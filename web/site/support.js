// Support page: sends a report to the support relay (support/worker) and shows the ticket thread.
// SUPPORT_API is the ONLY place the relay address is set. tools/build-site.sh copies its origin into the page's CSP (connect-src).
// Empty = the form is off and the page points to GitHub issues.
const SUPPORT_API = '';

(() => {
  'use strict';
  const TX = window.HUDINI_SUPPORT;
  const $ = id => document.getElementById(id);
  const API = String(SUPPORT_API || '').replace(/\/+$/, '');
  const POLL_MS = 15000, KEY = 'hudini.tickets';
  const ID_RE = /^[a-z2-7]{8}$/, SECRET_RE = /^[A-Za-z0-9_-]{32}$/;
  // Everything people wrote is put on the page with textContent only (never innerHTML) and is never turned into links.

  let lang = 'en', cur = null, timer = null, busy = false, lastData = null;
  const t = () => TX[lang] || TX.en;

  // ---- own tickets: id + secret only, in this browser only ----
  function mineLoad(){
    try{ const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && ID_RE.test(x.id) && SECRET_RE.test(x.secret)).slice(0, 50) : []; }catch{ return []; }
  }
  function mineSave(a){ try{ localStorage.setItem(KEY, JSON.stringify(a.slice(0, 50).map(x => ({ id: x.id, secret: x.secret })))); }catch{} }
  function mineAdd(id, secret){ const a = mineLoad().filter(x => x.id !== id); a.unshift({ id, secret }); mineSave(a); }
  function mineDrop(id){ mineSave(mineLoad().filter(x => x.id !== id)); }

  function detectOs(){
    const u = (navigator.userAgentData?.platform || navigator.platform || '') + ' ' + (navigator.userAgent || '');
    if(/android|iphone|ipad/i.test(u)) return 'other';
    if(/mac/i.test(u)) return 'macos';
    if(/linux|x11|cros/i.test(u)) return 'linux';
    if(/win/i.test(u)) return 'windows';
    return 'other';
  }
  let version = '';
  fetch('version.json', { cache: 'no-store', credentials: 'omit' }).then(r => r.ok ? r.json() : null).then(j => {
    const v = j && (j.version || j.panel); if(v != null && /^[A-Za-z0-9.+_ -]{1,40}$/.test(String(v))) version = String(v);
  }).catch(() => {});

  // ---- texts ----
  function text(){
    document.title = t().title;
    for(const el of document.querySelectorAll('[data-s]')){ const v = t()[el.dataset.s]; if(typeof v === 'string') el.innerHTML = v; }
    for(const el of document.querySelectorAll('[data-ph]')) el.placeholder = t()[el.dataset.ph] || '';
    drawMine(); if(cur && lastData) drawTicket(lastData);
  }

  // ---- views ----
  function show(name){
    for(const id of ['form', 'done', 'view']) $(id).hidden = id !== name;
    $('newWrap').hidden = name === 'form' || !API;
    if(name !== 'view') stopPoll();
  }
  function drawMine(){
    const a = mineLoad(), ul = $('mine'); ul.textContent = '';
    $('mineBox').hidden = !API || !a.length;
    for(const x of a){
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.textContent = t().ticket + ' #' + x.id;
      b.onclick = () => openTicket(x.id, x.secret);
      li.appendChild(b); ul.appendChild(li);
    }
  }
  const errText = code => ({ rate_limited: t().errRate, busy: t().errBusy, too_many_messages: t().tooMany })[code] || t().errServer;

  async function call(path, opts, secret){
    const h = { ...(opts.headers || {}) };
    if(secret) h['x-ticket-secret'] = secret;   // the secret travels in a header, never in the URL
    const r = await fetch(API + path, { ...opts, headers: h, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    let j = null; try{ j = await r.json(); }catch{}
    return { status: r.status, j };
  }

  // ---- sending a report ----
  async function onSubmit(e){
    e.preventDefault(); if(busy) return;
    const err = $('err'); err.textContent = '';
    const body = $('fText').value.trim();
    if(body.length < 10){ err.textContent = t().errText; return; }
    let log = $('fLog').value; if(log.length > 20000) log = log.slice(-20000);
    const payload = {
      kind: document.querySelector('input[name=kind]:checked')?.value || 'bug', text: body,
      role: $('fRole').value, connection: $('fConn').value, contact: $('fContact').value.trim(), log,
      version, os: detectOs(), lang, hp: $('fHp').value,
    };
    busy = true; $('sendBtn').disabled = true; $('sendBtn').textContent = t().sending;
    try{
      const r = await call('/api/ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if(r.status === 201 && r.j && ID_RE.test(r.j.id) && SECRET_RE.test(r.j.secret)){
        mineAdd(r.j.id, r.j.secret);
        cur = { id: r.j.id, secret: r.j.secret };
        $('ownLink').value = location.origin + location.pathname + '#t=' + r.j.id + '.' + r.j.secret;
        const tgb = $('tgBtn'), okTg = typeof r.j.tg === 'string' && /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[A-Za-z0-9_-]+$/.test(r.j.tg);
        tgb.hidden = $('tgHint').hidden = !okTg; if(okTg) tgb.href = r.j.tg;
        show('done'); drawMine();
        $('form').reset();
      } else err.textContent = r.status === 400 ? t().errText : errText(r.j && r.j.error);
    }catch{ err.textContent = t().errNet; }
    busy = false; $('sendBtn').disabled = false; $('sendBtn').textContent = t().send;
  }

  // ---- ticket view ----
  function drawTicket(d){
    lastData = d;
    $('vId').textContent = '#' + d.id;
    const st = $('vStatus'); st.textContent = d.status === 'closed' ? t().stClosed : t().stOpen; st.className = 'sp-st' + (d.status === 'closed' ? ' closed' : '');
    const box = $('thread'); box.textContent = '';
    for(const m of d.messages || []){
      const div = document.createElement('div'), who = document.createElement('b'), body = document.createElement('span');
      div.className = 'sp-msg' + (m.from === 'owner' ? ' owner' : '');
      who.textContent = (m.from === 'owner' ? t().dev : t().you) + ' · ' + new Date(m.t).toLocaleString(lang);
      body.textContent = String(m.text);
      div.appendChild(who); div.appendChild(body); box.appendChild(div);
    }
  }
  async function refresh(){
    if(!cur) return;
    try{
      const r = await call('/api/ticket?id=' + encodeURIComponent(cur.id), { method: 'GET' }, cur.secret);
      if(r.status === 200 && r.j){ $('vErr').textContent = ''; drawTicket(r.j); }
      else if(r.status === 404){ mineDrop(cur.id); drawMine(); stopPoll(); $('vErr').textContent = t().notFound; }
      else $('vErr').textContent = errText(r.j && r.j.error);
    }catch{ $('vErr').textContent = t().errNet; }
  }
  function stopPoll(){ if(timer){ clearInterval(timer); timer = null; } }
  async function openTicket(id, secret){
    cur = { id, secret }; lastData = null;
    $('thread').textContent = ''; $('vErr').textContent = ''; $('vId').textContent = '#' + id; $('vStatus').textContent = '';
    show('view'); stopPoll();
    await refresh();
    if(lastData) mineAdd(id, secret);
    timer = setInterval(() => { if(document.visibilityState === 'visible') refresh(); }, POLL_MS);
  }
  async function onReply(e){
    e.preventDefault(); if(busy || !cur) return;
    const v = $('rText').value.trim(), err = $('vErr'); err.textContent = '';
    if(!v || v.length > 2000){ err.textContent = t().errReply; return; }
    busy = true;
    try{
      const r = await call('/api/ticket/message', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: cur.id, text: v }) }, cur.secret);
      if(r.status === 200 && r.j){ $('rText').value = ''; drawTicket(r.j); }
      else err.textContent = r.status === 404 ? t().notFound : r.status === 400 ? t().errReply : errText(r.j && r.j.error);
    }catch{ err.textContent = t().errNet; }
    busy = false;
  }

  // ---- start ----
  $('form').addEventListener('submit', onSubmit);
  $('reply').addEventListener('submit', onReply);
  $('newBtn').onclick = () => { cur = null; show('form'); };
  $('openBtn').onclick = () => cur && openTicket(cur.id, cur.secret);
  $('copyBtn').onclick = async () => {
    const i = $('ownLink'); i.select();
    try{ await navigator.clipboard.writeText(i.value); }catch{ try{ document.execCommand('copy'); }catch{} }
    $('copyBtn').textContent = t().copied; setTimeout(() => { $('copyBtn').textContent = t().copy; }, 1500);
  };

  const pick = () => document.documentElement.lang;
  function sync(){ const l = pick(); if(TX[l]) lang = l; text(); }
  for(const s of document.querySelectorAll('select.lang')) s.addEventListener('change', () => setTimeout(sync, 0));
  sync();

  // #t=<id>.<secret>: the secret leaves the address bar and the history right away; it lives in memory (and in "my reports")
  function fromHash(){
    const m = /^#t=([a-z2-7]{8})\.([A-Za-z0-9_-]{32})$/.exec(location.hash);
    if(location.hash) history.replaceState(null, '', location.pathname + location.search);
    if(m) openTicket(m[1], m[2]);
    return !!m;
  }
  if(!API){ $('off').hidden = false; }
  else {
    window.addEventListener('hashchange', fromHash);
    if(!fromHash()) show('form');
  }
})();
