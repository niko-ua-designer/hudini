// Hudini Host: сервер оверлея на ПК стримера.
// • OBS подключается к нему напрямую (localhost): минимальная задержка, без интернета посередине.
// • Модераторы подключаются через бесплатный туннель Cloudflare (с паролем) или через свой адрес.
// • Общий сервер нужен только чтобы пульт нашёл адрес: раз в минуту туда уходит зашифрованное объявление.
//   Всё содержимое (экран, файлы, CS2) идёт только через этот компьютер.
// • Файлы хранятся на диске зашифрованными: программа не может их прочитать, расшифровывает только виджет.
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
import DOCK_HTML from './dock.html' with { type: 'text' };
import I18N_JS from '../i18n.js' with { type: 'text' };

const VERSION = '1.0.0-rc.1';
const PREFIX = 'stream-overlay/v1';
const PUBLIC_BROKER = process.env.OVERLAY_PUBLIC_BROKER || 'wss://broker.emqx.io:8084/mqtt';
const SITE = 'https://niko-ua-designer.github.io/overlay/';
const NO_TUNNEL = !!process.env.OVERLAY_NO_TUNNEL;
const NO_OPEN = !!process.env.OVERLAY_NO_OPEN;

// ---------- папка с настройками: рядом с .exe ----------
const compiled = import.meta.dir.includes('$bunfs') || import.meta.dir.includes('~BUN');
// Портативно: всё (настройки, файлы модераторов, кэш, cloudflared) лежит в папке data рядом с программой.
// Удалил папку с программой, и на компьютере ничего не осталось.
const APP_DIR = compiled ? path.dirname(process.execPath) : import.meta.dir;
const BASE = process.env.OVERLAY_HOST_DIR || path.join(APP_DIR, 'data');
fs.mkdirSync(BASE, { recursive: true });
// Версии до 1.0 хранили всё прямо рядом с .exe: переносим в data
if(compiled && !process.env.OVERLAY_HOST_DIR) for(const f of ['overlay-host.json', 'cache', 'files', 'cloudflared.exe', 'cloudflared']){
  const from = path.join(APP_DIR, f), to = path.join(BASE, f);
  try{ if(fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to); }catch{}
}
const CFG_FILE = path.join(BASE, 'overlay-host.json');
const rnd = n => nodeCrypto.randomBytes(n).toString('base64url');
let cfg = {};
try{ cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); }catch{}
cfg = { port:7777, link:'', modPass:rnd(18), gsiToken:rnd(18), fixedUrl:'', ...cfg };
// Лимиты для файлов модераторов: при первом запуске программа предлагает их поменять (страница управления)
const LIMIT_DEFAULTS = { fileMB:100, totalMB:2048, files:300 };
cfg.limits = { ...LIMIT_DEFAULTS, ...(cfg.limits||{}) };
const saveCfg = () => fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
saveCfg();
// Свой адрес вместо Cloudflare (Tailscale Funnel, свой домен): из настроек или переменной окружения
const fixedUrl = () => process.env.OVERLAY_TUNNEL_URL || cfg.fixedUrl || '';
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
  const r = parseLink(link); if(!r) throw new Error('Это не ссылка из пульта модератора');
  const key = await subtle.importKey('raw', Buffer.from(r.k, 'base64url'), 'AES-GCM', false, ['encrypt','decrypt']);
  const changed = ROOM && (ROOM.room!==r.room || ROOM.k!==r.k);
  if(changed){
    // Новая комната или новые ключи (модератор нажал «Сменить ключи»): старый адрес гасим,
    // пароль модераторов меняем и всех отключаем. Так доступ теряют все, у кого старые ключи.
    await announce({ off:true });
    cfg.modPass = rnd(18);
    kickMods('ключи комнаты сменились');
  }
  AES = key; ROOM = r; cfg.link = link.trim(); saveCfg();
  log('Комната:', r.room);
  restartBridge(); announce(); publishCtl();
}
function kickMods(why){
  let n = 0;
  for(const c of Object.values(aedes.clients)) if(c.conn?._tunnel){ try{ c.close(); n++; }catch{} }
  if(n) log('👤 Отключил модераторов:', n, '—', why);
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
// Кнопки стримера (док в OBS): спрятать оверлей, остановить звуки, пауза модераторов
const ctl = { hidden:false, paused:false, stop:0 };
async function publishCtl(){
  if(!ROOM || !AES) return;
  aedes.publish({ cmd:'publish', topic:T('host'), payload:await sealAES({ ...ctl, t:Date.now() }), qos:1, retain:true, dup:false }, ()=>{});
}
// Защита пароля от перебора: 5 ошибок подряд с одного адреса → пауза 1 мин, потом 2, 4… до 30 мин
const fails = new Map();
function locked(ip){ const f = fails.get(ip), u = Math.max(f?.until||0, globalUntil); return u > Date.now() ? Math.ceil((u-Date.now())/1000) : 0; }
let globalFails = [], globalUntil = 0;
function passOk(ip, pass){
  if(locked(ip) || globalUntil > Date.now()) return false;
  const a = Buffer.from(String(pass||'')), b = Buffer.from(cfg.modPass);
  const ok = a.length===b.length && nodeCrypto.timingSafeEqual(a, b);
  if(ok){ fails.delete(ip); return true; }
  const f = fails.get(ip) || { n:0, until:0, lock:30 };
  if(++f.n >= 5){ f.lock = Math.min(f.lock*2, 1800); f.until = Date.now() + f.lock*1000; f.n = 0; log('⚠ Подбор пароля с', ip, '— пауза', f.lock, 'с'); }
  else log('⚠ Отклонено подключение с неверным паролем');
  fails.set(ip, f);
  // и общий предел: заголовок с адресом можно подделать, поэтому больше 50 ошибок в минуту → пауза для всех новых входов
  const now = Date.now(); globalFails = globalFails.filter(t => now-t < 60000); globalFails.push(now);
  if(globalFails.length > 50){ globalUntil = now + 60000; globalFails = []; log('⚠ Слишком много неверных паролей: новые входы закрыты на 1 мин'); }
  if(fails.size > 1000) for(const [k,v] of fails) if(v.until < Date.now()) fails.delete(k);
  return false;
}
const ipOf = req => String(req.headers['cf-connecting-ip'] || req.socket?.remoteAddress || '?').slice(0, 64);
aedes.authenticate = (client, user, pass, cb) => {
  if(!client.conn?._tunnel) return cb(null, true);
  if(ctl.paused) return cb(Object.assign(new Error('пауза'), { returnCode:5 }), false);   // стример поставил модераторов на паузу   // локальные (OBS) без пароля: сервер слушает только этот ПК
  const ok = user==='mod' && passOk(client.conn._ip, pass);
  cb(ok ? null : Object.assign(new Error('auth'), { returnCode:4 }), ok);
};
// Тема host (кнопки стримера в доке OBS) пишет только сама программа: клиентам туда нельзя
aedes.authorizePublish = (client, packet, cb) => {
  if(!inRoom(packet.topic) || packet.topic.endsWith('/host')) return cb(new Error('чужая тема'));
  if(ctl.paused && client?.conn?._tunnel) return cb(new Error('пауза'));
  cb(null);
};
aedes.authorizeSubscribe = (client, sub, cb) => cb(null, inRoom(sub.topic) ? sub : null);
aedes.on('client', c => { if(c.conn?._tunnel){ status.mods++; log('👤 Модератор подключился'); } else status.obs++; });
aedes.on('clientDisconnect', c => { if(c.conn?._tunnel){ status.mods=Math.max(0,status.mods-1); log('👤 Модератор отключился'); } else status.obs=Math.max(0,status.obs-1); });

function wsServer(tunnel){
  const wss = new WebSocketServer({ noServer:true, handleProtocols: p => p.has('mqtt') ? 'mqtt' : false });
  return (req, socket, head) => {
    if(new URL(req.url, 'http://x').pathname !== '/mqtt'){ socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      const stream = createWebSocketStream(ws); stream._tunnel = tunnel; stream._ip = ipOf(req);
      stream.on('error', ()=>{});
      aedes.handle(stream, req);
    });
  };
}

// ---------- общий сервер: только объявление адреса ----------
// Пульт подписан на зашифрованное объявление (адрес + пароль). Содержимое через общий сервер не ходит.
let pub = null;
function restartBridge(){
  pub?.end(true);
  if(!ROOM) return;
  pub = mqtt.connect(PUBLIC_BROKER, { clientId:'host_'+rnd(6), clean:true, keepalive:30, reconnectPeriod:5000, connectTimeout:10000 });
  pub.on('connect', () => { status.bridge=true; log('🌐 Общий сервер подключён (объявление адреса)'); announce(); });
  pub.on('close', () => { if(status.bridge) log('🌐 Общий сервер отключился'); status.bridge=false; });
  pub.on('error', () => { status.bridge=false; });
}
aedes.on('publish', (packet, client) => {
  if(client && inRoom(packet.topic) && packet.topic.endsWith('/hb') && !client.conn?._tunnel) status.obsSeen = Date.now();
});

// ---------- объявление адреса для пульта ----------
const modUrl = () => fixedUrl() || (status.tunnel ? `wss://${status.tunnel}/mqtt` : null);
async function announce(opt={}){
  if(!ROOM || !AES) return;
  const url = opt.off ? null : modUrl();
  const info = { ver:2, url, user:'mod', pass: url ? cfg.modPass : null, paused:ctl.paused, t:Date.now() };
  const box = await sealAES(info);
  // и в свой брокер: пульт, уже подключённый к программе, узнает о смене адреса или пароля
  aedes.publish({ cmd:'publish', topic:T('srv'), payload:box, qos:1, retain:true, dup:false }, ()=>{});
  if(pub?.connected) await new Promise(r => pub.publish(T('srv'), box, { qos:1, retain:true }, r));
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
// Свой адрес поменяли на странице управления: гасим или поднимаем туннель Cloudflare
function applyFixedUrl(){
  if(fixedUrl()){ try{ tunnelProc?.kill(); }catch{} startTunnel(); }
  else { status.tunnel=null; announce(); if(!tunnelProc) startTunnel(); }
}
async function startTunnel(){
  if(fixedUrl()){ status.tunnel = fixedUrl().replace(/^wss?:\/\//,'').replace(/\/.*$/,''); status.tunnelErr=''; log('Свой адрес для модераторов:', fixedUrl()); announce(); return; }
  if(NO_TUNNEL) return;
  let bin;
  try{ bin = await ensureCloudflared(); }
  catch(e){ status.tunnelErr = e.message; log('⚠ Туннель:', e.message, '— модераторы пока не подключатся, пробую снова через минуту'); setTimeout(startTunnel, 60000); return; }
  log('🚇 Поднимаю туннель для модераторов…');
  tunnelProc = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${TPORT}`], { windowsHide:true });
  const onData = d => {
    // api.trycloudflare.com встречается в сообщениях об ошибках: это не адрес туннеля
    const m = String(d).match(/https:\/\/(?!api\.)([a-z0-9-]+\.trycloudflare\.com)/);
    if(m && m[1]!==status.tunnel){ status.tunnel=m[1]; status.tunnelErr=''; log('✓ Туннель готов:', m[1]); announce(); }
  };
  tunnelProc.stdout.on('data', onData); tunnelProc.stderr.on('data', onData);
  tunnelProc.on('exit', code => {
    tunnelProc=null;
    if(fixedUrl()) return;   // переключились на свой адрес
    status.tunnel=null; announce();
    if(shuttingDown) return;
    status.tunnelErr='туннель упал (код '+code+'), перезапуск через 15 с'; log('⚠', status.tunnelErr);
    setTimeout(startTunnel, 15000);
  });
}

// ---------- CS2 Game State Integration ----------
let lastOwn = null, cs2Local = 0, cs2Pending = null, cs2Timer = null;
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
  if(process.env.OVERLAY_SITE==='off') return;   // тесты: только встроенные файлы
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
const ASSET = { win32:'HudiniHost-windows.exe', linux:'HudiniHost-linux', darwin: os.arch()==='arm64' ? 'HudiniHost-mac-arm64' : 'HudiniHost-mac-intel' }[process.platform];
const startedAt = Date.now();
const upd = { state:'idle', latest:null, err:'', staged:null, auto: cfg.autoUpdate!==false };
// Версии вида 1.0.0 и 1.0.0-rc.1 (rc раньше готовой версии)
const parseVer = v => { const m = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(v||''); return m ? [+m[1], +m[2], +m[3], m[4]==null ? Infinity : +m[4]] : null; };
const cmpVer = (a,b) => { const x=parseVer(a), y=parseVer(b); for(let i=0;i<4;i++) if(x[i]!==y[i]) return x[i]>y[i] ? 1 : -1; return 0; };
// Предварительные версии (rc) получают только те, у кого уже стоит rc. Старые теги host-v… не смотрим.
function pickRelease(list){
  const beta = VERSION.includes('-');
  return (Array.isArray(list) ? list : [list]).filter(x => x && !x.draft && /^v\d+\.\d+\.\d+(-rc\.\d+)?$/.test(x.tag_name||'') && (beta || (!x.prerelease && !x.tag_name.includes('-'))))
    .sort((a,b) => cmpVer(b.tag_name.slice(1), a.tag_name.slice(1)))[0] || null;
}
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
    if(name===want || name.endsWith('/'+want)){
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
    const r=await fetch(process.env.OVERLAY_RELEASES_API || `https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers:{ accept:'application/vnd.github+json', 'user-agent':'HudiniHost' }, signal:AbortSignal.timeout(15000) });
    if(!r.ok) throw new Error('GitHub ответил '+r.status);
    const rel=pickRelease(await r.json()), ver=rel ? rel.tag_name.slice(1) : VERSION;
    upd.latest=ver;
    if(!rel || cmpVer(ver, VERSION)<=0){ upd.state='latest'; return; }
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

// ---------- файлы модераторов на диске ----------
// Пульт шифрует и подписывает файл ключами комнаты, программа хранит байты как есть и отдаёт виджету.
// Лежат в files/<комната>/<id>. Лимиты: размер одного файла, всё место и число файлов (на все комнаты).
const FILES = path.join(BASE, 'files'); fs.mkdirSync(FILES, { recursive:true });
const okId = id => /^[a-z0-9]{8,32}$/i.test(id||'');
const okRoom = r => /^[a-z0-9_-]{4,64}$/i.test(r||'');
const MB = 1048576, PART_MAX = 8*MB + 4096;   // туннель Cloudflare принимает до 100 МБ за запрос, шлём кусками
function scanFiles(){
  const out = new Map();   // "room/id" → { room, id, size, at }
  for(const r of fs.readdirSync(FILES)){
    if(!okRoom(r)) continue;
    let list; try{ list = fs.readdirSync(path.join(FILES, r)); }catch{ continue; }
    for(const f of list){
      const full = path.join(FILES, r, f);
      if(f.endsWith('.part')){ try{ if(Date.now()-fs.statSync(full).mtimeMs > 3600e3) fs.rmSync(full, { force:true }); }catch{} continue; }
      if(!okId(f)) continue;
      try{ const st = fs.statSync(full); out.set(r+'/'+f, { room:r, id:f, size:st.size, at:st.mtimeMs }); }catch{}
    }
  }
  return out;
}
let fileIndex = scanFiles();
function storage(room){
  let used = 0, n = 0, roomUsed = 0, roomN = 0;
  for(const f of fileIndex.values()){ used += f.size; n++; if(f.room===room){ roomUsed += f.size; roomN++; } }
  const L = cfg.limits;
  return { used, files:n, roomUsed, roomFiles:roomN, limitBytes:L.totalMB*MB, maxFiles:L.files, maxFileBytes:L.fileMB*MB, limitsSet:!!cfg.limitsSet };
}
const filePath = (room, id) => path.join(FILES, room, id);
class HttpErr extends Error{ constructor(code, msg, extra){ super(msg); this.code = code; this.extra = extra; } }
function putPart(room, id, part, last, buf){
  if(!okRoom(room) || !okId(id)) throw new HttpErr(400, 'плохое имя файла');
  if(fileIndex.has(room+'/'+id)) throw new HttpErr(409, 'файл уже есть');
  const L = cfg.limits, st = storage(room);
  const tmp = filePath(room, id)+'.part';
  fs.mkdirSync(path.join(FILES, room), { recursive:true });
  if(part===0) fs.rmSync(tmp, { force:true });
  else if(!fs.existsSync(tmp)) throw new HttpErr(409, 'начало файла потерялось, загрузи заново');
  const have = part===0 ? 0 : fs.statSync(tmp).size;
  const size = have + buf.length;
  const full = (why, code='full') => { fs.rmSync(tmp, { force:true }); return new HttpErr(413, why, { reason:code, storage:storage(room) }); };
  if(size > L.fileMB*MB + 65536) throw full(`файл больше ${L.fileMB} МБ`, 'file');
  if(st.files >= L.files) throw full(`уже ${st.files} файлов из ${L.files}`, 'count');
  if(st.used + size > L.totalMB*MB) throw full(`место кончилось: занято ${(st.used/MB).toFixed(0)} из ${L.totalMB} МБ`, 'space');
  fs.appendFileSync(tmp, buf);
  if(last){
    fs.renameSync(tmp, filePath(room, id));
    fileIndex.set(room+'/'+id, { room, id, size, at:Date.now() });
    log('📁 Файл сохранён:', (size/MB).toFixed(1), 'МБ');
  }
  return { ok:true, size, storage:storage(room) };
}
function delFile(room, id){
  if(!okRoom(room) || !okId(id)) return false;
  fs.rmSync(filePath(room, id), { force:true });
  return fileIndex.delete(room+'/'+id);
}
// Удалить всё в комнате, кроме списка, который прислал пульт (то, что на экране, в сценах и библиотеке)
function cleanRoomFiles(room, keep){
  const k = new Set(keep.filter(okId)); let n = 0, bytes = 0;
  for(const f of [...fileIndex.values()]) if(f.room===room && !k.has(f.id)){ bytes += f.size; if(delFile(room, f.id)) n++; }
  if(n) log('🧹 Удалено неиспользуемых файлов:', n, `(${(bytes/MB).toFixed(1)} МБ)`);
  return { ok:true, deleted:n, bytes, storage:storage(room) };
}
function setLimits(l){
  const num = (v, lo, hi) => { const x = Math.round(Number(v)); if(!Number.isFinite(x) || x<lo || x>hi) throw new HttpErr(400, `значение ${v} вне ${lo}…${hi}`); return x; };
  cfg.limits = { fileMB:num(l.fileMB, 1, 4096), totalMB:num(l.totalMB, 10, 1024*1024), files:num(l.files, 1, 100000) };
  cfg.limitsSet = true; saveCfg();
  log('📁 Лимиты для файлов:', cfg.limits.fileMB, 'МБ на файл,', cfg.limits.totalMB, 'МБ всего,', cfg.limits.files, 'файлов');
}

// ---------- HTTP ----------
const okHost = h => h===`localhost:${PORT}` || h===`127.0.0.1:${PORT}`;
const okOrigin = o => o===`http://localhost:${PORT}` || o===`http://127.0.0.1:${PORT}`;
function send(res, code, body, type='text/plain; charset=utf-8', extra={}){
  res.writeHead(code, { 'content-type':type, 'cache-control':'no-store', 'x-content-type-options':'nosniff', ...extra }); res.end(body);
}
function readRaw(req, max){
  return new Promise((ok, no) => { let n=0; const parts=[];
    req.on('data', c => { n+=c.length; if(n>max){ no(new HttpErr(413, 'слишком большой запрос')); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts))); req.on('error', no); });
}
const readBody = async (req, max) => (await readRaw(req, max)).toString('utf8');
const bearer = req => (String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/)||[])[1] || '';
// Пульт открыт на другом сайте (GitHub Pages, приложение): разрешаем запросы с паролем отовсюду.
// Куки не используются, а без пароля через туннель ничего не отдаётся.
const CORS = { 'access-control-allow-origin':'*', 'access-control-allow-methods':'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers':'authorization, content-type', 'access-control-max-age':'600' };
async function filesApi(req, res, url, tunnel){
  const p = url.pathname, extra = tunnel ? CORS : {};
  const j = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', extra);
  if(req.method==='OPTIONS') return send(res, 204, '', 'text/plain', extra);
  if(!ROOM) return j(503, { ok:false, error:'программа ещё не знает комнату: вставь ссылку из пульта' });
  const id = p.startsWith('/files/') ? p.slice(7) : '';
  const room = url.searchParams.get('room') || ROOM.room;
  // Виджет на этом же компьютере читает файлы текущей комнаты без пароля, всё остальное только с паролем модераторов
  if(!(!tunnel && req.method==='GET' && id && room===ROOM.room)){
    const ip = tunnel ? ipOf(req) : 'local', wait = locked(ip);
    if(wait) return j(429, { ok:false, error:`слишком много неверных паролей, подожди ${wait} с` });
    if(!passOk(ip, bearer(req))) return j(401, { ok:false, error:'неверный пароль' });
  }
  const mine = () => [...fileIndex.values()].filter(f => f.room===ROOM.room).map(f => [f.id, f.size]);
  if(req.method==='GET' && p==='/files') return j(200, { ok:true, storage:storage(ROOM.room), ids:mine() });
  if(req.method==='POST' && p==='/files/clean'){
    const { keep } = JSON.parse(await readBody(req, 512*1024));
    if(!Array.isArray(keep)) throw new HttpErr(400, 'нет списка файлов');
    return j(200, cleanRoomFiles(ROOM.room, keep));
  }
  if(!okId(id) || !okRoom(room)) return j(400, { ok:false, error:'плохое имя файла' });
  if(req.method==='GET'){
    const f = fileIndex.get(room+'/'+id); if(!f) return j(404, { ok:false, error:'файла нет' });
    res.writeHead(200, { 'content-type':'application/octet-stream', 'content-length':f.size, 'cache-control':'private, max-age=31536000, immutable', 'x-content-type-options':'nosniff', ...extra });
    fs.createReadStream(filePath(room, id)).on('error', () => res.destroy()).pipe(res);
    return;
  }
  if(room!==ROOM.room) return j(403, { ok:false, error:'менять можно только файлы текущей комнаты' });
  if(req.method==='PUT'){
    const part = Number(url.searchParams.get('part')||0);
    if(!Number.isInteger(part) || part<0 || part>100000) return j(400, { ok:false, error:'плохой номер куска' });
    return j(200, putPart(room, id, part, url.searchParams.get('last')==='1', await readRaw(req, PART_MAX)));
  }
  if(req.method==='DELETE'){ delFile(room, id); return j(200, { ok:true, storage:storage(room) }); }
  return j(405, { ok:false, error:'нельзя' });
}
const errOut = (res, e, extra={}) => { if(res.headersSent) return res.destroy(); send(res, e.code||400, JSON.stringify({ ok:false, error:e.message, ...(e.extra||{}) }), 'application/json', extra); };
function obsLink(){
  if(!ROOM) return '';
  return `http://localhost:${PORT}/widget.html?room=${ROOM.room}&broker=${encodeURIComponent(`ws://localhost:${PORT}/mqtt`)}&v=9#k=${ROOM.k}&p=${ROOM.p}`;
}
const local = http.createServer(async (req, res) => {
  if(!okHost(req.headers.host)) return send(res, 421, 'wrong host');   // защита от DNS-rebinding
  const url = new URL(req.url, `http://localhost:${PORT}`), p = url.pathname;
  try{
    if(p==='/files' || p.startsWith('/files/')) return await filesApi(req, res, url, false);
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
      if(req.method==='POST' && p==='/api/limits'){ setLimits(JSON.parse(await readBody(req, 4096))); return send(res, 200, JSON.stringify({ ok:true, limits:cfg.limits }), 'application/json'); }
      if(req.method==='POST' && p==='/api/fixedurl'){
        const { url:u } = JSON.parse(await readBody(req, 4096)), v = String(u||'').trim();
        if(v && !/^wss:\/\/[a-z0-9.-]+(:\d+)?\/mqtt$/i.test(v)) throw new HttpErr(400, 'адрес должен быть вида wss://мой-адрес/mqtt');
        if(process.env.OVERLAY_TUNNEL_URL) throw new HttpErr(400, 'адрес задан переменной OVERLAY_TUNNEL_URL');
        cfg.fixedUrl = v; saveCfg(); log(v ? 'Свой адрес: '+v : 'Свой адрес убран, возвращаю туннель Cloudflare'); applyFixedUrl();
        return send(res, 200, JSON.stringify({ ok:true }), 'application/json');
      }
      if(req.method==='POST' && p==='/api/control'){
        const { action } = JSON.parse(await readBody(req, 1024));
        if(action==='hide' || action==='show'){ ctl.hidden = action==='hide'; log(ctl.hidden ? '🙈 Стример спрятал оверлей' : '👁 Стример вернул оверлей'); }
        else if(action==='stopsounds'){ ctl.stop++; log('⏹ Стример остановил звуки'); }
        else if(action==='pause' || action==='resume'){ ctl.paused = action==='pause'; if(ctl.paused) kickMods('пауза модераторов'); log(ctl.paused ? '⏸ Модераторы на паузе' : '▶ Модераторы снова могут менять экран'); await announce(); }
        else throw new HttpErr(400, 'неизвестное действие');
        await publishCtl();
        return send(res, 200, JSON.stringify({ ok:true, ctl }), 'application/json');
      }
      if(p==='/api/modpass') return send(res, 200, JSON.stringify({ ok:true, url:modUrl(), pass:cfg.modPass }), 'application/json');
      if(req.method==='POST' && p==='/api/modpass/new'){ cfg.modPass = rnd(18); saveCfg(); kickMods('новый пароль модераторов'); await announce(); return send(res, 200, JSON.stringify({ ok:true }), 'application/json'); }
      if(p==='/api/status') return send(res, 200, JSON.stringify({ version:VERSION, upd:{ state:upd.state, latest:upd.latest, err:upd.err, auto:upd.auto, ready:!!upd.staged, compiled }, room:ROOM?.room||null, obsLink:obsLink(),
        storage:storage(ROOM?.room), limits:cfg.limits, tport:TPORT, ctl, fixedUrl:fixedUrl(), fixedEnv:!!process.env.OVERLAY_TUNNEL_URL,
        ...status, obsOnline: Date.now()-status.obsSeen < 9000, cs2Online: Date.now()-status.cs2Seen < 15000, logs:logs.slice(-40) }), 'application/json');
      if(req.method==='POST' && p==='/api/link'){ const { link } = JSON.parse(await readBody(req, 8192)); await setRoom(link); return send(res, 200, JSON.stringify({ ok:true, obsLink:obsLink() }), 'application/json'); }
      if(req.method==='POST' && p==='/api/gsi/install'){ const f = await installGsi(); return send(res, 200, JSON.stringify({ ok:true, file:f }), 'application/json'); }
      if(p==='/api/gsi/cfg') return send(res, 200, gsiCfgText(), 'application/octet-stream', { 'content-disposition':'attachment; filename="gamestate_integration_streamoverlay.cfg"' });
      return send(res, 404, 'not found');
    }
    if(p==='/' || p==='/index.html') return send(res, 200, UI_HTML, 'text/html; charset=utf-8');
    if(p==='/dock') return send(res, 200, DOCK_HTML, 'text/html; charset=utf-8');
    if(p==='/widget.html'){ if(url.searchParams.has('upd')) await refreshNow(); return send(res, 200, widgetHtml(), 'text/html; charset=utf-8'); }
    if(p==='/core.js') return send(res, 200, files['core.js'], 'application/javascript; charset=utf-8');
    if(p==='/core.css') return send(res, 200, files['core.css'], 'text/css; charset=utf-8');
    if(p==='/i18n.js') return send(res, 200, I18N_JS, 'application/javascript; charset=utf-8');
    if(p==='/mqtt.min.js') return send(res, 200, MQTT_JS, 'application/javascript; charset=utf-8');
    send(res, 404, 'not found');
  }catch(e){ errOut(res, e); }
});
local.on('upgrade', wsServer(false));
// Порт для туннеля: MQTT по WebSocket и файлы с паролем, ничего больше (страница управления наружу не видна)
const tunnelSrv = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try{
    if(p==='/files' || p.startsWith('/files/')) return await filesApi(req, res, url, true);
    send(res, 404, 'Hudini Host', 'text/plain; charset=utf-8', CORS);
  }catch(e){ errOut(res, e, CORS); }
});
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
  try{ status.tunnel = null; await announce({ off:true }); }catch{}
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
