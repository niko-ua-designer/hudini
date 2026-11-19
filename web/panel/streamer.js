// Пульт и решения стримера (Hudini Host на его компьютере): права модераторов, выключатели в доке OBS
// и элементы, которые стример спрятал у себя. Всё это публикует только программа стримера, а применяет виджет;
// пульт лишь прячет запрещённые кнопки и помечает, что на стрим не попадёт.
// Загружается после moderator.js (boot.js) и пользуется его общими переменными: room, hostCtl, nodes, state.
(function(){
  'use strict';
  const tr = s => window.HudiniI18n ? window.HudiniI18n.t(s) : s;
  const PERM_NAME = { av:'звуки и видео', web:'сайты и файлы', fx:'чат, рисование, эффекты', games:'кейсы, розыгрыши, опросы, CS2' };
  // Как в widget.html: тип элемента → право
  const PERM_OF = { video:'av', web:'web', image:'web', chat:'fx', msg:'fx', draw:'fx', case:'games', raffle:'games', poll:'games', cs2:'games' };
  // Что прятать в пульте. Кнопку можно отдать праву и разметкой: data-perm="fx".
  const PERM_UI = {
    av:['#playSound', '#soundUrl', '#pickSound', '#soundVol'],
    web:['#newUrl', '#addUrl', '#pickFile'],
    fx:['#confetti', '#shake', '#addChatFeed', '[data-add="draw"]'],
    games:['[data-add="poll"]', '[data-add="cs2"]', '[data-add="case"]', '[data-tab="raffle"]'],
  };
  // Быстрые выключатели стримера в доке OBS (hostCtl.off): как OFF_OF в widget.html
  const OFF_NAME = { chat:'чат', cs2:'CS2-HUD', sound:'звуки', draw:'рисунки', fx:'эффекты' };
  const OFF_OF = { chat:'chat', msg:'chat', cs2:'cs2', draw:'draw' };
  const offNow = () => typeof hostCtl !== 'undefined' && hostCtl?.off && typeof hostCtl.off === 'object' ? hostCtl.off : {};
  let perms = null, permsRoom = null;
  const cur = () => permsRoom === room && perms ? perms : { av:true, web:true, fx:true, games:true };
  const permOff = el => { const p = PERM_OF[el?.type]; return !!p && cur()[p] === false; };

  const css = document.createElement('style');
  css.textContent = '.perm-off{display:none!important}' +
    '#permNote{margin:0 0 10px;padding:7px 10px;border-radius:8px;background:#2b2210;border:1px solid #6b5420;color:#f3d28a;font-size:12px}' +
    '.el .hoff{position:absolute;left:0;bottom:100%;margin-bottom:2px;white-space:nowrap;font:600 11px/1.3 system-ui,sans-serif;color:#fff;background:#b3263a;padding:1px 6px;border-radius:4px;pointer-events:none;display:none;z-index:5}' +
    '.el.host-off{outline:2px dashed #ff4d5e99;outline-offset:1px}.el.host-off .hoff{display:block}' +
    '.layer.host-off .name{text-decoration:line-through;opacity:.6}';
  document.head.appendChild(css);

  function applyUi(){
    const p = cur(), off = Object.keys(PERM_NAME).filter(k => p[k] === false);
    for(const [k, sels] of Object.entries(PERM_UI)) for(const sel of sels) for(const n of document.querySelectorAll(sel)){
      const row = n.parentElement?.classList.contains('row') ? n.parentElement : n;
      row.classList.toggle('perm-off', p[k] === false);
    }
    for(const n of document.querySelectorAll('[data-perm]')) n.classList.toggle('perm-off', p[n.dataset.perm] === false);
    const sw = Object.keys(OFF_NAME).filter(k => offNow()[k] === true);
    let note = document.getElementById('permNote');
    if(!off.length && !sw.length){ note?.remove(); return; }
    if(!note){ note = document.createElement('div'); note.id = 'permNote'; document.querySelector('[data-pane="add"]')?.prepend(note); }
    const lines = [];
    if(off.length) lines.push(tr('🔒 Стример выключил для модераторов:') + ' ' + off.map(k => tr(PERM_NAME[k])).join(', ') + '. ' + tr('На стрим это не попадёт.'));
    if(sw.length) lines.push(tr('⏸ Стример выключил на стриме:') + ' ' + sw.map(k => tr(OFF_NAME[k])).join(', ') + '.');
    note.textContent = lines.join('\n'); note.style.whiteSpace = 'pre-line';
  }
  // Почему элемент не виден на стриме, хотя в пульте он есть (пусто — виден как обычно)
  function whyOff(el){
    if(permOff(el)) return tr('выключено стримером');
    if(OFF_OF[el?.type] && offNow()[OFF_OF[el.type]] === true) return tr('выключено на стриме');
    return '';
  }
  function marks(){
    if(typeof nodes === 'undefined') return;
    for(const [id, node] of nodes){
      const why = whyOff(node._el);
      node.classList.toggle('host-off', !!why);
      let tag = node.querySelector(':scope > .hoff');
      if(why && !tag){ tag = document.createElement('div'); tag.className = 'hoff'; node.appendChild(tag); }
      if(tag) tag.textContent = why;
    }
    for(const row of document.querySelectorAll('#layers .layer[data-id]')){
      const why = whyOff(typeof byId === 'function' ? byId(row.dataset.id) : null);
      row.classList.toggle('host-off', !!why);
      if(why) row.title = why;
    }
  }
  // Права пришли из программы стримера (тема perms)
  window.hudiniPanelPerms = p => {
    if(!p || typeof p !== 'object') return;
    perms = { av:p.av !== false, web:p.web !== false, fx:p.fx !== false, games:p.games !== false }; permsRoom = room;
    applyUi(); marks();
  };
  // После каждой перерисовки пульта (renderAll)
  window.hudiniMarks = () => { applyUi(); marks(); };
  window.hudiniPermOff = permOff;
  applyUi();
})();
