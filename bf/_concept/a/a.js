/* eLogy · Concept A · «Dal caos al controllo»
   Vanilla JS, nessuna libreria. Tutto è guidato dalla posizione di scroll:
   tornando su, la scena torna indietro. Solo transform/opacity nel ciclo. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;

  /* ---------- spot con voce (vale sempre, anche nella versione statica) ---------- */
  var spot = d.querySelector('.spot'), sv = spot && spot.querySelector('video');
  d.querySelectorAll('[data-open-spot]').forEach(function (b) {
    b.addEventListener('click', function () { spot.hidden = false; sv.play(); });
  });
  if (spot) spot.addEventListener('click', function (e) {
    if (e.target === spot || e.target.hasAttribute('data-close-spot')) { sv.pause(); spot.hidden = true; }
  });

  if (!root.classList.contains('js')) return; /* statico: niente altro */

  /* ---------- utilità ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function map(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eo(t) { return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); } // deterministico
  var W = 0, H = 0, mobile = false;
  function measure() { W = root.clientWidth; H = window.innerHeight; mobile = W < 760; }
  measure();

  var scenes = {};
  d.querySelectorAll('[data-scene]').forEach(function (el) { scenes[el.dataset.scene] = { el: el, frame: el.querySelector('.frame'), p: 0, top: 0, len: 1 }; });
  function layout() {
    measure();
    Object.keys(scenes).forEach(function (k) {
      var s = scenes[k], r = s.el.getBoundingClientRect();
      s.top = r.top + window.scrollY; s.len = Math.max(1, s.el.offsetHeight - H);
    });
    sizeCanvas(); sizeTrack();
  }

  /* ---------- video: caricati solo quando servono, in pausa fuori scena ---------- */
  function wake(v) { if (v.dataset.src && !v.src) { v.src = v.dataset.src; v.load(); } }
  function setPlay(v, on) {
    if (on) { wake(v); if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } }
    else if (!v.paused) v.pause();
  }
  var vHero = d.querySelector('.v-hero'), vCalm = d.querySelector('.v-calm'), vStorm = d.querySelector('.v-storm');

  /* ---------- notifiche ---------- */
  var tWrap = d.querySelector('.toasts'), N = 28, toasts = [];
  for (var i = 0; i < N; i++) {
    var t = d.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span class="ic"></span><span class="tx"><b>Nuovo ordine</b><i></i><i></i></span><span class="tm">ora</span>';
    tWrap.appendChild(t);
    toasts.push({ el: t, rx: rnd(i + 1), ry: rnd(i + 51), rr: rnd(i + 101) * 2 - 1, rz: rnd(i + 151), ok: false, vis: false });
  }
  var lastCount = 0, flashT = 0;

  /* ---------- parole delle frasi del problema ---------- */
  var lines = [].slice.call(d.querySelectorAll('.p-lines .kl')).map(function (p) {
    var words = [];
    (function split(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(d.createTextNode(' ')); return; }
            var s = d.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s); words.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) split(n);
      });
    })(p);
    return { el: p, words: words };
  });
  var LW = [[.15, .37], [.35, .58], [.56, .78], [.76, 1.01]]; // finestre di scroll di ogni frase

  /* ---------- sequenza di fotogrammi (clip KIE) disegnata su canvas ---------- */
  var cv = d.querySelector('.seq'), cx = cv.getContext('2d'), FR = 49, SWEEP_AT = 13 / 48;
  var frames = [], seqKind = '', lastDrawn = -1;
  function seqPath(i) { return 'media/seq-' + seqKind + '/' + (i < 10 ? '0' : '') + i + '.webp'; }
  function loadSeq() {
    var k = mobile ? 'm' : 'd';
    if (k === seqKind) return; seqKind = k; frames = new Array(FR); lastDrawn = -1;
    // prima un fotogramma ogni 4 (la scena è subito «giocabile»), poi i mancanti
    var order = [];
    for (var s = 4; s >= 1; s = s === 4 ? 2 : s === 2 ? 1 : 0) {
      for (var j = 0; j < FR; j += s) if (order.indexOf(j) < 0) order.push(j);
      if (s === 1) break;
    }
    if (order.indexOf(FR - 1) < 0) order.splice(1, 0, FR - 1);
    var q = order.slice(), active = 0;
    (function next() {
      while (active < 4 && q.length) {
        (function (idx) {
          var im = new Image(); im.decoding = 'async'; active++;
          im.onload = function () { frames[idx] = im; active--; lastDrawn = -1; next(); };
          im.onerror = function () { active--; next(); };
          im.src = seqPath(idx);
        })(q.shift());
      }
    })();
  }
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function sizeCanvas() { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); lastDrawn = -1; }
  function drawFrame(f) {
    var idx = Math.round(f);
    if (idx === lastDrawn) return;
    var im = frames[idx];
    if (!im) { // il più vicino già caricato
      for (var o = 1; o < FR; o++) { if (frames[idx - o]) { im = frames[idx - o]; break; } if (frames[idx + o]) { im = frames[idx + o]; break; } }
    }
    if (!im) return;
    var cw = cv.width, ch = cv.height, iw = im.naturalWidth, ih = im.naturalHeight, sc = Math.max(cw / iw, ch / ih);
    var dw = iw * sc, dh = ih * sc;
    cx.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    lastDrawn = frames[idx] ? idx : -1;
  }

  /* ---------- binario del processo ---------- */
  var sProc = scenes.process, track = sProc.el.querySelector('.track'), stations = [].slice.call(sProc.el.querySelectorAll('.st'));
  var dots = [].slice.call(sProc.el.querySelectorAll('.dots i')), stw = 0;
  function sizeTrack() { stw = mobile ? W : W * .62; }

  /* ---------- il ciclo ---------- */
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  function setV(el, k, v) { el.style.setProperty(k, typeof v === 'number' ? v.toFixed(4) : v); }

  function update() {
    ticking = false;
    var y = window.scrollY;
    Object.keys(scenes).forEach(function (k) { var s = scenes[k]; if (k !== 'intro') { var v = y >= s.top - 2; if (v !== s.shown) { s.shown = v; s.frame.style.visibility = v ? 'visible' : 'hidden'; } } s.p = clamp((y - s.top) / s.len, 0, 1); s.near = y > s.top - H * 1.5 && y < s.top + s.len + H; s.in = y >= s.top - H && y <= s.top + s.len + H * .2; });

    /* ===== SCENA 1: hero → lo spot si apre ===== */
    var si = scenes.intro, p = si.p, f = si.frame;
    setV(f, '--up', ease(map(p, .02, .24)));
    setV(f, '--x', ease(map(p, .06, .3)));
    setV(f, '--shade-out', map(p, .12, .3));
    setV(f, '--dim', map(p, .3, .44) * .93);
    setV(f, '--lb', ease(map(p, .28, .42)) * (1 - ease(map(p, .64, .78))));
    var sl = map(p, .4, .5) * (1 - map(p, .6, .67));
    setV(f, '--slate', eo(sl));
    vCalm.style.opacity = (map(p, .58, .7)).toFixed(3);
    vHero.style.opacity = (1 - map(p, .58, .64)) * (W >= 900 ? .92 : .78);
    if (si.near) wake(vCalm);
    setPlay(vHero, si.in && p < .66);
    setPlay(vCalm, si.in && p > .5);

    /* ===== timeline globale del caos (T 0→1) ===== */
    var sp = scenes.problem, T;
    if (y < sp.top) T = map(p, .66, 1) * .22; else T = .22 + sp.p * .78;
    var countF = T <= 0 ? 0 : 1 + 27 * Math.pow(T, 1.45);
    var chaos = Math.pow(map(T, .28, 1), 1.2);

    /* ===== SCENA 2: il problema ===== */
    var pp = sp.p, pf = sp.frame;
    if (sp.near) wake(vStorm);
    setPlay(vStorm, sp.in);
    setV(pf, '--zoom', ease(pp));
    setV(pf, '--storm-in', map(pp, 0, .04));
    setV(pf, '--handoff', ease(map(pp, .9, .995)));
    setV(pf, '--head-in', 1 - eo(map(pp, 0, .09)));
    setV(pf, '--head-small', ease(map(pp, .12, .2)));
    setV(pf, '--head-out', mobile ? map(pp, .12, .17) : map(pp, .9, 1) * 0);
    lines.forEach(function (ln, li) {
      var w0 = LW[li][0], w1 = LW[li][1], lp = map(pp, w0, w1), n = ln.words.length, last = li === lines.length - 1;
      var out = last ? 0 : map(lp, .82, 1);
      ln.el.style.visibility = (lp <= 0 || out >= 1) ? 'hidden' : 'visible';
      ln.words.forEach(function (w, wi) {
        var a = eo(map(lp, wi / n * .38, wi / n * .38 + .16));
        var o = a * (1 - out);
        w.style.opacity = o.toFixed(3);
        w.style.transform = 'translate3d(0,' + ((1 - a) * 36 - out * 30).toFixed(1) + 'px,0)';
      });
    });

    /* ===== SCENA 3: con eLogy ===== */
    var sc = scenes.control, cp = sc.p, cf = sc.frame;
    if (sc.near) loadSeq();
    var order = ease(map(cp, .01, .1));          // le notifiche si raddrizzano
    var seqP = map(cp, .12, .66);
    if (sc.in || (y > sp.top + sp.len * .8)) drawFrame(seqP * (FR - 1));
    // la scena 2 sfuma nella clip (vortice ↔ vortice)
    var swp = map(seqP, SWEEP_AT - .09, SWEEP_AT + .02);
    setV(cf, '--sweep', ease(swp));
    setV(cf, '--sweep-out', map(seqP, SWEEP_AT + .02, SWEEP_AT + .16));
    setV(cf, '--enter', map(cp, .06, .14) * (1 - map(cp, .36, .44)));
    setV(cf, '--title', eo(map(cp, .64, .76)));
    setV(cf, '--cshade', .35 + map(cp, .6, .72) * .65);
    [].forEach.call(cf.querySelectorAll('.c-par p'), function (el, k) {
      var a = eo(map(cp, .74 + k * .05, .84 + k * .05));
      el.style.opacity = a.toFixed(3); el.style.transform = 'translate3d(0,' + ((1 - a) * 20).toFixed(1) + 'px,0)';
    });
    setV(cf, '--out', map(cp, .94, 1));

    /* ===== notifiche (livello globale) ===== */
    var n = Math.min(N, Math.ceil(countF)), vis = 0;
    var toastLayerOn = (T > 0) && cp < .3;
    tWrap.style.opacity = toastLayerOn ? 1 : 0;
    if (toastLayerOn) {
      var tw = mobile ? Math.min(W * .76, 290) : 268;
      var baseX = mobile ? (W - tw) / 2 : W - tw - Math.max(24, W * .05);
      var baseY = mobile ? 70 : Math.max(86, H * .13);
      var gap = mobile ? 50 : 60;
      var vpx = W / 2 - tw / 2, vpy = H * .46;
      for (var j = 0; j < N; j++) {
        var o = toasts[j], el = o.el;
        if (j >= n) { if (o.vis) { el.style.opacity = 0; o.vis = false; } continue; }
        o.vis = true; vis++;
        var k = n - 1 - j;                              // 0 = la più nuova
        var enter = j === n - 1 ? eo(clamp(countF - j, 0, 1)) : 1;
        // pila ordinata
        var kk = k < (mobile ? 5 : 8) ? k : (mobile ? 5 : 8) + (k - (mobile ? 5 : 8)) * .22;
        var sx = baseX, syy = baseY + kk * gap, ss = 1 - Math.min(k, 14) * .03, so = k > 7 ? Math.max(0, 1 - (k - 7) * .3) * .62 : 1 - k * .05;
        // posizione nel caos: sparse per lo schermo, a profondità diverse
        var cxp = mobile ? lerp(-tw * .15, W - tw * .85, o.rx) : lerp(W * .56, W - tw * .82, o.rx);
        var cyp = mobile ? lerp(64, H * .52, o.ry) : lerp(H * .06, H * .86, o.ry);
        var cs = lerp(.72, 1.12, o.rz);
        var c = chaos * (1 - order) * clamp(.35 + k * .08, 0, 1);
        var x = lerp(sx, cxp, c), yy = lerp(syy, cyp, c), s = lerp(ss, cs, c), r = o.rr * 16 * c;
        var op = lerp(so, lerp(.55, 1, o.rz), c);
        // entra eLogy: verde uno dopo l'altro, poi tutte volano nel punto di fuga
        var okOn = order > 0 && map(cp, .01, .09) > (k / Math.max(n, 1)) * .85 + .05;
        if (okOn !== o.ok) { o.ok = okOn; el.classList.toggle('ok', okOn); }
        var fly = ease(map(cp, .08 + (1 - j / N) * .1, .17 + (1 - j / N) * .1));
        if (fly > 0) { x = lerp(x, vpx, fly); yy = lerp(yy, vpy, fly); s = lerp(s, .12, fly); r = lerp(r, 0, fly); op = op * (1 - fly); }
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (yy + (1 - enter) * -26).toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
        el.style.opacity = (op * enter * (yy > H + 40 ? 0 : 1)).toFixed(3);
        el.style.zIndex = Math.round((c > .3 ? o.rz * 100 : 100 - k));
        el.style.width = tw + 'px';
      }
      // «suono visivo»: ogni nuovo ordine fa un ping, i picchi fanno lampeggiare i bordi
      var ci = Math.floor(countF);
      if (ci > lastCount && order < .1) {
        var nt = toasts[Math.min(ci, N) - 1];
        if (nt) { nt.el.classList.remove('ping'); void nt.el.offsetWidth; nt.el.classList.add('ping'); }
        if (chaos > .35 && Date.now() - flashT > 380) { flashT = Date.now(); tWrap.classList.add('flash'); setTimeout(function () { tWrap.classList.remove('flash'); }, 90); }
      }
      lastCount = ci;
    }

    /* ===== SCENA 4: il viaggio di un ordine ===== */
    var qp = sProc.p, q = qp * 4.18 - .09, qf = sProc.frame;   // q = posizione in «tappe» (0..4)
    q = clamp(q, 0, 4);
    var pan = q * stw;
    setV(qf, '--pan', pan.toFixed(1) + '');
    track.style.transform = 'translate3d(' + (-pan + (W - stw) / 2).toFixed(1) + 'px,0,0)';
    setV(qf, '--railp', q / 4);
    setV(qf, '--lane', qp * 3);
    stations.forEach(function (st, k) { setV(st, '--on', clamp(1 - Math.abs(q - k) * 1.3, 0, 1)); });
    dots.forEach(function (dt, k) { dt.classList.toggle('on', Math.round(q) === k); });
    // il gettone: ordine → dentro eLogy → pacco → parte → consegnato
    var toCube = map(q, .62, 1);
    setV(qf, '--ord-s', 1 - toCube * .85);
    setV(qf, '--ord-o', 1 - map(q, .8, 1));
    var boxIn = eo(map(q, 1.55, 2.0));
    setV(qf, '--box-s', boxIn * (1 - map(q, 3.86, 4) * .35));
    setV(qf, '--box-o', boxIn * (1 - map(q, 3.82, 3.97)));
    setV(qf, '--lbl', map(q, 1.95, 2.2));
    setV(qf, '--speed', map(q, 2.55, 2.85) * (1 - map(q, 3.35, 3.6)));
    setV(qf, '--bob', Math.sin(qp * 60) * 3 * map(q, 2.4, 2.6) * (1 - map(q, 3.6, 3.8)));
    stations[1].style.setProperty('--glow', (clamp(1 - Math.abs(q - 1.15) * 1.6, 0, 1)).toFixed(3));
    stations[4].style.setProperty('--check', map(q, 3.85, 4).toFixed(3));
  }

  /* ---------- salto diretto per le anteprime: ?at=problem:0.8 ---------- */
  function jump() {
    var m = /[?&]at=([a-z]+):([0-9.]+)/.exec(location.search);
    if (!m || !scenes[m[1]]) return;
    var s = scenes[m[1]];
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, s.top + s.len * parseFloat(m[2]));
  }

  layout();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { var wasM = mobile; layout(); if (wasM !== mobile) { seqKind = ''; if (scenes.control.near) loadSeq(); } update(); });
  window.addEventListener('load', function () { layout(); jump(); update(); });
  jump(); update();
  // precarica la clip dopo che la pagina è ferma (non compete con l'hero)
  // solo su computer: sul telefono si scarica quando ci si avvicina (risparmio dati)
  if (!mobile) setTimeout(function () { if ('requestIdleCallback' in window) requestIdleCallback(loadSeq); else loadSeq(); }, 3500);
})();
