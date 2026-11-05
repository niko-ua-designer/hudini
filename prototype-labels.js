// PROTOTYPE, throwaway. Question: how should the panel mark beta and alpha features in 1.0?
// Loaded by moderator.html only when the URL has ?variant=A|B|C. Switcher at the bottom (or ← → with nothing selected).
(() => {
  const VARIANTS = [
    ['A', 'Значки β/α на месте'],
    ['B', 'Вкладка «Лаборатория»'],
    ['C', 'Переключатель «Эксперименты»'],
  ];
  const ISSUES = 'https://github.com/niko-ua-designer/overlay/issues';
  const $ = id => document.getElementById(id);
  const click = sel => () => document.querySelector(sel)?.click();
  const openTab = t => () => { showTab(t); };

  // Every feature that is not stable in 1.0, where it lives in the panel, and how the Lab reaches it.
  const F = [
    { lvl:'beta', name:'Hudini Host', hint:'Туннель, мост и автообновление программы стримера.', sel:'#status', keep:true },
    { lvl:'beta', name:'Чат Twitch', hint:'Лента чата и показ сообщений на стриме.', sel:'[data-tab="chat"]', act:['Открыть', openTab('chat')] },
    { lvl:'beta', name:'Сценарии', hint:'Если… → то…: реакции на чат, CS2, таймеры.', sel:'[data-tab="auto"]', act:['Открыть', openTab('auto')] },
    { lvl:'beta', name:'Счётчик чата', hint:'Считает !команды или слова в чате.', sel:'[data-add="chatcounter"]', act:['Добавить', click('[data-add="chatcounter"]')] },
    { lvl:'beta', name:'Голосование', hint:'Зрители голосуют цифрами в чате.', sel:'[data-add="poll"]', act:['Добавить', click('[data-add="poll"]')] },
    { lvl:'beta', name:'CS2 (игрок)', hint:'K/D/A, HP, деньги, серии киллов.', sel:'[data-add="cs2"]', act:['Добавить', click('[data-add="cs2"]')] },
    { lvl:'beta', name:'Вебка', hint:'Камера через VDO.Ninja.', sel:'#addCam', act:['Подключить', click('#addCam')] },
    { lvl:'beta', name:'Загрузка файлов', hint:'Картинки и видео с компьютера (перетащить и Ctrl+V тоже).', sel:'#pickFile', act:['Выбрать файл', click('#pickFile')] },
    { lvl:'beta', name:'YouTube, Twitch и сайты', hint:'Плеер и сайт на экране, громкость.', sel:'#addUrl', keep:true, url:true },
    { lvl:'beta', name:'Группы и сетка', hint:'Ctrl+G, выравнивание, магнит к сетке.', sel:'#tGroup', up:'.tgrp', also:['label.chk:has(#gridOn)', '#gridStep'], toggle:'Показать на панели' },
    { lvl:'alpha', name:'CS2: режим наблюдателя', hint:'Панели команд, счёт-бар, «за кем смотрим». Только когда стример наблюдатель на сервере.', sel:'#iCsView option[value="teams"], #iCsView option[value="scorebar"], #iCsView option[value="observed"]', option:true, toggle:'Показать в инспекторе CS2' },
    { lvl:'alpha', name:'Twitch: пауза и перемотка', hint:'⏪ 10 с / ⏩ 10 с в плеере Twitch. Иногда плеер не слушается.', sel:'#plSeek', toggle:'Показать в инспекторе плеера' },
  ];
  const nodesOf = f => {
    let list = [...document.querySelectorAll(f.sel)].map(n => f.up ? n.closest(f.up) : n);
    for(const s of f.also || []) list.push(...document.querySelectorAll(s));
    return list.filter(Boolean);
  };
  const LBL = { beta:'β', alpha:'α' };
  const WORD = { beta:'Бета', alpha:'Альфа' };
  const SAY = {
    beta: 'Работает, но мало проверено на разных ПК. Если сбоит, напиши.',
    alpha: 'Экспериментально: может ломаться и измениться без предупреждения.',
  };

  const css = document.createElement('style');
  css.textContent = `
  .pr-hide{display:none!important}
  .pr-b{display:inline-block;font:700 10px/14px system-ui;padding:0 5px;border-radius:7px;margin-left:4px;vertical-align:middle;cursor:help;color:#111}
  .pr-b.beta{background:#f5b83d}.pr-b.alpha{background:#ff5c7a;color:#fff}
  .pr-host{position:relative}
  .pr-host>.pr-b{position:absolute;top:-6px;right:-6px;margin:0;font-size:9px;line-height:13px;padding:0 4px;z-index:2}
  #tabs .pr-host>.pr-b{top:2px;right:2px}
  .pill.pr-host>.pr-b{top:-7px;right:-7px}
  #prPop{position:fixed;z-index:100010;max-width:260px;background:#171a21;border:1px solid #3a3f4c;border-radius:10px;padding:10px 12px;font-size:12px;box-shadow:0 8px 30px #0008}
  #prPop a{color:#b9a8ff}
  #prSw{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100009;display:flex;align-items:center;gap:6px;background:#fff;color:#111;border-radius:999px;padding:4px 6px;font:600 13px system-ui;box-shadow:0 6px 24px #000a}
  #prSw button{border:0;background:#111;color:#fff;border-radius:999px;width:28px;height:28px;cursor:pointer;font-size:14px}
  #prSw small{font-weight:400;color:#555;margin-left:4px}
  .pr-lab .card{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:6px 0;background:var(--panel2)}
  .pr-lab .card.alpha{border-color:#ff5c7a66}.pr-lab .card.beta{border-color:#f5b83d55}
  .pr-lab .card b{font-size:13px}.pr-lab .card .hint{margin:3px 0 6px}
  .pr-lab .lead{font-size:12px;color:var(--mut,#8b91a1);margin:4px 0 8px}
  .pr-back{font-size:12px;margin-bottom:6px}
  .pr-ring-beta{box-shadow:inset 3px 0 0 #f5b83d!important}
  .pr-ring-alpha{box-shadow:inset 3px 0 0 #ff5c7a!important}
  option.pr-ring-alpha{color:#ff8da2}
  #prExp{cursor:pointer}
  #prExp.on{background:#f5b83d;color:#111;border-color:#f5b83d}
  `;
  document.head.appendChild(css);

  // ---------- cleanup between variants ----------
  const undo = [];
  const mark = n => { n.dataset.proto = '1'; return n; };
  function reset(){
    while(undo.length) undo.pop()();
    document.querySelectorAll('[data-proto]').forEach(n => n.remove());
    document.querySelectorAll('.pr-hide,.pr-ring-beta,.pr-ring-alpha').forEach(n => n.classList.remove('pr-hide', 'pr-ring-beta', 'pr-ring-alpha'));
    $('prPop')?.remove();
  }
  const hide = n => n.classList.add('pr-hide');
  const optText = (n, prefix) => { const old = n.textContent; n.textContent = prefix + old; undo.push(() => n.textContent = old); };

  function pop(anchor, f){
    $('prPop')?.remove();
    const p = document.createElement('div'); p.id = 'prPop';
    p.innerHTML = `<b>${LBL[f.lvl]} ${WORD[f.lvl]}: ${f.name}</b><div style="margin:4px 0">${SAY[f.lvl]}</div><a href="${ISSUES}" target="_blank" rel="noopener">Сообщить о проблеме ↗</a>`;
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    p.style.left = Math.min(innerWidth - 270, Math.max(8, r.left)) + 'px';
    p.style.top = (r.bottom + 6 + p.offsetHeight > innerHeight ? r.top - p.offsetHeight - 6 : r.bottom + 6) + 'px';
    setTimeout(() => addEventListener('pointerdown', e => { if(!p.contains(e.target)) p.remove(); }, { once:true }), 0);
  }
  const badge = f => {
    const b = mark(document.createElement('span'));
    b.className = 'pr-b ' + f.lvl; b.textContent = LBL[f.lvl]; b.title = WORD[f.lvl];
    b.onclick = e => { e.stopPropagation(); e.preventDefault(); pop(b, f); };
    return b;
  };

  // ---------- A: badges in place ----------
  function variantA(){
    for(const f of F){
      const list = nodesOf(f);
      if(f.option){ list.forEach(n => optText(n, 'α ')); continue; }
      const n = list[0]; if(!n) continue;
      n.classList.add('pr-host'); undo.push(() => n.classList.remove('pr-host'));
      n.appendChild(badge(f));
    }
  }

  // ---------- B: Lab tab ----------
  function variantB(){
    const tab = mark(document.createElement('button'));
    tab.dataset.tab = 'lab'; tab.title = 'Бета и альфа функции'; tab.innerHTML = '🧪<span>Лаборатория</span>';
    document.querySelector('#tabs [data-tab="room"]').before(tab);
    tab.onclick = () => showTab('lab');
    const pane = mark(document.createElement('section'));
    pane.dataset.pane = 'lab'; pane.hidden = true; pane.className = 'pr-lab';
    pane.innerHTML = '<h2>🧪 Лаборатория</h2><div class="lead">Здесь функции, которые уже работают, но ещё обкатываются. Всё остальное в пульте стабильное.</div>';
    for(const lvl of ['beta', 'alpha']){
      const h = document.createElement('h2'); h.innerHTML = `${lvl === 'beta' ? 'β Бета' : 'α Альфа'} <span class="hint" style="text-transform:none;letter-spacing:0">${SAY[lvl]}</span>`;
      pane.appendChild(h);
      for(const f of F.filter(x => x.lvl === lvl)){
        const c = document.createElement('div'); c.className = 'card ' + lvl;
        c.innerHTML = `<b>${f.name}</b><div class="hint">${f.hint}</div>`;
        const row = document.createElement('div'); row.className = 'row'; c.appendChild(row);
        const list = nodesOf(f);
        if(!f.keep) list.forEach(hide);
        if(f.act){ const b = document.createElement('button'); b.className = 'grow'; b.textContent = f.act[0]; b.onclick = f.act[1]; row.appendChild(b); }
        if(f.url){
          const i = document.createElement('input'); i.type = 'url'; i.className = 'grow'; i.placeholder = 'Ссылка на YouTube, Twitch или сайт';
          const b = document.createElement('button'); b.textContent = '➕'; b.onclick = () => { $('newUrl').value = i.value; $('addUrl').click(); i.value = ''; };
          row.append(i, b);
        }
        if(f.keep && f.sel === '#status'){
          const s = document.createElement('span'); s.className = 'hint grow'; row.appendChild(s);
          const upd = () => { s.textContent = 'Сейчас: ' + $('status').textContent; };
          upd(); const t = setInterval(upd, 1000); undo.push(() => clearInterval(t));
        }
        if(f.toggle){
          const l = document.createElement('label'); l.className = 'chk';
          l.innerHTML = `<input type="checkbox"> ${f.toggle}`;
          l.firstChild.onchange = e => list.forEach(n => n.classList.toggle('pr-hide', !e.target.checked));
          row.appendChild(l);
        }
        const fb = document.createElement('a'); fb.href = ISSUES; fb.target = '_blank'; fb.rel = 'noopener'; fb.textContent = 'Сбоит?'; fb.className = 'hint'; fb.style.marginLeft = 'auto';
        row.appendChild(fb);
        pane.appendChild(c);
      }
    }
    document.querySelector('section[data-pane="room"]').after(pane);
    // the chat and scenario panes get a way back to the Lab
    for(const t of ['chat', 'auto']){
      const b = mark(document.createElement('button')); b.className = 'pr-back'; b.textContent = '← Лаборатория'; b.onclick = () => showTab('lab');
      document.querySelector(`section[data-pane="${t}"]`).prepend(b);
    }
    // the hint under the URL field stops promising YouTube and sites
    const u = $('newUrl'); const old = u.placeholder; u.placeholder = 'Ссылка на картинку, GIF или видео'; undo.push(() => u.placeholder = old);
    const cur = document.querySelector('#tabs button.on')?.dataset.tab;
    if(cur === 'chat' || cur === 'auto') showTab('lab');
  }

  // ---------- C: experiments switch ----------
  function variantC(){
    const key = 'proto.exp';
    let st; try { st = JSON.parse(localStorage.getItem(key)) || {}; } catch { st = {}; }
    if(st.beta === undefined) st = { beta:false, alpha:false };
    const btn = mark(document.createElement('button'));
    btn.id = 'prExp'; btn.title = 'Бета и альфа функции';
    document.querySelector('header .spacer').before(btn);
    const box = mark(document.createElement('div'));
    box.innerHTML = `<h2>🧪 Экспериментальные функции</h2>
      <label class="chk"><input type="checkbox" id="prBeta"> Бета: чат, сценарии, CS2, сайты и плееры, вебка, файлы, группы</label>
      <label class="chk"><input type="checkbox" id="prAlpha"> Альфа: наблюдатель CS2, перемотка Twitch</label>
      <div class="hint">Выключено: в пульте только стабильные функции. Включённые помечены полоской слева: жёлтая бета, красная альфа. <a href="${ISSUES}" target="_blank" rel="noopener" style="color:#b9a8ff">Сообщить о проблеме</a></div>`;
    document.querySelector('section[data-pane="room"] h2').before(box);
    const apply = () => {
      try { localStorage.setItem(key, JSON.stringify(st)); } catch {}
      $('prBeta').checked = st.beta; $('prAlpha').checked = st.alpha;
      const n = (st.beta ? 1 : 0) + (st.alpha ? 1 : 0);
      btn.textContent = n ? `🧪 ${st.alpha ? 'β+α' : 'β'}` : '🧪 выкл';
      btn.classList.toggle('on', !!n);
      for(const f of F){
        if(f.keep) continue;
        const on = !!st[f.lvl];
        for(const node of nodesOf(f)){
          node.classList.toggle('pr-hide', !on);
          node.classList.toggle('pr-ring-' + f.lvl, on);
        }
      }
      const cur = document.querySelector('#tabs button.on');
      if(cur?.classList.contains('pr-hide')) showTab('add');
    };
    $('prBeta').onchange = e => { if(e.target.checked){ st.beta = true; if(!confirm('Бета-функции работают, но мало проверены на разных ПК. Включить?')) st.beta = false; } else st.beta = false; apply(); };
    $('prAlpha').onchange = e => { if(e.target.checked){ st.alpha = true; if(!confirm('Альфа-функции экспериментальные: могут ломаться и измениться без предупреждения. Включить?')) st.alpha = false; } else st.alpha = false; apply(); };
    btn.onclick = () => { showTab('room'); box.scrollIntoView({ block:'start', behavior:'smooth' }); };
    apply();
  }

  // ---------- switcher ----------
  const RUN = { A:variantA, B:variantB, C:variantC };
  let cur = (new URLSearchParams(location.search).get('variant') || 'A').toUpperCase();
  if(!RUN[cur]) cur = 'A';
  const sw = document.createElement('div'); sw.id = 'prSw'; sw.setAttribute('data-i18n-skip', '');
  sw.innerHTML = '<button title="Предыдущий">←</button><span></span><button title="Следующий">→</button>';
  const [prev, label, next] = sw.children;
  function go(k){
    reset(); cur = k; RUN[k]();
    const name = VARIANTS.find(v => v[0] === k)[1];
    const nb = F.filter(f => f.lvl === 'beta').length, na = F.filter(f => f.lvl === 'alpha').length;
    label.innerHTML = `${k} (${name}) <small>β ${nb} · α ${na}</small>`;
    const u = new URL(location.href); u.searchParams.set('variant', k); history.replaceState(null, '', u);
  }
  const step = d => { const i = VARIANTS.findIndex(v => v[0] === cur); go(VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length][0]); };
  prev.onclick = () => step(-1); next.onclick = () => step(1);
  addEventListener('keydown', e => {
    if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const a = document.activeElement;
    if(a && (a.matches('input,textarea,select') || a.isContentEditable)) return;
    if(!$('toolbar').classList.contains('none')) return; // arrows move the selected element
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });
  const start = () => { document.body.appendChild(sw); go(cur); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', start) : start();
})();
