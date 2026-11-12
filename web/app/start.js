// Первый экран Hudini: роль (стример / модератор) и сохранённые сессии модератора.
// Связь с Rust (app/src-tauri): app_state, start_role, set_remember, apply_update; данные лежат в HudiniStore.
(function(){
  'use strict';
  const S = window.HudiniSessions, $ = id => document.getElementById(id);
  const tauri = window.__TAURI__;
  const call = (cmd, args) => tauri ? tauri.core.invoke(cmd, args) : Promise.reject(new Error('Not running inside the Hudini app'));
  const tr = s => window.HudiniI18n ? window.HudiniI18n.t(s) : s;
  const lang = () => window.HudiniI18n?.lang || 'ru';
  const COLORS = ['#7c5cff', '#e0457b', '#2e9e6b', '#d98324', '#2d8fd5', '#a24fd1', '#c4512d', '#3a9aa8'];
  let sessions = [], app = { role:'', remember:false, version:'', update:null }, tab = 'str', menuFor = null;

  const store = () => { HudiniStore.set('app.sessions', sessions); };
  const colorOf = name => { let h = 0; for(const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  function toast(t, ms = 3200){ const el = $('toast'); el.textContent = tr(t); el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', ms); }

  // ---------- вкладки ----------
  function setTab(t, fromUser){
    tab = t;
    $('tabStr').classList.toggle('on', t === 'str'); $('tabMod').classList.toggle('on', t === 'mod');
    $('paneStr').hidden = t !== 'str'; $('paneMod').hidden = t !== 'mod';
    HudiniStore.set('app.tab', t);
    // Роль модератора: сервер без портов, только проверка обновлений. Запоминается, если стоит галочка.
    if(t === 'mod' && (fromUser || app.role === 'mod' || app.role === '')) call('start_role', { role:'mod', remember:$('remember').checked }).catch(() => {});
  }
  $('tabStr').onclick = () => setTab('str', true);
  $('tabMod').onclick = () => setTab('mod', true);

  $('remember').onchange = e => call('set_remember', { remember:e.target.checked }).catch(() => {});

  $('startBtn').onclick = async () => {
    const b = $('startBtn'), err = $('startErr');
    b.disabled = true; err.hidden = true;
    const old = b.textContent; b.textContent = tr('Запускаю…');
    try{ await call('start_role', { role:'streamer', remember:$('remember').checked }); }  // дальше Rust сам открывает окно сервера
    catch(e){ err.textContent = String(e?.message || e); err.hidden = false; b.disabled = false; b.textContent = old; }
  };

  // ---------- сессии ----------
  function whenLabel(s){
    const w = S.whenText(s.last, lang());
    return w.rel || tr(w.key).replace('{t}', w.t || '');
  }
  function render(){
    const list = S.sortSessions(sessions), box = $('list');
    box.textContent = '';
    for(const s of list){
      const row = document.createElement('div'); row.className = 'row'; row.dataset.id = s.id;
      const av = document.createElement('div'); av.className = 'av'; av.style.background = colorOf(s.name); av.textContent = [...s.name][0].toUpperCase();
      const nm = document.createElement('div'); nm.className = 'name';
      const b = document.createElement('b'), nt = document.createElement('span'); nt.textContent = s.name; nt.setAttribute('data-i18n-skip', ''); b.append(nt);
      if(s.pinned){ const pin = document.createElement('span'); pin.className = 'pin'; pin.textContent = '📌 '; b.prepend(pin); }
      const sm = document.createElement('small'); sm.textContent = whenLabel(s); sm.setAttribute('data-i18n-skip', '');
      nm.append(b, sm);
      const net = document.createElement('span'); net.className = 'net'; net.textContent = tr(S.NET_NAMES[S.netOf(s)]);
      const more = document.createElement('button'); more.type = 'button'; more.textContent = '⋯'; more.dataset.more = s.id; more.title = tr('Действия');
      const go = document.createElement('button'); go.type = 'button'; go.className = 'pri'; go.dataset.go = s.id; go.textContent = tr('Войти');
      row.append(av, nm, net, more, go); box.append(row);
    }
    $('empty').hidden = list.length > 0;
  }
  $('list').addEventListener('click', e => {
    const go = e.target.closest('[data-go]'), more = e.target.closest('[data-more]');
    if(go) enter(go.dataset.go);
    else if(more){ e.stopPropagation(); openMenu(more); }
  });

  function enter(id){
    const s = sessions.find(x => x.id === id); if(!s) return;
    s.last = Date.now(); store();
    HudiniStore.flushNow();
    // пульт откроется в этом же окне; соединение с сервером стримера и список сессий там подхватит фаза 4
    location.href = '../panel/moderator.html?session=' + encodeURIComponent(id);
  }

  function openMenu(btn){
    const s = sessions.find(x => x.id === btn.dataset.more); if(!s) return;
    menuFor = s.id;
    const m = $('menu'); m.querySelector('[data-act=pin]').hidden = s.pinned; m.querySelector('[data-act=unpin]').hidden = !s.pinned;
    m.hidden = false;
    const r = btn.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
    m.style.top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 4) + 'px';
  }
  document.addEventListener('click', () => { $('menu').hidden = true; });
  addEventListener('keydown', e => { if(e.key === 'Escape') $('menu').hidden = true; });
  $('menu').addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act, s = sessions.find(x => x.id === menuFor);
    $('menu').hidden = true; if(!act || !s) return;
    if(act === 'rename'){ const n = prompt('Новое имя стримера:', s.name); if(n && n.trim()) s.name = n.trim().slice(0, 40); }
    else if(act === 'pin' || act === 'unpin') s.pinned = act === 'pin';
    else if(act === 'del'){ if(!confirm('Удалить стримера из списка? Код придётся вставить заново.')) return; sessions = sessions.filter(x => x !== s); }
    store(); render();
  });

  // ---------- добавление кода ----------
  function addFromText(text, quiet){
    const code = S.parseCode(text);
    if(!code){ if(!quiet) toast('Это не код для модератора Hudini'); return false; }
    const r = S.addCode(sessions, code);
    if(r.keysDiffer){ alert('Стример с таким кодом уже есть, но с другими ключами.\nКод не принят: сохранённый остался как был.'); return false; }
    sessions = r.list; store(); render();
    toast(r.created ? 'Стример добавлен' : 'Стример уже есть: адреса и пароль обновлены');
    return true;
  }
  const submit = () => { const v = $('codeIn').value; if(addFromText(v)) $('codeIn').value = ''; };
  $('codeAdd').onclick = submit;
  $('codeIn').addEventListener('keydown', e => { if(e.key === 'Enter') submit(); });
  // вставка с Ctrl+V в любом месте окна
  document.addEventListener('paste', e => {
    if(tab !== 'mod' || e.target === $('codeIn')) return;
    const t = e.clipboardData?.getData('text') || '';
    if(t.includes('hudini1:')){ e.preventDefault(); addFromText(t); }
  });
  // перетаскивание кода в окно (текст или маленький .txt)
  let dragDepth = 0;
  addEventListener('dragenter', e => { e.preventDefault(); if(tab === 'mod'){ dragDepth++; $('drop').hidden = false; } });
  addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if(!dragDepth) $('drop').hidden = true; });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', async e => {
    e.preventDefault(); dragDepth = 0; $('drop').hidden = true;
    if(tab !== 'mod') return;
    const f = e.dataTransfer?.files?.[0];
    const text = f && f.size < 20000 ? await f.text() : e.dataTransfer?.getData('text') || '';
    addFromText(text);
  });

  // ---------- обновления (сервер-проверяльщик в обеих ролях) ----------
  function showUpdate(u){
    app.update = u;
    const on = u && u.state === 'ready' && u.ver;
    $('updBanner').hidden = !on; if(on) $('updVer').textContent = u.ver;
  }
  $('updBtn').onclick = () => { $('updBtn').disabled = true; call('apply_update').catch(e => { $('updBtn').disabled = false; toast(String(e?.message || e)); }); };
  if(tauri?.event) tauri.event.listen('hudini-update', e => showUpdate(e.payload));

  // ---------- прошлое падение и журналы ----------
  function showCrash(c){
    $('crashBanner').hidden = !c;
    if(!c) return;
    $('crashCopy').onclick = async () => { try{ await navigator.clipboard.writeText(c.name + '\n\n' + c.text); toast('Скопировано'); }catch{ toast('Не удалось скопировать'); } };
    $('crashHide').onclick = () => { $('crashBanner').hidden = true; call('crash_dismiss', { name:c.name }).catch(() => {}); };
  }
  $('logsBtn').onclick = () => call('open_logs').catch(e => toast(String(e?.message || e)));

  // ---------- запуск ----------
  (async () => {
    await HudiniStore.ready;
    sessions = S.cleanList(HudiniStore.get('app.sessions', []));
    try{ app = { ...app, ...(await call('app_state')) }; }catch{}
    $('ver').textContent = app.version ? 'v' + app.version : '';
    $('remember').checked = !!app.remember;
    showUpdate(app.update);
    showCrash(app.crash);
    $('logsBtn').hidden = !tauri;
    // первая вкладка: сохранённая роль, иначе последняя открытая, иначе «Стример»
    const first = app.role === 'mod' ? 'mod' : app.role === 'streamer' ? 'str' : HudiniStore.get('app.tab', 'str');
    setTab(first === 'mod' ? 'mod' : 'str', false);
    render();
    setInterval(render, 60000);   // «сегодня, 18:42» → «вчера» без перезапуска
    window.hudiniStartReady = true;
  })();
  addEventListener('pagehide', () => HudiniStore.flushNow());
})();
