// Общий код пульта и виджета. Оба HTML подключают этот файл: держи их в одной папке.

// Эмодзи рисуем одним шрифтом (Noto Color Emoji) у всех: системные шрифты в старых Windows/OBS
// не знают новые эмодзи (например 🪖) и показывают пустой квадрат
// Обычный шрифт стоит перед шрифтом эмодзи: если веб-шрифт не загрузился, пробелы и цифры
// иначе берутся из шрифта эмодзи (он их тоже содержит) и текст разъезжается
const EMOJI_FONT = "'Noto Color Emoji'", TEXT_FB = "Arial,'Liberation Sans','Segoe UI'";
const FONTS = {
  montserrat:`'Montserrat',${TEXT_FB},${EMOJI_FONT},sans-serif`, russo:`'Russo One',${TEXT_FB},${EMOJI_FONT},sans-serif`,
  impact:`Impact,'Anton','Arial Black',${TEXT_FB},${EMOJI_FONT},sans-serif`, pixel:`'Press Start 2P','Courier New',${EMOJI_FONT},monospace`,
  comfortaa:`'Comfortaa',${TEXT_FB},${EMOJI_FONT},sans-serif`, caveat:`'Caveat',${TEXT_FB},${EMOJI_FONT},cursive`
};
// ---------- надписи на стриме ----------
// Язык выбирает модератор (Комната → «Язык надписей на стриме»), он приходит в состоянии экрана.
const STREAM_LANGS = ['ru', 'en', 'uk', 'de'];
let STREAM_LANG = 'ru';
const STREAM_TXT = {
  en:{ 'Пиши в чат цифру':'Type a number in chat', 'голосов':'votes', 'Голосование закрыто':'Poll closed', 'Голосование скоро начнётся':'Poll starts soon',
    'Нож':'Knife', 'Флешка':'Flashbang', 'Дым':'Smoke', 'Молотов':'Molotov', 'Зажигалка':'Incendiary', 'Ложная':'Decoy',
    'заложена':'planted', 'разминируют':'defusing', 'разминирована':'defused', 'взорвалась':'exploded',
    'появится само при мульти-килле':'shows up by itself on a multikill', '🎯 CS2: ждём данные из игры':'🎯 CS2: waiting for game data', 'Игрок':'Player',
    'смотрит':'watching', 'мёртв':'dead', 'раунд':'round', 'Раунд':'Round', '👁 Наблюдатель: выбери игрока':'👁 Spectator: pick a player',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Team panels work when the streamer watches a match as a spectator (GOTV / observer)',
    'Спецназ':'Counter-Terrorists', 'Террористы':'Terrorists', 'в голову':'headshot', 'Зритель':'Viewer', 'д':'d' },
  uk:{ 'Пиши в чат цифру':'Пиши в чат цифру', 'голосов':'голосів', 'Голосование закрыто':'Голосування закрите', 'Голосование скоро начнётся':'Голосування скоро почнеться',
    'Нож':'Ніж', 'Флешка':'Флешка', 'Дым':'Дим', 'Молотов':'Молотов', 'Зажигалка':'Запальничка', 'Ложная':'Хибна',
    'заложена':'закладена', 'разминируют':'розміновують', 'разминирована':'розмінована', 'взорвалась':'вибухнула',
    'появится само при мульти-килле':"з'явиться само при мульти-кілі", '🎯 CS2: ждём данные из игры':'🎯 CS2: чекаємо дані з гри', 'Игрок':'Гравець',
    'смотрит':'дивиться', 'мёртв':'мертвий', 'раунд':'раунд', 'Раунд':'Раунд', '👁 Наблюдатель: выбери игрока':'👁 Спостерігач: вибери гравця',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Панелі команд працюють, коли стример дивиться матч глядачем (GOTV / спостерігач)',
    'Спецназ':'Спецпризначенці', 'Террористы':'Терористи', 'в голову':'у голову', 'Зритель':'Глядач', 'д':'д' },
  de:{ 'Пиши в чат цифру':'Schreib eine Zahl in den Chat', 'голосов':'Stimmen', 'Голосование закрыто':'Umfrage beendet', 'Голосование скоро начнётся':'Umfrage startet gleich',
    'Нож':'Messer', 'Флешка':'Blendgranate', 'Дым':'Rauch', 'Молотов':'Molotow', 'Зажигалка':'Brandgranate', 'Ложная':'Köder',
    'заложена':'gelegt', 'разминируют':'wird entschärft', 'разминирована':'entschärft', 'взорвалась':'explodiert',
    'появится само при мульти-килле':'erscheint bei einem Multikill von selbst', '🎯 CS2: ждём данные из игры':'🎯 CS2: warte auf Spieldaten', 'Игрок':'Spieler',
    'смотрит':'schaut', 'мёртв':'tot', 'раунд':'Runde', 'Раунд':'Runde', '👁 Наблюдатель: выбери игрока':'👁 Zuschauer: Spieler wählen',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Team-Panels funktionieren, wenn der Streamer ein Match als Zuschauer verfolgt (GOTV / Observer)',
    'Спецназ':'Antiterroreinheit', 'Террористы':'Terroristen', 'в голову':'Kopfschuss', 'Зритель':'Zuschauer', 'д':'T' },
};
const st = s => STREAM_TXT[STREAM_LANG]?.[s] ?? s;
const ANIMS = ['none','pulse','wobble','float','spin','shake','rainbow'];
const STYLES = ['flip','neon','plain'];
const TIMER_MODES = ['countdown','stopwatch','until','clock'];
const COUNTER_MODES = ['manual','chat','interval'];
const TYPES = ['text','image','video','timer','counter','web','poll','cs2','msg'];
const CS2_VIEWS = ['card','kda','hp','score','money','weapon','streak','teams','scorebar','observed'];
// Живые данные из CS2 (приходят от программы стримера Hudini Host)
let CS2 = null;
const ASPECTS = { '16:9':'16 / 9', '4:3':'4 / 3', '1:1':'1 / 1', '9:16':'9 / 16', '21:9':'21 / 9' };
const SHAPES = ['rect','round','circle'];
const MAX_ELS = 200;

// Время пульта. Виджет подстраивает CLOCK_OFFSET, чтобы таймеры шли секунда в секунду с пультом.
let CLOCK_OFFSET = 0;
const nowMs = () => Date.now() + CLOCK_OFFSET;

// ---------- проверка данных ----------
function num(v, d, min, max){ v = Number(v); if(!Number.isFinite(v)) v = d; return Math.min(max, Math.max(min, v)); }
function hex(v, d){ return /^#[0-9a-f]{6}$/i.test(v) ? v : d; }
function str(v, n){ return String(v ?? '').slice(0, n); }
function safeUrl(u){ try{ const p = new URL(String(u).trim()); return (p.protocol==='https:'||p.protocol==='http:') ? p.href : null; }catch{ return null; } }
const ASSET_RE = /^asset:([a-z0-9]{6,24})$/;
function assetId(src){ const m = ASSET_RE.exec(src || ''); return m ? m[1] : null; }
function safeSrc(u){ return assetId(u) ? u : safeUrl(u); }
function isVideoUrl(u){ try{ return /\.(mp4|webm|mov|m4v)$/i.test(new URL(u).pathname); }catch{ return false; } }
function rgba(h, a){ const n = parseInt(h.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
const tzOk = new Map();
function validTz(tz){
  if(!tz) return '';
  if(!tzOk.has(tz)){ try{ new Intl.DateTimeFormat('ru-RU',{ timeZone:tz }); tzOk.set(tz,true); }catch{ tzOk.set(tz,false); } }
  return tzOk.get(tz) ? tz : '';
}
function outline(color, wEm){
  if(!wEm) return 'none';
  const s = [];
  for(let i=0;i<16;i++){ const a=i*Math.PI/8; s.push(`${(Math.cos(a)*wEm).toFixed(3)}em ${(Math.sin(a)*wEm).toFixed(3)}em 0 ${color}`); }
  return s.join(',');
}

function sanitizeEl(e){
  if(!e || typeof e!=='object') return null;
  const type = TYPES.includes(e.type) ? e.type : null;
  const id = str(e.id, 40);
  if(!type || !id) return null;
  const o = { id, type, x:num(e.x,50,0,100), y:num(e.y,50,0,100), rot:num(e.rot,0,-36000,36000),
    op:num(e.op,1,0,1), anim:ANIMS.includes(e.anim)?e.anim:'none', hidden:!!e.hidden };
  if(type==='text'){
    o.text=str(e.text,500); o.fs=num(e.fs,8,0.5,100);
    o.font=FONTS[e.font]?e.font:'montserrat'; o.color=hex(e.color,'#ffffff');
    o.stroke=hex(e.stroke,'#000000'); o.sw=num(e.sw,6,0,10);
    o.bg=!!e.bg; o.bgColor=hex(e.bgColor,'#000000'); o.bgA=num(e.bgA,0.6,0,1);
  } else if(type==='image' || type==='video'){
    o.src=safeSrc(e.src); if(!o.src) return null;
    o.w=num(e.w,25,1,200);
    o.hh=num(e.hh,0,0,300);   // высота в % экрана; 0 = по пропорциям картинки
    if(type==='video'){ o.sound=!!e.sound; o.vol=num(e.vol,1,0,1); o.restart=num(e.restart,0,0,1e15); }
  } else if(type==='web'){
    o.url=safeUrl(e.url); if(!o.url) return null;
    o.w=num(e.w,40,1,200); o.ar=ASPECTS[e.ar]?e.ar:'16:9'; o.shape=SHAPES.includes(e.shape)?e.shape:'rect';
    o.zoom=num(e.zoom,1,0.2,3); o.sound=!!e.sound; o.vol=num(e.vol,1,0,1); o.paused=!!e.paused; o.restart=num(e.restart,0,0,1e15);
    o.bw=num(e.bw,0,0,3); o.bc=hex(e.bc,'#ffffff');
  } else if(type==='cs2'){
    o.view=CS2_VIEWS.includes(e.view)?e.view:'card';
    o.fs=num(e.fs,4,0.5,100); o.font=FONTS[e.font]?e.font:'montserrat';
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#15171d'); o.accent=hex(e.accent,'#ffb020');
    o.label=str(e.label,40); o.side=['both','ct','t'].includes(e.side)?e.side:'both';
    o.minK=Math.round(num(e.minK,2,1,5));
  } else if(type==='msg'){
    o.user=str(e.user,40); o.ucolor=hex(e.ucolor,'#a78bfa'); o.text=str(e.text,500);
    o.emotes=(Array.isArray(e.emotes)?e.emotes:[]).slice(0,80).map(x=>[str(x?.[0],40).replace(/[^A-Za-z0-9_]/g,''), Math.round(num(x?.[1],0,0,600)), Math.round(num(x?.[2],0,0,600))]).filter(x=>x[0] && x[2]>=x[1]);
    o.badge=['mod','vip','sub','broadcaster',''].includes(e.badge)?e.badge:'';
    o.fs=num(e.fs,3,0.5,100); o.font=FONTS[e.font]?e.font:'montserrat';
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#15171d'); o.accent=hex(e.accent,'#a78bfa');
    o.maxw=num(e.maxw,38,10,100);
  } else if(type==='poll'){
    o.fs=num(e.fs,3.2,0.5,100); o.font=FONTS[e.font]?e.font:'montserrat';
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#1d1d24'); o.accent=hex(e.accent,'#7c5cff');
    o.title=str(e.title,100);
    o.opts=(Array.isArray(e.opts)?e.opts:[]).slice(0,6).map(x=>str(x,40));
    if(o.opts.length<2) o.opts=['Да','Нет'];
    o.votes=o.opts.map((_,i)=>Math.round(num(Array.isArray(e.votes)?e.votes[i]:0,0,0,1e7)));
    o.running=!!e.running; o.closeAt=num(e.closeAt,0,0,1e15);   // закрыть само в это время (0 = вручную)
  } else {
    o.fs=num(e.fs,10,0.5,100); o.font=FONTS[e.font]?e.font:'montserrat';
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#1d1d24');
    o.style=STYLES.includes(e.style)?e.style:'flip'; o.label=str(e.label,80);
    o.running=!!e.running; o.startAt=num(e.startAt,0,0,1e15);
    if(type==='timer'){
      o.mode=TIMER_MODES.includes(e.mode)?e.mode:'countdown';
      o.dur=num(e.dur,300000,0,864e6); o.left=num(e.left,o.dur,0,864e6); o.endAt=num(e.endAt,0,0,1e15);
      o.acc=num(e.acc,0,0,1e13); o.target=num(e.target,0,0,1e15);
      o.tz=validTz(str(e.tz,50)); o.secs=e.secs!==false;
      o.endText=str(e.endText,40); o.endSound=safeUrl(e.endSound)||'';
      o.endConfetti=!!e.endConfetti; o.endBlink=e.endBlink!==false;
    } else {
      o.value=Math.round(num(e.value,0,-1e9,1e9)); o.step=Math.round(num(e.step,1,1,1e6));
      o.cmode=COUNTER_MODES.includes(e.cmode)?e.cmode:'manual'; o.kw=str(e.kw,120); o.uniq=!!e.uniq;
      o.every=num(e.every,60,1,86400); o.goal=Math.round(num(e.goal,0,0,1e9));
    }
  }
  if(e.ttl) o.ttl=num(e.ttl,0,0,1e15);
  if(e.g) o.g=str(e.g,12).replace(/[^a-z0-9]/gi,'');
  const kf=sanitizeKf(e.kf); if(kf) o.kf=kf;
  return o;
}
// ---------- анимация движения по ключевым кадрам ----------
const EASES = ['linear','inout','in','out','back','bounce'];
const KF_MODES = ['loop','once','pingpong'];
const KF_ENDS = ['stay','hide','back'];
function sanitizeFrames(arr){
  return Array.isArray(arr) ? arr.slice(0,40).map(x=>({ x:num(x?.x,50,-80,180), y:num(x?.y,50,-80,180),
    r:num(x?.r,0,-36000,36000), s:num(x?.s,1,0,20), o:num(x?.o,1,0,1), d:num(x?.d,800,0,600000),
    e:EASES.includes(x?.e)?x.e:'inout' })) : [];
}
function sanitizeKf(k){
  if(!k || typeof k!=='object') return null;
  const f=sanitizeFrames(k.f); if(!f.length) return null;
  return { f, mode:KF_MODES.includes(k.mode)?k.mode:'loop', end:KF_ENDS.includes(k.end)?k.end:'stay',
    start:num(k.start,0,0,1e15), playing:!!k.playing };
}
const EASE_FN = {
  linear:t=>t,
  inout:t=>t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2,
  in:t=>t*t*t,
  out:t=>1-Math.pow(1-t,3),
  back:t=>{ const c=1.70158, c3=c+1; return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2); },
  bounce:t=>{ const n=7.5625, d=2.75;
    if(t<1/d) return n*t*t; if(t<2/d) return n*(t-=1.5/d)*t+.75;
    if(t<2.5/d) return n*(t-=2.25/d)*t+.9375; return n*(t-=2.625/d)*t+.984375; },
};
function kfSegments(kf){
  const f=kf.f, segs=[];
  for(let i=0;i<f.length-1;i++) segs.push([f[i], f[i+1], f[i].d, f[i].e]);
  if(kf.mode==='loop' && f.length>1) segs.push([f[f.length-1], f[0], f[f.length-1].d, f[f.length-1].e]);
  return segs;
}
function kfDuration(kf){ return kfSegments(kf).reduce((a,s)=>a+s[2],0); }
// Состояние анимации в момент t (мс от старта)
function kfAt(kf, t){
  const f=kf.f; if(f.length===1) return { ...f[0], done: kf.mode==='once' };
  const segs=kfSegments(kf), T=segs.reduce((a,s)=>a+s[2],0);
  if(T<=0) return { ...f[f.length-1], done:true };
  if(kf.mode==='once'){ if(t>=T) return { ...f[f.length-1], done:true }; }
  else if(kf.mode==='loop') t%=T;
  else { t%=2*T; if(t>T) t=2*T-t; }
  for(const [a,b,d,e] of segs){
    if(t<=d || d===0 && t<=0){
      const k = d>0 ? EASE_FN[e](Math.min(1,t/d)) : 1;
      const L=(p,q)=>p+(q-p)*k;
      return { x:L(a.x,b.x), y:L(a.y,b.y), r:L(a.r,b.r), s:L(a.s,b.s), o:L(a.o,b.o), done:false };
    }
    t-=d;
  }
  return { ...f[f.length-1], done:kf.mode==='once' };
}
// Применить анимацию к элементу. true = анимация рисует элемент, 'reset' = надо вернуть обычный вид.
function animApply(node, el, now){
  const kf=el.kf;
  let st = kf && kf.playing ? kfAt(kf, Math.max(0, now-kf.start)) : null;
  if(st && st.done && kf.end==='back') st=null;
  if(!st){ if(node._animOn){ node._animOn=false; node.classList.remove('animating'); return 'reset'; } return false; }
  node._animOn=true; node.classList.add('animating');
  node.style.left=st.x+'%'; node.style.top=st.y+'%';
  node.style.transform=`translate(-50%,-50%) rotate(${st.r}deg) scale(${st.s})`;
  node.style.opacity = (node._vis ?? 1) * el.op * (st.done && kf.end==='hide' ? 0 : st.o);
  return true;
}
// Готовые анимации (kfPreset, KF_PRESETS) лежат в presets/animations.js: они под лицензией MIT.

function sanitizeState(m){
  const els = Array.isArray(m?.els) ? m.els.slice(0,MAX_ELS).map(sanitizeEl).filter(Boolean) : [];
  return { visible: m?.visible !== false, els, lang: STREAM_LANGS.includes(m?.lang) ? m.lang : null };
}

// ---------- время ----------
const pad = n => String(n).padStart(2,'0');
function fmtDur(ms, roundUp){
  let s = Math.max(0, roundUp ? Math.ceil(ms/1000) : Math.floor(ms/1000));
  const d = Math.floor(s/86400); s -= d*86400;
  const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60;
  if(d) return `${d}${st('д')} ${pad(h)}:${pad(m)}:${pad(x)}`;
  if(h) return `${h}:${pad(m)}:${pad(x)}`;
  return `${pad(m)}:${pad(x)}`;
}
const clockFmt = new Map();
function clockText(el, now){
  const k = el.tz+'|'+el.secs;
  if(!clockFmt.has(k)) clockFmt.set(k, new Intl.DateTimeFormat('ru-RU', { hour:'2-digit', minute:'2-digit',
    ...(el.secs ? { second:'2-digit' } : {}), hourCycle:'h23', ...(el.tz ? { timeZone:el.tz } : {}) }));
  return clockFmt.get(k).format(now);
}
function counterValue(el, now){
  return el.cmode==='interval' && el.running
    ? el.value + Math.floor(Math.max(0, now-el.startAt) / (el.every*1000))
    : el.value;
}
// Что сейчас показывать у таймера/счётчика
function twState(el, now){
  if(el.type==='counter'){
    const v = counterValue(el, now);
    return { text: el.goal ? `${v}/${el.goal}` : String(v), ended:false, value:v,
      progress: el.goal ? Math.max(0, Math.min(1, v/el.goal)) : null };
  }
  if(el.mode==='clock') return { text: clockText(el, now), ended:false };
  if(el.mode==='stopwatch') return { text: fmtDur(el.running ? el.acc + Math.max(0, now-el.startAt) : el.acc, false), ended:false };
  const ms = el.mode==='until' ? (el.target ? el.target-now : 0) : (el.running ? el.endAt-now : el.left);
  const ended = ms<=0 && (el.mode==='until' ? el.target>0 : el.dur>0);
  return { text: ended && el.endText ? el.endText : fmtDur(Math.max(0, ms), true), ended };
}

// ---------- флип-цифры ----------
function makeCard(c){
  const card = document.createElement('span'); card.className = 'fc';
  for(const k of ['t','b','ft','fb']){
    const h = document.createElement('span'); h.className = 'fh '+k;
    const b = document.createElement('b'); b.textContent = c;
    h.appendChild(b); card.appendChild(h);
  }
  card._v = c;
  return card;
}
function flipCard(card, c){
  const old = card._v; card._v = c;
  const [t, b, ft, fb] = card.children;
  t.firstChild.textContent = c;     // верх: уже новая
  b.firstChild.textContent = old;   // низ: пока старая
  ft.firstChild.textContent = old;  // падающая шторка: старая
  fb.firstChild.textContent = c;    // выезжающая шторка: новая
  card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
  clearTimeout(card._t);
  card._t = setTimeout(()=>{ b.firstChild.textContent = card._v; card.classList.remove('flip'); }, 620);
}
function renderDisp(disp, text, style){
  if(disp._style !== style){ disp.replaceChildren(); disp._style = style; disp._sig = null; disp._text = null; }
  if(disp._text === text) return;
  disp._text = text;
  if(style !== 'flip'){ disp.textContent = text; return; }
  const chars = [...text];
  const sig = chars.map(c => /\d/.test(c) ? '#' : c).join('');
  if(disp._sig !== sig){
    disp.replaceChildren();
    disp._cards = chars.map(c => {
      if(/\d/.test(c)){ const k = makeCard(c); disp.appendChild(k); return k; }
      const s = document.createElement('span'); s.className = 'sep'; s.textContent = c; disp.appendChild(s); return null;
    });
    disp._sig = sig;
  } else {
    chars.forEach((c, i) => { const k = disp._cards[i]; if(k && k._v !== c) flipCard(k, c); });
  }
}

// ---------- DOM элемента ----------
function buildNode(el){
  const node=document.createElement('div'); node.className='el'; node.dataset.id=el.id; node.dataset.type=el.type;
  const fx=document.createElement('div'); fx.className='fx';
  const body=document.createElement('div'); body.className='body';
  let c;
  if(el.type==='text'){ c=document.createElement('div'); c.className='txt'; }
  else if(el.type==='video'){
    c=document.createElement('video'); c.autoplay=true; c.loop=true; c.muted=true; c.playsInline=true;
    c.setAttribute('playsinline',''); c.setAttribute('muted','');
  } else if(el.type==='image'){ c=document.createElement('img'); c.alt=''; c.draggable=false; }
  else if(el.type==='cs2'){ c=document.createElement('div'); c.className='cs2'; }
  else if(el.type==='msg'){ c=document.createElement('div'); c.className='msg'; }
  else if(el.type==='poll'){
    c=document.createElement('div'); c.className='poll';
    for(const k of ['ptitle','prows','pfoot']){ const d=document.createElement('div'); d.className=k; c.appendChild(d); }
  }
  else if(el.type==='web'){
    c=document.createElement('div'); c.className='web';
    const f=document.createElement('iframe');
    f.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
    f.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
    f.setAttribute('frameborder','0');
    if(parseEmbed(el.url).kind==='site') f.setAttribute('sandbox', SITE_SANDBOX);
    const ph=document.createElement('div'); ph.className='ph';
    c.append(f, ph);
  }
  else {
    c=document.createElement('div'); c.className='tw';
    const cap=document.createElement('div'); cap.className='cap';
    const disp=document.createElement('div'); disp.className='disp';
    c.append(cap, disp);
    if(el.type==='counter'){
      const bar=document.createElement('div'); bar.className='bar'; bar.hidden=true;
      const fill=document.createElement('div'); fill.className='fill';
      bar.appendChild(fill); c.appendChild(bar);
    }
  }
  c.classList.add('content'); c.setAttribute('data-i18n-skip', '');   // превью = как на стриме, не переводим
  body.appendChild(c); fx.appendChild(body); node.appendChild(fx);
  return node;
}
function paintNode(node, el, z){
  node.style.left=el.x+'%'; node.style.top=el.y+'%'; node.style.zIndex=z;
  node.style.transform=`translate(-50%,-50%) rotate(${el.rot}deg)`;
  const fx=node.firstChild, c=node.querySelector('.content');
  const cls='fx'+(el.anim!=='none'?' a-'+el.anim:''); if(fx.className!==cls) fx.className=cls;
  if(el.type==='text'){
    node.style.width='';
    if(c.textContent!==el.text) c.textContent=el.text;
    c.style.fontSize=`calc(var(--u) * ${el.fs})`;
    c.style.fontFamily=FONTS[el.font];
    c.style.color=el.color;
    c.style.textShadow=outline(el.stroke, el.sw*0.01);
    c.style.background=el.bg ? rgba(el.bgColor, el.bgA) : 'transparent';
    c.classList.toggle('plate', el.bg);
  } else if(el.type==='image' || el.type==='video'){
    node.style.width=el.w+'%';
    c.style.height = el.hh ? `calc(var(--u) * ${el.hh})` : '';
    c.style.objectFit = el.hh ? 'fill' : '';
    const url=resolveSrc(el.src);
    if(url && c.getAttribute('src')!==url) c.setAttribute('src', url);
    node.classList.toggle('loading', !url);
  } else if(el.type==='msg'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=FONTS[el.font]; c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    c.style.maxWidth=`calc(var(--u) * ${(el.maxw*16/9).toFixed(2)})`;
    const sig=JSON.stringify([el.user, el.ucolor, el.text, el.emotes, el.badge]);
    if(c._sig!==sig){ const had=!!c._sig; c._sig=sig; paintMsg(c, el); if(had){ c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } }
  } else if(el.type==='cs2'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=FONTS[el.font]; c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    c.dataset.view=el.view;
    paintCs2(c, el);
  } else if(el.type==='poll'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=FONTS[el.font]; c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    const [title, rows, foot]=c.children;
    if(title.textContent!==el.title) title.textContent=el.title; title.hidden=!el.title;
    const sig=el.opts.join('\n');
    if(rows._sig!==sig){
      rows.replaceChildren(); rows._sig=sig;
      el.opts.forEach((t,i)=>{
        const r=document.createElement('div'); r.className='pr';
        const l=document.createElement('div'); l.className='pl';
        const n=document.createElement('b'); n.textContent=i+1; l.append(n, document.createTextNode(' '+t));
        const bar=document.createElement('div'); bar.className='pb'; const f=document.createElement('div'); f.className='pf'; bar.appendChild(f);
        const v=document.createElement('div'); v.className='pv';
        r.append(l, bar, v); rows.appendChild(r);
      });
    }
    const total=el.votes.reduce((a,b)=>a+b,0), max=Math.max(...el.votes);
    [...rows.children].forEach((r,i)=>{
      const v=el.votes[i]||0, pct=total?Math.round(v/total*100):0;
      r.querySelector('.pf').style.width=pct+'%';
      r.querySelector('.pv').textContent=`${pct}% · ${v}`;
      r.classList.toggle('win', !el.running && total>0 && v===max);
    });
    foot._base = el.running ? `${st('Пиши в чат цифру')} 1–${el.opts.length} · ${st('голосов')}: ${total}` : (total ? `${st('Голосование закрыто')} · ${st('голосов')}: ${total}` : st('Голосование скоро начнётся'));
    pollFoot(foot, el, nowMs());
  } else if(el.type==='web'){
    node.style.width=el.w+'%';
    c.style.aspectRatio = el.shape==='circle' ? '1 / 1' : ASPECTS[el.ar];
    c.dataset.shape=el.shape;
    c.style.border = el.bw ? `calc(var(--u) * ${el.bw}) solid ${el.bc}` : '';
    const f=c.firstChild, z=el.zoom;
    f.style.width=(100/z)+'%'; f.style.height=(100/z)+'%'; f.style.transform=z===1?'':`scale(${z})`;
  } else {
    node.style.width='';
    c.dataset.st=el.style;
    c.style.fontSize=`calc(var(--u) * ${el.fs})`;
    c.style.fontFamily=FONTS[el.font];
    c.style.color=el.color;
    c.style.setProperty('--card', el.card);
    c.style.setProperty('--c', el.color);
    c.style.textShadow = el.style==='plain' ? outline('#000000', 0.05) : '';
    const cap=c.querySelector('.cap');
    if(cap.textContent!==el.label) cap.textContent=el.label;
    cap.hidden=!el.label;
  }
}
// Обновить цифры таймера/счётчика. Вызывается часто (10 раз в секунду).
// подпись голосования с обратным отсчётом до автозакрытия
function pollFoot(foot, el, now){
  const left = el.running && el.closeAt ? Math.max(0, Math.ceil((el.closeAt - now)/1000)) : 0;
  const t = (foot._base||'') + (left ? ` · ⏳ ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}` : '');
  if(foot.textContent !== t) foot.textContent = t;
}
function tickNode(node, el, now){
  if(el.type==='poll'){ const f=node.querySelector('.poll')?.children[2]; if(f) pollFoot(f, el, now); return null; }
  if(el.type==='cs2'){
    const c=node.querySelector('.cs2'); if(!c) return null;
    if(el.view==='streak') c.classList.toggle('on', Date.now() < (c._until||0));
    if(el.view==='scorebar'){ const t=c.querySelector('.sb-time'); if(t) t.textContent=cs2Timer(); }
    return null;
  }
  if(el.type!=='timer' && el.type!=='counter') return null;
  const tw=node.querySelector('.tw'), disp=tw.querySelector('.disp');
  const s=twState(el, now);
  renderDisp(disp, s.text, el.style);
  tw.classList.toggle('ended', s.ended);
  tw.classList.toggle('blink', s.ended && !!el.endBlink);
  if(el.type==='counter'){
    if(node._val!==undefined && node._val!==s.value && el.style!=='flip'){
      disp.classList.remove('bump'); void disp.offsetWidth; disp.classList.add('bump');
    }
    node._val=s.value;
    const bar=tw.querySelector('.bar');
    bar.hidden = s.progress==null;
    if(s.progress!=null) bar.firstChild.style.width=(s.progress*100)+'%';
  }
  return s;
}

// ---------- сайты, YouTube, Twitch, вебка ----------
function ytTime(t){
  if(!t) return 0;
  if(/^\d+$/.test(t)) return +t;
  const m = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(t);
  return m ? (+m[1]||0)*3600 + (+m[2]||0)*60 + (+m[3]||0) : 0;
}
function parseEmbed(url){
  let u; try{ u = new URL(url); }catch{ return { kind:'site' }; }
  const h = u.hostname.replace(/^(www|m)\./,'');
  let id = null;
  if(h==='youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if(/^(youtube\.com|youtube-nocookie\.com|music\.youtube\.com)$/.test(h)){
    if(u.pathname==='/watch') id = u.searchParams.get('v');
    else { const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/); if(m) id = m[1]; }
  }
  if(id && /^[\w-]{6,20}$/.test(id)) return { kind:'youtube', id, start: ytTime(u.searchParams.get('t') || u.searchParams.get('start')) };
  if(h==='clips.twitch.tv'){ const slug = u.pathname.split('/').filter(Boolean)[0]; if(slug && slug!=='embed') return { kind:'twitch', clip:slug }; }
  if(h==='twitch.tv'){
    const p = u.pathname.split('/').filter(Boolean);
    if(p[1]==='clip' && p[2]) return { kind:'twitch', clip:p[2] };
    if(p[0]==='videos' && p[1]) return { kind:'twitch', video:p[1] };
    if(p.length===1) return { kind:'twitch', channel:p[0] };
  }
  if(h==='vdo.ninja' && u.searchParams.has('view')) return { kind:'cam' };
  return { kind:'site' };
}
// Ссылка для iframe. host нужен Twitch (должен совпадать с адресом страницы).
function embedSrc(el, host, forceMute){
  const mute = forceMute || !el.sound;
  const p = parseEmbed(el.url);
  const e = encodeURIComponent;
  if(p.kind==='youtube')
    return `https://www.youtube.com/embed/${p.id}?autoplay=1&mute=${mute?1:0}&controls=0&rel=0&playsinline=1&loop=1&playlist=${p.id}&enablejsapi=1${p.start?'&start='+p.start:''}`;
  if(p.kind==='twitch'){
    if(!host) return null;
    const base = p.clip ? `https://clips.twitch.tv/embed?clip=${e(p.clip)}`
      : p.video ? `https://player.twitch.tv/?video=${e(p.video)}` : `https://player.twitch.tv/?channel=${e(p.channel)}`;
    return `${base}&parent=${e(host)}&autoplay=true&muted=${mute}`;
  }
  if(p.kind==='cam'){ const u = new URL(el.url); if(mute) u.searchParams.set('noaudio','1'); else u.searchParams.delete('noaudio'); return u.href; }
  return el.url;
}
// Обычные сайты открываем в песочнице. Ставим её при каждой смене ссылки, до загрузки:
// у элемента могли сменить YouTube на сайт, и песочница от старой ссылки не подходит
const SITE_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-forms';
function setFrameSrc(node, src, sandboxed){
  const f = node.querySelector('iframe'), ph = node.querySelector('.ph');
  if(node._src === src) return;
  node._src = src;
  if(sandboxed) f.setAttribute('sandbox', SITE_SANDBOX); else f.removeAttribute('sandbox');
  if(src) f.setAttribute('src', src); else f.removeAttribute('src');
  ph.hidden = !!src || node._noPh;
}

// ---------- управление плеером YouTube / Twitch ----------
// Команды уходят в iframe через postMessage: YouTube — iframe API (enablejsapi=1),
// Twitch — тот же протокол, что у их embed-библиотеки (namespace twitch-embed-player-proxy).
// Оба плеера сами присылают текущее время, по нему считаем перемотку «±10 с».
// Заглушку 18+ у Twitch так не снять: её нажимают в OBS через «Взаимодействовать».
const PLAYER_ORIGIN = { youtube:'https://www.youtube.com', twitch:'https://player.twitch.tv' };
const TWITCH_CMD = { pause:2, play:3, seek:4, vol:11 };
const playerTime = new WeakMap();   // окно iframe → { t: секунды, at: когда узнали }
addEventListener('message', e => {
  if(!e.source) return;
  if(e.origin === PLAYER_ORIGIN.youtube){
    let d = e.data; if(typeof d === 'string'){ try{ d = JSON.parse(d); }catch{ return; } }
    const t = d?.info?.currentTime;
    if(typeof t === 'number') playerTime.set(e.source, { t, at:Date.now() });
  } else if(e.origin === PLAYER_ORIGIN.twitch){
    const d = e.data;
    if(d?.namespace === 'twitch-embed-player-proxy' && d.eventName === 'UPDATE_STATE' && typeof d.params?.currentTime === 'number')
      playerTime.set(e.source, { t:d.params.currentTime, at:Date.now() });
  }
});
function playerKind(el){ const k = parseEmbed(el.url).kind; return k==='youtube' || k==='twitch' ? k : null; }
function playerPost(node, kind, cmd, arg){
  const w = node.querySelector('iframe')?.contentWindow; if(!w) return;
  try{
    if(kind === 'youtube'){
      const call = { play:['playVideo',[]], pause:['pauseVideo',[]], seek:['seekTo',[arg,true]], vol:['setVolume',[Math.round(arg*100)]], listen:null }[cmd];
      w.postMessage(JSON.stringify(call ? { event:'command', func:call[0], args:call[1] } : { event:'listening', id:1, channel:'widget' }), PLAYER_ORIGIN.youtube);
    } else if(kind === 'twitch' && TWITCH_CMD[cmd] !== undefined){
      w.postMessage({ eventName:TWITCH_CMD[cmd], params: cmd==='seek'||cmd==='vol' ? arg : undefined, namespace:'twitch-embed-player-proxy' }, PLAYER_ORIGIN.twitch);
    }
  }catch{}
}
// Довести плеер до нужного состояния: пауза/игра и громкость (muted = превью в пульте, без звука).
// Плеер принимает команды только после загрузки, поэтому после load повторяем несколько раз.
function playerApply(node, el, muted){
  const kind = playerKind(el); if(!kind) return;
  const f = node.querySelector('iframe'); if(!f) return;
  const want = { kind, paused:!!el.paused, vol: !muted && el.sound ? el.vol : null };
  const prev = node._plWant; node._plWant = want;
  const send = () => {
    const w = node._plWant; if(!w) return;
    playerPost(node, w.kind, 'listen');
    if(w.vol !== null) playerPost(node, w.kind, 'vol', w.vol);
    if(w.paused) playerPost(node, w.kind, 'pause');
  };
  if(!f._plHook){ f._plHook = true; f.addEventListener('load', () => { for(const ms of [600, 1500, 3000, 6000]) setTimeout(send, ms); }); }
  if(!prev || prev.kind!==want.kind || prev.vol!==want.vol || prev.paused!==want.paused){
    send();
    if(prev && prev.paused && !want.paused) playerPost(node, kind, 'play');
  }
}
// Перемотка на d секунд от текущего места (для записей и клипов; у прямого эфира не работает)
function playerSeek(node, el, d){
  const kind = playerKind(el); if(!kind) return;
  const w = node.querySelector('iframe')?.contentWindow; if(!w) return;
  const cur = playerTime.get(w);
  const now = cur ? cur.t + (node._plWant?.paused ? 0 : (Date.now()-cur.at)/1000) : 0;
  const t = Math.max(0, now + d);
  playerPost(node, kind, 'seek', t);
  playerTime.set(w, { t, at:Date.now() });
}

// ---------- файлы с компьютера ----------
// Файл хранится в программе стримера Hudini Host. Пульт шифрует и подписывает его ключами комнаты,
// программа держит байты как есть, виджет и пульты скачивают и проверяют подпись.
// Формат открытой части: [4 байта длина заголовка][заголовок JSON { id, mime, size, name }][байты файла]
const MIME_RE = /^(image|video|audio)\/[\w.+-]+$/;
async function packAsset(keys, blob, id, name){
  const head = TE.encode(JSON.stringify({ id, mime:blob.type, size:blob.size, name:str(name, 80) }));
  const data = new Uint8Array(4 + head.length + blob.size);
  new DataView(data.buffer).setUint32(0, head.length);
  data.set(head, 4); data.set(new Uint8Array(await blob.arrayBuffer()), 4 + head.length);
  return seal(keys, data, true);
}
// null = подделка, чужой файл или мусор
async function openAsset(keys, buf, id){
  const plain = await unseal(keys, buf, true); if(!plain || plain.length < 4) return null;
  const n = new DataView(plain.buffer, plain.byteOffset).getUint32(0); if(n > 4096 || 4 + n > plain.length) return null;
  let m; try{ m = JSON.parse(TD.decode(plain.subarray(4, 4 + n))); }catch{ return null; }
  if(!m || m.id !== id || !MIME_RE.test(m.mime)) return null;   // программа не может подсунуть один файл вместо другого
  const body = plain.subarray(4 + n);
  return { blob:new Blob([body], { type:m.mime }), mime:m.mime, size:body.length, name:str(m.name, 80) };
}
const Assets = {
  urls:new Map(), meta:new Map(), loading:new Set(), tries:new Map(),
  fetcher:null,                // async id → { blob, mime, size } | null; задаёт страница
  onReady:()=>{},
  reset(){ for(const u of this.urls.values()) URL.revokeObjectURL(u); this.urls.clear(); this.meta.clear(); this.tries.clear(); this.loading.clear(); this.gen=(this.gen||0)+1; },
  want(id){
    if(this.urls.has(id) || this.loading.has(id) || !this.fetcher) return;
    const t = this.tries.get(id);
    if(t && (t.timer || t.n > 12)) return;
    this.loading.add(id);
    const gen = this.gen;
    this.fetcher(id).then(r => {
      if(gen !== this.gen) return;
      if(!r) throw new Error('нет файла');
      this.add(id, r.blob, r.name); this.tries.delete(id); this.onReady(id);
    }).catch(() => {
      if(gen !== this.gen) return;
      const x = this.tries.get(id) || { n:0 }; x.n++;
      // ещё загружается у модератора или программа перезапускается: пробуем снова, всё реже
      x.timer = setTimeout(() => { x.timer = null; this.want(id); }, Math.min(60000, 1500 * 2 ** Math.min(x.n, 6)));
      this.tries.set(id, x);
    }).finally(() => { if(gen === this.gen) this.loading.delete(id); });
  },
  retry(){ for(const [id, x] of this.tries){ clearTimeout(x.timer); this.tries.delete(id); this.want(id); } },
  resolve(src){
    const id = assetId(src); if(!id) return src;
    const u = this.urls.get(id); if(!u) this.want(id);
    return u || '';
  },
  add(id, blob, name){ if(this.urls.has(id)) return; this.urls.set(id, URL.createObjectURL(blob)); this.meta.set(id, { mime:blob.type, size:blob.size, name }); },
};
function resolveSrc(src){ return Assets.resolve(src); }

// ---------- защита: подпись + шифрование ----------
// Каждое сообщение: [1 версия][1 флаги][12 iv][64 подпись, если есть][шифротекст AES-GCM].
// Шифрует общий ключ комнаты (есть у виджета), подписывает закрытый ключ (есть только у модераторов).
const b64u = {
  enc(buf){ let s=''; const b=new Uint8Array(buf); for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
  dec(str){ const s=atob(String(str).replace(/-/g,'+').replace(/_/g,'/')); const b=new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i); return b; },
};
const ECDSA = { name:'ECDSA', namedCurve:'P-256' }, SIG = { name:'ECDSA', hash:'SHA-256' };
async function newRoomKeys(){
  const aes = crypto.getRandomValues(new Uint8Array(32));
  const pair = await crypto.subtle.generateKey(ECDSA, true, ['sign','verify']);
  return { k: b64u.enc(aes), p: b64u.enc(await crypto.subtle.exportKey('raw', pair.publicKey)), s: await crypto.subtle.exportKey('jwk', pair.privateKey) };
}
async function importRoomKeys(r){
  const out = { aes: await crypto.subtle.importKey('raw', b64u.dec(r.k), 'AES-GCM', false, ['encrypt','decrypt']) };
  out.pub = await crypto.subtle.importKey('raw', b64u.dec(r.p), ECDSA, false, ['verify']);
  if(r.s) out.priv = await crypto.subtle.importKey('jwk', r.s, ECDSA, false, ['sign']);
  return out;
}
async function seal(keys, data, sign=true){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, keys.aes, data));
  const signed = sign && keys.priv;
  const head = new Uint8Array(14+(signed?64:0)); head[0]=1; head[1]=signed?1:0; head.set(iv, 2);
  if(signed){
    const msg = new Uint8Array(12+ct.length); msg.set(iv); msg.set(ct, 12);
    head.set(new Uint8Array(await crypto.subtle.sign(SIG, keys.priv, msg)), 14);
  }
  const out = new Uint8Array(head.length+ct.length); out.set(head); out.set(ct, head.length);
  return out;
}
// null = подделка, мусор или чужой ключ
async function unseal(keys, buf, requireSig=true){
  try{
    const b = new Uint8Array(buf);
    if(b.length<30 || b[0]!==1) return null;
    const signed = b[1]===1; if(requireSig && !signed) return null;
    const iv = b.subarray(2,14), ct = b.subarray(signed?78:14);
    if(signed){
      const msg = new Uint8Array(12+ct.length); msg.set(iv); msg.set(ct, 12);
      if(!await crypto.subtle.verify(SIG, keys.pub, b.subarray(14,78), msg)) return null;
    }
    return new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv }, keys.aes, ct));
  }catch{ return null; }
}
const TE = new TextEncoder(), TD = new TextDecoder();
const sealJSON = (keys, obj, sign=true) => seal(keys, TE.encode(JSON.stringify(obj)), sign);
async function unsealJSON(keys, buf, requireSig=true){ const d = await unseal(keys, buf, requireSig); if(!d) return null; try{ return JSON.parse(TD.decode(d)); }catch{ return null; } }
// Пароль → ключ (для хранилища в браузере и файла бэкапа)
async function passKey(pass, salt){
  const base = await crypto.subtle.importKey('raw', TE.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:310000, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function lockJSON(pass, obj){
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await passKey(pass, salt), TE.encode(JSON.stringify(obj)));
  return { v:1, salt:b64u.enc(salt), iv:b64u.enc(iv), ct:b64u.enc(ct) };
}
async function unlockJSON(pass, box){
  try{ const d = await crypto.subtle.decrypt({ name:'AES-GCM', iv:b64u.dec(box.iv) }, await passKey(pass, b64u.dec(box.salt)), b64u.dec(box.ct)); return JSON.parse(TD.decode(d)); }
  catch{ return null; }
}

// ---------- CS2 ----------
const WEAPONS = { ak47:'AK-47', m4a1:'M4A4', m4a1_silencer:'M4A1-S', awp:'AWP', deagle:'Desert Eagle', usp_silencer:'USP-S',
  glock:'Glock-18', hkp2000:'P2000', p250:'P250', fiveseven:'Five-SeveN', tec9:'Tec-9', cz75a:'CZ75', elite:'Dual Berettas',
  revolver:'R8', galilar:'Galil AR', famas:'FAMAS', sg556:'SG 553', aug:'AUG', ssg08:'SSG 08', scar20:'SCAR-20', g3sg1:'G3SG1',
  mac10:'MAC-10', mp9:'MP9', mp7:'MP7', mp5sd:'MP5-SD', ump45:'UMP-45', p90:'P90', bizon:'PP-Bizon', nova:'Nova', xm1014:'XM1014',
  mag7:'MAG-7', sawedoff:'Sawed-Off', negev:'Negev', m249:'M249', taser:'Zeus', c4:'C4', hegrenade:'HE', flashbang:'Флешка',
  smokegrenade:'Дым', molotov:'Молотов', incgrenade:'Зажигалка', decoy:'Ложная' };
function weaponName(w){ if(!w) return ''; const id=String(w).replace(/^weapon_/,''); return /knife|bayonet/.test(id) ? st('Нож') : st(WEAPONS[id] || id.toUpperCase()); }
function mapName(m){ if(!m) return ''; const n=String(m).replace(/^(de|cs|ar|dz|gd)_/,''); return n.charAt(0).toUpperCase()+n.slice(1); }
const money = v => '$'+String(Math.round(v||0)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const STREAK = { 2:'DOUBLE KILL', 3:'TRIPLE KILL', 4:'QUAD KILL', 5:'ACE!' };
function bombText(d){ const b=d.bomb; return b==='planted'?' · 💣 '+st('заложена'):b==='defusing'?' · 🔧 '+st('разминируют'):b==='defused'?' · ✅ '+st('разминирована'):b==='exploded'?' · 💥 '+st('взорвалась'):''; }
// Таймер фазы: сколько осталось (по времени программы стримера)
function cs2Timer(){
  const d=CS2; if(!d?.pend) return '';
  const left=Math.max(0, Math.ceil((d.pend + (d._skew||0) - Date.now())/1000));
  const m=Math.floor(left/60), s=left%60;
  const icon = d.pphase==='bomb' ? '💣 ' : d.pphase==='defuse' ? '🔧 ' : d.pphase==='freezetime' ? '❄ ' : '';
  return icon + m + ':' + String(s).padStart(2,'0');
}
function cs2Fresh(){ return CS2 && Date.now()-(CS2.at||0) < 30000; }
function h(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function paintCs2(c, el){
  const d = cs2Fresh() ? CS2 : null;
  if(c._view!==el.view){ c.replaceChildren(); c._view=el.view; c._seen=null; c.classList.remove('nodata','on','pop'); }
  if(el.view==='streak'){
    // всплывашка по событиям от программы стримера: свои мульти-киллы и (в режиме наблюдателя) любого игрока
    const list=(d?.evs||[]).filter(e=>e.k==='multikill' && e.n>=(el.minK||2));
    const last=list[list.length-1];
    if(c._seen==null) c._seen = last ? last.s : 0;          // старые события при подключении не показываем
    else if(last && last.s>c._seen){ c._seen=last.s; if(Date.now()-(last.t+(d._skew||0)) < 8000) cs2Popup(c, last); }
    if(!c.firstChild) c.replaceChildren(h('div','c-streak','TRIPLE KILL'), h('div','c-sub',st('появится само при мульти-килле')));
    return;
  }
  c.classList.toggle('nodata', !d);
  if(!d){ c.replaceChildren(h('div','c-none',st('🎯 CS2: ждём данные из игры'))); return; }
  const kd = d.d ? (d.k/d.d).toFixed(2) : (d.k||0).toFixed(2);
  const name = el.label || d.name || st('Игрок');
  const hpBar = ()=>{ const b=h('div','c-bar'), f=h('div','c-fill'); f.style.width=Math.max(0,Math.min(100,d.hp||0))+'%'; f.style.background = (d.hp||0)>50 ? '#3ddc84' : (d.hp||0)>20 ? '#ffb020' : '#ff4d5e'; b.appendChild(f); return b; };
  const kdaRow = ()=>{ const r=h('div','c-kda'); for(const [v,l] of [[d.k,'K'],[d.d,'D'],[d.a,'A']]){ r.append(h('b',null,String(v??0)), h('i',null,l)); } r.append(h('span','c-kd','K/D '+kd)); return r; };
  const parts=[];
  switch(el.view){
    case 'card': {
      const top=h('div','c-top'); top.append(h('span','c-name', name), h('span','c-map', `${mapName(d.map)}${d.round!=null?' · R'+(d.round+1):''}`));
      const bars=h('div','c-hprow');
      if(d.alive===false){ bars.append(h('span','c-dead', d.spectating ? `💀 ${st('смотрит')} ${d.spectating}` : '💀 '+st('мёртв'))); }
      else { bars.append(h('span','c-hp','❤ '+(d.hp??0)), hpBar(), h('span','c-ar',(d.helmet?'🪖 ':'🛡 ')+(d.armor??0))); }
      const bot=h('div','c-bot'); bot.append(h('span','c-money', money(d.money)), h('span','c-weap', d.weapon ? `${weaponName(d.weapon)}${d.ammoMax>0?` ${d.ammo}/${d.reserve}`:''}` : ''));
      parts.push(top, kdaRow(), bars, bot); break;
    }
    case 'kda': parts.push(h('div','c-cap', name), kdaRow()); break;
    case 'hp': {
      const r=h('div','c-hprow big');
      if(d.alive===false) r.append(h('span','c-dead','💀'));
      else r.append(h('span','c-hp','❤ '+(d.hp??0)), hpBar(), h('span','c-ar',(d.helmet?'🪖 ':'🛡 ')+(d.armor??0)));
      parts.push(r); break;
    }
    case 'score': {
      const r=h('div','c-score'); r.append(h('span','c-ct','CT'), h('b',null,String(d.ct??0)), h('span','c-sep',':'), h('b',null,String(d.tt??0)), h('span','c-t','T'));
      parts.push(r, h('div','c-map', `${mapName(d.map)}${d.round!=null?' · '+st('раунд')+' '+(d.round+1):''}`)); break;
    }
    case 'money': parts.push(h('div','c-big c-money', money(d.money))); break;
    case 'observed': {
      const o = d.observed || (d.spec ? null : { ...d, alive:d.alive!==false });
      if(!o){ parts.push(h('div','c-none',st('👁 Наблюдатель: выбери игрока'))); break; }
      const top=h('div','c-top'); top.append(h('span','c-name', `${o.slot!=null?o.slot+' · ':''}${o.name||st('Игрок')}`), h('span', o.team==='CT'?'c-ct':'c-t', o.team||''));
      const okd = o.d ? (o.k/o.d).toFixed(2) : (o.k||0).toFixed(2);
      const kr=h('div','c-kda'); for(const [v,l] of [[o.k,'K'],[o.d,'D'],[o.a,'A']]) kr.append(h('b',null,String(v??0)), h('i',null,l)); kr.append(h('span','c-kd','K/D '+okd));
      const hr=h('div','c-hprow');
      if(o.alive===false) hr.append(h('span','c-dead','💀'));
      else { const b=h('div','c-bar'), f=h('div','c-fill'); f.style.width=Math.max(0,Math.min(100,o.hp||0))+'%'; f.style.background=(o.hp||0)>50?'#3ddc84':(o.hp||0)>20?'#ffb020':'#ff4d5e'; b.appendChild(f);
        hr.append(h('span','c-hp','❤ '+(o.hp??0)), b, h('span','c-ar',(o.helmet?'🪖 ':'🛡 ')+(o.armor??0))); }
      const bot=h('div','c-bot'); bot.append(h('span','c-money', money(o.money)), h('span','c-weap', o.weapon ? `${weaponName(o.weapon)}${o.ammoMax>0?` ${o.ammo}/${o.reserve}`:''}` : ''));
      parts.push(top, kr, hr, bot); break;
    }
    case 'teams': {
      if(!d.players?.length){ parts.push(h('div','c-none',st('👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)'))); break; }
      const sides = el.side==='both' ? ['CT','T'] : [el.side.toUpperCase()];
      const wrap=h('div','tm-wrap');
      for(const side of sides){
        const col=h('div','tm-col tm-'+side.toLowerCase());
        const head=h('div','tm-head'); head.append(h('span',null, (side==='CT'?d.ctName:d.tName) || st(side==='CT'?'Спецназ':'Террористы')), h('b',null,String(side==='CT'?d.ct??0:d.tt??0)));
        col.appendChild(head);
        const list=d.players.filter(p=>p.team===side).sort((a,b)=>(a.slot??99)-(b.slot??99));
        for(const p of list){
          const r=h('div','tm-row'+(p.alive?'':' dead')+(d.obs===p.id?' obs':''));
          const hpw=h('div','tm-hp'), hf=h('div','tm-hpf'); hf.style.width=Math.max(0,Math.min(100,p.hp||0))+'%'; hpw.appendChild(hf);
          const nm=h('div','tm-name'); nm.append(h('span','tm-slot', p.slot!=null?String(p.slot):''), document.createTextNode(p.name||'?'));
          const ic=p.alive ? (p.bomb?'💣':'')+(p.kit?'🔧':'')+(p.armor>0?(p.helmet?'🪖':'🛡'):'') : '';
          const info=h('div','tm-info'); info.append(h('span','tm-hpn', p.alive?String(p.hp):'💀'), h('span','tm-ic', ic), h('span','tm-money', money(p.money)), h('span','tm-kd', `${p.k??0}/${p.d??0}`), h('span','tm-w', weaponName(p.main||p.weapon)));
          r.append(hpw, nm, info); col.appendChild(r);
        }
        wrap.appendChild(col);
      }
      parts.push(wrap); break;
    }
    case 'scorebar': {
      const r=h('div','sb');
      r.append(h('span','sb-team sb-ct', d.ctName||'CT'), h('b','sb-s',String(d.ct??0)));
      const mid=h('div','sb-mid'); mid.append(h('div','sb-time', cs2Timer()), h('div','sb-round', `${st('Раунд')} ${(d.round??0)+1}${bombText(d)}`));
      r.append(mid, h('b','sb-s',String(d.tt??0)), h('span','sb-team sb-t', d.tName||'T'));
      parts.push(r, h('div','c-map sb-map', mapName(d.map))); break;
    }
    case 'weapon': parts.push(h('div','c-big', d.weapon ? weaponName(d.weapon) : '—'), h('div','c-map', d.ammoMax>0 ? `${d.ammo} / ${d.reserve}` : '')); break;
  }
  c.replaceChildren(...parts);
}

function cs2Popup(c, ev){
  const sub=[ev.me?null:ev.name, ev.hs?`${ev.hs} ${st('в голову')}`:null, ev.weapon?weaponName(ev.weapon):null].filter(Boolean).join(' · ');
  c.replaceChildren(h('div','c-streak', STREAK[Math.min(ev.n,5)] || (ev.n+' KILLS')), h('div','c-sub', sub));
  c._until=Date.now()+3800; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); c.classList.add('on');
}
// ---------- сообщение из чата ----------
const BADGE = { mod:'🛡', vip:'💎', sub:'⭐', broadcaster:'🎥' };
function paintMsg(c, el){
  const head=h('div','m-head');
  if(el.badge) head.append(h('span','m-badge', BADGE[el.badge]));
  const nm=h('span','m-user', el.user||st('Зритель')); nm.style.color=el.ucolor; head.append(nm);
  const body=h('div','m-text');
  const cp=Array.from(el.text);                       // Twitch считает позиции эмоутов по символам
  const em=[...el.emotes].sort((a,b)=>a[1]-b[1]); let i=0;
  for(const [id,a,b] of em){
    if(a<i || a>=cp.length) continue;
    if(a>i) body.append(document.createTextNode(cp.slice(i,a).join('')));
    const img=document.createElement('img'); img.className='m-emote'; img.alt=cp.slice(a,b+1).join(''); img.draggable=false;
    img.src=`https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
    body.append(img); i=b+1;
  }
  if(i<cp.length) body.append(document.createTextNode(cp.slice(i).join('')));
  c.replaceChildren(head, body);
}
