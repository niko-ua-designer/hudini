// Hudini panel: your own layout (stored only in this browser), first-run tour, help menu,
// a prompt for persistent browser storage and small contextual animations. Loaded after moderator.js.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'hudini.ui', BAK = 'hudini.ui.bak';
  const HELP_URL = 'help.html';
  const ISSUES_URL = 'https://github.com/niko-ua-designer/overlay/issues';
  const TABS = ['add', 'scenes', 'chat', 'auto', 'room'];
  const DEF = { v:1, lw:300, rw:310, swap:false, compact:false, fs:14, motion:'auto', free:false, win:{}, tabs:TABS.slice(), fold:{}, tour:0, persist:0 };
  // Ready layouts: one click, then everything can still be tuned by hand
  const PRESETS = {
    classic:{ name:'Классика', lw:300, rw:310, compact:false, fs:14, free:false },
    stage:{ name:'Большой холст', lw:250, rw:270, compact:true, fs:13, free:false },
    laptop:{ name:'Ноутбук', lw:240, rw:255, compact:true, fs:12, free:false },
    free:{ name:'Свободные окна', compact:true, fs:13, free:true },
  };

  // ---------- settings: load with fallback ----------
  // Anything odd in storage is rejected field by field; if parsing fails we fall back to the last good copy, then to defaults.
  function clean(o){
    if(!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('not an object');
    const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d;
    const tabs = Array.isArray(o.tabs) ? o.tabs.filter(t => TABS.includes(t)) : [];
    for(const t of TABS) if(!tabs.includes(t)) tabs.push(t);
    const fold = {};
    if(o.fold && typeof o.fold === 'object') for(const [k, v] of Object.entries(o.fold).slice(0, 80)) if(/^[a-z]+:\d{1,2}$/.test(k) && v === true) fold[k] = true;
    const win = {};
    for(const k of ['left', 'right']){ const w = o.win?.[k]; if(w && typeof w === 'object') win[k] = { x:n(w.x, 0, 8000, 0), y:n(w.y, 0, 8000, 0), w:n(w.w, 220, 1400, 300), h:n(w.h, 200, 3000, 600) }; }
    return { v:1, lw:n(o.lw, 220, 560, DEF.lw), rw:n(o.rw, 240, 600, DEF.rw), swap:o.swap === true, compact:o.compact === true,
      fs:n(o.fs, 12, 17, DEF.fs), motion:['auto', 'bright', 'soft', 'min'].includes(o.motion) ? o.motion : 'auto', free:o.free === true, win, tabs:[...new Set(tabs)], fold,
      tour:n(o.tour, 0, 99, 0), persist:n(o.persist, 0, 4e12, 0) };
  }
  const read = k => { const raw = localStorage.getItem(k); return raw == null ? null : clean(JSON.parse(raw)); };
  let ui = { ...DEF }, loadNote = '';
  try{ ui = read(KEY) || { ...DEF }; }
  catch(e){
    console.warn('ui settings', e);
    try{ const b = read(BAK); if(b){ ui = b; loadNote = 'Настройки вида не загрузились: вернул прошлую сохранённую версию'; } else throw 0; }
    catch{ ui = { ...DEF }; loadNote = 'Настройки вида не загрузились: вернул стандартные'; }
  }
  let saveT = null;
  function save(){
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try{
        const prev = localStorage.getItem(KEY);
        if(prev){ try{ clean(JSON.parse(prev)); localStorage.setItem(BAK, prev); }catch{} }   // keep the last good copy
        localStorage.setItem(KEY, JSON.stringify(ui));
      }catch(e){ console.warn(e); }
    }, 300);
  }

  // ---------- apply ----------
  function apply(){
    const b = document.body;
    b.style.setProperty('--lw', ui.lw + 'px'); b.style.setProperty('--rw', ui.rw + 'px'); b.style.setProperty('--fs', ui.fs + 'px');
    b.classList.toggle('swap', ui.swap); b.classList.toggle('compact', ui.compact);
    // motion: "auto" follows the system setting (reduced motion → almost none), otherwise soft
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = ui.motion === 'auto' ? (reduce ? 'min' : 'soft') : ui.motion;
    b.classList.toggle('nomotion', m === 'min'); b.classList.toggle('motion', m !== 'min'); b.classList.toggle('bright', m === 'bright');
    b.classList.toggle('free', ui.free);
    placeWindows();
    const nav = $('tabs');
    for(const t of ui.tabs){ const btn = nav.querySelector(`[data-tab="${t}"]`); if(btn) nav.appendChild(btn); }
    document.querySelectorAll('aside section h2.fold').forEach(h => setFold(h, !!ui.fold[h.dataset.fold]));
    window.dispatchEvent(new Event('resize'));   // the stage re-fits to the new column widths
  }
  function setFold(h, closed){
    h.classList.toggle('closed', closed);
    for(let n = h.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) n.classList.toggle('sec-hide', closed);
  }

  // ---------- free windows: the side panels float over the canvas ----------
  const WIN = { left:'Инструменты', right:'Слои и настройки' };
  function defWin(k){ const top = Math.round(($('toolbar')?.getBoundingClientRect().bottom || 100) + 10);
    return k === 'left' ? { x:12, y:top, w:300, h:Math.max(300, innerHeight - top - 24) } : { x:Math.max(12, innerWidth - 332), y:top, w:320, h:Math.max(300, innerHeight - top - 24) }; }
  function placeWindows(){
    for(const k of ['left', 'right']){
      const el = $(k); if(!el) continue;
      if(!ui.free){ el.style.cssText = ''; continue; }
      const w = ui.win[k] || defWin(k);
      const W = Math.min(w.w, innerWidth - 16), H = Math.min(w.h, innerHeight - 16);
      Object.assign(el.style, { left:Math.max(0, Math.min(innerWidth - 80, w.x)) + 'px', top:Math.max(0, Math.min(innerHeight - 40, w.y)) + 'px', width:W + 'px', height:H + 'px' });
    }
  }
  function windows(){
    for(const k of ['left', 'right']){
      const el = $(k);
      const bar = document.createElement('div'); bar.className = 'winbar'; bar.title = 'Потяни, чтобы передвинуть окно';
      bar.innerHTML = `<span>⠿ ${WIN[k]}</span><button title="Вернуть панели на место (раскладка «Классика»)">📌</button>`;
      el.prepend(bar);
      bar.querySelector('button').onclick = () => usePreset('classic');
      bar.addEventListener('pointerdown', e => {
        if(e.target.closest('button') || !ui.free) return;
        e.preventDefault(); bar.setPointerCapture(e.pointerId);
        const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        const move = ev => { ui.win[k] = { ...(ui.win[k] || defWin(k)), x:Math.round(ev.clientX - dx), y:Math.round(ev.clientY - dy) }; placeWindows(); };
        const up = () => { bar.removeEventListener('pointermove', move); save(); };
        bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up, { once:true }); bar.addEventListener('pointercancel', up, { once:true });
      });
      // the native corner resize; remember the size
      new ResizeObserver(() => {
        if(!ui.free) return;
        const r = el.getBoundingClientRect(), w = ui.win[k] || defWin(k);
        if(Math.abs(r.width - w.w) > 2 || Math.abs(r.height - w.h) > 2){ ui.win[k] = { ...w, w:Math.round(r.width), h:Math.round(r.height) }; save(); }
      }).observe(el);
    }
    addEventListener('resize', placeWindows);
  }
  function usePreset(key){
    const p = PRESETS[key]; if(!p) return;
    const { name, ...vals } = p;
    ui = { ...ui, ...vals }; if(!p.free) ui.win = ui.win || {};
    apply(); save(); syncSettings();
    toast('Раскладка: ' + name);
  }
  let syncSettings = () => {};

  // ---------- column resizers ----------
  function resizers(){
    const main = $('wrap');
    for(const [id, side] of [['rzL', 'lw'], ['rzR', 'rw']]){
      const r = document.createElement('div'); r.className = 'rz'; r.id = id; r.title = 'Потяни, чтобы изменить ширину · двойной клик — по умолчанию';
      main.appendChild(r);
      r.addEventListener('pointerdown', e => {
        e.preventDefault(); r.setPointerCapture(e.pointerId); r.classList.add('on');
        const x0 = e.clientX, w0 = ui[side];
        // left resizer grows the column on its side; with swapped columns the sides flip
        const sign = (id === 'rzL') !== ui.swap ? 1 : -1;
        const move = ev => { ui[side] = Math.min(side === 'lw' ? 560 : 600, Math.max(side === 'lw' ? 220 : 240, w0 + sign * (ev.clientX - x0))); apply(); };
        const up = () => { r.classList.remove('on'); r.removeEventListener('pointermove', move); save(); };
        r.addEventListener('pointermove', move); r.addEventListener('pointerup', up, { once:true }); r.addEventListener('pointercancel', up, { once:true });
      });
      r.addEventListener('dblclick', () => { ui[side] = DEF[side]; apply(); save(); });
    }
  }

  // ---------- tabs: drag to reorder ----------
  function dragTabs(){
    const nav = $('tabs');
    nav.querySelectorAll('button').forEach(b => {
      b.draggable = true;
      b.addEventListener('dragstart', e => { b.classList.add('dragging'); e.dataTransfer.setData('text/x-hudini-tab', b.dataset.tab); e.dataTransfer.effectAllowed = 'move'; });
      b.addEventListener('dragend', () => { b.classList.remove('dragging'); nav.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over')); });
      b.addEventListener('dragover', e => { if(e.dataTransfer.types.includes('text/x-hudini-tab')){ e.preventDefault(); b.classList.add('drag-over'); } });
      b.addEventListener('dragleave', () => b.classList.remove('drag-over'));
      b.addEventListener('drop', e => {
        e.preventDefault(); b.classList.remove('drag-over');
        const t = e.dataTransfer.getData('text/x-hudini-tab'), moving = nav.querySelector(`[data-tab="${t}"]`);
        if(!moving || moving === b) return;
        nav.insertBefore(moving, b);
        ui.tabs = [...nav.querySelectorAll('button')].map(x => x.dataset.tab).filter(x => TABS.includes(x)); save();
      });
    });
  }

  // ---------- foldable sections ----------
  function folds(){
    document.querySelectorAll('aside section[data-pane]').forEach(sec => {
      [...sec.children].filter(c => c.tagName === 'H2').forEach((h, i) => {
        h.classList.add('fold'); h.dataset.fold = sec.dataset.pane + ':' + i; h.title = 'Свернуть / развернуть';
        h.addEventListener('click', e => {
          if(e.target.closest('button,input,select,a,.pill')) return;
          const closed = !h.classList.contains('closed'); setFold(h, closed);
          if(closed) ui.fold[h.dataset.fold] = true; else delete ui.fold[h.dataset.fold];
          save();
        });
      });
    });
  }

  // ---------- settings section (Комната) ----------
  function settingsSection(){
    const box = document.createElement('div'); box.className = 'uiset';
    box.innerHTML = `
      <h2>🎛 Вид пульта</h2>
      <div class="hint">Колонки можно тянуть за край, вкладки перетаскивать, разделы сворачивать кликом по заголовку. Вид хранится только в этом браузере.</div>
      <div class="row"><label class="hint">Размер текста</label><select id="uiFs"><option value="12">Мелкий</option><option value="13">Компактный</option><option value="14">Обычный</option><option value="15">Крупный</option><option value="16">Очень крупный</option></select></div>
      <div class="hint" style="margin-top:6px">Раскладка</div>
      <div class="grid2" id="uiPresets">${Object.entries(PRESETS).map(([k, p]) => `<button data-preset="${k}">${p.name}</button>`).join('')}</div>
      <div class="row"><label class="hint">Анимации</label><select id="uiMotion"><option value="auto">Как в системе</option><option value="bright">Яркие</option><option value="soft">Мягкие</option><option value="min">Почти без</option></select></div>
      <label class="chk"><input type="checkbox" id="uiSwap"> Поменять колонки местами</label>
      <label class="chk"><input type="checkbox" id="uiCompact"> Компактный режим (меньше отступов)</label>
      <div class="grid2">
        <button id="uiExport" title="Файл с видом пульта: можно перенести в другой браузер">⬇ Сохранить вид</button>
        <button id="uiImport">⬆ Загрузить вид</button>
        <button id="uiReset" style="grid-column:span 2">↺ Стандартный вид</button>
      </div>
      <input type="file" id="uiFile" accept=".json,application/json" hidden>
      <div class="row"><button id="uiPersist" class="grow" title="Чтобы браузер не удалил комнаты, ключи и сцены сам">💾 Надёжное хранение в браузере</button></div>
      <div class="hint" id="uiPersistInfo"></div>`;
    const keys = [...document.querySelectorAll('section[data-pane="room"] h2')].find(h => /Клавиши/.test(h.textContent));
    (keys ? keys.parentNode.insertBefore(box, keys) : document.querySelector('section[data-pane="room"]').appendChild(box));
    box.replaceWith(...box.childNodes);   // the heading becomes a normal section heading that folds like the others
    const sync = () => { $('uiFs').value = String(ui.fs); $('uiMotion').value = ui.motion; $('uiSwap').checked = ui.swap; $('uiCompact').checked = ui.compact;
      document.querySelectorAll('#uiPresets button').forEach(b => b.classList.toggle('on', presetNow() === b.dataset.preset)); };
    syncSettings = sync; sync();
    document.querySelectorAll('#uiPresets button').forEach(b => b.onclick = () => usePreset(b.dataset.preset));
    $('uiFs').onchange = e => { ui.fs = +e.target.value; apply(); save(); };
    $('uiMotion').onchange = e => { ui.motion = e.target.value; apply(); save(); };
    $('uiSwap').onchange = e => { ui.swap = e.target.checked; apply(); save(); };
    $('uiCompact').onchange = e => { ui.compact = e.target.checked; apply(); save(); };
    $('uiReset').onclick = () => { const keep = { tour:ui.tour, persist:ui.persist }; ui = { ...DEF, tabs:TABS.slice(), fold:{}, win:{}, ...keep }; apply(); save(); sync(); toast('↺ Вернул стандартный вид'); };
    $('uiExport').onclick = () => {
      const blob = new Blob([JSON.stringify({ hudiniUi:1, lang:window.HudiniI18n?.lang, ui }, null, 2)], { type:'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hudini-view.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('⬇ Вид пульта сохранён в файл');
    };
    $('uiImport').onclick = () => $('uiFile').click();
    $('uiFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if(!f) return;
      try{
        if(f.size > 64 * 1024) throw new Error('слишком большой файл');
        const j = JSON.parse(await f.text());
        if(j?.hudiniUi !== 1) throw new Error('это не файл вида Hudini');
        ui = { ...clean(j.ui), tour:ui.tour, persist:ui.persist }; apply(); save(); sync();
        toast('⬆ Вид пульта загружен');
      }catch(err){ toast('Не загрузилось: ' + (err.message || err), 4000); }
    };
    $('uiPersist').onclick = () => askPersist(true);
    persistInfo();
  }

  function presetNow(){
    for(const [k, p] of Object.entries(PRESETS)){ const { name, ...v } = p; if(Object.entries(v).every(([f, x]) => ui[f] === x)) return k; }
    return '';
  }

  // ---------- persistent storage ----------
  async function persistInfo(){
    const el = $('uiPersistInfo'); if(!el) return;
    if(!navigator.storage?.persisted){ el.textContent = 'Этот браузер не умеет надёжное хранение: делай бэкап (⬇ Бэкап выше).'; return; }
    const ok = await navigator.storage.persisted().catch(() => false);
    el.textContent = ok ? '✓ Браузер не удалит данные пульта сам.' : 'Сейчас браузер может удалить данные пульта, если мало места на диске.';
    $('uiPersist').hidden = ok;
  }
  async function askPersist(fromButton){
    if(!navigator.storage?.persist) return fromButton && toast('Этот браузер не умеет надёжное хранение: делай бэкап', 4000);
    if(await navigator.storage.persisted().catch(() => false)) return fromButton && toast('✓ Уже включено');
    $('persistBox')?.remove();
    const box = document.createElement('div'); box.id = 'persistBox';
    box.innerHTML = `<h3>💾 Чтобы ничего не пропало</h3>
      <p>Комнаты, ключи, сцены, библиотека и вид пульта хранятся только в этом браузере, на сервер они не уходят. Если на диске мало места, браузер может удалить их сам. Разреши хранить их постоянно: браузер спросит или решит сам, данные по-прежнему никуда не отправляются.</p>
      <div class="row"><button class="primary grow" id="persistYes">Разрешить</button><button id="persistNo">Не сейчас</button></div>`;
    document.body.appendChild(box);
    $('persistNo').onclick = () => { box.remove(); ui.persist = Date.now(); save(); };
    $('persistYes').onclick = async () => {
      box.remove(); ui.persist = Date.now(); save();
      const ok = await navigator.storage.persist().catch(() => false);
      toast(ok ? '✓ Готово: браузер не удалит данные пульта сам' : 'Браузер не разрешил. Так бывает: Chrome решает сам. Делай иногда бэкап: Комната → ⬇ Бэкап', ok ? 3500 : 7000);
      persistInfo();
    };
  }
  async function maybeAskPersist(){
    if(!navigator.storage?.persisted || await navigator.storage.persisted().catch(() => true)) return;
    if(ui.persist && Date.now() - ui.persist < 7 * 864e5) return;   // "не сейчас" → снова через неделю
    if(!$('tour') && !$('lock').offsetParent) askPersist(false);
  }

  // ---------- help menu ----------
  function helpButton(){
    const b = document.createElement('button'); b.id = 'helpBtn'; b.textContent = '❓'; b.title = 'Гайд и справка';
    $('passBtn').before(b);
    b.onclick = e => {
      e.stopPropagation();
      if($('helpMenu')){ $('helpMenu').remove(); return; }
      const m = document.createElement('div'); m.id = 'helpMenu';
      const lang = window.HudiniI18n?.lang || 'ru';
      const items = [
        ['🎓 Показать обучение ещё раз', () => tour(0)],
        ['📖 Справка по программе', () => openHelp()],
        ['⌨ Клавиши', () => { showTab('room'); const h = [...document.querySelectorAll('section[data-pane="room"] h2')].find(x => /Клавиши/.test(x.textContent)); if(h){ setFold(h, false); h.scrollIntoView({ behavior:'smooth', block:'start' }); } }],
        ['🎩 Как подключить стримера', () => showHostTip()],
        ['🐞 Сообщить о проблеме', ISSUES_URL],
      ];
      for(const [label, act] of items){
        const it = document.createElement(typeof act === 'string' ? 'a' : 'button');
        it.textContent = label;
        if(typeof act === 'string'){ it.href = act; it.target = '_blank'; it.rel = 'noopener'; }
        else it.onclick = () => { m.remove(); act(); };
        m.appendChild(it);
      }
      document.body.appendChild(m);
      const r = b.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.min(innerWidth - 250, r.left) + 'px';
      setTimeout(() => addEventListener('pointerdown', ev => { if(!m.contains(ev.target)) m.remove(); }, { once:true }), 0);
    };
  }

  // ---------- help drawer: the same texts as help.html on the site ----------
  let helpLoad = null;
  async function openHelp(id){
    if(!window.HUDINI_HELP) await (helpLoad ||= new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'help-content.js?v=1'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); })).catch(() => {});
    const lang = window.HudiniI18n?.lang || 'ru', H = window.HUDINI_HELP?.[lang] || window.HUDINI_HELP?.en;
    if(!H){ window.open(HELP_URL, '_blank', 'noopener'); return; }
    $('helpDrawer')?.remove();
    const d = document.createElement('div'); d.id = 'helpDrawer';
    d.innerHTML = `<div class="hd-top"><b>📖</b><input type="search" id="hdQ"><a id="hdSite" target="_blank" rel="noopener" title="Открыть справку на сайте">↗</a><button id="hdClose" title="Закрыть">✕</button></div><div class="hd-body" data-i18n-skip></div>`;
    document.body.appendChild(d);
    $('hdQ').placeholder = H.search; $('hdSite').href = `${HELP_URL}?lang=${lang}${id ? '#' + id : ''}`;
    const body = d.querySelector('.hd-body');
    for(const [sid, title, html] of H.sections){
      const sec = document.createElement('details'); sec.id = 'hd-' + sid; sec.open = !id || sid === id;
      const sum = document.createElement('summary'); sum.textContent = title; sec.appendChild(sum);
      const c = document.createElement('div'); c.innerHTML = html; sec.appendChild(c);   // trusted text from help-content.js
      body.appendChild(sec);
    }
    $('hdQ').oninput = e => { const w = e.target.value.trim().toLowerCase(); body.querySelectorAll('details').forEach(x => { const ok = !w || x.textContent.toLowerCase().includes(w); x.hidden = !ok; if(w && ok) x.open = true; }); };
    $('hdClose').onclick = () => d.remove();
    if(id) $('hd-' + id)?.scrollIntoView({ block:'start' });
  }
  addEventListener('keydown', e => { if(e.key === 'Escape' && $('helpDrawer') && !$('tour')) $('helpDrawer').remove(); });

  // ---------- guided tour ----------
  const STEPS = [
    { sel:null, title:'👋 Привет! Это Hudini', text:'Отсюда ты показываешь на экране стримера текст, картинки, таймеры и эффекты. Покажу главное за минуту.' },
    { sel:'#left', tab:'add', title:'Добавляй здесь', text:'Текст, картинки, GIF, видео, таймеры и счётчики. Картинку можно просто перетащить на холст или вставить через Ctrl+V.', sample:true },
    { sel:'#stage', title:'Это экран стримера', text:'Всё, что здесь, видно на стриме. Тащи элемент мышкой, меняй размер за уголок, крути за кружок. Ctrl+Z отменяет.' },
    { sel:'#right', title:'Слои и настройки', text:'Кликни по элементу, и здесь появятся цвет, шрифт и анимации. Глазик 👁 прячет элемент со стрима, не удаляя его.' },
    { sel:'#copyLink', title:'Связь со стримером', text:'Нажми «Копировать» и отправь ссылку стримеру. Он вставляет её в программу Hudini Host на своём ПК, и пульт находит его сам.' },
    { sel:'#status', title:'Всё ли на связи', text:'Зелёная точка: программа стримера подключена. Рядом видно, работает ли виджет в OBS. Если что-то не так, нажми на плашку.' },
    { sel:'.lvl', title:'Метки β и α', text:'β: работает, но ещё обкатывается. α: эксперимент. Нажми на метку, чтобы узнать больше или сообщить о проблеме.' },
    { sel:'#helpBtn', title:'Гайд всегда здесь', text:'Кнопка ❓ покажет обучение ещё раз и откроет справку прямо в пульте.' },
    { sel:null, title:'🎛 Настроим под тебя', text:'Выбери, как пульт будет выглядеть. Всё это можно поменять потом: Комната → Вид пульта.', setup:true },
  ];
  function tour(i){
    $('tour')?.remove(); $('helpMenu')?.remove();
    const s = STEPS[i]; if(!s){ endTour(); return; }
    if(s.tab) showTab(s.tab);
    const t = document.createElement('div'); t.id = 'tour';
    t.innerHTML = '<div id="tourHole"></div><div id="tourBox"><h3></h3><p></p><div class="extra"></div><div class="foot"><div class="dots"></div><button id="tourSkip">Пропустить</button><button id="tourBack">Назад</button><button id="tourNext" class="primary"></button></div></div>';
    document.body.appendChild(t);
    t.querySelector('h3').textContent = s.title; t.querySelector('p').textContent = s.text;
    const dots = t.querySelector('.dots'); STEPS.forEach((_, k) => { const d = document.createElement('i'); if(k === i) d.className = 'on'; dots.appendChild(d); });
    $('tourBack').hidden = i === 0;
    $('tourNext').textContent = i === 0 ? 'Поехали' : i === STEPS.length - 1 ? 'Готово' : 'Дальше';
    $('tourSkip').hidden = i === STEPS.length - 1;
    $('tourNext').onclick = () => tour(i + 1); $('tourBack').onclick = () => tour(i - 1); $('tourSkip').onclick = endTour;
    if(s.setup){
      const ex = t.querySelector('.extra');
      const group = (label, items, get, set) => {
        const g = document.createElement('div'); g.className = 'tset';
        const l = document.createElement('div'); l.className = 'hint'; l.textContent = label; g.appendChild(l);
        const row = document.createElement('div'); row.className = 'tchips'; g.appendChild(row);
        const draw = () => row.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(get())));
        for(const [v, name] of items){ const b = document.createElement('button'); b.dataset.v = v; b.textContent = name; b.onclick = () => { set(v); apply(); save(); syncSettings(); draw(); place(); }; row.appendChild(b); }
        draw(); ex.appendChild(g);
      };
      group('Анимации', [['bright', '✨ Яркие'], ['soft', '🌊 Мягкие'], ['min', '· Почти без']], () => ui.motion === 'auto' ? (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'min' : 'soft') : ui.motion, v => { ui.motion = v; });
      group('Раскладка', Object.entries(PRESETS).map(([k, p]) => [k, p.name]), presetNow, v => { const { name, ...vals } = PRESETS[v]; void name; ui = { ...ui, ...vals }; });
      group('Размер текста', [['12', 'A−'], ['14', 'A'], ['16', 'A+']], () => String(ui.fs), v => { ui.fs = +v; });
    }
    if(s.sample){
      const b = document.createElement('button'); b.textContent = '➕ Добавить «Привет, чат! 👋»'; b.className = 'go';
      b.onclick = () => { addText(window.HudiniI18n?.t('Привет, чат! 👋') || 'Привет, чат! 👋'); b.disabled = true; b.textContent = '✓ Добавлено на холст'; };
      t.querySelector('.extra').appendChild(b);
    }
    const target = s.sel && [...document.querySelectorAll(s.sel)].find(n => n.offsetParent);
    const hole = $('tourHole'), box = $('tourBox');
    const place = () => {
      if(!target){ hole.className = 'center'; box.style.left = (innerWidth - box.offsetWidth) / 2 + 'px'; box.style.top = (innerHeight - box.offsetHeight) / 2 + 'px'; return; }
      const r = target.getBoundingClientRect(), pad = 6;
      Object.assign(hole.style, { left:r.left - pad + 'px', top:r.top - pad + 'px', width:r.width + pad * 2 + 'px', height:r.height + pad * 2 + 'px' });
      const bw = box.offsetWidth, bh = box.offsetHeight;
      let x = r.right + 16, y = r.top;                                    // right of the target if it fits,
      if(x + bw > innerWidth - 8) x = r.left - bw - 16;                   // else left,
      if(x < 8){ x = Math.min(innerWidth - bw - 8, Math.max(8, r.left)); y = r.bottom + 14; }   // else below
      if(y + bh > innerHeight - 8) y = Math.max(8, r.top - bh - 14);
      box.style.left = x + 'px'; box.style.top = Math.max(8, Math.min(innerHeight - bh - 8, y)) + 'px';
    };
    requestAnimationFrame(place);
    t._place = place;
  }
  addEventListener('resize', () => $('tour')?._place?.());
  addEventListener('keydown', e => {
    if(!$('tour')) return;
    if(e.key === 'Escape'){ e.stopPropagation(); endTour(); }
  }, true);
  function endTour(){ $('tour')?.remove(); ui.tour = 1; save(); setTimeout(maybeAskPersist, 1500); }

  // ---------- empty stage hint and contextual motion ----------
  function emptyHint(){
    const h = document.createElement('div'); h.id = 'emptyHint';
    h.innerHTML = '<span class="arrow">⬅</span><b>Экран пока пустой</b><span>Добавь текст или картинку слева,<br>или просто перетащи файл сюда</span>';
    $('stage').appendChild(h);
    const sync = () => { h.hidden = !!$('elLayer').children.length; };
    new MutationObserver(sync).observe($('elLayer'), { childList:true }); sync();
  }
  function motionHooks(){
    let ready = false; setTimeout(() => { ready = true; }, 1500);   // no bursts during the first render
    new MutationObserver(muts => {
      if(!ready) return;
      for(const m of muts) for(const n of m.addedNodes) if(n.classList?.contains('el')){ n.classList.add('born'); setTimeout(() => n.classList.remove('born'), 400); }
    }).observe($('elLayer'), { childList:true });
    const layers = $('layers');
    if(layers) new MutationObserver(muts => {
      if(!ready) return;
      for(const m of muts) for(const n of m.addedNodes) if(n.classList?.contains('layer') && !known.has(n.dataset.id)){ n.classList.add('fresh'); }
      known = new Set([...layers.querySelectorAll('.layer')].map(x => x.dataset.id));
    }).observe(layers, { childList:true });
    let known = new Set();
    const cheered = new Set();
    for(const id of ['status', 'obsStatus']){
      const el = $(id); let last = el.className.replace(' changed', '');
      new MutationObserver(() => {
        const now = el.className.replace(' changed', ''); if(now === last) return; last = now;
        el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed');
        // bright mode: a small celebration the first time the Host and then OBS come online
        if(/\bok\b/.test(now) && !cheered.has(id) && document.body.classList.contains('bright')){ cheered.add(id); cheer(el); }
      }).observe(el, { attributes:true, attributeFilter:['class'] });
    }
  }

  function cheer(from){
    const cv = document.createElement('canvas'); cv.id = 'cheer'; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.bottom;
    const cols = ['#7c5cff', '#b9a8ff', '#2ecc71', '#f5b83d', '#ff5c7a', '#4cc9f0'];
    const ps = Array.from({ length:60 }, () => ({ x:cx, y:cy, vx:(Math.random() - .5) * 9, vy:Math.random() * 6 + 2, s:3 + Math.random() * 4, c:cols[Math.random() * cols.length | 0], r:Math.random() * 6 }));
    let t = 0;
    (function frame(){
      ctx.clearRect(0, 0, cv.width, cv.height);
      for(const p of ps){ p.vy += .25; p.x += p.vx; p.y += p.vy; p.r += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      if(++t < 70) requestAnimationFrame(frame); else cv.remove();
    })();
  }

  // ---------- start ----------
  settingsSection(); folds(); windows(); apply(); resizers(); dragTabs(); helpButton(); emptyHint(); motionHooks();
  if(loadNote) setTimeout(() => toast(loadNote, 5000), 800);
  function whenReady(){
    // after the language picker and the password lock
    const langChosen = (() => { try{ return !!localStorage.getItem('hudini.lang'); }catch{ return true; } })();
    if(!window.hudiniReady || !langChosen || $('lock')?.offsetParent){ setTimeout(whenReady, 400); return; }
    if(!ui.tour && !new URLSearchParams(location.search).has('notour')) setTimeout(() => tour(0), 500);
    else setTimeout(maybeAskPersist, 20000);
  }
  whenReady();
  // the "instructions for the streamer" link in the connection dialog opens the right help section
  document.querySelector('#hostTipNoHost a.hint')?.addEventListener('click', e => { e.preventDefault(); $('hostTip').hidden = true; openHelp('streamer'); });
  window.HudiniUI = { tour, openHelp, reset:() => $('uiReset').click(), settings:() => ({ ...ui }) };
})();
