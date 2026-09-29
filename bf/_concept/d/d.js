/* Concept D — un pacco racconta il servizio. Vanilla JS, nessuna libreria. */
(function () {
  'use strict';
  var root = document.documentElement;
  var MOTION = root.classList.contains('m');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var out = function (t) { return 1 - Math.pow(1 - t, 3); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- spot ---------- */
  var spot = $('.spot'), spotV = spot && $('video', spot);
  $$('[data-open-spot]').forEach(function (b) {
    b.addEventListener('click', function () { spot.hidden = false; try { spotV.play(); } catch (e) {} });
  });
  function closeSpot() { spot.hidden = true; spotV.pause(); }
  if (spot) {
    $('.spot-x', spot).addEventListener('click', closeSpot);
    spot.addEventListener('click', function (e) { if (e.target === spot) closeSpot(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !spot.hidden) closeSpot(); });
  }

  /* ---------- raggi = decine di corrieri (costruiti sempre, anche in statico) ---------- */
  var raysSvg = $('.rays'), rays = [];
  (function buildRays() {
    var NS = 'http://www.w3.org/2000/svg', N = 34, seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2 + (rnd() - .5) * .12;
      var r0 = 120, r1 = 250 + rnd() * 230;
      var hi = i === 29;
      var g = document.createElementNS(NS, 'g'); if (hi) g.setAttribute('class', 'hi');
      var l = document.createElementNS(NS, 'line');
      var x0 = Math.cos(a) * r0, y0 = Math.sin(a) * r0, x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1;
      l.setAttribute('x1', x0.toFixed(1)); l.setAttribute('y1', y0.toFixed(1));
      l.setAttribute('x2', x1.toFixed(1)); l.setAttribute('y2', y1.toFixed(1));
      var len = r1 - r0; l.setAttribute('stroke-dasharray', len.toFixed(1)); l.setAttribute('stroke-dashoffset', '0');
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x1.toFixed(1)); c.setAttribute('cy', y1.toFixed(1)); c.setAttribute('r', hi ? 6 : 3.5);
      g.appendChild(l); g.appendChild(c); raysSvg.appendChild(g);
      rays.push({ g: g, l: l, c: c, len: len, d: rnd(), hi: hi, a: a, r0: r0, r1: r1 });
    }
    var run = document.createElementNS(NS, 'circle'); run.setAttribute('r', 7); run.setAttribute('class', 'run'); run.style.opacity = 0;
    raysSvg.appendChild(run); rays.run = run;
  })();

  if (!MOTION) return; /* statico: niente altro da fare */

  /* ---------- parole lente (problema) ---------- */
  var slow = $('.slow');
  if (slow) {
    slow.innerHTML = slow.textContent.split(' ').map(function (w, i) {
      return '<span class="w" style="transition-delay:' + (0.5 + i * 0.16).toFixed(2) + 's">' + w + '</span>';
    }).join(' ');
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .35 });
  $$('.moment').forEach(function (m) { io.observe(m); });

  /* ---------- elementi ---------- */
  var vw = 0, vh = 0, mobile = false;
  var heroWrap = $('.hero-wrap'), heroFrame = $('.hero-frame'), heroIn = $('.hero-in'), vendi = $('.word-vendi'), hint = $('.scroll-hint');
  var heroVideo = $('.hero-video');
  var ordWrap = $('.orders-wrap'), cvs = $('.orders-canvas'), ctx = cvs.getContext('2d'), ordWord = $('.orders-pin .word');
  var rev = $('.reveal'), revLogo = $('.reveal-logo'), revCopy = $('.reveal-copy');
  var scene = $('.scene'), stage = $('.stage'), cam = $('.cam'), shadow = $('.shadow');
  var flaps = { front: $('.h-front .flap'), back: $('.h-back .flap'), left: $('.h-left .flap'), right: $('.h-right .flap') };
  var prod = $('.prod'), tissue = $('.tissue'), tapeTop = $('.tape-top'), tapeV = $('.tape-v'), label = $('.label'), seal = $('.l-seal');
  var beats = $$('.beat').map(function (b) { var r = b.getAttribute('data-r').split(','); return { el: b, a: +r[0], b: +r[1] }; });
  var srcs = $$('.src');
  var mapBox = $('.map'), pins = { pomezia: $('.pin-pomezia'), pecs: $('.pin-pecs'), mataro: $('.pin-mataro') };

  /* ---------- mappa su canvas: punti letti dal file SVG vero ---------- */
  var MAP = { w: 600, h: 520, base: [], it: [], hu: [], es: [], ready: false };
  var SITES = { pomezia: [320.5, 376.6], pecs: [398.7, 288.6], mataro: [183.3, 379.2] };
  var mc = document.createElement('canvas'); mapBox.insertBefore(mc, mapBox.firstChild);
  var mctx = mc.getContext('2d');
  function loadMap() {
    if (MAP.loading) return; MAP.loading = true;
    fetch('europa.svg').then(function (r) { return r.text(); }).then(function (t) {
      ['base', 'it', 'hu', 'es'].forEach(function (k) {
        var m = t.match(new RegExp('class="m-' + k + '"[^>]*d="([^"]+)"'));
        if (!m) return;
        var re = /M([\d.]+) ([\d.]+)/g, x, arr = [];
        while ((x = re.exec(m[1]))) arr.push(+x[1], +x[2]);
        MAP[k] = new Float32Array(arr);
      });
      MAP.ready = true; tick(true);
    }).catch(function () {});
  }

  /* ---------- canvas ordini ---------- */
  var DOTS = [], dotsDrawn = 0, dpr = 1;
  function buildDots() {
    DOTS = []; var n = mobile ? 900 : 1800, seed = 11;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var tr = ordWord.getBoundingClientRect(), pr = ordWord.parentNode.getBoundingClientRect();
    var bx0 = tr.left - pr.left - 16, bx1 = tr.right - pr.left + 16, by0 = tr.top - pr.top - 12, by1 = tr.bottom - pr.top + 12;
    var guard = 0;
    while (DOTS.length < n && guard++ < n * 6) {
      var x = rnd() * vw, y = rnd() * vh;
      var inside = x > bx0 && x < bx1 && y > by0 && y < by1;
      if (inside && DOTS.length < n * .82) continue;
      var k = rnd();
      DOTS.push([x, y, 1.6 + rnd() * 2.2, k < .72 ? '#2EA853' : k < .86 ? '#9BE15D' : '#4A504C']);
    }
  }
  function sizeCanvas(c, w, h) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  }
  function drawDots(q) {
    var want = Math.floor(DOTS.length * q);
    if (want < dotsDrawn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height); dotsDrawn = 0; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = dotsDrawn; i < want; i++) {
      var d = DOTS[i]; ctx.fillStyle = d[3]; ctx.beginPath(); ctx.arc(d[0], d[1], d[2], 0, 6.283); ctx.fill();
    }
    dotsDrawn = want;
  }

  /* ---------- misure ---------- */
  var OX = .5, OY = .48, W = 300;
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight; mobile = vw < 900;
    W = Math.round(mobile ? Math.min(vw * .46, vh * .25, 230) : Math.min(vw * .175, vh * .3, 290));
    stage.style.setProperty('--w', W + 'px');
    OX = .5; OY = mobile ? .38 : .47;
    stage.style.setProperty('--ox', (OX * 100) + '%'); stage.style.setProperty('--oy', (OY * 100) + '%');
    sizeCanvas(cvs, vw, vh); dotsDrawn = 0; buildDots();
    sizeCanvas(mc, vw, vh);
    tick(true);
  }

  /* ---------- progresso di una sezione "pinnata" ---------- */
  function prog(el) {
    var r = el.getBoundingClientRect(), span = r.height - vh;
    return { p: span > 0 ? clamp(-r.top / span, 0, 1) : 0, on: r.top < vh && r.bottom > 0, top: r.top };
  }

  var lastY = -1, lightOn = false;
  function tick(force) {
    var y = window.scrollY;
    if (!force && y === lastY) return; lastY = y;

    /* 1 · hero → la finestra si ritira, resta «Vendi.» */
    var h = prog(heroWrap);
    if (h.on) {
      var q = h.p, e = ease(seg(q, 0, .8));
      var s = 1 - .56 * e;
      heroFrame.style.transform = 'scale(' + s.toFixed(4) + ')';
      heroFrame.style.borderRadius = (28 * e / s).toFixed(1) + 'px';
      heroIn.style.opacity = (1 - seg(q, 0, .35)).toFixed(3);
      heroIn.style.transform = 'translateY(' + (-60 * seg(q, 0, .4)).toFixed(1) + 'px)';
      var v = out(seg(q, .42, .85));
      vendi.style.opacity = v.toFixed(3);
      vendi.style.transform = 'scale(' + (1.12 - .12 * v).toFixed(4) + ')';
      hint.style.opacity = 1 - seg(q, 0, .1);
      if (heroVideo.paused !== (q > .98)) { if (q > .98) heroVideo.pause(); else heroVideo.play().catch(function () {}); }
    }

    /* 2 · ordini che si accumulano */
    var o = prog(ordWrap);
    if (o.on) drawDots(ease(seg(o.p, .02, .9)));

    /* 4 · la pagina si accende: eLogy */
    var r = prog(rev);
    if (r.on || force) {
      var L = seg(r.p, .05, .35);
      var c0 = [14, 16, 15], c1 = [244, 242, 237];
      rev.style.backgroundColor = 'rgb(' + c0.map(function (c, i) { return Math.round(lerp(c, c1[i], L)); }).join(',') + ')';
      var lg = out(seg(r.p, .18, .45)), lgUp = ease(seg(r.p, .5, .75));
      revLogo.style.opacity = lg.toFixed(3);
      revLogo.style.transform = 'translateY(' + (lerp(mobile ? 18 : 22, 0, lgUp) * vh / 100).toFixed(1) + 'px) scale(' + (lerp(.8, 1.35, lg) - .75 * lgUp).toFixed(4) + ')';
      var cp = out(seg(r.p, .58, .85));
      revCopy.style.opacity = cp.toFixed(3);
      revCopy.style.transform = 'translateY(' + (40 * (1 - cp)).toFixed(1) + 'px)';
    }
    var isLight = r.top < 0 && r.p > .22;
    if (isLight !== lightOn) { lightOn = isLight; document.body.classList.toggle('lt', lightOn); }

    /* 5 · il pacco */
    var sc = prog(scene);
    if (sc.on || force) scenePaint(sc.p);
  }

  function setFlap(el, deg) { el.style.transform = 'rotateX(' + deg.toFixed(2) + 'deg)'; }

  function scenePaint(p) {
    if (p > .5 && !MAP.ready) loadMap();

    /* ingresso + apertura */
    var enter = out(seg(p, 0, .04));
    var shrink = ease(seg(p, .655, .705));          /* il pacco diventa un punto su Pomezia */
    var back = out(seg(p, .87, .93));               /* torna, consegnato */
    var boxScale = (lerp(.82, 1, enter) * (1 - shrink)) + back;
    var ry = lerp(-40, -26, seg(p, 0, .65)) + lerp(0, -8, back);
    var rx = -24 + 4 * seg(p, .44, .52) - 4 * seg(p, .52, .6);
    var lift = lerp(40, 0, enter);

    /* posizione: segue Pomezia quando la camera si allontana */
    var mapCam = mapCamera(p);
    var cx = vw * OX, cy = vh * OY;
    var bx = 0, by = 0;
    if (shrink > 0 && back === 0) { bx = (mapCam.pom[0] - cx) * shrink; by = (mapCam.pom[1] - cy) * shrink; }
    cam.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,' + (by + lift).toFixed(1) + 'px,0) scale(' + Math.max(boxScale, .001).toFixed(4) + ') rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    cam.style.visibility = boxScale < .012 ? 'hidden' : 'visible';
    shadow.style.opacity = (Math.max(1 - shrink, back) * enter).toFixed(3);
    shadow.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px) scale(' + Math.max(boxScale, .001).toFixed(3) + ')';

    /* lembi: aperti → chiusi (prima davanti/dietro, poi i lati sopra) */
    var open = -28;
    var fb = ease(seg(p, .305, .345)), lr = ease(seg(p, .345, .385));
    var start = lerp(70, open, out(seg(p, 0, .05)));
    setFlap(flaps.front, lerp(start, 90, fb)); setFlap(flaps.back, lerp(start, 90, fb));
    setFlap(flaps.left, lerp(start - 6, 90, lr)); setFlap(flaps.right, lerp(start - 6, 90, lr));

    /* prodotto che scende nel pacco */
    var drop = seg(p, .095, .175), dropE = drop < 1 ? ease(drop) : 1;
    var bounce = Math.sin(seg(p, .175, .2) * Math.PI) * 6;
    prod.style.transform = 'translateY(calc(var(--h)/2 - var(--ph)/2 - 1px)) translateY(' + (lerp(-W * 1.9, 0, dropE) - bounce).toFixed(1) + 'px) rotateY(' + lerp(-30, 0, dropE).toFixed(1) + 'deg)';
    prod.style.opacity = seg(p, .09, .11).toFixed(3);
    prod.style.visibility = p > .5 ? 'hidden' : 'visible';

    /* velina */
    var ti = out(seg(p, .215, .27));
    tissue.style.transform = 'rotateX(90deg) translateZ(calc(var(--h)/-2 + var(--ph) + 3px)) scale(' + ti.toFixed(3) + ') rotate(' + lerp(-14, 0, ti).toFixed(1) + 'deg)';
    tissue.style.visibility = p > .5 ? 'hidden' : 'visible';

    /* nastro */
    var tp = ease(seg(p, .39, .425));
    tapeTop.style.transform = 'rotateX(90deg) translateZ(calc(var(--h)/2 + 3px)) scaleY(' + tp.toFixed(3) + ')';
    tapeTop.style.opacity = tp > 0 ? .96 : 0;
    tapeV.style.transform = 'scaleY(' + ease(seg(p, .415, .44)).toFixed(3) + ')';

    /* etichetta */
    var lb = out(seg(p, .45, .5));
    label.style.opacity = lb.toFixed(3);
    label.style.transform = 'translate(' + lerp(30, 0, lb).toFixed(1) + '%,' + lerp(-40, 0, lb).toFixed(1) + '%) rotate(' + lerp(-12, 0, lb).toFixed(2) + 'deg) scale(' + lerp(1.35, 1, lb).toFixed(3) + ')';
    var se = out(seg(p, .925, .96));
    seal.style.transform = 'scale(' + se.toFixed(3) + ')';

    /* sorgenti dell'ordine: Shopify / WooCommerce / API volano dentro il pacco */
    srcs.forEach(function (s, i) {
      var t = ease(seg(p, .025 + i * .012, .07 + i * .008));
      if (!s._r) { var a = s.getBoundingClientRect(), st = stage.getBoundingClientRect(); s._r = [a.left - st.left + a.width / 2, a.top - st.top + a.height / 2]; }
      var dx = (cx - s._r[0]) * t, dy = (cy - W * .45 - s._r[1]) * t;
      s.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + lerp(1, .25, t).toFixed(3) + ')';
      s.style.opacity = ((1 - seg(t, .7, 1)) * (1 - seg(p, .085, .1))).toFixed(3);
    });

    /* raggi: decine di corrieri */
    var rayIn = seg(p, .525, .61), rayOut = 1 - seg(p, .655, .675), hiOn = seg(p, .6, .63);
    raysSvg.style.opacity = rayOut.toFixed(3);
    rays.forEach(function (R, i) {
      var t = ease(seg(rayIn, R.d * .55, R.d * .55 + .45));
      R.g.style.opacity = (t > 0 ? (R.hi ? 1 : lerp(1, .45, hiOn)) : 0);
      R.l.setAttribute('stroke-dashoffset', (R.len * (1 - t)).toFixed(1));
      R.c.style.opacity = seg(t, .9, 1);
    });
    var run = seg(p, .61, .655), H = rays.filter(function (R) { return R.hi; })[0];
    if (H) {
      var rr = lerp(H.r0, H.r1, ease(run));
      rays.run.setAttribute('cx', (Math.cos(H.a) * rr).toFixed(1)); rays.run.setAttribute('cy', (Math.sin(H.a) * rr).toFixed(1));
      rays.run.style.opacity = run > 0 && run < 1 ? 1 : 0;
    }

    /* Europa */
    var mo = seg(p, .655, .69) * (1 - seg(p, .86, .885));
    mapBox.style.opacity = mo.toFixed(3);
    if (mo > 0 && MAP.ready) drawMap(mapCam, p);
    var pinT = { pomezia: seg(p, .69, .71), pecs: seg(p, .745, .77), mataro: seg(p, .785, .81) };
    Object.keys(pins).forEach(function (k) {
      var pt = mapCam.sites[k], t = out(pinT[k]);
      pins[k].style.opacity = t.toFixed(3);
      pins[k].style.transform = 'translate(' + pt[0].toFixed(1) + 'px,' + pt[1].toFixed(1) + 'px) scale(' + lerp(.6, 1, t).toFixed(3) + ')';
    });

    /* testi attorno all'oggetto */
    beats.forEach(function (B) {
      var len = B.b - B.a, fi = B.a <= 0 ? 1 : out(seg(p, B.a, B.a + len * .22)), fo = B.b >= 1 ? 0 : seg(p, B.b - len * .18, B.b);
      var v = Math.min(fi, 1 - fo);
      B.el.style.opacity = v.toFixed(3);
      B.el.style.visibility = v > 0.001 ? 'visible' : 'hidden';
      var ty = (1 - fi) * 36 - fo * 24;
      var base = (!mobile && (B.el.classList.contains('pos-a') || B.el.classList.contains('pos-b'))) ? 'translateY(-50%) ' : '';
      B.el.style.transform = base + 'translateY(' + ty.toFixed(1) + 'px)';
    });
  }

  /* camera della mappa: parte dentro l'Italia, si allontana fino all'Europa intera */
  function mapCamera(p) {
    var cx = vw * OX, cy = vh * OY;
    var fit = mobile ? Math.min(vw * 1.25 / MAP.w, vh * .62 / MAP.h) : Math.min(vw * .62 / MAP.w, vh * .84 / MAP.h);
    var z = ease(seg(p, .67, .82));
    var S = fit * Math.pow(9, 1 - z);                   /* zoom esponenziale = movimento di camera */
    var pom = SITES.pomezia;
    var endC = mobile ? [vw * .5, vh * .4] : [vw * .64, vh * .47];
    var mc = [MAP.w * (mobile ? .56 : .5), MAP.h * (mobile ? .62 : .55)];
    /* punto dello schermo in cui sta Pomezia */
    var tx = lerp(cx, endC[0] + (pom[0] - mc[0]) * fit, z), ty = lerp(cy, endC[1] + (pom[1] - mc[1]) * fit, z);
    var toScr = function (pt) { return [tx + (pt[0] - pom[0]) * S, ty + (pt[1] - pom[1]) * S]; };
    return { S: S, fit: fit, pom: [tx, ty], toScr: toScr,
      sites: { pomezia: [tx, ty], pecs: toScr(SITES.pecs), mataro: toScr(SITES.mataro) } };
  }

  function drawMap(C, p) {
    var c = mctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, mc.width, mc.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = Math.max(1.1, Math.min(1.6 * C.S * .9, 9));
    var pom = SITES.pomezia, tx = C.pom[0], ty = C.pom[1], S = C.S;
    var layer = function (arr, color) {
      if (!arr.length) return;
      c.fillStyle = color; c.beginPath();
      for (var i = 0; i < arr.length; i += 2) {
        var x = tx + (arr[i] - pom[0]) * S, y = ty + (arr[i + 1] - pom[1]) * S;
        if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
        c.moveTo(x + r, y); c.arc(x, y, r, 0, 6.283);
      }
      c.fill();
    };
    var mix = function (t) { /* grigio → verde */
      var a = [196, 191, 181], b = [46, 168, 83];
      return 'rgb(' + a.map(function (v, i) { return Math.round(lerp(v, b[i], t)); }).join(',') + ')';
    };
    layer(MAP.base, '#CFCAC0');
    layer(MAP.it, mix(1));
    layer(MAP.hu, mix(seg(p, .74, .77)));
    layer(MAP.es, mix(seg(p, .78, .81)));
  }

  /* ---------- loop ---------- */
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; tick(false); }); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  var rt; window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () { srcs.forEach(function (s) { s._r = null; s.style.transform = 'none'; }); measure(); }, 120);
  });
  measure();
  /* anteprime: ?at=processo:0.5 salta a quel punto della sezione */
  var at = /[?&]at=([\w-]+):([\d.]+)/.exec(location.search);
  if (at) {
    var sec = document.getElementById(at[1]);
    if (sec) { var go = function () { var r = sec.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + (+at[2]) * Math.max(0, r.height - vh)); tick(true); }; go(); setTimeout(go, 400); }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { buildDots(); dotsDrawn = 0; tick(true); });
})();
