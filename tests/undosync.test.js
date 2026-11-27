// Undo with two panels on one room: Ctrl+Z takes back only this panel's own changes, element by element.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid, host } = S;
  const inv = await mod.evaluate(() => inviteLink(curRoom()));
  const mod2 = await T.newPage('mod2');
  await mod2.goto(inv);
  await mod2.waitForFunction(() => typeof curRoom === 'function' && curRoom());
  await T.attach(mod2, host);
  await until(async () => (await mod2.getAttribute('#status', 'class')).includes('ok'), 12000);

  // one change on a panel, as the inspector makes it
  const edit = (p, code) => p.evaluate(`(() => { beginChange(); ${code} commit(); })()`);
  const view = p => p.evaluate(() => state.els.map(e => `${e.id}:${e.text ?? e.title}:${Math.round(e.x)}${e.hidden ? ':h' : ''}`).join(' '));
  const widView = () => wid.evaluate(() => (lastState?.els || []).map(e => `${e.id}:${e.text ?? e.title}:${Math.round(e.x)}${e.hidden ? ':h' : ''}`).join(' '));
  // both panels and the stream show the same screen
  const synced = async want => until(async () => { const [a, b, w] = await Promise.all([view(mod), view(mod2), widView()]); return a === want && b === want && w === want; }, 8000);
  const stage = async want => { const ok = await synced(want); if(!ok) console.log('   panel:', await view(mod), '\n   panel2:', await view(mod2), '\n   stream:', await widView()); return ok; };
  const toastText = p => p.evaluate(() => document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '');
  const clearToast = p => p.evaluate(() => document.getElementById('toast').classList.remove('show'));

  await step('setup: three texts on both panels', async () => {
    await mod.evaluate(() => { beginChange(); state.els = ['a', 'b', 'c'].map((id, i) => sanitizeEl({ id, type: 'text', text: id.toUpperCase(), x: 10 + i * 10, y: 50 })); undoStack.length = 0; commit(); undoStack.length = 0; });
    check(await stage('a:A:10 b:B:20 c:C:30'), 'both panels and the stream have a, b, c');
  });

  await step('Ctrl+Z takes back my move and keeps the other panel\'s text', async () => {
    await edit(mod, 'byId("a").x = 70;');
    check(await stage('a:A:70 b:B:20 c:C:30'), 'my move reached everyone');
    await edit(mod2, 'byId("b").text = "B2";');
    check(await stage('a:A:70 b:B2:20 c:C:30'), 'the other panel\'s text reached everyone');
    await mod.keyboard.press('Control+z');
    check(await stage('a:A:10 b:B2:20 c:C:30'), 'a is back, b keeps the other panel\'s text');
    check(!(await toastText(mod)).includes('Часть правок пропущена'), 'no conflict toast');   // other toasts (free storage space) may be on screen
  });

  await step('redo uses the same step', async () => {
    await mod.keyboard.press('Control+Shift+z');
    check(await stage('a:A:70 b:B2:20 c:C:30'), 'Ctrl+Shift+Z moves a again');
    await mod.keyboard.press('Control+y');
    eq(await toastText(mod), 'Нечего повторять', 'nothing more to redo');
    await mod.keyboard.press('Control+z');
    check(await stage('a:A:10 b:B2:20 c:C:30'), 'and back');
  });

  await step('an element the other panel changed after me is skipped with a toast', async () => {
    await edit(mod, 'byId("c").text = "mine";');
    check(await stage('a:A:10 b:B2:20 c:mine:30'), 'my text reached everyone');
    await edit(mod2, 'byId("c").text = "theirs";');
    check(await stage('a:A:10 b:B2:20 c:theirs:30'), 'their text replaced mine');
    await clearToast(mod);
    await mod.evaluate(() => undo());
    await sleep(600);
    eq(await view(mod2), 'a:A:10 b:B2:20 c:theirs:30', 'their text stays on the other panel');
    eq(await view(mod), 'a:A:10 b:B2:20 c:theirs:30', 'and on mine');
    eq(await toastText(mod), 'Часть правок пропущена: их уже поменял другой модератор', 'a toast says the change was skipped');
  });

  await step('a deleted element comes back in its place, the other panel\'s new element stays', async () => {
    await edit(mod, 'state.els = state.els.filter(e => e.id !== "b");');
    check(await stage('a:A:10 c:theirs:30'), 'b is gone everywhere');
    await edit(mod2, 'state.els.push(sanitizeEl({ id: "d", type: "text", text: "D", x: 40, y: 50 }));');
    check(await stage('a:A:10 c:theirs:30 d:D:40'), 'the other panel added d');
    await mod.click('#undoBtn');
    check(await stage('a:A:10 b:B2:20 c:theirs:30 d:D:40'), 'b is back between a and c, d stays');
    await mod.evaluate(() => redo());
    check(await stage('a:A:10 c:theirs:30 d:D:40'), 'redo deletes b again');
    await mod.evaluate(() => undo());
    check(await stage('a:A:10 b:B2:20 c:theirs:30 d:D:40'), 'undo brings it back again');
  });

  await step('layer order and folders come back, the other panel\'s edit stays', async () => {
    await edit(mod, 'const [a, b, c, d] = state.els; state.els = [d, c, b, a]; c.g = "f1"; c.gn = "F"; b.g = "f1"; b.gn = "F";');
    check(await stage('d:D:40 c:theirs:30 b:B2:20 a:A:10'), 'reordered everywhere');
    eq(await mod2.evaluate(() => state.els.map(e => e.g || '-').join()), '-,f1,f1,-', 'the folder reached the other panel');
    await edit(mod2, 'byId("d").text = "D2";');
    check(await stage('d:D2:40 c:theirs:30 b:B2:20 a:A:10'), 'the other panel renamed d');
    await mod.evaluate(() => undo());
    check(await stage('a:A:10 b:B2:20 c:theirs:30 d:D2:40'), 'the old order is back and d keeps its new text');
    eq(await mod2.evaluate(() => state.els.map(e => e.g || '-').join()), '-,-,-,-', 'the folder is gone on the other panel too');
  });

  await step('hide all is one step that comes back without touching the other panel\'s element', async () => {
    await mod.click('#globalEye');
    check(await stage('a:A:10:h b:B2:20:h c:theirs:30:h d:D2:40:h'), 'hide all hid everything');
    await edit(mod2, 'state.els.push(sanitizeEl({ id: "e", type: "text", text: "E", x: 60, y: 50 }));');
    check(await stage('a:A:10:h b:B2:20:h c:theirs:30:h d:D2:40:h e:E:60'), 'the other panel added a visible element');
    await mod.evaluate(() => undo());
    check(await stage('a:A:10 b:B2:20 c:theirs:30 d:D2:40 e:E:60'), 'undo shows the four again and keeps e');
    eq(await mod2.evaluate(() => state.hidAll), [], 'hide all is off on the other panel');
  });

  await step('a screen from the other panel in the middle of my change is not part of my step', async () => {
    await mod.evaluate(() => { beginChange(); byId('a').x = 55; changed(); });   // e.g. a slider still held
    await edit(mod2, 'byId("b").text = "mid";');
    check(await until(async () => (await mod.evaluate(() => byId('b').text)) === 'mid'), 'their text arrived while my change was open');
    await mod.evaluate(() => { byId('a').x = 60; commit(); });
    check(await stage('a:A:60 b:mid:20 c:theirs:30 d:D2:40 e:E:60'), 'my change reached everyone');
    await mod.evaluate(() => undo());
    check(await stage('a:A:10 b:mid:20 c:theirs:30 d:D2:40 e:E:60'), 'undo moves a back and leaves their text');
  });

  await step('chat votes that came in later are not wiped by undo', async () => {
    await edit(mod, 'state.els.push(sanitizeEl({ id: "p", type: "poll", title: "Q", opts: ["x", "y"], running: true, x: 80, y: 50 }));');
    await edit(mod, 'byId("p").title = "Q2";');
    check(await until(async () => (await mod2.evaluate(() => byId('p')?.title)) === 'Q2'), 'the other panel has the poll');
    await mod2.evaluate(() => { onChat('anna', '2', null); onChat('boris', '1', null); });
    check(await until(async () => JSON.stringify(await mod.evaluate(() => byId('p').votes)) === '[1,1]'), 'two votes reached my panel');
    await clearToast(mod);
    await mod.evaluate(() => undo());
    await sleep(800);
    eq(await mod2.evaluate(() => [byId('p').title, byId('p').votes]), ['Q', [1, 1]], 'the title is back, the votes stay');
    eq(await toastText(mod), '', 'votes are not a conflict');
  });

  await step('a scene is one step that undo takes back', async () => {
    const before = await view(mod);
    await mod.evaluate(() => applyScene({ name: 's', els: [{ id: 'z', type: 'text', text: 'Z', x: 5, y: 5 }] }, false));
    check(await stage('z:Z:5'), 'the scene replaced the screen');
    await mod.evaluate(() => undo());
    check(await stage(before), 'undo brings the old screen back');
  });

  eq(T.pageErrors, [], 'no page errors');
  await mod2.context().close();
  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
