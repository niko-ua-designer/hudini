// Report page (report.html): a five-step helper that collects the facts, writes the report and opens a prefilled GitHub issue form.
// Nothing is sent from here: the only outgoing thing is the link the visitor opens. Pure helpers are exposed as window.HudiniReport (tests).
(() => {
  'use strict';
  const R = window.HUDINI_REPORT;
  const REPO = 'https://github.com/niko-ua-designer/hudini/issues/new';
  const OSES = ['Windows', 'macOS (Apple Silicon)', 'macOS (Intel)', 'Linux'];
  const CODE = /hudini1:[^\s"'<>`]+/g;
  const LIMIT = 1500;   // per field in the link, so the whole URL stays well under GitHub's limit

  const detectOs = (ua = navigator.userAgent || '', plat = navigator.platform || '') => {
    if(/Win/i.test(plat + ua)) return 'Windows';
    if(/Mac/i.test(plat + ua)) return 'macOS (Apple Silicon)';
    if(/Linux|X11/i.test(plat + ua) && !/Android/i.test(ua)) return 'Linux';
    return 'Windows';
  };
  const redact = (text) => { let n = 0; const out = String(text).replace(CODE, () => { n++; return 'hudini1:[removed]'; }); return { text: out, n }; };
  const clip = (s, n) => s.length > n ? s.slice(0, n) + ' …' : s;
  // a room code pasted into a field never reaches the public issue
  const scrub = s => { const o = { ...s }; for(const k of ['what', 'steps', 'ver']) if(typeof o[k] === 'string') o[k] = redact(o[k]).text; return o; };

  function buildReport(s){
    s = scrub(s);
    const h = (t, v) => `### ${t}\n${v && v.trim() ? v.trim() : '_No response_'}\n`;
    if(s.type === 'idea') return h('Your idea', s.what);
    return [h('Type', s.type === 'lag' ? 'Lags or freezes' : 'Bug'), h('What happened', s.what), h('Steps to reproduce', s.steps), h('Hudini version', s.ver), h('Operating system', s.os), h('Role where it happens', s.role), h('Connection method', s.conn)].join('\n');
  }
  function buildUrl(s){
    s = scrub(s);
    const q = new URLSearchParams(), idea = s.type === 'idea';
    q.set('template', idea ? 'idea.yml' : 'bug.yml');
    const first = (s.what || '').trim().split('\n')[0].slice(0, 70);
    q.set('title', (s.type === 'lag' ? '[Lag] ' : idea ? '[Idea] ' : '') + first);
    const w = clip((s.what || '').trim(), LIMIT), st = clip((s.steps || '').trim(), LIMIT);
    let truncated = (s.what || '').trim().length > LIMIT || (s.steps || '').trim().length > LIMIT;
    if(idea) q.set('idea', w);
    else { q.set('what', w); if(st) q.set('steps', st); if(s.ver) q.set('version', s.ver.trim()); q.set('os', s.os); q.set('role', s.role); if(s.conn) q.set('connection', s.conn); }
    return { url: `${REPO}?${q}`, truncated };
  }
  window.HudiniReport = { detectOs, redact, buildReport, buildUrl };
  if(!document.getElementById('body')) return;   // loaded by a test without the page

  const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { step: 0, type: 'bug', ver: '', os: detectOs(), role: 'Streamer', conn: '', what: '', steps: '', copied: false };
  {   // the program opens this page with its own facts: ?v=1.1.2&os=linux&role=streamer&conn=zerotier
    const q = new URLSearchParams(location.search);
    const OSMAP = { windows:'Windows', linux:'Linux', 'macos-arm':'macOS (Apple Silicon)', 'macos-intel':'macOS (Intel)', macos:'macOS (Apple Silicon)' };
    const ROLES = { streamer:'Streamer', moderator:'Moderator', both:'Both' };
    const CONNS = { radmin:'Radmin VPN', porthole:'Porthole (Steam)', tailscale:'Tailscale', zerotier:'ZeroTier', hamachi:'Hamachi', ext:'Port forwarding', lan:'Same PC or local network' };
    const v = (q.get('v') || '').slice(0, 20); if(/^[\w.\-]+$/.test(v)) S.ver = v;
    if(OSMAP[q.get('os')]) S.os = OSMAP[q.get('os')];
    if(ROLES[q.get('role')]) S.role = ROLES[q.get('role')];
    if(CONNS[q.get('conn')]) S.conn = CONNS[q.get('conn')];
  }
  let lang = 'en', clean = null;
  const t = () => R[lang] || R.en;
  // an idea has three steps: kind, the idea, GitHub (no facts to collect, no log); a bug has five
  const total = () => S.type === 'idea' ? 3 : 5, phase = n => S.type === 'idea' ? [0, 2, 3][n] : n;

  const field = (id, label, hint, inner) => `<label class="rp-f" for="${id}"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const select = (id, opts, val) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

  function draw(){
    const k = t(), n = S.step, idea = S.type === 'idea', ph = phase(n), TOTAL = total();
    $('stepOf').textContent = k.stepOf.replace('{n}', n + 1).replace('{total}', TOTAL);
    $('dots').innerHTML = Array.from({ length: TOTAL }, (_, i) => `<li class="${i < n ? 'done' : i === n ? 'on' : ''}"></li>`).join('');
    $('stTitle').textContent = idea && n > 0 ? k.stIdea[n] : k.st[ph];
    let h = '';
    if(ph === 0){
      h = `<div class="rp-types" role="radiogroup">${k.types.map(([v, a, b]) => `<button type="button" role="radio" aria-checked="${S.type === v}" class="${S.type === v ? 'on' : ''}" data-type="${v}"><b>${a}</b><span>${b}</span></button>`).join('')}</div>`;
    } else if(ph === 1){
      h = `<p>${k.s2p}</p>`;
      if(idea) h += `<p class="rp-soft">—</p>`;
      else h += `<div class="rp-grid">${field('fVer', k.fVer, k.fVerH, `<input id="fVer" value="${esc(S.ver)}" placeholder="${k.fVerPh}" autocomplete="off">`)}
        ${field('fOs', k.fOs, '', select('fOs', OSES.map(o => [o, o]), S.os))}
        ${field('fRole', k.fRole, '', select('fRole', k.roles, S.role))}
        ${field('fConn', k.fConn, '', select('fConn', [['', '—'], ...k.conns], S.conn))}</div>`;
      h += `<div class="rp-warn"><b>${k.warnH}</b><span>${k.warnP}</span></div>`;
    } else if(ph === 2){
      h = `<p>${idea ? k.s3pIdea : k.s3p}</p>` + (idea ? field('fWhat', k.fIdea, k.fIdeaH, `<textarea id="fWhat" rows="5">${esc(S.what)}</textarea>`)
        : field('fWhat', k.fWhat, k.fWhatH, `<textarea id="fWhat" rows="4">${esc(S.what)}</textarea>`) + field('fSteps', k.fSteps, k.fStepsH, `<textarea id="fSteps" rows="4">${esc(S.steps)}</textarea>`));
    } else if(ph === 3){
      const { truncated } = buildUrl(S);
      h = `<p>${k.s4p}</p><ol class="rp-ol">${k.acc.map(x => `<li>${x}</li>`).join('')}</ol><p class="rp-soft">${k.accHave}</p>
        ${idea ? '' : `<p class="rp-note">${k.logNote}</p>`}
        <div class="rp-act"><a class="btn primary shine" id="gh" target="_blank" rel="noopener noreferrer"></a></div>${truncated ? `<p class="rp-note">${k.long}</p>` : ''}`;
    } else {
      h = `<p>${k.s5p}</p><ol class="rp-ol">${k.logSteps.map(x => `<li>${x}</li>`).join('')}</ol>
        <div class="rp-chk"><b>${k.chkH}</b><p>${k.chkP}</p><input type="file" id="logFile" accept=".log,.txt,text/plain"><div id="chkOut" aria-live="polite"></div></div>
        <div class="rp-prev"><span>${k.preview}</span><pre id="prev"></pre><button type="button" class="btn small" id="copy"></button></div>
        <p class="rp-ok">${k.done}</p>`;
    }
    $('body').innerHTML = h;
    $('back').textContent = k.back; $('back').style.visibility = n ? 'visible' : 'hidden';
    const last = n === TOTAL - 1; $('next').textContent = last ? k.restart : k.next;
    wire(); validate();
  }
  function validate(){
    const need = phase(S.step) === 2 && S.what.trim().length < 10;
    $('next').disabled = need;
    const prev = $('prev'); if(prev){ prev.textContent = need ? t().tooShort : buildReport(S); $('copy').textContent = S.copied ? t().copied : t().copy; $('copy').disabled = need; }
    const gh = $('gh'); if(gh){ const { url } = buildUrl(S); gh.href = url; gh.textContent = S.type === 'idea' ? t().openIdea : t().open; }
  }
  function wire(){
    for(const b of document.querySelectorAll('[data-type]')) b.onclick = () => { S.type = b.dataset.type; draw(); };
    const bind = (id, key) => { const e = $(id); if(e) e.oninput = e.onchange = () => { S[key] = e.value; S.copied = false; validate(); }; };
    bind('fVer', 'ver'); bind('fOs', 'os'); bind('fRole', 'role'); bind('fConn', 'conn'); bind('fWhat', 'what'); bind('fSteps', 'steps');
    const c = $('copy'); if(c) c.onclick = async () => { try{ await navigator.clipboard.writeText(buildReport(S)); }catch{ const p = $('prev'); const r = document.createRange(); r.selectNodeContents(p); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy'); } S.copied = true; validate(); };
    const f = $('logFile'); if(f) f.onchange = async () => {
      const file = f.files[0]; if(!file) return; const k = t(), out = $('chkOut');
      const r = redact(await file.text()); clean = r;
      out.innerHTML = r.n ? `<p class="rp-bad">${k.chkFound.replace('{n}', r.n)}</p><button type="button" class="btn small" id="dlClean">${k.chkDl}</button>` : `<p class="rp-good">${k.chkOk}</p>`;
      const d = $('dlClean'); if(d) d.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([clean.text], { type: 'text/plain' })); a.download = file.name.replace(/(\.\w+)?$/, '-clean$1'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
    };
  }
  const swap = fn => window.HudiniSwap ? window.HudiniSwap($('body'), fn) : fn();   // soft step change (site.js)
  $('back').onclick = () => { if(S.step) { S.step--; swap(draw); window.scrollTo(0, 0); } };
  $('next').onclick = () => { if(S.step === total() - 1) Object.assign(S, { step: 0, what: '', steps: '', copied: false }); else S.step++; swap(draw); window.scrollTo(0, 0); };

  function texts(){ const k = t(); document.title = k.title; for(const e of document.querySelectorAll('[data-r]')) if(typeof k[e.dataset.r] === 'string') e.innerHTML = k[e.dataset.r]; draw(); }
  function sync(){ const l = document.documentElement.lang; if(R[l]) lang = l; texts(); }
  for(const s of document.querySelectorAll('select.lang')) s.addEventListener('change', () => setTimeout(sync, 0));
  sync();
})();
