// Hudini website: language picker, landing page texts, the live hero demo and the help page.
// The chosen language is shared with the panel (localStorage "hudini.lang").
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const LANGS = [['en', 'English'], ['ru', 'Русский'], ['uk', 'Українська'], ['de', 'Deutsch']];
  const has = c => LANGS.some(l => l[0] === c);
  function pick(){
    const q = new URLSearchParams(location.search).get('lang');
    let s = null; try{ s = localStorage.getItem('hudini.lang'); }catch{}
    for(const c of [q, s, (navigator.language || '').slice(0, 2).toLowerCase()]) if(has(c)) return c;
    return 'en';
  }
  let lang = pick();
  // Release page for now; phase 8 points these at the Hudini-<os>-<version>.zip assets and SHA256SUMS.txt.
  const REL = 'https://github.com/niko-ua-designer/hudini/releases';
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

  // ---------- pausable clocks: a demo only advances while it is on screen and the tab is visible ----------
  const clocks = new Set();
  const seen = new IntersectionObserver(es => { for(const e of es) if(e.target._clk) e.target._clk.vis = e.isIntersecting; }, { threshold:0.08 });
  function makeClock(el){
    el._clk?.kill();
    const c = { el, t:0, vis:false, on:false, waits:[], ticks:new Set() };
    c.wait = ms => new Promise(res => c.waits.push({ at:c.t + ms, res }));
    c.kill = () => { clocks.delete(c); c.waits = []; c.ticks.clear(); seen.unobserve(el); if(el._clk === c) el._clk = null; };
    el._clk = c; clocks.add(c); seen.observe(el);
    return c;
  }
  let lastFrame = 0;
  function frame(now){
    const dt = lastFrame ? Math.min(now - lastFrame, 80) : 0; lastFrame = now;
    for(const c of clocks){
      const on = c.vis && !document.hidden;
      if(on !== c.on){ c.on = on; c.el.classList.toggle('paused', !on); }
      if(!on) continue;
      c.t += dt;
      for(const f of c.ticks) f(dt);
      if(c.waits.length){ const due = c.waits.filter(w => w.at <= c.t); if(due.length){ c.waits = c.waits.filter(w => w.at > c.t); due.forEach(w => w.res()); } }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ---------- CS2 HUD scene (self-contained: data, markup, animation; styles under "CS2 HUD" in site.css) ----------
  // player: [nick, hp, kills, deaths, money, weapon, grenades, armor]
  const CS = {
    ct:{ name:'NAVI', logo:'N', score:9, players:[
      ['kyro', 100, 21, 12, 4750, 'AK-47', ['he', 'flash', 'smoke'], 'helmet'],
      ['frost', 100, 14, 13, 3200, 'AWP', ['flash'], 'shield'],
      ['nexa', 84, 11, 15, 2900, 'M4A1-S', ['smoke', 'molly'], 'helmet'],
      ['bolt', 100, 9, 14, 4100, 'M4A4', ['kit', 'he'], 'helmet'],
      ['vexx', 62, 12, 13, 1850, 'Deagle', ['flash'], 'shield']] },
    t:{ name:'Vitality', logo:'V', score:7, players:[
      ['zayn', 100, 18, 14, 5200, 'AWP', ['smoke'], 'helmet'],
      ['rook', 100, 13, 16, 2400, 'AK-47', ['molly', 'flash'], 'helmet'],
      ['mako', 100, 10, 15, 3650, 'AK-47', ['smoke', 'he'], 'shield'],
      ['juno', 100, 15, 13, 4300, 'Galil AR', ['he', 'flash'], 'helmet'],
      ['drift', 100, 8, 16, 1500, 'Tec-9', [], 'shield']] },
    round:17, bomb:38,
    // kyro (observed, CT) takes the whole T side: ACE
    kills:[['rook', 'AK-47', 1], ['mako', 'AK-47', 0], ['juno', 'AK-47', 1], ['drift', 'AK-47', 0], ['zayn', 'AK-47', 1]],
  };
  const initials = n => n.slice(0, 2).toUpperCase();
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const money = v => '$' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const hpColor = hp => hp > 50 ? '#3ddc84' : hp > 25 ? '#f5a623' : '#ff4d5e';
  function csScore(t, mid){
    return `<div class="cs-score gl">
      <div class="cs-team cs-ct"><span class="cs-logo">${CS.ct.logo}</span>${CS.ct.name}</div>
      <div class="cs-sc cs-ct" data-sc="ct">${CS.ct.score}</div>
      <div class="cs-mid"><small>${t.dRound} ${CS.round}</small>${mid}</div>
      <div class="cs-sc cs-t" data-sc="t">${CS.t.score}</div>
      <div class="cs-team cs-t"><span class="cs-logo">${CS.t.logo}</span>${CS.t.name}</div></div>`;
  }
  function csCard(side, p, i){
    const [nick, hp, k, d, m, w, nades, arm] = p, slot = side === 'ct' ? i + 1 : (i + 6) % 10;
    return `<div class="cs-p gl cs-${side}${side === 'ct' && i === 0 ? ' obs' : ''}" data-p="${side}${i}" style="transition-delay:${(side === 'ct' ? i : 4 - i) * 45 + 150}ms">
      <div class="r1"><span class="cs-av">${initials(nick)}</span><b class="cs-hp">${hp}</b><span class="cs-arm">${ic(arm)}</span></div>
      <div class="cs-bar"><i style="width:${hp}%;background:${hpColor(hp)}"></i></div>
      <div class="cs-nick"><i>${slot}</i>${nick}</div>
      <div class="r3"><span class="kd">${k}/${d}</span><span class="m">${money(m)}</span></div>
      <div class="r4"><span class="wp">${w}</span><span class="nd">${nades.map(n => ic(n, n)).join('')}</span></div></div>`;
  }
  function csHTML(t){
    const o = CS.ct.players[0];
    return `<div class="cs-flash"></div>
    <div class="cs-top">${csScore(t, `<span class="cs-bomb">${ic('bomb')}<b>${mmss(CS.bomb)}</b></span>`)}<div class="cs-series gl">${t.dSeries}</div></div>
    <div class="cs-feed"></div>
    <div class="cs-ace"><b>ACE!</b><small class="gl">${o[0]} · ${t.dKills}</small></div>
    <div class="cs-bot">
      <div class="cs-side">${CS.ct.players.map((p, i) => csCard('ct', p, i)).join('')}</div>
      <div class="cs-obs gl cs-ct">
        <span class="cs-av">${initials(o[0])}</span>
        <div class="mid"><div class="nm">${o[0]}</div>
          <div class="bars"><b class="hpn">${o[1]}</b><div class="cs-bar"><i></i></div><span class="ar">${ic('shield')}100</span></div>
          <div class="stats"><i>K</i><b class="ok">${o[2]}</b><i>D</i><b>${o[3]}</b><i>A</i><b>4</b><i>ADR</i><b>118</b><i>HS</i><b>54%</b></div></div>
        <div class="rt"><span class="m">${money(o[4])}</span><span>${o[5]}</span><span class="ammo">30/90</span></div>
      </div>
      <div class="cs-side">${CS.t.players.map((p, i) => csCard('t', p, i)).join('')}</div>
    </div>`;
  }
  // Plays the HUD inside `root` (a .cs element) on the demo clock. Returns when the ACE is over.
  async function csScene(root, t, clk){
    const wait = clk.wait, alive = () => root.isConnected && root.classList.contains('on');
    root.innerHTML = csHTML(t);
    void root.offsetWidth; root.classList.add('on');
    const q = s => root.querySelector(s);
    let bomb = CS.bomb;
    (async () => { while(true){ await wait(1000); if(!alive()) return; bomb = Math.max(0, bomb - 1); q('.cs-bomb b').textContent = mmss(bomb); } })();
    const me = CS.ct.players[0];
    let ammo = 30, kills = me[2];
    const card = id => q(`[data-p="${id}"]`);
    function setHp(id, hp){
      const c = card(id), b = c.querySelector('.cs-hp'), bar = c.querySelector('.cs-bar i');
      bar.style.width = hp + '%'; bar.style.background = hpColor(hp);
      if(hp === 0){ c.classList.add('dead'); b.innerHTML = ic('skull'); c.querySelector('.r4').innerHTML = ''; c.querySelector('.cs-arm').innerHTML = ''; }
      else{ b.textContent = hp; b.classList.toggle('low', hp <= 25); restart(c, 'hit'); }
    }
    const feed = q('.cs-feed');
    const shoot = n => { ammo = Math.max(0, ammo - n); q('.ammo').textContent = `${ammo}/90`; };
    await wait(1300);
    // a hit on juno: floating damage number, HP bar drops
    shoot(3);
    const j = card('t3'), dmg = document.createElement('div'); dmg.className = 'cs-dmg'; dmg.textContent = '-27'; j.appendChild(dmg);
    setHp('t3', 73);
    await wait(900);
    for(const [victim, weapon, hs] of CS.kills){
      shoot(hs ? 2 : 4);
      const row = document.createElement('div'); row.className = 'cs-k gl cs-ct'; row.style.setProperty('--c', 'var(--ct)');
      row.innerHTML = `<span class="a cs-ct">${me[0]}</span><span class="w">${weapon}</span>${hs ? `<span class="hs">${ic('hs')}</span>` : ''}<span class="b cs-t">${victim}</span>`;
      feed.appendChild(row);
      const rows = [...feed.querySelectorAll('.cs-k:not(.out)')];
      if(rows.length > 3){ const r0 = rows[0]; r0.classList.add('out'); wait(340).then(() => r0.remove()); }
      setHp('t' + CS.t.players.findIndex(p => p[0] === victim), 0);
      kills++;
      q('.cs-obs .ok').textContent = kills;
      card('ct0').querySelector('.kd').textContent = `${kills}/${me[3]}`;
      await wait(620);
    }
    q('.cs-ace').classList.add('on'); q('.cs-flash').classList.add('on');
    await wait(900);
    const sc = q('[data-sc="ct"]'); sc.textContent = CS.ct.score + 1; restart(sc, 'bump');
    await wait(1900);
  }

  // ---------- hero demo: panel on the left, stream on the right ----------
  const CURSOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5 19 13.6l-6.6 1.1 3.9 6.9-2.9 1.5-3.8-7L4.4 20z" fill="#fff" stroke="#14131c" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  function heroDemo(el, t){
    const D = t.dm, strip = document.getElementById('fnStrip');
    const SC = ['text', 'img', 'web', 'xform', 'group', 'poll', 'timer', 'kase', 'auto', 'cs'];
    const TILES = [['timer', 'timer'], ['count', 'count'], ['poll', 'poll'], ['cs', 'cs'], ['kase', 'box', 'wide']];
    const TABS = ['plus', 'film', 'chat', 'bolt', 'gift', 'volume', 'gear'];
    const LIC = { text:'text', poll:'poll', timer:'timer', count:'count', kase:'box', sticker:'sticker', cs:'cs', img:'image', gif:'image', web:'globe', group:'chain', txt:'text' };
    const FIELDS = {
      text:[[D.f.text, t.dMsg]], poll:[[D.f.question, t.dPollQ], [D.f.options, 'Mirage · Inferno · Nuke']], timer:[[D.f.time, '05:00'], [D.f.label, t.dBreak]],
      count:[[D.f.label, t.dDeaths]], kase:[[D.f.kind, D.caseKind], [D.f.who, 'nightowl']], sticker:[[D.f.text, 'POG!']], cs:[[D.f.view, D.csView]],
      web:[[D.f.url, 'stats.example/top']], txt:[[D.f.text, 'WOW!']],
    };
    const BASE = { img:{ w:28, ar:0.625 }, gif:{ w:15, ar:1 } };   // default size and aspect, for the "size" and "stretch" readouts
    const RC = ['#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#e4ae39'];   // case rarity colors, same order as the panel
    const reelCards = Array.from({ length:30 }, (_, i) => i === 24 ? 4 : [0, 0, 1, 0, 2, 0, 1, 3, 0, 1][(i * 7) % 10]);
    const AL = ['al-l', 'al-c', 'al-r', 'al-t', 'al-m', 'al-b'];
    const rows = [['nightowl', 100, '1 200'], ['pixelkat', 72, '860'], ['b0rsch', 45, '540']];
    el.innerHTML = `
    <div class="dv-top">
      <span class="dv-logo"><img src="shared/icons/icon-192.png" alt="">Hudini</span>
      <span class="dv-cap"><span class="sig"><i></i><i></i><i></i></span>${D.online} <em>24 ms</em><span class="sep"></span><b class="ok"></b>${D.obs}</span>
      <span class="sp"></span>
      <span class="dv-vol">${ic('volume')}<span class="sl"><i></i></span></span>
      <span class="dv-hb">${ic('undo')}<span>${D.undo}</span></span>
      <span class="dv-hb" data-b="hide">${ic('hide')}<span>${D.hideAll}</span></span>
    </div>
    <div class="dv-body">
      <div class="dv-rail">${TABS.map((k, i) => `<div class="tb${i === 0 ? ' on' : ''}" data-b="${i === 3 ? 'tab-auto' : 'tab-' + k}" data-tab="${i === 3 ? 'auto' : i === 0 ? 'add' : ''}">${ic(k)}<span>${D.tabs[i]}</span></div>`).join('')}</div>
      <div class="dv-pane">
        <div class="pg pg-add on">
          <h5>${D.text}</h5><div class="fk ta">${D.textPh}</div>
          <div class="pb primary" data-b="text">${ic('plus')}${D.addText}</div>
          <h5>${D.media}</h5>
          <div class="fk lnk" data-b="lnk"><span class="tx">${D.linkPh}</span></div>
          <div class="two"><div class="pb primary" data-b="link">${ic('plus')}${D.byLink}</div><div class="pb">${ic('folder')}${D.file}</div></div>
          <h5>${D.widgets}</h5>
          <div class="tiles">${TILES.map(([k, i, c]) => `<div class="tl ${c || ''}" data-b="${k}">${ic(i)}<span>${D.tiles[k]}</span></div>`).join('')}</div>
        </div>
        <div class="pg pg-auto">
          <h5>${D.scen}</h5>
          <div class="rule"><div class="r1">${D.ruleIf} <code>!pog</code></div><div class="r2">${ic('bolt')}<span>${D.ruleThen}</span></div></div>
          <div class="hit">${ic('chat')}<span>${D.ruleHit}</span></div>
        </div>
      </div>
      <div class="dv-main">
        <div class="dv-tb none"><span class="si"></span><span class="sp"></span>
          <span class="tg">${AL.map(a => `<b>${ic(a)}</b>`).join('')}</span>
          <span class="tg"><b data-b="group" class="gb">${ic('chain')}</b><b>${ic('unchain')}</b></span>
          <span class="tg"><b>${ic('eye')}</b><b>${ic('copy')}</b><b>${ic('trash')}</b></span></div>
        <div class="stbox"><div class="st">
          <div class="st-bg"></div>
          <div class="xe x-img"><img src="img/demo-photo.jpg" alt=""></div>
          <div class="xe x-gif"><img src="img/demo-party.gif" alt=""></div>
          <div class="xe x-web"><div class="wb"><div class="wbar"><i></i><i></i><i></i><span>${ic('lock')}stats.example/top</span></div>
            <div class="wbody"><h6>${D.top}</h6>${rows.map(([n, v, a], i) => `<div class="wr"><span class="wn">${i + 1} ${n}</span><span class="wbr"><i style="--v:${v}%"></i></span><span class="wv">${a}</span></div>`).join('')}</div></div></div>
          <div class="xe x-txt"><span>WOW!</span></div>
          <div class="o o-text">${t.dMsg}</div>
          <div class="o o-poll"><h4>${t.dPollQ}</h4>${['Mirage', 'Inferno', 'Nuke'].map((m, i) => `<div class="pr"><span class="k">${i + 1}</span><span>${m}</span><span class="bar"><i></i></span><span class="v"></span></div>`).join('')}<div class="pf"></div></div>
          <div class="o o-timer"><div class="lb">${t.dBreak}</div><div class="flip"><span class="fd"><span></span></span><span class="fd"><span></span></span><span class="colon">:</span><span class="fd"><span></span></span><span class="fd"><span></span></span></div></div>
          <div class="o o-count"><small>${t.dDeaths}</small><b>6</b></div>
          <div class="o o-sticker">POG!</div>
          <div class="o o-case"><div class="kc-who">${D.caseWho}</div>
            <div class="k3"><div class="beam"></div><div class="crate">
              <div class="fc f-back"></div><div class="fc f-left"></div><div class="fc f-right"></div><div class="fc f-bottom"></div>
              <div class="fc f-glow"></div>
              <div class="fc f-front">${ic('box')}<b>HUDINI</b><small>CASE</small></div>
              <div class="hinge"><div class="fc f-lid"></div></div>
            </div></div>
            <div class="rl"><div class="kc-win"><i class="kc-mark"></i><div class="kc-strip">${reelCards.map(r => `<div class="kc" style="--c:${RC[r]}">${ic('box')}<small>${D.rar[r]}</small></div>`).join('')}</div></div></div>
            <div class="kc-res" style="--c:${RC[4]}">${ic('box')}<small>${D.rar[4]}</small></div></div>
          <div class="cs"></div>
          <i class="marq"></i>
          <div class="sel"><i class="hd rot"></i><i class="hd se"></i><i class="hd e"></i><i class="hd s"></i><span class="gtag">${D.names.group}</span></div>
          <div class="tip"></div>
          <canvas class="o-conf"></canvas>
        </div></div>
      </div>
      <div class="dv-right">
        <h5>${D.layers}</h5><div class="ly-list"></div>
        <h5>${D.selected}</h5><div class="insp"></div>
      </div>
    </div>
    <div class="dv-cur hidden">${CURSOR}</div>`;
    if(strip) strip.innerHTML = `<span class="fn-t">${D.fn}</span><div class="fn-chips">${SC.map((k, i) => `<button type="button" data-i="${i}">${D.sc[k][0]}</button>`).join('')}</div><p class="fn-cap"></p>`;
    const $ = s => el.querySelector(s);
    const clk = makeClock(el), wait = clk.wait;
    const showOn = (sel, v = true) => $(sel).classList.toggle('on', v);
    const OV = ['.o-text', '.o-poll', '.o-timer', '.o-count', '.o-sticker', '.o-case'];
    let tok = 0;   // bumped whenever the played scene changes: every pending wait and tween of the old scene stops

    // time-based animation on the demo clock; rejects when the scene was cancelled
    const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const mix = (a, b, p) => a + (b - a) * p;
    function tween(ms, fn){
      const my = tok;
      return new Promise((res, rej) => {
        let a = 0;
        const f = dt => { if(my !== tok){ clk.ticks.delete(f); rej(0); return; } a += dt; const p = Math.min(1, a / ms); fn(ease(p)); if(p >= 1){ clk.ticks.delete(f); res(); } };
        clk.ticks.add(f);
      });
    }

    // ---- poll, flip clock, counter ----
    const votes = [0, 0, 0];
    function poll(){
      const total = votes.reduce((a, b) => a + b, 0), max = Math.max(...votes);
      el.querySelectorAll('.pr').forEach((r, i) => {
        const pct = total ? Math.round(votes[i] / total * 100) : 0;
        r.querySelector('.bar i').style.width = pct + '%';
        r.querySelector('.v').textContent = `${pct}% · ${votes[i]}`;
        r.classList.toggle('lead', votes[i] === max && total > 0);
      });
      $('.pf').textContent = `${t.dPollFoot} ${total}`;
    }
    const digits = [...el.querySelectorAll('.fd')];
    function clock(sec){
      const s = String(Math.floor(sec / 60)).padStart(2, '0') + String(sec % 60).padStart(2, '0');
      digits.forEach((d, i) => { const sp = d.firstChild; if(sp.textContent !== s[i]){ sp.textContent = s[i]; if(!reduced) restart(d, 'flipping'); } });
    }
    let timerTok = 0;
    function runTimer(from){
      const tk = ++timerTok; let s = from; clock(s);
      (async () => { while(true){ await wait(1000); if(tk !== timerTok) return; s = Math.max(0, s - 1); clock(s); } })();
    }
    const cnt = $('.o-count b');
    const setCount = (n, bump) => { cnt.textContent = n; if(bump) restart(cnt, 'bump'); };

    // ---- transformable elements (picture, GIF, website, text) + selection frame, like the panel's canvas ----
    const NODE = { img:$('.x-img'), gif:$('.x-gif'), web:$('.x-web'), txt:$('.x-txt') };
    const G = {};   // geometry per element in stage units: 1 = 1% of the stream width
    const sel = $('.sel'), marq = $('.marq'), tb = $('.dv-tb'), tipEl = $('.tip');
    let selK = null, grp = null;
    function paint(k){ const g = G[k], n = NODE[k]; for(const p of ['x', 'y', 'w', 'h', 'r']) n.style.setProperty('--' + p, g[p]); }
    function put(k, g){ G[k] = { ...g }; paint(k); NODE[k].classList.remove('pop'); void NODE[k].offsetWidth; NODE[k].classList.add('on', 'pop'); }
    const selGeom = () => grp ? grp.g : selK ? G[selK] : null;
    function syncSel(){
      const g = selGeom(); sel.classList.toggle('on', !!g); sel.classList.toggle('grp', !!grp);
      tb.classList.toggle('none', !g);
      if(!g) return;
      for(const p of ['x', 'y', 'w', 'h', 'r']) sel.style.setProperty('--' + p, g[p]);
    }
    const tip = s => { tipEl.textContent = s || ''; tipEl.classList.toggle('on', !!s); };
    // inspector: fields for the picked element, and live "size / stretch / rotation" sliders for pictures and groups
    const ly = $('.ly-list'), insp = $('.insp');
    const rng = (id, label) => `<div class="rg"><div class="rl2"><span>${label}</span><b data-v="${id}"></b></div><div class="rt"><i data-r="${id}"></i></div></div>`;
    const clamp01 = v => Math.max(0, Math.min(1, v));
    function setR(id, text, frac){ const v = insp.querySelector(`[data-v="${id}"]`), r = insp.querySelector(`[data-r="${id}"]`); if(v) v.textContent = text; if(r) r.style.left = clamp01(frac) * 100 + '%'; }
    function updateInsp(){
      if(grp){ setR('size', Math.round(grp.p.s * 100) + '%', grp.p.s / 2.5); setR('rot', Math.round(grp.p.rot) + '°', (grp.p.rot + 180) / 360); return; }
      if(!selK || !BASE[selK]) return;
      const g = G[selK], b = BASE[selK], str = g.h / (g.w * b.ar) * 100;
      setR('size', Math.round(g.w / b.w * 100) + '%', g.w / b.w / 3);
      setR('str', Math.round(str) + '%', (str - 20) / 280);
      setR('rot', Math.round(g.r) + '°', (g.r + 180) / 360);
    }
    function buildInsp(k){
      const head = `<div class="in-eye">${ic('eye')}<span>${D.onStream}</span></div>${k === 'group' ? '' : `<div class="in-fl">${ic('bolt')}<span>${D.flash}</span></div>`}`;
      const title = `<div class="in-t">${ic(LIC[k])}<span>${D.names[k]}</span></div>`;
      let body;
      if(k === 'group') body = `<label>${D.f.members}</label><div class="fk">${grp.keys.length}</div>${rng('size', D.f.size)}${rng('rot', D.f.rot)}`;
      else if(BASE[k]) body = `${rng('size', D.f.size)}${rng('str', D.f.stretch)}${rng('rot', D.f.rot)}`;
      else body = FIELDS[k].map(([l, v]) => `<label>${l}</label><div class="fk">${v}</div>`).join('') + (k === 'kase' ? `<div class="pb go" data-b="open">${ic('box')}${D.openCase}</div>` : '');
      insp.innerHTML = `${head}<div class="in-box">${title}${body}</div>`;
      updateInsp();
    }
    // layers (newest on top); a group folds its items under one row
    let LY = [];
    function renderLayers(fresh){
      const mk = (k, cls, n) => `<div class="ly ${cls}${k === fresh ? ' new' : ''}"><i>${n}</i>${ic(LIC[k])}<span>${D.names[k] || ''}</span><b>${ic('eye')}</b></div>`;
      const out = []; let n = LY.length;
      if(grp) out.push(mk('group', 'cur', n + 1));
      for(const k of [...LY].reverse()){ out.push(mk(k, (grp && grp.keys.includes(k)) ? 'nest' : (k === selK && !grp ? 'cur' : ''), n--)); }
      ly.innerHTML = out.join('');
    }
    function addLayer(k, pick = true){ LY.push(k); if(pick) select(k, k); else renderLayers(k); }
    function select(k, fresh){ selK = k; grp = null; syncSel(); buildInsp(k); renderLayers(fresh); $('.si').textContent = D.names[k]; }
    // group: bounding box of the items; moving, scaling and rotating the group moves every item around the group's center
    function makeGroup(keys){
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for(const k of keys){ const g = G[k]; x0 = Math.min(x0, g.x - g.w / 2); x1 = Math.max(x1, g.x + g.w / 2); y0 = Math.min(y0, g.y - g.h / 2); y1 = Math.max(y1, g.y + g.h / 2); }
      const g0 = { x:(x0 + x1) / 2, y:(y0 + y1) / 2, w:x1 - x0, h:y1 - y0, r:0 };
      grp = { keys, g0, g:{ ...g0 }, p:{ dx:0, dy:0, s:1, rot:0 }, base:keys.map(k => ({ k, ...G[k] })) };
      selK = null; syncSel(); buildInsp('group'); renderLayers(); $('.si').textContent = D.names.group + ' · ' + keys.length;
    }
    function applyGroup(){
      const { p, g0, base } = grp, cx = g0.x + p.dx, cy = g0.y + p.dy, a = p.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      for(const b of base){ const ox = (b.x - g0.x) * p.s, oy = (b.y - g0.y) * p.s; G[b.k] = { x:cx + ox * ca - oy * sa, y:cy + ox * sa + oy * ca, w:b.w * p.s, h:b.h * p.s, r:b.r + p.rot }; paint(b.k); }
      grp.g = { x:cx, y:cy, w:g0.w * p.s, h:g0.h * p.s, r:p.rot };
      syncSel(); updateInsp();
    }
    // the pane scrolls like the real one when the cursor needs a lower button
    let shift = 0;
    function pane(sh){ shift = sh; $('.pg-add').style.transform = `translateY(${-sh}px)`; }
    async function ensureVisible(b, w){
      if(!b.closest('.pg-add')) return;
      const pr = $('.dv-pane').getBoundingClientRect(), br = b.getBoundingClientRect();
      const need = br.bottom - pr.bottom + 14;
      if(need > 0){ pane(shift + need); await w(650); }
    }
    function setTab(name){
      el.querySelectorAll('.tb').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
      el.querySelectorAll('.pg').forEach(p => p.classList.toggle('on', p.classList.contains('pg-' + name)));
    }
    // confetti on the stream canvas
    const st = $('.st'), cv = $('.o-conf'), cx = cv.getContext('2d');
    function confetti(){
      const r = st.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const W = cv.width, H = cv.height, cols = ['#7c5cff', '#ff5c9a', '#ffd166', '#4fd8ff', '#8ef0a8', '#ffffff'];
      const ps = Array.from({ length:150 }, (_, i) => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = (0.5 + Math.random() * 0.75) * H * 0.0024;
        return { x:W * (i % 2 ? 0.38 : 0.62), y:H * 0.58, vx:Math.cos(a) * v, vy:Math.sin(a) * v * 1.25, s:(3 + Math.random() * 5) * dpr * r.width / 700, r:Math.random() * 6, vr:(Math.random() - 0.5) * 0.02, c:cols[i % cols.length] };
      });
      let age = 0;
      const f = dt => {
        age += dt; cx.clearRect(0, 0, W, H);
        for(const p of ps){ p.vy += H * 0.0000045 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
          cx.save(); cx.globalAlpha = Math.max(0, 1 - age / 2600); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); }
        if(age > 2600){ clk.ticks.delete(f); cx.clearRect(0, 0, W, H); }
      };
      clk.ticks.add(f);
    }
    // cursor
    const cur = $('.dv-cur'); let cp = [0, 0];
    function point(target, dx = 0.5, dy = 0.55){
      const a = el.getBoundingClientRect(); let b = target.getBoundingClientRect();
      if(!b.width) b = st.getBoundingClientRect();   // the panel is hidden on narrow screens: point at the stream
      return [b.left - a.left + b.width * dx, b.top - a.top + b.height * dy];
    }
    const moveTo = ([x, y]) => { cp = [x, y]; cur.style.transform = `translate(${x - 4}px,${y - 2}px)`; };
    async function click(k, w){
      const b = $(`[data-b="${k}"]`); if(!b) return;
      await ensureVisible(b, w);
      moveTo(point(b, 0.42)); await w(900);
      b.classList.add('press');
      const rp = document.createElement('div'); rp.className = 'dv-rip'; rp.style.left = cp[0] + 'px'; rp.style.top = cp[1] + 'px'; el.appendChild(rp);
      wait(600).then(() => rp.remove());
      await w(150); b.classList.remove('press'); await w(120);
    }
    // grab something on the canvas with the cursor and change it over `ms`; the cursor stays glued to the grabbed point
    async function drag(w, target, dx, dy, ms, fn){
      moveTo(point(target, dx, dy)); await w(850);
      cur.classList.add('drag', 'press');
      await tween(ms, p => { fn(p); syncSel(); moveTo(point(target, dx, dy)); });
      cur.classList.remove('drag', 'press'); await w(350);
    }
    async function typeLink(s, w){
      await click('lnk', w);
      const box = $('.lnk'), tx = box.querySelector('.tx'); box.classList.add('act'); tx.textContent = '';
      for(const ch of s){ tx.textContent += ch; await w(36); }
      await w(250);
    }
    function clearLink(){ const box = $('.lnk'); box.classList.remove('act'); box.querySelector('.tx').textContent = D.linkPh; }

    function reset(){
      OV.forEach(s => showOn(s, false)); timerTok++; st.classList.remove('cs-mode');
      const cs = $('.cs'); cs.replaceWith(cs.cloneNode(false));   // a fresh node: a half-played CS2 scene lets go of the old one
      const kc = $('.o-case'); kc.classList.remove('drop', 'open', 'reel', 'spin', 'won');
      for(const k in NODE){ NODE[k].classList.remove('on', 'pop', 'msel'); }
      selK = null; grp = null; LY = []; syncSel(); tip(null); marq.classList.remove('on'); tb.classList.remove('multi'); $('.si').textContent = '';
      ly.replaceChildren(); insp.replaceChildren(); setTab('add'); pane(0); clearLink();
      $('.pg-auto .rule').classList.remove('fire'); $('.pg-auto .hit').classList.remove('on');
      votes.splice(0, 3, 0, 0, 0); poll(); setCount(6); clock(300);
    }
    const SCENES = {
      async text(w){ await click('text', w); addLayer('text'); showOn('.o-text'); await w(3000); },
      async img(w){
        await typeLink('cdn.example/sunset.jpg', w); await click('link', w); clearLink();
        put('img', { x:30, y:29, w:BASE.img.w, h:BASE.img.w * BASE.img.ar, r:0 }); addLayer('img'); await w(1300);
        await typeLink('cdn.example/party.gif', w); await click('link', w); clearLink();
        put('gif', { x:72, y:29, w:BASE.gif.w + 3, h:BASE.gif.w + 3, r:0 }); addLayer('gif'); await w(3200);
      },
      async web(w){
        await typeLink('stats.example/top', w); await click('link', w); clearLink();
        put('web', { x:50, y:28, w:50, h:30, r:0 }); addLayer('web'); await w(4200);
      },
      async xform(w){
        put('img', { x:50, y:28, w:BASE.img.w, h:BASE.img.w * BASE.img.ar, r:0 }); addLayer('img'); await w(900);
        const k = 'img', g0 = { ...G[k] };
        tip(D.tips.move);
        await drag(w, NODE[k], 0.5, 0.5, 1300, p => { G[k].x = mix(g0.x, 34, p); G[k].y = mix(g0.y, 27, p); paint(k); updateInsp(); });
        tip(D.tips.scale); const g1 = { ...G[k] };
        await drag(w, $('.hd.se'), 0.5, 0.5, 1300, p => { const s = mix(1, 1.4, p); G[k].w = g1.w * s; G[k].h = g1.h * s; paint(k); updateInsp(); });
        tip(D.tips.rotate);
        await drag(w, $('.hd.rot'), 0.5, 0.5, 1200, p => { G[k].r = mix(0, 15, p); paint(k); updateInsp(); });
        tip(D.tips.squeeze); const g2 = { ...G[k] };
        await drag(w, $('.hd.e'), 0.5, 0.5, 1200, p => { G[k].w = mix(g2.w, g2.w * 0.55, p); paint(k); updateInsp(); });
        tip(D.tips.stretch); const g3 = { ...G[k] };
        await drag(w, $('.hd.s'), 0.5, 0.5, 1200, p => { G[k].h = mix(g3.h, g3.h * 1.6, p); paint(k); updateInsp(); });
        await w(1500);
      },
      async group(w){
        put('img', { x:24, y:31, w:24, h:15, r:-6 }); addLayer('img', false);
        put('gif', { x:50, y:29, w:15, h:15, r:4 }); addLayer('gif', false);
        put('txt', { x:77, y:31, w:21, h:8, r:0 }); addLayer('txt', false); renderLayers();
        await w(700);
        // a rubber-band frame around everything
        tip(D.tips.select);
        const a = [2, 13], b = [95, 47];
        marq.style.setProperty('--mx', a[0]); marq.style.setProperty('--my', a[1]); marq.style.setProperty('--mw', 0); marq.style.setProperty('--mh', 0); marq.classList.add('on');
        moveTo(point(st, a[0] / 100, a[1] / 56.25)); await w(900); cur.classList.add('drag', 'press');
        await tween(1300, p => {
          marq.style.setProperty('--mw', (b[0] - a[0]) * p); marq.style.setProperty('--mh', (b[1] - a[1]) * p);
          moveTo(point(st, (a[0] + (b[0] - a[0]) * p) / 100, (a[1] + (b[1] - a[1]) * p) / 56.25));
          for(const k of ['img', 'gif', 'txt']) NODE[k].classList.toggle('msel', p > 0.7);
        });
        cur.classList.remove('drag', 'press'); marq.classList.remove('on'); tb.classList.add('multi'); $('.si').textContent = D.names.group + ' · 3';
        await w(500);
        await click('group', w); tip(D.tips.group); tb.classList.remove('multi');
        for(const k of ['img', 'gif', 'txt']) NODE[k].classList.remove('msel');
        makeGroup(['img', 'gif', 'txt']); await w(900);
        tip(D.tips.move);
        await drag(w, sel, 0.5, 0.5, 1200, p => { grp.p.dx = mix(0, 6, p); grp.p.dy = mix(0, 4, p); applyGroup(); });
        tip(D.tips.scale);
        await drag(w, $('.hd.se'), 0.5, 0.5, 1200, p => { grp.p.s = mix(1, 1.18, p); applyGroup(); });
        tip(D.tips.rotate);
        await drag(w, $('.hd.rot'), 0.5, 0.5, 1200, p => { grp.p.rot = mix(0, 7, p); applyGroup(); });
        await w(1500);
      },
      async poll(w){
        await click('poll', w); addLayer('poll'); showOn('.o-poll'); await w(700);
        for(const v of [0, 1, 0, 2, 0, 1, 0, 0, 2, 0]){ votes[v]++; poll(); await w(420); }
        await w(1400);
      },
      async timer(w){
        await click('timer', w); addLayer('timer'); showOn('.o-timer'); runTimer(300); await w(1000);
        await click('count', w); addLayer('count'); showOn('.o-count'); await w(800);
        setCount(7, true); await w(900); setCount(8, true); await w(1600);
      },
      async kase(w){
        const kc = $('.o-case');
        await click('kase', w); addLayer('kase'); kc.classList.add('on', 'drop'); await w(1900);
        await click('open', w); kc.classList.add('open'); await w(1700);
        kc.classList.add('reel'); await w(500); kc.classList.add('spin'); await w(4600);
        kc.classList.add('won'); await w(3000);
      },
      async auto(w){
        await click('tab-auto', w); setTab('auto'); await w(900);
        $('.pg-auto .hit').classList.add('on'); $('.pg-auto .rule').classList.add('fire'); await w(700);
        confetti(); addLayer('sticker'); showOn('.o-sticker'); await w(2600);
      },
      async cs(w){
        await click('cs', w); addLayer('cs'); st.classList.add('cs-mode'); moveTo(point(st, 0.5, 0.5)); await w(500);
        await csScene($('.cs'), t, clk); await w(600);
        await click('hide', w); reset(); await w(1400);
      },
    };
    const caps = strip?.querySelector('.fn-cap');
    const chips = strip ? [...strip.querySelectorAll('[data-i]')] : [];
    function mark(n){ chips.forEach((c, i) => c.classList.toggle('on', i === n)); if(caps) caps.textContent = D.sc[SC[n]][1]; }
    async function play(i){
      const my = ++tok, w = async ms => { await wait(ms); if(my !== tok) throw 0; };
      try{
        cur.classList.remove('hidden', 'drag', 'press');
        for(let n = i; ; n = (n + 1) % SC.length){
          mark(n); reset(); moveTo(point(st, 0.7, 0.75)); await w(500);
          await SCENES[SC[n]](w); await w(1200);
        }
      }catch(e){ if(my !== tok || e === 0) return; throw e; }
    }
    chips.forEach(c => { c.onclick = () => { tok++; play(+c.dataset.i); }; });

    if(reduced){   // one still frame with the classic overlay
      mark(0); votes.splice(0, 3, 14, 9, 5); poll(); clock(272); setCount(7);
      for(const k of ['text', 'poll', 'timer', 'count']) addLayer(k);
      ['.o-text', '.o-poll', '.o-timer', '.o-count'].forEach(s => showOn(s));
      chips.forEach(c => { c.disabled = true; });
      return;
    }
    play(0);
  }

  // ---------- CS2 section: scoreboard table ↔ duel comparison (same glass look as the HUD) ----------
  function csMini(el, t){
    const stat = p => { const [n, , k, d] = p, a = (k * 7) % 9 + 2; return { k, d, a, pm:k - d, adr:60 + (k * 13) % 60, hs:30 + (k * 7) % 28 }; };
    const sign = v => (v > 0 ? '+' : '') + v;
    const row = (p, side) => { const s = stat(p); return `<div class="mm-tr" data-n="${p[0]}"><span class="av">${initials(p[0])}</span><span class="nm">${p[0]}</span><b class="k">${s.k}</b><b class="d">${s.d}</b><b>${s.a}</b><b class="pm">${sign(s.pm)}</b><b>${s.adr}</b><b>${money(p[4])}</b></div>`; };
    const head = `<div class="mm-tr th"><span>${t.mmPlayer}</span><b>K</b><b>D</b><b>A</b><b>+/-</b><b>ADR</b><b>$</b></div>`;
    const sec = side => `<div class="mm-sec cs-${side}">${head}${CS[side].players.map(p => row(p, side)).join('')}</div>`;
    const a = CS.ct.players[0], b = CS.t.players[0], sa = stat(a), sb = stat(b);
    const cmp = [['K', sa.k, sb.k], ['ADR', sa.adr, sb.adr], ['HS%', sa.hs, sb.hs], ['$', a[4], b[4]]];
    const side = (p, s) => `<div class="sd cs-${s}"><span class="av">${initials(p[0])}</span><span class="nm">${p[0]}</span><span class="hpl">${ic('heart')}<b>100</b></span></div>`;
    el.innerHTML = `
      <div class="mm-v mm-sb on">
        ${csScore(t, `<b>1:24</b>`).replace('cs-score', 'cs-score mm-score')}
        <div class="mm-ser gl">${t.dSeries}</div>
        <div class="mm-tb gl-none">${sec('ct')}${sec('t')}</div>
      </div>
      <div class="mm-v mm-du">
        ${csScore(t, `<b>0:19</b>`).replace('cs-score', 'cs-score mm-score')}
        <div class="mm-vs gl">
          <div class="mm-vt">${ic('hs')}${t.mmDuel}</div>
          <div class="mm-vh">${side(a, 'ct')}<span class="x">VS</span>${side(b, 't')}</div>
          <div class="mm-cmp">${cmp.map(([l, x, y]) => `<div class="mm-cr"><span class="l${x > y ? ' w' : ''}">${l === '$' ? money(x) : x}</span><span class="bl cs-ct"><i data-w="${Math.round(x / Math.max(x, y) * 100)}"></i></span><span class="lb">${l}</span><span class="br cs-t"><i data-w="${Math.round(y / Math.max(x, y) * 100)}"></i></span><span class="r${y > x ? ' w' : ''}">${l === '$' ? money(y) : y}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="mm-tabs"><i class="on"></i><i></i></div>`;
    const $ = s => el.querySelector(s), views = [$('.mm-sb'), $('.mm-du')], tabs = el.querySelectorAll('.mm-tabs i');
    const show = i => { views.forEach((v, j) => v.classList.toggle('on', i === j)); tabs.forEach((v, j) => v.classList.toggle('on', i === j)); };
    const bars = on => el.querySelectorAll('.mm-cr i').forEach(i => { i.style.width = on ? i.dataset.w + '%' : '0'; });
    const clk = makeClock(el), wait = clk.wait;
    if(reduced){ bars(true); return; }
    const sides = el.querySelectorAll('.mm-vs .sd'), hpl = el.querySelectorAll('.mm-vs .hpl');
    const hp = (i, v) => { hpl[i].querySelector('b').textContent = v; hpl[i].classList.toggle('low', v <= 25); };
    (async () => {
      for(;;){
        show(0);
        const k = $('[data-n="kyro"] .k'), d = $('[data-n="zayn"] .d'), z = $('[data-n="zayn"]');
        k.textContent = sa.k; d.textContent = sb.d; k.classList.remove('hl'); d.classList.remove('hl'); z.classList.remove('dead');
        await wait(2200);
        k.textContent = sa.k + 1; d.textContent = sb.d + 1; restart(k, 'hl'); restart(d, 'hl'); z.classList.add('dead');
        await wait(2600);
        bars(false); hp(0, 100); hp(1, 100); sides.forEach(s => s.classList.remove('lost'));
        show(1); await wait(500); bars(true); await wait(1300);
        hp(0, 54); await wait(900);
        hp(1, 18); await wait(700);
        hp(1, 0); sides[1].classList.add('lost');
        await wait(2400);
      }
    })();
  }

  // ---------- "How it works" diagram ----------
  function flow(el, t){
    const node = (i, b, s) => `<div class="node"><div class="ni">${ic(i)}</div><b>${b}</b><small>${s}</small></div>`;
    const wire = (cls, label) => `<div class="wire ${cls}"><span>${label}</span><i>${ic('lock')}</i><i>${ic('lock')}</i><i>${ic('lock')}</i></div>`;
    el.innerHTML = node('browser', t.nP, t.nPs) + wire('w1', t.wire) + node('pc', t.nH, t.nHs) + wire('w2', 'localhost') + node('obs', t.nO, t.nOs);
  }

  // ---------- "How do we connect?": pick what you already have, get the steps ----------
  let picked = 'easy';
  function chooser(el){
    const g = window.HUDINI_CONNECT?.[lang] || window.HUDINI_CONNECT?.en; if(!g) return;
    document.getElementById('cTitle').textContent = g.title; document.getElementById('cLead').textContent = g.lead;
    const ids = picked === 'easy' ? ['radmin', 'porthole'] : [picked];
    const list = a => `<ol>${a.map(x => `<li>${x}</li>`).join('')}</ol>`;
    const answer = id => { const m = g.methods[id]; return `<div class="answer">
        <div class="ahead"><h3>${m.name}</h3><span class="atag">${m.tag}</span>${picked === 'easy' ? `<span class="rec">${g.recommend}</span>` : ''}</div>
        <p class="when">${m.when}</p>
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
    for(const a of document.querySelectorAll('a[data-os-label]')) a.innerHTML = ic('dl') + t.dlFor.replace('{os}', osName);
    for(const a of document.querySelectorAll('a[data-sums]')) a.href = REL;
    const other = document.getElementById('otherOs');
    if(other) other.innerHTML = OSES.filter(o => o[0] !== myOs).map(o => `<a href="${REL}" target="_blank" rel="noopener">${o[1]}</a>`).join(' · ');
    for(const a of document.querySelectorAll('a[data-help]')) a.href = 'help.html?lang=' + encodeURIComponent(lang);
    for(const a of document.querySelectorAll('a[data-rep]')) a.href = 'report.html?lang=' + encodeURIComponent(lang);
    for(const [id, key] of [['sSteps', 'sSteps'], ['mSteps', 'mSteps']]){ const ol = document.getElementById(id); if(ol) ol.innerHTML = t[key].map(x => `<li>${x}</li>`).join(''); }
    const ch = document.getElementById('chooser'); if(ch) chooser(ch);
    const list = document.getElementById('csList');
    if(list) list.innerHTML = t.csList.map((s, i, a) => `<li${i === a.length - 1 ? ' class="wide"' : ''}>${ic('check')}<span>${s}</span></li>`).join('');
    const csTag = document.querySelector('[data-t="csTag"]'); if(csTag) csTag.innerHTML = ic('star') + t.dPower;
    const f = document.getElementById('flow'); if(f) flow(f, t);
    const d = document.getElementById('demo'); if(d) heroDemo(d, t);
    const m = document.getElementById('csMini'); if(m) csMini(m, t);
  }
  function landingOnce(){
    // sections fade in as they scroll into view
    const els = document.querySelectorAll('.reveal');
    if(reduced || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('in'));
    else{
      const io = new IntersectionObserver(es => { for(const e of es) if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold:0.12, rootMargin:'0px 0px -40px 0px' });
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
    for(const el of document.querySelectorAll('[data-t]')){ const v = t[el.dataset.t]; if(typeof v === 'string') el.innerHTML = v; }
    if(document.body.dataset.page === 'help') helpPage(); else landing(t);
  }
  function setLang(l){
    if(!has(l)) return;
    lang = l; try{ localStorage.setItem('hudini.lang', l); }catch{}
    const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u);
    render();
  }
  for(const s of document.querySelectorAll('select.lang')){
    for(const [c, n] of LANGS){ const o = document.createElement('option'); o.value = c; o.textContent = n; o.selected = c === lang; s.appendChild(o); }
    s.onchange = () => setLang(s.value);
  }
  render();
  if(document.body.dataset.page !== 'help') landingOnce();
})();
