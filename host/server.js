// Hudini Host: сервер оверлея на ПК стримера.
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
import zlib from 'node:zlib';
import { WebSocketServer, createWebSocketStream } from 'ws';
import createAedes from 'aedes';
import mqtt from 'mqtt';
import WIDGET_HTML from '../widget.html' with { type: 'text' };
import CORE_JS from '../core.js' with { type: 'text' };
import CORE_CSS from '../core.css' with { type: 'text' };
import MQTT_JS from './node_modules/mqtt/dist/mqtt.min.js' with { type: 'text' };
import UI_HTML from './ui.html' with { type: 'text' };
import I18N_JS from '../i18n.js' with { type: 'text' };

const VERSION = '1.4.0';
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
// Закреплённая версия cloudflared и SHA-256 готового бинарника (для macOS: файла внутри .tgz).
// Хеши из release notes Cloudflare, перепроверены скачиванием.
// Обновление: поменять CF_VERSION и хеши из https://github.com/cloudflare/cloudflared/releases
const CF_VERSION = '2026.10.4';
const CF_PINS = {
  'win32-amd64':  { file:'cloudflared-windows-amd64.exe', sha256:'411b16d40c8d872243efeb52c550053d00af0a8a97fbb32e730fb8aba429eaa8' },
  'linux-amd64':  { file:'cloudflared-linux-amd64',       sha256:'ae5e8add7884b0531d66bbca4570d1de491ff6da51e4ebe7eb160cdf241d9e42' },
  'linux-arm64':  { file:'cloudflared-linux-arm64',       sha256:'2b7203b4fb0ba28a0c1e12f8855ce2c25f76d266a8d5edafac5540b6812acff6' },
  'darwin-amd64': { file:'cloudflared-darwin-amd64.tgz',  sha256:'fdec0f9a1c726f4c10283fc0cd70e602d510c72887b737270433c81a08c883a9' },
  'darwin-arm64': { file:'cloudflared-darwin-arm64.tgz',  sha256:'49e7963072b2ca83fb44c09f4d4a7cda52d390c0c9c6f55bac83454a5bc43910' },
};
function cfPin(){
  const arch = os.arch()==='arm64' ? 'arm64' : os.arch()==='x64' ? 'amd64' : os.arch();
  // Windows на ARM запускает amd64-сборку через эмуляцию: отдельной arm64-сборки у Cloudflare нет
  const key = process.platform==='win32' ? 'win32-amd64' : `${process.platform}-${arch}`;
  const pin = CF_PINS[key];
  if(!pin) throw new Error('нет cloudflared для этой системы ('+key+')');
  return pin;
}
const sha256File = p => nodeCrypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function ensureCloudflared(){
  const local = path.join(BASE, cfName());
  const pin = cfPin();
  // Уже скачанный файл тоже проверяем: старые версии программы качали его без проверки
  if(fs.existsSync(local)){
    if(sha256File(local)===pin.sha256) return local;
    log('⚠ cloudflared на диске не совпадает с проверенной версией', CF_VERSION, '— скачиваю заново');
    fs.rmSync(local, { force:true });
  }
  const url = `https://github.com/cloudflare/cloudflared/releases/download/${CF_VERSION}/${pin.file}`;
  log('⬇ Скачиваю cloudflared', CF_VERSION, '(один раз, ~30 МБ)…');
  const res = await fetch(url, { redirect:'follow', signal:AbortSignal.timeout(10*60*1000) });
  if(!res.ok) throw new Error('не скачался cloudflared: HTTP '+res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  // Распаковываем и проверяем во временном месте; на постоянное место кладём только проверенный файл
  const tmpDir = fs.mkdtempSync(path.join(BASE, '.cf-'));
  try{
    let bin;
    if(pin.file.endsWith('.tgz')){
      const tgz = path.join(tmpDir, 'cf.tgz'); fs.writeFileSync(tgz, buf);
      await new Promise((ok, no) => execFile('tar', ['-xzf', tgz, '-C', tmpDir, 'cloudflared'], e => e?no(e):ok()));
      bin = path.join(tmpDir, 'cloudflared');
    } else { bin = path.join(tmpDir, cfName()); fs.writeFileSync(bin, buf); }
    const got = sha256File(bin);
    if(got!==pin.sha256) throw new Error('контрольная сумма cloudflared не совпала, файл удалён');
    fs.chmodSync(bin, 0o755);
    fs.renameSync(bin, local);
  } finally { fs.rmSync(tmpDir, { recursive:true, force:true }); }
  log('✓ cloudflared', CF_VERSION, 'скачан и проверен');
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
    // api.trycloudflare.com встречается в сообщениях об ошибках: это не адрес туннеля
    const m = String(d).match(/https:\/\/(?!api\.)([a-z0-9-]+\.trycloudflare\.com)/);
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
// События игры: считаем здесь, по каждому пакету от CS2, чтобы пульт и виджет получали готовое и ничего не пропускали
let evSeq = Date.now() % 1e9, evs = [], prevOwn = null, prevAll = {}, prevBomb = null, prevRPhase = null;
function addEv(k, extra){ evs.push({ s:++evSeq, k, t:Date.now(), ...extra }); if(evs.length>20) evs.shift(); }
function shortPlayer(p, id){
  const st=p.state||{}, ms=p.match_stats||{};
  const ws=Object.values(p.weapons||{}).filter(Boolean);
  const w=ws.find(x=>x.state==='active') || {};
  const main=ws.find(x=>/Rifle|SniperRifle|Submachine Gun|Shotgun|Machine Gun/.test(x.type||'')) || ws.find(x=>x.type==='Pistol') || {};
  return { id, name:p.name, team:p.team, slot:p.observer_slot, hp:st.health, armor:st.armor, helmet:!!st.helmet, money:st.money,
    rk:st.round_kills, k:ms.kills, d:ms.deaths, a:ms.assists, mvps:ms.mvps, weapon:w.name, main:main.name, ammo:w.ammo_clip, reserve:w.ammo_reserve, ammoMax:w.ammo_clip_max,
    kit:!!st.defusekit, bomb:ws.some(x=>x.name==='weapon_c4'), alive:(st.health??0)>0 };
}
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
  const out = { t:Date.now(), map:map.name, mode:map.mode, phase:map.phase, round:map.round,
    ct:map.team_ct?.score, tt:map.team_t?.score, ctName:map.team_ct?.name, tName:map.team_t?.name,
    rphase:g.round?.phase, bomb:g.bomb?.state || g.round?.bomb, win:g.round?.win_team,
    spectating: !own && p.name ? p.name : null, ...mine };
  // таймер фазы раунда (заморозка / раунд / бомба / разминирование)
  const pc=g.phase_countdowns;
  if(pc && pc.phase_ends_in!=null){ out.pphase=pc.phase; out.pend=Date.now()+Number(pc.phase_ends_in)*1000; }
  // режим наблюдателя: CS2 отдаёт всех игроков (только зрителям, GOTV и кастерам)
  if(g.allplayers){
    out.spec=true;
    out.players=Object.entries(g.allplayers).slice(0,12).map(([id,pl])=>shortPlayer(pl, id));
    if(p.steamid) out.obs=p.steamid;
  }
  if(!own && p.name) out.observed=shortPlayer(p, p.steamid);

  // ---- события ----
  if(own){
    if(prevOwn){
      const dk=(mine.k||0)-(prevOwn.k||0);
      if(dk>0 && dk<6) addEv('kill', { n:dk, name:mine.name, team:mine.team, hs:(mine.rhs||0)>(prevOwn.rhs||0), weapon:mine.weapon, rk:mine.rk||0 });
      if((mine.rk||0)>=2 && (mine.rk||0)>(prevOwn.rk||0)) addEv('multikill', { n:mine.rk, name:mine.name, team:mine.team, hs:mine.rhs||0, weapon:mine.weapon, me:true });
      if((mine.mvps||0)>(prevOwn.mvps||0)) addEv('mvp', { name:mine.name });
      if(prevOwn.alive && !mine.alive) addEv('death', { name:mine.name });
    }
    prevOwn = mine;
  } else if(prevOwn?.alive && lastOwn){ addEv('death', { name:lastOwn.name }); prevOwn = { ...prevOwn, alive:false }; }
  if(out.players){
    for(const pl of out.players){
      const pv=prevAll[pl.id];
      if(pv && (pl.rk||0)>=2 && (pl.rk||0)>(pv.rk||0)) addEv('multikill', { n:pl.rk, name:pl.name, team:pl.team, weapon:pl.weapon });
      prevAll[pl.id]=pl;
    }
  }
  if(out.bomb && out.bomb!==prevBomb && ['planted','defused','exploded'].includes(out.bomb)) addEv('bomb_'+out.bomb, {});
  prevBomb = out.bomb;
  const rp = g.round?.phase;
  if(rp==='over' && prevRPhase && prevRPhase!=='over'){
    const win=g.round?.win_team, my=(own?mine.team:lastOwn?.team)||null;
    addEv('round_end', { win, my, ct:out.ct, tt:out.tt });
  }
  if(rp) prevRPhase = rp;
  out.evs = evs.slice(-10);
  return out;
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
    "allplayers_id"          "1"
    "allplayers_state"       "1"
    "allplayers_match_stats" "1"
    "allplayers_weapons"     "1"
    "phase_countdowns"       "1"
    "bomb"                   "1"
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
  status.gsiPath = file; cfg.gsiFile = file; saveCfg(); log('✓ Файл для CS2 записан:', file);
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
// виджет перезагружается за обновлением: сначала сами берём свежие файлы с сайта
let refreshing=null, lastRefresh=0;
function refreshNow(){ if(Date.now()-lastRefresh<20000) return Promise.resolve(); return refreshing ||= refreshSite().finally(()=>{ refreshing=null; lastRefresh=Date.now(); }); }
function widgetHtml(){
  // mqtt.min.js отдаём свой (та же версия, тот же хеш)
  return files['widget.html'].replace(/src="https:\/\/unpkg\.com\/mqtt@[^"]+"/, 'src="mqtt.min.js"');
}


// ---------- автообновление программы ----------
// Проверяет GitHub Releases, качает .zip для своей системы, сверяет SHA-256 и подменяет себя.
// Посреди стрима не перезапускается: только при старте (пока OBS не подключился), в простое или по кнопке.
const REPO = 'niko-ua-designer/overlay';
const ASSET = { win32:'OverlayHost-windows.exe', linux:'OverlayHost-linux', darwin: os.arch()==='arm64' ? 'OverlayHost-mac-arm64' : 'OverlayHost-mac-intel' }[process.platform];
const startedAt = Date.now();
const upd = { state:'idle', latest:null, err:'', staged:null, auto: cfg.autoUpdate!==false };
const cmpVer = (a,b) => { const x=a.split('.').map(Number), y=b.split('.').map(Number); for(let i=0;i<3;i++) if((x[i]||0)!==(y[i]||0)) return (x[i]||0)-(y[i]||0); return 0; };
function unzipSingle(buf, want){
  let eocd=-1;
  for(let i=buf.length-22; i>=Math.max(0, buf.length-65557); i--) if(buf.readUInt32LE(i)===0x06054b50){ eocd=i; break; }
  if(eocd<0) throw new Error('архив повреждён');
  let p=buf.readUInt32LE(eocd+16); const count=buf.readUInt16LE(eocd+10);
  for(let i=0;i<count;i++){
    if(buf.readUInt32LE(p)!==0x02014b50) throw new Error('архив повреждён');
    const method=buf.readUInt16LE(p+10), csize=buf.readUInt32LE(p+20), usize=buf.readUInt32LE(p+24);
    const nlen=buf.readUInt16LE(p+28), xlen=buf.readUInt16LE(p+30), clen=buf.readUInt16LE(p+32), lho=buf.readUInt32LE(p+42);
    const name=buf.toString('utf8', p+46, p+46+nlen);
    if(name===want){
      const start=lho+30+buf.readUInt16LE(lho+26)+buf.readUInt16LE(lho+28), data=buf.subarray(start, start+csize);
      const out = method===0 ? Buffer.from(data) : method===8 ? zlib.inflateRawSync(data) : null;
      if(!out || out.length!==usize) throw new Error('не распаковался');
      return out;
    }
    p+=46+nlen+xlen+clen;
  }
  throw new Error('в архиве нет '+want);
}
let checking=null;
function checkUpdate(applyIfIdle){ return checking ||= doCheck(applyIfIdle).finally(()=>{ checking=null; }); }
async function doCheck(applyIfIdle){
  if(!compiled || process.env.OVERLAY_NO_UPDATE || !ASSET) { upd.state='off'; return; }
  try{
    upd.state='checking'; upd.err='';
    const r=await fetch(process.env.OVERLAY_RELEASES_API || `https://api.github.com/repos/${REPO}/releases/latest`, { headers:{ accept:'application/vnd.github+json', 'user-agent':'OverlayHost' }, signal:AbortSignal.timeout(15000) });
    if(!r.ok) throw new Error('GitHub ответил '+r.status);
    const rel=await r.json(), ver=String(rel.tag_name||'').replace(/^host-v/,'');
    upd.latest=ver;
    if(!/^\d+\.\d+\.\d+$/.test(ver) || cmpVer(ver, VERSION)<=0){ upd.state='latest'; return; }
    if(upd.staged?.ver!==ver){
      const zipA=rel.assets?.find(a=>a.name===ASSET+'.zip'), sumA=rel.assets?.find(a=>a.name==='SHA256SUMS.txt');
      if(!zipA || !sumA) throw new Error('в релизе нет файла для этой системы');
      upd.state='downloading'; log('⬇ Скачиваю обновление', ver, '…');
      const sums=await (await fetch(sumA.browser_download_url, { signal:AbortSignal.timeout(30000) })).text();
      const line=sums.split('\n').find(l=>l.trim().replace(/^\S+\s+\*?/,'')===zipA.name);
      const want=(line||'').trim().split(/\s+/)[0];
      const zip=Buffer.from(await (await fetch(zipA.browser_download_url, { signal:AbortSignal.timeout(10*60*1000) })).arrayBuffer());
      const got=nodeCrypto.createHash('sha256').update(zip).digest('hex');
      if(!want || got!==want) throw new Error('контрольная сумма не совпала, обновление отменено');
      const staged=process.execPath+'.new';
      fs.writeFileSync(staged, unzipSingle(zip, ASSET)); fs.chmodSync(staged, 0o755);
      upd.staged={ ver, path:staged }; log('✓ Обновление', ver, 'скачано и проверено');
    }
    upd.state='ready';
    if(applyIfIdle && upd.auto && isIdle()) await applyUpdate();
  }catch(e){ upd.state='error'; upd.err=e.message; log('⚠ Обновление:', e.message); }
}
// «Простой»: OBS-виджет не подключён и модераторов нет
function isIdle(){ return status.mods===0 && Date.now()-status.obsSeen > 2*60*1000; }
async function applyUpdate(){
  if(!upd.staged) return;
  log('🔄 Перезапускаюсь с версией', upd.staged.ver, '…');
  const exe=process.execPath, old=exe+'.old';
  try{ fs.rmSync(old, { force:true }); }catch{}
  fs.renameSync(exe, old);               // работающий файл можно переименовать, но не перезаписать
  fs.renameSync(upd.staged.path, exe);
  shuttingDown=true;
  try{ tunnelProc?.kill(); }catch{}
  try{ pub?.end(true); }catch{}
  try{ local.closeAllConnections?.(); local.close(); tunnelSrv.closeAllConnections?.(); tunnelSrv.close(); }catch{}
  const child=spawn(exe, [], { cwd:BASE, detached:true, stdio:'ignore', env:{ ...process.env, OVERLAY_UPDATED:'1' } });
  child.unref();
  setTimeout(()=>process.exit(0), 400);
}
// при старте убираем старую версию, проверяем обновление; потом раз в 3 часа
try{ fs.rmSync(process.execPath+'.old', { force:true }); fs.rmSync(process.execPath+'.new', { force:true }); }catch{}
setTimeout(()=>checkUpdate(true), 4000);
setInterval(()=>checkUpdate(true), 3*60*60*1000);
setInterval(()=>{ if(upd.state==='ready' && upd.auto && isIdle() && Date.now()-startedAt>10*60*1000) applyUpdate(); }, 5*60*1000);

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
  return `http://localhost:${PORT}/widget.html?room=${ROOM.room}&broker=${encodeURIComponent(`ws://localhost:${PORT}/mqtt`)}&v=9#k=${ROOM.k}&p=${ROOM.p}`;
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
      if(req.method==='POST' && p==='/api/update/check'){ await checkUpdate(false); return send(res, 200, JSON.stringify({ ok:true, upd }), 'application/json'); }
      if(req.method==='POST' && p==='/api/update/apply'){ if(!upd.staged) return send(res, 400, JSON.stringify({ ok:false, error:'обновление ещё не скачано' }), 'application/json'); send(res, 200, JSON.stringify({ ok:true }), 'application/json'); setTimeout(applyUpdate, 300); return; }
      if(req.method==='POST' && p==='/api/update/auto'){ const { auto } = JSON.parse(await readBody(req, 1024)); upd.auto=cfg.autoUpdate=!!auto; saveCfg(); return send(res, 200, JSON.stringify({ ok:true, upd }), 'application/json'); }
      if(p==='/api/status') return send(res, 200, JSON.stringify({ version:VERSION, upd:{ state:upd.state, latest:upd.latest, err:upd.err, auto:upd.auto, ready:!!upd.staged, compiled }, room:ROOM?.room||null, obsLink:obsLink(),
        ...status, obsOnline: Date.now()-status.obsSeen < 9000, cs2Online: Date.now()-status.cs2Seen < 15000, logs:logs.slice(-40) }), 'application/json');
      if(req.method==='POST' && p==='/api/link'){ const { link } = JSON.parse(await readBody(req, 8192)); await setRoom(link); return send(res, 200, JSON.stringify({ ok:true, obsLink:obsLink() }), 'application/json'); }
      if(req.method==='POST' && p==='/api/gsi/install'){ const f = await installGsi(); return send(res, 200, JSON.stringify({ ok:true, file:f }), 'application/json'); }
      if(p==='/api/gsi/cfg') return send(res, 200, gsiCfgText(), 'application/octet-stream', { 'content-disposition':'attachment; filename="gamestate_integration_streamoverlay.cfg"' });
      return send(res, 404, 'not found');
    }
    if(p==='/' || p==='/index.html') return send(res, 200, UI_HTML, 'text/html; charset=utf-8');
    if(p==='/widget.html'){ if(url.searchParams.has('upd')) await refreshNow(); return send(res, 200, widgetHtml(), 'text/html; charset=utf-8'); }
    if(p==='/core.js') return send(res, 200, files['core.js'], 'application/javascript; charset=utf-8');
    if(p==='/core.css') return send(res, 200, files['core.css'], 'text/css; charset=utf-8');
    if(p==='/i18n.js') return send(res, 200, I18N_JS, 'application/javascript; charset=utf-8');
    if(p==='/mqtt.min.js') return send(res, 200, MQTT_JS, 'application/javascript; charset=utf-8');
    send(res, 404, 'not found');
  }catch(e){ send(res, 400, JSON.stringify({ ok:false, error:e.message }), 'application/json'); }
});
local.on('upgrade', wsServer(false));
// Порт для туннеля: только MQTT по WebSocket, ничего больше (страница управления наружу не видна)
const tunnelSrv = http.createServer((req, res) => send(res, 404, 'Hudini Host'));
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
  console.log(`\n  ╔══════════════════════════════════════════════╗\n  ║  Hudini Host ${VERSION}                           ║\n  ║  Управление:  http://localhost:${PORT}           ║\n  ║  Не закрывай это окно, пока идёт стрим       ║\n  ╚══════════════════════════════════════════════╝\n`);
  log('Папка настроек:', BASE);
  if(cfg.link){ try{ await setRoom(cfg.link); }catch(e){ log('⚠', e.message); } }
  // если файл для CS2 уже ставили — обновляем его (новые поля), CS2 подхватит при следующем запуске
  if(cfg.gsiFile && fs.existsSync(cfg.gsiFile)){ try{ if(fs.readFileSync(cfg.gsiFile,'utf8')!==gsiCfgText()){ fs.writeFileSync(cfg.gsiFile, gsiCfgText()); log('✓ Файл для CS2 обновлён — перезапусти CS2'); } status.gsiPath=cfg.gsiFile; }catch{} }
  startTunnel();
  if(process.env.OVERLAY_UPDATED) log('✓ Обновлено до версии', VERSION);
  else openBrowser(`http://localhost:${PORT}/`);
});
let portTries=0;
local.on('error', e => {
  if(e.code==='EADDRINUSE' && process.env.OVERLAY_UPDATED && portTries++<30){ setTimeout(()=>local.listen(PORT, '127.0.0.1'), 500); return; }   // старая версия ещё закрывается
  log('⚠ Не могу занять порт', PORT, '—', e.message, '(уже запущено?)'); openBrowser(`http://localhost:${PORT}/`); setTimeout(()=>process.exit(1), 4000);
});
