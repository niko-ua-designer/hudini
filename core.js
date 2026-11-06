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
// ---------- свои шрифты ----------
// Файл шрифта лежит в Hudini Host как обычный файл комнаты, элемент хранит ключ 'u:<id>'.
// Автоподгонка: у разных шрифтов разная высота букв и строки, поэтому заглавные приводим к высоте Montserrat
// (size-adjust), а верх и низ строки к его же пропорциям. Тогда смена шрифта не ломает размер и рамку элемента.
const UFONT_RE = /^u:([a-z0-9]{6,24})$/;
const REF = { cap:0.70, asc:0.968, desc:0.251 };
const UFonts = { done:new Map(),   // id → 'loading' | 'ok' | 'bad'
  async load(id, buf){
    const probe = new FontFace('hu-probe-'+id, buf.slice(0)); await probe.load(); document.fonts.add(probe);
    const cx = document.createElement('canvas').getContext('2d'); cx.font = `100px 'hu-probe-${id}'`;
    const cap = cx.measureText('H').actualBoundingBoxAscent / 100; document.fonts.delete(probe);
    const adj = cap > 0.2 ? Math.min(1.6, Math.max(0.6, REF.cap / cap)) : 1;
    const pc = v => (v*100).toFixed(2)+'%';
    const f = new FontFace('hu-'+id, buf, { sizeAdjust:pc(adj), ascentOverride:pc(REF.asc/adj), descentOverride:pc(REF.desc/adj), lineGapOverride:'0%' });
    await f.load(); document.fonts.add(f); return adj;
  },
  use(id){
    if(this.done.has(id)) return;
    const u = Assets.resolve('asset:'+id); if(!u) return;   // файл ещё качается: позовут снова после onReady
    this.done.set(id, 'loading');
    fetch(u).then(r => r.arrayBuffer()).then(b => this.load(id, b)).then(() => this.done.set(id, 'ok')).catch(() => this.done.set(id, 'bad'));
  } };
function fontOf(v){ return FONTS[v] || UFONT_RE.test(v||'') ? v : 'montserrat'; }
function fontCss(key){
  const m = UFONT_RE.exec(key||''); if(!m) return FONTS[key] || FONTS.montserrat;
  UFonts.use(m[1]);
  return `'hu-${m[1]}',${TEXT_FB},${EMOJI_FONT},sans-serif`;
}
const FONT_EXT = { ttf:'font/ttf', otf:'font/otf', woff:'font/woff', woff2:'font/woff2' };

// ---------- надписи на стриме ----------
// Язык выбирает модератор (Комната → «Язык надписей на стриме»), он приходит в состоянии экрана.
const STREAM_LANGS = ['ru', 'en', 'uk', 'de'];
let STREAM_LANG = 'ru';
const STREAM_TXT = {
  en:{ "открывает":"opens", "выбил":"unboxed", "Ширпотреб":"Consumer Grade", "Промышленное":"Industrial Grade", "Армейское":"Mil-Spec", "Запрещённое":"Restricted", "Засекреченное":"Classified", "Тайное":"Covert", "Редкое":"Rare Special", "Розыгрыш":"Giveaway", "только подписчики":"subscribers only", "Пиши в чат":"Type in chat", "Пиши в чат что угодно, чтобы участвовать":"Type anything in chat to join", "Сбор закрыт, сейчас крутим!":"Entries closed, spinning now!", "Розыгрыш скоро начнётся":"Giveaway starts soon", "У подписчиков шанс x2":"Subscribers have x2 chance", "выигрывает":"wins", "Победители":"Winners", "на связи":"is here", "Напиши в чат за":"Reply in chat within", "Не ответил, перекручиваем…":"No reply, spinning again…", 'урон за раунд':"damage this round", 'Выбери двух игроков в пульте':"Pick two players in the panel", 'Дуэль появится сама после килла (режим наблюдателя)':"The duel shows up by itself after a kill (spectator mode)", 'Пиши в чат цифру':'Type a number in chat', 'голосов':'votes', 'Голосование закрыто':'Poll closed', 'Голосование скоро начнётся':'Poll starts soon',
    'Нож':'Knife', 'Флешка':'Flashbang', 'Дым':'Smoke', 'Молотов':'Molotov', 'Зажигалка':'Incendiary', 'Ложная':'Decoy',
    'заложена':'planted', 'разминируют':'defusing', 'разминирована':'defused', 'взорвалась':'exploded',
    'появится само при мульти-килле':'shows up by itself on a multikill', '🎯 CS2: ждём данные из игры':'🎯 CS2: waiting for game data', 'Игрок':'Player',
    'смотрит':'watching', 'мёртв':'dead', 'раунд':'round', 'Раунд':'Round', '👁 Наблюдатель: выбери игрока':'👁 Spectator: pick a player',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Team panels work when the streamer watches a match as a spectator (GOTV / observer)',
    'Спецназ':'Counter-Terrorists', 'Террористы':'Terrorists', 'в голову':'headshot', 'Зритель':'Viewer', 'д':'d' },
  uk:{ "открывает":"відкриває", "выбил":"вибив", "Ширпотреб":"Ширвжиток", "Промышленное":"Промислове", "Армейское":"Армійське", "Запрещённое":"Заборонене", "Засекреченное":"Засекречене", "Тайное":"Таємне", "Редкое":"Рідкісне", "Розыгрыш":"Розіграш", "только подписчики":"тільки підписники", "Пиши в чат":"Пиши в чат", "Пиши в чат что угодно, чтобы участвовать":"Пиши в чат що завгодно, щоб узяти участь", "Сбор закрыт, сейчас крутим!":"Збір закрито, зараз крутимо!", "Розыгрыш скоро начнётся":"Розіграш скоро почнеться", "У подписчиков шанс x2":"У підписників шанс x2", "выигрывает":"виграє", "Победители":"Переможці", "на связи":"на зв'язку", "Напиши в чат за":"Напиши в чат за", "Не ответил, перекручиваем…":"Не відповів, перекручуємо…", 'урон за раунд':"урон за раунд", 'Выбери двух игроков в пульте':"Вибери двох гравців у пульті", 'Дуэль появится сама после килла (режим наблюдателя)':"Дуель з'явиться сама після кіла (режим спостерігача)", 'Пиши в чат цифру':'Пиши в чат цифру', 'голосов':'голосів', 'Голосование закрыто':'Голосування закрите', 'Голосование скоро начнётся':'Голосування скоро почнеться',
    'Нож':'Ніж', 'Флешка':'Флешка', 'Дым':'Дим', 'Молотов':'Молотов', 'Зажигалка':'Запальничка', 'Ложная':'Хибна',
    'заложена':'закладена', 'разминируют':'розміновують', 'разминирована':'розмінована', 'взорвалась':'вибухнула',
    'появится само при мульти-килле':"з'явиться само при мульти-кілі", '🎯 CS2: ждём данные из игры':'🎯 CS2: чекаємо дані з гри', 'Игрок':'Гравець',
    'смотрит':'дивиться', 'мёртв':'мертвий', 'раунд':'раунд', 'Раунд':'Раунд', '👁 Наблюдатель: выбери игрока':'👁 Спостерігач: вибери гравця',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Панелі команд працюють, коли стример дивиться матч глядачем (GOTV / спостерігач)',
    'Спецназ':'Спецпризначенці', 'Террористы':'Терористи', 'в голову':'у голову', 'Зритель':'Глядач', 'д':'д' },
  de:{ "открывает":"öffnet", "выбил":"hat gezogen", "Ширпотреб":"Verbraucherklasse", "Промышленное":"Industriequalität", "Армейское":"Militärstandard", "Запрещённое":"Limitiert", "Засекреченное":"Geheim", "Тайное":"Verdeckt", "Редкое":"Selten", "Розыгрыш":"Gewinnspiel", "только подписчики":"nur Abonnenten", "Пиши в чат":"Schreib in den Chat", "Пиши в чат что угодно, чтобы участвовать":"Schreib irgendwas in den Chat, um mitzumachen", "Сбор закрыт, сейчас крутим!":"Teilnahme geschlossen, gleich wird gedreht!", "Розыгрыш скоро начнётся":"Gewinnspiel startet gleich", "У подписчиков шанс x2":"Abonnenten haben x2 Chance", "выигрывает":"gewinnt", "Победители":"Gewinner", "на связи":"ist da", "Напиши в чат за":"Antworte im Chat innerhalb", "Не ответил, перекручиваем…":"Keine Antwort, neu drehen…", 'урон за раунд':"Schaden diese Runde", 'Выбери двух игроков в пульте':"Wähle zwei Spieler im Pult", 'Дуэль появится сама после килла (режим наблюдателя)':"Das Duell erscheint nach einem Kill von selbst (Zuschauermodus)", 'Пиши в чат цифру':'Schreib eine Zahl in den Chat', 'голосов':'Stimmen', 'Голосование закрыто':'Umfrage beendet', 'Голосование скоро начнётся':'Umfrage startet gleich',
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
const TYPES = ['text','image','video','timer','counter','web','poll','cs2','msg','raffle','case'];
const CS2_VIEWS = ['card','kda','hp','score','money','weapon','streak','teams','scorebar','observed','hud_solo','hud_tour','table','duel','compare'];
// Виды на весь экран: своя сетка на 16:9, двигать их нельзя, чтобы ничего не съезжало
const CS2_FULL = new Set(['hud_solo','hud_tour','table','duel','compare']);
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

// Элементы, у которых размер можно задать рамкой: тогда они не прыгают от данных
const BOXABLE = new Set(['text','timer','counter','poll','cs2','msg']);
// Розыгрыш: сбор → (закрыт) → лента. Время ленты общее для пульта и виджета, поэтому все видят одно и то же
const RAFFLE_PHASES = ['idle','collect','closed','spin'];
// Кейс за донат: время сцены от openAt, одинаковое у пульта и виджета
const CASE_T = { land:1300, lock1:3300, lock2:3650, open:4000, reel:4800, reelDur:8200, reveal:13200 };
const CASE_REEL = 60, CASE_WIN = 52, CASE_STEP = 10.8;   // карточка 10em + зазор .8em
const RARITY7 = ['#b0c3d9','#5e98d9','#4b69ff','#8847ff','#d32ce6','#eb4b4b','#e4ae39'];
const RARITY_NAME = ['Ширпотреб','Промышленное','Армейское','Запрещённое','Засекреченное','Тайное','Редкое'];
const RAFFLE_REEL = 72, RAFFLE_WIN = 62, RAFFLE_OPEN = 1900, RAFFLE_SPIN = 7200, RAFFLE_STEP = 5.6;   // карточка 5.2em + зазор .4em
function sanitizeEl(e){
  if(!e || typeof e!=='object') return null;
  const type = TYPES.includes(e.type) ? e.type : null;
  const id = str(e.id, 40);
  if(!type || !id) return null;
  const o = { id, type, x:num(e.x,50,0,100), y:num(e.y,50,0,100), rot:num(e.rot,0,-36000,36000),
    op:num(e.op,1,0,1), anim:ANIMS.includes(e.anim)?e.anim:'none', hidden:!!e.hidden };
  if(type==='text'){
    o.text=str(e.text,500); o.fs=num(e.fs,8,0.5,100);
    o.font=fontOf(e.font); o.color=hex(e.color,'#ffffff');
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
    o.fs=num(e.fs,4,0.5,100); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#15171d'); o.accent=hex(e.accent,'#ffb020');
    o.label=str(e.label,40); o.side=['both','ct','t'].includes(e.side)?e.side:'both';
    o.minK=Math.round(num(e.minK,2,1,5));
    // вид HUD: цвета, эффекты, аватарки, команды, серия, выбранные игроки
    o.ctc=hex(e.ctc,'#5d9cec'); o.tc=hex(e.tc,'#e0a030'); o.glow=e.glow!==false; o.fx=['none','soft','bright'].includes(e.fx)?e.fx:'soft';
    o.av={}; if(e.av && typeof e.av==='object') for(const [k,v] of Object.entries(e.av).slice(0,40)){ const src=safeSrc(v); if(src) o.av[str(k,40).toLowerCase()]=src; }
    o.tnCT=str(e.tnCT,30); o.tnT=str(e.tnT,30); o.lgCT=safeSrc(e.lgCT)||''; o.lgT=safeSrc(e.lgT)||'';
    o.series=str(e.series,120); o.pick=str(e.pick,40); o.pa=str(e.pa,40); o.pb=str(e.pb,40);
    o.theme=['classic','glass','ko'].includes(e.theme)?e.theme:'glass'; o.flip=!!e.flip;
    if(CS2_FULL.has(o.view)){ o.x=50; o.y=50; o.rot=0; }
  } else if(type==='msg'){
    o.user=str(e.user,40); o.ucolor=hex(e.ucolor,'#a78bfa'); o.text=str(e.text,500);
    o.emotes=(Array.isArray(e.emotes)?e.emotes:[]).slice(0,80).map(x=>[str(x?.[0],40).replace(/[^A-Za-z0-9_]/g,''), Math.round(num(x?.[1],0,0,600)), Math.round(num(x?.[2],0,0,600))]).filter(x=>x[0] && x[2]>=x[1]);
    o.badge=['mod','vip','sub','broadcaster',''].includes(e.badge)?e.badge:'';
    o.fs=num(e.fs,3,0.5,100); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#15171d'); o.accent=hex(e.accent,'#a78bfa');
    o.maxw=num(e.maxw,38,10,100);
  } else if(type==='case'){
    o.x=50; o.y=50; o.rot=0; o.fs=num(e.fs,4,1,12); o.font=fontOf(e.font); o.color=hex(e.color,'#ffffff');
    o.name=str(e.name,40)||'HUDINI CASE'; o.logo=safeSrc(e.logo)||''; o.cc=hex(e.cc,'#7c5cff');
    o.items=(Array.isArray(e.items)?e.items:[]).slice(0,40).map(x=>({ n:str(x?.n,40), img:safeSrc(x?.img)||'', r:Math.round(num(x?.r,2,0,6)), p:num(x?.p,0,0,100) }));
    o.openAt=num(e.openAt,0,0,1e15); o.donor=str(e.donor,40); o.amount=str(e.amount,24);
    o.win=Math.round(num(e.win,-1,-1,39)); o.jit=num(e.jit,0,-0.4,0.4);
    o.reel=(Array.isArray(e.reel)?e.reel:[]).slice(0,CASE_REEL).map(v=>Math.round(num(v,0,0,39)));
    o.hideAfter=num(e.hideAfter,12,3,120); o.vol=num(e.vol,0.8,0,1); o.q=e.q==='low'?'low':'high';
    o.snd={}; for(const k of ['in','lock','open','tick','win']){ const v=safeSrc(e.snd?.[k]); if(v) o.snd[k]=v; }
  } else if(type==='raffle'){
    o.fs=num(e.fs,3,0.5,100); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#141824'); o.accent=hex(e.accent,'#7c5cff');
    o.title=str(e.title,80); o.prize=str(e.prize,120); o.pimg=safeSrc(e.pimg)||'';
    o.entry=['word','any'].includes(e.entry)?e.entry:'word'; o.kw=str(e.kw,30).trim()||'!участвую';
    o.subs=!!e.subs; o.subx2=e.subx2!==false; o.auto=e.auto!==false;
    o.phase=RAFFLE_PHASES.includes(e.phase)?e.phase:'idle';
    o.closeAt=num(e.closeAt,0,0,1e15); o.n=Math.round(num(e.n,0,0,1e7));
    o.reel=(Array.isArray(e.reel)?e.reel:[]).slice(0,RAFFLE_REEL).map(x=>[str(x?.[0],40), Math.round(num(x?.[1],0,0,4))]);
    o.spinAt=num(e.spinAt,0,0,1e15); o.jit=num(e.jit,0,-0.45,0.45);
    o.winner=str(e.winner,40); o.wlogin=str(e.wlogin,40).toLowerCase();
    o.winners=(Array.isArray(e.winners)?e.winners:[]).slice(-50).map(x=>str(x,40)).filter(Boolean);
    o.confirm=Math.round(num(e.confirm,0,0,600)); o.cUntil=num(e.cUntil,0,0,1e15); o.ok=!!e.ok;
    o.snd=safeSrc(e.snd)||''; o.vfx=safeSrc(e.vfx)||''; o.key=e.key!==false; o.kc=hex(e.kc,'#00ff00'); o.ksim=num(e.ksim,0.4,0.05,0.9);
    o.fxc=e.fxc!==false; o.ticks=e.ticks!==false;
  } else if(type==='poll'){
    o.fs=num(e.fs,3.2,0.5,100); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#1d1d24'); o.accent=hex(e.accent,'#7c5cff');
    o.title=str(e.title,100);
    o.opts=(Array.isArray(e.opts)?e.opts:[]).slice(0,6).map(x=>str(x,40));
    if(o.opts.length<2) o.opts=['Да','Нет'];
    o.votes=o.opts.map((_,i)=>Math.round(num(Array.isArray(e.votes)?e.votes[i]:0,0,0,1e7)));
    o.running=!!e.running; o.closeAt=num(e.closeAt,0,0,1e15);   // закрыть само в это время (0 = вручную)
  } else {
    o.fs=num(e.fs,10,0.5,100); o.font=fontOf(e.font);
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
  // своя рамка: ширина в % экрана и высота в % высоты экрана (0 = по содержимому)
  if(BOXABLE.has(o.type)){ o.bw=num(e.bw,0,0,100); o.bh=num(e.bh,0,0,100); }
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
  const fonts = (Array.isArray(m?.fonts) ? m.fonts : []).slice(0, 40)
    .filter(f => /^[a-z0-9]{6,24}$/.test(f?.id||'')).map(f => ({ id:f.id, name:str(f.name, 60) || 'Шрифт' }));
  return { visible: m?.visible !== false, els, lang: STREAM_LANGS.includes(m?.lang) ? m.lang : null, fonts };
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

// ---------- розыгрыш: сбор в чате, открытие кейса, лента как в CS2, победитель ----------
const RARITY = ['#4b69ff','#8847ff','#d32ce6','#eb4b4b','#e4ae39'];
// Звуки и эффекты на стриме задаёт виджет; в пульте превью молчит
const RaffleFx = { tick(){}, win(){}, open(){} };
const rEase = p => 1 - Math.pow(1 - p, 4);
function rh(tag, cls, text){ const n=document.createElement(tag); if(cls) n.className=cls; if(text!=null) n.textContent=text; return n; }
function rafPrize(el){
  const p=rh('div','rf-prize'); if(!el.prize && !el.pimg) return p;
  if(el.pimg){ const im=rh('img'); im.alt=''; im.src=resolveSrc(el.pimg); p.appendChild(im); }
  if(el.prize) p.appendChild(rh('b',null,el.prize));
  return p;
}
function rafCard(name, rar, win){
  const c=rh('div','rf-card'+(win?' win':'')); c.style.setProperty('--r', RARITY[rar]||RARITY[0]);
  const ini=String(name||'?').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'?';
  c.append(rh('div','rf-ava',ini), rh('div','rf-nm',name)); return c;
}
function paintRaffle(c, el){
  const sig=JSON.stringify([el.phase, el.title, el.prize, el.pimg && resolveSrc(el.pimg), el.entry, el.kw, el.subs, el.subx2, el.spinAt, el.winner, el.winners, el.confirm, el.ok, STREAM_LANG]);
  if(el.snd) resolveSrc(el.snd); if(el.vfx) resolveSrc(el.vfx);   // заранее скачать звук и видео победы, чтобы не опоздали
  if(c._sig===sig){ raffleTick(c, el, nowMs()); return; }
  c._sig=sig; c.dataset.phase=el.phase; c.replaceChildren();
  const head=rh('div','rf-head'); head.append(rh('span','rf-ic','🎁'), rh('b',null, el.title || st('Розыгрыш')));
  if(el.subs) head.appendChild(rh('span','rf-tag', st('только подписчики')));
  c.appendChild(head);
  if(el.phase==='idle' || el.phase==='collect' || el.phase==='closed'){
    c.appendChild(rafPrize(el));
    const how=rh('div','rf-how');
    if(el.phase==='collect'){
      if(el.entry==='word'){ how.append(document.createTextNode(st('Пиши в чат')+' ')); how.appendChild(rh('code',null,el.kw)); }
      else how.textContent=st('Пиши в чат что угодно, чтобы участвовать');
    } else how.textContent = el.phase==='closed' ? st('Сбор закрыт, сейчас крутим!') : st('Розыгрыш скоро начнётся');
    c.appendChild(how);
    const foot=rh('div','rf-foot'); foot.append(rh('span','rf-n'), rh('span','rf-t')); c.appendChild(foot);
    if(el.subx2 && !el.subs && el.phase!=='closed') c.appendChild(rh('div','rf-note', st('У подписчиков шанс x2')));
  } else {
    // лента: окно, полоса карточек, стрелка по центру
    const stg=rh('div','rf-stage');
    const box=rh('div','rf-case'); box.append(rh('div','rf-lid'), rh('div','rf-body'), rh('div','rf-glow'));
    const win=rh('div','rf-win'), strip=rh('div','rf-strip');
    el.reel.forEach(([n,r],i)=>strip.appendChild(rafCard(n, r, i===RAFFLE_WIN)));
    win.append(strip, rh('div','rf-mark')); stg.append(box, win); c.appendChild(stg);
    const res=rh('div','rf-res');
    const wn=rh('div','rf-wname'); wn.append(rh('span','rf-cup','🏆'), rh('b',null, el.winner));
    res.append(wn, rh('div','rf-wins', st('выигрывает')), rafPrize(el), rh('div','rf-conf'));
    c.appendChild(res);
    const others=el.winners.filter(w=>w!==el.winner);
    if(others.length) c.appendChild(rh('div','rf-list', st('Победители')+': '+others.join(', ')));
    c._strip=strip; c._box=box; c._res=res; c._lastIdx=-1;
  }
  raffleTick(c, el, nowMs());
}
function raffleTick(c, el, now){
  if(el.phase!=='spin'){
    const n=c.querySelector('.rf-n'), t=c.querySelector('.rf-t');
    if(n){ const v=`👥 ${el.n}`; if(n.textContent!==v) n.textContent=v; }
    if(t){ const left = el.phase==='collect' && el.closeAt ? Math.max(0, Math.ceil((el.closeAt-now)/1000)) : 0;
      const v = left ? `⏳ ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}` : ''; if(t.textContent!==v) t.textContent=v; }
    return;
  }
  const t=now-el.spinAt;
  c.classList.toggle('opening', t < RAFFLE_OPEN);
  c.classList.toggle('done', t >= RAFFLE_OPEN + RAFFLE_SPIN);
  c.classList.toggle('reveal', t >= RAFFLE_OPEN + RAFFLE_SPIN + 700);
  if(c._box && t>=0 && t<RAFFLE_OPEN && c._opened!==el.spinAt){ c._opened=el.spinAt; RaffleFx.open(el); }
  const conf=c.querySelector('.rf-conf');
  if(conf){
    let v='';
    if(el.confirm){ if(el.ok) v='✅ '+st('на связи'); else { const l=Math.max(0, Math.ceil((el.cUntil-now)/1000)); v = l ? `⌛ ${st('Напиши в чат за')} ${Math.floor(l/60)}:${String(l%60).padStart(2,'0')}` : st('Не ответил, перекручиваем…'); } }
    if(conf.textContent!==v) conf.textContent=v; conf.classList.toggle('ok', el.ok);
  }
  if(c._won!==el.spinAt && t >= RAFFLE_OPEN + RAFFLE_SPIN + 700){ c._won=el.spinAt; if(t < RAFFLE_OPEN + RAFFLE_SPIN + 8000) RaffleFx.win(el); }
  if(!c._loop){ c._loop=true; const step=()=>{ if(!c.isConnected || !c._strip){ c._loop=false; return; } rafFrame(c, el, nowMs()); if(nowMs()-el.spinAt < RAFFLE_OPEN+RAFFLE_SPIN+200) requestAnimationFrame(step); else { rafFrame(c, el, nowMs()); c._loop=false; } }; requestAnimationFrame(step); }
}
// Положение ленты считается от общего времени: открывший стрим позже увидит тот же кадр
function rafFrame(c, el, now){
  const p=Math.min(1, Math.max(0, (now-el.spinAt-RAFFLE_OPEN)/RAFFLE_SPIN));
  const target=(RAFFLE_WIN + 0.5 + el.jit*0.8)*RAFFLE_STEP - 0.2;   // центр выигрышной карточки (со смещением) под стрелкой
  const x=target*rEase(p);
  c._strip.style.transform=`translate3d(${(-x).toFixed(3)}em,0,0)`;
  const idx=Math.floor((x+0.2)/RAFFLE_STEP);
  if(idx!==c._lastIdx){ if(c._lastIdx>=0 && p>0 && p<1) RaffleFx.tick(el); c._lastIdx=idx; }
}

// ---------- кейс за донат: 3D-открытие (case3d.js), лента с «почти-почти», взрыв цвета редкости ----------
// Звуки и 3D рисует case3d.js. В пульте сцена тише и легче: CaseFx.audio включает только виджет.
const CaseFx = { audio:false, low:false };
// Предмет без картинки: огранённый кристалл в цвет редкости
function gemSvg(){
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 64 64'); const id='gm'+(gemSvg.n=(gemSvg.n||0)+1);
  s.innerHTML='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity=".55"/></linearGradient></defs>'+
    '<path d="M20 8h24l14 16-26 32L6 24z" fill="url(#'+id+')"/><path d="M6 24h52M20 8l-4 16 16 32 16-32-4-16M32 8l-16 16M32 8l16 16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/>';
  return s;
}
function itemCard(it, cls){
  const c=rh('div','cs-card'+(cls?' '+cls:'')); c.style.setProperty('--r', RARITY7[it?.r??2]);
  const pic=rh('div','cs-pic');
  if(it?.img){ const im=rh('img'); im.alt=''; im.draggable=false; im.src=resolveSrc(it.img); pic.appendChild(im); }
  else pic.appendChild(gemSvg());
  c.append(pic, rh('div','cs-nm', it?.n||'?'));
  return c;
}
function paintCase(c, el){
  for(const it of el.items) if(it.img) resolveSrc(it.img);
  for(const v of Object.values(el.snd)) resolveSrc(v);
  const sig=JSON.stringify([el.openAt, el.items, el.reel, el.win, el.donor, el.amount, el.name, el.cc, el.logo && resolveSrc(el.logo), STREAM_LANG]);
  if(c._sig!==sig){
    c._sig=sig; c.replaceChildren(); c._t0=el.openAt;
    const g=rh('div','cs-3d'); c.appendChild(g); c._gl=g;
    const top=rh('div','cs-top'); top.append(rh('b','cs-donor', el.donor||st('Зритель')), rh('span',null,' '+st('открывает')+' '), rh('b','cs-cname', el.name));
    if(el.amount) top.appendChild(rh('span','cs-amt', el.amount));
    c.appendChild(top);
    const reel=rh('div','cs-reel'), strip=rh('div','cs-strip');
    el.reel.forEach((ix,i)=>strip.appendChild(itemCard(el.items[ix], i===CASE_WIN?'win':'')));
    reel.append(strip, rh('div','cs-mark')); c.appendChild(reel);
    const w=el.items[el.win];
    const rev=rh('div','cs-rev'+(w?.r===6?' gold':'')); if(w) rev.style.setProperty('--r', RARITY7[w.r]);
    rev.append(rh('div','cs-rays'), rh('canvas','cs-sparks'));
    const card=rh('div','cs-big'); const pic=rh('div','cs-bpic');
    if(w?.img){ const im=rh('img'); im.alt=''; im.src=resolveSrc(w.img); pic.appendChild(im); } else pic.appendChild(gemSvg());
    card.append(pic, rh('div','cs-rar', w ? st(RARITY_NAME[w.r]) : ''), rh('div','cs-bname', w?.n||''), rh('div','cs-who', (el.donor||st('Зритель'))+' '+st('выбил')));
    rev.appendChild(card); c.appendChild(rev);
    c._strip=strip; c._last=-1; c._sparks=null;
  }
  caseKick(c, el);
}
// Положение ленты: разгон, долгое торможение на соседней карточке и медленный дотяг до выигрыша
function caseReelX(el, t){
  const p=Math.min(1, Math.max(0, t/CASE_T.reelDur));
  const target=(CASE_WIN+0.5+el.jit)*CASE_STEP - 0.4, gap=CASE_STEP*(0.5+el.jit)+1.2;   // стоп: над прошлой карточкой
  const x1=target-gap;
  if(p<0.8){ const q=p/0.8; return x1*(1-Math.pow(1-q,3.2)); }
  const q=(p-0.8)/0.2; return x1 + gap*(q*q*(3-2*q));
}
function caseKick(c, el){
  if(c._loop || !el.openAt) return;
  const end=el.openAt+CASE_T.reveal+el.hideAfter*1000+1500;
  if(nowMs()>end) { c.dataset.ph='gone'; return; }
  c._loop=true;
  const step=()=>{
    const now = window.__caseFreeze!=null ? el.openAt+window.__caseFreeze : nowMs();   // __caseFreeze: стоп-кадр для тестов и скриншотов
    if(!c.isConnected || now>end || c._t0!==el.openAt){ c._loop=false; if(now>end) c.dataset.ph='gone'; window.Case3D?.stop(c); return; }
    caseFrame(c, el, now-el.openAt);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function caseFrame(c, el, t){
  const ph = t<0 ? 'wait' : t<CASE_T.reel ? 'open' : t<CASE_T.reveal ? 'reel' : 'reveal';
  if(c.dataset.ph!==ph) c.dataset.ph=ph;
  window.Case3D?.frame(c, el, t);
  if(t>=CASE_T.reel-300 && c._strip){
    const x=caseReelX(el, t-CASE_T.reel);
    c._strip.style.transform=`translate3d(${(-x).toFixed(3)}em,0,0)`;
    const idx=Math.floor((x+0.4)/CASE_STEP);
    if(idx!==c._last){ if(c._last>=0 && t<CASE_T.reel+CASE_T.reelDur) window.Case3D?.tick(el, Math.min(1,(t-CASE_T.reel)/CASE_T.reelDur)); c._last=idx; }
  }
  if(ph==='reveal') caseSparks(c, el, t-CASE_T.reveal);
}
// Искры в цвет редкости при выпадении (2D-холст поверх)
function caseSparks(c, el, t){
  const cv=c.querySelector('.cs-sparks'); if(!cv) return;
  const w=el.items[el.win]; if(!w) return;
  if(!c._sparks){
    const W=cv.width=Math.max(320, c.clientWidth|0), H=cv.height=Math.max(180, c.clientHeight|0), n = w.r>=5 ? 260 : w.r>=3 ? 160 : 90;
    c._sparks=Array.from({ length:n }, ()=>{ const a=Math.random()*Math.PI*2, v=(0.25+Math.random())*H*0.012*(w.r>=5?1.5:1); return { x:W/2, y:H*0.46, vx:Math.cos(a)*v, vy:Math.sin(a)*v-H*0.004, s:1+Math.random()*2.6, l:0.7+Math.random()*1.3 }; });
    c._spT=t;
  }
  const ctx=cv.getContext('2d'), dt=Math.min(50, t-c._spT)/16.7; c._spT=t;
  ctx.clearRect(0,0,cv.width,cv.height); ctx.globalCompositeOperation='lighter';
  const col=RARITY7[w.r];
  for(const p of c._sparks){
    const age=t/1000; if(age>p.l*2.2) continue;
    p.vy+=cv.height*0.00022*dt; p.vx*=Math.pow(0.985,dt); p.vy*=Math.pow(0.985,dt); p.x+=p.vx*dt; p.y+=p.vy*dt;
    const a=Math.max(0, 1-age/(p.l*2.2));
    ctx.globalAlpha=a; ctx.fillStyle = Math.random()<0.25 ? '#fff' : col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.s*(0.6+a), 0, 7); ctx.fill();
  }
  ctx.globalAlpha=1;
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
  else if(el.type==='raffle'){ c=document.createElement('div'); c.className='raf'; }
  else if(el.type==='case'){ c=document.createElement('div'); c.className='case'; }
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
    c.style.fontFamily=fontCss(el.font);
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
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    c.style.maxWidth=`calc(var(--u) * ${(el.maxw*16/9).toFixed(2)})`;
    const sig=JSON.stringify([el.user, el.ucolor, el.text, el.emotes, el.badge]);
    if(c._sig!==sig){ const had=!!c._sig; c._sig=sig; paintMsg(c, el); if(had){ c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } }
  } else if(el.type==='cs2'){
    const full=CS2_FULL.has(el.view);
    node.style.width = full ? '100%' : ''; node.classList.toggle('full', full);
    c.classList.toggle('full', full); c.classList.toggle('glow', full && el.glow); c.dataset.fx = el.fx; c.dataset.theme = el.theme;
    c.style.setProperty('--ct', el.ctc); c.style.setProperty('--tt', el.tc);
    c.style.fontSize = full ? `calc(var(--u) * ${(el.fs/4*1.85).toFixed(3)})` : `calc(var(--u) * ${el.fs})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    c.dataset.view=el.view;
    paintCs2(c, el);
  } else if(el.type==='case'){
    node.style.width='100%'; node.classList.add('full');
    c.style.fontSize=`calc(var(--u) * ${(el.fs/4*1.7).toFixed(3)})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--cc', el.cc);
    paintCase(c, el);
  } else if(el.type==='raffle'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    paintRaffle(c, el);
  } else if(el.type==='poll'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
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
    c.style.fontFamily=fontCss(el.font);
    c.style.color=el.color;
    c.style.setProperty('--card', el.card);
    c.style.setProperty('--c', el.color);
    c.style.textShadow = el.style==='plain' ? outline('#000000', 0.05) : '';
    const cap=c.querySelector('.cap');
    if(cap.textContent!==el.label) cap.textContent=el.label;
    cap.hidden=!el.label;
  }
  // рамка, которую модератор растянул руками: содержимое живёт внутри неё
  if(BOXABLE.has(el.type) && !(el.type==='cs2' && CS2_FULL.has(el.view))){
    const box=node.querySelector('.content');
    if(box){
      box.classList.toggle('boxed', el.bw>0 || el.bh>0);
      if(el.bw>0) node.style.width=el.bw+'%';
      box.style.height = el.bh>0 ? `calc(var(--u) * ${el.bh})` : '';
    }
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
  if(el.type==='case'){ const c=node.querySelector('.case'); if(c) caseKick(c, el); return null; }
  if(el.type==='raffle'){ const c=node.querySelector('.raf'); if(c) raffleTick(c, el, now); return null; }
  if(el.type==='poll'){ const f=node.querySelector('.poll')?.children[2]; if(f) pollFoot(f, el, now); return null; }
  if(el.type==='cs2'){
    const c=node.querySelector('.cs2'); if(!c) return null;
    if(el.view==='streak') c.classList.toggle('on', Date.now() < (c._until||0));
    if(el.view==='scorebar'){ const t=c.querySelector('.sb-time'); if(t) timerSet(t, false); }
    if(CS2_FULL.has(el.view)){
      const t=c.querySelector('.hd-time'); if(t) timerSet(t, !!el.flip);
      if(el.view==='duel' && c._duel && Date.now()>(c._duntil||0) && c.querySelector('.hd-vs')){ c._sig=null; paintCs2(c, el); }
      if(c._feedT!==Math.floor(Date.now()/1000)){ c._feedT=Math.floor(Date.now()/1000); if(c.querySelector('.hd-kill')){ c._sig=null; paintCs2(c, el); } }
    }
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
const MIME_RE = /^(image|video|audio|font)\/[\w.+-]+$/;
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
// Линейные иконки HUD вместо эмодзи: эмодзи разного размера и сидят на разной высоте.
// Контуры из Lucide (ISC, icons/LICENSE-lucide); каска, C4 и граната HE нарисованы свои в той же сетке 24×24
const HUD_IC = {
  heart:'<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  helmet:'<path d="M4 19c-1-7.5 3-13.5 8.5-13.5 4.7 0 8 3.7 8.5 9.5H9.5l-1.5 4z"/><path d="M21 15h1.5"/>',
  skull:'<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
  bomb:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><rect x="6.5" y="11" width="7" height="4" rx=".5"/><path d="M17 11v1"/><path d="M17 15v1"/><path d="M7 8V5.5a1.5 1.5 0 0 1 1.5-1.5H11"/>',
  kit:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  hs:'<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  freeze:'<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/>',
  defused:'<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>',
  boom:'<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
  he:'<path d="M6.5 14a5.5 5.5 0 0 1 11 0v2.5a5.5 5.5 0 0 1-11 0z"/><path d="M9.5 8.5V6h5v2.5"/><path d="M14.5 6.5 18 10"/><circle cx="8" cy="4" r="1.6"/>',
  flash:'<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
  smoke:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  molly:'<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  decoy:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>'
};
// <svg class="hi"> размером в строку текста; разметка контуров — константы выше, данные игры сюда не попадают
function hudIc(name, cls){
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('class', 'hi hi-'+name+(cls?' '+cls:'')); s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('aria-hidden','true');
  s.innerHTML=HUD_IC[name]||''; return s;
}
// иконка + текст в одном спане (❤ 64, 🛡 100)
function icText(cls, name, text){ const e=h('span', cls); if(name) e.appendChild(hudIc(name)); if(text!=null) e.append(String(text)); return e; }
function armorIc(p){ return p.armor>0 ? (p.helmet?'helmet':'shield') : null; }
// снаряжение игрока: бомба, кусачки, гранаты — ряд одинаковых иконок
function gearIcons(p, cls){
  const box=h('span', cls||'hd-ic');
  if(p.bomb) box.appendChild(hudIc('bomb','hi-c4'));
  if(p.kit) box.appendChild(hudIc('kit'));
  for(const n of (p.nades||[])) if(HUD_IC[n]) box.appendChild(hudIc(n));
  return box;
}
// состояние бомбы для строки раунда: иконка + подпись
function bombNode(d){
  const b=d.bomb, m={ planted:['bomb','заложена'], defusing:['kit','разминируют'], defused:['defused','разминирована'], exploded:['boom','взорвалась'] }[b];
  return m ? icText('sb-bomb sb-'+b, m[0], st(m[1])) : null;
}
// Таймер фазы: сколько осталось (по времени программы стримера). Только цифры: иконку фазы рисует cs2TimerIc
function cs2Timer(){
  const d=CS2; if(!d?.pend) return '';
  const left=Math.max(0, Math.ceil((d.pend + (d._skew||0) - Date.now())/1000));
  const m=Math.floor(left/60), s=left%60;
  return m + ':' + String(s).padStart(2,'0');
}
function cs2TimerIc(){ const p=CS2?.pphase; return p==='bomb' ? 'bomb' : p==='defuse' ? 'kit' : p==='freezetime' ? 'freeze' : ''; }
// узел таймера: иконка фазы отдельным элементом перед цифрами, цифры в .tv (флип-цифры перелистываются только при смене)
function timerNode(cls, flip){ const t=h('div', cls); t.append(h('span','tic'), h('span', 'tv'+(flip?' flipn':''))); timerSet(t, flip); return t; }
function timerSet(t, flip){
  const icn=cs2TimerIc(), v=cs2Timer();
  if(t._ic!==icn){ t._ic=icn; t.firstChild.replaceChildren(...(icn ? [hudIc(icn)] : [])); }
  if(t._prev===v) return;
  if(flip) flipFill(t.lastChild, v, t._prev); else t.lastChild.textContent=v;
  t._prev=v;
}
function cs2Fresh(){ return CS2 && Date.now()-(CS2.at||0) < 30000; }
function h(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function paintCs2(c, el){
  let d = cs2Fresh() ? CS2 : null;
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
  if(CS2_FULL.has(el.view)){ paintHud(c, el, d); return; }
  c.classList.toggle('nodata', !d);
  if(!d){ c.replaceChildren(h('div','c-none',st('🎯 CS2: ждём данные из игры'))); return; }
  // выбранный игрок по нику (в режиме наблюдателя есть все игроки)
  if(el.pick && d.players){ const p=d.players.find(x=>String(x.name||'').toLowerCase()===el.pick.toLowerCase()); if(p) d={ ...d, ...p, name:p.name, spectating:null }; }
  const kd = d.d ? (d.k/d.d).toFixed(2) : (d.k||0).toFixed(2);
  const name = el.label || d.name || st('Игрок');
  const hpBar = ()=>{ const b=h('div','c-bar'), f=h('div','c-fill'); f.style.width=Math.max(0,Math.min(100,d.hp||0))+'%'; f.style.background = (d.hp||0)>50 ? '#3ddc84' : (d.hp||0)>20 ? '#ffb020' : '#ff4d5e'; b.appendChild(f); return b; };
  // K/D и ADR — плашки справа, по центру строки цифр (а не по базовой линии мелкого шрифта)
  const chip=(l, v)=>{ const s=h('span','c-kd'); s.append(h('i',null,l), v); return s; };
  const kdaRow = ()=>{ const r=h('div','c-kda'); for(const [v,l] of [[d.k,'K'],[d.d,'D'],[d.a,'A']]){ r.append(fnum(c, el, 'c'+l, String(v??0)), h('i',null,l)); }
    const ch=h('span','c-chips'); ch.append(chip('K/D', h('b',null,kd))); if(d.adr!=null) ch.append(chip('ADR', fnum(c, el, 'cadr', String(d.adr)))); r.append(ch); return r; };
  const parts=[];
  switch(el.view){
    case 'card': {
      const top=h('div','c-top'); top.append(h('span','c-name', name), h('span','c-map', `${mapName(d.map)}${d.round!=null?' · R'+(d.round+1):''}`));
      const bars=h('div','c-hprow');
      if(d.alive===false){ bars.append(icText('c-dead', 'skull', d.spectating ? `${st('смотрит')} ${d.spectating}` : st('мёртв'))); }
      else { bars.append(icText('c-hp','heart', d.hp??0), hpBar(), icText('c-ar', d.helmet?'helmet':'shield', d.armor??0)); }
      const bot=h('div','c-bot'); bot.append(fnum(c, el, 'c$', money(d.money), 'c-money'), h('span','c-weap', d.weapon ? `${weaponName(d.weapon)}${d.ammoMax>0?` ${d.ammo}/${d.reserve}`:''}` : ''));
      parts.push(top, kdaRow(), bars, bot); break;
    }
    case 'kda': parts.push(h('div','c-cap', name), kdaRow()); break;
    case 'hp': {
      const r=h('div','c-hprow big');
      if(d.alive===false) r.append(icText('c-dead','skull'));
      else r.append(icText('c-hp','heart', d.hp??0), hpBar(), icText('c-ar', d.helmet?'helmet':'shield', d.armor??0));
      parts.push(r); break;
    }
    case 'score': {
      const r=h('div','c-score'); r.append(h('span','c-ct','CT'), fnum(c, el, 'sc', String(d.ct??0)), h('span','c-sep',':'), fnum(c, el, 'st', String(d.tt??0)), h('span','c-t','T'));
      parts.push(r, h('div','c-map', `${mapName(d.map)}${d.round!=null?' · '+st('раунд')+' '+(d.round+1):''}`)); break;
    }
    case 'money': parts.push(fnum(c, el, 'm$', money(d.money), 'c-big c-money')); break;
    case 'observed': {
      const o = d.observed || (d.spec ? null : { ...d, alive:d.alive!==false });
      if(!o){ parts.push(h('div','c-none',st('👁 Наблюдатель: выбери игрока'))); break; }
      const top=h('div','c-top'); top.append(h('span','c-name', `${o.slot!=null?o.slot+' · ':''}${o.name||st('Игрок')}`), h('span', o.team==='CT'?'c-ct':'c-t', o.team||''));
      const okd = o.d ? (o.k/o.d).toFixed(2) : (o.k||0).toFixed(2);
      const kr=h('div','c-kda'); for(const [v,l] of [[o.k,'K'],[o.d,'D'],[o.a,'A']]) kr.append(h('b',null,String(v??0)), h('i',null,l));
      const och=h('span','c-chips'); och.append(chip('K/D', h('b',null,okd))); kr.append(och);
      const hr=h('div','c-hprow');
      if(o.alive===false) hr.append(icText('c-dead','skull'));
      else { const b=h('div','c-bar'), f=h('div','c-fill'); f.style.width=Math.max(0,Math.min(100,o.hp||0))+'%'; f.style.background=(o.hp||0)>50?'#3ddc84':(o.hp||0)>20?'#ffb020':'#ff4d5e'; b.appendChild(f);
        hr.append(icText('c-hp','heart', o.hp??0), b, icText('c-ar', o.helmet?'helmet':'shield', o.armor??0)); }
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
          // колонки фиксированной ширины: у всех строк цифры и иконки стоят друг под другом
          const ic=h('span','tm-ic'); if(p.alive){ if(p.bomb) ic.appendChild(hudIc('bomb','hi-c4')); if(p.kit) ic.appendChild(hudIc('kit')); if(armorIc(p)) ic.appendChild(hudIc(armorIc(p))); }
          const hpn=h('span','tm-hpn'); if(p.alive) hpn.textContent=String(p.hp); else hpn.appendChild(hudIc('skull'));
          const info=h('div','tm-info'); info.append(hpn, ic, h('span','tm-money', money(p.money)), h('span','tm-kd', `${p.k??0}/${p.d??0}`), h('span','tm-w', weaponShort(p.main||p.weapon)));
          r.append(hpw, nm, info); col.appendChild(r);
        }
        wrap.appendChild(col);
      }
      parts.push(wrap); break;
    }
    case 'scorebar': {
      const r=h('div','sb');
      r.append(h('span','sb-team sb-ct', d.ctName||'CT'), h('b','sb-s',String(d.ct??0)));
      const rnd=h('div','sb-round', `${st('Раунд')} ${(d.round??0)+1}`), bn=bombNode(d); if(bn) rnd.append(' · ', bn);
      const mid=h('div','sb-mid'); mid.append(timerNode('sb-time', false), rnd);
      r.append(mid, h('b','sb-s',String(d.tt??0)), h('span','sb-team sb-t', d.tName||'T'));
      parts.push(r, h('div','c-map sb-map', mapName(d.map))); break;
    }
    case 'weapon': parts.push(h('div','c-big', d.weapon ? weaponName(d.weapon) : '—'), h('div','c-map', d.ammoMax>0 ? `${d.ammo} / ${d.reserve}` : '')); break;
  }
  c.replaceChildren(...parts);
}

// ---------- флип-цифры: каждая цифра на своей плашке, при смене перелистывается ----------
// Значения прошлой отрисовки хранятся на контейнере элемента по ключу, поэтому анимация идёт только у изменившихся цифр
function flipFill(box, text, prev){
  box.replaceChildren();
  const t=String(text), p=prev==null ? t : String(prev), off=p.length-t.length;
  for(let i=0;i<t.length;i++){
    const ch=t[i], digit=/[0-9]/.test(ch);
    const sp=document.createElement('span'); sp.className = digit ? 'fd' : 'fs'; sp.textContent=ch;
    if(digit && prev!=null && p[i+off]!==ch) sp.classList.add('go');
    box.appendChild(sp);
  }
}
function fnum(c, el, key, text, cls){
  if(!el.flip) return h('b', cls||null, String(text));
  c._flip ||= {};
  const b=h('b', 'flipn'+(cls?' '+cls:'')); flipFill(b, text, c._flip[key]); c._flip[key]=String(text);
  return b;
}

// ---------- турнирный и соло HUD, таблица, дуэль, сравнение ----------
// короткие имена для узких карточек турнирного HUD
const WSHORT = { deagle:'Deagle', galilar:'Galil', elite:'Berettas', bizon:'Bizon', fiveseven:'Five-7', usp_silencer:'USP-S', m4a1_silencer:'M4A1-S', mp5sd:'MP5', sawedoff:'Sawed-Off' };
function weaponShort(w){ const id=String(w||'').replace(/^weapon_/,''); return WSHORT[id] || weaponName(w); }
function avatar(el, p, cls){
  const box=h('div', cls||'hd-av'), src=el.av[String(p?.name||'').toLowerCase()];
  const team=p?.team==='T'?'t':'ct'; box.classList.add('tm-'+team);
  if(src){ const img=document.createElement('img'); img.alt=''; img.src=resolveSrc(src); img.draggable=false; box.appendChild(img); }
  else box.textContent=String(p?.name||'?').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase() || '?';
  return box;
}
function hpColor(hp){ return hp>50 ? '#3ddc84' : hp>20 ? '#ffb020' : '#ff4d5e'; }
// сколько урона получил игрок с прошлой отрисовки: всплывает «-27» над карточкой
function hpDrop(c, p, card){
  c._hp ||= {}; const prev=c._hp[p.id||p.name]; c._hp[p.id||p.name]=p.hp;
  if(prev!=null && p.hp<prev && c.dataset.fx!=='none'){
    const n=h('div','hd-drop','-'+(prev-p.hp)); card.appendChild(n); setTimeout(()=>n.remove(), 1400);
    card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
  }
}
function playerCard(c, el, p, obs){
  const team=p.team==='T'?'t':'ct';
  const card=h('div', `hd-card tm-${team}${p.alive===false?' dead':''}${obs?' obs':''}${p.alive!==false&&(p.hp||0)<=20?' low':''}`);
  // верх: аватар, HP, броня справа; номер слота — перед ником (как в панели команд), чтобы не налезал на HP
  const top=h('div','hd-ctop'); top.append(avatar(el, p));
  const hp=h('b','hd-hpn'); if(p.alive===false) hp.appendChild(hudIc('skull')); else hp.textContent=String(p.hp??0);
  top.append(hp); if(p.alive!==false && armorIc(p)) top.append(hudIc(armorIc(p), 'hd-arm'));
  card.appendChild(top);
  const bar=h('div','hd-bar'), f=h('div','hd-fill'); f.style.width=Math.max(0,Math.min(100,p.hp||0))+'%'; f.style.background=hpColor(p.hp||0); bar.appendChild(f);
  const nm=h('div','hd-name'); if(p.slot!=null) nm.appendChild(h('span','hd-slot', String(p.slot))); nm.append(p.name||'?');
  card.append(bar, nm);
  const key=p.id||p.name, row=h('div','hd-row'); row.append(fnum(c, el, key+'kd', `${p.k??0}/${p.d??0}`), fnum(c, el, key+'$', money(p.money), 'hd-money'));
  card.appendChild(row);
  const low=h('div','hd-low');
  if(p.alive===false) low.append(h('span','hd-dmgl', st('урон за раунд')), h('b',null, String(p.dmg||0)));
  else low.append(h('span','hd-w', weaponShort(p.main||p.weapon)), gearIcons(p));
  card.appendChild(low);
  hpDrop(c, p, card);
  return card;
}
function bigCard(c, el, p){
  const team=p.team==='T'?'t':'ct';
  const card=h('div', `hd-big tm-${team}${p.alive===false?' dead':''}${p.alive!==false&&(p.hp||0)<=20?' low':''}`);
  card.appendChild(avatar(el, p, 'hd-bav'));
  const mid=h('div','hd-bmid');
  mid.append(h('div','hd-bname', p.name||st('Игрок')));
  const bars=h('div','hd-bbars');
  const hb=h('div','hd-bar'), hf=h('div','hd-fill'); hf.style.width=Math.max(0,Math.min(100,p.hp||0))+'%'; hf.style.background=hpColor(p.hp||0); hb.appendChild(hf);
  const bhp=h('b','hd-bhp'); if(p.alive===false) bhp.appendChild(hudIc('skull')); else bhp.textContent=String(p.hp??0);
  bars.append(bhp, hb, icText('hd-bar-ar', p.helmet?'helmet':'shield', p.armor??0));
  mid.appendChild(bars);
  const stats=h('div','hd-bstats');
  for(const [l,v] of [['K',p.k??0],['D',p.d??0],['A',p.a??0],['ADR',p.adr??0],['HS',(p.hsp??0)+'%']]) stats.append(h('i',null,l), fnum(c, el, 'big'+l, String(v)));
  mid.appendChild(stats);
  const right=h('div','hd-bright');
  right.append(fnum(c, el, 'big$', money(p.money), 'hd-money'), h('div','hd-w', p.weapon ? `${weaponName(p.weapon)}${p.ammoMax>0?` ${p.ammo}/${p.reserve}`:''}` : ''), gearIcons(p, 'hd-ic'));
  card.append(mid, right);
  hpDrop(c, p, card);
  return card;
}
function scoreTop(el, d, withSeries){
  const top=h('div','hd-score');
  const team=(side)=>{ const b=h('div','hd-team tm-'+side); const lg=side==='ct'?el.lgCT:el.lgT;
    if(lg){ const i=document.createElement('img'); i.src=resolveSrc(lg); i.alt=''; b.appendChild(i); }
    b.appendChild(h('span','hd-tname', (side==='ct'?(el.tnCT||d.ctName):(el.tnT||d.tName)) || (side==='ct'?'CT':'T'))); return b; };
  const mid=h('div','hd-mid');
  const tm=timerNode('hd-time'+(d.pphase==='bomb'?' bomb':''), !!el.flip);
  mid.append(h('div','hd-rnd', `${st('Раунд')} ${(d.round??0)+1}`), tm);
  top.append(team('ct'), fnum(scoreTop.c, el, 'sct', String(d.ct??0), 'hd-n tm-ct'), mid, fnum(scoreTop.c, el, 'stt', String(d.tt??0), 'hd-n tm-t'), team('t'));
  const wrap=h('div','hd-top'); wrap.appendChild(top);
  if(withSeries && el.series) wrap.appendChild(h('div','hd-series', el.series));
  return wrap;
}
function killfeed(d, el){
  const box=h('div','hd-feed'), now=Date.now()-(d._skew||0);
  killfeed.seen ||= new Set();
  for(const e of (d.evs||[]).filter(x=>x.k==='frag' && now-x.t<9000).slice(-5)){
    const r=h('div','hd-kill'+(killfeed.seen.has(e.s)?'':' new')); killfeed.seen.add(e.s);
    const kw=h('span','hd-kw', weaponName(e.weapon)); if(e.hs) kw.appendChild(hudIc('hs','hi-hs'));
    r.append(h('span','tm-'+(e.kteam==='T'?'t':'ct'), e.killer||'?'), kw);
    if(e.victim) r.append(h('span','tm-'+(e.vteam==='T'?'t':'ct'), e.victim));
    box.appendChild(r);
  }
  return box;
}
function statRows(a, b){
  const rows=[['K', a.k??0, b.k??0], ['D', a.d??0, b.d??0, true], ['A', a.a??0, b.a??0], ['ADR', a.adr??0, b.adr??0], ['HS%', a.hsp??0, b.hsp??0], ['MVP', a.mvps??0, b.mvps??0], ['$', a.money??0, b.money??0]];
  const box=h('div','hd-cmp');
  for(const [l, x, y, lowGood] of rows){
    const r=h('div','hd-crow'), tot=Math.max(1, x+y);
    const better = x===y ? 0 : ((x>y) !== !!lowGood ? -1 : 1);
    const L=h('div','hd-cl'+(better<0?' win':'')), R=h('div','hd-cr'+(better>0?' win':''));
    L.append(fnum(statRows.c, statRows.el, 'cl'+l, l==='$'?money(x):String(x))); R.append(fnum(statRows.c, statRows.el, 'cr'+l, l==='$'?money(y):String(y)));
    const bar=h('div','hd-cbar'), fl=h('i','tm-'+(a.team==='T'?'t':'ct')), fr=h('i','tm-'+(b.team==='T'?'t':'ct'));
    fl.style.width=(x/tot*100)+'%'; fr.style.width=(y/tot*100)+'%'; bar.append(fl, fr);
    r.append(L, h('span','hd-cl-l', l), bar, R); box.appendChild(r);
  }
  return box;
}
function vsCard(c, el, a, b, title, hs){
  const w=h('div','hd-vs'); if(title){ const t=h('div','hd-vtitle', title); if(hs) t.appendChild(hudIc('hs','hi-hs')); w.appendChild(t); }
  const heads=h('div','hd-vheads');
  const side=(p)=>{ const x=h('div','hd-vside tm-'+(p.team==='T'?'t':'ct')); x.append(avatar(el, p, 'hd-vav'), h('div','hd-vname', p.name||'?')); return x; };
  heads.append(side(a), h('div','hd-vvs','VS'), side(b));
  w.append(heads, statRows(a, b));
  return w;
}
function paintHud(c, el, d){
  scoreTop.c=c; statRows.c=c; statRows.el=el;
  // перерисовываем только когда что-то поменялось: иначе анимации перезапускались бы с каждым пакетом CS2
  const now0=Date.now(), feed=(d?.evs||[]).filter(x=>x.k==='frag' && now0-(d._skew||0)-x.t<9000).map(x=>x.s).join();
  const sig=JSON.stringify([el, d && [d.players, d.observed, d.ct, d.tt, d.round, d.pphase, d.hp, d.armor, d.money, d.k, d.d, d.a, d.adr, d.weapon, d.ammo, d.alive, d.team], feed, el.view==='duel' && (d?.evs||[]).slice(-1)[0]?.s, now0<(c._duntil||0)]);
  if(c._sig===sig) return; c._sig=sig;
  if(!d){ c.replaceChildren(h('div','hd-wait', st('🎯 CS2: ждём данные из игры'))); return; }
  const players=d.players||[], byName=n=>players.find(x=>String(x.name||'').toLowerCase()===String(n||'').toLowerCase());
  const me={ ...d, id:d.id||'me', team:d.team };
  const parts=[];
  if(el.view==='hud_solo'){
    parts.push(scoreTop(el, d, false), killfeed(d, el));
    const b=h('div','hd-bottom solo'); b.appendChild(bigCard(c, el, me)); parts.push(b);
  } else if(el.view==='hud_tour'){
    if(!players.length){ c.replaceChildren(h('div','hd-wait', st('👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)'))); return; }
    parts.push(scoreTop(el, d, true), killfeed(d, el));
    const bot=h('div','hd-bottom');
    const col=side=>{ const g=h('div','hd-side tm-'+side.toLowerCase()); for(const p of players.filter(x=>x.team===side).sort((a,b)=>(a.slot??99)-(b.slot??99)).slice(0,5)) g.appendChild(playerCard(c, el, p, d.obs===p.id)); return g; };
    const ob=d.observed ? { ...d.observed, ...(players.find(x=>x.id===d.observed.id)||{}) } : null;
    const center=h('div','hd-center'); if(ob) center.appendChild(bigCard(c, el, ob));
    bot.append(col('CT'), center, col('T')); parts.push(bot);
  } else if(el.view==='table'){
    const t=h('div','hd-table');
    t.appendChild(scoreTop(el, d, true));
    const list = players.length ? players : [me];
    for(const side of ['CT','T']){
      const ps=list.filter(p=>p.team===side).sort((a,b)=>(b.adr??0)-(a.adr??0) || (b.k??0)-(a.k??0)); if(!ps.length) continue;
      const sec=h('div','hd-tsec tm-'+side.toLowerCase());
      const head=h('div','hd-tr hd-th'); for(const x of ['', st('Игрок'), 'K','D','A','+/−','ADR','HS%','MVP','$']) head.appendChild(h('span',null,x)); sec.appendChild(head);
      for(const p of ps){
        const r=h('div','hd-tr'+(p.alive===false?' dead':''));
        r.append(avatar(el, p, 'hd-tav'), h('span','hd-tn', p.name||'?'));
        const diff=(p.k??0)-(p.d??0);
        [p.k??0, p.d??0, p.a??0, (diff>0?'+':'')+diff, p.adr??0, (p.hsp??0)+'%', p.mvps??0, money(p.money)].forEach((v,i)=>r.appendChild(fnum(c, el, 't'+(p.id||p.name)+i, String(v))));
        sec.appendChild(r);
      }
      t.appendChild(sec);
    }
    parts.push(t);
  } else if(el.view==='duel'){
    // после килла на 4 секунды: убийца против жертвы (нужен режим наблюдателя)
    const now=Date.now()-(d._skew||0);
    const e=(d.evs||[]).filter(x=>x.k==='frag' && x.victim).slice(-1)[0];
    if(c._dseen==null) c._dseen = e ? e.s : 0;
    if(e && e.s>c._dseen && now-e.t<6000){ c._dseen=e.s; c._duntil=Date.now()+4200; c._duel=e; }
    if(c._duel && Date.now()<(c._duntil||0)){
      const a=byName(c._duel.killer)||{ name:c._duel.killer, team:c._duel.kteam }, b=byName(c._duel.victim)||{ name:c._duel.victim, team:c._duel.vteam };
      const v=vsCard(c, el, a, b, weaponName(c._duel.weapon), c._duel.hs); v.classList.add('show'); parts.push(v);
    } else if(!c._duel && !c.closest('#elLayer')) parts.push(h('div'));
    else if(c.closest('#elLayer')) parts.push(h('div','hd-hint', st('Дуэль появится сама после килла (режим наблюдателя)')));
  } else if(el.view==='compare'){
    const a=byName(el.pa) || (players.length?null:me), b=byName(el.pb);
    if(!a || !b) parts.push(h('div','hd-wait', st('Выбери двух игроков в пульте')));
    else parts.push(vsCard(c, el, a, b, ''));
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
