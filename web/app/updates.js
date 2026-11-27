// Updates of the app in the moderator role: Stable / Beta channel, automatic download, the offer of a new version,
// «what is new» after an update and the list of changes. The Host program inside the app checks and installs updates;
// this role has no management page, so the pages ask it through the app (command app_ui, answer in the event hudini-info).
// Nothing here restarts the app by itself: only the buttons do. Used by the start screen and the moderator panel.
(function(){
  'use strict';
  const tauri = window.__TAURI__;
  const tr = s => window.HudiniI18n ? window.HudiniI18n.t(s) : s;
  const fmt = (s, v) => tr(s).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const lang = () => window.HudiniI18n?.lang || 'ru';
  const $ = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n = document.createElement(tag); if(text != null) n.textContent = text; if(cls) n.className = cls; return n; };
  // text built here is already translated and may hold server text: the page translator leaves it alone
  const raw = (n, text) => { n.setAttribute('data-i18n-skip', ''); if(n.textContent !== text) n.textContent = text; };
  const session = (k, v) => { try{ if(v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); }catch{} return null; };
  const KINDS = { hotfix:['хотфикс', 'Вышло исправление'], version:['новая версия', 'Вышла новая версия'], beta:['бета', 'Вышла новая бета-версия'] };
  const LATER = 'hudini.upd.later', HEARD = 'hudini.upd.heard', WAIT = 'hudini.upd.rbWait';
  let on = false, popups = false, listening = false, info = null, entries = null, view = null, poll = 0, retry = 0;

  // ---------- the program ----------
  function ask(op = 'info', value){
    clearTimeout(retry);
    if(!on) return;
    const request = { op, value, lang:lang(), log:!entries };
    // right after the role is chosen the program may still be starting: ask again until it has answered once
    const again = () => { clearTimeout(retry); if(on && !info) retry = setTimeout(() => ask(), 1500); };
    tauri.core.invoke('app_ui', { request }).then(again, again);
  }
  function got(i){
    if(!on || !i?.upd) return;
    info = i; clearTimeout(retry);
    if(i.entries){ entries = i.entries; if(view === 'settings') fillLog(); }
    if(i.error) say(tr(i.error));
    clearTimeout(poll);
    if(i.upd.state === 'checking' || i.upd.state === 'downloading') poll = setTimeout(() => ask(), 1000);
    announce();
    if(view === 'settings') render();
    if(popups) popup();
  }
  const found = () => { const u = info?.upd; return u && (u.state === 'ready' || u.state === 'available') ? String(u.latest) : ''; };
  // «update available» is heard once per version
  async function announce(){
    const ver = found(); if(!ver) return;
    await window.HudiniStore?.ready;
    if(session(HEARD) === ver) return;
    session(HEARD, ver); window.HudiniSounds?.event('update');
  }
  // what to show by itself (start screen): first what is new, then a downloaded update
  function popup(){
    if(view === 'settings') return;
    if(info.ui?.whatsNew){ if(view !== 'news' && entries) news(); return; }
    const u = info.upd;
    if(u.state === 'ready' && session(LATER) !== String(u.latest)){ if(view !== 'offer') offer(); }
    else if(view === 'news') close();
  }

  // ---------- window ----------
  function frame(kind, title){
    close();
    view = kind;
    const m = el('div', null, 'upm'); m.id = 'auModal'; m.dataset.view = kind;
    const box = el('div', null, 'upbox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'auTitle');
    const h = el('h2'); h.id = 'auTitle'; raw(h, title);
    box.append(h); m.append(box); document.body.append(m);
    return box;
  }
  function close(){ $('auModal')?.remove(); view = null; }
  function button(id, text, onclick, cls){ const b = el('button', text, cls); b.type = 'button'; b.id = id; b.onclick = onclick; return b; }
  function say(text){ const n = $('auErr'); if(n){ raw(n, text); n.hidden = false; } }
  function notes(box, sections){
    for(const s of Array.isArray(sections) ? sections : []){
      if(s?.title) box.append(el('h4', String(s.title)));
      const ul = el('ul'); for(const i of Array.isArray(s?.items) ? s.items : []) ul.append(el('li', String(i)));
      if(ul.childElementCount) box.append(ul);
    }
  }
  function entryBody(box, e, beta){
    if(beta) box.append(el('h3', tr('Что входит в бету')));
    notes(box, e.sections);
    if(beta && e.testing?.length){ const ul = el('ul'); for(const i of e.testing) ul.append(el('li', String(i))); box.append(el('h3', tr('Что тестируется')), ul); }
  }
  function apply(){
    for(const id of ['auApply', 'auNow']) if($(id)) $(id).disabled = true;
    tauri.core.invoke('apply_update').catch(e => { for(const id of ['auApply', 'auNow']) if($(id)) $(id).disabled = false; say(String(e?.message || e)); });
  }

  function news(){
    const w = info.ui.whatsNew, e = entries?.find(x => x.ver === w.ver), beta = !!w.beta;
    const box = frame('news', fmt(beta ? 'Что нового в бете {v}' : 'Что нового в версии {v}', { v:w.ver }));
    const body = el('div', null, 'upnotes'); body.tabIndex = 0; body.setAttribute('data-i18n-skip', '');
    if(e) entryBody(body, e, beta); else body.append(el('p', tr('Список изменений пока не загрузился.')));
    const row = el('div', null, 'upbtns'); row.append(button('auOk', 'Понятно', () => { info.ui.whatsNew = null; close(); ask('seen'); popup(); }, 'upri'));
    box.append(body, row); $('auOk').focus();
  }
  function offer(){
    const u = info?.upd, ver = found(); if(!ver) return settings();
    const kind = KINDS[u.kind] || KINDS.version;
    const box = frame('offer', tr(kind[1]));
    const vers = el('div', null, 'upvers'); raw(vers, 'v' + info.current + ' → v' + ver);
    const body = el('div', null, 'upnotes'); body.setAttribute('data-i18n-skip', ''); notes(body, u.notes?.sections); body.hidden = !body.childElementCount;
    const err = el('div', null, 'uperr'); err.id = 'auErr'; err.hidden = true;
    const row = el('div', null, 'upbtns');
    row.append(button('auLater', 'Позже', () => { session(LATER, ver); close(); }),
      button('auNow', u.state === 'ready' ? '🔄 Обновить и перезапустить' : '⬇ Скачать и перезапустить', apply, 'upri'));
    box.append(vers, body, el('p', 'Приложение перезапустится, соединение со стримером прервётся на пару секунд.'), err, row); $('auLater').focus();
  }

  function settings(){
    const box = frame('settings', tr('Обновления'));
    const x = button('auClose', '✕', () => { close(); if(popups && info) popup(); }); x.title = 'Закрыть'; box.append(x);
    const state = el('div', null, 'upstate'); state.id = 'auState';
    const bar = el('div', null, 'upbar'); bar.id = 'auBar'; bar.append(el('i'));
    const when = el('div', null, 'uphint'); when.id = 'auWhen';
    const err = el('div', null, 'uperr'); err.id = 'auErr'; err.hidden = true;
    const row = el('div', null, 'upbtns left');
    row.append(button('auCheck', 'Проверить', () => ask('check')), button('auApply', '', apply, 'upri'));
    const roll = el('div', null, 'uproll'); roll.id = 'auRoll';
    const rollTxt = el('span'); rollTxt.id = 'auRollTxt';
    const rollRow = el('div', null, 'upbtns left');
    rollRow.append(button('auRollNow', '', () => { const v = info?.upd?.rollback?.ver; if(v && confirm(fmt('Откатиться на версию {v}? Сначала сохранится копия настроек, потом приложение перезапустится.', { v }))) ask('rollback'); }),
      button('auRollWait', 'Ждать новую стабильную', () => { try{ localStorage.setItem(WAIT, String(info?.upd?.rollback?.ver)); }catch{} render(); }));
    roll.append(el('b', 'Твоя версия новее последней стабильной'), rollTxt, rollRow);
    const chan = el('fieldset', null, 'upchan'); chan.id = 'auChan'; chan.append(el('legend', 'Канал обновлений'));
    for(const [v, name] of [['stable', 'Стабильная'], ['beta', 'Бета']]){
      const l = el('label'), r = el('input'); r.type = 'radio'; r.name = 'auChannel'; r.value = v; r.onchange = () => { if(r.checked) ask('channel', v); };
      l.append(r, el('span', name)); chan.append(l);
    }
    chan.append(el('div', 'Бета получает новое раньше, но в ней возможны ошибки.', 'uphint'));
    const auto = el('label', null, 'upchk'), box2 = el('input'); box2.type = 'checkbox'; box2.id = 'auAuto'; box2.onchange = () => ask('auto', box2.checked);
    auto.append(box2, el('span', 'Скачивать обновления автоматически'));
    const list = el('div'); list.id = 'auLog'; list.setAttribute('data-i18n-skip', '');
    box.append(state, bar, when, row, err, roll, chan, auto, el('div', 'Программа не перезапускается сама: когда обновление скачано, она спросит.', 'uphint'), el('h3', 'Что нового'), list);
    fillLog(); render(); ask(); $('auClose').focus();
  }
  function render(){
    if(view !== 'settings') return;
    const u = info?.upd;
    for(const id of ['auBar', 'auRoll', 'auApply', 'auCheck', 'auChan', 'auAuto']) { const n = id === 'auAuto' ? $(id).parentElement : $(id); n.hidden = !u; }
    if(!u) return raw($('auState'), tr('Проверяю…'));
    const v = { v:u.latest }, pct = u.prog?.total ? ' ' + Math.round(100 * u.prog.done / u.prog.total) + '%' : '';
    raw($('auState'), !u.compiled ? tr('Запущено из исходников: обновляй через git pull') :
      u.state === 'checking' ? tr('Проверяю…') : u.state === 'downloading' ? fmt('Скачиваю версию {v}…', v) + pct :
      u.state === 'ready' ? fmt('Скачана версия {v}. Перезапусти программу, когда будет удобно.', v) :
      u.state === 'available' ? fmt('Вышла версия {v}. Программа скачает её, когда нажмёшь кнопку.', v) :
      u.state === 'error' ? '⚠ ' + tr(u.err) : u.state === 'latest' ? fmt('✓ Версия {v} — последняя', { v:info.current }) : fmt('Версия {v}', { v:info.current }));
    const dl = u.state === 'downloading';
    $('auBar').hidden = !(dl || u.state === 'checking'); $('auBar').classList.toggle('busy', !(dl && u.prog?.total));
    $('auBar').firstChild.style.width = dl && u.prog?.total ? pct.trim() : '';
    raw($('auWhen'), !u.compiled ? '' : u.checkedAt ? tr('Последняя проверка:') + ' ' + new Date(u.checkedAt).toLocaleString(lang(), { dateStyle:'medium', timeStyle:'short' }) : tr('Ещё не проверялось'));
    $('auApply').hidden = !found();
    // written in Russian when it changes: the page translates it and draws the icon
    const act = u.state === 'available' ? '⬇ Скачать и перезапустить' : '🔄 Обновить и перезапустить';
    if($('auApply').dataset.act !== act){ $('auApply').dataset.act = act; $('auApply').textContent = act; }
    for(const r of document.querySelectorAll('input[name=auChannel]')) r.checked = r.value === u.channel;
    $('auAuto').checked = !!u.auto;
    const back = u.rollback?.ver ? String(u.rollback.ver) : '';
    $('auRoll').hidden = !back;
    if(back){
      let waiting = false; try{ waiting = localStorage.getItem(WAIT) === back; }catch{}
      raw($('auRollTxt'), fmt(waiting ? 'Ждём новую стабильную версию. Откатиться на {v} можно в любой момент.' : 'Сейчас стоит {cur}, а последняя стабильная — {v}. Можно откатиться сейчас (сначала сохранится копия настроек) или дождаться новой стабильной.', { v:back, cur:info.current }));
      raw($('auRollNow'), fmt('Откатиться на {v}', { v:back }));
      $('auRollWait').hidden = waiting;
    }
  }
  function fillLog(){
    const list = $('auLog'); if(!list || !entries) return;
    const date = d => { const t = new Date(d); return d && !isNaN(t) ? t.toLocaleDateString(lang(), { dateStyle:'medium', timeZone:'UTC' }) : String(d || ''); };
    list.replaceChildren(...entries.filter(e => e?.ver).map(e => {
      const d = el('details'), sum = el('summary'), body = el('div', null, 'upnotes flat');
      d.open = e.ver === info?.current;
      sum.append(el('span', 'v' + e.ver));
      if(e.beta) sum.append(el('span', tr('бета'), 'uptag warn'));
      if(e.ver === info?.current) sum.append(el('span', tr('установлена'), 'uptag'));
      sum.append(el('span', date(e.date), 'upwhen'));
      entryBody(body, e, e.beta); d.append(sum, body); return d;
    }));
  }
  addEventListener('keydown', e => { if(e.key === 'Escape' && view === 'settings'){ e.stopPropagation(); $('auClose').click(); } }, true);

  window.HudiniUpdates = {
    // the moderator's Host is running: start asking it. popups: show «what is new» and a downloaded update by itself
    start(opts = {}){
      if(!tauri) return;
      popups = !!opts.popups;
      if(on) return;
      on = true;
      if(!$('auCss')){ const css = document.createElement('link'); css.id = 'auCss'; css.rel = 'stylesheet'; css.href = new URL('updates.css', SRC).href; document.head.append(css); }
      if(!listening && tauri.event){ listening = true; tauri.event.listen('hudini-info', e => got(e.payload)); tauri.event.listen('hudini-update', () => ask()); }
      ask();
    },
    stop(){ on = false; info = null; entries = null; clearTimeout(poll); clearTimeout(retry); close(); },
    active:() => on,
    open:() => { if(on) settings(); },
    offer:() => { if(on) offer(); },
  };
  const SRC = document.currentScript.src;
})();
