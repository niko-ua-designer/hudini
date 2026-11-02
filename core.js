// Общий код пульта и виджета. Оба HTML подключают этот файл: держи их в одной папке.

const FONTS = {
  montserrat:"'Montserrat',sans-serif", russo:"'Russo One',sans-serif",
  impact:"Impact,'Anton','Arial Black',sans-serif", pixel:"'Press Start 2P',monospace",
  comfortaa:"'Comfortaa',sans-serif", caveat:"'Caveat',cursive"
};
const ANIMS = ['none','pulse','wobble','float','spin','shake','rainbow'];
const STYLES = ['flip','neon','plain'];
const TIMER_MODES = ['countdown','stopwatch','until','clock'];
const COUNTER_MODES = ['manual','chat','interval'];
const TYPES = ['text','image','video','timer','counter','web'];
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
    if(type==='video'){ o.sound=!!e.sound; o.restart=num(e.restart,0,0,1e15); }
  } else if(type==='web'){
    o.url=safeUrl(e.url); if(!o.url) return null;
    o.w=num(e.w,40,1,200); o.ar=ASPECTS[e.ar]?e.ar:'16:9'; o.shape=SHAPES.includes(e.shape)?e.shape:'rect';
    o.zoom=num(e.zoom,1,0.2,3); o.sound=!!e.sound; o.restart=num(e.restart,0,0,1e15);
    o.bw=num(e.bw,0,0,3); o.bc=hex(e.bc,'#ffffff');
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
// Готовые анимации. Строятся от текущего положения элемента.
const SPEED = 0.025; // % экрана за мс для «пролётов»
function kfPreset(name, el){
  const x=el.x, y=el.y, r=el.rot, F=(o)=>({ x, y, r, s:1, o:1, d:800, e:'inout', ...o });
  const dist=(a,b)=>Math.hypot(b.x-a.x, (b.y-a.y)*9/16);
  switch(name){
    case 'flyLR': return { mode:'once', end:'hide', f:[F({ x:-30, d:4500, e:'linear' }), F({ x:130 })] };
    case 'flyRL': return { mode:'once', end:'hide', f:[F({ x:130, d:4500, e:'linear' }), F({ x:-30 })] };
    case 'flyUp': return { mode:'once', end:'hide', f:[F({ y:130, d:6000, e:'linear' }), F({ y:-30 })] };
    case 'slideIn': return { mode:'once', end:'hide', f:[F({ x:-30, d:700, e:'out' }), F({ d:3000, e:'linear' }), F({ d:600, e:'in' }), F({ x:130 })] };
    case 'drop': return { mode:'once', end:'stay', f:[F({ y:-30, d:1100, e:'bounce' }), F({})] };
    case 'zoom': return { mode:'once', end:'hide', f:[F({ s:0, d:450, e:'back' }), F({ d:2500, e:'linear' }), F({ d:300, e:'in' }), F({ s:0 })] };
    case 'spinIn': return { mode:'once', end:'stay', f:[F({ s:0, r:r-360, o:0, d:900, e:'out' }), F({})] };
    case 'orbit': return { mode:'loop', end:'stay', f:Array.from({ length:12 }, (_,i)=>{ const a=i/12*Math.PI*2; return F({ x:x+Math.cos(a)*6, y:y+Math.sin(a)*6*16/9, d:250, e:'linear' }); }) };
    case 'zigzag': return { mode:'pingpong', end:'stay', f:[-2,-1,0,1,2].map(i=>F({ x:x+i*8, y:y-(i%2?7:0), d:450, e:'inout' })) };
    case 'swing': return { mode:'pingpong', end:'stay', f:[F({ r:r-15, d:900 }), F({ r:r+15 })] };
    case 'heart': return { mode:'loop', end:'stay', f:[F({ d:500, e:'out' }), F({ s:1.25, d:200, e:'in' }), F({ d:300, e:'out' }), F({ s:1.15, d:150, e:'in' })] };
    case 'dvd': {
      const pts=[[8,12],[70,88],[92,40],[30,10],[8,55],[50,88],[92,70],[60,12]].map(([px,py])=>F({ x:px, y:py, e:'linear' }));
      pts.forEach((p,i)=>p.d=dist(p, pts[(i+1)%pts.length])/SPEED*1.6);
      return { mode:'loop', end:'stay', f:pts };
    }
  }
  return null;
}
const KF_PRESETS = { flyLR:'➡ Пролёт слева направо', flyRL:'⬅ Пролёт справа налево', flyUp:'⬆ Титры снизу вверх',
  slideIn:'↔ Въехал, постоял, уехал', drop:'⬇ Падение с отскоком', zoom:'💥 Зум-удар', spinIn:'🌀 Влёт с вращением',
  orbit:'⭕ По кругу', zigzag:'〰 Зигзаг', swing:'🎐 Маятник', heart:'💓 Сердцебиение', dvd:'📀 DVD-заставка' };

function sanitizeState(m){
  const els = Array.isArray(m?.els) ? m.els.slice(0,MAX_ELS).map(sanitizeEl).filter(Boolean) : [];
  return { visible: m?.visible !== false, els };
}

// ---------- время ----------
const pad = n => String(n).padStart(2,'0');
function fmtDur(ms, roundUp){
  let s = Math.max(0, roundUp ? Math.ceil(ms/1000) : Math.floor(ms/1000));
  const d = Math.floor(s/86400); s -= d*86400;
  const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60;
  if(d) return `${d}д ${pad(h)}:${pad(m)}:${pad(x)}`;
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
  else if(el.type==='web'){
    c=document.createElement('div'); c.className='web';
    const f=document.createElement('iframe');
    f.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
    f.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
    f.setAttribute('frameborder','0');
    if(parseEmbed(el.url).kind==='site') f.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation allow-forms');
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
  c.classList.add('content');
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
    const url=resolveSrc(el.src);
    if(url && c.getAttribute('src')!==url) c.setAttribute('src', url);
    node.classList.toggle('loading', !url);
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
function tickNode(node, el, now){
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
    return `https://www.youtube.com/embed/${p.id}?autoplay=1&mute=${mute?1:0}&controls=0&rel=0&playsinline=1&loop=1&playlist=${p.id}${p.start?'&start='+p.start:''}`;
  if(p.kind==='twitch'){
    if(!host) return null;
    const base = p.clip ? `https://clips.twitch.tv/embed?clip=${e(p.clip)}`
      : p.video ? `https://player.twitch.tv/?video=${e(p.video)}` : `https://player.twitch.tv/?channel=${e(p.channel)}`;
    return `${base}&parent=${e(host)}&autoplay=true&muted=${mute}`;
  }
  if(p.kind==='cam'){ const u = new URL(el.url); if(mute) u.searchParams.set('noaudio','1'); else u.searchParams.delete('noaudio'); return u.href; }
  return el.url;
}
function setFrameSrc(node, src){
  const f = node.querySelector('iframe'), ph = node.querySelector('.ph');
  if(node._src === src) return;
  node._src = src;
  if(src) f.setAttribute('src', src); else f.removeAttribute('src');
  ph.hidden = !!src || node._noPh;
}

// ---------- файлы с компьютера ----------
// Файл режется на куски и хранится на брокере (retained), поэтому виджет получает его и после перезапуска OBS.
const CHUNK = 64*1024;
const Assets = {
  urls:new Map(), meta:new Map(), parts:new Map(), subs:new Set(),
  client:null, base:'', onReady:()=>{},
  setRoom(client, base){
    for(const id of this.subs) this.client?.unsubscribe(`${this.base}/asset/${id}/#`);
    this.client=client; this.base=base; this.subs.clear(); this.parts.clear();
  },
  want(id){
    if(this.urls.has(id) || this.subs.has(id) || !this.client?.connected) return;
    this.subs.add(id); this.client.subscribe(`${this.base}/asset/${id}/#`, { qos:1 });
  },
  resubscribe(){ const ids=[...this.subs]; this.subs.clear(); ids.forEach(id=>this.want(id)); },
  resolve(src){
    const id = assetId(src); if(!id) return src;
    const u = this.urls.get(id); if(!u) this.want(id);
    return u || '';
  },
  handle(topic, payload){
    const pre = this.base+'/asset/';
    if(!topic.startsWith(pre)) return false;
    const [id, kind, idx] = topic.slice(pre.length).split('/');
    if(!payload.length || this.urls.has(id)) return true;
    if(kind==='m'){ try{ const m = JSON.parse(payload.toString()); if(/^(image|video|audio)\/[\w.+-]+$/.test(m.mime) && m.n>0 && m.n<2000) this.meta.set(id, m); }catch{} }
    else if(kind==='c'){ let a = this.parts.get(id); if(!a){ a=[]; this.parts.set(id,a); } a[+idx] = new Uint8Array(payload); }
    const m = this.meta.get(id), a = this.parts.get(id);
    if(m && a){
      for(let i=0;i<m.n;i++) if(!a[i]) return true;
      this.urls.set(id, URL.createObjectURL(new Blob(a.slice(0,m.n), { type:m.mime })));
      this.parts.delete(id);
      this.client.unsubscribe(`${this.base}/asset/${id}/#`); this.subs.delete(id);
      this.onReady(id);
    }
    return true;
  },
  addLocal(id, blob){ this.urls.set(id, URL.createObjectURL(blob)); this.meta.set(id, { mime:blob.type, n:Math.ceil(blob.size/CHUNK), size:blob.size }); },
};
function resolveSrc(src){ return Assets.resolve(src); }
