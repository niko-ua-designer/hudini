// Buttons in the panel lists (library, scenes, scenarios, keyframes) are drawn as SVG icons: a click on the icon itself
// must do what the button says. Library items saved in a previous room are copied into the new one.
'use strict';
const path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const PNG = path.join(__dirname, 'fixtures/img.png');

// a real mouse click in the middle of the icon, so the event target is inside the button
const icon = async (p, sel) => {
  await p.locator(sel).scrollIntoViewIfNeeded();
  check(await p.$eval(sel, b => !!b.querySelector('svg')), 'the button shows an icon: ' + sel);
  const b = await p.locator(`${sel} svg`).first().boundingBox();
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(60);
};

(async () => {
  const web = await T.webServer();
  const open = async () => {
    const p = await T.newPage('lists', { app: false });
    await p.goto(`${web.url}/panel/moderator.html`);
    await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    await p.evaluate(() => {
      useMain({ connected: true, subscribe(){}, unsubscribe(){}, publish(t, box, o, cb){ cb(); }, on(){}, end(){} });
      state = { visible: true, hidAll: [], vol: 1, fxVol: 1, raffle: null, els: [] };
      undoStack.length = 0; changeOpen = false; selectedId = null; msel.clear(); renderAll();
    });
    return p;
  };
  const onScreen = p => p.evaluate(() => state.els.map(e => e.text).join(' '));

  await step('library: the cross removes the item and puts nothing on stream, even when its file is gone', async () => {
    const p = await open();
    await p.click('[data-tab=scenes]');
    await p.evaluate(() => {
      library.length = 0;
      library.push({ name: 'gone', room: 'oldroom123456789', el: { type: 'image', src: 'asset:missingfile000', x: 10, y: 10, w: 20 } },
        { name: 'kept', room, el: { type: 'text', text: 'kept', x: 10, y: 10, w: 20 } });
      saveLib(); renderLib();
    });
    await icon(p, '#libList .lib[data-i="0"] button[data-a=del]');
    eq(await p.evaluate(() => library.map(i => i.name)), ['kept'], 'the item left the library');
    eq(await p.evaluate(() => state.els.length), 0, 'nothing was added to the screen');
    eq(await p.evaluate(() => JSON.parse(localStorage.getItem('store:overlay.lib') || 'null')?.map(i => i.name) ?? lsGet('overlay.lib', []).map(i => i.name)), ['kept'], 'and the removal is saved');
    await p.click('#libList .lib .name');
    check(await until(async () => await onScreen(p) === 'kept'), 'a click on the row still adds the element');
    await p.context().close();
  });

  await step('scenes: the cross and the disk work on the scene and do not switch it on', async () => {
    const p = await open();
    await p.click('[data-tab=scenes]');
    await p.evaluate(() => {
      const t = text => sanitizeEl({ id: text, type: 'text', text });
      state.els = [t('now')];
      scenes[room] = [{ name: 'one', els: [t('one')] }, { name: 'two', els: [t('two')] }]; saveScenes(); renderScenes(); renderAll();
    });
    await icon(p, '#sceneList .scene[data-i="0"] button[data-a=upd]');
    eq([await p.evaluate(() => scenes[room][0].els.map(e => e.text)), await onScreen(p)], [['now'], 'now'], 'the disk rewrites the scene with the screen');
    await icon(p, '#sceneList .scene[data-i="1"] button[data-a=del]');
    eq([await p.evaluate(() => scenes[room].map(s => s.name)), await onScreen(p)], [['one'], 'now'], 'the cross deletes the scene, the screen stays');
    await p.context().close();
  });

  await step('scenarios: run, edit and delete', async () => {
    const p = await open();
    await p.click('[data-tab=auto]');
    await p.evaluate(() => {
      window.__ran = []; runScenario = sc => __ran.push(sc.id);
      scnList().length = 0; scnList().push({ id: 's1', name: 'first', on: true, trig: { type: 'manual' }, acts: [{ t: 'shake' }] }); saveScn(); renderScn();
    });
    await icon(p, '#scnList .scn button[data-a=run]');
    eq(await p.evaluate(() => __ran), ['s1'], 'the triangle runs it');
    await icon(p, '#scnList .scn button[data-a=edit]');
    check(await p.isVisible('#scnEdit'), 'the pencil opens the editor');
    await icon(p, '#scnList .scn button[data-a=del]');
    eq(await p.evaluate(() => scnList().length), 0, 'the cross deletes it');
    await p.context().close();
  });

  await step('keyframes: the pin stores the position, the cross deletes the frame', async () => {
    const p = await open();
    await p.evaluate(() => {
      state.els = [sanitizeEl({ id: 'k', type: 'text', text: 'k', x: 10, y: 10, w: 20 })]; selectedId = 'k';
      const el = byId('k'); el.kf = { f: [frameFrom(el), frameFrom(el)], mode: 'once', end: 'stay', start: 0, playing: false }; el.x = 40; renderAll();
      for(let n = document.getElementById('kfList'); n; n = n.parentElement){ if(n.tagName === 'DETAILS') n.open = true; }
    });
    check(await until(() => p.isVisible('#kfList .kf button[data-a=set]')), 'the frame list is on screen');
    await icon(p, '#kfList .kf[data-i="0"] button[data-a=set]');
    eq(await p.evaluate(() => byId('k').kf.f.map(f => Math.round(f.x))), [40, 10], 'the first frame took the current position');
    await icon(p, '#kfList .kf[data-i="1"] button[data-a=del]');
    eq(await p.evaluate(() => byId('k').kf.f.length), 1, 'the second frame is gone');
    await p.context().close();
  });
  await step('drawing strokes stay unless fading is switched on', async () => {
    const p = await open();
    const box = () => p.evaluate(() => [document.getElementById('dFadeOn').checked, document.getElementById('dFade').disabled]);
    // a fresh start of the panel, then the drawing tool: its strip shows the saved settings
    const reload = async () => { await p.reload(); await p.waitForFunction(() => window.hudiniReady && window.Draw, null, { timeout: 15000 }); await p.click('[data-tab=add]'); await p.click('#addDraw'); await sleep(200); };
    await reload();
    eq(await box(), [false, true], 'off on a first start');
    // what 1.1.2 saved after any change of the pen, with the box never touched
    await p.evaluate(() => HudiniStore.set('hudini.draw', { tool: 'pen', color: '#ff3b5c', size: 8, fadeOn: true, fade: 5, mode: 'live' }));
    await reload();
    eq(await box(), [false, true], 'off after an update too');
    await p.evaluate(() => { const i = document.getElementById('dFadeOn'); i.checked = true; i.dispatchEvent(new Event('change')); });
    await reload();
    eq(await box(), [true, false], 'switched on by hand it stays on');
    await p.context().close();
  });
  await web.close();

  await step('library after the Host made a new room: the file is copied from the previous room', async () => {
    const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
    const { panel, host } = S;
    await panel.setInputFiles('#fileInput', PNG);
    check(await until(() => panel.evaluate(() => state.els.some(e => String(e.src).startsWith('asset:'))), 8000), 'the picture is uploaded');
    const old = await panel.evaluate(() => {
      const el = JSON.parse(JSON.stringify(state.els.find(e => String(e.src).startsWith('asset:'))));
      delete el.id; library.length = 0; library.push({ name: 'pic', room, el }); saveLib(); renderLib();
      return { room, src: el.src };
    });
    await host.api('/api/room/new', { name: 'fresh' });
    const { data } = await host.code();
    await panel.evaluate(async d => {
      Assets.urls.clear();   // a restarted panel has nothing in memory
      rooms.push(cleanRoom({ code: d.room, name: d.name, k: d.k, p: d.p, s: d.s })); saveRooms(); await switchRoom(d.room);
    }, data);
    await T.attach(panel, host);
    check(await until(() => panel.evaluate(() => !!homeHttp()), 15000), 'the panel is connected to the new room');
    await panel.click('[data-tab=scenes]');
    await panel.click('#libList .lib .name');
    check(await until(() => panel.evaluate(src => state.els.some(e => String(e.src).startsWith('asset:') && e.src !== src), old.src), 10000), 'the element is on screen with a fresh copy of the file');
    const copy = await panel.evaluate(() => state.els.find(e => String(e.src).startsWith('asset:')).src.slice(6));
    const ids = await panel.evaluate(async () => { const h = homeHttp(); return (await (await fetch(h.base + '/files', { headers: { authorization: h.auth } })).json()).ids.map(x => x[0]); });
    check(ids.includes(copy), 'the Host has the copy in the new room', ids);
    await S.close();
  });

  await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
