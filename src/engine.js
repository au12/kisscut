/* Kiss Cut engine: image -> cleaned color layers -> gap-free smooth vector paths.
   Runs inside a Web Worker (or on the main thread as a fallback). No dependencies. */
(function (root) {
  'use strict';
  var KC = {};

  // ---------------------------------------------------------------- utilities
  var now = function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); };
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- color (OKLab)
  var S2L = new Float32Array(256);
  for (var i0 = 0; i0 < 256; i0++) { var c0 = i0 / 255; S2L[i0] = c0 <= 0.04045 ? c0 / 12.92 : Math.pow((c0 + 0.055) / 1.055, 2.4); }
  function linToSrgb(v) { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function rgbToLab(r, g, b, out, o) {
    var R = S2L[r], G = S2L[g], B = S2L[b];
    var l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    var m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    var s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    out[o] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    out[o + 1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  }
  function labToRgb(L, a, b) {
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [
      Math.round(255 * linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
      Math.round(255 * linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
      Math.round(255 * linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))
    ];
  }
  function hexOfRgb(rgb) { return '#' + rgb.map(function (v) { return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'); }).join('').toUpperCase(); }
  function rgbOfHex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function labOfHex(h) { var c = rgbOfHex(h), o = [0, 0, 0]; rgbToLab(c[0], c[1], c[2], o, 0); return o; }
  function hexOfLab(l) { return hexOfRgb(labToRgb(l[0], l[1], l[2])); }
  KC.labOfHex = labOfHex; KC.hexOfLab = hexOfLab; KC.rgbToLab = rgbToLab; KC.labToRgb = labToRgb;

  var NAMED = [
    ['Black', '#111111'], ['Charcoal', '#3A3D40'], ['Gray', '#808285'], ['Silver', '#B7B9BB'], ['White', '#FFFFFF'], ['Cream', '#F3EBD3'],
    ['Red', '#D32F2F'], ['Cherry', '#A3122A'], ['Maroon', '#6B1A26'], ['Coral', '#F2706B'], ['Pink', '#F48FB1'], ['Hot pink', '#E91E79'],
    ['Orange', '#F57C00'], ['Peach', '#F6A877'], ['Gold', '#D9A21B'], ['Yellow', '#FFD52E'], ['Lemon', '#F4F18A'],
    ['Lime', '#9BCB3C'], ['Green', '#3E9E47'], ['Kelly green', '#16A34A'], ['Forest', '#1F5130'], ['Olive', '#707A2E'], ['Mint', '#A8E6C6'],
    ['Teal', '#14857A'], ['Aqua', '#3FC6D3'], ['Sky blue', '#7EC4EE'], ['Blue', '#1E6FD9'], ['Royal blue', '#2A3FB7'], ['Navy', '#1B2647'],
    ['Dark slate', '#24404C'], ['Midnight', '#1C2638'], ['Purple', '#6A3FA0'], ['Lavender', '#B9A4E0'], ['Magenta', '#B0207E'], ['Brown', '#6D4528'], ['Tan', '#C9A57A'], ['Khaki', '#B7AD86'], ['Slate', '#4F6272']
  ].map(function (p) { return { name: p[0], lab: labOfHex(p[1]) }; });
  KC.nameOfLab = function (l) {
    var C = Math.sqrt(l[1] * l[1] + l[2] * l[2]);
    if (C < 0.028) {
      var L = l[0];
      return L < 0.22 ? 'Black' : L < 0.36 ? 'Charcoal' : L < 0.52 ? 'Dark gray' : L < 0.68 ? 'Gray' : L < 0.84 ? 'Light gray' : L < 0.93 ? 'Off-white' : 'White';
    }
    var best = null, bd = 1e9;
    for (var k = 0; k < NAMED.length; k++) {
      var n = NAMED[k].lab, d = (n[0] - l[0]) * (n[0] - l[0]) + 1.6 * ((n[1] - l[1]) * (n[1] - l[1]) + (n[2] - l[2]) * (n[2] - l[2]));
      if (d < bd) { bd = d; best = NAMED[k].name; }
    }
    if (['Black', 'White', 'Gray', 'Silver', 'Charcoal', 'Cream', 'Lemon', 'Mint', 'Navy', 'Forest', 'Maroon', 'Dark slate', 'Midnight'].indexOf(best) < 0) {
      if (l[0] < 0.4) best = 'Dark ' + best.toLowerCase();
      else if (l[0] > 0.88) best = 'Pale ' + best.toLowerCase();
    }
    return best;
  };

  function toLab(rgba, N) {
    var lab = new Float32Array(N * 3), alpha = new Uint8Array(N);
    var cache = new Map();
    for (var i = 0; i < N; i++) {
      var p = i * 4, r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      alpha[i] = rgba[p + 3];
      var key = (r << 16) | (g << 8) | b, hit = cache.get(key);
      if (hit === undefined) {
        rgbToLab(r, g, b, lab, i * 3);
        if (cache.size < 300000) cache.set(key, i * 3);
      } else { lab[i * 3] = lab[hit]; lab[i * 3 + 1] = lab[hit + 1]; lab[i * 3 + 2] = lab[hit + 2]; }
    }
    return { lab: lab, alpha: alpha };
  }

  // ---------------------------------------------------------------- denoise (edge-preserving)
  function bilateral(src, W, H, opaque, R, sigmaS, sigmaR) {
    var dst = new Float32Array(src.length), D = 2 * R + 1;
    var sw = new Float32Array(D * D);
    for (var dy = -R; dy <= R; dy++) for (var dx = -R; dx <= R; dx++) sw[(dy + R) * D + dx + R] = Math.exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS));
    var LUTN = 1024, LUTMAX = 9, lut = new Float32Array(LUTN + 1);
    for (var t = 0; t <= LUTN; t++) lut[t] = Math.exp(-t / LUTN * LUTMAX);
    var kf = 1 / (2 * sigmaR * sigmaR) * LUTN / LUTMAX;
    for (var y = 0; y < H; y++) {
      var y0 = y - R < 0 ? 0 : y - R, y1 = y + R >= H ? H - 1 : y + R;
      for (var x = 0; x < W; x++) {
        var i = y * W + x, o = i * 3;
        if (!opaque[i]) { dst[o] = src[o]; dst[o + 1] = src[o + 1]; dst[o + 2] = src[o + 2]; continue; }
        var L0 = src[o], a0 = src[o + 1], b0 = src[o + 2], sL = 0, sa = 0, sb = 0, ws = 0;
        var x0 = x - R < 0 ? 0 : x - R, x1 = x + R >= W ? W - 1 : x + R;
        for (var yy = y0; yy <= y1; yy++) {
          var row = yy * W, swr = (yy - y + R) * D - x + R;
          for (var xx = x0; xx <= x1; xx++) {
            var j = row + xx;
            if (!opaque[j]) continue;
            var p = j * 3, dL = src[p] - L0, da = src[p + 1] - a0, db = src[p + 2] - b0;
            var q = (dL * dL + da * da + db * db) * kf;
            if (q >= LUTN) continue;
            var w = sw[swr + xx] * lut[q | 0];
            sL += w * src[p]; sa += w * src[p + 1]; sb += w * src[p + 2]; ws += w;
          }
        }
        dst[o] = sL / ws; dst[o + 1] = sa / ws; dst[o + 2] = sb / ws;
      }
    }
    return dst;
  }
  var DENOISE = [null, { R: 2, s: 1.4, r: 0.035, n: 1 }, { R: 2, s: 1.6, r: 0.05, n: 2 }, { R: 3, s: 2.2, r: 0.07, n: 3 }];

  function gradientMag(lab, W, H) {
    var g = new Float32Array(W * H);
    for (var y = 1; y < H - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var i = y * W + x, gx2 = 0, gy2 = 0;
        for (var c = 0; c < 3; c++) {
          var wgt = c === 0 ? 1 : 0.8;
          var tl = lab[(i - W - 1) * 3 + c], t = lab[(i - W) * 3 + c], tr = lab[(i - W + 1) * 3 + c];
          var l = lab[(i - 1) * 3 + c], r = lab[(i + 1) * 3 + c];
          var bl = lab[(i + W - 1) * 3 + c], b = lab[(i + W) * 3 + c], br = lab[(i + W + 1) * 3 + c];
          var gx = (tr + 2 * r + br) - (tl + 2 * l + bl), gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
          gx2 += wgt * gx * gx; gy2 += wgt * gy * gy;
        }
        g[i] = Math.sqrt(gx2 + gy2) / 8;
      }
    }
    return g;
  }

  // ---------------------------------------------------------------- background removal
  function removeBackground(lab, alpha, W, H, S) {
    var N = W * H, bg = new Uint8Array(N), info = { mode: 'none', hex: null, lab: null, confidence: 0, removed: 0, hasAlpha: false };
    var transparent = 0;
    for (var i = 0; i < N; i++) if (alpha[i] < 128) { bg[i] = 1; transparent++; }
    info.hasAlpha = transparent > 0;
    var border = [];
    for (var x = 0; x < W; x++) { border.push(x); border.push((H - 1) * W + x); }
    for (var y = 1; y < H - 1; y++) { border.push(y * W); border.push(y * W + W - 1); }
    var bt = 0, opaqueBorder = [];
    for (var k = 0; k < border.length; k++) { if (alpha[border[k]] < 128) bt++; else opaqueBorder.push(border[k]); }
    if (transparent > 0 && bt > border.length * 0.3) info.mode = 'alpha';
    var wantColor = S.bgMode === 'remove' || (S.bgMode === 'auto' && info.mode !== 'alpha');
    if (wantColor && opaqueBorder.length > 8) {
      var bgLab;
      if (S.bgColor) bgLab = S.bgColor.slice();
      else {
        var Ls = [], As = [], Bs = [];
        for (var k2 = 0; k2 < opaqueBorder.length; k2++) { var p = opaqueBorder[k2] * 3; Ls.push(lab[p]); As.push(lab[p + 1]); Bs.push(lab[p + 2]); }
        var med = function (arr) { arr.sort(function (a, b) { return a - b; }); return arr[arr.length >> 1]; };
        bgLab = [med(Ls), med(As), med(Bs)];
      }
      var tol = S.bgTol / 100;
      var dBg = new Float32Array(N);
      for (var j = 0; j < N; j++) {
        var q = j * 3, dl = lab[q] - bgLab[0], da = lab[q + 1] - bgLab[1], db = lab[q + 2] - bgLab[2];
        dBg[j] = Math.sqrt(dl * dl + da * da + db * db);
      }
      var near = 0;
      for (var k3 = 0; k3 < opaqueBorder.length; k3++) if (dBg[opaqueBorder[k3]] < tol * 1.5) near++;
      info.lab = bgLab; info.hex = hexOfLab(bgLab); info.confidence = near / opaqueBorder.length;
      if (S.bgMode === 'auto' && !S.bgColor && info.confidence < 0.55) {
        info.mode = info.mode === 'alpha' ? 'alpha' : 'none'; info.reason = 'uneven';
      } else {
        info.mode = 'color';
        if (S.bgGlobal) {
          for (var j2 = 0; j2 < N; j2++) if (alpha[j2] >= 128 && dBg[j2] < tol) bg[j2] = 1;
        } else {
          var qu = new Int32Array(N), qh = 0, qt = 0;
          for (var k4 = 0; k4 < opaqueBorder.length; k4++) { var b0 = opaqueBorder[k4]; if (!bg[b0] && dBg[b0] < tol) { bg[b0] = 1; qu[qt++] = b0; } }
          var follow = !!S.bgGradient, cap = tol * 1.7, step = 0.01;
          while (qh < qt) {
            var c = qu[qh++], cx = c % W, cy = (c / W) | 0;
            for (var nb = 0; nb < 4; nb++) {
              var nx = cx + (nb === 0 ? 1 : nb === 1 ? -1 : 0), ny = cy + (nb === 2 ? 1 : nb === 3 ? -1 : 0);
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              var n = ny * W + nx;
              if (bg[n]) continue;
              var ok = dBg[n] < tol;
              if (!ok && follow && dBg[n] < cap) {
                var pc = c * 3, pn = n * 3, e0 = lab[pc] - lab[pn], e1 = lab[pc + 1] - lab[pn + 1], e2 = lab[pc + 2] - lab[pn + 2];
                ok = (e0 * e0 + e1 * e1 + e2 * e2) < step * step;
              }
              if (ok) { bg[n] = 1; qu[qt++] = n; }
            }
          }
        }
        // trim the anti-aliased fringe one pixel deep
        var trim = [];
        for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
          var t = y2 * W + x2;
          if (bg[t] || dBg[t] > tol * 1.8) continue;
          if ((x2 > 0 && bg[t - 1]) || (x2 < W - 1 && bg[t + 1]) || (y2 > 0 && bg[t - W]) || (y2 < H - 1 && bg[t + W])) trim.push(t);
        }
        for (var k5 = 0; k5 < trim.length; k5++) bg[trim[k5]] = 1;
      }
    }
    var x0 = W, y0 = H, x1 = -1, y1 = -1, removed = 0;
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
      if (bg[yy * W + xx]) { removed++; continue; }
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
    info.removed = removed / N;
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
    return { bg: bg, info: info, bbox: [x0, y0, x1 + 1, y1 + 1] };
  }

  // ---------------------------------------------------------------- color selection (k-means in OKLab)
  function d2lab(X, s, C, k) { var a = X[s] - C[k], b = X[s + 1] - C[k + 1], c = X[s + 2] - C[k + 2]; return a * a + b * b + c * c; }

  function lloyd(X, S, C, K, nf, iters) {
    var assign = new Int16Array(S), sums = new Float64Array(K * 3), cnt = new Float64Array(K), sse = 0;
    for (var it = 0; it < iters; it++) {
      sums.fill(0); cnt.fill(0); sse = 0;
      for (var s = 0; s < S; s++) {
        var best = 0, bd = 1e9, xL = X[s * 3], xa = X[s * 3 + 1], xb = X[s * 3 + 2];
        for (var k = 0, kk = 0; k < K; k++, kk += 3) { var e0 = xL - C[kk], e1 = xa - C[kk + 1], e2 = xb - C[kk + 2], d = e0 * e0 + e1 * e1 + e2 * e2; if (d < bd) { bd = d; best = k; } }
        assign[s] = best; sse += bd; cnt[best]++;
        sums[best * 3] += X[s * 3]; sums[best * 3 + 1] += X[s * 3 + 1]; sums[best * 3 + 2] += X[s * 3 + 2];
      }
      var shift = 0;
      for (var k2 = nf; k2 < K; k2++) {
        if (cnt[k2] > 0) {
          var nl = sums[k2 * 3] / cnt[k2], na = sums[k2 * 3 + 1] / cnt[k2], nb = sums[k2 * 3 + 2] / cnt[k2];
          var sh = Math.abs(nl - C[k2 * 3]) + Math.abs(na - C[k2 * 3 + 1]) + Math.abs(nb - C[k2 * 3 + 2]);
          if (sh > shift) shift = sh;
          C[k2 * 3] = nl; C[k2 * 3 + 1] = na; C[k2 * 3 + 2] = nb;
        } else {
          // reseed an empty cluster at the worst-represented sample
          var far = 0, fd = -1;
          for (var s2 = 0; s2 < S; s2++) { var dd = d2lab(X, s2 * 3, C, assign[s2] * 3); if (dd > fd) { fd = dd; far = s2; } }
          C[k2 * 3] = X[far * 3]; C[k2 * 3 + 1] = X[far * 3 + 1]; C[k2 * 3 + 2] = X[far * 3 + 2]; shift = 1;
        }
      }
      if (shift < 2e-4) break;
    }
    return { assign: assign, sse: sse };
  }

  function kmeansPP(X, S, K, fixed, rng) {
    var C = new Float32Array(K * 3), nf = fixed.length, D = new Float32Array(S), filled = 0;
    for (var f = 0; f < nf; f++) { C[f * 3] = fixed[f][0]; C[f * 3 + 1] = fixed[f][1]; C[f * 3 + 2] = fixed[f][2]; }
    filled = nf;
    if (filled === 0) { var r0 = Math.floor(rng() * S); C[0] = X[r0 * 3]; C[1] = X[r0 * 3 + 1]; C[2] = X[r0 * 3 + 2]; filled = 1; }
    D.fill(1e9);
    var upd = function (k) { for (var s = 0; s < S; s++) { var d = d2lab(X, s * 3, C, k * 3); if (d < D[s]) D[s] = d; } };
    for (var k = 0; k < filled; k++) upd(k);
    while (filled < K) {
      var sum = 0; for (var s = 0; s < S; s++) sum += D[s];
      var pick = S - 1;
      if (sum > 0) { var r = rng() * sum; for (var s2 = 0; s2 < S; s2++) { r -= D[s2]; if (r <= 0) { pick = s2; break; } } }
      C[filled * 3] = X[pick * 3]; C[filled * 3 + 1] = X[pick * 3 + 1]; C[filled * 3 + 2] = X[pick * 3 + 2];
      upd(filled); filled++;
    }
    return C;
  }

  // Perceptual palette: over-cluster into many tight sub-colors, then repeatedly merge the pair whose loss is
  // smallest. The loss grows with the color difference (hue counts more than lightness) but only gently with
  // population, so a small, distinct accent (an orange trim, a red stripe) outlives a second shade of a big
  // color. Pixels are later assigned through their sub-color, so assignment always agrees with the merges.
  // Locked colors are never absorbed and keep their exact value.
  var TUNE = { q: 0.3, wl: 0.45, wc: 3.0, wh: 2.0 }, DUP_T = 0.008;
  KC.tune = TUNE;
  function perceptualPalette(X, S, K, fixed, seed, wantCosts) {
    var nf = Math.min(fixed.length, Math.max(K, fixed.length));
    var K0 = Math.max(K, nf, Math.min(Math.max(64, K * 3), Math.floor(S / 30)));
    var rng = mulberry32(seed || 1);
    var C0 = kmeansPP(X, S, K0, fixed.slice(0, nf), rng);
    var res = lloyd(X, S, C0, K0, nf, 14);
    var cnt = new Float64Array(K0), cl = [], scale = 50000 / Math.max(1, S);
    for (var s = 0; s < S; s++) cnt[res.assign[s]]++;
    for (var k = 0; k < K0; k++) if (cnt[k] > 0 || k < nf) cl.push({ L: C0[k * 3], a: C0[k * 3 + 1], b: C0[k * 3 + 2], n: Math.max(cnt[k], 1) * scale, lock: k < nf ? k : -1, members: [k] });
    function cost(p, q) {
      if (p.lock >= 0 && q.lock >= 0) return Infinity;
      var dL = p.L - q.L, da = p.a - q.a, db = p.b - q.b;
      var dC = Math.sqrt(p.a * p.a + p.b * p.b) - Math.sqrt(q.a * q.a + q.b * q.b), dH2 = Math.max(0, da * da + db * db - dC * dC);
      return (dL * dL * TUNE.wl + dC * dC * TUNE.wc + dH2 * TUNE.wh) * Math.pow(Math.min(p.n, q.n), TUNE.q);
    }
    var costs = wantCosts ? {} : null, target = Math.max(K, nf, 1), floor = Math.max(nf, 1);
    while (cl.length > floor) {
      var bi = -1, bj = -1, bc = Infinity;
      for (var i = 0; i < cl.length; i++) for (var j = i + 1; j < cl.length; j++) {
        var c = cost(cl[i], cl[j]); if (c < bc) { bc = c; bi = i; bj = j; }
      }
      if (bi < 0) break;
      // past the requested count, keep folding only shades that are effectively the same color
      if (cl.length <= target && !(bc < DUP_T)) break;
      if (costs) costs[cl.length] = bc;
      var A = cl[bi], B = cl[bj], n = A.n + B.n, M;
      if (A.lock >= 0) M = { L: A.L, a: A.a, b: A.b, n: n, lock: A.lock };
      else if (B.lock >= 0) M = { L: B.L, a: B.a, b: B.b, n: n, lock: B.lock };
      else M = { L: (A.L * A.n + B.L * B.n) / n, a: (A.a * A.n + B.a * B.n) / n, b: (A.b * A.n + B.b * B.n) / n, n: n, lock: -1 };
      M.members = A.members.concat(B.members);
      cl.splice(bj, 1); cl[bi] = M;
    }
    // locked colors first in their given order, then by coverage
    var locks = cl.filter(function (c) { return c.lock >= 0; }).sort(function (p, q) { return p.lock - q.lock; });
    var free = cl.filter(function (c) { return c.lock < 0; }).sort(function (p, q) { return q.n - p.n; });
    var all = locks.concat(free), C = new Float32Array(all.length * 3), parent = new Int16Array(K0).fill(0);
    for (var t = 0; t < all.length; t++) {
      C[t * 3] = all[t].L; C[t * 3 + 1] = all[t].a; C[t * 3 + 2] = all[t].b;
      for (var m = 0; m < all[t].members.length; m++) parent[all[t].members[m]] = t;
    }
    return { C: C, K: all.length, sub: C0, K0: K0, parent: parent, costs: costs };
  }
  KC.perceptualPalette = perceptualPalette;

  // suggest a color count: stop merging right before the first merge that would join clearly distinct colors
  var SUGGEST_T = 0.2;
  function suggestK(X, S, fixedN) {
    var P = perceptualPalette(X, S, Math.max(1, fixedN), [], 11, true), lo = Math.max(2, fixedN);
    for (var m = Math.min(12, P.K0); m >= lo; m--) {
      // merging m -> m-1 colors; if every merge from here down is expensive, m is the answer
      if (P.costs[m] > SUGGEST_T) return m;
    }
    return lo;
  }
  KC._suggestCosts = function (X, S) { return perceptualPalette(X, S, 1, [], 11, true).costs; };

  function sampleColors(lab, fg, grad, N, maxS, seed) {
    var fgIdx = [];
    for (var i = 0; i < N; i++) if (fg[i]) fgIdx.push(i);
    if (!fgIdx.length) return { X: new Float32Array(0), S: 0, thr: 0.02 };
    // flat pixels only: anti-aliased transitions would otherwise spawn in-between colors
    var gs = [], stepG = Math.max(1, Math.floor(fgIdx.length / 20000));
    for (var k = 0; k < fgIdx.length; k += stepG) gs.push(grad[fgIdx[k]]);
    gs.sort(function (a, b) { return a - b; });
    var thr = gs[Math.floor(gs.length * 0.7)] + 1e-6;
    var flat = fgIdx.filter(function (i) { return grad[i] <= thr; });
    if (flat.length < 2000) flat = fgIdx;
    var rng = mulberry32(seed || 7), S = Math.min(maxS, flat.length), X = new Float32Array(S * 3);
    var stride = flat.length / S;
    for (var s = 0; s < S; s++) {
      var idx = flat[Math.min(flat.length - 1, Math.floor((s + rng()) * stride))];
      X[s * 3] = lab[idx * 3]; X[s * 3 + 1] = lab[idx * 3 + 1]; X[s * 3 + 2] = lab[idx * 3 + 2];
    }
    return { X: X, S: S, thr: thr };
  }

  // Anti-aliased edge pixels are blends of the colors on either side. Explain each edge pixel as a mix of two
  // colors found on nearby flat pixels (or the background) and give it to whichever side it is closer to.
  // Boundaries land on the true 50% line and in-between colors never form their own thin bands.
  function refineEdges(raw, lab, grad, W, H, C, bgLab, thr) {
    var out = new Int16Array(raw), R = 3, cand = new Int16Array(12), cc = new Float32Array(36);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var p = y * W + x, own = raw[p];
      if (own < 0 || grad[p] <= thr) continue;
      var nc = 1; cand[0] = own;
      var y0 = Math.max(0, y - R), y1 = Math.min(H - 1, y + R), x0 = Math.max(0, x - R), x1 = Math.min(W - 1, x + R);
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        var q = yy * W + xx, l = raw[q];
        if (l >= 0 && grad[q] > thr) continue;
        if (l < 0 && !bgLab) continue;
        var f = false; for (var u = 0; u < nc; u++) if (cand[u] === l) { f = true; break; }
        if (!f && nc < 12) cand[nc++] = l;
      }
      if (nc < 2) continue;
      for (var u2 = 0; u2 < nc; u2++) {
        var lv = cand[u2], src = lv < 0 ? bgLab : null;
        cc[u2 * 3] = src ? src[0] : C[lv * 3]; cc[u2 * 3 + 1] = src ? src[1] : C[lv * 3 + 1]; cc[u2 * 3 + 2] = src ? src[2] : C[lv * 3 + 2];
      }
      var pL = lab[p * 3], pa = lab[p * 3 + 1], pb = lab[p * 3 + 2], best = own, bd = 1e9;
      for (var i = 0; i < nc; i++) {
        var aL = cc[i * 3], aa = cc[i * 3 + 1], ab = cc[i * 3 + 2];
        var e0 = pL - aL, e1 = pa - aa, e2 = pb - ab, d0 = e0 * e0 + e1 * e1 + e2 * e2;
        if (d0 < bd) { bd = d0; best = cand[i]; }
        for (var j = i + 1; j < nc; j++) {
          var vL = cc[j * 3] - aL, va = cc[j * 3 + 1] - aa, vb = cc[j * 3 + 2] - ab, vv = vL * vL + va * va + vb * vb;
          if (vv < 1e-6) continue;
          var t = (e0 * vL + e1 * va + e2 * vb) / vv;
          if (t <= 0 || t >= 1) continue;
          var r0 = e0 - t * vL, r1 = e1 - t * va, r2 = e2 - t * vb, d = r0 * r0 + r1 * r1 + r2 * r2;
          if (d < bd) { bd = d; best = t < 0.5 ? cand[i] : cand[j]; }
        }
      }
      out[p] = best;
    }
    return out;
  }

  // ---------------------------------------------------------------- label-map cleanup
  function gaussKernel(sigma) {
    var r = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(2 * r + 1), sum = 0;
    for (var i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
    for (var j = 0; j < k.length; j++) k[j] /= sum;
    return { k: k, r: r };
  }
  // separable gaussian on a sub-rectangle [x0,x1) x [y0,y1), clamped edges
  function blurRect(buf, tmp, W, x0, y0, x1, y1, G) {
    var k = G.k, r = G.r;
    for (var y = y0; y < y1; y++) {
      var row = y * W;
      for (var x = x0; x < x1; x++) {
        var s = 0;
        for (var t = -r; t <= r; t++) { var xx = x + t; if (xx < x0) xx = x0; else if (xx >= x1) xx = x1 - 1; s += k[t + r] * buf[row + xx]; }
        tmp[row + x] = s;
      }
    }
    for (var y2 = y0; y2 < y1; y2++) {
      for (var x2 = x0; x2 < x1; x2++) {
        var s2 = 0;
        for (var t2 = -r; t2 <= r; t2++) { var yy = y2 + t2; if (yy < y0) yy = y0; else if (yy >= y1) yy = y1 - 1; s2 += k[t2 + r] * tmp[yy * W + x2]; }
        buf[y2 * W + x2] = s2;
      }
    }
  }

  // smooth region boundaries: argmax of gaussian-blurred one-hot label fields (a soft majority vote).
  // Done separably with a sparse per-pixel histogram (at most 4 labels), skipping uniform areas.
  function smoothLabels(labels, W, H, nLab, sigma) {
    var N = W * H, out = new Int16Array(labels);
    if (!(sigma > 0.3)) return out;
    var G = gaussKernel(sigma), k = G.k, r = G.r, M = 4;
    var hl = new Int16Array(N * M), hw = new Float32Array(N * M), hn = new Uint8Array(N);
    var runL = new Int32Array(W), runR = new Int32Array(W);
    for (var y = 0; y < H; y++) {
      var row = y * W;
      runL[0] = 1; for (var x = 1; x < W; x++) runL[x] = labels[row + x] === labels[row + x - 1] ? runL[x - 1] + 1 : 1;
      runR[W - 1] = 1; for (var x1 = W - 2; x1 >= 0; x1--) runR[x1] = labels[row + x1] === labels[row + x1 + 1] ? runR[x1 + 1] + 1 : 1;
      for (var x2 = 0; x2 < W; x2++) {
        var i = row + x2, o = i * M;
        if ((runL[x2] > r || runL[x2] > x2) && (runR[x2] > r || runR[x2] >= W - x2)) { hn[i] = 1; hl[o] = labels[i]; hw[o] = 1; continue; }
        var n = 0;
        for (var t = -r; t <= r; t++) {
          var xx = x2 + t; if (xx < 0) xx = 0; else if (xx >= W) xx = W - 1;
          var l = labels[row + xx], w = k[t + r], f = -1;
          for (var q = 0; q < n; q++) if (hl[o + q] === l) { f = q; break; }
          if (f >= 0) hw[o + f] += w;
          else if (n < M) { hl[o + n] = l; hw[o + n] = w; n++; }
          else { var mi = 0; for (var q2 = 1; q2 < M; q2++) if (hw[o + q2] < hw[o + mi]) mi = q2; if (hw[o + mi] < w) { hl[o + mi] = l; hw[o + mi] = w; } }
        }
        hn[i] = n;
      }
    }
    var accL = new Int16Array(16), accW = new Float32Array(16);
    for (var y2 = 0; y2 < H; y2++) {
      for (var x3 = 0; x3 < W; x3++) {
        var i2 = y2 * W + x3, own = labels[i2], uniform = true;
        for (var t2 = -r; t2 <= r; t2++) {
          var yy = y2 + t2; if (yy < 0) yy = 0; else if (yy >= H) yy = H - 1;
          var j = yy * W + x3;
          if (hn[j] !== 1 || hl[j * M] !== own) { uniform = false; break; }
        }
        if (uniform) continue;
        var na = 0;
        for (var t3 = -r; t3 <= r; t3++) {
          var y3 = y2 + t3; if (y3 < 0) y3 = 0; else if (y3 >= H) y3 = H - 1;
          var j2 = y3 * W + x3, o2 = j2 * M, cnt = hn[j2], wv = k[t3 + r];
          for (var e = 0; e < cnt; e++) {
            var l2 = hl[o2 + e], w2 = hw[o2 + e] * wv, f2 = -1;
            for (var q3 = 0; q3 < na; q3++) if (accL[q3] === l2) { f2 = q3; break; }
            if (f2 >= 0) accW[f2] += w2; else if (na < 16) { accL[na] = l2; accW[na] = w2; na++; }
          }
        }
        var bl = own, bw = -1;
        for (var q4 = 0; q4 < na; q4++) if (accW[q4] > bw || (accW[q4] === bw && accL[q4] === own)) { bw = accW[q4]; bl = accL[q4]; }
        out[i2] = bl;
      }
    }
    return out;
  }

  // 4-connected components (two-pass union-find). comp: per-pixel id; labs/areas per component
  var PAR = new Int32Array(1);
  function components(labels, W, H) {
    var N = W * H, comp = new Int32Array(N), next = 0;
    if (PAR.length < N) PAR = new Int32Array(N);
    var par = PAR;
    function find(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
    for (var y = 0; y < H; y++) {
      var row = y * W;
      for (var x = 0; x < W; x++) {
        var i = row + x, l = labels[i];
        var up = (y > 0 && labels[i - W] === l) ? comp[i - W] : -1, lf = (x > 0 && labels[i - 1] === l) ? comp[i - 1] : -1;
        if (up < 0 && lf < 0) { comp[i] = next; par[next] = next; next++; }
        else if (up >= 0 && lf >= 0) {
          var ra = find(up), rb = find(lf);
          if (ra !== rb) { if (ra < rb) par[rb] = ra; else par[ra] = rb; }
          comp[i] = ra < rb ? ra : rb;
        } else comp[i] = up >= 0 ? up : lf;
      }
    }
    var remap = new Int32Array(next).fill(-1), n = 0, labs = [], areas = [];
    for (var j = 0; j < N; j++) {
      var rt = find(comp[j]), id = remap[rt];
      if (id < 0) { id = remap[rt] = n++; labs.push(labels[j]); areas.push(0); }
      comp[j] = id; areas[id]++;
    }
    return { comp: comp, labs: labs, areas: areas, n: n };
  }

  // merge regions smaller than minArea into the neighbor they share the most border with
  // (neighbors that are themselves too small only count when they are bigger, so specks never swap)
  function removeSmall(labels, W, H, nLab, minArea, out) {
    var merged = 0;
    if (out) out.cc = null;
    if (!(minArea > 1)) return merged;
    var NL = nLab + 2;
    for (var pass = 0; pass < 6; pass++) {
      var cc = components(labels, W, H), comp = cc.comp, areas = cc.areas, small = new Uint8Array(cc.n), any = false;
      for (var c = 0; c < cc.n; c++) if (areas[c] < minArea) { small[c] = 1; any = true; }
      if (!any) { if (out) out.cc = cc; break; }
      var big = new Map(), sm = new Map();
      var add = function (m, key) { m.set(key, (m.get(key) || 0) + 1); };
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var p = y * W + x, cp = comp[p];
        if (!small[cp]) continue;
        for (var t = 0; t < 4; t++) {
          var q;
          if (t === 0) { if (x === 0) continue; q = p - 1; } else if (t === 1) { if (x === W - 1) continue; q = p + 1; }
          else if (t === 2) { if (y === 0) continue; q = p - W; } else { if (y === H - 1) continue; q = p + W; }
          var cq = comp[q]; if (cq === cp) continue;
          var key = cp * NL + labels[q] + 1;
          if (!small[cq]) add(big, key); else if (areas[cq] > areas[cp] || (areas[cq] === areas[cp] && cq > cp)) add(sm, key);
        }
      }
      var tgt = new Int32Array(cc.n).fill(-9), tc = new Int32Array(cc.n);
      big.forEach(function (v, key) { var c2 = Math.floor(key / NL); if (v > tc[c2]) { tc[c2] = v; tgt[c2] = key % NL - 1; } });
      sm.forEach(function (v, key) { var c3 = Math.floor(key / NL); if (tgt[c3] === -9 || (tc[c3] < 0 && -v < tc[c3])) { tc[c3] = -v; tgt[c3] = key % NL - 1; } });
      var changed = 0;
      for (var c4 = 0; c4 < cc.n; c4++) if (small[c4] && tgt[c4] !== -9) changed++;
      if (!changed) break;
      for (var k = 0; k < W * H; k++) { var ck = comp[k]; if (small[ck] && tgt[ck] !== -9) labels[k] = tgt[ck]; }
      merged += changed;
    }
    return merged;
  }

  // break 2x2 checkerboards so no region touches another of the same color only at a corner
  function removeSaddles(labels, W, H) {
    for (var pass = 0; pass < 4; pass++) {
      var changed = 0;
      for (var y = 0; y < H - 1; y++) for (var x = 0; x < W - 1; x++) {
        var i = y * W + x, a = labels[i], b = labels[i + 1], c = labels[i + W], d = labels[i + W + 1];
        if (a === d && b === c && a !== b) { labels[i + 1] = a; changed++; }
      }
      if (!changed) break;
    }
  }

  function floodSet(labels, W, H, x, y, to) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    var s = y * W + x, from = labels[s];
    if (from === to) return 0;
    var st = [s], n = 0; labels[s] = to;
    while (st.length) {
      var p = st.pop(), px = p % W, py = (p - px) / W; n++;
      if (px > 0 && labels[p - 1] === from) { labels[p - 1] = to; st.push(p - 1); }
      if (px < W - 1 && labels[p + 1] === from) { labels[p + 1] = to; st.push(p + 1); }
      if (py > 0 && labels[p - W] === from) { labels[p - W] = to; st.push(p - W); }
      if (py < H - 1 && labels[p + W] === from) { labels[p + W] = to; st.push(p + W); }
    }
    return n;
  }
  KC.floodSet = floodSet;

  // ---------------------------------------------------------------- curve fitting (Schneider, Graphics Gems)
  function bzPt(b, t) {
    var mt = 1 - t, a = mt * mt * mt, c1 = 3 * mt * mt * t, c2 = 3 * mt * t * t, d = t * t * t;
    return [a * b[0] + c1 * b[2] + c2 * b[4] + d * b[6], a * b[1] + c1 * b[3] + c2 * b[5] + d * b[7]];
  }
  function bzD1(b, t) {
    var mt = 1 - t, a = 3 * mt * mt, c = 6 * mt * t, d = 3 * t * t;
    return [a * (b[2] - b[0]) + c * (b[4] - b[2]) + d * (b[6] - b[4]), a * (b[3] - b[1]) + c * (b[5] - b[3]) + d * (b[7] - b[5])];
  }
  function bzD2(b, t) {
    var mt = 1 - t;
    return [6 * mt * (b[4] - 2 * b[2] + b[0]) + 6 * t * (b[6] - 2 * b[4] + b[2]), 6 * mt * (b[5] - 2 * b[3] + b[1]) + 6 * t * (b[7] - 2 * b[5] + b[3])];
  }
  function norm2(x, y) { var l = Math.sqrt(x * x + y * y); return l > 1e-12 ? [x / l, y / l] : null; }

  function fitCurve(xs, ys, tol, tL, tR, out) {
    var n = xs.length;
    var tol2 = tol * tol;
    function pushLine(a, b, t1, t2) {
      var dx = xs[b] - xs[a], dy = ys[b] - ys[a], d = Math.sqrt(dx * dx + dy * dy) / 3;
      out.push(xs[a] + t1[0] * d, ys[a] + t1[1] * d, xs[b] + t2[0] * d, ys[b] + t2[1] * d, xs[b], ys[b]);
    }
    function chord(a, b) {
      var u = new Float64Array(b - a + 1); u[0] = 0;
      for (var i = a + 1; i <= b; i++) { var dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1]; u[i - a] = u[i - a - 1] + Math.sqrt(dx * dx + dy * dy); }
      var tot = u[b - a];
      if (tot <= 1e-12) return null;
      for (var j = 1; j <= b - a; j++) u[j] /= tot;
      return u;
    }
    function gen(a, b, u, t1, t2) {
      var x0 = xs[a], y0 = ys[a], x3 = xs[b], y3 = ys[b];
      var c00 = 0, c01 = 0, c11 = 0, X0 = 0, X1 = 0;
      for (var i = 0; i <= b - a; i++) {
        var t = u[i], mt = 1 - t, b1 = 3 * t * mt * mt, b2 = 3 * t * t * mt;
        var A0x = t1[0] * b1, A0y = t1[1] * b1, A1x = t2[0] * b2, A1y = t2[1] * b2;
        c00 += A0x * A0x + A0y * A0y; c01 += A0x * A1x + A0y * A1y; c11 += A1x * A1x + A1y * A1y;
        var b0 = mt * mt * mt + b1, b3 = b2 + t * t * t;
        var tx = xs[a + i] - (x0 * b0 + x3 * b3), ty = ys[a + i] - (y0 * b0 + y3 * b3);
        X0 += A0x * tx + A0y * ty; X1 += A1x * tx + A1y * ty;
      }
      var det = c00 * c11 - c01 * c01, al = 0, ar = 0;
      if (Math.abs(det) > 1e-12) { al = (X0 * c11 - X1 * c01) / det; ar = (c00 * X1 - c01 * X0) / det; }
      var seg = Math.sqrt((x3 - x0) * (x3 - x0) + (y3 - y0) * (y3 - y0)), eps = 1e-6 * seg;
      if (al < eps || ar < eps || al > seg * 2 || ar > seg * 2) { al = ar = seg / 3; }
      return [x0, y0, x0 + t1[0] * al, y0 + t1[1] * al, x3 + t2[0] * ar, y3 + t2[1] * ar, x3, y3];
    }
    function maxErr(a, b, bz, u) {
      var mx = 0, sp = (a + b) >> 1;
      for (var i = a + 1; i < b; i++) {
        var p = bzPt(bz, u[i - a]), dx = p[0] - xs[i], dy = p[1] - ys[i], d = dx * dx + dy * dy;
        if (d > mx) { mx = d; sp = i; }
      }
      return [mx, sp];
    }
    function reparam(a, b, bz, u) {
      var nu = new Float64Array(u.length);
      for (var i = 0; i <= b - a; i++) {
        var t = u[i], p = bzPt(bz, t), d1 = bzD1(bz, t), d2 = bzD2(bz, t);
        var dx = p[0] - xs[a + i], dy = p[1] - ys[a + i];
        var num = dx * d1[0] + dy * d1[1], den = d1[0] * d1[0] + d1[1] * d1[1] + dx * d2[0] + dy * d2[1];
        var v = den === 0 ? t : t - num / den;
        nu[i] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
      return nu;
    }
    function rec(a, b, t1, t2, depth) {
      if (b - a < 2 || depth > 40) { pushLine(a, b, t1, t2); return; }
      var u = chord(a, b);
      if (!u) { pushLine(a, b, t1, t2); return; }
      var bz = gen(a, b, u, t1, t2), e = maxErr(a, b, bz, u);
      if (e[0] < tol2) { out.push(bz[2], bz[3], bz[4], bz[5], bz[6], bz[7]); return; }
      if (e[0] < tol2 * 16) {
        for (var it = 0; it < 12; it++) {
          u = reparam(a, b, bz, u); bz = gen(a, b, u, t1, t2); e = maxErr(a, b, bz, u);
          if (e[0] < tol2) { out.push(bz[2], bz[3], bz[4], bz[5], bz[6], bz[7]); return; }
        }
      }
      var sp = e[1]; if (sp <= a) sp = a + 1; if (sp >= b) sp = b - 1;
      var tc = norm2(xs[sp - 1] - xs[sp + 1], ys[sp - 1] - ys[sp + 1]);
      if (!tc) { var q = norm2(xs[sp - 1] - xs[sp], ys[sp - 1] - ys[sp]) || [1, 0]; tc = [-q[1], q[0]]; }
      rec(a, sp, t1, tc, depth + 1);
      rec(sp, b, [-tc[0], -tc[1]], t2, depth + 1);
    }
    if (n < 2) return;
    rec(0, n - 1, tL, tR, 0);
  }

  function tangentAt(xs, ys, i, dir, closed) {
    var n = xs.length;
    for (var k = 1; k <= 3; k++) {
      var j = i + dir * k;
      if (closed) j = ((j % n) + n) % n; else if (j < 0 || j >= n) break;
      var t = norm2(xs[j] - xs[i], ys[j] - ys[i]);
      if (t && k >= Math.min(2, n - 1)) return t;
    }
    var j2 = closed ? (((i + dir) % n) + n) % n : Math.max(0, Math.min(n - 1, i + dir));
    return norm2(xs[j2] - xs[i], ys[j2] - ys[i]) || [dir, 0];
  }

  // gaussian smoothing with both ends pinned (odd reflection keeps the end tangent natural)
  function smoothOpen(xs, ys, sigma) {
    var n = xs.length, ox = Float64Array.from(xs), oy = Float64Array.from(ys);
    if (n < 4 || !(sigma > 0.2)) return [ox, oy];
    var s = Math.min(sigma, (n - 1) / 3), G = gaussKernel(s), k = G.k, r = G.r, last = n - 1;
    for (var i = 1; i < last; i++) {
      var sx = 0, sy = 0;
      for (var t = -r; t <= r; t++) {
        var j = i + t, px, py;
        if (j < 0) { var jj = Math.min(last, -j); px = 2 * xs[0] - xs[jj]; py = 2 * ys[0] - ys[jj]; }
        else if (j > last) { var jk = Math.max(0, 2 * last - j); px = 2 * xs[last] - xs[jk]; py = 2 * ys[last] - ys[jk]; }
        else { px = xs[j]; py = ys[j]; }
        sx += k[t + r] * px; sy += k[t + r] * py;
      }
      ox[i] = sx; oy[i] = sy;
    }
    return [ox, oy];
  }
  function smoothClosed(xs, ys, sigma) {
    var n = xs.length, ox = Float64Array.from(xs), oy = Float64Array.from(ys);
    if (n < 5 || !(sigma > 0.2)) return [ox, oy];
    var s = Math.min(sigma, n / 6), G = gaussKernel(s), k = G.k, r = G.r;
    for (var i = 0; i < n; i++) {
      var sx = 0, sy = 0;
      for (var t = -r; t <= r; t++) { var j = ((i + t) % n + n) % n; sx += k[t + r] * xs[j]; sy += k[t + r] * ys[j]; }
      ox[i] = sx; oy[i] = sy;
    }
    return [ox, oy];
  }

  function turnDeg(xs, ys, i, k, n, closed) {
    var a = i - k, b = i + k;
    if (closed) { a = ((a % n) + n) % n; b = b % n; } else if (a < 0 || b >= n) return 0;
    var ax = xs[i] - xs[a], ay = ys[i] - ys[a], bx = xs[b] - xs[i], by = ys[b] - ys[i];
    var la = Math.sqrt(ax * ax + ay * ay), lb = Math.sqrt(bx * bx + by * by);
    if (la < 1e-9 || lb < 1e-9) return 0;
    var c = (ax * bx + ay * by) / (la * lb);
    return Math.acos(c > 1 ? 1 : c < -1 ? -1 : c) * 57.29577951308232;
  }

  // angle between the arm arriving at i (from i-b to i-a) and the arm leaving it (from i+a to i+b)
  function armDeg(qx, qy, i, a, b, n, closed) {
    var p0 = i - b, p1 = i - a, p2 = i + a, p3 = i + b;
    if (closed) { p0 = ((p0 % n) + n) % n; p1 = ((p1 % n) + n) % n; p2 = p2 % n; p3 = p3 % n; }
    else { if (p1 <= 0 || p2 >= n - 1) return 0; if (p0 < 0) p0 = 0; if (p3 > n - 1) p3 = n - 1; }
    var ax = qx[p1] - qx[p0], ay = qy[p1] - qy[p0], bx = qx[p3] - qx[p2], by = qy[p3] - qy[p2];
    var la = Math.sqrt(ax * ax + ay * ay), lb = Math.sqrt(bx * bx + by * by);
    if (la < 0.8 || lb < 0.8) return 0;
    var c = (ax * bx + ay * by) / (la * lb);
    return Math.acos(c > 1 ? 1 : c < -1 ? -1 : c) * 57.29577951308232;
  }

  function detectCorners(xs, ys, closed, theta) {
    var n = xs.length, res = [];
    if (theta >= 179 || n < (closed ? 8 : 6)) return { idx: res, qx: null, qy: null };
    var q = closed ? smoothClosed(xs, ys, 0.6) : smoothOpen(xs, ys, 0.6), qx = q[0], qy = q[1];
    var NMS = 2, A = new Uint8Array(n), sc = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var tA = armDeg(qx, qy, i, 1, 4, n, closed), tB = armDeg(qx, qy, i, 2, 6, n, closed), b2 = turnDeg(qx, qy, i, 2, n, closed);
      var t = tA > tB ? tA : tB;
      A[i] = (t >= theta && b2 >= theta * 0.35) ? 1 : 0; sc[i] = tA + tB + b2;
    }
    for (var j = 0; j < n; j++) {
      if (!A[j]) continue;
      var isMax = true;
      for (var d = -NMS; d <= NMS && isMax; d++) {
        if (d === 0) continue;
        var m = j + d;
        if (closed) m = ((m % n) + n) % n; else if (m < 0 || m >= n) continue;
        if (A[m] && (sc[m] > sc[j] || (sc[m] === sc[j] && d < 0))) isMax = false;
      }
      if (isMax && (closed || (j > 1 && j < n - 2))) res.push(j);
    }
    var out = [];
    for (var r = 0; r < res.length; r++) {
      if (out.length && res[r] - out[out.length - 1] < 3) continue;
      out.push(res[r]);
    }
    if (closed && out.length > 1 && (out[0] + n - out[out.length - 1]) < 3) out.pop();
    return { idx: out, qx: qx, qy: qy };
  }

  // Put a corner where its two sides meet: intersect lines fitted to the run just before and just after it.
  function sharpenCorner(qx, qy, n, closed, i, lo, hi, sx, sy) {
    var g = function (k) { if (closed) k = ((k % n) + n) % n; return k; };
    var a0 = Math.max(i - 7, lo), a1 = i - 1, b0 = i + 1, b1 = Math.min(i + 7, hi);
    if (a1 - a0 < 2 || b1 - b0 < 2) return null;
    var ax = qx[g(a0)], ay = qy[g(a0)], bx = qx[g(a1)], by = qy[g(a1)], cx = qx[g(b0)], cy = qy[g(b0)], dx = qx[g(b1)], dy = qy[g(b1)];
    var ux = bx - ax, uy = by - ay, vx = dx - cx, vy = dy - cy, den = ux * vy - uy * vx;
    var lu = Math.sqrt(ux * ux + uy * uy), lv = Math.sqrt(vx * vx + vy * vy);
    if (lu < 1e-6 || lv < 1e-6 || Math.abs(den) / (lu * lv) < 0.45) return null;
    var t = ((cx - ax) * vy - (cy - ay) * vx) / den, px = ax + ux * t, py = ay + uy * t;
    var ex = px - sx, ey = py - sy;
    if (ex * ex + ey * ey > 2.2 * 2.2) return null;
    return [px, py];
  }

  // Fit one boundary run. pts: midpoints of pixel-crack edges (open runs carry their junction endpoints).
  // cx, cy: the crack-corner coordinates used to snap detected corners onto the true pixel corner.
  function fitRun(xs, ys, closed, cx, cy, opt) {
    var n = xs.length, out = [];
    if (!closed && n <= 3) {
      out.push(xs[0], ys[0]);
      var dx = xs[n - 1] - xs[0], dy = ys[n - 1] - ys[0];
      out.push(xs[0] + dx / 3, ys[0] + dy / 3, xs[0] + 2 * dx / 3, ys[0] + 2 * dy / 3, xs[n - 1], ys[n - 1]);
      return out;
    }
    var dc = detectCorners(xs, ys, closed, opt.cornerDeg), cs = dc.idx;
    // snap: point i is the midpoint of crack edge (ci_a -> ci_b); move it onto whichever end actually turns
    var nc = cx.length;
    function isTurn(j) {
      var jp = j - 1, jn = j + 1;
      if (closed) { jp = (jp + nc) % nc; jn = jn % nc; } else if (jp < 0 || jn >= nc) return false;
      return (cx[j] - cx[jp]) !== (cx[jn] - cx[j]) || (cy[j] - cy[jp]) !== (cy[jn] - cy[j]);
    }
    var sx = Float64Array.from(xs), sy = Float64Array.from(ys);
    for (var c = 0; c < cs.length; c++) {
      var i = cs[c], ja = closed ? i : i - 1, jb = closed ? (i + 1) % nc : i;
      if (isTurn(jb)) { sx[i] = cx[jb]; sy[i] = cy[jb]; } else if (isTurn(ja)) { sx[i] = cx[ja]; sy[i] = cy[ja]; }
      var lo = c > 0 ? cs[c - 1] + 1 : (closed ? cs[cs.length - 1] - n + 1 : 0);
      var hi = c < cs.length - 1 ? cs[c + 1] - 1 : (closed ? cs[0] + n - 1 : n - 1);
      if (cs.length === 1 && closed) { lo = i - n + 1; hi = i + n - 1; }
      var sh = sharpenCorner(dc.qx, dc.qy, n, closed, i, lo, hi, sx[i], sy[i]);
      if (sh) { sx[i] = sh[0]; sy[i] = sh[1]; }
    }
    var tol = opt.tol, sig = opt.sigma;
    function piece(idx) {
      var m = idx.length, px = new Float64Array(m), py = new Float64Array(m);
      for (var u = 0; u < m; u++) { px[u] = sx[idx[u]]; py[u] = sy[idx[u]]; }
      var sm = smoothOpen(px, py, sig);
      var tL = tangentAt(sm[0], sm[1], 0, 1, false), tR = tangentAt(sm[0], sm[1], m - 1, -1, false);
      fitCurve(sm[0], sm[1], tol, tL, tR, out);
    }
    if (!closed) {
      out.push(sx[0], sy[0]);
      var cuts = [0].concat(cs, [n - 1]);
      for (var p = 0; p < cuts.length - 1; p++) {
        var idx = []; for (var q = cuts[p]; q <= cuts[p + 1]; q++) idx.push(q);
        piece(idx);
      }
      return out;
    }
    if (!cs.length) {
      var sm2 = smoothClosed(xs, ys, sig), ax = Array.from(sm2[0]), ay = Array.from(sm2[1]);
      ax.push(ax[0]); ay.push(ay[0]);
      var t0 = norm2(ax[1] - ax[n - 1], ay[1] - ay[n - 1]) || [1, 0];
      out.push(ax[0], ay[0]);
      fitCurve(ax, ay, tol, t0, [-t0[0], -t0[1]], out);
      return out;
    }
    out.push(sx[cs[0]], sy[cs[0]]);
    for (var p2 = 0; p2 < cs.length; p2++) {
      var a = cs[p2], b = p2 + 1 < cs.length ? cs[p2 + 1] : cs[0] + n, idx2 = [];
      for (var q2 = a; q2 <= b; q2++) idx2.push(q2 % n);
      piece(idx2);
    }
    return out;
  }

  function reverseBz(b) {
    var n = b.length / 2, out = new Array(b.length);
    for (var i = 0; i < n; i++) { out[2 * i] = b[2 * (n - 1 - i)]; out[2 * i + 1] = b[2 * (n - 1 - i) + 1]; }
    return out;
  }

  // ---------------------------------------------------------------- tracing (shared edges => no gaps, no overlaps)
  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], CX = [0, 1, 1, 0], CY = [0, 0, 1, 1];

  function traceLabels(labels, W, H, nLab, opt) {
    var W1 = W + 1, NC = W1 * (H + 1), WP = W + 2, PL = new Int16Array(WP * (H + 2)).fill(-1);
    for (var py0 = 0; py0 < H; py0++) PL.set(labels.subarray(py0 * W, py0 * W + W), (py0 + 1) * WP + 1);
    function L(x, y) { return PL[(y + 1) * WP + x + 1]; }
    var junction = new Uint8Array(NC);
    for (var cy = 0; cy <= H; cy++) {
      var r0 = cy * WP, r1 = r0 + WP;
      for (var cx = 0; cx <= W; cx++) {
        var tl = PL[r0 + cx], tr = PL[r0 + cx + 1], bl = PL[r1 + cx], br = PL[r1 + cx + 1];
        if (tl === tr && bl === br) continue;
        var cnt = (tl !== tr ? 1 : 0) + (bl !== br ? 1 : 0) + (tl !== bl ? 1 : 0) + (tr !== br ? 1 : 0);
        if (cnt >= 3) junction[cy * W1 + cx] = 1;
      }
    }
    var visited = new Uint8Array(W * H * 4), cache = new Map(), cycles = [];
    for (var l0 = 0; l0 < nLab; l0++) cycles.push([]);
    var offX = opt.offX || 0, offY = opt.offY || 0;
    var cornersBuf = [];

    function runFromCorners(seq, closed) {
      var m = seq.length, xs, ys, ccx = new Float64Array(m), ccy = new Float64Array(m);
      for (var i = 0; i < m; i++) { ccx[i] = seq[i] % W1; ccy[i] = (seq[i] - ccx[i]) / W1; }
      if (closed) {
        xs = new Float64Array(m); ys = new Float64Array(m);
        for (var j = 0; j < m; j++) { var k = (j + 1) % m; xs[j] = (ccx[j] + ccx[k]) / 2; ys[j] = (ccy[j] + ccy[k]) / 2; }
      } else {
        xs = new Float64Array(m + 1); ys = new Float64Array(m + 1);
        xs[0] = ccx[0]; ys[0] = ccy[0];
        for (var j2 = 0; j2 < m - 1; j2++) { xs[j2 + 1] = (ccx[j2] + ccx[j2 + 1]) / 2; ys[j2 + 1] = (ccy[j2] + ccy[j2 + 1]) / 2; }
        xs[m] = ccx[m - 1]; ys[m] = ccy[m - 1];
      }
      return fitRun(xs, ys, closed, ccx, ccy, opt);
    }

    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i0 = y * W + x, a = labels[i0];
      if (a < 0) continue;
      var pc = (y + 1) * WP + x + 1;
      if (PL[pc - 1] === a && PL[pc + 1] === a && PL[pc - WP] === a && PL[pc + WP] === a) continue;
      for (var s0 = 0; s0 < 4; s0++) {
        if (visited[i0 * 4 + s0]) continue;
        var nd = (s0 + 3) & 3;
        if (L(x + DX[nd], y + DY[nd]) === a) continue;
        // walk the boundary keeping region `a` on the right; prefer right turns (4-connected regions)
        var px = x, py = y, s = s0, corners = cornersBuf; corners.length = 0;
        corners.push((py + CY[s]) * W1 + px + CX[s]);
        var guard = 0;
        do {
          visited[(py * W + px) * 4 + s] = 1;
          var e = (s + 1) & 3;
          corners.push((py + CY[e]) * W1 + px + CX[e]);
          var ax = px + DX[s], ay = py + DY[s];
          if (L(ax, ay) !== a) { s = (s + 1) & 3; }
          else {
            var bx = ax + DY[s], by = ay - DX[s];
            if (L(bx, by) !== a) { px = ax; py = ay; }
            else { px = bx; py = by; s = (s + 3) & 3; }
          }
          if (++guard > 50000000) break;
        } while (!(px === x && py === y && s === s0));
        corners.pop();
        var n = corners.length, J = [];
        for (var k = 0; k < n; k++) if (junction[corners[k]]) J.push(k);
        var bz;
        if (!J.length) {
          var mi = 0; for (var k2 = 1; k2 < n; k2++) if (corners[k2] < corners[mi]) mi = k2;
          var fwd = corners[(mi + 1) % n] < corners[(mi - 1 + n) % n];
          var key = -(corners[mi] + 1), hit = cache.get(key);
          if (!hit) {
            var seq = new Array(n);
            for (var k3 = 0; k3 < n; k3++) seq[k3] = corners[fwd ? (mi + k3) % n : (mi - k3 + n) % n];
            hit = runFromCorners(seq, true); cache.set(key, hit);
          }
          bz = fwd ? hit : reverseBz(hit);
        } else {
          bz = [];
          for (var t = 0; t < J.length; t++) {
            var ja = J[t], jb = t + 1 < J.length ? J[t + 1] : J[0] + n, seg = [];
            for (var q = ja; q <= jb; q++) seg.push(corners[q % n]);
            var sl = seg.length - 1, e1 = seg[0] * NC + seg[1], e2 = seg[sl] * NC + seg[sl - 1], f2 = e1 < e2;
            var key2 = f2 ? e1 : e2, hit2 = cache.get(key2);
            if (!hit2) { hit2 = runFromCorners(f2 ? seg : seg.slice().reverse(), false); cache.set(key2, hit2); }
            var part = f2 ? hit2 : reverseBz(hit2);
            for (var u = (bz.length ? 2 : 0); u < part.length; u++) bz.push(part[u]);
          }
        }
        cycles[a].push(bz);
      }
    }
    var paths = [], nodes = [];
    for (var l = 0; l < nLab; l++) {
      var parts = [], nn = 0;
      for (var c = 0; c < cycles[l].length; c++) {
        var b = cycles[l][c], sArr = ['M', fmt(b[0] + offX), fmt(b[1] + offY)];
        for (var v = 2; v + 5 < b.length; v += 6) {
          sArr.push('C', fmt(b[v] + offX), fmt(b[v + 1] + offY), fmt(b[v + 2] + offX), fmt(b[v + 3] + offY), fmt(b[v + 4] + offX), fmt(b[v + 5] + offY));
          nn++;
        }
        sArr.push('Z'); parts.push(sArr.join(' '));
      }
      paths.push(parts.join(' ')); nodes.push(nn);
    }
    return { paths: paths, nodes: nodes };
  }
  function fmt(v) { var r = Math.round(v * 100) / 100; return (r === 0 ? 0 : r).toString(); }
  KC.traceLabels = traceLabels;

  // trace a single 0/1 mask (Uint8) -> path string
  function traceMask(mask, W, H, opt) {
    var lab = new Int16Array(W * H);
    for (var i = 0; i < W * H; i++) lab[i] = mask[i] ? 0 : -1;
    removeSaddles(lab, W, H);
    var r = traceLabels(lab, W, H, 1, opt);
    return { d: r.paths[0], nodes: r.nodes[0] };
  }
  KC.traceMask = traceMask;

  // ---------------------------------------------------------------- distance transform (Felzenszwalb)
  function edt1d(f, n, d, v, z) {
    var k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (var q = 1; q < n; q++) {
      var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    k = 0;
    for (var q2 = 0; q2 < n; q2++) { while (z[k + 1] < q2) k++; var dq = q2 - v[k]; d[q2] = dq * dq + f[v[k]]; }
  }
  // squared distance to the nearest set pixel, computed only inside rect
  function edtRect(mask, W, x0, y0, x1, y1) {
    var w = x1 - x0, h = y1 - y0, D = new Float64Array(w * h), m = Math.max(w, h);
    var f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) D[y * w + x] = mask[(y + y0) * W + x + x0] ? 0 : 1e20;
    for (var x2 = 0; x2 < w; x2++) {
      for (var y2 = 0; y2 < h; y2++) f[y2] = D[y2 * w + x2];
      edt1d(f, h, d, v, z);
      for (var y3 = 0; y3 < h; y3++) D[y3 * w + x2] = d[y3];
    }
    for (var y4 = 0; y4 < h; y4++) {
      for (var x4 = 0; x4 < w; x4++) f[x4] = D[y4 * w + x4];
      edt1d(f, w, d, v, z);
      for (var x5 = 0; x5 < w; x5++) D[y4 * w + x5] = d[x5];
    }
    return D;
  }

  // ---------------------------------------------------------------- cut layers for heat-transfer vinyl
  // mode 'overlap': each layer tucks `trap` px under the layers pressed on top of it (hides small misalignment)
  // mode 'underlay': like overlap, and lower layers also fill solid under any upper layer they surround
  // Works inside the layer's own bounding box; returns a local mask plus its rect.
  function buildCutMask(labels, W, H, id, bbox, orderOf, cutOf, mode, trapPx, minArea) {
    var r = Math.ceil(trapPx) + 2;
    var rx0 = Math.max(0, bbox[0] - r), ry0 = Math.max(0, bbox[1] - r), rx1 = Math.min(W, bbox[2] + r), ry1 = Math.min(H, bbox[3] + r);
    var rw = rx1 - rx0, rh = ry1 - ry0, n = rw * rh, mask = new Uint8Array(n), myO = orderOf[id];
    for (var y = 0; y < rh; y++) { var src = (y + ry0) * W + rx0, dst = y * rw; for (var x = 0; x < rw; x++) if (labels[src + x] === id) mask[dst + x] = 1; }
    var added = 0;
    function above(lp) { var l = labels[lp]; return l >= 0 && l !== id && cutOf[l] && orderOf[l] > myO; }
    // anything above this layer inside its box at all? if not, the cut is just the layer itself
    var anyAbove = false;
    for (var ya = 0; ya < rh && !anyAbove; ya++) for (var xa = 0; xa < rw; xa++) if (above((ya + ry0) * W + xa + rx0)) { anyAbove = true; break; }
    if (!anyAbove) return { mask: mask, rect: [rx0, ry0, rw, rh], added: 0 };
    if (trapPx > 0.2) {
      var D = edtRect(mask, rw, 0, 0, rw, rh), t2 = trapPx * trapPx;
      for (var y2 = 0; y2 < rh; y2++) for (var x2 = 0; x2 < rw; x2++) {
        var p = y2 * rw + x2;
        if (!mask[p] && D[p] <= t2 && above((y2 + ry0) * W + x2 + rx0)) { mask[p] = 2; added++; }
      }
    }
    if (mode === 'underlay') {
      var out = new Uint8Array(n), st = [];
      for (var bx = 0; bx < rw; bx++) st.push(bx, (rh - 1) * rw + bx);
      for (var by = 0; by < rh; by++) st.push(by * rw, by * rw + rw - 1);
      while (st.length) {
        var q = st.pop();
        if (out[q] || mask[q]) continue;
        out[q] = 1; var qx = q % rw, qy = (q - qx) / rw;
        if (qx > 0) st.push(q - 1); if (qx < rw - 1) st.push(q + 1); if (qy > 0) st.push(q - rw); if (qy < rh - 1) st.push(q + rw);
      }
      for (var j = 0; j < n; j++) if (!mask[j] && !out[j]) { var jx = j % rw, jy = (j - jx) / rw; if (above((jy + ry0) * W + jx + rx0)) { mask[j] = 2; added++; } }
    }
    if (!added) return { mask: mask, rect: [rx0, ry0, rw, rh], added: 0 };
    var lab = new Int16Array(n), rs = {};
    for (var k = 0; k < n; k++) lab[k] = mask[k] ? 0 : -1;
    removeSmall(lab, rw, rh, 1, minArea, rs);
    for (var k2 = 0; k2 < n; k2++) mask[k2] = lab[k2] === 0 ? 1 : 0;
    return { mask: mask, rect: [rx0, ry0, rw, rh], added: added, cc: rs.cc };
  }

  function maskStats(mask, W, H, cc) {
    var x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (mask[y * W + x]) { area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (!cc) { var lab = new Int16Array(W * H); for (var i = 0; i < W * H; i++) lab[i] = mask[i] ? 0 : -1; cc = components(lab, W, H); }
    var pieces = 0; for (var c = 0; c < cc.n; c++) if (cc.labs[c] === 0) pieces++;
    return { area: area, pieces: pieces, bbox: x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1] };
  }

  // ---------------------------------------------------------------- the pipeline (cached per stage)
  function crop3(src, W, bb) { var w = bb[2] - bb[0], h = bb[3] - bb[1], o = new Float32Array(w * h * 3); for (var y = 0; y < h; y++) o.set(src.subarray(((y + bb[1]) * W + bb[0]) * 3, ((y + bb[1]) * W + bb[0] + w) * 3), y * w * 3); return o; }
  function crop1(src, W, bb, T) { var w = bb[2] - bb[0], h = bb[3] - bb[1], o = new T(w * h); for (var y = 0; y < h; y++) o.set(src.subarray((y + bb[1]) * W + bb[0], (y + bb[1]) * W + bb[0] + w), y * w); return o; }

  function createPipeline(post) {
    var st = { img: null, latest: 0, ver: 0 };

    async function run(msg) {
      var runId = msg.runId, S = msg.settings, E = msg.edit;
      var stale = function () { return st.latest !== runId; };
      var prog = function (label, pct) { post({ type: 'progress', runId: runId, label: label, pct: pct }); };
      if (!st.img) return null;
      var img = st.img, W = img.W, H = img.H, N = W * H, T = {}, t, T0 = now();

      // 1. texture cleanup
      var kPrep = img.v + '|' + S.denoise;
      if (st.kPrep !== kPrep) {
        prog('Reading colors', 4); await tick(); if (stale()) return null;
        t = now();
        var cv = toLab(img.rgba, N), lab = cv.lab, opaque = new Uint8Array(N);
        for (var i = 0; i < N; i++) opaque[i] = cv.alpha[i] >= 128 ? 1 : 0;
        var dn = DENOISE[S.denoise | 0];
        if (dn) for (var ps = 0; ps < dn.n; ps++) {
          prog('Flattening texture', 6 + ps * 6); await tick(); if (stale()) return null;
          lab = bilateral(lab, W, H, opaque, dn.R, dn.s, dn.r);
        }
        st.prep = { lab: lab, alpha: cv.alpha, grad: gradientMag(lab, W, H) };
        st.kPrep = kPrep; st.vPrep = ++st.ver; T.prep = now() - t;
      }
      // 2. background
      var kBg = st.vPrep + '|' + JSON.stringify([S.bgMode, S.bgTol, S.bgGradient, S.bgGlobal, S.bgColor]);
      if (st.kBg !== kBg) {
        prog('Separating background', 22); await tick(); if (stale()) return null;
        t = now();
        var bgr = removeBackground(st.prep.lab, st.prep.alpha, W, H, S), pad = 3;
        var bb = [Math.max(0, bgr.bbox[0] - pad), Math.max(0, bgr.bbox[1] - pad), Math.min(W, bgr.bbox[2] + pad), Math.min(H, bgr.bbox[3] + pad)];
        var cw = bb[2] - bb[0], ch = bb[3] - bb[1], fgC = new Uint8Array(cw * ch);
        for (var yy = 0; yy < ch; yy++) for (var xx = 0; xx < cw; xx++) fgC[yy * cw + xx] = bgr.bg[(yy + bb[1]) * W + xx + bb[0]] ? 0 : 1;
        st.bg = { info: bgr.info, content: bgr.bbox, crop: bb, cw: cw, ch: ch, fg: fgC, lab: crop3(st.prep.lab, W, bb), grad: crop1(st.prep.grad, W, bb, Float32Array) };
        st.samples = null;
        st.kBg = kBg; st.vBg = ++st.ver; T.bg = now() - t;
      }
      var B = st.bg, cw2 = B.cw, ch2 = B.ch, Nc = cw2 * ch2;
      if (!st.samples) st.samples = sampleColors(B.lab, B.fg, B.grad, Nc, 50000, 7);
      // 3. palette
      var locked = (S.locked || []).map(function (l) { return l.lab; });
      var K = Math.max(1, Math.max(S.K | 0, locked.length));
      var kQ = st.vBg + '|' + K + '|' + JSON.stringify(locked);
      if (st.kQ !== kQ) {
        prog('Choosing the best ' + K + ' colors', 32); await tick(); if (stale()) return null;
        t = now();
        var sm = st.samples;
        if (!sm.S) { sm = { X: new Float32Array([0.5, 0, 0]), S: 1 }; }
        var P = perceptualPalette(sm.X, sm.S, K, locked, 1234), C = P.C, SUB = P.sub, K0 = P.K0, par = P.parent;
        K = P.K;
        var raw = new Int16Array(Nc), labC = B.lab, NB = 112, bins = new Int16Array(NB * NB * NB).fill(-1);
        for (var p = 0; p < Nc; p++) {
          if (!B.fg[p]) { raw[p] = -1; continue; }
          var pL = labC[p * 3], pa = labC[p * 3 + 1], pb = labC[p * 3 + 2];
          var iL = Math.min(NB - 1, Math.max(0, (pL * (NB - 1)) | 0)), ia = Math.min(NB - 1, Math.max(0, ((pa + 0.35) * (NB - 1) / 0.7) | 0)), ib = Math.min(NB - 1, Math.max(0, ((pb + 0.35) * (NB - 1) / 0.7) | 0));
          var bk = (iL * NB + ia) * NB + ib, hit = bins[bk];
          if (hit < 0) {
            var bi = 0, bd = 1e9;
            for (var k = 0, kk = 0; k < K0; k++, kk += 3) { var e0 = pL - SUB[kk], e1 = pa - SUB[kk + 1], e2 = pb - SUB[kk + 2], d = e0 * e0 + e1 * e1 + e2 * e2; if (d < bd) { bd = d; bi = k; } }
            hit = bins[bk] = par[bi];
          }
          raw[p] = hit;
        }
        raw = refineEdges(raw, labC, B.grad, cw2, ch2, C, B.info.mode === 'color' ? B.info.lab : null, Math.max(0.02, sm.thr || 0));
        var centers = [];
        for (var k2 = 0; k2 < K; k2++) {
          var lb = [C[k2 * 3], C[k2 * 3 + 1], C[k2 * 3 + 2]];
          centers.push({ id: k2, lab: lb, hex: k2 < locked.length && S.locked[k2].hex ? S.locked[k2].hex : hexOfLab(lb), name: KC.nameOfLab(lb), locked: k2 < locked.length });
        }
        st.q = { K: K, raw: raw, centers: centers };
        st.kQ = kQ; st.vQ = ++st.ver; T.quant = now() - t;
      }
      var Q = st.q;
      // physical scale: work pixels per millimetre of the finished design
      var contentW = Math.max(1, B.content[2] - B.content[0]);
      var ppm = contentW / (S.widthIn * 25.4);
      var rPx = (S.minPieceMm / 2) * ppm, minArea = S.minPieceMm > 0 ? Math.max(2, Math.PI * rPx * rPx) : 0;
      var map = E.map && E.map.length === Q.K ? E.map : null;
      // 4. cleanup
      var kC = st.vQ + '|' + JSON.stringify([map, S.labelSigma, minArea.toFixed(1), E.overrides || []]);
      if (st.kC !== kC) {
        prog('Smoothing edges', 46); await tick(); if (stale()) return null;
        t = now();
        var lbl = new Int16Array(Nc);
        for (var p2 = 0; p2 < Nc; p2++) { var r0 = Q.raw[p2]; lbl[p2] = r0 < 0 ? -1 : (map ? map[r0] : r0); }
        lbl = smoothLabels(lbl, cw2, ch2, Q.K, S.labelSigma);
        prog('Removing specks', 56); await tick(); if (stale()) return null;
        var merged = removeSmall(lbl, cw2, ch2, Q.K, minArea);
        var ov = E.overrides || [];
        for (var o = 0; o < ov.length; o++) floodSet(lbl, cw2, ch2, Math.round(ov[o].x - B.crop[0]), Math.round(ov[o].y - B.crop[1]), ov[o].to);
        removeSaddles(lbl, cw2, ch2);
        var cc = components(lbl, cw2, ch2), stats = [];
        for (var l = 0; l < Q.K; l++) stats.push({ area: 0, pieces: 0, smallest: 1e9, bbox: [1e9, 1e9, -1, -1] });
        for (var c = 0; c < cc.n; c++) { var cl = cc.labs[c]; if (cl < 0) continue; stats[cl].area += cc.areas[c]; stats[cl].pieces++; if (cc.areas[c] < stats[cl].smallest) stats[cl].smallest = cc.areas[c]; }
        var fb = [1e9, 1e9, -1, -1];
        for (var y5 = 0; y5 < ch2; y5++) for (var x5 = 0; x5 < cw2; x5++) {
          var lv = lbl[y5 * cw2 + x5]; if (lv < 0) continue;
          var sb = stats[lv].bbox;
          if (x5 < sb[0]) sb[0] = x5; if (y5 < sb[1]) sb[1] = y5; if (x5 + 1 > sb[2]) sb[2] = x5 + 1; if (y5 + 1 > sb[3]) sb[3] = y5 + 1;
          if (x5 < fb[0]) fb[0] = x5; if (y5 < fb[1]) fb[1] = y5; if (x5 + 1 > fb[2]) fb[2] = x5 + 1; if (y5 + 1 > fb[3]) fb[3] = y5 + 1;
        }
        st.c = { labels: lbl, stats: stats, merged: merged, bbox: fb[2] < 0 ? [0, 0, cw2, ch2] : fb };
        st.kC = kC; st.vC = ++st.ver; T.clean = now() - t;
      }
      var Cl = st.c, topt = { sigma: S.curveSigma, cornerDeg: S.cornerDeg, tol: S.tolerance, offX: B.crop[0], offY: B.crop[1] };
      // 5. knockout trace
      var kT = st.vC + '|' + JSON.stringify([S.curveSigma, S.cornerDeg, S.tolerance]);
      if (st.kT !== kT) {
        prog('Fitting smooth curves', 64); await tick(); if (stale()) return null;
        t = now();
        st.tr = traceLabels(Cl.labels, cw2, ch2, Q.K, topt);
        st.kT = kT; st.vT = ++st.ver; T.trace = now() - t;
      }
      // 6. package the preview now; cut layers follow in a second message
      var ox = B.crop[0], oy = B.crop[1];
      var shift = function (b) { return b && b[2] >= 0 ? [b[0] + ox, b[1] + oy, b[2] + ox, b[3] + oy] : null; };
      var layers = [];
      for (var lj = 0; lj < Q.K; lj++) {
        var s2 = Cl.stats[lj];
        layers.push({ id: lj, area: s2.area, pieces: s2.pieces, smallest: s2.pieces ? s2.smallest : 0, bbox: shift(s2.bbox), d: st.tr.paths[lj], nodes: st.tr.nodes[lj] });
      }
      var order = (E.order && E.order.length) ? E.order : layers.filter(function (l) { return l.area > 0; }).sort(function (p, q) { return q.area - p.area; }).map(function (l) { return l.id; });
      var cut = E.cut || {}, orderOf = new Int32Array(Q.K).fill(-1), cutOf = new Uint8Array(Q.K);
      for (var oi = 0; oi < order.length; oi++) if (order[oi] < Q.K) orderOf[order[oi]] = oi;
      for (var ci = 0; ci < Q.K; ci++) cutOf[ci] = cut[ci] === false ? 0 : 1;
      var trapPx = S.layerMode === 'knockout' ? 0 : S.trapMm * ppm;
      var kU = st.vT + '|' + JSON.stringify([S.layerMode, trapPx.toFixed(2), order, Array.from(cutOf), minArea.toFixed(1)]);
      var ready = st.kU === kU;
      var packCuts = function () {
        return st.cuts.map(function (cu) { return cu ? { d: cu.d, nodes: cu.nodes, area: cu.area, pieces: cu.pieces, bbox: shift(cu.bbox), tucked: cu.tucked } : null; });
      };
      var result = {
        W: W, H: H, crop: { x: ox, y: oy, w: cw2, h: ch2 }, labels: Cl.labels.slice(),
        centers: Q.centers, layers: layers, bbox: shift(Cl.bbox), content: B.content, bg: B.info,
        ppm: ppm, minArea: minArea, merged: Cl.merged, K: Q.K, timings: T, cutKey: kU, cuts: ready ? packCuts() : null,
        order: order, qv: st.vQ, requestedK: S.K
      };
      T.total = now() - T0;
      post({ type: 'result', runId: runId, result: result }, [result.labels.buffer]);
      if (ready) { prog('Done', 100); return true; }
      t = now();
      var cuts = [];
      for (var li = 0; li < Q.K; li++) {
        var stl = Cl.stats[li];
        if (!stl.area) { cuts.push(null); continue; }
        var same = { d: st.tr.paths[li], nodes: st.tr.nodes[li], area: stl.area, pieces: stl.pieces, bbox: stl.bbox, tucked: 0 };
        if (S.layerMode === 'knockout' || !cutOf[li]) { cuts.push(same); continue; }
        prog('Tucking layers under each other', 80 + Math.round(19 * li / Q.K)); await tick(); if (stale()) return null;
        var mk = buildCutMask(Cl.labels, cw2, ch2, li, stl.bbox, orderOf, cutOf, S.layerMode, trapPx, minArea), R = mk.rect;
        if (!mk.added) { cuts.push(same); continue; }
        var tm = traceMask(mk.mask, R[2], R[3], { sigma: topt.sigma, cornerDeg: topt.cornerDeg, tol: topt.tol, offX: topt.offX + R[0], offY: topt.offY + R[1] });
        var ms = maskStats(mk.mask, R[2], R[3], mk.cc);
        cuts.push({ d: tm.d, nodes: tm.nodes, area: ms.area, pieces: ms.pieces, bbox: ms.bbox ? [ms.bbox[0] + R[0], ms.bbox[1] + R[1], ms.bbox[2] + R[0], ms.bbox[3] + R[1]] : null, tucked: mk.added });
      }
      st.cuts = cuts; st.kU = kU; T.cut = now() - t;
      post({ type: 'cuts', runId: runId, cutKey: kU, cuts: packCuts(), ms: T.cut });
      prog('Done', 100);
      return true;
    }

    return async function onMessage(msg) {
      if (msg.type === 'image') {
        st.img = { rgba: new Uint8ClampedArray(msg.rgba), W: msg.W, H: msg.H, v: (st.img ? st.img.v : 0) + 1 };
        st.kPrep = st.kBg = st.kQ = st.kC = st.kT = st.kU = null; st.samples = null;
        return;
      }
      if (msg.type === 'run') {
        st.latest = msg.runId;
        await tick();
        if (st.latest !== msg.runId) return;
        try {
          await run(msg);
        } catch (e) {
          post({ type: 'error', runId: msg.runId, message: (e && e.message) || String(e), stack: e && e.stack });
        }
        return;
      }
      if (msg.type === 'suggest') {
        if (!st.samples) { post({ type: 'suggest', K: null }); return; }
        post({ type: 'suggest', K: suggestK(st.samples.X, st.samples.S, msg.lockedN || 0) });
      }
    };
  }
  KC.createPipeline = createPipeline;
  KC._i = { turnDeg: turnDeg, smoothClosed: smoothClosed, sampleColors: sampleColors, toLab: toLab, bilateral: bilateral, gradientMag: gradientMag, removeBackground: removeBackground, DENOISE: DENOISE, suggestK: suggestK };

  // when loaded as a Worker script
  if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    var handler = createPipeline(function (m, tr) { root.postMessage(m, tr || []); });
    root.onmessage = function (ev) { handler(ev.data); };
  }
  root.KC = KC;
})(typeof self !== 'undefined' ? self : globalThis);
