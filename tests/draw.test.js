// Drawing on stream (element draw): two panels at once, live strokes (topic ink), fading, "on button" mode, eraser, Ctrl+Z,
// photo brush and palette, library, and sanitizeEl against junk strokes.
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

  const stageBox = p => p.evaluate(() => { const r = stage.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  // a stroke through points given in parts of the screen (0..1)
  async function stroke(p, pts, { steps = 4, keep = false } = {}){
    const b = await stageBox(p), at = ([fx, fy]) => [b.x + fx * b.w, b.y + fy * b.h];
    await p.mouse.move(...at(pts[0])); await p.mouse.down();
    for(let i = 1; i < pts.length; i++) await p.mouse.move(...at(pts[i]), { steps });
    if(!keep) await p.mouse.up();
  }
  // alpha of the widget's drawing at a point (0..1 of the screen)
  const widPx = (fx, fy) => wid.evaluate(([fx, fy]) => {
    const c = document.querySelector('.draw canvas'); if(!c || !c.width) return -1;
    let best = 0; const x0 = Math.round(fx * c.width), y0 = Math.round(fy * c.height);
    const d = c.getContext('2d').getImageData(x0 - 15, y0 - 15, 31, 31).data;   // a smoothed line passes near its corner points
    for(let i = 3; i < d.length; i += 4) best = Math.max(best, d[i]);
    return best;
  }, [fx, fy]);
  const drawOf = p => p.evaluate(() => { const e = state.els.find(x => x.type === 'draw'); return e && { id: e.id, n: e.strokes.length, ids: e.strokes.map(k => k.id), del: e.del.length, held: e.strokes.filter(k => k.hold).length, hidden: e.hidden }; });
  const widDraw = () => wid.evaluate(() => { const n = [...nodes.values()].find(x => x.dataset.type === 'draw'); return n && { n: n._el.strokes.length, ids: n._el.strokes.map(k => k.id), held: n._el.strokes.filter(k => k.hold).length }; });
  const setP = (p, pr) => p.evaluate(pr => {
    const fire = (id, v, prop = 'value', ev = 'input') => { const i = document.getElementById(id); i[prop] = v; i.dispatchEvent(new Event(ev)); };
    if(pr.fade !== undefined){ fire('dFadeOn', !!pr.fade, 'checked', 'change'); if(pr.fade) fire('dFade', String(pr.fade)); }
    if(pr.color) fire('dColor', pr.color);
    if(pr.size) fire('dSize', String(pr.size));
  }, pr);

  await step('sanitizeEl cleans junk strokes', async () => {
    const r = await mod.evaluate(() => {
      const ok = { id: 'abcd1234', tool: 'pen', color: '#ff0000', size: 6, pts: [10, 20, 30, 40], t: 5 };
      const big = Array.from({ length: 5000 }, (_, i) => i % 1000);
      const el = sanitizeEl({ id: 'd', type: 'draw', x: 10, y: 90, rot: 30, del: ['gone1234', 'BAD ID', 5, '__proto__'], strokes: [
        ok, { ...ok }, { ...ok, id: 'gone1234' }, { ...ok, id: 'x' }, { ...ok, id: 'evil<b>' }, { ...ok, id: 'tooloo12', tool: 'laser' },
        { ...ok, id: 'nopts123', pts: 'nope' }, { ...ok, id: 'empty123', pts: [] }, { ...ok, id: 'nanpts12', pts: [NaN, 'x', {}, 1e9, -1e9, 500] },
        { ...ok, id: 'bigbig12', pts: big }, { ...ok, id: 'shape123', tool: 'rect', pts: [1, 2, 3, 4, 5, 6, 7, 8] },
        { ...ok, id: 'stamp123', tool: 'stamp' }, { ...ok, id: 'stamp456', tool: 'stamp', asset: 'https://evil.example/x.png' },
        { ...ok, id: 'stamp789', tool: 'tex', asset: 'asset:abcdef123456' }, { ...ok, id: 'colors12', color: 'red; background:url(x)', size: 1e6, fade: 999, hold: 'yes', by: 'x'.repeat(100) },
        null, 7, 'str', [1, 2],
      ] });
      const many = sanitizeEl({ id: 'm', type: 'draw', strokes: Array.from({ length: 900 }, (_, i) => ({ ...ok, id: 'k' + String(i).padStart(4, '0') })) });
      const heavy = sanitizeEl({ id: 'h', type: 'draw', strokes: Array.from({ length: 30 }, (_, i) => ({ ...ok, id: 'h' + String(i).padStart(4, '0'), pts: Array(4000).fill(5) })) });
      return { geo: [el.x, el.y, el.rot], ids: el.strokes.map(k => k.id), del: el.del, nan: el.strokes.find(k => k.id === 'nanpts12').pts, big: el.strokes.find(k => k.id === 'bigbig12').pts.length / 2,
        shape: el.strokes.find(k => k.id === 'shape123').pts, tex: el.strokes.find(k => k.id === 'stamp789').asset, junk: el.strokes.find(k => k.id === 'colors12'),
        many: [many.strokes.length, many.strokes[0].id, many.strokes.at(-1).id], heavy: heavy.strokes.reduce((a, k) => a + k.pts.length / 2, 0), notArr: sanitizeEl({ id: 'n', type: 'draw', strokes: { a: 1 }, del: 'x' }) };
    });
    eq(r.geo, [50, 50, 0], 'a drawing covers the whole screen');
    eq(r.ids, ['abcd1234', 'nanpts12', 'bigbig12', 'shape123', 'stamp789', 'colors12'], 'bad ids, tools, points, deleted and duplicate strokes are dropped');
    eq(r.del, ['gone1234'], 'del keeps only valid ids');
    eq(r.nan, [0, 0, 0, 1100, -100, 500], 'points are numbers within the screen margin');
    eq(r.big, 2000, 'at most 2000 points in a stroke');
    eq(r.shape, [1, 2, 7, 8], 'a shape keeps its start and end');
    eq(r.tex, 'asset:abcdef123456', 'photo brushes only use files from the Host');
    eq([r.junk.color, r.junk.size, r.junk.fade, r.junk.hold, r.junk.by.length], ['#ffffff', 80, 60, 1, 24], 'color, size, fade and author are clamped');
    eq(r.many, [400, 'k0500', 'k0899'], 'at most 400 strokes, the newest stay');
    check(r.heavy <= 40000, 'at most 40000 points in a drawing');
    eq([r.notArr.strokes, r.notArr.del], [[], []], 'non-array strokes and del become empty');
  });

  await step('merge and simplify', async () => {
    const r = await mod.evaluate(() => {
      const k = (id, t, extra) => ({ id, tool: 'pen', color: '#fff', size: 4, pts: [0, 0, 10, 10], t, ...extra });
      const now = Date.now();
      const a = { strokes: [k('aaaa', 1), k('bbbb', 2), k('held', 3, { hold: 1 }), k('old1', now - 60000, { fade: 5 })], del: ['cccc'] };
      const b = { strokes: [k('aaaa', 1), k('cccc', 4), k('dddd', 5), k('held', now)], del: ['eeee'] };
      const m = drawMerge(a, b, now), same = drawMerge(b, b, now);
      const line = []; for(let i = 0; i <= 100; i++) line.push(i * 5, 300 + (i % 2));
      return { ids: m.strokes.map(x => x.id), held: m.strokes.find(x => x.id === 'held').hold || 0, del: m.del, added: m.added, same: same.added, simp: drawSimplify(line, 1.5).length / 2 };
    });
    eq(r.ids, ['aaaa', 'bbbb', 'dddd', 'held'], 'strokes merge by id, deleted ones stay deleted, melted ones are not brought back');
    eq(r.held, 0, 'a stroke already shown wins over the same stroke still waiting');
    eq(r.del, ['eeee', 'cccc'], 'deletions of both sides are kept');
    check(r.added && !r.same, 'merge reports when the other side misses something');
    eq(r.simp, 2, 'a straight wobbly line simplifies to its ends');
    // del is full (1000) and the two panels keep different tails: they must not send each other the screen forever
    const rounds = await mod.evaluate(() => {
      const id = i => 'del' + String(i).padStart(5, '0');
      let A = { strokes: [], del: Array.from({ length: DRAW_MAX_DEL }, (_, i) => id(i + 1)) }, B = { strokes: [], del: Array.from({ length: DRAW_MAX_DEL }, (_, i) => id(i)) };
      let msg = A, toB = true, n = 0;
      while(msg && n < 20){ n++; const m = drawMerge(toB ? B : A, msg); const s = { strokes: m.strokes, del: m.del }; if(toB) B = s; else A = s; msg = m.added ? s : null; toB = !toB; }
      return n;
    });
    check(rounds <= 2, 'full del lists settle instead of ping-pong: ' + rounds + ' rounds');
    // junk live strokes for elements that do not exist must not block live drawing for good
    const inkOk = await wid.evaluate(() => {
      const part = (el, id) => ({ el, id, tool: 'pen', color: '#fff', size: 4, i: 0, pts: [1, 1, 2, 2] });
      for(let i = 0; i < 40; i++) DrawFx.ink(part('junk' + i, 'jjjj' + i));
      const full = !DrawFx.ink(part('real', 'rrrr'));
      for(const m of DrawFx.live.values()) for(const e of m.values()) e.at -= 10000;   // the junk got old
      const ok = DrawFx.ink(part('real', 'rrrr'));
      DrawFx.live.clear();
      return [full, ok];
    });
    eq(inkOk, [true, true], 'the live list is full of junk, and after it gets old a real stroke gets in');
  });

  let drawId;
  await step('the drawing tool: a pen stroke reaches the stream, live points come before the stroke ends', async () => {
    await mod.click('[data-tab=add]'); await mod.click('#addDraw');
    check(await mod.evaluate(() => !document.getElementById('drawBar').hidden && stage.classList.contains('drawing')), 'the tool strip shows above the canvas');
    drawId = (await drawOf(mod)).id;
    await setP(mod, { fade: 0, color: '#ff3b5c', size: 10 });
    await mod.click('[data-dt=pen]');
    await stroke(mod, [[0.1, 0.2], [0.2, 0.25], [0.3, 0.2], [0.4, 0.25]], { keep: true });
    check(await until(() => wid.evaluate(id => (DrawFx.live.get(id)?.size || 0) > 0, drawId), 4000), 'the stream gets the stroke while it is drawn (ink)');
    check(await until(async () => (await widPx(0.3, 0.2)) > 200, 4000), 'and paints it');
    await mod.mouse.up();
    check(await until(async () => (await widDraw())?.n === 1), 'the finished stroke is in the screen');
    const k = await mod.evaluate(() => state.els.find(x => x.type === 'draw').strokes[0]);
    check(k.pts.length / 2 < 40 && k.pts.length / 2 >= 2, 'points are simplified', k.pts.length / 2);
    eq([k.tool, k.color, k.size, k.fade, k.by.startsWith('mod_')], ['pen', '#ff3b5c', 10, undefined, true], 'tool, color, size and author are stored');
    check(await until(() => wid.evaluate(id => !DrawFx.live.get(id)?.size, drawId), 9000), 'the live copy goes away once the screen has the stroke');
    check((await widPx(0.3, 0.2)) > 200, 'the stroke stays on stream');
  });

  await step('two panels draw at the same moment: both strokes everywhere', async () => {
    await mod2.click('[data-tab=add]'); await mod2.click('#addDraw');
    eq((await drawOf(mod2)).id, drawId, 'the second panel joins the same drawing');
    await setP(mod2, { fade: 0, color: '#3fd0ff', size: 8 });
    await mod2.click('[data-dt=neon]');
    for(let round = 0; round < 3; round++){
      const y = 0.4 + round * 0.1;
      await Promise.all([stroke(mod, [[0.1, y], [0.3, y + 0.02], [0.45, y]], { steps: 3 }), stroke(mod2, [[0.55, y], [0.7, y + 0.02], [0.9, y]], { steps: 3 })]);
    }
    const ok = await until(async () => { const [a, b, w] = await Promise.all([drawOf(mod), drawOf(mod2), widDraw()]);
      return a.n === 7 && b.n === 7 && w?.n === 7 && JSON.stringify([...a.ids].sort()) === JSON.stringify([...b.ids].sort()) && JSON.stringify([...a.ids].sort()) === JSON.stringify([...w.ids].sort()); }, 10000);
    check(ok, 'seven strokes on both panels and on stream', [await drawOf(mod), await drawOf(mod2), await widDraw()]);
    check((await widPx(0.7, 0.42)) > 150 && (await widPx(0.3, 0.42)) > 150, 'both panels\' strokes are painted on stream');
  });

  await step('eraser and Ctrl+Z work across panels', async () => {
    await mod2.click('[data-dt=eraser]');
    await stroke(mod2, [[0.69, 0.42], [0.71, 0.42]]);
    check(await until(async () => (await drawOf(mod)).n === 6 && (await widDraw()).n === 6), 'the erased stroke leaves the other panel and the stream');
    check((await drawOf(mod)).del >= 1, 'the deletion is remembered in del');
    await mod.click('#dClear');
    check(await until(async () => (await drawOf(mod2)).n === 0 && (await widDraw()).n === 0), 'clear erases the drawing everywhere');
    await mod.keyboard.press('Control+z');
    check(await until(async () => (await drawOf(mod2)).n === 6 && (await widDraw()).n === 6, 8000), 'Ctrl+Z brings it back everywhere (the other panel does not erase it again)', [await drawOf(mod2), await widDraw()]);
    await sleep(1500);
    eq([(await drawOf(mod)).n, (await drawOf(mod2)).n, (await widDraw()).n], [6, 6, 6], 'and it stays');
    await mod.click('#dClear'); await mod2.click('[data-dt=pen]');
    await until(async () => (await widDraw()).n === 0);
  });

  await step('melting strokes disappear on stream by themselves', async () => {
    await setP(mod, { fade: 1 });
    await mod.click('[data-dt=marker]');
    await stroke(mod, [[0.2, 0.7], [0.5, 0.72]]);
    check(await until(async () => (await widPx(0.35, 0.71)) > 60, 3000), 'the stroke shows');
    const k = await mod.evaluate(() => state.els.find(x => x.type === 'draw').strokes.at(-1));
    eq(k.fade, 1, 'the stroke melts after 1 s');
    check(await until(async () => (await widPx(0.35, 0.71)) === 0, 4000), 'and is gone from the stream without the panel');
    await mod.evaluate(() => publishNow(1));
    check(await until(async () => (await drawOf(mod)).n === 0 && (await widDraw()).n === 0), 'the melted stroke leaves the screen on the next send');
  });

  await step('"on button" mode: the stream sees the drawing after Show', async () => {
    await setP(mod, { fade: 0 }); await mod.click('[data-dt=pen]'); await mod.click('#dHold');
    await stroke(mod, [[0.6, 0.15], [0.62, 0.3], [0.64, 0.15]], { keep: true });
    await sleep(500);
    check(await wid.evaluate(id => (DrawFx.live.get(id)?.size || 0) > 0, drawId), 'the live points reach the stream');
    eq(await widPx(0.62, 0.25), 0, 'but they are not painted');
    await mod.mouse.up();
    check(await until(async () => (await widDraw()).held === 1), 'the stroke is in the screen, waiting');
    await sleep(300);
    eq(await widPx(0.62, 0.25), 0, 'the stream does not show it');
    check(!(await mod.isHidden('#dShow')), 'the panel offers Show');
    check(await until(() => mod2.evaluate(() => { const c = document.querySelector('#elLayer .draw canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for(let i = 3; i < d.length; i += 4) if(d[i]) return true; return false; })), 'the other panel sees the waiting stroke');
    await mod.click('#dShow');
    check(await until(async () => (await widPx(0.62, 0.25)) > 200), 'after Show it is on stream');
    eq((await widDraw()).held, 0, 'nothing waits any more');
    await mod.click('#dLive');
  });

  await step('photo: palette, eyedropper and photo brushes', async () => {
    // a picture with four clear colors
    const png = await mod.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 120; c.height = 80; const x = c.getContext('2d');
      [['#e63946', 0, 0], ['#2a9d8f', 60, 0], ['#f4a261', 0, 40], ['#1d3557', 60, 40]].forEach(([f, a, b]) => { x.fillStyle = f; x.fillRect(a, b, 60, 40); });
      const b = await new Promise(r => c.toBlob(r, 'image/png')); return [...new Uint8Array(await b.arrayBuffer())];
    });
    await mod.click('#dPhoto');
    await mod.setInputFiles('#dFile', { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png) });
    check(await until(() => mod.isVisible('#dPhotoPop')), 'the photo card opens');
    const pal = await mod.$$eval('#dPhotoPal button', b => b.map(x => x.dataset.c));
    check(pal.length >= 4 && pal.length <= 8, 'a palette of the main colors', pal);
    check(['#e63946', '#2a9d8f', '#f4a261', '#1d3557'].every(c => pal.includes(c)), 'with the colors of the picture');
    const cv = await mod.$('#dPhotoCv'), bb = await cv.boundingBox();
    await mod.mouse.click(bb.x + bb.width * 0.7, bb.y + bb.height * 0.3);
    eq(await mod.evaluate(() => document.getElementById('dColor').value), '#2a9d8f', 'a click on the photo takes its color');
    await mod.click('[data-dt=stamp]');
    check(await until(() => mod.evaluate(() => !!Draw && document.querySelector('[data-dt=stamp]').classList.contains('on'))), 'stamp brush picked');
    await until(() => mod.evaluate(() => [...Assets.urls.keys()].length > 0), 8000);
    await sleep(300);
    await stroke(mod, [[0.1, 0.85], [0.45, 0.85]]);
    const k = await mod.evaluate(() => state.els.find(x => x.type === 'draw').strokes.at(-1));
    check(k.tool === 'stamp' && /^asset:/.test(k.asset), 'the stroke uses the uploaded photo', k);
    check(await mod.evaluate(a => assetsOf(state).has(a.slice(6)), k.asset), 'assetsOf sees the brush file (it is kept by "clean files")');
    check(await until(async () => (await widPx(0.3, 0.85)) > 200, 8000), 'the stamp is painted on stream (file from the Host)');
    await mod.click('[data-dt=tex]');
    await stroke(mod, [[0.55, 0.85], [0.9, 0.85]]);
    check(await until(async () => (await widPx(0.7, 0.85)) > 200, 8000), 'the texture brush is painted on stream');
  });

  await step('pipette from the canvas, library, leaving the tool', async () => {
    await mod.evaluate(() => { window.EyeDropper = undefined; });
    await mod.click('#dPick');
    // a point of the red stroke on the panel's canvas
    const at = await mod.evaluate(() => { const c = document.querySelector('#elLayer .draw canvas'), r = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for(let i = 0; i < d.length; i += 4) if(d[i + 3] === 255 && d[i] === 255 && d[i + 1] === 59 && d[i + 2] === 92){ const n = i / 4; return [r.left + (n % c.width + 0.5) * r.width / c.width, r.top + (Math.floor(n / c.width) + 0.5) * r.height / c.height]; } return null; });
    await mod.mouse.click(...at);
    eq(await mod.evaluate(() => document.getElementById('dColor').value), '#ff3b5c', 'the pipette takes the color of a stroke on the canvas');
    const n = (await drawOf(mod)).n;
    await mod.click('#dDone');
    check(await mod.isHidden('#drawBar'), 'Done hides the strip');
    await mod.evaluate(() => { window.prompt = () => 'Рисунок'; });
    await mod.click('#bLib');
    check(await until(() => mod.evaluate(() => library.some(it => it.el.type === 'draw'))), 'the drawing is saved to the library');
    await mod.evaluate(() => { const i = library.findIndex(it => it.el.type === 'draw'); document.querySelector(`#libList .lib[data-i="${i}"]`)?.click(); });
    check(await until(async () => (await mod.evaluate(() => state.els.filter(e => e.type === 'draw').length)) === 2), 'and added back from it');
    const copy = await mod.evaluate(() => state.els.filter(e => e.type === 'draw').at(-1));
    eq(copy.strokes.length, n, 'with all its strokes');
    check(copy.strokes.every(k => Date.now() - k.t < 10000), 'strokes start again (they melt anew)');
    await mod.keyboard.press('Escape');
    check(await mod.evaluate(() => !stage.classList.contains('drawing')), 'Esc leaves the drawing tool');
  });

  await step('the Host refuses ink from the OBS side', async () => {
    check(/PUB_MOD = new Set\(\[[^\]]*'ink'[^\]]*\]\), PUB_LOCAL = new Set\(\['hb', 'rtc'\]\)/.test(require('fs').readFileSync(require('path').join(__dirname, '../server/server.js'), 'utf8')), 'only moderators publish ink');
  });

  await mod2.context().close();
  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
