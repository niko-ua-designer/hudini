// Первый экран приложения (web/app/start.html): выбор роли и сохранённые сессии модератора.
// Rust-часть заменена заглушкой window.__TAURI__ (команды пишутся в window.__calls, store лежит в localStorage).
'use strict';
const T = require('./lib');
const { step, check, eq } = T;
const S = require('../web/app/sessions.js');

const FP = 'ab'.repeat(32);
const mk = (o = {}) => 'hudini1:' + Buffer.from(JSON.stringify({ v:1, name:'etsuitoku', room:'room_abc123', pass:'secret-pass', fp:FP,
  addrs:[{ h:'100.64.0.7', port:7778, net:'tailscale' }, { h:'127.0.0.1', port:7778, net:'porthole' }], ...o })).toString('base64url');
const KEYS = { k:'KEY', p:'PUB', s:{ kty:'EC', d:'x' } };

const STUB = () => {
  window.__calls = [];
  const st = () => { try{ return JSON.parse(localStorage.getItem('fake.store') || '{}'); }catch{ return {}; } };
  window.__TAURI__ = {
    core: { invoke: async (cmd, args) => {
      window.__calls.push([cmd, args]);
      if(cmd === 'store_load') return st();
      if(cmd === 'store_save'){ localStorage.setItem('fake.store', JSON.stringify(args.data)); return null; }
      if(cmd === 'app_state') return window.__appState || { role:'', remember:false, version:'1.0.0-rc.5', update:null };
      if(cmd === 'start_role' && window.__startFails) throw new Error('boom');
      return null;
    } },
    event: { listen: (n, f) => { (window.__listeners ||= {})[n] = f; return Promise.resolve(() => {}); } },
  };
};

(async () => {
  // ---------- логика сессий ----------
  await step('parseCode', async () => {
    const c = S.parseCode('вот код ' + mk() + ' спасибо');
    check(c && c.room === 'room_abc123' && c.addrs.length === 2 && !c.k, 'valid code parsed, no keys');
    check(S.parseCode(mk(KEYS)).k === 'KEY', 'keys kept when present');
    check(S.parseCode(mk({ fp:'zz' })) === null, 'bad fingerprint rejected');
    check(S.parseCode(mk({ pass:'' })) === null, 'empty password rejected');
    check(S.parseCode(mk({ room:'../x' })) === null, 'bad room rejected');
    check(S.parseCode(mk({ addrs:[{ h:'a b', port:1 }, { h:'x', port:70000 }] })) === null, 'no valid addresses rejected');
    check(S.parseCode(mk({ addrs:[{ h:'1.2.3.4', port:7778, net:'weird' }] })).addrs[0].net === 'inet', 'unknown network becomes inet');
    check(S.parseCode('hudini1:!!!') === null && S.parseCode('') === null && S.parseCode(null) === null, 'garbage rejected');
    eq(S.parseCode(mk({ name:'  ' + 'я'.repeat(60) })).name.length, 40, 'name cut to 40');
  });
  await step('addCode keeps room keys', async () => {
    let r = S.addCode([], S.parseCode(mk(KEYS)));
    check(r.created && r.session.k === 'KEY', 'new session with keys');
    const again = S.addCode(r.list, S.parseCode(mk({ pass:'new-pass', fp:'cd'.repeat(32), addrs:[{ h:'10.0.0.5', port:9, net:'lan' }] })));
    check(!again.created && !again.keysDiffer && again.session.pass === 'new-pass' && again.session.fp === 'cd'.repeat(32) && again.session.addrs[0].h === '10.0.0.5', 'address, fingerprint and password updated');
    eq(again.session.k, 'KEY', 'old keys stay when the new code has none');
    const diff = S.addCode(r.list, S.parseCode(mk({ ...KEYS, k:'OTHER' })));
    check(diff.keysDiffer && diff.session.k === 'KEY', 'different keys are flagged and not applied');
    const noKeys = S.addCode([], S.parseCode(mk()));
    const fill = S.addCode(noKeys.list, S.parseCode(mk(KEYS)));
    eq(fill.session.k, 'KEY', 'missing keys are filled in');
  });
  await step('sort and clean', async () => {
    const mkS = (id, o) => ({ id, name:id, pass:'p', fp:FP, addrs:[{ h:'h', port:1, net:'lan' }], pinned:false, added:1, last:0, lastNet:'', ...o });
    eq(S.sortSessions([mkS('old', { last:5 }), mkS('new', { last:9 }), mkS('pin', { pinned:true, last:1 })]).map(s => s.id), ['pin', 'new', 'old'], 'pinned first, then latest');
    eq(S.cleanList([mkS('room1'), mkS('room1'), { id:'../bad' }, null, 5]).map(s => s.id), ['room1'], 'bad and duplicate entries dropped');
    eq(S.whenText(0, 'ru').key, 'ещё не заходил', 'never visited');
    const now = new Date(2026, 10, 12, 20, 0).getTime();
    check(S.whenText(new Date(2026, 10, 12, 9, 5).getTime(), 'en', now).key === 'сегодня, {t}', 'today');
    check(S.whenText(new Date(2026, 10, 11, 23, 0).getTime(), 'en', now).key === 'вчера', 'yesterday');
    check(/3/.test(S.whenText(new Date(2026, 10, 9, 12, 0).getTime(), 'en', now).rel), 'days ago');
  });

  // ---------- экран ----------
  const web = await T.webServer();
  const open = async (lang = 'ru', pre) => {
    const p = await T.newPage('start-' + lang, { w: 1000, h: 700, lang });
    await p.addInitScript(STUB);
    if(pre) await p.addInitScript(pre);
    await p.goto(`${web.url}/app/start.html`);
    await p.waitForFunction(() => window.hudiniStartReady);
    return p;
  };
  const calls = p => p.evaluate(() => window.__calls.map(c => c[0]));
  const rows = p => p.$$eval('.row', r => r.map(x => x.querySelector('b').textContent.replace('📌', '').trim()));

  await step('first start: streamer tab, nothing saved', async () => {
    const p = await open();
    check(await p.isVisible('#paneStr') && !await p.isVisible('#paneMod'), 'streamer pane shown first');
    eq(await p.textContent('#ver'), 'v1.0.0-rc.5', 'version shown');
    check(!(await calls(p)).includes('start_role'), 'nothing started before a choice');
    await p.click('#tabMod');
    check(await p.isVisible('#empty') && await p.isVisible('#paneMod'), 'moderator pane with empty hint');
    check((await calls(p)).includes('start_role'), 'moderator role started');
    eq(await p.evaluate(() => window.__calls.find(c => c[0] === 'start_role')[1]), { role:'mod', remember:false }, 'start_role args');
    await p.context().close();
  });

  await step('streamer start and remember', async () => {
    const p = await open();
    await p.check('#remember');
    check((await calls(p)).includes('set_remember'), 'set_remember called');
    await p.click('#startBtn');
    eq(await p.evaluate(() => window.__calls.filter(c => c[0] === 'start_role').pop()[1]), { role:'streamer', remember:true }, 'start_role streamer with remember');
    await p.context().close();
    const q = await open('ru', () => { window.__startFails = true; });
    await q.click('#startBtn');
    await q.waitForSelector('#startErr:not([hidden])');
    check((await q.textContent('#startErr')).includes('boom') && !await q.isDisabled('#startBtn'), 'error shown and the button comes back');
    await q.context().close();
  });

  await step('add, pin, rename, delete, enter', async () => {
    const p = await open();
    await p.click('#tabMod');
    await p.fill('#codeIn', 'мусор'); await p.press('#codeIn', 'Enter');
    check((await p.textContent('#toast')).includes('не код'), 'garbage gives a hint');
    await p.fill('#codeIn', mk()); await p.press('#codeIn', 'Enter');
    eq(await rows(p), ['etsuitoku'], 'session added');
    eq(await p.inputValue('#codeIn'), '', 'input cleared');
    check(await p.isHidden('#empty'), 'empty hint hidden');
    check((await p.textContent('.row .net')).includes('Tailscale'), 'network label from the first address');
    // тот же код ещё раз — не дубль
    await p.fill('#codeIn', mk({ pass:'other' })); await p.press('#codeIn', 'Enter');
    eq((await rows(p)).length, 1, 'same room is not duplicated');
    await p.fill('#codeIn', mk({ room:'room_second', name:'Mira_plays' })); await p.press('#codeIn', 'Enter');
    eq((await rows(p)).length, 2, 'second streamer');
    // закрепить второго в списке (старый стример идёт после нового)
    await p.click('.row:nth-child(2) [data-more]'); await p.click('#menu [data-act=pin]');
    eq(await rows(p), ['etsuitoku', 'Mira_plays'], 'pinned goes first');
    check(await p.isVisible('.row:nth-child(1) .pin'), 'pin mark shown');
    await p.evaluate(() => { window.prompt = () => 'Мира'; });
    await p.click('.row:nth-child(1) [data-more]'); await p.click('#menu [data-act=rename]');
    eq((await rows(p))[0], 'Мира', 'renamed');
    // сохранилось: перезагрузка
    await p.reload(); await p.waitForFunction(() => window.hudiniStartReady);
    await p.click('#tabMod');
    eq(await rows(p), ['Мира', 'Mira_plays'], 'sessions survive a reload');
    eq((await p.evaluate(() => JSON.parse(localStorage.getItem('fake.store'))['app.sessions'].find(s => s.id === 'room_abc123').pass)), 'other', 'new password stored');
    // удалить
    await p.click('.row:nth-child(2) [data-more]'); await p.click('#menu [data-act=del]');
    eq(await rows(p), ['Мира'], 'deleted');
    // войти: пульт стирает query из адреса, поэтому смотрим на запрос
    const [req] = await Promise.all([p.waitForRequest(/panel\/moderator\.html\?session=room_abc123$/, { timeout: 5000 }), p.click('.row [data-go]')]);
    check(!!req, 'enter opens the panel with the session id');
    await p.context().close();
  });

  await step('paste and drop', async () => {
    const p = await open();
    await p.click('#tabMod');
    await p.evaluate(code => { const dt = new DataTransfer(); dt.setData('text/plain', code); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, mk());
    eq(await rows(p), ['etsuitoku'], 'Ctrl+V adds a session');
    await p.evaluate(code => { const dt = new DataTransfer(); dt.setData('text/plain', code); window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, mk({ room:'room_dropped', name:'Dropped' }));
    await p.waitForFunction(() => document.querySelectorAll('.row').length === 2);
    check(true, 'drop adds a session');
    await p.context().close();
  });

  await step('update banner', async () => {
    const p = await open('ru', () => { window.__appState = { role:'', remember:false, version:'1.0.0-rc.5', update:{ state:'ready', ver:'1.0.0-rc.6' } }; });
    check(await p.isVisible('#updBanner') && (await p.textContent('#updVer')) === '1.0.0-rc.6', 'banner from app_state');
    await p.click('#updBtn');
    check((await calls(p)).includes('apply_update'), 'apply_update called');
    await p.context().close();
    const q = await open();
    check(await q.isHidden('#updBanner'), 'no banner without an update');
    await q.evaluate(() => window.__listeners['hudini-update']({ payload:{ state:'ready', ver:'9.9.9' } }));
    check(await q.isVisible('#updBanner'), 'banner from the event');
    await q.context().close();
  });

  await step('saved role opens its tab', async () => {
    const p = await open('ru', () => { window.__appState = { role:'mod', remember:true, version:'1', update:null }; });
    check(await p.isVisible('#paneMod') && await p.isChecked('#remember'), 'moderator tab and checkbox from app_state');
    await p.context().close();
  });

  for(const lang of ['en', 'uk', 'de']) await step('translated and fits: ' + lang, async () => {
    const p = await open(lang);
    await p.click('#tabMod');
    await p.fill('#codeIn', mk()); await p.press('#codeIn', 'Enter');
    await p.click('[data-more]');
    const text = (await p.evaluate(() => document.body.innerText)).replace(/Русский|Українська|English|Deutsch/g, '');
    if(lang !== 'uk') check(!/[А-Яа-яЁё]/.test(text), 'no Cyrillic left on the screen (' + lang + ')', text.match(/[А-Яа-яЁё]+/g));
    if(lang === 'uk') check(!/Запустить|Модератор\b|Добавить|Войти/.test(text), 'Russian words translated');
    const bad = await p.evaluate(() => [...document.querySelectorAll('button, input')].filter(b => b.offsetParent && (b.scrollWidth > b.clientWidth + 2 || b.getBoundingClientRect().right > innerWidth)).map(b => b.id || b.textContent.trim()));
    check(!bad.length, 'controls fit', bad);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
    await p.context().close();
  });

  await T.closeBrowser(); await web.close();
  const errs = T.pageErrors.filter(e => !/Not running inside/.test(e));
  check(!errs.length, 'no page errors', errs);
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
