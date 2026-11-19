// Shared setup for Hudini end-to-end tests: a static web server for the panel, a TCP→TLS relay standing in for the app's,
// a real Hudini Host started from source with Bun, and Chromium pages for the panel and the OBS widget.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const net = require('net'), tls = require('tls');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

// The moderators' port uses a self-signed certificate: tests (and only tests) accept it
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const ADMIN_TOKEN = 'test-admin-token';
const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const MQTT_JS = fs.readFileSync(path.join(__dirname, 'node_modules/mqtt/dist/mqtt.min.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
// HUDINI_TEST_PORT_OFFSET shifts every port, so two stacks (a test run and a video recording) can run side by side
const OFF = Number(process.env.HUDINI_TEST_PORT_OFFSET || 0);
const PORTS = { web: 18090 + OFF, host: 17790 + OFF };   // host uses host+1 for the moderators' TLS port

// ---------- tiny test framework ----------
const results = [];
let current = '';
function check(ok, what, extra){
  results.push({ ok: !!ok, what: (current ? current + ': ' : '') + what });
  console.log((ok ? '  ✓ ' : '  ✗ ') + what + (ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)));
}
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, { got: a, want: b });
async function step(name, fn){
  current = name; console.log('• ' + name);
  try{ await fn(); }catch(e){ check(false, 'threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
  current = '';
}
async function until(fn, ms = 8000, every = 150){
  const end = Date.now() + ms; let last;
  while(Date.now() < end){ try{ last = await fn(); if(last) return last; }catch{} await sleep(every); }
  return last;
}

// ---------- servers ----------
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.gif':'image/gif' };
async function webServer(opts = {}){
  const srv = http.createServer((req, res) => {
    const f = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(!f.startsWith(WEB) || !fs.existsSync(f) || !fs.statSync(f).isFile()){ res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
    if(opts.csp) res.setHeader('content-security-policy', opts.csp);
    res.end(fs.readFileSync(f));
  });
  const port = opts.port || PORTS.web;
  await new Promise(r => srv.listen(port, r));
  return { url: `http://localhost:${port}`, close: () => new Promise(r => srv.close(r)) };
}
function startHost(env = {}){
  const dir = env.OVERLAY_HOST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-host-'));
  const port = Number(env.OVERLAY_PORT || PORTS.host);
  const proc = spawn('bun', ['run', 'server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env,
    OVERLAY_HOST_DIR: dir, OVERLAY_NO_OPEN: '1', OVERLAY_NO_UPDATE: '1', OVERLAY_PORT: String(port),
    OVERLAY_ADMIN_TOKEN: ADMIN_TOKEN, OVERLAY_MOD_PORT: String(port + 1), ...env } });
  let log = ''; proc.stdout.on('data', d => log += d); proc.stderr.on('data', d => log += d);
  const base = `http://localhost:${port}`;
  const host = {
    proc, dir, port, base, tunnel: `https://127.0.0.1:${port + 1}`, modPort: port + 1, token: ADMIN_TOKEN, log: () => log,
    admin: `http://127.0.0.1:${port}`,   // страница управления и /api: отдельный origin от виджета (localhost)
    async api(p, body){
      const base = `http://127.0.0.1:${port}`;
      const h = { 'x-hudini-token': ADMIN_TOKEN };
      const r = await fetch(base + p, body === undefined ? { headers: h } : { method:'POST', headers:{ ...h, 'content-type':'application/json', origin: base }, body: JSON.stringify(body) });
      return r.json();
    },
    async ready(){ return until(async () => (await fetch(`http://127.0.0.1:${port}/api/status`)).ok, 15000); },
    // The code a streamer gives to a moderator, decoded
    async code(){ const r = await this.api('/api/code'); return { ...r, data: JSON.parse(Buffer.from(r.code.slice(8), 'base64url').toString()) }; },
    async stop(){ if(proc.exitCode !== null) return; proc.kill('SIGTERM'); await until(() => proc.exitCode !== null, 3000); if(proc.exitCode === null) proc.kill('SIGKILL'); },
  };
  return host;
}

// ---------- relay (stands in for app/relay: local TCP port → TLS to the Host's moderator port) ----------
const relays = new Map();
function relayFor(port){
  if(!relays.has(port)) relays.set(port, new Promise(res => {
    const srv = net.createServer(c => {
      const up = tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false });
      const end = () => { c.destroy(); up.destroy(); };
      c.pipe(up); up.pipe(c);
      c.on('error', end); up.on('error', end); c.on('close', end); up.on('close', end);
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  }));
  return relays.get(port).then(r => r.port);
}
async function closeRelays(){ for(const p of relays.values()) (await p).srv.close(); relays.clear(); }

// The app shell as the panel sees it: window.__TAURI__ with the store in localStorage ("fake.store") and relay_open/relay_status
function fakeTauri(){
  const L = {}, emit = (ev, payload) => (L[ev] || []).forEach(cb => cb({ payload }));
  const st = () => { try{ return JSON.parse(localStorage.getItem('fake.store') || '{}'); }catch{ return {}; } };
  window.__calls = [];
  window.__TAURI__ = {
    core: { async invoke(cmd, args){
      window.__calls.push([cmd, args]);
      if(cmd === 'store_load') return st();
      if(cmd === 'store_save'){ localStorage.setItem('fake.store', JSON.stringify(args.data)); return null; }
      if(cmd === 'relay_open'){
        const port = await window.__relayOpen(args.addrs[0].port);
        setTimeout(() => emit('relay_status', { state: 'online', addr: args.addrs[0].h + ':' + args.addrs[0].port, net: args.addrs[0].net, rtt_ms: window.__rtt ?? 4, since: Date.now(), reconnects: 0, last_error: '' }), 60);
        return port;
      }
      return null;
    } },
    event: { listen(ev, cb){ (L[ev] ||= []).push(cb); return Promise.resolve(() => {}); } },
  };
  window.__emit = emit;
}
// What the panel stored (the app's store.json)
const stored = (page, key) => page.evaluate(k => { try{ return JSON.parse(localStorage.getItem('fake.store') || '{}')[k] ?? null; }catch{ return null; } }, key);

// ---------- browser ----------
let browser = null;
const pageErrors = [];
async function newPage(name, { w = 1600, h = 900, lang = 'ru', irc = false, tour = false, app = !name.startsWith('widget') } = {}){
  // HUDINI_TEST_GPU=1: real GPU (Vulkan) instead of software GL: smooth 3D and animations in screen recordings
  browser ||= await chromium.launch(process.env.HUDINI_TEST_GPU ? { args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] } : {});
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.HUDINI_TEST_DSF || 1), ignoreHTTPSErrors: true });   // HUDINI_TEST_DSF=2: sharper screen recordings
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/github\.io|api\.github\.com/, r => r.fulfill({ status: 404, body: '' }));
  // the OBS widget still loads mqtt.js from unpkg
  await ctx.route('https://unpkg.com/**', r => r.fulfill({ body: MQTT_JS, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  if(app){
    await ctx.exposeFunction('__relayOpen', port => relayFor(port));
    await ctx.addInitScript(fakeTauri);
  }
  await ctx.addInitScript(([l, tour, app]) => { try{
    localStorage.setItem('hudini.lang', l);
    const snooze = Date.now() + 864e5;
    if(app){ const s = JSON.parse(localStorage.getItem('fake.store') || '{}'); if(!s['overlay.vaultWarn']){ s['overlay.vaultWarn'] = snooze; localStorage.setItem('fake.store', JSON.stringify(s)); } }
    else if(!localStorage.getItem('store:overlay.vaultWarn')) localStorage.setItem('store:overlay.vaultWarn', String(snooze));
    if(!tour && !localStorage.getItem('hudini.ui')) localStorage.setItem('hudini.ui', JSON.stringify({ v:1, tour:1 }));
  }catch{} }, [lang, tour, app]);
  await ctx.route(/jtvnw\.net/, r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'fixtures/img.png')), contentType: 'image/png' }));
  // Twitch chat without the network: window.__irc(line) feeds a raw IRC line to the panel
  if(irc) await ctx.addInitScript(() => { const Real = window.WebSocket; window.WebSocket = function(url, p){ if(!String(url).includes('irc-ws')) return new Real(url, p);
    const ws = { send(m){ if(m.startsWith('JOIN')) setTimeout(() => ws.onmessage && ws.onmessage({ data: ':tmi.twitch.tv 366 justinfan #chan :End' }), 10); }, close(){} };
    window.__irc = line => ws.onmessage && ws.onmessage({ data: line }); setTimeout(() => ws.onopen && ws.onopen(), 5); return ws; }; });
  const p = await ctx.newPage();
  p.on('pageerror', e => pageErrors.push(name + ': ' + e.message));
  p.on('console', m => { if(m.type() === 'error' && !/Failed to load resource|ERR_|WebSocket connection/.test(m.text())) pageErrors.push(name + ' console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  return p;
}
async function closeBrowser(){ await browser?.close(); browser = null; await closeRelays(); }

// Point a panel at a Host the way a saved session does: a session for the panel's room (address, password), then the relay
async function attach(page, host){
  const { pass } = await host.api('/api/code');
  await page.evaluate(([port, pass]) => {
    const list = HudiniStore.get('app.sessions', []).filter(x => x.id !== room);
    list.push({ id: room, name: 'Test', pass, fp: '0'.repeat(64), addrs: [{ h: '127.0.0.1', port, net: 'lan' }], pinned: false, added: Date.now(), last: 0, lastNet: '' });
    HudiniStore.set('app.sessions', list); dropHome(); reopenHome();
  }, [host.modPort, pass]);
}
// Panel + Host + widget wired together, as on a real stream
async function stack({ hostEnv, irc = false, lang = 'ru', w = 1600, h = 900 } = {}){
  const web = await webServer();
  const host = startHost(hostEnv); await host.ready();
  const panel = await newPage('panel', { irc, lang, w, h });
  await panel.goto(`${web.url}/panel/moderator.html`);
  await panel.waitForFunction(() => document.getElementById('link').value.includes('#k='));
  const link = await panel.inputValue('#link');
  const set = await host.api('/api/link', { link });
  await attach(panel, host);
  const online = await until(async () => (await panel.getAttribute('#status', 'class')).includes('ok'), 15000);
  const widget = await newPage('widget', { w: 1920, h: 1080, irc });
  await widget.goto(set.obsLink);
  await until(async () => /OBS: виден · 1920×1080/.test(await panel.textContent('#obsStatus')), 10000);
  return { web, host, panel, widget, link, online, obsLink: set.obsLink,
    async close(){ await host.stop(); await web.close(); await closeRelays(); } };
}
// Fills in the panel's password dialog (#pwDlg) by itself: every item of `list` holds the values of one dialog, in order
async function answerPw(p, list){
  await p.evaluate(list => {
    window.__pwAnswers = list;
    if(window.__pwWatch) return;
    window.__pwWatch = new MutationObserver(() => {
      const d = document.getElementById('pwDlg'); if(!d || d.dataset.done || !window.__pwAnswers.length) return;
      const vals = window.__pwAnswers.shift(); d.dataset.done = '1';
      d.querySelectorAll('input[type=password], input[type=text]').forEach((i, n) => { i.value = vals[n] ?? ''; });
      d.querySelector('form').requestSubmit();
    });
    window.__pwWatch.observe(document.body, { childList: true });
  }, list);
}
function finish(){
  if(pageErrors.length) for(const e of [...new Set(pageErrors)]) check(false, 'page error: ' + e);
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  return bad.length ? 1 : 0;
}
// A sealed asset made the same way the panel does it, using core.js inside a page
module.exports = { answerPw, ROOT, ADMIN_TOKEN, attach, PORTS, sleep, until, check, eq, step, stored, webServer, startHost, newPage, closeBrowser, stack, finish, pageErrors };
