'use strict';
/*
 * Kiss Cut server: serves the single-page app and stores shareable projects.
 * No dependencies. Projects live on disk under DATA_DIR/projects/<id>/:
 *   meta.json   ids, timestamps, image info, hash of the owner's edit token
 *   state.json  settings, palette edits, piece edits, view (what the app saves)
 *   image       the source image exactly as uploaded
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const num = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : +v);
const CFG = {
  port: num(process.env.PORT, 8080),
  dataDir: process.env.DATA_DIR || '/data',
  maxImageMB: num(process.env.MAX_IMAGE_MB, 25),
  maxStorageMB: num(process.env.MAX_STORAGE_MB, 0),       // 0 = no cap
  ttlDays: num(process.env.PROJECT_TTL_DAYS, 0),           // 0 = keep forever; otherwise days since last open or save
  savesPerHour: num(process.env.SAVES_PER_HOUR, 60),       // per client address; 0 = unlimited
  trustProxy: /^(1|true|yes|on)$/i.test(process.env.TRUST_PROXY || ''),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, '')
};
const VERSION = require('./package.json').version;
const PUBLIC = path.join(__dirname, 'public');
const PROJECTS = path.join(CFG.dataDir, 'projects');
const MAX_STATE = 2 * 1024 * 1024;
const MAX_IMAGE = CFG.maxImageMB * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9]{10}$/;
const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

fs.mkdirSync(PROJECTS, { recursive: true });
dropPrivileges();
const INDEX = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');

// When started as root (the Docker default), hand the data folder to PUID:PGID and run as that user.
// Unraid's shares use 99:100 (nobody:users).
function dropPrivileges() {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
  const uid = num(process.env.PUID, 1000), gid = num(process.env.PGID, 1000);
  if (uid === 0) return;
  const owned = (p) => { try { const st = fs.statSync(p); return st.uid === uid && st.gid === gid; } catch (e) { return false; } };
  if (!owned(CFG.dataDir) || !owned(PROJECTS)) {
    const walk = (p) => {
      try { fs.lchownSync(p, uid, gid); } catch (e) { console.error('kisscut: could not change the owner of', p, '-', e.code); return; }
      let st; try { st = fs.lstatSync(p); } catch (e) { return; }
      if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f));
    };
    walk(CFG.dataDir);
  }
  try { if (process.setgroups) process.setgroups([gid]); process.setgid(gid); process.setuid(uid); }
  catch (e) { console.error('kisscut: could not switch to', uid + ':' + gid, '-', e.message); }
}

// ------------------------------------------------------------------ helpers
function newId() {
  let s = '';
  while (s.length < 10) for (const v of crypto.randomBytes(16)) if (v < 248 && s.length < 10) s += B62[v % 62];
  return s;
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
const PAGE_CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "worker-src 'self' blob:", "style-src 'self' 'unsafe-inline'",
  "font-src 'self'", "img-src 'self' blob: data:", "connect-src 'self' blob: data:", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'"
].join('; ');

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({}, SECURITY, headers || {}));
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); }

function clientIp(req) {
  if (CFG.trustProxy) {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
    if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
  }
  return req.socket.remoteAddress || 'unknown';
}
function origin(req) {
  if (CFG.publicUrl) return CFG.publicUrl;
  const proto = CFG.trustProxy && req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : 'http';
  const host = (CFG.trustProxy && req.headers['x-forwarded-host']) || req.headers.host || 'localhost';
  return proto + '://' + host;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const len = +req.headers['content-length'];
    if (len > limit) { reject(new HttpError(413, 'That upload is too large. The limit is ' + CFG.maxImageMB + ' MB.')); req.resume(); return; }
    const chunks = []; let size = 0, done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; reject(new HttpError(413, 'That upload is too large. The limit is ' + CFG.maxImageMB + ' MB.')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

function sniffImage(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b.toString('latin1', 0, 6) === 'GIF87a' || b.toString('latin1', 0, 6) === 'GIF89a') return 'image/gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('latin1', 4, 8) === 'ftyp' && /^avi[fs]$/.test(b.toString('latin1', 8, 12))) return 'image/avif';
  if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
  return null;
}

// body = state JSON (x-state-length bytes) followed by the image bytes (may be empty on an update)
function parseEnvelope(req, buf) {
  const sl = +req.headers['x-state-length'];
  if (!(sl > 0) || sl > MAX_STATE || sl > buf.length) throw new HttpError(400, 'The project data is missing or too large.');
  let state;
  try { state = JSON.parse(buf.subarray(0, sl).toString('utf8')); } catch (e) { throw new HttpError(400, 'The project data isn\'t valid JSON.'); }
  if (!state || typeof state !== 'object' || state.app !== 'kisscut' || state.v !== 1) throw new HttpError(400, 'That isn\'t a Kiss Cut project.');
  const image = buf.subarray(sl);
  let type = null;
  if (image.length) { type = sniffImage(image); if (!type) throw new HttpError(415, 'The image must be PNG, JPEG, WebP, GIF, AVIF or BMP.'); }
  let name = 'image';
  try { name = decodeURIComponent(String(req.headers['x-image-name'] || 'image')).slice(0, 120); } catch (e) {}
  return { state: state, stateBuf: buf.subarray(0, sl), image: image, type: type, name: name };
}

async function writeAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}
const dirOf = (id) => path.join(PROJECTS, id);
async function readMeta(id) {
  if (!ID_RE.test(id)) return null;
  try { return JSON.parse(await fsp.readFile(path.join(dirOf(id), 'meta.json'), 'utf8')); } catch (e) { return null; }
}
function expired(meta) {
  if (!CFG.ttlDays) return false;
  const last = Date.parse(meta.accessed || meta.updated || meta.created);
  return Date.now() - last > CFG.ttlDays * 86400000;
}

// saves per hour per address
const buckets = new Map();
function rateCheck(req) {
  if (!CFG.savesPerHour) return;
  const ip = clientIp(req), t = Date.now(), b = buckets.get(ip) || { n: 0, reset: t + 3600000 };
  if (t > b.reset) { b.n = 0; b.reset = t + 3600000; }
  b.n++; buckets.set(ip, b);
  if (b.n > CFG.savesPerHour) throw new HttpError(429, 'Too many saves from this address. Try again in a little while.');
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t > b.reset) buckets.delete(k); }, 600000).unref();

let usageCache = { at: 0, bytes: 0 };
async function storageBytes() {
  if (Date.now() - usageCache.at < 60000) return usageCache.bytes;
  let total = 0;
  for (const id of await fsp.readdir(PROJECTS).catch(() => [])) {
    for (const f of await fsp.readdir(dirOf(id)).catch(() => [])) { const st = await fsp.stat(path.join(dirOf(id), f)).catch(() => null); if (st) total += st.size; }
  }
  usageCache = { at: Date.now(), bytes: total };
  return total;
}

// ------------------------------------------------------------------ API
async function createProject(req, res) {
  rateCheck(req);
  if (CFG.maxStorageMB && (await storageBytes()) > CFG.maxStorageMB * 1048576) throw new HttpError(507, 'This server is out of space for new projects.');
  const env = parseEnvelope(req, await readBody(req, MAX_IMAGE + MAX_STATE));
  if (!env.image.length) throw new HttpError(400, 'A new project needs its image.');
  let id = newId();
  while (fs.existsSync(dirOf(id))) id = newId();
  const token = crypto.randomBytes(24).toString('base64url');
  const meta = {
    id: id, created: now(), updated: now(), accessed: now(), tokenHash: sha(token), revision: 1,
    forkOf: ID_RE.test(String(env.state.forkOf || '')) ? env.state.forkOf : null,
    image: { type: env.type, size: env.image.length, name: env.name, sha: sha(env.image).slice(0, 16) }
  };
  await fsp.mkdir(dirOf(id), { recursive: true });
  await writeAtomic(path.join(dirOf(id), 'image'), env.image);
  await writeAtomic(path.join(dirOf(id), 'state.json'), env.stateBuf);
  await writeAtomic(path.join(dirOf(id), 'meta.json'), JSON.stringify(meta));
  usageCache.at = 0;
  console.log(now(), 'created', id, meta.forkOf ? '(copy of ' + meta.forkOf + ')' : '', Math.round(env.image.length / 1024) + ' KB', clientIp(req));
  json(res, 201, { id: id, token: token, url: origin(req) + '/p/' + id, revision: 1, updated: meta.updated });
}

async function updateProject(req, res, id) {
  const meta = await readMeta(id);
  if (!meta || expired(meta)) throw new HttpError(404, 'That project doesn\'t exist anymore.');
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ok = auth && crypto.timingSafeEqual(Buffer.from(sha(auth), 'hex'), Buffer.from(meta.tokenHash, 'hex'));
  if (!ok) throw new HttpError(403, 'Only the person who first saved this link can update it. Saving makes your own copy instead.');
  rateCheck(req);
  const env = parseEnvelope(req, await readBody(req, MAX_IMAGE + MAX_STATE));
  if (env.image.length) {
    await writeAtomic(path.join(dirOf(id), 'image'), env.image);
    meta.image = { type: env.type, size: env.image.length, name: env.name, sha: sha(env.image).slice(0, 16) };
  }
  await writeAtomic(path.join(dirOf(id), 'state.json'), env.stateBuf);
  meta.updated = meta.accessed = now(); meta.revision = (meta.revision || 1) + 1;
  await writeAtomic(path.join(dirOf(id), 'meta.json'), JSON.stringify(meta));
  usageCache.at = 0;
  console.log(now(), 'updated', id, 'rev', meta.revision);
  json(res, 200, { id: id, url: origin(req) + '/p/' + id, revision: meta.revision, updated: meta.updated });
}

async function getProject(req, res, id) {
  const meta = await readMeta(id);
  if (!meta || expired(meta)) throw new HttpError(404, 'That project doesn\'t exist anymore.');
  const state = JSON.parse(await fsp.readFile(path.join(dirOf(id), 'state.json'), 'utf8'));
  if (Date.now() - Date.parse(meta.accessed || 0) > 3600000) { meta.accessed = now(); writeAtomic(path.join(dirOf(id), 'meta.json'), JSON.stringify(meta)).catch(() => {}); }
  json(res, 200, {
    id: id, created: meta.created, updated: meta.updated, revision: meta.revision || 1, forkOf: meta.forkOf || null,
    image: { type: meta.image.type, size: meta.image.size, name: meta.image.name, url: '/api/projects/' + id + '/image?v=' + meta.image.sha },
    state: state
  });
}

async function getImage(req, res, id) {
  const meta = await readMeta(id);
  if (!meta || expired(meta)) throw new HttpError(404, 'Not found');
  const etag = '"' + meta.image.sha + '"';
  if (req.headers['if-none-match'] === etag) { send(res, 304, '', { ETag: etag }); return; }
  const buf = await fsp.readFile(path.join(dirOf(id), 'image'));
  send(res, 200, buf, {
    'Content-Type': meta.image.type, 'Content-Length': buf.length, ETag: etag,
    'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'; sandbox"
  });
}

// ------------------------------------------------------------------ static
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
async function serveIndex(req, res, id) {
  let html = INDEX;
  if (id) {
    const meta = await readMeta(id);
    if (meta && !expired(meta)) {
      const o = origin(req), title = (meta.image.name || 'Design').replace(/\.[a-z0-9]+$/i, '') + ' · Kiss Cut';
      html = html.replace('</title>', '</title>\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="A layered vinyl design. Open it to pick up where it was left off.">\n<meta property="og:image" content="' + esc(o + '/api/projects/' + id + '/image?v=' + meta.image.sha) + '">\n<meta property="og:url" content="' + esc(o + '/p/' + id) + '">\n<meta name="twitter:card" content="summary_large_image">');
    }
  }
  send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Security-Policy': PAGE_CSP });
}
async function serveStatic(req, res, urlPath) {
  const file = path.normalize(path.join(PUBLIC, decodeURIComponent(urlPath)));
  if (!file.startsWith(PUBLIC + path.sep)) throw new HttpError(404, 'Not found');
  const st = await fsp.stat(file).catch(() => null);
  if (!st || !st.isFile()) throw new HttpError(404, 'Not found');
  const ext = path.extname(file).toLowerCase();
  send(res, 200, await fsp.readFile(file), { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800' });
}

// ------------------------------------------------------------------ router
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  try {
    if (p === '/api/health') return json(res, 200, { ok: true, app: 'kisscut', version: VERSION, maxImageMB: CFG.maxImageMB, ttlDays: CFG.ttlDays });
    if (p === '/api/projects' && m === 'POST') return await createProject(req, res);
    let r = /^\/api\/projects\/([A-Za-z0-9]{10})$/.exec(p);
    if (r && m === 'GET') return await getProject(req, res, r[1]);
    if (r && m === 'PUT') return await updateProject(req, res, r[1]);
    r = /^\/api\/projects\/([A-Za-z0-9]{10})\/image$/.exec(p);
    if (r && (m === 'GET' || m === 'HEAD')) return await getImage(req, res, r[1]);
    if (p.startsWith('/api/')) throw new HttpError(404, 'Not found');
    if (m !== 'GET' && m !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (p === '/' || p === '/index.html') return await serveIndex(req, res, null);
    r = /^\/p\/([A-Za-z0-9]{10})\/?$/.exec(p);
    if (r) return await serveIndex(req, res, r[1]);
    return await serveStatic(req, res, p);
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 500;
    if (code === 500) console.error(now(), 'error', m, p, e && e.stack);
    if (!res.headersSent) {
      if (p.startsWith('/api/')) json(res, code, { error: code === 500 ? 'Something went wrong on the server.' : e.message });
      else send(res, code, code === 404 ? 'Not found' : 'Error', { 'Content-Type': 'text/plain; charset=utf-8' });
    } else res.end();
  }
});
server.requestTimeout = 120000;
server.headersTimeout = 30000;

// ------------------------------------------------------------------ housekeeping
async function sweep() {
  if (!CFG.ttlDays) return;
  let removed = 0;
  for (const id of await fsp.readdir(PROJECTS).catch(() => [])) {
    const meta = await readMeta(id);
    if (meta && expired(meta)) { await fsp.rm(dirOf(id), { recursive: true, force: true }); removed++; }
  }
  if (removed) console.log(now(), 'expired', removed, 'project(s) unopened for', CFG.ttlDays, 'days');
}
setInterval(sweep, 6 * 3600000).unref();
sweep();

server.listen(CFG.port, () => {
  console.log(now(), 'Kiss Cut', VERSION, 'listening on', CFG.port, '| data', CFG.dataDir, '| image limit', CFG.maxImageMB + ' MB',
    '| keep', CFG.ttlDays ? CFG.ttlDays + ' days' : 'forever', '| saves/hour', CFG.savesPerHour || 'unlimited', CFG.trustProxy ? '| behind proxy' : '');
});
const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
