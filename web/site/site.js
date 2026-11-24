// Hudini website: language picker, landing page texts, the showcase landing page and the help page.
// The chosen language is shared with the panel (localStorage "hudini.lang").
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const LANGS = [['en', 'English'], ['ru', 'Русский'], ['uk', 'Українська'], ['de', 'Deutsch']];
  const has = c => LANGS.some(l => l[0] === c);
  const canon = c => LANGS.find(l => l[0] === c)?.[0] || '';   // hands back the constant from LANGS, never the input string
  // The landing page exists once per language: / (English), /ru/, /uk/, /de/. The build sets data-root="../" on the language folders.
  const ROOT = document.documentElement.dataset.root || '';
  const STATIC_LANG = document.documentElement.dataset.staticLang || '';
  const ROUTED = !!STATIC_LANG || document.documentElement.hasAttribute('data-lang-routes');
  function pick(){
    if(canon(STATIC_LANG)) return canon(STATIC_LANG);
    const q = new URLSearchParams(location.search).get('lang');
    let s = null; try{ s = localStorage.getItem('hudini.lang'); }catch{}
    for(const c of [q, s, (navigator.language || '').slice(0, 2).toLowerCase()]){ const k = canon(c); if(k) return k; }
    return 'en';
  }
  let lang = pick();
  const REL = 'https://github.com/niko-ua-designer/hudini/releases/latest';
  const OSES = [['windows', 'Windows'], ['linux', 'Linux'], ['macos', 'macOS']];
  function detectOs(){
    const u = (navigator.userAgentData?.platform || navigator.platform || '') + ' ' + (navigator.userAgent || '');
    if(/android|iphone|ipad/i.test(u)) return 'windows';   // phones cannot run it; show the default
    if(/mac/i.test(u)) return 'macos';
    if(/linux|x11|cros/i.test(u)) return 'linux';
    return 'windows';
  }
  const myOs = detectOs();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Animations are off for reduced motion and for automated test browsers (enter.js sets html.no-anim; a test can set window.__forceAnim to look at them)
  const still = () => reduced || document.documentElement.classList.contains('no-anim');
  const go = u => { if(window.HudiniGo) window.HudiniGo(u); else location.href = u; };   // page change with the site transition (defined at the end of this file)

  // Line icons (24×24, stroke = currentColor).
  const P = {
    text:'<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    poll:'<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2h5M19 5l1.5 1.5"/>',
    count:'<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    sticker:'<path d="M15.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7.5L21 13.5V6a3 3 0 0 0-3-3z"/><path d="M13 21v-5a3 3 0 0 1 3-3h5M8.5 10h.01M14.5 10h.01M8.5 14.5s1.2 1.5 3 1.5"/>',
    globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    chain:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    unchain:'<path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 19v3M19 16h3"/>',
    copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    'al-l':'<path d="M4 3v18M8 7h12M8 14h8"/>','al-c':'<path d="M12 3v18M5 7h14M7 14h10"/>','al-r':'<path d="M20 3v18M4 7h12M8 14h8"/>',
    'al-t':'<path d="M3 4h18M7 8v12M14 8v8"/>','al-m':'<path d="M3 12h18M7 5v14M14 7v10"/>','al-b':'<path d="M3 20h18M7 4v12M14 8v8"/>',
    plus:'<path d="M5 12h14M12 5v14"/>',
    film:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4"/>',
    gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    volume:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    eye:'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    cs:'<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r=".8"/>',
    hide:'<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
    chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    lock:'<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>',
    home:'<path d="M3 11 12 4l9 7M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    code:'<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    browser:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01"/>',
    pc:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    obs:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M4.2 16.5l4.8-2.8M19.8 16.5 15 13.7"/>',
    dl:'<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    // CS2 HUD icons, the same set as the overlay's HUD (core.js HUD_IC; Lucide outlines, ISC, shared/icons/LICENSE-lucide)
    heart:'<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
    shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    helmet:'<path d="M4 19c-1-7.5 3-13.5 8.5-13.5 4.7 0 8 3.7 8.5 9.5H9.5l-1.5 4z"/><path d="M21 15h1.5"/>',
    skull:'<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
    bomb:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><rect x="6.5" y="11" width="7" height="4" rx=".5"/><path d="M17 11v1"/><path d="M17 15v1"/><path d="M7 8V5.5a1.5 1.5 0 0 1 1.5-1.5H11"/>',
    kit:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    hs:'<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
    he:'<path d="M6.5 14a5.5 5.5 0 0 1 11 0v2.5a5.5 5.5 0 0 1-11 0z"/><path d="M9.5 8.5V6h5v2.5"/><path d="M14.5 6.5 18 10"/><circle cx="8" cy="4" r="1.6"/>',
    flash:'<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
    smoke:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    molly:'<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  };
  const ic = (k, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`;

  // Landing texts live in site-texts.js (trusted HTML written by us, never user input).
  const T = window.HUDINI_SITE_T;

  // ---------- "How do we connect?": pick what you already have, get the steps ----------
  let picked = 'easy';
  // Where to get each tool (opens in a new tab); the router/port way needs no download
  const TOOLS = { radmin:'https://www.radmin-vpn.com/', tailscale:'https://tailscale.com/', zerotier:'https://www.zerotier.com/', porthole:'https://store.steampowered.com/app/4963920/Porthole_Local_Port_Sharing/' };
  function chooser(el){
    const g = window.HUDINI_CONNECT?.[lang] || window.HUDINI_CONNECT?.en; if(!g) return;
    const get = id => TOOLS[id] ? `<div class="dl-tools"><a class="btn primary dl-tool" href="${TOOLS[id]}" target="_blank" rel="noopener noreferrer"><span>${(g.get || window.HUDINI_CONNECT.en.get)[id]}</span><span aria-hidden="true">\u2197\uFE0E</span></a></div>` : '';
    const ids = picked === 'easy' ? ['radmin', 'porthole'] : [picked];
    const list = a => `<ol>${a.map(x => `<li>${x}</li>`).join('')}</ol>`;
    const answer = id => { const m = g.methods[id]; return `<div class="answer">
        <div class="ahead"><h3>${m.name}</h3><span class="atag">${m.tag}</span>${picked === 'easy' ? `<span class="rec">${g.recommend}</span>` : ''}</div>
        <p class="when">${m.when}</p>
        ${get(id)}
        <div class="two"><div class="role s"><h4>${g.secS}</h4>${list(m.s)}</div><div class="role m"><h4>${g.secM}</h4>${list(m.m)}</div></div>
        ${m.warn ? `<p class="fw warn">${m.warn}</p>` : ''}
        <div class="notes"><div class="note ok"><b>${g.secCheck}</b><p>${g.check}</p></div><div class="note"><b>${g.secFix}</b>${list(m.fix)}</div></div>
      </div>`; };
    el.innerHTML = `<p class="q">${g.q}</p>
      <div class="chips" role="radiogroup" aria-label="${g.q}">${Object.keys(g.pick).map(k => `<button type="button" role="radio" aria-checked="${k === picked}" data-pick="${k}" class="${k === picked ? 'on' : ''}">${g.pick[k]}</button>`).join('')}</div>
      <div class="answers">${ids.map(answer).join('')}</div>
      <p class="fw">${g.firewall}</p>`;
    el.onclick = e => { const b = e.target.closest('[data-pick]'); if(!b) return; picked = b.dataset.pick; chooser(el); el.querySelector(`[data-pick="${picked}"]`)?.focus(); };
  }

  function card(c){ return `<div class="card"><div class="ic">${ic(c[0])}</div><h3>${c[1]}</h3><p>${c[2]}</p></div>`; }
  function landing(t){
    for(const el of document.querySelectorAll('[data-t-aria]')) el.setAttribute('aria-label', t[el.dataset.tAria] || '');
    for(const el of document.querySelectorAll('[data-cards]')) el.innerHTML = el.dataset.cards.split(',').map(k => card(t[k])).join('');
    const osName = OSES.find(o => o[0] === myOs)[1];
    for(const a of document.querySelectorAll('a[data-dl]')) a.href = REL;
    for(const a of document.querySelectorAll('a[data-os-label]')) a.innerHTML = ic('dl') + `<span class="dl-l">${t.dlFor.replace('{os}', osName)}</span><span class="dl-s">${t.dlShort}</span>`;
    for(const el of document.querySelectorAll('[data-t-alt]')) el.setAttribute('alt', t[el.dataset.tAlt] || '');
    for(const el of document.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', t[el.dataset.tLabel] || '');
    if(reduced) for(const v of document.querySelectorAll('video.sh-vid')){ v.removeAttribute('autoplay'); v.pause(); }   // reduced motion: the poster stays
    for(const a of document.querySelectorAll('a[data-sums]')) a.href = REL;
    const other = document.getElementById('otherOs');
    if(other) other.innerHTML = OSES.filter(o => o[0] !== myOs).map(o => `<a href="${REL}" data-os="${o[0]}" target="_blank" rel="noopener">${o[1]}</a>`).join(' · ');
    for(const a of document.querySelectorAll('a[data-help]')) a.href = ROOT + 'help.html?lang=' + encodeURIComponent(lang);
    for(const a of document.querySelectorAll('a[data-rep]')) a.href = ROOT + 'report.html?lang=' + encodeURIComponent(lang);
    for(const [id, key] of [['sSteps', 'sSteps'], ['mSteps', 'mSteps']]){ const ol = document.getElementById(id); if(ol) ol.innerHTML = t[key].map(x => `<li>${x}</li>`).join(''); }
    const list = document.getElementById('csList');
    if(list) list.innerHTML = t.csList.map(s => `<li>${ic('check')}<span>${s}</span></li>`).join('');
  }
  function landingOnce(){
    // sections fade in as they scroll into view
    const els = document.querySelectorAll('.reveal');
    if(reduced || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('in'));
    else{
      const io = new IntersectionObserver(es => { for(const e of es) if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold:0 });
      els.forEach(e => io.observe(e));
    }
    // feature cards: glow follows the pointer
    document.addEventListener('pointermove', e => {
      const c = e.target.closest?.('.glow .card'); if(!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive:true });
  }

  function helpPage(){
    const H = window.HUDINI_HELP?.[lang] || window.HUDINI_HELP?.en; if(!H) return;
    document.title = 'Hudini · ' + H.title;
    const toc = document.getElementById('toc'), art = document.getElementById('content'), q = document.getElementById('q');
    q.placeholder = H.search;
    toc.replaceChildren(); art.replaceChildren();
    for(const [id, title, html] of H.sections){
      const a = document.createElement('a'); a.href = '#' + id; a.textContent = title; a.dataset.id = id; toc.appendChild(a);
      const s = document.createElement('section'); s.id = id;
      const h = document.createElement('h2'); h.textContent = title; s.appendChild(h);
      const body = document.createElement('div'); body.innerHTML = html; s.appendChild(body);   // trusted text from help-content.js
      art.appendChild(s);
    }
    const none = document.createElement('p'); none.textContent = H.empty; none.hidden = true; none.className = 'empty'; art.appendChild(none);
    q.oninput = () => {
      const w = q.value.trim().toLowerCase(); let shown = 0;
      for(const s of art.querySelectorAll('section')){ const ok = !w || s.textContent.toLowerCase().includes(w); s.hidden = !ok; toc.querySelector(`[data-id="${s.id}"]`).hidden = !ok; if(ok) shown++; }
      none.hidden = shown > 0;
    };
    const io = new IntersectionObserver(es => { for(const e of es) if(e.isIntersecting) toc.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.id === e.target.id)); }, { rootMargin:'-30% 0px -60% 0px' });
    art.querySelectorAll('section').forEach(s => io.observe(s));
    if(location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  function render(){
    document.documentElement.lang = lang;
    const t = T[lang] || T.en;
    const slots = new Map();   // text key -> elements; the HTML itself always comes from the text table below, never from the page
    for(const el of document.querySelectorAll('[data-t]')){ const k = el.dataset.t; if(!slots.has(k)) slots.set(k, []); slots.get(k).push(el); }
    const VER = document.documentElement.dataset.ver || '';   // the build writes the program version into <html data-ver>
    for(const [k, v] of Object.entries(t)) if(typeof v === 'string') for(const el of slots.get(k) || []) el.innerHTML = v.replace(/\{ver\}/g, VER);
    if(document.body.dataset.page === 'help') helpPage(); else landing(t);
  }
  function setLang(code){
    const l = canon(code); if(!l) return;
    try{ localStorage.setItem('hudini.lang', l); }catch{}
    if(ROUTED && document.body.dataset.page === 'home'){ go(ROOT + (l === 'en' ? '?lang=en' : l + '/') + location.hash); return; }
    lang = l;
    const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u);
    const m = document.querySelector('main') || document.querySelector('.help');
    if(!m || still() || !m.animate){ render(); return; }
    // the text changes under a short fade: the old text fades out, the new one slides in
    m.animate({ opacity:[1, 0] }, { duration:110, easing:'ease-in', fill:'forwards' }).finished
      .then(() => { render(); const a = m.animate([{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'none' }], { duration:220, easing:'ease-out' }); a.finished.finally(() => { m.getAnimations().forEach(x => x.cancel()); }); })
      .catch(render);
  }
  for(const s of document.querySelectorAll('select.lang')){
    for(const [c, n] of LANGS){ const o = document.createElement('option'); o.value = c; o.textContent = n; o.selected = c === lang; s.appendChild(o); }
    s.onchange = () => setLang(s.value);
  }
  document.addEventListener('click', e => {   // the crawlable language links in the footer also remember the choice
    const a = e.target.closest?.('.langlinks a'); if(a) try{ localStorage.setItem('hudini.lang', a.getAttribute('hreflang')); }catch{}
  });
  // Closing a dialog: a short fade (class .out), then the element goes away
  function fadeOut(back){
    if(still() || back.classList.contains('out')){ back.remove(); return; }
    back.classList.add('out');
    let done = false; const end = () => { if(!done){ done = true; back.remove(); } };
    back.addEventListener('transitionend', e => { if(e.target === back) end(); }); setTimeout(end, 260);
  }
  // A download click opens a two-step mini guide: what else is needed (a way to connect the PCs), then the release page with the right file marked
  function dlGuide(os, opener){
    if(document.querySelector('.lo-back')) return;
    const t = T[lang] || T.en, back = document.createElement('div'); back.className = 'lo-back';
    const box = document.createElement('div'); box.className = 'lo-box dl-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'dlTitle');
    const osName = (OSES.find(o => o[0] === os) || OSES[0])[1];
    const from = opener || document.activeElement;
    picked = 'easy';   // the simplest way is selected each time the guide opens
    const close = () => { document.removeEventListener('keydown', onKey); fadeOut(back); if(from && from.focus && from.isConnected) setTimeout(() => from.focus(), 0); };
    const focusables = () => [...box.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
    const onKey = e => {
      if(e.key === 'Escape'){ close(); return; }
      if(e.key !== 'Tab') return;
      const f = focusables(); if(!f.length) return;   // keep Tab inside the window
      const i = f.indexOf(document.activeElement);
      if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && (i === f.length - 1 || i < 0)){ e.preventDefault(); f[0].focus(); }
    };
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; };
    const btn = (label, cls, fn) => { const b = el('button', 'lo-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.onclick = fn; return b; };
    function show(step){
      if(box.childElementCount && !still()){   // step 1 -> 2: the old content fades out, the new one fades in
        box.classList.add('swap');
        setTimeout(() => { draw(step); box.classList.remove('swap'); box.querySelector('.lo-btn.main')?.focus(); }, 110);
      } else draw(step);
    }
    function draw(step){
      box.replaceChildren();
      const head = el('div', 'dl-head'), body = el('div', 'dl-body'), foot = el('div', 'dl-foot');
      const dots = el('div', 'dl-dots'); for(let i = 0; i < 2; i++) dots.appendChild(el('i', i === step ? 'on' : ''));
      const x = el('button', 'dl-x', '\u2715'); x.type = 'button'; x.setAttribute('aria-label', t.dlClose || 'Close'); x.onclick = close;
      const title = el('h2', 'lo-title', step === 0 ? t.dlG1T : t.dlG2T); title.id = 'dlTitle';
      head.append(dots, title, x);
      if(step === 0){
        const ch = el('div', 'chooser dl-chooser');
        body.append(el('p', 'dl-p', t.dlG1P), ch); chooser(ch);
        foot.append(btn(t.dlGNext, 'main', () => show(1)));
      } else {
        const p = el('p', 'dl-p'); p.innerHTML = t.dlG2P.replace('{os}', osName); body.append(p);
        const img = el('img', 'dl-img'); img.src = ROOT + 'img/assets-' + os + '.webp'; img.width = 760; img.height = 430; img.alt = ''; body.append(img);
        const open = el('a', 'lo-btn main dl-open', t.dlGOpen); open.href = REL; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.onclick = () => setTimeout(close, 300);
        foot.append(btn(t.dlGBack, '', () => show(0)), open);
      }
      box.append(head, body, foot);
    }
    back.addEventListener('click', e => { if(e.target === back) close(); }); document.addEventListener('keydown', onKey);
    show(0); back.appendChild(box); document.body.appendChild(back); box.querySelector('.lo-btn.main')?.focus();
  }
  // Every link to #connect on the landing page opens this guide on its first step (a link from another page lands here and opens it by the address)
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[href*="#connect"]');
    if(!a || document.body.dataset.page !== 'home' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let u; try{ u = new URL(a.href, location.href); }catch{ return; }
    if(u.hash !== '#connect' || u.origin !== location.origin || u.pathname !== location.pathname) return;
    e.preventDefault(); dlGuide(myOs, a);
  });
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[data-dl], #otherOs a'); if(!a || document.body.dataset.page === 'help') return;
    e.preventDefault(); dlGuide(a.dataset.os || myOs, a);
  });
  // First visit on the landing page: offer the languages at once (the browser language first). Any choice, or closing the offer, is remembered.
  function langOffer(){
    if(document.body.dataset.page !== 'home' || document.querySelector('.lo-back')) return;
    let saved = null; try{ saved = localStorage.getItem('hudini.lang'); }catch{}
    if(saved || new URLSearchParams(location.search).get('lang')) return;
    const mine = canon((navigator.language || '').slice(0, 2).toLowerCase()) || 'en';
    const TITLE = { en:'Choose your language', ru:'Выберите язык', uk:'Оберіть мову', de:'Sprache wählen' };
    const order = [mine, ...LANGS.map(l => l[0]).filter(c => c !== mine)];
    const back = document.createElement('div'); back.className = 'lo-back';
    const box = document.createElement('div'); box.className = 'lo-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', TITLE[mine]);
    const h = document.createElement('div'); h.className = 'lo-title'; h.textContent = TITLE[mine];
    box.appendChild(h);
    const close = keep => {
      try{ localStorage.setItem('hudini.lang', keep || lang); }catch{}
      fadeOut(back); document.removeEventListener('keydown', onKey);
    };
    const onKey = e => { if(e.key === 'Escape') close(); };
    for(const c of order){
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lo-btn' + (c === mine ? ' main' : '');
      b.textContent = LANGS.find(l => l[0] === c)[1];
      b.onclick = () => { if(c === lang){ close(c); } else setLang(c); };
      box.appendChild(b);
    }
    back.appendChild(box);
    back.addEventListener('click', e => { if(e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    box.querySelector('.lo-btn')?.focus();
  }
  render();
  if(document.body.dataset.page !== 'help') landingOnce();
  if(document.body.dataset.page === 'home' && location.hash === '#connect') dlGuide(myOs);   // an address with #connect opens the guide
  langOffer();
})();

// Page transitions. Leaving for another page of the site: the letters of the visible headings drop a little and fade (left to right),
// the other blocks fade out with a small shift down; then the next page opens (enter.js sets html.enter from a flag in sessionStorage):
// its blocks fade in and rise a little, and the letters of the headings settle from above. Only transform and opacity are animated.
// Off for: reduced motion, automated browsers (navigator.webdriver), modifier/middle clicks, target=_blank, anchors on the same page,
// other sites, downloads (a[data-dl]). Weak devices (fewer than 4 cores, Save-Data) get a plain fade without letters.
// Any failure falls back to a normal link. To switch it off for one link: data-no-transition.
(() => {
  'use strict';
  const d = document.documentElement;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || d.classList.contains('no-anim');
  const weak = () => (navigator.hardwareConcurrency || 8) < 4 || !!navigator.connection?.saveData;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const HEAD = 'h1,h2,h3';
  const PICK = '.pill,.sub,.cta,.free,.card,.tile,.role,.note,.answer,.rp-card,.rp-tg,.mig-steps>li,.sh-shot,.help aside,.help article>section,.chips,.band,.legend>*,.mig-foot';
  const seg = window.Intl?.Segmenter ? new Intl.Segmenter(undefined, { granularity:'grapheme' }) : null;
  const glyphs = t => seg ? [...seg.segment(t)].map(x => x.segment) : Array.from(t);
  let busy = false, undo = [];

  const visible = (el, vh, vw) => {
    if(el.closest('.top,footer,.lo-back') || el.hidden) return false;
    const r = el.getBoundingClientRect();
    if(r.width < 20 || r.height < 12 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
    const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > .05;
  };
  const clips = el => { const c = getComputedStyle(el); return (c.backgroundClip || c.webkitBackgroundClip) === 'text' || c.webkitBackgroundClip === 'text'; };
  // text of a heading -> letters (words stay unbreakable); parts painted through background-clip:text (the gradient words) stay whole
  function split(h){
    const saved = h.innerHTML, letters = [], units = [];
    if(clips(h)) return { saved, letters, units:[h] };
    const walk = node => {
      for(const n of [...node.childNodes]){
        if(n.nodeType === 3){
          const frag = document.createDocumentFragment();
          for(const part of n.nodeValue.split(/(\s+)/)){
            if(!part) continue;
            if(/^\s+$/.test(part)){ frag.append(part); continue; }
            const w = document.createElement('hud-w'); w.style.cssText = 'display:inline-block;white-space:nowrap'; w.setAttribute('aria-hidden', 'true');
            for(const g of glyphs(part)){ const s = document.createElement('hud-l'); s.style.display = 'inline-block'; s.textContent = g; w.append(s); letters.push(s); }
            frag.append(w);
          }
          n.replaceWith(frag);
        } else if(n.nodeType === 1){ if(clips(n)) units.push(n); else walk(n); }
      }
    };
    const label = h.textContent.trim();
    walk(h); h.setAttribute('aria-label', label);
    return { saved, letters, units, label };
  }
  const unsplit = (h, sp) => { h.innerHTML = sp.saved; h.removeAttribute('aria-label'); };
  const step = n => Math.min(11, 120 / Math.max(n, 1));

  function cleanup(){
    for(const f of undo) try{ f(); }catch{}
    undo = [];
    for(const el of document.querySelectorAll('[data-leaving]')){ el.getAnimations().forEach(a => a.cancel()); el.removeAttribute('data-leaving'); }
    d.classList.remove('leaving'); busy = false;
  }

  function leave(){
    const vh = innerHeight, vw = innerWidth;
    if(weak() || !Element.prototype.animate){
      const a = document.body.animate({ opacity:[1, 0] }, { duration:200, easing:'ease-in', fill:'forwards' });
      undo.push(() => a.cancel());
      return Promise.race([a.finished, new Promise(r => setTimeout(r, 320))]);
    }
    const anims = [], heads = [...document.querySelectorAll(HEAD)].filter(h => visible(h, vh, vw)).slice(0, 8);
    const blocks = [];
    for(const el of document.querySelectorAll(PICK)){
      if(!visible(el, vh, vw) || blocks.some(b => b.contains(el) || el.contains(b))) continue;
      blocks.push(el);
    }
    blocks.slice(0, 14).forEach((el, i) => {
      el.setAttribute('data-leaving', '');
      anims.push(el.animate([{ opacity:1, transform:'none' }, { opacity:0, transform:`translateY(${rnd(8, 12).toFixed(1)}px)` }], { duration:rnd(220, 300), delay:Math.min(i * 15, 90), easing:'ease-in', fill:'forwards' }));
    });
    for(const h of heads){
      const sp = split(h); undo.push(() => unsplit(h, sp));
      const all = [...sp.letters, ...sp.units], k = step(all.length);
      all.forEach((l, i) => anims.push(l.animate([{ opacity:1, transform:'none' }, { opacity:0, transform:`translateY(${rnd(14, 24).toFixed(1)}px)` }], { duration:rnd(280, 300), delay:i * k, easing:'ease-in', fill:'forwards' })));
    }
    return Promise.race([Promise.all(anims.map(a => a.finished)), new Promise(r => setTimeout(r, 560))]);
  }

  window.HudiniGo = url => {
    if(busy) return;
    if(still()){ location.href = url; return; }
    busy = true;
    let p; try{ p = leave(); }catch{ p = Promise.resolve(); }
    Promise.resolve(p).catch(() => {}).then(() => { try{ sessionStorage.setItem('hudini.tr', String(Date.now())); }catch{} location.href = url; });
  };
  addEventListener('pageshow', e => { if(e.persisted) cleanup(); });   // back button: the page comes back from the cache whole

  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[href]');
    if(!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if((a.target && a.target !== '_self') || a.hasAttribute('download') || a.matches('a[data-dl], #otherOs a, [data-no-transition]')) return;
    let u; try{ u = new URL(a.href, location.href); }catch{ return; }
    if(u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
    if(u.pathname === location.pathname && u.search === location.search) return;   // an anchor on this page
    if(still()) return;
    e.preventDefault(); window.HudiniGo(u.href);
  });

  // The page was opened through a transition: the headings are held back by CSS (html.enter) until their letters are ready, then the letters settle from above
  function land(){
    const vh = innerHeight, vw = innerWidth, heads = [...document.querySelectorAll(HEAD)];
    const play = heads.filter(h => visible(h, vh, vw) && !weak()).slice(0, 8);
    for(const h of heads){
      if(!play.includes(h)){ h.classList.add('lt'); continue; }
      const sp = split(h), all = [...sp.letters, ...sp.units], k = Math.min(11, 110 / Math.max(all.length, 1));
      for(const l of all) l.style.opacity = '0';
      h.classList.add('lt');
      let left = all.length;
      all.forEach((l, i) => {
        const a = l.animate([{ opacity:0, transform:`translateY(-${rnd(12, 16).toFixed(1)}px)` }, { opacity:1, transform:'none' }], { duration:rnd(330, 400), delay:i * k, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards' });
        l.style.opacity = '';
        a.finished.catch(() => {}).then(() => { if(--left === 0 && h.isConnected) unsplit(h, sp); });
      });
    }
  }
  if(d.classList.contains('enter')){
    const run = () => { try{ land(); }catch{ for(const h of document.querySelectorAll(HEAD)) h.classList.add('lt'); } };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  }

  // Steps of the report wizard (report.js): the old step fades out with a small drop, the new one fades in and slides up. The change itself is applied at once.
  window.HudiniSwap = (el, change) => {
    if(still() || !el || !el.animate){ change(); return; }
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    Object.assign(ghost.style, { position:'fixed', left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', margin:'0', pointerEvents:'none', zIndex:'5' });
    el.after(ghost);
    change();
    ghost.animate([{ opacity:1, transform:'none' }, { opacity:0, transform:'translateY(8px)' }], { duration:160, easing:'ease-in', fill:'forwards' });
    setTimeout(() => ghost.remove(), 200);
    el.animate([{ opacity:0, transform:'translateY(10px)' }, { opacity:1, transform:'none' }], { duration:200, delay:40, easing:'ease-out', fill:'backwards' });
  };
})();
