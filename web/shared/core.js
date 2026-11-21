// Общий код пульта и виджета. Оба HTML подключают этот файл: держи их в одной папке.

// Эмодзи рисуем одним шрифтом (Noto Color Emoji) у всех: системные шрифты в старых Windows/OBS
// не знают новые эмодзи (например 🪖) и показывают пустой квадрат
// Обычные шрифты и общий sans-serif стоят перед шрифтом эмодзи: если веб-шрифт не загрузился или в системе нет Arial
// (Linux), пробелы и цифры иначе берутся из шрифта эмодзи (он их тоже содержит) и текст разъезжается
const EMOJI_FONT = "'Noto Color Emoji'", TEXT_FB = "Arial,'Liberation Sans','Segoe UI'";
const FONTS = {
  montserrat:`'Montserrat',${TEXT_FB},sans-serif,${EMOJI_FONT}`, russo:`'Russo One',${TEXT_FB},sans-serif,${EMOJI_FONT}`,
  impact:`Impact,'Anton','Arial Black',${TEXT_FB},sans-serif,${EMOJI_FONT}`, pixel:`'Press Start 2P','Courier New',monospace,${EMOJI_FONT}`,
  comfortaa:`'Comfortaa',${TEXT_FB},sans-serif,${EMOJI_FONT}`, caveat:`'Caveat',${TEXT_FB},cursive,${EMOJI_FONT}`
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
function fontOf(v){ return typeof v==='string' && (Object.hasOwn(FONTS, v) || UFONT_RE.test(v)) ? v : 'montserrat'; }
function fontCss(key){
  const m = UFONT_RE.exec(key||''); if(!m) return typeof key==='string' && Object.hasOwn(FONTS, key) ? FONTS[key] : FONTS.montserrat;
  UFonts.use(m[1]);
  return `'hu-${m[1]}',${TEXT_FB},sans-serif,${EMOJI_FONT}`;
}
const FONT_EXT = { ttf:'font/ttf', otf:'font/otf', woff:'font/woff', woff2:'font/woff2' };

// ---------- надписи на стриме ----------
// Язык выбирает модератор (Комната → «Язык надписей на стриме»), он приходит в состоянии экрана.
const STREAM_LANGS = ['ru', 'en', 'uk', 'de'];
let STREAM_LANG = 'ru';
const STREAM_TXT = {
  en:{ "открывает":"opens", "выбил":"unboxed", "Ширпотреб":"Consumer Grade", "Промышленное":"Industrial Grade", "Армейское":"Mil-Spec", "Запрещённое":"Restricted", "Засекреченное":"Classified", "Тайное":"Covert", "Редкое":"Rare Special", "Розыгрыш":"Giveaway", "только подписчики":"subscribers only", "Пиши в чат":"Type in chat", "Пиши в чат что угодно, чтобы участвовать":"Type anything in chat to join", "Сбор закрыт, сейчас крутим!":"Entries closed, spinning now!", "Розыгрыш скоро начнётся":"Giveaway starts soon", "У подписчиков шанс x2":"Subscribers have x2 chance", "выигрывает":"wins", "Победители":"Winners", "на связи":"is here", "Напиши в чат за":"Reply in chat within", "Не ответил, перекручиваем…":"No reply, spinning again…", 'урон за раунд':"damage this round", 'Выбери двух игроков в пульте':"Pick two players in the panel", 'Дуэль появится сама после килла (режим наблюдателя)':"The duel shows up by itself after a kill (spectator mode)", 'Пиши в чат цифру':'Type a number in chat', 'голосов':'votes', 'Голосование закрыто':'Poll closed', 'Голосование скоро начнётся':'Poll starts soon', 'Да':'Yes', 'Нет':'No', 'Окно источника':'Source window', 'Розовая рамка должна идти ровно по краям экрана стрима.':'The pink frame must run exactly along the edges of the stream screen.', 'Если она меньше экрана: в OBS выдели источник →':'If it is smaller than the screen: in OBS select the source →', 'Растянуть на экран':'Fit to screen',
    'Нож':'Knife', 'Флешка':'Flashbang', 'Дым':'Smoke', 'Молотов':'Molotov', 'Зажигалка':'Incendiary', 'Ложная':'Decoy',
    'заложена':'planted', 'разминируют':'defusing', 'разминирована':'defused', 'взорвалась':'exploded',
    'появится само при мульти-килле':'shows up by itself on a multikill', '🎯 CS2: ждём данные из игры':'🎯 CS2: waiting for game data', 'Игрок':'Player',
    'смотрит':'watching', 'мёртв':'dead', 'раунд':'round', 'Раунд':'Round', '👁 Наблюдатель: выбери игрока':'👁 Spectator: pick a player',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Team panels work when the streamer watches a match as a spectator (GOTV / observer)',
    'Спецназ':'Counter-Terrorists', 'Террористы':'Terrorists', 'в голову':'headshot', 'Зритель':'Viewer', 'д':'d',
    'Серия':'Series', 'ТАЙМАУТ':'TIMEOUT', 'ПАУЗА':'PAUSE', 'Тактический перерыв':'Tactical timeout', 'осталось':'left', 'СМЕНА СТОРОН':'SIDE SWITCH', 'ИТОГ КАРТЫ':'MAP RESULT', 'Победа':'Win:', 'Ничья':'Draw', 'убийств':'kills', '👁 Радар работает, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 The radar works when the streamer watches a match as a spectator (GOTV / observer)' },
  uk:{ "открывает":"відкриває", "выбил":"вибив", "Ширпотреб":"Ширвжиток", "Промышленное":"Промислове", "Армейское":"Армійське", "Запрещённое":"Заборонене", "Засекреченное":"Засекречене", "Тайное":"Таємне", "Редкое":"Рідкісне", "Розыгрыш":"Розіграш", "только подписчики":"тільки підписники", "Пиши в чат":"Пиши в чат", "Пиши в чат что угодно, чтобы участвовать":"Пиши в чат що завгодно, щоб узяти участь", "Сбор закрыт, сейчас крутим!":"Збір закрито, зараз крутимо!", "Розыгрыш скоро начнётся":"Розіграш скоро почнеться", "У подписчиков шанс x2":"У підписників шанс x2", "выигрывает":"виграє", "Победители":"Переможці", "на связи":"на зв'язку", "Напиши в чат за":"Напиши в чат за", "Не ответил, перекручиваем…":"Не відповів, перекручуємо…", 'урон за раунд':"урон за раунд", 'Выбери двух игроков в пульте':"Вибери двох гравців у пульті", 'Дуэль появится сама после килла (режим наблюдателя)':"Дуель з'явиться сама після кіла (режим спостерігача)", 'Пиши в чат цифру':'Пиши в чат цифру', 'голосов':'голосів', 'Голосование закрыто':'Голосування закрите', 'Голосование скоро начнётся':'Голосування скоро почнеться', 'Да':'Так', 'Нет':'Ні', 'Окно источника':'Вікно джерела', 'Розовая рамка должна идти ровно по краям экрана стрима.':'Рожева рамка має йти рівно по краях екрана стріму.', 'Если она меньше экрана: в OBS выдели источник →':'Якщо вона менша за екран: в OBS виділи джерело →', 'Растянуть на экран':'Розтягнути на екран',
    'Нож':'Ніж', 'Флешка':'Флешка', 'Дым':'Дим', 'Молотов':'Молотов', 'Зажигалка':'Запальничка', 'Ложная':'Хибна',
    'заложена':'закладена', 'разминируют':'розміновують', 'разминирована':'розмінована', 'взорвалась':'вибухнула',
    'появится само при мульти-килле':"з'явиться само при мульти-кілі", '🎯 CS2: ждём данные из игры':'🎯 CS2: чекаємо дані з гри', 'Игрок':'Гравець',
    'смотрит':'дивиться', 'мёртв':'мертвий', 'раунд':'раунд', 'Раунд':'Раунд', '👁 Наблюдатель: выбери игрока':'👁 Спостерігач: вибери гравця',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Панелі команд працюють, коли стример дивиться матч глядачем (GOTV / спостерігач)',
    'Спецназ':'Спецпризначенці', 'Террористы':'Терористи', 'в голову':'у голову', 'Зритель':'Глядач', 'д':'д',
    'Серия':'Серія', 'ТАЙМАУТ':'ТАЙМАУТ', 'ПАУЗА':'ПАУЗА', 'Тактический перерыв':'Тактична перерва', 'осталось':'лишилось', 'СМЕНА СТОРОН':'ЗМІНА СТОРІН', 'ИТОГ КАРТЫ':'ПІДСУМОК КАРТИ', 'Победа':'Перемога', 'Ничья':'Нічия', 'убийств':'вбивств', '👁 Радар работает, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Радар працює, коли стример дивиться матч глядачем (GOTV / спостерігач)' },
  de:{ "открывает":"öffnet", "выбил":"hat gezogen", "Ширпотреб":"Verbraucherklasse", "Промышленное":"Industriequalität", "Армейское":"Militärstandard", "Запрещённое":"Limitiert", "Засекреченное":"Geheim", "Тайное":"Verdeckt", "Редкое":"Selten", "Розыгрыш":"Gewinnspiel", "только подписчики":"nur Abonnenten", "Пиши в чат":"Schreib in den Chat", "Пиши в чат что угодно, чтобы участвовать":"Schreib irgendwas in den Chat, um mitzumachen", "Сбор закрыт, сейчас крутим!":"Teilnahme geschlossen, gleich wird gedreht!", "Розыгрыш скоро начнётся":"Gewinnspiel startet gleich", "У подписчиков шанс x2":"Abonnenten haben x2 Chance", "выигрывает":"gewinnt", "Победители":"Gewinner", "на связи":"ist da", "Напиши в чат за":"Antworte im Chat innerhalb", "Не ответил, перекручиваем…":"Keine Antwort, neu drehen…", 'урон за раунд':"Schaden diese Runde", 'Выбери двух игроков в пульте':"Wähle zwei Spieler im Pult", 'Дуэль появится сама после килла (режим наблюдателя)':"Das Duell erscheint nach einem Kill von selbst (Zuschauermodus)", 'Пиши в чат цифру':'Schreib eine Zahl in den Chat', 'голосов':'Stimmen', 'Голосование закрыто':'Umfrage beendet', 'Голосование скоро начнётся':'Umfrage startet gleich', 'Да':'Ja', 'Нет':'Nein', 'Окно источника':'Quellenfenster', 'Розовая рамка должна идти ровно по краям экрана стрима.':'Der pinke Rahmen muss genau am Rand des Stream-Bildschirms verlaufen.', 'Если она меньше экрана: в OBS выдели источник →':'Ist er kleiner als der Bildschirm: in OBS die Quelle wählen →', 'Растянуть на экран':'An Bildschirm anpassen',
    'Нож':'Messer', 'Флешка':'Blendgranate', 'Дым':'Rauch', 'Молотов':'Molotow', 'Зажигалка':'Brandgranate', 'Ложная':'Köder',
    'заложена':'gelegt', 'разминируют':'wird entschärft', 'разминирована':'entschärft', 'взорвалась':'explodiert',
    'появится само при мульти-килле':'erscheint bei einem Multikill von selbst', '🎯 CS2: ждём данные из игры':'🎯 CS2: warte auf Spieldaten', 'Игрок':'Spieler',
    'смотрит':'schaut', 'мёртв':'tot', 'раунд':'Runde', 'Раунд':'Runde', '👁 Наблюдатель: выбери игрока':'👁 Zuschauer: Spieler wählen',
    '👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Team-Panels funktionieren, wenn der Streamer ein Match als Zuschauer verfolgt (GOTV / Observer)',
    'Спецназ':'Antiterroreinheit', 'Террористы':'Terroristen', 'в голову':'Kopfschuss', 'Зритель':'Zuschauer', 'д':'T',
    'Серия':'Serie', 'ТАЙМАУТ':'TIMEOUT', 'ПАУЗА':'PAUSE', 'Тактический перерыв':'Taktische Auszeit', 'осталось':'noch', 'СМЕНА СТОРОН':'SEITENWECHSEL', 'ИТОГ КАРТЫ':'KARTENERGEBNIS', 'Победа':'Sieg:', 'Ничья':'Unentschieden', 'убийств':'Kills', '👁 Радар работает, когда стример смотрит матч зрителем (GOTV / наблюдатель)':'👁 Das Radar funktioniert, wenn der Streamer ein Match als Zuschauer verfolgt (GOTV / Observer)' },
};
// Рулетка (автомат и колесо): тексты на стриме
const ROU_TXT = {
  en:{ 'РУЛЕТКА':'ROULETTE', 'ВСТАВЬТЕ БИЛЕТ':'INSERT TICKET', 'ПРИЁМ БИЛЕТА':'TAKING TICKET', 'ЗАГРУЗКА…':'LOADING…', 'РАЗДАЧА':'SHUFFLING', 'ПОЛУЧЕНО':'YOU WON', 'получает':'gets', 'шанс':'chance', 'Без названия':'Untitled', 'Добавь призы':'Add prizes' },
  uk:{ 'РУЛЕТКА':'РУЛЕТКА', 'ВСТАВЬТЕ БИЛЕТ':'ВСТАВТЕ КВИТОК', 'ПРИЁМ БИЛЕТА':'ПРИЙОМ КВИТКА', 'ЗАГРУЗКА…':'ЗАВАНТАЖЕННЯ…', 'РАЗДАЧА':'РОЗДАЧА', 'ПОЛУЧЕНО':'ОТРИМАНО', 'получает':'отримує', 'шанс':'шанс', 'Без названия':'Без назви', 'Добавь призы':'Додай призи' },
  de:{ 'РУЛЕТКА':'ROULETTE', 'ВСТАВЬТЕ БИЛЕТ':'TICKET EINWERFEN', 'ПРИЁМ БИЛЕТА':'TICKET WIRD GEPRÜFT', 'ЗАГРУЗКА…':'LÄDT…', 'РАЗДАЧА':'MISCHEN', 'ПОЛУЧЕНО':'GEWONNEN', 'получает':'bekommt', 'шанс':'Chance', 'Без названия':'Ohne Namen', 'Добавь призы':'Preise hinzufügen' },
};
for(const l of Object.keys(ROU_TXT)) Object.assign(STREAM_TXT[l], ROU_TXT[l]);
const st = s => STREAM_TXT[STREAM_LANG]?.[s] ?? s;
const ANIMS = ['none','pulse','wobble','float','spin','shake','rainbow'];
const STYLES = ['flip','neon','plain'];
const TIMER_MODES = ['countdown','stopwatch','until','clock'];
const COUNTER_MODES = ['manual','chat','interval'];
const TYPES = ['text','image','video','timer','counter','web','poll','cs2','msg','chat','raffle','case','draw','roulette','stream'];
const CHAT_THEMES = ['glass','bubbles','minimal','neon','panel','accent'];
// Общая громкость оверлея: звук на стриме = общая × громкость элемента. Виджет задаёт её из состояния.
let MASTER_VOL = 1, FX_VOL = 1;
function setVolumes(s){ MASTER_VOL = num(s?.vol, 1, 0, 1); FX_VOL = num(s?.fxVol, 1, 0, 1); }
function masterVol(){ return MASTER_VOL; }
function fxVol(){ return FX_VOL; }
const CS2_VIEWS = ['card','kda','hp','score','money','weapon','streak','teams','scorebar','observed','hud_solo','hud_tour','table','duel','compare','radar'];
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
// Берём только простые значения: объект вроде {"toString":1} иначе роняет проверку, а массив ['#fff'] проходит как строка
const prim = v => typeof v==='string' || typeof v==='number' || typeof v==='boolean';
function num(v, d, min, max){ v = prim(v) ? Number(v) : NaN; if(!Number.isFinite(v)) v = d; return Math.min(max, Math.max(min, v)); }
function hex(v, d){ return typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d; }
function str(v, n){ return (prim(v) ? String(v) : '').slice(0, n); }
function safeUrl(u){ if(typeof u!=='string') return null; try{ const p = new URL(u.trim()); return (p.protocol==='https:'||p.protocol==='http:') ? p.href : null; }catch{ return null; } }
const ASSET_RE = /^asset:([a-z0-9]{6,24})$/;
function assetId(src){ const m = typeof src==='string' ? ASSET_RE.exec(src) : null; return m ? m[1] : null; }
// Сайт на экране не может быть самим пультом, страницами Hudini или программой стримера на этом ПК
const HUDINI_SITE = 'https://niko-ua-designer.github.io';
// Локальные адреса: те же правила, что is_local_ip / browser_url в app/src-tauri/src/main.rs
function localV4(a,b){ return a===0 || a===10 || a===127 || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===169 && b===254) || (a===100 && b>=64 && b<=127) || a===255; }
function localHost(h){
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if(v4) return localV4(+v4[1], +v4[2]);
  if(h.includes(':')){
    if(h==='::' || h==='::1') return true;
    const w = h.split(':')[0];
    if(/^f[cd][0-9a-f]{2}$/.test(w) || /^fe[89ab][0-9a-f]$/.test(w)) return true;   // fc00::/7, fe80::/10
    const m = /^(?:0:){0,5}:?(?:0:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h) || /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if(m){ const x = parseInt(m[1],16); return localV4(x>>8, x&255); }
    const d = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(h);
    return !!d && localHost(d[1]);
  }
  return false;
}
// Имена, которые для любого префикса отвечают локальным адресом (wildcard DNS)
const LOCAL_DNS = /(^|\.)(nip\.io|sslip\.io|localtest\.me|lvh\.me|localhost)$/;
function blockedEmbed(url){
  let u; try{ u = new URL(url); }catch{ return true; }
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if(h==='localhost' || LOCAL_DNS.test(h) || /^127\.\d+\.\d+\.\d+\./.test(h) || localHost(h)) return true;
  if(u.origin===HUDINI_SITE) return true;
  return typeof location!=='undefined' && /^https?:$/.test(location.protocol) && u.origin===location.origin;
}
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
const BOXABLE = new Set(['text','timer','counter','poll','cs2','msg','chat']);
// Обрезка как в OBS: [слева, сверху, справа, снизу] в % размера элемента. Для CS2, кейса и розыгрыша не нужна
const STREAM_KINDS = ['cam','screen','mic'];
const CROPPABLE = new Set(['image','video','stream','web','text','timer','counter','poll','msg','chat']);
function sanitizeCrop(c){
  if(!Array.isArray(c) || c.length!==4) return null;
  const a=c.map(v=>Math.round(num(v,0,0,90)*100)/100);
  for(const [i,j] of [[0,2],[1,3]]){ const t=a[i]+a[j]; if(t>90){ a[i]=Math.floor(a[i]*90/t*100)/100; a[j]=Math.floor(a[j]*90/t*100)/100; } }
  return a.some(v=>v>=0.01) ? a : null;
}
// Розыгрыш: сбор → (закрыт) → лента. Время ленты общее для пульта и виджета, поэтому все видят одно и то же
const RAFFLE_PHASES = ['idle','collect','closed','spin'];
// Кейс: время сцены от openAt, одинаковое у пульта и виджета
const CASE_T = { land:1300, lock1:3300, lock2:3650, open:4000, reel:4800, reelDur:8200, reveal:13200 };
const CASE_REEL = 60, CASE_WIN = 52, CASE_STEP = 10.8;   // карточка 10em + зазор .8em
// Виды кейса: обычный (честная лента), байтовый (почти выпало, но нет), рандомный (вид решается при открытии), со вторым шансом
const CASE_KINDS = ['normal','bait','random','second'];
const CASE_2 = { gap:1900, dur:6400 };   // «перекрут»: пауза с надписью и вторая лента
const RARITY7 = ['#b0c3d9','#5e98d9','#4b69ff','#8847ff','#d32ce6','#eb4b4b','#e4ae39'];
const RARITY_NAME = ['Ширпотреб','Промышленное','Армейское','Запрещённое','Засекреченное','Тайное','Редкое'];
// Рулетка: призы с весами, прокрутка считается от spinAt, одинаково у пульта и виджета
const ROU_VIEWS = ['capsule','wheel'];
const ROU_MAX = 30, ROU_PEOPLE = 200;
const ROU_COLORS = ['#a970ff','#4cc9f0','#3ddc97','#ffd166','#ff6b9d','#ff8c42','#8ecae6','#c77dff'];
const ROU_T = { capsule:7600, wheel:7000 };
const rouDur = el => ROU_T[el.view] || ROU_T.capsule;
// Крутится (плюс короткая пауза, пока показывается итог): пока так, новую прокрутку не начинаем
const rouBusy = (el, now) => !!el.spinAt && now < el.spinAt + rouDur(el) + 800;
const rouShown = (el, now) => !!el.spinAt && now < el.spinAt + rouDur(el) + el.hideAfter*1000;
function rouPrizes(list){
  return (Array.isArray(list)?list:[]).slice(0,ROU_MAX).map((x,i)=>({ n:str(x?.n,40), w:num(x?.w,1,0,1000), c:hex(x?.c, ROU_COLORS[i%ROU_COLORS.length]), note:str(x?.note,80) }));
}
// Взвешенный выбор: unit в [0,1). Возвращает индекс или -1, если выбирать не из чего
function rouPickIdx(list, unit, wOf){
  let total=0; for(const x of list) total+=wOf(x);
  if(!(total>0)) return -1;
  let r=Math.min(0.999999999, Math.max(0, unit))*total, last=-1;
  for(let i=0;i<list.length;i++){ const w=wOf(list[i]); if(w<=0) continue; last=i; r-=w; if(r<0) return i; }
  return last;
}
const roulettePrize = (el, unit) => rouPickIdx(el.prizes, unit, x=>x.w>0 ? x.w : 0);
const roulettePerson = (el, unit) => rouPickIdx(el.people, unit, x=>x.w);
// Сектора колеса по снимку призов и точка остановки: победитель посередине под стрелкой (со смещением jit внутри сектора)
function rouSegs(list){
  const pool=list.filter(x=>x.w>0), total=pool.reduce((a,x)=>a+x.w,0)||1, T=Math.PI*2;
  let acc=0;
  return pool.map(x=>{ const sp=x.w/total*T, g={ item:x, start:acc, span:sp, mid:acc+sp/2, chance:x.w/total }; acc+=sp; return g; });
}
function rouTarget(el){
  const T=Math.PI*2, seg=rouSegs(el.segs).find(g=>g.item===el.segs[el.win]);
  const aim=seg ? seg.mid+el.jit*seg.span*0.9 : 0, from=el.from||0, delta=(((-aim-from)%T)+T)%T;
  return { from, to:from+5*T+delta, rest:((-aim%T)+T)%T };
}
// Шанс выпавшего приза в процентах (по снимку призов на момент прокрутки)
function rouChance(el){
  const t=el.segs.reduce((a,x)=>a+x.w,0), w=el.segs[el.win];
  return w && t>0 ? w.w/t : 0;
}
const RAFFLE_REEL = 72, RAFFLE_WIN = 62, RAFFLE_OPEN = 1900, RAFFLE_SPIN = 7200, RAFFLE_STEP = 5.6;   // карточка 5.2em + зазор .4em
const VK_MAX = 5000, CIDS_MAX = 300, CLAIMS_MAX = 200;
const VOTER_RE = /^[a-z0-9][a-z0-9_]{0,24}$/, MSGID_RE = /^[A-Za-z0-9-]{1,64}$/, REWARD_RE = /^[A-Za-z0-9-]{8,64}$/;
function pollTally(vk, n){ const v=new Array(n).fill(0); for(const k of Object.keys(vk)){ const i=vk[k]; if(i>=0 && i<n) v[i]++; } return v; }
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
  } else if(type==='stream'){
    // a camera, a screen or a microphone of one participant. The owner is only a name here: the widget decides whether to show it
    o.owner = typeof e.owner==='string' && /^[A-Za-z0-9_-]{1,40}$/.test(e.owner) ? e.owner : '';
    o.kind = STREAM_KINDS.includes(e.kind) ? e.kind : '';
    if(!o.owner || !o.kind) return null;
    o.w=num(e.w,30,1,200); o.hh=num(e.hh,0,0,300);
    o.sound=!!e.sound; o.vol=num(e.vol,1,0,1);
  } else if(type==='web'){
    o.url=safeUrl(e.url); if(!o.url || blockedEmbed(o.url)) return null;
    o.w=num(e.w,40,1,200); o.ar=typeof e.ar==='string' && Object.hasOwn(ASPECTS, e.ar)?e.ar:'16:9'; o.shape=SHAPES.includes(e.shape)?e.shape:'rect';
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
    o.av=Object.create(null); if(e.av && typeof e.av==='object') for(const [k,v] of Object.entries(e.av).slice(0,40)){ const src=safeSrc(v); if(src) o.av[str(k,40).toLowerCase()]=src; }
    o.tnCT=str(e.tnCT,30); o.tnT=str(e.tnT,30); o.lgCT=safeSrc(e.lgCT)||''; o.lgT=safeSrc(e.lgT)||'';
    o.nicks=cleanNicks(e.nicks);
    o.series=str(e.series,120); o.pick=str(e.pick,40); o.pa=str(e.pa,40); o.pb=str(e.pb,40);
    o.rbg=e.rbg!==false; o.rmap=e.rmap!==false;   // радар: рамка с плашкой и сеткой; сама картинка карты
    o.rgr=e.rgr!==false; o.rgm=e.rgm!==false; o.rgh=e.rgh!==false; o.rgf=e.rgf!==false; o.rgs=e.rgs!==false;   // гранаты на радаре: всего и по типам (молотов, HE, флешка, дым)
    o.grenStyle=e.grenStyle==='B' ? 'B' : 'A';   // A: значки со следом и зоны, B: точки без следа и простые зоны
    o.rds=num(e.rds,1,0.5,2.5);   // размер значков радара: множитель от маленького по умолчанию
    o.theme=['classic','glass','ko'].includes(e.theme)?e.theme:'glass'; o.flip=!!e.flip; o.kfeed=!!e.kfeed;   // свой киллфид в HUD (kf занят анимацией движения)
    if(CS2_FULL.has(o.view)){ o.x=50; o.y=50; o.rot=0; }
  } else if(type==='msg'){
    o.user=str(e.user,40); o.ucolor=hex(e.ucolor,'#a78bfa'); o.text=str(e.text,500);
    o.emotes=(Array.isArray(e.emotes)?e.emotes:[]).slice(0,80).map(x=>[str(x?.[0],40).replace(/[^A-Za-z0-9_]/g,''), Math.round(num(x?.[1],0,0,600)), Math.round(num(x?.[2],0,0,600))]).filter(x=>x[0] && x[2]>=x[1]);
    // смайлы 7TV/BTTV/FFZ: [провайдер, id, с, по]; адрес картинки строится по шаблону провайдера
    o.xe=(Array.isArray(e.xe)?e.xe:[]).slice(0,80).map(x=>[x?.[0], str(x?.[1],40), Math.round(num(x?.[2],0,0,600)), Math.round(num(x?.[3],0,0,600))])
      .filter(x=>EMX_PROV.includes(x[0]) && EMX_ID[x[0]].test(x[1]) && x[3]>=x[2]);
    o.badge=['mod','vip','sub','broadcaster',''].includes(e.badge)?e.badge:'';
    o.fs=num(e.fs,3,0.5,100); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#15171d'); o.accent=hex(e.accent,'#a78bfa');
    o.maxw=num(e.maxw,38,10,100);
  } else if(type==='chat'){
    o.chan=cleanChan(e.chan);
    o.theme=CHAT_THEMES.includes(e.theme)?e.theme:'glass';
    o.fs=num(e.fs,2.4,0.8,10); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#15171d'); o.accent=hex(e.accent,'#a78bfa');
    o.fade=Math.round(num(e.fade,0,0,600)); o.dir=e.dir==='up'?'up':'down'; o.align=e.align==='right'?'right':'left';
    o.max=Math.round(num(e.max,12,3,50)); o.badges=e.badges!==false;
  } else if(type==='case'){
    o.x=50; o.y=50; o.rot=0; o.fs=num(e.fs,4,1,12); o.font=fontOf(e.font); o.color=hex(e.color,'#ffffff');
    o.name=str(e.name,40)||'HUDINI CASE'; o.logo=safeSrc(e.logo)||''; o.cc=hex(e.cc,'#7c5cff');
    o.items=(Array.isArray(e.items)?e.items:[]).slice(0,40).map(x=>({ n:str(x?.n,40), img:safeSrc(x?.img)||'', r:Math.round(num(x?.r,2,0,6)), p:num(x?.p,0,0,100), sp:x?.sp?1:0 }));
    o.openAt=num(e.openAt,0,0,1e15); o.donor=str(e.donor,40); o.amount=str(e.amount,24);
    o.win=Math.round(num(e.win,-1,-1,39)); o.jit=num(e.jit,0,-0.4,0.4);
    o.reel=(Array.isArray(e.reel)?e.reel:[]).slice(0,CASE_REEL).map(v=>Math.round(num(v,0,0,39)));
    o.kind=CASE_KINDS.includes(e.kind)?e.kind:'bait';   // кейсы без вида вели себя как байтовые
    o.kindNow=e.kindNow==='normal'?'normal':e.kindNow==='bait'?'bait':'';   // у рандомного: что выпало на этом открытии
    o.bmode=e.bmode==='over'?'over':'under';
    o.reel2=(Array.isArray(e.reel2)?e.reel2:[]).slice(0,CASE_REEL).map(v=>Math.round(num(v,0,0,39)));
    o.win2=Math.round(num(e.win2,-1,-1,39)); o.jit2=num(e.jit2,0,-0.4,0.4);
    o.uhhText=str(e.uhhText,24); o.upText=str(e.upText,24);   // свои надписи (по умолчанию без текста)
    o.hideAfter=num(e.hideAfter,12,3,120); o.vol=num(e.vol,0.8,0,1); o.q=e.q==='low'?'low':'high';
    o.snd={}; for(const k of ['in','tense','lock','open','tick','win']){ const v=safeSrc(e.snd?.[k]); if(v) o.snd[k]=v; }
  } else if(type==='roulette'){
    o.view=ROU_VIEWS.includes(e.view)?e.view:'capsule';
    o.fs=num(e.fs,4,1,12); o.font=fontOf(e.font); o.color=hex(e.color,'#ffffff'); o.accent=hex(e.accent,'#a970ff');
    o.title=str(e.title,30);
    o.prizes=rouPrizes(e.prizes); o.segs=rouPrizes(e.segs);
    o.people=(Array.isArray(e.people)?e.people:[]).slice(0,ROU_PEOPLE).map(x=>({ n:str(x?.n,40).trim(), w:Math.round(num(x?.w,1,1,100)) })).filter(x=>x.n);
    o.used=(Array.isArray(e.used)?e.used:[]).slice(0,ROU_PEOPLE).map(x=>({ n:str(x?.n,40).trim(), w:Math.round(num(x?.w,1,1,100)) })).filter(x=>x.n);
    o.once=e.once!==false; o.odds=e.odds!==false; o.who=e.who!==false;
    o.hideAfter=num(e.hideAfter,10,3,120); o.vol=num(e.vol,0.8,0,1);
    o.spinAt=num(e.spinAt,0,0,1e15); o.viewer=str(e.viewer,40); o.jit=num(e.jit,0,-0.45,0.45); o.from=num(e.from,0,0,7);
    o.win=Math.round(num(e.win,-1,-1,ROU_MAX-1)); if(o.win>=o.segs.length) o.win=-1;
    // Запуск зрителями без входа в Twitch: чат-команда (c*) и награда за баллы с вводом текста (r*). Ник в списке всегда обычный текст.
    const oneOf=(v, list, d)=>list.includes(v) ? v : d, intIn=(v, d, lo, hi)=>Math.round(num(v, d, lo, hi));
    o.cOn=e.cOn===true; o.cWord=str(e.cWord,24).replace(/\s+/g,'') || '!крутить'; o.cWho=oneOf(e.cWho, ['all','subs','mods'], 'mods');
    o.cMode=oneOf(e.cMode, ['add','spin'], 'add'); o.cCd=intIn(e.cCd, 10, 0, 3600); o.cLim=intIn(e.cLim, 1, 0, 99);
    o.rOn=e.rOn===true; o.rId=typeof e.rId==='string' && REWARD_RE.test(e.rId) ? e.rId : ''; o.rOne=e.rOne!==false; o.rWord=str(e.rWord,24).replace(/\s+/g,'');
    o.rMode=oneOf(e.rMode, ['add','spin'], 'add'); o.rCd=intIn(e.rCd, 5, 0, 3600); o.rLim=intIn(e.rLim, 0, 0, 99);
    o.vcnt=Object.create(null);   // сколько раз каждый зритель уже запускал (логин → число), для лимита на зрителя
    if(e.vcnt && typeof e.vcnt==='object') for(const k of Object.keys(e.vcnt).slice(0,ROU_PEOPLE*2)){ if(VOTER_RE.test(k)) o.vcnt[k]=intIn(e.vcnt[k], 0, 0, 999); }
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
    o.fxc=e.fxc!==false; o.ticks=e.ticks!==false; o.vol=num(e.vol,1,0,1);
  } else if(type==='draw'){
    o.x=50; o.y=50; o.rot=0;   // рисунок на весь экран: точки штрихов в 0.1% ширины и высоты
    o.del=(Array.isArray(e.del)?e.del:[]).filter(id=>typeof id==='string' && DRAW_ID_RE.test(id)).slice(-DRAW_MAX_DEL);
    o.strokes=sanitizeStrokes(e.strokes, new Set(o.del));
  } else if(type==='poll'){
    o.fs=num(e.fs,3.2,0.5,100); o.font=fontOf(e.font);
    o.color=hex(e.color,'#ffffff'); o.card=hex(e.card,'#1d1d24'); o.accent=hex(e.accent,'#7c5cff');
    o.title=str(e.title,100);
    o.opts=(Array.isArray(e.opts)?e.opts:[]).slice(0,6).map(x=>str(x,40));
    if(o.opts.length<2) o.opts=[st('Да'),st('Нет')];
    // голоса зрителей: ник → номер варианта. Один зритель = один голос, у всех пультов один и тот же словарь.
    // vround меняется при сбросе: словари разных раундов не смешиваются.
    o.vround=str(e.vround,12).replace(/[^a-z0-9]/gi,'');
    o.vk=Object.create(null); let nv=0;
    if(e.vk && typeof e.vk==='object') for(const k of Object.keys(e.vk)){
      if(nv>=VK_MAX) break;
      const i=num(e.vk[k],-1,-1,5);
      if(VOTER_RE.test(k) && Number.isInteger(i) && i>=0 && i<o.opts.length){ o.vk[k]=i; nv++; }
    }
    o.votes=nv ? pollTally(o.vk, o.opts.length) : o.opts.map((_,i)=>Math.round(num(Array.isArray(e.votes)?e.votes[i]:0,0,0,1e7)));   // старый экран без словаря
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
      o.endConfetti=!!e.endConfetti; o.endBlink=e.endBlink!==false; o.vol=num(e.vol,0.8,0,1);
    } else {
      o.value=Math.round(num(e.value,0,-1e9,1e9)); o.step=Math.round(num(e.step,1,1,1e6));
      o.cmode=COUNTER_MODES.includes(e.cmode)?e.cmode:'manual'; o.kw=str(e.kw,120); o.uniq=!!e.uniq; o.modsOnly=!!e.modsOnly;
      o.every=num(e.every,60,1,86400); o.goal=Math.round(num(e.goal,0,0,1e9));
      // режим «по чату»: id уже засчитанных сообщений, чтобы два пульта не посчитали одно сообщение дважды
      o.cids=(Array.isArray(e.cids)?e.cids:[]).slice(-CIDS_MAX).filter(x=>typeof x==='string' && MSGID_RE.test(x));
    }
  }
  if(e.ttl) o.ttl=num(e.ttl,0,0,1e15);
  if(e.g){ o.g=str(e.g,12).replace(/[^a-z0-9]/gi,''); if(o.g && e.gn) o.gn=str(e.gn,40); else if(!o.g) delete o.g; }
  const kf=sanitizeKf(e.kf); if(kf) o.kf=kf;
  // общая длительность анимации в секундах (приоритетнее старого множителя spd; вместе не храним)
  const rawDur=num(e.adur,0,0,600);
  if(rawDur>0) o.adur=Math.max(0.1, Math.round(rawDur*100)/100);
  else { const spd=num(e.spd,1,0.25,4); if(spd!==1) o.spd=spd; }   // старый множитель скорости (нет = 1)
  // своя рамка: ширина в % экрана и высота в % высоты экрана (0 = по содержимому)
  if(BOXABLE.has(o.type)){ o.bw=num(e.bw,o.type==='chat'?26:0,0,100); o.bh=num(e.bh,o.type==='chat'?55:0,0,100); }
  if(CROPPABLE.has(o.type)){ const cr=sanitizeCrop(e.crop); if(cr) o.crop=cr; }
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
// Период одного цикла готового эффекта, сек (как в core.css)
const ANIM_PERIOD = { pulse:1, wobble:1.2, float:2, spin:3, shake:0.25, rainbow:2 };
// Естественная длительность анимации элемента, сек: кадры (сумма времени кадров) или цикл готового эффекта; 0 = анимации нет
function animNatural(el){
  const k=el?.kf ? kfDuration(el.kf)/1000 : 0;
  return k>0 ? k : (ANIM_PERIOD[el?.anim]||0);
}
// Множитель скорости: заданная длительность adur (сек) даёт natural/dur; иначе старый spd
function animSpeed(el){
  const d=+el?.adur, n=animNatural(el);
  if(d>0 && n>0) return Math.min(1000, Math.max(0.001, n/d));
  const v=+el?.spd; return v>=0.25 && v<=4 ? v : 1;
}
// Сколько мс реального времени идёт анимация «один раз» с учётом скорости элемента
function kfRealDuration(el){ return el.kf ? kfDuration(el.kf)/animSpeed(el) : 0; }
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
  let st = kf && kf.playing ? kfAt(kf, Math.max(0, now-kf.start)*animSpeed(el)) : null;
  if(st && st.done && kf.end==='back') st=null;
  if(!st){ if(node._animOn){ node._animOn=false; node.classList.remove('animating'); return 'reset'; } return false; }
  node._animOn=true; node.classList.add('animating');
  node.style.left=st.x+'%'; node.style.top=st.y+'%';
  node.style.transform=`translate(-50%,-50%) rotate(${st.r}deg) scale(${st.s})`;
  node.style.opacity = (node._vis ?? 1) * el.op * (st.done && kf.end==='hide' ? 0 : st.o);
  return true;
}
// Готовые анимации (kfPreset, KF_PRESETS) лежат в presets/animations.js: они под лицензией MIT.

// Испорченный элемент выкидываем один, а не весь экран
function sanitizeElSafe(e){ try{ return sanitizeEl(e); }catch{ return null; } }
function sanitizeState(m){
  const lang = STREAM_LANGS.includes(m?.lang) ? m.lang : null, prevLang = STREAM_LANG;
  if(lang) STREAM_LANG = lang;   // тексты по умолчанию (варианты опроса) берём на языке этого экрана
  let els;
  try{ els = Array.isArray(m?.els) ? m.els.slice(0,MAX_ELS).map(sanitizeElSafe).filter(Boolean) : []; }finally{ STREAM_LANG = prevLang; }
  // Розыгрыш один на экран и живёт не в списке слоёв, а в state.raffle. Старый экран: первый розыгрыш из списка переезжает.
  const raffle = sanitizeElSafe(m?.raffle && typeof m.raffle==='object' ? { ...m.raffle, type:'raffle' } : els.find(e => e.type==='raffle'));
  els = els.filter(e => e.type!=='raffle');
  // id у каждого свой: с двумя одинаковыми экран пересобирал бы элементы при каждом обновлении. Остаётся первый.
  const ids = new Set();
  els = els.filter(e => !ids.has(e.id) && ids.add(e.id));
  if(raffle && ids.has(raffle.id)){ let n = 1; while(ids.has('raffle'+n)) n++; raffle.id = 'raffle'+n; }
  const fonts = (Array.isArray(m?.fonts) ? m.fonts : []).slice(0, 40)
    .filter(f => typeof f?.id==='string' && /^[a-z0-9]{6,24}$/.test(f.id)).map(f => ({ id:f.id, name:str(f.name, 60) || 'Шрифт' }));
  // смайлы 7TV/BTTV/FFZ включаются на комнату; выключенный провайдер пропадает и из показанных сообщений
  const emx = m?.emx && typeof m.emx==='object' ? cleanEmx(m.emx) : null;
  for(const e of els) if(e.type==='msg') e.xe = e.xe.filter(x => emx?.[x[0]]);
  // «Скрыть всё» теперь закрывает глазки у видимых элементов (hidAll помнит какие). Старый экран с visible:false: прячем все элементы.
  let hidAll = (Array.isArray(m?.hidAll) ? m.hidAll : []).filter(x => typeof x==='string').slice(0, MAX_ELS+1).map(x => x.slice(0, 40));
  if(m?.visible === false){
    hidAll = [];
    for(const e of drawList({ els, raffle })) if(!e.hidden){ e.hidden = true; delete e.ttl; hidAll.push(e.id); }
  }
  // claims: кто из пультов обрабатывает сообщение чата (по id сообщения); так одно сообщение не запускает действие дважды
  const claims = (Array.isArray(m?.claims) ? m.claims : []).slice(-CLAIMS_MAX).filter(c => c && typeof c.m==='string' && MSGID_RE.test(c.m) && typeof c.o==='string' && /^[\w-]{1,32}$/.test(c.o)).map(c => ({ m:c.m, o:c.o }));
  return { visible: true, hidAll, els, lang, fonts, vol: num(m?.vol, 1, 0, 1), fxVol: num(m?.fxVol, 1, 0, 1), raffle, emx, cs2auto: cleanCs2Auto(m?.cs2auto), claims };
}
// Всё, что рисуется на экране: слои, а розыгрыш отдельным узлом поверх них
function drawList(s){ return s.raffle ? [...s.els, s.raffle] : s.els; }

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
  c._el=el;   // цикл кадров ленты берёт последнее состояние элемента
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
  if(!c._loop){ c._loop=true; const step=()=>{ const el=c._el; if(!c.isConnected || !c._strip || el.phase!=='spin'){ c._loop=false; return; } rafFrame(c, el, nowMs()); if(nowMs()-el.spinAt < RAFFLE_OPEN+RAFFLE_SPIN+200) requestAnimationFrame(step); else { rafFrame(c, el, nowMs()); c._loop=false; } }; requestAnimationFrame(step); }
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

// ---------- кейс: 3D-открытие (case3d.js), лента с «почти-почти», взрыв цвета редкости ----------
// Звуки и 3D рисует case3d.js. В пульте сцена тише и легче: CaseFx.audio включает только виджет.
const CaseFx = { audio:false, low:false };
// Предмет без картинки: огранённый кристалл в цвет редкости
function gemSvg(){
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 64 64'); const id='gm'+(gemSvg.n=(gemSvg.n||0)+1);
  s.innerHTML='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity=".55"/></linearGradient></defs>'+
    '<path d="M20 8h24l14 16-26 32L6 24z" fill="url(#'+id+')"/><path d="M6 24h52M20 8l-4 16 16 32 16-32-4-16M32 8l-16 16M32 8l16 16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/>';
  return s;
}
// Картинка предмета: если файл ещё качается, src проставит paintCase, когда он придёт
function caseImg(src){ const im=rh('img'); im.alt=''; im.draggable=false; const u=resolveSrc(src); if(u) im.src=u; else im.dataset.asset=src; return im; }
function itemCard(it, cls){
  const c=rh('div','cs-card'+(cls?' '+cls:'')); c.style.setProperty('--r', RARITY7[it?.r??2]);
  const pic=rh('div','cs-pic');
  if(it?.sp){ c.classList.add('sp'); c.style.setProperty('--r','#35d0ff'); }   // карточка «Перекрут»
  if(it?.img) pic.appendChild(caseImg(it.img));
  else if(it?.sp) pic.appendChild(rh('div','cs-respin','↻'));
  else pic.appendChild(gemSvg());
  c.append(pic, rh('div','cs-nm', it?.n||'?'));
  return c;
}
function paintCase(c, el){
  for(const it of el.items) if(it.img) resolveSrc(it.img);
  for(const v of Object.values(el.snd)) resolveSrc(v);
  const sig=JSON.stringify([el.openAt, el.items, el.reel, el.win, el.reel2, el.win2, el.kind, el.kindNow, el.bmode, el.uhhText, el.upText, el.donor, el.amount, el.name, el.cc, STREAM_LANG]);   // логотип рисует только 3D-крышка
  if(c._sig!==sig){
    c._sig=sig; c.replaceChildren(); c._t0=el.openAt;
    const g=rh('div','cs-3d'); c.appendChild(g); c._gl=g;
    const top=rh('div','cs-top'); top.append(rh('b','cs-donor', el.donor||st('Зритель')), rh('span',null,' '+st('открывает')+' '), rh('b','cs-cname', el.name));
    if(el.amount) top.appendChild(rh('span','cs-amt', el.amount));
    c.appendChild(top);
    const reel=rh('div','cs-reel'), strip=rh('div','cs-strip');
    el.reel.forEach((ix,i)=>strip.appendChild(itemCard(el.items[ix], i===CASE_WIN?'win':'')));
    reel.append(strip);
    if(el.reel2.length){   // вторая лента «перекрута»: те же карточки, но предметы ≥ выбранной редкости
      const strip2=rh('div','cs-strip cs-strip2'); el.reel2.forEach((ix,i)=>strip2.appendChild(itemCard(el.items[ix], i===CASE_WIN?'win':''))); reel.appendChild(strip2); c._strip2=strip2;
    } else c._strip2=null;
    reel.append(rh('div','cs-mark')); c.appendChild(reel); c._reelBox=reel;
    c.append(rh('div','cs-flash'));
    if(el.uhhText) c.appendChild(rh('div','cs-uhh', el.uhhText));
    if(el.upText) c.appendChild(rh('div','cs-up', el.upText));
    const w=el.items[caseWinIdx(el)];
    const rev=rh('div','cs-rev'+(w?.r===6?' gold':'')); if(w) rev.style.setProperty('--r', RARITY7[w.r]);
    rev.append(rh('div','cs-rays'), rh('canvas','cs-sparks'));
    const card=rh('div','cs-big'); const pic=rh('div','cs-bpic');
    pic.appendChild(w?.img ? caseImg(w.img) : gemSvg());
    card.append(pic, rh('div','cs-rar', w ? st(RARITY_NAME[w.r]) : ''), rh('div','cs-bname', w?.n||''), rh('div','cs-who', (el.donor||st('Зритель'))+' '+st('выбил')));
    rev.appendChild(card); c.appendChild(rev);
    c._strip=strip; c._last=-1; c._last2=-1; c._sparks=null;
  }
  // картинки, которые догрузились после того, как кейс нарисован (без пересборки: лента не дёргается)
  for(const im of c.querySelectorAll('img[data-asset]')){ const u=resolveSrc(im.dataset.asset); if(u){ im.src=u; delete im.dataset.asset; } }
  caseKick(c, el);
}
// Вид этого открытия (у рандомного он выпал при открытии), время сцены и итоговый предмет
function caseKind(el){ return el.kind==='random' ? (el.kindNow||'normal') : el.kind; }
function caseWinIdx(el){ return el.reel2 && el.reel2.length ? el.win2 : el.win; }
function caseT(el){
  if(!(el && el.reel2 && el.reel2.length)) return CASE_T;
  const up=CASE_T.reel+CASE_T.reelDur, reel2=up+CASE_2.gap;
  return { ...CASE_T, up, reel2, reveal:reel2+CASE_2.dur+200 };
}
// Положение ленты. Обычная: один плавный ease-out в случайную точку выигрышной карточки.
// Байтовая «недокрут»: долгое торможение на соседней карточке и медленный дотяг. «Перекрут»: проскок на следующую карточку и откат.
const easeOut=(q,k)=>1-Math.pow(1-q,k);
function caseReelX(el, t){
  const p=Math.min(1, Math.max(0, t/CASE_T.reelDur)), jit=el.jit;
  const target=(CASE_WIN+0.5+jit)*CASE_STEP - 0.4;
  if(caseKind(el)!=='bait') return target*easeOut(p, 3.7);
  if(el.bmode==='over'){
    const xo=target+CASE_STEP*(0.62+Math.abs(jit)*0.4);   // проскочили на следующую карточку
    if(p<0.8) return xo*easeOut(p/0.8, 3.2);
    const q=(p-0.8)/0.2; return xo + (target-xo)*(q*q*(3-2*q));
  }
  const gap=CASE_STEP*(0.5+jit)+1.2, x1=target-gap;   // стоп: над прошлой карточкой
  if(p<0.8) return x1*easeOut(p/0.8, 3.2);
  const q=(p-0.8)/0.2; return x1 + gap*(q*q*(3-2*q));
}
function caseReelX2(el, t){
  const p=Math.min(1, Math.max(0, t/CASE_2.dur));
  return ((CASE_WIN+0.5+el.jit2)*CASE_STEP - 0.4)*easeOut(p, 3.7);
}
// Момент напряжения байтовой ленты: тряска, вспышка и «УХХ!»
const CASE_BAIT = [0.74, 0.93];
function caseKick(c, el){
  c._el=el;   // цикл кадров всегда берёт последнее состояние элемента
  if(c._loop || !el.openAt) return;
  c._loop=true;
  const step=()=>{
    const el=c._el, end=el.openAt+caseT(el).reveal+el.hideAfter*1000+1500;
    const now = window.__caseFreeze!=null ? el.openAt+window.__caseFreeze : nowMs();   // __caseFreeze: стоп-кадр для тестов и скриншотов
    if(!c.isConnected || now>end || c._t0!==el.openAt){ c._loop=false; if(now>end) c.dataset.ph='gone'; window.Case3D?.stop(c); return; }
    caseFrame(c, el, now-el.openAt);
    requestAnimationFrame(step);
  };
  if(nowMs()>el.openAt+caseT(el).reveal+el.hideAfter*1000+1500){ c.dataset.ph='gone'; c._loop=false; return; }
  requestAnimationFrame(step);
}
function caseFrame(c, el, t){
  const ct=caseT(el), two=ct.reel2!=null;
  const ph = t<0 ? 'wait' : t<CASE_T.reel ? 'open' : t<ct.reveal ? 'reel' : 'reveal';
  if(c.dataset.ph!==ph) c.dataset.ph=ph;
  window.Case3D?.frame(c, el, t);
  if(t>=CASE_T.reel-300 && c._strip){
    const second = two && t>=ct.reel2;
    if(c.dataset.stage!==(second?'2':'1')) c.dataset.stage=second?'2':'1';
    if(!second){
      const x=caseReelX(el, t-CASE_T.reel);
      c._strip.style.transform=`translate3d(${(-x).toFixed(3)}em,0,0)`;
      const idx=Math.floor((x+0.4)/CASE_STEP);
      if(idx!==c._last){ if(c._last>=0 && t<CASE_T.reel+CASE_T.reelDur) window.Case3D?.tick(el, Math.min(1,(t-CASE_T.reel)/CASE_T.reelDur)); c._last=idx; }
    } else if(c._strip2){
      const x=caseReelX2(el, t-ct.reel2);
      c._strip2.style.transform=`translate3d(${(-x).toFixed(3)}em,0,0)`;
      const idx=Math.floor((x+0.4)/CASE_STEP);
      if(idx!==c._last2){ if(c._last2>=0 && t<ct.reel2+CASE_2.dur) window.Case3D?.tick(el, Math.min(1,(t-ct.reel2)/CASE_2.dur)); c._last2=idx; }
    }
    // байтовая лента: в момент «почти» трясётся и вспыхивает
    const pb=(t-CASE_T.reel)/CASE_T.reelDur, bait=caseKind(el)==='bait' && pb>CASE_BAIT[0] && pb<CASE_BAIT[1];
    const box=c._reelBox;
    if(box){
      if(bait){ const k=Math.sin(Math.PI*(pb-CASE_BAIT[0])/(CASE_BAIT[1]-CASE_BAIT[0])); box.style.translate=`${(Math.sin(t*0.11)*0.22*k).toFixed(3)}em ${(Math.cos(t*0.17)*0.16*k).toFixed(3)}em`; }
      else if(box.style.translate) box.style.translate='';
    }
    const u=bait?'1':'0'; if(c.dataset.uhh!==u) c.dataset.uhh=u;
    const up = two && t>=ct.up && t<ct.reel2+900 ? '1' : '0'; if(c.dataset.up!==up) c.dataset.up=up;
  }
  if(ph==='reveal') caseSparks(c, el, t-ct.reveal);
}
// Искры в цвет редкости при выпадении (2D-холст поверх)
function caseSparks(c, el, t){
  const cv=c.querySelector('.cs-sparks'); if(!cv) return;
  const w=el.items[caseWinIdx(el)]; if(!w) return;
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
  else if(el.type==='stream'){
    c=document.createElement('video'); c.autoplay=true; c.muted=true; c.playsInline=true;
    c.setAttribute('playsinline',''); c.setAttribute('muted','');
  }
  else if(el.type==='video'){
    c=document.createElement('video'); c.autoplay=true; c.loop=true; c.muted=true; c.playsInline=true;
    c.setAttribute('playsinline',''); c.setAttribute('muted','');
  } else if(el.type==='image'){ c=document.createElement('img'); c.alt=''; c.draggable=false; }
  else if(el.type==='cs2'){ c=document.createElement('div'); c.className='cs2'; }
  else if(el.type==='msg'){ c=document.createElement('div'); c.className='msg'; }
  else if(el.type==='chat'){ c=document.createElement('div'); c.className='chat'; }
  else if(el.type==='raffle'){ c=document.createElement('div'); c.className='raf'; }
  else if(el.type==='case'){ c=document.createElement('div'); c.className='case'; }
  else if(el.type==='draw'){ c=document.createElement('div'); c.className='draw'; c.appendChild(document.createElement('canvas')); }
  else if(el.type==='roulette'){ c=document.createElement('div'); c.className='rou'; }
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
  const sp=animSpeed(el); if(fx._as!==sp){ fx._as=sp; if(sp===1) fx.style.removeProperty('--as'); else fx.style.setProperty('--as', sp); }
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
  } else if(el.type==='stream'){
    node.style.width=el.kind==='mic' ? '' : el.w+'%';
    node.dataset.kind=el.kind; node.classList.toggle('s-mic', el.kind==='mic');
    c.style.height = el.hh ? `calc(var(--u) * ${el.hh})` : '';
    c.style.objectFit = el.hh ? 'fill' : '';
    c.style.aspectRatio = el.hh ? 'auto' : (c._ar || '16 / 9');
    window.streamPaint?.(node, el);   // the page binds the live picture (media.js)
  } else if(el.type==='msg'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    c.style.maxWidth=`calc(var(--u) * ${(el.maxw*16/9).toFixed(2)})`;
    const sig=JSON.stringify([el.user, el.ucolor, el.text, el.emotes, el.xe, el.badge]);
    if(c._sig!==sig){ const had=!!c._sig; c._sig=sig; paintMsg(c, el); if(had){ c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } }
  } else if(el.type==='chat'){
    c.style.fontSize=`calc(var(--u) * ${el.fs})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--card', el.card); c.style.setProperty('--c', el.accent);
    node.style.width='';
    c.dataset.theme=el.theme; c.dataset.align=el.align; c.classList.toggle('nob', !el.badges);
    chatBind(c, el);
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
  } else if(el.type==='draw'){
    node.style.width='100%'; node.classList.add('full');
    drawPaint(c, el);
  } else if(el.type==='roulette'){
    node.style.width='';
    c.style.fontSize=`calc(var(--u) * ${(el.fs*0.37).toFixed(3)})`; c.style.fontFamily=fontCss(el.font); c.style.color=el.color;
    c.style.setProperty('--ra', el.accent); c.style.setProperty('--q', `calc(var(--u) * ${(el.fs*0.37/16).toFixed(4)})`);
    window.Rou?.paint(c, el);
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
  // обрезка: режем содержимое, а рамка и анимации остаются на месте; --L/--R/... нужны ручкам пульта
  { const cr = CROPPABLE.has(el.type) && el.crop ? el.crop : null, b = node.querySelector('.content');
    if(b){ const v = cr ? `inset(${cr[1]}% ${cr[2]}% ${cr[3]}% ${cr[0]}%)` : ''; if(b.style.clipPath!==v) b.style.clipPath=v; }
    const sp=(k,v)=>{ if(node.style.getPropertyValue(k)!==v) node.style.setProperty(k,v); }, c=cr||[0,0,0,0];
    sp('--L',c[0]+'%'); sp('--T',c[1]+'%'); sp('--R',(100-c[2])+'%'); sp('--B',(100-c[3])+'%');
    sp('--CX',((c[0]+100-c[2])/2)+'%'); sp('--CY',((c[1]+100-c[3])/2)+'%'); }
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
  if(el.type==='roulette'){ const c=node.querySelector('.rou'); if(c) window.Rou?.kick(c, el); return null; }
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

// ---------- сайты, YouTube, Twitch ----------
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
  const want = { kind, paused:!!el.paused, vol: !muted && el.sound ? el.vol * masterVol() : null };
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
// SVG не принимаем: это документ со своими ссылками и скриптами, а не просто картинка
const MIME_RE = /^(?!image\/svg)(image|video|audio|font)\/[\w.+-]+$/i;
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
  // файл больше не нужен: отдать память. Понадобится снова: resolve() скачает его заново.
  drop(id){
    const u = this.urls.get(id); if(u) URL.revokeObjectURL(u);
    this.urls.delete(id); this.meta.delete(id);
    const t = this.tries.get(id); if(t){ clearTimeout(t.timer); this.tries.delete(id); }
  },
};
function resolveSrc(src){ return Assets.resolve(src); }
// Файлы (id ассетов), на которые ссылается элемент или экран: картинки, видео, звуки, логотипы, аватарки, шрифты
function assetsOfEl(e, used=new Set()){
  const add=v=>{ const a=assetId(v); if(a) used.add(a); };
  if(!e || typeof e!=='object') return used;
  add(e.src); add(e.endSound); add(e.lgCT); add(e.lgT); add(e.pimg); add(e.vfx); add(e.logo);
  if(Array.isArray(e.items)) for(const it of e.items) add(it?.img);
  if(e.snd && typeof e.snd==='object') for(const v of Object.values(e.snd)) add(v); else add(e.snd);
  if(e.av && typeof e.av==='object') for(const v of Object.values(e.av)) add(v);
  if(Array.isArray(e.strokes)) for(const k of e.strokes) add(k?.asset);   // кисть из фото
  return used;
}
function assetsOf(s, used=new Set()){
  if(!s || typeof s!=='object') return used;
  for(const e of Array.isArray(s.els) ? s.els : []) assetsOfEl(e, used);
  assetsOfEl(s.raffle, used);
  for(const f of Array.isArray(s.fonts) ? s.fonts : []) if(typeof f?.id==='string') used.add(f.id);
  return used;
}

// ---------- рисунок ----------
// Элемент draw: штрихи на весь экран. Точки целыми числами в 0.1% ширины и высоты экрана ([x,y,x,y,…]),
// толщина в пикселях экрана высотой 1080. Стёртые штрихи помнятся в del: так чужой пульт не вернёт их при слиянии.
const DRAW_TOOLS = ['pen','marker','neon','line','arrow','circle','rect','stamp','tex'];
const DRAW_SHAPES = new Set(['line','arrow','circle','rect']);
const DRAW_ID_RE = /^[a-z0-9]{4,24}$/;
const DRAW_MAX_STROKES = 400, DRAW_MAX_PTS = 2000, DRAW_MAX_TOTAL = 40000, DRAW_MAX_DEL = 1000;
const DRAW_FADE_OUT = 900;   // мс: штрих тает, а не пропадает разом
function sanitizeStroke(s){
  if(!s || typeof s!=='object') return null;
  const id = typeof s.id==='string' && DRAW_ID_RE.test(s.id) ? s.id : null;
  const tool = DRAW_TOOLS.includes(s.tool) ? s.tool : null;
  if(!id || !tool || !Array.isArray(s.pts)) return null;
  const n = Math.min(DRAW_MAX_PTS, s.pts.length>>1), pts = [];
  for(let i=0;i<n*2;i++) pts.push(Math.round(num(s.pts[i],0,-100,1100)));
  if(DRAW_SHAPES.has(tool) && pts.length>4) pts.splice(2, pts.length-4);   // у фигуры только начало и конец
  if(!pts.length) return null;
  const o = { id, by:str(s.by,24), tool, color:hex(s.color,'#ffffff'), size:Math.round(num(s.size,6,1,80)*2)/2, pts, t:num(s.t,0,0,1e15) };
  if(s.fade) o.fade = Math.round(num(s.fade,5,1,60));
  if(tool==='stamp' || tool==='tex'){ const a = assetId(s.asset); if(!a) return null; o.asset = 'asset:'+a; }
  if(s.hold) o.hold = 1;
  return o;
}
// Новые штрихи важнее: при переполнении уходят самые старые
function drawCap(list){
  list = list.slice(-DRAW_MAX_STROKES);
  let total = 0, i = list.length;
  while(i>0 && total + list[i-1].pts.length/2 <= DRAW_MAX_TOTAL){ total += list[i-1].pts.length/2; i--; }
  return list.slice(i);
}
function sanitizeStrokes(arr, del=new Set()){
  const seen = new Set(), out = [];
  for(const x of Array.isArray(arr) ? arr.slice(-DRAW_MAX_STROKES*2) : []){
    const k = sanitizeStroke(x);
    if(!k || del.has(k.id) || seen.has(k.id)) continue;
    seen.add(k.id); out.push(k);
  }
  return drawCap(out);
}
// Растаял совсем? Штрих «по кнопке» не тает, пока его не показали.
function drawGone(k, now){ return !!k.fade && !k.hold && now >= k.t + k.fade*1000 + DRAW_FADE_OUT; }
function drawAlpha(k, now){
  if(!k.fade || k.hold) return 1;
  const over = now - (k.t + k.fade*1000);
  if(over<=0) return 1;
  const q = Math.min(1, over/DRAW_FADE_OUT); return (1-q)*(1-q);
}
// Слияние рисунка двух пультов: штрихи по id, стёртое (del) у обоих стёрто. added: у нас есть то, чего нет у них.
function drawMerge(mine, theirs, now=nowMs()){
  const del = new Set(theirs.del), map = new Map(), shown = new Set(theirs.strokes.map(k=>k.id));
  let added = false;
  // Стёртое дослать нужно, только если у них этот штрих ещё виден. Иначе при переполнении del (DRAW_MAX_DEL)
  // два пульта бесконечно возвращали бы друг другу обрезанные хвосты списка.
  for(const id of mine.del) if(!del.has(id)){ del.add(id); if(shown.has(id)) added = true; }
  for(const k of theirs.strokes) if(!del.has(k.id)) map.set(k.id, k);
  for(const k of mine.strokes){
    if(del.has(k.id) || drawGone(k, now)) continue;
    const r = map.get(k.id);
    if(!r || (r.hold && !k.hold)){ map.set(k.id, k); added = true; }   // показанный штрих важнее скрытого
  }
  const strokes = drawCap([...map.values()].sort((a,b)=>(a.hold?1e15:a.t)-(b.hold?1e15:b.t) || (a.id<b.id?-1:a.id>b.id?1:0)));
  return { strokes, del:[...del].slice(-DRAW_MAX_DEL), added };
}
// Упрощение линии (Рамер — Дуглас — Пекер): точки, отклоняющиеся меньше eps (в 0.1% высоты), выкидываются
function drawSimplify(pts, eps=1){
  const n = pts.length>>1; if(n<3) return pts.slice();
  const X = i => pts[2*i]*16/9, Y = i => pts[2*i+1];
  const keep = new Uint8Array(n); keep[0] = keep[n-1] = 1;
  const stack = [[0, n-1]];
  while(stack.length){
    const [a, b] = stack.pop(); let far = 0, at = -1;
    const ax = X(a), ay = Y(a), dx = X(b)-ax, dy = Y(b)-ay, L = Math.hypot(dx, dy);
    for(let i=a+1;i<b;i++){
      const d = L ? Math.abs(dy*(X(i)-ax) - dx*(Y(i)-ay))/L : Math.hypot(X(i)-ax, Y(i)-ay);
      if(d>far){ far = d; at = i; }
    }
    if(at>=0 && far>eps){ keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const out = []; for(let i=0;i<n;i++) if(keep[i]) out.push(pts[2*i], pts[2*i+1]);
  return out;
}
// Рисует .draw: штрихи элемента и живые штрихи, которые модераторы ещё ведут (тема ink)
const DrawFx = {
  panel:false,            // пульт: штрихи «по кнопке» видны полупрозрачными
  live:new Map(),         // id элемента → Map(id штриха → { k, at, done })
  boxes:new Set(), imgs:new Map(), raf:0, ro:null,
  // Кусок живого штриха: { el, id, i (с какой точки), pts, tool, color, size, asset, hold, done }
  ink(m){
    if(!m || typeof m!=='object') return false;
    const el = str(m.el,40), id = typeof m.id==='string' && DRAW_ID_RE.test(m.id) ? m.id : '';
    if(!el || !id) return false;
    const part = sanitizeStroke({ ...m, t:0, fade:0 });
    let map = this.live.get(el);
    if(!map){ if(this.live.size>=40) this.prune(); if(this.live.size>=40) return false; map = new Map(); this.live.set(el, map); }
    let e = map.get(id);
    if(!e){ if(map.size>=24) this.prune(); if(!part || map.size>=24) return false; e = { k:part }; map.set(id, e); }
    else if(part){
      if(DRAW_SHAPES.has(part.tool)) e.k.pts = part.pts;
      else { const p = e.k.pts, off = 2*Math.round(num(m.i,0,0,DRAW_MAX_PTS)); if(off<p.length) p.length = off; for(const v of part.pts) if(p.length<DRAW_MAX_PTS*2) p.push(v); }
    }
    e.at = Date.now(); e.done = !!m.done;
    this.dirty(el); return true;
  },
  // Живые штрихи без хозяина (элемента нет на экране, пульт пропал) иначе чистит только drawRender своего рисунка:
  // мусорные id элементов от модератора заняли бы все 40 мест навсегда
  prune(now=Date.now()){
    for(const [el, m] of this.live){
      for(const [id, e] of m) if(now-e.at > (e.done ? 8000 : 3000)) m.delete(id);
      if(!m.size) this.live.delete(el);
    }
  },
  dirty(elId){ for(const c of this.boxes) if(!elId || c._el?.id===elId) c._dirty = true; this.loop(); },
  loop(){ if(!this.raf && typeof requestAnimationFrame==='function') this.raf = requestAnimationFrame(()=>{ this.raf = 0; this.frame(); }); },
  frame(){
    const now = nowMs(); let more = false;
    for(const c of this.boxes){
      if(!c.isConnected){ this.boxes.delete(c); this.ro?.unobserve(c); continue; }
      if(c._dirty || now>=c._wake) drawRender(c, now);
      if(c._wake<Infinity) more = true;
    }
    if(more) this.loop();
  },
  // Картинка кисти из фото: файл приходит из программы стримера, как и все остальные
  img(src){
    const u = resolveSrc(src); if(!u) return null;
    let im = this.imgs.get(u);
    if(!im){
      if(this.imgs.size>40) this.imgs.clear();
      im = new Image(); im.onload = () => { for(const c of this.boxes) c._baseKey = null; this.dirty(); }; im.src = u; this.imgs.set(u, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  },
};
function drawPaint(c, el){
  c._el = el;
  if(!DrawFx.boxes.has(c)){
    DrawFx.boxes.add(c);
    if(typeof ResizeObserver==='function'){ DrawFx.ro ||= new ResizeObserver(es=>{ for(const e of es) e.target._dirty = true; DrawFx.loop(); }); DrawFx.ro.observe(c); }
  }
  let sig = ''; for(const k of el.strokes) sig += k.id+(k.hold?'+':':')+k.t+',';
  if(c._sig!==sig){ c._sig = sig; c._dirty = true; }
  if(c._dirty) DrawFx.loop();
}
// Готовые штрихи рисуются в запасной холст и перерисовываются, только когда они поменялись или тают;
// живые штрихи (их ведут прямо сейчас) кладутся поверх каждый кадр
function drawRender(c, now){
  const el = c._el, cv = c.firstChild;
  c._dirty = false; c._wake = Infinity;
  if(!el || !cv?.getContext) return;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(c.clientWidth*dpr)), H = Math.max(1, Math.round(c.clientHeight*dpr));
  if(cv.width!==W || cv.height!==H){ cv.width = W; cv.height = H; }
  const base = c._base ||= document.createElement('canvas'), key = c._sig+'|'+W+'x'+H+'|'+DrawFx.panel;
  if(c._baseKey!==key || now>=c._baseWake){
    if(base.width!==W || base.height!==H){ base.width = W; base.height = H; }
    const bx = base.getContext('2d'); bx.setTransform(1,0,0,1,0,0); bx.clearRect(0, 0, W, H);
    let wake = Infinity;
    for(const k of el.strokes){
      if(k.hold && !DrawFx.panel) continue;
      const a = drawAlpha(k, now); if(a<=0) continue;
      if(k.fade && !k.hold){ const t0 = k.t + k.fade*1000; wake = Math.min(wake, now<t0 ? t0 : now); }
      drawStroke(bx, k, W, H, k.hold ? a*0.45 : a);
    }
    c._baseKey = key; c._baseWake = wake;
  }
  c._wake = c._baseWake;
  const ctx = cv.getContext('2d'); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0, 0, W, H);
  ctx.drawImage(base, 0, 0);
  const live = DrawFx.live.get(el.id);
  if(live){
    const ids = new Set(el.strokes.map(k=>k.id));
    for(const [id, e] of live){
      const age = Date.now()-e.at, ttl = e.done ? 8000 : 3000;
      if(ids.has(id) || age>ttl){ live.delete(id); continue; }   // штрих уже в элементе, или пульт пропал
      c._wake = Math.min(c._wake, now + ttl - age + 50);
      if(e.k.hold && !DrawFx.panel) continue;
      drawStroke(ctx, e.k, W, H, e.k.hold ? 0.45 : 1);
    }
    if(!live.size) DrawFx.live.delete(el.id);
  }
}
// Плавная линия через середины отрезков
function drawPath(ctx, P){
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
  if(P.length===1){ ctx.lineTo(P[0][0]+0.01, P[0][1]); return; }
  for(let i=1;i<P.length-1;i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0]+P[i+1][0])/2, (P[i][1]+P[i+1][1])/2);
  ctx.lineTo(P[P.length-1][0], P[P.length-1][1]);
}
function drawLight(h, t){ const n = parseInt(h.slice(1),16), m = v => Math.round(v+(255-v)*t); return `rgb(${m(n>>16&255)},${m(n>>8&255)},${m(n&255)})`; }
function drawStroke(ctx, k, W, H, alpha){
  const z = H/1080, w = Math.max(0.5, k.size*z), P = [];
  for(let i=0;i+1<k.pts.length;i+=2) P.push([k.pts[i]*W/1000, k.pts[i+1]*H/1000]);
  if(!P.length) return;
  const A = P[0], B = P[P.length-1];
  ctx.save();
  ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = k.color; ctx.fillStyle = k.color; ctx.lineWidth = w;
  // мягкая тень: линию видно и на светлой, и на тёмной картинке игры
  const shade = (s=1) => { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = Math.max(2*z, w*0.7)*s; ctx.shadowOffsetY = Math.max(z, w*0.12)*s; };
  if(k.tool==='pen'){ shade(); drawPath(ctx, P); ctx.stroke(); }
  else if(k.tool==='marker'){ ctx.globalAlpha = alpha*0.55; ctx.lineWidth = w*2.6; drawPath(ctx, P); ctx.stroke(); }
  else if(k.tool==='neon'){
    drawPath(ctx, P);
    ctx.shadowColor = k.color; ctx.shadowBlur = w*4; ctx.stroke();
    ctx.shadowBlur = w*1.6; ctx.stroke();
    ctx.shadowBlur = w*0.5; ctx.strokeStyle = drawLight(k.color, 0.85); ctx.lineWidth = Math.max(z, w*0.45); ctx.stroke();
  }
  else if(k.tool==='line' || k.tool==='arrow'){
    const dx = B[0]-A[0], dy = B[1]-A[1], L = Math.hypot(dx, dy);
    shade();
    if(k.tool==='line' || L<1){ ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0]+(L<1?0.01:0), B[1]); ctx.stroke(); }
    else {
      const ux = dx/L, uy = dy/L, hl = Math.min(L*0.8, Math.max(w*4.8, 26*z)), hw = hl*0.55;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0]-ux*hl*0.8, B[1]-uy*hl*0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(B[0], B[1]);
      ctx.lineTo(B[0]-ux*hl-uy*hw, B[1]-uy*hl+ux*hw);
      ctx.lineTo(B[0]-ux*hl*0.82, B[1]-uy*hl*0.82);
      ctx.lineTo(B[0]-ux*hl+uy*hw, B[1]-uy*hl-ux*hw);
      ctx.closePath(); ctx.lineWidth = Math.max(z, w*0.6); ctx.fill(); ctx.stroke();
    }
  }
  else if(k.tool==='circle'){
    const rx = Math.abs(B[0]-A[0])/2, ry = Math.abs(B[1]-A[1])/2;
    shade(); ctx.beginPath(); ctx.ellipse((A[0]+B[0])/2, (A[1]+B[1])/2, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI*2); ctx.stroke();
  }
  else if(k.tool==='rect'){
    const x = Math.min(A[0], B[0]), y = Math.min(A[1], B[1]), rw = Math.abs(B[0]-A[0]), rh = Math.abs(B[1]-A[1]);
    shade(); ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x, y, rw, rh, Math.min(w*1.2, rw/4, rh/4)); else ctx.rect(x, y, rw, rh);
    ctx.stroke();
  }
  else if(k.tool==='stamp'){
    const im = DrawFx.img(k.asset);
    if(im){
      const h = k.size*4*z, wd = h*im.naturalWidth/im.naturalHeight, step = Math.max(2, Math.max(h, wd)*0.8);
      shade(0.6);
      const put = (x, y) => ctx.drawImage(im, x-wd/2, y-h/2, wd, h);
      put(A[0], A[1]);
      let left = step;
      for(let i=1;i<P.length;i++){
        const [x0, y0] = P[i-1], [x1, y1] = P[i], d = Math.hypot(x1-x0, y1-y0);
        let s = left;
        while(s<=d){ put(x0+(x1-x0)*s/d, y0+(y1-y0)*s/d); s += step; }
        left = s-d;
      }
    }
  }
  else if(k.tool==='tex'){
    const im = DrawFx.img(k.asset);
    if(im){
      const pat = ctx.createPattern(im, 'repeat'), sc = 240*z/im.naturalHeight;
      if(pat){
        if(pat.setTransform && typeof DOMMatrix==='function') pat.setTransform(new DOMMatrix([sc, 0, 0, sc, 0, 0]));
        shade(0.6); ctx.strokeStyle = pat; ctx.lineWidth = w*2.4; drawPath(ctx, P); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

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
function weaponName(w){ if(!w) return ''; const id=String(w).replace(/^weapon_/,''); return /knife|bayonet/.test(id) ? st('Нож') : st((Object.hasOwn(WEAPONS, id) && WEAPONS[id]) || id.toUpperCase()); }
function mapName(m){ if(!m) return ''; const n=String(m).replace(/^(de|cs|ar|dz|gd)_/,''); return n.charAt(0).toUpperCase()+n.slice(1); }
// observer_slot CS2 идёт 0–9: слот 0 — первый игрок (клавиша 1), слот 9 — десятый (клавиша 0). Подпись 1 2 … 9 0, порядок — по слоту.
// Та же формула в server.js (slotKey). -1 и пустое значение дают пустую подпись и уходят в конец.
const slotLabel = s => { const n=Number(s); return s!=null && s!=='' && Number.isInteger(n) && n>=0 && n<=9 ? String((n+1)%10) : ''; };
const slotOrd = s => slotLabel(s)==='' ? 99 : Number(s);
// «По порядку в худе»: внутри команды по слоту игры, слева (CT) 0–4 → подписи 1–5, справа (T) 5–9 → 6–0. Та же формула в server.js (hudSlots).
function cs2HudSlots(players){
  const out={};
  for(const side of ['CT','T']) (players||[]).filter(p=>p.team===side).sort((a,b)=>slotOrd(a.slot)-slotOrd(b.slot)).slice(0,5).forEach((p,i)=>{ out[p.id]=(side==='CT'?0:5)+i; });
  return out;
}
let CS2_NUM = 'game';   // режим нумерации из state.cs2auto.num; виджет и пульт ставят его при каждом новом экране
const CS2_STRIP_DEF = 'Lite, Premium';
let CS2_STRIP = CS2_STRIP_DEF;   // «Убрать из ников» из state.cs2auto.strip, ставится вместе с CS2_NUM
function setCs2Num(a){ CS2_NUM = a?.num==='hud' ? 'hud' : 'game'; CS2_STRIP = typeof a?.strip==='string' ? a.strip : CS2_STRIP_DEF; }
// Ник без приписок вроде Lite/Premium (Cybershoke): слова через запятую, каждое режется как отдельный токен без учёта регистра,
// вместе со скобками и разделителями ([LITE], (Premium), «PREMIUM | ник», «ник-lite»). «Elite» не трогаем. Пусто после чистки — исходный ник.
// strip: undefined = слова по умолчанию, '' = ничего не убирать.
const CS2_NICK_SEP = '[\\s\\[\\](){}|\\-·_.,:]', cs2NickRe = new Map();
function cs2Nick(name, strip){
  const raw = name==null ? '' : String(name);
  if(!raw) return raw;
  const list = String(strip===undefined || strip===null ? CS2_STRIP_DEF : strip);
  let re = cs2NickRe.get(list);
  if(re===undefined){
    const w = list.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    re = w.length ? new RegExp(`[\\[({]\\s*(?:${w.join('|')})\\s*[\\])}]|(^|${CS2_NICK_SEP})(?:${w.join('|')})(?=${CS2_NICK_SEP}|$)`, 'giu') : null;
    if(cs2NickRe.size>50) cs2NickRe.clear();
    cs2NickRe.set(list, re);
  }
  if(!re) return raw;
  const out = raw.replace(re, (m, p1)=>p1 ?? ' ').replace(/\s+/g,' ').replace(/^[\s|\-·_.,:]+|[\s|\-·_.,:]+$/g,'');
  return out || raw;
}
function cs2Renumber(d){
  if(CS2_NUM!=='hud' || !d?.players) return d;
  const hs=cs2HudSlots(d.players), re=p=>p && Object.hasOwn(hs, p.id) ? { ...p, slot:hs[p.id] } : p;
  const out={ ...d, players:d.players.map(re) };
  if(d.observed) out.observed=re(d.observed);
  return out;
}
const money = v => '$'+String(Math.round(v||0)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const STREAK = { 2:'DOUBLE KILL', 3:'TRIPLE KILL', 4:'QUAD KILL', 5:'ACE!' };
// Линейные иконки HUD вместо эмодзи: эмодзи разного размера и сидят на разной высоте.
// Контуры из Lucide (ISC, shared/icons/LICENSE-lucide); каска, C4 и граната HE нарисованы свои в той же сетке 24×24
const HUD_IC = {
  heart:'<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  helmet:'<path d="M4 19c-1-7.5 3-13.5 8.5-13.5 4.7 0 8 3.7 8.5 9.5H9.5l-1.5 4z"/><path d="M21 15h1.5"/>',
  skull:'<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
  bomb:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><rect x="6.5" y="11" width="7" height="4" rx=".5"/><path d="M17 11v1"/><path d="M17 15v1"/><path d="M7 8V5.5a1.5 1.5 0 0 1 1.5-1.5H11"/>',
  kit:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  aim:'<circle cx="12" cy="12" r="7.5"/><path d="M12 2v6.5M12 15.5V22M2 12h6.5M15.5 12H22"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
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
// K/D значками: «прицел 12 · череп 5». c и key — для флип-цифр; без c цифры обычные
function kdNode(c, el, key, k, d, cls){
  const num=(sfx, v)=>c ? fnum(c, el, key+sfx, String(v??0)) : h('b', null, String(v??0));
  const s=h('span', 'kd'+(cls?' '+cls:''));
  s.append(hudIc('aim'), num('k', k), h('span','kd-sep','·'), hudIc('skull'), num('d', d));
  return s;
}
// подпись строки/колонки статистики: K и D значками, остальное текстом
function statLabel(tag, cls, l){ const e=h(tag, cls); if(l==='K') e.appendChild(hudIc('aim')); else if(l==='D') e.appendChild(hudIc('skull')); else e.textContent=l; return e; }
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
// Ники игроков: steamid64 (17 цифр) -> показываемый ник. До 20 записей, ник до 24 символов, без управляющих
function cleanNicks(v){
  const o=Object.create(null); if(!v || typeof v!=='object') return o;
  for(const [k,x] of Object.entries(v)){ if(Object.keys(o).length>=20) break;
    if(!/^\d{17}$/.test(k) || typeof x!=='string') continue;
    const n=x.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,'').trim().slice(0,24); if(n) o[k]=n; }
  return o;
}
// Что видит HUD: ники игроков подменены (исходный ник в gname), названия и логотипы команд едут вместе с командой
// при смене сторон (d.sw пришёл от Host: нечётное = стороны сменили). Ручные названия tnCT/tnT заданы для начальных сторон.
function cs2View(el, d){
  if(!d) return d;
  const nk=el.nicks||{}, has=Object.keys(nk).length>0;
  const flip=d.sw ? 1 : 0, mine=(a,b)=>flip ? b : a;
  const out={ ...cs2Renumber(d), ctName: mine(el.tnCT, el.tnT) || d.ctName, tName: mine(el.tnT, el.tnCT) || d.tName, lgCT: mine(el.lgCT, el.lgT)||'', lgT: mine(el.lgT, el.lgCT)||'' };
  // приписки (Lite, Premium) убираем при показе: в пакетах хранится игровой ник, он же ключ аватарок (gname)
  const cn=n=>typeof n==='string' ? cs2Nick(n, CS2_STRIP) : n;
  const sp=p=>{ if(!p) return p; const n=cn(p.name); return n!==p.name ? { ...p, name:n, gname:p.gname||p.name } : p; };
  if(out.players) out.players=out.players.map(sp);
  if(out.observed) out.observed=sp(out.observed);
  if(typeof d.name==='string' && cn(d.name)!==d.name){ out.gname=d.name; out.name=cn(d.name); }
  if(out.spectating) out.spectating=cn(out.spectating);
  if(out.evs) out.evs=out.evs.map(e=>{ const k=cn(e.killer), v=cn(e.victim), n=cn(e.name); return k!==e.killer || v!==e.victim || n!==e.name ? { ...e, killer:k, victim:v, name:n } : e; });
  if(!has) return out;
  const nm=(id,name)=>(id && Object.hasOwn(nk,id)) ? nk[id] : name;
  const pl=p=>p && Object.hasOwn(nk,p.id) ? { ...p, name:nk[p.id], gname:p.gname||p.name } : p;
  if(out.players) out.players=out.players.map(pl);
  if(out.observed) out.observed=pl(out.observed);
  if(d.id && Object.hasOwn(nk,d.id)){ out.gname=d.name; out.name=nk[d.id]; }
  if(d.spectating && d.observed && Object.hasOwn(nk,d.observed.id)) out.spectating=nk[d.observed.id];
  if(out.evs) out.evs=out.evs.map(e=>(e.kid&&Object.hasOwn(nk,e.kid)) || (e.vid&&Object.hasOwn(nk,e.vid)) || (e.k==='multikill'&&e.id&&Object.hasOwn(nk,e.id))
    ? { ...e, killer: nm(e.kid, e.killer), victim: nm(e.vid, e.victim), name: e.k==='multikill' ? nm(e.id, e.name) : e.name } : e);
  return out;
}
function paintCs2(c, el){
  let d = cs2Fresh() ? cs2View(el, CS2) : null;
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
  if(el.view==='radar'){ paintRadar(c, el, d); return; }
  c.classList.toggle('nodata', !d);
  if(!d){ c.replaceChildren(h('div','c-none',st('🎯 CS2: ждём данные из игры'))); return; }
  // выбранный игрок по нику (в режиме наблюдателя есть все игроки)
  if(el.pick && d.players){ const p=d.players.find(x=>String(x.gname||x.name||'').toLowerCase()===el.pick.toLowerCase()); if(p) d={ ...d, ...p, name:p.name, spectating:null }; }
  const kd = d.d ? (d.k/d.d).toFixed(2) : (d.k||0).toFixed(2);
  const name = el.label || d.name || st('Игрок');
  const hpBar = ()=>{ const b=h('div','c-bar'), f=h('div','c-fill'); f.style.width=Math.max(0,Math.min(100,d.hp||0))+'%'; f.style.background = (d.hp||0)>50 ? '#3ddc84' : (d.hp||0)>20 ? '#ffb020' : '#ff4d5e'; b.appendChild(f); return b; };
  // K/D и ADR — плашки справа, по центру строки цифр (а не по базовой линии мелкого шрифта)
  const chip=(l, v)=>{ const s=h('span','c-kd'); s.append(h('i',null,l), v); return s; };
  const kdaRow = ()=>{ const r=h('div','c-kda'); r.append(kdNode(c, el, 'c', d.k, d.d), fnum(c, el, 'cA', String(d.a??0)), h('i',null,'A'));
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
      const top=h('div','c-top'); top.append(h('span','c-name', `${slotLabel(o.slot)?slotLabel(o.slot)+' · ':''}${o.name||st('Игрок')}`), h('span', o.team==='CT'?'c-ct':'c-t', o.team||''));
      const okd = o.d ? (o.k/o.d).toFixed(2) : (o.k||0).toFixed(2);
      const kr=h('div','c-kda'); kr.append(kdNode(null, el, '', o.k, o.d), h('b',null,String(o.a??0)), h('i',null,'A'));
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
        const list=d.players.filter(p=>p.team===side).sort((a,b)=>slotOrd(a.slot)-slotOrd(b.slot));
        for(const p of list){
          const r=h('div','tm-row'+(p.alive?'':' dead')+(d.obs===p.id?' obs':''));
          const hpw=h('div','tm-hp'), hf=h('div','tm-hpf'); hf.style.width=Math.max(0,Math.min(100,p.hp||0))+'%'; hpw.appendChild(hf);
          const nm=h('div','tm-name'); nm.append(h('span','tm-slot', slotLabel(p.slot)), document.createTextNode(p.name||'?'));
          // колонки фиксированной ширины: у всех строк цифры и иконки стоят друг под другом
          const ic=h('span','tm-ic'); if(p.alive){ if(p.bomb) ic.appendChild(hudIc('bomb','hi-c4')); if(p.kit) ic.appendChild(hudIc('kit')); if(armorIc(p)) ic.appendChild(hudIc(armorIc(p))); }
          const hpn=h('span','tm-hpn'); if(p.alive) hpn.textContent=String(p.hp); else hpn.appendChild(hudIc('skull'));
          const info=h('div','tm-info'); info.append(hpn, ic, h('span','tm-money', money(p.money)), kdNode(null, el, '', p.k, p.d, 'tm-kd'), h('span','tm-w', weaponShort(p.main||p.weapon)));
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
      parts.push(r, h('div','c-map sb-map', [mapName(d.map), seriesLabel()].filter(Boolean).join(' · '))); break;
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
function weaponShort(w){ const id=String(w||'').replace(/^weapon_/,''); return Object.hasOwn(WSHORT, id) ? WSHORT[id] : weaponName(w); }
function avatar(el, p, cls){
  const box=h('div', cls||'hd-av'), avk=String(p?.gname||p?.name||'').toLowerCase(), src=el.av && Object.hasOwn(el.av, avk) ? el.av[avk] : null;
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
  const nm=h('div','hd-name'); if(slotLabel(p.slot)) nm.appendChild(h('span','hd-slot', slotLabel(p.slot))); nm.append(p.name||'?');
  card.append(bar, nm);
  const key=p.id||p.name, row=h('div','hd-row'); row.append(kdNode(c, el, key, p.k, p.d), fnum(c, el, key+'$', money(p.money), 'hd-money'));
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
  stats.append(kdNode(c, el, 'big', p.k, p.d));
  // подпись и число — одним куском: в узкой карточке строка переносится целыми парами, а не налезает на правую колонку
  for(const [l,v] of [['A',p.a??0],['ADR',p.adr??0],['HS',(p.hsp??0)+'%']]){ const g=h('span','hd-bst'); g.append(h('i',null,l), fnum(c, el, 'big'+l, String(v))); stats.append(g); }
  mid.appendChild(stats);
  const right=h('div','hd-bright');
  right.append(gearIcons(p, 'hd-ic'), h('div','hd-w', p.weapon ? `${weaponName(p.weapon)}${p.ammoMax>0?` ${p.ammo}/${p.reserve}`:''}` : ''));
  card.append(mid, fnum(c, el, 'big$', money(p.money), 'hd-money'), right);
  hpDrop(c, p, card);
  return card;
}
function scoreTop(el, d, withSeries){
  const top=h('div','hd-score');
  const team=(side)=>{ const b=h('div','hd-team tm-'+side); const lg=side==='ct'?d.lgCT:d.lgT;
    if(lg){ const i=document.createElement('img'); i.src=resolveSrc(lg); i.alt=''; b.appendChild(i); }
    b.appendChild(h('span','hd-tname', (side==='ct'?d.ctName:d.tName) || (side==='ct'?'CT':'T'))); return b; };
  const mid=h('div','hd-mid');
  const tm=timerNode('hd-time'+(d.pphase==='bomb'?' bomb':''), !!el.flip);
  mid.append(h('div','hd-rnd', `${st('Раунд')} ${(d.round??0)+1}`), tm);
  top.append(team('ct'), fnum(scoreTop.c, el, 'sct', String(d.ct??0), 'hd-n tm-ct'), mid, fnum(scoreTop.c, el, 'stt', String(d.tt??0), 'hd-n tm-t'), team('t'));
  const wrap=h('div','hd-top'); wrap.appendChild(top);
  const ser=withSeries ? [seriesLabel(), el.series].filter(Boolean).join(' · ') : '';
  if(ser) wrap.appendChild(h('div','hd-series', ser));
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
    r.append(L, statLabel('span','hd-cl-l', l), bar, R); box.appendChild(r);
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
  const sig=JSON.stringify([el, CS2_STRIP, seriesLabel(), d && [d.players, d.observed, d.ct, d.tt, d.ctName, d.tName, d.sw, d.name, d.round, d.pphase, d.hp, d.armor, d.money, d.k, d.d, d.a, d.adr, d.weapon, d.ammo, d.alive, d.team], feed, el.view==='duel' && (d?.evs||[]).slice(-1)[0]?.s, now0<(c._duntil||0)]);
  if(c._sig===sig) return; c._sig=sig;
  if(!d){ c.replaceChildren(h('div','hd-wait', st('🎯 CS2: ждём данные из игры'))); return; }
  const players=d.players||[], byName=n=>players.find(x=>{ const q=String(n||'').toLowerCase(); return String(x.name||'').toLowerCase()===q || String(x.gname||'').toLowerCase()===q; });
  const me={ ...d, id:d.id||'me', team:d.team };
  const parts=[];
  if(el.view==='hud_solo'){
    parts.push(scoreTop(el, d, false)); if(el.kfeed) parts.push(killfeed(d, el));
    const b=h('div','hd-bottom solo'); b.appendChild(bigCard(c, el, me)); parts.push(b);
  } else if(el.view==='hud_tour'){
    if(!players.length){ c.replaceChildren(h('div','hd-wait', st('👁 Панели команд работают, когда стример смотрит матч зрителем (GOTV / наблюдатель)'))); return; }
    parts.push(scoreTop(el, d, true)); if(el.kfeed) parts.push(killfeed(d, el));
    const bot=h('div','hd-bottom');
    const col=side=>{ const g=h('div','hd-side tm-'+side.toLowerCase()); for(const p of players.filter(x=>x.team===side).sort((a,b)=>slotOrd(a.slot)-slotOrd(b.slot)).slice(0,5)) g.appendChild(playerCard(c, el, p, d.obs===p.id)); return g; };
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
      const head=h('div','hd-tr hd-th'); for(const x of ['', st('Игрок'), 'K','D','A','+/−','ADR','HS%','MVP','$']) head.appendChild(statLabel('span', null, x)); sec.appendChild(head);
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
// ---------- CS2: серия карт, авто-таб, радар ----------
// Серия приходит от программы стримера отдельной темой cs2series: { bo, a:{name,w}, b:{name,w}, maps, ctIs:'a'|'b', map, go }
let CS2_SERIES = null;
function cleanSeriesView(v){
  if(!v || typeof v!=='object') return null;
  const tm = x => ({ name:str(x?.name, 40), w:Math.round(num(x?.w, 0, 0, 9)) });
  const maps = (Array.isArray(v.maps) ? v.maps : []).slice(0, 7).map(m => ({ map:str(m?.map, 40).replace(/[^a-z0-9_]/gi, ''),
    a:{ name:str(m?.a?.name, 40), score:Math.round(num(m?.a?.score, 0, 0, 99)) }, b:{ name:str(m?.b?.name, 40), score:Math.round(num(m?.b?.score, 0, 0, 99)) }, win:m?.win==='a' || m?.win==='b' ? m.win : '' }));
  return { bo:[1,3,5].includes(v.bo) ? v.bo : 3, a:tm(v.a), b:tm(v.b), maps, ctIs:v.ctIs==='a' || v.ctIs==='b' ? v.ctIs : null, map:str(v.map, 40), go:num(v.go, 0, 0, 1e15) };
}
// победы по сторонам сейчас: слева CT, справа T, как в счёте
function seriesSides(){
  const s=CS2_SERIES; if(!s) return null;
  const flip = s.ctIs==='b';
  return { ct:(flip ? s.b : s.a).w, t:(flip ? s.a : s.b).w, bo:s.bo, n:s.maps.length };
}
function seriesLabel(){ const x=seriesSides(); if(!x || (x.bo===1 && !x.n)) return ''; return `${st('Серия')} ${x.ct} : ${x.t} · BO${x.bo}`; }

// Авто-таб: таблица всех игроков сама выезжает на таймауте/паузе, смене сторон и в конце карты (15 с), потом уезжает.
// state.cs2auto = { on, timeout, half, end, theme:'A'..'D', hideBottom, hideTop, num:'game'|'hud', strip:'Lite, Premium' }. Красится под тему CS2-элемента экрана.
const CS2TAB_STYLES = ['A','B','C','D'], CS2TAB_END_MS = 15000;
function cleanCs2Auto(a){
  a = a && typeof a==='object' ? a : {};
  return { on:a.on===true, timeout:a.timeout!==false, half:a.half!==false, end:a.end!==false,
    theme:CS2TAB_STYLES.includes(a.theme) ? a.theme : 'A', hideBottom:a.hideBottom!==false, hideTop:a.hideTop!==false,
    num:a.num==='hud' ? 'hud' : 'game',
    strip:typeof a.strip==='string' ? a.strip.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,200) : CS2_STRIP_DEF };
}
// Какой момент сейчас: 'timeout' | 'half' | 'end' | null. mem помнит, когда этот пульт или виджет впервые увидел конец карты;
// время конца от программы (серия, go) важнее: перезагруженный виджет не покажет итог второй раз.
function cs2TabMoment(d, a, mem, now){
  if(!a?.on || !d) return null;
  if(d.phase==='gameover'){
    if(!a.end) return null;
    const key=(d.map||'')+'|'+d.ct+':'+d.tt;
    if(mem.endKey!==key){ mem.endKey=key; mem.endAt=now; }
    const go = CS2_SERIES?.go && CS2_SERIES.map===d.map ? CS2_SERIES.go + (d._skew||0) : mem.endAt;
    return now - go < CS2TAB_END_MS ? 'end' : null;
  }
  if(d.phase==='intermission') return a.half ? 'half' : null;
  if(['timeout_ct','timeout_t','paused'].includes(d.pphase)) return a.timeout ? 'timeout' : null;
  return null;
}
// MVP карты: больше всех MVP раундов, потом киллы, потом ADR
function cs2Mvp(players){
  let best=null;
  for(const p of players||[]){ const k=[p.mvps||0, p.k||0, p.adr||0]; if(!best || k[0]>best.k[0] || (k[0]===best.k[0] && (k[1]>best.k[1] || (k[1]===best.k[1] && k[2]>best.k[2])))) best={ p, k }; }
  return best && (best.k[0] || best.k[1]) ? best.p : null;
}
// Тема и цвета берём у CS2-элемента экрана (сначала HUD на весь экран); без элемента — «стекло»
function cs2TabLook(els){
  const all=(els||[]).filter(e=>e.type==='cs2'), list=all.filter(e=>!e.hidden);
  const el=list.find(e=>CS2_FULL.has(e.view)) || list[0] || all[0];
  return { theme:el?.theme || 'glass', ctc:el?.ctc || '#5d9cec', tc:el?.tc || '#e0a030', font:el?.font || '', el:el||null };
}
// Пример данных для превью в пульте и кнопки «Показать сейчас» без игры
const CS2_DEMO = (() => {
  const P=(slot, name, team, k, d, adr, hsp, money, w, mvps)=>({ id:'d'+slot, slot, name, team, k, d, a:3, adr, hsp, money, weapon:w, main:w, mvps, alive:true, hp:100 });
  return { demo:true, map:'de_mirage', phase:'live', round:16, ct:9, tt:7, ctName:'', tName:'', pphase:'timeout_ct',
    players:[P(1,'SaiYeah1','CT',17,9,92,64,4750,'weapon_ak47',4), P(2,'gospoja','CT',14,11,78,50,5200,'weapon_m4a1_silencer',2), P(3,'runorn','CT',11,12,71,41,3100,'weapon_awp',1),
      P(4,'pelmech','CT',9,13,64,33,1800,'weapon_famas',0), P(5,'etsuitoku','CT',8,14,58,25,2450,'weapon_mp9',1), P(6,'kirpich','T',16,10,88,57,4100,'weapon_ak47',3),
      P(7,'mamka','T',13,13,76,46,3900,'weapon_galilar',2), P(8,'lesnik','T',10,14,66,40,2200,'weapon_ak47',1), P(9,'zhuk','T',8,15,61,22,900,'weapon_mac10',0), P(0,'tapok','T',6,16,49,17,1500,'weapon_deagle',0)] };
})();
function cs2DemoFor(m){
  const d={ ...CS2_DEMO, pend:Date.now()+24000, t:Date.now() };
  if(m==='half'){ d.phase='intermission'; d.pphase='freezetime'; d.ct=8; d.tt=4; }
  if(m==='end'){ d.phase='gameover'; d.pphase='over'; d.ct=13; d.tt=9; }
  return d;
}
function cs2TabTitle(d, m, look){
  const ctN=d.ctName || st('Спецназ'), tN=d.tName || st('Террористы'), map=mapName(d.map);   // d уже прошёл cs2View: названия по сторонам после смены
  if(m==='timeout'){
    if(d.pphase==='paused') return [st('ПАУЗА'), [map, `${st('Раунд')} ${(d.round??0)+1}`].filter(Boolean).join(' · '), false];
    return [st('ТАЙМАУТ'), `${st('Тактический перерыв')} · ${d.pphase==='timeout_t' ? tN : ctN} · ${st('осталось')} `, true];
  }
  if(m==='half') return [st('СМЕНА СТОРОН'), `${d.ct??0} : ${d.tt??0}${map?' · '+map:''}`, false];
  const ct=d.ct??0, tt=d.tt??0;
  const sub = ct===tt ? `${st('Ничья')} ${ct} : ${tt}` : `${st('Победа')} ${ct>tt?ctN:tN} ${Math.max(ct,tt)} : ${Math.min(ct,tt)}`;
  return [`${st('ИТОГ КАРТЫ')}${map?' · '+map:''}`, sub, false];
}
function cs2TabRow(p, mvp){
  const r=h('div','pl'+(p.alive===false?' dead':'')+(mvp?' mvp':''));
  const nm=h('span','nm', p.name||'?'); if(mvp) nm.append(h('i','star',' ★ MVP'));
  r.append(h('span','sl', slotLabel(p.slot)), nm, kdNode(null, null, '', p.k, p.d, 'num kdn'),
    h('span','num', String(p.adr??0)), h('span','num', (p.hsp??0)+'%'), h('span','wpn', weaponShort(p.main||p.weapon)), h('span','num money', money(p.money)));
  return r;
}
function cs2TabHead(){
  const r=h('div','pl ph'); r.append(h('span','sl'), h('span','nm'), h('span','num','K · D'), h('span','num','ADR'), h('span','num','HS'), h('span','wpn'), h('span','num','$')); return r;
}
function cs2TabCard(p, mvp){
  const c=h('div','pc'+(p.alive===false?' dead':'')+(mvp?' mvp':''));
  c.append(h('div','nm', `${slotLabel(p.slot)?slotLabel(p.slot)+' · ':''}${p.name||'?'}${mvp?' ★':''}`));
  const s=h('div','st'); s.append(kdNode(null, null, '', p.k, p.d), h('span',null,'ADR '+(p.adr??0)), h('span',null,'HS '+(p.hsp??0)+'%')); c.appendChild(s);
  c.appendChild(h('div','mo', `${weaponShort(p.main||p.weapon)} · ${money(p.money)}`));
  return c;
}
// Собирает таб заново (имена и цифры игры — только через textContent)
function cs2TabBuild(box, d, a, m, look){
  const [title, sub, timer]=cs2TabTitle(d, m, look), end=m==='end';
  const list=d.players?.length ? d.players : (d.name ? [{ ...d, id:d.id||'me', slot:null }] : []);
  const key=slotOrd;
  const side=t=>list.filter(p=>p.team===t).sort((x,y)=>key(x)-key(y)).slice(0,5);
  const CT=side('CT'), TT=side('T'), mvp=end ? cs2Mvp(list) : null;
  const ctN=d.ctName || st('Спецназ'), tN=d.tName || st('Террористы'), ser=seriesLabel();
  const subNode=()=>{ const s=h('div','sub', sub); if(timer) s.appendChild(h('span','ctime', cs2Timer())); return s; };
  const rows=ps=>ps.map(p=>cs2TabRow(p, mvp===p));
  const parts=[];
  if(a.theme==='A'){
    const col=(cls, name, score, ps)=>{ const c=h('div','col '+cls), hd=h('h4'); hd.append(h('span',null,name), h('b',null,String(score??0))); c.append(hd, cs2TabHead(), ...rows(ps)); return c; };
    parts.push(h('div','tt', title), subNode(), col('l', ctN, d.ct, CT), col('r', tN, d.tt, TT));
    if(ser) parts.push(h('div','ser', ser));
  } else if(a.theme==='B'){
    const card=h('div','card'), head=h('div','head'), big=h('div','big');
    const flip=v=>{ const b=h('b'); b.appendChild(h('i', null, String(v??0))); return b; };
    big.append(flip(d.ct), h('span','colon',':'), flip(d.tt)); head.append(h('div','tt', title), big);
    const two=h('div','two'), half=(cls, name, ps)=>{ const x=h('div', cls); x.append(h('h4',null,name), cs2TabHead(), ...rows(ps)); return x; };
    two.append(half('l', ctN, CT), half('r', tN, TT));
    const foot=mvp ? h('div','sub', `★ MVP: ${mvp.name} · ${mvp.k??0} ${st('убийств')} · ADR ${mvp.adr??0}`) : subNode(); foot.classList.add('mvpbox');
    card.append(head, two, foot); if(ser) card.appendChild(h('div','ser', ser)); parts.push(card);
  } else if(a.theme==='C'){
    const bar=h('div','topbar'); bar.append(h('span',null,title), h('span','tsc', `${d.ct??0} : ${d.tt??0}`)); if(ser) bar.append(h('span','tser', ser)); parts.push(bar);
    parts.push(subNode());
    CT.forEach((p,i)=>{ const s=h('div','stripe'); s.style.top=(11.5+i*7)+'cqw'; s.style.setProperty('--i', i); s.appendChild(cs2TabRow(p, mvp===p)); parts.push(s); });
    TT.forEach((p,i)=>{ const s=h('div','stripe t'); s.style.top=(11.5+i*7)+'cqw'; s.style.setProperty('--i', i); s.appendChild(cs2TabRow(p, mvp===p)); parts.push(s); });
  } else {
    const mid=h('div','mid'); mid.append(h('div','tt', `${title} · ${d.ct??0} : ${d.tt??0}`)); const sb=subNode(); if(ser) sb.append(' · '+ser); mid.appendChild(sb);
    const r1=h('div','rowc ct'), r2=h('div','rowc tr');
    r1.append(...CT.map(p=>cs2TabCard(p, mvp===p))); r2.append(...TT.map(p=>cs2TabCard(p, mvp===p)));
    parts.push(r1, mid, r2);
  }
  box.replaceChildren(...parts);
}
// Показывает, обновляет и убирает таб. o = { d, a, m, look }; без m — уехать. → показан ли таб
function cs2TabRender(box, o){
  const m=o?.m || null;
  if(!m){
    if(box._on){ box._on=false; box._sig=null; box.classList.remove('still','show'); clearTimeout(box._hT);
      box._hT=setTimeout(()=>{ if(!box._on){ box.replaceChildren(); box.hidden=true; } }, 1300); }
    return false;
  }
  const { a, look }=o, d=cs2View(look.el || {}, o.d);   // названия команд после смены сторон и ники игроков, как на карточках
  box.dataset.st=a.theme; box.dataset.th=look.theme; box.dataset.m=m;
  box.style.setProperty('--ct', look.ctc); box.style.setProperty('--t', look.tc);
  box.style.fontFamily = look.font ? fontCss(look.font) : '';
  const list=d.players||[];
  const sig=JSON.stringify([m, CS2_STRIP, a.theme, look.theme, look.ctc, look.tc, look.font, seriesLabel(), d.ct, d.tt, d.map, d.pphase, d.ctName, d.tName,
    list.map(p=>[p.id,p.name,p.slot,p.team,p.k,p.d,p.adr,p.hsp,p.money,p.main||p.weapon,p.alive,p.mvps]), list.length ? null : [d.name,d.k,d.d,d.money]]);
  if(!box._on){
    box._on=true; clearTimeout(box._hT); box.hidden=false; box.classList.remove('show','still');
    cs2TabBuild(box, d, a, m, look); box._sig=sig; void box.offsetWidth;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(box._on) box.classList.add('show'); }));
    clearTimeout(box._sT); box._sT=setTimeout(()=>{ if(box._on) box.classList.add('still'); }, 1700);
  } else if(sig!==box._sig && box.classList.contains('still')){ box._sig=sig; cs2TabBuild(box, d, a, m, look); }
  const t=box.querySelector('.ctime'); if(t){ const v=cs2Timer(); if(t.textContent!==v) t.textContent=v; }
  return true;
}

// Радар: точки игроков на карте сверху. Подложка Hudini в теме элемента (shared/radar), без неё сетка.
// Без калибровки карты границы подбираются по тому, где побывали игроки.
function radarProject(r, map, pts){
  const cal=typeof CS2_MAPS!=='undefined' && Object.hasOwn(CS2_MAPS, map) ? CS2_MAPS[map] : null;
  if(cal) return p=>cs2MapUV(map, p);
  if(r.bmap!==map){ r.bmap=map; r.b=null; }
  for(const p of pts){ if(!p) continue; const b=r.b ||= { x0:p[0], x1:p[0], y0:p[1], y1:p[1] };
    b.x0=Math.min(b.x0,p[0]); b.x1=Math.max(b.x1,p[0]); b.y0=Math.min(b.y0,p[1]); b.y1=Math.max(b.y1,p[1]); }
  const b=r.b; if(!b) return ()=>null;
  const span=Math.max(800, b.x1-b.x0, b.y1-b.y0)*1.2, cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2;
  return p=>[(p[0]-cx)/span+0.5, (cy-p[1])/span+0.5];
}
// размер карточки радара в em: длинная сторона RADAR_SIDE, пропорции — по рамке содержимого подложки карты
const RADAR_SIDE = 10.5;
function radarDims(map){
  const b=typeof cs2MapBox==='function' ? cs2MapBox(map) : [0,0,1,1], bw=b[2]-b[0], bh=b[3]-b[1], k=RADAR_SIDE/Math.max(bw, bh);
  return { w:bw*k, h:bh*k, b };
}
// ---- гранаты на радаре ----
// Хост присылает d.gr: [{ i, t:'molly'|'he'|'flash'|'smoke', tm:'CT'|'T'|'', p:[x,y,z], v:[vx,vy], s:0 летит|1 лежит|2 действует, e?, f?:[[x,y]…] }].
// История позиций (след) и время начала эффекта хранятся здесь, в карточке; пакеты с гранатами идут до 10 раз в секунду.
const GR_TRAIL = 8, GR_SMOKE_R = 144, GR_FIRE_R = 120, GR_FLAME_R = 55, GR_SMOKE_T = 18, GR_FIRE_T = 7;
const GR_BURST = { he:{ r:140, ms:650 }, flash:{ r:90, ms:450 } };
const grOn = (el, t) => el.rgr!==false && el[{ molly:'rgm', he:'rgh', flash:'rgf', smoke:'rgs' }[t]]!==false;
// нужные радару гранаты: только включённые типы, не больше 40, с числами нужной формы (данные пришли из сети)
function grList(el, d){
  const out=[]; if(!Array.isArray(d?.gr)) return out;
  for(const g of d.gr.slice(0,40)){
    if(!g || typeof g!=='object' || !['molly','he','flash','smoke'].includes(g.t) || !grOn(el, g.t)) continue;
    if(!Array.isArray(g.p) || g.p.length<2 || !g.p.every(Number.isFinite) || !/^[0-9A-Za-z_-]{1,12}$/.test(String(g.i))) continue;
    out.push({ i:String(g.i), t:g.t, tm:g.tm==='T'?'T':g.tm==='CT'?'CT':'', p:g.p.slice(0,3), s:g.s===2?2:g.s===1?1:0, e:Number.isFinite(g.e) ? Math.min(120, Math.max(0, g.e)) : 0,   // e: сколько секунд эффект уже идёт (effecttime)
      f:Array.isArray(g.f) ? g.f.slice(0,60).filter(f=>Array.isArray(f) && Number.isFinite(f[0]) && Number.isFinite(f[1])) : [] });
  }
  return out;
}
// Размеры и прозрачность зоны по времени от начала эффекта (сек): дым сжимается в конце, огонь гаснет
function grZoneLook(t, age){
  if(t==='smoke'){ const left=GR_SMOKE_T-age; return { scale: left<1.5 ? Math.max(0.15, left/1.5) : Math.min(1, 0.4+age*1.5), op: left<1.5 ? Math.max(0.1, left/1.5) : 1 }; }
  const left=GR_FIRE_T-age; return { scale:1, op: left<2 ? Math.max(0.15, left/2) : 1 };
}
function paintGrenades(r, el, d, uv, map, lower, place, seen){
  const now=Date.now(), list=grList(el, d), B=el.grenStyle==='B', gh=r.gh ||= new Map();
  r.box.classList.toggle('gs-b', B);
  const k=(()=>{ const a=uv([0,0]), b=uv([1000,0]); return a&&b ? Math.hypot(b[0]-a[0], b[1]-a[1])/1000 : 0; })();
  const ids=new Set(), pt=[];
  for(const g of list){
    const q=uv(g.p); if(!q) continue;
    ids.add(g.i);
    let hs=gh.get(g.i); if(!hs){ hs={ trail:[], eff0:0 }; gh.set(g.i, hs); }
    hs.t=g.t; hs.tm=g.tm; hs.p=g.p; hs.s=g.s; hs.at=now;
    const last=hs.trail[hs.trail.length-1];
    if(!last || last[0]!==q[0] || last[1]!==q[1]){ hs.trail.push(q); if(hs.trail.length>GR_TRAIL) hs.trail.shift(); }
    if(g.s===2 && !hs.eff0) hs.eff0=now-g.e*1000;   // после перезагрузки виджета отсчёт идёт с настоящего начала эффекта
    const other=typeof cs2Lower==='function' && cs2Lower(map, g.p)!==lower, tcls='tm-'+(g.tm==='T'?'t':'ct');
    // зона действия
    if(g.s===2 && k && (g.t==='smoke' || g.t==='molly')){
      const lk=grZoneLook(g.t, (now-hs.eff0)/1000);
      const spots=g.t==='molly' && g.f.length ? g.f.map(f=>[f[0], f[1], GR_FLAME_R]) : [[g.p[0], g.p[1], g.t==='smoke' ? GR_SMOKE_R : GR_FIRE_R]];
      spots.forEach((sp, j)=>{
        const key='z'+g.i+'.'+j; seen.add(key); let n=r.map.get(key);
        if(!n){ n=h('div','rd-zone'); r.dots.appendChild(n); r.map.set(key, n); }
        n.className='rd-zone '+(g.t==='smoke'?'smoke':'fire')+' '+tcls+(other?' other':'');
        n.style.width=n.style.height=(sp[2]*2*k*100*lk.scale).toFixed(2)+'%'; n.style.opacity=lk.op.toFixed(2);
        n.hidden=!place(n, [sp[0], sp[1], 0]);
      });
    }
    // значок
    const key='g'+g.i; seen.add(key); let n=r.map.get(key);
    if(!n){ n=h('div','rd-gr'); n.append(hudIc(g.t==='molly'?'molly':g.t), h('i')); r.dots.appendChild(n); r.map.set(key, n); }
    n.className='rd-gr gt-'+g.t+' '+tcls+(g.s===0?' fly':g.s===1?' land':' eff')+(other?' other':'');
    n.hidden=!place(n, g.p);
    if(!B && g.s!==2 && hs.trail.length>1) pt.push([hs.trail, tcls, other]);
  }
  // гранаты, которых больше нет: HE и флешка взорвались на месте последней позиции
  for(const [id,hs] of gh) if(!ids.has(id)){
    gh.delete(id);
    const bu=GR_BURST[hs.t];
    if(bu && hs.s!==2 && k && now-hs.at<1500){
      const n=h('div','rd-burst '+hs.t+' tm-'+(hs.tm==='T'?'t':'ct')); n.style.width=n.style.height=(bu.r*2*k*100).toFixed(2)+'%'; n.style.animationDuration=bu.ms+'ms';
      if(place(n, hs.p)){ r.dots.appendChild(n); setTimeout(()=>n.remove(), bu.ms+80); }
    }
  }
  // следы: одна ломаная на гранату, старая часть бледнее
  const sv=r.tr; sv.replaceChildren();
  for(const [tr, tcls, other] of pt){
    const mk=(a, cls)=>{ const l=document.createElementNS('http://www.w3.org/2000/svg','polyline'); l.setAttribute('points', a.map(q=>(Math.min(1,Math.max(0,q[0]))*100).toFixed(2)+','+(Math.min(1,Math.max(0,q[1]))*100).toFixed(2)).join(' ')); l.setAttribute('class','rd-trail '+cls+' '+tcls+(other?' other':'')); sv.appendChild(l); };
    mk(tr, 'old'); if(tr.length>3) mk(tr.slice(-3), 'new');
  }
}
function paintRadar(c, el, d){
  let r=c._rd;
  if(!r || r.box.parentNode!==c){
    r=c._rd={ box:h('div','rd'), img:document.createElement('img'), dots:h('div','rd-dots'), cap:h('div','rd-cap'), map:new Map(), src:null };
    r.img.className='rd-img'; r.img.alt=''; r.img.draggable=false; r.img.hidden=true;
    r.img.onload=()=>{ r.img.hidden=false; r.box.classList.add('has-img'); }; r.img.onerror=()=>{ r.img.hidden=true; r.box.classList.remove('has-img'); };
    r.sq=h('div','rd-sq'); r.tr=document.createElementNS('http://www.w3.org/2000/svg','svg'); r.tr.setAttribute('class','rd-tr'); r.tr.setAttribute('viewBox','0 0 100 100'); r.tr.setAttribute('preserveAspectRatio','none'); r.tr.setAttribute('aria-hidden','true');
    r.sq.append(r.img, r.tr, r.dots);   // слой во всю подложку: рамка .rd лишь вырезает из него нужную часть
    r.box.append(h('div','rd-grid'), r.sq, r.cap); c.replaceChildren(r.box);
  }
  c.classList.toggle('nodata', !d);
  if(!d){ r.cap.textContent=st('🎯 CS2: ждём данные из игры'); r.dots.replaceChildren(); r.map.clear(); r.gh?.clear(); r.tr.replaceChildren(); return; }
  const map=String(d.map||''), players=(d.players||[]).filter(p=>Array.isArray(p.pos));
  const obs=players.find(p=>p.id===d.obs), lower=typeof cs2Lower==='function' && obs ? cs2Lower(map, obs.pos) : false;
  c.dataset.rbg=el.rbg===false ? '0' : '1'; r.box.classList.toggle('nomap', el.rmap===false);
  const dim=radarDims(map), bs=r.box.style;
  bs.setProperty('--ds', (0.6*(el.rds||1)).toFixed(3)+'em');
  bs.setProperty('--rw', dim.w.toFixed(3)); bs.setProperty('--rh', dim.h.toFixed(3));
  bs.setProperty('--bw', (dim.b[2]-dim.b[0]).toFixed(4)); bs.setProperty('--bh', (dim.b[3]-dim.b[1]).toFixed(4));
  bs.setProperty('--bu', dim.b[0].toFixed(4)); bs.setProperty('--bv', dim.b[1].toFixed(4));
  const src=typeof cs2RadarImg==='function' ? cs2RadarImg(map, el.theme, lower) : '';
  if(r.src!==src){ r.src=src; r.box.classList.remove('has-img'); r.img.hidden=true; if(src) r.img.src=src; else r.img.removeAttribute('src'); }
  r.box.classList.toggle('lower', lower);
  r.cap.textContent=players.length ? mapName(map) : st('👁 Радар работает, когда стример смотрит матч зрителем (GOTV / наблюдатель)');
  const uv=radarProject(r, map, [...players.map(p=>p.pos), d.bpos]);
  const seen=new Set(), place=(n, p)=>{ const q=uv(p); if(!q) return false; n.style.left=(Math.min(1,Math.max(0,q[0]))*100).toFixed(2)+'%'; n.style.top=(Math.min(1,Math.max(0,q[1]))*100).toFixed(2)+'%'; return true; };
  for(const p of players){
    const key='p'+p.id; seen.add(key);
    let n=r.map.get(key);
    if(!n){ n=h('div','rd-dot'); n.append(h('i','rd-dir'), h('b')); r.dots.appendChild(n); r.map.set(key, n); }
    n.className='rd-dot tm-'+(p.team==='T'?'t':'ct')+(p.alive===false?' dead':'')+(p.id===d.obs?' obs':'')+(p.bomb?' c4':'')
      +(typeof cs2Lower==='function' && cs2Lower(map, p.pos)!==lower ? ' other' : '');
    n.lastChild.textContent=p.alive===false ? '✕' : slotLabel(p.slot);
    n.title=(p.slot!=null ? slotLabel(p.slot)+' · ' : '')+(p.name||'');   // ник из cs2View (с подменой)
    if(p.fw!=null) n.style.setProperty('--a', (-p.fw)+'deg');
    n.firstChild.hidden=p.fw==null || p.alive===false;
    n.hidden=!place(n, p.pos);
  }
  // бомба: заложена или лежит на земле (у игрока её показывает значок на точке)
  if(d.bpos && ['planted','dropped','defusing','defused','exploded'].includes(d.bomb)){
    seen.add('bomb'); let n=r.map.get('bomb');
    if(!n){ n=h('div','rd-bomb'); n.appendChild(hudIc('bomb')); r.dots.appendChild(n); r.map.set('bomb', n); }
    n.classList.toggle('planted', d.bomb==='planted' || d.bomb==='defusing'); n.hidden=!place(n, d.bpos);
  }
  paintGrenades(r, el, d, uv, map, lower, place, seen);
  for(const [k,n] of r.map) if(!seen.has(k)){ n.remove(); r.map.delete(k); }
}
// ---------- сообщение из чата ----------
const BADGE = { mod:'🛡', vip:'💎', sub:'⭐', broadcaster:'🎥' };
// тело сообщения: текст, эмоуты Twitch ([id,с,по]) и смайлы 7TV/BTTV/FFZ ([провайдер,id,с,по]) картинками
function msgBody(text, emotes, xe){
  const body=h('div','m-text');
  const cp=Array.from(text);                       // Twitch считает позиции эмоутов по символам
  const em=[...(emotes||[]).map(([id,a,b])=>['tw',id,a,b]), ...(xe||[])].sort((x,y)=>x[2]-y[2]); let i=0;
  for(const [p,id,a,b] of em){
    const url=emoteUrl(p, String(id));
    if(!url || a<i || a>=cp.length || b<a) continue;
    if(a>i) body.append(document.createTextNode(cp.slice(i,a).join('')));
    const img=document.createElement('img'); img.className='m-emote'; img.alt=cp.slice(a,b+1).join(''); img.draggable=false;
    img.referrerPolicy='no-referrer'; img.src=url;
    body.append(img); i=b+1;
  }
  if(i<cp.length) body.append(document.createTextNode(cp.slice(i).join('')));
  return body;
}
function paintMsg(c, el){
  const head=h('div','m-head');
  if(el.badge) head.append(h('span','m-badge', BADGE[el.badge]));
  const nm=h('span','m-user', el.user||st('Зритель')); nm.style.color=el.ucolor; head.append(nm);
  c.replaceChildren(head, msgBody(el.text, el.emotes, el.xe));
}

// ---------- смайлы 7TV, BetterTTV, FrankerFaceZ ----------
// Наборы грузятся с серверов провайдеров (глобальные и канала), только если провайдер включён в комнате.
// Кэш 30 минут, ошибки молча: без набора слово остаётся текстом.
const EMX_PROV = ['stv','bttv','ffz'];
const EMX_ID = { tw:/^[A-Za-z0-9_]{1,60}$/, stv:/^[0-9A-Za-z]{10,40}$/, bttv:/^[0-9a-f]{24}$/, ffz:/^[0-9]{1,10}$/ };
const RID_RE = /^[0-9]{1,20}$/;
function emoteUrl(p, id){
  if(!Object.hasOwn(EMX_ID, p) || !EMX_ID[p].test(id)) return '';
  return p==='stv' ? `https://cdn.7tv.app/emote/${id}/2x.webp` : p==='bttv' ? `https://cdn.betterttv.net/emote/${id}/2x`
    : p==='ffz' ? `https://cdn.frankerfacez.com/emote/${id}/2` : `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
}
function cleanEmx(x){ return { stv:x?.stv===true, bttv:x?.bttv===true, ffz:x?.ffz===true }; }
const ThirdEmotes = {
  on:{ stv:false, bttv:false, ffz:false },
  sets:new Map(),       // 'stv:g' (глобальный) или 'stv:<id канала>' → { at, busy, map: Map(имя → id) | null }
  rids:new Set(),       // каналы, которые читаем
  TTL:30*60*1000, RETRY:5*60*1000, MAX:5000, BYTES:8e6,
  onReady:()=>{},       // набор загрузился: страница может перерисовать ленту
  API:{
    stv:{ g:'https://7tv.io/v3/emote-sets/global', c:id=>`https://7tv.io/v3/users/twitch/${id}`,
      list:(j, g)=>(g ? j?.emotes : j?.emote_set?.emotes) || [], name:'name' },
    bttv:{ g:'https://api.betterttv.net/3/cached/emotes/global', c:id=>`https://api.betterttv.net/3/cached/users/twitch/${id}`,
      list:(j, g)=>g ? j : [...(Array.isArray(j?.channelEmotes) ? j.channelEmotes : []), ...(Array.isArray(j?.sharedEmotes) ? j.sharedEmotes : [])], name:'code' },
    ffz:{ g:'https://api.frankerfacez.com/v1/set/global', c:id=>`https://api.frankerfacez.com/v1/room/id/${id}`,
      list:(j, g)=>{ const ids = g ? j?.default_sets : [j?.room?.set]; return (Array.isArray(ids) ? ids : []).flatMap(n => { const e = j?.sets?.[String(n)]?.emoticons; return Array.isArray(e) ? e : []; }); }, name:'name' },
  },
  setOn(x){ this.on = cleanEmx(x); for(const r of this.rids) this.want(r); },
  room(rid){
    if(!RID_RE.test(String(rid||''))) return;
    if(!this.rids.has(rid)){ if(this.rids.size >= 20) this.rids.delete(this.rids.values().next().value); this.rids.add(rid); }
    this.want(rid);
  },
  want(rid){ for(const p of EMX_PROV) if(this.on[p]){ this._load(p, 'g'); if(rid) this._load(p, rid); } },
  _load(p, key){
    const k = p+':'+key, now = Date.now(); let s = this.sets.get(k);
    if(s && (s.busy || now - s.at < (s.map ? this.TTL : this.RETRY))) return;
    if(!s){ s = { at:0, busy:false, map:null }; this.sets.set(k, s); }
    s.busy = true;
    const api = this.API[p], g = key==='g';
    const ctl = typeof AbortController==='function' ? new AbortController() : null, t = setTimeout(() => ctl?.abort(), 10000);
    fetch(g ? api.g : api.c(key), { credentials:'omit', referrerPolicy:'no-referrer', signal:ctl?.signal })
      .then(r => r.ok ? r.text() : null)
      .then(txt => {
        if(!txt || txt.length > this.BYTES) return null;
        const list = api.list(JSON.parse(txt), g); if(!Array.isArray(list)) return null;
        const map = new Map();
        for(const e of list){
          if(map.size >= this.MAX) break;
          const name = e?.[api.name], id = e?.id==null ? '' : String(e.id);
          if(typeof name==='string' && name.length <= 100 && /^\S+$/.test(name) && EMX_ID[p].test(id) && !map.has(name)) map.set(name, id);
        }
        return map;
      })
      .catch(() => null)
      .then(map => { clearTimeout(t); s.busy = false; s.at = Date.now(); if(map){ s.map = map; try{ this.onReady(p, key); }catch{} } });
  },
  // смайлы в тексте: [[провайдер, id, с, по]] по символам, слова внутри эмоутов Twitch не трогаем
  find(text, emotes, rid){
    if(!EMX_PROV.some(p => this.on[p]) || typeof text!=='string') return [];
    rid = RID_RE.test(String(rid||'')) ? String(rid) : '';
    if(rid) this.room(rid); else this.want('');
    const order = [];
    for(const key of [rid, 'g']) if(key) for(const p of EMX_PROV) if(this.on[p]){ const m = this.sets.get(p+':'+key)?.map; if(m?.size) order.push([p, m]); }   // свои смайлы канала важнее глобальных
    if(!order.length) return [];
    const cp = Array.from(text), taken = new Uint8Array(cp.length);
    for(const x of emotes||[]) for(let i = Math.max(0, x[1]); i <= x[2] && i < cp.length; i++) taken[i] = 1;
    const out = []; let i = 0;
    while(i < cp.length && out.length < 80){
      if(/\s/.test(cp[i])){ i++; continue; }
      let j = i, free = true;
      while(j < cp.length && !/\s/.test(cp[j])){ if(taken[j]) free = false; j++; }
      if(free && j - i <= 100){ const w = cp.slice(i, j).join(''); for(const [p, m] of order){ const id = m.get(w); if(id){ out.push([p, id, i, j-1]); break; } } }
      i = j;
    }
    return out;
  },
};

// ---------- чат Twitch: анонимное чтение, одно соединение на канал ----------
function cleanChan(ch){ return (typeof ch==='string' ? ch : '').toLowerCase().replace(/^.*twitch\.tv\//,'').replace(/[^a-z0-9_]/g,'').slice(0,25); }
const TAG_KEYS=['badges','display-name','id','color','emotes','subscriber','target-msg-id','room-id','custom-reward-id'];   // the only tags the app reads
function parseTags(str){
  const raw=new Map();
  for(const kv of (str||'').split(';')){ const i=kv.indexOf('='); if(i<0) continue;
    raw.set(kv.slice(0,i), kv.slice(i+1).replace(/\\s/g,' ').replace(/\\:/g,';').replace(/\\\\/g,'\\')); }
  const o=Object.create(null);
  for(const k of TAG_KEYS) if(raw.has(k)) o[k]=raw.get(k);
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
function nameColor(login){ let n=0; for(const ch of login) n=(n*31+ch.charCodeAt(0))>>>0; return NAME_COLORS[n%NAME_COLORS.length]; }
// одна строка IRC → { type:'msg', msg } | { type:'del', id } | { type:'clear', login } | { type:'room', id } | null
function ircMessage(line){
  let m=line.match(/^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #\w+ :(.*)$/);
  if(m){
    const tags=parseTags(m[1]), text=m[3].replace(/^\x01ACTION |\x01$/g,''), badge=badgeOf(tags.badges);
    return { type:'msg', msg:{ id:tags.id||Math.random().toString(36).slice(2,10), login:m[2], user:tags['display-name']||m[2],
      color:/^#[0-9a-f]{6}$/i.test(tags.color||'')?tags.color:nameColor(m[2]), text, emotes:parseEmotes(tags.emotes), badge,
      mod:badge==='mod'||badge==='broadcaster', sub:tags.subscriber==='1'||badge==='sub', rid:RID_RE.test(tags['room-id']||'')?tags['room-id']:'', reward:REWARD_RE.test(tags['custom-reward-id']||'')?tags['custom-reward-id']:'', t:Date.now() } };
  }
  m=line.match(/^(?:@(\S+) )?:\S+ ROOMSTATE #\w+/);
  if(m){ const id=parseTags(m[1])['room-id']; return RID_RE.test(id||'') ? { type:'room', id } : null; }   // id канала: по нему грузятся смайлы 7TV/BTTV/FFZ
  m=line.match(/^(?:@(\S+) )?:\S+ CLEARMSG #\w+ :/);
  if(m){ const id=parseTags(m[1])['target-msg-id']; return id ? { type:'del', id } : null; }
  m=line.match(/^(?:@(\S+) )?:\S+ CLEARCHAT #\w+(?: :(\S+))?\s*$/);
  if(m) return { type:'clear', login:(m[2]||'').toLowerCase() };
  return null;
}
const TwitchChat={
  _c:new Map(),
  subscribe(ch, cb){      // → функция отписки; когда подписчиков не осталось, соединение закрывается
    ch=cleanChan(ch); if(!ch) return ()=>{};
    let c=this._c.get(ch);
    if(!c){ c={ ch, subs:new Set(), ws:null, timer:0, closed:false }; this._c.set(ch, c); this._open(c); }
    c.subs.add(cb);
    return ()=>{
      c.subs.delete(cb);
      if(c.subs.size || c.closed) return;
      c.closed=true; clearTimeout(c.timer); this._c.delete(ch);
      try{ c.ws && c.ws.close(); }catch{}
    };
  },
  _open(c){
    const ws=new WebSocket('wss://irc-ws.chat.twitch.tv:443'); c.ws=ws;
    ws.onopen=()=>{ ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands'); ws.send('PASS SCHMOOPIIE'); ws.send('NICK justinfan'+(10000+Math.random()*80000|0)); ws.send('JOIN #'+c.ch); };
    ws.onmessage=ev=>{
      for(const line of String(ev.data).split('\r\n')){
        if(!line) continue;
        if(line.startsWith('PING')){ ws.send('PONG'+line.slice(4)); continue; }
        const r=ircMessage(line); if(!r) continue;
        if(r.type==='room') ThirdEmotes.room(r.id);
        for(const cb of [...c.subs]){ try{ cb(r); }catch(e){ console.error(e); } }
      }
    };
    ws.onclose=()=>{ if(c.closed || c.ws!==ws) return; c.timer=setTimeout(()=>{ if(!c.closed) this._open(c); }, 3000); };
  }
};
// лента элемента «Чат»: подписка на канал, строки, исчезание, удалённое модератором
function chatBind(c, el){
  c._el=el; c._wasConn=c._wasConn || c.isConnected;
  if(c._dir && c._dir!==el.dir) c.replaceChildren(...[...c.children].reverse());
  c._dir=el.dir; c.dataset.dir=el.dir;
  if(c._chan===el.chan) return;
  if(c._unsub){ c._unsub(); c._unsub=null; }
  c.replaceChildren(); c._chan=el.chan;
  if(el.chan) c._unsub=TwitchChat.subscribe(el.chan, ev=>chatEvent(c, ev));
}
// Элемент убрали с экрана или сменили ему тип: сразу отписаться от канала (соединение закроется, если оно больше никому не нужно).
// Принимает узел элемента (.el) или саму ленту (.chat); с любым другим узлом ничего не делает.
function chatUnbind(node){
  const c = node?.classList?.contains('chat') ? node : node?.querySelector?.('.chat');
  if(!c) return;
  if(c._unsub){ c._unsub(); c._unsub=null; }
  c._chan=null;
  for(const r of c.children) clearTimeout(r._t);
}
function chatEvent(c, ev){
  if(!c.isConnected && c._wasConn){ if(c._unsub) c._unsub(); c._unsub=null; c._chan=null; return; }   // элемент убрали с экрана
  const el=c._el; if(!el) return;
  if(ev.type==='msg') chatAdd(c, el, ev.msg);
  else if(ev.type==='del'){ for(const r of [...c.children]) if(r.dataset.id===ev.id) chatDrop(r); }
  else if(ev.type==='clear'){ for(const r of [...c.children]) if(!ev.login || r.dataset.login===ev.login) chatDrop(r); }
}
function chatDrop(r){ if(r._gone) return; r._gone=true; clearTimeout(r._t); r.classList.add('gone'); setTimeout(()=>r.remove(), 320); }
function paintChatLine(row, m){
  const name=h('span','cl-name');
  if(m.badge) name.append(h('span','m-badge', BADGE[m.badge]));
  const u=h('span','m-user', m.user); u.style.color=m.color; name.append(u);
  row.style.setProperty('--uc', m.color);
  row.append(name, ...msgBody(m.text, m.emotes, m.xe || ThirdEmotes.find(m.text, m.emotes, m.rid)).childNodes);
}
function chatAdd(c, el, m){
  const row=h('div','cl'); row.dataset.id=m.id; row.dataset.login=m.login.toLowerCase();
  paintChatLine(row, m);
  if(el.dir==='up') c.prepend(row); else c.append(row);
  const live=[...c.children].filter(r=>!r._gone);
  for(const old of (el.dir==='up' ? live.reverse() : live).slice(0, Math.max(0, live.length-el.max))){ clearTimeout(old._t); old.remove(); }
  if(el.fade>0) row._t=setTimeout(()=>chatDrop(row), el.fade*1000);
}
