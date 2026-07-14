/* GAST — public homepage grid.
   Read-only port of the Grid Lab v2.6 engine (CODE/home-grid/grid-lab_v2.6.html).
   Renders /layout.json (written by the lab's 💾 Save) with the SAME packer:
   chaotic skyline + colour-aware pool filling, crop limits law, size ranges,
   phone pairing layout, hover titles with auto-contrast.
   No editing UI. Cells are <a> links. Videos: HLS muted/loop, lazy via
   IntersectionObserver. Failure guard: red note if an asset errors.
   Keep engine functions in sync with the lab when the lab evolves. */
(function () {
  'use strict';

  var CFU = 'https://customer-p97i3zrfuq59b5ur.cloudflarestream.com';
  var CLD = 'https://res.cloudinary.com/dvyflhlls';
  var POOL_T = 0.86;
  var COLS = 24, G = 6;

  var board = document.getElementById('board');
  if (!board) return;

  var state = { dens: 100, items: [] };
  var els = {};

  /* ════ helpers (verbatim from the lab) ════ */
  function thumbOf(it) {
    if (it.k === 'cf') return CFU + '/' + it.id + '/thumbnails/thumbnail.jpg?time=2s&width=640';
    if (it.k === 'cv') return CLD + '/video/upload/so_2,w_640/' + it.id.replace(/\.mp4$/, '.jpg');
    if (it.k === 'ci') return CLD + '/image/upload/w_640/' + it.id;
    return it.id;
  }
  function bigOf(it) { /* images render at layout width: serve up to 1200px */
    if (it.k === 'ci') return CLD + '/image/upload/w_1200/' + it.id;
    return thumbOf(it);
  }
  function tinyOf(it) {
    if (it.k === 'cf') return CFU + '/' + it.id + '/thumbnails/thumbnail.jpg?time=2s&width=48';
    if (it.k === 'cv') return CLD + '/video/upload/so_2,w_48/' + it.id.replace(/\.mp4$/, '.jpg');
    if (it.k === 'ci') return CLD + '/image/upload/w_48/' + it.id;
    return it.id;
  }
  function keyOf(it) { return it.k + ':' + it.id; }

  var AUTO_LIM = 0.05;
  function limOf(it) {
    if (it.lim) return it.lim;
    return { l: AUTO_LIM, t: AUTO_LIM, r: AUTO_LIM, b: AUTO_LIM };
  }
  function hRange(it, hNat) {
    var L = limOf(it);
    return { min: hNat * (1 - L.t - L.b), max: hNat / (1 - L.l - L.r || 1) };
  }
  function isPool(it) { return it.sz <= POOL_T; }
  function szPhone(it) { return it.szP != null ? it.szP : it.sz; }
  function szLow(it) { return it.szMin != null ? Math.min(it.szMin, it.sz) : it.sz; }
  function ranged(it) { return it.szMin != null && it.szMin < it.sz - 0.001; }

  function hueDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function harmony(fc, ncols) {
    if (!fc) return { s: 0.4, tag: '' };
    if (fc.flat || fc.s < 0.12) return { s: 0.7, tag: 'neutral' };
    var best = 0.2, tag = 'contrast';
    ncols.forEach(function (nc) {
      if (!nc) return;
      if (nc.flat || nc.s < 0.12) { if (best < 0.6) { best = 0.6; tag = 'on-neutral'; } return; }
      var dh = hueDiff(fc.h, nc.h);
      if (Math.abs(dh - 180) <= 28) { if (best < 1) { best = 1; tag = 'complement'; } }
      else if (dh <= 35) { if (best < 0.85) { best = 0.85; tag = 'analogous'; } }
      else if (Math.abs(dh - 120) <= 22) { if (best < 0.65) { best = 0.65; tag = 'triadic'; } }
    });
    return { s: best, tag: tag };
  }

  /* link: internal gast.studio URLs become relative so the preview site
     navigates within itself; external links open in a new tab */
  function normHref(h) {
    if (!h) return null;
    h = ('' + h).trim();
    if (!h) return null;
    var m = h.match(/^https?:\/\/(www\.)?gast\.studio(\/[^\s]*)?$/i);
    if (m) {
      var path = m[2] || '/';
      /* store lives on Shopify now */
      if (path.indexOf('/store') === 0) return 'https://vbxikz-33.myshopify.com';
      return path;
    }
    return h;
  }
  function isExternal(h) { return /^https?:\/\//i.test(h); }
  function titleOf(it) {
    if (it.ttl) return it.ttl;
    if (it.num) return '№ ' + it.num;
    return '';
  }

  /* ════ CHAOTIC SKYLINE + COLOUR-AWARE POOL FILLING (verbatim) ════ */
  function pack() {
    window.__packStats = { iter: 0, gate: 0, win: 0, filler: 0, borrowed: 0, alt: 0, absorbed: 0, forced: 0, tail: 0, flexfill: 0, defers: 0, forcedList: [], absorbedList: [] };
    state.items.forEach(function (it) { it._path = null; it._defer = 0; });
    var W = board.clientWidth;
    var densF = state.dens / 100;
    var colW = (W - G * (COLS - 1)) / COLS;
    var unit = colW + G;
    var MAXH = 560 * densF;
    var VCAP = Math.max(420, window.innerHeight - 90);

    function widthFor(it) {
      var A = 55 * densF * Math.pow(it.sz, 2.4);
      var wc = Math.round(Math.sqrt(A * it.r));
      wc = Math.max(2, Math.min(wc, it.r > 1.25 ? 13 : COLS));
      var capH = Math.min(MAXH * Math.max(1, it.sz), VCAP);
      var hpx = (wc * colW + (wc - 1) * G) / it.r;
      if (hpx > capH) wc = Math.max(2, Math.floor((capH * it.r + G) / unit));
      return wc;
    }
    function widthForSz(it, s) {
      var A = 55 * densF * Math.pow(s, 2.4);
      var wc = Math.round(Math.sqrt(A * it.r));
      wc = Math.max(2, Math.min(wc, it.r > 1.25 ? 13 : COLS));
      var capH = Math.min(MAXH * Math.max(1, s), VCAP);
      var hpx = (wc * colW + (wc - 1) * G) / it.r;
      if (hpx > capH) wc = Math.max(2, Math.floor((capH * it.r + G) / unit));
      return wc;
    }

    var mobile = W < 768;
    if (mobile) {
      var y0 = 0;
      var HCAP = W * 1.45;
      var q = state.items.slice();
      function heroQ(x) { return x.mFull || szPhone(x) >= 1.35; }
      function cls(r) { return r < 0.95 ? 'p' : (r > 1.25 ? 'l' : 's'); }
      function compat(x, y) {
        var ca = cls(x.r), cb = cls(y.r);
        return !((ca === 'p' && cb === 'l') || (ca === 'l' && cb === 'p'));
      }
      var VCAPm = Math.max(420, window.innerHeight - 90);
      function solo(a) {
        var hNat = W / a.r;
        var rng = hRange(a, hNat);
        var h1 = Math.max(Math.min(hNat, HCAP, VCAPm), rng.min);
        a._x = 0; a._y = y0; a._w = W; a._h = h1;
        y0 += h1 + G;
      }
      while (q.length) {
        var a = q.shift();
        a._filler = false; a._harm = null;
        if (heroQ(a) || !q.length) { solo(a); continue; }
        var pj = -1;
        for (var j = 0; j < Math.min(6, q.length); j++) {
          if (heroQ(q[j])) continue;
          if (compat(a, q[j])) { pj = j; break; }
        }
        if (pj === -1) pj = heroQ(q[0]) ? -1 : 0;
        if (pj === -1) {
          for (var j2 = 0; j2 < q.length; j2++) {
            if (!heroQ(q[j2])) { pj = j2; break; }
          }
        }
        if (pj === -1) { solo(a); continue; }
        var b = q.splice(pj, 1)[0];
        b._filler = false; b._harm = null;
        var H2 = (W - G) / (a.r + b.r);
        a._x = 0; a._y = y0; a._w = H2 * a.r; a._h = H2;
        b._x = a._w + G; b._y = y0; b._w = H2 * b.r; b._h = H2;
        y0 += H2 + G;
      }
      board.style.height = (y0 - G) + 'px';
      annotate();
      return;
    }

    var sky = new Array(COLS).fill(0);
    var placedRects = [];
    function lowestSlot() {
      var L = Infinity;
      for (var c = 0; c < COLS; c++) if (sky[c] < L) L = sky[c];
      var x = 0;
      while (x < COLS && sky[x] > L + 2) x++;
      var end = x;
      while (end < COLS && sky[end] <= L + 2) end++;
      var lb = x > 0 ? sky[x - 1] : Infinity;
      var rb = end < COLS ? sky[end] : Infinity;
      return { x: x, w: end - x, y: L, depth: Math.min(lb, rb) - L, lb: lb, rb: rb };
    }
    function neighbourCols(slot) {
      var px = slot.x * unit, pw = slot.w * unit;
      var probe = { x: px - unit, y: slot.y - 150, w: pw + unit * 2, h: 320 };
      var near = [];
      for (var i = placedRects.length - 1; i >= 0 && near.length < 4; i--) {
        var p = placedRects[i];
        if (p.it.col && p.x < probe.x + probe.w && p.x + p.w > probe.x &&
          p.y < probe.y + probe.h && p.y + p.h > probe.y) near.push(p.it.col);
      }
      return near;
    }
    function belowRectOf(x0px, x1px, ytop) {
      var best = null, bestOv = 0;
      for (var i = placedRects.length - 1; i >= 0; i--) {
        var r = placedRects[i];
        if (Math.abs(r.y + r.h + G - ytop) > 8) continue;
        var ov = Math.min(r.x + r.w, x1px) - Math.max(r.x, x0px);
        if (ov > bestOv) { bestOv = ov; best = r; }
      }
      return best;
    }
    function colsOfPx(wpx) { return Math.round((wpx + G) / unit); }
    function put(it, slot, wc, filler) {
      wc = Math.max(1, Math.min(wc, slot.w));
      var want = wc;
      var idealW = widthFor(it);
      var loW = ranged(it) ? Math.max(2, widthForSz(it, szLow(it))) : null;
      var minW = 2, maxW = slot.w;
      if (filler || isPool(it)) maxW = Math.min(maxW, Math.max(2, Math.ceil((isPool(it) ? idealW : Math.min(idealW, widthForSz(it, Math.min(szLow(it), POOL_T)))) * 1.25)));
      if (it.sz >= 1.3) minW = Math.max(minW, Math.min(loW != null ? loW : Math.ceil(idealW * 0.75), want));
      var poolBacked = pool.some(function (p) {
        var lk = 4 + Math.round(((p.bl != null ? p.bl : 20) / 100) * 30);
        return rankOf[keyOf(p)] <= placedRects.length + lk;
      });
      var cands = [];
      var Ws = [];
      if (loW != null) {
        for (var wv = Math.max(2, Math.min(loW, want)); wv <= Math.min(slot.w, want + 1); wv++) Ws.push(wv);
      } else Ws = [want - 2, want - 1, want, want + 1];
      Ws.forEach(function (w) {
        if (w < minW || w > maxW || w > slot.w) return;
        var left = slot.w - w;
        if (left === 1) return;
        if (left >= 2 && want === slot.w && !(slot.w >= 4 && poolBacked)) return;
        cands.push({ w: w, x: slot.x });
        if (left >= 2) cands.push({ w: w, x: slot.x + left });
      });
      if (!cands.length) cands.push({ w: want, x: slot.x });
      var below = belowRectOf(slot.x * unit, (slot.x + slot.w) * unit, slot.y);
      var bCols = below ? colsOfPx(below.w) : -99;
      var parity = placedRects.length % 2;
      var bestC = cands[0], bestS = Infinity;
      cands.forEach(function (cd) {
        var s = Math.abs(cd.w - want) * 0.28;
        if (want === slot.w && cd.w < want) s += 0.35;
        var hN = (cd.w * colW + (cd.w - 1) * G) / it.r;
        var rgN = hRange(it, hN);
        var lvl = false;
        if (isFinite(slot.lb)) { var tL = slot.lb - slot.y - G; if (tL > 50 && tL >= rgN.min - 0.5 && tL <= rgN.max + 0.5) lvl = true; }
        if (!lvl && isFinite(slot.rb)) { var tR = slot.rb - slot.y - G; if (tR > 50 && tR >= rgN.min - 0.5 && tR <= rgN.max + 0.5) lvl = true; }
        if (lvl) s -= 0.45;
        var leftN = slot.w - cd.w;
        if (leftN >= 2 && leftN <= 3) {
          if (hN > 420) s += 0.8;
          else if (!poolBacked) s += 0.3;
        }
        if (below) {
          var dw = Math.abs(cd.w - bCols);
          s += (dw <= 0.5 ? Math.min(1.5, 0.6 + 0.25 * ((below.runLen || 1) - 1))
            : (dw <= 1 ? 0.21 : 0));
          var xpx = cd.x * unit, xpx2 = xpx + cd.w * unit - G;
          if (Math.abs(xpx - below.x) < unit * 0.3) s += 0.5;
          if (Math.abs(xpx2 - (below.x + below.w)) < unit * 0.3) s += 0.5;
        }
        s += 0.02 * (parity ? (cd.x === slot.x ? 1 : 0) : (cd.x === slot.x ? 0 : 1));
        if (s < bestS - 1e-9) { bestS = s; bestC = cd; }
      });
      wc = bestC.w;
      var xc = bestC.x;
      var wpx = wc * colW + (wc - 1) * G;
      var hNat = wpx / it.r;
      var h = hNat;
      var rng = hRange(it, hNat);
      var snaps = [];
      if (isFinite(slot.lb)) snaps.push(slot.lb - slot.y - G);
      if (isFinite(slot.rb)) snaps.push(slot.rb - slot.y - G);
      var bestH = -1, bestD = Infinity;
      for (var ci = 0; ci < snaps.length; ci++) {
        var hw = snaps[ci];
        if (hw > 50 && hw <= VCAP * 1.02 && hw >= rng.min - 0.5 && hw <= rng.max + 0.5 &&
          Math.abs(hw - hNat) < bestD) { bestD = Math.abs(hw - hNat); bestH = hw; }
      }
      if (bestH > 0) h = bestH;
      it._x = xc * unit;
      it._y = slot.y;
      it._w = wpx;
      it._h = h;
      it._filler = !!filler;
      it._seq = placedRects.length;
      var myRun = (below && Math.abs(bCols - wc) <= 0.5) ? ((below.runLen || 1) + 1) : 1;
      placedRects.push({ x: it._x, y: it._y, w: wpx, h: h, it: it, runLen: myRun });
      var top = slot.y + h + G;
      for (var c = xc; c < xc + wc; c++) sky[c] = top;
    }

    var main = [], pool = [];
    state.items.forEach(function (it) { it._harm = null; (isPool(it) ? pool : main).push(it); });

    var lastFillerHue = -999;
    var fillerStreak = 0;
    var bTag = '';
    var rankOf = {};
    state.items.forEach(function (x, ri) { rankOf[keyOf(x)] = ri; });
    function chooseMainIndex(slot) {
      if (main.length < 2) return 0;
      var headBl = main[0].bl != null ? main[0].bl : 20;
      var WIN = 1 + Math.round(headBl / 100 * 11);
      if (WIN <= 1) return 0;
      var ncols = neighbourCols(slot);
      if (!ncols.length) return 0;
      var lim = Math.min(WIN, main.length);
      var bi = 0, bs = -Infinity;
      var below0 = belowRectOf(slot.x * unit, (slot.x + slot.w) * unit, slot.y);
      var bCols0 = below0 ? colsOfPx(below0.w) : -99;
      for (var i = 0; i < lim; i++) {
        var cnd = main[i];
        var cbl = cnd.bl != null ? cnd.bl : 20;
        if (i > Math.round(cbl / 100 * 11)) continue;
        var h = cnd.col ? harmony(cnd.col, ncols).s : 0.4;
        var sc = h - i * (0.3 * (1 - cbl / 100) + 0.04);
        if (Math.abs(Math.min(widthFor(cnd), slot.w) - bCols0) <= 0.5) sc -= 0.15;
        sc -= 0.3 * Math.max(0, (widthFor(cnd) - slot.w) / Math.max(1, widthFor(cnd)));
        if (sc > bs) { bs = sc; bi = i; }
      }
      return bi;
    }
    var guard = 0;
    while ((main.length || pool.length) && guard++ < 2000) {
      var slot = lowestSlot();
      var mergeW = 12, mergeTol = 12;
      if (!pool.length && main.length && main.length <= 10) mergeTol = 30;
      if (!pool.length && main.length === 1) { mergeW = COLS; mergeTol = 64; }
      if (slot.w <= mergeW) {
        var mx0 = slot.x, mx1 = slot.x + slot.w, mtop = slot.y;
        while (mx0 > 0 && sky[mx0 - 1] > slot.y + 2 && sky[mx0 - 1] <= slot.y + mergeTol) { mtop = Math.max(mtop, sky[mx0 - 1]); mx0--; }
        while (mx1 < COLS && sky[mx1] > slot.y + 2 && sky[mx1] <= slot.y + mergeTol) { mtop = Math.max(mtop, sky[mx1]); mx1++; }
        if (mx1 - mx0 > slot.w) {
          var mlb = mx0 > 0 ? sky[mx0 - 1] : Infinity;
          var mrb = mx1 < COLS ? sky[mx1] : Infinity;
          slot = { x: mx0, w: mx1 - mx0, y: mtop, depth: Math.min(mlb, mrb) - mtop, lb: mlb, rb: mrb };
        }
      }
      var n = null, nIdx = 0;
      if (main.length) { nIdx = chooseMainIndex(slot); n = main[nIdx]; }
      if (n) {
        var ideal = widthFor(n);
        var needFrac = n.sz >= 1.3 ? 0.75 : 0.6;
        var needCols = Math.max(3, Math.ceil(ideal * needFrac));
        if (ranged(n)) needCols = Math.max(2, Math.min(needCols, widthForSz(n, szLow(n))));
        if (slot.w >= needCols) {
          main.splice(nIdx, 1);
          put(n, slot, Math.min(ideal, slot.w), false);
          n._path = nIdx ? 'win' : 'gate'; window.__packStats[nIdx ? 'win' : 'gate']++;
          fillerStreak = 0;
          continue;
        }
        n._defer++; window.__packStats.defers++;
        if (pool.length && (fillerStreak < 2 || n.sz >= 1.3)) {
          var ncols = neighbourCols(slot);
          var smallsNear = 0;
          (function () {
            var px2 = slot.x * unit, pw2 = slot.w * unit;
            var pb = { x: px2 - unit, y: slot.y - 150, w: pw2 + unit * 2, h: 320 };
            for (var ii = placedRects.length - 1, seen = 0; ii >= 0 && seen < 5; ii--) {
              var pr = placedRects[ii];
              if (pr.x < pb.x + pb.w && pr.x + pr.w > pb.x && pr.y < pb.y + pb.h && pr.y + pr.h > pb.y) {
                seen++;
                if (pr.it._filler || pr.it.sz <= 0.86) smallsNear++;
              }
            }
          })();
          var bi = 0, bs = -Infinity, bTag = '', bWc = 2;
          var progress = placedRects.length;
          var belowF = belowRectOf(slot.x * unit, (slot.x + slot.w) * unit, slot.y);
          var bColsF = belowF ? colsOfPx(belowF.w) : -99;
          pool.forEach(function (p, pi) {
            var lookP = 4 + Math.round(((p.bl != null ? p.bl : 20) / 100) * 30);
            if (rankOf[keyOf(p)] > progress + lookP) return;
            var wcP = Math.min(slot.w, Math.max(2, Math.ceil(widthFor(p) * 1.25)));
            if (slot.w - wcP === 1) {
              if (wcP - 1 >= 2) wcP -= 1;
              else wcP = slot.w;
            }
            var wpxP = wcP * colW + (wcP - 1) * G;
            var hn = wpxP / p.r;
            var fit = (isFinite(slot.depth) && slot.depth > 60)
              ? 1 - Math.min(1, Math.abs(hn - slot.depth) / Math.max(slot.depth, 1))
              : 1 - Math.min(1, Math.abs(widthFor(p) - wcP) / 6);
            var sc, tag = '';
            if (p.col) {
              var hm = harmony(p.col, ncols);
              var variety = (!p.col.flat && hueDiff(p.col.h, lastFillerHue) < 30) ? 0 : 1;
              sc = fit * 0.55 + hm.s * 0.35 + variety * 0.10;
              tag = hm.tag;
            } else sc = fit;
            sc -= smallsNear * 0.22;
            if (Math.abs(wcP - bColsF) <= 0.5) sc -= 0.08;
            if (sc > bs) { bs = sc; bi = pi; bTag = tag; bWc = wcP; }
          });
          var flexPick = -1;
          var fLim = Math.min(12, main.length);
          for (var fi = 0; fi < fLim; fi++) {
            var fc = main[fi];
            if (fi === nIdx || !ranged(fc) || szLow(fc) > POOL_T) continue;
            var lookF = 4 + Math.round(((fc.bl != null ? fc.bl : 20) / 100) * 30);
            if (rankOf[keyOf(fc)] > progress + lookF) continue;
            var wcF = Math.min(slot.w, Math.max(2, Math.ceil(widthForSz(fc, Math.min(szLow(fc), POOL_T)) * 1.25)));
            if (slot.w - wcF === 1) { if (wcF - 1 >= 2) wcF -= 1; else wcF = slot.w; }
            var wpxF = wcF * colW + (wcF - 1) * G;
            var hnF = wpxF / fc.r;
            var fitF = (isFinite(slot.depth) && slot.depth > 60)
              ? 1 - Math.min(1, Math.abs(hnF - slot.depth) / Math.max(slot.depth, 1))
              : 1 - Math.min(1, Math.abs(widthForSz(fc, szLow(fc)) - wcF) / 6);
            var scF, tagF = '';
            if (fc.col) {
              var hmF = harmony(fc.col, ncols);
              var varF = (!fc.col.flat && hueDiff(fc.col.h, lastFillerHue) < 30) ? 0 : 1;
              scF = fitF * 0.55 + hmF.s * 0.35 + varF * 0.10;
              tagF = hmF.tag;
            } else scF = fitF;
            scF -= smallsNear * 0.22;
            if (Math.abs(wcF - bColsF) <= 0.5) scF -= 0.08;
            scF -= 0.06;
            if (scF > bs) { bs = scF; flexPick = fi; bi = -1; bTag = tagF; bWc = wcF; }
          }
          var hadNormal = bs > -Infinity;
          if (bs === -Infinity && n && n.sz >= 1.3 && (pool.length > 3 || main.length <= 8)) {
            pool.forEach(function (p, pi) {
              var pbl = p.bl != null ? p.bl : 20;
              if (pbl <= 10) return;
              if (rankOf[keyOf(p)] > progress + 55) return;
              var wcP = Math.min(slot.w, Math.max(2, Math.ceil(widthFor(p) * 1.25)));
              if (slot.w - wcP === 1) { if (wcP - 1 >= 2) wcP -= 1; else wcP = slot.w; }
              var hh = p.col ? harmony(p.col, ncols) : { s: 0.4, tag: '' };
              var dist = (rankOf[keyOf(p)] - progress) / Math.max(1, state.items.length);
              var sc = hh.s - dist * 1.5;
              if (sc > bs) { bs = sc; bi = pi; bTag = hh.tag; bWc = wcP; }
            });
          }
          if (bs > -Infinity && (smallsNear < 2 || (slot.w <= 3 && smallsNear < 3) || n.sz >= 1.3)) {
            var chosen = (bi < 0 && flexPick >= 0) ? main.splice(flexPick, 1)[0] : pool.splice(bi, 1)[0];
            chosen._harm = bTag || null;
            if (chosen.col && !chosen.col.flat) lastFillerHue = chosen.col.h;
            put(chosen, slot, bWc, true);
            chosen._path = (bi < 0) ? 'flexfill' : (hadNormal ? 'filler' : 'borrowed');
            window.__packStats[(bi < 0) ? 'flexfill' : (hadNormal ? 'filler' : 'borrowed')]++;
            fillerStreak++;
            continue;
          }
        }
        var alt = -1;
        for (var ai = 0; ai < Math.min(8, main.length); ai++) {
          if (ai === nIdx) continue;
          var cAlt = main[ai];
          if (ai > 0 && (cAlt.bl != null ? cAlt.bl : 20) <= 10) continue;
          var fr = cAlt.sz >= 1.3 ? 0.75 : 0.6;
          var needAlt = Math.max(3, Math.ceil(widthFor(cAlt) * fr));
          if (ranged(cAlt)) needAlt = Math.max(2, Math.min(needAlt, widthForSz(cAlt, szLow(cAlt))));
          if (slot.w >= needAlt) { alt = ai; break; }
        }
        if (alt >= 0) {
          var mAlt = main.splice(alt, 1)[0];
          put(mAlt, slot, Math.min(widthFor(mAlt), slot.w), false);
          mAlt._path = 'alt'; window.__packStats.alt++;
          fillerStreak = 0;
          continue;
        }
        var pickI = -1, pickS = Infinity;
        var lhLim = Math.min(16, main.length);
        for (var li = 0; li < lhLim; li++) {
          var cLH = main[li];
          if (li !== nIdx && li > 0 && (cLH.bl != null ? cLH.bl : 20) <= 10) continue;
          var idW = widthFor(cLH);
          var eff = Math.min(idW, slot.w);
          var loC = ranged(cLH) ? Math.max(2, widthForSz(cLH, szLow(cLH))) : idW;
          var s2 = Math.max(0, 1 - eff / idW) * 0.4 + Math.max(0, 1 - eff / loC);
          if (cLH.sz >= 1.3 && eff < 0.7 * idW && eff < loC) s2 += 10;
          s2 += li * 0.01;
          if (slot.w <= 3 && isFinite(slot.depth) && slot.depth > 60) {
            var hC = (eff * colW + (eff - 1) * G) / cLH.r;
            s2 += Math.min(0.6, Math.abs(hC - slot.depth) / slot.depth * 0.4);
          }
          if (s2 < pickS - 1e-9) { pickS = s2; pickI = li; }
        }
        if (pickI < 0) pickI = nIdx;
        var nx = main.splice(pickI, 1)[0];
        put(nx, slot, Math.min(Math.max(2, widthFor(nx)), slot.w), false);
        nx._path = (nx === n) ? 'forced' : 'absorbed';
        window.__packStats[(nx === n) ? 'forced' : 'absorbed']++;
        window.__packStats.absorbedList.push({ id: ('' + nx.id).slice(-12), sz: nx.sz, slotW: slot.w, y: Math.round(slot.y), harm: +pickS.toFixed(2), poolLeft: pool.length, mainLeft: main.length });
        fillerStreak = 0;
        continue;
      }
      var p0 = pool.shift();
      put(p0, slot, Math.min(Math.ceil(widthFor(p0) * 1.5), slot.w), false);
      p0._path = 'tail'; window.__packStats.tail++;
      fillerStreak = 0;
    }

    var maxY = 0;
    for (var c2 = 0; c2 < COLS; c2++) if (sky[c2] > maxY) maxY = sky[c2];
    board.style.height = (maxY - G) + 'px';
    annotate();
  }

  function annotate() {
    state.items.forEach(function (it) {
      var rd = it._w / it._h;
      if (rd > it.r * 1.005) { it._cropAx = 'Y'; it._cropPct = Math.round((1 - it.r / rd) * 100); }
      else if (rd < it.r * 0.995) { it._cropAx = 'X'; it._cropPct = Math.round((1 - rd / it.r) * 100); }
      else { it._cropAx = null; it._cropPct = 0; }
    });
  }

  /* ════ media geometry (verbatim, incl. the v2.5 video fix) ════ */
  function imgGeom(it) {
    var rd = it._w / it._h, L = limOf(it);
    if (rd >= it.r) {
      var v = 1 - it.r / rd;
      var sumV = L.t + L.b;
      var shareT = sumV > 0 ? L.t / sumV : 0.5;
      var k = it._w, kh = k / it.r;
      return { k: k, kh: kh, left: 0, top: -(kh * v * shareT) };
    }
    var u = 1 - rd / it.r;
    var sumH = L.l + L.r;
    var shareL = sumH > 0 ? L.l / sumH : 0.5;
    var kh2 = it._h, k2 = kh2 * it.r;
    return { k: k2, kh: kh2, left: -(k2 * u * shareL), top: 0 };
  }
  function placeImg(it, el) {
    var g = imgGeom(it);
    el.querySelectorAll('img,video').forEach(function (m) {
      m.style.width = g.k + 'px'; m.style.height = g.kh + 'px';
      m.style.left = g.left + 'px'; m.style.top = g.top + 'px';
    });
  }

  /* ════ video loading: HLS muted/loop, lazy via IntersectionObserver ════ */
  function attachHls(v, src) {
    if (window.Hls && Hls.isSupported()) {
      var h = new Hls({ autoStartLoad: true, maxBufferLength: 8 });
      h.loadSource(src); h.attachMedia(v);
      h.on(Hls.Events.MANIFEST_PARSED, function () { v.play().catch(function () { }); });
      v._hls = h;
    } else v.src = src;
  }
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var cell = e.target;
      var v = cell.querySelector('video');
      if (!v) return;
      if (e.isIntersecting) {
        if (!v._started) {
          v._started = true;
          if (v.dataset.hls) attachHls(v, v.dataset.hls);
          else if (v.dataset.src) v.src = v.dataset.src;
        }
        var p = v.play();
        if (p && p.catch) p.catch(function () { });
        cell.classList.add('playing');
      } else v.pause();
    });
  }, { rootMargin: '400px 0px' }) : null;

  /* ════ render (read-only: cells are links) ════ */
  function render() {
    state.items.forEach(function (it) {
      var key = keyOf(it);
      var el = els[key];
      if (!el) {
        var href = normHref(it.href);
        el = document.createElement(href ? 'a' : 'div');
        el.className = 'it';
        el.dataset.key = key;
        if (href) {
          el.href = href;
          if (isExternal(href)) { el.target = '_blank'; el.rel = 'noopener'; }
          el.setAttribute('aria-label', titleOf(it) || href);
        }
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = titleOf(it) || '';
        img.src = it.k === 'ci' ? bigOf(it) : thumbOf(it);
        img.onload = function () { el.classList.add('ld'); };
        img.onerror = function () { el.classList.add('err'); };
        el.appendChild(img);
        el.style.backgroundImage = 'url("' + tinyOf(it) + '")';
        var isVid = it.k === 'cf' || it.k === 'cv';
        if (isVid) {
          var v = document.createElement('video');
          v.muted = true; v.loop = true; v.playsInline = true;
          v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
          v.preload = 'none';
          if (it.k === 'cf') v.dataset.hls = CFU + '/' + it.id + '/manifest/video.m3u8';
          else v.dataset.src = CLD + '/video/upload/' + it.id;
          el.appendChild(v);
          if (io) io.observe(el);
          else { v._started = true; if (v.dataset.hls) attachHls(v, v.dataset.hls); else v.src = v.dataset.src; v.play().catch(function () { }); el.classList.add('playing'); }
        }
        var t = titleOf(it);
        if (t) {
          var ttl = document.createElement('span');
          ttl.className = 'ttl' + ((it.col && it.col.cl > 0.6) ? ' dark' : '');
          ttl.textContent = t;
          el.appendChild(ttl);
        }
        board.appendChild(el);
        els[key] = el;
      }
      el.style.left = it._x + 'px';
      el.style.top = it._y + 'px';
      el.style.width = it._w + 'px';
      el.style.height = it._h + 'px';
      placeImg(it, el);
    });
  }

  function repack() { pack(); render(); }

  /* ════ manifest → engine items ════ */
  function fromManifest(d) {
    var items = (d.items || []).slice().sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); });
    return items.filter(function (m) { return m.kind !== 'lo'; }).map(function (m) {
      return {
        k: m.kind,
        id: m.id,
        r: m.ratio,
        href: m.href || '',
        sz: (m.size != null ? m.size : 100) / 100,
        szMin: m.sizeMin != null ? m.sizeMin / 100 : null,
        szP: (m.phone && m.phone.size != null) ? m.phone.size / 100
          : (m.sizePhone != null ? m.sizePhone / 100 : null),
        mFull: !!((m.phone && m.phone.full) || m.phoneFull),
        lim: m.lockedFullFrame ? { l: 0, t: 0, r: 0, b: 0 } : (m.cropLimits || null),
        col: m.dominantColor || null,
        bl: m.placementBlend != null ? m.placementBlend : 20,
        ttl: m.title || null,
        num: m.number || null
      };
    });
  }

  /* ════ boot ════ */
  fetch('/layout.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('layout.json ' + r.status); return r.json(); })
    .then(function (d) {
      state.dens = d.density || 100;
      state.items = fromManifest(d);
      repack();
    })
    .catch(function (e) {
      board.innerHTML = '<p style="color:#f87171;font:12px ui-monospace,monospace;padding:20px">Could not load layout.json — ' + e.message + '</p>';
    });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(repack, 120); });
})();
