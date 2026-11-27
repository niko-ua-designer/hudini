// Курсоры других модераторов на холсте пульта. Загружается после draw.js и берёт из moderator.js stage, clientId, room, topics,
// sealedPublish, drag, selectedId, lsGet/lsSet. Свой курсор уходит в отдельную неретейн-тему cur (QoS 0, ~20 раз в секунду),
// на стрим он не идёт: виджет эту тему не слушает, а Host пускает в неё только модераторов.
'use strict';
window.Cursors = (function(){
  const KEY = 'overlay.cursors', NAME = 'overlay.curName';
  const SEND_MS = 50, KEEP_MS = 1000, TTL_MS = 3000, MAX = 12, NAME_MAX = 24;
  const SAFE = /^[A-Za-z0-9_-]{1,40}$/;
  const C = { on:lsGet(KEY, true)!==false, name:String(lsGet(NAME, '')||'').slice(0, NAME_MAX), last:null, sentAt:0, t:null, keep:null, gc:null };
  const peers = new Map();   // id клиента → { id, n, x, y, s, d, at, el, box }
  const nicks = new Map();   // id клиента → последний ник; живёт дольше курсора (подписи слоёв трансляции)
  const layer = document.createElement('div');
  layer.id = 'curLayer'; layer.setAttribute('data-i18n-skip', ''); layer.hidden = !C.on;
  stage.appendChild(layer);
  const tr = s => window.HudiniI18n?.t ? window.HudiniI18n.t(s) : s;

  const hue = id => { let h = 0; for(let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) >>> 0; return h; };
  const colorOf = id => `hsl(${hue(id)%360} 85% 62%)`;
  const numOf = id => 1 + hue(id)%99;
  const labelOf = p => p.n || `${tr('Модератор')} ${numOf(p.id)}`;
  const clean = s => String(s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX);

  // ---------- свой курсор ----------
  const mine = () => drag && drag.id && drag.mode!=='rect' ? String(drag.id) : '';
  function send(off){
    if(!C.on || !client?.connected || !window.hudiniHost11) return;   // Host 1.0 закрывает соединение на чужой теме
    const l = C.last; if(!off && !l) return;
    C.sentAt = Date.now(); clearTimeout(C.t); C.t = null;
    const m = off ? { id:clientId, off:1 } : { id:clientId, n:C.name, x:l.x, y:l.y, s:selectedId||'', d:mine() };
    sealedPublish(topics(room).base+'/cur', m, { qos:0 }).catch(()=>{});
  }
  function onMove(e){
    if(!C.on) return;
    const r = stage.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    const inside = x>=-2 && x<=102 && y>=-2 && y<=102;
    if(!inside){ leave(); return; }
    C.last = { x:Math.min(100, Math.max(0, x)), y:Math.min(100, Math.max(0, y)) };
    const wait = SEND_MS - (Date.now() - C.sentAt);
    if(wait <= 0) send(); else if(!C.t) C.t = setTimeout(send, wait);
  }
  function leave(){ if(C.last){ C.last = null; send(true); } }
  // Мышь стоит на месте: повторяем позицию, иначе остальные погасят курсор через 3 секунды
  const keepAlive = () => { if(C.on && C.last && Date.now() - C.sentAt >= KEEP_MS) send(); };
  addEventListener('pointermove', onMove, { passive:true });
  document.documentElement.addEventListener('pointerleave', leave);
  addEventListener('pagehide', leave);
  addEventListener('blur', leave);

  // ---------- чужие курсоры ----------
  function make(p){
    p.el = document.createElement('div'); p.el.className = 'cur';
    p.el.innerHTML = '<svg viewBox="0 0 16 22" width="16" height="22" aria-hidden="true"><path d="M1 1v17l4.6-4.2 3.1 7 2.8-1.2-3-6.9H15z" fill="currentColor" stroke="#000a" stroke-width="1.2" stroke-linejoin="round"/></svg><span></span>';
    p.box = document.createElement('div'); p.box.className = 'curBox'; p.box.hidden = true; p.box.innerHTML = '<span></span>';
    p.el.style.setProperty('--c', colorOf(p.id)); p.box.style.setProperty('--c', colorOf(p.id));
    layer.append(p.box, p.el);
  }
  function paint(p){
    p.el.style.left = p.x+'%'; p.el.style.top = p.y+'%';
    const label = labelOf(p);
    p.el.lastChild.textContent = label; p.box.lastChild.textContent = label;
    // что тянет или выделил другой модератор: лёгкая рамка, ничего не блокирует
    const id = p.d || p.s, node = id ? elLayer.querySelector(`[data-id="${CSS.escape(id)}"]`) : null;
    const r = node?.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if(!r || !r.width || !s.width){ p.box.hidden = true; return; }
    Object.assign(p.box.style, { left:(r.left-s.left)+'px', top:(r.top-s.top)+'px', width:r.width+'px', height:r.height+'px' });
    p.box.classList.toggle('drag', !!p.d);
    p.box.hidden = false;
  }
  function drop(id){ const p = peers.get(id); if(!p) return; p.el.remove(); p.box.remove(); peers.delete(id); }
  function sweep(){
    const now = Date.now();
    for(const p of [...peers.values()]) if(now - p.at > TTL_MS) drop(p.id);
    if(!peers.size){ clearInterval(C.gc); C.gc = null; }
    else for(const p of peers.values()) if(p.d || p.s) paint(p);   // элемент мог сдвинуться или исчезнуть
  }
  function msg(m){
    if(!C.on || !m || typeof m!=='object' || Array.isArray(m)) return;
    const id = typeof m.id==='string' ? m.id : '';
    if(!SAFE.test(id) || id===clientId) return;
    if(m.off){ drop(id); return; }
    const x = typeof m.x==='number' ? m.x : NaN, y = typeof m.y==='number' ? m.y : NaN;
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;
    let p = peers.get(id);
    if(!p){
      for(const q of [...peers.values()]) if(Date.now() - q.at > TTL_MS) drop(q.id);
      if(peers.size >= MAX) return;
      p = { id, n:'', x:0, y:0, s:'', d:'', at:0 }; peers.set(id, p); make(p);
    }
    p.x = Math.min(100, Math.max(0, x)); p.y = Math.min(100, Math.max(0, y));
    p.n = typeof m.n==='string' ? clean(m.n) : '';
    p.s = typeof m.s==='string' && SAFE.test(m.s) ? m.s : ''; p.d = typeof m.d==='string' && SAFE.test(m.d) ? m.d : '';
    p.at = Date.now();
    if(p.n && (nicks.size < 200 || nicks.has(id))) nicks.set(id, p.n);
    paint(p);
    if(!C.gc) C.gc = setInterval(sweep, 500);
  }
  function clear(){ for(const id of [...peers.keys()]) drop(id); clearInterval(C.gc); C.gc = null; }
  // Смена комнаты: чужие курсоры старой комнаты уходят, свой сбрасывается
  function reset(){ clear(); clearTimeout(C.t); C.t = null; C.last = null; }

  // ---------- включатель и ник ----------
  function setOn(v){
    if(!v && C.on && client?.connected) sealedPublish(topics(room).base+'/cur', { id:clientId, off:1 }, { qos:0 }).catch(()=>{});
    C.on = !!v; lsSet(KEY, C.on); layer.hidden = !C.on; $('curOn').checked = C.on;
    if(C.on){ if(!C.keep) C.keep = setInterval(keepAlive, KEEP_MS/2); }
    else { reset(); clearInterval(C.keep); C.keep = null; }
  }
  $('curOn').onchange = e => setOn(e.target.checked);
  $('curName').value = C.name;
  $('curName').oninput = e => { C.name = clean(e.target.value); lsSet(NAME, C.name); };
  $('curOn').checked = C.on;
  if(C.on) C.keep = setInterval(keepAlive, KEEP_MS/2);

  // имя участника для списка слоёв: ник курсора, иначе короткое «мод N» с тем же номером, что у курсора
  const nameOf = id => nicks.get(id) || `${tr('мод')} ${numOf(id)}`;

  return { msg, reset, peers, nameOf, get on(){ return C.on; } };
})();
