// Shared setup for Hudini end-to-end tests: a stand-in for the public broker, a static web server for the panel,
// a real Hudini Host started from source with Bun, and Chromium pages for the panel and the OBS widget.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MQTT_JS = fs.readFileSync(path.join(__dirname, 'node_modules/mqtt/dist/mqtt.min.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORTS = { pub: 18888, web: 18090, host: 17790 };   // host uses host+1 for the moderators' tunnel port

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
async function publicBroker(){
  const aedes = require('aedes')(), { createServer } = require('aedes-server-factory');
  const srv = createServer(aedes, { ws: true });
  await new Promise(r => srv.listen(PORTS.pub, r));
  return { aedes, url: `ws://localhost:${PORTS.pub}`, close: () => new Promise(r => { srv.close(); aedes.close(r); }) };
}
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.gif':'image/gif' };
async function webServer(){
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()){ res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(PORTS.web, r));
  return { url: `http://localhost:${PORTS.web}`, close: () => new Promise(r => srv.close(r)) };
}
function startHost(env = {}){
  const dir = env.OVERLAY_HOST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-host-'));
  const port = Number(env.OVERLAY_PORT || PORTS.host);
  const proc = spawn('bun', ['run', 'server.js'], { cwd: path.join(ROOT, 'host'), env: { ...process.env,
    OVERLAY_HOST_DIR: dir, OVERLAY_NO_OPEN: '1', OVERLAY_NO_UPDATE: '1', OVERLAY_PORT: String(port),
    OVERLAY_PUBLIC_BROKER: `ws://localhost:${PORTS.pub}`, OVERLAY_TUNNEL_URL: `ws://127.0.0.1:${port + 1}/mqtt`, ...env } });
  let log = ''; proc.stdout.on('data', d => log += d); proc.stderr.on('data', d => log += d);
  const base = `http://localhost:${port}`;
  const host = {
    proc, dir, port, base, tunnel: `http://127.0.0.1:${port + 1}`, log: () => log,
    async api(p, body){
      const r = await fetch(base + p, body === undefined ? {} : { method:'POST', headers:{ 'content-type':'application/json', origin: base }, body: JSON.stringify(body) });
      return r.json();
    },
    async ready(){ return until(async () => (await fetch(base + '/api/status')).ok, 15000); },
    async stop(){ if(proc.exitCode !== null) return; proc.kill('SIGTERM'); await until(() => proc.exitCode !== null, 3000); if(proc.exitCode === null) proc.kill('SIGKILL'); },
  };
  return host;
}

// ---------- browser ----------
let browser = null;
const pageErrors = [];
async function newPage(name, { w = 1600, h = 900, lang = 'ru', irc = false } = {}){
  browser ||= await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route('https://unpkg.com/**', r => r.fulfill({ body: MQTT_JS, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/github\.io|api\.github\.com/, r => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(l => { try{ localStorage.setItem('hudini.lang', l); }catch{} }, lang);
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
async function closeBrowser(){ await browser?.close(); browser = null; }

// Panel + Host + widget wired together, as on a real stream
async function stack({ hostEnv, irc = false } = {}){
  const pub = await publicBroker(), web = await webServer();
  const host = startHost(hostEnv); await host.ready();
  const panel = await newPage('panel', { irc });
  await panel.goto(`${web.url}/moderator.html?broker=${encodeURIComponent(pub.url)}`);
  await panel.waitForFunction(() => document.getElementById('link').value.includes('#k='));
  const link = await panel.inputValue('#link');
  const set = await host.api('/api/link', { link });
  const online = await until(async () => /Hudini Host/.test(await panel.textContent('#status')) && (await panel.getAttribute('#status', 'class')).includes('ok'), 15000);
  const widget = await newPage('widget', { w: 1920, h: 1080 });
  await widget.goto(set.obsLink);
  await until(async () => /OBS: 1920×1080/.test(await panel.textContent('#obsStatus')), 10000);
  return { pub, web, host, panel, widget, link, online, obsLink: set.obsLink,
    async close(){ await host.stop(); await pub.close(); await web.close(); } };
}
function finish(){
  if(pageErrors.length) for(const e of [...new Set(pageErrors)]) check(false, 'page error: ' + e);
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  return bad.length ? 1 : 0;
}
// A sealed asset made the same way the panel does it, using core.js inside a page
module.exports = { ROOT, PORTS, sleep, until, check, eq, step, publicBroker, webServer, startHost, newPage, closeBrowser, stack, finish, pageErrors };
