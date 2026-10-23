(function () {
  'use strict';
  var KC = window.KC;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ------------------------------------------------------------ icons
  var IC = {
    open: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 16l4.5-4.5 3.5 3.5 2.5-2.5 6.5 6"/><circle cx="15.5" cy="9" r="1.6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
    download: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/>',
    pipette: '<path d="M14.5 6.5l3 3"/><path d="M19.6 4.4a2.1 2.1 0 010 3l-2.1 2.1-3-3 2.1-2.1a2.1 2.1 0 013 0z"/><path d="M15.5 10.5L7 19H5v-2l8.5-8.5"/>',
    wand: '<path d="M5 19L15.5 8.5"/><path d="M14 7l3 3"/><path d="M18 3v3M16.5 4.5h3M20 10v2M19 11h2M10 3v2M9 4h2"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M4 4l16 16"/><path d="M9.9 5.8A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-3 3.7M6.3 7.6C3.9 9.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 004.1-1"/><path d="M9.9 9.9a2.8 2.8 0 004.2 3.7"/>',
    scissors: '<circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.2 8L20 18M8.2 16L20 6"/>',
    noCut: '<circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.2 8l3.5 3M8.2 16L20 6"/><path d="M3 21L21 3" stroke-dasharray="0"/>',
    up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>',
    dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    split: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    merge: '<path d="M6 4v5a6 6 0 006 6h6"/><path d="M15 12l3 3-3 3"/><path d="M18 4v5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    link: '<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.2-1.2"/>',
    fill: '<path d="M5 13l7-7 7 7-7 7z"/><path d="M19.5 17.5a1.8 1.8 0 11-3.6 0c0-1.2 1.8-3 1.8-3s1.8 1.8 1.8 3z"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }
  $$('[data-icon]').forEach(function (el) { el.outerHTML = icon(el.getAttribute('data-icon')); });

  // ------------------------------------------------------------ settings
  var LS_KEY = 'kisscut.settings.v1';
  var DEFAULTS = { quality: 'standard', denoise: 2, bgMode: 'auto', bgTol: 10, bgGradient: true, bgGlobal: false, K: 6, smooth: 50, corners: 58, minPieceMm: 1.5, precision: 50, widthIn: 10, layerMode: 'overlap', trapMm: 1.0, marks: false, shirt: '#F3F3F0', view: 'compare' };
  var S = Object.assign({}, DEFAULTS);
  try { var saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); for (var k in DEFAULTS) if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) S[k] = saved[k]; } catch (e) {}
  S.locked = []; S.bgColor = null;
  function persist() { try { var o = {}; for (var k in DEFAULTS) o[k] = S[k]; localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }
  function saveSettings() { persist(); markDirty(); }
  var QUALITY = { fast: 800, standard: 1200, max: 1800 };

  function engineSettings() {
    var s = S.smooth / 100, prec = S.precision / 100;
    return {
      denoise: S.denoise, bgMode: S.bgMode, bgTol: S.bgTol, bgGradient: S.bgGradient, bgGlobal: S.bgGlobal, bgColor: S.bgColor,
      K: S.K, locked: S.locked.map(function (l) { return { lab: l.lab, hex: l.hex }; }),
      labelSigma: 0.6 + 1.8 * s, curveSigma: 1.0 + 5.0 * s, tolerance: (0.35 + 0.6 * s) * (1.5 - prec),
      cornerDeg: S.corners <= 0 ? 181 : 100 - 0.6 * S.corners,
      minPieceMm: S.minPieceMm, widthIn: S.widthIn, layerMode: S.layerMode, trapMm: S.trapMm
    };
  }
  function quantSig() { return JSON.stringify([S.quality, S.denoise, S.bgMode, S.bgTol, S.bgGradient, S.bgGlobal, S.bgColor, S.K, S.locked.map(function (l) { return l.lab; }), imgVersion]); }

  // ------------------------------------------------------------ engine (worker, with in-page fallback)
  var engine = null, usingWorker = false, lastImageMsg = null;
  function startEngine() {
    var src = document.getElementById('kc-engine').textContent;
    try {
      var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = onEngine;
      w.onerror = function (e) { if (usingWorker) { e.preventDefault && e.preventDefault(); useLocal(); } };
      engine = { post: function (m, t) { w.postMessage(m, t || []); } };
      usingWorker = true;
    } catch (e) { useLocal(); }
  }
  function useLocal() {
    usingWorker = false;
    var h = KC.createPipeline(function (m) { setTimeout(function () { onEngine({ data: m }); }, 0); });
    engine = { post: function (m) { setTimeout(function () { h(m); }, 0); } };
    if (lastImageMsg) { engine.post(lastImageMsg); doRun(); }
  }

  // ------------------------------------------------------------ state
  var srcImg = null, srcBlob = null, pendingRestore = null, srcName = '', isSample = true, imgVersion = 0, W = 0, H = 0, workData = null;
  var result = null, cuts = null, runId = 0, runInfo = {}, needFit = true;
  var E = { qv: -1, map: null, meta: {}, order: [], overrides: [] };
  var undoStack = [];
  var view = { s: 1, tx: 0, ty: 0 }, splitFrac = 0.5;
  var pickMode = null, selected = null, hlId = null;

  // ------------------------------------------------------------ DOM refs
  var stage = $('#stage'), world = $('#world'), origImg = $('#origImg'), vecSvg = $('#vecSvg'), selSvg = $('#selSvg');
  var matCanvas = $('#matCanvas'), mctx = matCanvas.getContext('2d');

  // ------------------------------------------------------------ toast / progress
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }
  var progTimer = null;
  function showProgress(label, pct) {
    var p = $('#progress'); p.classList.add('on'); p.firstElementChild.style.setProperty('--p', pct + '%');
    $('#status').textContent = pct >= 100 ? '' : label + '…';
    clearTimeout(progTimer);
    if (pct >= 100) progTimer = setTimeout(function () { p.classList.remove('on'); p.firstElementChild.style.setProperty('--p', '0%'); }, 350);
  }

  // ------------------------------------------------------------ runs
  var runTimer = null;
  function requestRun(delay) { clearTimeout(runTimer); runTimer = setTimeout(doRun, delay == null ? 140 : delay); }
  function doRun() {
    if (!lastImageMsg || !engine) return;
    runId++;
    var sig = quantSig(), fresh = sig !== E.sig;
    var cutFlags = {}; Object.keys(E.meta).forEach(function (id) { if (!E.meta[id].cut) cutFlags[id] = false; });
    var edit = fresh ? { map: null, order: [], cut: {}, overrides: [] } : { map: E.map, order: E.order, cut: cutFlags, overrides: E.overrides };
    runInfo = { id: runId, fresh: fresh, sig: sig };
    engine.post({ type: 'run', runId: runId, settings: engineSettings(), edit: edit });
    showProgress('Working', 3);
  }

  function onEngine(ev) {
    var m = ev.data;
    if (m.type === 'progress') { if (m.runId === runId) showProgress(m.label, m.pct); return; }
    if (m.type === 'error') { if (m.runId === runId) { showProgress('', 100); toast('Processing failed: ' + m.message, 5000); console.error(m.stack); } return; }
    if (m.type === 'suggest') {
      if (m.K) { S.K = m.K; syncControls(); saveSettings(); requestRun(0); toast('Suggested ' + m.K + ' colors for this image'); }
      return;
    }
    if (m.type === 'result') {
      if (m.runId !== runId) return;
      var r = m.result;
      if (runInfo.id === m.runId && runInfo.fresh) { resetEdit(r, runInfo.sig); if (pendingRestore) applyRestore(r, pendingRestore); }
      result = r; cuts = r.cuts;
      if (needFit) { needFit = false; fitView(); }
      renderAll();
      return;
    }
    if (m.type === 'cuts') {
      if (m.runId !== runId || !result) return;
      cuts = m.cuts; renderCutDependent();
    }
  }

  function resetEdit(r, sig) {
    var meta = {};
    r.centers.forEach(function (c) { meta[c.id] = { hex: c.hex, name: c.name, visible: true, cut: true, lab: c.lab }; });
    E = { qv: r.qv, sig: sig, map: null, meta: meta, order: r.order.slice(), overrides: [] };
    undoStack = []; selected = null; hidePop(); syncUndo();
  }

  // ------------------------------------------------------------ edits + undo
  function snapshot() { return JSON.stringify({ map: E.map, meta: E.meta, order: E.order, overrides: E.overrides }); }
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); syncUndo(); markDirty(); }
  function syncUndo() { $('#btnUndo').disabled = !undoStack.length; }
  function undo() {
    if (!undoStack.length) return;
    markDirty();
    var s = JSON.parse(undoStack.pop());
    var needRun = JSON.stringify([s.map, s.order, s.overrides, cutList(s.meta)]) !== JSON.stringify([E.map, E.order, E.overrides, cutList(E.meta)]);
    E.map = s.map; E.meta = s.meta; E.order = s.order; E.overrides = s.overrides;
    syncUndo(); hidePop(); selected = null;
    if (needRun) requestRun(0); renderAll();
  }
  function cutList(meta) { return Object.keys(meta).filter(function (k) { return !meta[k].cut; }).sort().join(','); }
  function ensureMap() { if (!E.map) { E.map = []; for (var i = 0; i < result.K; i++) E.map.push(i); } }
  function liveIds() { return E.order.filter(function (id) { return E.meta[id] && result && result.layers[id] && result.layers[id].area > 0; }); }

  function mergeLayer(from, to) {
    pushUndo(); ensureMap();
    for (var i = 0; i < E.map.length; i++) if (E.map[i] === from) E.map[i] = to;
    E.overrides.forEach(function (o) { if (o.to === from) o.to = to; });
    E.order = E.order.filter(function (id) { return id !== from; });
    toast(E.meta[from].name + ' merged into ' + E.meta[to].name);
    requestRun(0);
  }
  function removeLayer(id) {
    pushUndo(); ensureMap();
    for (var i = 0; i < E.map.length; i++) if (E.map[i] === id) E.map[i] = -1;
    E.overrides.forEach(function (o) { if (o.to === id) o.to = -1; });
    E.order = E.order.filter(function (x) { return x !== id; });
    toast(E.meta[id].name + ' removed. Undo brings it back.');
    requestRun(0);
  }
  function moveLayer(id, dir) {
    var i = E.order.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= E.order.length) return;
    pushUndo(); var t = E.order[i]; E.order[i] = E.order[j]; E.order[j] = t;
    renderAll(); requestRun(0);
  }
  function toggleCut(id) { pushUndo(); E.meta[id].cut = !E.meta[id].cut; renderAll(); requestRun(0); }
  function toggleVisible(id) { markDirty(); E.meta[id].visible = !E.meta[id].visible; renderVector(); renderLayerList(); renderShirt(); }
  function recolor(id, hex) { E.meta[id].hex = hex.toUpperCase(); E.meta[id].name = KC.nameOfLab(KC.labOfHex(hex)); renderAll(); }
  function lockLayer(id) {
    var m = E.meta[id]; markDirty();
    var i = S.locked.findIndex(function (l) { return l.hex === m.hex; });
    if (i >= 0) { S.locked.splice(i, 1); toast(m.name + ' is no longer held'); }
    else { S.locked.push({ lab: KC.labOfHex(m.hex), hex: m.hex }); toast(m.name + ' will be kept exactly when colors are re-detected'); }
    renderLocked(); requestRun();
  }
  function pieceEdit(x, y, to) {
    pushUndo(); E.overrides.push({ x: x, y: y, to: to });
    hidePop(); selected = null; renderSelection(); requestRun(0);
  }

  // ------------------------------------------------------------ image loading
  function loadImgFromUrl(url) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = url; });
  }
  async function openFile(file) {
    if (!file) return;
    if (file.type && file.type.indexOf('image/') !== 0) { toast('That file isn\'t an image. Use PNG, JPG, WebP or SVG.', 4000); return; }
    var url = URL.createObjectURL(file);
    try { var im = await loadImgFromUrl(url); newProject(); setImage(im, url, file.name || 'pasted-image.png', false, file); }
    catch (e) { toast('This browser couldn\'t open that file. Try PNG, JPG, WebP or SVG.', 4500); }
  }
  function setImage(im, url, name, sample, blob, restore) {
    srcImg = im; srcName = name; isSample = sample; srcBlob = blob || null; imgVersion++;
    S.locked = restore ? (restore.locked || []) : []; S.bgColor = restore ? (restore.bgColor || null) : null; renderLocked();
    pendingRestore = restore || null;
    project.imageSaved = !!restore;
    renderFileName();
    origImg.src = url;
    prepareWork();
  }
  function prepareWork() {
    if (!srcImg) return;
    var iw = srcImg.naturalWidth || srcImg.width || 1000, ih = srcImg.naturalHeight || srcImg.height || 1000;
    var target = QUALITY[S.quality] || 1200, sc = target / Math.max(iw, ih);
    W = Math.max(8, Math.round(iw * sc)); H = Math.max(8, Math.round(ih * sc));
    // halve in steps for big downsizes so fine detail averages instead of aliasing
    var src = srcImg, sw = iw, sh = ih;
    while (sw / 2 > W * 1.2) {
      var c0 = document.createElement('canvas'); c0.width = Math.round(sw / 2); c0.height = Math.round(sh / 2);
      var x0 = c0.getContext('2d'); x0.imageSmoothingQuality = 'high'; x0.drawImage(src, 0, 0, c0.width, c0.height);
      src = c0; sw = c0.width; sh = c0.height;
    }
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var cx = c.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, 0, 0, W, H);
    workData = cx.getImageData(0, 0, W, H);
    origImg.style.width = W + 'px'; origImg.style.height = H + 'px';
    vecSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); vecSvg.style.width = W + 'px'; vecSvg.style.height = H + 'px';
    selSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); selSvg.style.width = W + 'px'; selSvg.style.height = H + 'px';
    var buf = workData.data.buffer.slice(0);
    lastImageMsg = { type: 'image', rgba: buf, W: W, H: H };
    imgVersion++;
    result = null; cuts = null; needFit = true; E.sig = null; selected = null; hidePop();
    vecSvg.innerHTML = ''; selSvg.innerHTML = '';
    if (usingWorker) engine.post({ type: 'image', rgba: buf.slice(0), W: W, H: H }, []);
    else engine.post({ type: 'image', rgba: buf.slice(0), W: W, H: H });
    $('#outRes').textContent = W + ' × ' + H + ' px';
    renderAll(); doRun();
  }

  // a sample badge, drawn here and roughed up into a real JPEG so the cleanup has something to do
  async function makeSample() {
    try { await document.fonts.load('800 80px Archivo'); } catch (e) {}
    var N = 1000, c = document.createElement('canvas'); c.width = N; c.height = N;
    var g = c.getContext('2d'), cx = N / 2, cy = N / 2;
    g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, N, N);
    var ring = '#1F3B4A', cream = '#F4E4C4', sun = '#EC7A4E', pine = '#2E6A50', water = ring, white = cream;
    g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, 450, 0, 7); g.fill();
    g.fillStyle = cream; g.beginPath(); g.arc(cx, cy, 352, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, 352, 0, 7); g.clip();
    g.fillStyle = sun; g.beginPath(); g.arc(cx + 70, cy - 70, 118, 0, 7); g.fill();
    g.fillStyle = pine;
    var tree = function (x, base, h, w) { g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + w / 2, base); g.lineTo(x - w / 2, base); g.closePath(); g.fill(); g.fillRect(x - w * 0.07, base - 4, w * 0.14, 26); };
    tree(cx - 175, cy + 150, 300, 150); tree(cx - 70, cy + 150, 220, 112); tree(cx + 205, cy + 150, 250, 126);
    g.fillStyle = water; g.fillRect(cx - 360, cy + 150, 720, 260);
    g.strokeStyle = white; g.lineWidth = 15; g.lineCap = 'round';
    for (var row = 0; row < 3; row++) {
      g.beginPath(); var y = cy + 200 + row * 52, off = row % 2 ? 40 : 0;
      for (var x = cx - 330 + off; x < cx + 330; x += 4) { var yy = y + Math.sin((x - off) / 34) * 9; if (x === cx - 330 + off) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    }
    g.restore();
    var arcText = function (txt, radius, mid, size, flip) {
      g.font = '800 ' + size + 'px Archivo, "Arial Black", Arial, sans-serif'; g.fillStyle = cream; g.textAlign = 'center'; g.textBaseline = 'middle';
      var spacing = size * 0.16, widths = txt.split('').map(function (ch) { return g.measureText(ch).width + spacing; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) - spacing, ang = mid - (flip ? -1 : 1) * total / radius / 2;
      txt.split('').forEach(function (ch, i) {
        var a = ang + (flip ? -1 : 1) * widths[i] / 2 / radius;
        g.save(); g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); g.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2)); g.fillText(ch, 0, 0); g.restore();
        ang += (flip ? -1 : 1) * widths[i] / radius;
      });
    };
    arcText('SALT & PINE', 401, -Math.PI / 2, 68, false);
    arcText('EST · 2026', 401, Math.PI / 2, 52, true);
    // rough it up: soften, add sensor-ish noise, then save as a low-quality JPEG
    var d = g.getImageData(0, 0, N, N), px = d.data, seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var i = 0; i < px.length; i += 4) { var n = (rnd() - 0.5) * 22; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
    g.putImageData(d, 0, 0);
    var c2 = document.createElement('canvas'); c2.width = 820; c2.height = 820;
    var g2 = c2.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(c, 0, 0, 820, 820);
    var blob = await new Promise(function (r) { c2.toBlob(r, 'image/jpeg', 0.55); });
    var url = URL.createObjectURL(blob), im = await loadImgFromUrl(url);
    newProject(); setImage(im, url, 'salt-and-pine-badge.jpg', true, blob);
  }

  // ------------------------------------------------------------ geometry helpers
  function bbox() { return result && result.bbox ? result.bbox : [0, 0, W, H]; }
  function ppi() { var b = bbox(); return Math.max(1, b[2] - b[0]) / S.widthIn; }
  function designSizeIn() { var b = bbox(), p = ppi(); return [(b[2] - b[0]) / p, (b[3] - b[1]) / p]; }
  function fmtIn(v) { return v.toFixed(v < 10 ? 2 : 1); }

  // ------------------------------------------------------------ view transform
  function stageSize() { return [stage.clientWidth, stage.clientHeight]; }
  function applyView() {
    world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.s + ')';
    $('#zPct').textContent = Math.round(view.s * 100) + '%';
    drawMat(); updateCompare(); renderSelection(); placePop();
  }
  function fitView() {
    var sz = stageSize(); if (!sz[0] || !W) return;
    var b = result ? bbox() : [0, 0, W, H];
    var pad = result ? 1.05 * ppi() : 0, bw = b[2] - b[0] + pad * 2, bh = b[3] - b[1] + pad * 2;
    var margin = sz[0] < 500 ? 8 : 16;
    view.s = Math.min((sz[0] - margin * 2) / bw, (sz[1] - margin * 2) / bh);
    view.tx = (sz[0] - bw * view.s) / 2 - (b[0] - pad) * view.s;
    view.ty = (sz[1] - bh * view.s) / 2 - (b[1] - pad) * view.s;
    applyView();
  }
  function zoomAt(f, sx, sy) {
    var ns = clamp(view.s * f, 0.05, 40); f = ns / view.s;
    view.tx = sx - (sx - view.tx) * f; view.ty = sy - (sy - view.ty) * f; view.s = ns; applyView();
  }
  function toWorld(clientX, clientY) { var r = stage.getBoundingClientRect(); return [(clientX - r.left - view.tx) / view.s, (clientY - r.top - view.ty) / view.s]; }

  // ------------------------------------------------------------ cutting mat
  var themeColors = {};
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    ['--paper', '--mat', '--mat-edge', '--mat-line', '--mat-inch', '--mat-num', '--ink-3'].forEach(function (k) { themeColors[k] = cs.getPropertyValue(k).trim(); });
  }
  function drawMat() {
    var sz = stageSize(), dpr = window.devicePixelRatio || 1;
    if (matCanvas.width !== Math.round(sz[0] * dpr) || matCanvas.height !== Math.round(sz[1] * dpr)) { matCanvas.width = Math.round(sz[0] * dpr); matCanvas.height = Math.round(sz[1] * dpr); }
    var g = mctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = themeColors['--paper'] || '#eee'; g.fillRect(0, 0, sz[0], sz[1]);
    if (!result || S.view === 'sheets' || S.view === 'shirt') return;
    var b = bbox(), p = ppi(), ds = designSizeIn();
    var mw = Math.max(12, Math.ceil(ds[0] + 1)), mh = Math.max(12, Math.ceil(ds[1] + 1));
    var X = (b[0] - 0.5 * p) * view.s + view.tx, Y = (b[1] - 0.5 * p) * view.s + view.ty, sp = p * view.s, MW = mw * sp, MH = mh * sp;
    var pad = 0.45 * sp;
    g.save();
    g.fillStyle = themeColors['--mat'];
    roundRect(g, X - pad, Y - pad, MW + pad * 2, MH + pad * 2, Math.min(18, sp * 0.4)); g.fill();
    g.strokeStyle = themeColors['--mat-edge']; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.rect(X, Y, MW, MH); g.clip();
    var drawLines = function (step, color, width) {
      g.strokeStyle = color; g.lineWidth = width; g.beginPath();
      for (var i = 0; i <= mw / step + 0.5; i++) { var x = Math.round(X + i * step * sp) + 0.5; g.moveTo(x, Y); g.lineTo(x, Y + MH); }
      for (var j = 0; j <= mh / step + 0.5; j++) { var y = Math.round(Y + j * step * sp) + 0.5; g.moveTo(X, y); g.lineTo(X + MW, y); }
      g.stroke();
    };
    if (sp / 4 >= 7) drawLines(0.25, themeColors['--mat-line'], 1);
    else if (sp / 2 >= 7) drawLines(0.5, themeColors['--mat-line'], 1);
    if (sp >= 5) drawLines(1, themeColors['--mat-inch'], 1);
    g.restore();
    // ruler numbers in the mat border, like the printed scale on a real mat
    if (sp >= 9) {
      g.fillStyle = themeColors['--mat-num']; g.font = '500 ' + clamp(sp * 0.18, 8, 11) + 'px "IBM Plex Mono", ui-monospace, monospace';
      var every = sp >= 22 ? 1 : sp >= 12 ? 2 : 3;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (var i = every; i < mw; i += every) g.fillText(String(i), X + i * sp, Y - pad / 2);
      g.textAlign = 'center';
      for (var j = every; j < mh; j += every) g.fillText(String(j), X - pad / 2, Y + j * sp);
      g.textAlign = 'right'; g.textBaseline = 'alphabetic';
      if (sp >= 14) g.fillText(mw + ' × ' + mh + ' in mat', X + MW, Y + MH + pad * 0.72);
    }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ------------------------------------------------------------ vector preview
  function hatchDef(id, hex) {
    return '<pattern id="hatch' + id + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="' + hex + '" opacity="0.28"/><rect width="2.4" height="7" fill="' + hex + '" opacity="0.85"/></pattern>';
  }
  function stackIds() {
    if (!result) return [];
    var ids = liveIds();
    result.layers.forEach(function (l) { if (l.area > 0 && ids.indexOf(l.id) < 0 && E.meta[l.id]) ids.push(l.id); });
    return ids;
  }
  function renderVector() {
    if (!result) { vecSvg.innerHTML = ''; return; }
    var defs = '', body = '';
    stackIds().forEach(function (id) {
      var l = result.layers[id], m = E.meta[id];
      if (!m.visible) return;
      var fill = m.hex, stroke = ' stroke="' + m.hex + '" stroke-width="0.7" stroke-linejoin="round"';
      if (!m.cut) { defs += hatchDef(id, m.hex); fill = 'url(#hatch' + id + ')'; stroke = ''; }
      body += '<path data-id="' + id + '"' + (hlId === id ? ' class="hl"' : '') + ' fill="' + fill + '" fill-rule="evenodd"' + stroke + ' d="' + l.d + '"/>';
    });
    vecSvg.innerHTML = (defs ? '<defs>' + defs + '</defs>' : '') + body;
    if (hlId != null) vecSvg.setAttribute('data-hl', '1'); else vecSvg.removeAttribute('data-hl');
  }
  function setHighlight(id) {
    hlId = id;
    if (id == null) vecSvg.removeAttribute('data-hl'); else vecSvg.setAttribute('data-hl', '1');
    $$('path', vecSvg).forEach(function (p) { p.classList.toggle('hl', +p.getAttribute('data-id') === id); });
    $$('.layer', $('#layerList')).forEach(function (li) { li.classList.toggle('hl', +li.dataset.id === id); });
  }

  function updateCompare() {
    var cmp = S.view === 'compare', vec = S.view === 'vector', canvasView = cmp || vec;
    world.style.display = canvasView ? '' : 'none';
    $('#split').hidden = !cmp || !result; $('#lblL').hidden = !cmp || !result; $('#lblR').hidden = !cmp || !result;
    $('#zoomBar').style.visibility = canvasView ? '' : 'hidden';
    origImg.style.visibility = cmp ? '' : 'hidden';
    if (cmp) {
      var sx = stageSize()[0] * splitFrac, wx = clamp((sx - view.tx) / view.s, 0, W);
      vecSvg.style.clipPath = 'inset(0 0 0 ' + wx + 'px)';
      origImg.style.clipPath = 'inset(0 ' + (W - wx) + 'px 0 0)';
      $('#split').style.left = sx + 'px';
    } else { vecSvg.style.clipPath = ''; origImg.style.clipPath = ''; }
  }

  // ------------------------------------------------------------ piece selection
  function pieceAt(wx, wy) {
    if (!result) return null;
    var c = result.crop, x = Math.floor(wx) - c.x, y = Math.floor(wy) - c.y;
    if (x < 0 || y < 0 || x >= c.w || y >= c.h) return { label: -1, outside: true, x: Math.floor(wx), y: Math.floor(wy) };
    var lab = result.labels[y * c.w + x];
    // flood the connected piece to get its outline and size
    var mask = new Uint8Array(c.w * c.h), st = [y * c.w + x], area = 0, x0 = x, y0 = y, x1 = x, y1 = y, L = result.labels;
    mask[st[0]] = 1;
    while (st.length) {
      var p = st.pop(), px = p % c.w, py = (p - px) / c.w; area++;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      if (px > 0 && !mask[p - 1] && L[p - 1] === lab) { mask[p - 1] = 1; st.push(p - 1); }
      if (px < c.w - 1 && !mask[p + 1] && L[p + 1] === lab) { mask[p + 1] = 1; st.push(p + 1); }
      if (py > 0 && !mask[p - c.w] && L[p - c.w] === lab) { mask[p - c.w] = 1; st.push(p - c.w); }
      if (py < c.h - 1 && !mask[p + c.w] && L[p + c.w] === lab) { mask[p + c.w] = 1; st.push(p + c.w); }
    }
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1, sub = new Uint8Array(bw * bh);
    for (var yy = 0; yy < bh; yy++) for (var xx = 0; xx < bw; xx++) sub[yy * bw + xx] = mask[(yy + y0) * c.w + xx + x0];
    var d = KC.traceMask(sub, bw, bh, { sigma: 1.2, cornerDeg: 70, tol: 0.6, offX: x0 + c.x, offY: y0 + c.y }).d;
    return { label: lab, area: area, d: d, x: Math.floor(wx), y: Math.floor(wy), touchesEdge: x0 === 0 || y0 === 0 || x1 === c.w - 1 || y1 === c.h - 1 };
  }
  function renderSelection() {
    if (!selected || !selected.d || !(S.view === 'compare' || S.view === 'vector')) { selSvg.innerHTML = ''; return; }
    var w = 2 / view.s;
    selSvg.innerHTML = '<path d="' + selected.d + '" fill="none" stroke="var(--raised)" stroke-width="' + (w * 2.4) + '" stroke-linejoin="round"/>' +
      '<path d="' + selected.d + '" fill="none" stroke="var(--accent)" stroke-width="' + w + '" stroke-dasharray="' + (w * 3) + ' ' + (w * 2) + '" stroke-linejoin="round"/>';
  }
  var popAnchor = null;
  function showPiecePop(sel, clientX, clientY) {
    var pop = $('#piecePop'), p2 = ppi() * ppi();
    var others = stackIds().filter(function (id) { return id !== sel.label; }).slice().reverse();
    var sw = function (id) { var m = E.meta[id]; return '<button type="button" data-to="' + id + '" style="--c:' + m.hex + '" title="' + esc(m.name) + ' ' + m.hex + '" aria-label="Make it ' + esc(m.name) + '"></button>'; };
    var html;
    if (sel.label < 0) {
      if (sel.outside || sel.touchesEdge) { html = '<div class="pop-head"><i class="none"></i><div><div class="pop-title">Background</div><div class="pop-sub">Not cut</div></div></div>'; }
      else {
        html = '<div class="pop-head"><i class="none"></i><div><div class="pop-title">Empty area</div><div class="pop-sub">' + (sel.area / p2).toFixed(2) + ' sq in, not cut</div></div></div>' +
          '<div class="pop-label">Fill it with</div><div class="swatches">' + others.map(sw).join('') + '</div>';
      }
    } else {
      var m = E.meta[sel.label];
      html = '<div class="pop-head"><i style="--c:' + m.hex + '"></i><div style="min-width:0"><div class="pop-title">' + esc(m.name) + ' piece</div><div class="pop-sub">' + (sel.area / p2).toFixed(2) + ' sq in</div></div></div>' +
        '<button class="btn sm danger" type="button" data-to="-1">' + icon('trash') + 'Delete this piece</button>' +
        (others.length ? '<div class="pop-label">Change it to</div><div class="swatches">' + others.map(sw).join('') + '</div>' : '');
    }
    pop.innerHTML = html; pop.hidden = false;
    popAnchor = toWorld(clientX, clientY);
    $$('[data-to]', pop).forEach(function (b) { b.addEventListener('click', function () { pieceEdit(sel.x, sel.y, +b.getAttribute('data-to')); }); });
    placePop();
  }
  function placePop() {
    var pop = $('#piecePop'); if (pop.hidden || !popAnchor) return;
    var sz = stageSize(), sx = popAnchor[0] * view.s + view.tx, sy = popAnchor[1] * view.s + view.ty;
    var pw = pop.offsetWidth, ph = pop.offsetHeight, x = sx + 14, y = sy + 14;
    if (x + pw > sz[0] - 8) x = sx - pw - 14; if (y + ph > sz[1] - 8) y = sy - ph - 14;
    pop.style.left = clamp(x, 8, Math.max(8, sz[0] - pw - 8)) + 'px'; pop.style.top = clamp(y, 8, Math.max(8, sz[1] - ph - 8)) + 'px';
  }
  function hidePop() { $('#piecePop').hidden = true; popAnchor = null; }

  // ------------------------------------------------------------ pointer handling on the stage
  var pointers = new Map(), drag = null;
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.pop, .split, .overlay-view')) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    else if (pointers.size === 2) { var pts = Array.from(pointers.values()); drag = { pinch: true, d: dist(pts[0], pts[1]), s: view.s, tx: view.tx, ty: view.ty, c: mid(pts[0], pts[1]), moved: true }; }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId) || !drag) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.pinch && pointers.size >= 2) {
      var pts = Array.from(pointers.values()), r = stage.getBoundingClientRect(), c = mid(pts[0], pts[1]);
      var ns = clamp(drag.s * dist(pts[0], pts[1]) / drag.d, 0.05, 40), f = ns / drag.s;
      var cx = drag.c[0] - r.left, cy = drag.c[1] - r.top;
      view.s = ns; view.tx = cx - (cx - drag.tx) * f + (c[0] - drag.c[0]); view.ty = cy - (cy - drag.ty) * f + (c[1] - drag.c[1]); applyView();
      return;
    }
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; stage.classList.add('panning'); }
    if (drag.moved) { view.tx = drag.tx + dx; view.ty = drag.ty + dy; applyView(); }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      stage.classList.remove('panning');
      if (drag && !drag.moved && e.type === 'pointerup') stageClick(e);
      drag = null;
    } else if (pointers.size === 1) { var p = Array.from(pointers.values())[0]; drag = { x: p[0], y: p[1], tx: view.tx, ty: view.ty, moved: true }; }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  stage.addEventListener('wheel', function (e) {
    if (!(S.view === 'compare' || S.view === 'vector')) return;
    e.preventDefault();
    var r = stage.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    var mouseWheel = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
    if (e.ctrlKey || e.metaKey || mouseWheel) zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : (e.ctrlKey ? 0.01 : 0.0025))), sx, sy);
    else { view.tx -= e.deltaX; view.ty -= e.deltaY; applyView(); }
  }, { passive: false });

  function stageClick(e) {
    if (!(S.view === 'compare' || S.view === 'vector') || !W) return;
    var w = toWorld(e.clientX, e.clientY);
    if (pickMode) { pickAt(w[0], w[1]); return; }
    if (!result) return;
    var onMenu = !$('#piecePop').hidden;
    var sel = pieceAt(w[0], w[1]);
    if (!sel || (onMenu && selected && sel.label === selected.label && sel.d === selected.d)) { selected = null; hidePop(); renderSelection(); return; }
    selected = sel; renderSelection(); showPiecePop(sel, e.clientX, e.clientY);
  }

  // eyedropper
  function setPick(mode) {
    pickMode = mode; stage.classList.toggle('picking', !!mode);
    var b = $('#banner');
    if (mode) {
      if (S.view !== 'compare' && S.view !== 'vector') setView('compare');
      b.hidden = false; b.textContent = mode === 'bg' ? 'Click the background color · Esc to cancel' : 'Click a color in the image to add it · Esc to cancel';
      hidePop(); selected = null; renderSelection();
    } else b.hidden = true;
  }
  function sampleAt(wx, wy) {
    var x = clamp(Math.floor(wx), 0, W - 1), y = clamp(Math.floor(wy), 0, H - 1), r = 0, g = 0, b = 0, n = 0, d = workData.data;
    for (var yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++) for (var xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++) {
      var i = (yy * W + xx) * 4; if (d[i + 3] < 128) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return null;
    var rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)], lab = [0, 0, 0];
    KC.rgbToLab(rgb[0], rgb[1], rgb[2], lab, 0);
    return { lab: lab, hex: '#' + rgb.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('').toUpperCase() };
  }
  function pickAt(wx, wy) {
    var c = sampleAt(wx, wy), mode = pickMode; setPick(null);
    if (!c) { toast('That spot is transparent. Pick a visible color.'); return; }
    if (mode === 'bg') { S.bgColor = c.lab; S.bgMode = 'remove'; syncControls(); saveSettings(); requestRun(0); toast('Removing ' + c.hex + ' as the background'); return; }
    S.locked.push(c); S.K = clamp(Math.max(S.K + 1, S.locked.length), 2, 16); syncControls(); saveSettings(); renderLocked(); requestRun(0);
    toast('Added ' + c.hex + '. It stays fixed while the other colors adjust.');
  }
  function renderLocked() {
    var box = $('#lockedChips');
    box.innerHTML = S.locked.map(function (l, i) { return '<button type="button" class="chip" data-i="' + i + '" style="--c:' + l.hex + '" title="Stop holding this color"><i></i>' + l.hex + icon('x') + '</button>'; }).join('');
    $$('button', box).forEach(function (b) { b.addEventListener('click', function () { S.locked.splice(+b.dataset.i, 1); markDirty(); renderLocked(); requestRun(0); }); });
  }

  // ------------------------------------------------------------ layer list
  function renderLayerList() {
    var ol = $('#layerList');
    if (!result) { ol.innerHTML = '<li class="hint">Working…</li>'; return; }
    var ids = stackIds().slice().reverse(), tot = 0, p2 = ppi() * ppi();
    ids.forEach(function (id) { tot += result.layers[id].area; });
    var n = ids.length;
    ol.innerHTML = ids.map(function (id, k) {
      var l = result.layers[id], m = E.meta[id], cu = cuts && cuts[id], press = n - k;
      var isLocked = S.locked.some(function (x) { return x.hex === m.hex; });
      var pcs = cu ? cu.pieces : l.pieces, meta = m.hex + ' · ' + pcs + (pcs === 1 ? ' piece' : ' pieces');
      return '<li class="layer' + (m.cut ? '' : ' uncut') + (m.visible ? '' : ' hidden') + (hlId === id ? ' hl' : '') + '" data-id="' + id + '">' +
        '<label class="swatch" style="--c:' + m.hex + '" title="Change color"><input type="color" value="' + m.hex.toLowerCase() + '" aria-label="Color for ' + esc(m.name) + '">' + (m.cut ? '<b class="press-no" title="Press order">' + press + '</b>' : '') + '</label>' +
        '<div style="min-width:0"><div class="layer-name">' + esc(m.name) + (isLocked ? '<span class="lock-badge" title="Held exactly">' + icon('lock') + '</span>' : '') + '</div><div class="layer-meta">' + (m.cut ? '' : 'not cut · ') + meta + '</div></div>' +
        '<div class="layer-actions">' +
        '<button type="button" data-a="vis" aria-label="' + (m.visible ? 'Hide in preview' : 'Show in preview') + '" title="' + (m.visible ? 'Hide in preview' : 'Show in preview') + '">' + icon(m.visible ? 'eye' : 'eyeOff') + '</button>' +
        '<button type="button" data-a="cut" class="' + (m.cut ? '' : 'off') + '" aria-label="' + (m.cut ? 'Don\'t cut this color' : 'Cut this color') + '" title="' + (m.cut ? 'Cutting this color. Click to let the shirt show through instead.' : 'Not cut: the shirt shows through. Click to cut it.') + '">' + icon(m.cut ? 'scissors' : 'noCut') + '</button>' +
        '<span class="updown"><button type="button" data-a="up" aria-label="Move ' + esc(m.name) + ' up the stack"' + (k === 0 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
        '<button type="button" data-a="down" aria-label="Move ' + esc(m.name) + ' down the stack"' + (k === n - 1 ? ' disabled' : '') + '>' + icon('down') + '</button></span>' +
        '<button type="button" data-a="more" aria-label="More for ' + esc(m.name) + '">' + icon('dots') + '</button>' +
        '</div></li>';
    }).join('');
    $$('.layer', ol).forEach(function (li) {
      var id = +li.dataset.id;
      li.addEventListener('mouseenter', function () { setHighlight(id); });
      li.addEventListener('mouseleave', function () { setHighlight(null); });
      var ci = $('input[type=color]', li);
      ci.addEventListener('input', function () { E.meta[id].hex = ci.value.toUpperCase(); li.querySelector('.swatch').style.setProperty('--c', ci.value); renderVector(); });
      ci.addEventListener('change', function () { pushUndo(); recolor(id, ci.value); });
      $$('[data-a]', li).forEach(function (b) {
        b.addEventListener('click', function (ev) {
          var a = b.dataset.a;
          if (a === 'vis') toggleVisible(id); else if (a === 'cut') toggleCut(id);
          else if (a === 'up') moveLayer(id, 1); else if (a === 'down') moveLayer(id, -1);
          else if (a === 'more') openLayerMenu(id, b);
          ev.stopPropagation();
        });
      });
    });
  }
  function openLayerMenu(id, anchor) {
    var menu = $('#menu'), m = E.meta[id], others = stackIds().filter(function (x) { return x !== id; }).reverse();
    var held = S.locked.some(function (x) { return x.hex === m.hex; });
    menu.innerHTML = (others.length ? '<div class="pop-label" style="padding:4px 8px">Merge ' + esc(m.name) + ' into</div>' + others.map(function (o) { return '<button class="item" type="button" data-merge="' + o + '"><i style="--c:' + E.meta[o].hex + '"></i>' + esc(E.meta[o].name) + ' <span class="mono" style="margin-left:auto;font-size:11px;color:var(--ink-3)">' + E.meta[o].hex + '</span></button>'; }).join('') + '<hr>' : '') +
      '<button class="item" type="button" data-act="lock">' + icon('lock') + (held ? 'Stop holding this color' : 'Hold this exact color') + '</button>' +
      '<button class="item" type="button" data-act="remove">' + icon('trash') + 'Remove ' + esc(m.name) + ' entirely</button>';
    menu.hidden = false;
    var r = anchor.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    var x = clamp(r.right - mw, 8, window.innerWidth - mw - 8), y = r.bottom + 4; if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 4);
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    $$('[data-merge]', menu).forEach(function (b) { b.addEventListener('click', function () { closeMenu(); mergeLayer(id, +b.dataset.merge); }); });
    $('[data-act=lock]', menu).addEventListener('click', function () { closeMenu(); lockLayer(id); });
    $('[data-act=remove]', menu).addEventListener('click', function () { closeMenu(); removeLayer(id); });
  }
  function closeMenu() { $('#menu').hidden = true; }
  document.addEventListener('pointerdown', function (e) { if (!$('#menu').hidden && !e.target.closest('#menu') && !e.target.closest('[data-a=more]')) closeMenu(); });

  // ------------------------------------------------------------ cut sheets
  function cutPath(id) { var c = cuts && cuts[id]; return c ? c.d : result.layers[id].d; }
  function marksPath(b, p) {
    var m = 0.34 * p, gap = 0.22 * p, t = Math.max(0.055 * p, 1.2), h = m / 2, t2 = t / 2;
    var cross = function (cx, cy) {
      var pts = [[cx - t2, cy - h], [cx + t2, cy - h], [cx + t2, cy - t2], [cx + h, cy - t2], [cx + h, cy + t2], [cx + t2, cy + t2], [cx + t2, cy + h], [cx - t2, cy + h], [cx - t2, cy + t2], [cx - h, cy + t2], [cx - h, cy - t2], [cx - t2, cy - t2]];
      return 'M' + pts.map(function (q) { return q[0].toFixed(2) + ' ' + q[1].toFixed(2); }).join(' L') + ' Z';
    };
    var off = gap + h;
    return { d: cross(b[0] - off, b[1] - off) + ' ' + cross(b[2] + off, b[3] + off), pad: gap + m };
  }
  function exportBox() {
    var b = bbox(), p = ppi(), pad = 0, mk = null;
    if (S.marks) { mk = marksPath(b, p); pad = mk.pad; }
    return { vb: [b[0] - pad, b[1] - pad, b[2] - b[0] + pad * 2, b[3] - b[1] + pad * 2], marks: mk ? mk.d : '', p: p };
  }
  function lum(hex) { var c = hex.replace('#', ''); var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function renderSheets() {
    var box = $('#sheets');
    if (!result) { box.innerHTML = ''; return; }
    var ids = stackIds(), eb = exportBox(), p = eb.p, pending = !cuts && S.layerMode !== 'knockout', k = 0, nCut = ids.filter(function (id) { return E.meta[id].cut; }).length;
    box.innerHTML = ids.map(function (id) {
      var m = E.meta[id], l = result.layers[id], cu = cuts && cuts[id];
      var bb = (cu && cu.bbox) || l.bbox || bbox(), w = (bb[2] - bb[0]) / p, h = (bb[3] - bb[1]) / p;
      if (m.cut) k++;
      var L = lum(m.hex), light = L > 0.82, d = cutPath(id) + (S.marks && m.cut ? ' ' + eb.marks : '');
      var backing = L > 0.55 ? '#2B343A' : '#E4E9EC';
      var tucked = cu && cu.tucked ? 'Tucks ' + S.trapMm.toFixed(1) + ' mm under the layers on top' : (S.layerMode === 'knockout' ? 'Knockout: edges meet the next color exactly' : 'Nothing sits on top of this one');
      return '<article class="sheet' + (m.cut ? '' : ' off') + '"><div class="sheet-art" style="--backing:' + backing + '"><svg viewBox="' + eb.vb.join(' ') + '" preserveAspectRatio="xMidYMid meet"><path fill="' + m.hex + '" fill-rule="evenodd" d="' + d + '"' + (light ? ' stroke="rgba(255,255,255,.35)" stroke-width="0.8" vector-effect="non-scaling-stroke"' : '') + '/></svg></div>' +
        '<div class="sheet-meta"><div class="sheet-top">' + (m.cut ? '<span class="press">Press ' + k + ' of ' + nCut + '</span>' : '<span class="press" style="color:var(--ink-3);background:var(--line-2)">Not cut</span>') + '<span class="sheet-name">' + esc(m.name) + '</span></div>' +
        '<div class="sheet-stats">' + m.hex + ' · ' + fmtIn(w) + ' × ' + fmtIn(h) + ' in · ' + (cu ? cu.pieces : l.pieces) + ' pieces · ' + (cu ? cu.nodes : l.nodes) + ' curves</div>' +
        '<div class="sheet-note">' + (m.cut ? (pending ? 'Building the overlap…' : tucked) : 'The shirt shows through here') + '</div></div></article>';
    }).join('');
  }

  // ------------------------------------------------------------ shirt mockup
  var SHIRTS = [['White', '#F3F3F0'], ['Black', '#1B1C1E'], ['Heather gray', '#A7A9AC'], ['Navy', '#1F2A44'], ['Red', '#B3202C'], ['Royal', '#2846A8'], ['Forest', '#25442F'], ['Maroon', '#5B1F2B'], ['Pink', '#F2B8C6'], ['Sand', '#D8C6A4']];
  function renderShirtColors() {
    var box = $('#shirtColors');
    box.innerHTML = '<span>Shirt</span>' + SHIRTS.map(function (s) { return '<button type="button" data-c="' + s[1] + '" style="--c:' + s[1] + '" title="' + s[0] + '" aria-label="' + s[0] + ' shirt" aria-pressed="' + (S.shirt.toUpperCase() === s[1].toUpperCase()) + '"></button>'; }).join('') +
      '<label title="Custom shirt color"><input type="color" id="shirtCustom" value="' + S.shirt.toLowerCase() + '" aria-label="Custom shirt color"></label>';
    $$('button', box).forEach(function (b) { b.addEventListener('click', function () { S.shirt = b.dataset.c; saveSettings(); renderShirtColors(); renderShirt(); renderChecks(); }); });
    $('#shirtCustom').addEventListener('input', function (e) { S.shirt = e.target.value.toUpperCase(); saveSettings(); renderShirt(); renderChecks(); $$('button', box).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); });
  }
  var SHIRT_PATH = 'M-3.7 0C-2.6 2.3 2.6 2.3 3.7 0L8.7 1.1C11.4 1.9 13.8 3.6 16.2 6.9L12.7 10.4C11.7 9.6 10.9 9.1 10.2 8.8C10.3 15 10.5 22 10.7 28.7C4 29.2 -4 29.2 -10.7 28.7C-10.5 22 -10.3 15 -10.2 8.8C-10.9 9.1 -11.7 9.6 -12.7 10.4L-16.2 6.9C-13.8 3.6 -11.4 1.9 -8.7 1.1Z';
  function renderShirt() {
    var svg = $('#shirtSvg');
    if (!result) { svg.innerHTML = ''; return; }
    var ds = designSizeIn(), wIn = ds[0], hIn = ds[1], b = bbox();
    var chest = wIn <= 4.6, cx = chest ? 4.7 : 0, top = chest ? 4.2 : 3.4;
    var shade = lum(S.shirt) < 0.3 ? 0.35 : 0.14;
    var maxH = Math.max(29.5, top + hIn + 1.5);
    svg.setAttribute('viewBox', '-17.5 -1.8 35 ' + (maxH + 2.6));
    var paths = stackIds().filter(function (id) { return E.meta[id].cut && E.meta[id].visible; }).map(function (id) { return '<path fill="' + E.meta[id].hex + '" fill-rule="evenodd" stroke="' + E.meta[id].hex + '" stroke-width="0.6" d="' + result.layers[id].d + '"/>'; }).join('');
    svg.innerHTML = '<defs><clipPath id="shirtClip"><path d="' + SHIRT_PATH + '"/></clipPath>' +
      '<linearGradient id="shirtShade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="' + shade + '"/><stop offset=".18" stop-color="#000" stop-opacity="0"/><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="' + shade + '"/></linearGradient>' +
      '<filter id="knit" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="9 14" numOctaves="1" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .09 -.02"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>' +
      '<path d="' + SHIRT_PATH + '" fill="' + S.shirt + '" stroke="rgba(0,0,0,.18)" stroke-width="0.06"/>' +
      '<g clip-path="url(#shirtClip)">' +
      '<svg x="' + (cx - wIn / 2) + '" y="' + top + '" width="' + wIn + '" height="' + hIn + '" viewBox="' + b[0] + ' ' + b[1] + ' ' + (b[2] - b[0]) + ' ' + (b[3] - b[1]) + '" overflow="visible">' + paths + '</svg>' +
      '<rect x="-17" y="-2" width="34" height="32" fill="url(#shirtShade)"/>' +
      '<rect x="-17" y="-2" width="34" height="32" filter="url(#knit)" fill="#000"/>' +
      '<path d="M-10.2 8.8C-9.6 7 -9.1 4.2 -8.7 1.1M10.2 8.8C9.6 7 9.1 4.2 8.7 1.1" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="0.07"/>' +
      '</g>' +
      '<path d="M-3.7 0C-2.6 2.3 2.6 2.3 3.7 0" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="0.55"/>' +
      '<path d="M-3.7 0C-2.6 2.3 2.6 2.3 3.7 0" fill="none" stroke="' + S.shirt + '" stroke-width="0.32"/>' +
      '<text x="0" y="' + (maxH + 0.4) + '" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="0.62" fill="var(--ink-3)">' + fmtIn(wIn) + ' × ' + fmtIn(hIn) + ' in on an adult tee (about 20 in across the chest)</text>';
  }

  // ------------------------------------------------------------ checks
  function deltaE(h1, h2) { var a = KC.labOfHex(h1), b = KC.labOfHex(h2); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function renderChecks() {
    var ul = $('#checks');
    if (!result) { ul.innerHTML = ''; return; }
    var ids = stackIds(), cutIds = ids.filter(function (id) { return E.meta[id].cut; }), p = ppi(), items = [];
    var n = cutIds.length;
    if (n <= 3) items.push(['ok', 'Good', '<b>' + n + ' layer' + (n === 1 ? '' : 's') + '</b> of vinyl. Easy to press and stays soft.']);
    else if (n === 4) items.push(['warn', 'Check', '<b>4 layers</b> is about the practical limit for stacked HTV. Keep each tack press short.']);
    else items.push(['bad', 'Heavy', '<b>' + n + ' layers</b> will press thick and stiff. Merge similar colors, let the shirt show through one of them, or use Print Then Cut with the PNG.']);
    var pieces = 0, smallest = Infinity;
    cutIds.forEach(function (id) { var l = result.layers[id], cu = cuts && cuts[id]; pieces += cu ? cu.pieces : l.pieces; if (l.smallest) smallest = Math.min(smallest, l.smallest); });
    var smallMm = isFinite(smallest) ? 2 * Math.sqrt(smallest / Math.PI) / (p / 25.4) : 0;
    if (pieces > 160) items.push(['warn', 'Weeding', '<b>' + pieces + ' pieces</b> to weed. Raise Smallest piece or Smoothness to cut that down.']);
    else items.push(['ok', 'Weeding', '<b>' + pieces + ' pieces</b> to weed' + (smallMm ? ', smallest about ' + smallMm.toFixed(1) + ' mm across.' : '.')]);
    if (n >= 2) {
      if (S.layerMode === 'knockout') items.push(['warn', 'Fit', '<b>Knockout</b> pieces meet edge to edge, so any misalignment shows the shirt. Overlap hides it.']);
      else if (S.layerMode === 'overlap') items.push(['ok', 'Fit', 'Lower layers tuck <b>' + S.trapMm.toFixed(1) + ' mm</b> under the ones on top, so small misalignment won\'t show.']);
      else items.push(['ok', 'Fit', '<b>Underlay</b>: lower layers run solid under what\'s on top. Most forgiving, but thicker.']);
    }
    var tot = 0; ids.forEach(function (id) { tot += result.layers[id].area; });
    cutIds.forEach(function (id) {
      var a = result.layers[id].area / Math.max(1, tot);
      if (a < 0.006 && n > 1) items.push(['warn', 'Tiny', '<b>' + esc(E.meta[id].name) + '</b> covers ' + (a * 100).toFixed(1) + '% of the design. Worth a sheet of vinyl? <button class="btn sm" type="button" data-merge-small="' + id + '">Merge into nearest color</button>']);
    });
    cutIds.forEach(function (id) {
      if (deltaE(E.meta[id].hex, S.shirt) < 0.04) items.push(['warn', 'Shirt', '<b>' + esc(E.meta[id].name) + '</b> is close to the shirt color. Skip cutting it and let the shirt show through. <button class="btn sm" type="button" data-skip="' + id + '">Don\'t cut ' + esc(E.meta[id].name) + '</button>']);
    });
    var ds = designSizeIn();
    if (ds[0] > 12.5 || ds[1] > 23.5) items.push(['warn', 'Size', 'At ' + fmtIn(ds[0]) + ' × ' + fmtIn(ds[1]) + ' in this needs a 12 × 24 in mat or a roll.']);
    ul.innerHTML = items.map(function (it) { return '<li><span class="tag ' + it[0] + '">' + it[1] + '</span><span>' + it[2] + '</span></li>'; }).join('');
    $$('[data-skip]', ul).forEach(function (b) { b.addEventListener('click', function () { toggleCut(+b.dataset.skip); }); });
    $$('[data-merge-small]', ul).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = +b.dataset.mergeSmall, best = null, bd = 1e9;
        stackIds().forEach(function (o) { if (o === id) return; var d = deltaE(E.meta[o].hex, E.meta[id].hex); if (d < bd) { bd = d; best = o; } });
        if (best != null) mergeLayer(id, best);
      });
    });
  }

  // ------------------------------------------------------------ footer + how-to
  function renderFoot() {
    if (!result) { $('#footSize').textContent = W ? 'Preparing ' + W + ' × ' + H + ' px' : ''; $('#footStats').textContent = ''; return; }
    var ds = designSizeIn(), ids = stackIds(), cutIds = ids.filter(function (id) { return E.meta[id].cut; }), nodes = 0;
    cutIds.forEach(function (id) { nodes += (cuts && cuts[id]) ? cuts[id].nodes : result.layers[id].nodes; });
    $('#footSize').textContent = fmtIn(ds[0]) + ' × ' + fmtIn(ds[1]) + ' in';
    $('#footStats').textContent = cutIds.length + ' cut layer' + (cutIds.length === 1 ? '' : 's') + ' · ' + nodes.toLocaleString() + ' curves · ' + (result.timings.total / 1000).toFixed(1) + ' s';
    $('#outHeight').textContent = 'height ' + fmtIn(ds[1]) + ' in';
    var steps = [
      'In Design Space, choose <b>Upload</b> and pick the layered SVG. Every color comes in as its own layer, already lined up.',
      'Check the size on the canvas. It should read <b>' + fmtIn(ds[0]) + ' × ' + fmtIn(ds[1]) + ' in</b>' + (S.marks ? ' plus the alignment marks' : '') + '.',
      'Click <b>Make It</b> and switch on <b>Mirror</b> for every HTV mat.',
      'Cut and weed each color. Leave it on its clear carrier sheet.',
      'Press in the order shown on the cut sheets, starting with Press 1. Tack each layer for a few seconds, peel the carrier, then add the next.' + (S.marks ? ' Line the crosses up through each clear carrier, then peel the marks away before the last press.' : ''),
      'Finish with one full press at your vinyl\'s recommended time and temperature.'
    ];
    $('#howtoSteps').innerHTML = steps.map(function (s) { return '<li>' + s + '</li>'; }).join('');
  }
  function renderBgInfo() {
    var sw = $('#bgSwatch'), tx = $('#bgText');
    sw.classList.remove('alpha'); sw.style.removeProperty('--c');
    if (!result) { tx.textContent = 'Looking for a background'; return; }
    var bg = result.bg, pct = Math.round(bg.removed * 100);
    if (bg.mode === 'alpha') { sw.classList.add('alpha'); tx.textContent = 'Transparent background kept as is'; }
    else if (bg.mode === 'color') { sw.style.setProperty('--c', bg.hex); tx.innerHTML = '<span class="mono">' + bg.hex + '</span> removed · ' + pct + '% of the image'; }
    else if (S.bgMode === 'keep') { tx.textContent = 'Everything is kept, background included'; }
    else { tx.textContent = bg.reason === 'uneven' ? 'Edges aren\'t one color, so nothing was removed. Pick it, or choose Remove.' : 'No background found'; if (bg.hex) sw.style.setProperty('--c', bg.hex); }
  }
  function renderKHint() {
    var h = $('#kHint');
    if (result && result.K < S.K) h.textContent = 'Found only ' + result.K + ' distinct colors, so the extra slots were folded together.';
    else h.textContent = 'Each color becomes one sheet of vinyl.';
  }

  function renderCutDependent() { renderSheets(); renderLayerList(); renderChecks(); renderFoot(); }
  function renderAll() {
    renderVector(); renderLayerList(); renderSheets(); renderShirt(); renderChecks(); renderFoot(); renderBgInfo(); renderKHint();
    drawMat(); updateCompare(); renderSelection();
  }

  // ------------------------------------------------------------ views
  function setView(v) {
    S.view = v; persist();
    $$('#tabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
    $('#sheetsView').hidden = v !== 'sheets'; $('#shirtView').hidden = v !== 'shirt';
    if (v !== 'compare' && v !== 'vector') { hidePop(); setPick(null); }
    updateCompare(); drawMat(); renderSelection();
    if (v === 'shirt') renderShirt(); if (v === 'sheets') renderSheets();
  }
  $$('#tabs button').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });

  // split handle
  (function () {
    var sp = $('#split'), dragging = false;
    sp.addEventListener('pointerdown', function (e) { dragging = true; sp.setPointerCapture(e.pointerId); e.stopPropagation(); });
    sp.addEventListener('pointermove', function (e) { if (!dragging) return; var r = stage.getBoundingClientRect(); splitFrac = clamp((e.clientX - r.left) / r.width, 0.02, 0.98); updateCompare(); });
    sp.addEventListener('pointerup', function () { dragging = false; });
    sp.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { splitFrac = clamp(splitFrac - 0.04, 0.02, 0.98); updateCompare(); } if (e.key === 'ArrowRight') { splitFrac = clamp(splitFrac + 0.04, 0.02, 0.98); updateCompare(); } });
  })();

  // ------------------------------------------------------------ controls
  function setFill(input) { var min = +input.min, max = +input.max; input.style.setProperty('--fill', (100 * (input.value - min) / (max - min)) + '%'); }
  function segSet(id, v) { $$('#' + id + ' button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); }); }
  var MODE_HINT = {
    overlap: 'Best for heat-transfer vinyl. Each color tucks a little under the ones pressed on top of it.',
    knockout: 'Every piece fits its neighbors exactly, with no overlap. Flattest result; needs careful alignment. Good for adhesive vinyl.',
    underlay: 'Lower colors run solid under everything they surround. Easiest to align, adds thickness.'
  };
  function syncControls() {
    $('#inK').value = S.K; $('#outK').textContent = S.K; setFill($('#inK'));
    segSet('segBg', S.bgMode); $('#inBgTol').value = S.bgTol; $('#outBgTol').textContent = S.bgTol; setFill($('#inBgTol'));
    $('#inBgGrad').checked = S.bgGradient; $('#inBgGlobal').checked = S.bgGlobal;
    $('#inSmooth').value = S.smooth; $('#outSmooth').textContent = S.smooth; setFill($('#inSmooth'));
    $('#inCorners').value = S.corners; $('#outCorners').textContent = S.corners <= 0 ? 'Off' : S.corners; setFill($('#inCorners'));
    $('#inMinPiece').value = S.minPieceMm; $('#outMinPiece').textContent = S.minPieceMm <= 0 ? 'Off' : (+S.minPieceMm).toFixed(1) + ' mm'; setFill($('#inMinPiece'));
    segSet('segDenoise', S.denoise);
    $('#inWidth').value = S.widthIn;
    $$('#sizeChips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(+c.dataset.w === +S.widthIn)); });
    segSet('segMode', S.layerMode); $('#modeHint').textContent = MODE_HINT[S.layerMode];
    $('#trapField').hidden = S.layerMode === 'knockout';
    $('#inTrap').value = S.trapMm; $('#outTrap').textContent = (+S.trapMm).toFixed(1) + ' mm'; setFill($('#inTrap'));
    $('#inMarks').checked = S.marks;
    $('#inPrecision').value = S.precision; $('#outPrecision').textContent = S.precision; setFill($('#inPrecision'));
    segSet('segQuality', S.quality);
  }
  function bindRange(id, key, opts) {
    var el = $('#' + id);
    el.addEventListener('input', function () { S[key] = +el.value; markDirty(); syncControls(); if (!opts || !opts.noRun) requestRun(opts && opts.delay); if (opts && opts.after) opts.after(); });
    el.addEventListener('change', saveSettings);
  }
  bindRange('inK', 'K', { delay: 250 });
  bindRange('inBgTol', 'bgTol', { delay: 250 });
  bindRange('inSmooth', 'smooth', { delay: 200 });
  bindRange('inCorners', 'corners', { delay: 200 });
  bindRange('inMinPiece', 'minPieceMm', { delay: 220 });
  bindRange('inTrap', 'trapMm', { delay: 220 });
  bindRange('inPrecision', 'precision', { delay: 200 });
  function bindSeg(id, key, num, after) {
    $$('#' + id + ' button').forEach(function (b) { b.addEventListener('click', function () { S[key] = num ? +b.dataset.v : b.dataset.v; syncControls(); saveSettings(); if (after) after(); else requestRun(0); }); });
  }
  bindSeg('segBg', 'bgMode', false, function () { if (S.bgMode !== 'remove') S.bgColor = null; requestRun(0); });
  bindSeg('segDenoise', 'denoise', true);
  bindSeg('segMode', 'layerMode', false, function () { requestRun(0); renderAll(); });
  bindSeg('segQuality', 'quality', false, function () { prepareWork(); });
  $('#inBgGrad').addEventListener('change', function (e) { S.bgGradient = e.target.checked; saveSettings(); requestRun(0); });
  $('#inBgGlobal').addEventListener('change', function (e) { S.bgGlobal = e.target.checked; saveSettings(); requestRun(0); });
  $('#inMarks').addEventListener('change', function (e) { S.marks = e.target.checked; saveSettings(); renderAll(); });
  $('#inWidth').addEventListener('input', function (e) { var v = parseFloat(e.target.value); if (v >= 0.5 && v <= 40) { S.widthIn = v; $$('#sizeChips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(+c.dataset.w === v)); }); saveSettings(); renderAll(); requestRun(350); } });
  $$('#sizeChips .chip').forEach(function (c) { c.addEventListener('click', function () { S.widthIn = +c.dataset.w; syncControls(); saveSettings(); renderAll(); requestRun(0); }); });
  $('#btnAutoK').addEventListener('click', function () { if (engine) { engine.post({ type: 'suggest', lockedN: S.locked.length }); toast('Measuring how many colors this image really has…', 1500); } });
  $('#btnPick').addEventListener('click', function () { setPick(pickMode === 'add' ? null : 'add'); });
  $('#btnPickBg').addEventListener('click', function () { setPick(pickMode === 'bg' ? null : 'bg'); });
  $('#zIn').addEventListener('click', function () { var s = stageSize(); zoomAt(1.25, s[0] / 2, s[1] / 2); });
  $('#zOut').addEventListener('click', function () { var s = stageSize(); zoomAt(0.8, s[0] / 2, s[1] / 2); });
  $('#zFit').addEventListener('click', fitView);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnOpen').addEventListener('click', function () { $('#fileInput').click(); });
  $('#fileInput').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
  $('#btnSample').addEventListener('click', function () { if (project.id) history.replaceState(null, '', '/'); makeSample(); });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && server.on) { e.preventDefault(); saveProject(); }
    if (e.key === 'Escape') { setPick(null); hidePop(); closeMenu(); selected = null; renderSelection(); }
  });
  // drag and drop, paste
  var dragDepth = 0;
  window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { dragDepth++; $('#drop').hidden = false; e.preventDefault(); } });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop').hidden = true; });
  window.addEventListener('drop', function (e) { e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) openFile(f); });
  window.addEventListener('paste', function (e) { var items = (e.clipboardData && e.clipboardData.files) || []; if (items[0]) openFile(items[0]); });

  // ------------------------------------------------------------ export
  var downloadsP = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(function () { return null; }) : Promise.resolve(null);
  function baseName() { return (srcName || 'design').replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design'; }
  async function saveFile(filename, data) {
    var dl = await downloadsP;
    if (dl) {
      try { await dl.save({ filename: filename, data: data }); toast('Saved ' + filename); }
      catch (e) { if (e && e.code === 'declined') toast('Download canceled'); else if (e && e.code === 'rate_limited') toast('A save prompt is already open'); else toast('Couldn\'t save here. Use Copy SVG code instead.', 4000); }
      return;
    }
    if (window.claude && window.claude.use) { toast('Downloads aren\'t available in this view. Use Copy SVG code instead.', 4500); return; }
    var blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast('Saved ' + filename);
  }
  function cutIdsBottomUp() { return stackIds().filter(function (id) { return E.meta[id].cut; }); }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function svgDoc(ids, opts) {
    var eb = exportBox(), vb = eb.vb, wIn = vb[2] / eb.p, hIn = vb[3] / eb.p, knock = opts && opts.knockout;
    var groups = ids.map(function (id, i) {
      var m = E.meta[id], d = (knock ? result.layers[id].d : cutPath(id)) + (S.marks && !(opts && opts.noMarks) ? ' ' + eb.marks : '');
      return '  <g id="' + (i + 1) + '-' + slug(m.name) + '-' + m.hex.slice(1) + '">\n    <title>' + esc(m.name + ' ' + m.hex) + '</title>\n    <path fill="' + m.hex + '" fill-rule="evenodd" d="' + d + '"/>\n  </g>';
    }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + wIn.toFixed(3) + 'in" height="' + hIn.toFixed(3) + 'in" viewBox="' + vb.map(function (v) { return +v.toFixed(2); }).join(' ') + '">\n' +
      '  <!-- Made with Kiss Cut. Layers are listed bottom to top: press them in this order. -->\n' + groups + '\n</svg>\n';
  }
  function needResult() { if (!result) { toast('Still working on the vector. One moment.'); return false; } if (!cuts && S.layerMode !== 'knockout') { toast('Finishing the overlaps. Try again in a second.'); return false; } return true; }
  async function exportSvg() { if (!needResult()) return; var ids = cutIdsBottomUp(); if (!ids.length) { toast('Every color is set to not cut.'); return; } await saveFile(baseName() + '-layers.svg', svgDoc(ids)); }
  async function exportZip() {
    if (!needResult()) return;
    var ids = cutIdsBottomUp(), files = ids.map(function (id, i) { var m = E.meta[id]; return { name: String(i + 1).padStart(2, '0') + '-' + slug(m.name) + '-' + m.hex.slice(1) + '.svg', data: new TextEncoder().encode(svgDoc([id])) }; });
    files.push({ name: 'all-layers.svg', data: new TextEncoder().encode(svgDoc(ids)) });
    await saveFile(baseName() + '-by-color.zip', makeZip(files));
  }
  async function exportPng() {
    if (!result) return;
    var ids = cutIdsBottomUp(), eb = exportBox(), dpi = 300, wpx = Math.round(eb.vb[2] / eb.p * dpi), hpx = Math.round(eb.vb[3] / eb.p * dpi);
    var scale = Math.min(1, 8000 / Math.max(wpx, hpx)); wpx = Math.round(wpx * scale); hpx = Math.round(hpx * scale);
    var svg = svgDoc(ids, { knockout: true, noMarks: true }).replace(/width="[^"]+" height="[^"]+"/, 'width="' + wpx + '" height="' + hpx + '"');
    svg = svg.replace(/<path fill="(#[0-9A-F]{6})"/g, '<path stroke="$1" stroke-width="0.5" stroke-linejoin="round" fill="$1"');
    var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      var im = await loadImgFromUrl(url), c = document.createElement('canvas'); c.width = wpx; c.height = hpx;
      c.getContext('2d').drawImage(im, 0, 0, wpx, hpx);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      await saveFile(baseName() + '-300dpi.png', blob);
    } catch (e) { toast('Couldn\'t render the PNG in this browser.'); }
    finally { URL.revokeObjectURL(url); }
  }
  function copySvg() {
    if (!needResult()) return;
    var text = svgDoc(cutIdsBottomUp());
    var fallback = function () {
      var box = $('#copyBox'); box.hidden = false; box.innerHTML = '<textarea class="codebox" readonly aria-label="SVG code"></textarea>';
      var ta = $('textarea', box); ta.value = text; ta.focus(); ta.select(); toast('Selected. Press Ctrl+C or ⌘C to copy.');
    };
    try { navigator.clipboard.writeText(text).then(function () { toast('SVG code copied (' + Math.round(text.length / 1024) + ' KB)'); }, fallback); } catch (e) { fallback(); }
  }
  $('#btnSvg').addEventListener('click', exportSvg); $('#btnSvgTop').addEventListener('click', exportSvg);
  $('#btnZip').addEventListener('click', exportZip); $('#btnPng').addEventListener('click', exportPng); $('#btnCopy').addEventListener('click', copySvg);

  // minimal ZIP writer (stored, no compression; SVG text compresses fine on its own later)
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }

  // ------------------------------------------------------------ saved projects (only when served by the Kiss Cut server)
  var server = { on: false, maxImageMB: 25 };
  var project = { id: null, token: null, revision: 0, imageSaved: false, savedAt: null, url: null, dirty: false, saving: false };
  var TOKENS_KEY = 'kisscut.tokens.v1';
  function tokens() { try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}'); } catch (e) { return {}; } }
  function setToken(id, t) { var o = tokens(); o[id] = t; try { localStorage.setItem(TOKENS_KEY, JSON.stringify(o)); } catch (e) {} }
  function newProject() {
    project = { id: null, token: null, revision: 0, imageSaved: false, savedAt: null, url: null, dirty: false, saving: false };
    if (/^\/p\//.test(location.pathname)) history.replaceState(null, '', '/');
    hideShare(); renderSaveState();
  }
  function markDirty() { if (!project.dirty) { project.dirty = true; renderSaveState(); } }
  function renderFileName() {
    var chip = isSample ? '<em>Sample</em>' : (project.id && !project.token ? '<em title="Saving makes your own copy; the original link stays as it was">Shared copy</em>' : '');
    $('#fileName').innerHTML = esc(srcName) + chip;
  }
  function renderSaveState() {
    var el = $('#saveState'), b = $('#btnShare');
    if (!server.on) { el.hidden = true; b.hidden = true; return; }
    b.hidden = false; el.hidden = false;
    if (project.saving) el.textContent = 'Saving…';
    else if (!project.id) el.textContent = '';
    else if (project.dirty) el.textContent = 'Unsaved changes';
    else if (project.savedAt) el.textContent = (project.token ? 'Saved ' : 'Opened, saved ') + project.savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('#btnShareLabel').textContent = project.id && project.token ? (project.dirty ? 'Save' : 'Share link') : 'Save & share';
    renderFileName();
  }
  async function detectServer() {
    if (location.protocol === 'file:') return;
    try {
      var r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) return;
      var j = await r.json();
      if (j && j.app === 'kisscut') { server.on = true; server.maxImageMB = j.maxImageMB || 25; }
    } catch (e) {}
  }
  function buildState() {
    var settings = {}; for (var k in DEFAULTS) settings[k] = S[k];
    return {
      v: 1, app: 'kisscut', name: srcName, savedAt: new Date().toISOString(), settings: settings,
      locked: S.locked, bgColor: S.bgColor, work: { W: W, H: H },
      edit: { map: E.map, meta: E.meta, order: E.order, overrides: E.overrides },
      centers: result.centers.map(function (c) { return { id: c.id, lab: c.lab }; }),
      forkOf: project.id && !project.token ? project.id : null
    };
  }
  // the server stores raster images only; anything else (an SVG, an oversized photo) is re-encoded here
  async function uploadableImage() {
    var b = srcBlob, limit = server.maxImageMB * 1048576 * 0.97;
    if (b && /^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(b.type) && b.size <= limit) return b;
    var iw = srcImg.naturalWidth || srcImg.width || 1200, ih = srcImg.naturalHeight || srcImg.height || 1200;
    var isVector = b && /svg/.test(b.type), cap = isVector ? 2400 : 4096, sc = Math.min(isVector ? cap / Math.max(iw, ih) : 1, cap / Math.max(iw, ih));
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw * sc)); c.height = Math.max(1, Math.round(ih * sc));
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(srcImg, 0, 0, c.width, c.height);
    var out = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
    if (out.size > limit) out = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.92); });
    srcBlob = out;
    return out;
  }
  async function saveProject() {
    if (!server.on || project.saving) return;
    if (!result || (!cuts && S.layerMode !== 'knockout')) { toast('Wait for the vector to finish, then save.'); return; }
    if (project.id && project.token && !project.dirty) { showShare(false); return; }
    project.saving = true; renderSaveState();
    try {
      var owned = !!(project.id && project.token), copyOf = project.id && !owned ? project.id : null;
      var stateBuf = new TextEncoder().encode(JSON.stringify(buildState()));
      var img = owned && project.imageSaved ? null : await uploadableImage();
      var headers = { 'Content-Type': 'application/octet-stream', 'X-State-Length': String(stateBuf.length), 'X-Image-Name': encodeURIComponent(srcName || 'image') };
      if (owned) headers.Authorization = 'Bearer ' + project.token;
      var r = await fetch(owned ? '/api/projects/' + project.id : '/api/projects', { method: owned ? 'PUT' : 'POST', headers: headers, body: new Blob(img ? [stateBuf, img] : [stateBuf]) });
      if (owned && (r.status === 403 || r.status === 404)) {
        // this browser lost the right to update that link: keep the work by saving a new copy
        project.token = null; project.saving = false; return saveProject();
      }
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'The save didn\'t go through (' + r.status + ').');
      if (!owned) { project.id = j.id; project.token = j.token; setToken(j.id, j.token); history.replaceState(null, '', '/p/' + j.id); }
      project.url = /^https?:/.test(j.url || '') ? j.url : location.origin + '/p/' + project.id;
      project.revision = j.revision; project.savedAt = new Date(); project.imageSaved = true; project.dirty = false;
      project.saving = false; renderSaveState(); showShare(!!copyOf);
    } catch (e) {
      project.saving = false; renderSaveState();
      toast(e && e.message ? e.message : 'The save didn\'t go through. Check the connection and try again.', 5000);
    }
  }
  function showShare(wasCopy) {
    var pop = $('#sharePop'), b = $('#btnShare').getBoundingClientRect();
    pop.innerHTML = '<div class="pop-label">' + (wasCopy ? 'Saved as your own copy' : 'Link to this project') + '</div>' +
      '<div class="share-row"><input id="shareUrl" class="share-url" readonly value="' + esc(project.url) + '" aria-label="Project link"><button class="btn sm primary" type="button" id="shareCopy">' + icon('copy') + 'Copy</button></div>' +
      '<p class="hint">' + (wasCopy ? 'The link you opened is unchanged. This new link is yours; saving again updates it. ' : 'Saving again updates this same link. ') +
      'Anyone you send it to gets the image, settings and every edit, and can carry on. When they save, they get a link of their own.</p>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn sm ghost" type="button" id="shareDone">Done</button></div>';
    pop.hidden = false;
    var w = pop.offsetWidth;
    pop.style.top = (b.bottom + 8) + 'px'; pop.style.left = clamp(b.right - w, 8, window.innerWidth - w - 8) + 'px';
    var input = $('#shareUrl');
    $('#shareCopy').addEventListener('click', function () {
      var done = function () { toast('Link copied'); };
      var fallback = function () { input.focus(); input.select(); try { document.execCommand('copy') ? done() : toast('Press Ctrl+C or ⌘C to copy'); } catch (e) { toast('Press Ctrl+C or ⌘C to copy'); } };
      try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(project.url).then(done, fallback); else fallback(); } catch (e) { fallback(); }
    });
    $('#shareDone').addEventListener('click', hideShare);
    input.addEventListener('focus', function () { input.select(); });
  }
  function hideShare() { var p = $('#sharePop'); if (p) p.hidden = true; }
  document.addEventListener('pointerdown', function (e) { var p = $('#sharePop'); if (p && !p.hidden && !e.target.closest('#sharePop') && !e.target.closest('#btnShare')) hideShare(); });
  $('#btnShare').addEventListener('click', saveProject);
  window.addEventListener('beforeunload', function (e) { if (server.on && project.id && project.dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function openProject(id) {
    showProgress('Opening the shared project', 4);
    try {
      var r = await fetch('/api/projects/' + id, { cache: 'no-store' });
      if (!r.ok) { var j0 = await r.json().catch(function () { return {}; }); throw new Error(j0.error || 'That link didn\'t open.'); }
      var j = await r.json(), st = j.state;
      var blob = await (await fetch(j.image.url)).blob();
      for (var k in DEFAULTS) if (st.settings && st.settings[k] !== undefined && typeof st.settings[k] === typeof DEFAULTS[k]) S[k] = st.settings[k];
      persist(); syncControls(); renderShirtColors(); setView(S.view || 'compare');
      project = { id: id, token: tokens()[id] || null, revision: j.revision, imageSaved: true, savedAt: new Date(j.updated), url: location.origin + '/p/' + id, dirty: false, saving: false };
      var url = URL.createObjectURL(blob), im = await loadImgFromUrl(url);
      setImage(im, url, st.name || j.image.name || 'design', false, blob, st);
      renderSaveState();
      return true;
    } catch (e) {
      toast((e && e.message) || 'That link didn\'t open.', 5000);
      history.replaceState(null, '', '/');
      return false;
    }
  }
  // saved edits name colors by cluster id; match them to this run's palette so they land on the same colors
  function applyRestore(r, st) {
    pendingRestore = null;
    var ed = st.edit;
    if (!ed || !st.centers || !st.centers.length) return;
    var pairs = [], mapId = {}, used = {};
    st.centers.forEach(function (o) { r.centers.forEach(function (n) { pairs.push([Math.hypot(o.lab[0] - n.lab[0], o.lab[1] - n.lab[1], o.lab[2] - n.lab[2]), o.id, n.id]); }); });
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    pairs.forEach(function (p) { if (p[0] < 0.05 && !(p[1] in mapId) && !used[p[2]]) { mapId[p[1]] = p[2]; used[p[2]] = 1; } });
    if (st.centers.length !== r.centers.length || Object.keys(mapId).length !== st.centers.length) {
      toast('The colors came out a little differently on this device, so the layer edits were reset.', 5000);
      return;
    }
    var tr = function (v) { return v < 0 ? v : (v in mapId ? mapId[v] : v); };
    var map = null;
    if (ed.map) { map = []; for (var i = 0; i < r.K; i++) map.push(i); ed.map.forEach(function (t, oldRaw) { if (oldRaw in mapId) map[mapId[oldRaw]] = tr(t); }); }
    var meta = {};
    Object.keys(ed.meta || {}).forEach(function (k) { if (k in mapId) meta[mapId[k]] = ed.meta[k]; });
    r.centers.forEach(function (c) { if (!meta[c.id]) meta[c.id] = { hex: c.hex, name: c.name, visible: true, cut: true, lab: c.lab }; });
    var sx = st.work && st.work.W ? W / st.work.W : 1, sy = st.work && st.work.H ? H / st.work.H : 1;
    E.map = map; E.meta = meta;
    E.order = (ed.order || []).map(tr).filter(function (v) { return v >= 0; });
    E.overrides = (ed.overrides || []).map(function (o) { return { x: o.x * sx, y: o.y * sy, to: tr(o.to) }; });
    requestRun(0);
  }

  // ------------------------------------------------------------ boot
  readTheme();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { readTheme(); drawMat(); }); } catch (e) {}
  new MutationObserver(function () { readTheme(); drawMat(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  var lastSize = [0, 0];
  new ResizeObserver(function () { var s = stageSize(); if (s[0] !== lastSize[0] || s[1] !== lastSize[1]) { var first = !lastSize[0]; lastSize = s; if (first || needFit) fitView(); else { drawMat(); updateCompare(); placePop(); } } }).observe(stage);
  syncControls(); renderShirtColors(); setView(S.view === 'shirt' || S.view === 'sheets' ? S.view : (S.view || 'compare'));
  startEngine();
  renderAll();
  (async function () {
    await detectServer();
    renderSaveState();
    var m = /^\/p\/([A-Za-z0-9]{10})\/?$/.exec(location.pathname);
    if (server.on && m && await openProject(m[1])) return;
    makeSample();
  })();
  window.__kc = { get project() { return project; }, get result() { return result; }, get cuts() { return cuts; }, get E() { return E; }, S: S, svgDoc: function () { return svgDoc(cutIdsBottomUp()); }, makeZip: makeZip, pieceAt: pieceAt, stageClick: stageClick };
})();
