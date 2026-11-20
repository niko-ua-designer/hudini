// Пролёты камеры CS2: редактор путей во вкладке CS2. Маршруты и настройки хранит и проверяет Hudini Host (data/cs2-flights.json),
// пульт показывает то, что Host прислал в теме cs2series (CS2_SERIES.fl), и шлёт подписанные команды {op:'fl', a:…} в cs2cmd.
// Здесь нет ни одной консольной команды игры: числа уходят Host, а он сам собирает spec_goto / getpos / spec_mode.
(function(){
  'use strict';
  const KINDS = [['freeze', 'Закупка'], ['tech', 'Тех. пауза'], ['timeout', 'Таймаут'], ['warmup', 'Разминка']];
  const r2 = x => Math.round(Number(x) * 100) / 100 || 0;
  let selId = '', draft = null, sel = -1, busy = false, seq = 0;
  const fl = () => CS2_SERIES?.fl || null;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; };
  const cmd = o => { const f = fl(); return serCmd({ op:'fl', ...(f?.edit ? { map:f.edit } : {}), ...o }); };
  const strip = r => JSON.stringify({ n:r.name, d:r.dur || 0, t:r.trg, p:r.pts.map(q => [q.p.map(r2), q.a.map(r2), r2(q.t || 0), q.j ? 1 : 0]) });
  const hostRoute = () => fl()?.routes.find(r => r.id === selId) || null;
  // маршрут, который сейчас показываем: свой черновик, пока Host не подтвердил (или 3 с)
  function cur(){
    const h = hostRoute();
    if(draft && (!h || draft.id !== h.id || Date.now() - draft.t > 3000 || strip(draft.route) === strip(h))) draft = null;
    return draft ? draft.route : h;
  }
  function commit(route){
    route = { ...route, pts:route.pts.slice(0, 40).map(q => ({ p:q.p.map(r2), a:q.a.map(r2), t:Math.max(0, r2(q.t || 0)), j:q.j ? 1 : 0 })) };
    draft = { id:selId, route, t:Date.now() };
    cmd({ a:'set', id:selId, q:(seq = Math.max(seq + 1, Date.now())), route:{ name:route.name, dur:route.dur || 0, trg:route.trg, pts:route.pts } });
    render();
  }
  const edit = fn => { const r = cur(); if(!r) return; const c = JSON.parse(JSON.stringify(r)); fn(c); commit(c); };

  // ---------- радар ----------
  function projection(map, pts){
    if(typeof CS2_MAPS !== 'undefined' && Object.hasOwn(CS2_MAPS, map)) return { cal:true, to:p => cs2MapUV(map, p), from:uv => cs2MapXY(map, uv) };
    const xs = pts.map(q => q.p[0]), ys = pts.map(q => q.p[1]), x0 = Math.min(...xs, 0), x1 = Math.max(...xs, 1), y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 1);
    const span = Math.max(800, x1 - x0, y1 - y0) * 1.3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { cal:false, to:p => [(p[0] - cx) / span + .5, (cy - p[1]) / span + .5], from:uv => [cx + (uv[0] - .5) * span, cy - (uv[1] - .5) * span] };
  }
  const NS = 'http://www.w3.org/2000/svg';
  function drawRadar(box, r, map){
    const pts = r.pts, pr = projection(map, pts), S = 1000;
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${S} ${S}`); svg.classList.add('fl-svg');
    const mk = (n, a) => { const e = document.createElementNS(NS, n); for(const k in a) e.setAttribute(k, a[k]); return e; };
    const uv = pts.map(q => pr.to(q.p) || [.5, .5]), xy = i => [uv[i][0] * S, uv[i][1] * S];
    for(let i = 1; i < pts.length; i++){
      const a = xy(i - 1), b = xy(i);
      svg.appendChild(mk('line', { x1:a[0], y1:a[1], x2:b[0], y2:b[1], class:'fl-seg' + (pts[i].j ? ' cut' : '') }));
    }
    pts.forEach((q, i) => {
      const c = xy(i), g = mk('g', { class:'fl-pt' + (i === sel ? ' on' : ''), transform:`translate(${c[0]} ${c[1]})` });
      g.append(mk('circle', { r:20 }), Object.assign(mk('text', { y:7, 'text-anchor':'middle' }), { textContent:String(i + 1) }));
      g.addEventListener('pointerdown', e => {
        e.preventDefault(); sel = i; busy = true; g.setPointerCapture(e.pointerId);
        const rc = svg.getBoundingClientRect(), move = ev => {
          const u = Math.min(1, Math.max(0, (ev.clientX - rc.left) / rc.width)), v = Math.min(1, Math.max(0, (ev.clientY - rc.top) / rc.height));
          const w = pr.from([u, v]); if(!w) return;
          g.setAttribute('transform', `translate(${u * S} ${v * S})`); g._w = w;
        };
        const up = () => { busy = false; g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up);
          if(g._w) edit(c2 => { c2.pts[i].p[0] = g._w[0]; c2.pts[i].p[1] = g._w[1]; }); else render(); };
        g.addEventListener('pointermove', move); g.addEventListener('pointerup', up);
      });
      svg.appendChild(g);
    });
    const img = typeof cs2RadarImg === 'function' ? cs2RadarImg(map, 'glass', false) : '';
    box.replaceChildren();
    if(img){ const im = document.createElement('img'); im.src = img; im.alt = ''; im.draggable = false; im.className = 'fl-img'; box.appendChild(im); }
    box.classList.toggle('grid', !img); box.appendChild(svg);
  }

  // ---------- список точек ----------
  function num(v, step, on, w){
    const i = document.createElement('input'); i.type = 'number'; i.step = step; i.value = String(r2(v)); if(w) i.style.width = w;
    i.addEventListener('change', () => { const n = Number(i.value); on(Number.isFinite(n) ? n : 0); }); return i;
  }
  function drawPts(box, r){
    box.replaceChildren(...r.pts.map((q, i) => {
      const row = el('div', 'fl-row' + (i === sel ? ' on' : '')), n = el('b', 'fl-n', String(i + 1)); n.draggable = true; n.title = 'Потяни, чтобы поменять порядок';
      n.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'fl' + i); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragover', e => e.preventDefault());
      row.addEventListener('drop', e => { const m = /^fl(\d+)$/.exec(e.dataTransfer.getData('text/plain')); if(!m) return; e.preventDefault();
        const from = Number(m[1]); if(from === i) return; edit(c => { const [x] = c.pts.splice(from, 1); c.pts.splice(i, 0, x); }); sel = i; });
      row.addEventListener('click', e => { if(e.target.closest('input,button')) return; if(sel !== i){ sel = i; render(); } });
      const f = (get, set, st) => num(get(), st, v => edit(c => set(c.pts[i], v)));
      const cut = document.createElement('input'); cut.type = 'checkbox'; cut.checked = !!q.j; cut.disabled = i === 0; cut.title = 'Обрыв: камера прыгает в эту точку, без плавного пролёта';
      cut.addEventListener('change', () => edit(c => { c.pts[i].j = cut.checked ? 1 : 0; }));
      const del = el('button', 'fl-x', '✕'); del.title = 'Убрать точку'; del.addEventListener('click', e => { e.stopPropagation(); edit(c => { c.pts.splice(i, 1); }); sel = -1; });
      const t = f(() => q.t || 0, (p, v) => { p.t = Math.max(0, v); }, '0.1'); t.title = 'Секунд от прошлой точки (0 — поровну)'; t.min = 0;
      row.append(n, f(() => q.p[0], (p, v) => { p.p[0] = v; }, '1'), f(() => q.p[1], (p, v) => { p.p[1] = v; }, '1'), f(() => q.p[2], (p, v) => { p.p[2] = v; }, '1'),
        f(() => q.a[0], (p, v) => { p.a[0] = v; }, '1'), f(() => q.a[1], (p, v) => { p.a[1] = v; }, '1'), t, cut, del);
      return row;
    }));
    if(r.pts.length){ const head = el('div', 'fl-row fl-head'); head.append(...['№', 'x', 'y', 'z', 'pitch', 'yaw', 'сек', '⤳', ''].map(t => el('span', null, t))); box.prepend(head); }
  }

  // ---------- цепочки ----------
  function drawChains(box, f){
    const sig = JSON.stringify([f.chains, f.routes.map(r => [r.id, r.name]), f.edit]);
    if(box._sig === sig || box.contains(document.activeElement)) return; box._sig = sig;
    box.replaceChildren(...KINDS.map(([k, label]) => {
      const steps = (f.chains?.[k] || []).map(q => ({ ...q })), wrap = el('div', 'fl-chain');
      const save = () => cmd({ a:'chain', kind:k, steps });
      wrap.appendChild(el('b', null, label));
      steps.forEach((q, i) => {
        const row = el('div', 'fl-step'), s = document.createElement('select');
        for(const r of f.routes){ const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; s.appendChild(o); }
        s.value = q.id; s.addEventListener('change', () => { q.id = s.value; save(); });
        row.appendChild(s);
        if(i > 0){
          const j = document.createElement('select'); for(const [v, t] of [['smooth', 'плавно'], ['cut', 'обрыв']]){ const o = document.createElement('option'); o.value = v; o.textContent = t; j.appendChild(o); }
          j.value = q.join; j.title = 'Как перейти от прошлого пути'; j.addEventListener('change', () => { q.join = j.value; save(); });
          const p = document.createElement('input'); p.type = 'number'; p.min = 0; p.max = 60; p.step = .5; p.value = q.pause; p.title = 'Пауза перед этим путём, секунд (камера стоит)'; p.style.width = '56px';
          p.addEventListener('change', () => { q.pause = Math.max(0, Number(p.value) || 0); save(); });
          row.append(j, p);
        }
        const x = el('button', 'fl-x', '✕'); x.addEventListener('click', () => { steps.splice(i, 1); save(); }); row.appendChild(x);
        wrap.appendChild(row);
      });
      const add = el('button', null, '＋ Путь'); add.disabled = !f.routes.length || steps.length >= 6;
      add.addEventListener('click', () => { steps.push({ id:f.routes[0].id, join:'smooth', pause:0 }); save(); });
      const run = el('button', null, '▶ Прогнать'); run.title = 'Показать этот момент в игре'; run.addEventListener('click', () => cmd({ a:'preview', kind:k }));
      const b = el('div', 'row'); b.append(add, run); wrap.appendChild(b);
      return wrap;
    }));
  }

  // ---------- главный рендер ----------
  function render(){
    const f = fl(), pane = $('flOn'); if(!pane || busy) return;
    $('flBody').hidden = true;
    if(!f){ $('flNote').textContent = 'Пролёты появятся, когда программа стримера подключена.'; return; }
    setField($('flOn'), f.on, 'checked'); setField($('flPort'), String(f.port)); setField($('flPick'), f.pick); setField($('flRet'), String(f.returnMode === 5 ? 5 : 4));
    $('flLink').textContent = !f.on ? '' : f.link ? '● есть связь' : f.spec ? '○ нет связи' : '○ ждёт наблюдателя';
    $('flNote').textContent = f.note || '';
    // карта
    const maps = new Set([...(typeof CS2_MAPS !== 'undefined' ? Object.keys(CS2_MAPS) : []), ...f.maps.map(m => m[0]), f.map, f.edit].filter(Boolean));
    const ms = $('flMap'); if(!ms.contains(document.activeElement)){
      const sig = [...maps].join(',');
      if(ms._sig !== sig){ ms._sig = sig; ms.replaceChildren(...[...maps].map(m => { const o = document.createElement('option'); o.value = m; const n = f.maps.find(x => x[0] === m)?.[1]; o.textContent = m + (n ? ` (${n})` : ''); return o; })); }
      if(f.edit && ms.value !== f.edit) ms.value = f.edit;
    }
    // список путей
    const rs = $('flRoute');
    if(!f.routes.some(r => r.id === selId)){ selId = f.routes[0]?.id || ''; sel = -1; }
    if(!rs.contains(document.activeElement)){
      const sig = JSON.stringify(f.routes.map(r => [r.id, r.name, r.pts.length]));
      if(rs._sig !== sig){ rs._sig = sig; rs.replaceChildren(...f.routes.map(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = `${r.name} · ${r.pts.length}`; return o; })); if(!f.routes.length){ const o = document.createElement('option'); o.textContent = 'Путей на этой карте нет'; rs.replaceChildren(o); } }
      rs.value = selId;
    }
    const r = cur(); $('flBody').hidden = !r;
    $('flDel').disabled = $('flDup').disabled = !r;
    drawChains($('flChains'), f);
    if(!r) return;
    setField($('flName'), r.name); setField($('flDur'), String(r.dur || 0));
    for(const [k] of KINDS) setField($('flT' + k), !!r.trg[k], 'checked');
    const ae = document.activeElement;
    const sig = strip(r) + '|' + sel + '|' + f.edit;
    if(!($('flPts').contains(ae) && ae.tagName === 'INPUT') && $('flPts')._sig !== sig){ $('flPts')._sig = sig; drawPts($('flPts'), r); }
    if($('flRadar')._sig !== sig){ $('flRadar')._sig = sig; drawRadar($('flRadar'), r, f.edit); }
    $('flPrev').disabled = !f.on || !f.spec; $('flAddGame').disabled = !f.on || !f.spec;
    $('flStop').disabled = !f.flying;
  }
  window.renderFlights = render;

  // ---------- события ----------
  $('flOn').addEventListener('change', e => cmd({ a:'cfg', on:e.target.checked }));
  $('flPort').addEventListener('change', e => { const n = Number(e.target.value); if(Number.isInteger(n) && n >= 1024 && n <= 65535) cmd({ a:'cfg', port:n }); else toast('Порт от 1024 до 65535'); });
  $('flPick').addEventListener('change', e => cmd({ a:'cfg', pick:e.target.value }));
  $('flRet').addEventListener('change', e => cmd({ a:'cfg', returnMode:Number(e.target.value) }));
  $('flMap').addEventListener('change', e => { selId = ''; draft = null; cmd({ a:'edit', map:e.target.value }); });
  $('flRoute').addEventListener('change', e => { selId = e.target.value; draft = null; sel = -1; render(); });
  $('flNew').onclick = () => { const n = (fl()?.routes.length || 0) + 1; cmd({ a:'new', name:'Route ' + n }); };
  $('flDup').onclick = () => cmd({ a:'dup', id:selId });
  $('flDel').onclick = () => { if(confirm('Удалить этот путь?')) { cmd({ a:'del', id:selId }); selId = ''; } };
  $('flName').addEventListener('change', e => edit(c => { c.name = e.target.value.trim().slice(0, 40) || c.name; }));
  $('flDur').addEventListener('change', e => edit(c => { c.dur = Math.max(0, Math.min(300, Number(e.target.value) || 0)); }));
  for(const [k] of KINDS) $('flT' + k).addEventListener('change', e => edit(c => { c.trg[k] = e.target.checked; }));
  $('flAddGame').onclick = () => cmd({ a:'point', id:selId });
  $('flAddMan').onclick = () => edit(c => { const l = c.pts[c.pts.length - 1]; if(c.pts.length < 40) c.pts.push({ p:l ? l.p.map((x, i) => i < 2 ? x + 100 : x) : [0, 0, 100], a:l ? l.a.slice() : [0, 0, 0], t:0, j:0 }); sel = c.pts.length - 1; });
  $('flPrev').onclick = () => cmd({ a:'preview', id:selId });
  $('flStop').onclick = () => cmd({ a:'stop' });
  $('flExp').onclick = () => {
    const r = cur(); if(!r) return;
    const blob = new Blob([JSON.stringify({ hudini:'cs2-flight', v:1, map:fl().edit, route:{ name:r.name, dur:r.dur || 0, trg:r.trg, pts:r.pts } }, null, 1)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `flight-${fl().edit}-${r.name.replace(/[^\w-]+/g, '_').slice(0, 30)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('flImp').onclick = () => $('flImpFile').click();
  $('flImpFile').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if(!file) return;
    try{
      if(file.size > 40000) throw 0;
      const j = JSON.parse(await file.text());
      if(j?.hudini !== 'cs2-flight' || !j.route || typeof j.route !== 'object') throw 0;
      cmd({ a:'import', route:{ name:j.route.name, dur:j.route.dur, trg:j.route.trg, pts:j.route.pts } }); toast('Путь добавлен');
    }catch{ toast('Это не файл пути Hudini'); }
  });
  setInterval(() => { if($('flOn')?.offsetParent !== null) render(); }, 500);
  render();
})();
