// Panel interface: hide-all through the eyes, layers (delete, drag between folders), side panels, password dialog.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const web = await T.webServer();
  const open = async (opts = {}) => {
    const p = await T.newPage('ui', { app: false, ...opts });
    await p.goto(`${web.url}/panel/moderator.html`);
    await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    await p.evaluate(() => { window.__sent = []; useMain({ connected: true, subscribe(){}, unsubscribe(){}, publish(t, box, o, cb){ __sent.push(box); cb(); }, on(){}, end(){} }); });
    return p;
  };
  const mk = (p, spec) => p.evaluate(spec => {
    state = { visible: true, hidAll: [], vol: 1, fxVol: 1, raffle: null, els: spec.map(s => sanitizeEl({ type: 'text', text: s.id, ...s })) };
    undoStack.length = 0; changeOpen = false; selectedId = null; msel.clear(); renderAll();
  }, spec);

  await step('hide all closes the eyes of visible elements; show all opens exactly those', async () => {
    const p = await open();
    await mk(p, [{ id: 'a' }, { id: 'b', hidden: true }, { id: 'c' }, { id: 'd' }]);
    const hid = () => p.evaluate(() => state.els.map(e => e.hidden ? 1 : 0).join(''));
    check(/Скрыть/.test(await p.textContent('#globalEye')), 'the button offers to hide');
    await p.click('#globalEye');
    eq([await hid(), await p.evaluate(() => state.hidAll), await p.evaluate(() => state.visible)], ['1111', ['a', 'c', 'd'], true], 'every visible element is hidden and remembered');
    check(/Показать/.test(await p.textContent('#globalEye')), 'the button offers to show');
    check(await p.evaluate(() => document.querySelector('#stage').classList.contains('all-hidden')), 'the stage says everything is hidden');
    await p.evaluate(() => { beginChange(); byId('c').hidden = false; commit(); });   // opened by hand in between
    await p.click('#globalEye');
    eq([await hid(), await p.evaluate(() => state.hidAll)], ['0100', []], 'show all opens the remembered ones, c opened by hand stays open, b hidden before stays closed');
    check(/Скрыть/.test(await p.textContent('#globalEye')), 'and the button is back');
    await p.click('#globalEye'); await p.evaluate(() => undo());
    eq(await hid(), '0100', 'hide all is one undo step');
    // opening everything by hand makes the button offer hiding again
    await p.click('#globalEye');
    await p.evaluate(() => { beginChange(); state.els.forEach(e => e.hidden = false); commit(); });
    check(/Скрыть/.test(await p.textContent('#globalEye')), 'everything opened by hand returns the hide button');
    eq(await p.evaluate(async () => { const m = await unsealJSON(KEYS, __sent.at(-1), true); return [m.visible, Array.isArray(m.hidAll)]; }), [true, true], 'the screen is sent with visible:true and hidAll');
    await p.context().close();
  });

  await step('an old screen with visible:false becomes hidden elements', async () => {
    const p = await open();
    const r = await p.evaluate(() => { const s = sanitizeState({ visible: false, els: [{ id: 'a', type: 'text', text: 'a' }, { id: 'b', type: 'text', text: 'b', hidden: true }] }); return { v: s.visible, h: s.els.map(e => e.hidden), all: s.hidAll }; });
    eq(r, { v: true, h: [true, true], all: ['a'] }, 'migrated: all hidden, visible is true, only the previously visible one is remembered');
    await p.context().close();
  });

  await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
