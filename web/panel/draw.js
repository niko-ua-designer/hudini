// Рисование на холсте пульта (элемент draw). Загружается после moderator.js и берёт из него state, byId, addEl, select,
// beginChange/changed/commit, sealedPublish. Полоса инструментов над холстом; законченный штрих уходит в экран (state),
// а точки штриха, пока его ведут, идут в тему ink (~30 раз в секунду), чтобы стрим и другие пульты видели линию сразу.
'use strict';
window.Draw = (function(){
  DrawFx.panel = true;
  const PREF = 'hudini.draw';
  const BASE = ['#ffffff', '#111318', '#ff3b5c', '#ff8a00', '#ffd23f', '#2ee66b', '#3fd0ff', '#7c5cff'];
  const PEN_TOOLS = ['pen', 'marker', 'neon', 'line', 'arrow', 'circle', 'rect', 'stamp', 'tex', 'eraser'];
  const INK_MS = 33;
  const P = { tool:'pen', color:'#ff3b5c', size:8, fadeOn:true, fade:5, mode:'live' };
  { const v = lsGet(PREF, null);
    if(v && typeof v==='object'){
      if(PEN_TOOLS.includes(v.tool) && v.tool!=='stamp' && v.tool!=='tex') P.tool = v.tool;
      P.color = hex(v.color, P.color); P.size = Math.round(num(v.size, P.size, 2, 40));
      P.fadeOn = v.fadeOn!==false; P.fade = Math.round(num(v.fade, 5, 1, 60)); P.mode = v.mode==='btn' ? 'btn' : 'live';
    } }
  const savePrefs = () => lsSet(PREF, { tool:P.tool, color:P.color, size:P.size, fadeOn:P.fadeOn, fade:P.fade, mode:P.mode });
  const D = { on:false, id:null, cur:null, erase:null, picking:false, photo:null, inkT:null };
  const known = new Map();     // id рисунка → id штрихов, которые этот пульт последним видел или отправил
  const seenDel = new Map();   // id рисунка → id стёртых штрихов (стёртое, вернувшееся через Ctrl+Z, получает новый id)

  const drawEl = () => { const el = byId(D.id); return el && el.type==='draw' ? el : null; };
  const bar = $('drawBar');

  // ---------- вход и выход ----------
  function start(id){
    D.on = true; D.id = id;
    if(selectedId!==id) select(id); else renderAll();
  }
  function stop(){
    if(!D.on) return;
    if(D.cur) finish();
    D.on = false; D.picking = false; D.erase = null;
    sync();
  }
  function open(){
    const sel = byId(selectedId);
    const el = sel?.type==='draw' ? sel : [...state.els].reverse().find(e=>e.type==='draw');
    if(el){ if(el.hidden) toast('Рисунок скрыт со стрима: открой его глазиком в слоях', 3500); return start(el.id); }
    const made = addEl({ type:'draw', x:50, y:50, strokes:[], del:[], hidden:false });
    if(made) start(made.id);
  }
  // Вызывается при каждой перерисовке пульта: выход из режима, когда выбрали другое, и состояние полосы
  function sync(){
    const el = drawEl();
    if(D.on && (!el || selectedId!==D.id)){ D.on = false; D.picking = false; if(D.cur) dropCur(); }
    bar.hidden = !D.on;
    stage.classList.toggle('drawing', D.on);
    stage.classList.toggle('erasing', D.on && P.tool==='eraser');
    stage.classList.toggle('picking', D.on && D.picking);
    if(!D.on){ $('dPhotoPop').hidden = true; }
    const sel = byId(selectedId);
    if(sel?.type==='draw'){
      const held = sel.strokes.filter(k=>k.hold).length;
      $('dInfo').textContent = `Штрихов: ${sel.strokes.length}` + (held ? ` · ждут показа: ${held}` : '');
      $('dStart').hidden = D.on;
    }
    // у рисунка на весь экран нет размера и поворота
    for(const id of ['iSize', 'iRot']){ const f = $(id), d = sel?.type==='draw' ? 'none' : ''; f.style.display = d; f.previousElementSibling.style.display = d; }
    if(D.on) paintBar(el);
  }

  // ---------- полоса инструментов ----------
  const swatch = (c, box) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.c = c; b.title = c; b.style.background = c; box.appendChild(b); return b; };
  function paintBar(el){
    for(const b of bar.querySelectorAll('[data-dt]')) b.classList.toggle('on', b.dataset.dt===P.tool);
    const sw = $('dSw'), pal = D.photo?.pal || [], sig = pal.join();
    if(sw._sig!==sig){
      sw._sig = sig; sw.replaceChildren();
      (pal.length ? BASE.slice(0, 2) : BASE).forEach(c => swatch(c, sw));   // с фото: белый, чёрный и цвета фото
      if(pal.length){ sw.appendChild(document.createElement('i')); pal.forEach(c => swatch(c, sw)); }
    }
    for(const b of bar.querySelectorAll('.dsw button')) b.classList.toggle('on', b.dataset.c===P.color);
    setField($('dColor'), P.color); setField($('dSize'), String(P.size));
    const dot = $('dDot'), d = Math.max(3, Math.min(26, P.size*0.6));
    dot.style.width = dot.style.height = d+'px'; dot.style.background = P.color;
    setField($('dFadeOn'), P.fadeOn, 'checked'); setField($('dFade'), String(P.fade)); $('dFade').disabled = !P.fadeOn;
    $('vFade').textContent = String(P.fade);
    $('dLive').classList.toggle('on', P.mode==='live'); $('dHold').classList.toggle('on', P.mode==='btn');
    const held = el ? el.strokes.filter(k=>k.hold).length : 0;
    $('dShow').hidden = !held; $('dHeld').textContent = String(held);
    $('dPick').classList.toggle('on', D.picking);
    $('dPhoto').classList.toggle('on', !!D.photo);
  }
  function setTool(t){
    if((t==='stamp' || t==='tex') && !D.photo){ D.wantTool = t; $('dFile').click(); return; }
    P.tool = t; D.picking = false; savePrefs(); sync();
    if(t==='stamp' || t==='tex') photoAsset();   // файл кисти загружается в программу стримера заранее
  }
  function setColor(c){ c = hex(c, null); if(!c) return; P.color = c; if(P.tool==='eraser') P.tool = 'pen'; savePrefs(); sync(); }
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.dt) return setTool(b.dataset.dt);
    if(b.dataset.c) return setColor(b.dataset.c);
  });
  $('dPhotoPal').addEventListener('click', e => { const b = e.target.closest('button[data-c]'); if(b) setColor(b.dataset.c); });
  $('dColor').addEventListener('input', e => setColor(e.target.value));
  $('dSize').addEventListener('input', e => { P.size = Math.round(num(e.target.value, 8, 2, 40)); savePrefs(); sync(); });
  $('dFadeOn').addEventListener('change', e => { P.fadeOn = e.target.checked; savePrefs(); sync(); });
  $('dFade').addEventListener('input', e => { P.fade = Math.round(num(e.target.value, 5, 1, 60)); savePrefs(); sync(); });
  $('dLive').onclick = () => { P.mode = 'live'; savePrefs(); sync(); };
  $('dHold').onclick = () => { P.mode = 'btn'; savePrefs(); sync(); };
  $('dShow').onclick = () => showHeld();
  $('dClear').onclick = $('dClear2').onclick = () => clearAll();
  $('dDone').onclick = () => stop();
  $('dStart').onclick = () => { const el = byId(selectedId); if(el?.type==='draw') start(el.id); };
  $('addDraw').onclick = () => open();
  $('dPick').onclick = () => pick();

  function showHeld(){
    const el = drawEl() || byId(selectedId); if(!el || el.type!=='draw') return;
    const now = nowMs(); let n = 0;
    beginChange();
    el.strokes = el.strokes.map(k => { if(!k.hold) return k; n++; const c = { ...k, t:now }; delete c.hold; return c; });
    commit();
    if(n) toast(`▶ На стриме: ${n}`);
  }
  function clearAll(){
    const el = drawEl() || byId(selectedId); if(!el || el.type!=='draw' || !el.strokes.length) return;
    beginChange();
    forget(el, el.strokes.map(k=>k.id));
    el.strokes = [];
    commit(); toast('Рисунок стёрт. Ctrl+Z, чтобы вернуть');
  }
  function forget(el, ids){
    if(!ids.length) return;
    el.del = [...el.del, ...ids].slice(-DRAW_MAX_DEL);
    let s = seenDel.get(el.id); if(!s) seenDel.set(el.id, s = new Set());
    for(const id of ids) s.add(id);
  }

  // ---------- ввод на холсте ----------
  function pt(e){
    const r = stage.getBoundingClientRect();
    return [Math.round((e.clientX-r.left)/r.width*1000), Math.round((e.clientY-r.top)/r.height*1000)];
  }
  const isShape = t => DRAW_SHAPES.has(t);
  const own = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  stage.addEventListener('pointerdown', e => {
    if(!D.on) return;
    own(e);
    if(e.button!==0) return;
    const el = drawEl(); if(!el){ stop(); return; }
    $('dPhotoPop').hidden = true;
    if(D.picking){ D.picking = false; sampleStage(e).then(c => { if(c) setColor(c); else { toast('Здесь нет цвета'); sync(); } }); return; }
    stage.setPointerCapture(e.pointerId);
    if(P.tool==='eraser'){ D.erase = { began:false }; eraseAt(e); return; }
    let asset;
    if(P.tool==='stamp' || P.tool==='tex'){
      asset = D.photo?.asset;
      if(!asset){ photoAsset(); toast(D.photo ? 'Фото ещё загружается в программу стримера…' : 'Сначала выбери фото'); return; }
    }
    const p = pt(e);
    const k = { id:rid(10), by:clientId, tool:P.tool, color:P.color, size:P.size, pts:isShape(P.tool) ? [p[0], p[1], p[0], p[1]] : [p[0], p[1]], t:0 };
    if(asset) k.asset = asset;
    if(P.mode==='btn') k.hold = 1;
    D.cur = { el:el.id, k, sent:0, a:p };
    live(); inkSoon();
  }, true);
  stage.addEventListener('pointermove', e => {
    if(!D.on) return;
    if(!D.cur && !D.erase) return;
    own(e);
    if(D.erase){ eraseAt(e); return; }
    const c = D.cur, k = c.k;
    if(isShape(k.tool)){
      let [x, y] = pt(e);
      if(e.shiftKey){
        const dx = (x-c.a[0])*16/9, dy = y-c.a[1];
        if(k.tool==='line' || k.tool==='arrow'){
          const an = Math.round(Math.atan2(dy, dx)/(Math.PI/4))*(Math.PI/4), L = Math.hypot(dx, dy);
          x = Math.round(c.a[0]+Math.cos(an)*L*9/16); y = Math.round(c.a[1]+Math.sin(an)*L);
        } else { const m = Math.max(Math.abs(dx), Math.abs(dy)); x = Math.round(c.a[0]+Math.sign(dx||1)*m*9/16); y = Math.round(c.a[1]+Math.sign(dy||1)*m); }
      }
      k.pts = [c.a[0], c.a[1], x, y];
    } else {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for(const ev of evs.length ? evs : [e]){
        const [x, y] = pt(ev), n = k.pts.length;
        if(n>=DRAW_MAX_PTS*2) break;
        if(Math.abs(x-k.pts[n-2])+Math.abs(y-k.pts[n-1])<2) continue;
        k.pts.push(x, y);
      }
    }
    live(); inkSoon();
  }, true);
  const up = e => {
    if(!D.on || (!D.cur && !D.erase)) return;
    own(e);
    if(D.erase){ const b = D.erase.began; D.erase = null; if(b) commit(); return; }
    finish();
  };
  stage.addEventListener('pointerup', up, true);
  stage.addEventListener('pointercancel', up, true);
  // Пока рисуешь, клики по холсту не выделяют и не двигают элементы
  for(const t of ['dblclick', 'wheel', 'click']) stage.addEventListener(t, e => { if(D.on && t!=='wheel') own(e); }, true);

  // Свой штрих на холсте пульта, пока его ведёшь
  function live(){
    const c = D.cur; let m = DrawFx.live.get(c.el);
    if(!m){ m = new Map(); DrawFx.live.set(c.el, m); }
    m.set(c.k.id, { k:c.k, at:Date.now(), done:false });
    DrawFx.dirty(c.el);
  }
  function dropCur(){ const c = D.cur; D.cur = null; DrawFx.live.get(c.el)?.delete(c.k.id); DrawFx.dirty(c.el); }
  function inkSoon(){ if(!D.inkT) D.inkT = setTimeout(sendInk, INK_MS); }
  function sendInk(done){
    clearTimeout(D.inkT); D.inkT = null;
    const c = done || D.cur; if(!c || !client?.connected) return;
    const k = c.k, shape = isShape(k.tool), n = k.pts.length>>1;
    if(!done && !shape && n===c.sent) return;
    const m = { el:c.el, id:k.id, tool:k.tool, color:k.color, size:k.size, i:shape ? 0 : c.sent, pts:shape ? k.pts : k.pts.slice(c.sent*2), from:clientId, t:Date.now() };
    if(k.asset) m.asset = k.asset;
    if(k.hold) m.hold = 1;
    if(done) m.done = 1;
    c.sent = n;
    sealedPublish(topics(room).base+'/ink', m, { qos:0 }).catch(()=>{});
  }
  function finish(){
    const c = D.cur; if(!c) return;
    D.cur = null; clearTimeout(D.inkT); D.inkT = null;
    const k = c.k, shape = isShape(k.tool);
    const tiny = shape && Math.abs(k.pts[2]-k.pts[0])*16/9 + Math.abs(k.pts[3]-k.pts[1]) < 4;
    const el = byId(c.el);
    if(tiny || !el || el.type!=='draw'){ DrawFx.live.get(c.el)?.delete(k.id); DrawFx.dirty(c.el); return; }
    sendInk(c);   // последние точки и «готово»: стрим держит линию, пока не придёт экран с ней
    const fin = sanitizeStroke({ ...k, pts:shape ? k.pts : drawSimplify(k.pts, 0.7), t:nowMs(), fade:P.fadeOn ? P.fade : 0 });
    if(!fin) return;
    beginChange();
    el.strokes = drawCap([...el.strokes, fin]);
    commit();
  }

  // ---------- ластик: стирает штрих целиком ----------
  function hits(k, p, r){
    const sx = r.width/1000, sy = r.height/1000, z = r.height/1080;
    const wide = { marker:2.6, tex:2.4, stamp:4 }[k.tool] || 1;
    const tol = Math.max(8, k.size*z*wide/2+6);
    const px = p[0]*sx, py = p[1]*sy, Q = [];
    for(let i=0;i+1<k.pts.length;i+=2) Q.push([k.pts[i]*sx, k.pts[i+1]*sy]);
    const seg = (a, b) => {
      const dx = b[0]-a[0], dy = b[1]-a[1], L = dx*dx+dy*dy;
      const t = L ? Math.max(0, Math.min(1, ((px-a[0])*dx+(py-a[1])*dy)/L)) : 0;
      return Math.hypot(px-a[0]-t*dx, py-a[1]-t*dy);
    };
    let path = Q;
    if(isShape(k.tool) && Q.length===2){
      const [A, B] = Q;
      if(k.tool==='rect') path = [A, [B[0], A[1]], B, [A[0], B[1]], A];
      else if(k.tool==='circle'){ path = []; const cx = (A[0]+B[0])/2, cy = (A[1]+B[1])/2, rx = Math.abs(B[0]-A[0])/2, ry = Math.abs(B[1]-A[1])/2;
        for(let i=0;i<=48;i++){ const a = i/48*Math.PI*2; path.push([cx+Math.cos(a)*rx, cy+Math.sin(a)*ry]); } }
    }
    if(path.length===1) return Math.hypot(px-path[0][0], py-path[0][1])<=tol;
    for(let i=1;i<path.length;i++) if(seg(path[i-1], path[i])<=tol) return true;
    return false;
  }
  function eraseAt(e){
    const el = drawEl(); if(!el) return;
    const p = pt(e), r = stage.getBoundingClientRect();
    const gone = el.strokes.filter(k => hits(k, p, r)).map(k=>k.id);
    if(!gone.length) return;
    if(!D.erase.began){ beginChange(); D.erase.began = true; }
    const g = new Set(gone);
    el.strokes = el.strokes.filter(k => !g.has(k.id));
    forget(el, gone);
    changed();
  }

  // ---------- пипетка ----------
  const toHex = (r, g, b) => '#'+[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function cssHex(c){ const m = /rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[,/ ]+([\d.]+))?/.exec(c||''); return m && (m[4]===undefined || +m[4]>0.2) ? toHex(+m[1], +m[2], +m[3]) : null; }
  function pick(){
    if(window.EyeDropper){
      new window.EyeDropper().open().then(r => setColor(r.sRGBHex)).catch(()=>{});
      return;
    }
    D.picking = !D.picking; sync();
    if(D.picking) toast('Кликни по холсту, чтобы взять цвет');
  }
  // Снимок холста в точке: сверху вниз рисунки, картинки и видео, текст; иначе ничего
  async function sampleStage(e){
    const x = e.clientX, y = e.clientY, one = document.createElement('canvas');
    one.width = one.height = 1;
    const cx = one.getContext('2d', { willReadFrequently:true });
    const list = [...nodes.values()].filter(n => n.isConnected).sort((a, b) => (+b.style.zIndex||0)-(+a.style.zIndex||0));
    for(const n of list){
      const c = n.querySelector('.content'); if(!c) continue;
      const b = c.getBoundingClientRect();
      if(x<b.left || x>b.right || y<b.top || y>b.bottom) continue;
      try{
        if(c.classList.contains('draw')){
          const cv = c.firstChild, d = cv.getContext('2d').getImageData(Math.floor((x-b.left)/b.width*cv.width), Math.floor((y-b.top)/b.height*cv.height), 1, 1).data;
          if(d[3]>40) return toHex(d[0], d[1], d[2]);
          continue;
        }
        if(c.tagName==='IMG' || c.tagName==='VIDEO'){
          const w = c.naturalWidth || c.videoWidth, h = c.naturalHeight || c.videoHeight; if(!w || !h) continue;
          cx.clearRect(0, 0, 1, 1); cx.drawImage(c, (x-b.left)/b.width*w, (y-b.top)/b.height*h, 1, 1, 0, 0, 1, 1);
          const d = cx.getImageData(0, 0, 1, 1).data;
          if(d[3]>40) return toHex(d[0], d[1], d[2]);
          continue;
        }
      }catch{ continue; }   // картинка с чужого сайта: пиксели не прочитать
      const t = cssHex(getComputedStyle(c).color); if(t) return t;
    }
    return null;
  }

  // ---------- фото: палитра, пипетка, кисть ----------
  // Палитра из фото: k-means по уменьшенной копии, до 8 главных цветов (почти одинаковые склеиваются)
  function photoPalette(im, k=8){
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently:true }); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S).data, px = [];
    for(let i=0;i<d.length;i+=4) if(d[i+3]>128) px.push([d[i], d[i+1], d[i+2]]);
    if(!px.length) return [];
    const d2 = (a, b) => (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
    const cs = [px[px.length>>1].slice()];   // начальные центры как можно дальше друг от друга
    while(cs.length<k){
      let best = null, bd = 0;
      for(const p of px){ let m = Infinity; for(const q of cs) m = Math.min(m, d2(p, q)); if(m>bd){ bd = m; best = p; } }
      if(!best || bd<300) break;
      cs.push(best.slice());
    }
    let cnt = [];
    for(let it=0; it<12; it++){
      const sum = cs.map(() => [0, 0, 0, 0]);
      for(const p of px){ let b = 0, bd = Infinity; cs.forEach((q, i) => { const v = d2(p, q); if(v<bd){ bd = v; b = i; } }); const s = sum[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
      cs.forEach((q, i) => { const s = sum[i]; if(s[3]){ q[0] = s[0]/s[3]; q[1] = s[1]/s[3]; q[2] = s[2]/s[3]; } });
      cnt = sum.map(s => s[3]);
    }
    const out = [];
    for(const [q] of cs.map((q, i) => [q, cnt[i]]).filter(e => e[1]>0).sort((a, b) => b[1]-a[1])) if(out.every(o => d2(o, q)>900)) out.push(q);
    return out.slice(0, 8).map(q => toHex(...q));
  }
  function loadImage(file){
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('не картинка')); }; im.src = u; });
  }
  $('dPhoto').onclick = () => { if(!D.photo){ $('dFile').click(); return; } const p = $('dPhotoPop'); p.hidden = !p.hidden; placePop(); };
  $('dPhotoNew').onclick = () => $('dFile').click();
  $('dPhotoDel').onclick = () => { D.photo = null; $('dPhotoPop').hidden = true; if(P.tool==='stamp' || P.tool==='tex') P.tool = 'pen'; sync(); };
  function placePop(){ const p = $('dPhotoPop'), b = $('dPhoto').getBoundingClientRect(), r = bar.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(r.width-p.offsetWidth-8, b.left-r.left))+'px'; }
  $('dFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    let im; try{ im = await loadImage(f); }catch{ return toast('Это не картинка'); }
    D.photo = { im, name:f.name, pal:photoPalette(im), asset:null, up:null };
    const cv = $('dPhotoCv'), x = cv.getContext('2d'), s = Math.min(cv.width/im.naturalWidth, cv.height/im.naturalHeight);
    x.clearRect(0, 0, cv.width, cv.height);
    x.drawImage(im, (cv.width-im.naturalWidth*s)/2, (cv.height-im.naturalHeight*s)/2, im.naturalWidth*s, im.naturalHeight*s);
    paintPal();
    $('dPhotoPop').hidden = false; placePop();
    if(D.wantTool){ const t = D.wantTool; D.wantTool = null; setTool(t); } else sync();
  };
  function paintPal(){ const box = $('dPhotoPal'); box.replaceChildren(); (D.photo?.pal||[]).forEach(c => swatch(c, box)); }
  $('dPhotoCv').addEventListener('click', e => {
    const cv = e.currentTarget, r = cv.getBoundingClientRect();
    const d = cv.getContext('2d').getImageData(Math.floor((e.clientX-r.left)/r.width*cv.width), Math.floor((e.clientY-r.top)/r.height*cv.height), 1, 1).data;
    if(d[3]>40) setColor(toHex(d[0], d[1], d[2]));
  });
  // Кисть из фото: картинка уменьшается до 512 px и один раз загружается в программу стримера
  function photoAsset(){
    const ph = D.photo; if(!ph || ph.asset || ph.up) return ph?.up || null;
    const im = ph.im, s = Math.min(1, 512/Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth*s)); cv.height = Math.max(1, Math.round(im.naturalHeight*s));
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    ph.up = new Promise(res => cv.toBlob(res, 'image/png'))
      .then(b => uploadBlob(b, ph.name.replace(/\.[^.]*$/, '')+'.png'))
      .then(a => { ph.asset = a; hideUpload(); if(D.photo===ph) toast('Кисть из фото готова'); return a; })
      .catch(err => { hideUpload(); ph.up = null; if(!err.shown) toast('Фото не загрузилось: '+(err.message||err)); return null; });
    return ph.up;
  }

  // ---------- хуки из moderator.js ----------
  return {
    open, stop, sync, start,
    get on(){ return D.on; },
    // Чужой экран: рисунки сливаются со своими. true: у нас есть штрихи или стирания, которых там нет (надо дослать)
    merge(s){
      let need = false;
      for(const r of s.els){
        if(r.type!=='draw') continue;
        const l = byId(r.id);
        let sd = seenDel.get(r.id); if(!sd) seenDel.set(r.id, sd = new Set());
        for(const id of r.del) sd.add(id);
        if(l && l.type==='draw'){ const m = drawMerge(l, r); r.strokes = m.strokes; r.del = m.del; if(m.added) need = true; }
        known.set(r.id, new Set(r.strokes.map(k=>k.id)));
      }
      return need;
    },
    // Перед отправкой экрана: пропавшие штрихи (Ctrl+Z, ластик) помечаются стёртыми, растаявшие убираются,
    // а стёртый штрих, который вернули через Ctrl+Z, получает новый id: иначе другие пульты снова его сотрут.
    beforeSend(){
      const now = nowMs();
      for(const el of state.els){
        if(el.type!=='draw') continue;
        const sd = seenDel.get(el.id);
        if(sd) el.strokes = el.strokes.map(k => sd.has(k.id) && !el.del.includes(k.id) ? { ...k, id:rid(10) } : k);
        const have = new Set(el.strokes.map(k=>k.id)), was = known.get(el.id);
        if(was){ const lost = [...was].filter(id => !have.has(id) && !el.del.includes(id)); if(lost.length) forget(el, lost); }
        el.strokes = el.strokes.filter(k => !drawGone(k, now));
        known.set(el.id, new Set(el.strokes.map(k=>k.id)));
      }
    },
    ink(m){ if(m && m.from!==clientId) DrawFx.ink(m); },
    // Рисунок из библиотеки: штрихи рисуются заново (новые id и время, растаявшие оживают)
    fromLib(el){
      if(el?.type!=='draw') return;
      const t = nowMs();
      el.strokes = (el.strokes||[]).map(k => ({ ...k, id:rid(10), t }));
      el.del = [];
    },
  };
})();
