// Panel robustness: key rotation keeps room data, broken saved data does not empty the panel.
'use strict';
const T = require('./lib');
const { step, check, eq, until } = T;

(async () => {
  const web = await T.webServer();
  const open = async (seed) => {
    const p = await T.newPage('fix', { app: false });
    if (seed) await p.addInitScript(([s]) => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem('store:' + k, JSON.stringify(v)); } } catch {} }, [seed]);
    await p.goto(`${web.url}/panel/moderator.html`);
    await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    return p;
  };

  await step('rekey moves scenes, scenarios and library to the new room code', async () => {
    const p = await open();
    const r = await p.evaluate(async () => {
      const old = room;
      scenes[old] = [{ id: 's1', name: 'Scene', els: [] }]; saveScenes();
      scnStore[old] = [{ id: 'c1', name: 'Script', acts: [] }]; saveScn();
      library.push({ name: 'Item', room: old, el: { type: 'text', text: 'x' } }); saveLib();
      document.getElementById('roomRekey').click();
      for (let i = 0; i < 100 && room === old; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 300));
      return { old, now: room, sc: (scenes[room] || []).length, scOld: !!scenes[old], scn: (scnStore[room] || []).length, scnOld: !!scnStore[old], lib: library.filter(i => i.room === room).length, libOld: library.filter(i => i.room === old).length };
    });
    check(r.now !== r.old, 'room code changed');
    eq([r.sc, r.scOld, r.scn, r.scnOld, r.lib, r.libOld], [1, false, 1, false, 1, 0], 'data followed the new code');
    await p.context().close();
  });

  await step('a vault without a rooms array still boots', async () => {
    const p = await open({ 'overlay.vault2': { plain: { rooms: {} } } });
    check(await p.evaluate(() => rooms.length >= 1 && !!room), 'panel has a room');
    await p.context().close();
  });

  await step('no room yet: the connection pill does not claim a pause', async () => {
    const p = await open();
    const r = await p.evaluate(() => { const keep = room; room = null; const m = statusModel(); room = keep; return [m.text, m.strip?.head || '']; });
    check(!/паузу/.test(r.join(' ')), 'pill and strip: ' + r.join(' | '));
    await p.context().close();
  });

  await step('a broadcast layer is named by its owner, without the client id, and an empty frame has a caption', async () => {
    const p = await open();
    const r = await p.evaluate(async () => {
      const cam = addEl({ type: 'stream', owner: 'mod_n9ffs8kqz1', kind: 'cam', x: 30, y: 30, w: 25 });
      const own = sanitizeEl({ id: 's2', type: 'stream', owner: 'streamer', kind: 'screen' });
      const names = [elName(state.els.at(-1)), elName(own)];
      await new Promise(r => setTimeout(r, 1500));   // the frames are painted again every second
      const body = document.querySelector('.el[data-type="stream"].nosig .body');
      return { names, caption: body ? getComputedStyle(body, '::after').content : '' };
    });
    check(/^Камера · мод \d+$/.test(r.names[0]), 'another moderator: ' + r.names[0]);
    eq(r.names[1], 'Экран · стример', 'the streamer');
    check(/Камера · нет сигнала/.test(r.caption), 'caption: ' + r.caption);
    await p.context().close();
  });

  await step('corrupt giveaway storage does not throw', async () => {
    const p = await open();
    const r = await p.evaluate(async () => {
      const id = 'rafx';
      state.els = [{ id, type: 'raffle', phase: 'collect', winners: [], entry: 'any', kw: '!x', subs: false, subx2: false, auto: false, confirm: 0 }];
      lsSet(rafKey(id), [['a', null], ['b', {}], 5, ['c', { user: 'Carl' }]]);
      rafPool.clear();
      const size = rafEntries(id).size;
      let err = null; try { rafTick(); const el = state.els[0]; rafPick(el); } catch (e) { err = String(e); }
      return { size, err };
    });
    eq([r.size, r.err], [1, null], 'only the valid entry is kept, no throw');
    await p.context().close();
  });

  await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
