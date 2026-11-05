// Hudini moderator panel. Loaded by moderator.html.
// ================== НАСТРОЙКИ ==================
// Должны совпадать с widget.html
const BROKER_URL   = 'wss://broker.emqx.io:8084/mqtt'; // общий сервер: только чтобы найти Hudini Host
const TOPIC_PREFIX = 'stream-overlay/v1';
// Пусто = виджет лежит рядом с этим файлом (так и есть на GitHub Pages)
const WIDGET_BASE_URL = '';
const SEND_INTERVAL_MS = 50;           // как часто слать обновления при перетаскивании
const PART_BYTES = 8*1048576;           // файлы уходят в программу кусками (туннель Cloudflare берёт до 100 МБ за раз)
const HOST_DL = 'https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.3';
// ===============================================

const $ = id => document.getElementById(id);
const stage=$('stage'), elLayer=$('elLayer'), wrap=$('wrap');

function rid(n){
  const abc='abcdefghijkmnpqrstuvwxyz23456789', b=crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, x=>abc[x%abc.length]).join('');
}
function toast(t, ms=2400){ const el=$('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'), ms); }
function setPill(el, cls, text){ el.className='pill '+cls; el.textContent=text; }
function lsGet(k, d){ try{ const v=localStorage.getItem(k); return v==null ? d : JSON.parse(v); }catch{ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }

const qs=new URLSearchParams(location.search);
const brokerUrl=qs.get('broker') || BROKER_URL;
// после перехода по ссылке оставляем в адресе только служебные параметры
function keepQuery(){ const q=new URLSearchParams(); for(const k of ['broker','variant']) if(qs.has(k)) q.set(k, qs.get(k)); const t=q.toString(); return t ? '?'+t : ''; }
const clientId='mod_'+rid(10);
const topics = r => ({ base:`${TOPIC_PREFIX}/${r}`, state:`${TOPIC_PREFIX}/${r}/state`, fx:`${TOPIC_PREFIX}/${r}/fx` });
const validCode = c => /^[a-z0-9_-]{4,64}$/i.test(c||'');

// ================== КОМНАТЫ И КЛЮЧИ ==================
// У каждой комнаты: код (тема на брокере, не секрет), ключ шифрования k, открытый ключ p и закрытый ключ s.
// Закрытый ключ есть только у модераторов: без него на экран стримера ничего не отправить.
let rooms=[], room=null, KEYS=null, vaultPass=null;
const curRoom=()=>rooms.find(r=>r.code===room);
let saveChain=Promise.resolve();
function saveRooms(){
  lsSet('overlay.current', room);
  const data={ rooms };
  saveChain=saveChain.then(async()=>lsSet('overlay.vault2', vaultPass ? { locked: await lockJSON(vaultPass, data) } : { plain:data })).catch(e=>console.warn(e));
  return saveChain;
}
const cleanAddr = h => h && typeof h.url==='string' && /^wss?:\/\/[^\s/]+\/mqtt$/.test(h.url) && typeof h.pass==='string' && h.pass.length<200 ? { url:h.url, pass:h.pass } : undefined;
function cleanRoom(r){
  return r && validCode(r.code) && typeof r.k==='string' && typeof r.p==='string' && r.s && typeof r.s==='object'
    ? { code:r.code, name:String(r.name||'Комната').slice(0,40), k:r.k, p:r.p, s:r.s, home:cleanAddr(r.home), manual:cleanAddr(r.manual), slang:STREAM_LANGS.includes(r.slang) ? r.slang : undefined } : null;
}
async function makeRoom(name){ return { code:rid(16), name:String(name||'Комната').slice(0,40), ...(await newRoomKeys()) }; }
// Комнаты из старых версий (без ключей). Их коды были видны на брокере всем, поэтому выдаём новые.
async function migrateOld(){
  const legacy=[], old=lsGet('overlay.rooms', null);
  if(Array.isArray(old)) legacy.push(...old.filter(r=>validCode(r?.code)));
  let one=null; try{ one=localStorage.getItem('overlay.room'); }catch{}
  if(one && one[0]==='"') try{ one=JSON.parse(one); }catch{}
  if(validCode(one) && !legacy.some(r=>r.code===one)) legacy.push({ code:one, name:'Комната 1' });
  for(const r of legacy) rooms.push(await makeRoom(r.name||'Комната'));
  if(legacy.length){
    lsSet('overlay.oldCodes', [...new Set([...(lsGet('overlay.oldCodes',[])||[]), ...legacy.map(r=>r.code)])]);
    try{ localStorage.removeItem('overlay.rooms'); localStorage.removeItem('overlay.room'); }catch{}
  }
  return legacy.length;
}
async function useRoom(code){ room=code; KEYS=await importRoomKeys(curRoom()); }

let state={ visible:true, els:[] };
let selectedId=null, drag=null;
const undoStack=[]; let changeOpen=false;
function byId(id){ return state.els.find(e=>e.id===id); }

// ================== СВЯЗЬ ==================
let client=null, pendingOffline=false;
// Виджеты (OBS), которые сейчас подключены к комнате
const WIDGET_VER=15, widgets=new Map();
function renderObs(){
  const now=Date.now(), pill=$('obsStatus');
  for(const [id,h] of widgets) if(now-h.at>9000) widgets.delete(id);
  const list=[...widgets.values()];
  if(!list.length){
    setPill(pill, 'bad', 'OBS: не видно');
    pill.title='Виджет стримера не подключён к этой комнате.\n• Проверь, что у стримера ссылка именно этой комнаты (кнопка «Копировать»).\n• Источник «Браузер» должен быть включён (глазик) и в текущей сцене.\n• Если ссылка верная: в свойствах источника «Обновить кэш текущей страницы».';
    return;
  }
  if(hostCtl?.hidden){ setPill(pill, 'warn', 'OBS: 🙈 спрятано стримером'); pill.title='Стример нажал «Спрятать оверлей» в доке OBS. Изменения сохраняются, на стриме их видно не будет, пока он не вернёт.'; return; }
  const h=list[0], old=list.some(x=>(x.ver||0)<WIDGET_VER), err=list.find(x=>x.err)?.err;
  const bad=list.find(x=>x.bad || (x.h>0 && Math.abs(x.w/x.h-16/9)>0.03));
  setPill(pill, err||old||bad ? 'warn' : 'ok', `OBS: ${list.length>1?list.length+' шт, ':''}${h.w}×${h.h}${bad?' ⚠ не 16:9':''}${err?' ⚠ ошибка':''}${old?' ⚠ старая версия':''}`);
  pill.title = (bad ? `⚠ Источник «Браузер» ${bad.w}×${bad.h}, а нужно 16:9. Всё на стриме будет сплюснуто.\nOBS → свойства источника → Ширина 1920, Высота 1080 → ОК, потом выдели источник и Ctrl+F.\n` : '') +
    (err ? 'Ошибка в виджете: '+err+'\n' : '') + (old ? 'У стримера старая версия виджета: свойства источника → «Обновить кэш текущей страницы».\n' : '') +
    `Окно источника ${h.w}×${h.h}, элементов на экране: ${h.n}.` + (!bad && h.w<1280 ? '\nОкно меньше 1280×720: текст на стриме может быть мыльным, лучше 1920×1080.' : '');
  // предупреждаем один раз за сеанс, чтобы модератор сразу сказал стримеру
  if(bad && !renderObs.warned){ renderObs.warned=true; toast(`⚠ У стримера источник ${bad.w}×${bad.h}, а нужно 1920×1080: оверлей будет сплюснут`, 7000); }
}
setInterval(renderObs, 3000);
// Подключения. Общий сервер нужен только чтобы найти программу стримера Hudini Host: раз в минуту она
// публикует туда свой адрес и пароль, зашифрованные ключом комнаты. Экран, файлы и CS2 идут только через программу.
// Если общий сервер недоступен, пульт пробует последний известный адрес (он хранится в комнате).
let pubClient=null, homeInfo=null, homeClient=null, hostNote='';
function mqttClient(url, suffix, opts={}){
  return mqtt.connect(url, { clientId:clientId+suffix, clean:true, keepalive:30, reconnectPeriod:2000,
    connectTimeout:8000, resubscribe:false, queueQoSZero:false, ...opts });
}
const mainTopics = () => [topics(room).state, topics(room).base+'/hb', topics(room).base+'/cs2', topics(room).base+'/srv', topics(room).base+'/host'];
let hostCtl=null;   // кнопки стримера в доке OBS: { hidden, paused }
// Адрес для файлов: тот же туннель, только https и с паролем в заголовке
function homeHttp(){
  if(!homeInfo || !client?.connected) return null;
  return { base:homeInfo.url.replace(/^ws/, 'http').replace(/\/mqtt$/, ''), auth:'Bearer '+homeInfo.pass };
}
function hostStatus(){
  if(client?.connected) return;
  const pill=$('status');
  if(homeClient){ setPill(pill, 'warn', 'подключаюсь к Hudini Host…'); pill.title='Адрес программы стримера: '+(homeInfo?.url||''); return; }
  // без программы пульт работает: всё уйдёт стримеру при подключении, поэтому это ожидание, а не ошибка
  setPill(pill, /пароль/.test(hostNote) ? 'bad' : 'warn', hostNote || '⏳ Ждём Hudini Host');
  pill.title='Экран стримера меняется только через программу Hudini Host на его компьютере.\nНажми, чтобы узнать, как её запустить. Пока программы нет, можно готовить экран: всё уйдёт при подключении.';
}
function useMain(c){
  if(client && client!==c && client.connected) client.unsubscribe(mainTopics());
  client=c;
  if(!c?.connected){ hostStatus(); return; }
  setPill($('status'), 'ok', 'онлайн · Hudini Host'); $('status').title='Подключено к программе стримера: '+(homeInfo?.url||'');
  if(pendingOffline){ pendingOffline=false; publishNow(1); }   // сначала свои изменения, сделанные без связи
  c.subscribe(mainTopics(), { qos:1 }); Assets.retry(); renderAll(); refreshStorage(true);
}
function wire(c){
  c.on('reconnect', ()=>{ if(client===c) setPill($('status'), 'warn', 'переподключение…'); });
  c.on('offline',   ()=>{ if(client===c){ setPill($('status'), 'bad', 'нет связи с Hudini Host'); } });
  c.on('error', e=>{ console.warn(e); if(client===c) setPill($('status'), 'bad', 'ошибка связи'); });
  let chain=Promise.resolve();   // по очереди: расшифровка асинхронная, порядок важен
  c.on('message', (topic, payload, packet)=>{
    if(topic===topics(room).base+'/srv'){ onSrv(payload); return; }
    if(client!==c) return;
    chain=chain.then(()=>onMessage(topic, payload, packet)).catch(e=>console.warn(e));
  });
}
function connect(){
  if(typeof mqtt==='undefined'){
    $('fatal').style.display='flex';
    $('fatal').textContent='Не загрузилась библиотека mqtt.js (unpkg.com). Проверь интернет или блокировщик рекламы и обнови страницу.';
    return;
  }
  pubClient=mqttClient(brokerUrl, '', { reconnectPeriod:5000 });
  wire(pubClient);
  pubClient.on('connect', ()=>pubClient.subscribe(topics(room).base+'/srv', { qos:1 }));
  tryHome(); hostStatus();
}
// Ручной адрес (для продвинутых) главнее объявлений; иначе последний известный
function tryHome(){
  const r=curRoom(); if(!r) return;
  const h=r.manual || r.home;
  if(h?.url && h?.pass) openHome({ url:h.url, user:'mod', pass:h.pass });
}
function dropHome(why){
  const h=homeClient; homeClient=null; homeInfo=null;
  if(client===h) useMain(null);
  h?.end(true);
  if(why) toast(why, 4000);
  hostStatus();
}
function openHome(info){
  if(homeClient && homeInfo?.url===info.url && homeInfo?.pass===info.pass) return;
  if(homeClient) dropHome();
  homeInfo=info; hostNote='';
  const c=mqttClient(info.url, 'h', { username:'mod', password:String(info.pass||''), reconnectPeriod:3000 });
  homeClient=c; wire(c); hostStatus();
  c.on('connect', ()=>{
    if(homeClient!==c) return;
    const first=client!==c; useMain(c);
    if(first) toast('🏠 Подключено к Hudini Host', 2500);
    const r=curRoom();
    if(r && !r.manual && (r.home?.url!==info.url || r.home?.pass!==info.pass)){ r.home={ url:info.url, pass:info.pass }; saveRooms(); }
  });
  c.on('error', e=>{ if(homeClient===c && /auth|password|Not authorized/i.test(String(e.message))){
    if(!hostCtl?.paused) hostNote='Hudini Host не принял пароль';
    dropHome(); setTimeout(()=>{ if(!homeClient) tryHome(); }, 20000);   // пауза стримера или новый пароль: пробуем снова
  } });
}
// ---- свой адрес (для продвинутых) ----
function renderHostAdv(){
  const m=curRoom()?.manual;
  if(document.activeElement!==$('manUrl')) $('manUrl').value=m?.url||'';
  $('manPass').value=''; $('manPass').placeholder = m ? 'Пароль сохранён' : 'Пароль модераторов';
  $('manInfo').textContent = m ? '✓ Пульт подключается только к этому адресу' : '';
  if(m) $('hostAdv').open=true;
}
$('manSave').onclick=()=>{
  const r=curRoom(), url=$('manUrl').value.trim(), pass=$('manPass').value || r.manual?.pass || '';
  const a=cleanAddr({ url, pass }); if(!a || !pass) return toast('Нужен адрес вида wss://мой-адрес/mqtt и пароль');
  r.manual=a; saveRooms(); dropHome(); tryHome(); renderHostAdv();
};
$('manClear').onclick=()=>{ const r=curRoom(); delete r.manual; saveRooms(); dropHome(); tryHome(); renderHostAdv(); toast('Пульт снова ищет программу стримера сам'); };
// Программа стримера сообщает адрес (зашифровано ключом комнаты)
async function onSrv(payload){
  if(!payload.length || !KEYS) return;
  const info=await unsealJSON(KEYS, payload, false); if(!info) return;
  if(Number(info.ver)<2){ hostNote='Hudini Host устарел: нужна версия 1.0'; if(!homeClient) hostStatus(); return; }
  if(info.paused){ hostCtl={ ...(hostCtl||{}), paused:true }; hostNote='⏸ Стример поставил управление на паузу'; if(homeClient) dropHome(); else hostStatus(); return; }
  if(hostCtl?.paused){ hostCtl.paused=false; hostNote=''; }
  if(curRoom()?.manual) return;
  const fresh = typeof info.url==='string' && /^wss?:\/\/[^\s/]+\/mqtt$/.test(info.url) && typeof info.pass==='string' && Math.abs(Date.now()-Number(info.t)) < 3*60*1000;
  if(info.url===null && Math.abs(Date.now()-Number(info.t)) < 3*60*1000){ hostNote='Hudini Host выключен'; if(homeClient) dropHome('Программа стримера выключилась'); return; }
  if(!fresh) return;
  openHome({ url:info.url, user:'mod', pass:info.pass });
}
$('status').onclick=()=>{ if(!client?.connected) showHostTip(); };
async function onMessage(topic, payload, packet){
  if(!payload.length) return;                     // пустые «удаления» не принимаем
  const T=topics(room), keys=KEYS;
  if(topic===T.base+'/hb'){
    const h=await unsealJSON(keys, payload, false); if(!h) return;
    h.at=Date.now(); widgets.set(String(h.id).slice(0,10), h); renderObs(); return;
  }
  if(topic===T.base+'/host'){ const c=await unsealJSON(keys, payload, false); if(c){ const was=hostCtl?.hidden; hostCtl=c; renderObs(); if(c.hidden && !was && !packet.retain) toast('🙈 Стример спрятал оверлей в OBS', 4000); } return; }
  if(topic===T.base+'/cs2'){ const d=await unsealJSON(keys, payload, false); if(d){ CS2=d; CS2.at=packet.retain ? Number(d.t)||0 : Date.now(); CS2._skew=packet.retain?0:Date.now()-Number(d.t||Date.now()); if(!packet.retain) processCs2Events(d); else lastEvSeq=Math.max(lastEvSeq||0, ...((d.evs||[]).map(e=>e.s||0))); repaintCs2(); } return; }
  if(topic!==T.state) return;
  const msg=await unsealJSON(keys, payload, true);
  if(!msg || topic!==topics(room).state) return;  // подделка, или комнату сменили, пока расшифровывали
  if(msg.from===clientId && !packet.retain) return;   // своё эхо
  if(drag) return;                                 // не мешаем, пока тащим
  state=sanitizeState(msg); if(state.lang) STREAM_LANG=state.lang;
  if(selectedId && !byId(selectedId)) selectedId=null;
  renderAll();
}
// Всё, что уходит на экран, подписывается и шифруется. Очередь сохраняет порядок.
let pubChain=Promise.resolve();
function sealedPublish(topic, data, opts, keys=KEYS){
  const bytes = data instanceof Uint8Array ? data : TE.encode(JSON.stringify(data));
  const p = pubChain.then(async()=>{
    if(!client?.connected) throw new Error('нет связи');
    const box=await seal(keys, bytes, true);
    await new Promise((res, rej)=>client.publish(topic, box, opts, e=>e?rej(e):res()));
  });
  pubChain=p.catch(e=>console.warn(e));
  return p;
}
Assets.onReady=()=>renderAll();
// Файлы скачиваем из программы стримера и проверяем подпись
Assets.fetcher=async id=>{
  const h=homeHttp(); if(!h) throw new Error('нет связи');
  const keys=KEYS, r=await fetch(`${h.base}/files/${id}`, { headers:{ authorization:h.auth } });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return openAsset(keys, new Uint8Array(await r.arrayBuffer()), id);
};

let sendTimer=null, lastSend=0;
function publishNow(qos=0){
  clearTimeout(sendTimer); sendTimer=null; lastSend=performance.now();
  if(!client || !client.connected){ pendingOffline=true; return; }
  STREAM_LANG=streamLang();
  const msg={ v:2, wv:WIDGET_VER, from:clientId, t:Date.now(), lang:STREAM_LANG, visible:state.visible, els:state.els, fonts:state.fonts||[] };
  sealedPublish(topics(room).state, msg, { qos, retain:true }).catch(()=>{});
}
function scheduleSend(){
  if(sendTimer) return;
  sendTimer=setTimeout(()=>publishNow(0), Math.max(0, SEND_INTERVAL_MS-(performance.now()-lastSend)));
}
function sendFx(fx, quiet){
  if(!client || !client.connected){ if(!quiet) toast('Нет связи с Hudini Host'); return false; }
  sealedPublish(topics(room).fx, { ...fx, from:clientId, t:Date.now(), n:rid(8) }, { qos: quiet?0:1 }).catch(()=>{});
  return true;
}
async function switchRoom(code){
  if(code===room) return;
  if(homeClient) dropHome();
  if(pubClient?.connected) pubClient.unsubscribe(topics(room).base+'/srv');
  widgets.clear(); renderObs(); CS2=null; hostNote=''; storage=null; renderStorage();
  await useRoom(code); saveRooms();
  state={ visible:true, els:[] }; selectedId=null; undoStack.length=0; changeOpen=false; chatSeen.clear(); pendingOffline=false;
  Assets.reset();
  if(pubClient?.connected) pubClient.subscribe(topics(room).base+'/srv', { qos:1 });
  tryHome(); renderHostAdv(); renderSlang(); STREAM_LANG=streamLang();
  history.replaceState(null, '', location.pathname+keepQuery());
  renderRooms(); renderScenes(); renderScn(); $('scnEdit').hidden=true; lastEvSeq=null; updateLink(); renderAll();
}

// ================== ИЗМЕНЕНИЯ / ОТМЕНА ==================
function beginChange(){
  if(changeOpen) return;
  changeOpen=true;
  undoStack.push(JSON.stringify(state)); if(undoStack.length>80) undoStack.shift();
}
function changed(){ renderAll(); scheduleSend(); }
function commit(){ changeOpen=false; renderAll(); publishNow(1); }
function undo(){
  if(!undoStack.length) return toast('Нечего отменять');
  state=JSON.parse(undoStack.pop()); changeOpen=false;
  if(selectedId && !byId(selectedId)) selectedId=null;
  renderAll(); publishNow(1);
}

// ================== СОЗДАНИЕ ==================
function place(x, y){
  if(x!=null) return { x, y };
  const n=state.els.length%8; return { x:42+n*2.5, y:42+n*2.5 };
}
function addEl(el){
  if(state.els.length>=MAX_ELS){ toast('Слишком много элементов'); return null; }
  el.id=rid(10);
  if(el.hidden==null) el.hidden=$('addHidden').checked;
  Object.assign(el, { rot:0, op:1, anim:'none' }, el);
  const clean=sanitizeEl(el); if(!clean){ toast('Некорректный элемент'); return null; }
  beginChange();
  state.els.push(clean); selectedId=clean.id; commit();
  if(clean.hidden) toast('Добавлено скрытым: покажи кнопкой 👁 или ⚡');
  return clean;
}
function addText(text, x, y){
  text=(text||'').replace(/\s+$/,''); if(!text.trim()) return toast('Пустой текст');
  addEl({ type:'text', text, ...place(x,y), fs:8, font:'montserrat', color:'#ffffff', stroke:'#000000', sw:6, bg:false, bgColor:'#000000', bgA:0.6 });
}
function addWeb(url, x, y, extra={}){
  const kind=parseEmbed(url).kind;
  addEl({ type:'web', url, ...place(x,y), w: kind==='site'?45:40, ar:'16:9', shape:'rect',
    zoom: kind==='site'?0.6:1, sound: kind==='youtube'||kind==='twitch', bw:0, bc:'#ffffff', ...extra });
}
// Что за ссылка? Картинка, видео, YouTube/Twitch или сайт
function probeImage(src){
  return new Promise(res=>{ const i=new Image(); const t=setTimeout(()=>{ i.src=''; res(false); }, 5000);
    i.onload=()=>{ clearTimeout(t); res(true); }; i.onerror=()=>{ clearTimeout(t); res(false); }; i.src=src; });
}
async function addUrl(url, x, y){
  const src=safeUrl(url);
  if(!src) return toast('Нужна ссылка http(s)://…');
  if(parseEmbed(src).kind!=='site') return addWeb(src, x, y);
  if(isVideoUrl(src)) return addEl({ type:'video', src, ...place(x,y), w:35, sound:false });
  if(/\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(new URL(src).pathname) || await probeImage(src))
    return addEl({ type:'image', src, ...place(x,y), w:25 });
  addWeb(src, x, y);
}
function addCam(){
  const id=rid(12);
  window.open(`https://vdo.ninja/?push=${id}&webcam&label=moderator`, '_blank');
  addWeb(`https://vdo.ninja/?view=${id}&cleanoutput&transparent&cover`, 82, 75, { w:22, ar:'1:1', shape:'circle', sound:false, bw:0.6, bc:'#7c5cff' });
  toast('Во вкладке VDO.Ninja выбери камеру и нажми старт', 5000);
}
function nextNewYear(){ const d=new Date(); return new Date(d.getFullYear()+1, 0, 1).getTime(); }
const TW_BASE={ fs:10, font:'montserrat', color:'#ffffff', card:'#1d1d24', style:'flip' };
function addTimer(mode){
  const now=Date.now();
  const base={ type:'timer', mode, ...place(), ...TW_BASE, label:'', running:false };
  if(mode==='countdown') Object.assign(base, { dur:300000, left:300000, endText:sT('ВРЕМЯ!'), endBlink:true });
  if(mode==='stopwatch') Object.assign(base, { acc:0 });
  if(mode==='until') Object.assign(base, { target:nextNewYear(), label:sT('До Нового года'), fs:8, endText:sT('С НОВЫМ ГОДОМ!'), endConfetti:true, endBlink:true });
  if(mode==='clock') Object.assign(base, { secs:true, tz:'', fs:8 });
  addEl(base);
}
function addCounter(chat){
  addEl({ type:'counter', ...place(), ...TW_BASE, fs:9, value:0, step:1,
    label: chat ? sT('F в чат') : sT('Смертей'), cmode: chat?'chat':'manual', kw: chat?'F':'', uniq:false,
    every:60, goal:0, running: !!chat, startAt:Date.now() });
  if(chat && !chatWs) toast('Подключи чат Twitch слева, чтобы счётчик заработал', 4000);
}

function addCs2(){
  const n=state.els.filter(e=>e.type==='cs2').length%5;
  addEl({ type:'cs2', view:'card', x:16+n*4, y:86-n*14, fs:3.4, font:'montserrat', color:'#ffffff', card:'#15171d', accent:'#ffb020', label:'' });
  if(!cs2Fresh()) toast('Данные CS2 появятся, когда у стримера запущена программа Hudini Host и подключена CS2', 5000);
}
function repaintCs2(){
  state.els.forEach((el,i)=>{ if(el.type!=='cs2') return; const n=nodes.get(el.id); if(n && !n._animOn) paintNode(n, el, i+1); });
  const sel=byId(selectedId); if(sel?.type==='cs2') renderCsStatus();
}
function renderCsStatus(){
  $('csStatus').textContent = cs2Fresh()
    ? `✓ Данные идут: ${mapName(CS2.map)||'меню'}${CS2.name?' · '+CS2.name:''}`
    : 'Нет данных. У стримера должна быть запущена программа Hudini Host и нажата кнопка «Подключить CS2».';
  if(cs2Fresh()) $('csStatus').textContent += CS2.spec ? ` · 👁 режим наблюдателя, игроков: ${CS2.players.length}` : ' · игрок (панели команд — только в режиме наблюдателя)';
}
function addCase(){
  const items=[['Наклейка',2,50],['Скин на пистолет',3,25],['Скин на винтовку',4,15],['AK-47 | Redline',5,8],['Нож',6,2]].map(([n,r,p])=>({ n:sT(n), r, p, img:'' }));
  addEl({ type:'case', x:50, y:50, fs:4, font:'montserrat', color:'#ffffff', name:'HUDINI CASE', cc:'#7c5cff', items, hideAfter:12, vol:0.8 });
}
function addRaffle(){
  addEl({ type:'raffle', ...place(), x:50, y:45, fs:3, font:'montserrat', color:'#ffffff', card:'#141824', accent:'#7c5cff',
    title:sT('Розыгрыш'), prize:'', kw:'!участвую', entry:'word', subx2:true, auto:true, phase:'idle' });
  if(!chatWs) toast('Для розыгрыша подключи чат Twitch слева', 4000);
}
function addPoll(){
  addEl({ type:'poll', ...place(), x:78, y:30, fs:3.2, font:'montserrat', color:'#ffffff', card:'#1d1d24', accent:'#7c5cff',
    title:sT('Что дальше?'), opts:[1,2,3].map(n=>sT('Вариант')+' '+n), votes:[0,0,0], running:false });
  if(!chatWs) toast('Для голосования подключи чат Twitch слева', 4000);
}

// ---- язык надписей на стриме (по умолчанию как у пульта) ----
const DEFAULT_TXT={
  en:{ 'ВРЕМЯ!':'TIME!', 'До Нового года':'Until New Year', 'С НОВЫМ ГОДОМ!':'HAPPY NEW YEAR!', 'F в чат':'F in chat', 'Смертей':'Deaths', 'Что дальше?':'What next?', 'Вариант':'Option', 'Розыгрыш':'Giveaway', 'Наклейка':'Sticker', 'Скин на пистолет':'Pistol skin', 'Скин на винтовку':'Rifle skin', 'Нож':'Knife', 'Предмет':'Item' },
  uk:{ 'ВРЕМЯ!':'ЧАС!', 'До Нового года':'До Нового року', 'С НОВЫМ ГОДОМ!':'З НОВИМ РОКОМ!', 'F в чат':'F у чат', 'Смертей':'Смертей', 'Что дальше?':'Що далі?', 'Вариант':'Варіант', 'Розыгрыш':'Розіграш', 'Наклейка':'Наліпка', 'Скин на пистолет':'Скін на пістолет', 'Скин на винтовку':'Скін на гвинтівку', 'Нож':'Ніж', 'Предмет':'Предмет' },
  de:{ 'ВРЕМЯ!':'ZEIT!', 'До Нового года':'Bis Neujahr', 'С НОВЫМ ГОДОМ!':'FROHES NEUES!', 'F в чат':'F in den Chat', 'Смертей':'Tode', 'Что дальше?':'Was als Nächstes?', 'Вариант':'Option', 'Розыгрыш':'Gewinnspiel', 'Наклейка':'Sticker', 'Скин на пистолет':'Pistolen-Skin', 'Скин на винтовку':'Gewehr-Skin', 'Нож':'Messer', 'Предмет':'Gegenstand' },
};
function streamLang(){ const r=curRoom(); return STREAM_LANGS.includes(r?.slang) ? r.slang : (STREAM_LANGS.includes(window.HudiniI18n?.lang) ? window.HudiniI18n.lang : 'ru'); }
const sT=s=>DEFAULT_TXT[streamLang()]?.[s] ?? s;
function renderSlang(){ const r=curRoom(); $('slang').value = STREAM_LANGS.includes(r?.slang) ? r.slang : ''; }
$('slang').onchange=e=>{ const r=curRoom(); if(e.target.value) r.slang=e.target.value; else delete r.slang; saveRooms(); STREAM_LANG=streamLang(); renderAll(); publishNow(1); toast('Надписи на стриме: '+e.target.selectedOptions[0].textContent); };

// ================== ФАЙЛЫ С КОМПЬЮТЕРА ==================
function showUpload(text, p){ $('upload').hidden=false; $('upText').textContent=text; $('upBar').style.width=Math.round(p*100)+'%'; }
function hideUpload(){ $('upload').hidden=true; }
// Анимированная ли картинка: WebP с флагом анимации или APNG (кадр acTL до первых данных)
async function isAnimated(file){
  try{
    const b=new Uint8Array(await file.slice(0, 256*1024).arrayBuffer());
    const at=(i,str)=>[...str].every((c,k)=>b[i+k]===c.charCodeAt(0));
    if(file.type==='image/gif') return true;
    if(at(0,'RIFF') && at(8,'WEBP')) return at(12,'VP8X') && (b[20] & 0x02)!==0;
    if(b[0]===0x89 && at(1,'PNG')){
      for(let i=8;i+8<b.length;){ const len=(b[i]<<24|b[i+1]<<16|b[i+2]<<8|b[i+3])>>>0;
        if(at(i+4,'acTL')) return true; if(at(i+4,'IDAT')) return false; i+=12+len; }
    }
  }catch{}
  return false;
}
async function shrinkImage(file){
  // GIF, анимированные WebP/PNG и SVG не трогаем. Большие обычные фото уменьшаем до 1920 px и жмём в WebP.
  if(!/^image\/(png|jpeg|webp|bmp)$/.test(file.type) || await isAnimated(file)) return file;
  try{
    const bmp=await createImageBitmap(file);
    const k=Math.min(1, 1920/Math.max(bmp.width, bmp.height));
    if(k===1 && file.size<600*1024) return file;
    const cv=document.createElement('canvas'); cv.width=Math.round(bmp.width*k); cv.height=Math.round(bmp.height*k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob=await new Promise(r=>cv.toBlob(r, 'image/webp', 0.88));
    return blob && blob.size<file.size ? blob : file;
  }catch{ return file; }
}
// ---- место для файлов в программе стримера ----
let storage=null, storageToast=false;
const fmtBytes=b=>{ const lang=window.HudiniI18n?.lang||'ru', nf=new Intl.NumberFormat(lang, { maximumFractionDigits:1 });
  const [k,m,g] = lang==='ru'||lang==='uk' ? ['КБ','МБ','ГБ'] : ['KB','MB','GB'];
  return b>=1073741824 ? nf.format(b/1073741824)+' '+g : b>=1048576 ? nf.format(Math.round(b/1048576))+' '+m : nf.format(Math.round(b/1024))+' '+k; };
function renderStorage(){
  const el=$('storageInfo'), row=$('storageRow');
  if(!storage){ row.hidden=true; return; }
  row.hidden=false;
  const full=storage.used>=storage.limitBytes*0.9 || storage.files>=storage.maxFiles;
  el.textContent=`Место: ${fmtBytes(storage.used)} / ${fmtBytes(storage.limitBytes)} · файлов: ${storage.files} / ${storage.maxFiles}`;
  el.title=`Файлы хранятся у стримера в программе Hudini Host. Один файл до ${fmtBytes(storage.maxFileBytes)}. Лимиты меняет стример на странице программы.`;
  el.classList.toggle('warnText', full);
}
function setStorage(st){ if(st && typeof st==='object'){ storage=st; renderStorage(); } }
async function refreshStorage(announce){
  const h=homeHttp(); if(!h) return;
  try{
    const r=await fetch(h.base+'/files', { headers:{ authorization:h.auth } });
    const j=await r.json(); if(!r.ok) throw new Error(j.error||r.status);
    setStorage(j.storage);
    if(announce && !storageToast){ storageToast=true; toast(`Место для файлов: свободно ${fmtBytes(Math.max(0, storage.limitBytes-storage.used))}, ещё ${Math.max(0, storage.maxFiles-storage.files)} файлов`, 4000); }
    return j;
  }catch(e){ console.warn('storage', e); }
}
// Файлы, которые нужны этой комнате: на экране, в сценах, библиотеке, сценариях и поле звука
function usedAssets(){
  const used=new Set(), add=v=>{ const a=assetId(v); if(a) used.add(a); };
  const fromEl=e=>{ add(e?.src); add(e?.endSound); add(e?.lgCT); add(e?.lgT); add(e?.pimg); add(e?.vfx); add(e?.logo); for(const it of e?.items||[]) add(it?.img);
    if(e?.snd && typeof e.snd==='object') for(const v of Object.values(e.snd)) add(v); else add(e?.snd); for(const v of Object.values(e?.av||{})) add(v); };
  state.els.forEach(fromEl);
  for(const f of state.fonts||[]) used.add(f.id);
  add($('soundUrl').value);
  for(const it of library) if(it.room===room) fromEl(it.el);
  for(const sc of scenes[room]||[]) (sc.els||[]).forEach(fromEl);
  for(const sc of scnStore[room]||[]) for(const a of sc.acts||[]) add(a.url);
  return used;
}
function showHostTip(why, full){
  $('hostTipWhy').textContent = why || 'Экран стримера меняется через программу Hudini Host';
  $('hostTipFull').hidden=!full; $('hostTipNoHost').hidden=!!full;
  $('hostTip').hidden=false;
}
$('hostTipOk').onclick=()=>{ $('hostTip').hidden=true; };
$('hostTipClean').onclick=()=>{ $('hostTip').hidden=true; cleanFiles(); };
function err(msg){ const e=new Error(msg); e.shown=true; toast(msg, 5000); return e; }
async function uploadBlob(blob, name){
  const h=homeHttp();
  if(!h){ showHostTip('Файлы хранятся у стримера в программе Hudini Host, а она сейчас не подключена'); const e=new Error('нет Hudini Host'); e.shown=true; throw e; }
  if(storage && blob.size > storage.maxFileBytes) throw err(`${name}: ${fmtBytes(blob.size)}, а стример разрешил файлы до ${fmtBytes(storage.maxFileBytes)}. Для больших видео лучше ссылка или YouTube.`);
  const id=rid(14), keys=KEYS;
  const box=await packAsset(keys, blob, id, name);
  const n=Math.max(1, Math.ceil(box.length/PART_BYTES));
  for(let i=0;i<n;i++){
    const r=await fetch(`${h.base}/files/${id}?part=${i}${i===n-1?'&last=1':''}`, { method:'PUT',
      headers:{ authorization:h.auth, 'content-type':'application/octet-stream' }, body:box.subarray(i*PART_BYTES, (i+1)*PART_BYTES) });
    const j=await r.json().catch(()=>({}));
    if(j.storage) setStorage(j.storage);
    if(r.status===413){
      const why={ file:'файл больше, чем разрешил стример', count:'файлов уже столько, сколько разрешил стример', space:'место для файлов кончилось' }[j.reason] || 'место для файлов кончилось';
      showHostTip(`«${name}» не загрузился: ${why}`, true); const e=new Error('нет места'); e.shown=true; throw e;
    }
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    showUpload(`Загрузка ${name}: ${Math.round((i+1)/n*100)}%`, (i+1)/n);
  }
  Assets.add(id, blob, name);
  return 'asset:'+id;
}
// ---------- свои шрифты: файл .ttf/.otf/.woff/.woff2 перетащить на экран или выбрать в инспекторе ----------
const fontExt = f => FONT_EXT[(f.name.split('.').pop()||'').toLowerCase()];
async function addFonts(files){
  let last=null;
  for(const file of files){
    const type=fontExt(file); if(!type) continue;
    try{
      const buf=await file.arrayBuffer();
      try{ await new FontFace('hu-check', buf.slice(0)).load(); }catch{ toast(`${file.name}: файл не открылся как шрифт`); continue; }
      showUpload(`Загрузка шрифта ${file.name}…`, 0);
      const id=assetId(await uploadBlob(new Blob([buf], { type }), file.name));
      beginChange(); state.fonts=[...(state.fonts||[]).filter(f=>f.id!==id), { id, name:file.name.replace(/\.[^.]+$/,'').slice(0,60) }];
      const el=byId(selectedId); if(el && 'font' in el) el.font='u:'+id;   // выбранному элементу сразу ставим новый шрифт
      commit(); last=id;
    }catch(e){ if(!e.shown) toast(`Шрифт не загрузился: ${e.message||e}`); }
  }
  hideUpload();
  if(last) toast('Шрифт добавлен: он есть в списке «Шрифт» у всех элементов');
}
function fillFonts(){
  const sel=I('iFont'); let g=sel.querySelector('optgroup[data-own]');
  if(!g){ g=document.createElement('optgroup'); g.dataset.own=''; g.label='Свои шрифты'; sel.appendChild(g);
    const add=document.createElement('option'); add.value='__add'; add.textContent='＋ Добавить свой шрифт…'; sel.appendChild(add); }
  const want=(state.fonts||[]).map(f=>f.id+'|'+f.name).join(',');
  if(g.dataset.sig===want) return; g.dataset.sig=want;
  g.replaceChildren(...(state.fonts||[]).map(f=>{ const o=new Option(f.name, 'u:'+f.id); o.dataset.i18nSkip=''; return o; }));
  g.hidden=!g.children.length;
}
function removeFont(id){
  beginChange(); state.fonts=(state.fonts||[]).filter(f=>f.id!==id);
  for(const e of state.els) if(e.font==='u:'+id) e.font='montserrat';
  commit(); toast('Шрифт убран из списка. Файл удалит «Очистить файлы» в комнате.');
}

async function uploadFiles(files, x, y){
  const fonts=files.filter(fontExt); if(fonts.length){ await addFonts(fonts); files=files.filter(f=>!fontExt(f)); if(!files.length) return; }
  for(const file of files){
    const kind=file.type.split('/')[0];
    if(kind!=='image' && kind!=='video'){ toast(`${file.name}: это не картинка и не видео`); continue; }
    try{
      const blob = kind==='image' ? await shrinkImage(file) : file;
      showUpload(`Загрузка ${file.name}…`, 0);
      const src=await uploadBlob(blob, file.name);
      addEl({ type: kind==='video'?'video':'image', src, ...place(x,y), w: kind==='video'?35:25, sound:false });
    }catch(e){ if(!e.shown) toast(`Не загрузилось: ${e.message||e}`); }
  }
  hideUpload();
}
// Удалить из программы стримера файлы, которых нет ни на экране, ни в сценах, ни в библиотеке этого пульта.
// Сама программа ничего не удаляет: так мем, приготовленный на конец стрима, не пропадёт.
async function cleanFiles(){
  const h=homeHttp(); if(!h) return showHostTip('Файлы хранятся в программе Hudini Host, а она сейчас не подключена');
  const j=await refreshStorage(); if(!j) return toast('Не получилось узнать список файлов');
  const used=usedAssets(), unused=(j.ids||[]).filter(([id])=>!used.has(id));
  if(!unused.length) return toast('Все файлы используются: на экране, в сценах, библиотеке или сценариях', 4000);
  const bytes=unused.reduce((a,[,b])=>a+b, 0);
  if(!confirm(`Удалить ${unused.length} файлов (${fmtBytes(bytes)})?\n\nИх нет ни на экране, ни в сценах, библиотеке и сценариях этого пульта.\nЕсли у другого модератора свои сцены с этими файлами, у него они пропадут.`)) return;
  try{
    const r=await fetch(h.base+'/files/clean', { method:'POST', headers:{ authorization:h.auth, 'content-type':'application/json' }, body:JSON.stringify({ keep:[...used] }) });
    const k=await r.json(); if(!r.ok) throw new Error(k.error||r.status);
    setStorage(k.storage); toast(`🧹 Удалено файлов: ${k.deleted} (${fmtBytes(k.bytes)})`, 4000);
  }catch(e){ toast('Не удалилось: '+(e.message||e)); }
}
$('cleanFiles').onclick=cleanFiles;
$('cleanFiles2').onclick=cleanFiles;

// ================== ОТРИСОВКА ==================
const nodes=new Map();
function addHandles(node){
  for(const h of ['size','rot','sw','shh']){ const d=document.createElement('div'); d.className='h h-'+h; d.dataset.h=h; if(h==='sw'||h==='shh') d.title='Потяни: своя ширина или высота рамки · двойной клик: снова по содержимому'; node.appendChild(d); }
  const t=document.createElement('div'); t.className='tag'; node.appendChild(t);
  const c=node.querySelector('.content');
  if(c.tagName==='IMG' || c.tagName==='VIDEO'){
    c.addEventListener('error', ()=>node.classList.add('broken'));
    c.addEventListener(c.tagName==='VIDEO'?'loadeddata':'load', ()=>node.classList.remove('broken'));
  }
}
function renderAll(){
  syncSel();
  stage.classList.toggle('all-hidden', !state.visible);
  const seen=new Set(), now=nowMs();
  state.els.forEach((el,i)=>{
    seen.add(el.id);
    let node=nodes.get(el.id);
    if(node && node.dataset.type!==el.type){ node.remove(); node=null; }
    if(!node){ node=buildNode(el); addHandles(node); elLayer.appendChild(node); nodes.set(el.id,node); }
    node._el=el;
    paintNode(node, el, i+1);
    tickNode(node, el, now);
    if(el.type==='web'){
      const src=embedSrc(el, location.hostname, true);   // в пульте всегда без звука
      node.querySelector('.ph').textContent = src ? '' : (window.HudiniI18n?.t || String)('Twitch показывается, только когда пульт открыт с сайта');
      setFrameSrc(node, src ? src+(src.includes('?')?'&':'?')+'_r='+el.restart : null, parseEmbed(el.url).kind==='site');
      if(src) playerApply(node, el, true);   // превью повторяет паузу стрима, но всегда без звука
    }
    node.style.opacity=el.op;
    node.classList.toggle('is-hidden', el.hidden);
    node.classList.toggle('flashing', !!el.ttl);
    node.classList.toggle('sel', el.id===selectedId);
    node.classList.toggle('msel', msel.has(el.id) && el.id!==selectedId);
    node.querySelector('.tag').textContent = el.ttl ? 'на стриме ⏱' : 'скрыто';
    if(el.type==='video' && el.restart && node._restart!==el.restart){ node._restart=el.restart; node.querySelector('video').currentTime=0; }
  });
  for(const [id,n] of nodes) if(!seen.has(id)){ n.remove(); nodes.delete(id); }
  renderLayers(); renderInspector(); renderToolbar();
  $('globalEye').textContent = state.visible ? '🙈 Скрыть всё' : '👁 Показать всё';
}
const MODE_ICO={ countdown:'⏱', stopwatch:'⏲', until:'📅', clock:'🕐' };
const MODE_NAME={ countdown:'Таймер', stopwatch:'Секундомер', until:'Отсчёт до', clock:'Часы' };
const KIND_NAME={ site:'🌐 Сайт', youtube:'▶ YouTube', twitch:'🟣 Twitch', cam:'📷 Вебка' };
function elIcon(el){
  if(el.type==='timer') return MODE_ICO[el.mode];
  if(el.type==='counter') return el.cmode==='chat'?'💬':'🔢';
  if(el.type==='web') return KIND_NAME[parseEmbed(el.url).kind].split(' ')[0];
  if(el.type==='poll') return '📊';
  if(el.type==='raffle') return '🎁';
  if(el.type==='case') return '📦';
  if(el.type==='cs2') return '🎯';
  if(el.type==='msg') return '💬';
  return { text:'T', image:'🖼', video:'🎞' }[el.type];
}
function elName(el){
  if(el.type==='text') return el.text.split('\n')[0] || '(пусто)';
  if(el.type==='timer') return (el.label||MODE_NAME[el.mode])+' · '+twState(el, nowMs()).text;
  if(el.type==='counter') return (el.label||'Счётчик')+' · '+counterValue(el, nowMs());
  if(el.type==='msg') return (el.user||'сообщение')+': '+el.text;
  if(el.type==='cs2') return 'CS2 · '+{ card:'карточка', kda:'K/D/A', hp:'HP', score:'счёт', money:'деньги', weapon:'оружие', streak:'серия', teams:'команды'+(el.side!=='both'?' '+el.side.toUpperCase():''), scorebar:'счёт-бар', observed:'наблюдаемый' }[el.view];
  if(el.type==='poll') return (el.title||'Голосование')+' · '+el.votes.reduce((a,b)=>a+b,0)+(el.running?' ▶':'');
  if(el.type==='case') return 'Кейс · '+el.name+(el.openAt && nowMs()<el.openAt+CASE_T.reveal ? ' · открывается' : '');
  if(el.type==='raffle') return (el.title||'Розыгрыш')+' · '+({ idle:'ждёт', collect:'сбор', closed:'сбор закрыт', spin:el.winner||'крутим' }[el.phase])+' · 👥 '+el.n;
  if(el.type==='web'){ const k=parseEmbed(el.url).kind; if(k==='cam') return 'Вебка'; try{ return new URL(el.url).hostname+new URL(el.url).pathname; }catch{ return el.url; } }
  if(assetId(el.src)) return el.type==='video' ? 'видео с компьютера' : 'картинка с компьютера';
  try{ const p=new URL(el.src).pathname.split('/').filter(Boolean).pop(); return decodeURIComponent(p||el.src); }catch{ return el.src; }
}
function renderLayers(){
  const box=$('layers'); box.replaceChildren();
  if(!state.els.length){ const d=document.createElement('div'); d.className='hint'; d.textContent='Пока пусто'; box.appendChild(d); return; }
  [...state.els].reverse().forEach((el, li)=>{
    const row=document.createElement('div');
    row.className='layer'+(el.id===selectedId?' sel':msel.has(el.id)?' msel':'')+(el.hidden?' hid':'')+(el.ttl?' flashing':'');
    row.dataset.id=el.id;
    const num=document.createElement('span'); num.className='num'; num.textContent=li<9?li+1:''; num.title=li<9?`Клавиша ${li+1}: показать на N сек`:'';
    const ico=document.createElement('span'); ico.className='ico'; ico.textContent=elIcon(el);
    const name=document.createElement('span'); name.className='name'; name.textContent=(el.g?'🔗 ':'')+elName(el); name.title=name.textContent;
    row.append(num, ico, name);
    const btn=(act, txt, title)=>{ const b=document.createElement('button'); b.dataset.act=act; b.textContent=txt; b.title=title; row.appendChild(b); };
    if(el.type==='timer' && (el.mode==='countdown'||el.mode==='stopwatch')) btn('ttoggle', el.running?'⏸':'▶', 'Старт / пауза (Пробел)');
    if(el.type==='counter'){ btn('cminus','−','−шаг'); btn('cplus','+','+шаг'); }
    if(el.type==='poll') btn('ptoggle', el.running?'⏸':'▶', 'Начать / закончить голосование');
    if(el.kf) btn('kfplay', el.kf.playing?'⏹':'🎬', 'Проиграть / остановить анимацию (P)');
    btn('eye', el.hidden?'🙈':'👁', 'Показать / скрыть (H)');
    btn('flash', '⚡', 'Показать на N секунд (F)');
    box.appendChild(row);
  });
}
// --- инспектор ---
const I=id=>$(id);
function setField(f, v, prop='value'){ if(document.activeElement!==f && f[prop]!==v) f[prop]=v; }
function normRot(r){ return ((r+180)%360+360)%360-180; }
function toLocalInput(ms){ if(!ms) return ''; const d=new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function showFor(attr, value){ document.querySelectorAll(`#insp [data-${attr}]`).forEach(n=>n.hidden=!n.dataset[attr].split(' ').includes(value)); }
function renderInspector(){
  const el=byId(selectedId);
  $('insp').hidden=!el; $('insp-empty').hidden=!!el;
  if(!el) return;
  $('multiBanner').hidden = msel.size<2;
  $('multiBanner').textContent = `Выбрано ${msel.size}. Ниже настройки «${elName(el).slice(0,20)}». Двигать, выравнивать, скрывать и удалять можно все сразу: панель над холстом.`;
  showFor('for', el.type);
  const eye=$('bigEye');
  eye.className=el.hidden?'off':'on';
  eye.textContent=el.hidden?'🙈 Скрыто: нажми, чтобы показать':'👁 На стриме: нажми, чтобы скрыть';
  $('flashBtn').textContent=`⚡ Показать на ${flashSecs()} сек`;
  const sizeTxt = 'fs' in el;
  if(sizeTxt){
    Object.assign(I('iSize'), { min:1, max:40, step:0.5 }); setField(I('iSize'), String(el.fs));
    $('vSize').textContent=el.fs.toFixed(1)+'% высоты';
    fillFonts(); setField(I('iFont'), el.font); setField(I('iColor'), el.color);
    $('fontDel').hidden=!String(el.font).startsWith('u:');
  } else {
    Object.assign(I('iSize'), { min:2, max:150, step:1 }); setField(I('iSize'), String(el.w));
    $('vSize').textContent=Math.round(el.w)+'% ширины';
  }
  if(el.type==='text'){
    setField(I('iText'), el.text); setField(I('iStroke'), el.stroke); setField(I('iSw'), String(el.sw));
    setField(I('iBg'), el.bg, 'checked'); setField(I('iBgColor'), el.bgColor); setField(I('iBgA'), String(el.bgA));
  }
  if(el.type==='timer'||el.type==='counter'){
    setField(I('iLabel'), el.label); setField(I('iStyle'), el.style); setField(I('iCard'), el.card);
  }
  if(el.type==='timer'){
    setField(I('iMode'), el.mode); showFor('mode', el.mode);
    const tot=Math.round(el.dur/1000); setField(I('iMin'), String(Math.floor(tot/60))); setField(I('iSec'), String(tot%60));
    $('tToggle').textContent = el.running ? '⏸ Пауза' : '▶ Старт';
    $('tToggle').className = el.running ? 'grow' : 'go grow';
    setField(I('iTarget'), toLocalInput(el.target));
    setField(I('iSecs'), el.secs, 'checked'); setField(I('iTz'), el.tz);
    setField(I('iEndText'), el.endText); setField(I('iEndSound'), el.endSound);
    setField(I('iEndConfetti'), el.endConfetti, 'checked'); setField(I('iEndBlink'), el.endBlink, 'checked');
  }
  if(el.type==='counter'){
    setField(I('iValue'), String(counterValue(el, nowMs()))); setField(I('iStep'), String(el.step)); setField(I('iGoal'), el.goal?String(el.goal):'');
    setField(I('iCmode'), el.cmode); showFor('cmode', el.cmode);
    setField(I('iKw'), el.kw); setField(I('iUniq'), el.uniq, 'checked'); setField(I('iEvery'), String(el.every));
    $('cToggle').textContent = el.running ? '⏸ Остановить' : '▶ Считать';
    $('cToggle').className = el.running ? 'grow' : 'go grow';
  }
  if(el.type==='video'){ setField(I('iSound'), el.sound, 'checked'); setField(I('iVol'), String(el.vol)); $('vVol').textContent=Math.round(el.vol*100)+'%'; I('iVol').disabled=!el.sound; }
  if(el.type==='msg'){ setField(I('iMaxw'), String(el.maxw)); $('vMaxw').textContent=Math.round(el.maxw)+'% экрана'; setField(I('iMsgAccent'), el.accent); setField(I('iMsgCard'), el.card); }
  if(el.type==='cs2'){ renderCsHud(el); $('csSideRow').hidden = el.view!=='teams'; $('csStreakRow').hidden = el.view!=='streak'; setField(I('iCsMinK'), String(el.minK)); setField(I('iCsSide'), el.side); setField(I('iCsView'), el.view); setField(I('iCsLabel'), el.label); setField(I('iCsAccent'), el.accent); setField(I('iCsCard'), el.card); renderCsStatus(); }
  if(el.type==='raffle') renderRaffle(el);
  if(el.type==='case') renderCase(el);
  if(el.type==='poll'){
    setField(I('iPTitle'), el.title); setField(I('iPOpts'), el.opts.join('\n'));
    setField(I('iAccent'), el.accent); setField(I('iPCard'), el.card);
    $('pToggle').textContent = el.running ? '⏹ Закончить' : '▶ Начать'; $('pToggle').className = el.running ? 'grow' : 'go grow';
  }
  if(el.type==='web'){
    const k=parseEmbed(el.url).kind; showFor('kind', k);
    $('webKind').textContent=KIND_NAME[k];
    setField(I('iUrl'), el.url); setField(I('iWebSound'), el.sound, 'checked');
    $('plToggle').textContent = el.paused ? '▶ Играть' : '⏸ Пауза'; $('plToggle').className = el.paused ? 'go grow' : 'grow';
    { const p=parseEmbed(el.url); $('plSeek').hidden = p.kind==='twitch' && !!p.channel; }   // у прямого эфира перематывать некуда
    setField(I('iWebVol'), String(el.vol)); $('vWebVol').textContent=Math.round(el.vol*100)+'%'; I('iWebVol').disabled=!el.sound;
    setField(I('iAr'), el.ar); setField(I('iShape'), el.shape); setField(I('iBc'), el.bc); setField(I('iBw'), String(el.bw));
    setField(I('iZoom'), String(el.zoom)); $('vZoom').textContent=Math.round(el.zoom*100)+'%';
  }
  renderKf(el);
  if(el.type==='image'||el.type==='video'){
    setField(I('iHh'), String(el.hh||0)); $('vHh').textContent = el.hh ? el.hh.toFixed(1)+'% высоты' : 'по пропорциям';
    $('bRatio').disabled = !el.hh;
  }
  setField(I('iRot'), String(Math.round(normRot(el.rot)))); $('vRot').textContent=Math.round(normRot(el.rot))+'°';
  setField(I('iOp'), String(el.op)); $('vOp').textContent=Math.round(el.op*100)+'%';
  setField(I('iAnim'), el.anim);
}
// ---- выделение: несколько элементов, группы ----
const msel=new Set();
function groupOf(id){ const el=byId(id); return el?.g ? state.els.filter(e=>e.g===el.g).map(e=>e.id) : [id]; }
function select(id, mode='replace'){
  if(!id){ msel.clear(); selectedId=null; renderAll(); return; }
  const ids=groupOf(id);
  if(mode==='toggle' && msel.has(id)){ ids.forEach(i=>msel.delete(i)); if(!msel.has(selectedId)) selectedId=[...msel][0]||null; }
  else { if(mode!=='toggle' && mode!=='add') msel.clear(); ids.forEach(i=>msel.add(i)); selectedId=id; }
  renderAll();
}
function selList(){ return state.els.filter(e=>msel.has(e.id)); }
function syncSel(){
  for(const id of [...msel]) if(!byId(id)) msel.delete(id);
  if(selectedId && !byId(selectedId)) selectedId=null;
  if(!selectedId){ msel.clear(); return; }
  if(!msel.has(selectedId)){ msel.clear(); groupOf(selectedId).forEach(i=>msel.add(i)); }
}

// ================== СЦЕНА ==================
const stageBox=$('stageBox');
function fit(){
  const W=stageBox.clientWidth-30, H=stageBox.clientHeight-40;
  let w=W, h=w*9/16; if(h>H){ h=H; w=h*16/9; }
  stage.style.width=w+'px'; stage.style.height=h+'px';
  stage.style.setProperty('--u', (h/100)+'px');
}
new ResizeObserver(fit).observe(stageBox);

function scaleEl(el,k){ if('fs' in el) el.fs=num(el.fs*k,el.fs,0.5,100); else { el.w=num(el.w*k,el.w,1,200); if(el.hh) el.hh=num(el.hh*k,el.hh,0.5,300); } }
let lastHandle={};   // для двойного клика по ручке рамки
function centerPx(el){ const r=stage.getBoundingClientRect(); return { cx:r.left+el.x/100*r.width, cy:r.top+el.y/100*r.height, r }; }
const angleOf=(e,cx,cy)=>Math.atan2(e.clientY-cy, e.clientX-cx)*180/Math.PI;

stage.addEventListener('pointerdown', e=>{
  if(e.button!==0) return;
  const node=e.target.closest('.el');
  document.activeElement?.blur?.();
  if(!node){
    // рамка выделения по пустому месту
    e.preventDefault();
    const r=stage.getBoundingClientRect();
    drag={ mode:'rect', x0:e.clientX, y0:e.clientY, r, add:e.shiftKey||e.ctrlKey||e.metaKey, base:new Set(msel), moved:false };
    stage.setPointerCapture(e.pointerId);
    return;
  }
  const el=byId(node.dataset.id); if(!el) return;
  e.preventDefault();
  const h=e.target.closest('.h')?.dataset.h;
  if(!h && (e.shiftKey||e.ctrlKey||e.metaKey)){ select(el.id, 'toggle'); return; }   // Shift/Ctrl+клик — добавить/убрать из выделения
  if(msel.has(el.id) && msel.size>1 && !h){ selectedId=el.id; renderAll(); } else select(el.id);
  beginChange();
  const { cx, cy, r }=centerPx(el);
  const media = el.type==='image' || el.type==='video';
  const prevHandle = lastHandle; lastHandle={ t:Date.now(), h, id:el.id }; void prevHandle;
  if(media && (h==='sw' || h==='shh' || (h==='size' && e.shiftKey))){
    // растягивание: считаем по осям самого элемента (с учётом поворота)
    const c=node.querySelector('.content'), a=el.rot*Math.PI/180;
    const loc=(x,y)=>({ u:(x-cx)*Math.cos(a)+(y-cy)*Math.sin(a), v:-(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a) });
    const p0=loc(e.clientX, e.clientY);
    drag={ mode:'stretch', axis: h==='sw'?'x':h==='shh'?'y':'xy', loc, u0:Math.max(4,Math.abs(p0.u)), v0:Math.max(4,Math.abs(p0.v)),
      w0:el.w, hh0: el.hh || c.offsetHeight/r.height*100 };
  } else if(BOXABLE.has(el.type) && (h==='sw' || h==='shh') && Date.now()-(prevHandle.t||0)<400 && prevHandle.h===h && prevHandle.id===el.id){
    // двойной клик по ручке рамки: снова размер по содержимому
    if(h==='sw') el.bw=0; else el.bh=0; commit(); toast('Размер снова по содержимому'); return;
  } else if(BOXABLE.has(el.type) && (h==='sw' || h==='shh')){
    // своя рамка: тянем ширину или высоту, содержимое подстраивается внутри
    const c=node.querySelector('.content');
    drag={ mode:'box', axis:h==='sw'?'x':'y', cx, cy, x0:e.clientX, y0:e.clientY, a:el.rot*Math.PI/180, sw:r.width, sh:r.height,
      bw0: el.bw || node.offsetWidth/r.width*100, bh0: el.bh || c.offsetHeight/r.height*100 };
  } else if(h==='size'){
    drag={ mode:'size', cx, cy, d0:Math.max(5, Math.hypot(e.clientX-cx, e.clientY-cy)), fs0:el.fs, w0:el.w, hh0:el.hh };
  } else if(h==='rot' || e.altKey){
    drag={ mode:'rot', cx, cy, prev:angleOf(e,cx,cy), acc:0, rot0:el.rot };
  } else {
    // двигаем всё выделенное; рамка всей группы не должна вылезти за край кадра
    const items=selList().map(x=>({ id:x.id, x0:x.x, y0:x.y }));
    const bb=selBounds(items.map(i=>i.id));
    drag={ mode:'move', mx:e.clientX, my:e.clientY, x0:el.x, y0:el.y, r, items, bb };
  }
  drag.id=el.id;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e=>{
  if(!drag) return;
  if(drag.mode==='rect'){
    const x1=Math.min(drag.x0,e.clientX), x2=Math.max(drag.x0,e.clientX), y1=Math.min(drag.y0,e.clientY), y2=Math.max(drag.y0,e.clientY);
    if(x2-x1+y2-y1>6) drag.moved=true;
    Object.assign($('selRect').style, { display:'block', left:(x1-drag.r.left)+'px', top:(y1-drag.r.top)+'px', width:(x2-x1)+'px', height:(y2-y1)+'px' });
    msel.clear(); if(drag.add) drag.base.forEach(i=>msel.add(i));
    for(const el of state.els){
      const b=nodes.get(el.id)?.querySelector('.fx')?.getBoundingClientRect(); if(!b) continue;
      const cx=(b.left+b.right)/2, cy=(b.top+b.bottom)/2;
      if(cx>=x1 && cx<=x2 && cy>=y1 && cy<=y2) groupOf(el.id).forEach(i=>msel.add(i));
    }
    selectedId=[...msel].pop()||null;
    renderAll(); return;
  }
  const el=byId(drag.id); if(!el){ drag=null; return; }
  if(drag.mode==='move'){
    let x=drag.x0+(e.clientX-drag.mx)/drag.r.width*100;
    let y=drag.y0+(e.clientY-drag.my)/drag.r.height*100;
    const free=e.ctrlKey||e.metaKey, single=drag.items.length===1;
    let snapX=false, snapY=false;
    if(!free && gridOn){ x=Math.round(x/gridStep)*gridStep; y=Math.round(y/gridStep)*gridStep; }
    else if(!free && single){ snapX=Math.abs(x-50)<1.2; snapY=Math.abs(y-50)<1.8; if(snapX) x=50; if(snapY) y=50; }
    let dx=x-drag.x0, dy=y-drag.y0;
    if(!free && drag.bb){   // не даём рамке выделения выйти за кадр
      const b=drag.bb;
      if(b.r-b.l<100) dx=Math.min(Math.max(dx, -b.l), 100-b.r);
      if(b.b-b.t<100) dy=Math.min(Math.max(dy, -b.t), 100-b.b);
    }
    $('gv').classList.toggle('show', snapX); $('gh').classList.toggle('show', snapY);
    for(const it of drag.items){ const t=byId(it.id); if(t){ t.x=num(it.x0+dx,50,0,100); t.y=num(it.y0+dy,50,0,100); } }
  } else if(drag.mode==='stretch'){
    const p=drag.loc(e.clientX, e.clientY);
    if(drag.axis!=='y') el.w=num(drag.w0*Math.abs(p.u)/drag.u0, 25, 1, 200);
    if(drag.axis!=='x') el.hh=num(drag.hh0*Math.abs(p.v)/drag.v0, 10, 0.5, 300);
    else if(!el.hh) el.hh=num(drag.hh0, 10, 0.5, 300);   // высоту фиксируем, иначе картинка поедет пропорционально
  } else if(drag.mode==='box'){
    // смещение мыши в осях элемента; рамка растёт в обе стороны от центра
    const dx=e.clientX-drag.x0, dy=e.clientY-drag.y0;
    const du=dx*Math.cos(drag.a)+dy*Math.sin(drag.a), dv=-dx*Math.sin(drag.a)+dy*Math.cos(drag.a);
    if(drag.axis==='x') el.bw=num(drag.bw0 + 2*du/drag.sw*100, 10, 2, 100);
    else el.bh=num(drag.bh0 + 2*dv/drag.sh*100, 10, 2, 100);
  } else if(drag.mode==='size'){
    const k=Math.hypot(e.clientX-drag.cx, e.clientY-drag.cy)/drag.d0;
    if('fs' in el) el.fs=num(drag.fs0*k,8,0.5,100);
    else { el.w=num(drag.w0*k,25,1,200); if(drag.hh0) el.hh=num(drag.hh0*k,10,0.5,300); }
  } else {
    const a=angleOf(e,drag.cx,drag.cy); let d=a-drag.prev;
    if(d>180) d-=360; if(d<-180) d+=360;
    drag.acc+=d; drag.prev=a;
    let rot=drag.rot0+drag.acc; if(e.shiftKey) rot=Math.round(rot/15)*15;
    el.rot=rot;
  }
  changed();
});
function endDrag(){
  if(!drag) return;
  const d=drag; drag=null; $('gv').classList.remove('show'); $('gh').classList.remove('show');
  if(d.mode==='rect'){ $('selRect').style.display='none'; if(!d.moved && !d.add) select(null); else renderAll(); return; }
  commit();
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('dblclick', e=>{ if(e.target.closest('.el[data-type="text"]')){ I('iText').focus(); I('iText').select(); } });

let wheelT=null;
stage.addEventListener('wheel', e=>{
  const node=e.target.closest('.el');
  const el=node ? byId(node.dataset.id) : byId(selectedId);
  if(!el) return;
  e.preventDefault();
  selectedId=el.id;
  beginChange();
  const d=e.deltaY || e.deltaX;
  if(e.shiftKey || e.altKey) el.rot+=(d>0?1:-1)*(e.shiftKey && e.altKey ? 15 : 5);
  else scaleEl(el, d<0 ? 1.07 : 1/1.07);
  changed();
  clearTimeout(wheelT); wheelT=setTimeout(commit, 300);
}, { passive:false });

// перетаскивание файлов и картинок из других вкладок
function stagePoint(e){ const r=stage.getBoundingClientRect(); return { x:num((e.clientX-r.left)/r.width*100,50,0,100), y:num((e.clientY-r.top)/r.height*100,50,0,100) }; }
stage.addEventListener('dragover', e=>{ e.preventDefault(); stage.classList.add('dragover'); });
stage.addEventListener('dragleave', e=>{ if(!stage.contains(e.relatedTarget)) stage.classList.remove('dragover'); });
stage.addEventListener('drop', e=>{
  e.preventDefault(); stage.classList.remove('dragover');
  const dt=e.dataTransfer, p=stagePoint(e);
  let url=htmlMediaUrl(dt.getData('text/html'));   // из другой вкладки: берём оригинал (GIF останется анимированной)
  if(!url && dt.files?.length) return uploadFiles([...dt.files], p.x, p.y);
  if(!url){ const list=dt.getData('text/uri-list'); if(list) url=list.split('\n').find(l=>l && !l.startsWith('#'))?.trim(); }
  const plain=dt.getData('text/plain');
  if(!url && plain && safeUrl(plain)) url=plain;
  if(url) return addUrl(url, p.x, p.y);
  if(plain) addText(plain, p.x, p.y);
});

// ================== ЛЕВАЯ ПАНЕЛЬ ==================
$('addText').onclick=()=>{ addText($('newText').value); $('newText').value=''; };
$('newText').addEventListener('keydown', e=>{ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); $('addText').click(); } });
$('addUrl').onclick=()=>{ const u=$('newUrl').value.trim(); if(!safeUrl(u)) return toast('Нужна ссылка http(s)://…'); $('newUrl').value=''; addUrl(u); };
$('newUrl').addEventListener('keydown', e=>{ if(e.key==='Enter') $('addUrl').click(); });
$('pickFile').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{ uploadFiles([...e.target.files]); e.target.value=''; };
$('addCam').onclick=addCam;
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.add;
  if(a==='raffle') return addRaffle();
  if(a==='case') return addCase();
  if(a==='counter') addCounter(false); else if(a==='chatcounter') addCounter(true); else if(a==='poll') addPoll(); else if(a==='cs2') addCs2(); else addTimer(a);
});

$('pickSound').onclick=()=>$('soundFile').click();
$('soundFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  if(f.size>8*1048576) return toast('Звук больше 8 МБ, возьми покороче');
  try{ showUpload('Загрузка звука…', 0); $('soundUrl').value=await uploadBlob(f, f.name); toast('Звук загружен, жми 🔊'); }
  catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); }
  hideUpload();
};
$('playSound').onclick=()=>{ const src=safeSrc($('soundUrl').value.trim()); if(!src) return toast('Вставь ссылку на звук или выбери файл'); if(sendFx({ type:'sound', src, vol:Number($('soundVol').value) })) toast('🔊 Звук отправлен'); };
$('stopSounds').onclick=()=>{ if(sendFx({ type:'stopsounds' })) toast('⏹ Звуки остановлены'); };
$('confetti').onclick=()=>{ if(sendFx({ type:'confetti' })) toast('🎉'); };
$('shake').onclick=()=>{ if(sendFx({ type:'shake' })) toast('💥'); };
$('calibBtn').onclick=()=>{ if(sendFx({ type:'calib' })) toast('У стримера на 10 секунд появилась рамка по краям оверлея', 4000); };

$('clearAll').onclick=()=>{ if(!state.els.length) return; beginChange(); state.els=[]; selectedId=null; commit(); toast('Очищено. Ctrl+Z, чтобы вернуть'); };
$('globalEye').onclick=()=>{ beginChange(); state.visible=!state.visible; commit(); };
$('undoBtn').onclick=undo;

function widgetLink(){
  const base=WIDGET_BASE_URL || new URL('widget.html', location.href).href;
  const u=new URL(base); u.searchParams.set('room', room); u.searchParams.set('v', String(WIDGET_VER));
  const r=curRoom();
  u.hash=`k=${r.k}&p=${r.p}`;   // ключи после #: не уходят ни на сайт, ни на брокер
  return u.href;
}
function updateLink(){ $('link').value=widgetLink(); }
$('copyLink').onclick=async()=>{
  try{ await navigator.clipboard.writeText($('link').value); }
  catch{ $('link').select(); document.execCommand('copy'); }
  toast('Ссылка скопирована: стример вставляет её в программу Hudini Host', 3500);
};
$('link').onclick=()=>$('link').select();

// --- комнаты ---
function renderRooms(){
  const sel=$('roomSel'); sel.replaceChildren();
  for(const r of rooms){ const o=document.createElement('option'); o.value=r.code; o.textContent=`${r.name} · ${r.code.slice(0,6)}…`; sel.appendChild(o); }
  sel.value=room;
}
$('roomSel').onchange=e=>switchRoom(e.target.value);
$('roomNew').onclick=async()=>{
  const name=prompt('Название новой комнаты (например, ник стримера):', ''); if(name==null) return;
  const r=await makeRoom(name.trim()||'Комната '+(rooms.length+1));
  rooms.push(r); await switchRoom(r.code); saveRooms(); renderRooms();
  toast('Новая комната: скопируй ссылку и отдай стримеру для Hudini Host', 4000);
};
// Приглашение второго модератора: ссылка на пульт с ключами комнаты после #
function inviteLink(r){ const u=new URL(location.href); u.search=''; u.hash='invite='+b64u.enc(TE.encode(JSON.stringify(r))); return u.href; }
async function acceptInvite(text){
  let r=null;
  try{ const h=(text.includes('#') ? text.slice(text.indexOf('#')+1) : text).replace(/^invite=/,''); r=cleanRoom(JSON.parse(TD.decode(b64u.dec(h)))); }catch{}
  if(!r){ toast('Это не ссылка-приглашение модератора'); return false; }
  const ex=rooms.find(x=>x.code===r.code);
  if(ex) Object.assign(ex, r); else rooms.push(r);
  await switchRoom(r.code); saveRooms(); renderRooms();
  toast(`Комната «${r.name}» добавлена`); return true;
}
$('roomJoin').onclick=()=>{ const t=prompt('Вставь ссылку-приглашение от другого модератора:', ''); if(t) acceptInvite(t.trim()); };
$('roomInvite').onclick=async()=>{
  const r=curRoom();
  if(!confirm(`Ссылка-приглашение даёт ПОЛНОЕ управление экраном «${r.name}».\nОтправляй её только модератору, которому доверяешь, и только в личку.\n\nСкопировать?`)) return;
  try{ await navigator.clipboard.writeText(inviteLink(r)); toast('Приглашение скопировано'); }
  catch{ prompt('Скопируй ссылку:', inviteLink(r)); }
};
$('roomRename').onclick=()=>{
  const r=curRoom(); const name=prompt('Новое название:', r.name); if(!name) return;
  r.name=name.trim().slice(0,40); saveRooms(); renderRooms();
};
$('roomRekey').onclick=async()=>{
  const r=curRoom();
  if(!confirm(`Сменить ключи «${r.name}»?\n\nСтарая ссылка и все приглашения перестанут работать, а Hudini Host отключит всех модераторов со старыми ключами.\nСтример вставляет новую ссылку в программу, другим модераторам нужны новые приглашения.\nДелай так, если ссылка утекла или надо закрыть доступ человеку.`)) return;
  const fresh=await makeRoom(r.name); const keep=JSON.parse(JSON.stringify(state));
  if(client?.connected) sealedPublish(topics(room).state, { v:2, wv:WIDGET_VER, from:clientId, t:Date.now(), visible:true, els:[] }, { qos:1, retain:true }).catch(()=>{});
  rooms[rooms.indexOf(r)]=fresh; room=null; await switchRoom(fresh.code); saveRooms(); renderRooms();
  state=keep; commit();   // экран переезжает в новую комнату
  toast('Ключи сменены: отдай стримеру новую ссылку для Hudini Host', 5000);
};
$('roomDel').onclick=()=>{
  if(rooms.length<2) return toast('Это последняя комната, сначала создай другую');
  const r=curRoom();
  if(!confirm(`Убрать «${r.name}» из списка?\nКлючи пропадут из этого пульта. Сохрани бэкап, если комната ещё нужна.`)) return;
  rooms=rooms.filter(x=>x.code!==room); room=null; switchRoom(rooms[0].code).then(()=>{ saveRooms(); renderRooms(); });
};
// Бэкап: в нём закрытые ключи, поэтому он всегда зашифрован паролем
$('roomExport').onclick=async()=>{
  const pass=prompt('Придумай пароль для файла бэкапа (в нём ключи всех комнат):', vaultPass||''); if(!pass) return;
  const box=await lockJSON(pass, { rooms, library, anims:myAnims, scenes, scenarios:scnStore });
  const blob=new Blob([JSON.stringify({ overlayBackup:2, box })], { type:'application/json' });
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='overlay-backup.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  toast('Бэкап скачан. Без пароля его не открыть', 4000);
};
$('roomImport').onclick=()=>$('roomFile').click();
$('roomFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  let data; try{ data=JSON.parse(await f.text()); }catch{ return toast('Это не файл бэкапа оверлея'); }
  if(data.overlayBackup===2){
    const pass=prompt('Пароль от файла бэкапа:', ''); if(!pass) return;
    data=await unlockJSON(pass, data.box); if(!data) return toast('Неверный пароль');
  }
  let added=0, libAdded=0, animAdded=0;
  for(const raw of (data.rooms||[])){ const r=cleanRoom(raw); if(r && !rooms.some(x=>x.code===r.code)){ rooms.push(r); added++; } }
  for(const r of (data.overlayRooms||[])) if(validCode(r?.code) && !r.k){ rooms.push(await makeRoom(r.name)); added++; }   // старый бэкап без ключей
  for(const it of (data.library||[])){ const el=sanitizeEl({ ...it?.el, id:'x' }); if(el && validCode(it.room) && !library.some(l=>JSON.stringify(l.el)===JSON.stringify(it.el))){ library.push({ name:String(it.name||'Элемент').slice(0,60), room:it.room, el:it.el }); libAdded++; } }
  for(const a of (data.anims||[])){ const fr=sanitizeFrames(a?.f); if(fr.length && !myAnims.some(m=>m.name===a.name)){ myAnims.push({ name:String(a.name).slice(0,40), mode:KF_MODES.includes(a.mode)?a.mode:'loop', end:KF_ENDS.includes(a.end)?a.end:'stay', f:fr }); animAdded++; } }
  if(data.scenes && typeof data.scenes==='object') for(const [code, list] of Object.entries(data.scenes)) if(validCode(code) && Array.isArray(list)){ scenes[code]=[...(scenes[code]||[]), ...list.filter(x=>x && Array.isArray(x.els)).map(x=>({ name:String(x.name||'Сцена').slice(0,40), els:x.els }))]; }
  if(data.scenarios && typeof data.scenarios==='object') for(const [code, list] of Object.entries(data.scenarios)) if(validCode(code) && Array.isArray(list)){
    const have=new Set((scnStore[code]||[]).map(x=>x.id)); scnStore[code]=[...(scnStore[code]||[]), ...list.filter(x=>x && x.trig && Array.isArray(x.acts) && !have.has(x.id))]; }
  saveRooms(); saveLib(); saveAnims(); saveScenes(); saveScn(); renderRooms(); renderLib(); renderKfPresets(); renderScenes(); renderScn();
  toast(`Добавлено: комнат ${added}, элементов ${libAdded}, анимаций ${animAdded}`);
};

// --- пароль на пульт ---
function renderLockBtns(){ $('passBtn').textContent = vaultPass ? '🔒 Пароль ✓' : '🔓 Пароль'; $('lockBtn').hidden=!vaultPass; }
$('passBtn').onclick=async()=>{
  if(vaultPass){
    const old=prompt('Текущий пароль (чтобы изменить или снять):'); if(old==null) return;
    if(old!==vaultPass) return toast('Неверный пароль');
    const np=prompt('Новый пароль. Оставь пустым, чтобы снять пароль:', ''); if(np==null) return;
    if(np && np.length<6) return toast('Пароль хотя бы 6 символов');
    vaultPass=np||null;
  } else {
    const np=prompt('Пароль на пульт (хотя бы 6 символов). Без него никто с этого компьютера не откроет твои комнаты.\nЗапомни его: восстановить нельзя, только из бэкапа.', ''); if(!np) return;
    if(np.length<6) return toast('Пароль хотя бы 6 символов');
    if(prompt('Повтори пароль:', '')!==np) return toast('Пароли не совпали');
    vaultPass=np;
  }
  await saveRooms(); renderLockBtns(); toast(vaultPass ? 'Пароль установлен 🔒' : 'Пароль снят');
};
$('lockBtn').onclick=()=>{ location.reload(); };
function askUnlock(box){
  return new Promise(res=>{
    $('lock').hidden=false; $('lockPass').focus();
    const tryIt=async()=>{
      $('lockErr').textContent='Проверяю…';
      const data=await unlockJSON($('lockPass').value, box);
      if(!data){ $('lockErr').textContent='Неверный пароль'; $('lockPass').select(); return; }
      vaultPass=$('lockPass').value; $('lockPass').value=''; $('lock').hidden=true; res(data);
    };
    $('lockGo').onclick=tryIt;
    $('lockPass').onkeydown=e=>{ if(e.key==='Enter') tryIt(); };
    $('lockReset').onclick=()=>{
      if(!confirm('Стереть все комнаты в этом браузере? Вернуть их можно будет только из файла бэкапа.')) return;
      lsSet('overlay.vault2', null); location.reload();
    };
  });
}

// --- фон превью ---
function applyBg(v){
  const bg=$('bgLayer'); bg.replaceChildren(); bg.style.backgroundImage='';
  v=(v||'').trim(); lsSet('overlay.bg', v);
  if(!v) return;
  const u=safeUrl(v);
  if(u){ bg.style.backgroundImage=`url("${u.replace(/"/g,'%22')}")`; return; }
  const ch=v.replace(/^.*twitch\.tv\//,'').replace(/[^a-zA-Z0-9_]/g,'');
  if(!ch) return;
  if(!location.hostname){ toast('Twitch-превью работает, только когда пульт открыт с сайта'); return; }
  const f=document.createElement('iframe');
  f.src=`https://player.twitch.tv/?channel=${ch}&parent=${location.hostname}&muted=true&autoplay=true`;
  f.allow='autoplay'; bg.appendChild(f);
}
$('bgInput').value=lsGet('overlay.bg','')||'';
$('bgInput').addEventListener('change', e=>applyBg(e.target.value));
function setBgInteract(on){
  stage.classList.toggle('bg-interact', on);
  $('bgClick').classList.toggle('on', on);
  $('bgClick').textContent = on ? '✅ Готово, вернуться к элементам' : '🖱 Нажать в плеере';
  if(on){ select(null); toast('Плеер кликабельный: нажми «Start Watching», громкость и т.д.'); }
}
$('bgClick').onclick=()=>setBgInteract(!stage.classList.contains('bg-interact'));

// --- чат Twitch (только чтение, анонимно) ---
let chatWs=null;
const chatSeen=new Map();
const chatLog=[];
function parseTags(str){
  const o={}; if(!str) return o;
  for(const kv of str.split(';')){ const i=kv.indexOf('='); if(i<0) continue;
    o[kv.slice(0,i)]=kv.slice(i+1).replace(/\\s/g,' ').replace(/\\:/g,';').replace(/\\\\/g,'\\'); }
  return o;
}
function parseEmotes(tag){   // "25:0-4,12-16/1902:6-10" → [[id,from,to],…]
  const out=[]; if(!tag) return out;
  for(const part of tag.split('/')){ const [id, ranges]=part.split(':'); if(!id || !ranges) continue;
    for(const r of ranges.split(',')){ const [a,b]=r.split('-').map(Number); if(Number.isFinite(a)&&Number.isFinite(b)) out.push([id,a,b]); } }
  return out;
}
function badgeOf(b){ b=b||''; return /broadcaster\//.test(b)?'broadcaster':/moderator\//.test(b)?'mod':/vip\//.test(b)?'vip':/(subscriber|founder)\//.test(b)?'sub':''; }
const NAME_COLORS=['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#748ffc','#da77f2','#f783ac'];
function nameColor(login){ let h=0; for(const ch of login) h=(h*31+ch.charCodeAt(0))>>>0; return NAME_COLORS[h%NAME_COLORS.length]; }
function chatConnect(ch){
  chatDisconnect();
  ch=(ch||'').toLowerCase().replace(/^.*twitch\.tv\//,'').replace(/[^a-z0-9_]/g,'');
  if(!ch) return;
  lsSet('overlay.chat', ch); $('chatChan').value=ch;
  const ws=new WebSocket('wss://irc-ws.chat.twitch.tv:443'); chatWs=ws;
  setPill($('chatStatus'), 'warn', 'подключение…'); $('chatBtn').textContent='Отключить';
  ws.onopen=()=>{ ws.send('CAP REQ :twitch.tv/tags'); ws.send('PASS SCHMOOPIIE'); ws.send('NICK justinfan'+(10000+Math.random()*80000|0)); ws.send('JOIN #'+ch); };
  ws.onmessage=ev=>{
    for(const line of String(ev.data).split('\r\n')){
      if(!line) continue;
      if(line.startsWith('PING')){ ws.send('PONG'+line.slice(4)); continue; }
      if(/ 366 /.test(line)) setPill($('chatStatus'), 'ok', '#'+ch);
      const m=line.match(/^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #\w+ :(.*)$/);
      if(!m) continue;
      const tags=parseTags(m[1]), text=m[3].replace(/^\x01ACTION |\x01$/g,'');
      const badge=badgeOf(tags.badges);
      const msg={ id:tags.id||rid(8), login:m[2], user:tags['display-name']||m[2], color:/^#[0-9a-f]{6}$/i.test(tags.color||'')?tags.color:nameColor(m[2]),
        text, emotes:parseEmotes(tags.emotes), badge, mod:badge==='mod'||badge==='broadcaster', sub:tags.subscriber==='1'||badge==='sub', t:Date.now() };
      onChat(msg.login, msg.text, msg);
      addChatRow(msg);
    }
  };
  ws.onclose=()=>{ if(chatWs!==ws) return; setPill($('chatStatus'), 'bad', 'переподключение…'); setTimeout(()=>{ if(chatWs===ws) chatConnect(ch); }, 3000); };
}
// ---- лента чата в пульте ----
function chatRowNode(m){
  const row=document.createElement('div'); row.className='cm'; row.dataset.id=m.id; row.title='Клик — показать на стриме';
  const tm=document.createElement('span'); tm.className='tm'; tm.textContent=new Date(m.t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  row.appendChild(tm);
  if(m.badge){ const b=document.createElement('span'); b.className='b'; b.textContent=BADGE[m.badge]; row.appendChild(b); }
  const u=document.createElement('span'); u.className='u'; u.style.color=m.color; u.textContent=m.user; row.append(u, document.createTextNode(': '));
  const tmp=document.createElement('div'); paintMsg(tmp, { user:'', ucolor:'#000000', text:m.text, emotes:m.emotes, badge:'' });
  const txt=document.createElement('span'); txt.setAttribute('data-i18n-skip',''); txt.append(...tmp.querySelector('.m-text').childNodes);
  u.setAttribute('data-i18n-skip',''); row.append(txt);
  return row;
}
function chatMatches(m){ const f=$('chatFilter').value.trim().toLowerCase(); return !f || m.user.toLowerCase().includes(f) || m.text.toLowerCase().includes(f); }
function addChatRow(m){
  chatLog.push(m); if(chatLog.length>300) chatLog.shift();
  const feed=$('chatFeed');
  if(feed.firstElementChild?.classList.contains('hint')) feed.replaceChildren();
  if(!chatMatches(m)) return;
  const atBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<40;
  feed.appendChild(chatRowNode(m));
  while(feed.children.length>200) feed.firstChild.remove();
  if(atBottom) feed.scrollTop=feed.scrollHeight; else $('chatMore').hidden=false;
}
function rebuildFeed(){ const feed=$('chatFeed'); feed.replaceChildren(...chatLog.filter(chatMatches).slice(-200).map(chatRowNode)); feed.scrollTop=feed.scrollHeight; }
$('chatFilter').addEventListener('input', rebuildFeed);
$('chatClear').onclick=()=>{ chatLog.length=0; $('chatFeed').replaceChildren(); };
$('chatFeed').addEventListener('scroll', ()=>{ const f=$('chatFeed'); if(f.scrollHeight-f.scrollTop-f.clientHeight<40) $('chatMore').hidden=true; });
$('chatMore').onclick=()=>{ const f=$('chatFeed'); f.scrollTop=f.scrollHeight; $('chatMore').hidden=true; };
$('chatFeed').addEventListener('click', e=>{
  const row=e.target.closest('.cm'); if(!row) return;
  const m=chatLog.find(x=>x.id===row.dataset.id); if(!m) return;
  showChatMsg(m); row.classList.add('shown');
});
$('msgSecs').value=lsGet('overlay.msgSecs', 8); $('msgSecs').onchange=e=>lsSet('overlay.msgSecs', num(e.target.value,8,0,600));
$('msgReplace').checked=lsGet('overlay.msgReplace', true)!==false; $('msgReplace').onchange=e=>lsSet('overlay.msgReplace', e.target.checked);
// Показать сообщение на стриме. Вид и место берутся у прошлого сообщения: настроил один раз — дальше просто кликай.
function showChatMsg(m){
  const secs=num($('msgSecs').value,8,0,600);
  const data={ user:m.user, ucolor:m.color, text:m.text, emotes:m.emotes, badge:m.badge };
  const prev=[...state.els].reverse().find(e=>e.type==='msg');
  beginChange();
  let el;
  if(prev && $('msgReplace').checked){ el=prev; Object.assign(el, data); }
  else {
    const base = prev ? JSON.parse(JSON.stringify(prev)) : { type:'msg', x:22, y:80, fs:3, font:'montserrat', color:'#ffffff', card:'#15171d', accent:'#a78bfa', maxw:38, rot:0, op:1, anim:'none' };
    el=sanitizeEl({ ...base, ...data, id:rid(10), hidden:false }); if(prev){ el.y=num(prev.y-6,80,0,100); }
    state.els.push(el);
  }
  el.hidden=false;
  if(secs>0) el.ttl=Date.now()+secs*1000; else delete el.ttl;
  if(el.kf){ el.kf.playing=true; el.kf.start=Date.now(); }
  commit();
  toast(`💬 ${m.user}: ${m.text.slice(0,40)}`);
}
function chatDisconnect(){ const ws=chatWs; chatWs=null; ws?.close(); setPill($('chatStatus'), '', 'выкл'); $('chatBtn').textContent='Подключить'; }
$('chatBtn').onclick=()=>{ if(chatWs){ chatDisconnect(); lsSet('overlay.chat',''); } else chatConnect($('chatChan').value); };
$('chatChan').addEventListener('keydown', e=>{ if(e.key==='Enter') $('chatBtn').click(); });
const pollVotes=new Map();   // id голосования → (зритель → номер варианта)
// ---- розыгрыш: участники живут в пульте (и в localStorage, чтобы пережить перезагрузку вкладки) ----
const rafPool=new Map();     // id розыгрыша → Map(login → { user, color, sub })
const rafSkip=new Map();     // id → Set(login) не ответивших победителей
function rafEntries(id){
  if(!rafPool.has(id)){ const m=new Map(lsGet('hudini.raf.'+id, [])); rafPool.set(id, m); }
  return rafPool.get(id);
}
let rafSaveT=null;
function rafSave(id){ clearTimeout(rafSaveT); rafSaveT=setTimeout(()=>lsSet('hudini.raf.'+id, [...rafEntries(id)].slice(-20000)), 800); }
function rafWanted(el, text, msg){
  if(el.subs && !(msg?.sub || msg?.badge==='broadcaster')) return false;
  if(el.entry==='any') return true;
  const kw=el.kw.toLowerCase(), low=text.trim().toLowerCase();
  return low===kw || low.startsWith(kw+' ');
}
function rafOnChat(user, text, msg){
  let any=false;
  for(const el of state.els){
    if(el.type!=='raffle') continue;
    if(el.phase==='collect' && rafWanted(el, text, msg)){
      const m=rafEntries(el.id); if(m.has(user)) continue;
      m.set(user, { user:msg?.user||user, color:msg?.color||'#ffffff', sub:!!(msg?.sub || msg?.badge==='broadcaster') });
      el.n=m.size; rafSave(el.id); any=true;
    }
    // победитель отвечает в чат
    if(el.phase==='spin' && el.confirm && !el.ok && user===el.wlogin && nowMs() > el.spinAt+RAFFLE_OPEN+RAFFLE_SPIN && Date.now() < el.cUntil){
      el.ok=true; if(!el.winners.includes(el.winner)) el.winners.push(el.winner); any=true; toast(`✅ ${el.winner} на связи`);
    }
  }
  return any;
}
function rafPick(el){
  const skip=rafSkip.get(el.id)||new Set(), won=new Set(el.winners.map(w=>w.toLowerCase()));
  const pool=[...rafEntries(el.id)].filter(([login, e])=>!skip.has(login) && !won.has(e.user.toLowerCase()));
  if(!pool.length) return null;
  const weight=e=>el.subx2 && e.sub ? 2 : 1;
  const total=pool.reduce((a,[,e])=>a+weight(e),0);
  const r=new Uint32Array(1); crypto.getRandomValues(r);
  let x=r[0]/2**32*total;
  for(const p of pool){ x-=weight(p[1]); if(x<0) return { pool, win:p }; }
  return { pool, win:pool[pool.length-1] };
}
function rafSpin(el){
  const got=rafPick(el);
  if(!got){ toast(rafEntries(el.id).size ? 'Все участники уже выиграли или не ответили' : 'Участников пока нет'); return false; }
  const { pool, win } = got;
  const rar=()=>{ const x=Math.random(); return x<.6?0:x<.82?1:x<.92?2:x<.98?3:4; };
  el.reel=Array.from({ length:RAFFLE_REEL }, (_, i)=>{
    if(i===RAFFLE_WIN) return [win[1].user, Math.random()<.5?4:3];
    const p=pool[Math.random()*pool.length|0][1]; return [p.user, rar()];
  });
  el.phase='spin'; el.spinAt=Date.now()+400; el.jit=(Math.random()-0.5)*0.8;
  el.winner=win[1].user; el.wlogin=win[0]; el.ok=false;
  el.cUntil = el.confirm ? el.spinAt+RAFFLE_OPEN+RAFFLE_SPIN+700+el.confirm*1000 : 0;
  if(!el.confirm && !el.winners.includes(el.winner)) el.winners.push(el.winner);
  el.hidden=false;
  return true;
}
function rafTick(){
  let any=false; const now=Date.now();
  for(const el of state.els){
    if(el.type!=='raffle') continue;
    if(el.phase==='collect' && el.closeAt && now>=el.closeAt){ el.closeAt=0; el.phase='closed'; any=true; if(el.auto) rafSpin(el); }
    // победитель не ответил: крутим снова без него
    if(el.phase==='spin' && el.confirm && !el.ok && el.cUntil && now>=el.cUntil+1500){
      let sk=rafSkip.get(el.id); if(!sk){ sk=new Set(); rafSkip.set(el.id, sk); } sk.add(el.wlogin);
      toast(`⌛ ${el.winner} не ответил, перекручиваем`);
      if(!rafSpin(el)){ el.phase='closed'; el.cUntil=0; }
      any=true;
    }
  }
  if(any){ renderAll(); publishNow(1); }
}
function renderRaffle(el){
  setField(I('iRTitle'), el.title); setField(I('iRPrize'), el.prize); setField(I('iREntry'), el.entry); setField(I('iRKw'), el.kw);
  $('iRKw').hidden = el.entry!=='word';
  I('iRSubs').checked=el.subs; I('iRSubx2').checked=el.subx2; I('iRAuto').checked=el.auto;
  setField(I('iRConfirm'), String(el.confirm)); I('iRKey').checked=el.key; setField(I('iRKc'), el.kc); setField(I('iRKsim'), String(el.ksim));
  I('iRFxc').checked=el.fxc; I('iRTicks').checked=el.ticks; setField(I('iRAccent'), el.accent); setField(I('iRCard'), el.card);
  $('rPimgDel').hidden=!el.pimg; $('rSndDel').hidden=!el.snd; $('rVfxDel').hidden=!el.vfx; $('rKeyRow').hidden=!el.key;
  $('rSnd').textContent = el.snd ? '🔊 Звук выбран ✓' : '🔊 Свой звук'; $('rVfx').textContent = el.vfx ? '🎞 Видео выбрано ✓' : '🎞 Своё видео-эффект';
  $('rStart').disabled = el.phase==='collect'; $('rStop').disabled = el.phase!=='collect';
  $('rSpin').textContent = el.phase==='spin' ? '🎰 Ещё победитель' : '🎰 Крутить';
  const m=rafEntries(el.id);
  $('rInfo').textContent = `Участников: ${m.size}` + (el.winners.length ? ` · победители: ${el.winners.join(', ')}` : '') + (chatWs ? '' : ' · чат Twitch не подключён');
  const list=$('rList'); list.dataset.i18nSkip=''; list.textContent=[...m.values()].slice(-300).map(e=>(e.sub?'★ ':'')+e.user).join(', ') || '—';
}
// ---- кейс за донат ----
const CASE_SND=[['in','Подлёт и посадка'],['tense','Нарастание'],['lock','Защёлки'],['open','Открытие'],['tick','Щелчок ленты'],['win','Выпадение']];
function casePick(el){
  const pool=el.items.map((it,i)=>[i,it.p]).filter(([,p])=>p>0); if(!pool.length) return -1;
  const total=pool.reduce((a,[,p])=>a+p,0), r=new Uint32Array(1); crypto.getRandomValues(r);
  let x=r[0]/2**32*total; for(const [i,p] of pool){ x-=p; if(x<0) return i; } return pool[pool.length-1][0];
}
function caseOpen(el, donor, amount){
  if(!el.items.some(it=>it.p>0)) return toast('Добавь предметы с шансом больше 0'), false;
  const win=casePick(el), rnd=()=>{ const pool=el.items.map((it,i)=>[i,it.p]).filter(([,p])=>p>0); const tot=pool.reduce((a,[,p])=>a+p,0); let x=Math.random()*tot; for(const [i,p] of pool){ x-=p; if(x<0) return i; } return pool[0][0]; };
  const reel=Array.from({ length:CASE_REEL }, ()=> Math.random()<0.18 ? Math.random()*el.items.length|0 : rnd());
  reel[CASE_WIN]=win;
  // «почти-почти»: перед выигрышем стоит самый редкий предмет (если выпало не самое редкое) — лента притормозит на нём
  const rarest=el.items.reduce((b,it,i)=> it.r>el.items[b].r ? i : b, 0);
  reel[CASE_WIN-1] = el.items[win].r < el.items[rarest].r ? rarest : rnd();
  reel[CASE_WIN+1] = rnd();
  el.reel=reel; el.win=win; el.jit=(Math.random()-0.5)*0.6;
  el.donor=String(donor||'').slice(0,40); el.amount=String(amount||'').slice(0,24);
  el.openAt=Date.now()+500; el.hidden=false; el.ttl=el.openAt+CASE_T.reveal+el.hideAfter*1000;
  const h=lsGet('hudini.caseHist', []); h.unshift({ t:Date.now(), d:el.donor, n:el.items[win].n, r:el.items[win].r, c:el.name }); lsSet('hudini.caseHist', h.slice(0,100));
  return true;
}
function renderCase(el){
  setField(I('iKName'), el.name); setField(I('iKColor'), el.cc); setField(I('iKVol'), String(el.vol)); setField(I('iKHide'), String(el.hideAfter)); I('iKLow').checked=el.q==='low';
  $('kLogoDel').hidden=!el.logo;
  const sum=el.items.reduce((a,it)=>a+it.p,0);
  $('kSum').textContent=`· ${el.items.length} · шансы: ${+sum.toFixed(2)}%`; $('kSum').style.color = Math.abs(sum-100)<0.01 ? '' : 'var(--warn)';
  $('kFix').hidden = Math.abs(sum-100)<0.01 || !sum;
  const busy = el.openAt && nowMs() < el.openAt+CASE_T.reveal;
  $('kOpen').disabled=!!busy; $('kTest').disabled=!!busy;
  $('kInfo').textContent = busy ? 'Кейс открывается на стриме…' : Math.abs(sum-100)>=0.01 && sum ? 'Шансы в сумме не 100%: при открытии они считаются пропорционально.' : '';
  const box=$('kItems');
  if(document.activeElement?.closest('#kItems')) return;   // не перерисовывать, пока печатают
  box.replaceChildren(...el.items.map((it,i)=>{
    const r=document.createElement('div'); r.className='row kit'; r.dataset.i=i; r.style.borderLeft=`3px solid ${RARITY7[it.r]}`; r.style.paddingLeft='6px';
    const pic=document.createElement('button'); pic.className='kpic'; pic.title='Картинка предмета'; pic.dataset.act='img';
    if(it.img){ const im=document.createElement('img'); im.src=resolveSrc(it.img); im.style.cssText='width:26px;height:20px;object-fit:contain'; pic.appendChild(im); } else pic.textContent='🖼';
    const nm=document.createElement('input'); nm.type='text'; nm.className='grow'; nm.value=it.n; nm.placeholder='Предмет'; nm.dataset.f='n'; nm.style.minWidth='60px';
    const rr=document.createElement('select'); rr.dataset.f='r'; rr.style.width='84px'; RARITY_NAME.forEach((n,k)=>{ const o=new Option(n,k); o.style.color=RARITY7[k]; rr.appendChild(o); }); rr.value=String(it.r);
    const pp=document.createElement('input'); pp.type='number'; pp.min='0'; pp.max='100'; pp.step='0.1'; pp.value=String(it.p); pp.dataset.f='p'; pp.style.width='58px'; pp.title='Шанс, %';
    const del=document.createElement('button'); del.textContent='✕'; del.title='Убрать предмет'; del.dataset.act='del';
    r.append(pic, nm, rr, pp, del); return r;
  }));
  const sb=$('kSnd'); if(!sb.children.length) sb.append(...CASE_SND.map(([k,n])=>{ const r=document.createElement('div'); r.className='row'; r.dataset.k=k;
    const l=document.createElement('span'); l.className='hint grow'; l.textContent=n; const b=document.createElement('button'); b.dataset.act='snd'; const d=document.createElement('button'); d.dataset.act='sdel'; d.textContent='🗑'; d.title='Вернуть встроенный звук';
    r.append(l,b,d); return r; }));
  for(const r of sb.children){ const k=r.dataset.k; r.querySelector('[data-act=snd]').textContent = el.snd[k] ? '🔊 ✓' : '📁'; r.querySelector('[data-act=sdel]').hidden=!el.snd[k]; }
  const h=lsGet('hudini.caseHist', []); const hb=$('kHist'); hb.dataset.i18nSkip='';
  hb.textContent = h.length ? h.slice(0,30).map(x=>`${new Date(x.t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} ${x.d||'тест'} → ${x.n}`).join('\n') : '—'; hb.style.whiteSpace='pre-line';
}
let kFileFor=null;
function caseUpload(target, accept){ kFileFor=target; $('kFile').accept=accept||'image/*'; $('kFile').click(); }
async function caseSetFile(f, target){
  if(!f) return; const el=byId(selectedId); if(el?.type!=='case') return;
  try{ showUpload(`Загрузка ${f.name}…`, 0); const blob = f.type.startsWith('image/') ? await shrinkImage(f) : f; const src=await uploadBlob(blob, f.name);
    act(e=>{ if(target.kind==='logo') e.logo=src; else if(target.kind==='snd') e.snd[target.k]=src; else if(e.items[target.i]) e.items[target.i].img=src; }); }
  catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); }
  hideUpload();
}
$('kFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; caseSetFile(f, kFileFor); };
bindInput('iKName', (el,f)=>el.name=f.value.slice(0,40)||'HUDINI CASE');
bindInput('iKColor', (el,f)=>el.cc=f.value);
bindInput('iKVol', (el,f)=>el.vol=Number(f.value));
bindInput('iKHide', (el,f)=>el.hideAfter=num(f.value,12,3,120));
bindInput('iKLow', (el,f)=>el.q=f.checked?'low':'high', 'change');
$('kLogo').onclick=()=>caseUpload({ kind:'logo' }); $('kLogoDel').onclick=()=>act(el=>el.logo='');
$('kAdd').onclick=()=>act(el=>{ if(el.items.length<40) el.items.push({ n:sT('Предмет'), r:2, p:0, img:'' }); });
$('kFix').onclick=()=>act(el=>{ const s=el.items.reduce((a,it)=>a+it.p,0); if(s>0) el.items.forEach(it=>it.p=Math.round(it.p/s*10000)/100); });
$('kOpen').onclick=()=>{ const el=byId(selectedId); if(el?.type!=='case') return; if(!$('kDonor').value.trim()) return toast('Впиши ник донатера'); beginChange(); if(caseOpen(el, $('kDonor').value.trim(), $('kAmount').value.trim())){ commit(); $('kDonor').value=''; $('kAmount').value=''; } };
$('kTest').onclick=()=>{ const el=byId(selectedId); if(el?.type!=='case') return; beginChange(); if(caseOpen(el, '', '')) commit(); };
$('kItems').addEventListener('change', e=>{
  const row=e.target.closest('.kit'); if(!row) return; const i=+row.dataset.i, f=e.target.dataset.f; if(!f) return;
  act(el=>{ const it=el.items[i]; if(!it) return; if(f==='n') it.n=e.target.value.slice(0,40); else if(f==='r') it.r=Math.round(num(e.target.value,2,0,6)); else if(f==='p') it.p=num(e.target.value,0,0,100); });
  e.target.blur?.();
});
$('kItems').addEventListener('click', e=>{
  const b=e.target.closest('button'); const row=e.target.closest('.kit'); if(!b || !row) return; const i=+row.dataset.i;
  if(b.dataset.act==='del') act(el=>el.items.splice(i,1));
  if(b.dataset.act==='img') caseUpload({ kind:'item', i });
});
$('kItems').addEventListener('dragover', e=>{ if(e.target.closest('.kit')) e.preventDefault(); });
$('kItems').addEventListener('drop', e=>{ const row=e.target.closest('.kit'); const f=e.dataTransfer?.files?.[0]; if(!row || !f || !f.type.startsWith('image/')) return; e.preventDefault(); caseSetFile(f, { kind:'item', i:+row.dataset.i }); });
$('kSnd').addEventListener('click', e=>{ const b=e.target.closest('button'); const r=e.target.closest('[data-k]'); if(!b || !r) return; const k=r.dataset.k;
  if(b.dataset.act==='snd') caseUpload({ kind:'snd', k }, 'audio/*'); else if(b.dataset.act==='sdel') act(el=>{ delete el.snd[k]; }); });
let rafFileFor='';
function rafUpload(kind){
  rafFileFor=kind; const f=$('rFile');
  f.accept = kind==='snd' ? 'audio/*' : kind==='vfx' ? 'video/*' : 'image/*'; f.click();
}
// ---- команды в чате для доверенных: !опрос, !таймер ----
let cmdCfg=lsGet('overlay.cmd', null); if(!cmdCfg || typeof cmdCfg!=='object') cmdCfg={ mode:'mods', list:'' };
const CMD_MODES=['off','broadcaster','mods','modslist','list'];
function trusted(msg){
  if(!msg) return false;
  const m=CMD_MODES.includes(cmdCfg.mode) ? cmdCfg.mode : 'mods';
  const inList=String(cmdCfg.list||'').toLowerCase().split(/[\s,;]+/).filter(Boolean).includes(String(msg.login||'').toLowerCase());
  if(m==='off') return false;
  if(m==='broadcaster') return msg.badge==='broadcaster';
  if(m==='mods') return msg.badge==='broadcaster' || msg.badge==='mod';
  if(m==='modslist') return msg.badge==='broadcaster' || msg.badge==='mod' || inList;
  return inList;
}
// 90, 90с, 2м, 1:30 → мс; без единицы: секунды для голосования, минуты для таймера
function parseDur(a, unitMs){
  const t=String(a||'').toLowerCase().trim(); let m;
  if((m=t.match(/^(\d{1,3}):(\d{2})$/))) return (+m[1]*60 + +m[2])*1000;
  if((m=t.match(/^(\d{1,4})\s*(с|сек|s|sec)?$/)) && m[2]) return +m[1]*1000;
  if((m=t.match(/^(\d{1,4})\s*(м|мин|m|min)$/))) return +m[1]*60000;
  if((m=t.match(/^(\d{1,4})$/))) return +m[1]*unitMs;
  return null;
}
function chatCommand(text, msg){
  const m=text.trim().match(/^!(опрос|poll|голосование|таймер|timer|розыгрыш|giveaway)(?:\s+(.*))?$/i); if(!m || !trusted(msg)) return false;
  const cmd=m[1].toLowerCase(), arg=(m[2]||'').trim().toLowerCase();
  const STOP=/^(стоп|stop|конец|end)$/, START=/^(старт|start|go)?$/, RESET=/^(сброс|reset)$/;
  if(cmd==='розыгрыш' || cmd==='giveaway'){
    const el=state.els.find(e=>e.type==='raffle' && !e.hidden) || state.els.find(e=>e.type==='raffle'); if(!el) return true;
    if(STOP.test(arg)){ if(el.phase==='collect'){ el.phase='closed'; el.closeAt=0; } }
    else if(/^(крути|крутить|spin|roll)$/.test(arg)){ rafSpin(el); }
    else if(RESET.test(arg)){ rafReset(el); }
    else if(START.test(arg)){ el.phase='collect'; el.closeAt=0; el.hidden=false; }
    else { const d=parseDur(arg, 1000); if(d==null || d<10000 || d>7200000) return true; el.phase='collect'; el.closeAt=Date.now()+d; el.hidden=false; }
    renderAll(); publishNow(1); return true;
  }
  if(cmd==='опрос' || cmd==='poll' || cmd==='голосование'){
    const el=state.els.find(e=>e.type==='poll' && !e.hidden) || state.els.find(e=>e.type==='poll'); if(!el) return true;
    if(STOP.test(arg)){ el.running=false; el.closeAt=0; }
    else if(START.test(arg)){ el.running=true; el.closeAt=0; }
    else { const d=parseDur(arg, 1000); if(d==null || d<5000 || d>3600000) return true; el.running=true; el.closeAt=Date.now()+d; }
  } else {
    const el=state.els.find(e=>e.type==='timer' && e.mode==='countdown' && !e.hidden) || state.els.find(e=>e.type==='timer' && e.mode==='countdown'); if(!el) return true;
    const now=Date.now();
    if(STOP.test(arg)){ if(el.running){ el.left=Math.max(0, el.endAt-now); el.running=false; } }
    else if(RESET.test(arg)){ el.running=false; el.left=el.dur; }
    else if(START.test(arg)){ if(!el.running){ if(el.left<=0) el.left=el.dur; el.endAt=now+el.left; el.running=true; } }
    else { const d=parseDur(arg, 60000); if(d==null || d<1000 || d>86400000) return true; el.dur=d; el.left=d; el.endAt=now+d; el.running=true; el.hidden=false; }
  }
  renderAll(); publishNow(1);
  return true;
}
function renderCmd(){ $('cmdMode').value=CMD_MODES.includes(cmdCfg.mode)?cmdCfg.mode:'mods'; $('cmdList').value=cmdCfg.list||''; $('cmdListRow').hidden=!['modslist','list'].includes($('cmdMode').value); }
$('cmdMode').onchange=e=>{ cmdCfg.mode=e.target.value; lsSet('overlay.cmd', cmdCfg); renderCmd(); };
$('cmdList').onchange=e=>{ cmdCfg.list=e.target.value.slice(0,2000); lsSet('overlay.cmd', cmdCfg); };
renderCmd();
function onChat(user, text, msg){
  if(chatCommand(text, msg)) return;
  const rafAny=rafOnChat(user, text, msg);
  if(msg) fire('chat', { user:msg.user, msg:text, chatMsg:msg });
  const low=text.toLowerCase(), tokens=new Set(low.split(/\s+/));
  let any=false;
  const vm=text.trim().match(/^!?([1-6])$/);
  if(vm) for(const el of state.els){
    if(el.type!=='poll' || !el.running) continue;
    const i=+vm[1]-1; if(i>=el.opts.length) continue;
    let m=pollVotes.get(el.id); if(!m){ m=new Map(); pollVotes.set(el.id, m); }
    const prev=m.get(user); if(prev===i) continue;
    if(prev!=null) el.votes[prev]=Math.max(0, el.votes[prev]-1);
    el.votes[i]++; m.set(user, i); any=true;
  }
  for(const el of state.els){
    if(el.type!=='counter' || el.cmode!=='chat' || !el.running) continue;
    const kws=el.kw.toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
    if(!kws.some(k=> k==='*' || (k.includes(' ') ? low.includes(k) : tokens.has(k)))) continue;
    if(el.uniq){ let s=chatSeen.get(el.id); if(!s){ s=new Set(); chatSeen.set(el.id,s); } if(s.has(user)) continue; s.add(user); }
    el.value+=el.step; any=true;
  }
  if(any || rafAny){ renderAll(); scheduleSend(); }
}

// ================== СЛОИ ==================
function flashSecs(){ return num($('flashSecs').value, 5, 1, 600); }
function toggleHidden(el){ beginChange(); el.hidden=!el.hidden; delete el.ttl; commit(); }
function flash(el){ beginChange(); el.hidden=false; el.ttl=Date.now()+flashSecs()*1000; if(el.type==='video'||el.type==='web') el.restart=Date.now(); if(el.kf){ el.kf.playing=true; el.kf.start=Date.now(); } commit(); }
$('flashSecs').addEventListener('input', renderInspector);
$('layers').addEventListener('click', e=>{
  const row=e.target.closest('.layer'); if(!row) return;
  const el=byId(row.dataset.id); if(!el) return;
  const act=e.target.closest('button')?.dataset.act;
  if(act==='eye') toggleHidden(el);
  else if(act==='flash') flash(el);
  else if(act==='ttoggle') act1(el, timerToggle);
  else if(act==='kfplay') act1(el, kfToggle);
  else if(act==='ptoggle') act1(el, pollToggle);
  else if(act==='cplus') act1(el, e=>e.value+=e.step);
  else if(act==='cminus') act1(el, e=>e.value-=e.step);
  else select(el.id, e.shiftKey||e.ctrlKey||e.metaKey ? 'toggle' : 'replace');
});

// ================== ДЕЙСТВИЯ ==================
function act1(el, fn){ beginChange(); fn(el); commit(); }
function act(fn){ const el=byId(selectedId); if(el) act1(el, fn); }
function timerToggle(el){
  const now=Date.now();
  if(el.mode==='countdown'){
    if(el.running){ el.left=Math.max(0, el.endAt-now); el.running=false; }
    else { if(el.left<=0) el.left=el.dur; el.endAt=now+el.left; el.running=true; }
  } else if(el.mode==='stopwatch'){
    if(el.running){ el.acc+=Math.max(0, now-el.startAt); el.running=false; }
    else { el.startAt=now; el.running=true; }
  }
}
function timerReset(el){
  if(el.mode==='countdown'){ el.running=false; el.left=el.dur; }
  if(el.mode==='stopwatch'){ el.acc=0; el.startAt=Date.now(); }
}
function timerAdd(el, ms){
  if(el.mode!=='countdown') return;
  if(el.running) el.endAt=Math.max(Date.now(), el.endAt+ms); else el.left=Math.max(0, el.left+ms);
}
function pollToggle(el){
  el.running=!el.running;
  if(el.running && !chatWs) toast('Подключи чат Twitch слева, иначе голоса не придут', 4000);
}
function counterToggle(el){
  const now=Date.now();
  if(el.running){ el.value=counterValue(el, now); el.running=false; }
  else { el.startAt=now; el.running=true; }
}

// ================== ИНСПЕКТОР: привязки ==================
function bindInput(id, apply, evt='input'){
  const f=$(id);
  f.addEventListener(evt, ()=>{ const el=byId(selectedId); if(!el) return; beginChange(); apply(el, f); changed(); });
  f.addEventListener('change', ()=>{ if(byId(selectedId)) commit(); });
}
bindInput('iText',   (el,f)=>el.text=f.value.slice(0,500));
bindInput('iFont',   (el,f)=>{ if(f.value==='__add'){ f.value=el.font; $('fontInput').click(); return; } el.font=f.value; });
$('fontInput').onchange=e=>{ addFonts([...e.target.files]); e.target.value=''; };
$('fontDel').onclick=()=>{ const el=byId(selectedId); const m=/^u:(.+)$/.exec(el?.font||''); if(m && confirm('Убрать этот шрифт из списка у всех элементов?')) removeFont(m[1]); };
bindInput('iColor',  (el,f)=>el.color=f.value);
bindInput('iStroke', (el,f)=>el.stroke=f.value);
bindInput('iSw',     (el,f)=>el.sw=Number(f.value));
bindInput('iBg',     (el,f)=>el.bg=f.checked);
bindInput('iBgColor',(el,f)=>el.bgColor=f.value);
bindInput('iBgA',    (el,f)=>el.bgA=Number(f.value));
bindInput('iSize',   (el,f)=>{ if('fs' in el) el.fs=Number(f.value); else el.w=Number(f.value); });
bindInput('iRot',    (el,f)=>el.rot=Number(f.value));
bindInput('iHh',     (el,f)=>el.hh=Number(f.value));
bindInput('iOp',     (el,f)=>el.op=Number(f.value));
bindInput('iAnim',   (el,f)=>el.anim=f.value);
bindInput('iSound',  (el,f)=>el.sound=f.checked);
bindInput('iVol',    (el,f)=>el.vol=+f.value);
// таймеры / счётчики
bindInput('iLabel',  (el,f)=>el.label=f.value.slice(0,80));
bindInput('iStyle',  (el,f)=>el.style=f.value);
bindInput('iCard',   (el,f)=>el.card=f.value);
bindInput('iMode',   (el,f)=>{ el.mode=f.value; el.running=false;
  if(el.mode==='until' && !el.target) el.target=nextNewYear();
  if(el.mode==='countdown' && !el.dur){ el.dur=300000; el.left=300000; } });
function setDur(el){ const d=(num(I('iMin').value,0,0,9999)*60+num(I('iSec').value,0,0,59))*1000; el.dur=d; if(!el.running) el.left=d; }
bindInput('iMin', setDur); bindInput('iSec', setDur);
bindInput('iTarget', (el,f)=>{ const t=new Date(f.value).getTime(); if(Number.isFinite(t)) el.target=t; });
bindInput('iSecs',   (el,f)=>el.secs=f.checked);
bindInput('iTz',     (el,f)=>el.tz=validTz(f.value.trim()), 'change');
bindInput('iEndText',(el,f)=>el.endText=f.value.slice(0,40));
bindInput('iEndSound',(el,f)=>el.endSound=safeUrl(f.value)||'', 'change');
bindInput('iEndConfetti',(el,f)=>el.endConfetti=f.checked);
bindInput('iEndBlink',(el,f)=>el.endBlink=f.checked);
bindInput('iValue',  (el,f)=>{ const v=Math.round(num(f.value,0,-1e9,1e9)); if(el.cmode==='interval' && el.running){ el.startAt=Date.now(); } el.value=v; }, 'change');
bindInput('iStep',   (el,f)=>el.step=Math.round(num(f.value,1,1,1e6)));
bindInput('iGoal',   (el,f)=>el.goal=Math.round(num(f.value,0,0,1e9)));
bindInput('iCmode',  (el,f)=>{ if(el.cmode==='interval' && el.running) el.value=counterValue(el, Date.now());
  el.cmode=f.value; el.running = el.cmode==='chat'; el.startAt=Date.now();
  if(el.cmode==='chat' && !chatWs) toast('Подключи чат Twitch слева', 3000); });
bindInput('iKw',     (el,f)=>el.kw=f.value.slice(0,120));
bindInput('iUniq',   (el,f)=>{ el.uniq=f.checked; chatSeen.delete(el.id); });
bindInput('iEvery',  (el,f)=>{ if(el.running){ el.value=counterValue(el, Date.now()); el.startAt=Date.now(); } el.every=num(f.value,60,1,86400); });
// CS2
bindInput('iCsView',   (el,f)=>{ el.view=f.value;
  if(el.view==='teams' && el.fs>2.6) el.fs=2.4;            // панели команд крупные — сразу поменьше
  if(el.view==='scorebar'){ el.x=50; el.y=7; }
  if(el.view==='streak'){ el.x=50; el.y=32; if(el.fs<5) el.fs=5; }
  if(CS2_FULL.has(el.view)){ el.x=50; el.y=50; el.rot=0; el.fs=4; } });
// ---- HUD CS2: цвета, эффекты, команды, аватарки, выбор игроков ----
function csNames(){ return [...new Set([...(CS2?.players||[]).map(p=>p.name), CS2?.name].filter(Boolean))]; }
function fillSel(sel, val, first){
  const names=csNames(); if(val && !names.includes(val)) names.unshift(val);
  sel.replaceChildren(new Option(first, ''), ...names.map(n=>new Option(n, n))); sel.value=val||'';
}
function renderCsHud(el){
  const full=CS2_FULL.has(el.view);
  $('csFullBox').hidden=!full; $('csAvBox').hidden=!(full || el.view==='card');
  $('csPickRow').hidden=!['card','kda','hp','money','weapon'].includes(el.view);
  $('csCmpRow').hidden=el.view!=='compare';
  if(document.activeElement!==$('iCsPick')) fillSel($('iCsPick'), el.pick, 'Свой игрок / наблюдаемый');
  if(document.activeElement!==$('iCsPa')) fillSel($('iCsPa'), el.pa, 'Игрок 1');
  if(document.activeElement!==$('iCsPb')) fillSel($('iCsPb'), el.pb, 'Игрок 2');
  setField(I('iCsCt'), el.ctc); setField(I('iCsT'), el.tc); I('iCsGlow').checked=el.glow; setField(I('iCsFx'), el.fx); setField(I('iCsTheme'), el.theme); I('iCsFlip').checked=el.flip;
  setField(I('iCsTnCT'), el.tnCT); setField(I('iCsTnT'), el.tnT); setField(I('iCsSeries'), el.series);
  const list=$('csAvList'); list.replaceChildren();
  const names=[...new Set([...csNames().map(n=>n.toLowerCase()), ...Object.keys(el.av)])];
  for(const n of names){
    const r=document.createElement('div'); r.className='row';
    const nm=document.createElement('span'); nm.className='grow hint'; nm.textContent=(csNames().find(x=>x.toLowerCase()===n)||n)+(el.av[n]?' ✓':''); nm.dataset.i18nSkip='';
    const b=document.createElement('button'); b.textContent=el.av[n]?'🗑':'📁'; b.title=el.av[n]?'Убрать аватарку':'Выбрать картинку';
    b.onclick=()=>{ if(el.av[n]) setAvatar(n, null); else { $('csAvName').value=n; $('csAvFile').click(); } };
    r.append(nm, b); list.appendChild(r);
  }
}
function setAvatar(name, src){
  const key=String(name||'').trim().toLowerCase().slice(0,40); if(!key) return toast('Впиши ник игрока');
  beginChange();
  for(const x of state.els) if(x.type==='cs2'){ if(src) x.av[key]=src; else delete x.av[key]; }
  commit(); const el=byId(selectedId); if(el?.type==='cs2') renderCsHud(el);
}
let avTarget='';
$('csAvAdd').onclick=()=>{ avTarget=$('csAvName').value; if(!avTarget.trim()) return toast('Впиши ник игрока'); $('csAvFile').click(); };
$('csAvFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  const name=avTarget||$('csAvName').value; avTarget='';
  try{ showUpload('Загрузка аватарки…', 0); const src=await uploadBlob(await shrinkImage(f), f.name); setAvatar(name, src); $('csAvName').value=''; }
  catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); }
  hideUpload();
};
$('csAvUrl').onclick=()=>{ const n=$('csAvName').value; if(!n.trim()) return toast('Впиши ник игрока'); const u=safeUrl(prompt('Ссылка на картинку:', '')||''); if(u){ setAvatar(n, u); $('csAvName').value=''; } };
async function pickLogo(side){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return;
    try{ showUpload('Загрузка лого…', 0); const src=await uploadBlob(await shrinkImage(f), f.name); act(el=>{ el[side]=src; }); }
    catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); } hideUpload(); };
  inp.click();
}
$('csLgCT').onclick=()=>pickLogo('lgCT'); $('csLgT').onclick=()=>pickLogo('lgT');
bindInput('iCsPick', (el,f)=>el.pick=f.value, 'change');
bindInput('iCsPa', (el,f)=>el.pa=f.value, 'change');
bindInput('iCsPb', (el,f)=>el.pb=f.value, 'change');
bindInput('iCsCt', (el,f)=>el.ctc=f.value);
bindInput('iCsT', (el,f)=>el.tc=f.value);
bindInput('iCsGlow', (el,f)=>el.glow=f.checked, 'change');
bindInput('iCsFx', (el,f)=>el.fx=f.value, 'change');
bindInput('iCsTheme', (el,f)=>{ el.theme=f.value; if(el.theme==='ko' && el.font==='montserrat') el.font='russo'; }, 'change');   // к пиксельному стилю подходит рубленый шрифт
bindInput('iCsFlip', (el,f)=>el.flip=f.checked, 'change');
bindInput('iCsTnCT', (el,f)=>el.tnCT=f.value.slice(0,30));
bindInput('iCsTnT', (el,f)=>el.tnT=f.value.slice(0,30));
bindInput('iCsSeries', (el,f)=>el.series=f.value.slice(0,120));
bindInput('iCsSide',   (el,f)=>el.side=f.value);
bindInput('iMaxw',      (el,f)=>el.maxw=Number(f.value));
bindInput('iMsgAccent', (el,f)=>el.accent=f.value);
bindInput('iMsgCard',   (el,f)=>el.card=f.value);
bindInput('iCsMinK',   (el,f)=>el.minK=Number(f.value));
$('csTest').onclick=()=>{
  const ev={ n:3, name:'Пример', weapon:'weapon_ak47', hs:2 };
  sendFx({ type:'cs2test', ...ev });
  for(const el of state.els) if(el.type==='cs2' && el.view==='streak'){ const c=nodes.get(el.id)?.querySelector('.cs2'); if(c) cs2Popup(c, ev); }
};
bindInput('iCsLabel',  (el,f)=>el.label=f.value.slice(0,40));
bindInput('iCsAccent', (el,f)=>el.accent=f.value);
bindInput('iCsCard',   (el,f)=>el.card=f.value);
// голосование
bindInput('iPTitle', (el,f)=>el.title=f.value.slice(0,100));
bindInput('iPOpts',  (el,f)=>{ const o=f.value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,6); if(o.length<2) return;
  el.votes=o.map((t,i)=>el.opts[i]===t ? el.votes[i] : 0); el.opts=o; pollVotes.delete(el.id); }, 'change');
bindInput('iAccent', (el,f)=>el.accent=f.value);
bindInput('iPCard',  (el,f)=>el.card=f.value);
// web
bindInput('iUrl',    (el,f)=>{ const u=safeUrl(f.value); if(u){ el.url=u; nodes.get(el.id)?.remove(); nodes.delete(el.id); } }, 'change');
bindInput('iWebSound',(el,f)=>el.sound=f.checked);
bindInput('iWebVol', (el,f)=>el.vol=+f.value);
bindInput('iAr',     (el,f)=>el.ar=f.value);
bindInput('iShape',  (el,f)=>el.shape=f.value);
bindInput('iBc',     (el,f)=>el.bc=f.value);
bindInput('iBw',     (el,f)=>el.bw=Number(f.value));
bindInput('iZoom',   (el,f)=>el.zoom=Number(f.value));
I('iText').addEventListener('blur', ()=>{ if(changeOpen) commit(); });

$('bigEye').onclick=()=>{ const el=byId(selectedId); if(el) toggleHidden(el); };
$('flashBtn').onclick=()=>{ const el=byId(selectedId); if(el) flash(el); };
$('restartVideo').onclick=()=>act(el=>el.restart=Date.now());
$('restartWeb').onclick=()=>act(el=>{ el.restart=Date.now(); el.paused=false; });
$('plToggle').onclick=()=>act(el=>{ el.paused=!el.paused; });
function seekPlayer(d){
  const el=byId(selectedId); if(!el || el.type!=='web') return;
  if(!sendFx({ type:'seek', id:el.id, d })) return;
  const node=nodes.get(el.id); if(node) playerSeek(node, el, d);   // и превью в пульте
}
$('plBack').onclick=()=>seekPlayer(-10);
$('plFwd').onclick=()=>seekPlayer(10);
$('openCam').onclick=()=>{ const el=byId(selectedId); if(!el) return; const id=new URL(el.url).searchParams.get('view'); window.open(`https://vdo.ninja/?push=${id}&webcam&label=moderator`, '_blank'); };
$('tToggle').onclick=()=>act(timerToggle);
$('tReset').onclick=()=>act(timerReset);
document.querySelectorAll('[data-tadd]').forEach(b=>b.onclick=()=>act(el=>timerAdd(el, Number(b.dataset.tadd))));
$('tNY').onclick=()=>act(el=>{ el.target=nextNewYear(); if(!el.label) el.label=sT('До Нового года'); });
$('tHour').onclick=()=>act(el=>el.target=Date.now()+3600000);
$('cPlus').onclick=()=>act(el=>el.value+=el.step);
$('cMinus').onclick=()=>act(el=>el.value-=el.step);
$('cReset').onclick=()=>act(el=>{ el.value=0; el.startAt=Date.now(); chatSeen.delete(el.id); });
$('cToggle').onclick=()=>act(counterToggle);
$('pToggle').onclick=()=>act(el=>{ pollToggle(el); el.closeAt=0; });
$('pTimed').onclick=()=>act(el=>{ el.running=true; el.closeAt=Date.now()+num($('pSecs').value,60,5,3600)*1000; if(!chatWs) toast('Подключи чат Twitch слева, иначе голоса не придут', 4000); });
$('pReset').onclick=()=>act(el=>{ el.votes=el.opts.map(()=>0); pollVotes.delete(el.id); });
function rafReset(el){ el.phase='idle'; el.closeAt=0; el.n=0; el.reel=[]; el.winner=''; el.wlogin=''; el.winners=[]; el.ok=false; el.cUntil=0;
  rafPool.set(el.id, new Map()); rafSkip.delete(el.id); try{ localStorage.removeItem('hudini.raf.'+el.id); }catch{} }
bindInput('iRTitle', (el,f)=>el.title=f.value.slice(0,80));
bindInput('iRPrize', (el,f)=>el.prize=f.value.slice(0,120));
bindInput('iREntry', (el,f)=>el.entry=f.value, 'change');
bindInput('iRKw', (el,f)=>el.kw=f.value.slice(0,30));
bindInput('iRSubs', (el,f)=>el.subs=f.checked, 'change');
bindInput('iRSubx2', (el,f)=>el.subx2=f.checked, 'change');
bindInput('iRAuto', (el,f)=>el.auto=f.checked, 'change');
bindInput('iRConfirm', (el,f)=>el.confirm=Math.round(num(f.value,0,0,600)));
bindInput('iRKey', (el,f)=>el.key=f.checked, 'change');
bindInput('iRKc', (el,f)=>el.kc=f.value);
bindInput('iRKsim', (el,f)=>el.ksim=Number(f.value));
bindInput('iRFxc', (el,f)=>el.fxc=f.checked, 'change');
bindInput('iRTicks', (el,f)=>el.ticks=f.checked, 'change');
bindInput('iRAccent', (el,f)=>el.accent=f.value);
bindInput('iRCard', (el,f)=>el.card=f.value);
$('rStart').onclick=()=>act(el=>{ el.phase='collect'; el.hidden=false; el.closeAt=Date.now()+num($('rSecs').value,120,10,7200)*1000; if(!chatWs) toast('Подключи чат Twitch слева, иначе участники не придут', 4000); });
$('rStop').onclick=()=>act(el=>{ if(el.phase==='collect'){ el.phase='closed'; el.closeAt=0; } });
$('rSpin').onclick=()=>act(el=>{ if(el.phase==='collect'){ el.closeAt=0; } rafSpin(el); });
$('rReset').onclick=()=>{ const el=byId(selectedId); if(el && (!el.n || confirm('Начать новый розыгрыш? Участники и победители обнулятся.'))) act1(el, rafReset); };
$('rPimg').onclick=()=>rafUpload('pimg'); $('rSnd').onclick=()=>rafUpload('snd'); $('rVfx').onclick=()=>rafUpload('vfx');
$('rPimgDel').onclick=()=>act(el=>el.pimg=''); $('rSndDel').onclick=()=>act(el=>el.snd=''); $('rVfxDel').onclick=()=>act(el=>el.vfx='');
$('rFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return; const kind=rafFileFor;
  try{ showUpload(`Загрузка ${f.name}…`, 0); const blob = kind==='pimg' ? await shrinkImage(f) : f; const src=await uploadBlob(blob, f.name); act(el=>{ el[kind]=src; }); }
  catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); }
  hideUpload();
};
$('bCenter').onclick=()=>act(el=>{ el.x=50; el.y=50; });
$('bRot0').onclick=()=>act(el=>el.rot=0);
$('bRatio').onclick=()=>act(el=>el.hh=0);
function moveLayer(dir){ const i=state.els.findIndex(e=>e.id===selectedId), j=i+dir; if(i<0||j<0||j>=state.els.length) return; beginChange(); [state.els[i],state.els[j]]=[state.els[j],state.els[i]]; commit(); }
$('bUp').onclick=()=>moveLayer(1);
$('bDown').onclick=()=>moveLayer(-1);
function duplicate(){
  const list=selList(); if(!list.length) return; beginChange();
  const gmap=new Map(), ids=[];
  for(const el of list){ const c=JSON.parse(JSON.stringify(el)); c.id=rid(10); c.x=num(el.x+3,50,0,100); c.y=num(el.y+3,50,0,100); delete c.ttl;
    if(el.g){ if(!gmap.has(el.g)) gmap.set(el.g, rid(6)); c.g=gmap.get(el.g); } state.els.push(c); ids.push(c.id); }
  msel.clear(); ids.forEach(i=>msel.add(i)); selectedId=ids.at(-1); commit();
}
function remove(){ if(!msel.size) return; beginChange(); state.els=state.els.filter(e=>!msel.has(e.id)); msel.clear(); selectedId=null; commit(); }
function hideSel(){ const list=selList(); if(!list.length) return; const hide=list.some(x=>!x.hidden); beginChange(); list.forEach(x=>{ x.hidden=hide; delete x.ttl; }); commit(); }
function groupSel(){ const list=selList(); if(list.length<2) return toast('Выдели 2+ элемента (Shift+клик или рамкой)'); beginChange(); const g=rid(6); list.forEach(x=>x.g=g); commit(); toast('🔗 Сгруппировано: двигаются вместе'); }
function ungroupSel(){ const list=selList().filter(x=>x.g); if(!list.length) return; beginChange(); list.forEach(x=>delete x.g); commit(); toast('Группа разбита'); }
// ---- рамки элементов и выравнивание ----
function boxOf(id){
  const n=nodes.get(id), r=stage.getBoundingClientRect(); if(!n) return null;
  const b=n.querySelector('.fx').getBoundingClientRect();
  return { l:(b.left-r.left)/r.width*100, r:(b.right-r.left)/r.width*100, t:(b.top-r.top)/r.height*100, b:(b.bottom-r.top)/r.height*100 };
}
function selBounds(ids){
  const bs=ids.map(boxOf).filter(Boolean); if(!bs.length) return null;
  return { l:Math.min(...bs.map(b=>b.l)), r:Math.max(...bs.map(b=>b.r)), t:Math.min(...bs.map(b=>b.t)), b:Math.max(...bs.map(b=>b.b)) };
}
function units(){   // группа считается одним блоком
  const m=new Map();
  for(const el of selList()){ const k=el.g||el.id; if(!m.has(k)) m.set(k, []); m.get(k).push(el); }
  return [...m.values()].map(els=>({ els, box:selBounds(els.map(x=>x.id)) })).filter(u=>u.box);
}
function moveUnit(u, dx, dy){ for(const el of u.els){ el.x=num(el.x+dx,50,0,100); el.y=num(el.y+dy,50,0,100); } }
function alignSel(mode){
  const us=units(); if(!us.length) return toast('Сначала выдели элементы');
  const ref = us.length===1 ? { l:0, r:100, t:0, b:100 } : { l:Math.min(...us.map(u=>u.box.l)), r:Math.max(...us.map(u=>u.box.r)), t:Math.min(...us.map(u=>u.box.t)), b:Math.max(...us.map(u=>u.box.b)) };
  beginChange();
  for(const u of us){ const b=u.box; let dx=0, dy=0;
    if(mode==='l') dx=ref.l-b.l; if(mode==='r') dx=ref.r-b.r; if(mode==='ch') dx=(ref.l+ref.r)/2-(b.l+b.r)/2;
    if(mode==='t') dy=ref.t-b.t; if(mode==='b') dy=ref.b-b.b; if(mode==='cv') dy=(ref.t+ref.b)/2-(b.t+b.b)/2;
    moveUnit(u, dx, dy); }
  commit();
}
function distributeSel(axis){
  const us=units(); if(us.length<3) return toast('Для распределения нужно 3+ элемента');
  const c=u=>axis==='h' ? (u.box.l+u.box.r)/2 : (u.box.t+u.box.b)/2;
  us.sort((a,b)=>c(a)-c(b));
  const first=c(us[0]), step=(c(us.at(-1))-first)/(us.length-1);
  beginChange();
  us.forEach((u,i)=>{ const d=first+step*i-c(u); moveUnit(u, axis==='h'?d:0, axis==='v'?d:0); });
  commit();
}
// ---- панель инструментов и сетка ----
let gridOn=!!lsGet('overlay.grid', false), gridStep=num(lsGet('overlay.gridStep', 5),5,1,50);
function applyGrid(){ stage.classList.toggle('grid', gridOn); $('gridLayer').style.backgroundSize=`${gridStep}% ${gridStep}%`; $('gridOn').checked=gridOn; $('gridStep').value=String(gridStep); }
$('gridOn').onchange=e=>{ gridOn=e.target.checked; lsSet('overlay.grid', gridOn); applyGrid(); };
$('gridStep').onchange=e=>{ gridStep=num(e.target.value,5,1,50); lsSet('overlay.gridStep', gridStep); applyGrid(); };
applyGrid();
document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>alignSel(b.dataset.align));
document.querySelectorAll('[data-dist]').forEach(b=>b.onclick=()=>distributeSel(b.dataset.dist));
$('tGroup').onclick=groupSel; $('tUngroup').onclick=ungroupSel;
$('tEye').onclick=hideSel; $('tDup').onclick=duplicate; $('tDel').onclick=remove;
function renderToolbar(){
  const list=selList();
  $('toolbar').classList.toggle('none', !list.length);
  $('selInfo').textContent = !list.length ? 'Ничего не выбрано' : list.length===1 ? elIcon(list[0])+' '+elName(list[0]).slice(0,26) : `Выбрано: ${list.length}`;
  $('tGroup').disabled = list.length<2; $('tUngroup').disabled = !list.some(x=>x.g);
}
// ---- вкладки слева ----
function showTab(t){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===t));
  document.querySelectorAll('section[data-pane]').forEach(p=>p.hidden = p.dataset.pane!==t);
  lsSet('overlay.tab', t);
}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
showTab(lsGet('overlay.tab','add')||'add');
$('bDup').onclick=duplicate;
$('bDel').onclick=remove;

// ================== КЛАВИАТУРА / ВСТАВКА ==================
function typing(t){ return t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable); }
document.addEventListener('keydown', e=>{
  const ctrl=e.ctrlKey||e.metaKey;
  if(typing(e.target)) return;
  if(ctrl && e.code==='KeyZ'){ e.preventDefault(); undo(); return; }
  if(e.key==='Escape'){ setBgInteract(false); select(null); return; }
  if(/^Digit[1-9]$/.test(e.code) && !ctrl && !e.altKey){
    const t=[...state.els].reverse()[+e.code.slice(5)-1]; if(t){ e.preventDefault(); flash(t); toast(`⚡ ${elName(t).slice(0,30)}`); } return;
  }
  if(ctrl && e.code==='KeyA'){ e.preventDefault(); msel.clear(); state.els.forEach(x=>msel.add(x.id)); selectedId=state.els.at(-1)?.id||null; renderAll(); return; }
  if(ctrl && e.code==='KeyG'){ e.preventDefault(); if(e.shiftKey) ungroupSel(); else groupSel(); return; }
  const el=byId(selectedId); if(!el) return;
  if(ctrl && e.code==='KeyD'){ e.preventDefault(); duplicate(); return; }
  if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); remove(); return; }
  if(e.code==='KeyH' && !ctrl){ hideSel(); return; }
  if(e.code==='KeyF' && !ctrl){ selList().forEach(x=>flash(x)); return; }
  if(e.code==='KeyP' && !ctrl){ if(el.kf) act1(el, kfToggle); else toast('У элемента нет анимации движения'); return; }
  if(e.code==='Space' && el.type==='timer'){ e.preventDefault(); act1(el, timerToggle); return; }
  if(el.type==='counter' && (e.code==='Equal'||e.code==='NumpadAdd')){ e.preventDefault(); act1(el, x=>x.value+=x.step); return; }
  if(el.type==='counter' && (e.code==='Minus'||e.code==='NumpadSubtract')){ e.preventDefault(); act1(el, x=>x.value-=x.step); return; }
  const step=e.shiftKey?5:0.5;
  const mv={ ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] }[e.key];
  if(mv){ e.preventDefault(); beginChange(); for(const t of selList()){ t.x=num(t.x+mv[0],50,0,100); t.y=num(t.y+mv[1],50,0,100); } changed(); clearTimeout(wheelT); wheelT=setTimeout(commit,300); }
});
// Ссылка на оригинал из HTML (браузер при «Копировать изображение» кладёт в файл статичный PNG, а ссылку — на настоящую GIF)
function htmlMediaUrl(html){
  const m=(html||'').match(/<(?:img|video|source)[^>]+src=["']([^"']+)["']/i);
  return m ? safeUrl(m[1].replace(/&amp;/g,'&')) : null;
}
// ---- Ctrl+C / Ctrl+X / Ctrl+V для элементов ----
// В буфер уходит текст с меткой, поэтому можно вставить и в другую вкладку или комнату (файлы скопируются сами).
const CLIP_MARK='hudini-elements:';
let pasteSeq={ key:'', n:0 };
function copySel(e, cut){
  if(typing(e.target) || String(window.getSelection?.()||'')) return;
  const list=selList(); if(!list.length) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', CLIP_MARK+JSON.stringify({ v:1, room, els:list }));
  pasteSeq={ key:'', n:0 };
  if(cut){ remove(); toast(`✂ Вырезано: ${list.length}. Ctrl+V — вставить`); }
  else toast(`📋 Скопировано: ${list.length}. Ctrl+V — вставить`);
}
document.addEventListener('copy', e=>copySel(e, false));
document.addEventListener('cut', e=>copySel(e, true));
async function pasteEls(text){
  let data; try{ data=JSON.parse(text.slice(CLIP_MARK.length)); }catch{ return toast('В буфере повреждённые элементы'); }
  const src=(Array.isArray(data?.els) ? data.els : []).slice(0, 60);
  if(!src.length) return;
  const same=data.room===room;
  // каждая следующая вставка того же самого сдвигается, чтобы копии не легли друг на друга
  pasteSeq = pasteSeq.key===text ? { key:text, n:pasteSeq.n+1 } : { key:text, n:1 };
  const d = same ? 3*pasteSeq.n : 0;
  const els=[];
  for(const raw of src){
    const c=sanitizeEl(JSON.parse(JSON.stringify(raw))); if(!c) continue;
    if(!same){
      for(const k of ['src','endSound']){
        const aid=assetId(c[k]); if(!aid) continue;
        try{ showUpload('Копирую файл в эту комнату…', 0.3); c[k]=await uploadBlob(await getAssetBlob(data.room, aid), 'copy'); }
        catch(err){ hideUpload(); if(!err.shown) toast('Файл не скопировался: '+(err.message||err)); return; }
      }
      hideUpload();
    }
    els.push(c);
  }
  const free=MAX_ELS-state.els.length;
  if(free<=0) return toast('Слишком много элементов');
  if(els.length>free){ els.length=free; toast('Вставлены не все: на экране максимум '+MAX_ELS+' элементов'); }
  beginChange();
  const gmap=new Map(), ids=[];
  for(const c of els){
    c.id=rid(10); c.x=num(c.x+d,50,0,100); c.y=num(c.y+d,50,0,100); delete c.ttl;
    if(c.g){ if(!gmap.has(c.g)) gmap.set(c.g, rid(6)); c.g=gmap.get(c.g); }
    if(c.kf) c.kf.start=Date.now();
    state.els.push(c); ids.push(c.id);
  }
  msel.clear(); ids.forEach(i=>msel.add(i)); selectedId=ids.at(-1)||null; commit();
  toast(`📋 Вставлено: ${ids.length}`);
}
document.addEventListener('paste', e=>{
  if(typing(e.target)) return;
  const clipText=e.clipboardData?.getData('text/plain')||'';
  if(clipText.startsWith(CLIP_MARK)){ e.preventDefault(); pasteEls(clipText); return; }
  const orig=htmlMediaUrl(e.clipboardData?.getData('text/html'));
  if(orig){ e.preventDefault(); addUrl(orig); return; }
  const files=[...(e.clipboardData?.files||[])].filter(f=>/^(image|video)\//.test(f.type));
  if(files.length){ e.preventDefault(); uploadFiles(files); return; }
  const t=e.clipboardData?.getData('text/plain')?.trim(); if(!t) return;
  e.preventDefault();
  if(safeUrl(t)) addUrl(t); else addText(t);
});

// ================== ТИКИ ==================
setInterval(()=>{
  const now=nowMs();
  for(const el of state.els){ if(el.type==='timer'||el.type==='counter'||el.type==='cs2'||el.type==='poll'){ const n=nodes.get(el.id); if(n) tickNode(n, el, now); } }
  // голосование с автозакрытием: закрывает любой открытый пульт, результат одинаковый
  const due=state.els.filter(e=>e.type==='poll' && e.running && e.closeAt && Date.now()>=e.closeAt);
  if(due.length){ due.forEach(e=>{ e.running=false; e.closeAt=0; }); renderAll(); publishNow(1); }
  checkTwTriggers(now);
  rafTick();
}, 100);
setInterval(()=>{ // подписи в слоях и инспекторе (цифры таймеров)
  if(!state.els.some(e=>e.type==='timer'||e.type==='counter')) return;
  document.querySelectorAll('#layers .layer').forEach(row=>{ const el=byId(row.dataset.id); if(el && (el.type==='timer'||el.type==='counter')) row.querySelector('.name').textContent=elName(el); });
  const sel=byId(selectedId); if(sel?.type==='counter' && sel.cmode==='interval') setField(I('iValue'), String(counterValue(sel, nowMs())));
}, 500);
// «показать на N сек»
setInterval(()=>{
  const now=Date.now(); let any=false;
  for(const el of state.els) if(el.ttl && now>=el.ttl){ el.hidden=true; delete el.ttl; any=true; }
  if(any){ renderAll(); publishNow(1); }
}, 200);
// сверка часов с виджетом
setInterval(()=>sendFx({ type:'sync' }, true), 5000);


// ================== АНИМАЦИИ ДВИЖЕНИЯ ==================
let myAnims=lsGet('overlay.anims', []); if(!Array.isArray(myAnims)) myAnims=[];
function saveAnims(){ lsSet('overlay.anims', myAnims); }
const EASE_NAME={ linear:'ровно', inout:'плавно', in:'разгон', out:'торможение', back:'пружина', bounce:'отскок' };
function renderKfPresets(){
  const sel=$('kfPreset'), v=sel.value; sel.replaceChildren();
  const add=(val, txt)=>{ const o=document.createElement('option'); o.value=val; o.textContent=txt; sel.appendChild(o); };
  add('', '— готовые анимации —');
  for(const [k,name] of Object.entries(KF_PRESETS)) add('p:'+k, name);
  myAnims.forEach((a,i)=>add('u:'+i, '★ '+a.name));
  sel.value=[...sel.options].some(o=>o.value===v) ? v : '';
  $('kfDelSaved').hidden=!sel.value.startsWith('u:');
}
$('kfPreset').onchange=()=>{ $('kfDelSaved').hidden=!$('kfPreset').value.startsWith('u:'); };
function frameFrom(el){ return { x:el.x, y:el.y, r:el.rot, s:1, o:1, d:1000, e:'inout' }; }
function kfToggle(el){
  if(!el.kf) return;
  if(el.kf.playing){ el.kf.playing=false; }
  else { el.kf.playing=true; el.kf.start=Date.now(); el.hidden=false; delete el.ttl; }
}
function renderKf(el){
  const has=!!el.kf, list=$('kfList');
  $('kfOpts').hidden=!has;
  if(document.activeElement && list.contains(document.activeElement)) return;  // не мешаем вводу
  list.replaceChildren();
  if(!has) return;
  setField(I('kfMode'), el.kf.mode); setField(I('kfEnd'), el.kf.end);
  $('kfEnd').hidden = el.kf.mode!=='once';
  $('kfPlay').textContent = el.kf.playing ? '↻ Сначала (P)' : '▶ Проиграть (P)';
  const last = el.kf.mode==='loop' ? -1 : el.kf.f.length-1;
  el.kf.f.forEach((f,i)=>{
    const row=document.createElement('div'); row.className='kf'; row.dataset.i=i;
    const n=document.createElement('span'); n.className='n'; n.textContent=i+1; n.title='Поставить элемент в положение этого кадра';
    row.appendChild(n);
    if(i!==last){
      const d=document.createElement('input'); d.type='number'; d.min='0'; d.step='0.1'; d.value=+(f.d/1000).toFixed(2); d.dataset.k='d'; d.title='Секунд до следующего кадра';
      const e=document.createElement('select'); e.dataset.k='e';
      for(const [k,t] of Object.entries(EASE_NAME)){ const o=document.createElement('option'); o.value=k; o.textContent=t; e.appendChild(o); }
      e.value=f.e;
      row.append(d, document.createTextNode('с'), e);
    } else { const t=document.createElement('span'); t.className='hint'; t.textContent='последний'; t.style.flex='1'; row.appendChild(t); }
    const sc=document.createElement('input'); sc.type='number'; sc.min='0'; sc.step='10'; sc.value=Math.round(f.s*100); sc.dataset.k='s'; sc.title='Масштаб, %';
    const up=document.createElement('button'); up.textContent='📍'; up.dataset.a='set'; up.title='Записать сюда текущее положение элемента';
    const del=document.createElement('button'); del.textContent='✕'; del.dataset.a='del'; del.title='Удалить кадр';
    row.append(sc, document.createTextNode('%'), up, del);
    list.appendChild(row);
  });
}
$('kfList').addEventListener('change', e=>{
  const el=byId(selectedId), row=e.target.closest('.kf'); if(!el?.kf || !row) return;
  const f=el.kf.f[+row.dataset.i], k=e.target.dataset.k;
  beginChange();
  if(k==='d') f.d=num(e.target.value,1,0,600)*1000;
  if(k==='e') f.e=e.target.value;
  if(k==='s') f.s=num(e.target.value,100,0,2000)/100;
  e.target.blur(); commit();
});
$('kfList').addEventListener('click', e=>{
  const el=byId(selectedId), row=e.target.closest('.kf'); if(!el?.kf || !row) return;
  const i=+row.dataset.i, f=el.kf.f[i];
  if(e.target.classList.contains('n')){ act1(el, x=>{ x.kf.playing=false; x.x=num(f.x,50,0,100); x.y=num(f.y,50,0,100); x.rot=f.r; }); return; }
  const a=e.target.dataset.a;
  if(a==='set') act1(el, x=>Object.assign(x.kf.f[i], { x:x.x, y:x.y, r:x.rot }));
  if(a==='del') act1(el, x=>{ x.kf.f.splice(i,1); if(!x.kf.f.length) delete x.kf; });
});
$('kfAdd').onclick=()=>act(el=>{
  if(!el.kf) el.kf={ f:[], mode:'once', end:'stay', start:0, playing:false };
  el.kf.playing=false;
  if(el.kf.f.length>=40) return toast('Максимум 40 кадров');
  el.kf.f.push(frameFrom(el));
  toast(el.kf.f.length===1 ? 'Кадр 1 есть. Передвинь элемент и добавь следующий' : `Кадр ${el.kf.f.length} добавлен`);
});
$('kfClear').onclick=()=>act(el=>{ delete el.kf; });
$('kfApply').onclick=()=>{
  const v=$('kfPreset').value, el=byId(selectedId); if(!v || !el) return toast('Выбери анимацию в списке');
  let kf;
  if(v.startsWith('p:')) kf=kfPreset(v.slice(2), el);
  else { const a=myAnims[+v.slice(2)]; if(!a) return;
    kf={ mode:a.mode, end:a.end, f:a.f.map(f=>({ ...f, x:el.x+f.x, y:el.y+f.y, r:el.rot+f.r })) }; }
  act1(el, x=>{ x.kf=sanitizeKf({ ...kf, playing:true, start:Date.now() }); x.hidden=false; delete x.ttl; });
};
$('kfDelSaved').onclick=()=>{
  const v=$('kfPreset').value; if(!v.startsWith('u:')) return;
  const a=myAnims[+v.slice(2)]; if(!a || !confirm(`Удалить анимацию «${a.name}»?`)) return;
  myAnims.splice(+v.slice(2),1); saveAnims(); $('kfPreset').value=''; renderKfPresets();
};
$('kfMode').onchange=e=>act(el=>{ if(el.kf){ el.kf.mode=e.target.value; el.kf.start=Date.now(); } });
$('kfEnd').onchange=e=>act(el=>{ if(el.kf) el.kf.end=e.target.value; });
$('kfPlay').onclick=()=>act(el=>{ if(el.kf){ el.kf.playing=true; el.kf.start=Date.now(); el.hidden=false; delete el.ttl; } });
$('kfStop').onclick=()=>act(el=>{ if(el.kf) el.kf.playing=false; });
$('kfSave').onclick=()=>{
  const el=byId(selectedId); if(!el?.kf) return;
  const name=prompt('Название анимации:', 'Моя анимация '+(myAnims.length+1)); if(!name) return;
  myAnims.push({ name:name.trim().slice(0,40), mode:el.kf.mode, end:el.kf.end,
    f:el.kf.f.map(f=>({ ...f, x:f.x-el.x, y:f.y-el.y, r:f.r-el.rot })) });   // относительно элемента: подойдёт любому
  saveAnims(); renderKfPresets(); toast('Сохранено в «★ '+name+'»');
};
// Отрисовка анимаций 60 раз в секунду
function animLoop(){
  const now=Date.now();
  state.els.forEach((el,i)=>{
    const n=nodes.get(el.id); if(!n) return;
    if(drag && drag.id===el.id){ if(n._animOn){ n._animOn=false; n.classList.remove('animating'); paintNode(n, el, i+1); n.style.opacity=el.op; } return; }
    if(animApply(n, el, now)==='reset'){ paintNode(n, el, i+1); n.style.opacity=el.op; }
  });
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);
// Конец анимации «один раз»: исчезнуть / вернуться
setInterval(()=>{
  const now=Date.now(); let any=false;
  for(const el of state.els){
    const k=el.kf; if(!k?.playing || k.mode!=='once' || now-k.start < kfDuration(k)) continue;
    if(k.end==='hide'){ el.hidden=true; k.playing=false; any=true; }
    else if(k.end==='back'){ k.playing=false; any=true; }
  }
  if(any){ renderAll(); publishNow(1); }
}, 150);

// ================== БИБЛИОТЕКА ЭЛЕМЕНТОВ ==================
let library=lsGet('overlay.lib', []); if(!Array.isArray(library)) library=[];
function saveLib(){ lsSet('overlay.lib', library); }
function renderLib(){
  const box=$('libList'); box.replaceChildren();
  if(!library.length){ const d=document.createElement('div'); d.className='hint'; d.textContent='Пусто'; box.appendChild(d); return; }
  library.forEach((it,i)=>{
    const row=document.createElement('div'); row.className='lib'; row.dataset.i=i; row.title='Добавить на экран';
    const ico=document.createElement('span'); ico.textContent=elIcon(it.el)+(it.el.kf?'🎬':'');
    const name=document.createElement('span'); name.className='name'; name.textContent=it.name;
    const del=document.createElement('button'); del.textContent='✕'; del.dataset.a='del'; del.title='Удалить из библиотеки';
    row.append(ico, name, del); box.appendChild(row);
  });
}
$('bLib').onclick=()=>{
  const el=byId(selectedId); if(!el) return;
  const name=prompt('Название в библиотеке:', elName(el).slice(0,40)); if(!name) return;
  const copy=JSON.parse(JSON.stringify(el)); delete copy.ttl; delete copy.id;
  if(copy.kf && copy.kf.mode==='once') copy.kf.playing=false;
  library.push({ name:name.trim().slice(0,60), room, el:copy }); saveLib(); renderLib();
  toast('Сохранено в библиотеку 📚');
};
$('libList').addEventListener('click', async e=>{
  const row=e.target.closest('.lib'); if(!row) return;
  const it=library[+row.dataset.i]; if(!it) return;
  if(e.target.dataset.a==='del'){ if(confirm(`Удалить «${it.name}» из библиотеки?`)){ library.splice(+row.dataset.i,1); saveLib(); renderLib(); } return; }
  const el=JSON.parse(JSON.stringify(it.el)); delete el.hidden;
  const aid=assetId(el.src);
  if(aid && it.room!==room){
    try{ showUpload('Копирую файл в эту комнату…', 0.3); el.src=await uploadBlob(await getAssetBlob(it.room, aid), it.name); }
    catch(err){ hideUpload(); return err.shown ? undefined : toast('Файл не нашёлся: '+(err.message||err)); }
    hideUpload();
  }
  if(el.kf){ el.kf.start=Date.now(); if(el.kf.mode==='once') el.kf.playing=true; }
  addEl(el);
});
// Достать файл из другой комнаты (для библиотеки): из памяти пульта или из этой же программы стримера
async function getAssetBlob(fromRoom, id){
  const u=Assets.urls.get(id); if(u) return await (await fetch(u)).blob();
  const h=homeHttp(); if(!h) throw new Error('нет связи с Hudini Host');
  const src=rooms.find(r=>r.code===fromRoom); if(!src) throw new Error('комнаты, откуда этот файл, нет в списке');
  const r=await fetch(`${h.base}/files/${id}?room=${encodeURIComponent(fromRoom)}`, { headers:{ authorization:h.auth } });
  if(!r.ok) throw new Error(r.status===404 ? 'файл лежит у другого стримера: добавь его заново' : 'HTTP '+r.status);
  const f=await openAsset(await importRoomKeys(src), new Uint8Array(await r.arrayBuffer()), id);
  if(!f) throw new Error('файл повреждён');
  return f.blob;
}

// ================== СЦЕНАРИИ: «если … → то …» ==================
// Хранятся в этом браузере для каждой комнаты; выполняются, пока пульт открыт.
let scnStore=lsGet('overlay.scn', {}); if(!scnStore || typeof scnStore!=='object' || Array.isArray(scnStore)) scnStore={};
const scnList=()=> (scnStore[room] ||= []);
function saveScn(){ lsSet('overlay.scn', scnStore); }
const sleep=ms=>new Promise(r=>setTimeout(r, ms));
const TRIGS={ chat:'💬 Команда в чате', cs2:'🎯 Событие в CS2', timer:'⏱ Таймер закончился', counter:'🔢 Счётчик дошёл до цели', manual:'🖐 Только вручную (кнопка ▶)' };
const CS2EV={ kill:'Убийство (своё)', multikill:'Мульти-килл от N', ace:'ACE (5 за раунд)', death:'Смерть', mvp:'MVP раунда',
  round_win:'Раунд выигран', round_loss:'Раунд проигран', round_end:'Конец раунда', bomb_planted:'Бомба заложена', bomb_defused:'Бомба разминирована', bomb_exploded:'Бомба взорвалась' };
const ACTS={
  flash:{ n:'⚡ Показать на N сек', el:'any', secs:5 }, show:{ n:'👁 Показать', el:'any' }, hide:{ n:'🙈 Скрыть', el:'any' },
  toggle:{ n:'🔁 Показать / скрыть', el:'any' }, anim:{ n:'🎬 Проиграть анимацию', el:'any' },
  sound:{ n:'🔊 Звук', url:true }, confetti:{ n:'🎉 Конфетти' }, shake:{ n:'💥 Тряска' },
  scene:{ n:'🎞 Включить сцену', scene:true }, counter:{ n:'🔢 Счётчик +N', el:'counter', num:1 },
  text:{ n:'✏ Поменять текст', el:'text', tpl:true }, chatmsg:{ n:'💬 Показать это сообщение чата' },
  timer:{ n:'⏱ Запустить таймер заново', el:'timer' }, wait:{ n:'⏳ Подождать N сек', secs:2 },
};
function fillTpl(t, ctx){ return String(t).replace(/\{(user|args|msg|name|n)\}/g, (_,k)=>String(ctx[k]??'')); }
function flashFor(el, secs){ beginChange(); el.hidden=false; el.ttl=Date.now()+secs*1000; if(el.type==='video'||el.type==='web') el.restart=Date.now(); if(el.kf){ el.kf.playing=true; el.kf.start=Date.now(); } commit(); }
async function runAction(a, ctx){
  const el=a.el ? byId(a.el) : null;
  switch(a.t){
    case 'flash': if(el) flashFor(el, num(a.secs,5,0.5,600)); break;
    case 'show': if(el) act1(el, x=>{ x.hidden=false; delete x.ttl; if(x.kf){ x.kf.playing=true; x.kf.start=Date.now(); } if(x.type==='video'||x.type==='web') x.restart=Date.now(); }); break;
    case 'hide': if(el) act1(el, x=>{ x.hidden=true; delete x.ttl; }); break;
    case 'toggle': if(el) toggleHidden(el); break;
    case 'anim': if(el?.kf) act1(el, x=>{ x.kf.playing=true; x.kf.start=Date.now(); x.hidden=false; }); break;
    case 'sound': { const src=safeSrc(String(a.url||'').trim()); if(src) sendFx({ type:'sound', src, vol:num(a.vol,0.8,0,1) }, true); break; }
    case 'confetti': sendFx({ type:'confetti' }, true); break;
    case 'shake': sendFx({ type:'shake' }, true); break;
    case 'scene': { const sc=(scenes[room]||[]).find(x=>x.name===a.scene); if(sc) applyScene(sc, false); break; }
    case 'counter': if(el?.type==='counter') act1(el, x=>x.value+=Math.round(num(a.num,1,-1e6,1e6))); break;
    case 'text': if(el?.type==='text') act1(el, x=>x.text=fillTpl(a.tpl||'', ctx).slice(0,500)); break;
    case 'chatmsg': if(ctx.chatMsg) showChatMsg(ctx.chatMsg); break;
    case 'timer': if(el?.type==='timer') act1(el, x=>{ timerReset(x); timerToggle(x); }); break;
    case 'wait': await sleep(num(a.secs,1,0,600)*1000); break;
  }
}
async function runScenario(sc, ctx={}){
  const row=document.querySelector(`.scn[data-id="${sc.id}"]`); row?.classList.add('fired'); setTimeout(()=>row?.classList.remove('fired'), 900);
  for(const a of sc.acts||[]){ try{ await runAction(a, ctx); }catch(e){ console.warn(e); } }
}
function matchTrig(t, ctx){
  if(t.type==='chat'){
    const cmd=String(t.cmd||'').trim().toLowerCase(), m=String(ctx.msg||'').trim(), low=m.toLowerCase();
    if(!cmd || !(low===cmd || low.startsWith(cmd+' '))) return false;
    if(t.who==='mods' && !ctx.chatMsg?.mod) return false;
    if(t.who==='subs' && !(ctx.chatMsg?.sub || ctx.chatMsg?.mod)) return false;
    ctx.args=m.slice(cmd.length).trim(); return true;
  }
  if(t.type==='cs2'){
    const ev=ctx.ev; if(!ev) return false;
    switch(t.ev){
      case 'multikill': return ev.k==='multikill' && ev.n>=(t.n||2);
      case 'ace': return ev.k==='multikill' && ev.n>=5;
      case 'round_win': return ev.k==='round_end' && !!ev.my && ev.win===ev.my;
      case 'round_loss': return ev.k==='round_end' && !!ev.my && !!ev.win && ev.win!==ev.my;
      default: return ev.k===t.ev;
    }
  }
  if(t.type==='timer' || t.type==='counter') return !t.el || t.el===ctx.el;
  return false;
}
const scnLast=new Map();
function fire(kind, ctx){
  if(!$('scnRun').checked) return;
  for(const sc of scnList()){
    if(!sc.on || sc.trig?.type!==kind) continue;
    const c={ ...ctx };
    if(!matchTrig(sc.trig, c)) continue;
    const cd=num(sc.trig.cd,0,0,3600)*1000, last=scnLast.get(sc.id)||0;
    if(Date.now()-last<cd) continue;
    scnLast.set(sc.id, Date.now());
    runScenario(sc, c);
  }
}
$('scnRun').checked=lsGet('overlay.scnRun', true)!==false;
$('scnRun').onchange=e=>lsSet('overlay.scnRun', e.target.checked);
// События CS2 от программы стримера → сценарии
let lastEvSeq=null;
function processCs2Events(d){
  const evs=Array.isArray(d.evs)?d.evs:[]; const max=Math.max(0, ...evs.map(e=>e.s||0));
  if(lastEvSeq===null){ lastEvSeq=max; return; }          // при подключении старое не запускаем
  for(const ev of evs) if(ev.s>lastEvSeq){ fire('cs2', { ev, name:ev.name||'', n:ev.n||'' }); }
  lastEvSeq=Math.max(lastEvSeq, max);
}
// Таймеры и счётчики → сценарии (проверяем в общем тике)
const twPrev=new Map();
function checkTwTriggers(now){
  for(const el of state.els){
    if(el.type==='timer' && (el.mode==='countdown'||el.mode==='until')){
      const ended=twState(el, now).ended, was=twPrev.get(el.id);
      if(was===false && ended) fire('timer', { el:el.id, name:el.label||'' });
      twPrev.set(el.id, ended);
    } else if(el.type==='counter' && el.goal){
      const v=counterValue(el, now), was=twPrev.get(el.id);
      if(typeof was==='number' && was<el.goal && v>=el.goal) fire('counter', { el:el.id, n:v });
      twPrev.set(el.id, v);
    }
  }
}
// ---- список и редактор ----
function trigText(t){
  if(!t) return '';
  if(t.type==='chat') return `чат: ${t.cmd||'?'}${t.who==='mods'?' (модеры)':t.who==='subs'?' (сабы)':''}`;
  if(t.type==='cs2') return 'CS2: '+(CS2EV[t.ev]||'').replace(' от N', t.ev==='multikill'?' от '+(t.n||2):'');
  if(t.type==='timer') return 'таймер: '+(t.el ? elName(byId(t.el)||{type:'text',text:'(удалён)'}) : 'любой');
  if(t.type==='counter') return 'цель счётчика: '+(t.el ? elName(byId(t.el)||{type:'text',text:'(удалён)'}) : 'любого');
  return 'вручную';
}
function renderScn(){
  const box=$('scnList'); box.replaceChildren();
  const list=scnList();
  if(!list.length){ const d=document.createElement('div'); d.className='hint'; d.style.margin='8px 0'; d.textContent='Пока нет сценариев. Например: «!кринж» в чате → показать мем на 5 сек и звук; ACE в CS2 → конфетти.'; box.appendChild(d); return; }
  for(const sc of list){
    const row=document.createElement('div'); row.className='scn'+(sc.on?'':' off'); row.dataset.id=sc.id;
    const on=document.createElement('input'); on.type='checkbox'; on.checked=sc.on; on.dataset.a='on'; on.title='Включён';
    const nm=document.createElement('div'); nm.className='nm';
    const b=document.createElement('b'); b.textContent=sc.name||'Без названия';
    const sp=document.createElement('span'); sp.textContent=`${trigText(sc.trig)} → ${(sc.acts||[]).map(a=>ACTS[a.t]?.n.split(' ')[0]).join(' ')}`;
    nm.append(b, sp);
    const run=document.createElement('button'); run.textContent='▶'; run.dataset.a='run'; run.title='Запустить сейчас';
    const ed=document.createElement('button'); ed.textContent='✎'; ed.dataset.a='edit'; ed.title='Изменить';
    const del=document.createElement('button'); del.textContent='✕'; del.dataset.a='del'; del.title='Удалить';
    row.append(on, nm, run, ed, del); box.appendChild(row);
  }
}
$('scnList').addEventListener('click', e=>{
  const row=e.target.closest('.scn'); if(!row) return;
  const list=scnList(), sc=list.find(x=>x.id===row.dataset.id); if(!sc) return;
  const a=e.target.dataset.a;
  if(a==='on'){ sc.on=e.target.checked; saveScn(); renderScn(); }
  else if(a==='run') runScenario(sc, { user:'тест', msg:'', args:'', name:'тест', n:3 });
  else if(a==='edit') editScn(sc);
  else if(a==='del'){ if(confirm(`Удалить сценарий «${sc.name}»?`)){ list.splice(list.indexOf(sc),1); saveScn(); renderScn(); } }
});
$('scnNew').onclick=()=>editScn(null);
function opt(sel, v, t){ const o=document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o); return o; }
function elSelect(kind, value){
  const s=document.createElement('select');
  opt(s, '', kind==='trigger' ? '— любой —' : '— выбери элемент —');
  const ok=el=> kind==='any'||kind==='trigger'||kind==='trigger-timer'||kind==='trigger-counter' ? (kind==='trigger-timer'?el.type==='timer':kind==='trigger-counter'?el.type==='counter':true) : el.type===kind;
  for(const el of [...state.els].reverse()) if(ok(el)) opt(s, el.id, `${elIcon(el)} ${elName(el).slice(0,30)}`);
  if(value && !byId(value)) opt(s, value, '(элемент удалён)');
  s.value=value||''; return s;
}
function field(label, node){ const w=document.createElement('div'); const l=document.createElement('div'); l.className='lbl'; l.textContent=label; w.append(l, node); return w; }
function inp(type, value, ph){ const i=document.createElement('input'); i.type=type; i.value=value??''; if(ph) i.placeholder=ph; return i; }
function editScn(orig){
  const sc = orig ? JSON.parse(JSON.stringify(orig)) : { id:rid(8), name:'', on:true, trig:{ type:'chat', cmd:'!', who:'all', cd:10 }, acts:[{ t:'flash', el:'', secs:5 }] };
  const box=$('scnEdit'); box.hidden=false; box.replaceChildren();
  const name=inp('text', sc.name, 'Название, например: Кринж-мем');
  box.append(field('Название', name));
  const t1=document.createElement('div'); t1.className='t'; t1.textContent='Если…'; box.appendChild(t1);
  const ttype=document.createElement('select'); for(const [k,v] of Object.entries(TRIGS)) opt(ttype, k, v); ttype.value=sc.trig.type;
  const tbox=document.createElement('div');
  box.append(ttype, tbox);
  const tf={};
  function drawTrig(){
    tbox.replaceChildren(); const t=sc.trig; t.type=ttype.value;
    if(t.type==='chat'){
      tf.cmd=inp('text', t.cmd||'!', '!команда'); tf.who=document.createElement('select');
      opt(tf.who,'all','все зрители'); opt(tf.who,'subs','сабы и модеры'); opt(tf.who,'mods','только модеры'); tf.who.value=t.who||'all';
      tbox.append(field('Команда (сообщение начинается с неё)', tf.cmd), field('Кто может', tf.who));
    }
    if(t.type==='cs2'){
      tf.ev=document.createElement('select'); for(const [k,v] of Object.entries(CS2EV)) opt(tf.ev,k,v); tf.ev.value=t.ev||'multikill';
      tf.n=inp('number', t.n||3); tf.n.min=2; tf.n.max=5;
      const nWrap=field('Сколько убийств за раунд (от)', tf.n); nWrap.hidden=tf.ev.value!=='multikill';
      tf.ev.onchange=()=>nWrap.hidden=tf.ev.value!=='multikill';
      tbox.append(field('Событие', tf.ev), nWrap);
    }
    if(t.type==='timer'){ tf.el=elSelect('trigger-timer', t.el); tbox.append(field('Какой таймер', tf.el)); }
    if(t.type==='counter'){ tf.el=elSelect('trigger-counter', t.el); tbox.append(field('Какой счётчик (нужна цель в его настройках)', tf.el)); }
    if(t.type!=='manual'){ tf.cd=inp('number', t.cd??10); tf.cd.min=0; tbox.append(field('Перезарядка, сек (чтобы не спамили)', tf.cd)); }
  }
  ttype.onchange=drawTrig; drawTrig();
  const t2=document.createElement('div'); t2.className='t'; t2.textContent='…то сделать по порядку'; box.appendChild(t2);
  const alist=document.createElement('div'); box.appendChild(alist);
  function drawActs(){
    alist.replaceChildren();
    sc.acts.forEach((a,i)=>{
      const row=document.createElement('div'); row.className='act';
      const n=document.createElement('span'); n.className='n'; n.textContent=i+1;
      const ts=document.createElement('select'); for(const [k,v] of Object.entries(ACTS)) opt(ts,k,v.n); ts.value=a.t;
      ts.onchange=()=>{ sc.acts[i]={ t:ts.value }; drawActs(); };
      row.append(n, ts);
      const d=ACTS[a.t]||{};
      if(d.el){ const s=elSelect(d.el, a.el); s.onchange=()=>a.el=s.value; row.appendChild(s); }
      if(d.secs!=null){ const x=inp('number', a.secs??d.secs); x.step='0.5'; x.min='0'; x.title='секунд'; x.style.maxWidth='64px'; x.oninput=()=>a.secs=Number(x.value); row.appendChild(x); }
      if(d.num!=null){ const x=inp('number', a.num??d.num); x.title='на сколько (можно минус)'; x.style.maxWidth='64px'; x.oninput=()=>a.num=Number(x.value); row.appendChild(x); }
      if(d.url){ const x=inp('url', a.url, 'ссылка на звук'); x.oninput=()=>a.url=x.value; row.appendChild(x);
        const v=inp('range', a.vol??0.8); v.min=0; v.max=1; v.step=0.05; v.title='громкость'; v.oninput=()=>a.vol=Number(v.value); row.appendChild(v); }
      if(d.scene){ const s=document.createElement('select'); opt(s,'','— сцена —'); for(const x of (scenes[room]||[])) opt(s,x.name,x.name); s.value=a.scene||''; s.onchange=()=>a.scene=s.value; row.appendChild(s); }
      if(d.tpl){ const x=inp('text', a.tpl, 'текст: {user} {args} {name} {n}'); x.oninput=()=>a.tpl=x.value; x.style.flexBasis='100%'; row.appendChild(x); }
      const up=document.createElement('button'); up.textContent='↑'; up.title='Выше'; up.onclick=()=>{ if(i>0){ [sc.acts[i-1],sc.acts[i]]=[sc.acts[i],sc.acts[i-1]]; drawActs(); } };
      const rm=document.createElement('button'); rm.textContent='✕'; rm.title='Убрать'; rm.onclick=()=>{ sc.acts.splice(i,1); drawActs(); };
      row.append(up, rm); alist.appendChild(row);
    });
  }
  drawActs();
  const add=document.createElement('button'); add.textContent='＋ Действие'; add.style.width='100%'; add.onclick=()=>{ sc.acts.push({ t:'flash', el:'', secs:5 }); drawActs(); };
  const hint=document.createElement('div'); hint.className='hint'; hint.textContent='В тексте можно писать {user} (кто написал), {args} (что после команды), {name} (игрок CS2), {n}.';
  const bar=document.createElement('div'); bar.className='row';
  const save=document.createElement('button'); save.className='primary grow'; save.textContent='💾 Сохранить';
  const test=document.createElement('button'); test.textContent='▶ Тест';
  const cancel=document.createElement('button'); cancel.textContent='Отмена';
  bar.append(save, test, cancel);
  box.append(add, hint, bar);
  function collect(){
    sc.name=name.value.trim().slice(0,60) || TRIGS[ttype.value].replace(/^\S+ /,'');
    const t=sc.trig;
    if(t.type==='chat'){ t.cmd=tf.cmd.value.trim().slice(0,40); t.who=tf.who.value; }
    if(t.type==='cs2'){ t.ev=tf.ev.value; t.n=Math.round(num(tf.n.value,3,2,5)); }
    if(t.type==='timer'||t.type==='counter') t.el=tf.el.value;
    if(t.type!=='manual') t.cd=num(tf.cd.value,10,0,3600);
    for(const k of Object.keys(t)) if(!['type','cmd','who','ev','n','el','cd'].includes(k)) delete t[k];
    return sc;
  }
  save.onclick=()=>{
    const c=collect(); const list=scnList(), i=list.findIndex(x=>x.id===c.id);
    if(c.trig.type==='chat' && c.trig.cmd.length<2) return toast('Впиши команду, например !кринж');
    if(i>=0) list[i]=c; else list.push(c);
    saveScn(); renderScn(); box.hidden=true;
    if(c.trig.type==='chat' && !chatWs) toast('Не забудь подключить чат во вкладке 💬', 4000);
  };
  test.onclick=()=>runScenario(collect(), { user:'тест', msg:'', args:'аргументы', name:'тест', n:3 });
  cancel.onclick=()=>{ box.hidden=true; };
  box.scrollIntoView({ block:'nearest' });
}

// ================== СЦЕНЫ ==================
let scenes=lsGet('overlay.scenes', {}); if(!scenes || typeof scenes!=='object' || Array.isArray(scenes)) scenes={};
function saveScenes(){ lsSet('overlay.scenes', scenes); }
function renderScenes(){
  const box=$('sceneList'); box.replaceChildren();
  const list=scenes[room]||[];
  if(!list.length){ const d=document.createElement('div'); d.className='hint'; d.textContent='Пока нет сцен в этой комнате'; box.appendChild(d); return; }
  list.forEach((sc,i)=>{
    const row=document.createElement('div'); row.className='scene'; row.dataset.i=i; row.title='Клик: заменить экран · Shift+клик: добавить поверх';
    const name=document.createElement('span'); name.className='name'; name.textContent=`🎞 ${sc.name} (${sc.els.length})`;
    const up=document.createElement('button'); up.textContent='💾'; up.dataset.a='upd'; up.title='Перезаписать текущим экраном';
    const del=document.createElement('button'); del.textContent='✕'; del.dataset.a='del'; del.title='Удалить сцену';
    row.append(name, up, del); box.appendChild(row);
  });
}
function snapshotEls(){ return JSON.parse(JSON.stringify(state.els)).map(e=>{ delete e.ttl; return e; }); }
$('sceneSave').onclick=()=>{
  if(!state.els.length) return toast('Экран пустой');
  const name=prompt('Название сцены:', 'Сцена '+((scenes[room]||[]).length+1)); if(!name) return;
  (scenes[room]=scenes[room]||[]).push({ name:name.trim().slice(0,40), els:snapshotEls() }); saveScenes(); renderScenes();
  toast('Сцена сохранена');
};
$('sceneList').addEventListener('click', e=>{
  const row=e.target.closest('.scene'); if(!row) return;
  const list=scenes[room]||[], i=+row.dataset.i, sc=list[i]; if(!sc) return;
  const a=e.target.dataset.a;
  if(a==='del'){ if(confirm(`Удалить сцену «${sc.name}»?`)){ list.splice(i,1); saveScenes(); renderScenes(); } return; }
  if(a==='upd'){ if(confirm(`Перезаписать «${sc.name}» текущим экраном?`)){ sc.els=snapshotEls(); saveScenes(); renderScenes(); } return; }
  applyScene(sc, e.shiftKey);
  toast(`🎞 ${sc.name}${e.shiftKey?' (поверх)':''}`);
});
// id элементов сохраняем: так сценарии продолжают работать после смены сцены
function applyScene(sc, add){
  beginChange();
  const now=Date.now(), ids=new Set(add ? state.els.map(x=>x.id) : []);
  const els=JSON.parse(JSON.stringify(sc.els)).map(x=>{ if(!x.id || ids.has(x.id)) x.id=rid(10); ids.add(x.id); if(x.kf) x.kf.start=now; return sanitizeEl(x); }).filter(Boolean);
  state.els = add ? [...state.els, ...els].slice(0, MAX_ELS) : els;
  selectedId=null; commit();
}

// Раз в минуту переотправляем экран: так брокер всегда хранит свежую подписанную версию
setInterval(()=>{ if(client?.connected && !drag && KEYS) publishNow(1); }, 60000);

// ================== ОБНОВЛЕНИЯ ПУЛЬТА ==================
// Раз в 5 минут смотрим version.json на сайте; если вышла новая версия — предлагаем перезагрузить (экран при этом не теряется)
async function checkPanelUpdate(){
  if(!/^https?:$/.test(location.protocol)) return;
  try{
    const v=await (await fetch('version.json?t='+Date.now(), { cache:'no-store' })).json();
    if(Number(v.panel)>WIDGET_VER){ $('updBanner').hidden=false; $('updBanner').title=`Вышла версия ${v.panel}${v.notes?': '+v.notes:''}`; }
  }catch{}
}
$('updBanner').onclick=()=>{ if(!drag) location.reload(); };
setInterval(checkPanelUpdate, 5*60*1000); setTimeout(checkPanelUpdate, 15000);

// ================== СТАРТ ==================
async function boot(){
  if(!window.crypto?.subtle){ $('fatal').style.display='flex'; $('fatal').textContent='Пульт работает только по https:// (GitHub Pages) или с localhost: браузеру нужен модуль шифрования.'; return; }
  const v=lsGet('overlay.vault2', null);
  let data = v?.locked ? await askUnlock(v.locked) : (v?.plain || null);
  rooms=(data?.rooms||[]).map(cleanRoom).filter(Boolean);
  const migrated=await migrateOld();
  const inv=location.hash.startsWith('#invite=') ? location.hash.slice(1) : null;
  history.replaceState(null, '', location.pathname+keepQuery());
  if(!rooms.length && !inv) rooms.push(await makeRoom('Мой стример'));
  const cur=lsGet('overlay.current', null);
  if(rooms.length) await useRoom(rooms.some(r=>r.code===cur) ? cur : rooms[0].code);
  saveRooms();
  renderRooms(); renderKfPresets(); renderLib(); renderScenes(); renderScn(); renderLockBtns(); renderHostAdv(); renderSlang(); STREAM_LANG=streamLang();
  applyBg($('bgInput').value);
  setPill($('status'), 'warn', 'подключение…');
  connect();
  if(inv) await acceptInvite(inv);
  if(!rooms.length){ const r=await makeRoom('Мой стример'); rooms.push(r); await useRoom(r.code); saveRooms(); renderRooms(); }
  updateLink(); renderAll();
  { const ch=lsGet('overlay.chat',''); if(ch) chatConnect(ch); }
  window.hudiniReady=true;
  if(migrated) setTimeout(()=>alert('🔐 Защита обновлена.\n\nТеперь все команды на экран подписываются твоим ключом, а чужие отбрасываются. Старые ссылки для OBS больше не работают: нажми «📋 Копировать» и отправь стримеру НОВУЮ ссылку.'), 300);
}
// Пульт можно установить как приложение (PWA)
if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
// ================== МЕТКИ β / α ==================
// Стабильное в 1.0 без меток. Бета: работает, но мало проверено на разных ПК. Альфа: экспериментально.
const ISSUES='https://github.com/niko-ua-designer/hudini/issues';
const LEVELS={
  beta:{ mark:'β', name:'Бета', say:'Работает, но мало проверено на разных компьютерах. Если сбоит, напиши.' },
  alpha:{ mark:'α', name:'Альфа', say:'Экспериментально: может ломаться и измениться без предупреждения.' },
};
const FEATURES=[
  ['beta', 'Hudini Host', '#status'],
  ['beta', 'Чат Twitch', '[data-tab="chat"]'],
  ['beta', 'Сценарии', '[data-tab="auto"]'],
  ['beta', 'Счётчик чата', '[data-add="chatcounter"]'],
  ['beta', 'Голосование', '[data-add="poll"]'],
  ['beta', 'CS2', '[data-add="cs2"]'],
  ['beta', 'Вебка', '#addCam'],
  ['beta', 'Загрузка файлов', '#pickFile'],
  ['beta', 'YouTube, Twitch и сайты', '#addUrl'],
  ['beta', 'Группы, выравнивание и сетка', '#tGroup', '.tgrp'],
  ['alpha', 'Twitch: пауза и перемотка', '#plToggle', '.row'],
];
function levelPop(anchor, lvl, name){
  $('lvlPop')?.remove();
  const L=LEVELS[lvl], p=document.createElement('div'); p.id='lvlPop';
  const b=document.createElement('b'); b.textContent=`${L.mark} ${L.name}: ${name}`;
  const d=document.createElement('div'); d.textContent=L.say; d.style.margin='4px 0';
  const a=document.createElement('a'); a.href=ISSUES; a.target='_blank'; a.rel='noopener'; a.textContent='Сообщить о проблеме ↗';
  p.append(b, d, a); document.body.appendChild(p);
  const r=anchor.getBoundingClientRect();
  p.style.left=Math.min(innerWidth-280, Math.max(8, r.left))+'px';
  p.style.top=(r.bottom+6+p.offsetHeight>innerHeight ? r.top-p.offsetHeight-6 : r.bottom+6)+'px';
  setTimeout(()=>addEventListener('pointerdown', e=>{ if(!p.contains(e.target)) p.remove(); }, { once:true }), 0);
}
function markLevels(){
  for(const [lvl, name, sel, up] of FEATURES){
    let n=document.querySelector(sel); if(up) n=n?.closest(up); if(!n) continue;
    const b=document.createElement('span'); b.className='lvl '+lvl; b.textContent=LEVELS[lvl].mark; b.title=LEVELS[lvl].name;
    b.onclick=e=>{ e.stopPropagation(); e.preventDefault(); levelPop(b, lvl, name); };
    n.classList.add('lvl-host'); n.appendChild(b);
  }
  // режим наблюдателя CS2: метка прямо в списке видов
  for(const v of ['teams','scorebar','observed','hud_tour','table','duel','compare']){ const o=document.querySelector(`#iCsView option[value="${v}"]`); if(o) o.textContent='α '+o.textContent; }
}
markLevels();
boot();
