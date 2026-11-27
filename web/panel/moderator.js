// Hudini moderator panel. Loaded by moderator.html.
// Пульт работает только в своей вкладке: внутри чужой страницы его могли бы нажимать за модератора.
// Хранилище с ключами комнат в рамке не открываем.
if(window.top!==window.self){
  const box=document.createElement('div'), a=document.createElement('a');
  box.style.cssText='font:16px/1.5 system-ui,sans-serif;color:#e6e8ee;background:#0b0d11;padding:40px;text-align:center;min-height:100vh;box-sizing:border-box';
  box.textContent='Пульт Hudini открывается только в отдельной вкладке. ';
  a.href=location.origin+location.pathname; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Открыть пульт'; a.style.color='#a78bfa';
  box.appendChild(a); document.body.replaceChildren(box);
  throw new Error('Hudini: panel inside a frame');
}
// ================== НАСТРОЙКИ ==================
// Должны совпадать с widget.html
const TOPIC_PREFIX = 'stream-overlay/v1';
// Пусто = виджет лежит рядом с этим файлом (так и есть на GitHub Pages)
const WIDGET_BASE_URL = '';
const SEND_INTERVAL_MS = 50;           // как часто слать обновления при перетаскивании
const PART_BYTES = 8*1048576;           // файлы уходят в программу кусками по 8 МБ
const HOST_DL = 'https://github.com/niko-ua-designer/hudini/releases/latest';
// ===============================================

const $ = id => document.getElementById(id);
// time and date format follows the interface language, not the system locale
const uiLocale=()=>({ ru:'ru-RU', en:'en-GB', uk:'uk-UA', de:'de-DE' })[window.HudiniI18n?.lang]||'en-GB';
const stage=$('stage'), elLayer=$('elLayer'), wrap=$('wrap');

function rid(n){
  const abc='abcdefghijkmnpqrstuvwxyz23456789', b=crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, x=>abc[x%abc.length]).join('');
}
// подсказка «файт» от программы стримера: «3 SaiYeah ↔ 7 gospoja», номер = клавиша наблюдателя CS2. Живёт ttl мс (не больше 4 с)
function showFight(f){
  const bar=$('fightBar'); if(!bar || !f?.a || !f?.b) return;
  // ники игроков из настроек CS2-элемента (Host их не знает, поэтому в доке остаётся игровой ник)
  const nk=state.els.find(e=>e.type==='cs2' && e.nicks && Object.keys(e.nicks).length)?.nicks||{};
  const nick=p=>(p.id && Object.hasOwn(nk, p.id)) ? nk[p.id] : cs2Nick(p.name, taCfg().strip);
  const fill=(id, p)=>{ const s=$(id); s.className=p.team==='T'?'t':'ct'; s.replaceChildren(); if(p.slot!=null){ const n=document.createElement('em'); n.textContent=String(p.slot); s.appendChild(n); } s.append(String(nick(p)||'?').slice(0,40)); };
  fill('fightA', f.a); fill('fightB', f.b); bar.hidden=false;
  clearTimeout(showFight.t); showFight.t=setTimeout(()=>{ bar.hidden=true; }, Math.max(500, Math.min(4000, Number(f.ttl)||4000)));
}
function toast(t, ms=2400){ const el=$('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'), ms); }
function setPill(el, cls, text){ el.className='pill '+cls; el.textContent=text; }
// Данные пульта лежат в HudiniStore: в приложении это файл data/store.json на ПК, в тестах и браузере localStorage
function lsGet(k, d){ return HudiniStore.get(k, d); }
function lsSet(k, v){ HudiniStore.set(k, v); }
// хранилище сообщает о неудачной записи один раз
addEventListener('hudini-store-error', e=>toast(e.detail?.app ? 'Не удалось сохранить данные пульта на диск' : 'Не удалось сохранить: в браузере кончилось место', 8000));

const qs=new URLSearchParams(location.search);
// после перехода по ссылке оставляем в адресе только служебные параметры
function keepQuery(){ const q=new URLSearchParams(); for(const k of ['variant', 'streamer']) if(qs.has(k)) q.set(k, qs.get(k)); const t=q.toString(); return t ? '?'+t : ''; }
const clientId='mod_'+rid(10);
const topics = r => ({ base:`${TOPIC_PREFIX}/${r}`, state:`${TOPIC_PREFIX}/${r}/state`, fx:`${TOPIC_PREFIX}/${r}/fx` });
const validCode = c => typeof c==='string' && /^[a-z0-9_-]{4,64}$/i.test(c) && !['__proto__','constructor','prototype'].includes(c.toLowerCase());

// ================== КОМНАТЫ И КЛЮЧИ ==================
// У каждой комнаты: код (тема на брокере, не секрет), ключ шифрования k, открытый ключ p и закрытый ключ s.
// Закрытый ключ есть только у модераторов: без него на экран стримера ничего не отправить.
let rooms=[], room=null, KEYS=null, vaultPass=null;
// Ключи и пароль подключения сохранённых сессий приложения {id:{k,p,s,pass}}: при пароле лежат только в зашифрованном хранилище, в app.sessions их нет
let sessSecrets={};
const curRoom=()=>rooms.find(r=>r.code===room);
let saveChain=Promise.resolve();
function saveRooms(){
  lsSet('overlay.current', room);
  const data=vaultPass ? { rooms, sess:sessSecrets } : { rooms };
  saveChain=saveChain.then(async()=>lsSet('overlay.vault2', vaultPass ? { locked: await lockJSON(vaultPass, data) } : { plain:data })).catch(e=>console.warn(e));
  return saveChain;
}
// канал Twitch, привязанный к комнате: у каждой комнаты свой чат
function cleanChannel(ch){ return String(ch||'').toLowerCase().replace(/^.*twitch\.tv\//,'').replace(/[^a-z0-9_]/g,'').slice(0,40); }
function cleanRoom(r){
  return r && validCode(r.code) && typeof r.k==='string' && typeof r.p==='string' && r.s && typeof r.s==='object'
    ? { code:r.code, name:String(r.name||'Комната').slice(0,40), k:r.k, p:r.p, s:r.s, slang:STREAM_LANGS.includes(r.slang) ? r.slang : undefined, chat:cleanChannel(r.chat) || undefined,
        emx:r.emx && typeof r.emx==='object' ? cleanEmx(r.emx) : undefined } : null;
}
async function makeRoom(name){ return { code:rid(16), name:String(name||'Комната').slice(0,40), ...(await newRoomKeys()) }; }
// Ключи проверяем импортом: испорченная комната не становится текущей
async function roomKeys(code){ const r=rooms.find(x=>x.code===code); if(!r) throw new Error('нет такой комнаты'); return importRoomKeys(r); }
async function roomKeysOk(r){ try{ await importRoomKeys(r); return true; }catch{ return false; } }
async function useRoom(code){ const k=await roomKeys(code); room=code; KEYS=k; }

let state={ visible:true, hidAll:[], vol:1, fxVol:1, els:[], raffle:null };
let selectedId=null, drag=null;
const undoStack=[], redoStack=[]; let changeOpen=false, openChange=null;
// одновременные правки (раздел «ОДНОВРЕМЕННЫЕ ПРАВКИ»): netState: последний экран, отправленный или принятый этим пультом;
// sentSteps: что этот пульт менял в недавних отправках; seenBy: какие отправки пультов уже входят в текущий экран (msg.vv)
let netState=JSON.parse(JSON.stringify(state)), sentSteps=[], seenBy={};
function byId(id){ return state.els.find(e=>e.id===id); }

// ================== СВЯЗЬ ==================
// pendingOffline: комната, в которой экран меняли без связи. После подключения сначала ждём сохранённый экран (offlineWait),
// чтобы не затереть то, что другой модератор сделал, пока нас не было.
let client=null, pendingOffline=null, offlineWait=null;
let syncedIds=new Set();   // id элементов экрана, который пульт последним видел или отправил
const OFFLINE_WAIT_MS=1500;
function cancelOfflineWait(){
  if(!offlineWait) return;
  clearTimeout(offlineWait.timer); pendingOffline=offlineWait.room; offlineWait=null;
}
// Виджеты (OBS), которые сейчас подключены к комнате
const WIDGET_VER = 24, widgets=new Map();
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
  setPill(pill, err||old||bad ? 'warn' : 'ok', `OBS: виден · ${list.length>1?list.length+' шт, ':''}${h.w}×${h.h}${bad?' ⚠ не 16:9':''}${err?' ⚠ ошибка':''}${old?' ⚠ старая версия':''}`);
  pill.title = (bad ? `⚠ Источник «Браузер» ${bad.w}×${bad.h}, а нужно 16:9. Всё на стриме будет сплюснуто.\nOBS → свойства источника → Ширина 1920, Высота 1080 → ОК, потом выдели источник и Ctrl+F.\n` : '') +
    (err ? 'Ошибка в виджете: '+err+'\n' : '') + (old ? 'У стримера старая версия виджета: свойства источника → «Обновить кэш текущей страницы».\n' : '') +
    `Окно источника ${h.w}×${h.h}, элементов на экране: ${h.n}.` + (!bad && h.w<1280 ? '\nОкно меньше 1280×720: текст на стриме может быть мыльным, лучше 1920×1080.' : '');
  // предупреждаем один раз за сеанс, чтобы модератор сразу сказал стримеру
  if(bad && !renderObs.warned){ renderObs.warned=true; toast(`⚠ У стримера источник ${bad.w}×${bad.h}, а нужно 1920×1080: оверлей будет сплюснут`, 7000); }
}
setInterval(renderObs, 3000);
// Подключение. Пульт говорит только с программой стримера (Hudini Host) и больше ни с кем:
// - в приложении: ретранслятор открывает порт на 127.0.0.1, сам ходит к серверу по TLS и сверяет отпечаток сертификата из кода;
//   пульт подключается к этому порту как к обычному брокеру (команды relay_open / relay_close, событие relay_status);
// - в тестах: openHome({ url, pass }) прямо на адрес сервера.
// Экран, файлы и CS2 идут только через программу. Без неё пульт работает: всё уйдёт стримеру при подключении.
let homeInfo=null, homeClient=null, hostNote='';
// pausedRoom: комната, где стример поставил модераторов на паузу; пульт пробует вернуться, пока не пустят
let pausedRoom=null, retryT=null;
const PAUSE_NOTE='⏸ Стример поставил управление на паузу', RETRY_MS=20000;
const TAURI=window.__TAURI__;
let session=null, relayInfo=null, relayPort=0;   // сохранённая сессия приложения и последнее состояние ретранслятора
// Секрет возобновления: только в памяти этой вкладки, уходит только программе стримера в адресе подключения (внутри TLS).
// По нему она узнаёт тот же пульт, сменивший сеть, и сразу отдаёт ему его clientId. В пароле и логине ему не место:
// программа старой версии сверяет их точно, а лишнее в адресе пропускает.
const RESUME=rid(32);
function mqttClient(url, suffix, opts={}){
  return mqtt.connect(url, { clientId:clientId+suffix, clean:true, keepalive:30, reconnectPeriod:2000,
    connectTimeout:8000, resubscribe:false, queueQoSZero:false, ...opts });
}
let keepSent=null, keepOld=false;   // какой список файлов уже у программы; keepOld: до следующего подключения она списков не принимает (reportKeep)
const mainTopics = () => [topics(room).state, topics(room).base+'/hb', topics(room).base+'/cs2', topics(room).base+'/cs2fight', topics(room).base+'/host', topics(room).base+'/ink', topics(room).base+'/perms', topics(room).base+'/cs2series', topics(room).base+'/cur', topics(room).base+'/rtc', topics(room).base+'/media'];
let hostCtl=null;   // кнопки стримера в доке OBS: { hidden, paused }
// Адрес для файлов: тот же сервер, только http(s) и с паролем в заголовке
function homeHttp(){
  if(!homeInfo || !client?.connected) return null;
  return { base:homeInfo.url.replace(/^ws/, 'http').replace(/\/mqtt$/, ''), auth:'Bearer '+homeInfo.pass };
}
// Один источник правды для индикатора связи: состояние ретранслятора + состояние MQTT
function netName(n){ const r=(window.HudiniSessions?.NET_NAMES||{})[n] || n || ''; return window.HudiniI18n ? window.HudiniI18n.t(r) : r; }
const NET_FAIL={ tailscale:'включи Tailscale у себя и у стримера', radmin:'включи Radmin VPN у себя и у стримера, вы должны быть в одной сети', hamachi:'включи Hamachi у себя и у стримера',
  zerotier:'включи ZeroTier у себя и у стримера', lan:'работает только в одной локальной сети со стримером', inet:'порт стримера должен быть открыт из интернета',
  porthole:'проверь, что в Porthole открыт порт модераторов', ext:'проверь проброс порта на роутере стримера' };
// Модель индикатора: { cls, text, title, bars (0..4), strip: { head, why } | null }
function statusModel(){
  const R=relayInfo, T=t=>window.HudiniI18n ? window.HudiniI18n.t(t) : t;
  if(client?.connected){
    const rtt=R?.rtt_ms, cls=rtt>=200 ? 'bad' : rtt>=80 ? 'warn' : 'ok', bars=rtt==null ? 4 : rtt<40 ? 4 : rtt<80 ? 3 : rtt<200 ? 2 : 1;
    return { cls, bars, text:R?.net ? netName(R.net)+(rtt!=null ? ` · ${rtt} ms` : '') : 'онлайн · Hudini Host',
      title:'Подключено к программе стримера'+(R?.addr ? ': '+R.addr : ''), strip:null };
  }
  // пауза стримера важнее «нет связи» и «переподключение»
  if(pausedRoom===room) return { cls:'warn', bars:0, text:PAUSE_NOTE, title:'Экран стримера меняется только через программу Hudini Host.', strip:{ head:PAUSE_NOTE, why:'' } };
  if(R?.state==='badcert') return { cls:'bad', bars:0, text:'отпечаток не совпал: код устарел', title:'', strip:{ head:'отпечаток не совпал: код устарел',
    why:'Сертификат сервера стримера не совпал с отпечатком из твоего кода. Попроси стримера прислать новый код и вставь его на экране сессий.' } };
  if(R?.state==='offline'){
    // what to check for every address of the code: which network failed and what it needs
    const tried=(session?.addrs||[]).map(a=>`• ${netName(a.net)} (${a.h}:${a.port}): ${T(NET_FAIL[a.net]||'проверь, что стример в той же сети')}`);
    return { cls:'bad', bars:0, text:'сервер не отвечает', title:'', strip:{ head:'сервер не отвечает', multiline:true,
      why:T('Hudini Host не отвечает ни по одному адресу из кода. Проверь, что у тебя и у стримера включён один и тот же VPN (Tailscale, Radmin, Porthole), а программа запущена.')
        +(tried.length ? '\n'+T('Что не сработало:')+'\n'+tried.join('\n') : '') } };
  }
  if(!homeClient && hostNote){
    const bad=/пароль|Не удалось/.test(hostNote);
    return { cls:bad ? 'bad' : 'warn', bars:0, text:hostNote, title:'Экран стримера меняется только через программу Hudini Host.', strip:bad ? { head:hostNote, why:'' } : null };
  }
  if(R?.state==='connecting' || relayPort && !homeClient) return { cls:'warn', bars:1, text:'подключаюсь к адресам из кода…', title:'Пробую адреса из кода стримера: '+(session?.addrs?.length||1), strip:null };
  if(homeClient) return { cls:'warn', bars:1, text:'подключаюсь к Hudini Host…', title:'', strip:null };
  // без программы пульт работает: всё уйдёт стримеру при подключении, поэтому это ожидание, а не ошибка
  return { cls:'warn', bars:0, text:'⏳ Ждём Hudini Host', title:'Экран стримера меняется только через программу Hudini Host на его компьютере.\nНажми, чтобы узнать, как её запустить. Пока программы нет, можно готовить экран: всё уйдёт при подключении.', strip:null };
}
// Таблетка «палочки сигнала + сеть + задержка» и полоса с пояснением под шапкой
function setStatus(cls, text, bars=0, title=''){
  window.HudiniSounds?.link(!!client?.connected);
  const el=$('status'); setPill(el, 'sig '+cls, text); el.title=title; el.dataset.bars=String(bars);
  const b=document.createElement('span'); b.className='bars'; for(let i=1;i<=4;i++){ const x=document.createElement('i'); if(i<=bars) x.className='on'; b.appendChild(x); }
  el.prepend(b);
}
function hostStatus(){
  const m=statusModel();
  setStatus(m.cls, m.text, m.bars, m.title);
  const strip=$('connStrip'); strip.hidden=!m.strip; strip.className=m.cls;
  if(m.strip){ $('csHead').textContent=m.strip.head; $('csWhy').textContent=m.strip.why; $('csWhy').style.whiteSpace=m.strip.multiline ? 'pre-line' : ''; $('csSess').hidden=!TAURI; $('csRetry').hidden=!session; }
  if(!$('connPop').hidden) renderConnPop();
}
// Подробности по клику на таблетку
function renderConnPop(){
  const R=relayInfo, T=t=>window.HudiniI18n ? window.HudiniI18n.t(t) : t, pop=$('connPop'), m=statusModel();
  const rows=[['Адрес', R?.addr||(homeInfo?.url||'—')], ['Сеть', R?.net ? netName(R.net) : '—'], ['Задержка', R?.rtt_ms!=null ? R.rtt_ms+' ms' : '—'],
    ['Подключён с', R?.state==='online' && R.since ? new Date(R.since).toLocaleTimeString(uiLocale(), { hour:'2-digit', minute:'2-digit' }) : '—'],
    ['Переподключений', String(R?.reconnects||0)], ['Последняя ошибка', R?.last_error || 'ошибок нет']];
  const h=document.createElement('h4'); h.textContent=m.text; const dl=document.createElement('dl');
  for(const [k,v] of rows){ const dt=document.createElement('dt'), dd=document.createElement('dd'); dt.textContent=k; dd.textContent=v; dl.append(dt, dd); }
  const kids=[h, dl];
  if(m.strip?.why){ const w=document.createElement('div'); w.className='why'; w.textContent=m.strip.why; kids.push(w); }
  pop.replaceChildren(...kids);
}
function toggleConnPop(force){
  const pop=$('connPop'), open=force ?? pop.hidden;
  pop.hidden=!open; if(!open) return;
  renderConnPop();
  const r=$('status').getBoundingClientRect(); pop.style.left=Math.max(8, Math.min(innerWidth-pop.offsetWidth-8, r.left))+'px'; pop.style.top=(r.bottom+6)+'px';
  const away=e=>{ if(pop.contains(e.target) || $('status').contains(e.target)) return; pop.hidden=true; removeEventListener('pointerdown', away, true); };
  setTimeout(()=>addEventListener('pointerdown', away, true), 0);
}
$('csRetry').onclick=()=>{ hostNote=''; relayInfo=null; dropHome(); reopenHome(); };
// the streamer's answer to our request to show something is heard as well
async function answerSound(buf){
  const m=await unsealJSON(KEYS, buf, false);
  if(m && m.cid===client?.options?.clientId && (m.ev==='ok' || m.ev==='no')) window.HudiniSounds?.event(m.ev==='ok' ? 'ok' : 'error');
}
function useMain(c){
  if(client && client!==c && client.connected) client.unsubscribe(mainTopics());
  client=c; cancelOfflineWait(); keepSent=null; keepOld=false;
  if(!c?.connected){ hostStatus(); return; }
  hostStatus();
  c.subscribe(mainTopics(), { qos:1 });
  // изменения, сделанные без связи: сначала смотрим сохранённый экран комнаты, потом отправляем (см. onMessage)
  if(pendingOffline===room){
    const w={ room, seen:stateSeenT.get(room)||0 };
    w.timer=setTimeout(()=>{ if(offlineWait!==w) return; offlineWait=null;
      if(client?.connected && room===w.room) publishNow(1); else pendingOffline=w.room; }, OFFLINE_WAIT_MS);
    offlineWait=w;
  }
  pendingOffline=null;
  Assets.retry(); renderAll(); refreshStorage(true);
}
function wire(c){
  c.on('reconnect', ()=>{ if(client===c) setStatus('warn', 'переподключение…', 1); });
  c.on('offline',   ()=>{ if(client===c){ if(relayInfo?.state==='badcert' || relayInfo?.state==='offline') hostStatus(); else setStatus('bad', 'нет связи с Hudini Host'); } });
  c.on('error', e=>{ console.warn(e); if(client===c) setStatus('bad', 'ошибка связи'); });
  let chain=Promise.resolve();   // по очереди: расшифровка асинхронная, порядок важен
  c.on('message', (topic, payload, packet)=>{
    if(client!==c) return;
    chain=chain.then(()=>onMessage(topic, payload, packet)).catch(e=>console.warn(e));
  });
}
function connect(){
  if(typeof mqtt==='undefined'){
    $('fatal').style.display='flex';
    $('fatal').textContent='Не загрузилась библиотека mqtt.js. Переустанови Hudini или обнови страницу.';
    return;
  }
  hostStatus();
  reopenHome();
}
// Ретранслятор приложения: порт на 127.0.0.1 и состояние связи в событиях relay_status
async function openRelay(){
  try{
    if(TAURI.event && !openRelay.listening){
      openRelay.listening=true;
      TAURI.event.listen('relay_status', e=>{ relayInfo=e.payload; hostStatus(); noteSessionNet(); });
    }
    const port=await TAURI.core.invoke('relay_open', { addrs:session.addrs, fp:session.fp });
    relayPort=port; hostStatus();
    openHome({ url:`ws://127.0.0.1:${port}/mqtt`, pass:window.HudiniSessions.passOf(session, sessSecrets[session.id]) });
  }catch(e){ console.warn(e); hostNote='Не удалось открыть подключение: '+String(e?.message||e); relayPort=0; hostStatus(); }
}
// Запоминаем, какая сеть сработала и когда последний раз заходили
function noteSessionNet(){
  if(!session || relayInfo?.state!=='online' || session.lastNet===relayInfo.net && Date.now()-(session.last||0)<60e3) return;
  const list=HudiniStore.get('app.sessions', []), s=Array.isArray(list) && list.find(x=>x.id===session.id); if(!s) return;
  s.last=Date.now(); s.lastNet=relayInfo.net; session.last=s.last; session.lastNet=s.lastNet; HudiniStore.set('app.sessions', list);
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
  const url=info.user==='streamer' ? info.url : info.url+'?resume='+RESUME;
  const c=mqttClient(url, 'h', { username:info.user||'mod', password:String(info.pass||''), reconnectPeriod:3000 });
  homeClient=c; wire(c); hostStatus();
  c.on('connect', ()=>{
    if(homeClient!==c) return;
    pausedRoom=null;
    const first=client!==c; useMain(c);
    if(first) toast('🏠 Подключено к Hudini Host', 2500);
  });
  c.on('error', e=>{ if(homeClient===c && /auth|password|Not authorized/i.test(String(e.message))){
    // код 5 («Not authorized») программа отвечает только на паузе, неверный пароль — код 4
    if(/Not authorized/i.test(String(e.message))) return pausedByStreamer();
    pausedRoom=null;
    hostNote=info.user==='streamer' ? 'Вход устарел: нажми «Открыть пульт» в Hudini Host ещё раз' : 'Неверный пароль: попроси у стримера новый код';
    dropHome(); retryHome();   // стример мог выдать новый пароль: пробуем снова
  } });
  // попытка вернуться закончилась без ответа программы: это уже не пауза, показываем состояние связи
  c.on('close', ()=>{ if(homeClient===c && client!==c && pausedRoom===room){ pausedRoom=null; hostStatus(); } });
}
// Весть о паузе от программы или отказ при входе: показываем паузу и возвращаемся, когда её снимут. Пульта стримера пауза не касается
function pausedByStreamer(){
  if(!homeClient || homeInfo?.user==='streamer') return;
  pausedRoom=room; hostNote='';
  dropHome(); retryHome();
}
function retryHome(){ clearTimeout(retryT); retryT=setTimeout(()=>{ if(!homeClient) reopenHome(); }, RETRY_MS); }
// Повторная попытка после паузы или отказа
function reopenHome(){
  if(homeInfo) return;
  if(window.hudiniStreamer?.home(room)) return;   // пульт стримера: прямо к Hudini Host на этом компьютере (streamer.js)
  session=sessionFor(room);
  if(session && TAURI?.core) openRelay();
  else { if(TAURI?.core) TAURI.core.invoke('relay_close').catch(()=>{}); relayInfo=null; relayPort=0; hostStatus(); }
}
// Сохранённая сессия приложения для комнаты (код сессии = код комнаты)
// Пароль на пульт и ключи сессий. С паролем: открытые k/p/s из app.sessions переезжают в хранилище (сначала запись хранилища,
// потом чистка), в списке остаётся пометка sealed. Без пароля: ключи возвращаются в список. Сессии, добавленные из окна
// сессий (там пароля нет), приходят с открытыми ключами и переезжают при ближайшем открытии пульта.
async function syncSessions(){
  const S=window.HudiniSessions, list=HudiniStore.get('app.sessions', []);
  if(!Array.isArray(list) || !S) return;
  if(vaultPass){
    const move=list.filter(x=>x && S.vaultOf(x));
    if(!move.length) return;
    for(const x of move) sessSecrets[x.id]={ ...sessSecrets[x.id], ...S.vaultOf(x) };   // открытое новее: пришло из окна сессий или из кода
    await saveRooms();                       // хранилище записано: теперь можно убрать открытую копию
    const ids=new Set(move.map(x=>x.id));
    HudiniStore.set('app.sessions', HudiniStore.get('app.sessions', list).map(x=>x && ids.has(x.id) && S.vaultOf(x) ? S.seal(x) : x));
  } else {
    const back=list.filter(x=>x && x.sealed && sessSecrets[x.id]);
    if(!back.length) return;
    HudiniStore.set('app.sessions', list.map(x=>x && x.sealed && sessSecrets[x.id] ? S.unseal(x, sessSecrets[x.id]) : x));
  }
}
// Ключи сессии: открытые (старые данные, добавлено из окна сессий) или из хранилища
const sessionKeys=sess=>window.HudiniSessions.secretsOf(sess) || (sess.sealed && window.HudiniSessions.secretsOf(sessSecrets[sess.id])) || null;
function sessionFor(code){ const l=HudiniStore.get('app.sessions', []); return Array.isArray(l) && l.find(x=>x && x.id===code) || null; }
// Пульт открывается с ?session=<код>: берём стримера из списка сессий. Ключи у сессии есть, если комнату создал сам сервер.
// Правило: ключи уже сохранённой комнаты не перезаписываются.
async function roomFromSession(sess){
  const sk=sessionKeys(sess);
  const ex=rooms.find(r=>r.code===sess.id); if(ex) return { room:ex, differs:!!sk && (ex.k!==sk.k || ex.p!==sk.p || JSON.stringify(ex.s)!==JSON.stringify(sk.s)) };
  const r=sk ? cleanRoom({ code:sess.id, name:sess.name, ...sk }) : null;
  return { room:r && await roomKeysOk(r) ? r : null, differs:false };
}
$('status').onclick=()=>{ if(!client?.connected && !session) showHostTip(); else toggleConnPop(); };
const stateSeenT=new Map();   // комната → время самого нового экрана, который пульт видел или отправил
async function onMessage(topic, payload, packet){
  if(!payload.length) return;                     // пустые «удаления» не принимаем
  const T=topics(room), keys=KEYS;
  if(topic===T.base+'/hb'){
    const h=await unsealJSON(keys, payload, false); if(!h) return;
    h.at=Date.now(); widgets.set(String(h.id).slice(0,10), h); renderObs(); return;
  }
  if(topic===T.base+'/rtc'){ window.hudiniBroadcast?.onPacket(payload); return; }
  if(topic===T.base+'/media'){ window.hudiniBroadcast?.onMedia(payload); answerSound(payload); return; }   // ответ Host на запрос показать камеру/экран   // камера, экран, микрофон: запечатанная сигнализация (broadcast.js)
  if(topic===T.base+'/perms'){ window.hudiniPanelPerms?.(await unsealJSON(keys, payload, false)); return; }   // права модераторов от программы стримера (streamer.js)
  if(topic===T.base+'/host'){ const c=await unsealJSON(keys, payload, false); if(c){ const was=hostCtl?.hidden; hostCtl=c; renderObs(); window.hudiniMarks?.(); if(c.hidden && !was && !packet.retain) toast('🙈 Стример спрятал оверлей в OBS', 4000); if(c.paused && !packet.retain && keys===KEYS) pausedByStreamer(); } return; }
  if(topic===T.base+'/cs2series'){ const v=await unsealJSON(keys, payload, false); if(v){ CS2_SERIES=cleanSeriesView(v); repaintCs2(); renderSeries(); } return; }
  if(topic===T.base+'/cs2fight'){ const f=await unsealJSON(keys, payload, false); if(f && !packet.retain) showFight(f); return; }
  if(topic===T.base+'/cs2'){ const d=await unsealJSON(keys, payload, false); if(d){ CS2=d; CS2.at=packet.retain ? Number(d.t)||0 : Date.now(); CS2._skew=packet.retain?0:Date.now()-Number(d.t||Date.now()); if(!packet.retain) processCs2Events(d); else lastEvSeq=Math.max(lastEvSeq||0, ...((d.evs||[]).map(e=>e.s||0))); repaintCs2(); } return; }
  if(topic===T.base+'/cur'){ if(!packet.retain && window.Cursors?.on) window.Cursors.msg(await unsealJSON(keys, payload, true)); return; }   // курсор другого модератора (только пульты)
  if(topic===T.base+'/ink'){ if(!packet.retain) window.Draw?.ink(await unsealJSON(keys, payload, true)); return; }   // живой штрих рисунка
  if(topic!==T.state) return;
  const msg=await unsealJSON(keys, payload, true);
  if(!msg || topic!==topics(room).state) return;  // подделка, или комнату сменили, пока расшифровывали
  if(typeof msg!=='object' || !Array.isArray(msg.els)) return;   // эффект или мусор вместо экрана
  const t=Number(msg.t)||0;
  if(t>Date.now()+5*60*1000) return;               // из будущего
  if(offlineWait?.room===room){ mergeOffline(msg, t); return; }
  if(t<(stateSeenT.get(room)||0)) return;          // старый экран, присланный повторно: не принимаем и не переподписываем
  stateSeenT.set(room, t);
  if(msg.from===clientId && !packet.retain) return;   // своё эхо
  const s=sanitizeState(msg);
  if(takeRemote(s, cleanSeen(msg.vv))) scheduleSend();   // наши правки, которых в чужом экране ещё нет: дошлём
  if(drag && drag.mode!=='rect'){
    // тащим: чужой экран принимаем, а у элементов под мышью оставляем своё положение и размер, и сразу отправляем их
    for(const id of dragIds()){
      const mine=byId(id), r=s.els.find(e=>e.id===id);
      if(mine && r && mine.type===r.type) for(const k of GEOM_KEYS) if(k in mine) r[k]=mine[k];
    }
    acceptState(s, t); scheduleSend(); return;
  }
  acceptState(s, t);
}
const GEOM_KEYS=['x','y','rot','fs','w','hh','bw','bh','crop'];
function isGeom(m){ return m==='move' || m==='grp'; }
function dragIds(){ return isGeom(drag.mode) ? drag.items.map(i=>i.id) : [drag.id]; }
// Кто обрабатывает сообщение чата, когда его видят несколько пультов: первый записывает себя в state.claims,
// при споре побеждает меньший clientId. Действие выполняется через CLAIM_WAIT, когда чужие записи уже пришли.
const CLAIM_WAIT=450;
function mergeClaims(s){
  const out=[...(s.claims||[])], idx=new Map(out.map((c,i)=>[c.m, i])); let extra=false;
  for(const c of state.claims||[]){
    const i=idx.get(c.m);
    if(i==null){ idx.set(c.m, out.length); out.push(c); extra=true; }
    else if(c.o<out[i].o){ out[i]=c; extra=true; }
  }
  s.claims=out.slice(-CLAIMS_MAX); return extra;
}
function claimChat(mid, fn){
  if(!mid){ fn(); return; }
  if(!(state.claims||[]).some(c=>c.m===mid)){ state.claims=[...(state.claims||[]), { m:mid, o:clientId }].slice(-CLAIMS_MAX); publishNow(1); }
  setTimeout(()=>{ const c=(state.claims||[]).find(x=>x.m===mid); if(c && c.o===clientId) fn(); }, CLAIM_WAIT);
}
function acceptState(s, t){
  if(mergeClaims(s)) scheduleSend();
  if(mergeChat(s, t)) scheduleSend();   // наши голоса и сообщения, которых в чужом экране ещё нет: дошлём
  if(window.Draw?.merge(s)) scheduleSend();   // наши штрихи рисунка, которых там ещё нет
  if(changeOpen) rebaseChange(s);
  state=s; if(state.lang) STREAM_LANG=state.lang;
  syncedIds=new Set(drawList(state).map(e=>e.id));
  if(selectedId && !byId(selectedId)) selectedId=null;
  renderAll();
}
// Первый экран комнаты после подключения, когда у нас есть изменения без связи.
// Экран не менялся с тех пор, как мы его видели: отправляем свой целиком. Менялся (или видим впервые):
// оставляем его и добавляем только элементы, созданные без связи.
function mergeOffline(msg, t){
  const w=offlineWait; clearTimeout(w.timer); offlineWait=null;
  if(t<=w.seen){ publishNow(1); return; }
  stateSeenT.set(room, t);
  const remote=sanitizeState(msg), have=new Set(drawList(remote).map(e=>e.id));
  noteRemote(remote, cleanSeen(msg.vv)); sentSteps=[];   // что из правок без связи остаётся, решается здесь
  const mine=state.els.filter(e=>!have.has(e.id) && !syncedIds.has(e.id));
  remote.els=[...remote.els, ...mine].slice(0, MAX_ELS);
  const myRaf=!remote.raffle && state.raffle && !syncedIds.has(state.raffle.id);
  if(myRaf) remote.raffle=state.raffle;
  acceptState(remote);
  if(mine.length || myRaf) publishNow(1);
}
// Всё, что уходит на экран, подписывается и шифруется. Очередь сохраняет порядок.
let pubChain=Promise.resolve();
function sealedPublish(topic, data, opts, keys=KEYS){
  const bytes = data instanceof Uint8Array ? data : TE.encode(JSON.stringify(data));
  // очередь ждёт только шифрования и передачи в mqtt.js (порядок он хранит сам), а не подтверждения:
  // клиент, закрытый при смене комнаты, подтверждения не пришлёт, и очередь встала бы навсегда
  let acked;
  const p = pubChain.then(async()=>{
    if(!client?.connected) throw new Error('нет связи');
    const box=await seal(keys, bytes, true), c=client;
    if(!c?.connected) throw new Error('нет связи');
    acked=new Promise((res, rej)=>c.publish(topic, box, opts, e=>e?rej(e):res()));
  });
  pubChain=p.catch(e=>console.warn(e));
  return p.then(()=>acked);
}
Assets.onReady=()=>renderAll();
// Ошибка ответа файлового API: 423 = стример поставил модераторов на паузу (читать можно, менять нельзя)
const fileErr=(r,j)=>new Error(r.status===423 ? 'Стример поставил модераторов на паузу' : (j&&j.error)||('HTTP '+r.status));
// Файлы скачиваем из программы стримера и проверяем подпись
Assets.fetcher=async id=>{
  const h=homeHttp(); if(!h) throw new Error('нет связи');
  const keys=KEYS, r=await fetch(`${h.base}/files/${id}`, { headers:{ authorization:h.auth } });
  if(!r.ok) throw fileErr(r);
  return openAsset(keys, new Uint8Array(await r.arrayBuffer()), id);
};

let sendTimer=null, lastSend=0;
function publishNow(qos=0){
  clearTimeout(sendTimer); sendTimer=null; lastSend=performance.now();
  if(!client || !client.connected){ if(room) pendingOffline=room; return; }
  if(offlineWait) return;   // ещё ждём сохранённый экран: отправим после него
  STREAM_LANG=streamLang();
  window.Draw?.beforeSend();
  // время не меньше самого нового увиденного экрана: если часы у этого ПК отстают, правки всё равно примут
  const t=Math.max(Date.now(), Math.floor(stateSeenT.get(room)||0)+1)+T_FRAC;
  noteSent(t);
  const msg={ v:2, wv:WIDGET_VER, from:clientId, t, lang:STREAM_LANG, visible:true, hidAll:state.hidAll||[], vol:state.vol, fxVol:state.fxVol, raffle:state.raffle, els:state.els, claims:state.claims||[], fonts:state.fonts||[], emx:emxNow(), cs2auto:taCfg(), vv:seenBy };
  stateSeenT.set(room, Math.max(stateSeenT.get(room)||0, msg.t));
  syncedIds=new Set(drawList(state).map(e=>e.id));
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
  let keys;
  try{ keys=await roomKeys(code); }
  catch(e){ console.warn('room keys', e); toast('Ключи этой комнаты повреждены: возьми новое приглашение или бэкап', 5000); renderRooms(); return false; }
  // отложенная отправка и колесо относятся к старой комнате: иначе они сработают уже с пустым экраном новой
  clearTimeout(sendTimer); sendTimer=null; clearTimeout(wheelT); wheelT=null;
  if(offlineWait){ clearTimeout(offlineWait.timer); offlineWait=null; }
  if(homeClient) dropHome();
  rafFlush(); rafPool.clear(); rafSkip.clear(); chatPend.clear();   // участники и голоса у каждой комнаты свои
  chatDisconnect(); chatLog.length=0; $('chatFeed').replaceChildren(); $('chatChan').value=''; $('chatMore').hidden=true;   // у каждой комнаты свой чат
  widgets.clear(); renderObs(); CS2=null; CS2_SERIES=null; hostNote=''; storage=null; renderStorage();
  room=code; KEYS=keys; saveRooms(); window.Cursors?.reset();
  state={ visible:true, hidAll:[], vol:1, fxVol:1, els:[], raffle:null }; selectedId=null; undoStack.length=0; redoStack.length=0; changeOpen=false; openChange=null; chatSeen.clear(); pendingOffline=null; syncedIds=new Set(); noteRemote(state, null); sentSteps=[];
  clearTimeout(sendTimer); sendTimer=null; clearTimeout(wheelT); wheelT=null;
  Assets.reset();
  reopenHome(); renderSlang(); STREAM_LANG=streamLang();
  history.replaceState(null, '', location.pathname+keepQuery());
  renderRooms(); renderScenes(); renderScn(); $('scnEdit').hidden=true; lastEvSeq=null; updateLink(); renderAll();
  { const ch=curRoom()?.chat; if(ch) chatConnect(ch); }
  window.__webChatRefresh?.();
}

// ================== ИЗМЕНЕНИЯ / ОТМЕНА ==================
// Шаг отмены хранит не снимок экрана, а только свои правки: элементы по id (было/стало), порядок слоёв и общие поля.
// Отмена возвращает «было» только тем элементам, которые с тех пор никто не трогал; чужие правки остаются.
// openChange: { before:JSON экрана в начале правки, acc:уже собранная часть шага }
const UNDO_TOP=['hidAll','vol','fxVol','fonts','emx','raffle'];
function canonJSON(v){
  if(Array.isArray(v)) return '['+v.map(canonJSON).join(',')+']';
  if(v && typeof v==='object') return '{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonJSON(v[k])).join(',')+'}';
  return v===undefined ? 'null' : JSON.stringify(v);
}
// поля, которые меняет чат или время сами по себе: при сравнении не считаются чужой правкой
function undoVolatile(e){ return e.type==='poll' ? ['vk','votes'] : e.type==='counter' ? (e.cmode==='chat' ? ['cids','value'] : ['cids']) : e.type==='raffle' ? ['n'] : e.type==='roulette' ? ['vcnt', ...(e.cOn||e.rOn ? ['people','used'] : [])] : []; }
function elCanon(e){
  if(!e) return 'null';
  const o={ ...(sanitizeElSafe(e)||e) };
  if(o.ttl && o.ttl<=Date.now()){ o.hidden=true; delete o.ttl; }   // показ на время уже кончился
  for(const k of undoVolatile(o)) delete o[k];
  return canonJSON(o);
}
const topCanon=(k, v)=>k==='raffle' ? elCanon(v) : canonJSON(v ?? null);
const cloneJ=v=>v==null ? null : JSON.parse(JSON.stringify(v));
function undoDiff(before, now){
  const d={ els:{}, top:{} }, bm=new Map(before.els.map(e=>[e.id, e])), am=new Map(now.els.map(e=>[e.id, e]));
  for(const id of new Set([...bm.keys(), ...am.keys()])){
    const b=bm.get(id)||null, a=am.get(id)||null;
    if(elCanon(b)!==elCanon(a)) d.els[id]={ b:cloneJ(b), a:cloneJ(a) };
  }
  const ob=before.els.map(e=>e.id), oa=now.els.map(e=>e.id);
  if(ob.join()!==oa.join()){ d.ob=ob; d.oa=oa; }
  for(const k of UNDO_TOP) if(topCanon(k, before[k])!==topCanon(k, now[k])) d.top[k]={ b:cloneJ(before[k]), a:cloneJ(now[k]) };
  return d;
}
// сложить часть шага в уже собранное: «было» берётся из первой части, «стало» из последней
function undoFold(acc, d){
  if(!acc) return d;
  for(const [id, x] of Object.entries(d.els)){ const y=acc.els[id]; if(y){ y.a=x.a; if(elCanon(y.b)===elCanon(y.a)) delete acc.els[id]; } else acc.els[id]=x; }
  for(const [k, x] of Object.entries(d.top)){ const y=acc.top[k]; if(y){ y.a=x.a; if(topCanon(k, y.b)===topCanon(k, y.a)) delete acc.top[k]; } else acc.top[k]=x; }
  if(d.ob){ if(!acc.ob) acc.ob=d.ob; acc.oa=d.oa; }
  return acc;
}
function foldOpen(){ return openChange=openChange && { before:JSON.stringify(state), acc:undoFold(openChange.acc, undoDiff(JSON.parse(openChange.before), state)) }; }
// пришёл чужой экран посреди правки: сохраняем свою часть, дальше считаем от чужого экрана
function rebaseChange(next){ if(foldOpen()) openChange.before=JSON.stringify(next); }
function closeChange(){
  if(!changeOpen) return;
  changeOpen=false;
  const e=foldOpen()?.acc; openChange=null;
  if(!e || !Object.keys(e.els).length && !Object.keys(e.top).length && !(e.ob && e.ob.join()!==e.oa.join())) return;
  undoStack.push(e); if(undoStack.length>80) undoStack.shift();
  redoStack.length=0;
}
function beginChange(){
  if(changeOpen) return;
  changeOpen=true; openChange={ before:JSON.stringify(state), acc:null };
}
function changed(){ renderAll(); scheduleSend(); }
function commit(){ closeChange(); renderAll(); publishNow(1); }
// копия want, но голоса и счёт из чата остаются текущими, если сама правка их не меняла
function keepVolatile(want, expect, cur){
  const v=cloneJ(want);
  if(v && cur && expect) for(const k of undoVolatile(v)) if(canonJSON(want[k])===canonJSON(expect[k])){ if(k in cur) v[k]=cloneJ(cur[k]); else delete v[k]; }
  return v;
}
// место слоя id по порядку ord: над ближайшим соседом снизу, который есть в els
function layerPos(els, ord, id){
  for(let j=ord.indexOf(id)-1; j>=0; j--){ const p=els.findIndex(el=>el.id===ord[j]); if(p>=0) return p+1; }
  return 0;
}
// Применить шаг в сторону to ('b' = отмена, 'a' = повтор). Возвращает, сколько частей пропущено из-за чужих правок.
function applyStep(e, to){
  const from=to==='b'?'a':'b', ordTo=to==='b'?e.ob:e.oa, ordFrom=to==='b'?e.oa:e.ob;
  let skip=0;
  for(const [id, x] of Object.entries(e.els)){
    const want=x[to], expect=x[from], i=state.els.findIndex(el=>el.id===id), cur=i>=0 ? state.els[i] : null;
    if(expect ? !cur || elCanon(cur)!==elCanon(expect) : cur){ skip++; continue; }   // элемент с тех пор поменял кто-то другой
    if(!want){ state.els.splice(i, 1); msel.delete(id); continue; }
    const v=keepVolatile(want, expect, cur);
    if(cur){ state.els[i]=v; continue; }
    if(state.els.length>=MAX_ELS){ skip++; continue; }
    state.els.splice(layerPos(state.els, ordTo||[], id), 0, v);   // удалённый возвращается на место
  }
  if(ordTo && ordFrom){   // порядок слоёв: только если с тех пор его никто не менял
    const now=new Set(state.els.map(el=>el.id)), both=new Set(ordFrom.filter(id=>now.has(id)));
    const want=ordTo.filter(id=>both.has(id)), had=ordFrom.filter(id=>both.has(id)), cur=state.els.filter(el=>both.has(el.id)).map(el=>el.id);
    if(want.join()!==cur.join()){
      if(had.join()!==cur.join()) skip++;
      else { const m=new Map(state.els.map(el=>[el.id, el])); let n=0; state.els=state.els.map(el=>both.has(el.id) ? m.get(want[n++]) : el); }
    }
  }
  for(const [k, x] of Object.entries(e.top)){
    if(topCanon(k, state[k])!==topCanon(k, x[from])){ skip++; continue; }
    if(x[to]==null && k!=='raffle') delete state[k]; else state[k]=k==='raffle' ? keepVolatile(x[to], x[from], state.raffle) : cloneJ(x[to]);
  }
  if(selectedId && !byId(selectedId)) selectedId=null;
  for(const id of [...msel]) if(!byId(id)) msel.delete(id);
  renderAll(); publishNow(1);
  if(skip) toast('Часть правок пропущена: их уже поменял другой модератор', 3500);
  return skip;
}
function undo(){
  closeChange();
  if(!undoStack.length) return toast('Нечего отменять');
  const e=undoStack.pop(); redoStack.push(e); applyStep(e, 'b');
}
function redo(){
  closeChange();
  if(!redoStack.length) return toast('Нечего повторять');
  const e=redoStack.pop(); undoStack.push(e); applyStep(e, 'a');
}

// ================== ОДНОВРЕМЕННЫЕ ПРАВКИ ==================
// В каждом сообщении весь экран, и принимается только более новый. Если два пульта правят разное одновременно, более новый экран
// собран без правки другого. Поэтому в сообщении есть vv: { пульт: время его последней отправки, вошедшей в этот экран }.
// Пульт, чьей правки в принятом экране нет, возвращает её поверх и отправляет экран заново: за свои правки отвечает тот,
// кто их сделал. Один и тот же элемент: остаётся более новый вариант; удаление сильнее одновременной правки.
// Экран без vv (старый пульт) принимается целиком, как раньше.
const SENT_KEEP_MS=20000;   // правки старше этого уже дошли до всех и не возвращаются
const SEEN_MAX=32;
// дробная часть времени у каждого пульта своя: два пульта не пришлют экраны с одним и тем же временем
const T_FRAC=(1+crypto.getRandomValues(new Uint16Array(1))[0]%1023)/1024;
function cleanSeen(v){
  if(!v || typeof v!=='object') return null;
  return Object.fromEntries(Object.entries(v).filter(([k, t])=>/^mod_[a-z0-9]{1,28}$/.test(k) && Number.isFinite(t)).sort((a, b)=>b[1]-a[1]).slice(0, SEEN_MAX));
}
// общие поля экрана в одном виде, есть они в нём или нет
const SYNC_TOP={ hidAll:s=>s.hidAll||[], vol:s=>s.vol, fxVol:s=>s.fxVol, fonts:s=>s.fonts||[], emx:s=>s.emx||null, cs2auto:s=>cleanCs2Auto(s.cs2auto||null), raffle:s=>s.raffle||null };
// что изменилось между двумя экранами: элементы и общие поля «было/стало», порядок слоёв; null: ничего
function syncDiff(before, now){
  const d={ els:new Map(), top:new Map() }, bm=new Map(before.els.map(e=>[e.id, e])), am=new Map(now.els.map(e=>[e.id, e]));
  for(const id of new Set([...bm.keys(), ...am.keys()])){
    const b=bm.get(id)||null, a=am.get(id)||null;
    if(JSON.stringify(b)!==JSON.stringify(a)) d.els.set(id, { b, a });
  }
  const ob=before.els.map(e=>e.id), oa=now.els.map(e=>e.id);
  if(ob.join()!==oa.join()){ d.ob=ob; d.oa=oa; }
  for(const [k, get] of Object.entries(SYNC_TOP)){ const b=get(before), a=get(now); if(canonJSON(b)!==canonJSON(a)) d.top.set(k, { b, a }); }
  return d.els.size || d.top.size || d.ob ? d : null;
}
// несколько своих отправок подряд как одна правка: «было» из первой, «стало» из последней
function syncFold(list){
  const out={ els:new Map(), top:new Map() };
  for(const d of list){
    for(const part of ['els', 'top']) for(const [k, x] of d[part]) out[part].set(k, { b:out[part].has(k) ? out[part].get(k).b : x.b, a:x.a });
    if(d.ob){ out.ob ||= d.ob; out.oa=d.oa; }
  }
  return out;
}
// своя правка элемента (b → a) поверх варианта cur из чужого экрана → что должно остаться
function replayEl(b, a, cur){
  // штрихи рисунка объединяет Draw.merge: здесь они не сравниваются и остаются как в cur
  const draw=cur.type==='draw', canon=e=>elCanon(draw ? { ...e, strokes:[], del:[] } : e);
  // голоса и счёт: то, что пришло из чата (chatPend), объединяет mergeChat
  const keys=undoVolatile(cur), chat=!!chatPend.get(cur.id)?.size, untouched=keys.every(k=>canonJSON(cur[k])===canonJSON(b[k]));
  if(canon(a)!==canon(b)){
    if(canon(cur)!==canon(b)) return cur;   // этот элемент поменяли и там: остаётся их вариант, он новее
    const v=keepVolatile(a, chat && !untouched && a.vround===b.vround ? a : b, cur);   // новый раунд опроса несёт свои голоса
    if(draw){ v.strokes=cur.strokes; v.del=cur.del; }
    return v;
  }
  // изменились только голоса или счёт (кнопкой): своё берём, если там этого не трогали
  if(chat || !untouched) return cur;
  const v=cloneJ(cur);
  for(const k of keys){ if(k in a) v[k]=cloneJ(a[k]); else delete v[k]; }
  return v;
}
// вернуть свои правки d в чужой экран s. true: s изменился, его надо отправить
function replayOwn(s, d){
  let did=false;
  for(const [id, { b, a }] of d.els){
    const i=s.els.findIndex(e=>e.id===id), cur=i>=0 ? s.els[i] : null;
    if(!a){ if(cur){ s.els.splice(i, 1); did=true; } continue; }
    if(!cur){   // свой новый элемент ставим на место; если b есть, элемент удалили там: не возвращаем
      if(!b && s.els.length<MAX_ELS){ s.els.splice(layerPos(s.els, d.oa||[], id), 0, cloneJ(a)); did=true; }
      continue;
    }
    if(!b || b.type!==cur.type) continue;
    const v=replayEl(b, a, cur);
    if(canonJSON(v)!==canonJSON(cur)){ s.els[i]=v; did=true; }
  }
  if(d.ob){   // порядок слоёв: только если там его не меняли
    const here=new Set(s.els.map(e=>e.id)), both=new Set(d.ob.filter(id=>here.has(id) && d.oa.includes(id)));
    const want=d.oa.filter(id=>both.has(id)), had=d.ob.filter(id=>both.has(id)).join(), cur=s.els.filter(e=>both.has(e.id)).map(e=>e.id).join();
    if(had===cur && want.join()!==cur){ const m=new Map(s.els.map(e=>[e.id, e])); let n=0; s.els=s.els.map(e=>both.has(e.id) ? m.get(want[n++]) : e); did=true; }
  }
  for(const [k, { b, a }] of d.top){
    const cur=SYNC_TOP[k](s);
    let v=cur;
    if(k!=='raffle'){ if(canonJSON(cur)===canonJSON(b)) v=a; }
    else if(!a) v=null;                            // розыгрыш: те же правила, что у элемента
    else if(!cur) v=b ? null : a;
    else if(b) v=replayEl(b, a, cur);
    if(canonJSON(v)!==canonJSON(cur)){ s[k]=cloneJ(v); did=true; }
  }
  return did;
}
// s стал последним известным экраном сети
function noteRemote(s, vv){ netState=cloneJ(s); seenBy=vv||{}; }
// принят чужой экран s: вернуть в него наши правки, которых его отправитель не видел. true: s изменился
function takeRemote(s, vv){
  const now=performance.now(), mine=[];
  if(!vv) sentSteps=[];   // старый пульт: видел ли он наши правки, неизвестно
  else for(const x of sentSteps) if(now-x.at<SENT_KEEP_MS && x.t>(vv[clientId]||0)) mine.push(x.d);
  const unsent=sendTimer && syncDiff(netState, state);   // правка, которая ещё ждёт отправки
  if(unsent) mine.push(unsent);
  noteRemote(s, vv);
  return mine.length>0 && replayOwn(s, syncFold(mine));
}
// экран уходит с временем t: запоминаем, что в нём изменено
function noteSent(t){
  const now=performance.now(), snap=cloneJ(state), d=syncDiff(netState, snap);
  sentSteps=sentSteps.filter(x=>now-x.at<SENT_KEEP_MS);
  if(d) sentSteps.push({ t, at:now, d });
  netState=snap; seenBy=cleanSeen({ ...seenBy, [clientId]:t });
}

// ================== СОЗДАНИЕ ==================
function place(x, y){
  if(x!=null) return { x, y };
  const n=state.els.length%8; return { x:42+n*2.5, y:42+n*2.5 };
}
function addEl(el){
  if(el?.type==='raffle') return null;   // розыгрыш создаётся на своей вкладке
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
  if(blockedEmbed(url)) return toast('Этот адрес нельзя показать на экране: это пульт или программа Hudini', 4000);
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
function addCounter(){
  addEl({ type:'counter', ...place(), ...TW_BASE, fs:9, value:0, step:1,
    label: sT('Смертей'), cmode:'manual', kw:'', uniq:false, modsOnly:false,
    every:60, goal:0, running:false, startAt:Date.now() });
}

// радар по умолчанию в левом верхнем углу сцены: x и y — центр элемента, его размер берём из рамки карты матча
function radarCorner(fs){
  const d=radarDims(CS2?.map), m=1.2, pad=.4;                 // отступ от края (% высоты) и поля карточки в em
  return { x:+(m*.5625+((d.w+pad)*fs*.5625)/2).toFixed(1), y:+(m+((d.h+pad)*fs)/2).toFixed(1) };   // единица сцены — 1% высоты, ширина сцены = 1.78 высоты
}
function addCs2(){
  const n=state.els.filter(e=>e.type==='cs2').length%5;
  addEl({ type:'cs2', view:'card', x:16+n*4, y:86-n*14, fs:3.4, font:'montserrat', color:'#ffffff', card:'#15171d', accent:'#ffb020', label:'' });
  if(!cs2Fresh()) toast('Данные CS2 появятся, когда у стримера запущена программа Hudini Host и подключена CS2', 5000);
}
function repaintCs2(){
  state.els.forEach((el,i)=>{ if(el.type!=='cs2') return; const n=nodes.get(el.id); if(n && !n._animOn) paintNode(n, el, i+1); });
  const sel=byId(selectedId); if(sel?.type==='cs2'){ renderCsStatus(); renderNicks(sel); }
}
function renderCsStatus(){
  $('csStatus').textContent = cs2Fresh()
    ? `✓ Данные идут: ${mapName(CS2.map)||'меню'}${CS2.name?' · '+cs2Nick(CS2.name, taCfg().strip):''}`
    : 'Нет данных. У стримера должна быть запущена программа Hudini Host и нажата кнопка «Подключить CS2».';
  if(cs2Fresh()) $('csStatus').textContent += CS2.spec ? ` · 👁 режим наблюдателя, игроков: ${CS2.players.length}` : ' · игрок (панели команд — только в режиме наблюдателя)';
}
function addCase(){
  const items=[['Наклейка',2,50],['Скин на пистолет',3,25],['Скин на винтовку',4,15],['AK-47 | Redline',5,8],['Нож',6,2]].map(([n,r,p])=>({ n:sT(n), r, p, img:'' }));
  addEl({ type:'case', x:50, y:50, fs:4, font:'montserrat', color:'#ffffff', name:'HUDINI CASE', cc:'#7c5cff', items, hideAfter:12, vol:0.8, kind:'normal' });
}
// Розыгрыш один на экран: state.raffle, не слой
const raf=()=>state.raffle||null;
function addRaffle(){
  if(state.raffle) return;
  const clean=sanitizeEl({ id:'raffle', type:'raffle', x:50, y:45, fs:3, font:'montserrat', color:'#ffffff', card:'#141824', accent:'#7c5cff', rot:0, op:1, anim:'none',
    title:sT('Розыгрыш'), prize:'', kw:cmdWord('!участвую', streamLang()), entry:'word', subx2:true, auto:true, phase:'idle', hidden:false });
  beginChange(); state.raffle=clean; commit();
  if(!chatWs) toast('Для розыгрыша подключи чат Twitch слева', 4000);
}
function addPoll(){
  addEl({ type:'poll', ...place(), x:78, y:30, fs:3.2, font:'montserrat', color:'#ffffff', card:'#1d1d24', accent:'#7c5cff',
    title:sT('Что дальше?'), opts:[1,2,3].map(n=>sT('Вариант')+' '+n), votes:[0,0,0], vround:rid(8), running:false });
  if(!chatWs) toast('Для голосования подключи чат Twitch слева', 4000);
}

// ---- язык надписей на стриме (по умолчанию как у пульта) ----
const DEFAULT_TXT={
  en:{ 'Перекрут':'Respin', 'ВРЕМЯ!':'TIME!', 'До Нового года':'Until New Year', 'С НОВЫМ ГОДОМ!':'HAPPY NEW YEAR!', 'F в чат':'F in chat', 'Смертей':'Deaths', 'Что дальше?':'What next?', 'Вариант':'Option', 'Розыгрыш':'Giveaway', 'Наклейка':'Sticker', 'Скин на пистолет':'Pistol skin', 'Скин на винтовку':'Rifle skin', 'Нож':'Knife', 'Предмет':'Item', 'Приз':'Prize', 'Заказ песни':'Song request', 'Привет в чате':'Shout-out in chat', 'Бан в чате на 10 минут':'10 min timeout', 'Ещё одна попытка':'Spin again' },
  uk:{ 'Перекрут':'Перекрут', 'ВРЕМЯ!':'ЧАС!', 'До Нового года':'До Нового року', 'С НОВЫМ ГОДОМ!':'З НОВИМ РОКОМ!', 'F в чат':'F у чат', 'Смертей':'Смертей', 'Что дальше?':'Що далі?', 'Вариант':'Варіант', 'Розыгрыш':'Розіграш', 'Наклейка':'Наліпка', 'Скин на пистолет':'Скін на пістолет', 'Скин на винтовку':'Скін на гвинтівку', 'Нож':'Ніж', 'Предмет':'Предмет', 'Приз':'Приз', 'Заказ песни':'Замовлення пісні', 'Привет в чате':'Привіт у чаті', 'Бан в чате на 10 минут':'Бан у чаті на 10 хвилин', 'Ещё одна попытка':'Ще одна спроба' },
  de:{ 'Перекрут':'Respin', 'ВРЕМЯ!':'ZEIT!', 'До Нового года':'Bis Neujahr', 'С НОВЫМ ГОДОМ!':'FROHES NEUES!', 'F в чат':'F in den Chat', 'Смертей':'Tode', 'Что дальше?':'Was als Nächstes?', 'Вариант':'Option', 'Розыгрыш':'Gewinnspiel', 'Наклейка':'Sticker', 'Скин на пистолет':'Pistolen-Skin', 'Скин на винтовку':'Gewehr-Skin', 'Нож':'Messer', 'Предмет':'Gegenstand', 'Приз':'Preis', 'Заказ песни':'Songwunsch', 'Привет в чате':'Gruß im Chat', 'Бан в чате на 10 минут':'10 Min. Timeout', 'Ещё одна попытка':'Noch ein Versuch' },
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
    const r=await fetch(`${h.base}/files?panel=${panelId()}`, { headers:{ authorization:h.auth } });
    const j=await r.json().catch(()=>({})); if(!r.ok) throw fileErr(r,j);
    setStorage(j.storage);
    if(announce && !storageToast){ storageToast=true; toast(`Место для файлов: свободно ${fmtBytes(Math.max(0, storage.limitBytes-storage.used))}, ещё ${Math.max(0, storage.maxFiles-storage.files)} файлов`, 4000); }
    return j;
  }catch(e){ console.warn('storage', e); }
}
// Файлы, которые нужны этой комнате: на экране, в сценах, библиотеке, сценариях и поле звука
function usedAssets(){
  const used=assetsOf(state), add=v=>{ const a=assetId(v); if(a) used.add(a); };
  add($('soundUrl').value);
  for(const it of library) if(it.room===room) assetsOfEl(it.el, used);
  for(const sc of scenes[room]||[]) assetsOf(sc, used);
  for(const sc of scnStore[room]||[]) for(const a of sc.acts||[]) add(a.url);
  add(window.Draw?.brushAsset);   // загруженная кисть из фото, которой ещё не рисовали
  return used;
}
// Постоянный id пульта: по нему программа стримера помнит, какие файлы нужны этому модератору
function panelId(){
  let v=lsGet('overlay.panelId', '');
  if(typeof v!=='string' || !/^[a-z0-9]{12,32}$/.test(v)){ v=rid(20); lsSet('overlay.panelId', v); }
  return v;
}
// Программа стримера хранит список файлов этого пульта, чтобы очистка у другого модератора их не удалила.
// Отправляем после подключения и после изменений; проверка раз в 2 с заодно объединяет частые правки.
let keepBusy=false;
// Только что загруженный файл ещё не на холсте (идут другие загрузки, элемент не вставлен): в списке для программы он держится,
// пока не появится среди используемых, но не дольше FRESH_MS, иначе чужая очистка успеет его удалить.
const freshFiles=new Map(), FRESH_MS=10*60e3;   // id → до какого времени держать
async function reportKeep(){
  const h=homeHttp(), c=client; if(!h || keepBusy || keepOld) return;
  const used=usedAssets(), now=Date.now();
  for(const [id, until] of freshFiles) if(used.has(id) || now>until) freshFiles.delete(id); else used.add(id);
  const keep=[...used].sort(), sig=room+'|'+keep.join();
  if(sig===keepSent) return;
  keepBusy=true;
  try{
    const r=await fetch(h.base+'/files/keep', { method:'POST', headers:{ authorization:h.auth, 'content-type':'application/json' }, body:JSON.stringify({ id:panelId(), keep }) });
    if(c===client){
      if(r.ok) keepSent=sig;
      // 400 и 404: программа старой версии; 401: пароль уже другой, повторы сочлись бы перебором; 423: пауза модераторов.
      // До следующего подключения не спрашиваем
      else if([400, 401, 404, 423].includes(r.status)) keepOld=true;
    }
  }catch(e){ console.warn('keep', e); }
  keepBusy=false;
}
setInterval(reportKeep, 2000);
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
  if(!MIME_RE.test(blob.type||'')) throw err(`${name}: такой формат не загрузить. Подойдут PNG, JPG, GIF, WebP, видео, звук и шрифты`);
  if(storage && blob.size > storage.maxFileBytes) throw err(`${name}: ${fmtBytes(blob.size)}, а стример разрешил файлы до ${fmtBytes(storage.maxFileBytes)}. Для больших видео лучше ссылка или YouTube.`);
  const id=rid(14), keys=KEYS;
  freshFiles.set(id, Date.now()+FRESH_MS);
  const box=await packAsset(keys, blob, id, name);
  const n=Math.max(1, Math.ceil(box.length/PART_BYTES));
  for(let i=0;i<n;i++){
    const r=await fetch(`${h.base}/files/${id}?part=${i}${i===n-1?'&last=1':''}&panel=${panelId()}`, { method:'PUT',
      headers:{ authorization:h.auth, 'content-type':'application/octet-stream' }, body:box.subarray(i*PART_BYTES, (i+1)*PART_BYTES) });
    const j=await r.json().catch(()=>({}));
    if(j.storage) setStorage(j.storage);
    if(r.status===413){
      const why={ file:'файл больше, чем разрешил стример', count:'файлов уже столько, сколько разрешил стример', space:'место для файлов кончилось' }[j.reason] || 'место для файлов кончилось';
      showHostTip(`«${name}» не загрузился: ${why}`, true); const e=new Error('нет места'); e.shown=true; throw e;
    }
    if(!r.ok) throw fileErr(r,j);
    showUpload(`Загрузка ${name}: ${Math.round((i+1)/n*100)}%`, (i+1)/n);
  }
  freshFiles.set(id, Date.now()+FRESH_MS);   // долгая загрузка: срок считается от её конца
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
  const want=(state.fonts||[]).map(f=>f.id+'|'+f.name).join(',');
  for(const [id, withAdd] of [['iFont', true], ['iRFont', false], ['iRouFont', false]]){
    const sel=I(id); let g=sel.querySelector('optgroup[data-own]');
    if(!g){ g=document.createElement('optgroup'); g.dataset.own=''; g.label='Свои шрифты'; sel.appendChild(g);
      if(withAdd){ const add=document.createElement('option'); add.value='__add'; add.textContent='＋ Добавить свой шрифт…'; sel.appendChild(add); } }
    if(g.dataset.sig===want) continue; g.dataset.sig=want;
    g.replaceChildren(...(state.fonts||[]).map(f=>{ const o=new Option(f.name, 'u:'+f.id); o.dataset.i18nSkip=''; return o; }));
    g.hidden=!g.children.length;
  }
}
function removeFont(id){
  beginChange(); state.fonts=(state.fonts||[]).filter(f=>f.id!==id);
  for(const e of drawList(state)) if(e.font==='u:'+id) e.font='montserrat';
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
// Удалить из программы стримера файлы, которых нет ни на экране, ни в сценах, ни в библиотеке этого пульта
// и в списках других пультов (held). Сама программа ничего не удаляет: так мем, приготовленный на конец стрима, не пропадёт.
async function cleanFiles(){
  const h=homeHttp(); if(!h) return showHostTip('Файлы хранятся в программе Hudini Host, а она сейчас не подключена');
  const j=await refreshStorage(); if(!j) return toast('Не получилось узнать список файлов');
  const used=usedAssets(), held=new Set(j.held||[]), unused=(j.ids||[]).filter(([id])=>!used.has(id) && !held.has(id));
  if(!unused.length) return toast('Все файлы используются: на экране, в сценах, библиотеке или сценариях', 4000);
  const bytes=unused.reduce((a,[,b])=>a+b, 0);
  const note=Array.isArray(j.held)
    ? 'Их нет на экране и в сценах, библиотеке и сценариях модераторов.\nФайлы, нужные только модераторам, которые не подключались после обновления, могут удалиться.'
    : 'Их нет ни на экране, ни в сценах, библиотеке и сценариях этого пульта.\nЕсли у другого модератора свои сцены с этими файлами, у него они пропадут.';   // программа старой версии списков не знает
  if(!confirm(`Удалить ${unused.length} файлов (${fmtBytes(bytes)})?\n\n${note}`)) return;
  try{
    const r=await fetch(h.base+'/files/clean', { method:'POST', headers:{ authorization:h.auth, 'content-type':'application/json' }, body:JSON.stringify({ id:panelId(), keep:[...used] }) });
    const k=await r.json().catch(()=>({})); if(!r.ok) throw fileErr(r,k);
    setStorage(k.storage); toast(`🧹 Удалено файлов: ${k.deleted} (${fmtBytes(k.bytes)})`, 4000);
  }catch(e){ toast('Не удалилось: '+(e.message||e)); }
}
$('cleanFiles').onclick=cleanFiles;
$('cleanFiles2').onclick=cleanFiles;

// ================== ОТРИСОВКА ==================
const nodes=new Map();
const RZ_DIRS=['nw','n','ne','e','se','s','sw','w'];
function rzHandle(dir){
  const d=document.createElement('div'); d.className='h h-rz rz-'+dir+(dir.length===1?' edge':''); d.dataset.h='rz'; d.dataset.d=dir;
  if(dir.length===1) d.title='Потяни: размер от противоположного края · Shift: с пропорциями · Ctrl: от центра · Alt: обрезать · двойной клик: рамка по содержимому';
  return d;
}
function addHandles(node){
  for(const dir of RZ_DIRS) node.appendChild(rzHandle(dir));
  { const d=document.createElement('div'); d.className='h h-rot'; d.dataset.h='rot'; node.appendChild(d); }
  const t=document.createElement('div'); t.className='tag'; node.appendChild(t);
  const c=node.querySelector('.content');
  if(c.tagName==='IMG' || c.tagName==='VIDEO'){
    c.addEventListener('error', ()=>node.classList.add('broken'));
    c.addEventListener(c.tagName==='VIDEO'?'loadeddata':'load', ()=>node.classList.remove('broken'));
  }
}
function updGrp(){
  const g=$('grpBox'); if(!g) return;
  if(!g.firstChild) for(const dir of RZ_DIRS) g.appendChild(rzHandle(dir));
  const ids=msel.size>1 ? selList().filter(x=>x.type!=='raffle').map(x=>x.id) : [];
  const b=ids.length>1 ? selBounds(ids) : null;
  g.style.display=b ? 'block' : 'none';
  if(b) Object.assign(g.style, { left:b.l+'%', top:b.t+'%', width:(b.r-b.l)+'%', height:(b.b-b.t)+'%' });
}
function renderAll(){
  syncSel(); syncEmx();
  stage.classList.toggle('all-hidden', allHiddenNow());
  const seen=new Set(), now=nowMs();
  drawList(state).forEach((el,i)=>{
    seen.add(el.id);
    let node=nodes.get(el.id);
    if(node && node.dataset.type!==el.type){ window.chatUnbind?.(node); node.remove(); node=null; }   // лента чата сразу отписывается от канала
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
  for(const [id,n] of nodes) if(!seen.has(id)){ window.chatUnbind?.(n); n.remove(); nodes.delete(id); }
  stage.classList.toggle('multi', msel.size>1);
  updGrp();
  renderLayers(); renderMixer(); renderRaffleTab(); renderRTabs(); renderInspector(); renderToolbar();
  $('globalEye').textContent = hidAllActive() ? '👁 Показать всё' : '🙈 Скрыть всё';
  window.hudiniMarks?.();   // что стример выключил у себя (streamer.js)
  window.hudiniBroadcast?.refresh();   // нужные потоки подключаем, лишние отпускаем (broadcast.js)
}
const MODE_ICO={ countdown:'⏱', stopwatch:'⏲', until:'📅', clock:'🕐' };
const MODE_NAME={ countdown:'Таймер', stopwatch:'Секундомер', until:'Отсчёт до', clock:'Часы' };
const KIND_NAME={ site:'🌐 Сайт', youtube:'▶ YouTube', twitch:'🟣 Twitch' };
function elIcon(el){
  if(el.type==='timer') return MODE_ICO[el.mode];
  if(el.type==='counter') return el.cmode==='chat'?'💬':'🔢';
  if(el.type==='web') return KIND_NAME[parseEmbed(el.url).kind].split(' ')[0];
  if(el.type==='poll') return '📊';
  if(el.type==='raffle') return '🎁';
  if(el.type==='case') return '📦';
  if(el.type==='draw') return '🎨';
  if(el.type==='roulette') return el.view==='wheel' ? '🎡' : '🎰';
  if(el.type==='stream') return { cam:'📷', screen:'🖥', mic:'🎙' }[el.kind];
  if(el.type==='cs2') return '🎯';
  if(el.type==='msg' || el.type==='chat') return '💬';
  return { text:'T', image:'🖼', video:'🎞' }[el.type];
}
function elName(el){
  if(el.type==='text') return el.text.split('\n')[0] || '(пусто)';
  if(el.type==='timer') return (el.label||MODE_NAME[el.mode])+' · '+twState(el, nowMs()).text;
  if(el.type==='counter') return (el.label||'Счётчик')+' · '+counterValue(el, nowMs());
  if(el.type==='msg') return (el.user||'сообщение')+': '+el.text;
  if(el.type==='chat') return 'Чат'+(el.chan?' · '+el.chan:'');
  if(el.type==='cs2') return 'CS2 · '+{ card:'карточка', kda:'K/D/A', hp:'HP', score:'счёт', money:'деньги', weapon:'оружие', streak:'серия', teams:'команды'+(el.side!=='both'?' '+el.side.toUpperCase():''), scorebar:'счёт-бар', observed:'наблюдаемый', radar:'радар' }[el.view];
  if(el.type==='stream') return gT({ cam:'Камера', screen:'Экран', mic:'Микрофон' }[el.kind])+' · '+(el.owner===clientId || (el.owner==='streamer' && document.body.classList.contains('streamer-panel')) ? gT('я') : el.owner.replace(/^[a-z]+_/,'').slice(0,6));
  if(el.type==='poll') return (el.title||'Голосование')+' · '+el.votes.reduce((a,b)=>a+b,0)+(el.running?' ▶':'');
  if(el.type==='draw') return 'Рисунок · '+el.strokes.length;
  if(el.type==='case') return 'Кейс · '+el.name+(el.openAt && nowMs()<el.openAt+caseT(el).reveal ? ' · открывается' : '');
  if(el.type==='roulette') return 'Рулетка · '+(el.title||(el.view==='wheel' ? 'колесо' : 'автомат'))+(rouBusy(el, nowMs()) ? ' · крутится' : '');
  if(el.type==='raffle') return (el.title||'Розыгрыш')+' · '+({ idle:'ждёт', collect:'сбор', closed:'сбор закрыт', spin:el.winner||'крутим' }[el.phase])+' · 👥 '+el.n;
  if(el.type==='web'){ try{ return new URL(el.url).hostname+new URL(el.url).pathname; }catch{ return el.url; } }
  if(assetId(el.src)) return el.type==='video' ? 'видео с компьютера' : 'картинка с компьютера';
  try{ const p=new URL(el.src).pathname.split('/').filter(Boolean).pop(); return decodeURIComponent(p||el.src); }catch{ return el.src; }
}
// ---- вкладка «Звук»: общая громкость, эффекты и каждый звучащий элемент ----
const muteMem=new Map();   // что было на ползунке до 🔇
const hasSound = el => ['video','web','stream','case','raffle','roulette'].includes(el.type) || (el.type==='timer' && !!el.endSound);
const mxRows = () => [{ key:'master', name:'Общая громкость' }, { key:'fx', name:'Звуковые эффекты (кнопка «Звук», сценарии)' },
  ...drawList(state).filter(hasSound).map(el=>({ key:el.id, el, name:elIcon(el)+' '+elName(el).slice(0,40) }))];
function mxGet(r){ return r.key==='master' ? num(state.vol,1,0,1) : r.key==='fx' ? num(state.fxVol,1,0,1) : num(r.el.vol,1,0,1); }
function mxSet(r, v){ if(r.key==='master') state.vol=v; else if(r.key==='fx') state.fxVol=v; else r.el.vol=v; }
// у видео и сайта звук включается галочкой, у остальных 🔇 — это нулевая громкость
const mxMuted = r => r.el && (r.el.type==='video' || r.el.type==='web' || r.el.type==='stream') ? !r.el.sound : mxGet(r)<0.005;
let mixSig='';
// общая громкость в шапке: тот же state.vol, что и первый ползунок вкладки «Звук»
function syncHdrVol(){
  const sl=$('hdrVol'), v=Math.round(num(state.vol,1,0,1)*100);
  if(document.activeElement!==sl) sl.value=v;
  $('hdrVolV').textContent=v+'%'; $('hdrMute').textContent=v<1?'🔇':'🔊';
}
$('hdrVol').oninput=()=>{ beginChange(); state.vol=Number($('hdrVol').value)/100; changed(); };
$('hdrVol').onchange=()=>commit();
$('hdrMute').onclick=()=>{ beginChange(); if(num(state.vol,1,0,1)<0.005) state.vol=muteMem.get('master')||0.8; else { muteMem.set('master', num(state.vol,1,0,1)); state.vol=0; } commit(); };
// меню «⋯ Ещё»: ссылка для стримера, рамка, пароль, очистка
function toggleMore(force){
  const m=$('moreMenu'), open=force ?? m.hidden; m.hidden=!open; $('moreBtn').classList.toggle('on', open);
  if(!open) return;
  const away=e=>{ if(m.contains(e.target) || $('moreBtn').contains(e.target)) return; toggleMore(false); removeEventListener('pointerdown', away, true); };
  setTimeout(()=>addEventListener('pointerdown', away, true), 0);
}
$('moreBtn').onclick=()=>toggleMore();
$('moreMenu').addEventListener('click', e=>{ const b=e.target.closest('button'); if(b && b.id!=='copyLink') setTimeout(()=>toggleMore(false), 0); });
addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('moreMenu').hidden) toggleMore(false); });
function renderMixer(){
  syncHdrVol();
  const box=$('mixer'); if(!box) return;
  const rows=mxRows(), sig=rows.map(r=>r.key).join('|');   // имена тикают (таймер), поэтому строки пересобираем только при смене состава
  $('mixerEmpty').hidden = rows.length>2;
  if(sig!==mixSig){
    mixSig=sig; box.replaceChildren();
    for(const r of rows){
      const d=document.createElement('div'); d.className='mx'+(r.key==='master'?' master':''); d.dataset.key=r.key;
      const n=document.createElement('button'); n.className='mxn'; n.textContent=r.name; n.title=r.el ? 'Выделить на экране' : '';
      if(r.el) n.onclick=()=>select(r.el.id); else n.style.cursor='default';
      const s=document.createElement('div'); s.className='mxs';
      const sl=document.createElement('input'); sl.type='range'; sl.min=0; sl.max=100; sl.step=1;
      const v=document.createElement('span'); v.className='mxv';
      s.append(sl, v);
      const m=document.createElement('button'); m.className='mxm';
      const cur=()=>mxRows().find(x=>x.key===r.key);
      sl.oninput=()=>{ const x=cur(); if(!x) return; beginChange(); mxSet(x, Number(sl.value)/100); if(x.el && Number(sl.value)>0 && x.el.type!=='video' && x.el.type!=='web' && x.el.type!=='stream') muteMem.delete(x.key); changed(); };
      sl.onchange=()=>commit();
      m.onclick=()=>{ const x=cur(); if(!x) return; beginChange();
        if(x.el && (x.el.type==='video' || x.el.type==='web' || x.el.type==='stream')) x.el.sound=!x.el.sound;
        else if(mxGet(x)<0.005) mxSet(x, muteMem.get(x.key) || 0.8);
        else { muteMem.set(x.key, mxGet(x)); mxSet(x, 0); }
        commit(); };
      d.append(n, s, m); box.appendChild(d);
    }
  }
  for(const r of rows){
    const d=box.querySelector(`.mx[data-key="${CSS.escape(r.key)}"]`); if(!d) continue;
    const sl=d.querySelector('input'), val=Math.round(mxGet(r)*100), off=mxMuted(r);
    if(document.activeElement!==sl) sl.value=val;
    const nm=d.querySelector('.mxn'); if(nm.textContent!==r.name) nm.textContent=r.name;
    d.querySelector('.mxv').textContent=val+'%';
    d.classList.toggle('off', off);
    const m=d.querySelector('.mxm'); m.textContent=off?'🔇':'🔊'; m.title=off?'Включить звук':'Заглушить';
  }
}
const gT=t=>window.HudiniI18n ? window.HudiniI18n.t(t) : t;
// Слои: одиночные элементы и папки (группы). Участники группы показываются под папкой; группа из одного элемента папкой не считается.
let selFolder=null, layerAnchor=null, layerDrag=null;
const gfold=new Set((()=>{ const v=lsGet('overlay.gfold', []); return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]; })());
function saveFold(){ lsSet('overlay.gfold', [...gfold]); }
function layerUnits(){   // сверху вниз: { el } или { g, name, els }
  const rev=[...state.els].reverse(), cnt=new Map(), seen=new Set(), out=[];
  for(const e of rev) if(e.g) cnt.set(e.g, (cnt.get(e.g)||0)+1);
  for(const e of rev){
    if(e.g && cnt.get(e.g)>1){
      if(seen.has(e.g)) continue; seen.add(e.g);
      const els=rev.filter(x=>x.g===e.g);
      out.push({ g:e.g, name:els.find(x=>x.gn)?.gn||gT('Группа'), els });
    } else out.push({ el:e });
  }
  return out;
}
function layerOrder(){ return layerUnits().flatMap(u=>u.els||[u.el]).map(e=>e.id); }
function renderLayers(){
  const box=$('layers');
  // папку переименовывают: не перерисовываем, иначе поле ввода пропадёт (список обновится, когда имя сохранят)
  const ae=document.activeElement; if(ae?.classList.contains('folderName') && box.contains(ae)) return;
  box.replaceChildren();
  if(!state.els.length){ const d=document.createElement('div'); d.className='hint'; d.textContent='Пока пусто'; box.appendChild(d); return; }
  const li=new Map([...state.els].reverse().map((e,i)=>[e.id,i]));
  const units=layerUnits();
  for(const g of [...gfold]) if(!units.some(u=>u.g===g)) gfold.delete(g);
  const btnTo=(row, act, txt, title)=>{ const b=document.createElement('button'); b.dataset.act=act; b.textContent=txt; b.title=title; row.appendChild(b); };
  const elRow=(el, inside)=>{
    const row=document.createElement('div'), n=li.get(el.id);
    row.className='layer'+(inside?' in':'')+(el.id===selectedId?' sel':msel.has(el.id)?' msel':'')+(el.hidden?' hid':'')+(el.ttl?' flashing':'');
    row.dataset.id=el.id;
    const num=document.createElement('span'); num.className='num'; num.textContent=n<9?n+1:''; num.title=n<9?`Клавиша ${n+1}: показать на N сек`:'';
    const ico=document.createElement('span'); ico.className='ico'; ico.textContent=elIcon(el);
    const name=document.createElement('span'); name.className='name'; name.textContent=elName(el); name.title=name.textContent;
    row.append(num, ico, name);
    if(el.type==='timer' && (el.mode==='countdown'||el.mode==='stopwatch')) btnTo(row, 'ttoggle', el.running?'⏸':'▶', 'Старт / пауза (Пробел)');
    if(el.type==='counter'){ btnTo(row, 'cminus','−','−шаг'); btnTo(row, 'cplus','+','+шаг'); }
    if(el.type==='poll') btnTo(row, 'ptoggle', el.running?'⏸':'▶', 'Начать / закончить голосование');
    if(el.kf) btnTo(row, 'kfplay', el.kf.playing?'⏹':'🎬', 'Проиграть / остановить анимацию (P)');
    btnTo(row, 'eye', el.hidden?'🙈':'👁', 'Показать / скрыть (H). Зажми и проведи по глазкам, чтобы скрыть несколько');
    btnTo(row, 'flash', '⚡', 'Показать на N секунд (F)');
    btnTo(row, 'del', '🗑', 'Удалить');
    if(layerDrag?.moved && layerDrag.id===el.id) row.classList.add('dragging');
    return row;
  };
  for(const u of units){
    if(!u.g){ box.appendChild(elRow(u.el, false)); continue; }
    const folded=gfold.has(u.g), allHid=u.els.every(e=>e.hidden);
    const f=document.createElement('div');
    f.className='layer folder'+(selFolder===u.g&&u.els.some(e=>msel.has(e.id))?' sel':u.els.every(e=>msel.has(e.id))?' msel':'')+(allHid?' hid':'')+(u.els.some(e=>e.ttl)?' flashing':'');
    f.dataset.g=u.g;
    btnTo(f, 'fold', folded?'▸':'▾', 'Свернуть / развернуть');
    const ico=document.createElement('span'); ico.className='ico'; ico.textContent='📁';
    const name=document.createElement('span'); name.className='name'; name.dataset.i18nSkip=''; name.textContent=u.name+(folded?` (${u.els.length})`:''); ico.title='Переименовать (F2 или двойной клик)';
    f.append(ico, name);
    btnTo(f, 'eye', allHid?'🙈':'👁', 'Скрыть или показать всю папку');
    btnTo(f, 'flash', '⚡', 'Показать на N секунд (F)');
    btnTo(f, 'ungroup', '⛓️‍💥', 'Разгруппировать');
    btnTo(f, 'del', '🗑', 'Удалить папку вместе с элементами');
    if(layerDrag?.moved && layerDrag.g===u.g) f.classList.add('dragging');
    box.appendChild(f);
    if(!folded) for(const e of u.els) box.appendChild(elRow(e, true));
  }
}
function renameFolder(g){
  const f=document.querySelector(`#layers .folder[data-g="${g}"]`); if(!f) return;
  const name=f.querySelector('.name'), cur=state.els.find(e=>e.g===g&&e.gn)?.gn||gT('Группа');
  const inp=document.createElement('input'); inp.type='text'; inp.maxLength=40; inp.value=cur; inp.dataset.i18nSkip=''; inp.className='folderName';
  name.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const end=save=>{
    if(done) return; done=true; inp.classList.remove('folderName');
    const v=inp.value.trim().slice(0,40);
    if(save && v && v!==cur){ beginChange(); state.els.forEach(e=>{ if(e.g===g) e.gn=v; }); commit(); } else renderLayers();
  };
  inp.addEventListener('keydown', e=>{ e.stopPropagation(); if(e.key==='Enter') end(true); else if(e.key==='Escape') end(false); });
  inp.addEventListener('blur', ()=>end(true));
  inp.addEventListener('click', e=>e.stopPropagation());
}
// --- инспектор ---
const I=id=>$(id);
function setField(f, v, prop='value'){ if(document.activeElement!==f && f[prop]!==v) f[prop]=v; }
function normRot(r){ return ((r+180)%360+360)%360-180; }
function toLocalInput(ms){ if(!ms) return ''; const d=new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function showFor(attr, value){ document.querySelectorAll(`#insp [data-${attr}]`).forEach(n=>n.hidden=!n.dataset[attr].split(' ').includes(value)); }
function renderInspector(){
  window.Draw?.sync();
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
    setField(I('iKw'), el.kw); setField(I('iUniq'), el.uniq, 'checked'); setField(I('iModsOnly'), el.modsOnly, 'checked'); setField(I('iEvery'), String(el.every));
    $('cToggle').textContent = el.running ? '⏸ Остановить' : '▶ Считать';
    $('cToggle').className = el.running ? 'grow' : 'go grow';
  }
  if(el.type==='video' || el.type==='stream'){ setField(I('iSound'), el.sound, 'checked'); setField(I('iVol'), String(el.vol)); $('vVol').textContent=Math.round(el.vol*100)+'%'; I('iVol').disabled=!el.sound; }
  if(el.type==='chat'){
    setField(I('iChChan'), el.chan); setField(I('iChTheme'), el.theme); setField(I('iChCard'), el.card); setField(I('iChAccent'), el.accent);
    setField(I('iChFade'), String(el.fade)); $('vChFade').textContent = el.fade ? el.fade+' сек' : 'не исчезают';
    setField(I('iChDir'), el.dir); setField(I('iChAlign'), el.align); setField(I('iChBadges'), el.badges, 'checked');
    setField(I('iChMax'), String(el.max)); $('vChMax').textContent=String(el.max);
  }
  if(el.type==='msg'){ setField(I('iMaxw'), String(el.maxw)); $('vMaxw').textContent=Math.round(el.maxw)+'% экрана'; setField(I('iMsgAccent'), el.accent); setField(I('iMsgCard'), el.card); }
  if(el.type==='cs2'){ renderCsHud(el); $('csSideRow').hidden = el.view!=='teams'; $('csStreakRow').hidden = el.view!=='streak'; setField(I('iCsMinK'), String(el.minK)); setField(I('iCsSide'), el.side); setField(I('iCsView'), el.view); setField(I('iCsLabel'), el.label); setField(I('iCsAccent'), el.accent); setField(I('iCsCard'), el.card); renderCsStatus(); }
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
  if(el.type==='image'||el.type==='video'||el.type==='stream'){
    setField(I('iHh'), String(el.hh||0)); $('vHh').textContent = el.hh ? el.hh.toFixed(1)+'% высоты' : 'по пропорциям';
    $('bRatio').disabled = !el.hh;
  }
  $('bCrop').disabled = !el.crop;
  setField(I('iRot'), String(Math.round(normRot(el.rot)))); $('vRot').textContent=Math.round(normRot(el.rot))+'°';
  setField(I('iOp'), String(el.op)); $('vOp').textContent=Math.round(el.op*100)+'%';
}
// ---- выделение: несколько элементов, группы ----
const msel=new Set();
function groupOf(id){ const el=byId(id); return el?.g ? state.els.filter(e=>e.g===el.g).map(e=>e.id) : [id]; }
function select(id, mode='replace'){
  selFolder=null;
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

// ---- привязка к другим элементам: края и центры видимых, порог ~0.8% кадра ----
const SNAP_THR = 0.8;
function snapSetup(exclude){
  const r=stage.getBoundingClientRect(), xs=[], ys=[];
  for(const el of state.els){
    if(exclude.has(el.id) || el.hidden) continue;
    const b=boxOf(el.id); if(!b || b.r-b.l<0.05 || b.b-b.t<0.05) continue;
    xs.push({ v:b.l, id:el.id }, { v:(b.l+b.r)/2, id:el.id }, { v:b.r, id:el.id });
    ys.push({ v:b.t, id:el.id }, { v:(b.t+b.b)/2, id:el.id }, { v:b.b, id:el.id });
  }
  return { xs, ys, thrX:SNAP_THR, thrY:SNAP_THR*r.width/r.height };   // по вертикали порог в тех же пикселях
}
// Ближайшая линия к одной из точек (левый край, центр, правый край двигаемого). d — на сколько сдвинуть.
function snapMove(pts, lines, thr){
  let best=null;
  for(const p of pts) for(const l of lines){ const d=l.v-p; if(Math.abs(d)<thr && (!best || Math.abs(d)<Math.abs(best.d))) best={ d, v:l.v, id:l.id }; }
  return best;
}
let snapShown=[];
function showSnap(vx, vy, ids){
  for(const [id, pos] of [['gv2', vx], ['gh2', vy]]){ const g=$(id); g.classList.toggle('show', pos!=null); if(pos!=null) g.style[id==='gv2'?'left':'top']=pos+'%'; }
  for(const id of snapShown) nodes.get(id)?.classList.remove('snapT');
  snapShown=(vx!=null || vy!=null) ? [...new Set(ids||[])] : [];
  for(const id of snapShown) nodes.get(id)?.classList.add('snapT');
}
const noSnap = e => e.ctrlKey || e.metaKey;
// ---- размер за любой край: общий расчёт для одного элемента (оси элемента) и группы (оси кадра) ----
// Магнит двигаемого края: сетка, края и центры других элементов, границы и середина кадра. Работает без поворота (или на 180°).
function rzSnap(d, axis, pos){
  if(!d.sg || !d.sn) return null;
  const isX=axis==='u', base=isX ? d.cx-d.r.left : d.cy-d.r.top, size=isX ? d.r.width : d.r.height;
  const wp=(base+d.sg*pos)/size*100;
  let line=null;
  if(gridOn){ line={ v:Math.round(wp/gridStep)*gridStep, grid:true }; }
  else {
    const thr=isX ? d.sn.thrX : d.sn.thrY;
    for(const l of [...(isX ? d.sn.xs : d.sn.ys), { v:0 }, { v:50 }, { v:100 }]) if(Math.abs(l.v-wp)<thr && (!line || Math.abs(l.v-wp)<Math.abs(line.v-wp))) line=l;
  }
  return line ? { pos:d.sg*(line.v/100*size-base), v:line.grid ? null : line.v, id:line.id } : null;
}
// kx, ky: во сколько раз меняется видимая часть; a: якорь в осях элемента; uni: один общий множитель
function rzSolve(d, e, a, sym, uni){
  const p=d.loc(e.clientX, e.clientY), ep={ u:d.g.u + (p.u - d.p0.u), v:d.g.v + (p.v - d.p0.v) };
  const k1=ax=>{ const gv=d.g[ax]-a[ax]; return Math.abs(gv)<1e-6 ? 1 : (ep[ax]-a[ax])/gv; };
  const minK=ax=>8/Math.max(1, ax==='u' ? d.vw : d.vh);
  const snap={ vx:null, vy:null, ids:[] };
  const useSnap=!(e.altKey);
  let kx=1, ky=1;
  if(uni){
    let k;
    if(d.sx && d.sy){
      const gu=d.g.u - a.u, gv=d.g.v - a.v; k=((ep.u - a.u)*gu + (ep.v - a.v)*gv)/(gu*gu+gv*gv);
    } else k=d.sx ? k1('u') : k1('v');
    k=Math.max(k, minK(d.sx ? 'u' : 'v'));
    if(useSnap){
      let best=null;
      for(const [ax,s] of [['u',d.sx],['v',d.sy]]){
        if(!s) continue;
        const r=rzSnap(d, ax, a[ax]+(d.g[ax]-a[ax])*k); if(!r) continue;
        const kk=(r.pos-a[ax])/(d.g[ax]-a[ax]);
        if(kk>0 && (!best || Math.abs(kk-k)<Math.abs(best.k-k))) best={ k:kk, r, ax };
      }
      if(best){ k=best.k; if(best.ax==='u') snap.vx=best.r.v; else snap.vy=best.r.v; if(best.r.id) snap.ids.push(best.r.id); }
    }
    kx=ky=k;
  } else {
    for(const [ax,s] of [['u',d.sx],['v',d.sy]]){
      if(!s) continue;
      if(useSnap){
        const r=rzSnap(d, ax, ep[ax]);
        if(r){ ep[ax]=r.pos; if(ax==='u') snap.vx=r.v; else snap.vy=r.v; if(r.id) snap.ids.push(r.id); }
      }
    }
    if(d.sx) kx=Math.max(k1('u'), minK('u'));
    if(d.sy) ky=Math.max(k1('v'), minK('v'));
  }
  return { kx, ky, snap };
}

stage.addEventListener('pointerdown', e=>{
  if(e.button!==0) return;
  const gh=e.target.closest('#grpBox .h');
  if(gh){ startGroupScale(e, gh.dataset.d); return; }
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
  const opened=!changeOpen; beginChange();   // простой клик без движения не оставляет шага отмены (см. endDrag)
  const { cx, cy, r }=centerPx(el);
  const prevHandle = lastHandle; lastHandle={ t:Date.now(), h, id:el.id, d:e.target.dataset?.d }; void prevHandle;
  const full = node.classList.contains('full') || el.type==='case';
  if(h==='rz'){
    const dir=e.target.dataset.d, alt=e.altKey, canCrop=CROPPABLE.has(el.type);
    const sx=dir.includes('e')?1:dir.includes('w')?-1:0, sy=dir.includes('s')?1:dir.includes('n')?-1:0;
    if(Date.now()-(prevHandle.t||0)<400 && prevHandle.d===dir && prevHandle.id===el.id){
      if(alt && canCrop){   // Alt + двойной клик по краю: сбросить обрезку с этой стороны
        const c=[...(el.crop||[0,0,0,0])]; if(sx>0) c[2]=0; if(sx<0) c[0]=0; if(sy>0) c[3]=0; if(sy<0) c[1]=0;
        if(c.some(v=>v>=0.01)) el.crop=c; else delete el.crop;
        commit(); toast('Обрезка сброшена'); return;
      }
      if(!alt && BOXABLE.has(el.type) && dir.length===1 && !full){ if(sx) el.bw=0; else el.bh=0; commit(); toast('Размер снова по содержимому'); return; }
    }
    const fx=node.querySelector('.fx'), W=fx.offsetWidth||1, H=fx.offsetHeight||1, a=el.rot*Math.PI/180;
    const ca=Math.cos(a), sa=Math.sin(a), cr=el.crop||[0,0,0,0];
    const loc=(X,Y)=>({ u:(X-cx)*ca+(Y-cy)*sa, v:-(X-cx)*sa+(Y-cy)*ca });
    const uL=W*(cr[0]/100-.5), uR=W*(.5-cr[2]/100), vT=H*(cr[1]/100-.5), vB=H*(.5-cr[3]/100);   // видимая часть в осях элемента
    const c={ u:(uL+uR)/2, v:(vT+vB)/2 };
    const g={ u:sx>0?uR:sx<0?uL:c.u, v:sy>0?vB:sy<0?vT:c.v }, opp={ u:sx>0?uL:sx<0?uR:c.u, v:sy>0?vT:sy<0?vB:c.v };
    const base={ sx, sy, dir, loc, W, H, g, c, opp, vw:uR-uL, vh:vB-vT, p0:loc(e.clientX,e.clientY), cx, cy, r, ca, sa, x0:el.x, y0:el.y, sg:Math.abs(sa)<1e-3?(ca>0?1:-1):0 };
    if(alt && canCrop) drag={ mode:'crop', ...base, cr0:[...cr] };
    else drag={ mode:'rz', ...base, full, f0:{ fs:el.fs, w:el.w, hh:el.hh||0, bw:el.bw||0, bh:el.bh||0, hhEff:el.hh||H/r.height*100 } };
  } else if(h==='rot' || e.altKey){
    drag={ mode:'rot', cx, cy, prev:angleOf(e,cx,cy), acc:0, rot0:el.rot };
  } else {
    // двигаем всё выделенное; рамка всей группы не должна вылезти за край кадра
    const items=selList().map(x=>({ id:x.id, x0:x.x, y0:x.y }));
    const bb=selBounds(items.map(i=>i.id));
    drag={ mode:'move', mx:e.clientX, my:e.clientY, x0:el.x, y0:el.y, r, items, bb };
  }
  drag.id=el.id; drag.opened=opened; drag.moved=false;
  if(drag.mode!=='rot' && drag.mode!=='crop'){
    drag.sn=snapSetup(new Set(drag.mode==='move' ? drag.items.map(i=>i.id) : [el.id]));
    const b=drag.mode==='move' ? drag.bb : boxOf(el.id);
    if(b) drag.b0={ cx:(b.l+b.r)/2, cy:(b.t+b.b)/2, hw:(b.r-b.l)/2, hh:(b.b-b.t)/2 };
  }
  stage.setPointerCapture(e.pointerId);
});
// масштаб всего выделения за рамку из восьми ручек: якорь — противоположная сторона, Ctrl — центр
function startGroupScale(e, dir){
  const list=selList().filter(x=>x.type!=='raffle'); if(list.length<2) return;
  e.preventDefault();
  const r=stage.getBoundingClientRect(), bb=selBounds(list.map(x=>x.id)); if(!bb) return;
  const opened=!changeOpen; beginChange();
  const sx=dir.includes('e')?1:dir.includes('w')?-1:0, sy=dir.includes('s')?1:dir.includes('n')?-1:0;
  const L=bb.l/100*r.width, Rr=bb.r/100*r.width, T=bb.t/100*r.height, B=bb.b/100*r.height, c={ u:(L+Rr)/2, v:(T+B)/2 };
  const g={ u:sx>0?Rr:sx<0?L:c.u, v:sy>0?B:sy<0?T:c.v }, opp={ u:sx>0?L:sx<0?Rr:c.u, v:sy>0?T:sy<0?B:c.v };
  const loc=(X,Y)=>({ u:X-r.left, v:Y-r.top });
  const items=list.map(t=>({ id:t.id, x0:t.x, y0:t.y, fs:t.fs, w:t.w, hh:t.hh||0, bw:t.bw||0, bh:t.bh||0, full:t.type==='case' || (t.type==='cs2' && CS2_FULL.has(t.view)) }));
  drag={ mode:'grp', sx, sy, loc, g, c, opp, vw:Rr-L, vh:B-T, p0:loc(e.clientX,e.clientY), cx:r.left, cy:r.top, r, sg:1, items, id:list[0].id, opened, moved:false,
    sn:snapSetup(new Set(list.map(x=>x.id))) };
  stage.setPointerCapture(e.pointerId);
}
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
  const el=byId(drag.id); if(!el){ drag=null; changeOpen=false; return; }   // элемент удалил другой модератор
  drag.moved=true;
  if(drag.mode==='move'){
    let x=drag.x0+(e.clientX-drag.mx)/drag.r.width*100;
    let y=drag.y0+(e.clientY-drag.my)/drag.r.height*100;
    const free=e.ctrlKey||e.metaKey, single=drag.items.length===1;
    let snapX=false, snapY=false;
    if(!free && gridOn){ x=Math.round(x/gridStep)*gridStep; y=Math.round(y/gridStep)*gridStep; }
    else if(!free && single){ snapX=Math.abs(x-50)<1.2; snapY=Math.abs(y-50)<1.8; if(snapX) x=50; if(snapY) y=50; }
    let dx=x-drag.x0, dy=y-drag.y0, sx=null, sy=null;
    if(!free && !gridOn && drag.bb && drag.sn){   // сетка важнее привязки к элементам
      const b=drag.bb;
      if(!snapX) sx=snapMove([b.l+dx, (b.l+b.r)/2+dx, b.r+dx], drag.sn.xs, drag.sn.thrX);
      if(!snapY) sy=snapMove([b.t+dy, (b.t+b.b)/2+dy, b.b+dy], drag.sn.ys, drag.sn.thrY);
      if(sx) dx+=sx.d;
      if(sy) dy+=sy.d;
    }
    drag.snapNow={ vx:sx?.v, vy:sy?.v, ids:[sx?.id, sy?.id].filter(Boolean) };
    if(!free && drag.bb){   // не даём рамке выделения выйти за кадр
      const b=drag.bb;
      if(b.r-b.l<100) dx=Math.min(Math.max(dx, -b.l), 100-b.r);
      if(b.b-b.t<100) dy=Math.min(Math.max(dy, -b.t), 100-b.b);
    }
    $('gv').classList.toggle('show', snapX); $('gh').classList.toggle('show', snapY);
    for(const it of drag.items){ const t=byId(it.id); if(t){ t.x=num(it.x0+dx,50,0,100); t.y=num(it.y0+dy,50,0,100); } }
  } else if(drag.mode==='crop'){
    const d=drag, p=d.loc(e.clientX, e.clientY), du=p.u - d.p0.u, dv=p.v - d.p0.v, c=[...d.cr0];
    const lim=(v,opp)=>Math.max(0, Math.min(90-opp, v));
    if(d.sx>0) c[2]=lim(d.cr0[2]-du/d.W*100, c[0]); else if(d.sx<0) c[0]=lim(d.cr0[0]+du/d.W*100, c[2]);
    if(d.sy>0) c[3]=lim(d.cr0[3]-dv/d.H*100, c[1]); else if(d.sy<0) c[1]=lim(d.cr0[1]+dv/d.H*100, c[3]);
    const k=sanitizeCrop(c.map(v=>Math.round(v*100)/100));
    if(k) el.crop=k; else delete el.crop;
  } else if(drag.mode==='rz'){
    const d=drag, tp=el.type, media=tp==='image' || tp==='video' || tp==='stream', box=BOXABLE.has(tp), corner=!!(d.sx && d.sy);
    const sym=e.ctrlKey || e.metaKey || d.full;
    const uni = d.full || (!media && !box) || e.shiftKey || (box && corner);   // общий множитель: шрифт/ширина вместе с высотой
    const a=sym ? d.c : d.opp;
    const R=rzSolve(d, e, a, sym, uni);
    drag.snapNow=R.snap;
    let kx=R.kx, ky=R.ky;
    if(uni){
      const k=kx;
      if('fs' in el){
        el.fs=num(d.f0.fs*k, 8, 0.5, 100); kx=ky=el.fs/d.f0.fs;
        if(box){ if(d.f0.bw>0) el.bw=num(d.f0.bw*kx, 10, 2, 100); if(d.f0.bh>0) el.bh=num(d.f0.bh*kx, 10, 2, 100); }
      } else {
        el.w=num(d.f0.w*k, 25, 1, 200); kx=ky=el.w/d.f0.w;
        if(d.f0.hh) el.hh=num(d.f0.hh*kx, 10, 0.5, 300);
      }
    } else if(media){
      el.w=num(d.f0.w*kx, 25, 1, 200); kx=el.w/d.f0.w;
      if(d.f0.hh>0 || Math.abs(ky-kx)>1e-6){ el.hh=num(d.f0.hhEff*ky, 10, 0.5, 300); ky=el.hh/d.f0.hhEff; } else ky=kx;
    } else {   // рамка своей ширины/высоты; шрифт не трогаем
      if(d.sx){ const w0=d.W/d.r.width*100; el.bw=num(w0*kx, 10, 2, 100); kx=el.bw/w0; } else kx=1;
      if(d.sy){ const h0=d.H/d.r.height*100; el.bh=num(h0*ky, 10, 2, 100); ky=el.bh/h0; } else ky=1;
    }
    // якорь (противоположный край или центр) остаётся на месте: сдвигаем центр элемента
    const du=a.u*(1-kx), dv=a.v*(1-ky);
    el.x=num(d.x0+(du*d.ca-dv*d.sa)/d.r.width*100, 50, 0, 100);
    el.y=num(d.y0+(du*d.sa+dv*d.ca)/d.r.height*100, 50, 0, 100);
  } else if(drag.mode==='grp'){
    const d=drag, a=(e.ctrlKey||e.metaKey) ? d.c : d.opp;
    const R=rzSolve(d, e, a, false, true); drag.snapNow=R.snap;
    const k=R.kx;
    for(const it of d.items){
      const t=byId(it.id); if(!t) continue;
      t.x=num((a.u+(it.x0/100*d.r.width-a.u)*k)/d.r.width*100, 50, 0, 100);
      t.y=num((a.v+(it.y0/100*d.r.height-a.v)*k)/d.r.height*100, 50, 0, 100);
      if(it.full) continue;
      if('fs' in t) t.fs=num(it.fs*k, 8, 0.5, 100); else { t.w=num(it.w*k, 25, 1, 200); if(it.hh) t.hh=num(it.hh*k, 10, 0.5, 300); }
      if(BOXABLE.has(t.type)){ if(it.bw) t.bw=num(it.bw*k, 10, 2, 100); if(it.bh) t.bh=num(it.bh*k, 10, 2, 100); }
    }
  } else {
    const a=angleOf(e,drag.cx,drag.cy); let d=a-drag.prev;
    if(d>180) d-=360; if(d<-180) d+=360;
    drag.acc+=d; drag.prev=a;
    let rot=drag.rot0+drag.acc; if(e.shiftKey) rot=Math.round(rot/15)*15;
    el.rot=rot;
  }
  changed();
  const sn=drag.mode==='rot' ? null : drag.snapNow;
  showSnap(sn?.vx, sn?.vy, sn?.ids);
});
function endDrag(){
  if(!drag) return;
  const d=drag; drag=null; $('gv').classList.remove('show'); $('gh').classList.remove('show'); showSnap();
  if(d.mode==='rect'){ $('selRect').style.display='none'; if(!d.moved && !d.add) select(null); else renderAll(); return; }
  if(!d.moved){ if(d.opened){ changeOpen=false; openChange=null; } renderAll(); return; }   // просто клик: ничего не менялось
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
$('addChatFeed').onclick=()=>{
  const ch=cleanChan(curRoom()?.chat||'');
  if(!ch) toast('Сначала укажи канал Twitch во вкладке «Чат»: пока лента пустая', 4000);
  addEl({ type:'chat', chan:ch, x:16, y:64, fs:2.4, font:'montserrat', color:'#ffffff', card:'#15171d', accent:'#a78bfa', theme:'glass', fade:0, dir:'down', align:'left', max:12, badges:true, bw:26, bh:55 });
};
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.add;
  if(a==='counter') addCounter(); else if(a==='poll') addPoll(); else if(a==='cs2') addCs2(); else addTimer(a);
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
// «Скрыть всё» закрывает глазки у видимых элементов и запоминает их в state.hidAll; «Показать всё» открывает ровно их.
// Открытое вручную в промежутке остаётся открытым, а то, что скрыли руками, «Показать всё» не трогает.
function hidAllList(){ const all=drawList(state); return (state.hidAll||[]).map(id=>all.find(e=>e.id===id)).filter(Boolean); }
function hidAllActive(){ return hidAllList().some(e=>e.hidden); }
function allHiddenNow(){ return hidAllActive() && drawList(state).every(e=>e.hidden); }
function toggleHideAll(){
  beginChange();
  if(hidAllActive()){ for(const e of hidAllList()) if(e.hidden){ e.hidden=false; delete e.ttl; } state.hidAll=[]; }
  else{ const vis=drawList(state).filter(e=>!e.hidden); for(const e of vis){ e.hidden=true; delete e.ttl; } state.hidAll=vis.map(e=>e.id); }
  commit();
}
$('globalEye').onclick=toggleHideAll;
$('undoBtn').onclick=undo;

function widgetLink(){
  const base=WIDGET_BASE_URL || new URL('../widget/widget.html', location.href).href;
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
  if(!await roomKeysOk(r)){ toast('Ключи в приглашении повреждены: попроси новую ссылку', 5000); return false; }
  const ex=rooms.find(x=>x.code===r.code);
  // коды комнат уникальны: чужие ключи не перезаписывают уже сохранённую комнату
  if(ex && (ex.k!==r.k || ex.p!==r.p || JSON.stringify(ex.s)!==JSON.stringify(r.s))){
    alert(`Комната с кодом ${r.code} уже есть, но с другими ключами.\nПриглашение не принято: твоя комната осталась как была.`);
    return false;
  }
  if(!confirm(`Принять приглашение в комнату «${r.name}» (код ${r.code})?\nСсылка даёт полное управление экраном этой комнаты. Принимай только от модератора, которому доверяешь.`)) return false;
  if(!ex) rooms.push(r);
  await switchRoom(r.code); saveRooms(); renderRooms();
  toast(ex ? `Комната «${ex.name}» уже есть: переключаюсь` : `Комната «${r.name}» добавлена`); return true;
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
  // старый экран сбрасываем и ждём брокера (не дольше 3 с): после смены комнаты клиент закрывается
  if(client?.connected) await Promise.race([
    sealedPublish(topics(room).state, { v:2, wv:WIDGET_VER, from:clientId, t:Date.now(), visible:true, els:[] }, { qos:1, retain:true }).catch(()=>{}),
    new Promise(res=>setTimeout(res, 3000))]);
  // сцены, сценарии и библиотека переезжают на новый код комнаты
  const oldCode=r.code, newCode=fresh.code;
  if(scenes[oldCode]){ scenes[newCode]=scenes[oldCode]; delete scenes[oldCode]; saveScenes(); }
  if(scnStore[oldCode]){ scnStore[newCode]=scnStore[oldCode]; delete scnStore[oldCode]; saveScn(); }
  if(library.some(it=>it.room===oldCode)){ for(const it of library) if(it.room===oldCode) it.room=newCode; saveLib(); }
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
// Окно пароля вместо prompt(): поле type=password с кнопкой 👁, ошибки показываются в самом окне.
// fields: [{ label, optional }], check(values) → текст ошибки или null (можно async), sameAs: пароль, который подставляет галочка «Тот же, что на пульт» (в поле он не показывается).
// Возвращает массив значений или null, если окно закрыли.
function pwDialog({ title, note, fields, ok='Готово', check, sameAs }){
  return new Promise(res=>{
    $('pwDlg')?.remove();
    const wrap=document.createElement('div'); wrap.id='pwDlg';
    const form=document.createElement('form'); form.className='lockbox pwbox'; form.autocomplete='off';
    const h=document.createElement('h3'); h.textContent=title; form.appendChild(h);
    if(note){ const p=document.createElement('div'); p.className='hint'; p.textContent=note; form.appendChild(p); }
    const inputs=fields.map((f,i)=>{
      const lab=document.createElement('label'); lab.className='pwf';
      const sp=document.createElement('span'); sp.textContent=f.label;
      const row=document.createElement('div'); row.className='pwrow';
      const inp=document.createElement('input'); inp.type='password'; inp.autocomplete='new-password'; inp.spellcheck=false; inp.dataset.i18nSkip='';
      const eye=document.createElement('button'); eye.type='button'; eye.className='pweye'; eye.title='Показать / скрыть пароль'; eye.textContent='👁';
      eye.onclick=()=>{ const show=inp.type==='password'; inp.type=show?'text':'password'; eye.textContent=show?'🙈':'👁'; inp.focus(); };
      row.append(inp, eye); lab.append(sp, row); form.appendChild(lab); return inp;
    });
    let same=null;
    if(sameAs){
      const lab=document.createElement('label'); lab.className='chk';
      same=document.createElement('input'); same.type='checkbox';
      same.onchange=()=>{ inputs[0].disabled=same.checked; if(!same.checked) inputs[0].focus(); };
      lab.append(same, document.createTextNode(' '), document.createTextNode(gT('Тот же, что на пульт'))); form.appendChild(lab);
    }
    const err=document.createElement('div'); err.className='hint pwerr'; form.appendChild(err);
    const btns=document.createElement('div'); btns.className='row';
    const go=document.createElement('button'); go.type='submit'; go.id='pwOk'; go.className='primary grow'; go.textContent=ok;
    const no=document.createElement('button'); no.type='button'; no.id='pwCancel'; no.textContent='Отмена';
    btns.append(go, no); form.appendChild(btns); wrap.appendChild(form); document.body.appendChild(wrap);
    const close=v=>{ wrap.remove(); res(v); };
    no.onclick=()=>close(null);
    wrap.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(null); } });
    let busy=false;
    form.onsubmit=async e=>{
      e.preventDefault(); if(busy) return;
      const v=inputs.map(i=>i.value); if(same?.checked) v[0]=sameAs;
      const empty=fields.findIndex((f,i)=>!f.optional && !v[i]);
      const fail=m=>{ err.textContent=m; busy=false; go.disabled=false; (same?.checked ? same : inputs[Math.max(0, empty)]).focus(); };
      busy=true; go.disabled=true;
      if(empty>=0) return fail(gT('Введи пароль'));
      if(check){ err.textContent=gT('Проверяю…'); const m=await check(v); if(m) return fail(gT(m)); }
      close(v);
    };
    inputs[0].focus();
  });
}
// Бэкап: в нём закрытые ключи, поэтому он всегда зашифрован паролем
$('roomExport').onclick=async()=>{
  const r=await pwDialog({ title:'Пароль для файла бэкапа', note:'В бэкапе ключи всех комнат, поэтому файл всегда шифруется. Без пароля его не открыть.', fields:[{ label:'Пароль бэкапа' }], sameAs:vaultPass||null });
  if(!r) return;
  const pass=r[0];
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
  if(!data || typeof data!=='object' || Array.isArray(data)) return toast('Это не файл бэкапа оверлея');
  if(data.overlayBackup===2){
    const boxData=data.box; let opened=null;
    const r=await pwDialog({ title:'Пароль от файла бэкапа', fields:[{ label:'Пароль' }], check:async v=>{ opened=await unlockJSON(v[0], boxData); return opened && typeof opened==='object' ? null : 'Неверный пароль'; } });
    if(!r) return;
    data=opened;
  } else if(!confirm('Файл бэкапа без пароля: добавить из него комнаты, сцены и сценарии? Открывай только файлы, которым доверяешь.')) return;
  const arr=v=>Array.isArray(v) ? v : [];
  let added=0, libAdded=0, animAdded=0;
  for(const raw of arr(data.rooms)){ const r=cleanRoom(raw); if(r && !rooms.some(x=>x.code===r.code) && await roomKeysOk(r)){ rooms.push(r); added++; } }
  for(const r of arr(data.overlayRooms)) if(validCode(r?.code) && !r.k){ rooms.push(await makeRoom(r.name)); added++; }   // старый бэкап без ключей
  for(const raw of arr(data.library)){ const it=cleanLibItem(raw); if(it && !library.some(l=>JSON.stringify(l.el)===JSON.stringify(it.el))){ library.push(it); libAdded++; } }
  for(const a of arr(data.anims)){ const fr=sanitizeFrames(a?.f); if(fr.length && !myAnims.some(m=>m.name===a.name)){ myAnims.push({ name:String(a.name).slice(0,40), mode:KF_MODES.includes(a.mode)?a.mode:'loop', end:KF_ENDS.includes(a.end)?a.end:'stay', f:fr }); animAdded++; } }
  const inScenes=cleanScenes(data.scenes), inScn=cleanScnStore(data.scenarios);
  for(const [code, list] of Object.entries(inScenes)) scenes[code]=[...(scenes[code]||[]), ...list].slice(0, 200);
  for(const [code, list] of Object.entries(inScn)){
    const have=new Set((scnStore[code]||[]).map(x=>x.id)); scnStore[code]=[...(scnStore[code]||[]), ...list.filter(x=>!have.has(x.id))].slice(0, 200); }
  saveRooms(); saveLib(); saveAnims(); saveScenes(); saveScn(); renderRooms(); renderLib(); renderKfPresets(); renderScenes(); renderScn();
  toast(`Добавлено: комнат ${added}, элементов ${libAdded}, анимаций ${animAdded}`);
};

// --- пароль на пульт ---
// Без пароля ключи комнат лежат в браузере открытым текстом: напоминаем, пока пароль не поставят («Позже» — на 3 дня)
const VAULT_SNOOZE='overlay.vaultWarn';
function renderLockBtns(){
  $('passBtn').textContent = vaultPass ? '🔒 Пароль ✓' : '⚠ Нет пароля'; $('lockBtn').hidden=!vaultPass;
  $('passBtn').classList.toggle('warn', !vaultPass);
  // the first-run tour goes first: the warning appears after it ends
  $('vaultWarn').hidden = !!vaultPass || !rooms.length || Date.now() < Number(lsGet(VAULT_SNOOZE, 0)) || !!window.HudiniUI?.tourPending();
}
addEventListener('hudini:tourend', renderLockBtns);
$('vaultWarnSet').onclick=()=>$('passBtn').click();
$('vaultWarnLater').onclick=()=>{ lsSet(VAULT_SNOOZE, Date.now()+3*24*3600e3); renderLockBtns(); };
// «Больше не показывать»: карточка не появится, но кнопка «⚠ Нет пароля» остаётся оранжевой
$('vaultWarnNever').onclick=()=>{ lsSet(VAULT_SNOOZE, Number.MAX_SAFE_INTEGER); renderLockBtns(); };
$('passBtn').onclick=async()=>{
  const NEW_CHECK=(v, i)=>v[i].length<6 ? 'Пароль хотя бы 6 символов' : v[i]!==v[i+1] ? 'Пароли не совпали' : null;
  if(vaultPass){
    const r=await pwDialog({ title:'Сменить или снять пароль', fields:[{ label:'Текущий пароль' }, { label:'Новый пароль (пусто: снять пароль)', optional:true }, { label:'Повтори новый пароль', optional:true }],
      check:v=>v[0]!==vaultPass ? 'Неверный пароль' : v[1] ? NEW_CHECK(v, 1) : null });
    if(!r) return;
    vaultPass=r[1]||null;
    if(!vaultPass){ await syncSessions(); sessSecrets={}; }   // пароль снят: ключи сессий возвращаются в список
  } else {
    const r=await pwDialog({ title:'Пароль на пульт', note:'Хотя бы 6 символов. Без пароля никто с этого компьютера не откроет твои комнаты. Запомни его: восстановить нельзя, только из бэкапа.',
      fields:[{ label:'Пароль' }, { label:'Повтори пароль' }], check:v=>NEW_CHECK(v, 0) });
    if(!r) return;
    vaultPass=r[0];
  }
  await saveRooms();
  if(vaultPass) await syncSessions().catch(e=>console.warn('sessions vault', e)); renderLockBtns(); toast(vaultPass ? 'Пароль установлен 🔒' : 'Пароль снят');
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
function chatConnect(ch){
  chatDisconnect();
  ch=cleanChannel(ch);
  if(!ch) return;
  { const r=curRoom(); if(r && r.chat!==ch){ r.chat=ch; saveRooms(); window.__webChatRefresh?.(); } } $('chatChan').value=ch;
  const ws=new WebSocket('wss://irc-ws.chat.twitch.tv:443'); chatWs=ws;
  setPill($('chatStatus'), 'warn', 'подключение…'); $('chatBtn').textContent='Отключить';
  ws.onopen=()=>{ ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands'); ws.send('PASS SCHMOOPIIE'); ws.send('NICK justinfan'+(10000+Math.random()*80000|0)); ws.send('JOIN #'+ch); };
  ws.onmessage=ev=>{
    for(const line of String(ev.data).split('\r\n')){
      if(!line) continue;
      if(line.startsWith('PING')){ ws.send('PONG'+line.slice(4)); continue; }
      if(/ 366 /.test(line)) setPill($('chatStatus'), 'ok', '#'+ch);
      const r=ircMessage(line);
      if(r?.type==='room') ThirdEmotes.room(r.id);
      if(r?.type!=='msg') continue;
      const msg=r.msg;
      onChat(msg.login, msg.text, msg);
      addChatRow(msg);
    }
  };
  ws.onclose=()=>{ if(chatWs!==ws) return; setPill($('chatStatus'), 'bad', 'переподключение…'); setTimeout(()=>{ if(chatWs===ws) chatConnect(ch); }, 3000); };
}
// ---- лента чата в пульте ----
function chatRowNode(m){
  const row=document.createElement('div'); row.className='cm'; row.dataset.id=m.id; row.title='Клик — показать на стриме';
  const tm=document.createElement('span'); tm.className='tm'; tm.textContent=new Date(m.t).toLocaleTimeString(uiLocale(),{hour:'2-digit',minute:'2-digit'});
  row.appendChild(tm);
  if(m.badge){ const b=document.createElement('span'); b.className='b'; b.textContent=BADGE[m.badge]; row.appendChild(b); }
  const u=document.createElement('span'); u.className='u'; u.style.color=m.color; u.textContent=m.user; row.append(u, document.createTextNode(': '));
  const tmp=document.createElement('div'); paintMsg(tmp, { user:'', ucolor:'#000000', text:m.text, emotes:m.emotes, xe:ThirdEmotes.find(m.text, m.emotes, m.rid), badge:'' });
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
  const data={ user:m.user, ucolor:m.color, text:m.text, emotes:m.emotes, xe:ThirdEmotes.find(m.text, m.emotes, m.rid), badge:m.badge };
  const prev=[...state.els].reverse().find(e=>e.type==='msg');
  if(!(prev && $('msgReplace').checked) && state.els.length>=MAX_ELS) return toast('Слишком много элементов: на экране максимум '+MAX_ELS);
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
// Смайлы 7TV/BTTV/FFZ: настройка комнаты. Едет в экране (state.emx), чтобы виджет и другие пульты знали.
function emxNow(){ return state.emx || curRoom()?.emx || cleanEmx(null); }
function syncEmx(){
  const x=emxNow(), r=curRoom();
  if(state.emx && r && JSON.stringify(r.emx)!==JSON.stringify(state.emx)){ r.emx={ ...state.emx }; saveRooms(); }   // другой пульт поменял
  for(const p of EMX_PROV){ const f=$('emx_'+p); if(f) f.checked=x[p]; }
  if(JSON.stringify(ThirdEmotes.on)!==JSON.stringify(x)){ ThirdEmotes.setOn(x); if(chatLog.length) rebuildFeed(); }
}
for(const p of EMX_PROV) $('emx_'+p)?.addEventListener('change', e=>{ beginChange(); state.emx={ ...emxNow(), [p]:e.target.checked }; commit(); });
let emxT=0;
ThirdEmotes.onReady=()=>{ clearTimeout(emxT); emxT=setTimeout(()=>{ if(chatLog.length) rebuildFeed(); }, 300); };   // набор смайлов загрузился: перерисовать ленту
function chatDisconnect(){ const ws=chatWs; chatWs=null; ws?.close(); setPill($('chatStatus'), '', 'выкл'); $('chatBtn').textContent='Подключить'; }
$('chatBtn').onclick=()=>{ if(chatWs){ chatDisconnect(); const r=curRoom(); if(r){ delete r.chat; saveRooms(); window.__webChatRefresh?.(); } } else chatConnect($('chatChan').value); };
$('chatChan').addEventListener('keydown', e=>{ if(e.key==='Enter') $('chatBtn').click(); });
// Чат читает каждый пульт сам. Голос и засчитанное сообщение лежат в самом элементе (el.vk, el.cids), поэтому
// одно сообщение, пришедшее в два пульта, засчитывается один раз. chatPend: что этот пульт добавил недавно
// и другие ещё могли не увидеть (id элемента → ключ → время); при приёме чужого экрана это добавляется в него.
const chatPend=new Map(), PEND_MS=20000;
function pendMark(id, key){ let m=chatPend.get(id); if(!m){ m=new Map(); chatPend.set(id, m); } m.set(key, Date.now()); }
function pollNewRound(el){ el.vround=rid(8); el.vk=Object.create(null); el.votes=el.opts.map(()=>0); chatPend.delete(el.id); }
// чужой экран s (собран в момент t) пришёл: объединить с ним голоса и сообщения этого пульта. true = в s что-то добавилось.
// Зритель передумал: побеждает выбор, засчитанный позже, чем собран чужой экран (иначе тот экран его уже видел).
function mergeChat(s, t=Infinity){
  const now=Date.now(); let added=false;
  for(const r of s.els){
    const l=byId(r.id); if(!l || l.type!==r.type) continue;
    const pend=chatPend.get(r.id);
    if(r.type==='poll'){
      if(l.vround!==r.vround || !l.vk){ chatPend.delete(r.id); continue; }   // новый раунд у другого пульта
      let n=Object.keys(r.vk).length;
      for(const k of Object.keys(l.vk)){
        const i=l.vk[k]; if(!(i>=0 && i<r.opts.length)) continue;
        const pt=pend?.get(k)||0, has=Object.hasOwn(r.vk, k), fresh=pt>now-PEND_MS && pt>t;
        if(has && r.vk[k]===i){ pend?.delete(k); continue; }
        if(has ? fresh : n<VK_MAX){ if(!has) n++; r.vk[k]=i; added=true; }
      }
      if(added) r.votes=pollTally(r.vk, r.opts.length);
    } else if(r.type==='roulette'){
      for(const [k, v] of Object.entries(l.vcnt||{})) if(v>(r.vcnt[k]||0)){ r.vcnt[k]=v; added=true; }   // счётчики зрителей: берём большее
      if(pend) for(const [k, t] of pend){
        if(t<now-PEND_MS){ pend.delete(k); continue; }
        if(!k.startsWith('p:')) continue;
        const n=k.slice(2), low=n.toLowerCase(), has=a=>(a||[]).some(p=>p.n.toLowerCase()===low);
        if(!has(r.people) && !has(r.used) && has(l.people) && r.people.length<ROU_PEOPLE){ r.people.push({ n, w:1 }); added=true; }   // наш участник, которого чужой экран ещё не видел
      }
    } else if(r.type==='counter' && r.cmode==='chat' && pend){
      const ids=new Set(r.cids);
      for(const [id, t] of pend){
        if(ids.has(id) || t<now-PEND_MS){ pend.delete(id); continue; }
        r.value+=l.step; r.cids.push(id); ids.add(id); added=true;
      }
      for(const id of l.cids||[]) if(!ids.has(id)){ r.cids.push(id); ids.add(id); }   // эхо этих сообщений тоже не считать
      r.cids=r.cids.slice(-CIDS_MAX);
    }
  }
  return added;
}
// ---- розыгрыш: участники живут в пульте (и в хранилище, чтобы пережить перезагрузку пульта) ----
// Участники у каждой комнаты свои: при смене комнаты карты очищаются, в хранилище ключ с кодом комнаты
const rafPool=new Map();     // id розыгрыша → Map(login → { user, color, sub })
const rafSkip=new Map();     // id → Set(login) не ответивших победителей
const rafKey=id=>`hudini.raf.${room}.${id}`;
function rafEntries(id){
  if(!rafPool.has(id)){
    let list=lsGet(rafKey(id), null);
    // раньше ключ был без комнаты: участников забирает комната, которая первой откроет розыгрыш
    if(list==null){ list=lsGet('hudini.raf.'+id, null); if(list!=null){ HudiniStore.remove('hudini.raf.'+id); lsSet(rafKey(id), list); } }
    let m; try{ m=new Map((Array.isArray(list) ? list : []).filter(p=>Array.isArray(p) && typeof p[0]==='string' && p[1] && typeof p[1]==='object' && typeof p[1].user==='string')); }catch{ m=new Map(); }
    rafPool.set(id, m);
  }
  return rafPool.get(id);
}
let rafSaveT=null, rafSaveFn=null;
function rafSave(id){
  const k=rafKey(id), m=rafEntries(id);
  clearTimeout(rafSaveT); rafSaveFn=()=>{ rafSaveT=rafSaveFn=null; lsSet(k, [...m].slice(-20000)); }; rafSaveT=setTimeout(rafSaveFn, 800);
}
function rafFlush(){ if(rafSaveFn){ clearTimeout(rafSaveT); rafSaveFn(); } }
function rafWanted(el, text, msg){
  if(el.subs && !(msg?.sub || msg?.badge==='broadcaster')) return false;
  if(el.entry==='any') return true;
  const kw=el.kw.toLowerCase(), low=text.trim().toLowerCase();
  return low===kw || low.startsWith(kw+' ');
}
function rafOnChat(user, text, msg){
  let any=false;
  for(const el of [raf()].filter(Boolean)){
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
  const pool=[...rafEntries(el.id)].filter(([login, e])=>!skip.has(login) && !won.has(String(e?.user||'').toLowerCase()));
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
  try{
  for(const el of [raf()].filter(Boolean)){
    if(el.phase==='collect' && el.closeAt && now>=el.closeAt){ el.closeAt=0; el.phase='closed'; any=true; if(el.auto) rafSpin(el); }
    // победитель не ответил: крутим снова без него
    if(el.phase==='spin' && el.confirm && !el.ok && el.cUntil && now>=el.cUntil+1500){
      let sk=rafSkip.get(el.id); if(!sk){ sk=new Set(); rafSkip.set(el.id, sk); } sk.add(el.wlogin);
      toast(`⌛ ${el.winner} не ответил, перекручиваем`);
      if(!rafSpin(el)){ el.phase='closed'; el.cUntil=0; }
      any=true;
    }
  }
  }catch(e){ console.warn('raffle tick', e); return; }
  if(any){ renderAll(); publishNow(1); }
}
function renderRaffle(el){
  setField(I('iRTitle'), el.title); setField(I('iRPrize'), el.prize); setField(I('iREntry'), el.entry); I('iRKw').placeholder=cmdWord('!участвую', streamLang()); setField(I('iRKw'), el.kw);
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
// ---- кейс ----
const CASE_SND=[['in','Подлёт и посадка'],['tense','Нарастание'],['lock','Защёлки'],['open','Открытие'],['tick','Щелчок ленты'],['win','Выпадение']];
function casePick(el, spOk){
  const pool=el.items.map((it,i)=>[i,it.p]).filter(([i,p])=>p>0 && (spOk || !el.items[i].sp)); if(!pool.length) return -1;
  const total=pool.reduce((a,[,p])=>a+p,0), r=new Uint32Array(1); crypto.getRandomValues(r);
  let x=r[0]/2**32*total; for(const [i,p] of pool){ x-=p; if(x<0) return i; } return pool[pool.length-1][0];
}
const cryptoUnit=()=>{ const r=new Uint32Array(1); crypto.getRandomValues(r); return r[0]/2**32; };
function caseOpen(el, donor, amount){
  if(!el.items.some(it=>it.p>0 && !it.sp)) return toast('Добавь предметы с шансом больше 0'), false;
  // вид этого открытия: у рандомного решается здесь, сильной случайностью, и зрители про него не знают
  const kind = el.kind==='random' ? (cryptoUnit()<0.5 ? 'bait' : 'normal') : el.kind;
  el.kindNow = el.kind==='random' ? kind : '';
  const spOk = kind==='second';   // карточка «Перекрут» выпадает только во втором шансе
  const win=casePick(el, spOk);
  const all=el.items.map((_, i)=>i).filter(i=>spOk || !el.items[i].sp);
  const rndFrom=idxs=>{ const pool=idxs.map(i=>[i,el.items[i].p]).filter(([,p])=>p>0); const tot=pool.reduce((a,[,p])=>a+p,0); let x=Math.random()*tot; for(const [i,p] of pool){ x-=p; if(x<0) return i; } return pool[0][0]; };
  const rnd=()=>rndFrom(all);
  const reel=Array.from({ length:CASE_REEL }, ()=> Math.random()<0.18 ? all[Math.random()*all.length|0] : rnd());
  reel[CASE_WIN]=win; reel[CASE_WIN-1]=rnd(); reel[CASE_WIN+1]=rnd();
  el.bmode='under';
  if(kind==='bait'){
    // «почти-почти»: рядом с выигрышем стоит самый редкий предмет (если выпало не самое редкое). Лента недокручивает и дотягивает
    // или проскакивает на него и откатывается назад
    const rarest=all.reduce((b,i)=> el.items[i].r>el.items[b].r ? i : b, all[0]);
    const near = el.items[win].r < el.items[rarest].r ? rarest : rnd();
    el.bmode = cryptoUnit()<0.5 ? 'over' : 'under';
    reel[el.bmode==='over' ? CASE_WIN+1 : CASE_WIN-1] = near;
    el.jit=(Math.random()-0.5)*0.6;
  } else el.jit=(Math.random()-0.5)*0.8;   // обычная: точка остановки где угодно внутри карточки
  el.reel=reel; el.win=win;
  // второй шанс: выпала карточка «Перекрут» — вторая лента из обычных предметов по их шансам
  el.reel2=[]; el.win2=-1; el.jit2=0;
  if(kind==='second' && el.items[win].sp){
    const plain=all.filter(i=>!el.items[i].sp && el.items[i].p>0);
    if(plain.length){
      const w2=rndFrom(plain);
      el.reel2=Array.from({ length:CASE_REEL }, ()=>rndFrom(plain)); el.reel2[CASE_WIN]=w2; el.win2=w2; el.jit2=(Math.random()-0.5)*0.8;
    }
  }
  const fin=caseWinIdx(el);
  el.donor=String(donor||'').slice(0,40); el.amount=String(amount||'').slice(0,24);
  el.openAt=Date.now()+500; el.hidden=false; el.ttl=el.openAt+caseT(el).reveal+el.hideAfter*1000;
  const h=lsGet('hudini.caseHist', []); h.unshift({ t:Date.now(), d:el.donor, n:el.items[fin].n, r:el.items[fin].r, c:el.name }); lsSet('hudini.caseHist', h.slice(0,100));
  return true;
}
function renderCase(el){
  setField(I('iKName'), el.name); setField(I('iKColor'), el.cc); setField(I('iKVol'), String(el.vol)); setField(I('iKHide'), String(el.hideAfter)); I('iKLow').checked=el.q==='low'; setField(I('iKUhh'), el.uhhText); setField(I('iKUpT'), el.upText);
  $('kLogoDel').hidden=!el.logo;
  const used=it=>!it.sp || el.kind==='second', sum=el.items.reduce((a,it)=>a+(used(it)?it.p:0),0);
  $('kSum').textContent=`· ${el.items.length} · шансы: ${+sum.toFixed(2)}%`; $('kSum').style.color = Math.abs(sum-100)<0.01 ? '' : 'var(--warn)';
  $('kFix').hidden = Math.abs(sum-100)<0.01 || !sum;
  const busy = el.openAt && nowMs() < el.openAt+caseT(el).reveal;
  for(const r of document.querySelectorAll('#kKinds input')) r.checked = r.value===el.kind;
  $('kSp').hidden = el.kind!=='second' || el.items.some(it=>it.sp);
  $('kOpen').disabled=!!busy; $('kTest').disabled=!!busy;
  $('kInfo').textContent = busy ? 'Кейс открывается на стриме…' : Math.abs(sum-100)>=0.01 && sum ? 'Шансы в сумме не 100%: при открытии они считаются пропорционально.' : '';
  const box=$('kItems');
  if(document.activeElement?.closest('#kItems')) return;   // не перерисовывать, пока печатают
  box.replaceChildren(...el.items.map((it,i)=>{
    const r=document.createElement('div'); r.className='row kit'; r.dataset.i=i; r.style.borderLeft=`3px solid ${it.sp ? '#35d0ff' : RARITY7[it.r]}`; if(it.sp && el.kind!=='second') r.style.opacity='.45'; r.style.paddingLeft='6px';
    const pic=document.createElement('button'); pic.className='kpic'; pic.title='Картинка предмета'; pic.dataset.act='img';
    if(it.img){ const im=document.createElement('img'); im.src=resolveSrc(it.img); im.style.cssText='width:26px;height:20px;object-fit:contain'; pic.appendChild(im); } else pic.textContent='🖼';
    const nm=document.createElement('input'); nm.type='text'; nm.className='grow'; nm.value=it.n; nm.placeholder=it.sp ? 'Перекрут' : 'Предмет'; if(it.sp) nm.title='Карточка «Перекрут»: выпала — лента крутится ещё раз'; nm.dataset.f='n'; nm.style.minWidth='60px';
    const rr=document.createElement('select'); rr.dataset.f='r'; rr.style.width='84px'; RARITY_NAME.forEach((n,k)=>{ const o=new Option(n,k); o.style.color=RARITY7[k]; rr.appendChild(o); }); rr.value=String(it.r); if(it.sp) rr.hidden=true;
    const pp=document.createElement('input'); pp.type='number'; pp.min='0'; pp.max='100'; pp.step='0.1'; pp.value=String(it.p); pp.dataset.f='p'; pp.style.width='58px'; pp.title='Шанс, %';
    const del=document.createElement('button'); del.textContent='✕'; del.title='Убрать предмет'; del.dataset.act='del';
    r.append(pic, nm, rr, pp, del); return r;
  }));
  const sb=$('kSnd'); if(!sb.children.length) sb.append(...CASE_SND.map(([k,n])=>{ const r=document.createElement('div'); r.className='row'; r.dataset.k=k;
    const l=document.createElement('span'); l.className='hint grow'; l.textContent=n; const b=document.createElement('button'); b.dataset.act='snd'; const d=document.createElement('button'); d.dataset.act='sdel'; d.textContent='🗑'; d.title='Вернуть встроенный звук';
    r.append(l,b,d); return r; }));
  for(const r of sb.children){ const k=r.dataset.k; r.querySelector('[data-act=snd]').textContent = el.snd[k] ? '🔊 ✓' : '📁'; r.querySelector('[data-act=sdel]').hidden=!el.snd[k]; }
  const h=lsGet('hudini.caseHist', []); const hb=$('kHist'); hb.dataset.i18nSkip='';
  hb.textContent = h.length ? h.slice(0,30).map(x=>`${new Date(x.t).toLocaleTimeString(uiLocale(),{hour:'2-digit',minute:'2-digit'})} ${x.d||'тест'} → ${x.n}`).join('\n') : '—'; hb.style.whiteSpace='pre-line';
}
// Кейс и рулетка живут на вкладке «Розыгрыши»: управляем выбранным, а если выбран не кейс, то первым на экране
const caseEl=()=>{ const s=byId(selectedId); return s?.type==='case' ? s : state.els.find(e=>e.type==='case')||null; };
function actC(fn){ const el=caseEl(); if(el) act1(el, fn); }
function bindCase(id, apply, evt='input'){
  const f=$(id);
  f.addEventListener(evt, ()=>{ const el=caseEl(); if(!el) return; beginChange(); apply(el, f); changed(); });
  f.addEventListener('change', ()=>{ if(caseEl()) commit(); });
}
let kFileFor=null;
function caseUpload(target, accept){ kFileFor=target; $('kFile').accept=accept||'image/*'; $('kFile').click(); }
async function caseSetFile(f, target){
  if(!f) return; const el=caseEl(); if(!el) return;
  try{ showUpload(`Загрузка ${f.name}…`, 0); const blob = f.type.startsWith('image/') ? await shrinkImage(f) : f; const src=await uploadBlob(blob, f.name);
    actC(e=>{ if(target.kind==='logo') e.logo=src; else if(target.kind==='snd') e.snd[target.k]=src; else if(e.items[target.i]) e.items[target.i].img=src; }); }
  catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); }
  hideUpload();
}
$('kFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; caseSetFile(f, kFileFor); };
bindCase('iKName', (el,f)=>el.name=f.value.slice(0,40)||'HUDINI CASE');
for(const r of document.querySelectorAll('#kKinds input')) r.addEventListener('change', ()=>{ if(r.checked) actC(el=>{ el.kind=r.value; if(el.kind==='second') addRespin(el); }); });
function addRespin(el){ if(el.items.length<40 && !el.items.some(it=>it.sp)) el.items.push({ n:sT('Перекрут'), r:2, p:10, img:'', sp:1 }); }
$('kSp').onclick=()=>actC(addRespin);
bindCase('iKUhh', (el,f)=>el.uhhText=f.value.slice(0,24));
bindCase('iKUpT', (el,f)=>el.upText=f.value.slice(0,24));
bindCase('iKColor', (el,f)=>el.cc=f.value);
bindCase('iKVol', (el,f)=>el.vol=Number(f.value));
bindCase('iKHide', (el,f)=>el.hideAfter=num(f.value,12,3,120));
bindCase('iKLow', (el,f)=>el.q=f.checked?'low':'high', 'change');
$('kLogo').onclick=()=>caseUpload({ kind:'logo' }); $('kLogoDel').onclick=()=>actC(el=>el.logo='');
$('kAdd').onclick=()=>actC(el=>{ if(el.items.length<40) el.items.push({ n:sT('Предмет'), r:2, p:0, img:'' }); });
$('kFix').onclick=()=>actC(el=>{ const used=it=>!it.sp || el.kind==='second', s=el.items.reduce((a,it)=>a+(used(it)?it.p:0),0); if(s>0) el.items.forEach(it=>{ if(used(it)) it.p=Math.round(it.p/s*10000)/100; }); });
$('kOpen').onclick=()=>{ const el=caseEl(); if(!el) return; if(!$('kDonor').value.trim()) return toast('Впиши ник зрителя'); beginChange(); if(caseOpen(el, $('kDonor').value.trim(), $('kAmount').value.trim())){ commit(); $('kDonor').value=''; $('kAmount').value=''; } };
$('kTest').onclick=()=>{ const el=caseEl(); if(!el) return; beginChange(); if(caseOpen(el, '', '')) commit(); };
$('kItems').addEventListener('change', e=>{
  const row=e.target.closest('.kit'); if(!row) return; const i=+row.dataset.i, f=e.target.dataset.f; if(!f) return;
  actC(el=>{ const it=el.items[i]; if(!it) return; if(f==='n') it.n=e.target.value.slice(0,40); else if(f==='r') it.r=Math.round(num(e.target.value,2,0,6)); else if(f==='p') it.p=num(e.target.value,0,0,100); });
  e.target.blur?.();
});
$('kItems').addEventListener('click', e=>{
  const b=e.target.closest('button'); const row=e.target.closest('.kit'); if(!b || !row) return; const i=+row.dataset.i;
  if(b.dataset.act==='del') actC(el=>el.items.splice(i,1));
  if(b.dataset.act==='img') caseUpload({ kind:'item', i });
});
$('kItems').addEventListener('dragover', e=>{ if(e.target.closest('.kit')) e.preventDefault(); });
$('kItems').addEventListener('drop', e=>{ const row=e.target.closest('.kit'); const f=e.dataTransfer?.files?.[0]; if(!row || !f || !f.type.startsWith('image/')) return; e.preventDefault(); caseSetFile(f, { kind:'item', i:+row.dataset.i }); });
$('kSnd').addEventListener('click', e=>{ const b=e.target.closest('button'); const r=e.target.closest('[data-k]'); if(!b || !r) return; const k=r.dataset.k;
  if(b.dataset.act==='snd') caseUpload({ kind:'snd', k }, 'audio/*'); else if(b.dataset.act==='sdel') actC(el=>{ delete el.snd[k]; }); });
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
    const el=raf(); if(!el) return true;
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
  if(msg){
    if(msg.reward) noteReward(msg, text);
    const rEl=state.els.find(e=>e.type==='roulette'), rk=rouKind(rEl, text, msg);
    const scnIds=$('scnRun').checked ? scnList().filter(sc=>sc.on && sc.trig?.type==='chat' && matchTrig(sc.trig, { msg:text, chatMsg:msg })).map(sc=>String(sc.id)) : [];
    const mid=MSGID_RE.test(msg.id||'') ? msg.id : null;
    // Рулетка и сценарии заявляются отдельно: пульт без нужного сценария не должен перебивать пульт, у которого он есть.
    // Каждый сценарий заявляется отдельно (ключ сообщения + хеш id сценария, длина в пределах MSGID_RE): при пересекающихся наборах у двух пультов
    // общий сценарий выполняет один из них, а сценарий, которого нет у другого пульта, выполняет его владелец.
    if(rk) claimChat(mid, ()=>{   // одно сообщение в нескольких пультах: действие у одного
      const el=state.els.find(e=>e.type==='roulette');
      if(el && rouKind(el, text, msg)===rk && rouFromChat(el, rk, text, msg)){ renderAll(); publishNow(1); }
    });
    for(const id of new Set(scnIds)) claimChat(mid && mid.slice(0, 48)+'-s'+[...id].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0, 7).toString(36), ()=>fire('chat', { user:msg.user, msg:text, chatMsg:msg }, id));
  }
  const low=text.toLowerCase(), tokens=new Set(low.split(/\s+/));
  let any=false;
  const vm=text.trim().match(/^!?([1-6])$/);
  const voter=String(user||'').toLowerCase();
  if(vm && VOTER_RE.test(voter)) for(const el of state.els){
    if(el.type!=='poll' || !el.running) continue;
    const i=+vm[1]-1; if(i>=el.opts.length) continue;
    if(!el.vk) el.vk=Object.create(null);
    const has=Object.hasOwn(el.vk, voter); if(has && el.vk[voter]===i) continue;
    if(!has && Object.keys(el.vk).length>=VK_MAX) continue;
    el.vk[voter]=i; el.votes=pollTally(el.vk, el.opts.length); pendMark(el.id, voter); any=true;
  }
  for(const el of state.els){
    if(el.type!=='counter' || el.cmode!=='chat' || !el.running) continue;
    const kws=el.kw.toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
    if(!kws.some(k=> k==='*' || (k.includes(' ') ? low.includes(k) : tokens.has(k)))) continue;
    if(el.modsOnly && !msg?.mod) continue;
    const mid=MSGID_RE.test(msg?.id||'') ? msg.id : null;
    if(mid && el.cids?.includes(mid)) continue;   // другой пульт уже засчитал это сообщение
    if(el.uniq){ let s=chatSeen.get(el.id); if(!s){ s=new Set(); chatSeen.set(el.id,s); } if(s.has(user)) continue; s.add(user); }
    el.value+=el.step; any=true;
    if(mid){ el.cids=[...(el.cids||[]), mid].slice(-CIDS_MAX); pendMark(el.id, mid); }
  }
  if(any || rafAny){ renderAll(); scheduleSend(); }
}

// ================== СЛОИ ==================
function flashSecs(){ return num($('flashSecs').value, 5, 1, 600); }
function toggleHidden(el){ beginChange(); el.hidden=!el.hidden; delete el.ttl; commit(); }
function flash(el){ beginChange(); el.hidden=false; el.ttl=Date.now()+flashSecs()*1000; if(el.type==='video'||el.type==='web') el.restart=Date.now(); if(el.kf){ el.kf.playing=true; el.kf.start=Date.now(); } commit(); }
$('flashSecs').addEventListener('input', renderInspector);
// --- массовое скрытие: 👁 строки, папки, выделения; протяжка по глазкам ---
function eyeTargets(row){   // что скрывает глазок этой строки
  if(row.dataset.g) return state.els.filter(e=>e.g===row.dataset.g);
  const el=byId(row.dataset.id); if(!el) return [];
  return msel.has(el.id) && msel.size>1 ? selList() : [el];
}
let eyeDrag=null;
$('layers').addEventListener('pointerdown', e=>{
  const b=e.target.closest('button[data-act=eye]'); if(!b || e.button!==0) return;
  const row=b.closest('.layer'); if(!row) return;
  const list=eyeTargets(row); if(!list.length) return;
  const hide=list.some(x=>!x.hidden);
  eyeDrag={ hide, done:new Set() };
  beginChange();
  const apply=l=>{ for(const x of l){ x.hidden=hide; delete x.ttl; } };
  apply(list); eyeDrag.done.add(row.dataset.g||row.dataset.id);
  changed();
  const move=ev=>{
    if(ev.buttons===0) return up();   // кнопку отпустили там, где pointerup не дошёл
    const r=document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#layers .layer'); if(!r) return;
    const key=r.dataset.g||r.dataset.id; if(eyeDrag.done.has(key)) return;
    eyeDrag.done.add(key);
    apply(r.dataset.g ? state.els.filter(x=>x.g===r.dataset.g) : [byId(r.dataset.id)].filter(Boolean)); changed();
  };
  const up=()=>{ if(!eyeDrag) return; removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('blur', up); eyeDrag=null; commit(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('blur', up);
  e.preventDefault();
});
// --- перетаскивание строк слоёв: бросок внутрь папки добавляет в неё, вне папки снимает; папка тянется блоком ---
const ldUnit=row=>{   // единица списка, которой принадлежит строка: папка (заголовок и участники) или одиночный элемент
  const g=row.dataset.g || (row.classList.contains('in') ? byId(row.dataset.id)?.g : null);
  return g ? { g, key:'g:'+g } : { id:row.dataset.id, key:'e:'+row.dataset.id };
};
const ldRows=()=>[...$('layers').querySelectorAll('.layer')];
const ldUnitRows=u=>ldRows().filter(r=>ldUnit(r).key===u.key);
function layerDropTarget(x, y, dg){
  const rows=ldRows(); if(!rows.length) return null;
  const selfKey=dg.g ? 'g:'+dg.g : 'e:'+dg.id;
  const R=r=>r.getBoundingClientRect();
  const first=R(rows[0]), last=R(rows.at(-1));
  const sideOf=(u, side)=>u.g ? { g:u.g, side } : { ref:u.id, side };
  const line=(r, below, left)=>{ const b=R(r); return { top:b[below?'bottom':'top']+(below?2:-2), left:left ?? b.left, width:b.right-(left ?? b.left) }; };
  if(y<first.top-6 || y>last.bottom+6){   // за краем списка: над первой или под последней единицей
    const below=y>last.bottom+6, u=ldUnit(below?rows.at(-1):rows[0]);
    if(u.key===selfKey) return null;
    const ur=ldUnitRows(u);
    return { ...sideOf(u, below?'below':'above'), join:null, line:line(below?ur.at(-1):ur[0], below, R(ur[0]).left) };
  }
  let row=null, best=1e9;
  for(const r of rows){ const b=R(r), d=y<b.top?b.top-y:y>b.bottom?y-b.bottom:0; if(d<best){ best=d; row=r; } }
  const u=ldUnit(row);
  if(u.key===selfKey || (!dg.g && row.dataset.id===dg.id)) return null;
  const b=R(row), ur=ldUnitRows(u), below=y>=b.top+b.height/2;
  if(!row.dataset.g && !row.classList.contains('in')) return { ref:u.id, side:below?'below':'above', join:null, line:line(row, below) };   // одиночный элемент
  if(dg.g){   // папка над папкой: ставим рядом, единица делится пополам по высоте
    const ub=y>=(R(ur[0]).top+R(ur.at(-1)).bottom)/2;
    return { g:u.g, side:ub?'below':'above', join:null, line:line(ub?ur.at(-1):ur[0], ub, R(ur[0]).left) };
  }
  if(row.dataset.g){   // элемент над заголовком папки: верхняя треть — над папкой, остальное — внутрь, наверх
    if((y-b.top)/b.height<0.34) return { g:u.g, side:'above', join:null, line:line(row, false) };
    return { g:u.g, side:'above', join:u.g, line:line(row, true, b.left+18), into:row };
  }
  if(below && row===ur.at(-1) && x<b.left) return { g:u.g, side:'below', join:null, line:line(row, true, R(ur[0]).left) };   // левее отступа под последним участником: ниже папки
  return { ref:row.dataset.id, side:below?'below':'above', join:u.g, line:line(row, below) };
}
function layerDrop(dg, t){
  const ids=dg.g ? state.els.filter(e=>e.g===dg.g).map(e=>e.id) : [dg.id];
  const set=new Set(ids), moved=state.els.filter(e=>set.has(e.id)), rest=state.els.filter(e=>!set.has(e.id));
  let at;
  if(t.ref){ const i=rest.findIndex(e=>e.id===t.ref); if(i<0) return false; at=t.side==='above' ? i+1 : i; }
  else { const m=rest.map((e,i)=>e.g===t.g?i:-1).filter(i=>i>=0); if(!m.length) return false; at=t.side==='above' ? m.at(-1)+1 : m[0]; }   // список хранится снизу вверх
  const next=[...rest.slice(0,at), ...moved, ...rest.slice(at)];
  const sig=a=>a.map(e=>e.id).join(',');
  const gNow=dg.g ? dg.g : (byId(dg.id).g || null), gNew=dg.g ? dg.g : (t.join || null);
  if(sig(next)===sig(state.els) && gNow===gNew) return false;
  const name=t.join ? rest.find(e=>e.g===t.join && e.gn)?.gn || gT('Группа') : null;
  beginChange();
  if(!dg.g){ const e=moved[0]; if(t.join){ e.g=t.join; e.gn=name; } else { delete e.g; delete e.gn; } }
  state.els=next;
  if(gNow && gNow!==gNew && !dg.g && state.els.filter(e=>e.g===gNow).length===1) state.els.forEach(e=>{ if(e.g===gNow){ delete e.g; delete e.gn; } });   // в папке остался один: она больше не папка
  packGroups();
  if(!dg.g){ msel.clear(); msel.add(dg.id); selectedId=dg.id; selFolder=null; }
  commit(); return true;
}
$('layers').addEventListener('pointerdown', e=>{
  if(e.button!==0 || e.shiftKey || e.ctrlKey || e.metaKey || e.target.closest('button,input,select')) return;
  const row=e.target.closest('.layer'); if(!row) return;
  const dg={ x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, moved:false, g:row.dataset.g||null, id:row.dataset.g?null:row.dataset.id, t:null };
  if(dg.id && !byId(dg.id)) return;
  const scroller=$('layers').closest('aside');
  const mark=el=>{ document.querySelectorAll('#layers .drop-in').forEach(n=>n.classList.remove('drop-in')); el?.classList.add('drop-in'); };
  const update=()=>{
    dg.t=layerDropTarget(dg.x, dg.y, dg);
    let d=$('layerDrop'); if(!d){ d=document.createElement('div'); d.id='layerDrop'; document.body.appendChild(d); }
    if(!dg.t){ d.hidden=true; mark(null); return; }
    d.hidden=false; Object.assign(d.style, { top:dg.t.line.top-1.5+'px', left:dg.t.line.left+'px', width:dg.t.line.width+'px' }); mark(dg.t.into);
  };
  let timer=null;
  const end=drop=>{
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); removeEventListener('blur', cancel); removeEventListener('keydown', key, true);
    clearInterval(timer); $('layerDrop')?.remove(); mark(null); document.body.classList.remove('ld-active');
    const was=layerDrag; layerDrag=null;
    if(was?.moved){
      const stop=ev=>{ ev.stopPropagation(); ev.preventDefault(); };   // после броска click не должен выбирать строку
      $('layers').addEventListener('click', stop, { capture:true, once:true }); setTimeout(()=>$('layers').removeEventListener('click', stop, true), 0);
      if(!(drop && dg.t && layerDrop(dg, dg.t))) renderLayers();
    }
  };
  const move=ev=>{
    if(ev.buttons===0) return cancel();
    dg.x=ev.clientX; dg.y=ev.clientY;
    if(!dg.moved){
      if(Math.hypot(dg.x-dg.x0, dg.y-dg.y0)<5) return;
      dg.moved=true; layerDrag=dg; document.body.classList.add('ld-active'); renderLayers();
      timer=setInterval(()=>{   // у края списка прокручиваем
        const b=scroller.getBoundingClientRect(), zone=28;
        if(dg.y<b.top+zone) scroller.scrollTop-=12; else if(dg.y>b.bottom-zone) scroller.scrollTop+=12; else return;
        update();
      }, 30);
    }
    update();
  };
  const up=()=>end(true), cancel=()=>end(false);
  const key=ev=>{ if(ev.key==='Escape'){ ev.stopPropagation(); cancel(); } };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', cancel); addEventListener('blur', cancel); addEventListener('keydown', key, true);
});
function selectRange(toId){
  const order=layerOrder(), a=order.indexOf(layerAnchor), b=order.indexOf(toId);
  if(a<0 || b<0) return select(toId, 'replace');
  const [i,j]=a<b?[a,b]:[b,a];
  msel.clear(); order.slice(i,j+1).forEach(id=>groupOf(id).forEach(x=>msel.add(x)));
  selectedId=toId; selFolder=null; renderAll();
}
$('layers').addEventListener('click', e=>{
  const row=e.target.closest('.layer'); if(!row) return;
  const act=e.target.closest('button')?.dataset.act;
  if(act==='eye' && e.detail!==0) return;   // мышь уже обработана в pointerdown
  const mod=e.shiftKey?'range':(e.ctrlKey||e.metaKey)?'toggle':'replace';
  if(row.dataset.g){
    const g=row.dataset.g, members=state.els.filter(x=>x.g===g);
    if(e.detail>=2 && !act && e.target.closest('.name,.ico')){ renameFolder(g); return; }   // двойной клик: первый клик уже перерисовал список, поэтому ловим по click, а не dblclick
    if(act==='del') removeIds(members.map(x=>x.id));
    else if(act==='eye'){ const hide=members.some(x=>!x.hidden); beginChange(); members.forEach(x=>{ x.hidden=hide; delete x.ttl; }); commit(); }
    else if(act==='flash'){ beginChange(); const t=Date.now()+flashSecs()*1000; members.forEach(x=>{ x.hidden=false; x.ttl=t; if(x.type==='video'||x.type==='web') x.restart=Date.now(); if(x.kf){ x.kf.playing=true; x.kf.start=Date.now(); } }); commit(); }
    else if(act==='fold'){ gfold.has(g)?gfold.delete(g):gfold.add(g); saveFold(); renderLayers(); }
    else if(act==='ungroup'){ beginChange(); members.forEach(x=>{ delete x.g; delete x.gn; }); if(selFolder===g) selFolder=null; commit(); toast('Группа разбита'); }
    else if(mod==='range' && layerAnchor) selectRange(members[0].id);
    else { layerAnchor=members[0].id; select(members[0].id, mod==='toggle'?'toggle':'replace'); selFolder=g; renderLayers(); }
    return;
  }
  const el=byId(row.dataset.id); if(!el) return;
  if(act==='del') removeIds([el.id]);
  else if(act==='eye') toggleHidden(el);
  else if(act==='flash') flash(el);
  else if(act==='ttoggle') act1(el, timerToggle);
  else if(act==='kfplay') act1(el, kfToggle);
  else if(act==='ptoggle') act1(el, pollToggle);
  else if(act==='cplus') act1(el, e=>e.value+=e.step);
  else if(act==='cminus') act1(el, e=>e.value-=e.step);
  else {
    selFolder=null;
    if(mod==='range' && layerAnchor) selectRange(el.id);
    else { layerAnchor=el.id; select(el.id, mod); }
  }
});

// ================== ДЕЙСТВИЯ ==================
function act1(el, fn){ beginChange(); keepAnimSpeed(el, ()=>fn(el)); commit(); }
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
bindInput('iModsOnly',(el,f)=>el.modsOnly=f.checked);
bindInput('iUniq',   (el,f)=>{ el.uniq=f.checked; chatSeen.delete(el.id); });
bindInput('iEvery',  (el,f)=>{ if(el.running){ el.value=counterValue(el, Date.now()); el.startAt=Date.now(); } el.every=num(f.value,60,1,86400); });
// CS2
bindInput('iCsView',   (el,f)=>{ el.view=f.value;
  if(el.view==='teams' && el.fs>2.6) el.fs=2.4;            // панели команд крупные — сразу поменьше
  if(el.view==='scorebar'){ el.x=50; el.y=7; }
  if(el.view==='radar'){ el.fs=2.6; el.rot=0; Object.assign(el, radarCorner(el.fs)); }
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
  $('csRadarBox').hidden=el.view!=='radar'; I('iCsRbg').checked=el.rbg!==false; I('iCsRmap').checked=el.rmap!==false; setField(I('iCsRds'), String(el.rds??1)); $('vCsRds').textContent=Math.round((el.rds??1)*100)+'%';
  I('iCsRgr').checked=el.rgr!==false; $('csGrBox').hidden=el.rgr===false; for(const [i,k] of [['iCsRgm','rgm'],['iCsRgh','rgh'],['iCsRgf','rgf'],['iCsRgs','rgs']]) I(i).checked=el[k]!==false; setField(I('iCsGrenStyle'), el.grenStyle==='B'?'B':'A');
  I('iCsKf').checked=!!el.kfeed; $('csKfRow').hidden=!['hud_solo','hud_tour'].includes(el.view);
  setField(I('iCsTnCT'), el.tnCT); setField(I('iCsTnT'), el.tnT); setField(I('iCsSeries'), el.series);
  renderNicks(el);
  const list=$('csAvList'); list.replaceChildren();
  // после отмены или копирования av — обычный объект: ищем только свои ключи (игрок мог назваться constructor)
  const own=el.av||{}, av=n=>Object.hasOwn(own, n) ? own[n] : '';
  const names=[...new Set([...csNames().map(n=>n.toLowerCase()), ...Object.keys(own)])];
  for(const n of names){
    const r=document.createElement('div'); r.className='row';
    const nm=document.createElement('span'); nm.className='grow hint'; nm.textContent=(csNames().find(x=>x.toLowerCase()===n)||n)+(av(n)?' ✓':''); nm.dataset.i18nSkip='';
    const b=document.createElement('button'); b.textContent=av(n)?'🗑':'📁'; b.title=av(n)?'Убрать аватарку':'Выбрать картинку';
    b.onclick=()=>{ if(av(n)) setAvatar(n, null); else { $('csAvName').value=n; $('csAvFile').click(); } };
    r.append(nm, b); list.appendChild(r);
  }
}
// Ники игроков: steamid -> показываемый ник, ставится всем CS2-элементам. Список: все, кого сейчас видит HUD
function csPlayers(){
  const m=new Map();
  for(const p of CS2?.players||[]) if(p?.id) m.set(p.id, p);
  if(CS2?.observed?.id && !m.has(CS2.observed.id)) m.set(CS2.observed.id, CS2.observed);
  if(!CS2?.players?.length && CS2?.id) m.set(CS2.id, { id:CS2.id, name:CS2.name, team:CS2.team });
  return [...m.values()].sort((a,b)=>(a.team===b.team?0:a.team==='CT'?-1:1) || (a.slot??99)-(b.slot??99));
}
function setNick(id, val){
  const v=cleanNicks({ [id]:val })[id];
  beginChange();
  for(const x of state.els) if(x.type==='cs2'){
    const n={ ...(x.nicks||{}) };
    if(v) n[id]=v; else delete n[id];
    x.nicks=cleanNicks(n);
  }
  commit();
}
function renderNicks(el){
  const box=$('csNickBox'), list=$('csNickList'); if(!box || list.contains(document.activeElement)) return;
  const nk=el?.nicks||{}, ps=csPlayers(), seen=new Set(ps.map(p=>p.id));
  // CS2 шлёт пакеты по 10 раз в секунду: список перерисовываем только когда в нём что-то поменялось, иначе поле ввода уходит из-под рук
  const sig=JSON.stringify([ps.map(p=>[p.id,p.name,p.team,p.slot]), nk, CS2_NUM]); if(list._sig===sig) return; list._sig=sig;
  list.replaceChildren();
  const hudSl=CS2_NUM==='hud' ? cs2HudSlots(ps) : {};   // номер, как его видит зритель
  if(!ps.length && !Object.keys(nk).length){ const e=document.createElement('div'); e.className='hint'; e.textContent='Игроков пока нет: нужна запущенная CS2 и Hudini Host'; list.appendChild(e); return; }
  for(const p of [...ps, ...Object.keys(nk).filter(id=>!seen.has(id)).map(id=>({ id, name:'', offline:true }))]){
    const r=document.createElement('div'); r.className='row'; r.dataset.id=p.id;
    const nm=document.createElement('span'); nm.className='hint'; nm.dataset.i18nSkip=''; nm.style.minWidth='7em';
    nm.textContent=(slotLabel(hudSl[p.id] ?? p.slot)?slotLabel(hudSl[p.id] ?? p.slot)+' · ':'')+(p.team||'')+(p.team?' · ':'')+(p.name||p.id);
    const inp=document.createElement('input'); inp.type='text'; inp.className='grow'; inp.maxLength=24; inp.placeholder='Ник в HUD (пусто = игровой)'; inp.value=nk[p.id]||'';
    inp.addEventListener('change', ()=>setNick(p.id, inp.value));
    const b=document.createElement('button'); b.textContent='↺'; b.title='Сбросить ник'; b.disabled=!nk[p.id];
    b.onclick=()=>setNick(p.id, '');
    r.append(nm, inp, b); list.appendChild(r);
  }
}
function setAvatar(name, src){
  const key=String(name||'').trim().toLowerCase().slice(0,40); if(!key) return toast('Впиши ник игрока');
  if(['__proto__','constructor','prototype'].includes(key)) return toast('Такой ник нельзя');
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
bindInput('iCsRbg', (el,f)=>el.rbg=f.checked, 'change');
bindInput('iCsRmap', (el,f)=>el.rmap=f.checked, 'change');
bindInput('iCsRds', (el,f)=>{ el.rds=num(f.value,1,0.5,2.5); $('vCsRds').textContent=Math.round(el.rds*100)+'%'; });
bindInput('iCsRgr', (el,f)=>el.rgr=f.checked, 'change');
for(const [i,k] of [['iCsRgm','rgm'],['iCsRgh','rgh'],['iCsRgf','rgf'],['iCsRgs','rgs']]) bindInput(i, (el,f)=>el[k]=f.checked, 'change');
bindInput('iCsGrenStyle', (el,f)=>el.grenStyle=f.value==='B'?'B':'A', 'change');
bindInput('iCsKf', (el,f)=>el.kfeed=f.checked, 'change');
bindInput('iCsTnCT', (el,f)=>el.tnCT=f.value.slice(0,30));
bindInput('iCsTnT', (el,f)=>el.tnT=f.value.slice(0,30));
bindInput('iCsSeries', (el,f)=>el.series=f.value.slice(0,120));
bindInput('iCsSide',   (el,f)=>el.side=f.value);
bindInput('iMaxw',      (el,f)=>el.maxw=Number(f.value));
bindInput('iChChan',    (el,f)=>el.chan=cleanChan(f.value), 'change');
bindInput('iChTheme',   (el,f)=>el.theme=f.value, 'change');
bindInput('iChCard',    (el,f)=>el.card=f.value);
bindInput('iChAccent',  (el,f)=>el.accent=f.value);
bindInput('iChFade',    (el,f)=>el.fade=Math.round(Number(f.value)));
bindInput('iChDir',     (el,f)=>el.dir=f.value, 'change');
bindInput('iChAlign',   (el,f)=>el.align=f.value, 'change');
bindInput('iChBadges',  (el,f)=>el.badges=f.checked, 'change');
bindInput('iChMax',     (el,f)=>el.max=Math.round(Number(f.value)));
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
  const keep=Object.create(null); for(const k of Object.keys(el.vk||{})){ const i=el.vk[k]; if(el.opts[i]===o[i]) keep[k]=i; }
  el.opts=o; pollNewRound(el); el.vk=keep; el.votes=pollTally(keep, o.length); }, 'change');   // голоса за неизменённые варианты остаются
bindInput('iAccent', (el,f)=>el.accent=f.value);
bindInput('iPCard',  (el,f)=>el.card=f.value);
// web
bindInput('iUrl',    (el,f)=>{ const u=safeUrl(f.value);
  if(u && blockedEmbed(u)){ f.value=el.url; return toast('Этот адрес нельзя показать на экране: это пульт или программа Hudini', 4000); }   // как при создании
  if(u){ el.url=u; nodes.get(el.id)?.remove(); nodes.delete(el.id); } }, 'change');
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
$('tToggle').onclick=()=>act(timerToggle);
$('tReset').onclick=()=>act(timerReset);
document.querySelectorAll('[data-tadd]').forEach(b=>b.onclick=()=>act(el=>timerAdd(el, Number(b.dataset.tadd))));
$('tNY').onclick=()=>act(el=>{ el.target=nextNewYear(); if(!el.label) el.label=sT('До Нового года'); });
$('tHour').onclick=()=>act(el=>el.target=Date.now()+3600000);
$('cPlus').onclick=()=>act(el=>el.value+=el.step);
// ---- вкладка «Розыгрыши»: переключатель инструментов, кейс и рулетка ----
let rTool=lsGet('hudini.rtool','raffle');
function showRTool(t, save){
  if(!['raffle','case','roulette'].includes(t)) t='raffle';
  rTool=t; if(save) lsSet('hudini.rtool', t);
  document.querySelectorAll('[data-rtool]').forEach(b=>b.classList.toggle('on', b.dataset.rtool===t));
  document.querySelectorAll('[data-rtp]').forEach(p=>p.hidden=p.dataset.rtp!==t);
}
document.querySelectorAll('[data-rtool]').forEach(b=>b.onclick=()=>showRTool(b.dataset.rtool, true));
$('toRaffles').onclick=()=>{ const el=byId(selectedId); showTab('raffle'); showRTool(el?.type==='roulette' ? 'roulette' : 'case', true); };
$('caseCreate').onclick=()=>{ if(!caseEl()) addCase(); };
function renderCaseTab(){
  const el=caseEl();
  $('caseEmpty').hidden=!!el; $('caseBody').hidden=!el;
  if(el) renderCase(el);
}

// ---- рулетка (капсульный автомат и колесо) ----
const rouEl=()=>{ const s=byId(selectedId); return s?.type==='roulette' ? s : state.els.find(e=>e.type==='roulette')||null; };
function actU(fn){ const el=rouEl(); if(el) act1(el, fn); }
function bindU(id, apply, evt='input'){
  const f=$(id);
  f.addEventListener(evt, ()=>{ const el=rouEl(); if(!el) return; beginChange(); apply(el, f); changed(); });
  f.addEventListener('change', ()=>{ if(rouEl()) commit(); });
}
function addRoulette(){
  if(rouEl()) return;
  const prizes=[['Скин на пистолет',5],['Заказ песни',30],['Привет в чате',35],['Бан в чате на 10 минут',15],['Ещё одна попытка',15]].map(([n,w],i)=>({ n:sT(n), w, c:ROU_COLORS[i], note:'' }));
  addEl({ type:'roulette', view:'capsule', x:50, y:46, fs:4, font:'montserrat', color:'#ffffff', accent:'#a970ff', title:'', prizes, people:[], hideAfter:10, vol:0.8, cWord:cmdWord('!крутить', streamLang()) });
}
// Крутить: приз по весам, ник из поля или из списка участников. Всё решается здесь, на стриме только показ
function rouSpin(el, who, test){
  if(rouBusy(el, nowMs())) return toast('Рулетка ещё крутится'), false;
  const pi=roulettePrize(el, cryptoUnit());
  if(pi<0) return toast('Добавь призы с весом больше 0'), false;
  let viewer=String(who||'').trim().slice(0,40);
  if(!test){
    let pj = viewer ? el.people.findIndex(p=>p.n.toLowerCase()===viewer.toLowerCase()) : roulettePerson(el, cryptoUnit());
    if(!viewer && pj>=0) viewer=el.people[pj].n;
    if(!viewer && !test && !el.people.length) return toast('Впиши ник зрителя или добавь участников'), false;
    if(pj>=0 && el.once){ const [p]=el.people.splice(pj, 1); el.used=[...(el.used||[]), p].slice(-ROU_PEOPLE); }
  }
  const was = el.spinAt && el.win>=0 ? rouTarget(el).rest : 0;
  el.from=was; el.segs=el.prizes.map(x=>({ ...x })); el.win=pi; el.jit=(cryptoUnit()-0.5)*0.8; el.viewer=viewer;
  el.spinAt=Date.now()+400; el.hidden=false;
  const h=lsGet('hudini.rouHist', []); h.unshift({ t:Date.now(), v:viewer, n:el.segs[pi].n }); lsSet('hudini.rouHist', h.slice(0,100));
  return true;
}
function rouReset(el){ if(el.spinAt && el.win>=0) el.from=rouTarget(el).rest; el.spinAt=0; el.win=-1; el.segs=[]; el.viewer=''; }
const peopleText=list=>list.map(p=>p.w>1 ? `${p.n} x${p.w}` : p.n).join('\n');
function parsePeople(text){
  const seen=new Set(), out=[];
  for(const raw of String(text).split('\n')){
    const m=/^(.*?)\s*[x×*]\s*(\d{1,3})$/i.exec(raw.trim()), n=(m ? m[1] : raw).trim().slice(0,40), key=n.toLowerCase();
    if(!n || seen.has(key)) continue; seen.add(key); out.push({ n, w:m ? Math.min(100, Math.max(1, +m[2])) : 1 });
    if(out.length>=ROU_PEOPLE) break;
  }
  return out;
}
function rouLive(){
  const c=caseEl(), r=rouEl(), now=nowMs();
  $('rLiveCase').hidden=!(c && c.openAt && now<c.openAt+caseT(c).reveal);
  $('rLiveRou').hidden=!(r && rouBusy(r, now));
  if(r){ const busy=rouBusy(r, now); $('rouSpin').disabled=busy; $('rouTest').disabled=busy; }
}
setInterval(rouLive, 400);
// ---- запуск рулетки зрителями: чат-команда и награда за баллы (без входа в Twitch) ----
const rouSkipped=[], rouSeenRw=new Map(), rouLastRun={ c:0, r:0 }, rouRate={ c:[], r:[] }, ROU_PER_MIN=20;
const trp=t=>window.HudiniI18n ? window.HudiniI18n.t(t) : t;
function rouSkip(msg, text, why){
  rouSkipped.unshift({ t:Date.now(), u:String(msg?.user||msg?.login||'?').slice(0,40), x:String(text||'').slice(0,60), why });
  rouSkipped.length=Math.min(rouSkipped.length, 30);
  if(!$('rouSkipLog').hidden) renderRouSkip();
}
function renderRouSkip(){
  const b=$('rouSkipLog'); b.dataset.i18nSkip=''; b.style.whiteSpace='pre-line';
  b.textContent = rouSkipped.length ? rouSkipped.map(x=>`${new Date(x.t).toLocaleTimeString(uiLocale(),{hour:'2-digit',minute:'2-digit',second:'2-digit'})} ${x.u}: «${x.x}» — ${trp(x.why)}`).join('\n') : '—';
}
// какая сторона рулетки ждёт это сообщение: 'r' награда, 'c' команда, null ничего
function rouKind(el, text, msg){
  if(!el || !msg) return null;
  if(msg.reward) return el.rOn && el.rId && msg.reward===el.rId ? 'r' : null;
  if(!el.cOn) return null;
  const w=el.cWord.toLowerCase(), low=text.trim().toLowerCase();
  return w && (low===w || low.startsWith(w+' ')) ? 'c' : null;
}
const rouNick=(msg)=>String(msg.user||msg.login||'').replace(/[\p{C}\p{Z}<>]+/gu, ' ').trim().slice(0,40);
function rouFromChat(el, kind, text, msg){
  const c=kind==='c', who=c ? el.cWho : 'all', mode=c ? el.cMode : el.rMode, cd=(c ? el.cCd : el.rCd)*1000, lim=c ? el.cLim : el.rLim;
  const skip=why=>{ rouSkip(msg, text, why); return false; };
  if(who==='mods' && !msg.mod) return skip('нет прав');
  if(who==='subs' && !(msg.sub || msg.mod)) return skip('нет прав');
  if(!c){
    const words=text.trim().split(/\s+/).filter(Boolean);
    if(el.rOne && words.length!==1) return skip('в тексте не одно слово');
    if(el.rWord && (words[0]||'').toLowerCase()!==el.rWord.toLowerCase()) return skip('не то слово');
  }
  if(!el.vcnt) el.vcnt=Object.create(null);
  const login=String(msg.login||'').toLowerCase(), nick=rouNick(msg);
  if(!VOTER_RE.test(login) || !nick) return skip('странный ник');
  const now=Date.now(), rate=rouRate[kind];
  while(rate.length && now-rate[0]>=60000) rate.shift();
  if(now-rouLastRun[kind]<cd) return skip('пауза');
  if(rate.length>=ROU_PER_MIN) return skip('слишком часто');
  if(lim>0 && (el.vcnt[login]||0)>=lim) return skip('лимит на зрителя');
  if(mode==='add'){
    const low=nick.toLowerCase(), has=l=>(l||[]).some(p=>p.n.toLowerCase()===low);
    if(has(el.people) || has(el.used)) return skip('уже в списке');
    if(el.people.length>=ROU_PEOPLE) return skip('список участников полон');
    el.people=[...el.people, { n:nick, w:1 }]; pendMark(el.id, 'p:'+nick);
  } else {
    if(rouBusy(el, nowMs())) return skip('рулетка занята');
    if(roulettePrize(el, 0.5)<0) return skip('нет призов');
    if(!rouSpin(el, nick, false)) return skip('не получилось');
  }
  if(lim>0 || mode==='add') el.vcnt[login]=Math.min(999, (el.vcnt[login]||0)+1);
  rouLastRun[kind]=now; rate.push(now);
  return true;
}
function noteReward(msg, text){
  rouSeenRw.delete(msg.reward); rouSeenRw.set(msg.reward, { u:rouNick(msg), x:String(text||'').slice(0,40), t:Date.now() });
  while(rouSeenRw.size>8) rouSeenRw.delete(rouSeenRw.keys().next().value);
  if(!$('rouRSeen').hidden) renderRouSeen();
}
function renderRouSeen(){
  const box=$('rouRSeen'); box.dataset.i18nSkip=''; box.replaceChildren();
  if(!rouSeenRw.size){ const d=document.createElement('div'); d.textContent=trp('Пока ни одной награды с вводом текста не было. Получи её сам (или попроси друга), потом нажми кнопку снова.'); box.appendChild(d); return; }
  for(const [id, v] of [...rouSeenRw].reverse()){
    const b=document.createElement('button'); b.className='grow'; b.dataset.rw=id; b.style.textAlign='left';
    b.textContent=`${v.u}: «${v.x}» · ${id.slice(0,8)}…`; box.appendChild(b);
  }
}
function renderRouTab(){
  const el=rouEl();
  $('rouEmpty').hidden=!!el; $('rouBody').hidden=!el;
  if(!el) return;
  fillFonts();
  setField(I('iRouView'), el.view); setField(I('iRouTitle'), el.title); setField(I('iRouAccent'), el.accent); setField(I('iRouColor'), el.color); setField(I('iRouFont'), el.font);
  setField(I('iRouVol'), String(el.vol)); setField(I('iRouHide'), String(el.hideAfter)); setField(I('iRouSize'), String(el.fs)); $('vRouSize').textContent=el.fs.toFixed(1);
  I('iRouOnce').checked=el.once; I('iRouWhoOn').checked=el.who; I('iRouOdds').checked=el.odds; I('iRouShow').checked=!el.hidden;
  setField($('iRouPeople'), peopleText(el.people));
  I('iRouCOn').checked=el.cOn; I('iRouCWord').placeholder=cmdWord('!крутить', streamLang()); setField(I('iRouCWord'), el.cWord); setField(I('iRouCWho'), el.cWho); setField(I('iRouCMode'), el.cMode); setField(I('iRouCCd'), String(el.cCd)); setField(I('iRouCLim'), String(el.cLim));
  I('iRouROn').checked=el.rOn; setField(I('iRouRId'), el.rId); $('rouRClear').hidden=!el.rId; I('iRouROne').checked=el.rOne; setField(I('iRouRWord'), el.rWord);
  setField(I('iRouRMode'), el.rMode); setField(I('iRouRCd'), String(el.rCd)); setField(I('iRouRLim'), String(el.rLim));
  if($('rouViewers').open) renderRouSkip();
  $('rouPeopleN').textContent=`· ${el.people.length}` + (el.used?.length ? ` · выбыло ${el.used.length}` : '');
  $('rouBack').hidden=!el.used?.length;
  const total=el.prizes.reduce((a,x)=>a+x.w,0);
  $('rouSum').textContent=`· ${el.prizes.length} · вес: ${+total.toFixed(2)}`;
  $('rouInfo').textContent = rouBusy(el, nowMs()) ? 'Крутится на стриме…' : el.spinAt && el.win>=0 ? `Выпало: ${el.segs[el.win]?.n || '—'}${el.viewer ? ' · '+el.viewer : ''}` : '';
  const box=$('rouPrizes'), sig=el.prizes.length+'|'+el.view;
  if(!document.activeElement?.closest('#rouPrizes') && box._sig!==sig){
    box._sig=sig;
    box.replaceChildren(...el.prizes.map((p,i)=>{
      const r=document.createElement('div'); r.className='rou-it'; r.dataset.i=i;
      const c=document.createElement('input'); c.type='color'; c.dataset.f='c'; c.title='Цвет';
      const n=document.createElement('input'); n.type='text'; n.className='grow'; n.maxLength=40; n.dataset.f='n'; n.placeholder='Приз';
      const w=document.createElement('input'); w.type='number'; w.min='0'; w.max='1000'; w.step='any'; w.dataset.f='w'; w.title='Вес';
      const pc=document.createElement('span'); pc.className='pc';
      const d=document.createElement('button'); d.textContent='✕'; d.title='Убрать приз'; d.dataset.act='del';
      r.append(c, n, w, pc, d); return r;
    }));
  }
  [...box.children].forEach((r,i)=>{
    const p=el.prizes[i]; if(!p) return;
    setField(r.querySelector('[data-f=c]'), p.c); setField(r.querySelector('[data-f=n]'), p.n); setField(r.querySelector('[data-f=w]'), String(p.w));
    r.querySelector('.pc').textContent = total>0 && p.w>0 ? (p.w/total*100).toFixed(p.w/total<0.1 ? 1 : 0)+'%' : '—';
  });
  const h=lsGet('hudini.rouHist', []), hb=$('rouHist'); hb.dataset.i18nSkip=''; hb.style.whiteSpace='pre-line';
  hb.textContent = h.length ? h.slice(0,30).map(x=>`${new Date(x.t).toLocaleTimeString(uiLocale(),{hour:'2-digit',minute:'2-digit'})} ${x.v||'тест'} → ${x.n}`).join('\n') : '—';
  rouLive();
}
function renderRTabs(){ showRTool(rTool); renderCaseTab(); renderRouTab(); }
$('rouCreate').onclick=addRoulette;
$('rouDel').onclick=()=>{ const el=rouEl(); if(!el) return; if(!confirm('Убрать рулетку с экрана? Призы и участники пропадут.')) return;
  beginChange(); state.els=state.els.filter(e=>e.id!==el.id); selectedId=null; commit(); };
$('rouSpin').onclick=()=>{ const el=rouEl(); if(!el) return; beginChange(); if(rouSpin(el, $('iRouWho').value, false)){ commit(); $('iRouWho').value=''; } };
$('rouTest').onclick=()=>{ const el=rouEl(); if(!el) return; beginChange(); if(rouSpin(el, '', true)) commit(); };
$('rouReset').onclick=()=>actU(rouReset);
$('rouCenter').onclick=()=>actU(el=>{ el.x=50; el.y=46; });
$('rouAdd').onclick=()=>actU(el=>{ if(el.prizes.length<ROU_MAX) el.prizes.push({ n:sT('Приз')+' '+(el.prizes.length+1), w:10, c:ROU_COLORS[el.prizes.length%ROU_COLORS.length], note:'' }); });
$('rouEven').onclick=()=>actU(el=>el.prizes.forEach(p=>p.w=1));
$('rouBack').onclick=()=>actU(el=>{ el.people=[...el.people, ...(el.used||[])].slice(0,ROU_PEOPLE); el.used=[]; });
$('rouPrizes').addEventListener('change', e=>{
  const row=e.target.closest('.rou-it'), f=e.target.dataset.f; if(!row || !f) return; const i=+row.dataset.i, v=e.target.value;
  actU(el=>{ const p=el.prizes[i]; if(!p) return; if(f==='n') p.n=v.slice(0,40); else if(f==='w') p.w=num(v,1,0,1000); else if(f==='c') p.c=hex(v, p.c); });
});
$('rouPrizes').addEventListener('click', e=>{ const b=e.target.closest('button'), row=e.target.closest('.rou-it'); if(b?.dataset.act==='del' && row) actU(el=>el.prizes.splice(+row.dataset.i, 1)); });
bindU('iRouView', (el,f)=>el.view=ROU_VIEWS.includes(f.value) ? f.value : 'capsule', 'change');
bindU('iRouTitle', (el,f)=>el.title=f.value.slice(0,30));
bindU('iRouAccent', (el,f)=>el.accent=f.value);
bindU('iRouColor', (el,f)=>el.color=f.value);
bindU('iRouFont', (el,f)=>el.font=f.value, 'change');
bindU('iRouVol', (el,f)=>el.vol=Number(f.value));
bindU('iRouHide', (el,f)=>el.hideAfter=num(f.value,10,3,120));
bindU('iRouSize', (el,f)=>el.fs=num(f.value,4,1,12));
bindU('iRouOnce', (el,f)=>el.once=f.checked, 'change');
bindU('iRouWhoOn', (el,f)=>el.who=f.checked, 'change');
bindU('iRouOdds', (el,f)=>el.odds=f.checked, 'change');
bindU('iRouShow', (el,f)=>el.hidden=!f.checked, 'change');
bindU('iRouCOn', (el,f)=>el.cOn=f.checked, 'change');
bindU('iRouCWord', (el,f)=>el.cWord=f.value.replace(/\s+/g,'').slice(0,24) || cmdWord('!крутить', streamLang()), 'change');
bindU('iRouCWho', (el,f)=>el.cWho=['all','subs','mods'].includes(f.value) ? f.value : 'mods', 'change');
bindU('iRouCMode', (el,f)=>el.cMode=f.value==='spin' ? 'spin' : 'add', 'change');
bindU('iRouCCd', (el,f)=>el.cCd=Math.round(num(f.value,10,0,3600)));
bindU('iRouCLim', (el,f)=>el.cLim=Math.round(num(f.value,1,0,99)));
bindU('iRouROn', (el,f)=>el.rOn=f.checked, 'change');
bindU('iRouROne', (el,f)=>el.rOne=f.checked, 'change');
bindU('iRouRWord', (el,f)=>el.rWord=f.value.replace(/\s+/g,'').slice(0,24), 'change');
bindU('iRouRMode', (el,f)=>el.rMode=f.value==='spin' ? 'spin' : 'add', 'change');
bindU('iRouRCd', (el,f)=>el.rCd=Math.round(num(f.value,5,0,3600)));
bindU('iRouRLim', (el,f)=>el.rLim=Math.round(num(f.value,0,0,99)));
$('rouRDetect').onclick=()=>{ const b=$('rouRSeen'); b.hidden=!b.hidden; if(!b.hidden) renderRouSeen(); };
$('rouRSeen').addEventListener('click', e=>{ const id=e.target.closest('button')?.dataset.rw; if(!id || !REWARD_RE.test(id)) return; actU(el=>{ el.rId=id; el.rOn=true; }); $('rouRSeen').hidden=true; });
$('rouRClear').onclick=()=>actU(el=>{ el.rId=''; el.rOn=false; });
$('rouViewers').addEventListener('toggle', ()=>{ if($('rouViewers').open) renderRouSkip(); });
$('iRouPeople').addEventListener('change', e=>actU(el=>{ el.people=parsePeople(e.target.value); }));
$('cMinus').onclick=()=>act(el=>el.value-=el.step);
$('cReset').onclick=()=>act(el=>{ el.value=0; el.startAt=Date.now(); chatSeen.delete(el.id); });
$('cToggle').onclick=()=>act(counterToggle);
$('pToggle').onclick=()=>act(el=>{ pollToggle(el); el.closeAt=0; });
$('pTimed').onclick=()=>act(el=>{ el.running=true; el.closeAt=Date.now()+num($('pSecs').value,60,5,3600)*1000; if(!chatWs) toast('Подключи чат Twitch слева, иначе голоса не придут', 4000); });
$('pReset').onclick=()=>act(pollNewRound);
// ---- вкладка «Розыгрыши» ----
function actR(fn){ const el=raf(); if(el){ beginChange(); fn(el); commit(); } }
function bindR(id, apply, evt='input'){
  const f=$(id);
  f.addEventListener(evt, ()=>{ const el=raf(); if(!el) return; beginChange(); apply(el, f); changed(); });
  f.addEventListener('change', ()=>{ if(raf()) commit(); });
}
function renderRaffleTab(){
  const el=raf();
  $('rafEmpty').hidden=!!el; $('rafBody').hidden=!el;
  if(!el) return;
  renderRaffle(el); fillFonts();
  setField(I('iRFont'), el.font); setField(I('iRColor'), el.color);
  for(const [id, v, out, fmt] of [['iRX', el.x, 'vRX', x=>Math.round(x)+'%'], ['iRY', el.y, 'vRY', x=>Math.round(x)+'%'], ['iRSize', el.fs, 'vRSize', x=>x.toFixed(1)]]){
    setField(I(id), String(v)); $(out).textContent=fmt(v);
  }
  I('iRShow').checked=!el.hidden;
}
bindR('iRFont', (el,f)=>el.font=f.value, 'change');
bindR('iRColor', (el,f)=>el.color=f.value);
bindR('iRX', (el,f)=>el.x=num(f.value,50,0,100));
bindR('iRY', (el,f)=>el.y=num(f.value,45,0,100));
bindR('iRSize', (el,f)=>el.fs=num(f.value,3,1,8));
bindR('iRShow', (el,f)=>el.hidden=!f.checked, 'change');
$('rCenter').onclick=()=>actR(el=>{ el.x=50; el.y=50; });
$('rafCreate').onclick=addRaffle;
$('rDelete').onclick=()=>{ const el=raf(); if(!el) return; if(el.n && !confirm('Удалить розыгрыш вместе с участниками?')) return;
  beginChange(); rafReset(el); state.raffle=null; commit(); };
function rafReset(el){ el.phase='idle'; el.closeAt=0; el.n=0; el.reel=[]; el.winner=''; el.wlogin=''; el.winners=[]; el.ok=false; el.cUntil=0;
  clearTimeout(rafSaveT); rafSaveT=rafSaveFn=null;
  rafPool.set(el.id, new Map()); rafSkip.delete(el.id); HudiniStore.remove(rafKey(el.id)); }
bindR('iRTitle', (el,f)=>el.title=f.value.slice(0,80));
bindR('iRPrize', (el,f)=>el.prize=f.value.slice(0,120));
bindR('iREntry', (el,f)=>el.entry=f.value, 'change');
bindR('iRKw', (el,f)=>el.kw=f.value.slice(0,30));
bindR('iRSubs', (el,f)=>el.subs=f.checked, 'change');
bindR('iRSubx2', (el,f)=>el.subx2=f.checked, 'change');
bindR('iRAuto', (el,f)=>el.auto=f.checked, 'change');
bindR('iRConfirm', (el,f)=>el.confirm=Math.round(num(f.value,0,0,600)));
bindR('iRKey', (el,f)=>el.key=f.checked, 'change');
bindR('iRKc', (el,f)=>el.kc=f.value);
bindR('iRKsim', (el,f)=>el.ksim=Number(f.value));
bindR('iRFxc', (el,f)=>el.fxc=f.checked, 'change');
bindR('iRTicks', (el,f)=>el.ticks=f.checked, 'change');
bindR('iRAccent', (el,f)=>el.accent=f.value);
bindR('iRCard', (el,f)=>el.card=f.value);
$('rStart').onclick=()=>actR(el=>{ el.phase='collect'; el.hidden=false; el.closeAt=Date.now()+num($('rSecs').value,120,10,7200)*1000; if(!chatWs) toast('Подключи чат Twitch слева, иначе участники не придут', 4000); });
$('rStop').onclick=()=>actR(el=>{ if(el.phase==='collect'){ el.phase='closed'; el.closeAt=0; } });
$('rSpin').onclick=()=>actR(el=>{ if(el.phase==='collect'){ el.closeAt=0; } rafSpin(el); });
$('rReset').onclick=()=>{ const el=raf(); if(el && (!el.n || confirm('Начать новый розыгрыш? Участники и победители обнулятся.'))) actR(rafReset); };
$('rPimg').onclick=()=>rafUpload('pimg'); $('rSnd').onclick=()=>rafUpload('snd'); $('rVfx').onclick=()=>rafUpload('vfx');
$('rPimgDel').onclick=()=>actR(el=>el.pimg=''); $('rSndDel').onclick=()=>actR(el=>el.snd=''); $('rVfxDel').onclick=()=>actR(el=>el.vfx='');
$('rFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return; const kind=rafFileFor;
  try{ showUpload(`Загрузка ${f.name}…`, 0); const blob = kind==='pimg' ? await shrinkImage(f) : f; const src=await uploadBlob(blob, f.name); actR(el=>{ el[kind]=src; }); }
  catch(err){ if(!err.shown) toast('Не загрузилось: '+(err.message||err)); }
  hideUpload();
};
$('bCenter').onclick=()=>act(el=>{ el.x=50; el.y=50; });
$('bRot0').onclick=()=>act(el=>el.rot=0);
$('bRatio').onclick=()=>act(el=>el.hh=0);
$('bCrop').onclick=()=>act(el=>{ delete el.crop; });
// участники группы стоят подряд: блок встаёт на место самого верхнего участника, порядок внутри сохраняется
function packGroups(){
  const out=[], done=new Set();
  const top=new Map(); state.els.forEach((e,i)=>{ if(e.g) top.set(e.g, i); });
  state.els.forEach((e,i)=>{
    if(!e.g){ out.push(e); return; }
    if(top.get(e.g)!==i || done.has(e.g)) return;
    done.add(e.g); out.push(...state.els.filter(x=>x.g===e.g));
  });
  state.els=out;
}
function moveLayer(dir){
  const sel=byId(selectedId); if(!sel) return;
  const g=sel.g && state.els.filter(e=>e.g===sel.g).length>1 ? sel.g : null;
  const moveBlock=!!(g && selFolder===g);                  // выбрана папка: двигается блок целиком
  let block;
  if(g && !moveBlock){                                      // участник двигается только внутри своей группы
    const i=state.els.findIndex(e=>e.id===sel.id), j=i+dir;
    if(j<0 || j>=state.els.length || state.els[j].g!==g) return;
    beginChange(); [state.els[i],state.els[j]]=[state.els[j],state.els[i]]; commit(); return;
  }
  block = moveBlock ? state.els.filter(e=>e.g===g) : [sel];
  const ids=new Set(block.map(e=>e.id)), first=state.els.findIndex(e=>ids.has(e.id));
  const rest=state.els.filter(e=>!ids.has(e.id));
  // соседний юнит: одиночный элемент или группа целиком
  let at=first;                                             // индекс в rest, перед которым стоит блок
  const unitAt=k=>{ const e=rest[k]; return e.g ? rest.map((x,n)=>x.g===e.g?n:-1).filter(n=>n>=0) : [k]; };
  if(dir>0){ if(at>=rest.length) return; const u=unitAt(at); at=u[u.length-1]+1; }
  else { if(at<=0) return; const u=unitAt(at-1); at=u[0]; }
  beginChange(); state.els=[...rest.slice(0,at), ...block, ...rest.slice(at)]; packGroups(); commit();
}
$('bUp').onclick=()=>moveLayer(1);
$('bDown').onclick=()=>moveLayer(-1);
function duplicate(){
  const list=selList(); if(!list.length) return;
  if(state.els.length+list.length>MAX_ELS) return toast('Слишком много элементов: на экране максимум '+MAX_ELS);
  beginChange();
  const gmap=new Map(), ids=[];
  for(const el of list){ const c=JSON.parse(JSON.stringify(el)); c.id=rid(10); c.x=num(el.x+3,50,0,100); c.y=num(el.y+3,50,0,100); delete c.ttl;
    if(el.g){ if(!gmap.has(el.g)) gmap.set(el.g, rid(6)); c.g=gmap.get(el.g); } state.els.push(c); ids.push(c.id); }
  msel.clear(); ids.forEach(i=>msel.add(i)); selectedId=ids.at(-1); commit();
}
// Удаление одним шагом отмены: и для выделения (Del, 🗑 на панели), и для строки или папки в списке слоёв
function removeIds(ids){
  const set=new Set(ids); if(!set.size) return;
  beginChange();
  state.els=state.els.filter(e=>!set.has(e.id));
  for(const id of set) msel.delete(id);
  if(selectedId && set.has(selectedId)) selectedId=msel.size?[...msel][0]:null;
  if(selFolder && !state.els.some(e=>e.g===selFolder)) selFolder=null;
  commit();
}
function remove(){ if(msel.size) removeIds([...msel]); }
function hideSel(){ const list=selList(); if(!list.length) return; const hide=list.some(x=>!x.hidden); beginChange(); list.forEach(x=>{ x.hidden=hide; delete x.ttl; }); commit(); }
function groupSel(){
  const list=selList(); if(list.length<2) return toast('Выдели 2+ элемента (Shift+клик или рамкой)');
  beginChange();
  const named=list.find(x=>x.gn)?.gn;
  const used=new Set(state.els.filter(x=>x.gn).map(x=>x.gn)), base=gT('Группа');
  let n=1; while(used.has(`${base} ${n}`)) n++;
  const g=rid(6), name=named||`${base} ${n}`;
  list.forEach(x=>{ x.g=g; x.gn=name; });
  packGroups(); selFolder=g; commit(); toast('🔗 Сгруппировано: двигаются вместе');
}
function ungroupSel(){ const list=selList().filter(x=>x.g); if(!list.length) return; beginChange(); list.forEach(x=>{ delete x.g; delete x.gn; }); selFolder=null; commit(); toast('Группа разбита'); }
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
  if(ctrl && (e.code==='KeyY' || e.code==='KeyZ' && e.shiftKey)){ e.preventDefault(); redo(); return; }
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
  if(e.code==='F2' && el.g){ e.preventDefault(); renameFolder(el.g); return; }
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
  const same=data.room===room, rm=room;
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
      if(room!==rm) return;   // комнату сменили, пока копировались файлы
    }
    els.push(c);
  }
  if(room!==rm) return;
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
const EFFECT_NAME={ none:'Без эффекта', pulse:'Пульс', wobble:'Качание', float:'Парение', spin:'Вращение', shake:'Тряска', rainbow:'Радуга' };
const EASE_NAME={ linear:'ровно', inout:'плавно', in:'разгон', out:'торможение', back:'пружина', bounce:'отскок' };
function renderKfPresets(){
  const sel=$('kfPreset'), v=sel.value; sel.replaceChildren();
  const add=(val, txt)=>{ const o=document.createElement('option'); o.value=val; o.textContent=txt; sel.appendChild(o); };
  add('', '— выбрать анимацию —');
  const grp=(label)=>{ const g=document.createElement('optgroup'); g.label=label; sel.appendChild(g); return g; };
  let g=grp('Эффект на месте');
  for(const [k,name] of Object.entries(EFFECT_NAME)){ const o=document.createElement('option'); o.value='e:'+k; o.textContent=name; g.appendChild(o); }
  g=grp('Движение');
  for(const [k,name] of Object.entries(KF_PRESETS)){ const o=document.createElement('option'); o.value='p:'+k; o.textContent=name; g.appendChild(o); }
  if(myAnims.length){ g=grp('Мои'); myAnims.forEach((a,i)=>{ const o=document.createElement('option'); o.value='u:'+i; o.textContent='★ '+a.name; g.appendChild(o); }); }
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
// Слайдер длительности: 0,1-1 с шагом 0,05; 1-10 с шагом 0,5; 10-60 с шагом 1 (индексы 0..86)
const durOfIdx=i=>{ i=Math.round(+i)||0; return i<=18 ? Math.round((0.1+0.05*i)*100)/100 : i<=36 ? 1+0.5*(i-18) : 10+(i-36); };
const idxOfDur=d=>{ let b=0; for(let i=0;i<=86;i++) if(Math.abs(durOfIdx(i)-d)<Math.abs(durOfIdx(b)-d)) b=i; return b; };
const fmtSec=v=>(Math.round(v*100)/100).toFixed(1).replace('.',',');
// Текущая итоговая длительность анимации, сек (0 = анимации нет)
const animTotal=el=>{ const n=animNatural(el); return n>0 ? n/animSpeed(el) : 0; };
// Менять кадры/эффект, не трогая скорость: заданная длительность пересчитывается под новую естественную
function keepAnimSpeed(el, fn){
  const n0=animNatural(el), sp=animSpeed(el);
  fn();
  if(!(el.adur>0)) return;
  const n1=animNatural(el);
  if(n1===n0) return;
  if(n1>0) el.adur=Math.min(600, Math.max(0.1, Math.round(n1/sp*100)/100)); else delete el.adur;
}
let kfShownEl=null;
function renderKf(el){
  const has=!!el.kf, list=$('kfList');
  $('kfOpts').hidden=!has;
  for(const id of ['kfPlay','kfStop','kfDelLast','kfClear','kfSave']) $(id).disabled=!has;
  const nat=animNatural(el), tot=animTotal(el);
  $('iAs').disabled=$('iAd').disabled=!nat;
  setField(I('iAs'), String(tot ? idxOfDur(tot) : 0)); setField(I('iAd'), tot ? String(Math.round(tot*100)/100) : '');
  $('vAs').textContent=nat ? 'исходно '+fmtSec(nat)+' сек' : '';
  if(kfShownEl!==el.id){ kfShownEl=el.id; const sel=$('kfPreset'); sel.value=el.anim!=='none' ? 'e:'+el.anim : ''; $('kfDelSaved').hidden=true; }
  if(document.activeElement && list.contains(document.activeElement)) return;  // не мешаем вводу
  list.replaceChildren();
  if(!has) return;
  setField(I('kfMode'), el.kf.mode); setField(I('kfEnd'), el.kf.end);
  $('kfEnd').hidden = el.kf.mode!=='once';
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
  keepAnimSpeed(el, ()=>{
    if(k==='d') f.d=num(e.target.value,1,0,600)*1000;
    if(k==='e') f.e=e.target.value;
    if(k==='s') f.s=num(e.target.value,100,0,2000)/100;
  });
  e.target.blur(); commit();
});
$('kfList').addEventListener('click', e=>{
  const el=byId(selectedId), row=e.target.closest('.kf'); if(!el?.kf || !row) return;
  const i=+row.dataset.i, f=el.kf.f[i];
  if(e.target.classList.contains('n')){ act1(el, x=>{ x.kf.playing=false; x.x=num(f.x,50,0,100); x.y=num(f.y,50,0,100); x.rot=f.r; }); return; }
  const a=e.target.closest('[data-a]')?.dataset.a;   // клик приходит на иконку внутри кнопки
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
$('kfDelLast').onclick=()=>act(el=>{ if(el.kf){ el.kf.playing=false; el.kf.f.pop(); if(!el.kf.f.length) delete el.kf; } });
bindInput('iAs', (el,f)=>{
  setAnimDur(el, durOfIdx(f.value));
});
// длительность: ввод в поле (точно, десятые доли)
bindInput('iAd', (el,f)=>{ const d=parseFloat(String(f.value).replace(',','.')); if(d>0) setAnimDur(el, Math.min(60, Math.max(0.1, d))); });
// Выставить итоговую длительность (сек); кадр не прыгает при смене скорости
function setAnimDur(el, d){
  const n=animNatural(el); if(!n) return;
  const old=animSpeed(el); d=Math.round(d*100)/100;
  delete el.spd; el.adur=d;
  const v=animSpeed(el), now=Date.now();
  if(el.kf?.playing) el.kf.start=now-(now-el.kf.start)*old/v;
}
$('vAs').onclick=()=>act(el=>{ delete el.spd; delete el.adur; });   // вернуть исходную длительность
$('kfClear').onclick=()=>act(el=>{ delete el.kf; });
$('kfApply').onclick=()=>{
  const v=$('kfPreset').value, el=byId(selectedId); if(!v || !el) return toast('Выбери анимацию в списке');
  if(v.startsWith('e:')){ const k=v.slice(2); if(ANIMS.includes(k)) act1(el, x=>{ x.anim=k; }); return; }
  let kf;
  if(v.startsWith('p:')) kf=kfPreset(v.slice(2), el, boxOf(el.id));
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
    const k=el.kf; if(!k?.playing || k.mode!=='once' || now-k.start < kfRealDuration(el)) continue;
    if(k.end==='hide'){ el.hidden=true; k.playing=false; any=true; }
    else if(k.end==='back'){ k.playing=false; any=true; }
  }
  if(any){ renderAll(); publishNow(1); }
}, 150);

// ================== БИБЛИОТЕКА ЭЛЕМЕНТОВ ==================
// Элемент библиотеки хранится без id; в хранилище и бэкапе он мог быть испорчен, поэтому проверяем как элемент экрана
function cleanLibItem(it){
  if(!it || typeof it!=='object' || !validCode(it.room) || !it.el || typeof it.el!=='object' || it.el.type==='raffle') return null;
  const el=sanitizeEl({ ...it.el, id:'x' }); if(!el) return null;
  delete el.id;
  return { name:String(it.name||'Элемент').slice(0,60), room:it.room, el };
}
let library=[];
function loadLib(){ const v=lsGet('overlay.lib', []); library=(Array.isArray(v) ? v : []).map(cleanLibItem).filter(Boolean); }
loadLib();
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
  if(e.target.closest('[data-a=del]')){ if(confirm(`Удалить «${it.name}» из библиотеки?`)){ library.splice(+row.dataset.i,1); saveLib(); renderLib(); } return; }
  const el=JSON.parse(JSON.stringify(it.el)); delete el.hidden;
  const aid=assetId(el.src);
  if(aid && it.room!==room){
    try{ showUpload('Копирую файл в эту комнату…', 0.3); el.src=await uploadBlob(await getAssetBlob(it.room, aid), it.name); }
    catch(err){ hideUpload(); return err.shown ? undefined : toast('Файл не нашёлся: '+(err.message||err)); }
    hideUpload();
  }
  if(el.kf){ el.kf.start=Date.now(); if(el.kf.mode==='once') el.kf.playing=true; }
  window.Draw?.fromLib(el);
  addEl(el);
});
// Достать файл из другой комнаты (для библиотеки): из памяти пульта или из этой же программы стримера
async function getAssetBlob(fromRoom, id){
  const u=Assets.urls.get(id); if(u) return await (await fetch(u)).blob();
  const h=homeHttp(); if(!h) throw new Error('нет связи с Hudini Host');
  const src=rooms.find(r=>r.code===fromRoom); if(!src) throw new Error('комнаты, откуда этот файл, нет в списке');
  const r=await fetch(`${h.base}/files/${id}?room=${encodeURIComponent(fromRoom)}`, { headers:{ authorization:h.auth } });
  if(!r.ok) throw r.status===404 ? new Error('файл лежит у другого стримера: добавь его заново') : fileErr(r);
  const f=await openAsset(await importRoomKeys(src), new Uint8Array(await r.arrayBuffer()), id);
  if(!f) throw new Error('файл повреждён');
  return f.blob;
}

// ================== СЦЕНАРИИ: «если … → то …» ==================
// Хранятся в этом браузере для каждой комнаты; выполняются, пока пульт открыт.
let scnStore=Object.create(null);   // комната → список; без прототипа, чтобы код комнаты вроде toString не ломал поиск
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
// Сценарий из хранилища или бэкапа: только известные условия и действия и только их поля
const SCN_ID=/^[a-z0-9]{1,16}$/;
function cleanScn(x){
  if(!x || typeof x!=='object' || typeof x.id!=='string' || !SCN_ID.test(x.id)) return null;
  const t=x.trig;
  if(!t || typeof t!=='object' || typeof t.type!=='string' || !Object.hasOwn(TRIGS, t.type)) return null;
  const trig={ type:t.type };
  if(t.type==='chat'){ trig.cmd=str(t.cmd,40); trig.who=['all','subs','mods'].includes(t.who) ? t.who : 'all'; }
  if(t.type==='cs2'){ trig.ev=typeof t.ev==='string' && Object.hasOwn(CS2EV, t.ev) ? t.ev : 'kill'; trig.n=Math.round(num(t.n,3,2,5)); }
  if(t.type==='timer' || t.type==='counter') trig.el=str(t.el,40);
  if(t.type!=='manual') trig.cd=num(t.cd,10,0,3600);
  const acts=(Array.isArray(x.acts) ? x.acts : []).slice(0,40).map(a=>{
    if(!a || typeof a!=='object' || typeof a.t!=='string' || !Object.hasOwn(ACTS, a.t)) return null;
    const d=ACTS[a.t], o={ t:a.t };
    if(d.el) o.el=str(a.el,40);
    if(d.secs!=null) o.secs=num(a.secs,d.secs,0,600);
    if(d.num!=null) o.num=Math.round(num(a.num,d.num,-1e6,1e6));
    if(d.url){ o.url=str(a.url,2000); o.vol=num(a.vol,0.8,0,1); }
    if(d.scene) o.scene=str(a.scene,40);
    if(d.tpl) o.tpl=str(a.tpl,500);
    return o;
  }).filter(Boolean);
  return { id:x.id, name:str(x.name,60), on:x.on!==false, trig, acts };
}
function cleanScnStore(v){
  const out=Object.create(null);
  if(v && typeof v==='object' && !Array.isArray(v)) for(const [code, list] of Object.entries(v))
    if(validCode(code) && Array.isArray(list)) out[code]=list.slice(0,200).map(cleanScn).filter(Boolean);
  return out;
}
function loadScn(){ scnStore=cleanScnStore(lsGet('overlay.scn', null)); }
loadScn();
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
    case 'text': if(el?.type==='text') act1(el, x=>x.text=fillTpl(a.tpl||'', ctx).slice(0, ctx.cap||500)); break;
    case 'chatmsg': if(ctx.chatMsg) showChatMsg(ctx.cap ? capChatMsg(ctx.chatMsg, ctx.cap) : ctx.chatMsg); break;
    case 'timer': if(el?.type==='timer') act1(el, x=>{ timerReset(x); timerToggle(x); }); break;
    case 'wait': await sleep(num(a.secs,1,0,600)*1000); break;
  }
}
async function runScenario(sc, ctx={}){
  const row=document.querySelector(`.scn[data-id="${CSS.escape(String(sc.id))}"]`); row?.classList.add('fired'); setTimeout(()=>row?.classList.remove('fired'), 900);
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
// Защита от флуда: каждый сценарий не чаще раза в 3 с, все вместе не больше 30 раз в минуту.
// Если команду может написать любой зритель, его текст на экране обрезаем до 200 знаков.
const scnLast=new Map(), scnFired=[], SCN_MIN_CD=3000, SCN_PER_MIN=30, SCN_TEXT_CAP=200;
function capChatMsg(m, n){
  return { ...m, text:String(m.text||'').slice(0, n), emotes:(Array.isArray(m.emotes)?m.emotes:[]).filter(e=>Number(e?.[2])<n) };
}
function fire(kind, ctx, onlyId){   // onlyId: запустить только этот сценарий (его заявка выиграна)
  if(!$('scnRun').checked) return;
  for(const sc of scnList()){
    if(!sc.on || sc.trig?.type!==kind || (onlyId!=null && String(sc.id)!==onlyId)) continue;
    const c={ ...ctx };
    if(!matchTrig(sc.trig, c)) continue;
    const now=Date.now(), cd=Math.max(SCN_MIN_CD, num(sc.trig.cd,0,0,3600)*1000), last=scnLast.get(sc.id)||0;
    if(now-last<cd) continue;
    while(scnFired.length && now-scnFired[0]>=60000) scnFired.shift();
    if(scnFired.length>=SCN_PER_MIN) continue;
    scnFired.push(now); scnLast.set(sc.id, now);
    if(kind==='chat' && sc.trig.who!=='mods' && sc.trig.who!=='subs') c.cap=SCN_TEXT_CAP;
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
    const sp=document.createElement('span'); sp.textContent=`${trigText(sc.trig)} → ${(sc.acts||[]).map(a=>Object.hasOwn(ACTS, a.t) ? ACTS[a.t].n.split(' ')[0] : '?').join(' ')}`;
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
  const a=e.target.closest('[data-a]')?.dataset.a;   // клик приходит на иконку внутри кнопки
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
      const d=Object.hasOwn(ACTS, a.t) ? ACTS[a.t] : {};
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
// Сцены по комнатам: без прототипа, элементы проверены (хранилище и бэкап могли испортить)
function cleanScenes(v){
  const out=Object.create(null);
  if(v && typeof v==='object' && !Array.isArray(v)) for(const [code, list] of Object.entries(v)){
    if(!validCode(code) || !Array.isArray(list)) continue;
    out[code]=list.slice(0,200).filter(x=>x && typeof x==='object' && Array.isArray(x.els)).map(x=>({ name:String(x.name||'Сцена').slice(0,40),
      els:x.els.slice(0,MAX_ELS).map(e=>e && typeof e==='object' && e.type!=='raffle' ? sanitizeEl({ ...e, id:typeof e.id==='string' && e.id ? e.id : rid(10) }) : null).filter(Boolean) }));
  }
  return out;
}
let scenes=Object.create(null);
function loadScenes(){ scenes=cleanScenes(lsGet('overlay.scenes', null)); }
loadScenes();
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
  const a=e.target.closest('[data-a]')?.dataset.a;   // клик приходит на иконку внутри кнопки
  if(a==='del'){ if(confirm(`Удалить сцену «${sc.name}»?`)){ list.splice(i,1); saveScenes(); renderScenes(); } return; }
  if(a==='upd'){ if(confirm(`Перезаписать «${sc.name}» текущим экраном?`)){ sc.els=snapshotEls(); saveScenes(); renderScenes(); } return; }
  applyScene(sc, e.shiftKey);
  toast(`🎞 ${sc.name}${e.shiftKey?' (поверх)':''}`);
});
// id элементов сохраняем: так сценарии продолжают работать после смены сцены
function applyScene(sc, add){
  beginChange();
  const now=Date.now(), ids=new Set(add ? state.els.map(x=>x.id) : []), gmap=new Map();
  const els=JSON.parse(JSON.stringify(sc.els)).map(x=>{ if(!x.id || ids.has(x.id)) x.id=rid(10); ids.add(x.id); if(x.kf) x.kf.start=now;
    // поверх экрана: группы сцены становятся новыми, иначе они слились бы с такими же группами на экране
    if(add && x.g){ if(!gmap.has(x.g)) gmap.set(x.g, rid(6)); x.g=gmap.get(x.g); }
    return x.type==='raffle' ? null : sanitizeEl(x); }).filter(Boolean);
  state.els = add ? [...state.els, ...els].slice(0, MAX_ELS) : els;
  if(add) packGroups();
  selectedId=null; commit();
}

// Раз в минуту переотправляем экран: так брокер всегда хранит свежую подписанную версию
setInterval(()=>{ if(client?.connected && !drag && KEYS) publishNow(1); }, 60000);

// ================== ОБНОВЛЕНИЯ ПУЛЬТА ==================
// Раз в 5 минут смотрим version.json на сайте; если вышла новая версия — предлагаем перезагрузить (экран при этом не теряется)
async function checkPanelUpdate(){
  if(!/^https?:$/.test(location.protocol)) return;
  try{
    const v=await (await fetch('../version.json?t='+Date.now(), { cache:'no-store' })).json();
    if(Number(v.panel)>WIDGET_VER){ $('updBanner').hidden=false; $('updBanner').title=`Вышла версия ${v.panel}${v.notes?': '+v.notes:''}`; }
  }catch{}
}
// В приложении пульт обновляется вместе с программой: баннер берёт состояние у приложения (app_state, событие hudini-update)
// ================== БРАУЗЕР СПРАВА ==================
// В приложении это настоящий webview поверх колонки (вход в Twitch, кнопки модератора работают как в обычном браузере),
// вне приложения (сайт, тесты) — iframe: там Twitch и многие сайты встраивание запрещают.
const WEB_KEY='overlay.browser', WEB_NATIVE=!!TAURI?.core;
// Адрес этого ПК или домашней сети (включая IPv4 внутри IPv6 и имя с точкой на конце)
function localHost(host){
  let h=String(host||'').toLowerCase().replace(/^\[|\]$/g,'').replace(/\.+$/,'');
  let m=/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if(m){ const a=parseInt(m[1],16), b=parseInt(m[2],16); h=`${a>>8}.${a&255}.${b>>8}.${b&255}`; }
  else if((m=/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(h))) h=m[1];
  if(h==='localhost' || h.endsWith('.localhost') || h==='::1' || h==='::') return true;
  const v4=/^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h);
  if(v4){ const a=+v4[1], b=+v4[2];
    return a===0 || a===127 || a===10 || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===169 && b===254) || (a===100 && b>=64 && b<=127); }
  return h.includes(':') && (/^f[cd]/.test(h) || /^fe[89ab]/.test(h));   // fc00::/7, fe80::/10
}
function webUrl(raw){   // http(s) и только чужие сайты; без схемы считаем https
  raw=String(raw||'').trim(); if(!raw) return null;
  if(!/^https?:\/\//i.test(raw)){ if(/^(javascript|data|file|blob|vbscript|about|mailto|tauri|chrome|ftp):/i.test(raw)) return null; raw='https://'+raw; }
  let u; try{ u=new URL(raw); }catch{ return null; }
  if(!/^https?:$/.test(u.protocol)) return null;
  if(localHost(u.hostname)) return null;
  if(/^https?:$/.test(location.protocol) && u.origin===location.origin) return null;   // сам пульт и страницы рядом с ним
  return u.href;
}
const webCfg=(()=>{
  const v=lsGet(WEB_KEY, null)||{};
  const tabs=(Array.isArray(v.tabs)?v.tabs:[]).filter(t=>t && /^[a-z0-9]{1,12}$/.test(String(t.id)) && t.id!=='chat').slice(0,8).map(t=>({ id:String(t.id), url:webUrl(t.url)||'' }));
  return { open:v.open===true, tabs, active:tabs.some(t=>t.id===v.active)?v.active:'chat' };
})();
const webCur={};   // id → адрес, который сейчас открыт во вкладке (приходит из приложения)
let webFallback=false, webShown=null, webLastRect='';
function webSave(){ lsSet(WEB_KEY, { open:webCfg.open, tabs:webCfg.tabs, active:webCfg.active }); }
function webChatUrl(){ const ch=cleanChan(curRoom()?.chat||''); return ch ? `https://www.twitch.tv/popout/${ch}/chat?popout=` : null; }
function webEmbedChatUrl(){ const ch=cleanChan(curRoom()?.chat||''); return ch ? `https://www.twitch.tv/embed/${ch}/chat?parent=${encodeURIComponent(location.hostname||'localhost')}&darkpopout` : null; }
function webTab(id=webCfg.active){ return id==='chat' ? { id:'chat', url:webChatUrl()||'' } : (webCfg.tabs.find(t=>t.id===id) || { id:'chat', url:webChatUrl()||'' }); }
function webTabName(t){
  if(t.id==='chat') return window.HudiniI18n ? window.HudiniI18n.t('Чат канала') : 'Чат канала';
  try{ return new URL(webCur[t.id]||t.url).hostname.replace(/^www\./,''); }catch{ return window.HudiniI18n ? window.HudiniI18n.t('Новая вкладка') : 'Новая вкладка'; }
}
function webRenderTabs(){
  const box=$('webTabs'); box.replaceChildren();
  for(const t of [{ id:'chat' }, ...webCfg.tabs]){
    const b=document.createElement('button'); b.dataset.id=t.id; b.className=t.id===webCfg.active?'on':'';
    const l=document.createElement('span'); l.className='tl'; l.textContent=webTabName(t); if(t.id!=='chat') l.setAttribute('data-i18n-skip',''); b.appendChild(l);
    if(t.id!=='chat'){ const x=document.createElement('span'); x.className='x'; x.dataset.close=t.id; x.textContent='✕'; x.title='Закрыть вкладку'; b.appendChild(x); }
    box.appendChild(b);
  }
  const add=document.createElement('button'); add.dataset.add='1'; add.textContent='+'; add.title='Новая вкладка'; box.appendChild(add);
}
function webRect(){ const r=$('webSlot').getBoundingClientRect(), d=window.devicePixelRatio||1; return { x:Math.round(r.left*d), y:Math.round(r.top*d), w:Math.round(r.width*d), h:Math.round(r.height*d) }; }
function webPlace(force){
  if(!WEB_NATIVE || webFallback || !webCfg.open) return;
  const r=webRect(); if(r.w<8 || r.h<8) return;
  const key=`${r.x},${r.y},${r.w},${r.h}`; if(!force && key===webLastRect) return; webLastRect=key;
  TAURI.core.invoke('browser_place', r).catch(()=>{});
}
// то, что открыто поверх колонки (меню, справка, тур): нативный webview лежит выше страницы, поэтому его прячем
function webBlocked(){
  const slot=$('webSlot').getBoundingClientRect();
  return ['moreMenu','connPop','helpMenu','helpDrawer','tour','lock','hostTip','vaultWarn','pwDlg','lvlPop','upload','langPick'].some(id=>{
    const el=$(id); if(!el || el.hidden) return false;
    const cs=getComputedStyle(el); if(cs.display==='none' || cs.visibility==='hidden') return false;
    const r=el.getBoundingClientRect();
    return r.width>0 && r.height>0 && r.left<slot.right && r.right>slot.left && r.top<slot.bottom && r.bottom>slot.top;
  });
}
function webSync(){   // показывать webview только когда колонка открыта, у вкладки есть адрес и ничто не лежит сверху
  const tab=webTab(), has=tab.id==='chat' ? !!webChatUrl() : !!webUrl(tab.url);
  const want=webCfg.open && has && !webBlocked();
  if(WEB_NATIVE && !webFallback && want!==webShown){ webShown=want; TAURI.core.invoke('browser_visible', { visible:want }).catch(()=>{}); }
  $('webEmpty').hidden=has; $('webEmptyChat').hidden=tab.id!=='chat'; $('webEmptyNew').hidden=tab.id==='chat';
}
async function webShow(){   // открыть активную вкладку
  webRenderTabs();
  const tab=webTab(), url=tab.id==='chat' ? webChatUrl() : webUrl(tab.url);
  $('webUrl').readOnly = tab.id==='chat';
  $('webUrl').value = webCur[tab.id] || url || '';
  const native=WEB_NATIVE && !webFallback;
  $('webBack').disabled = $('webFwd').disabled = !native || !url;
  $('webReload').disabled = !url;
  $('webExt').disabled = !url;
  if(!webCfg.open) return;
  if(!url){ $('webFrame').hidden=true; $('webFrame').removeAttribute('src'); webShown=null; webSync(); return; }
  if(native){
    webPlace(true);
    try{ await TAURI.core.invoke('browser_open', { id:tab.id, url }); webShown=null; webSync(); return; }
    catch(e){ console.warn('browser_open', e); webFallback=true; }   // например, система без дочерних webview: остаётся iframe
  }
  const src = tab.id==='chat' ? webEmbedChatUrl() : url;
  if($('webFrame').getAttribute('src')!==src) $('webFrame').src=src;
  $('webFrame').hidden=false; $('webNote').hidden=false; webSync();
}
function setWebOpen(open){
  webCfg.open=!!open; webSave();
  document.body.classList.toggle('web', webCfg.open); $('webBtn').classList.toggle('on', webCfg.open);
  if(webCfg.open) requestAnimationFrame(()=>requestAnimationFrame(()=>webShow()));
  else if(WEB_NATIVE && !webFallback){ webShown=false; TAURI.core.invoke('browser_visible', { visible:false }).catch(()=>{}); }
  window.dispatchEvent(new Event('resize'));
}
function webSelect(id){ webCfg.active=id; webSave(); webShow(); }
function webNewTab(){
  if(webCfg.tabs.length>=8) return toast('Слишком много вкладок');
  const id='t'+Math.random().toString(36).slice(2,8).replace(/[^a-z0-9]/g,'a');
  webCfg.tabs.push({ id, url:'' }); webCfg.active=id; webSave(); webShow(); $('webUrl').focus();
}
function webCloseTab(id){
  const i=webCfg.tabs.findIndex(t=>t.id===id); if(i<0) return;
  webCfg.tabs.splice(i,1); delete webCur[id];
  if(webCfg.active===id) webCfg.active='chat';
  if(WEB_NATIVE) TAURI.core.invoke('browser_close', { id }).catch(()=>{});
  webSave(); webShow();
}
$('webBtn').onclick=()=>setWebOpen(!webCfg.open);
$('webTabs').addEventListener('click', e=>{
  const x=e.target.closest('[data-close]'); if(x) return webCloseTab(x.dataset.close);
  if(e.target.closest('[data-add]')) return webNewTab();
  const b=e.target.closest('button[data-id]'); if(b) webSelect(b.dataset.id);
});
$('webUrl').addEventListener('keydown', e=>{
  if(e.key!=='Enter' || $('webUrl').readOnly) return;
  const url=webUrl($('webUrl').value); if(!url) return toast('Нужен адрес сайта http(s)://…');
  const t=webCfg.tabs.find(x=>x.id===webCfg.active); if(!t) return;
  t.url=url; delete webCur[t.id]; webSave(); webShow();
});
$('webBack').onclick=()=>TAURI.core.invoke('browser_nav', { id:webCfg.active, op:'back' }).catch(()=>{});
$('webFwd').onclick=()=>TAURI.core.invoke('browser_nav', { id:webCfg.active, op:'forward' }).catch(()=>{});
$('webReload').onclick=()=>{
  if(WEB_NATIVE && !webFallback) TAURI.core.invoke('browser_nav', { id:webCfg.active, op:'reload' }).catch(()=>{});
  else { const f=$('webFrame'), s=f.getAttribute('src'); if(s){ f.removeAttribute('src'); f.src=s; } }
};
$('webExt').onclick=()=>{ const u=webCur[webCfg.active] || webTab().url || webChatUrl(); if(u && webUrl(u)) window.open(webUrl(u), '_blank', 'noopener'); };
$('webChanGo').onclick=()=>{ const v=$('webChan').value; if(cleanChan(v)) chatConnect(v); };
$('webChan').addEventListener('keydown', e=>{ if(e.key==='Enter') $('webChanGo').click(); });
if(WEB_NATIVE && TAURI.event) TAURI.event.listen('hudini-browser', e=>{
  const p=e.payload||{}, id=p.id==='chat' ? 'chat' : String(p.id||'');
  if(typeof p.url!=='string') return;
  webCur[id]=p.url;
  if(id===webCfg.active && document.activeElement!==$('webUrl')) $('webUrl').value=p.url;
  const t=webCfg.tabs.find(x=>x.id===id); if(t && webUrl(p.url)) { t.url=webUrl(p.url); webSave(); }
  webRenderTabs();
});
window.__webChatRefresh=()=>{ if(webCfg.open && webCfg.active==='chat'){ delete webCur.chat; webShow(); } else webSync(); };   // сменился канал комнаты
// положение и перекрытие: слежение за размером, окном и тем, что открылось поверх
if(window.ResizeObserver) new ResizeObserver(()=>webPlace()).observe($('webSlot'));
addEventListener('resize', ()=>webPlace());
setInterval(()=>{ if(webCfg.open){ webPlace(); webSync(); } }, 400);   // колонку могли сдвинуть перетаскиванием окон, а меню открылись и закрылись
let webSyncQ=0;
new MutationObserver(()=>{ if(webCfg.open && !webSyncQ) webSyncQ=requestAnimationFrame(()=>{ webSyncQ=0; webSync(); }); }).observe(document.body, { subtree:true, attributes:true, attributeFilter:['hidden','class'], childList:true });
document.body.classList.toggle('web', webCfg.open); $('webBtn').classList.toggle('on', webCfg.open);
webRenderTabs();
if(webCfg.open) requestAnimationFrame(()=>requestAnimationFrame(()=>webShow()));

if(TAURI?.core){
  const showAppUpdate=u=>{
    const on=!!(u && (u.state==='ready' || u.state==='available') && u.ver), b=$('updBanner');
    b.hidden=!on; if(on){ b.textContent='🆕 Обновить Hudini'; b.title='Вышла версия '+u.ver; }
  };
  // роль модератора: сначала окно с предложением (updates.js), без него приложение не перезапускается
  $('updBanner').onclick=()=>{ if(drag) return; if(window.HudiniUpdates?.active()) HudiniUpdates.offer(); else TAURI.core.invoke('apply_update').catch(e=>toast(String(e?.message||e))); };
  TAURI.core.invoke('app_state').then(a=>{ showAppUpdate(a?.update); if(a?.running==='mod'){ window.HudiniUpdates?.start(); dispatchEvent(new Event('hudini:modupdates')); } }).catch(()=>{});
  TAURI.event?.listen('hudini-update', e=>showAppUpdate(e.payload));
  $('dataDir').hidden=false; $('dataDir').onclick=()=>TAURI.core.invoke('open_data').catch(e=>toast(String(e?.message||e)));
}else{
  $('updBanner').onclick=()=>{ if(!drag) location.reload(); };
  setInterval(checkPanelUpdate, 5*60*1000); setTimeout(checkPanelUpdate, 15000);
}

// ================== СТАРТ ==================
// Сессии нет или в ней нет ключей: понятное сообщение вместо пустого пульта
function sessionProblem(text){
  const f=$('fatal'); f.style.display='flex'; f.replaceChildren();
  const box=document.createElement('div'), a=document.createElement('a');
  box.style.cssText='text-align:center;max-width:420px;line-height:1.5';
  box.append(text, document.createElement('br'));
  a.href='../app/start.html'; a.textContent='← Сессии'; a.style.color='#a78bfa';
  box.appendChild(a); f.appendChild(box);
}
async function boot(){
  if(!window.crypto?.subtle){ $('fatal').style.display='flex'; $('fatal').textContent='Пульт работает только по https:// (GitHub Pages) или с localhost: браузеру нужен модуль шифрования.'; return; }
  await HudiniStore.ready;
  loadLib(); loadScenes(); loadScn();   // в приложении хранилище могло загрузиться позже, чем выполнился этот файл
  const v=lsGet('overlay.vault2', null);
  let data = v?.locked ? await askUnlock(v.locked) : (v?.plain || null);
  rooms=(Array.isArray(data?.rooms) ? data.rooms : []).map(cleanRoom).filter(Boolean);
  sessSecrets={}; if(vaultPass && data?.sess && typeof data.sess==='object') for(const [id,sec] of Object.entries(data.sess)) { const c=window.HudiniSessions.cleanVault(sec); if(validCode(id) && c) sessSecrets[id]=c; }
  await syncSessions().catch(e=>console.warn('sessions vault', e));
  const inv=location.hash.startsWith('#invite=') ? location.hash.slice(1) : null;
  const sk=qs.has('streamer') ? window.hudiniStreamer?.take() : null;   // «Открыть пульт» в Hudini Host: одноразовый ключ (streamer.js)
  history.replaceState(null, '', location.pathname+keepQuery());
  const sid=qs.get('session'), want=sid ? sessionFor(sid) : null;
  let cur=lsGet('overlay.current', null);
  if(sid){
    // комната стримера из списка сессий; чужие ключи уже сохранённую комнату не заменяют
    if(!want) return sessionProblem('Этого стримера нет в списке сессий.');
    const { room:r, differs }=await roomFromSession(want);
    if(!r) return sessionProblem('В коде стримера нет ключей комнаты. Попроси стримера прислать код из программы Hudini Host ещё раз.');
    if(differs) alert('Эта комната уже есть в пульте, но с другими ключами.\nПульт открыт с твоими прежними ключами. Если стример их сменил, попроси новую ссылку-приглашение.');
    if(!rooms.some(x=>x.code===r.code)) rooms.push(r);
    cur=r.code;
  }
  if(sk){   // ключ меняется на сессию и ключи комнаты Hudini Host; комната стримера главнее сохранённой копии
    const { room:r, error }=await window.hudiniStreamer.login(sk);
    if(!r) return sessionProblem(error);
    const i=rooms.findIndex(x=>x.code===r.code); if(i>=0) rooms[i]={ ...rooms[i], ...r }; else rooms.push(r);
    cur=r.code;
  }
  if(!rooms.length && !inv && !TAURI) rooms.push(await makeRoom('Мой стример'));
  if(rooms.length){
    // сохранённая текущая комната могла испортиться: берём следующую рабочую, в крайнем случае новую
    for(const code of new Set([cur, ...rooms.map(r=>r.code)])){
      if(!rooms.some(r=>r.code===code)) continue;
      try{ await useRoom(code); break; }catch(e){ console.warn('room keys', e); }
    }
    if(!room){ const r=await makeRoom('Мой стример'); rooms.push(r); await useRoom(r.code); }
    if(rooms.some(r=>r.code===cur) && room!==cur) setTimeout(()=>toast('Ключи сохранённой комнаты повреждены: открыта другая комната', 6000), 500);
  }
  saveRooms();
  // испорченные данные в хранилище не должны мешать подключиться: каждая часть рисуется отдельно
  for(const f of [renderRooms, renderKfPresets, renderLib, renderScenes, renderScn, renderLockBtns, renderSlang]) try{ f(); }catch(e){ console.warn('boot', e); }
  STREAM_LANG=streamLang();
  applyBg($('bgInput').value);
  setStatus('warn', 'подключение…', 1);
  connect();
  if(inv) await acceptInvite(inv);
  if(!rooms.length){ const r=await makeRoom('Мой стример'); rooms.push(r); await useRoom(r.code); saveRooms(); renderRooms(); }
  $('toSessions').hidden=!TAURI;
  updateLink(); renderAll();
  { // раньше канал был один на весь пульт: переносим его в текущую комнату, остальные начинают без чата
    const legacy=cleanChannel(lsGet('overlay.chat','')), r=curRoom();
    if(legacy){ if(r && !r.chat){ r.chat=legacy; saveRooms(); } lsSet('overlay.chat',''); }
    const ch=curRoom()?.chat; if(ch) chatConnect(ch); }
  window.hudiniReady=true;
}
// ================== МЕТКИ β / α ==================
// Стабильное в 1.0 без меток. Бета: работает, но мало проверено на разных ПК. Альфа: экспериментально.
const reportUrl=()=>'https://niko-ua-designer.github.io/hudini/report.html?lang='+(window.HudiniI18n?.lang||'en');
const LEVELS={
  beta:{ mark:'β', name:'Бета', say:'Работает, но мало проверено на разных компьютерах. Если сбоит, напиши.' },
  alpha:{ mark:'α', name:'Альфа', say:'Экспериментально: может ломаться и измениться без предупреждения.' },
};
const FEATURES=[
  ['beta', 'Hudini Host', '#status'],
  ['beta', 'Чат Twitch', '[data-tab="chat"]'],
  ['beta', 'Сценарии', '[data-tab="auto"]'],
  ['beta', 'Голосование', '[data-add="poll"]'],
  ['beta', 'CS2', '[data-add="cs2"]'],
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
  const a=document.createElement('a'); a.href=reportUrl(); a.target='_blank'; a.rel='noopener'; a.textContent='Предложить идею или сообщить о проблеме ↗';
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
// ================== ВКЛАДКА CS2: авто-таб и серия карт ==================
// Настройки авто-таба едут в экране (state.cs2auto), виджет решает сам, когда таб выезжает.
// Серию ведёт программа стримера (тема cs2series), пульт шлёт ей подписанные команды в cs2cmd: формат, сброс, правка.
const taMem={};
let taPrevUntil=0, taPrevM=null, serDirty=false, serDraft=null;
function taCfg(){ const a=cleanCs2Auto(state.cs2auto); setCs2Num(a); return a; }
// стример выключил авто-таб в доке: кнопкой (ctl.tabOff) или быстрым выключателем (ctl.off.tab), как в widget.html
const taOffNow=()=>!!hostCtl?.tabOff || hostCtl?.off?.tab===true;
function taSet(k, v){ state.cs2auto={ ...taCfg(), [k]:v }; renderTa(); publishNow(1); }
for(const [id, k] of [['taOn','on'],['taTimeout','timeout'],['taHalf','half'],['taEnd','end'],['taHideBottom','hideBottom'],['taHideTop','hideTop']])
  $(id).addEventListener('change', e=>taSet(k, e.target.checked));
$('taNum').addEventListener('change', e=>taSet('num', e.target.value));
{ let t; $('taStrip').addEventListener('input', e=>{ clearTimeout(t); const v=e.target.value; t=setTimeout(()=>taSet('strip', v), 400); }); }
$('taStyle').addEventListener('change', e=>{ taSet('theme', e.target.value); taPlay($('taMoment').value); });
function renderTa(){
  const a=taCfg();
  for(const [id, k] of [['taOn','on'],['taTimeout','timeout'],['taHalf','half'],['taEnd','end'],['taHideBottom','hideBottom'],['taHideTop','hideTop']]) setField($(id), a[k], 'checked');
  setField($('taStyle'), a.theme); setField($('taNum'), a.num); setField($('taStrip'), a.strip);
  $('taOffNote').hidden=!taOffNow();
}
// превью во вкладке: «▶ Превью» на 6 с, а в игре — то же, что сейчас на стриме
function taPlay(m){ taPrevM=m; taPrevUntil=Date.now()+6000; const b=$('taBox'); cs2TabRender(b, null); b._on=false; taTick(); }
function taTick(){
  const box=$('taBox'); if(!box) return;
  const a=taCfg(), d=cs2Fresh() ? CS2 : null, now=Date.now();
  let m=null, data=d;
  if(now<taPrevUntil){ m=taPrevM; if(!d?.players?.length) data=cs2DemoFor(m); }
  else if(!taOffNow()) m=cs2TabMoment(d, a, taMem, now);
  if($('taPrev').offsetParent===null && m && !box._on) return;   // вкладка закрыта: не рисуем зря
  cs2TabRender(box, m ? { d:data, a:{ ...a, on:true }, m, look:cs2TabLook(state.els) } : null);
}
setInterval(()=>{ taTick(); if(!$('taOn').matches(':focus')) renderTa(); }, 250);
$('taPreview').onclick=()=>taPlay($('taMoment').value);
$('taShow').onclick=()=>{ const m=$('taMoment').value; if(sendFx({ type:'cs2tab', m, ms:8000 })){ taPlay(m); toast('📺 Таб на стриме на 8 секунд'); } };

function serCmd(cmd){
  if(!client?.connected){ toast('Нет связи с Hudini Host'); return false; }
  sealedPublish(topics(room).base+'/cs2cmd', { ...cmd, from:clientId, t:Date.now() }, { qos:1 }).catch(()=>toast('Не отправилось'));
  return true;
}
function serMapsNow(){ return serDirty && serDraft ? serDraft : (CS2_SERIES?.maps || []).map(m=>({ map:m.map, a:m.a.score, b:m.b.score })); }
function renderSeries(){
  const s=CS2_SERIES;
  setField($('serBo'), String(s?.bo || 3));
  if(!serDirty){ setField($('serNa'), s?.a.name || ''); setField($('serNb'), s?.b.name || ''); }
  $('serScore').textContent=`${s?.a.w ?? 0} : ${s?.b.w ?? 0}`;
  $('serNote').textContent = !s ? 'Серия появится, когда программа стримера подключена.' : serDirty ? 'Есть несохранённые правки.' : '';
  const box=$('serMaps');
  if(box.contains(document.activeElement)) return;
  box.replaceChildren(...serMapsNow().map((m, i)=>{
    const r=document.createElement('div'); r.className='ser-map';
    const nm=document.createElement('input'); nm.type='text'; nm.value=m.map; nm.placeholder='de_mirage';
    const a=document.createElement('input'); a.type='number'; a.min=0; a.max=99; a.value=m.a;
    const b=document.createElement('input'); b.type='number'; b.min=0; b.max=99; b.value=m.b;
    const del=document.createElement('button'); del.textContent='🗑'; del.title='Убрать карту';
    const edit=()=>{ serDraft=serMapsNow().map(x=>({ ...x })); serDirty=true; return serDraft; };
    nm.oninput=()=>{ edit()[i].map=nm.value.trim(); renderSeries(); };
    a.oninput=()=>{ edit()[i].a=Number(a.value)||0; renderSeries(); };
    b.oninput=()=>{ edit()[i].b=Number(b.value)||0; renderSeries(); };
    del.onclick=()=>{ edit().splice(i, 1); renderSeries(); };
    r.append(nm, a, b, del); return r;
  }));
}
$('serAdd').onclick=()=>{ serDraft=[...serMapsNow().map(x=>({ ...x })), { map:CS2?.map||'', a:0, b:0 }].slice(0, 7); serDirty=true; renderSeries(); };
for(const id of ['serNa','serNb']) $(id).addEventListener('input', ()=>{ if(!serDirty){ serDraft=serMapsNow().map(x=>({ ...x })); serDirty=true; } renderSeries(); });
$('serSave').onclick=()=>{
  const maps=serMapsNow().map(m=>({ map:m.map, a:{ score:m.a }, b:{ score:m.b } }));
  if(serCmd({ op:'edit', bo:Number($('serBo').value), names:{ a:$('serNa').value.trim(), b:$('serNb').value.trim() }, maps })){ serDirty=false; serDraft=null; toast('🏆 Серия сохранена'); }
};
$('serReset').onclick=()=>{ if(confirm('Начать серию заново? Записанные карты пропадут.') && serCmd({ op:'reset' })){ serDirty=false; serDraft=null; toast('↺ Серия сброшена'); } };
$('serBo').addEventListener('change', e=>{ serCmd({ op:'bo', bo:Number(e.target.value) }); });
renderTa(); renderSeries();
markLevels();
boot().catch(e=>{ console.error('boot', e); try{ sessionProblem('Пульт не запустился: '+(e?.message||e)); }catch{} });
