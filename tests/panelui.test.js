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

  await step('the reliable-storage prompt and button are gone', async () => {
    const p = await open();
    await p.evaluate(() => HudiniUI.reset());
    eq(await p.evaluate(() => [!!document.getElementById('uiPersist'), !!document.getElementById('uiPersistInfo'), !!document.getElementById('persistBox'), 'persist' in HudiniUI.settings()]), [false, false, false, false], 'no persist button, info, box or setting');
    eq(await p.evaluate(() => 'persist' in JSON.parse(localStorage.getItem('hudini.ui'))), false, 'the saved view has no persist field');
    await p.context().close();
  });

  // ---------- layers ----------
  const order = p => p.evaluate(() => state.els.map(e => e.id + (e.g ? '@' + e.g : '')).join(' '));
  const shown = p => p.evaluate(() => [...document.querySelectorAll('#layers .layer')].map(r => r.dataset.g ? '[' + r.dataset.g + ']' : r.dataset.id).join(' '));
  const rowBox = (p, sel) => p.locator(`#layers ${sel}`).boundingBox();
  const dragTo = async (p, from, x, y, { keep = false } = {}) => {
    const b = await rowBox(p, from);
    await p.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2); await p.mouse.down();
    await p.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2 + 8, { steps: 3 });
    await p.mouse.move(x, y, { steps: 6 });
    if(!keep) await p.mouse.up();
    await sleep(60);
  };
  const where = async (p, sel, frac, dx = 0) => { const b = await rowBox(p, sel); return [b.x + b.width / 2 - 20 + dx, b.y + b.height * frac]; };
  const folderSpec = () => [{ id: 'a' }, { id: 'b', g: 'F', gn: 'Folder' }, { id: 'c', g: 'F', gn: 'Folder' }, { id: 'f', g: 'F', gn: 'Folder' }, { id: 'd' }, { id: 'e' }];
  // display top to bottom: e, d, [F: f c b], a

  await step('the trash button deletes a row or a whole folder, one undo step each', async () => {
    const p = await open();
    await mk(p, folderSpec());
    eq(await shown(p), 'e d [F] f c b a', 'start layout');
    await p.click('#layers .layer[data-id="d"] button[data-act=del]');
    eq([await order(p), await p.evaluate(() => undoStack.length)], ['a b@F c@F f@F e', 1], 'a row is deleted in one step');
    await p.evaluate(() => undo());
    eq(await order(p), 'a b@F c@F f@F d e', 'undo brings it back');
    await p.click('#layers .layer.folder button[data-act=del]');
    eq([await order(p), await p.evaluate(() => undoStack.length)], ['a d e', 1], 'the folder takes its members with it, in one step');
    await p.evaluate(() => undo());
    eq(await order(p), 'a b@F c@F f@F d e', 'one undo restores the whole folder');
    eq(await p.evaluate(() => document.querySelectorAll('#layers button[data-act=del]').length), 7, 'a trash button on every row and folder');
    await p.context().close();
  });

  await step('dragging rows: into a folder, out of it, a folder as a block, with an indicator', async () => {
    const p = await open();
    await mk(p, folderSpec());
    // e into the folder: over the top half of member c
    let [x, y] = await where(p, '.layer[data-id="c"]', 0.25);
    await dragTo(p, '.layer[data-id="e"]', x, y, { keep: true });
    check(await p.evaluate(() => { const d = document.getElementById('layerDrop'); return !!d && !d.hidden && d.getBoundingClientRect().height > 0; }), 'a drop line is shown while dragging');
    check(await p.evaluate(() => !!document.querySelector('#layers .layer.dragging')), 'the dragged row is dimmed');
    await p.mouse.up(); await sleep(60);
    eq([await order(p), await p.evaluate(() => undoStack.length), await p.evaluate(() => byId('e').gn)], ['a b@F c@F e@F f@F d', 1, 'Folder'], 'e joined the folder above c, one undo step, folder name copied');
    check(await p.evaluate(() => !document.getElementById('layerDrop') && !document.querySelector('#layers .dragging')), 'the line and dimming are gone');
    eq(await p.evaluate(() => [selectedId, state.els.filter(e => e.g === 'F').length]), ['e', 4], 'the dropped row is selected');
    // b out of the folder to below a (a is the last row)
    [x, y] = await where(p, '.layer[data-id="a"]', 0.8);
    await dragTo(p, '.layer[data-id="b"]', x, y);
    eq([await order(p), await p.evaluate(() => undoStack.length)], ['b a c@F e@F f@F d', 2], 'b left the folder and sits at the bottom');
    // d onto the folder header: lower part goes inside, on top
    [x, y] = await where(p, '.layer.folder', 0.8);
    await dragTo(p, '.layer[data-id="d"]', x, y);
    eq(await order(p), 'b a c@F e@F f@F d@F', 'dropping on the folder header puts the row inside at the top');
    // upper third of the header: above the folder, outside
    [x, y] = await where(p, '.layer.folder', 0.1);
    await dragTo(p, '.layer[data-id="d"]', x, y);
    eq(await order(p), 'b a c@F e@F f@F d', 'the top edge of the header puts it above the folder, outside');
    // below the last member, left of the indent: under the folder, outside
    await mk(p, folderSpec());
    const lb = await rowBox(p, '.layer[data-id="b"]');
    await dragTo(p, '.layer[data-id="d"]', lb.x - 8, lb.y + lb.height * 0.8);
    eq(await order(p), 'a d b@F c@F f@F e', 'left of the indent under the last member: below the folder, outside');
    // the folder moves as a block
    await mk(p, folderSpec());
    [x, y] = await where(p, '.layer[data-id="a"]', 0.8);
    await dragTo(p, '.layer.folder', x, y);
    eq([await order(p), await p.evaluate(() => undoStack.length)], ['b@F c@F f@F a d e', 1], 'the folder goes to the bottom as a block, one undo step');
    await p.context().close();
  });

  await step('a drop on the same place, a short click and Escape change nothing', async () => {
    const p = await open();
    await mk(p, folderSpec());
    let [x, y] = await where(p, '.layer[data-id="d"]', 0.9);
    await dragTo(p, '.layer[data-id="d"]', x, y);
    eq(await p.evaluate(() => [undoStack.length, __sent.length]), [0, 0], 'dropping a row on itself is not a change');
    const b = await rowBox(p, '.layer[data-id="e"]');
    await p.mouse.click(b.x + 30, b.y + b.height / 2); await sleep(100);
    eq(await p.evaluate(() => [selectedId, undoStack.length]), ['e', 0], 'a plain click still selects');
    [x, y] = await where(p, '.layer[data-id="a"]', 0.8);
    await dragTo(p, '.layer[data-id="e"]', x, y, { keep: true });
    await p.keyboard.press('Escape'); await p.mouse.up(); await sleep(60);
    eq([await order(p), await p.evaluate(() => undoStack.length)], ['a b@F c@F f@F d e', 0], 'Escape cancels the drag');
    eq(await p.evaluate(() => [selectedId, !!document.getElementById('layerDrop')]), ['e', false], 'and the line is gone; selection from the click stays');
    // the last member leaving a two-member folder dissolves the folder
    await mk(p, [{ id: 'a' }, { id: 'b', g: 'F', gn: 'Folder' }, { id: 'c', g: 'F', gn: 'Folder' }]);
    [x, y] = await where(p, '.layer[data-id="a"]', 0.8);
    await dragTo(p, '.layer[data-id="b"]', x, y);
    eq(await order(p), 'b a c', 'the remaining member is a plain row again');
    await p.context().close();
  });

  // ---------- password dialog ----------
  await step('the panel password is set and changed in one dialog, with an eye, without prompt()', async () => {
    const p = await open();
    const dialogs = []; p.on('dialog', d => dialogs.push(d.type()));
    const dlg = '#pwDlg';
    const vals = () => p.$$eval(`${dlg} input:not([type=checkbox])`, n => n.map(i => i.value));
    await p.click('#moreBtn'); await p.click('#passBtn');
    await p.waitForSelector(dlg);
    eq(await p.$$eval(`${dlg} input`, n => n.map(i => i.type)), ['password', 'password'], 'one window with a password field and a repeat field');
    await p.fill(`${dlg} input >> nth=0`, 'abc'); await p.fill(`${dlg} input >> nth=1`, 'abc');
    await p.click(`${dlg} #pwOk`);
    check(/6/.test(await p.textContent(`${dlg} .pwerr`)) && await p.isVisible(dlg), 'a short password is refused inside the window');
    await p.fill(`${dlg} input >> nth=0`, 'secret1'); await p.fill(`${dlg} input >> nth=1`, 'secret2');
    await p.click(`${dlg} #pwOk`);
    check(/не совпали/.test(await p.textContent(`${dlg} .pwerr`)) && await p.isVisible(dlg), 'a mismatch is shown inside the window, it stays open');
    await p.click(`${dlg} .pweye >> nth=0`);
    eq(await p.$$eval(`${dlg} input`, n => n.map(i => i.type)), ['text', 'password'], 'the eye shows the first field');
    await p.click(`${dlg} .pweye >> nth=0`);
    eq(await p.$eval(`${dlg} input`, i => i.type), 'password', 'and hides it again');
    await p.keyboard.press('Escape');
    eq([await p.isVisible(dlg).catch(() => false), await p.evaluate(() => vaultPass)], [false, null], 'Escape closes the window and sets nothing');
    await p.click('#moreBtn'); await p.click('#passBtn'); await p.waitForSelector(dlg);
    await p.fill(`${dlg} input >> nth=0`, 'secret1'); await p.fill(`${dlg} input >> nth=1`, 'secret1');
    await p.click(`${dlg} #pwOk`);
    check(await until(() => p.evaluate(() => vaultPass === 'secret1')), 'a good pair sets the password');
    await sleep(200);
    // the change dialog never shows the current password
    await p.click('#moreBtn'); await p.click('#passBtn'); await p.waitForSelector(dlg);
    eq([await vals(), await p.$$eval(`${dlg} input`, n => n.length)], [['', '', ''], 3], 'three empty fields: nothing is pre-filled, the current password is not shown');
    await p.fill(`${dlg} input >> nth=0`, 'wrong'); await p.click(`${dlg} #pwOk`);
    check(/Неверный/.test(await p.textContent(`${dlg} .pwerr`)) && await p.isVisible(dlg), 'a wrong current password is refused inside the window');
    await p.fill(`${dlg} input >> nth=0`, 'secret1'); await p.click(`${dlg} #pwOk`);
    check(await until(() => p.evaluate(() => vaultPass === null)), 'an empty new password removes the password');
    eq(dialogs, [], 'no browser prompt() or confirm() was used');
    await p.context().close();
  });

  await step('the backup password and the import password are asked in the same kind of window', async () => {
    const p = await open();
    const dialogs = []; p.on('dialog', d => dialogs.push(d.type()));
    const dlg = '#pwDlg';
    await p.evaluate(() => { vaultPass = 'panelpass1'; });
    await p.click('[data-tab=room]');
    let [dl] = await Promise.all([p.waitForEvent('download'), (async () => { await p.click('#roomExport'); await p.waitForSelector(dlg);
      eq(await p.$eval(`${dlg} input:not([type=checkbox])`, i => [i.type, i.value]), ['password', ''], 'the backup password field is empty, not filled with the panel password');
      check(await p.isVisible(`${dlg} input[type=checkbox]`), 'a box offers the panel password without showing it');
      await p.click(`${dlg} #pwOk`);
      check(/Введи/.test(await p.textContent(`${dlg} .pwerr`)), 'an empty password is refused');
      await p.fill(`${dlg} input:not([type=checkbox])`, 'bk-secret'); await p.click(`${dlg} #pwOk`); })()]);
    const file = await dl.path();
    const bk = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    eq(bk.overlayBackup, 2, 'an encrypted backup was downloaded');
    // the same-as-panel box
    [dl] = await Promise.all([p.waitForEvent('download'), (async () => { await p.click('#roomExport'); await p.waitForSelector(dlg);
      await p.check(`${dlg} input[type=checkbox]`);
      check(await p.$eval(`${dlg} input:not([type=checkbox])`, i => i.disabled), 'the field is off while the box is on');
      await p.click(`${dlg} #pwOk`); })()]);
    check(!!(await dl.path()), 'the box uses the panel password');
    // import: wrong password stays in the window, the right one imports
    await p.setInputFiles('#roomFile', file);
    await p.waitForSelector(dlg);
    await p.fill(`${dlg} input`, 'nope'); await p.click(`${dlg} #pwOk`);
    check(await until(async () => /Неверный/.test(await p.textContent(`${dlg} .pwerr`))) && await p.isVisible(dlg), 'a wrong import password is refused inside the window');
    await p.fill(`${dlg} input`, 'bk-secret'); await p.click(`${dlg} #pwOk`);
    check(await until(async () => /Добавлено/.test(await p.textContent('#toast'))), 'the right one opens the file');
    eq(dialogs, [], 'no browser dialogs');
    await p.context().close();
  });

  await step('the password window is translated', async () => {
    const p = await open({ lang: 'de' });
    await p.click('#moreBtn'); await p.click('#passBtn'); await p.waitForSelector('#pwDlg');
    await sleep(200);
    const t = await p.evaluate(() => document.getElementById('pwDlg').innerText);
    check(/Passwort/.test(t) && !/[а-яА-Я]/.test(t), 'no Russian left in the German window: ' + t.replace(/\n/g, ' | '));
    await p.context().close();
  });

  await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
