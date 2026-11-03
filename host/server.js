// Overlay Host: сервер оверлея на ПК стримера.
// • OBS подключается к нему напрямую (localhost) — минимальная задержка, без интернета посередине.
// • Модераторы подключаются через бесплатный туннель Cloudflare (с паролем), адрес пульт находит сам.
// • Мост с публичным брокером: если туннель не поднялся, всё работает по-старому.
// • Принимает живые данные из CS2 (Game State Integration) и отдаёт их оверлею.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, exec, execFile } from 'node:child_process';
import nodeCrypto from 'node:crypto';
import { WebSocketServer, createWebSocketStream } from 'ws';
import createAedes from 'aedes';
import mqtt from 'mqtt';
import WIDGET_HTML from '../widget.html' with { type: 'text' };
import CORE_JS from '../core.js' with { type: 'text' };
import CORE_CSS from '../core.css' with { type: 'text' };
import MQTT_JS from './node_modules/mqtt/dist/mqtt.min.js' with { type: 'text' };
import UI_HTML from './ui.html' with { type: 'text' };

const VERSION = '1.0.0';
const PREFIX = 'stream-overlay/v1';
const PUBLIC_BROKER = process.env.OVERLAY_PUBLIC_BROKER || 'wss://broker.emqx.io:8084/mqtt';
const SITE = 'https://niko-ua-designer.github.io/overlay/';
const NO_TUNNEL = !!process.env.OVERLAY_NO_TUNNEL;
const NO_OPEN = !!process.env.OVERLAY_NO_OPEN;
const FIXED_TUNNEL = process.env.OVERLAY_TUNNEL_URL || '';   // свой адрес вместо Cloudflare (например, свой домен)

// ---------- папка с настройками: рядом с .exe ----------
const compiled = import.meta.dir.includes('$bunfs') || import.meta.dir.includes('~BUN');
const BASE = process.env.OVERLAY_HOST_DIR || (compiled ? path.dirname(process.execPath) : path.join(import.meta.dir, 'data'));
fs.mkdirSync(BASE, { recursive: true });
const CFG_FILE = path.join(BASE, 'overlay-host.json');
const rnd = n => nodeCrypto.randomBytes(n).toString('base64url');
let cfg = {};
try{ cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); }catch{}
cfg = { port:7777, link:'', modPass:rnd(18), gsiToken:rnd(18), ...cfg };
const saveCfg = () => fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
saveCfg();
const PORT = Number(process.env.OVERLAY_PORT) || cfg.port, TPORT = PORT + 1;

// ---------- журнал ----------
const logs = [];
function log(...a){
  const line = new Date().toLocaleTimeString('ru-RU') + '  ' + a.join(' ');
  console.log(line); logs.push(line); if(logs.length>200) logs.shift();
}

// ---------- комната из ссылки для OBS ----------
let ROOM = null, AES = null;
function parseLink(link){
  try{
    const u = new URL(String(link).trim());
    const room = u.searchParams.get('room'), h = new URLSearchParams(u.hash.slice(1));
    if(!/^[a-z0-9_-]{4,64}$/i.test(room||'') || !h.get('k') || !h.get('p')) return null;
    return { room, k:h.get('k'), p:h.get('p') };
  }catch{ return null; }
}
const subtle = globalThis.crypto.subtle;
async function setRoom(link){
  const r = parseLink(link); if(!r) throw new Error('Это не ссылка для OBS из пульта модератора');
  AES = await subtle.importKey('raw', Buffer.from(r.k, 'base64url'), 'AES-GCM', false, ['encrypt','decrypt']);
  ROOM = r; cfg.link = link.trim(); saveCfg();
  log('Комната:', r.room);
  restartBridge(); announce();
}
// Шифруем ключом комнаты (как в core.js, без подписи)
async function sealAES(obj){
  const iv = nodeCrypto.randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name:'AES-GCM', iv }, AES, new TextEncoder().encode(JSON.stringify(obj))));
  const out = new Uint8Array(14 + ct.length); out[0]=1; out[1]=0; out.set(iv, 2); out.set(ct, 14);
  return Buffer.from(out);
}
const T = s => `${PREFIX}/${ROOM.room}/${s}`;
const inRoom = topic => ROOM && topic.startsWith(`${PREFIX}/${ROOM.room}/`);

// ---------- брокер ----------
const aedes = createAedes();
const status = { mods:0, obs:0, obsSeen:0, tunnel:null, tunnelErr:'', bridge:false, cs2Seen:0, cs2:null, gsiPath:'' };
aedes.authenticate = (client, user, pass, cb) => {
  if(!client.conn?._tunnel) return cb(null, true);   // локальные (OBS) — без пароля, сервер слушает только этот ПК
  const a = Buffer.from(String(pass||'')), b = Buffer.from(cfg.modPass);
  const ok = user==='mod' && a.length===b.length && nodeCrypto.timingSafeEqual(a, b);
  if(!ok) log('⚠ Отклонено подключение с неверным паролем');
  const e = ok ? null : Object.assign(new Error('auth'), { returnCode:4 });
  cb(e, ok);
};
aedes.authorizePublish = (client, packet, cb) => cb(inRoom(packet.topic) ? null : new Error('чужая тема'));
aedes.authorizeSubscribe = (client, sub, cb) => cb(null, inRoom(sub.topic) ? sub : null);
aedes.on('client', c => { if(c.conn?._tunnel){ status.mods++; log('👤 Модератор подключился'); } else status.obs++; });
aedes.on('clientDisconnect', c => { if(c.conn?._tunnel){ status.mods=Math.max(0,status.mods-1); log('👤 Модератор отключился'); } else status.obs=Math.max(0,status.obs-1); });

function wsServer(tunnel){
  const wss = new WebSocketServer({ noServer:true, handleProtocols: p => p.has('mqtt') ? 'mqtt' : false });
  return (req, socket, head) => {
    if(new URL(req.url, 'http://x').pathname !== '/mqtt'){ socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      const stream = createWebSocketStream(ws); stream._tunnel = tunnel;
      stream.on('error', ()=>{});
      aedes.handle(stream, req);
    });
  };
}

// ---------- мост с публичным брокером ----------
const recent = new Map();
const fp = buf => nodeCrypto.createHash('sha1').update(buf).digest('base64');
function seenRecently(buf){
  const k = fp(buf), now = Date.now();
  if(recent.has(k)) return true;
  recent.set(k, now);
  if(recent.size>5000) for(const [x,t] of recent) if(now-t>120000) recent.delete(x);
  return false;
}
let pub = null;
function restartBridge(){
  pub?.end(true);
  if(!ROOM) return;
  pub = mqtt.connect(PUBLIC_BROKER, { clientId:'host_'+rnd(6), clean:true, keepalive:30, reconnectPeriod:3000, connectTimeout:10000 });
  pub.on('connect', () => { status.bridge=true; log('🌐 Публичный сервер подключён (мост)'); pub.subscribe([T('state'), T('fx'), T('asset/#')], { qos:1 }); announce(); });
  pub.on('close', () => { if(status.bridge) log('🌐 Публичный сервер отключился'); status.bridge=false; });
  pub.on('error', e => { status.bridge=false; });
  pub.on('message', (topic, payload) => {
    if(!payload.length || !inRoom(topic) || seenRecently(payload)) return;
    const retain = topic.endsWith('/state') || topic.includes('/asset/');
    aedes.publish({ cmd:'publish', topic, payload, qos:1, retain, dup:false }, ()=>{});
  });
}
// то, что прислали локально (модераторы через туннель, виджет), уходит и на публичный сервер
aedes.on('publish', (packet, client) => {
  if(!client || !inRoom(packet.topic)) return;
  if(packet.topic.endsWith('/hb') && !client.conn?._tunnel) status.obsSeen = Date.now();
  if(!pub?.connected) return;
  const t = packet.topic;
  if(!(t.endsWith('/state') || t.endsWith('/fx') || t.endsWith('/hb') || t.includes('/asset/'))) return;
  if(packet.payload.length && seenRecently(packet.payload)) return;
  pub.publish(t, packet.payload, { qos: packet.qos||0, retain: !!packet.retain });
});

// ---------- объявление адреса для пульта ----------
async function announce(){
  if(!ROOM || !AES) return;
  const url = FIXED_TUNNEL || (status.tunnel ? `wss://${status.tunnel}/mqtt` : null);
  const info = { ver:1, url, user:'mod', pass: url ? cfg.modPass : null, t:Date.now() };
  const box = await sealAES(info);
  if(pub?.connected) pub.publish(T('srv'), box, { qos:1, retain:true });
}
setInterval(announce, 60000);

// ---------- туннель Cloudflare ----------
function cfName(){ return process.platform==='win32' ? 'cloudflared.exe' : 'cloudflared'; }
async function ensureCloudflared(){
  const local = path.join(BASE, cfName());
  if(fs.existsSync(local)) return local;
  const arch = os.arch()==='arm64' ? 'arm64' : 'amd64';
  let url;
  if(process.platform==='win32') url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${arch}.exe`;
  else if(process.platform==='linux') url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
  else if(process.platform==='darwin') url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${arch}.tgz`;
  else throw new Error('нет cloudflared для этой системы');
  log('⬇ Скачиваю cloudflared (один раз, ~30 МБ)…');
  const res = await fetch(url, { redirect:'follow' });
  if(!res.ok) throw new Error('не скачался cloudflared: HTTP '+res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if(url.endsWith('.tgz')){
    const tgz = local+'.tgz'; fs.writeFileSync(tgz, buf);
    await new Promise((ok, no) => execFile('tar', ['-xzf', tgz, '-C', BASE], e => e?no(e):ok()));
    fs.unlinkSync(tgz);
  } else fs.writeFileSync(local, buf);
  fs.chmodSync(local, 0o755);
  log('✓ cloudflared скачан');
  return local;
}
let tunnelProc = null;
async function startTunnel(){
  if(FIXED_TUNNEL){ status.tunnel = FIXED_TUNNEL.replace(/^wss?:\/\//,'').replace(/\/.*$/,''); log('Свой адрес для модераторов:', FIXED_TUNNEL); announce(); return; }
  if(NO_TUNNEL) return;
  let bin;
  try{ bin = await ensureCloudflared(); }
  catch(e){ status.tunnelErr = e.message; log('⚠ Туннель:', e.message, '— работаю через публичный сервер'); setTimeout(startTunnel, 60000); return; }
  log('🚇 Поднимаю туннель для модераторов…');
  tunnelProc = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${TPORT}`], { windowsHide:true });
  const onData = d => {
    const m = String(d).match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/);
    if(m && m[1]!==status.tunnel){ status.tunnel=m[1]; status.tunnelErr=''; log('✓ Туннель готов:', m[1]); announce(); }
  };
  tunnelProc.stdout.on('data', onData); tunnelProc.stderr.on('data', onData);
  tunnelProc.on('exit', code => {
    status.tunnel=null; tunnelProc=null; announce();
    if(shuttingDown) return;
    status.tunnelErr='туннель упал (код '+code+'), перезапуск через 15 с'; log('⚠', status.tunnelErr);
    setTimeout(startTunnel, 15000);
  });
}

// ---------- CS2 Game State Integration ----------
let lastOwn = null, cs2Local = 0, cs2Public = 0, cs2Pending = null, cs2Timer = null;
function compactGsi(g){
  const me = g.provider?.steamid, p = g.player || {}, own = !!me && p.steamid === me;
  const st = p.state || {}, ms = p.match_stats || {};
  const w = Object.values(p.weapons || {}).find(x => x && x.state === 'active') || {};
  const map = g.map || {};
  const mine = own ? {
    name:p.name, team:p.team, hp:st.health, armor:st.armor, helmet:!!st.helmet, money:st.money,
    rk:st.round_kills, rhs:st.round_killhs, equip:st.equip_value, k:ms.kills, a:ms.assists, d:ms.deaths,
    mvps:ms.mvps, score:ms.score, weapon:w.name, ammo:w.ammo_clip, ammoMax:w.ammo_clip_max, reserve:w.ammo_reserve, alive:(st.health??0)>0,
  } : { ...(lastOwn||{}), hp:0, alive:false, weapon:null, ammo:null };
  if(own) lastOwn = mine;
  return { t:Date.now(), map:map.name, mode:map.mode, phase:map.phase, round:map.round,
    ct:map.team_ct?.score, tt:map.team_t?.score, rphase:g.round?.phase, bomb:g.round?.bomb, win:g.round?.win_team,
    spectating: !own && p.name ? p.name : null, ...mine };
}
async function pushCs2(data){
  status.cs2 = data; status.cs2Seen = Date.now();
  if(!AES) return;
  cs2Pending = data;
  if(cs2Timer) return;
  const wait = Math.max(0, 100 - (Date.now()-cs2Local));       // локально до 10 раз/с
  cs2Timer = setTimeout(async () => {
    cs2Timer = null; cs2Local = Date.now();
    const box = await sealAES(cs2Pending);
    aedes.publish({ cmd:'publish', topic:T('cs2'), payload:box, qos:0, retain:true, dup:false }, ()=>{});
    if(pub?.connected && Date.now()-cs2Public > 1000){ cs2Public = Date.now(); pub.publish(T('cs2'), box, { qos:0, retain:true }); }
  }, wait);
}
function gsiCfgText(){
  return `"Stream Overlay"
{
  "uri"       "http://127.0.0.1:${PORT}/gsi"
  "timeout"   "1.0"
  "buffer"    "0.1"
  "throttle"  "0.1"
  "heartbeat" "5.0"
  "auth"
  {
    "token" "${cfg.gsiToken}"
  }
  "data"
  {
    "provider"           "1"
    "map"                "1"
    "round"              "1"
    "player_id"          "1"
    "player_state"       "1"
    "player_weapons"     "1"
    "player_match_stats" "1"
  }
}
`;
}
async function steamRoots(){
  const roots = [];
  if(process.platform==='win32'){
    const reg = await new Promise(r => exec('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', (e, out) => r(e ? '' : out)));
    const m = reg.match(/SteamPath\s+REG_SZ\s+(.+)/); if(m) roots.push(m[1].trim());
    roots.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', 'D:\\Steam', 'D:\\SteamLibrary');
  } else {
    const h = os.homedir();
    roots.push(path.join(h,'.steam/steam'), path.join(h,'.local/share/Steam'), path.join(h,'.var/app/com.valvesoftware.Steam/.local/share/Steam'), path.join(h,'Library/Application Support/Steam'));
  }
  return roots;
}
async function findCs2Cfg(){
  const libs = new Set();
  for(const r of await steamRoots()){
    libs.add(r);
    try{
      const vdf = fs.readFileSync(path.join(r, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for(const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(m[1].replace(/\\\\/g, '\\'));
    }catch{}
  }
  for(const l of libs){
    const dir = path.join(l, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg');
    if(fs.existsSync(dir)) return dir;
  }
  return null;
}
async function installGsi(){
  const dir = await findCs2Cfg();
  if(!dir) throw new Error('Не нашёл папку CS2. Скачай файл и положи его вручную в …\\Counter-Strike Global Offensive\\game\\csgo\\cfg');
  const file = path.join(dir, 'gamestate_integration_streamoverlay.cfg');
  fs.writeFileSync(file, gsiCfgText());
  status.gsiPath = file; log('✓ Файл для CS2 записан:', file);
  return file;
}

// ---------- файлы виджета: свежие с сайта, запасные встроены в программу ----------
const CACHE = path.join(BASE, 'cache'); fs.mkdirSync(CACHE, { recursive:true });
const EMBED = { 'widget.html':WIDGET_HTML, 'core.js':CORE_JS, 'core.css':CORE_CSS };
const files = { ...EMBED };
for(const f of Object.keys(files)) try{ files[f] = fs.readFileSync(path.join(CACHE, f), 'utf8'); }catch{}
async function refreshSite(){
  try{
    const got = {};
    for(const f of Object.keys(EMBED)){
      const r = await fetch(SITE+f+'?t='+Date.now(), { signal:AbortSignal.timeout(6000) });
      if(!r.ok) throw new Error(f+': HTTP '+r.status);
      got[f] = await r.text();
    }
    if(!got['widget.html'].includes('core.js')) throw new Error('странный widget.html');
    for(const [f,txt] of Object.entries(got)){ files[f]=txt; fs.writeFileSync(path.join(CACHE, f), txt); }
  }catch(e){ log('⚠ Не обновил файлы виджета с сайта (', e.message, '), использую сохранённые'); }
}
refreshSite(); setInterval(refreshSite, 10*60*1000);
function widgetHtml(){
  // mqtt.min.js отдаём свой (та же версия, тот же хеш)
  return files['widget.html'].replace(/src="https:\/\/unpkg\.com\/mqtt@[^"]+"/, 'src="mqtt.min.js"');
}

// ---------- HTTP ----------
const okHost = h => h===`localhost:${PORT}` || h===`127.0.0.1:${PORT}`;
const okOrigin = o => o===`http://localhost:${PORT}` || o===`http://127.0.0.1:${PORT}`;
function send(res, code, body, type='text/plain; charset=utf-8', extra={}){
  res.writeHead(code, { 'content-type':type, 'cache-control':'no-store', 'x-content-type-options':'nosniff', ...extra }); res.end(body);
}
function readBody(req, max){
  return new Promise((ok, no) => { let n=0; const parts=[];
    req.on('data', c => { n+=c.length; if(n>max){ no(new Error('слишком большой запрос')); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts).toString('utf8'))); req.on('error', no); });
}
function obsLink(){
  if(!ROOM) return '';
  return `http://localhost:${PORT}/widget.html?room=${ROOM.room}&broker=${encodeURIComponent(`ws://localhost:${PORT}/mqtt`)}&v=5#k=${ROOM.k}&p=${ROOM.p}`;
}
const local = http.createServer(async (req, res) => {
  if(!okHost(req.headers.host)) return send(res, 421, 'wrong host');   // защита от DNS-rebinding
  const url = new URL(req.url, `http://localhost:${PORT}`), p = url.pathname;
  try{
    if(req.method==='POST' && p==='/gsi'){
      const g = JSON.parse(await readBody(req, 512*1024));
      if(g?.auth?.token !== cfg.gsiToken) return send(res, 403, 'bad token');
      pushCs2(compactGsi(g));
      return send(res, 200, 'ok');
    }
    if(p.startsWith('/api/')){
      if(req.method==='POST' && !okOrigin(req.headers.origin)) return send(res, 403, 'bad origin');   // защита от чужих сайтов
      if(p==='/api/status') return send(res, 200, JSON.stringify({ version:VERSION, room:ROOM?.room||null, obsLink:obsLink(),
        ...status, obsOnline: Date.now()-status.obsSeen < 9000, cs2Online: Date.now()-status.cs2Seen < 15000, logs:logs.slice(-40) }), 'application/json');
      if(req.method==='POST' && p==='/api/link'){ const { link } = JSON.parse(await readBody(req, 8192)); await setRoom(link); return send(res, 200, JSON.stringify({ ok:true, obsLink:obsLink() }), 'application/json'); }
      if(req.method==='POST' && p==='/api/gsi/install'){ const f = await installGsi(); return send(res, 200, JSON.stringify({ ok:true, file:f }), 'application/json'); }
      if(p==='/api/gsi/cfg') return send(res, 200, gsiCfgText(), 'application/octet-stream', { 'content-disposition':'attachment; filename="gamestate_integration_streamoverlay.cfg"' });
      return send(res, 404, 'not found');
    }
    if(p==='/' || p==='/index.html') return send(res, 200, UI_HTML, 'text/html; charset=utf-8');
    if(p==='/widget.html') return send(res, 200, widgetHtml(), 'text/html; charset=utf-8');
    if(p==='/core.js') return send(res, 200, files['core.js'], 'application/javascript; charset=utf-8');
    if(p==='/core.css') return send(res, 200, files['core.css'], 'text/css; charset=utf-8');
    if(p==='/mqtt.min.js') return send(res, 200, MQTT_JS, 'application/javascript; charset=utf-8');
    send(res, 404, 'not found');
  }catch(e){ send(res, 400, JSON.stringify({ ok:false, error:e.message }), 'application/json'); }
});
local.on('upgrade', wsServer(false));
// Порт для туннеля: только MQTT по WebSocket, ничего больше (страница управления наружу не видна)
const tunnelSrv = http.createServer((req, res) => send(res, 404, 'Overlay Host'));
tunnelSrv.on('upgrade', wsServer(true));

function openBrowser(u){
  if(NO_OPEN) return;
  if(process.platform==='win32') exec(`cmd /c start "" "${u}"`);
  else exec(`${process.platform==='darwin'?'open':'xdg-open'} "${u}"`);
}

let shuttingDown = false;
async function shutdown(){
  if(shuttingDown) return; shuttingDown = true;
  log('Выключаюсь…');
  try{ status.tunnel = null; if(ROOM && AES && pub?.connected) pub.publish(T('srv'), await sealAES({ ver:1, url:null, t:Date.now() }), { qos:1, retain:true }); }catch{}
  tunnelProc?.kill();
  setTimeout(() => process.exit(0), 600);
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

local.listen(PORT, '127.0.0.1', async () => {
  tunnelSrv.listen(TPORT, '127.0.0.1');
  console.log(`\n  ╔══════════════════════════════════════════════╗\n  ║  Overlay Host ${VERSION}                          ║\n  ║  Управление:  http://localhost:${PORT}           ║\n  ║  Не закрывай это окно, пока идёт стрим       ║\n  ╚══════════════════════════════════════════════╝\n`);
  log('Папка настроек:', BASE);
  if(cfg.link){ try{ await setRoom(cfg.link); }catch(e){ log('⚠', e.message); } }
  startTunnel();
  openBrowser(`http://localhost:${PORT}/`);
});
local.on('error', e => { log('⚠ Не могу занять порт', PORT, '—', e.message, '(уже запущено?)'); openBrowser(`http://localhost:${PORT}/`); setTimeout(()=>process.exit(1), 4000); });
