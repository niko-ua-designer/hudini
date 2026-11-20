// Пульт и решения стримера (Hudini Host на его компьютере): права модераторов, выключатели в доке OBS
// и элементы, которые стример спрятал у себя. Всё это публикует только программа стримера, а применяет виджет;
// пульт лишь прячет запрещённые кнопки и помечает, что на стрим не попадёт.
// Загружается перед moderator.js (boot.js): его общие переменные (room, hostCtl, nodes, openHome) берутся только при вызове.
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
  // cam, screen, mic: выключены, пока стример явно не включил (в отличие от остальных, у которых «выключено» = false)
  const MEDIA_KEYS = ['cam', 'screen', 'mic'];
  const isStreamer = () => document.body.classList.contains('streamer-panel');
  const cur = () => perms && permsRoom === room ? perms : { av:true, web:true, fx:true, games:true, flights:false, cam:false, screen:false, mic:false };
  // слой камеры, экрана или микрофона модератору нельзя, пока стример не разрешил; своё стримеру можно всегда
  const mediaOk = kind => isStreamer() || cur()[kind] === true;
  const permOff = el => { /* свой поток стримера права не спрашивает */ if(el?.type === 'stream') return el.owner !== 'streamer' && !mediaOk(el.kind); const p = PERM_OF[el?.type]; return !!p && cur()[p] === false; };

  // стили отдельным файлом: CSP окна приложения не пускает <style>, созданный скриптом
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'streamer.css?v=1';
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
    note.textContent = lines.join('\n');
  }
  // Почему элемент не виден на стриме, хотя в пульте он есть (пусто — виден как обычно)
  function whyOff(el){
    if(!el) return '';
    const ids = typeof hostCtl !== 'undefined' && Array.isArray(hostCtl?.hideIds) ? hostCtl.hideIds : [];
    if(ids.includes(el.id)) return tr('🙈 скрыто стримером');
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
    perms = { av:p.av !== false, web:p.web !== false, fx:p.fx !== false, games:p.games !== false, flights:p.flights === true, cam:p.cam === true, screen:p.screen === true, mic:p.mic === true }; permsRoom = room;
    applyUi(); marks(); window.renderFlights?.(); window.hudiniBroadcast?.perms();
  };
  // После каждой перерисовки пульта (renderAll)
  window.hudiniMarks = () => { applyUi(); marks(); };
  window.hudiniPermOff = permOff;
  // Пролёты камеры: пульт стримера видит всегда, модератор только с правом flights (Host всё равно проверяет сам)
  window.hudiniFlightsAllowed = () => document.body.classList.contains('streamer-panel') || cur().flights === true;
  window.hudiniMediaOk = mediaOk;
  applyUi();

  // ---------- «Открыть пульт» у стримера (пульт на том же ПК, что и Hudini Host) ----------
  // Ключ одноразовый и живёт минуту. В приложении его отдаёт окну сама программа (команда panel_key), без приложения
  // (разработка, тесты) он приходит во фрагменте адреса #hk=…&port=…: фрагмент не уходит на сервер и в Referer,
  // а boot() сразу стирает его из адреса. Ключ меняется на сессию «стример-пульт» и ключи комнаты.
  let link = null;   // { room, url, pass }
  const okPort = v => { const n = Number(v); return Number.isInteger(n) && n >= 1024 && n <= 65534 ? n : 0; };
  window.hudiniStreamer = {
    // до того, как boot() сотрёт адрес
    take(){
      const h = new URLSearchParams(location.hash.slice(1)), key = h.get('hk'), port = okPort(h.get('port'));
      if(key && port) return { key, port };
      return window.__TAURI__?.core ? { app:true } : { missing:true };
    },
    async login(sk){
      const fail = error => ({ room:null, error });
      try{
        if(sk.app){ const r = await window.__TAURI__.core.invoke('panel_key'); sk = { key:r?.key, port:okPort(r?.port) }; }
      }catch{ return fail(tr('Окно пульта открывается кнопкой «Открыть пульт» в Hudini Host.')); }
      if(sk.missing || !sk.key || !sk.port) return fail(tr('Ключ входа не найден: нажми «Открыть пульт» в Hudini Host ещё раз.'));
      let r, j = {};
      try{
        r = await fetch(`http://127.0.0.1:${sk.port}/api/streamer/session`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ key:sk.key }), cache:'no-store', referrerPolicy:'no-referrer', credentials:'omit' });
        j = await r.json().catch(() => ({}));
      }catch{ return fail(tr('Hudini Host на этом компьютере не отвечает.')); }
      if(!r.ok || !j.ok) return fail(tr(j.error || 'Ключ входа недействителен: нажми «Открыть пульт» в Hudini Host ещё раз'));
      const room = typeof cleanRoom === 'function' ? cleanRoom(j.room) : null;
      if(!room || !await roomKeysOk(room)) return fail(tr('Hudini Host прислал повреждённые ключи комнаты.'));
      link = { room:room.code, url:`ws://127.0.0.1:${sk.port}/mqtt`, pass:String(j.pass || '') };
      // окно стримера: списка сессий модератора здесь нет
      document.body.classList.add('streamer-panel');
      document.title = 'Hudini · ' + tr('пульт стримера');
      return { room };
    },
    // reopenHome(): своя комната — прямо к Hudini Host на этом ПК с логином стримера
    home(code){
      if(!link || code !== link.room) return false;
      openHome({ url:link.url, pass:link.pass, user:'streamer' });
      return true;
    },
  };
})();
