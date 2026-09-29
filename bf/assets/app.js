(function () {
  var BF = window.BF || {};
  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function cookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  // --- provenienza: prima e ultima visita ---------------------------------
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'campaign_id', 'adset_id', 'ad_id', 'fbclid'];
  var qs = new URLSearchParams(location.search);
  var now = {};
  KEYS.forEach(function (k) { if (qs.get(k)) now[k] = qs.get(k).slice(0, 200); });
  var hasNow = Object.keys(now).length > 0;
  if (hasNow) {
    now.at = new Date().toISOString();
    now.landing_url = location.href.slice(0, 500);
    if (!LS.get('bf_first')) LS.set('bf_first', now);
    LS.set('bf_last', now);
  }
  var first = LS.get('bf_first') || {};
  var last = LS.get('bf_last') || {};
  var visitor = LS.get('bf_vid') || uid();
  LS.set('bf_vid', visitor);
  var session = uid();

  // fbc: se arriva un fbclid lo teniamo nel formato che vuole Meta
  var fbclid = now.fbclid || last.fbclid;
  var fbc = cookie('_fbc') || (fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : null);

  // --- consenso e pixel ----------------------------------------------------
  var consent = LS.get('bf_consent'); // 'yes' | 'no' | null
  var pixelOn = false;
  function loadPixel() {
    if (pixelOn || !BF.pixel) return;
    pixelOn = true;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', BF.pixel);
  }
  function pixel(name, data, eventId, custom) {
    if (consent !== 'yes') return;
    loadPixel();
    fbq(custom ? 'trackCustom' : 'track', name, data || {}, { eventID: eventId });
  }

  // --- invio al nostro server (eventi della pagina) -------------------------
  function base() {
    return {
      variant: BF.variant, angle: BF.angle, visitor_id: visitor, session_id: session,
      consent: consent === 'yes', page_url: location.href.slice(0, 500), referrer: document.referrer.slice(0, 300),
      first_touch: first, last_touch: last, fbp: cookie('_fbp'), fbc: fbc
    };
  }
  function send(type, extra, beacon) {
    if (!BF.endpoint) return Promise.resolve(null);
    var body = Object.assign(base(), { type: type }, extra || {});
    var json = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(BF.endpoint, new Blob([json], { type: 'text/plain' }));
      return Promise.resolve(null);
    }
    return fetch(BF.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: json, keepalive: true })
      .then(function (r) { return r.json(); });
  }
  function track(name, pixelName, data, custom) {
    var id = name + '.' + uid();
    pixel(pixelName, Object.assign({ content_name: 'bf26_' + BF.angle, content_category: 'bf26_landing' }, data || {}), id, custom);
    send('event', { event: name, event_id: id, pixel_event: pixelName || null }, true);
    return id;
  }

  function startTracking() {
    track('page_view', 'PageView');
    track('view_content', 'ViewContent');
  }
  var banner = document.querySelector('.consent');
  function decide(v) {
    consent = v; LS.set('bf_consent', v); banner.hidden = true;
    if (v === 'yes') { loadPixel(); track('page_view', 'PageView'); track('view_content', 'ViewContent'); }
  }
  if (consent) startTracking();
  else {
    banner.hidden = false;
    send('event', { event: 'page_view', event_id: 'page_view.' + uid(), pixel_event: null }, true);
  }
  document.querySelectorAll('[data-consent]').forEach(function (b) {
    b.addEventListener('click', function () {
      var wasNull = consent == null;
      consent = b.dataset.consent; LS.set('bf_consent', consent); banner.hidden = true;
      if (wasNull && consent === 'yes') { track('consent_view', 'PageView'); track('view_content', 'ViewContent'); }
    });
  });
  var cs = document.querySelector('[data-cookie-settings]');
  if (cs) cs.addEventListener('click', function () { banner.hidden = false; });

  // --- modulo ---------------------------------------------------------------
  var form = document.getElementById('lead-form');
  var answers = {};
  var started = false;
  function formStart() {
    if (started) return; started = true;
    track('form_start', 'FormStart', {}, true);
  }
  form.querySelectorAll('.chips').forEach(function (g) {
    g.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', function () {
        formStart();
        g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
        answers[g.dataset.name] = b.dataset.v;
        form.querySelector('[data-err="1"]').textContent = '';
      });
    });
  });
  form.addEventListener('focusin', formStart);
  var steps = form.querySelectorAll('.st');
  var bar = form.querySelector('.progress i');
  function show(n) {
    steps.forEach(function (s) { s.hidden = s.dataset.step !== String(n); });
    bar.style.width = n === 1 ? '50%' : '100%';
  }
  form.querySelector('[data-next]').addEventListener('click', function () {
    var miss = ['ordini_mese', 'piattaforma', 'logistica_attuale'].filter(function (k) { return !answers[k]; });
    if (miss.length) { form.querySelector('[data-err="1"]').textContent = 'Scegli una risposta per ogni domanda.'; return; }
    show(2);
    send('event', { event: 'form_step2', event_id: 'form_step2.' + uid() }, true);
    var f = document.getElementById('f-nome'); if (f) f.focus({ preventScroll: true });
  });
  form.querySelector('[data-back]').addEventListener('click', function () { show(1); });

  function cleanSite(s) {
    s = (s || '').trim().toLowerCase();
    if (!s) return '';
    if (!/^https?:\/\//.test(s)) s = 'https://' + s;
    try { var u = new URL(s); return u.hostname.indexOf('.') > 0 ? u.origin : ''; } catch (e) { return ''; }
  }
  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var err = form.querySelector('[data-err="2"]');
    var nome = form.nome.value.trim(), email = form.email.value.trim(), sito = cleanSite(form.sito.value), tel = form.telefono.value.trim();
    [form.nome, form.email, form.sito].forEach(function (i) { i.classList.remove('bad'); });
    var bad = [];
    if (nome.length < 2) bad.push(form.nome);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) bad.push(form.email);
    if (!sito) bad.push(form.sito);
    if (bad.length) { bad.forEach(function (i) { i.classList.add('bad'); }); err.textContent = 'Controlla i campi evidenziati.'; bad[0].focus(); return; }
    if (!form.privacy.checked) { err.textContent = 'Serve la conferma sull\'informativa privacy.'; return; }
    err.textContent = '';
    sending = true;
    var btn = form.querySelector('button[type=submit]'); var label = btn.textContent; btn.textContent = 'Invio…'; btn.disabled = true;
    var leadEventId = 'lead.' + uid();
    var qualEventId = 'qualified_lead.' + uid();
    send('lead', {
      event_id: leadEventId, qualified_event_id: qualEventId,
      nome: nome, email: email, sito: sito, telefono: tel,
      ordini_mese: answers.ordini_mese, piattaforma: answers.piattaforma, logistica_attuale: answers.logistica_attuale,
      hp: form.azienda_web.value, privacy: true
    }).then(function (r) {
      if (!BF.endpoint) r = { ok: true, qualified: false }; if (!r || !r.ok) throw new Error((r && r.error) || 'errore');
      pixel('Lead', { content_name: 'bf26_' + BF.angle, content_category: 'bf26_landing' }, leadEventId);
      if (r.qualified) pixel('QualifiedLead', { content_name: 'bf26_' + BF.angle, lead_tier: r.tier }, qualEventId, true);
      steps.forEach(function (s) { s.hidden = true; });
      form.querySelector('.progress').hidden = true;
      form.querySelector('.done').hidden = false;
      document.querySelector('.sticky-cta').classList.remove('show');
    }).catch(function () {
      err.innerHTML = 'Non siamo riusciti a inviare la richiesta. Riprova, oppure chiamaci al <a href="tel:+393933302394">+39 393 3302394</a>.';
      btn.textContent = label; btn.disabled = false;
    }).then(function () { sending = false; });
  });

  // --- piccoli movimenti -----------------------------------------------------
  document.querySelectorAll('[data-cta]').forEach(function (a) {
    a.addEventListener('click', function () { send('event', { event: 'cta_click', event_id: 'cta.' + uid(), cta: a.dataset.cta }, true); });
  });
  var sticky = document.querySelector('.sticky-cta');
  var hero = document.querySelector('.hero');
  var finalSec = document.getElementById('modulo');
  if ('IntersectionObserver' in window) {
    var heroOut = false, finalIn = false;
    var upd = function () { sticky.classList.toggle('show', heroOut && !finalIn && form.querySelector('.done').hidden); };
    new IntersectionObserver(function (e) { heroOut = !e[0].isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(function (e) { finalIn = e[0].isIntersecting; upd(); }, { threshold: 0.15 }).observe(finalSec);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        if (!x.isIntersecting) return;
        x.target.querySelectorAll('li').forEach(function (li, i) { setTimeout(function () { li.classList.add('on'); }, i * 260); });
        io.unobserve(x.target);
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.flow').forEach(function (f) { io.observe(f); });
  } else {
    document.querySelectorAll('.flow li').forEach(function (li) { li.classList.add('on'); });
  }

  // spot con voce
  var spot = document.querySelector('.spot');
  var sv = spot.querySelector('video');
  document.querySelectorAll('[data-open-spot]').forEach(function (b) {
    b.addEventListener('click', function () { spot.hidden = false; sv.play(); send('event', { event: 'spot_play', event_id: 'spot.' + uid() }, true); });
  });
  spot.addEventListener('click', function (e) { if (e.target === spot || e.target.hasAttribute('data-close-spot')) { sv.pause(); spot.hidden = true; } });

  // giorni al Black Friday, contati sul giorno di chi guarda
  var gg = document.querySelector('[data-giorni]');
  if (gg) {
    var bf = new Date(2026, 10, 27), oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    var n = Math.round((bf - oggi) / 86400000);
    if (n > 1) gg.textContent = n; else gg.closest('.kicker').textContent = 'Black Friday · 27 novembre 2026';
  }

  // calendario (solo angolo tempo): giorni lavorativi da oggi
  var tl = document.querySelector('[data-timeline]');
  if (tl) {
    var addWork = function (d, n) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) n--; } return d; };
    var fmt = function (d) { return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); };
    var today = new Date();
    var avvio = addWork(today, 7), pronto = addWork(avvio, 2);
    tl.querySelector('[data-tl="oggi"]').textContent = 'Oggi, ' + fmt(today);
    tl.querySelector('[data-tl="avvio"]').textContent = 'Entro ' + fmt(avvio);
    tl.querySelector('[data-tl="pronto"]').textContent = 'Da ' + fmt(pronto);
  }
})();
