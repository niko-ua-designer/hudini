// Resizing by any edge or corner (the opposite side is the anchor), Shift / Ctrl / rotation / undo / group,
// and Alt-crop (stored on the element, cut with clip-path on stream).
'use strict';
const fs = require('fs'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const SHOTS = process.env.HUDINI_SHOTS || '';   // folder for screenshots (optional)

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid } = S;
  const IMG = `${S.web.url}/site/img/panel.png`;
  const shot = async (page, name) => { if(SHOTS){ fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  const OPP = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };
  const SIGN = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  const center = async sel => { const b = await mod.locator(`.el.sel ${sel}`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const dragH = async (dir, dx, dy, mods = []) => {
    const p = await center('.rz-' + dir);
    await mod.mouse.move(p.x, p.y);
    for(const m of mods) await mod.keyboard.down(m);
    await mod.mouse.down(); await mod.mouse.move(p.x + dx, p.y + dy, { steps: 8 }); await mod.mouse.up();
    for(const m of mods) await mod.keyboard.up(m);
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const geom = () => mod.evaluate(() => { const e = state.els[0]; return { x: e.x, y: e.y, w: e.w, hh: e.hh, fs: e.fs, bw: e.bw, bh: e.bh, rot: e.rot, crop: e.crop }; });
  const reset = async props => {
    await mod.evaluate(p => { beginChange(); Object.assign(state.els[0], { x: 30, y: 45, rot: 0, hh: 0, w: 20, ...p }); delete state.els[0].crop; commit(); selectedId = state.els[0].id; msel.clear(); renderAll(); }, props || {});
    await sleep(350);
  };
  const box = () => mod.evaluate(() => boxOf(state.els[0].id));
  const stageWH = () => mod.evaluate(() => { const r = stage.getBoundingClientRect(); return { w: r.width, h: r.height }; });

  await step('setup: an image on the stage', async () => {
    await mod.evaluate(src => { beginChange(); state.els = []; commit(); addEl({ type: 'image', src, x: 30, y: 45, w: 20, hidden: false }); }, IMG);
    check(await until(() => mod.evaluate(() => { const i = document.querySelector('.el img'); return i && i.naturalWidth > 0; })), 'image loaded');
    check(await mod.$$eval('.el.sel .h-rz', n => n.length) === 8, 'eight resize handles on a selected element');
    await reset();
    await shot(mod, 'handles.png');
  });

  await step('every handle: the opposite side or corner stays put, the dragged one follows the pointer', async () => {
    for(const dir of Object.keys(SIGN)){
      await reset();
      const [sx, sy] = SIGN[dir];
      const before = await center('.rz-' + OPP[dir]);
      await dragH(dir, sx * 60, sy * 40);
      const after = await center('.rz-' + OPP[dir]);
      check(near(before.x, after.x, 2) && near(before.y, after.y, 2), `${dir}: the ${OPP[dir]} handle stays at ${Math.round(before.x)},${Math.round(before.y)} (now ${Math.round(after.x)},${Math.round(after.y)})`);
      const g = await geom();
      check(g.w > 20 || sx === 0, `${dir}: width grows when it should`);
      check(sx !== 0 || near(g.w, 20, 0.01), `${dir}: an edge on the other axis leaves the width alone`);
    }
    await shot(mod, 'after-corner.png');
  });

  await step('the dragged edge follows the pointer', async () => {
    await reset();
    const b0 = await box(), sz = await stageWH();
    await dragH('e', 50, 0);
    const b1 = await box();
    check(near(b1.r - b0.r, 50 / sz.w * 100, 0.4), `east edge moved by ${(b1.r - b0.r).toFixed(2)}% (wanted ${(50 / sz.w * 100).toFixed(2)}%)`);
    check(near(b1.l, b0.l, 0.15) && near(b1.t, b0.t, 0.15) && near(b1.b, b0.b, 0.15), 'the other three sides did not move');
    check((await geom()).hh > 0, 'height got fixed (hh) because only the width changed');
  });

  await step('Shift keeps the proportions, a plain corner stretches', async () => {
    await reset();
    let b = await box(); const r0 = (b.r - b.l) / (b.b - b.t);
    await dragH('se', 90, 10, ['Shift']);
    b = await box();
    check(near((b.r - b.l) / (b.b - b.t), r0, 0.02), `Shift on a corner: aspect ${r0.toFixed(3)} → ${((b.r - b.l) / (b.b - b.t)).toFixed(3)}`);
    await reset();
    await dragH('se', 90, 10);
    b = await box();
    check(Math.abs((b.r - b.l) / (b.b - b.t) - r0) > 0.05, 'a plain corner stretches freely');
    await reset();
    await dragH('e', 70, 0, ['Shift']);
    b = await box();
    check(near((b.r - b.l) / (b.b - b.t), r0, 0.02), 'Shift on an edge keeps the proportions too');
  });

  await step('Ctrl resizes from the center (the old behaviour)', async () => {
    await reset();
    const b0 = await box(), cx0 = (b0.l + b0.r) / 2, cy0 = (b0.t + b0.b) / 2;
    await dragH('se', 60, 40, ['Control']);
    const b1 = await box();
    check(near((b1.l + b1.r) / 2, cx0, 0.2) && near((b1.t + b1.b) / 2, cy0, 0.2), 'the center stays');
    check(b1.r - b1.l > b0.r - b0.l + 1, 'and the element grew');
  });

  await step('rotated by 90°: the anchor is still the opposite handle', async () => {
    for(const dir of ['e', 'se', 'n']){
      await reset({ rot: 90, x: 40, y: 50 });
      const [sx, sy] = SIGN[dir];
      const before = await center('.rz-' + OPP[dir]);
      const hp = await center('.rz-' + dir), cc = await center('.rz-' + OPP[dir]);
      // pull outward along the line from the anchor through the dragged handle
      const vx = hp.x - cc.x, vy = hp.y - cc.y, len = Math.hypot(vx, vy) || 1;
      await dragH(dir, vx / len * 60, vy / len * 60);
      const after = await center('.rz-' + OPP[dir]);
      check(near(before.x, after.x, 2.5) && near(before.y, after.y, 2.5), `rot 90, ${dir}: ${OPP[dir]} handle stays (${Math.round(before.x)},${Math.round(before.y)} → ${Math.round(after.x)},${Math.round(after.y)})`);
      const g = await geom();
      check(sx !== 0 || sy !== 0, 'sanity'); void g;
    }
    const g = await geom();
    check(g.rot === 90, 'the rotation is unchanged');
    await shot(mod, 'rotated.png');
  });

  await step('one undo step per drag', async () => {
    await reset();
    const g0 = await geom(), n0 = await mod.evaluate(() => undoStack.length);
    await dragH('nw', -50, -30);
    const g1 = await geom();
    check(g1.w > g0.w && g1.x !== g0.x, 'the drag changed size and position');
    eq(await mod.evaluate(() => undoStack.length), n0 + 1, 'exactly one undo step was added');
    await mod.evaluate(() => undo());
    eq(await geom(), g0, 'one undo brings the element back');
  });

  await step('text: a corner scales the font from the opposite corner, an edge sets a frame', async () => {
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    await mod.fill('#newText', 'Hello Hudini'); await mod.click('#addText');
    await sleep(1500);
    await reset({ fs: 5 });
    let b = await box(); const before = await center('.rz-nw');
    await dragH('se', 70, 30);
    let g = await geom();
    check(g.fs > 5.5, `font grew: ${g.fs.toFixed(2)}`);
    const after = await center('.rz-nw');
    check(near(before.x, after.x, 3) && near(before.y, after.y, 3), 'the top-left corner stayed (fs scaling is anchored)');
    await reset({ fs: 5, bw: 0, bh: 0 });
    b = await box();
    await dragH('e', 100, 0);
    const b1 = await box(); g = await geom();
    check(g.bw > 0 && g.fs === 5, `east edge sets the frame width (bw ${g.bw.toFixed(1)}), the font stays`);
    check(near(b1.l, b.l, 0.2), 'the left edge stayed');
    await dragH('s', 0, 50);
    g = await geom();
    check(g.bh > 0, 'south edge sets the frame height');
    await dragH('w', -40, 0, ['Shift']);
    g = await geom();
    check(g.fs !== 5, 'Shift on an edge scales the whole element');
  });

  await step('a group is scaled together from the opposite corner', async () => {
    await mod.evaluate(src => { beginChange(); state.els = []; commit(); addEl({ type: 'image', src, x: 25, y: 30, w: 15, hidden: false }); addEl({ type: 'image', src, x: 55, y: 55, w: 10, hidden: false }); }, IMG);
    await sleep(800);
    await mod.evaluate(() => { selectedId = state.els[0].id; msel.clear(); state.els.forEach(e => msel.add(e.id)); renderAll(); });
    check(await mod.isVisible('#grpBox .rz-se'), 'a group box with handles appears for a multi-selection');
    const ids = await mod.evaluate(() => state.els.map(e => e.id));
    const bb = () => mod.evaluate(ids => selBounds(ids), ids);
    const b0 = await bb(), w0 = await mod.evaluate(() => state.els.map(e => e.w)), n0 = await mod.evaluate(() => undoStack.length);
    const hb = await mod.locator('#grpBox .rz-se').boundingBox();
    await mod.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await mod.mouse.down();
    await mod.mouse.move(hb.x + hb.width / 2 + 80, hb.y + hb.height / 2 + 45, { steps: 8 }); await mod.mouse.up();
    const b1 = await bb(), w1 = await mod.evaluate(() => state.els.map(e => e.w));
    check(near(b1.l, b0.l, 0.3) && near(b1.t, b0.t, 0.3), 'the top-left corner of the group stays');
    check(b1.r > b0.r + 1, 'the group grew');
    check(near(w1[0] / w0[0], w1[1] / w0[1], 0.02) && w1[0] > w0[0], `both members scaled by the same factor ${(w1[0] / w0[0]).toFixed(2)}`);
    eq(await mod.evaluate(() => undoStack.length), n0 + 1, 'one undo step for the whole group drag');
    await shot(mod, 'group.png');
    await mod.evaluate(() => undo());
    eq(await mod.evaluate(() => state.els.map(e => e.w)), w0, 'undo restores the sizes');
  });

  await step('Alt + drag an edge crops; the widget cuts with clip-path', async () => {
    await mod.evaluate(src => { beginChange(); state.els = []; commit(); addEl({ type: 'image', src, x: 40, y: 45, w: 30, hidden: false }); }, IMG);
    await sleep(800); await reset({ x: 40, w: 30 });
    const id = await mod.evaluate(() => state.els[0].id), n0 = await mod.evaluate(() => undoStack.length), g0 = await geom();
    const b0 = await box(), sz = await stageWH();
    await dragH('e', -100, 0, ['Alt']);
    let g = await geom();
    const want = 100 / sz.w * 100 / (b0.r - b0.l) * 100;
    check(g.crop && near(g.crop[2], want, 1.5), `right crop ${g.crop && g.crop[2].toFixed(1)}% (wanted ~${want.toFixed(1)}%)`);
    check(g.crop[0] === 0 && g.crop[1] === 0 && g.crop[3] === 0, 'other sides are not cropped');
    check(near(g.w, g0.w, 0.001) && near(g.x, g0.x, 0.001), 'the element itself did not resize or move');
    eq(await mod.evaluate(() => undoStack.length), n0 + 1, 'one undo step for the crop');
    const clip = await until(() => wid.$eval(`.el[data-id="${id}"] .content`, c => c.style.clipPath).catch(() => ''));
    check(/inset\(0(px|%)? [\d.]+% 0(px|%)? 0(px|%)?\)/.test(clip), 'the stream cuts the picture with inset(): ' + clip);
    const vis = await mod.evaluate(() => { const n = document.querySelector('.el .content'); return n.style.clipPath; });
    check(vis === clip, 'panel and widget cut the same way');
    check(await mod.evaluate(() => getComputedStyle(document.querySelector('.el.sel .rz-e')).left) !== '0px', 'handles follow the cropped box');
    await dragH('nw', 30, 20, ['Alt']);
    g = await geom();
    check(g.crop[0] > 0 && g.crop[1] > 0, 'a corner crops two sides at once: ' + g.crop.map(v => v.toFixed(1)));
    await shot(mod, 'crop-panel.png'); await shot(wid, 'crop-widget.png');
    await dragH('w', 900, 0, ['Alt']);
    g = await geom();
    check(g.crop[0] + g.crop[2] <= 90.01 && g.crop[0] >= 0, `crop on one axis never eats more than 90% (${g.crop[0].toFixed(1)} + ${g.crop[2].toFixed(1)})`);
    // resizing the cropped box anchors on the visible edge
    await reset({ x: 40, w: 30 });
    await mod.evaluate(() => { state.els[0].crop = [10, 10, 20, 20]; changed(); });
    await sleep(300);
    const before = await center('.rz-nw');
    await dragH('se', 50, 30);
    const after = await center('.rz-nw');
    check(near(before.x, after.x, 2.5) && near(before.y, after.y, 2.5), 'resizing a cropped element keeps the visible opposite corner');
    // reset: Alt + double-click an edge, and the inspector button
    await mod.evaluate(() => { state.els[0].crop = [10, 10, 20, 20]; changed(); });
    await sleep(300);
    const p = await center('.rz-e');
    await mod.keyboard.down('Alt');
    await mod.mouse.click(p.x, p.y); await mod.mouse.click(p.x, p.y);
    await mod.keyboard.up('Alt');
    g = await geom();
    check(g.crop && g.crop[2] === 0 && g.crop[0] === 10, 'Alt + double-click on an edge clears that side: ' + JSON.stringify(g.crop));
    check(await mod.isVisible('#bCrop') && !(await mod.isDisabled('#bCrop')), 'the inspector has "Reset crop"');
    await mod.click('#bCrop');
    eq((await geom()).crop, undefined, 'the button removes the crop');
    check(await until(() => wid.$eval(`.el[data-id="${id}"] .content`, c => c.style.clipPath === '').catch(() => false)), 'the stream shows the whole picture again');
  });

  await step('crop on text, none on CS2; junk is cleaned; old screens are unchanged', async () => {
    const r = await mod.evaluate(() => {
      const mk = (type, extra) => sanitizeEl({ id: 'a' + type, type, x: 10, y: 10, src: 'https://example.com/a.png', url: 'https://example.com/', text: 'x', ...extra });
      return {
        text: mk('text', { crop: [5, 0, 10, 0] }).crop,
        cs2: 'crop' in mk('cs2', { crop: [5, 0, 10, 0] }),
        raffle: 'crop' in mk('raffle', { crop: [5, 0, 10, 0] }),
        big: mk('image', { crop: [95, 0, 95, 200] }).crop,
        neg: mk('image', { crop: [-5, -1, 3, 'x'] }).crop,
        junk: ['abc', 5, null, [1, 2, 3], {}, [0, 0, 0, 0], [0.001, 0, 0, 0], ['a', 'b', 'c', 'd']].map(c => 'crop' in mk('image', { crop: c })),
        none: 'crop' in mk('image', {}),
        nan: mk('video', { src: 'https://example.com/a.mp4', crop: [NaN, Infinity, 1, 1] }).crop,
      };
    });
    eq(r.text, [5, 0, 10, 0], 'text keeps its crop');
    eq([r.cs2, r.raffle], [false, false], 'CS2 and giveaway have no crop');
    check(r.big[0] + r.big[2] <= 90 && r.big[3] <= 90 && r.big[1] === 0, 'oversize crop is squeezed to 90% per axis: ' + JSON.stringify(r.big));
    check(r.big[0] > 0 && r.big[2] > 0, 'both sides stay proportional');
    eq(r.neg, [0, 0, 3, 0], 'negative and non-numeric values become 0');
    eq(r.junk, [false, false, false, false, false, false, false, false], 'junk and all-zero crop are removed');
    eq(r.none, false, 'an element without crop gets none (old screens stay the same)');
    eq(r.nan, [0, 0, 1, 1], 'NaN and Infinity become 0');
    // an old screen goes through sanitizeState and comes out identical
    const same = await mod.evaluate(() => {
      const old = { v: 1, visible: true, els: [{ id: 'o1', type: 'text', text: 'hi', x: 20, y: 30, fs: 6, rot: 0, op: 1, anim: 'none' }, { id: 'o2', type: 'image', src: 'https://example.com/i.png', x: 50, y: 50, w: 22, rot: 5, op: 1, anim: 'none' }] };
      const a = sanitizeState(old), b = sanitizeState(JSON.parse(JSON.stringify(a)));
      return JSON.stringify(a) === JSON.stringify(b) && a.els.every(e => !('crop' in e));
    });
    check(same, 'a screen without crop is untouched by sanitizing');
    // a crop sent through the room reaches the widget and is cleaned there
    await mod.evaluate(src => { beginChange(); state.els = []; commit(); addEl({ type: 'text', text: 'CUT ME', x: 50, y: 50, fs: 9, hidden: false }); }, IMG);
    await mod.evaluate(() => { state.els[0].crop = [0, 0, 50, 0]; changed(); });
    const id = await mod.evaluate(() => state.els[0].id);
    check(await until(() => wid.$eval(`.el[data-id="${id}"] .content`, c => /inset/.test(c.style.clipPath)).catch(() => false)), 'a cropped text is cut on stream');
    await shot(wid, 'crop-text-widget.png');
  });

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
