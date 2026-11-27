// Hudini Host: сервер оверлея на ПК стримера.
// • OBS подключается к нему напрямую (localhost): минимальная задержка, без интернета посередине.
// • Модераторы подключаются напрямую: порт для модераторов (TLS, самоподписанный сертификат с отпечатком) открыт
//   на адресах VPN (Tailscale, Radmin, ZeroTier), в локальной сети или через проброс порта; Porthole показывает его как 127.0.0.1.
//   Чужих серверов нет: всё содержимое (экран, файлы, CS2) идёт только через этот компьютер.
// • Файлы хранятся на диске зашифрованными: программа не может их прочитать, расшифровывает только виджет.
// • Принимает живые данные из CS2 (Game State Integration) и отдаёт их оверлею.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { spawn, exec, execFile } from 'node:child_process';
import nodeCrypto from 'node:crypto';
import zlib from 'node:zlib';
import { WebSocketServer, createWebSocketStream } from 'ws';
import { Aedes } from 'aedes';
import selfsigned from 'selfsigned';
import WIDGET_HTML from '../web/widget/widget.html' with { type: 'text' };
import CORE_JS from '../web/shared/core.js' with { type: 'text' };
import CORE_CSS from '../web/shared/core.css' with { type: 'text' };
import MQTT_JS from './node_modules/mqtt/dist/mqtt.min.js' with { type: 'text' };
import UI_HTML from './ui.html' with { type: 'text' };
import DOCK_HTML from './dock.html' with { type: 'text' };
import I18N_JS from '../web/shared/i18n.js' with { type: 'text' };
import ICONS_JS from '../web/shared/icons.js' with { type: 'text' };
import CS2_MAPS_JS from '../web/shared/cs2-maps.js' with { type: 'text' };
import CASE3D_JS from '../web/shared/case3d.js' with { type: 'text' };
import MEDIA_JS from '../web/shared/media.js' with { type: 'text' };
import RADAR_EMBED from './radar-embed.js';
import THREE_JS from '../web/shared/vendor/three.module.min.js' with { type: 'text' };

const VERSION = '1.1.3';
const PREFIX = 'stream-overlay/v1';
const SITE = 'https://niko-ua-designer.github.io/hudini/';
// Роль модератора: сервер не открывает портов, только проверяет и ставит обновления
const ROLE_MOD = process.env.OVERLAY_ROLE === 'mod';
const NO_OPEN = !!process.env.OVERLAY_NO_OPEN;
// Запуск из программы с окном и треем (app/): она читает stdout и держит открытым stdin
const APP = !!process.env.OVERLAY_APP;
const APP_EXE = process.env.OVERLAY_APP_EXE || '';           // файл программы с окном (его перезапускаем после обновления)
const APP_PID = Number(process.env.OVERLAY_APP_PID) || process.ppid;
// Случайный префикс служебных строк для программы с окном (строка журнала их не подделает); он же — токен первого входа в управление
const APP_TOKEN = process.env.OVERLAY_APP_TOKEN || ''; delete process.env.OVERLAY_APP_TOKEN;
let appHidden = false;                                       // окно программы спрятано в трей

// ---------- папка с настройками: рядом с .exe ----------
const compiled = import.meta.dir.includes('$bunfs') || import.meta.dir.includes('~BUN');
// Портативно: всё (настройки, файлы модераторов, кэш, сертификат, журналы) лежит в папке data рядом с программой.
// Удалил папку с программой, и на компьютере ничего не осталось.
const APP_DIR = compiled ? path.dirname(process.execPath) : import.meta.dir;
const BASE = process.env.OVERLAY_HOST_DIR || path.join(APP_DIR, 'data');
fs.mkdirSync(BASE, { recursive: true, mode:0o700 });
// Версии до 1.0 хранили всё прямо рядом с .exe: переносим в data
if(compiled && !process.env.OVERLAY_HOST_DIR) for(const f of ['overlay-host.json', 'cache', 'files']){
  const from = path.join(APP_DIR, f), to = path.join(BASE, f);
  try{ if(fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to); }catch{}
}
const CFG_FILE = path.join(BASE, 'overlay-host.json');
const rnd = n => nodeCrypto.randomBytes(n).toString('base64url');
let cfg = {};
try{ cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); }catch{}
const hadCloudflare = !!cfg.link && !cfg.direct;   // настройки от версии с туннелем Cloudflare
cfg = { port:7777, link:'', modPass:rnd(18), gsiToken:rnd(18), extAddr:'', modsOn:true, name:'Hudini', ...cfg };
delete cfg.fixedUrl;
if(!cfg.direct){ cfg.direct = 1; if(hadCloudflare) cfg.cfNotice = true; }
// cloudflared больше не нужен: убираем скачанный файл
for(const f of ['cloudflared.exe', 'cloudflared']) try{ fs.rmSync(path.join(BASE, f), { force:true }); }catch{}
// Лимиты для файлов модераторов: при первом запуске программа предлагает их поменять (страница управления)
const LIMIT_DEFAULTS = { fileMB:100, totalMB:2048, files:300 };
cfg.limits = { ...LIMIT_DEFAULTS, ...(cfg.limits||{}) };
// в настройках пароль модераторов, токен CS2 и ключи комнаты: файл читает только владелец
const saveCfg = () => { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2), { mode:0o600 }); try{ fs.chmodSync(CFG_FILE, 0o600); }catch{} };
saveCfg();
const okPort = v => { const n = Number(v); return Number.isInteger(n) && n>=1024 && n<=65534 ? n : 0; };
// PORT — страница управления и виджет (только этот компьютер); MPORT — порт для модераторов (TLS, снаружи)
const PORT = okPort(process.env.OVERLAY_PORT) || okPort(cfg.port) || 7777;
const MPORT = okPort(process.env.OVERLAY_MOD_PORT) || okPort(cfg.modPort) || PORT + 1;

// ---------- журнал ----------
// В памяти последние строки (для страницы управления), на диске data/logs/host-ГГГГ-ММ-ДД.log (7 дней)
const LOGS_DIR = path.join(BASE, 'logs'); fs.mkdirSync(LOGS_DIR, { recursive:true, mode:0o700 });
const logs = [], connLogs = [];
// В журнал и краш-отчёт не попадает имя пользователя ПК: домашняя папка → ~, C:\\Users\\<имя> → C:\\Users\\<user>
function maskPath(p){
  let t = String(p);
  try{ const h = os.homedir(); if(h && h.length > 3) for(const v of new Set([h, h.replace(/\\/g, '/'), h.replace(/\//g, '\\')])) t = t.split(v).join('~'); }catch{}
  return t.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s:*?"<>|]+/gi, '$1<user>').replace(/(^|[\s'"(=])(\/(?:home|Users)\/)[^\/\s'")]+/g, '$1$2<user>');
}
const dayStamp = (d=new Date()) => d.toLocaleDateString('sv-SE');
function emitLog(conn, a){
  const text = maskPath(a.join(' ')).replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 2000);   // one plain line: no control characters, no runaway length
  const line = new Date().toLocaleTimeString('ru-RU') + '  ' + text;
  console.log(line); logs.push(line); if(logs.length>200) logs.shift();
  if(conn){ connLogs.push(line); if(connLogs.length>200) connLogs.shift(); }
  try{ fs.appendFileSync(path.join(LOGS_DIR, `host-${dayStamp()}.log`), new Date().toISOString() + (conn ? '  [conn]  ' : '  ') + text + '\n', { mode:0o600 }); }catch{}
}
const log = (...a) => emitLog(false, a);
const logc = (...a) => emitLog(true, a);   // события подключений: у них свой фильтр на странице управления
function pruneLogs(){
  const old = dayStamp(new Date(Date.now() - 7*864e5));
  try{ for(const f of fs.readdirSync(LOGS_DIR)){
    const m = /^host-(\d{4}-\d\d-\d\d)\.log$/.exec(f);
    if(m && m[1] < old) fs.rmSync(path.join(LOGS_DIR, f), { force:true });
  } }catch{}
}
pruneLogs(); setInterval(pruneLogs, 6*3600e3);
// Падение: стек в crash-<дата-время>.log и код 70. Обычное закрытие (QUIT, SIGTERM, выключение ПК) крашем не считается.
let shuttingDown = false;
function crash(kind, e){
  if(shuttingDown) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const text = maskPath(`${kind} ${new Date().toISOString()}\nHudini ${VERSION} ${process.platform} ${os.arch()}\n\n${e?.stack || e}\n\nПоследние строки журнала:\n${logs.slice(-30).join('\n')}\n`);
  try{ fs.writeFileSync(path.join(LOGS_DIR, `crash-${stamp}.log`), text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' '), { mode:0o600 }); }catch{}
  try{ console.error(text); }catch{}
  process.exit(70);
}
process.on('uncaughtException', e => crash('uncaughtException', e));
process.on('unhandledRejection', e => crash('unhandledRejection', e));

// ---------- комната ----------
const ROOM_ABC = 'abcdefghijkmnpqrstuvwxyz23456789';
let ROOM = null, AES = null, PUB = null;   // PUB — открытый ключ подписи модераторов (проверка экрана для дока)
function parseLink(link){
  try{
    const u = new URL(String(link).trim());
    const room = u.searchParams.get('room'), h = new URLSearchParams(u.hash.slice(1));
    if(!/^[a-z0-9_-]{4,64}$/i.test(room||'') || !h.get('k') || !h.get('p')) return null;
    return { room, k:h.get('k'), p:h.get('p') };
  }catch{ return null; }
}
const subtle = globalThis.crypto.subtle;
// Новые ключи комнаты: AES-256 (общий, есть у виджета) и пара ECDSA P-256 (закрытая половина только у модераторов), как в core.js
async function newRoom(name){
  const aes = nodeCrypto.randomBytes(32);
  const pair = await subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign', 'verify']);
  const code = Array.from(nodeCrypto.randomBytes(16), x => ROOM_ABC[x % ROOM_ABC.length]).join('');
  return { code, name:String(name||cfg.name||'Hudini').slice(0, 40), k:aes.toString('base64url'),
    p:Buffer.from(await subtle.exportKey('raw', pair.publicKey)).toString('base64url'), s:await subtle.exportKey('jwk', pair.privateKey) };
}
const linkOf = r => `http://localhost:${PORT}/widget/widget.html?room=${r.code}#k=${r.k}&p=${r.p}`;
// full — комната, созданная этой программой (с закрытым ключом, из неё собирается код для модератора)
async function setRoom(link, full){
  const r = parseLink(link); if(!r) throw new Error('Это не ссылка из пульта модератора');
  const key = await subtle.importKey('raw', Buffer.from(r.k, 'base64url'), 'AES-GCM', false, ['encrypt','decrypt']);
  const pub = await subtle.importKey('raw', Buffer.from(r.p, 'base64url'), { name:'ECDSA', namedCurve:'P-256' }, false, ['verify']);
  const changed = ROOM && (ROOM.room!==r.room || ROOM.k!==r.k);
  if(changed){
    // Новая комната или новые ключи: пароль модераторов меняем и всех отключаем. Так доступ теряют все, у кого старые ключи.
    cfg.modPass = rnd(18);
    kickMods('room keys changed');
    screen = null; ctl.hideIds = []; cfg.hideIds = [];   // элементы старой комнаты доку больше не нужны
    keepReset();   // и списки файлов, нужных модераторам
    dropPanelSessions();   // пульт стримера войдёт заново с новыми ключами
  }
  PUB = pub;
  if(full) cfg.room = full;
  else if(!(cfg.room && cfg.room.code===r.room && cfg.room.k===r.k)) delete cfg.room;
  AES = key; ROOM = r; cfg.link = link.trim(); saveCfg();
  log('Room ready');
  announce(); publishCtl(); publishPerms(); publishSeries(true);
}
async function createRoom(name){
  const full = await newRoom(name);
  if(name) cfg.name = full.name;
  await setRoom(linkOf(full), full);
  delete cfg.linkSet; saveCfg();
}
function kickMods(why){
  let n = 0;
  for(const c of Object.values(aedes.clients)) if(c.conn?._mod){ try{ c.close(); n++; }catch{} }
  if(n) logc('👤 Disconnected moderators:', n, '—', why);
}
// Пауза: сначала пульты получают весть о ней (тема host), потом их соединения закрываются. Присланное за это время отбрасывается
const PAUSE_NOTICE_MS = 300;
async function pauseMods(){
  await publishCtl();
  await new Promise(r => setTimeout(r, PAUSE_NOTICE_MS));
  if(ctl.paused) kickMods('moderators paused');
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

// ---------- TLS: самоподписанный сертификат с отпечатком ----------
// Модератор получает отпечаток (SHA-256 сертификата) в коде и сверяет его при подключении: имя и цепочка не нужны.
let TLS = { key:'', cert:'', fp:'' };
const fpOf = x => x.fingerprint256.replace(/:/g, '').toLowerCase();
async function ensureTls(){
  const dir = path.join(BASE, 'tls'); fs.mkdirSync(dir, { recursive:true, mode:0o700 });
  const kf = path.join(dir, 'key.pem'), cf = path.join(dir, 'cert.pem');
  try{
    const key = fs.readFileSync(kf, 'utf8'), cert = fs.readFileSync(cf, 'utf8'), x = new nodeCrypto.X509Certificate(cert);
    if(Date.parse(x.validTo) > Date.now() + 30*864e5 && x.checkPrivateKey(nodeCrypto.createPrivateKey(key))){ TLS = { key, cert, fp:fpOf(x) }; return; }
    log('⚠ Certificate is expiring, issuing a new one: old moderator codes will stop working');
  }catch{}
  const pems = await selfsigned.generate([{ name:'commonName', value:'Hudini' }], { notAfterDate:new Date(Date.now() + 3650*864e5), keySize:2048, algorithm:'sha256' });
  fs.writeFileSync(kf, pems.private, { mode:0o600 }); fs.writeFileSync(cf, pems.cert, { mode:0o600 });
  TLS = { key:pems.private, cert:pems.cert, fp:fpOf(new nodeCrypto.X509Certificate(pems.cert)) };
  log('🔐 Moderator certificate created');
}
await ensureTls();

// ---------- адреса, по которым можно подключиться ----------
// Подпись сети по адресу: так пульт показывает, через что идёт связь
const NET_LABEL = { tailscale:'Tailscale', radmin:'Radmin VPN', hamachi:'Hamachi', zerotier:'ZeroTier', lan:'Local network', inet:'Internet', porthole:'Porthole', ext:'Custom address' };
function netOf(ip, ifname=''){
  const a = String(ip).replace(/^::ffff:/, '');
  if(/^127\./.test(a) || a==='::1') return 'porthole';
  const [o1, o2] = a.split('.').map(Number);
  if(o1===100 && o2>=64 && o2<=127) return 'tailscale';
  if(o1===26) return 'radmin';
  if(o1===25) return 'hamachi';
  if(/^(zt|feth)/i.test(ifname)) return 'zerotier';
  if(o1===10 || (o1===172 && o2>=16 && o2<=31) || (o1===192 && o2===168)) return 'lan';
  return 'inet';
}
const NET_ORDER = ['tailscale', 'radmin', 'hamachi', 'zerotier', 'lan', 'inet'];
// В журнал адрес попадает только в маске: журнал копируют и показывают, а полный адрес модератора там не нужен.
// 100.64.3.12 → 100.x.x.12, fd7a:115c::1234 → fd7a:x:1234, my-pc.example.com → m…example.com
function maskHost(h){
  const a = String(h).replace(/^::ffff:/, '');
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(a)){ const p = a.split('.'); return `${p[0]}.x.x.${p[3]}`; }
  if(a.includes(':')){ const g = a.split(':'); return `${g[0] || ':'}:x:${g[g.length-1]}`; }
  const p = a.split('.');
  return p.length>1 ? `${p[0].slice(0, 1)}…${p.slice(1).join('.')}` : a.slice(0, 1) + '…';
}
// «100.x.x.12 (Tailscale)»
const who = ip => ip==='local' ? 'this computer' : `${maskHost(ip)} (${NET_LABEL[netOf(ip)]})`;   // 'local' — виджет OBS на порту стримера
// «my-pc.example.com:7778» → «m…example.com:7778»
const maskAddr = v => String(v).replace(/^(.*?)(:\d{1,5})?$/, (_, h, port) => maskHost(h) + (port || ''));
const fmtDur = sec => sec<60 ? `${sec} s` : sec<3600 ? `${Math.floor(sec/60)} min ${sec%60} s` : `${Math.floor(sec/3600)} h ${Math.floor(sec%3600/60)} min`;
// Отказ входа с причиной. С одного адреса одна и та же причина пишется не чаще раза в 10 секунд: перебор не должен забивать журнал
const refusedAt = new Map();
function refuse(ip, why){
  const k = ip + '|' + why, now = Date.now();
  if(now - (refusedAt.get(k)||0) < 10000) return;
  refusedAt.set(k, now);
  if(refusedAt.size > 500) for(const [x, t] of refusedAt) if(now - t > 10000) refusedAt.delete(x);
  logc('🚫 Login refused:', who(ip), '—', why);
}
function parseExt(v){
  const m = /^([a-z0-9.-]+):(\d{1,5})$/i.exec(String(v||'').trim());
  return m && +m[2]>=1 && +m[2]<=65535 ? { h:m[1], port:+m[2], net:'ext' } : null;
}
function addresses(){
  const out = [];
  for(const [name, list] of Object.entries(os.networkInterfaces())) for(const a of list||[]){
    if(a.family!=='IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
    out.push({ h:a.address, port:MPORT, net:netOf(a.address, name) });
  }
  out.sort((x, y) => NET_ORDER.indexOf(x.net) - NET_ORDER.indexOf(y.net));
  const ext = parseExt(cfg.extAddr); if(ext) out.push(ext);
  out.push({ h:'127.0.0.1', port:MPORT, net:'porthole' });   // Porthole открывает порт стримера у модератора на 127.0.0.1
  return out;
}
// Код для модератора: комната, пароль, отпечаток сертификата и адреса одной строкой
function modCode(){
  if(!ROOM) return '';
  const o = { v:1, name:cfg.name || 'Hudini', room:ROOM.room, ...(cfg.room?.s ? { k:ROOM.k, p:ROOM.p, s:cfg.room.s } : {}),
    pass:cfg.modPass, fp:TLS.fp, addrs:addresses() };
  return 'hudini1:' + Buffer.from(JSON.stringify(o)).toString('base64url');
}
const addrKey = () => addresses().map(a => `${a.h}:${a.port} ${a.net}`).join(', ');
const addrText = () => addresses().map(a => `${maskHost(a.h)}:${a.port} ${a.net}`).join(', ');   // для журнала: адреса в маске
let lastAddrs = '';
setInterval(() => {
  const now = addrKey();
  if(now!==lastAddrs){ lastAddrs = now; log('🌐 Moderator addresses:', addrText()); }
}, 30000);

// ---------- брокер ----------
const aedes = await Aedes.createBroker({ connectTimeout:10000 });   // aedes 1.x: брокер запускается асинхронно
const status = { mods:0, obs:0, obsSeen:0, cs2Seen:0, cs2:null, gsiPath:'' };
// CS2 в журнале: данные от игры появились / перестали идти (порог 15 с, как у статуса «CS2 онлайн»), проверка раз в 5 с
let cs2Up = false;
setInterval(() => {
  const up = Date.now()-status.cs2Seen < 15000;
  if(up!==cs2Up){ cs2Up = up; logc(up ? '🎯 CS2 appeared: data is flowing' : '🎯 CS2 gone: no data for over 15 s'); }
}, 5000);
const modList = new Map();   // id клиента → { ip, net, since, rtt } для страницы управления
// Кнопки стримера (док в OBS): спрятать оверлей, остановить звуки, пауза модераторов
// и быстрые выключатели «на стриме сейчас» (off: чат, CS2-HUD, звуки, рисунки, эффекты; применяет виджет, переживают перезапуск)
const OFF_KEYS = ['chat', 'cs2', 'sound', 'draw', 'fx', 'tab'];
const OFF_NAMES = { chat:'chat', cs2:'CS2 HUD', sound:'sounds', draw:'drawings', fx:'effects', tab:'CS2 auto-tab' };
const cleanOff = o => Object.fromEntries(OFF_KEYS.map(k => [k, o?.[k]===true]));
// hideIds — элементы, которые стример спрятал глазиком в доке: их прячет только виджет, экран модераторов не меняется
const cleanIds = a => [...new Set((Array.isArray(a) ? a : []).filter(x => typeof x==='string' && x.length>0 && x.length<=40))].slice(0, 200);
const ctl = { hidden:false, paused:false, stop:0, off:cleanOff(cfg.ctlOff), hideIds:cleanIds(cfg.hideIds), mediaOff:cfg.mediaOff===true };
async function publishCtl(){
  if(!ROOM || !AES) return;
  aedes.publish({ cmd:'publish', topic:T('host'), payload:await sealAES({ ...ctl, t:Date.now() }), qos:1, retain:true, dup:false }, ()=>{});
}
// Права модераторов: четыре галочки стримера. Выключенное виджет не показывает (главная защита, на ПК стримера),
// пульт прячет кнопки. Тему perms публикует только программа: ни модератор, ни виджет её не подделают.
// cam, screen, mic (камера, экран, микрофон модератора) по умолчанию ВЫКЛЮЧЕНЫ: включается только явным true
const PERM_KEYS = ['av', 'web', 'fx', 'games', 'cam', 'screen', 'mic'];
const DEFAULT_OFF = ['cam', 'screen', 'mic'];
const MEDIA_KINDS = ['cam', 'screen', 'mic'];
const PERM_NAMES = { av:'sounds and video', web:'sites and files', fx:'chat, drawing, effects', games:'cases, giveaways, polls, CS2',
  cam:"moderator's camera", screen:"moderator's screen", mic:"moderator's microphone" };
const cleanPerms = p => Object.fromEntries(PERM_KEYS.map(k => [k, DEFAULT_OFF.includes(k) ? p?.[k] === true : p?.[k] !== false]));
cfg.perms = cleanPerms(cfg.perms);
// Общий выключатель «все трансляции модераторов» (док): пока он стоит, камера, экран и микрофон модераторов выключены независимо от ползунков
const effPerms = () => ctl.mediaOff ? { ...cfg.perms, cam:false, screen:false, mic:false } : cfg.perms;
async function publishPerms(){
  if(!ROOM || !AES) return;
  aedes.publish({ cmd:'publish', topic:T('perms'), payload:await sealAES({ ...effPerms(), t:Date.now() }), qos:1, retain:true, dup:false }, ()=>{});
}
// ---------- пульт стримера на этом компьютере («Открыть пульт») ----------
// Локальный адрес сам по себе доступа не даёт: в localhost может стучаться любая программа и любая страница на ПК.
// Вход только по одноразовому ключу, который программа сама передаёт своему окну: 32 случайных байта, живёт 60 с,
// хранится только хэш, сгорает при первой попытке. Ключ меняется на сессию «стример-пульт»: свой логин для MQTT
// и ключи комнаты. Ни ключ, ни сессия не пишутся в журнал, краш-отчёт, /api/status и адрес (только во фрагменте #).
// Страницы пульта: окно приложения (tauri) и, для разработки и тестов, адрес из OVERLAY_PANEL_ORIGIN.
const DEV_PANEL = String(process.env.OVERLAY_PANEL_ORIGIN || '').split(',').map(s => s.trim()).filter(s => /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(s));
const PANEL_ORIGINS = new Set(['tauri://localhost', 'https://tauri.localhost', 'http://tauri.localhost', ...DEV_PANEL]);
const PANEL_KEY_MS = Math.min(60000, Math.max(200, Number(process.env.OVERLAY_PANEL_KEY_MS) || 60000));   // меньше — только в тестах
const sha256 = s => nodeCrypto.createHash('sha256').update(String(s)).digest();
const panelKeys = [];   // { h: sha256(ключа), exp, used }
function newPanelKey(){
  const now = Date.now();
  for(let i = panelKeys.length-1; i>=0; i--) if(now - panelKeys[i].exp > 600000) panelKeys.splice(i, 1);
  if(panelKeys.length >= 20) panelKeys.splice(0, panelKeys.length-19);
  const key = rnd(32);
  panelKeys.push({ h:sha256(key), exp:now + PANEL_KEY_MS, used:false });
  return key;
}
// '' — ключ годен (и уже сгорел), иначе причина отказа для журнала
function takePanelKey(key){
  if(typeof key!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(key)) return 'no key';
  const h = sha256(key), k = panelKeys.find(x => nodeCrypto.timingSafeEqual(x.h, h));
  if(!k) return 'unknown key';
  if(k.used) return 'key already used';
  k.used = true;
  return Date.now() > k.exp ? 'key expired' : '';
}
const panelSessions = new Map();   // hex sha256(пароля сессии) → { since, room }
function newPanelSession(){
  const pass = rnd(32);
  if(panelSessions.size >= 8) panelSessions.delete(panelSessions.keys().next().value);
  panelSessions.set(sha256(pass).toString('hex'), { since:Date.now(), room:ROOM.room });
  return pass;
}
const panelSessionOk = pass => { if(!pass) return false; const s = panelSessions.get(sha256(pass).toString('hex')); return !!s && s.room===ROOM?.room; };
const ownRoom = () => !!(ROOM && cfg.room?.s && cfg.room.code===ROOM.room && cfg.room.k===ROOM.k);
const panelUrl = () => DEV_PANEL[0] ? DEV_PANEL[0] + '/panel/moderator.html' : '';
function dropPanelSessions(){
  panelSessions.clear();
  for(const c of Object.values(aedes.clients)) if(c.conn?._streamer){ try{ c.close(); }catch{} }
}

// Защита пароля от перебора: 5 ошибок подряд с одного адреса → пауза 1 мин, потом 2, 4… до 30 мин
const fails = new Map();
// Общей блокировки для всех нет: пароль — 18 случайных байт, подобрать его нельзя, а общий замок позволял кому угодно запереть всех модераторов
// Porthole: все гости приходят с 127.0.0.1, блокировать «адрес» нельзя; для loopback только ограничение частоты (5 ошибок в минуту)
const isLoop = ip => /^(127\.|::1$|::ffff:127\.)/.test(ip);
const loopFails = [];
function locked(ip){
  if(isLoop(ip)){
    const now = Date.now(); while(loopFails.length && now-loopFails[0] > 60000) loopFails.shift();
    return loopFails.length>=5 ? Math.ceil((60000-(now-loopFails[0]))/1000) : 0;
  }
  const f = fails.get(ip), u = f?.until||0; return u > Date.now() ? Math.ceil((u-Date.now())/1000) : 0;
}
function passOk(ip, pass){
  // Porthole: верный пароль пускает всегда (иначе один гость запер бы остальных на минуту); перебор 144-битного пароля бессмыслен
  if(locked(ip) && !isLoop(ip)){ refuse(ip, 'limit: pause after wrong passwords'); return false; }
  const a = Buffer.from(String(pass||'')), b = Buffer.from(cfg.modPass);
  const ok = a.length===b.length && nodeCrypto.timingSafeEqual(a, b);
  if(ok){ fails.delete(ip); return true; }
  if(isLoop(ip)){
    if(!locked(ip)){ loopFails.push(Date.now()); refuse(ip, 'wrong password'); }
    else refuse(ip, 'limit: 5 wrong passwords per minute');
    return false;
  }
  const f = fails.get(ip) || { n:0, until:0, lock:30 };
  if(++f.n >= 5){ f.lock = Math.min(f.lock*2, 1800); f.until = Date.now() + f.lock*1000; f.n = 0; logc('⚠ Password guessing from', who(ip), '— pause', f.lock, 's'); }
  else refuse(ip, 'wrong password');
  fails.set(ip, f);
  if(fails.size > 1000) for(const [k,v] of fails) if(v.until < Date.now()) fails.delete(k);
  return false;
}
// Адрес — только из сокета: заголовкам вроде cf-connecting-ip верить нельзя
const ipOf = req => String(req.socket?.remoteAddress || '?').slice(0, 64);
// Секрет возобновления: пульт придумывает его при запуске и присылает в адресе подключения (внутри TLS), программа держит
// только хэш и только пока живо соединение. По нему тот же пульт, сменивший сеть, узнаётся с нового адреса.
const RESUME_RE = /^[A-Za-z0-9_-]{22,128}$/;
const samePanel = (a, b) => !!(a.conn._resume && b.conn._resume) && nodeCrypto.timingSafeEqual(a.conn._resume, b.conn._resume);
aedes.authenticate = (client, user, pass, cb) => {
  // Занятый clientId не отбирают: ни другой тип клиента (пульт стримера, виджет, модератор), ни модератор с другого адреса
  // без секрета того же пульта. Старое соединение закрывает брокер, и только после того, как новое прошло все проверки ниже
  const prev = client.id ? aedes.clients[client.id] : null;
  let moved = null;
  if(prev && prev!==client && prev.conn && prev.connected!==false){
    const kindOf = c => c.conn._mod ? 'mod' : c.conn._streamer ? 'streamer' : 'widget';
    // новое соединение ещё не вошло: пульт стримера узнаём по логину (пароль проверяется ниже)
    const kind = client.conn?._mod ? 'mod' : user==='streamer' ? 'streamer' : 'widget';
    const away = !!client.conn?._mod && prev.conn._ip!==client.conn._ip;
    if(kindOf(prev)!==kind || (away && !samePanel(prev, client))){
      refuse(client.conn?._mod ? client.conn._ip : 'local', 'clientId already in use');
      return cb(Object.assign(new Error('id'), { returnCode:2 }), false);
    }
    if(away) moved = prev;
  }
  if(!client.conn?._mod){
    if(user==='streamer'){   // пульт стримера на этом ПК: только с сессией, полученной за одноразовый ключ
      if(!panelSessionOk(String(pass||''))){ refuse('local', 'streamer panel: login expired'); return cb(Object.assign(new Error('auth'), { returnCode:4 }), false); }
      client.conn._streamer = true; return cb(null, true);
    }
    // со страницы пульта без входа нельзя; другого логина на этом порту нет (виджет входит без логина)
    if(client.conn?._panel || user) return cb(Object.assign(new Error('auth'), { returnCode:4 }), false);
    return cb(null, true);   // виджет OBS без пароля: порт слушает только этот ПК, писать он может только пульс
  }
  if(ctl.paused){ refuse(client.conn._ip, 'moderators paused'); return cb(Object.assign(new Error('пауза'), { returnCode:5 }), false); }   // стример поставил модераторов на паузу
  if(!cfg.modsOn){ refuse(client.conn._ip, 'entrance closed'); return cb(Object.assign(new Error('off'), { returnCode:3 }), false); }   // 3: сервер не принимает
  const ok = user==='mod' && passOk(client.conn._ip, pass);
  if(ok) client.conn._authed = true;   // снимает лимит PRE_AUTH в wsServer
  if(ok && moved) logc('👤 Moderator is back from another address, replacing the old connection:', who(moved.conn._ip), '→', who(client.conn._ip));
  cb(ok ? null : Object.assign(new Error('auth'), { returnCode:4 }), ok);
};
// Кто что пишет: модераторы — только экран (state), эффекты (fx) живые штрихи рисунка (ink) и команды серии CS2 (cs2cmd), виджет OBS — только пульс (hb).
// srv, cs2 и host публикует только сама программа: подделать данные игры или объявление клиент не может.
const PUB_MOD = new Set(['state', 'fx', 'ink', 'cs2cmd', 'cur', 'rtc']), PUB_LOCAL = new Set(['hb', 'rtc']);   // rtc: сигналинг камеры/экрана/микрофона, см. раздел «Медиа»
aedes.authorizePublish = (client, packet, cb) => {
  const kind = inRoom(packet.topic) ? packet.topic.slice(`${PREFIX}/${ROOM.room}/`.length) : '';
  if(!(client?.conn?._mod || client?.conn?._streamer ? PUB_MOD : PUB_LOCAL).has(kind)) return cb(new Error('чужая тема'));
  // на паузе сообщение тихо отбрасывается: обрыв за отправку не дал бы вести о паузе дойти до пульта
  if(ctl.paused && client?.conn?._mod){ packet.topic = `${PREFIX}/_drop`; packet.retain = false; return cb(null); }
  if(kind==='rtc'){
    const r = rtcGate(client, packet);
    if(r===false) return cb(new Error('rtc: неверный заголовок'));
    if(r===null){ packet.topic = `${PREFIX}/_drop`; packet.retain = false; }   // тихо отбросить: никто не подписан, соединение не рвём
  }
  cb(null);
};
aedes.authorizeSubscribe = (client, sub, cb) => cb(null, inRoom(sub.topic) ? sub : null);
// Виджет OBS в журнале: «подключился» при переходе 0 → 1, «отвалился» только если за 5 секунд он не вернулся (перезагрузка страницы не считается)
let obsUp = false, obsDropTimer = null;
const OBS_DROP_MS = 5000;
const PING_MS = 5000, PING_MISS = 3;   // модератор молчит 15 с — соединения больше нет
// вход, начатый до паузы и законченный после отключения всех: закрываем, повторный вход получит отказ «пауза»
aedes.on('clientReady', c => { if(ctl.paused && c.conn?._mod) c.close(); });
aedes.on('client', c => {
  const s = c.conn;
  if(!s?._mod && !s?._streamer){
    status.obs++;
    clearTimeout(obsDropTimer);
    if(!obsUp){ obsUp = true; logc('🎬 OBS widget connected'); }
    return;
  }
  const me = !!s._streamer;   // пульт стримера на этом ПК: в списке «на связи», но не модератор
  clearInterval(modList.get(c.id)?.timer);
  const m = { client:c, ip:me ? 'local' : s._ip, net:me ? 'local' : netOf(s._ip), me, since:Date.now(), rtt:null, ws:s._ws, pingAt:0, miss:0, timer:null };
  // Модератор, у которого пропала сеть, не должен держать свой clientId до keepalive MQTT (~45 с): без ответа на PING_MISS пинга подряд
  // соединение закрываем, и тот же пульт входит с нового адреса. Считаем пинги, а не время: сон ПК стримера никого не отключит.
  const ping = () => {
    if(m.ws?.readyState!==1) return;
    if(!me && m.miss >= PING_MISS){ logc('👤 Moderator does not respond, closing the connection:', who(m.ip)); try{ m.ws.terminate(); c.close(); }catch{} return; }
    m.miss++; m.pingAt = Date.now(); try{ m.ws.ping(); }catch{}
  };
  m.ws?.on('pong', () => { m.miss = 0; m.rtt = Date.now() - m.pingAt; });
  m.ws?.on('message', () => { m.miss = 0; });
  m.timer = setInterval(ping, PING_MS); ping();
  modList.set(c.id, m); status.mods = modCount();
  if(me) logc('🖥 Streamer panel connected');
  else logc('👤 Moderator connected:', who(m.ip));
});
const modCount = () => [...modList.values()].filter(m => !m.me).length;
aedes.on('clientDisconnect', c => {
  const m = modList.get(c.id);
  if(!c.conn?._mod && !c.conn?._streamer){
    status.obs = Math.max(0, status.obs-1);
    if(!status.obs && obsUp){
      clearTimeout(obsDropTimer);
      obsDropTimer = setTimeout(() => { if(!status.obs && obsUp){ obsUp = false; logc('🎬 OBS widget dropped'); } }, OBS_DROP_MS);
    }
    return;
  }
  if(m && m.client===c){ clearInterval(m.timer); modList.delete(c.id);   // запись нового соединения с тем же clientId не трогаем
    if(m.me) logc('🖥 Streamer panel disconnected');
    else logc('👤 Moderator disconnected:', who(m.ip), '— was online', fmtDur(Math.round((Date.now()-m.since)/1000))); }
  status.mods = modCount();
});

// Самое большое сообщение — состояние экрана; файлы идут отдельно через /files
const WS_MAX = 16*1048576, MOD_CONNS = 64;
// Порт модераторов открыт всем в сети. aedes копит пакет целиком, сколько бы байт ни объявил его заголовок,
// и делает это ещё до проверки пароля. Поэтому: до входа клиент может прислать не больше PRE_AUTH байт,
// после входа один пакет MQTT не больше WS_MAX. Кадр WebSocket (до WS_MAX) буферизуется раньше нас,
// поэтому ещё не вошедших соединений одновременно не больше PENDING, а с одного адреса (кроме 127.0.0.1, там Porthole) — не больше IP_CONNS.
const PRE_AUTH = 64*1024, IP_CONNS = 8, PENDING = 16;
// Следит за заголовками пакетов MQTT в потоке байт: длина пакета больше max → bad()
function mqttGuard(max, bad){
  let skip = 0, hdr = [];   // skip — сколько байт текущего пакета ещё впереди; hdr — начатый заголовок (тип + длина)
  return buf => {
    for(let i = 0; i < buf.length;){
      if(skip){ const k = Math.min(skip, buf.length-i); skip -= k; i += k; continue; }
      hdr.push(buf[i++]);
      if(hdr.length===1) continue;
      if(hdr.at(-1) & 128){ if(hdr.length>=5) return bad(); continue; }   // длина — не больше 4 байт
      let len = 0; for(let j = hdr.length-1; j>=1; j--) len = len*128 + (hdr[j] & 127);
      hdr = [];
      if(len > max) return bad();
      skip = len;
    }
  };
}
function wsServer(mod){
  const wss = new WebSocketServer({ noServer:true, maxPayload:WS_MAX, handleProtocols: p => p.has('mqtt') ? 'mqtt' : false });
  const perIp = new Map();
  return (req, socket, head) => {
    const pth = new URL(req.url, 'http://x').pathname;
    if(pth==='/media') return mediaUpgrade(mod, req, socket, head);   // запасной путь для камеры и экрана
    if(pth !== '/mqtt'){ socket.destroy(); return; }
    // локально подключается только виджет OBS с этого же адреса: чужой сайт в браузере стримера сюда не пустим
    // страница пульта стримера (окно приложения) тоже сюда, но войти она может только с сессией стримера (aedes.authenticate)
    const panel = !mod && PANEL_ORIGINS.has(req.headers.origin || '');
    if(!mod && (!okHost(req.headers.host) || (req.headers.origin && !okOrigin(req.headers.origin) && !panel))){ socket.destroy(); return; }
    const ip = ipOf(req);
    // из секрета возобновления берётся только хэш, а из запроса он убирается: дальше ему попадать некуда
    const resume = mod ? new URL(req.url, 'http://x').searchParams.get('resume') : null;
    req.url = pth;
    if(mod){
      let pending = 0; for(const w of wss.clients) if(!w._stream?._authed) pending++;
      const why = !cfg.modsOn ? 'entrance closed' : wss.clients.size >= MOD_CONNS ? 'limit: too many connections' : pending >= PENDING ? 'limit: too many waiting to log in'
        : !isLoop(ip) && (perIp.get(ip)||0) >= IP_CONNS ? 'limit: too many connections from one address' : '';
      if(why){ refuse(ip, why); socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const stream = createWebSocketStream(ws); stream._mod = mod; stream._panel = panel; stream._ip = ip; stream._ws = ws; ws._stream = stream;
      stream._resume = resume && RESUME_RE.test(resume) ? sha256(resume) : null;
      stream.on('error', ()=>{});
      if(mod){
        perIp.set(ip, (perIp.get(ip)||0) + 1);
        ws.on('close', () => { const n = (perIp.get(ip)||1) - 1; if(n>0) perIp.set(ip, n); else perIp.delete(ip); });
        const kill = () => { stream.destroy(); ws.terminate(); };
        // этот слушатель стоит раньше потока: лишний кадр рвёт соединение и до aedes не доходит
        const guard = mqttGuard(WS_MAX, kill);
        let pre = 0;
        ws.prependListener('message', data => {
          if(stream.destroyed) return;
          const b = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
          if(!stream._authed && (pre += b.length) > PRE_AUTH) return kill();
          guard(b);
        });
      }
      aedes.handle(stream, req);
    });
  };
}

aedes.on('publish', (packet, client) => {
  if(client && inRoom(packet.topic) && packet.topic.endsWith('/hb') && !client.conn?._mod) status.obsSeen = Date.now();
  if(client && ROOM && packet.topic===T('state') && packet.payload?.length) noteScreen(packet.payload);
});

// ---------- Медиа: камера, экран и микрофон (сигналинг rtc и запасной путь /media) ----------
// Host НИКОГДА не расшифровывает медиа и сигналинг: тело запечатано ключом комнаты. Он решает, кому можно вещать и кто что получает,
// по открытому заголовку и по тому, КТО прислал (соединение), а не по тому, что написано внутри.
// Формат сообщения темы rtc:  [u16 BE длина заголовка][заголовок JSON, до 300 байт][запечатанное тело, как sealAES]
//   заголовок: { v:1, sid:'[A-Za-z0-9_-]{8,32}', kind:'cam'|'screen'|'mic', t:'offer'|'answer'|'ice'|'bye'|'want'|'have', to?:'widget'|'streamer'|'m:<clientId>' }
//   Host сам проставляет в заголовок from = настоящий адрес отправителя ('streamer' | 'widget' | 'm:<clientId>'); чужое from затирается. Приёмник доверяет только этому полю.
//   offer/have начинает вещание (владелец sid = тот, кто прислал первым), to обязателен: адресат попадает в список peers сеанса.
//   answer/ice принимаются только от владельца (ice, и только к адресату из peers) и от адресатов из peers. bye — только владелец и стример.
//   want — просьба показать (sid любой, сеанс не создаёт). Чужой sid, неверный kind, не-адресат — сообщение молча отбрасывается.
//   Модератор начинает вещать, только если ползунок kind включён, общий выключатель не стоит и стример подтвердил в доке.
// Тема media (публикует только Host, запечатана): { ev:'pending'|'ok'|'no'|'bye', cid, kind, sid?, why?, t } — состояние для модератора с этим clientId.
// Запасной путь: WS /media?sid=SID. Первое сообщение — текст { u:'mod', p:<пароль> } | { u:'streamer', p:<сессия пульта> } | { u:'widget' } плюс t:<билет>.
//   Билет (случайный, 24 байта) Host выдаёт при offer/have владельцу сеанса и адресату, лично тому MQTT-соединению, которое отправило/получило (client.publish, тема rtc, t:'tkt', from:'host').
//   Билет привязан к sid и к самому соединению: без него (или после его закрытия) войти на /media в чужой сеанс нельзя, даже зная sid и clientId.
//   Потом только бинарные кадры [1 байт тип 0..2][зашифрованный кусок]: шлёт владелец, получают адресаты из peers. Тип 0 (заголовок потока) Host запоминает для опоздавших.
const MEDIA_FRAME = 1048576, MEDIA_BPS = 750000;   // кадр ≤ 1 МБ, ≤ 6 Мбит/с на источник (запись экрана идёт на 3,5 Мбит/с, запас на всплески ключевых кадров)
const MEDIA_PER_MOD = 4, MEDIA_TOTAL = 16, MEDIA_MOD_TOTAL = 12, MEDIA_PEERS = 8;   // стримеру всегда остаётся место: модераторы занимают не больше 12 из 16
const MEDIA_SOCKS = 48, MEDIA_PER_IP = 8, MEDIA_PENDING_SOCKS = 16, MEDIA_ASK = 8, ASK_TTL = 120000, DENY_TTL = 60000, RTC_MAX = 64*1024, PEER_IDLE = 120000, MEDIA_TIX = 24;
const SID_RE = /^[A-Za-z0-9_-]{8,32}$/, TO_RE = /^(widget|streamer|m:[\w.:-]{1,64})$/;
const RTC_T = new Set(['offer', 'answer', 'ice', 'bye', 'want', 'have']);
const sessions = new Map();   // sid → { sid, kind, owner, ownerType:'mod'|'streamer', ownerClient, ip, since, peers:Set, peerAt:Map<адрес, мс>, tix:Map<client, {tk, h, client}>, recv:Set<ws>, sender:ws|null, init:Buffer|null }
const grants = new Map();     // `${kind}|${clientId}` → { st:'pending'|'ok'|'no', at, kind, ownerType:'mod', ownerClient, cid, ip }
const idOf = c => c.conn?._streamer ? 'streamer' : c.conn?._mod ? 'm:'+c.id : 'widget';
const rtcBuckets = new WeakMap(), noteAt = new Map();
const sha = s => nodeCrypto.createHash('sha256').update(String(s)).digest();
function bucket(owner, cap, perSec){
  let b = rtcBuckets.get(owner); const now = Date.now();
  if(!b){ b = { n:cap, t:now }; rtcBuckets.set(owner, b); }
  b.n = Math.min(cap, b.n + (now-b.t)*perSec/1000); b.t = now;
  if(b.n < 1) return false; b.n--; return true;
}
function rtcHead(buf){
  if(!Buffer.isBuffer(buf) || buf.length < 2+10+30 || buf.length > RTC_MAX) return null;
  const n = buf.readUInt16BE(0);
  if(n < 10 || n > 300 || buf.length < 2+n+30) return null;
  let h; try{ h = JSON.parse(buf.subarray(2, 2+n).toString('utf8')); }catch{ return null; }
  if(!h || typeof h!=='object' || h.v!==1 || typeof h.sid!=='string' || !SID_RE.test(h.sid) || !MEDIA_KINDS.includes(h.kind) || !RTC_T.has(h.t)) return null;
  if(h.to!==undefined && (typeof h.to!=='string' || !TO_RE.test(h.to))) return null;
  return { sid:h.sid, kind:h.kind, t:h.t, to:h.to };
}
// Сообщение модератору (запечатано, его читают все, но обращено к clientId). Одинаковые не чаще раза в 5 с
async function mediaNote(cid, ev, kind, extra, force){
  if(!ROOM || !AES) return;
  const k = ev+'|'+kind+'|'+cid, now = Date.now();
  if(!force && now - (noteAt.get(k)||0) < 5000) return;
  noteAt.set(k, now);
  if(noteAt.size > 300) for(const [x, t] of noteAt) if(now - t > 5000) noteAt.delete(x);
  const box = await sealAES({ ev, cid, kind, ...extra, t:now });
  aedes.publish({ cmd:'publish', topic:T('media'), payload:box, qos:0, retain:false, dup:false }, ()=>{});
}
async function hostBye(s, why){
  if(!ROOM || !AES) return;
  const head = Buffer.from(JSON.stringify({ v:1, sid:s.sid, kind:s.kind, t:'bye', to:'*', from:'host' })), len = Buffer.alloc(2); len.writeUInt16BE(head.length);
  const body = await sealAES({ t:'bye', sid:s.sid, kind:s.kind, from:'host', why, ts:Date.now() });
  aedes.publish({ cmd:'publish', topic:T('rtc'), payload:Buffer.concat([len, head, body]), qos:0, retain:false, dup:false }, ()=>{});
}
function endSession(s, why){
  if(sessions.get(s.sid)!==s) return;
  sessions.delete(s.sid);
  for(const w of [...s.recv, s.sender]) if(w){ try{ w.close(1008, 'end'); }catch{} setTimeout(() => { try{ w.terminate(); }catch{} }, 500).unref?.(); }
  s.recv.clear(); s.sender = null;
  hostBye(s, why).catch(()=>{});
  if(s.ownerType==='mod') mediaNote(s.ownerClient, 'bye', s.kind, { sid:s.sid, why }, true).catch(()=>{});
}
// Отзыв: закрыть сеансы и забыть подтверждения, подходящие под условие. Условие получает { kind, ownerType, ownerClient }
function mediaRevoke(pred, why){
  let n = 0;
  for(const s of [...sessions.values()]) if(pred(s)){ endSession(s, why); n++; }
  for(const [k, g] of [...grants]) if(pred(g)) grants.delete(k);
  if(n) logc('🎥 Streams stopped:', n, '—', why);
}
function grantsSweep(){
  const now = Date.now();
  for(const [k, g] of grants){
    if(g.st!=='ok' && now - g.at > (g.st==='no' ? DENY_TTL : ASK_TTL)) grants.delete(k);
  }
}
setInterval(grantsSweep, 15000);
// Можно ли модератору сейчас вещать kind. Нет разрешения → «no», нет подтверждения → запрос в док (и «pending»)
function modMediaOk(client, kind){
  const cid = client.id, key = kind+'|'+cid, now = Date.now();
  if(!effPerms()[kind]){ mediaNote(cid, 'no', kind, { why:'perm' }).catch(()=>{}); return false; }
  grantsSweep();
  const g = grants.get(key);
  if(g?.st==='ok'){
    return true;
  }
  if(g?.st==='no'){ mediaNote(cid, 'no', kind, { why:'denied' }).catch(()=>{}); return false; }
  if(g) return false;   // ждёт ответа стримера
  const pend = [...grants.values()].filter(x => x.st==='pending');
  if(pend.length >= MEDIA_ASK || pend.filter(x => x.ownerClient===cid).length >= 3){ mediaNote(cid, 'no', kind, { why:'busy' }).catch(()=>{}); return false; }
  grants.set(key, { st:'pending', at:now, kind, ownerType:'mod', ownerClient:cid, cid, ip:client.conn._ip });
  logc('🎥 Moderator', who(client.conn._ip), 'asks to show:', PERM_NAMES[kind].replace("moderator's ", ''));
  mediaNote(cid, 'pending', kind, {}, true).catch(()=>{});
  return false;
}
// Заголовок уходит дальше с настоящим from (чужое from затирается)
function stampFrom(packet, h, from){
  const head = Buffer.from(JSON.stringify({ v:1, sid:h.sid, kind:h.kind, t:h.t, ...(h.to ? { to:h.to } : {}), from })), len = Buffer.alloc(2); len.writeUInt16BE(head.length);
  packet.payload = Buffer.concat([len, head, packet.payload.subarray(2 + packet.payload.readUInt16BE(0))]);
}
// Билет /media: свой у каждого соединения в сеансе, лично ему и уходит (client.publish), остальные тему rtc с ним не получают
const tixHolders = (to) => Object.values(aedes.clients).filter(c => c?.conn && c.connected !== false && idOf(c)===to && (to==='widget' ? !c.conn._mod && !c.conn._streamer : true));
async function sendTicket(s, cl){
  if(!ROOM || !AES || sessions.get(s.sid)!==s) return;
  let e = s.tix.get(cl);
  if(!e){
    for(const [k] of s.tix) if(aedes.clients[k.id]!==k) s.tix.delete(k);   // мёртвые билеты не занимают лимит
    if(s.tix.size >= MEDIA_TIX) return;
    const tk = nodeCrypto.randomBytes(24).toString('base64url');
    e = { tk, h:sha(tk), client:cl }; s.tix.set(cl, e);
  }
  const head = Buffer.from(JSON.stringify({ v:1, sid:s.sid, kind:s.kind, t:'tkt', to:idOf(cl), from:'host' })), len = Buffer.alloc(2); len.writeUInt16BE(head.length);
  const body = await sealAES({ t:'tkt', sid:s.sid, kind:s.kind, from:'host', tk:e.tk, ts:Date.now() });
  try{ cl.publish({ cmd:'publish', topic:T('rtc'), payload:Buffer.concat([len, head, body]), qos:0, retain:false, dup:false }, ()=>{}); }catch{}
}
function ticketOwner(s, tk){
  if(typeof tk!=='string' || tk.length<16 || tk.length>64) return null;
  const h = sha(tk); let hit = null;
  for(const e of s.tix.values()) if(nodeCrypto.timingSafeEqual(h, e.h) && !hit) hit = e;
  return hit && hit.client.connected !== false && aedes.clients[hit.client.id]===hit.client ? hit.client : null;
}
function peerSeen(s, id){ s.peerAt.set(id, Date.now()); }
// Сокеты /media получателя закрываем вместе с местом: иначе он продолжит получать кадры до конца сеанса
function recvClose(s, pred){
  for(const w of [...s.recv]) if(pred(w)){ s.recv.delete(w); try{ w.close(1008, 'end'); }catch{} setTimeout(() => { try{ w.terminate(); }catch{} }, 500).unref?.(); }
}
function peerDrop(s, id){ s.peers.delete(id); s.peerAt.delete(id); recvClose(s, w => w._id===id); }
// true — пропустить, null — тихо отбросить, false — нарушение формата (соединение рвёт aedes)
function rtcGate(client, packet){
  const h = rtcHead(packet.payload);
  if(!h) return false;
  packet.retain = false;
  const isMod = !!client.conn?._mod, isStr = !!client.conn?._streamer, id = idOf(client);
  if(!bucket(client, 100, 30)) return null;
  stampFrom(packet, h, id);   // 30 сообщений в секунду, всплеск 100 (ICE-кандидаты)
  if(h.t==='want') return true;
  if(h.t==='offer' || h.t==='have'){
    if(!isMod && !isStr) return null;   // виджет только отвечает
    if(!h.to || h.to===id) return false;
    let s = sessions.get(h.sid);
    if(s && (s.owner!==id || s.kind!==h.kind)){ refuse(isMod ? client.conn._ip : 'local', 'rtc: foreign sid'); return null; }
    if(isMod && !modMediaOk(client, h.kind)) return null;
    if(!s){
      const mods = [...sessions.values()].filter(x => x.ownerType==='mod');
      if(sessions.size >= MEDIA_TOTAL || (isMod && (mods.length >= MEDIA_MOD_TOTAL || mods.filter(x => x.ownerClient===client.id).length >= MEDIA_PER_MOD))){ refuse(isMod ? client.conn._ip : 'local', 'rtc: too many streams'); return null; }
      s = { sid:h.sid, kind:h.kind, owner:id, ownerType:isMod ? 'mod' : 'streamer', ownerClient:client.id, ip:isMod ? client.conn._ip : 'local', since:Date.now(), peers:new Set(), peerAt:new Map(), tix:new Map(), recv:new Set(), sender:null, init:null };
      sessions.set(h.sid, s);
      logc('🎥 Stream:', isMod ? who(s.ip) : 'streamer', '—', PERM_NAMES[h.kind]);
    }
    if(!s.peers.has(h.to)){ if(s.peers.size >= MEDIA_PEERS) return null; s.peers.add(h.to); }
    peerSeen(s, h.to);
    sendTicket(s, client).catch(()=>{});   // владельцу: нужен ему, чтобы открыть запасной путь
    for(const c of tixHolders(h.to)) if(c!==client) sendTicket(s, c).catch(()=>{});
    return true;
  }
  const s = sessions.get(h.sid);
  if(!s || s.kind!==h.kind) return null;
  if(h.t==='bye'){
    if(id!==s.owner && !isStr){   // получатель уходит: место в сеансе освобождается, владелец узнаёт
      if(!s.peers.has(id)) return null;
      peerDrop(s, id); return true;
    }
    setImmediate(() => endSession(s, 'finished'));
    return true;
  }
  // answer, ice
  if(id===s.owner) return h.t==='ice' && h.to && s.peers.has(h.to) ? true : null;
  if(!s.peers.has(id)) return null;
  peerSeen(s, id);
  return true;
}
// Получатели без вестей и без открытого сокета отпускаются: пульт грузится заново с новым clientId, а мест в сеансе всего MEDIA_PEERS
setInterval(() => {
  const now = Date.now();
  for(const s of sessions.values()) for(const id of [...s.peers]){
    if(now - (s.peerAt.get(id) || s.since) < PEER_IDLE) continue;
    const online = Object.values(aedes.clients).some(c => idOf(c)===id), live = [...s.recv].some(w => w._id===id);
    if(!online || !live) peerDrop(s, id);
  }
}, 15000).unref?.();
// Отключился модератор: его сеансы закрываем и одобрение стримера забываем (clientId виден другим модераторам, его можно занять): после обрыва стример подтверждает заново.
aedes.on('clientDisconnect', c => {
  const priv = !!(c.conn?._mod || c.conn?._streamer);
  const replaced = aedes.clients[c.id] && aedes.clients[c.id]!==c;   // тот же clientId уже вернулся: у нового соединения свои сеансы
  for(const s of [...sessions.values()]){
    s.tix.delete(c);   // билеты уходят и у виджетов: лимит MEDIA_TIX считается на живые соединения
    recvClose(s, w => w._cl===c);
    if(!priv) continue;
    if(s.ownerClient===c.id && !replaced) endSession(s, 'owner disconnected');
    const id = idOf(c);
    if(s.peers.has(id) && !tixHolders(id).some(x => x!==c)) peerDrop(s, id);
  }
  if(!priv) return;
  if(c.conn._mod && !replaced){
    for(const [k, g] of [...grants]){
      if(g.cid!==c.id) continue;
      grants.delete(k);
    }
  }
});
function mediaInfo(){
  grantsSweep();
  return { off:!!ctl.mediaOff,
    pending:[...grants.values()].filter(g => g.st==='pending').map(g => ({ key:g.kind+'|'+g.cid, kind:g.kind, ip:maskHost(g.ip) })),
    live:[...sessions.values()].map(s => ({ sid:s.sid, kind:s.kind, own:s.ownerType, ip:s.ownerType==='mod' ? maskHost(s.ip) : '', since:s.since, viewers:s.recv.size })) };
}
// Кнопки дока: ответ на запрос, «Выключить» у трансляции, общий выключатель
function mediaAction(action, key){
  if(action==='mediaoff' || action==='mediaon'){
    const off = action==='mediaoff';
    if(ctl.mediaOff!==off){ ctl.mediaOff = cfg.mediaOff = off; saveCfg(); log(off ? '🎥 Streamer turned off all moderator streams' : '🎥 Moderator streams allowed again (if the toggles are on)'); }
    if(off) mediaRevoke(x => x.ownerType==='mod', 'streamer turned off moderator streams');
    publishPerms().catch(()=>{});
    return;
  }
  if(typeof key!=='string' || key.length>100) throw new HttpErr(400, 'нет такой трансляции');
  if(action==='mediastop'){
    const s = sessions.get(key);
    if(!s) throw new HttpErr(404, 'трансляции уже нет');
    if(s.ownerType==='mod') grants.set(s.kind+'|'+s.ownerClient, { st:'no', at:Date.now(), kind:s.kind, ownerType:'mod', ownerClient:s.ownerClient, cid:s.ownerClient, ip:s.ip });   // заново — только через запрос
    endSession(s, 'streamer turned off'); log('🎥 Streamer turned off the stream:', PERM_NAMES[s.kind]);
    return;
  }
  const g = grants.get(key);
  if(!g || g.st!=='pending') throw new HttpErr(404, 'запрос уже не актуален');
  const ok = action==='mediaallow' && effPerms()[g.kind];
  g.st = ok ? 'ok' : 'no'; g.at = Date.now();
  logc('🎥', ok ? 'Allowed:' : 'Denied:', who(g.ip), '—', PERM_NAMES[g.kind]);
  mediaNote(g.cid, ok ? 'ok' : 'no', g.kind, ok ? {} : { why:'denied' }, true).catch(()=>{});
}

// Запасной путь: зашифрованные куски по WebSocket. Host их только пересылает.
const mediaWss = new WebSocketServer({ noServer:true, maxPayload:MEDIA_FRAME + 1 });
const mediaPerIp = new Map();
let mediaPendingSocks = 0;
function perIpAdd(ip, d){ const n = (mediaPerIp.get(ip)||0) + d; if(n>0) mediaPerIp.set(ip, n); else mediaPerIp.delete(ip); }
setInterval(() => { for(const w of mediaWss.clients){ if(w._dead){ w.terminate(); continue; } w._dead = true; try{ w.ping(); }catch{} } }, 20000);
function mediaUpgrade(mod, req, socket, head){
  const sid = new URL(req.url, 'http://x').searchParams.get('sid') || '';
  const panel = !mod && PANEL_ORIGINS.has(req.headers.origin || '');
  if(!SID_RE.test(sid) || (!mod && (!okHost(req.headers.host) || (req.headers.origin && !okOrigin(req.headers.origin) && !panel)))){ socket.destroy(); return; }
  const ip = ipOf(req), loop = isLoop(ip);
  if(mod && !cfg.modsOn){ socket.destroy(); return; }
  if(mediaWss.clients.size >= MEDIA_SOCKS || mediaPendingSocks >= MEDIA_PENDING_SOCKS || (!loop && (mediaPerIp.get(ip)||0) >= MEDIA_PER_IP)){ refuse(ip, 'limit: too many media connections'); socket.destroy(); return; }
  mediaPendingSocks++;
  let done = false;
  const unpend = () => { if(!done){ done = true; mediaPendingSocks--; } };
  socket.once('close', unpend);
  mediaWss.handleUpgrade(req, socket, head, ws => {
    let authed = false, sess = null, isSender = false, tokens = MEDIA_FRAME, last = Date.now();
    perIpAdd(ip, 1);
    const pendTimer = setTimeout(() => { try{ ws.terminate(); }catch{} }, 5000);
    ws.on('pong', () => { ws._dead = false; });
    ws.on('error', ()=>{});
    ws.on('close', () => {
      clearTimeout(pendTimer); unpend(); perIpAdd(ip, -1);
      if(sess){ sess.recv.delete(ws); if(sess.sender===ws) sess.sender = null; }
    });
    const bad = () => { try{ ws.terminate(); }catch{} };
    ws.on('message', (data, isBinary) => {
      const b = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
      if(!authed){
        if(isBinary || b.length > 600) return bad();
        let m; try{ m = JSON.parse(b.toString('utf8')); }catch{ return bad(); }
        if(!m || typeof m!=='object') return bad();
        let id = '';
        sess = sessions.get(sid);
        if(!sess) return bad();
        const cl = ticketOwner(sess, m.t);   // билет выдан этому sid и этому MQTT-соединению (см. sendTicket)
        if(!cl) return bad();
        if(mod){
          if(m.u!=='mod' || !passOk(ip, m.p) || ctl.paused || !cl.conn?._mod || !cl.conn._authed || cl.conn._ip!==ip) return bad();
        }else if(m.u==='streamer'){ if(!panel || !panelSessionOk(String(m.p||'')) || !cl.conn?._streamer) return bad(); }
        else if(m.u==='widget' && !panel){ if(cl.conn?._mod || cl.conn?._streamer) return bad(); }
        else return bad();
        id = idOf(cl); ws._id = id; ws._cl = cl;
        if(id===sess.owner){
          if(sess.ownerType==='mod' && !(effPerms()[sess.kind] && grants.get(sess.kind+'|'+sess.ownerClient)?.st==='ok')) return bad();
          try{ sess.sender?.terminate(); }catch{}
          sess.sender = ws; isSender = true;
        }else if(sess.peers.has(id) && sess.recv.size < MEDIA_PEERS){
          sess.recv.add(ws);
          if(sess.init) try{ ws.send(sess.init, { binary:true }); }catch{}
          ws._skip = true;   // середина записи без заголовка не воспроизводится: ждём следующий заголовок (отправитель режет запись на сегменты)
        }else return bad();
        authed = true; clearTimeout(pendTimer); unpend();
        return;
      }
      if(!isBinary || !isSender || sessions.get(sid)!==sess) return bad();   // получатель молчит; текст после входа не нужен
      if(b.length < 29 || b[0] > 2) return bad();
      if(sess.ownerType==='mod' && !effPerms()[sess.kind]) return bad();
      const now = Date.now(); tokens = Math.min(MEDIA_FRAME, tokens + (now-last)*MEDIA_BPS/1000); last = now;
      if((tokens -= b.length) < 0) return bad();   // быстрее 4 Мбит/с — обрыв
      if(b[0]===0) sess.init = Buffer.from(b);
      for(const r of sess.recv){
        if(r.readyState!==1) continue;
        if(r.bufferedAmount > 16*1048576){ try{ r.terminate(); }catch{} continue; }
        // Куски WebM зависят друг от друга: отстающему пропустили один — следующие до нового заголовка (ключевой кадр) бесполезны, их не шлём
        if(b[0]===0) r._skip = false;
        else if(r._skip) continue;
        else if(r.bufferedAmount > 4*1048576){ r._skip = true; continue; }
        try{ r.send(b, { binary:true }); }catch{}
      }
    });
  });
}

// ---------- экран для дока в OBS ----------
// Программа видит зашифрованный экран (тема state) и ключ комнаты у неё есть: расшифровывает сама, проверяет подпись
// модератора и отдаёт доку только список {id, type, name, hidden}. Сам экран и файлы дальше не уходят.
let screen = null, screenBuf = null, screenBusy = false, screenNum = 'game', screenStrip = 'Lite, Premium';   // screenStrip: «Убрать из ников» из экрана, для дока
// Экран (тема state) и команды серии CS2 (cs2cmd) разбирает одна функция; max — предел размера сообщения
async function openSigned(buf, max=Infinity){
  try{
    const b = new Uint8Array(buf);
    if(b.length<79 || b.length>max || b[0]!==1 || b[1]!==1 || !AES || !PUB) return null;
    const iv = b.subarray(2, 14), sig = b.subarray(14, 78), ct = b.subarray(78);
    const msg = new Uint8Array(12 + ct.length); msg.set(iv); msg.set(ct, 12);
    if(!await subtle.verify({ name:'ECDSA', hash:'SHA-256' }, PUB, sig, msg)) return null;
    return JSON.parse(new TextDecoder().decode(await subtle.decrypt({ name:'AES-GCM', iv }, AES, ct)));
  }catch{ return null; }
}
const line40 = v => typeof v==='string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 40) : '';
const hostOf = u => { try{ return new URL(String(u)).hostname.slice(0, 40); }catch{ return ''; } };
// Подпись элемента в доке: текст, заголовок, ник или сайт (сам экран в док не уходит)
function elLabel(e){
  const t = e.type;
  return line40(t==='text' ? e.text : t==='msg' ? (line40(e.user) ? line40(e.user)+': ' : '')+line40(e.text) : e.label || e.title || e.name || e.chan || e.gn)
    || (t==='web' ? hostOf(e.url) : t==='image' || t==='video' ? (/^asset:/.test(String(e.src)) ? '' : hostOf(e.src)) : t==='cs2' ? line40(e.view) : '');
}
// Экран приходит до 20 раз в секунду (перетаскивание): разбираем последний, не каждый
function noteScreen(buf){
  screenBuf = buf; if(screenBusy) return;
  screenBusy = true;
  setTimeout(async () => {
    const b = screenBuf; screenBuf = null;
    const m = await openSigned(b);
    if(m && Array.isArray(m.els) && (!screen || (Number(m.t)||0) >= screen.t)){
      screenNum = m.cs2auto?.num==='hud' ? 'hud' : 'game';
      screenStrip = typeof m.cs2auto?.strip==='string' ? m.cs2auto.strip.slice(0, 200) : 'Lite, Premium';
      const list = [...m.els.slice(0, 200), ...(m.raffle && typeof m.raffle==='object' ? [m.raffle] : [])];
      screen = { t:Number(m.t)||0, els:list.filter(e => e && typeof e==='object' && typeof e.id==='string' && typeof e.type==='string')
        .map(e => ({ id:e.id.slice(0, 40), type:e.type.slice(0, 12), name:elLabel(e), hidden:e.hidden===true })) };
    }
    screenBusy = false;
    if(screenBuf) noteScreen(screenBuf);
  }, 250);
}

// ---------- состояние для пульта, уже подключённого к программе ----------
// Адрес и пароль больше нигде не публикуются: модератор получает их в коде. В свой брокер уходит только пауза.
async function announce(){
  if(!ROOM || !AES) return;
  const box = await sealAES({ ver:2, paused:ctl.paused, t:Date.now() });
  aedes.publish({ cmd:'publish', topic:T('srv'), payload:box, qos:1, retain:true, dup:false }, ()=>{});
}
setInterval(announce, 60000);

// ---------- CS2 Game State Integration ----------
let lastOwn = null, cs2Local = 0, cs2Pending = null, cs2Timer = null;
// События игры: считаем здесь, по каждому пакету от CS2, чтобы пульт и виджет получали готовое и ничего не пропускали
let evSeq = Date.now() % 1e9, evs = [], prevOwn = null, prevAll = {}, prevBomb = null, prevRPhase = null;
function addEv(k, extra){ evs.push({ s:++evSeq, k, t:Date.now(), ...extra }); if(evs.length>20) evs.shift(); }
// Статистика за матч для ADR и HS%. По каждому игроку и номеру раунда храним максимум урона, хедшотов и убийств
// за раунд (CS2 обнуляет их в следующем раунде, а у погибшего в середине раунда они остаются последними известными).
// ADR = урон за сыгранные раунды / сыгранные раунды по счёту матча, HS% = хедшоты / убийства.
// Файл data/cs2-stats.json переживает перезапуск программы посреди матча; новая карта или матч обнуляют его.
const STATS_FILE = path.join(BASE, 'cs2-stats.json');
let mstats = {}, mKey = '', mLast = -1, mRounds = 0, statsT = null;
// Смена сторон: sw = чётность смен в матче, nf/sf = Host сам меняет названия/счёт местами (CS2 их не поменял), teams = игроки по сторонам, raw = прошлые сырые значения
let sd = { key:'', sw:0, nf:false, sf:false, teams:{}, raw:null, round:-1 };
try{
  const j = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  if(j && j.v === 1 && j.stats && typeof j.stats === 'object'){ for(const [id, x] of Object.entries(j.stats)) if(x && typeof x === 'object') mstats[id] = { dmg:{ ...x.dmg }, hs:{ ...x.hs }, k:{ ...x.k } };
    mKey = String(j.key || ''); mLast = Number.isInteger(j.last) ? j.last : -1; }
  if(j && j.sides && typeof j.sides === 'object') sd = { ...sd, sw:j.sides.sw ? 1 : 0, nf:!!j.sides.nf, sf:!!j.sides.sf, key:mKey };
}catch{}
function saveStats(now){
  if(statsT){ clearTimeout(statsT); statsT = null; }
  if(!now){ statsT = setTimeout(() => saveStats(true), 2000); return; }
  try{ fs.writeFileSync(STATS_FILE, JSON.stringify({ v:1, key:mKey, last:mLast, stats:mstats, sides:{ sw:sd.sw, nf:sd.nf, sf:sd.sf } }), { mode:0o600 }); }catch{}
}
// Названия и счёт команд едут вместе с командой на новую сторону. Смену сторон видим по игрокам: тот же steamid
// сменил CT на T. CS2 обычно сам меняет team_ct/team_t местами, но если названия или счёт остались на старой стороне,
// Host меняет их сам; если CS2 поменял, ничего не трогаем. Мгновенно и надёжно, без подсчёта раундов (mr12/mr15/овертайм).
function trackSides(g, out){
  const map = g.map || {}, round = Number.isInteger(map.round) ? map.round : -1;
  const key = (map.name || '') + '|' + (map.mode || '');
  const was = [sd.sw, sd.nf, sd.sf].join();
  if(map.phase === 'warmup' || key !== sd.key || round < sd.round){ sd = { key, sw:0, nf:false, sf:false, teams:{}, raw:null, round }; }
  else sd.round = round;
  const now = {};
  const note = (id, t) => { if(id && (t === 'CT' || t === 'T')) now[id] = t; };
  if(g.player) note(g.player.steamid, g.player.team);
  if(g.allplayers) for(const [id, pl] of Object.entries(g.allplayers)) note(id, pl?.team);
  let same = 0, diff = 0;
  for(const id in now){ if(sd.teams[id]) (sd.teams[id] === now[id] ? same++ : diff++); }
  const swapped = map.phase !== 'warmup' && diff > 0 && diff > same;
  const raw = { ct:Number(map.team_ct?.score), tt:Number(map.team_t?.score), cn:map.team_ct?.name || '', tn:map.team_t?.name || '' }, pr = sd.raw;
  if(swapped){
    sd.sw ^= 1;
    for(const id in sd.teams) sd.teams[id] = sd.teams[id] === 'CT' ? 'T' : 'CT';
  }
  if(pr){
    // названия: CS2 поменял их сам (ровно наоборот) или не тронул
    if(pr.cn && pr.tn && pr.cn !== pr.tn){
      if(raw.cn === pr.tn && raw.tn === pr.cn) sd.nf = false;
      else if(swapped && raw.cn === pr.cn && raw.tn === pr.tn) sd.nf = !sd.nf;
    }
    const plain = raw.ct >= pr.ct && raw.tt >= pr.tt, sw = raw.ct >= pr.tt && raw.tt >= pr.ct;
    if(sw && !plain) sd.sf = false;
    else if(swapped && plain && !sw) sd.sf = !sd.sf;
  }
  for(const id in now) sd.teams[id] = now[id];
  sd.raw = raw;
  if(sd.nf){ out.ctName = map.team_t?.name; out.tName = map.team_ct?.name; }
  if(sd.sf){ out.ct = map.team_t?.score; out.tt = map.team_ct?.score; }
  out.sw = sd.sw;
  if([sd.sw, sd.nf, sd.sf].join() !== was) saveStats();
}
const sumOf = o => { let n = 0; for(const k in o) n += o[k]; return n; };
function noteStat(id, round, st){
  const x = mstats[id] ||= { dmg:{}, hs:{}, k:{} };
  let ch = false;
  for(const [f, v] of [['dmg', st.round_totaldmg], ['hs', st.round_killhs], ['k', st.round_kills]]){
    const n = Math.max(0, Math.round(Number(v) || 0));
    if(n > (x[f][round] || 0)){ x[f][round] = n; ch = true; }
  }
  return ch;
}
// В статистику идёт только то, что приходит про каждого игрока целиком: свой игрок (steamid совпадает с provider)
// и все игроки в режиме наблюдателя. Игрок, на которого смотрим без allplayers, видим только по частям.
function trackStats(g, own){
  const map = g.map || {}, round = map.round;
  if(map.phase === 'warmup' || !Number.isInteger(round)) return;
  const key = (map.name || '') + '|' + (map.mode || '');
  if(key !== mKey || round < mLast){ mstats = {}; mKey = key; saveStats(); }
  mLast = round;
  const sc = Number(map.team_ct?.score) + Number(map.team_t?.score);
  mRounds = Number.isFinite(sc) ? sc : round;
  let ch = false;
  if(own && g.player?.state) ch = noteStat(g.player.steamid, round, g.player.state) || ch;
  if(g.allplayers) for(const [id, pl] of Object.entries(g.allplayers)) if(pl?.state) ch = noteStat(id, round, pl.state) || ch;
  if(ch && !statsT) saveStats();
}
const adrOf = id => {
  const x = mstats[id]; if(!x || !mRounds) return 0;
  let d = 0; for(const r in x.dmg) if(+r < mRounds) d += x.dmg[r];
  return Math.round(d / mRounds);
};
const hspOf = id => { const x = mstats[id], k = x ? sumOf(x.k) : 0; return k ? Math.min(100, Math.round(sumOf(x.hs) / k * 100)) : 0; };
const NADE = { weapon_hegrenade:'he', weapon_flashbang:'flash', weapon_smokegrenade:'smoke', weapon_molotov:'molly', weapon_incgrenade:'molly', weapon_decoy:'decoy' };
function shortPlayer(p, id){
  const st=p.state||{}, ms=p.match_stats||{};
  const ws=Object.values(p.weapons||{}).filter(Boolean);
  const w=ws.find(x=>x.state==='active') || {};
  const main=ws.find(x=>/Rifle|SniperRifle|Submachine Gun|Shotgun|Machine Gun/.test(x.type||'')) || ws.find(x=>x.type==='Pistol') || {};
  return { id, name:p.name, team:p.team, slot:p.observer_slot, hp:st.health, armor:st.armor, helmet:!!st.helmet, money:st.money,
    rk:st.round_kills, k:ms.kills, d:ms.deaths, a:ms.assists, mvps:ms.mvps, weapon:w.name, main:main.name, ammo:w.ammo_clip, reserve:w.ammo_reserve, ammoMax:w.ammo_clip_max,
    kit:!!st.defusekit, bomb:ws.some(x=>x.name==='weapon_c4'), alive:(st.health??0)>0,
    dmg:st.round_totaldmg||0, rhs:st.round_killhs||0, equip:st.equip_value, flashed:st.flashed||0,
    pistol:(ws.find(x=>x.type==='Pistol')||{}).name, nades:ws.filter(x=>NADE[x.name]).map(x=>NADE[x.name]),
    adr:adrOf(id), hsp:hspOf(id), ...posOf(p) };
}
// Радар: позиция игрока на карте (x, y, z мира CS2, округлено) и куда он смотрит (угол в градусах, 0 = +x, против часовой).
// Приходит с allplayers_position в режиме наблюдателя; у своего игрока без него поля нет.
const vec3 = s => { const a = String(s ?? '').split(',').map(Number); return a.length===3 && a.every(Number.isFinite) ? a : null; };
function posOf(p){
  const v = vec3(p?.position); if(!v) return {};
  const f = vec3(p?.forward);
  return { pos:v.map(Math.round), ...(f && (f[0] || f[1]) ? { fw:Math.round(Math.atan2(f[1], f[0]) * 180 / Math.PI) } : {}) };
}
// Гранаты на радаре (блок allgrenades, CS2 отдаёт его только зрителю): тип из белого списка, числа проверены, количество ограничено, свободного текста нет.
const GR_TYPE = { flashbang:'flash', flash:'flash', smoke:'smoke', smokegrenade:'smoke', frag:'he', hegrenade:'he', inferno:'molly', firebomb:'molly', molotov:'molly', incgrenade:'molly' };
const GR_MAX = 40, GR_FLAMES = 60, GR_FLAMES_ALL = 120;
const grNum = (v, lo, hi) => { const n = typeof v==='number' || typeof v==='string' ? Number(v) : NaN; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
function grenadesOf(g){
  const src = g && typeof g==='object' ? (g.allgrenades ?? g.grenades) : null;
  if(!src || typeof src!=='object' || Array.isArray(src)) return [];
  const out = []; let flamesLeft = GR_FLAMES_ALL, scanned = 0;
  for(const key in src){
    if(++scanned > 200 || out.length >= GR_MAX) break;
    const e = src[key]; if(!e || typeof e!=='object' || !/^[0-9A-Za-z_-]{1,12}$/.test(key)) continue;
    const t = typeof e.type==='string' ? GR_TYPE[e.type.toLowerCase()] : null; if(!t) continue;
    const pos = typeof e.position==='string' ? vec3(e.position) : null; if(!pos || pos.some(n => Math.abs(n) > 100000)) continue;
    const vel = typeof e.velocity==='string' ? vec3(e.velocity) : null, v = vel && vel.every(n => Math.abs(n) < 100000) ? vel : [0, 0, 0];
    const owner = typeof e.owner==='string' ? e.owner : '', ow = owner && g.allplayers && typeof g.allplayers==='object' && Object.hasOwn(g.allplayers, owner) ? g.allplayers[owner] : null;
    const tm = ow?.team==='CT' || ow?.team==='T' ? ow.team : '';
    const fl = [];
    if(t==='molly' && e.flames && typeof e.flames==='object') for(const k in e.flames){
      if(fl.length >= GR_FLAMES || flamesLeft <= 0) break;
      const f = typeof e.flames[k]==='string' ? vec3(e.flames[k]) : null; if(f && f.every(n => Math.abs(n) < 100000)){ fl.push([Math.round(f[0]), Math.round(f[1])]); flamesLeft--; }
    }
    const et = grNum(e.effecttime, 0, 120) ?? 0;
    const s = (t==='smoke' && et > 0) || (t==='molly' && fl.length) ? 2 : (Math.hypot(v[0], v[1], v[2]) < 1 ? 1 : 0);
    out.push({ i:key, t, tm, p:pos.map(Math.round), v:[Math.round(v[0]), Math.round(v[1])], s, ...(et ? { e:Math.round(et*10)/10 } : {}), ...(fl.length ? { f:fl } : {}) });
  }
  return out;
}
function compactGsi(g){
  const me = g.provider?.steamid, p = g.player || {}, own = !!me && p.steamid === me;
  const st = p.state || {}, ms = p.match_stats || {};
  const w = Object.values(p.weapons || {}).find(x => x && x.state === 'active') || {};
  const map = g.map || {};
  trackStats(g, own);
  const mine = own ? {
    dmg:st.round_totaldmg||0, adr:adrOf(me), hsp:hspOf(me), id:me,
    nades:Object.values(p.weapons||{}).filter(x=>x && NADE[x.name]).map(x=>NADE[x.name]), kit:!!st.defusekit, bomb:Object.values(p.weapons||{}).some(x=>x?.name==='weapon_c4'),
    name:p.name, team:p.team, hp:st.health, armor:st.armor, helmet:!!st.helmet, money:st.money,
    rk:st.round_kills, rhs:st.round_killhs, equip:st.equip_value, k:ms.kills, a:ms.assists, d:ms.deaths,
    mvps:ms.mvps, score:ms.score, weapon:w.name, ammo:w.ammo_clip, ammoMax:w.ammo_clip_max, reserve:w.ammo_reserve, alive:(st.health??0)>0,
  } : { ...(lastOwn||{}), hp:0, alive:false, weapon:null, ammo:null };
  if(own) lastOwn = mine;
  const out = { t:Date.now(), map:map.name, mode:map.mode, phase:map.phase, round:map.round,
    ct:map.team_ct?.score, tt:map.team_t?.score, ctName:map.team_ct?.name, tName:map.team_t?.name,
    rphase:g.round?.phase, bomb:g.bomb?.state || g.round?.bomb, win:g.round?.win_team,
    ...(vec3(g.bomb?.position) ? { bpos:vec3(g.bomb.position).map(Math.round) } : {}),
    spectating: !own && p.name ? p.name : null, ...mine };
  trackSides(g, out);
  // таймер фазы раунда (заморозка / раунд / бомба / разминирование)
  const pc=g.phase_countdowns;
  if(pc && pc.phase_ends_in!=null){ out.pphase=pc.phase; out.pend=Date.now()+Number(pc.phase_ends_in)*1000; }
  // режим наблюдателя: CS2 отдаёт всех игроков (только зрителям, GOTV и кастерам)
  if(g.allplayers){
    out.spec=true;
    out.players=Object.entries(g.allplayers).slice(0,12).map(([id,pl])=>shortPlayer(pl, id));
    if(p.steamid) out.obs=p.steamid;
    const gr = grenadesOf(g); if(gr.length) out.gr = gr;
  }
  if(!own && p.name) out.observed=shortPlayer(p, p.steamid);

  // ---- события ----
  if(own){
    if(prevOwn){
      const dk=(mine.k||0)-(prevOwn.k||0);
      if(dk>0 && dk<6 && !g.allplayers) addEv('frag', { killer:mine.name, kid:me, kteam:mine.team, victim:null, weapon:mine.weapon, hs:(mine.rhs||0)>(prevOwn.rhs||0), me:true });
      if(dk>0 && dk<6) addEv('kill', { n:dk, name:mine.name, team:mine.team, hs:(mine.rhs||0)>(prevOwn.rhs||0), weapon:mine.weapon, rk:mine.rk||0 });
      if((mine.rk||0)>=2 && (mine.rk||0)>(prevOwn.rk||0)) addEv('multikill', { n:mine.rk, id:me, name:mine.name, team:mine.team, hs:mine.rhs||0, weapon:mine.weapon, me:true });
      if((mine.mvps||0)>(prevOwn.mvps||0)) addEv('mvp', { name:mine.name });
      if(prevOwn.alive && !mine.alive) addEv('death', { name:mine.name });
    }
    prevOwn = mine;
  } else if(prevOwn?.alive && lastOwn){ addEv('death', { name:lastOwn.name }); prevOwn = { ...prevOwn, alive:false }; }
  if(out.players){
    // кто кого убил: у кого выросли киллы и кто только что умер (в одном пакете от CS2)
    const killers=[], victims=[];
    for(const pl of out.players){
      const pv=prevAll[pl.id];
      if(pv && (pl.rk||0)>=2 && (pl.rk||0)>(pv.rk||0)) addEv('multikill', { n:pl.rk, id:pl.id, name:pl.name, team:pl.team, weapon:pl.weapon });
      if(pv){
        for(let i=0;i<Math.min(5,(pl.k||0)-(pv.k||0));i++) killers.push({ pl, hs:(pl.rhs||0)>(pv.rhs||0) });
        if(pv.alive && !pl.alive) victims.push(pl);
      }
      prevAll[pl.id]=pl;
    }
    for(const kl of killers){
      const i=victims.findIndex(v=>v.team!==kl.pl.team); const v = i>=0 ? victims.splice(i,1)[0] : null;
      addEv('frag', { killer:kl.pl.name, kid:kl.pl.id, kteam:kl.pl.team, victim:v?.name||null, vid:v?.id||null, vteam:v?.team||null, weapon:kl.pl.weapon, hs:kl.hs });
    }
  }
  if(out.bomb && out.bomb!==prevBomb && ['planted','defused','exploded'].includes(out.bomb)) addEv('bomb_'+out.bomb, {});
  prevBomb = out.bomb;
  const rp = g.round?.phase;
  if(rp==='over' && prevRPhase && prevRPhase!=='over'){
    saveStats(true);
    const win=g.round?.win_team, my=(own?mine.team:lastOwn?.team)||null;
    addEv('round_end', { win, my, ct:out.ct, tt:out.tt });
  }
  if(rp) prevRPhase = rp;
  out.evs = evs.slice(-14);
  return out;
}
// ---- файт: подсказка кастеру «бой у игроков №N и №M» (только в пульт и док, на стрим не идёт) ----
// Номер на экране — клавиша наблюдателя CS2. observer_slot идёт 0–9: слот 0 — первый игрок (клавиша 1), слот 9 — десятый (клавиша 0).
// Та же формула в core.js (slotLabel). -1 и пустое значение — «нет номера».
const FIGHT_WIN = 2000, FIGHT_TTL = 4000;
function slotKey(s){ const n = Number(s); return s!=null && s!=='' && Number.isInteger(n) && n>=0 && n<=9 ? (n+1)%10 : null; }
// Режим «по порядку в худе»: внутри команды по слоту, слева (CT) 1–5, справа (T) 6–0. Та же формула в core.js (cs2HudSlots).
function hudSlots(players){
  const out = {};
  for(const side of ['CT', 'T']){
    (players||[]).filter(p => p.team===side).sort((a, b) => (slotKey(a.slot)==null ? 99 : Number(a.slot)) - (slotKey(b.slot)==null ? 99 : Number(b.slot)))
      .slice(0, 5).forEach((p, i) => { out[p.id] = (side==='CT' ? 0 : 5) + i; });
  }
  return out;
}
// Чистая функция: по прошлому и новому пакету allplayers (и событиям frag) решает, есть ли бой. Кандидаты по силе:
//  3. урон: игрок одной команды получил урон или погиб, а игрок другой команды за окно 2 с действовал (recent = { hurt, act });
//  2. выстрел: у игрока в этом пакете упали патроны (то же оружие). Враг — ближайший в поле зрения (угол ≤ 25°, до 2500 юнитов),
//     иначе ближайший в 1000 юнитах; без позиций — самый свежий раненый или активный враг;
//  1. предфайт: два живых врага ближе 1500 юнитов смотрят друг на друга (угол обоих ≤ 30°).
// Выстрел и предфайт показывают файт до первого урона. cur — ключ текущей пары: она остаётся, пока не появился кандидат сильнее.
const SHOT_CONE = 25, SHOT_DIST = 2500, SHOT_NEAR = 1000, PRE_CONE = 30, PRE_DIST = 1500;
const isSide = t => t==='CT' || t==='T';
const distOf = (a, b) => a.pos && b.pos ? Math.hypot(a.pos[0]-b.pos[0], a.pos[1]-b.pos[1], (a.pos[2]-b.pos[2])*.5) : null;
// угол между направлением взгляда p (p.fw, градусы) и направлением на q; null, если чего-то не хватает
function aimOff(p, q){
  if(!p.pos || !q.pos || p.fw==null) return null;
  const d = Math.atan2(q.pos[1]-p.pos[1], q.pos[0]-p.pos[0]) * 180 / Math.PI - p.fw;
  return Math.abs(((d % 360) + 540) % 360 - 180);
}
function detectFight(prevPlayers, players, evs, now, recent, cur, hud){
  const keep = m => { const o = {}; for(const [id, t] of Object.entries(m||{})) if(now-t < FIGHT_WIN) o[id] = t; return o; };
  const hurt = keep(recent?.hurt), act = keep(recent?.act);
  const byId = new Map((players||[]).map(p => [String(p.id), p]));
  const mark = (m, id, t) => { if(byId.has(String(id)) && now-t < FIGHT_WIN) m[id] = Math.max(m[id]||0, t); };
  const shots = [];
  for(const p of byId.values()){
    const pv = prevPlayers?.[p.id]; if(!pv) continue;
    if((p.hp??0) < (pv.hp??0)){ mark(hurt, p.id, now); mark(act, p.id, now); }
    // выстрел: в том же оружии стало меньше патронов (перезарядка их только добавляет)
    if(p.weapon && p.weapon===pv.weapon && p.ammo!=null && pv.ammo!=null && p.ammo < pv.ammo && p.alive!==false){ mark(act, p.id, now); shots.push(p); }
  }
  for(const e of evs||[]) if(e?.k==='frag' && now-(e.t||0) < FIGHT_WIN){ if(e.kid!=null) mark(act, e.kid, e.t); if(e.vid!=null){ mark(hurt, e.vid, e.t); mark(act, e.vid, e.t); } }
  const hs = hud ? hudSlots(players) : null;
  const who = id => { const p = byId.get(String(id)); return { id:p.id, slot:slotKey(hs && p.id in hs ? hs[p.id] : p.slot), name:String(p.name||'?').slice(0, 40), team:p.team }; };
  const cands = [];
  const add = (id1, id2, pri, t, dist) => {
    const x = who(id1), y = who(id2), [a, b] = x.team==='CT' ? [x, y] : [y, x];
    const key = `${a.id}|${b.id}`; if(!cands.some(c => c.key===key && c.pri>=pri)) cands.push({ a, b, t, key, pri, dist:dist ?? 1e9 });
  };
  // 3. урон
  for(const [hid, ht] of Object.entries(hurt)){
    const hp = byId.get(String(hid)); if(!hp || !isSide(hp.team)) continue;   // кого ранили, но в новом пакете его уже нет
    const foe = Object.entries(act).filter(([id]) => { const t = byId.get(String(id))?.team; return isSide(t) && t!==hp.team; })
      .sort((a, b) => { const da = distOf(hp, byId.get(String(a[0]))), db = distOf(hp, byId.get(String(b[0]))); return da!=null && db!=null && da!==db ? da-db : b[1]-a[1]; })[0];
    if(foe) add(hid, foe[0], 3, Math.max(ht, foe[1]));
  }
  const alive = [...byId.values()].filter(p => isSide(p.team) && p.alive!==false && (p.hp==null || p.hp>0));
  // 2. выстрел
  for(const sh of shots){
    if(!isSide(sh.team)) continue;
    const foes = alive.filter(p => p.team!==sh.team);
    let foe = null;
    if(sh.pos && sh.fw!=null && foes.some(p => p.pos)){
      const near = foes.map(p => ({ p, d:distOf(sh, p), ang:aimOff(sh, p) })).filter(x => x.d!=null).sort((x, y) => x.d-y.d);
      foe = (near.find(x => x.ang<=SHOT_CONE && x.d<=SHOT_DIST) || near.find(x => x.d<=SHOT_NEAR))?.p;
    } else {
      const f = foes.map(p => ({ p, t:Math.max(hurt[p.id]||0, act[p.id]||0) })).filter(x => x.t).sort((x, y) => y.t-x.t)[0];
      foe = f?.p;
    }
    if(foe) add(sh.id, foe.id, 2, now, distOf(sh, foe));
  }
  // 1. предфайт: смотрят друг на друга, оба живы
  for(const x of alive) for(const y of alive){
    if(x.team!=='CT' || y.team!=='T') continue;
    const d = distOf(x, y), ax = aimOff(x, y), ay = aimOff(y, x);
    if(d!=null && d<=PRE_DIST && ax!=null && ay!=null && ax<=PRE_CONE && ay<=PRE_CONE) add(x.id, y.id, 1, now, d);
  }
  cands.sort((p, q) => q.pri-p.pri || q.t-p.t || p.dist-q.dist);
  const keepCur = cur && cands.find(c => c.key===cur && c.pri>=(cands[0]?.pri||0));
  const fight = keepCur || cands[0] || null;
  return { fight, recent:{ hurt, act } };
}
let fightPrev = {}, fightRecent = null, fight = null, fightPubAt = 0;
function fightNow(){ const left = fight ? fight.until - Date.now() : 0; return left > 0 ? { a:fight.a, b:fight.b, ttl:left } : null; }
function trackFight(out){
  if(!out.players){ fightPrev = {}; fightRecent = null; return; }
  const now = Date.now(), live = fightNow(), r = detectFight(fightPrev, out.players, out.evs, now, fightRecent, live && fight.key, screenNum==='hud');
  fightRecent = r.recent; fightPrev = Object.fromEntries(out.players.map(p => [p.id, p]));
  if(!r.fight) return;
  const same = live && fight.key===r.fight.key;
  fight = { ...r.fight, until:r.fight.t + FIGHT_TTL };
  // новая пара уходит сразу, одна и та же — раз в секунду, только чтобы продлить ttl
  if(!same || now-fightPubAt > 1000) publishFight();
}
// Отдельная неретейн-тема cs2fight: пульт подписан, виджет OBS — нет. Публикует только программа (в PUB_MOD/PUB_LOCAL её нет).
async function publishFight(){
  const f = fightNow(); if(!f || !AES || !ROOM) return;
  fightPubAt = Date.now();
  aedes.publish({ cmd:'publish', topic:T('cs2fight'), payload:await sealAES({ ...f, t:Date.now() }), qos:0, retain:false, dup:false }, ()=>{});
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
// ---- серия карт BO1/BO3/BO5: итог каждой карты пишем сами, пульт меняет формат, сбрасывает и правит ----
// Команды «a» и «b» — по именам (team_ct.name / team_t.name), так смена сторон в половине не путает.
// Без имён «Команда 1» (a) — кто начал карту за CT, стороны меняются на каждом перерыве (map.phase intermission).
// Файл data/cs2-series.json переживает перезапуск программы. Чистые функции ниже (до «let series») проверяет tests/cs2auto.test.js.
const SER_BO = [1, 3, 5], SER_MAX = 7;
const serName = v => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
const serNum = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(99, Math.max(0, n)) : 0; };
const SER_STALE = 6 * 3600 * 1000;   // последняя карта старше: серия вчерашняя, начинаем заново
// режимы без серии: deathmatch, gungame*/armsrace, training, survival, coop*; остальные (competitive, wingman, casual, кастомные) идут в зачёт
const serSkipMode = v => /deathmatch|gungame|armsrace|training|survival|coop/i.test(String(v ?? ''));
const serMapName = v => String(v ?? '').replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 40);
function serMap(m){
  if(!m || typeof m!=='object') return null;
  const a = serNum(m.a?.score), b = serNum(m.b?.score);
  const win = m.win==='a' || m.win==='b' ? m.win : m.win==='' && 'win' in m ? '' : a>b ? 'a' : b>a ? 'b' : '';
  return { map:serMapName(m.map), a:{ name:serName(m.a?.name), score:a }, b:{ name:serName(m.b?.name), score:b }, win, at:Number.isFinite(Number(m.at)) && Number(m.at)>0 ? Math.round(Number(m.at)) : 0 };
}
function cleanSeries(j){
  const s = { v:1, bo:SER_BO.includes(Number(j?.bo)) ? Number(j.bo) : 3, names:{ a:serName(j?.names?.a), b:serName(j?.names?.b) },
    maps:(Array.isArray(j?.maps) ? j.maps : []).slice(0, 50).map(serMap).filter(Boolean).slice(0, SER_MAX), cur:null,
    touched:Number.isFinite(Number(j?.touched)) && Number(j.touched)>0 ? Math.round(Number(j.touched)) : 0 };
  const c = j?.cur;
  if(c && typeof c==='object' && serMapName(c.map)) s.cur = { map:serMapName(c.map), live:!!c.live, done:!!c.done, aSide:c.aSide==='T' ? 'T' : 'CT', sw:c.sw ? 1 : 0,
    round:serNum(c.round), ct:serNum(c.ct), tt:serNum(c.tt), ph:String(c.ph ?? '').slice(0, 20), go:Number(c.go) || 0 };
  return s;
}
// сторона команды a сейчас: по имени, если оно есть в пакете, иначе по стороне в начале карты и числу перерывов
function serSide(s, c, p){
  const A = s.names.a;
  if(A && p?.ctName===A) return 'CT';
  if(A && p?.tName===A) return 'T';
  return c.sw ? (c.aSide==='CT' ? 'T' : 'CT') : c.aSide;
}
function serRecord(s, c, ct, tt, p, now){
  const side = serSide(s, c, p), a = side==='CT' ? ct : tt, b = side==='CT' ? tt : ct;
  s.maps.push(serMap({ map:c.map, a:{ name:s.names.a, score:a }, b:{ name:s.names.b, score:b }, at:now }));
  if(s.maps.length > SER_MAX) s.maps.shift();
}
// Один пакет CS2 (сжатый, как в compactGsi) → меняет серию s. true, если что-то поменялось.
function seriesStep(s, p, now){
  const map = serMapName(p?.map);
  if(!map || !p.phase) return false;
  let c = s.cur, ch = false;
  const round = Number.isInteger(p.round) ? p.round : null;
  // новая карта; новый матч на той же карте после конца; рестарт посреди карты (раунд пошёл назад) — без записи
  if(!c || c.map!==map || (c.done && p.phase!=='gameover') || (!c.done && round!==null && round < c.round)){
    c = s.cur = { map, live:false, done:false, aSide:'CT', sw:0, round:round ?? 0, ct:0, tt:0, ph:'', go:0 }; ch = true;
  }
  if(p.phase==='live' && !c.live){
    c.live = true; c.sw = 0;
    const last = s.maps[s.maps.length - 1];
    if(last && (!last.at || now - Math.max(last.at || 0, s.touched || 0) > SER_STALE)){ s.maps = []; s.names = { a:'', b:'' }; }   // старая серия (последняя карта и ручная правка s.touched старше 6 ч; запись без времени из файла 1.0 тоже старая): начинаем заново, формат остаётся
    const A = s.names.a, B = s.names.b, ctN = serName(p.ctName), tN = serName(p.tName);
    if(!A && !B && (ctN || tN)) s.names = { a:ctN, b:tN };
    c.aSide = (s.names.a && tN===s.names.a) || (s.names.b && ctN===s.names.b) ? 'T' : 'CT';
    ch = true;
  }
  if(p.phase==='intermission' && c.ph!=='intermission' && c.live){ c.sw ^= 1; ch = true; }
  const ct = serNum(p.ct), tt = serNum(p.tt);
  if(p.phase==='gameover' && c.live && !c.done){
    c.done = true; c.go = now; ch = true;
    if(ct + tt > 0 && !serSkipMode(p.mode)) serRecord(s, c, ct, tt, p, now);   // карту засчитывает только gameover
  }
  if(c.ph!==p.phase){ c.ph = String(p.phase).slice(0, 20); ch = true; }
  if(round!==null && round!==c.round){ c.round = round; ch = true; }
  if(ct!==c.ct || tt!==c.tt){ c.ct = ct; c.tt = tt; ch = true; }
  return ch;
}
// Что видят пульт и виджет: формат, команды с победами, карты, кто сейчас за CT (a/b), время конца карты
function seriesView(s, p){
  let wa = 0, wb = 0;
  for(const m of s.maps){ if(m.win==='a') wa++; else if(m.win==='b') wb++; }
  const c = s.cur, side = c ? serSide(s, c, p) : null;
  return { bo:s.bo, a:{ name:s.names.a, w:wa }, b:{ name:s.names.b, w:wb }, maps:s.maps, ctIs:side ? (side==='CT' ? 'a' : 'b') : null, map:c?.map || '', go:c?.done ? c.go : 0 };
}
// Команда пульта (тема cs2cmd): формат, сброс, ручная правка карт и имён
function seriesCmd(s, m, now = Date.now()){
  if(!m || typeof m!=='object') return false;
  if(m.op==='bo' && SER_BO.includes(Number(m.bo))){ s.bo = Number(m.bo); return true; }
  if(m.op==='reset'){ s.maps = []; s.names = { a:'', b:'' }; return true; }
  if(m.op==='edit'){
    const old = s.maps;
    const t = cleanSeries({ bo:s.bo, names:m.names, maps:(Array.isArray(m.maps) ? m.maps : []).map((x, i) => x && typeof x==='object' ? { ...x, at:old[i] && old[i].map===serMapName(x.map) && old[i].at ? old[i].at : now } : x) });
    s.maps = t.maps; s.names = t.names; if(SER_BO.includes(Number(m.bo))) s.bo = Number(m.bo);
    s.touched = now;
    return true;
  }
  return false;
}
const SERIES_FILE = path.join(BASE, 'cs2-series.json');
let series = cleanSeries(null), serPub = '', serLast = null;
try{ series = cleanSeries(JSON.parse(fs.readFileSync(SERIES_FILE, 'utf8'))); }catch{}
function saveSeries(){ try{ fs.writeFileSync(SERIES_FILE, JSON.stringify(series), { mode:0o600 }); }catch{} }
function trackSeries(out){
  serLast = out;
  if(seriesStep(series, out, Date.now())) saveSeries();
  publishSeries();
}
// Ретейн-тема cs2series: публикует только программа (в PUB_MOD/PUB_LOCAL её нет), шлём только когда поменялось
async function publishSeries(force){
  if(!AES || !ROOM) return;
  const v = seriesView(series, serLast), key = JSON.stringify(v);
  if(key===serPub && !force) return;
  serPub = key;
  aedes.publish({ cmd:'publish', topic:T('cs2series'), payload:await sealAES({ ...v, t:Date.now() }), qos:1, retain:true, dup:false }, ()=>{});
}
// Пульт подписывает команду ключом модератора: openSigned проверяет подпись открытым ключом комнаты и расшифровывает.
// Команды шлют модераторы и пульт стримера на этом ПК (у обоих в PUB_MOD есть cs2cmd).
aedes.on('publish', async (packet, client) => {
  if(!(client?.conn?._mod || client?.conn?._streamer) || !inRoom(packet.topic) || !packet.topic.endsWith('/cs2cmd')) return;
  const m = await openSigned(packet.payload, 16384);
  if(!m || !(Math.abs(Date.now() - Number(m.t)) < 120000)) return;   // старую команду повторно не принимаем
  if(seriesCmd(series, m)){ saveSeries(); log('🏆 CS2 series:', m.op==='bo' ? 'BO'+series.bo : m.op==='reset' ? 'reset' : 'manual edit'); publishSeries(true); }
});
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
    "allplayers_position"    "1"
    "phase_countdowns"       "1"
    "bomb"                   "1"
    "allgrenades"            "1"
    "grenades"               "1"
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
  status.gsiPath = file; cfg.gsiFile = file; saveCfg(); log('✓ CS2 config file written:', file);
  return file;
}

// ---------- файлы виджета: свежие с сайта, запасные встроены в программу ----------
const CACHE = path.join(BASE, 'cache'); fs.mkdirSync(CACHE, { recursive:true });
// Ключ = путь файла на сайте и на этом сервере; в кэше имя без «/»
const EMBED = { 'widget/widget.html':WIDGET_HTML, 'shared/core.js':CORE_JS, 'shared/core.css':CORE_CSS, 'shared/case3d.js':CASE3D_JS, 'shared/media.js':MEDIA_JS, 'shared/cs2-maps.js':CS2_MAPS_JS };
const cacheName = f => f.replace(/\//g, '_');
const files = { ...EMBED };
for(const f of Object.keys(files)) try{ files[f] = fs.readFileSync(path.join(CACHE, cacheName(f)), 'utf8'); }catch{}
async function refreshSite(){
  if(process.env.OVERLAY_SITE==='off') return;   // тесты: только встроенные файлы
  try{
    const got = {};
    for(const f of Object.keys(EMBED)){
      const r = await fetch(SITE+f+'?t='+Date.now(), { signal:AbortSignal.timeout(6000) });
      if(!r.ok) throw new Error(f+': HTTP '+r.status);
      got[f] = await r.text();
    }
    if(!got['widget/widget.html'].includes('core.js')) throw new Error('странный widget.html');
    for(const [f,txt] of Object.entries(got)){ files[f]=txt; fs.writeFileSync(path.join(CACHE, cacheName(f)), txt); }
  }catch(e){ log('⚠ Could not update widget files from the site (', e.message, '), using saved ones'); }
}
refreshSite(); setInterval(refreshSite, 10*60*1000);
// виджет перезагружается за обновлением: сначала сами берём свежие файлы с сайта
let refreshing=null, lastRefresh=0;
function refreshNow(){ if(Date.now()-lastRefresh<20000) return Promise.resolve(); return refreshing ||= refreshSite().finally(()=>{ refreshing=null; lastRefresh=Date.now(); }); }
// Подложки радара вшиты в программу; недостающие берём с сайта и держим в кэше. Своя картинка в data/radar важнее.
const RADAR_CACHE = path.join(CACHE, 'radar');
const RADAR_MEM = new Map();
async function radarImg(name){
  if(typeof name!=='string' || !/^[a-z0-9_-]{1,60}\.webp$/.test(name)) return null;
  if(RADAR_MEM.has(name)) return RADAR_MEM.get(name);
  const dirs = [path.join(BASE, 'radar'), ...(compiled ? [] : [path.join(import.meta.dir, '..', 'web', 'shared', 'radar')]), RADAR_CACHE];
  for(const d of dirs){ try{ return fs.readFileSync(path.join(d, name)); }catch{} }
  // подложки вшиты в саму программу (tools/radar-embed.sh): работает без интернета и до выхода сайта
  if(Object.hasOwn(RADAR_EMBED, name)){ try{ return Buffer.from(await Bun.file(RADAR_EMBED[name]).arrayBuffer()); }catch{} }
  if(process.env.OVERLAY_SITE==='off') return null;
  try{
    const r = await fetch(SITE+'shared/radar/'+name, { signal:AbortSignal.timeout(6000) });
    if(!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if(b.length < 12 || b.length > 2*1048576 || b.subarray(0, 4).toString()!=='RIFF' || b.subarray(8, 12).toString()!=='WEBP' || b.readUInt32LE(4) + 8 !== b.length) return null;   // a real WebP: RIFF size matches the body
    if(RADAR_MEM.size >= 64) RADAR_MEM.delete(RADAR_MEM.keys().next().value);
    RADAR_MEM.set(name, b);   // kept in memory only: nothing downloaded is written to disk
    return b;
  }catch{ return null; }
}
function widgetHtml(){
  // mqtt.min.js отдаём свой (та же версия, тот же хеш)
  return files['widget/widget.html'].replace(/src="https:\/\/unpkg\.com\/mqtt@[^"]+"/, 'src="../mqtt.min.js"');
}


// ---------- автообновление программы ----------
// Проверяет GitHub Releases, качает .zip для своей системы, сверяет SHA-256 и подменяет себя.
// Посреди стрима не перезапускается: только при старте (пока OBS не подключился), в простое или по кнопке.
// Два вида сборок:
// • один файл без окна (запуск из исходников, разработка): HudiniHost-windows.exe.zip и т.п.;
// • приложение Hudini с окном и треем (OVERLAY_APP): HudiniHost-<система>-<версия>.zip, внутри папка «HudiniHost/»
//   с программой, этим сервером и README. Меняем всё, кроме data/, и запускаем программу с окном заново.
const REPO = 'niko-ua-designer/hudini';
const ASSET = { win32:'HudiniHost-windows.exe', linux:'HudiniHost-linux', darwin: os.arch()==='arm64' ? 'HudiniHost-mac-arm64' : 'HudiniHost-mac-intel' }[process.platform];
const APP_OS = { win32:'windows', linux:'linux', darwin:'mac' }[process.platform];   // для macOS одна universal-сборка (Apple Silicon и Intel)
const ASSET_OS = APP_OS;   // windows | linux | mac: HudiniHost-<система>-<версия>.zip
// Программа с окном: на macOS это папка «Hudini.app», файл внутри неё; иначе сам файл программы
const APP_BUNDLE = (/^(.*?[\\/][^\\/]+\.app)[\\/]Contents[\\/]MacOS[\\/]/.exec(APP_EXE) || [])[1] || APP_EXE;
const APP_ROOT = APP_BUNDLE ? path.dirname(APP_BUNDLE) : '';   // папка, куда распакован архив
const APP_ENTRY = APP_BUNDLE ? path.basename(APP_BUNDLE) : '';
const startedAt = Date.now();
const upd = { state:'idle', latest:null, err:'', staged:null, auto: cfg.autoUpdate!==false, checkedAt:0, prog:null };
// Версии вида 1.0.0 и 1.0.0-rc.1 (rc раньше готовой версии)
const parseVer = v => { const m = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(v||''); return m ? [+m[1], +m[2], +m[3], m[4]==null ? Infinity : +m[4]] : null; };
const cmpVer = (a,b) => { const x=parseVer(a), y=parseVer(b); for(let i=0;i<4;i++) if(x[i]!==y[i]) return x[i]>y[i] ? 1 : -1; return 0; };
// Версия в имени файла: 1.0.0-rc.4 → 1.0rc4, 1.0.0 → 1.0, 1.0.2 → 1.0.2
const prettyVer = v => { const m = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(v||''); return m ? `${m[1]}.${m[2]}${m[3]!=='0' ? '.'+m[3] : ''}${m[4]!=null ? 'rc'+m[4] : ''}` : v; };
// Подпись обновлений: релиз несёт SHA256SUMS.txt.sig — подпись Ed25519 строки «hudini-update\n<версия>\n» + SHA256SUMS.txt.
// Закрытый ключ есть только в секретах GitHub (HUDINI_SIGNING_KEY), здесь — публичный. Без верной подписи обновление не ставится,
// поэтому подменённый релиз (даже с верными суммами) или старая версия под новым тегом не пройдут.
const UPDATE_KEY = 'MCowBQYDK2VwAyEAHTTYc2pvx5Xi5GAD3wXNZVpN+hHLVNpVpludrApZcG0=';
function updateSigOk(ver, sums, sigB64){
  if(!UPDATE_KEY) return false;
  try{
    const key = nodeCrypto.createPublicKey({ key:Buffer.from(UPDATE_KEY, 'base64'), format:'der', type:'spki' });
    return nodeCrypto.verify(null, Buffer.from(`hudini-update\n${ver}\n${sums}`), key, Buffer.from(String(sigB64).trim(), 'base64'));
  }catch{ return false; }
}
// Предварительные версии (rc) получают только те, у кого уже стоит rc. Старые беты v0.x (Overlay Host) ниже 1.0 и не выбираются.
function pickRelease(list){
  const beta = VERSION.includes('-');
  return (Array.isArray(list) ? list : [list]).filter(x => x && !x.draft && /^v\d+\.\d+\.\d+(-rc\.\d+)?$/.test(x.tag_name||'') && (beta || (!x.prerelease && !x.tag_name.includes('-'))))
    .sort((a,b) => cmpVer(b.tag_name.slice(1), a.tag_name.slice(1)))[0] || null;
}
function pickAsset(assets, ver){
  assets = Array.isArray(assets) ? assets : [];
  if(!APP) return assets.find(a => a.name===ASSET+'.zip');
  // Релизы выходят как HudiniHost-<система>-<версия>.zip (windows | linux | mac; эти имена ждёт и 1.0); Hudini-<система>-<версия>.zip — будущее имя
  const names = [`Hudini-${APP_OS}`, `HudiniHost-${ASSET_OS}`];
  for(const n of names){ const a = assets.find(a => a.name===`${n}-${prettyVer(ver)}.zip`); if(a) return a; }
  for(const n of names){ const re = new RegExp('^'+n+'-\\d[\\w.]*\\.zip$'), a = assets.find(a => re.test(a.name||'')); if(a) return a; }
  return undefined;
}
// Разбор .zip: список записей, данные распаковываются по запросу
function unzipAll(buf){
  let eocd=-1;
  for(let i=buf.length-22; i>=Math.max(0, buf.length-65557); i--) if(buf.readUInt32LE(i)===0x06054b50){ eocd=i; break; }
  if(eocd<0) throw new Error('архив повреждён');
  let p=buf.readUInt32LE(eocd+16); const count=buf.readUInt16LE(eocd+10), out=[];
  for(let i=0;i<count;i++){
    if(p+46>buf.length || buf.readUInt32LE(p)!==0x02014b50) throw new Error('архив повреждён');
    const madeBy=buf.readUInt16LE(p+4)>>8, method=buf.readUInt16LE(p+10), csize=buf.readUInt32LE(p+20), usize=buf.readUInt32LE(p+24);
    const nlen=buf.readUInt16LE(p+28), xlen=buf.readUInt16LE(p+30), clen=buf.readUInt16LE(p+32), attr=buf.readUInt32LE(p+38), lho=buf.readUInt32LE(p+42);
    const name=buf.toString('utf8', p+46, p+46+nlen).replace(/\\/g, '/');   // Compress-Archive из PowerShell 5 пишет обратные слеши
    out.push({ name, dir:name.endsWith('/'), mode: madeBy===3 ? attr>>>16 : 0, data(){
      const start=lho+30+buf.readUInt16LE(lho+26)+buf.readUInt16LE(lho+28), data=buf.subarray(start, start+csize);
      const o = method===0 ? Buffer.from(data) : method===8 ? zlib.inflateRawSync(data) : null;
      if(!o || o.length!==usize) throw new Error('не распаковался '+name);
      return o;
    } });
    p+=46+nlen+xlen+clen;
  }
  return out;
}
function unzipSingle(buf, want){
  const e = unzipAll(buf).find(e => !e.dir && (e.name===want || e.name.endsWith('/'+want)));
  if(!e) throw new Error('в архиве нет '+want);
  return e.data();
}
// Распаковать архив программы с окном в dest. Общую папку («Hudini/») убираем, data/ не трогаем.
// Внутри dest? Сравниваем настоящие пути (realpath), чтобы ссылка на папку не вывела запись наружу
const inside = (root, p) => p===root || p.startsWith(root+path.sep);
function extractApp(zip, dest){
  const list = unzipAll(zip).filter(e => e.name && !e.name.startsWith('__MACOSX/'));
  if(list.length > 5000) throw new Error('архив повреждён: слишком много файлов');
  const top = list[0]?.name.split('/')[0];
  const strip = list.every(e => e.name.includes('/') && e.name.split('/')[0]===top) ? top+'/' : '';
  fs.rmSync(dest, { recursive:true, force:true }); fs.mkdirSync(dest, { recursive:true });
  const root = fs.realpathSync(dest);
  let n = 0, total = 0;
  const links = [];
  try{
    for(const e of list){
      const rel = e.name.slice(strip.length);
      const parts = rel.split('/').filter(Boolean);
      if(!parts.length || parts[0]==='data') continue;   // настройки и файлы стримера остаются как есть
      // без абсолютных путей, «..», имён дисков, NUL и двоеточий (потоки NTFS)
      if(rel.startsWith('/') || /^[a-z]:/i.test(rel) || parts.some(x => x==='..' || x==='.' || /[\0:]/.test(x))) throw new Error('архив повреждён: '+e.name);
      const to = path.join(root, ...parts);
      if(e.dir){ fs.mkdirSync(to, { recursive:true }); if(!inside(root, fs.realpathSync(to))) throw new Error('архив повреждён: '+e.name); continue; }
      fs.mkdirSync(path.dirname(to), { recursive:true });
      const dir = fs.realpathSync(path.dirname(to));
      if(!inside(root, dir) || isLink(to)) throw new Error('архив повреждён: '+e.name);
      const data = e.data();
      total += data.length; if(total > 1024*1048576) throw new Error('архив повреждён: слишком большой');
      if((e.mode & 0o170000)===0o120000){   // символическая ссылка (бывает внутри .app): только внутрь архива
        const target = data.toString('utf8');
        if(path.isAbsolute(target) || /[\0\\]/.test(target) || !inside(root, path.resolve(dir, target))) throw new Error('архив повреждён: '+e.name);
        fs.symlinkSync(target, to); links.push({ to, name:e.name }); n++; continue;
      }
      fs.writeFileSync(to, data, { flag:'wx' }); n++;
      if(process.platform!=='win32'){
        const m = e.mode & 0o777;
        fs.chmodSync(to, m || (/\.[a-z0-9]{1,5}$/i.test(parts.at(-1)) ? 0o644 : 0o755));
      }
    }
    if(!n) throw new Error('архив пустой');
    // Цепочку ссылок (B → «.», A → «B/..») проверка по тексту пути не видит: смотрим, куда каждая ссылка ведёт на деле.
    // Ссылка в никуда тоже отказ: куда она укажет потом, заранее не узнать.
    for(const l of links){
      let real = ''; try{ real = fs.realpathSync(l.to); }catch{}
      if(!real || !inside(root, real)) throw new Error('архив повреждён: '+l.name);
    }
  }catch(e){ try{ fs.rmSync(dest, { recursive:true, force:true }); }catch{} throw e; }
  return dest;
}
const isLink = p => { try{ return fs.lstatSync(p).isSymbolicLink(); }catch{ return false; } };
// Переместить файл или папку; если data на другом диске (macOS: папка в Application Support), копируем
function moveSync(from, to){
  try{ fs.renameSync(from, to); }
  catch(e){ if(e.code!=='EXDEV') throw e; fs.cpSync(from, to, { recursive:true, verbatimSymlinks:true }); fs.rmSync(from, { recursive:true, force:true }); }
}
let checking=null;
// Приложение читает строки «UPDATE <состояние> <версия>» (роль модератора: нет страницы управления) и может ответить «APPLY»
function checkUpdate(applyIfIdle){ return checking ||= doCheck(applyIfIdle).finally(()=>{ checking=null; appSay('UPDATE '+upd.state+' '+(upd.latest||'-')); }); }
async function doCheck(applyIfIdle){
  if(!compiled || process.env.OVERLAY_NO_UPDATE || !ASSET || (APP && !APP_EXE)) { upd.state='off'; return; }
  try{
    upd.state='checking'; upd.err='';
    const r=await fetch(process.env.OVERLAY_RELEASES_API || `https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers:{ accept:'application/vnd.github+json', 'user-agent':'HudiniHost' }, signal:AbortSignal.timeout(15000) });
    if(!r.ok) throw new Error('GitHub ответил '+r.status);
    const rel=pickRelease(await r.json()), ver=rel ? rel.tag_name.slice(1) : VERSION;
    upd.checkedAt=Date.now(); upd.latest=ver;
    if(!rel || cmpVer(ver, VERSION)<=0){ upd.state='latest'; return; }
    if(upd.staged?.ver!==ver){
      const zipA=pickAsset(rel.assets, ver), sumA=rel.assets?.find(a=>a.name==='SHA256SUMS.txt'), sigA=rel.assets?.find(a=>a.name==='SHA256SUMS.txt.sig');
      if(!zipA || !sumA) throw new Error('в релизе нет файла для этой системы');
      if(!sigA) throw new Error('у релиза нет подписи, обновление отменено');
      upd.state='downloading'; log('⬇ Downloading update', ver, '…');
      const sums=await (await fetch(sumA.browser_download_url, { signal:AbortSignal.timeout(30000) })).text();
      const sig=await (await fetch(sigA.browser_download_url, { signal:AbortSignal.timeout(30000) })).text();
      if(!updateSigOk(ver, sums, sig)) throw new Error('подпись релиза не совпала, обновление отменено');
      const line=sums.split('\n').find(l=>l.trim().replace(/^\S+\s+\*?/,'')===zipA.name);
      const want=(line||'').trim().split(/\s+/)[0];
      const resp=await fetch(zipA.browser_download_url, { signal:AbortSignal.timeout(10*60*1000) });
      if(!resp.ok) throw new Error('GitHub ответил '+resp.status);
      const chunks=[]; upd.prog={ done:0, total:Number(resp.headers.get('content-length')) || zipA.size || 0 };
      for await(const c of resp.body){ chunks.push(c); upd.prog.done+=c.length; }
      const zip=Buffer.concat(chunks); upd.prog=null;
      const got=nodeCrypto.createHash('sha256').update(zip).digest('hex');
      if(!want || got!==want) throw new Error('контрольная сумма не совпала, обновление отменено');
      if(APP){
        const dir = extractApp(zip, path.join(BASE, 'update', ver));
        if(!fs.existsSync(path.join(dir, APP_ENTRY))) throw new Error('в архиве нет '+APP_ENTRY);
        upd.staged={ ver, dir };
      } else {
        const staged=process.execPath+'.new';
        fs.writeFileSync(staged, unzipSingle(zip, ASSET)); fs.chmodSync(staged, 0o755);
        upd.staged={ ver, path:staged };
      }
      log('✓ Update', ver, 'downloaded and verified');
    }
    upd.state='ready';
    if(applyIfIdle && upd.auto && isIdle()) await applyUpdate();
  }catch(e){ upd.prog=null; upd.state='error'; upd.err=e.message; log('⚠ Update:', e.message); }
}
// «Простой»: OBS-виджет не подключён и модераторов нет.
// Роль модератора простоя не знает (пульт работает в окне программы, сервер его не видит): там обновление ставит только
// кнопка в программе (APPLY), сервер лишь сообщает «UPDATE ready».
function isIdle(){ return !ROLE_MOD && modList.size===0 && Date.now()-status.obsSeen > 2*60*1000; }   // modList: и модераторы, и пульт стримера
function stopForRestart(){
  shuttingDown=true;
  try{ local.closeAllConnections?.(); local.close(); modSrv.closeAllConnections?.(); modSrv.close(); }catch{}
}
// Программа с окном: старые файлы → *.old (работающие файлы переименовать можно), новые на их место,
// потом запускаем новую программу с окном. Она ждёт, пока старая закроется, и поднимает новый сервер.
function applyAppUpdate(){
  const src = upd.staged.dir, moved = [];
  const names = fs.readdirSync(src);
  try{
    for(const n of names){
      const dst = path.join(APP_ROOT, n);
      let old = dst+'.old';
      try{ fs.rmSync(old, { recursive:true, force:true }); }catch{ old = dst+'.old'+Date.now(); }   // Windows: прошлый .old ещё занят
      const had = fs.existsSync(dst);
      if(had) fs.renameSync(dst, old);
      moved.push({ dst, old:had ? old : null });
      moveSync(path.join(src, n), dst);
    }
  }catch(e){
    // откатываем всё, что успели поменять
    for(const m of moved.reverse()){ try{ fs.rmSync(m.dst, { recursive:true, force:true }); }catch{} try{ if(m.old) fs.renameSync(m.old, m.dst); }catch{} }
    upd.staged=null; upd.state='error'; upd.err='не смог заменить файлы программы: '+e.message; log('⚠ Update: could not replace program files:', e.message);
    return;
  }
  try{ fs.rmSync(path.join(BASE, 'update'), { recursive:true, force:true }); }catch{}
  log('🔄 Restarting with version', upd.staged.ver, '…');
  stopForRestart();
  const args = ['--updated', '--wait-pid', String(APP_PID), ...(appHidden ? ['--minimized'] : [])];
  const child=spawn(APP_EXE, args, { cwd:APP_ROOT, detached:true, stdio:'ignore', env:{ ...process.env, OVERLAY_UPDATED:'1' } });
  child.on('error', e => log('⚠ New version failed to start:', e.message));
  child.unref();
  appSay('RESTART');   // программа с окном закрывается сама
  setTimeout(()=>process.exit(0), 400);
}
// Вызывается из таймеров: ошибка здесь не должна ронять сервер, а программа не должна остаться без своего файла
async function applyUpdate(){
  if(!upd.staged) return;
  if(APP){
    try{ return applyAppUpdate(); }
    catch(e){ upd.staged=null; upd.state='error'; upd.err='не смог поставить обновление: '+e.message; log('⚠ Update: could not install:', e.message); return; }
  }
  const exe=process.execPath, old=exe+'.old';
  try{ fs.rmSync(old, { force:true }); }catch{}
  try{ fs.renameSync(exe, old); }   // работающий файл можно переименовать, но не перезаписать
  catch(e){ upd.state='error'; upd.err='не смог заменить программу: '+e.message; log('⚠ Update: could not replace the program:', e.message); return; }
  try{ fs.renameSync(upd.staged.path, exe); }
  catch(e){
    try{ fs.renameSync(old, exe); }catch(e2){ log('⚠ Could not restore the old version:', e2.message); }
    try{ fs.rmSync(upd.staged.path, { force:true }); }catch{}
    upd.staged=null; upd.state='error'; upd.err='не смог заменить программу: '+e.message; log('⚠ Update: could not replace the program:', e.message); return;
  }
  log('🔄 Restarting with version', upd.staged.ver, '…');
  stopForRestart();
  const child=spawn(exe, [], { cwd:BASE, detached:true, stdio:'ignore', env:{ ...process.env, OVERLAY_UPDATED:'1' } });
  child.on('error', e => log('⚠ New version failed to start:', e.message));
  child.unref();
  setTimeout(()=>process.exit(0), 400);
}
// при старте убираем старую версию, проверяем обновление; потом раз в 3 часа
if(APP){
  try{ fs.rmSync(path.join(BASE, 'update'), { recursive:true, force:true }); }catch{}
  if(APP_ROOT) try{ for(const n of fs.readdirSync(APP_ROOT)) if(/\.old\d*$/.test(n) && fs.existsSync(path.join(APP_ROOT, n.replace(/\.old\d*$/, '')))) fs.rmSync(path.join(APP_ROOT, n), { recursive:true, force:true }); }catch{}
} else try{ fs.rmSync(process.execPath+'.old', { force:true }); fs.rmSync(process.execPath+'.new', { force:true }); }catch{}
setTimeout(()=>checkUpdate(true), 4000);
setInterval(()=>checkUpdate(true), 3*60*60*1000);
setInterval(()=>{ if(upd.state==='ready' && upd.auto && isIdle() && Date.now()-startedAt>10*60*1000) applyUpdate(); }, 5*60*1000);

// ---------- файлы модераторов на диске ----------
// Пульт шифрует и подписывает файл ключами комнаты, программа хранит байты как есть и отдаёт виджету.
// Лежат в files/<комната>/<id>. Лимиты: размер одного файла, всё место и число файлов (на все комнаты).
const FILES = path.join(BASE, 'files'); fs.mkdirSync(FILES, { recursive:true });
const okId = id => /^[a-z0-9]{8,32}$/i.test(id||'');
const okRoom = r => /^[a-z0-9_-]{4,64}$/i.test(r||'');
const MB = 1048576, PART_MAX = 8*MB + 4096;   // файлы идут кусками по 8 МБ: обрыв связи не стоит всей загрузки
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
// Незаконченные загрузки: «комната/id» → { bytes, at }. Они тоже занимают место, иначе квоту обходят параллельными .part
const uploads = new Map(), UPLOADS_MAX = 4;
const finished = new Map();   // недавно сохранённые файлы: чтобы повтор последнего куска не давал 409
function storage(room){
  let used = 0, n = 0, roomUsed = 0, roomN = 0;
  for(const f of fileIndex.values()){ used += f.size; n++; if(f.room===room){ roomUsed += f.size; roomN++; } }
  for(const u of uploads.values()) used += u.bytes;
  const L = cfg.limits;
  return { used, files:n, roomUsed, roomFiles:roomN, limitBytes:L.totalMB*MB, maxFiles:L.files, maxFileBytes:L.fileMB*MB, limitsSet:!!cfg.limitsSet };
}
const filePath = (room, id) => path.join(FILES, room, id);
class HttpErr extends Error{ constructor(code, msg, extra){ super(msg); this.code = code; this.extra = extra; } }
function putPart(room, id, part, last, buf){
  if(!okRoom(room) || !okId(id)) throw new HttpErr(400, 'плохое имя файла');
  const fin = finished.get(room+'/'+id);
  // повтор последнего куска, который уже принят и файл сохранён: тот же ответ, ничего не пишем
  if(fin && last && part===fin.part && buf.length===fin.lastLen && fileIndex.has(room+'/'+id) && Date.now()-fin.at<600e3)
    return { ok:true, size:fin.size, storage:storage(room) };
  if(fileIndex.has(room+'/'+id)) throw new HttpErr(409, 'файл уже есть');
  const L = cfg.limits, st = storage(room);
  const tmp = filePath(room, id)+'.part';
  fs.mkdirSync(path.join(FILES, room), { recursive:true });
  const key = room+'/'+id;
  const cur = uploads.get(key);
  // Повтор последнего принятого куска (клиент не дождался ответа и послал снова): второй раз не дописываем, отвечаем так же
  if(cur && part===cur.next-1 && buf.length===cur.lastLen && !last){
    cur.at = Date.now();
    return { ok:true, size:cur.bytes, storage:storage(room) };
  }
  if(part===0){ fs.rmSync(tmp, { force:true }); uploads.delete(key);
    if([...uploads.keys()].filter(k => k.startsWith(room+'/')).length >= UPLOADS_MAX) throw new HttpErr(429, 'слишком много загрузок сразу, подожди');
  }
  else if(!cur || !fs.existsSync(tmp)) throw new HttpErr(409, 'начало файла потерялось, загрузи заново');
  else if(part!==cur.next) throw new HttpErr(409, `кусок ${part} пришёл не по порядку, ждали ${cur.next}`);
  const have = part===0 ? 0 : cur.bytes;
  uploads.delete(key);   // своя загрузка не считается дважды в проверке места
  const size = have + buf.length;
  const full = (why, code='full') => { fs.rmSync(tmp, { force:true }); return new HttpErr(413, why, { reason:code, storage:storage(room) }); };
  const st2 = storage(room);
  if(size > L.fileMB*MB + 65536) throw full(`файл больше ${L.fileMB} МБ`, 'file');
  if(st.files >= L.files) throw full(`уже ${st.files} файлов из ${L.files}`, 'count');
  if(st2.used + size > L.totalMB*MB) throw full(`место кончилось: занято ${(st.used/MB).toFixed(0)} из ${L.totalMB} МБ`, 'space');
  try{
    fs.appendFileSync(tmp, buf);
    if(last){
      fs.renameSync(tmp, filePath(room, id));
      fileIndex.set(key, { room, id, size, at:Date.now() });
      finished.set(key, { part, lastLen:buf.length, size, at:Date.now() });
      if(finished.size>200) finished.delete(finished.keys().next().value);
      log('📁 File saved:', (size/MB).toFixed(1), 'MB');
    }
    else uploads.set(key, { bytes:size, at:Date.now(), next:part+1, lastLen:buf.length });
  }catch(e){
    // диск полон или другая ошибка: недописанный файл не оставляем, иначе он лежит мимо квоты
    uploads.delete(key); try{ fs.rmSync(tmp, { force:true }); }catch{}
    throw new HttpErr(507, 'не удалось записать файл на диск: ' + (e && e.code || e && e.message || e));
  }
  return { ok:true, size, storage:storage(room) };
}
// брошенные загрузки (оборвалась связь) удаляем через час, не дожидаясь перезапуска
setInterval(() => {
  for(const [k, u] of uploads) if(Date.now()-u.at > 3600e3){ uploads.delete(k); const [r, i] = k.split('/'); try{ fs.rmSync(filePath(r, i)+'.part', { force:true }); }catch{} }
}, 10*60*1000);
function delFile(room, id){
  if(!okRoom(room) || !okId(id)) return false;
  fs.rmSync(filePath(room, id), { force:true });
  return fileIndex.delete(room+'/'+id);
}
// Какие файлы нужны каждому пульту: он присылает свой список (экран, сцены, библиотека, сценарии), и очистка не трогает
// файлы ни из одного списка. Списки переживают перезапуск программы и сбрасываются вместе с комнатой.
const KEEP_FILE = path.join(BASE, 'files-keep.json'), KEEP_PANELS = 64, KEEP_IDS = 5000, KEEP_BYTES = 16*MB;
const okPanel = p => typeof p==='string' && /^[a-z0-9]{12,32}$/.test(p);
const keepIds = a => [...new Set((Array.isArray(a) ? a : []).filter(x => typeof x==='string' && okId(x)))];
let keepRoom = '';
const keepLists = new Map();   // id пульта → { at, ids }
try{
  if(fs.statSync(KEEP_FILE).size <= KEEP_BYTES){
    const j = JSON.parse(fs.readFileSync(KEEP_FILE, 'utf8'));
    if(j?.v===1 && typeof j.room==='string' && okRoom(j.room) && j.panels && typeof j.panels==='object'){
      keepRoom = j.room;
      for(const [p, x] of Object.entries(j.panels).slice(0, KEEP_PANELS)){
        const ids = keepIds(x?.ids).slice(0, KEEP_IDS);
        if(okPanel(p) && ids.length) keepLists.set(p, { at:Number(x.at)||0, ids });
      }
    }
  }
}catch{}
function keepSave(){
  try{
    fs.writeFileSync(KEEP_FILE+'.tmp', JSON.stringify({ v:1, room:keepRoom, panels:Object.fromEntries(keepLists) }), { mode:0o600 });
    fs.renameSync(KEEP_FILE+'.tmp', KEEP_FILE);
  }catch(e){ log('⚠ Could not save the file lists:', e?.code || e?.message || e); }
}
function keepReset(){ keepLists.clear(); keepRoom = ''; keepSave(); }
// Списки текущей комнаты
function keepOfRoom(){
  if(keepRoom!==ROOM.room){ keepLists.clear(); keepRoom = ROOM.room; }
  return keepLists;
}
// Новый список пульта заменяет прежний. Хранятся только имена файлов, которые есть в комнате; при переполнении выбывает самый давний пульт
function keepSet(panel, list){
  const lists = keepOfRoom(), ids = keepIds(list).filter(id => fileIndex.has(ROOM.room+'/'+id)).slice(0, KEEP_IDS);
  if(!ids.length){ if(lists.delete(panel)) keepSave(); return; }
  const same = lists.get(panel)?.ids.join()===ids.join();
  lists.set(panel, { at:Date.now(), ids });
  while(lists.size > KEEP_PANELS){
    let oldest = null; for(const [p, x] of lists) if(p!==panel && (!oldest || x.at < oldest[1].at)) oldest = [p, x];
    lists.delete(oldest[0]);
  }
  if(!same) keepSave();
}
// Всё, что нужно пультам, кроме указанного
function keepHeld(except){
  const out = new Set();
  for(const [p, x] of keepOfRoom()) if(p!==except) for(const id of x.ids) if(fileIndex.has(ROOM.room+'/'+id)) out.add(id);
  return [...out];
}
// Удалить всё в комнате, кроме переданного списка (то, что на экране, в сценах и библиотеке этого и других пультов)
function cleanRoomFiles(room, keep){
  const k = new Set(keep.filter(okId)); let n = 0, bytes = 0;
  for(const f of [...fileIndex.values()]) if(f.room===room && !k.has(f.id)){ bytes += f.size; if(delFile(room, f.id)) n++; }
  if(n) log('🧹 Unused files removed:', n, `(${(bytes/MB).toFixed(1)} MB)`);
  return { ok:true, deleted:n, bytes, storage:storage(room) };
}
function setLimits(l){
  const num = (v, lo, hi) => { const x = Math.round(Number(v)); if(!Number.isFinite(x) || x<lo || x>hi) throw new HttpErr(400, `значение ${v} вне ${lo}…${hi}`); return x; };
  cfg.limits = { fileMB:num(l.fileMB, 1, 4096), totalMB:num(l.totalMB, 10, 1024*1024), files:num(l.files, 1, 100000) };
  cfg.limitsSet = true; saveCfg();
  log('📁 File limits:', cfg.limits.fileMB, 'MB per file,', cfg.limits.totalMB, 'MB total,', cfg.limits.files, 'files');
}

// ---------- HTTP ----------
const okHost = h => h===`localhost:${PORT}` || h===`127.0.0.1:${PORT}`;
const okOrigin = o => o===`http://localhost:${PORT}` || o===`http://127.0.0.1:${PORT}`;
// Страница управления живёт на http://127.0.0.1:<порт>, виджет OBS — на http://localhost:<порт>. Это разные origin:
// код оверлея (он приходит с сайта) не может читать пароль модераторов и менять настройки.
const ADMIN = () => `http://127.0.0.1:${PORT}`;
// Управление открывается только с cookie hudini_admin: сам адрес 127.0.0.1 ничего не значит (порт могли расшарить через Porthole).
// Окно приложения получает cookie через одноразовый /auth?t=<токен>, из браузера — по ссылке из консоли. Заголовок X-Hudini-Token — для самой программы и тестов.
const ADMIN_TOKEN = process.env.OVERLAY_ADMIN_TOKEN || APP_TOKEN || rnd(18);
const ADMIN_COOKIE = rnd(24);
let adminTokenUsed = false;
const sameStr = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length===y.length && nodeCrypto.timingSafeEqual(x, y); };
const isLocalAdminHost = req => req.headers.host===`127.0.0.1:${PORT}`;
const cookieOf = (req, name) => (String(req.headers.cookie||'').split(/;\s*/).map(x => x.split('=')).find(x => x[0]===name) || [])[1] || '';
const isAdmin = req => isLocalAdminHost(req) && (sameStr(cookieOf(req, 'hudini_admin'), ADMIN_COOKIE) || (!!req.headers['x-hudini-token'] && sameStr(req.headers['x-hudini-token'], ADMIN_TOKEN)));
function send(res, code, body, type='text/plain; charset=utf-8', extra={}){
  res.writeHead(code, { 'content-type':type, 'cache-control':'no-store', 'x-content-type-options':'nosniff', ...extra }); res.end(body);
}
function readRaw(req, max){
  return new Promise((ok, no) => { let n=0, done=false; const parts=[];
    req.on('data', c => { n+=c.length; if(n>max){ no(new HttpErr(413, 'слишком большой запрос')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { done=true; ok(Buffer.concat(parts)); }); req.on('error', no);
    // обрыв посреди тела: отпускаем запрос (и собранные куски), errOut увидит закрытый сокет и ничего не ответит
    req.on('close', () => { if(!done){ parts.length = 0; no(new HttpErr(400, 'запрос оборвался')); } }); });
}
const readBody = async (req, max) => (await readRaw(req, max)).toString('utf8');
const bearer = req => (String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/)||[])[1] || '';
// Пульт открыт на другом сайте (GitHub Pages, приложение): разрешаем запросы с паролем отовсюду.
// Куки на этом порту не используются, а без пароля ничего не отдаётся.
const CORS = { 'access-control-allow-origin':'*', 'access-control-allow-methods':'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers':'authorization, content-type', 'access-control-max-age':'600' };
// Пульт стримера ходит за файлами со своей страницы (окно приложения): ответы только этому origin, с паролем его сессии
const panelCors = origin => ({ 'access-control-allow-origin':origin, vary:'origin', 'access-control-allow-methods':CORS['access-control-allow-methods'],
  'access-control-allow-headers':'authorization, content-type', 'access-control-max-age':'600' });
async function filesApi(req, res, url, mod){
  const panel = !mod && PANEL_ORIGINS.has(req.headers.origin || '');
  const p = url.pathname, extra = mod ? CORS : panel ? panelCors(req.headers.origin) : {};
  const j = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', extra);
  if(req.method==='OPTIONS') return send(res, 204, '', 'text/plain', extra);
  if(!ROOM) return j(503, { ok:false, error:'комната ещё не создана' });
  if(mod && !cfg.modsOn) return j(503, { ok:false, error:'стример не пускает модераторов' });
  if(mod && ctl.paused && req.method!=='GET') return j(423, { ok:false, error:'пауза модераторов' });   // на паузе модератор только читает файлы (картинки на холсте), менять нельзя
  const id = p.startsWith('/files/') ? p.slice(7) : '';
  const room = url.searchParams.get('room') || ROOM.room;
  // Виджет на этом же компьютере читает файлы текущей комнаты без пароля, всё остальное только с паролем модераторов
  if(!(!mod && req.method==='GET' && id && room===ROOM.room)){
    if(!mod && req.headers.origin && !okOrigin(req.headers.origin) && !panel) return j(403, { ok:false, error:'чужой сайт' });
    const ip = mod ? ipOf(req) : 'local', wait = locked(ip);
    if(!(!mod && panelSessionOk(bearer(req))) && !passOk(ip, bearer(req))){
      if(wait) return j(429, { ok:false, error:`слишком много неверных паролей, подожди ${wait} с` });
      return j(401, { ok:false, error:'неверный пароль' });
    }
  }
  const mine = () => [...fileIndex.values()].filter(f => f.room===ROOM.room).map(f => [f.id, f.size]);
  const panelId = url.searchParams.get('panel');
  // held: файлы из списков других пультов, очистка их оставит
  if(req.method==='GET' && p==='/files') return j(200, { ok:true, storage:storage(ROOM.room), ids:mine(), held:keepHeld(panelId) });
  if(req.method==='POST' && (p==='/files/keep' || p==='/files/clean')){
    const { keep, id:panel } = JSON.parse(await readBody(req, 512*1024)), clean = p==='/files/clean';
    if(!Array.isArray(keep) || !clean && !okPanel(panel)) throw new HttpErr(400, 'нет списка файлов');
    if(okPanel(panel)) keepSet(panel, keep);
    // пульт старой версии id не присылает: тогда бережём списки всех пультов
    return j(200, clean ? cleanRoomFiles(ROOM.room, [...keep, ...keepHeld(panel)]) : { ok:true });
  }
  if(!okId(id) || !okRoom(room)) return j(400, { ok:false, error:'плохое имя файла' });
  // Модератор может читать и файлы прошлых комнат этого ПК: пульт так копирует файл из библиотеки в новую комнату.
  // Байты зашифрованы ключами той комнаты, без них их не прочитать.
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
    const last = url.searchParams.get('last')==='1', saved = putPart(room, id, part, last, await readRaw(req, PART_MAX));
    // свежий файл числится за загрузившим пультом, пока тот не пришлёт новый список
    if(last && okPanel(panelId)) keepSet(panelId, [id, ...(keepOfRoom().get(panelId)?.ids || [])]);
    return j(200, saved);
  }
  if(req.method==='DELETE'){ delFile(room, id); return j(200, { ok:true, storage:storage(room) }); }
  return j(405, { ok:false, error:'нельзя' });
}
// Ошибка запроса → ответ. Код ответа только из HttpErr (400…599): у ошибок сокета и диска code — строка (ECONNRESET, ENOSPC),
// с ней writeHead бросает, и сервер падал. Клиент уже ушёл или ответ начат — просто закрываем.
const errOut = (res, e, extra={}) => {
  try{
    if(res.headersSent || res.destroyed || res.writableEnded) return res.destroy();
    const code = Number.isInteger(e?.code) && e.code>=400 && e.code<=599 ? e.code : e?.code==null ? 400 : 500;
    if(code===500) log('⚠ Request error:', String(e?.code||''), e?.message||e);
    send(res, code, JSON.stringify({ ok:false, error:e instanceof HttpErr ? e.message : code===500 ? 'ошибка на ПК стримера' : 'некорректный запрос', ...(e?.extra||{}) }), 'application/json', extra);
  }catch{ try{ res.destroy(); }catch{} }
};
// Док в OBS (localhost, без входа): права, элементы экрана, кто на связи (адрес в маске), CS2
function dockCs2(){
  const c = status.cs2; if(!c || Date.now()-status.cs2Seen > 15000) return null;
  const o = c.observed || (!c.spectating && c.name ? c : null);
  // номер, как его видит зритель: клавиша 1…0 или место в худе (режим «по порядку в худе»)
  const hs = screenNum==='hud' && Array.isArray(c.players) ? hudSlots(c.players) : null;
  const key = o ? slotKey(hs && o.id!=null && o.id in hs ? hs[o.id] : o.slot) : null;
  return { map:c.map, round:c.round, phase:c.phase, ct:c.ct, tt:c.tt, ctName:c.ctName, tName:c.tName,
    obs:o ? { name:o.name, slot:key, hp:o.hp, team:o.team } : null };
}
function dockInfo(){
  return { perms:cfg.perms, media:mediaInfo(), els:screen ? screen.els : null, cs2:dockCs2(), nickStrip:screenStrip,
    ppl:[...modList].map(([id, m]) => ({ id, me:!!m.me, net:m.net, ip:m.me ? '' : maskHost(m.ip), rtt:m.rtt, since:m.since })) };
}
async function streamerSession(req, res){
  const origin = req.headers.origin || '', cors = PANEL_ORIGINS.has(origin) ? { ...panelCors(origin), 'access-control-allow-methods':'POST, OPTIONS' } : {};
  const j = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', { ...cors, 'referrer-policy':'no-referrer' });
  if(req.method==='OPTIONS') return send(res, 204, '', 'text/plain', cors);
  if(req.method!=='POST') return j(405, { ok:false, error:'нельзя' });
  if(!PANEL_ORIGINS.has(origin)){ refuse('local', 'streamer panel: foreign site'); return j(403, { ok:false, error:'чужой сайт' }); }
  let key = ''; try{ key = JSON.parse(await readBody(req, 1024))?.key; }catch{}
  const why = takePanelKey(key);
  if(why){ refuse('local', 'streamer panel: '+why); return j(403, { ok:false, error:'Ключ входа недействителен: нажми «Открыть пульт» в Hudini Host ещё раз' }); }
  if(!ownRoom()) return j(409, { ok:false, error:'Пульт на этом компьютере работает с комнатой, которую создал Hudini Host' });
  const pass = newPanelSession();
  log('🖥 Streamer panel opened on this computer');
  return j(200, { ok:true, user:'streamer', pass, port:PORT, room:{ code:ROOM.room, name:cfg.room.name || cfg.name || 'Hudini', k:ROOM.k, p:ROOM.p, s:cfg.room.s } });
}
function obsLink(){
  if(!ROOM) return '';
  return `http://localhost:${PORT}/widget/widget.html?room=${ROOM.room}&broker=${encodeURIComponent(`ws://localhost:${PORT}/mqtt`)}&v=9#k=${ROOM.k}&p=${ROOM.p}`;
}
const local = http.createServer(async (req, res) => {
  if(!okHost(req.headers.host)) return send(res, 421, 'wrong host');   // защита от DNS-rebinding
  const url = new URL(req.url, `http://localhost:${PORT}`), p = url.pathname;
  try{
    if(p==='/files' || p.startsWith('/files/')) return await filesApi(req, res, url, false);
    if(req.method==='POST' && p==='/gsi'){
      const g = JSON.parse(await readBody(req, 512*1024));
      const tok = Buffer.from(String(g?.auth?.token||'')), want = Buffer.from(cfg.gsiToken);
      if(tok.length!==want.length || !nodeCrypto.timingSafeEqual(tok, want)) return send(res, 403, 'bad token');
      const out = compactGsi(g); trackFight(out); trackSeries(out); pushCs2(out);
      return send(res, 200, 'ok');
    }
    if(p==='/auth' && isLocalAdminHost(req)){
      const t = url.searchParams.get('t') || '';
      // в приложении токен одноразовый (окно открывается один раз); из консоли браузера ссылкой можно пользоваться повторно
      if(!sameStr(t, ADMIN_TOKEN) || (APP_TOKEN && adminTokenUsed)) return send(res, 403, 'ссылка недействительна: открой управление из приложения Hudini или по ссылке из консоли');
      adminTokenUsed = true;
      const lq = url.searchParams.get('lang'), langQ = ['ru','en','uk','de'].includes(lq) ? '?lang='+lq : '';
      // не 302: WebKitGTK (Linux) не отправляет cookie SameSite=Strict после перенаправления, если переход начался со страницы
      // приложения (tauri://localhost). Переход со своей же страницы считается своим, и cookie уходит в любом движке
      return send(res, 200, '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/'+langQ+'"><title>Hudini</title><body bgcolor="#0f1115"></body>',
        'text/html; charset=utf-8', { 'set-cookie':`hudini_admin=${ADMIN_COOKIE}; HttpOnly; SameSite=Strict; Path=/`,
          'x-frame-options':'DENY', 'content-security-policy':"default-src 'none'; frame-ancestors 'none'", 'referrer-policy':'no-referrer' });
    }
    if(p==='/api/streamer/session') return await streamerSession(req, res);   // пульт стримера меняет одноразовый ключ на сессию
    if(p.startsWith('/api/') && !isAdmin(req)){
      // без входа: «живой» (проверка приложения); со стороны виджета (localhost) — краткий статус и кнопки стримера для дока в OBS
      if(req.method==='GET' && p==='/api/status'){
        if(isLocalAdminHost(req)) return send(res, 200, JSON.stringify({ alive:true, version:VERSION }), 'application/json');
        return send(res, 200, JSON.stringify({ version:VERSION, ctl, room:ROOM?.room||'', mods:status.mods,
          obsOnline: Date.now()-status.obsSeen < 9000, cs2Online: Date.now()-status.cs2Seen < 15000, storage:(({ used, limitBytes }) => ({ used, limitBytes }))(storage(ROOM?.room)),
          fight:fightNow(), ...dockInfo() }), 'application/json');
      }
      if(!(req.method==='POST' && p==='/api/control' && req.headers.origin===`http://localhost:${PORT}`)) return send(res, 403, 'open the management page from the Hudini app');
    }
    if(p.startsWith('/api/')){
      if(req.method==='POST' && !okOrigin(req.headers.origin)) return send(res, 403, 'bad origin');   // защита от чужих сайтов
      if(req.method==='POST' && p==='/api/update/check'){ await checkUpdate(false); return send(res, 200, JSON.stringify({ ok:true, upd }), 'application/json'); }
      if(req.method==='POST' && p==='/api/update/apply'){ if(!upd.staged) return send(res, 400, JSON.stringify({ ok:false, error:'обновление ещё не скачано' }), 'application/json'); send(res, 200, JSON.stringify({ ok:true }), 'application/json'); setTimeout(applyUpdate, 300); return; }
      if(req.method==='POST' && p==='/api/update/auto'){ const { auto } = JSON.parse(await readBody(req, 1024)); upd.auto=cfg.autoUpdate=!!auto; saveCfg(); return send(res, 200, JSON.stringify({ ok:true, upd }), 'application/json'); }
      if(req.method==='POST' && p==='/api/limits'){ setLimits(JSON.parse(await readBody(req, 4096))); return send(res, 200, JSON.stringify({ ok:true, limits:cfg.limits }), 'application/json'); }
      if(req.method==='POST' && p==='/api/extaddr'){   // свой внешний адрес для проброса порта: host:port
        const { addr } = JSON.parse(await readBody(req, 4096)), v = String(addr||'').trim();
        if(v && !parseExt(v)) throw new HttpErr(400, 'адрес должен быть вида мой-адрес:порт');
        cfg.extAddr = v; saveCfg(); log(v ? 'Custom external address: '+maskAddr(v) : 'Custom external address removed');
        return send(res, 200, JSON.stringify({ ok:true, code:modCode() }), 'application/json');
      }
      if(req.method==='POST' && p==='/api/mods'){   // «Пускать модераторов»
        const { on } = JSON.parse(await readBody(req, 1024));
        const was = cfg.modsOn;
        cfg.modsOn = !!on; saveCfg();
        if(cfg.modsOn!==was) logc(cfg.modsOn ? '▶ Letting moderators in' : '⏸ Not letting moderators in');   // повторный запрос с тем же значением ничего не меняет
        if(!cfg.modsOn) kickMods('streamer closed the entrance');
        return send(res, 200, JSON.stringify({ ok:true, modsOn:cfg.modsOn }), 'application/json');
      }
      if(req.method==='POST' && p==='/api/perms'){   // права модераторов
        const { perms } = JSON.parse(await readBody(req, 1024));
        const next = cleanPerms({ ...cfg.perms, ...(perms && typeof perms==='object' ? perms : {}) });
        const ch = PERM_KEYS.filter(k => next[k]!==cfg.perms[k]);
        cfg.perms = next; saveCfg();
        for(const k of ch) if(DEFAULT_OFF.includes(k) && !next[k]) mediaRevoke(x => x.kind===k && x.ownerType==='mod', 'streamer turned off: '+PERM_NAMES[k]);
        if(ch.length) log('🔒 Moderator permissions:', ch.map(k => PERM_NAMES[k]+(next[k] ? ' — allowed' : ' — denied')).join('; '));
        await publishPerms();
        return send(res, 200, JSON.stringify({ ok:true, perms:cfg.perms }), 'application/json');
      }
      if(req.method==='POST' && p==='/api/streamer/open'){   // «Открыть пульт»: одноразовый ключ своему окну
        if(!ownRoom()) throw new HttpErr(409, 'пульт на этом компьютере работает с комнатой, которую создал Hudini Host');
        const key = newPanelKey();
        if(APP && APP_TOKEN){ appSay(`PANEL ${key} ${PORT}`); return send(res, 200, JSON.stringify({ ok:true, app:true }), 'application/json'); }   // окно приложения откроет программа
        if(!panelUrl()) throw new HttpErr(409, 'пульт открывается из приложения Hudini');
        return send(res, 200, JSON.stringify({ ok:true, key, port:PORT, url:panelUrl() }), 'application/json', { 'referrer-policy':'no-referrer' });
      }
      if(req.method==='POST' && p==='/api/mods/kick'){ kickMods('streamer disconnected everyone'); return send(res, 200, JSON.stringify({ ok:true }), 'application/json'); }
      if(req.method==='POST' && p==='/api/notice'){ const { id } = JSON.parse(await readBody(req, 1024)); if(id==='cf'){ delete cfg.cfNotice; saveCfg(); } if(id==='room'){ delete cfg.roomNotice; saveCfg(); } return send(res, 200, JSON.stringify({ ok:true }), 'application/json'); }
      if(req.method==='POST' && p==='/api/control'){
        const { action, key, on } = JSON.parse(await readBody(req, 1024));
        if(['mediaallow', 'mediadeny', 'mediastop', 'mediaoff', 'mediaon'].includes(action)) mediaAction(action, key);
        else if(action==='off'){   // быстрый выключатель: on=true — выключить на стриме
          if(!OFF_KEYS.includes(key)) throw new HttpErr(400, 'неизвестный выключатель');
          if(ctl.off[key]!==!!on){ log(on ? '🚫 Streamer turned off on stream: '+OFF_NAMES[key] : '✅ Streamer turned back on on stream: '+OFF_NAMES[key]); }
          ctl.off = { ...ctl.off, [key]:!!on }; cfg.ctlOff = ctl.off; saveCfg();
        }
        else if(action==='hideel'){   // глазик в доке: спрятать элемент на стриме (только у стримера)
          const id = typeof key==='string' && key.length<=40 ? key : '';
          if(!id) throw new HttpErr(400, 'нет элемента');
          ctl.hideIds = cleanIds(on ? [...ctl.hideIds, id] : ctl.hideIds.filter(x => x!==id));
          cfg.hideIds = ctl.hideIds; saveCfg();
        }
        else if(action==='kick'){   // «Отключить» одного модератора в доке
          const c = typeof key==='string' && Object.hasOwn(aedes.clients, key) ? aedes.clients[key] : null;
          if(!c?.conn?._mod) throw new HttpErr(404, 'такого модератора нет');
          const m = modList.get(key);
          try{ c.close(); }catch{}
          logc('👤 Streamer disconnected a moderator:', m ? who(m.ip) : '?');
          return send(res, 200, JSON.stringify({ ok:true }), 'application/json');
        }
        else if(action==='hide' || action==='show'){ ctl.hidden = action==='hide'; log(ctl.hidden ? '🙈 Streamer hid the overlay' : '👁 Streamer showed the overlay'); }
        else if(action==='stopsounds'){ ctl.stop++; log('⏹ Streamer stopped the sounds'); }
        else if(action==='pause' || action==='resume'){ ctl.paused = action==='pause'; log(ctl.paused ? '⏸ Moderators paused' : '▶ Moderators can change the screen again'); await announce(); if(ctl.paused) pauseMods().catch(e => log('⚠ Pause:', e?.message || e)); }
        else if(action==='taboff' || action==='tabon'){ ctl.tabOff = action==='taboff'; log(ctl.tabOff ? '🎯 CS2 auto-tab turned off on stream' : '🎯 CS2 auto-tab turned back on'); }   // быстрый выключатель авто-таба (док)
        else throw new HttpErr(400, 'неизвестное действие');
        await publishCtl();
        return send(res, 200, JSON.stringify({ ok:true, ctl }), 'application/json');
      }
      if(p==='/api/code') return send(res, 200, JSON.stringify({ ok:true, code:modCode(), fp:TLS.fp, addrs:addresses(), pass:cfg.modPass, name:cfg.name }), 'application/json');
      if(req.method==='POST' && p==='/api/code/new'){ cfg.modPass = rnd(18); saveCfg(); kickMods('new moderator code'); log('🔑 New moderator code issued'); return send(res, 200, JSON.stringify({ ok:true, code:modCode() }), 'application/json'); }
      if(req.method==='POST' && p==='/api/room/new'){   // новая комната: новые ключи, пароль и код
        const { name } = JSON.parse(await readBody(req, 1024));
        await createRoom(name); log('🆕 Room recreated');
        return send(res, 200, JSON.stringify({ ok:true, obsLink:obsLink(), code:modCode() }), 'application/json');
      }
      if(p==='/api/status') return send(res, 200, JSON.stringify({ version:VERSION, upd:{ state:upd.state, latest:upd.latest, err:upd.err, auto:upd.auto, ready:!!upd.staged, compiled, checkedAt:upd.checkedAt, prog:upd.prog }, app:APP, standalone:compiled && !APP, room:ROOM?.room||null, obsLink:obsLink(),
        storage:storage(ROOM?.room), limits:cfg.limits, mport:MPORT, code:modCode(), ctl, perms:cfg.perms, fp:TLS.fp, addrs:addresses(), extAddr:cfg.extAddr, modsOn:cfg.modsOn, name:cfg.name, cfNotice:!!cfg.cfNotice, roomNotice:!!cfg.roomNotice, ownRoom:!!cfg.room?.s,
        media:mediaInfo(), modList:[...modList.values()].map(({ ip, net, since, rtt, me }) => ({ ip, net, since, rtt, me })), role:ROLE_MOD ? 'mod' : 'streamer', panel:APP || !!panelUrl(),
        ...status, obsOnline: Date.now()-status.obsSeen < 9000, cs2Online: Date.now()-status.cs2Seen < 15000, fight:fightNow(), logs:logs.slice(-40), connLogs:connLogs.slice(-40) }), 'application/json');
      if(req.method==='POST' && p==='/api/link'){ const { link } = JSON.parse(await readBody(req, 8192)); await setRoom(link); cfg.linkSet = true; saveCfg(); return send(res, 200, JSON.stringify({ ok:true, obsLink:obsLink() }), 'application/json'); }
      if(req.method==='POST' && p==='/api/gsi/install'){ const f = await installGsi(); return send(res, 200, JSON.stringify({ ok:true, file:f }), 'application/json'); }
      if(p==='/api/gsi/cfg') return send(res, 200, gsiCfgText(), 'application/octet-stream', { 'content-disposition':'attachment; filename="gamestate_integration_streamoverlay.cfg"' });
      return send(res, 404, 'not found');
    }
    if(p==='/' || p==='/index.html'){
      if(!isLocalAdminHost(req)) return send(res, 302, '', 'text/plain', { location:ADMIN()+'/' });   // старые закладки на localhost
      if(!isAdmin(req)) return send(res, 403, 'Страница управления открывается из приложения Hudini или по ссылке из консоли (…/auth?t=…).');
      return send(res, 200, UI_HTML, 'text/html; charset=utf-8', { 'x-frame-options':'DENY', 'content-security-policy':"frame-ancestors 'none'" });
    }
    if(p==='/dock') return send(res, 200, DOCK_HTML, 'text/html; charset=utf-8', { 'x-frame-options':'DENY', 'content-security-policy':"frame-ancestors 'none'" });
    if(p==='/widget.html') return send(res, 302, '', 'text/plain', { location:'/widget/widget.html'+url.search });   // старые ссылки для OBS (hash браузер сохранит сам)
    if(p==='/widget/widget.html'){ if(url.searchParams.has('upd')) await refreshNow(); return send(res, 200, widgetHtml(), 'text/html; charset=utf-8'); }
    if(p==='/shared/core.js') return send(res, 200, files['shared/core.js'], 'application/javascript; charset=utf-8');
    if(p==='/shared/core.css') return send(res, 200, files['shared/core.css'], 'text/css; charset=utf-8');
    if(p==='/shared/case3d.js') return send(res, 200, files['shared/case3d.js'], 'application/javascript; charset=utf-8');
    if(p==='/shared/media.js') return send(res, 200, files['shared/media.js'], 'application/javascript; charset=utf-8');
    if(p==='/shared/vendor/three.module.min.js') return send(res, 200, THREE_JS, 'application/javascript; charset=utf-8', { 'cache-control':'max-age=604800' });
    if(p==='/shared/i18n.js') return send(res, 200, I18N_JS, 'application/javascript; charset=utf-8');
    if(p==='/shared/icons.js') return send(res, 200, ICONS_JS, 'application/javascript; charset=utf-8');
    if(p==='/shared/cs2-maps.js') return send(res, 200, files['shared/cs2-maps.js'], 'application/javascript; charset=utf-8');
    // подложка радара CS2 (shared/radar/<карта>-<тема>.webp): своя из data/radar, иначе из исходников, иначе с сайта (кэш в data/cache/radar)
    if(/^\/shared\/radar\/[a-z0-9_]{2,40}-(classic|glass|ko)\.webp$/.test(p)){
      const img = await radarImg(p.slice(14));
      return img ? send(res, 200, img, 'image/webp', { 'cache-control':'max-age=3600' }) : send(res, 404, 'no radar image');
    }
    if(p==='/mqtt.min.js') return send(res, 200, MQTT_JS, 'application/javascript; charset=utf-8');
    send(res, 404, 'not found');
  }catch(e){ errOut(res, e); }
});
local.on('upgrade', wsServer(false));
// Порт для модераторов (TLS, все интерфейсы): MQTT по WebSocket, файлы с паролем и /ping для замера задержки.
// Страница управления здесь не отдаётся никогда.
const modSrv = https.createServer({ key:TLS.key, cert:TLS.cert, minVersion:'TLSv1.2' }, async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try{
    if(p==='/ping') return send(res, 200, 'pong', 'text/plain; charset=utf-8', CORS);
    if(p==='/files' || p.startsWith('/files/')) return await filesApi(req, res, url, true);
    send(res, 404, 'Hudini', 'text/plain; charset=utf-8', CORS);
  }catch(e){ errOut(res, e, CORS); }
});
modSrv.on('upgrade', wsServer(true));
modSrv.on('tlsClientError', () => {});
modSrv.on('error', e => { log('⚠ Moderator port', MPORT, 'did not open:', e.message); status.modErr = e.message; });

function openBrowser(u){
  if(NO_OPEN || APP) return;
  if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+\/(auth\?t=[\w-]+)?$/.test(u)) return;
  const cb = () => {};
  if(process.platform==='win32') execFile('cmd', ['/c', 'start', '', u], cb);
  else execFile(process.platform==='darwin' ? 'open' : 'xdg-open', [u], cb);
}

async function shutdown(){
  if(shuttingDown) return; shuttingDown = true;
  log('Shutting down…');
  setTimeout(() => process.exit(0), 600);
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

// ---------- связь с программой с окном (app/) ----------
// stdout: строки «READY <порт>», «RESTART», «FAIL <причина>», «PANEL <ключ> <порт>». stdin: «VISIBLE 0/1», «QUIT», «PANEL».
// PANEL: одноразовый ключ пульта стримера идёт только окну программы; эти строки с префиксом программа в журнал не пишет.
// Программа закрылась или упала → stdin закрывается → выключаемся сами (без брошенного процесса в Windows).
// Служебные строки для программы с окном идут с её случайным префиксом: строка журнала их не подделает
function appSay(line){ if(APP) try{ process.stdout.write((APP_TOKEN ? APP_TOKEN+' ' : '')+line+'\n'); }catch{} }
if(APP){
  process.stdout.on?.('error', ()=>{});
  let buf = '';
  process.stdin.setEncoding?.('utf8');
  process.stdin.on('data', d => {
    buf += d; let i;
    while((i = buf.indexOf('\n')) >= 0){
      const l = buf.slice(0, i).trim(); buf = buf.slice(i+1);
      if(l==='VISIBLE 0') appHidden = true;
      else if(l==='VISIBLE 1') appHidden = false;
      else if(l==='QUIT') shutdown();
      else if(l==='APPLY' && upd.staged) applyUpdate();
      else if(l==='PANEL' && APP_TOKEN) appSay(ROOM && ownRoom() ? `PANEL ${newPanelKey()} ${PORT}` : 'PANEL - 0');   // «Открыть пульт» в меню трея
    }
  });
  process.stdin.on('end', shutdown); process.stdin.on('close', shutdown); process.stdin.on('error', shutdown);
  process.stdin.resume();
}

const AUTH_URL = () => `${ADMIN()}/auth?t=${ADMIN_TOKEN}`;
function listenMod(){
  modSrv.listen(MPORT, '0.0.0.0', () => { status.modErr = ''; log('🔌 Moderator port:', MPORT, '(TLS, fingerprint', TLS.fp.slice(0, 16)+'…)'); });
}
let modTries = 0;
modSrv.on('error', e => { if(e.code==='EADDRINUSE' && process.env.OVERLAY_UPDATED && modTries++ < 30) setTimeout(listenMod, 500); });   // старая версия ещё закрывается
if(ROLE_MOD){
  // Роль модератора: ни одного порта, только проверка и установка обновлений
  log('Role: moderator (not opening ports)');
  appSay('READY 0');
  if(process.env.OVERLAY_UPDATED) log('✓ Updated to version', VERSION);
} else {
  local.listen(PORT, '127.0.0.1', async () => {
    listenMod();
    // Программа с окном пишет stdout в краш-отчёт: ссылку входа (в ней токен) туда не выводим, окно входит само
    if(!APP) console.log(`\n  ╔══════════════════════════════════════════════╗\n  ║  Hudini ${VERSION}                                ║\n  ║  Не закрывай это окно, пока идёт стрим       ║\n  ╚══════════════════════════════════════════════╝\n  Управление (ссылка входа): ${AUTH_URL()}\n`);
    log('Settings folder:', BASE);
    lastAddrs = addrKey(); log('🌐 Moderator addresses:', addrText());
    // Комната из конфига старой версии (ссылка без закрытого ключа): код для модератора вышел бы без ключей и модератор не вошёл бы.
    // Один раз создаём обычную комнату Host и просим стримера обновить ссылку в OBS и отправить модераторам новый код.
    if(cfg.link && !cfg.room?.s && !cfg.linkSet){
      try{ await createRoom(); cfg.roomNotice = true; saveCfg(); log('🆕 Room from an old version had no moderator keys: created a new room. Update the OBS link and send moderators the new code'); }
      catch(e){ log('⚠ Could not create the room:', e.message); }
    }
    else if(cfg.link){ try{ await setRoom(cfg.link, cfg.room); }catch(e){ log('⚠', e.message); } }
    else { try{ await createRoom(); log('🆕 Room created'); }catch(e){ log('⚠ Could not create the room:', e.message); } }
    // если файл для CS2 уже ставили — обновляем его (новые поля), CS2 подхватит при следующем запуске
    if(cfg.gsiFile && path.basename(cfg.gsiFile)==='gamestate_integration_streamoverlay.cfg' && fs.existsSync(cfg.gsiFile)){ try{ if(fs.readFileSync(cfg.gsiFile,'utf8')!==gsiCfgText()){ fs.writeFileSync(cfg.gsiFile, gsiCfgText()); log('✓ CS2 config file updated — restart CS2'); } status.gsiPath=cfg.gsiFile; }catch{} }
    appSay('READY '+PORT);
    if(process.env.OVERLAY_UPDATED) log('✓ Updated to version', VERSION);
    else openBrowser(AUTH_URL());
  });
}
let portTries=0;
local.on('error', e => {
  if(e.code==='EADDRINUSE' && process.env.OVERLAY_UPDATED && portTries++<30){ setTimeout(()=>local.listen(PORT, '127.0.0.1'), 500); return; }   // старая версия ещё закрывается
  log('⚠ Cannot take port', PORT, '—', e.message, '(already running?)'); appSay('FAIL port '+PORT+' '+(e.code||e.message)); setTimeout(()=>process.exit(1), 4000);
});

export { detectFight, slotKey, hudSlots, seriesStep, seriesView, seriesCmd, cleanSeries, maskPath };   // для тестов (tests/cs2stats.test.js берёт их из исходника)
