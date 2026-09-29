/* Concept C · Sala di controllo — JS vanilla, nessuna libreria.
   Senza JS o con prefers-reduced-motion la pagina resta statica e completa (vedi c.css). */
(() => {
  const d = document, R = d.documentElement, M = R.classList.contains('m');
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  let vw = innerWidth, vh = innerHeight;

  /* ---------- orologio e conto alla rovescia (dati veri: data e ora) ---------- */
  const BF = new Date(2026, 10, 27, 0, 0, 0);
  const cds = $$('[data-countdown]'), cdb = $('[data-countdown-big]'), clk = $('[data-clock]'), clk2 = $("[data-clock2]");
  function tick() {
    const n = new Date(), g = Math.ceil((BF - n) / 864e5);
    const t = g > 1 ? `T–${g} giorni` : g === 1 ? 'T–1 giorno' : g === 0 ? 'Oggi' : 'Black Friday';
    cds.forEach(e => e.textContent = t);
    if (cdb) cdb.textContent = g > 0 ? `T–${g}` : 'Oggi';
    const hh = n.toLocaleTimeString('it-IT', { hour12: false }); if (clk) clk.textContent = hh; if (clk2) clk2.textContent = hh;
  }
  tick(); setInterval(tick, 1000);

  /* ---------- spot ---------- */
  const spot = $('.spot'), sv = $('.spot video');
  const closeSpot = () => { spot.hidden = true; sv.pause(); };
  $('[data-open-spot]')?.addEventListener('click', () => { spot.hidden = false; sv.currentTime = 0; sv.play().catch(() => {}); });
  $$('[data-close-spot]').forEach(b => b.addEventListener('click', closeSpot));
  spot.addEventListener('click', e => { if (e.target === spot) closeSpot(); });
  d.addEventListener('keydown', e => { if (e.key === 'Escape' && !spot.hidden) closeSpot(); });

  /* ---------- ubicazioni: griglia di celle (esempio) ---------- */
  const bins = $('[data-bins]');
  if (bins) for (let i = 0; i < 50; i++) { const c = d.createElement('i'); if (Math.random() < .62) c.className = 'f'; bins.appendChild(c); }

  const heroVideo = $('.hero-video');
  if (!M) { // statico: niente video in autoplay se è stato chiesto movimento ridotto
    if (matchMedia('(prefers-reduced-motion: reduce)').matches && heroVideo) { heroVideo.pause(); heroVideo.removeAttribute('autoplay'); }
    const hud = $('.hud'), sc = $('.sticky-cta');
    addEventListener('scroll', () => { hud.classList.toggle('solid', scrollY > 40); sc.classList.toggle('show', scrollY > vh * .9); }, { passive: true });
    return;
  }

  /* ================= da qui in giù: solo con movimento ================= */
  const hud = $('.hud'), sticky = $('.sticky-cta'), finalS = $('.s-final');

  /* ---------- 1+2 · hero → parete della sala ---------- */
  const hero = $('.s-hero'), stage = $('.stage', hero), feed = $('.feed'), hin = $('.hero-in'), shade = $('.hero-shade');
  const tiles = $$('.wall .tile'), wgrid = $('.wall-grid'), wcap = $('.wall-cap'), ftag = $('.feed-tag'), tfeed = $('.t-feed');
  let heroP = -1;
  function heroFrame(p) {
    const W = stage.clientWidth, H = stage.clientHeight, desk = W >= 900;
    const s = desk ? { x: W * .52, y: 0, w: W * .48, h: H } : { x: 0, y: 0, w: W, h: H };
    const r = tfeed.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const e = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    const t = ease(clamp((p - .04) / .5));
    feed.style.left = lerp(s.x, e.x, t) + 'px'; feed.style.top = lerp(s.y, e.y, t) + 'px';
    feed.style.width = lerp(s.w, e.w, t) + 'px'; feed.style.height = lerp(s.h, e.h, t) + 'px';
    feed.style.zIndex = t > .02 ? 3 : 0;
    heroVideo.style.opacity = lerp(.75, 1, t);
    const ho = 1 - clamp(p / .2);
    hin.style.opacity = ho; hin.style.transform = `translateY(${-50 * clamp(p / .26)}px)`;
    hin.style.visibility = ho <= 0 ? 'hidden' : 'visible';
    shade.style.opacity = 1 - t;
    wgrid.style.opacity = clamp((t - .15) / .5) * .9;
    tiles.forEach((el, i) => {
      if (!i) return;
      const o = clamp((t - .35 - i * .07) / .25);
      el.style.opacity = o; el.style.transform = `translateY(${(1 - o) * 16}px)`;
    });
    tiles[0].style.opacity = clamp((t - .9) / .1);
    wcap.style.opacity = clamp((t - .85) / .15);
    ftag.style.opacity = clamp((t - .92) / .08);
  }

  /* parete viva: righe ordini, stato del pacco, prelievi — tutto d'esempio */
  const mtNow = $("[data-mt-now]");
  const ticker = $('[data-ticker]'), mt = $$('[data-minitrack] li'), binCells = bins ? [...bins.children] : [];
  const SRC = ['Shopify', 'WooCommerce', 'API'], ST = ['ricevuto', 'preso in carico', 'preparato', 'affidato al corriere', 'consegnato'];
  let wallOn = false, mtI = 2;
  function wallTick() {
    if (!wallOn) return;
    // avanza lo stato di una riga a caso, e ogni tanto arriva un ordine nuovo
    const rows = $$('li', ticker);
    const r = rows[1 + Math.floor(Math.random() * (rows.length - 1))];
    if (r) { const b = $('b', r), k = Math.min(ST.indexOf(b.textContent) + 1, 4); b.textContent = ST[k]; b.className = 'g'; }
    const li = d.createElement('li'); li.className = 'new';
    li.innerHTML = `<i></i><u>Nuovo ordine</u><span>${SRC[Math.floor(Math.random() * 3)]}</span><b>ricevuto</b>`;
    ticker.prepend(li); const mx = vw >= 900 ? 11 : 7; while (ticker.children.length > mx) ticker.lastElementChild.remove();
  }
  function trackTick() {
    if (!wallOn) return;
    mtI = (mtI + 1) % 6;
    mt.forEach((l, i) => { l.className = i < mtI ? "done" : i === mtI ? "now" : ""; });
    if (mtNow) mtNow.textContent = mtI < 5 ? mt[mtI].textContent : "Consegnato";
  }
  function binTick() {
    if (!wallOn || !binCells.length) return;
    binCells.forEach(c => c.classList.remove('pk'));
    const c = binCells[Math.floor(Math.random() * binCells.length)];
    c.classList.add('pk'); if (Math.random() < .5) c.classList.toggle('f');
  }
  setInterval(wallTick, 1700); setInterval(trackTick, 1300); setInterval(binTick, 420);

  /* ---------- 3 · problema: il paragrafo attivo guida il grafico ---------- */
  const chart = $('.chart'), ps = $$('.ps');
  chart.dataset.step = 0;
  function probFrame() {
    let s = 0;
    ps.forEach(p => { const r = p.getBoundingClientRect(); if (r.top + r.height * .5 < vh * .62) s = +p.dataset.s; });
    ps.forEach((p, i) => p.classList.toggle('on', i === s - 1));
    if (chart.dataset.step != s) chart.dataset.step = s;
  }

  /* ---------- 4 · con eLogy: il circuito si accende una volta ---------- */
  const circuit = $('.circuit');
  let pulses = null;
  new IntersectionObserver((en, o) => {
    en.forEach(x => { if (x.isIntersecting) { circuit.classList.add('on'); o.disconnect(); setTimeout(startPulses, 2600); } });
  }, { threshold: .35 }).observe(circuit);
  function startPulses() {
    const desk = vw >= 900, svg = $(desk ? '.cx-d' : '.cx-m', circuit);
    const a = desk ? [330, 140] : [170, 130], b = desk ? [1150, 140] : [170, 500];
    const NS = 'http://www.w3.org/2000/svg';
    pulses = { a, b, els: [0, 1, 2, 3].map(i => { const c = d.createElementNS(NS, 'circle'); c.setAttribute('r', desk ? 4 : 3.5); c.setAttribute('class', 'pulse'); svg.appendChild(c); return { c, o: i / 4 }; }) };
  }
  function pulseFrame(now) {
    if (!pulses) return;
    const { a, b, els } = pulses;
    els.forEach(p => { const t = ((now / 3600) + p.o) % 1; p.c.setAttribute('cx', lerp(a[0], b[0], t)); p.c.setAttribute('cy', lerp(a[1], b[1], t)); p.c.setAttribute('opacity', Math.min(1, t * 8, (1 - t) * 8)); });
  }

  /* ---------- 5 · il flusso: canvas con i pacchi (dati d'esempio) ---------- */
  const flow = $('.s-flow'), fst = $('.flow-stage'), cv = $('.flow-cv'), ctx = cv.getContext('2d');
  const lanes = $$('.lane'), fields = $$('.lane-f'), trk = $$('.trk-s li');
  let dpr = Math.min(devicePixelRatio || 1, 2), toks = [], flowP = 0, flowVis = false, lastT = 0;
  function sizeCv() { const w = fst.clientWidth, h = fst.clientHeight; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  function zones() {
    const sr = fst.getBoundingClientRect();
    return fields.map(f => { const r = f.getBoundingClientRect(); return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }; });
  }
  const horiz = () => vw >= 900;
  function pos(Z, u, c) {
    const i = clamp(Math.floor(u), 0, 4), z = Z[i], f = u - i;
    return horiz() ? [z.x + f * z.w, z.y + 18 + c * (z.h - 36)] : [z.x + 8 + c * (z.w - 16), z.y + f * z.h];
  }
  const rows = () => horiz() ? 9 : 4;
  function spawn() {
    const stops = [0, 1, 2, 3, 4].map(i => i + .3 + Math.random() * .4), R = rows();
    toks.push({ u: 0, c: (Math.floor(Math.random() * R) + .5) / R, stops, si: 0, wait: 0, v: .5 + Math.random() * .15 });
  }
  let spawnAcc = 0;
  function simulate(dt) {
    spawnAcc += dt * 1000;
    const every = 330 - 150 * clamp(flowP);
    if (spawnAcc > every && toks.length < 70) { spawn(); spawnAcc = -Math.random() * 90; }
    toks = toks.filter(t => {
      if (t.wait > 0) t.wait -= dt;
      else { t.u += t.v * dt; if (t.si < 5 && t.u >= t.stops[t.si]) { t.u = t.stops[t.si]; t.wait = t.si === 0 ? .15 + Math.random() * .3 : .35 + Math.random() * .8; t.si++; } }
      return t.u < 5;
    });
  }
  let warmed = false;
  function warm() { if (warmed) return; warmed = true; for (let i = 0; i < 260; i++) simulate(.05); }
  function drawTok(x, y, z, a, sz, hi) {
    ctx.globalAlpha = a;
    const s = sz;
    if (z === 0) { // ordine: documento
      ctx.strokeStyle = hi ? '#fff' : '#A3A9A2'; ctx.lineWidth = 1.3;
      ctx.strokeRect(x - s * .4, y - s * .5, s * .8, s); ctx.beginPath();
      ctx.moveTo(x - s * .2, y - s * .2); ctx.lineTo(x + s * .2, y - s * .2); ctx.moveTo(x - s * .2, y + s * .1); ctx.lineTo(x + s * .2, y + s * .1); ctx.stroke();
    } else if (z === 1) { // preso in carico
      ctx.fillStyle = hi ? '#6E766F' : '#4A5049'; ctx.fillRect(x - s * .4, y - s * .5, s * .8, s);
      ctx.fillStyle = '#2EA853'; ctx.fillRect(x - s * .4, y - s * .5, s * .22, s);
    } else { // pacco: il cubo
      if (z === 3) { ctx.strokeStyle = '#9BE15D'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let k = 0; k < 3; k++) { const o = (k - 1) * s * .3; if (horiz()) { ctx.moveTo(x - s * 1.6, y + o); ctx.lineTo(x - s * .8, y + o); } else { ctx.moveTo(x + o, y - s * 1.6); ctx.lineTo(x + o, y - s * .8); } } ctx.stroke(); }
      if (z === 4) { ctx.strokeStyle = '#2EA853'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, s * .55, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s * .25, y); ctx.lineTo(x - s * .05, y + s * .2); ctx.lineTo(x + s * .28, y - s * .2); ctx.stroke(); }
      else {
        const h = s * .55;
        ctx.fillStyle = '#2F8446'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h, y - h / 2); ctx.lineTo(x + h, y + h / 2); ctx.lineTo(x, y + h); ctx.lineTo(x - h, y + h / 2); ctx.lineTo(x - h, y - h / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2EA853'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h, y - h / 2); ctx.lineTo(x, y); ctx.lineTo(x - h, y - h / 2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h, y - h / 2); ctx.lineTo(x - h, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.globalAlpha = a * .75; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function flowFrame(now) {
    const dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now;
    const Z = zones(), sz = horiz() ? 15 : 11;
    // quale fase è attiva, dallo scroll
    const f = clamp(flowP, 0, .9999) * 5, a = Math.floor(f), fr = f - a;
    lanes.forEach((l, i) => { l.classList.toggle('on', i === a); l.classList.toggle('past', i < a); });
    trk.forEach((l, i) => { l.className = i < a ? 'done' : i === a ? 'now' : ''; });
    if (trk[a]) trk[a].style.setProperty('--k', Math.round(fr * 100) + '%');
    // simulazione e disegno
    simulate(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    // binari: righe guida tratteggiate
    const R = rows(); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath();
    for (let r = 0; r < R; r++) { const c = (r + .5) / R, [x0, y0] = pos(Z, 0, c), [x1, y1] = pos(Z, 4.999, c); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke(); ctx.setLineDash([]);
    toks.forEach(t => {
      const z = Math.floor(t.u), [x, y] = pos(Z, t.u, t.c);
      const al = Math.min(1, t.u / .12, (5 - t.u) / .35) * (z === a ? 1 : .55);
      drawTok(x, y, z, al, sz, false);
    });
    // il pacco d'esempio seguito dallo scroll
    const ut = a >= 4 ? 4.5 : a + .5 + sstep(.55, 1, fr);
    const [x, y] = pos(Z, ut, .5), zt = Math.min(4, Math.floor(ut)), B = sz * 1.45;
    ctx.fillStyle = 'rgba(21,23,22,.92)'; ctx.fillRect(x - B, y - B, B * 2, B * 2);
    drawTok(x, y, zt, 1, sz * 1.25, true);
    ctx.strokeStyle = '#9BE15D'; ctx.lineWidth = 1.5; ctx.beginPath();
    const L = B * .45;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { ctx.moveTo(x + sx * B, y + sy * (B - L)); ctx.lineTo(x + sx * B, y + sy * B); ctx.lineTo(x + sx * (B - L), y + sy * B); });
    ctx.stroke();
    ctx.font = '500 10px "Roboto Mono", monospace'; ctx.fillStyle = '#9BE15D'; ctx.textBaseline = 'bottom';
    ctx.fillText('ESEMPIO', x - B, y - B - 5);
  }
  new IntersectionObserver(en => en.forEach(x => { flowVis = x.isIntersecting; lastT = 0; if (flowVis) warm(); }), { rootMargin: '300px' }).observe(flow);

  /* ---------- 5b · mappa: la camera si sposta a ogni pannello ---------- */
  const ms = $('.map-stage'), map = $('.map'), mps = $$('.map-panels .mp');
  let mk = 1, mStep = -1;
  const CAM = {
    d: [{ cx: 470, cy: 470, s: 1, fx: .6, fy: .54 }, { cx: 513, cy: 625, s: 1.8, fx: .64, fy: .5 }, { cx: 468, cy: 560, s: 1.45, fx: .64, fy: .52 }, { cx: 470, cy: 500, s: 1.02, fx: .62, fy: .54 }],
    m: [{ cx: 480, cy: 470, s: .52, fx: .5, fy: .3 }, { cx: 513, cy: 625, s: 1.15, fx: .5, fy: .34 }, { cx: 470, cy: 575, s: .68, fx: .5, fy: .32 }, { cx: 440, cy: 520, s: .5, fx: .5, fy: .31 }]
  };
  function mapLayout() {
    const H = ms.clientHeight, desk = ms.clientWidth >= 900;
    const mh = desk ? H * .9 : H * .8, mw = mh * 1004 / 851;
    map.style.width = mw + 'px'; map.style.height = mh + 'px'; mk = mw / 1004;
    mStep = -1;
  }
  ms.dataset.step = 0;
  function mapFrame() {
    let s = 0;
    mps.forEach(p => { const r = p.getBoundingClientRect(); if (r.top + Math.min(r.height, 200) * .5 < vh * (vw >= 900 ? .62 : .8)) s = +p.dataset.s; });
    mps.forEach((p, i) => p.classList.toggle('on', i === s));
    if (s === mStep) return;
    mStep = s; ms.dataset.step = s;
    const W = ms.clientWidth, H = ms.clientHeight, c = CAM[W >= 900 ? 'd' : 'm'][s];
    map.style.transform = `translate(${W * c.fx - c.cx * mk * c.s}px,${H * c.fy - c.cy * mk * c.s}px) scale(${c.s})`;
    map.style.setProperty('--s', c.s);
  }

  /* ---------- avvio: le righe si «accendono» quando entrano ---------- */
  const bio = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('ok'); bio.unobserve(x.target); } }), { threshold: .7 });
  $$('.boot li').forEach(l => bio.observe(l));

  /* ---------- motore: un solo rAF ---------- */
  const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - vh)); };
  const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > -50 && r.top < vh + 50; };
  function frame(now) {
    if (innerWidth !== vw || innerHeight !== vh) resize();
    const y = scrollY;
    hud.classList.toggle('solid', y > 40);
    hud.style.setProperty('--p', clamp(y / (R.scrollHeight - vh)));
    const fr = finalS.getBoundingClientRect();
    const busy = [flow, $('.s-map')].some(el => { const r = el.getBoundingClientRect(); return r.top < vh * .5 && r.bottom > vh * .5; });
    sticky.classList.toggle('show', y > hero.offsetHeight - vh * .5 && fr.top > vh * .6 && !busy);
    if (inView(hero)) { const p = prog(hero); if (Math.abs(p - heroP) > .0005) { heroP = p; heroFrame(p); } wallOn = p > .45; } else wallOn = false;
    if (inView($('.s-prob'))) probFrame();
    pulseFrame(now);
    if (flowVis) { flowP = prog(flow); flowFrame(now); }
    if (inView($('.s-map'))) mapFrame();
    requestAnimationFrame(frame);
  }
  function resize() { vw = innerWidth; vh = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2); sizeCv(); mapLayout(); heroP = -1; }
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
