// Roulette (capsule machine and wheel) in the "Giveaways" tab: data checks, weighted winner, panel ↔ stream sync,
// one result on two panels, sounds, and the 3D case that moved into the same tab.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid, host } = S;
  const prizes = [{ n: 'Skin', w: 5, c: '#a970ff' }, { n: 'Song', w: 30, c: '#ffd166' }, { n: 'Hello', w: 65, c: '#3ddc97' }, { n: 'Never', w: 0, c: '#ff0000' }];

  await step('sanitizing: garbage in, safe roulette out', async () => {
    const r = await mod.evaluate(() => {
      const hostile = [null, undefined, 1e308, -1e308, 'x', '', [], {}, ['#ffffff'], { toString: 1 }, '__proto__', true, NaN];
      let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      let thrown = 0, bad = 0;
      for (let i = 0; i < 2000; i++) {
        const e = { id: 'r' + i, type: 'roulette' };
        for (const k of ['view', 'fs', 'color', 'accent', 'title', 'font', 'vol', 'hideAfter', 'spinAt', 'viewer', 'jit', 'from', 'win', 'once', 'odds', 'who', 'x', 'y'])
          if (rnd() < 0.5) e[k] = hostile[rnd() * hostile.length | 0];
        for (const k of ['prizes', 'segs', 'people', 'used'])
          if (rnd() < 0.6) e[k] = rnd() < 0.3 ? hostile[rnd() * hostile.length | 0] : Array.from({ length: rnd() * 80 | 0 }, () => rnd() < 0.2 ? hostile[rnd() * hostile.length | 0] : { n: hostile[rnd() * hostile.length | 0], w: hostile[rnd() * hostile.length | 0], c: hostile[rnd() * hostile.length | 0], note: hostile[rnd() * hostile.length | 0] });
        try {
          const o = sanitizeEl(e);
          if (!o) { bad++; continue; }
          if (!['capsule', 'wheel'].includes(o.view) || o.prizes.length > ROU_MAX || o.segs.length > ROU_MAX || o.people.length > ROU_PEOPLE || o.used.length > ROU_PEOPLE) bad++;
          if (o.prizes.some(p => typeof p.n !== 'string' || p.n.length > 40 || !(p.w >= 0 && p.w <= 1000) || !/^#[0-9a-f]{6}$/i.test(p.c))) bad++;
          if (o.people.some(p => !p.n || p.w < 1 || p.w > 100)) bad++;
          if (!/^#[0-9a-f]{6}$/i.test(o.accent) || !/^#[0-9a-f]{6}$/i.test(o.color) || o.fs < 1 || o.fs > 12 || o.vol < 0 || o.vol > 1 || o.hideAfter < 3 || o.hideAfter > 120) bad++;
          if (o.win < -1 || o.win >= Math.max(1, o.segs.length) || (o.win >= 0 && !o.segs[o.win])) bad++;
        } catch { thrown++; }
      }
      return { thrown, bad, noId: sanitizeEl({ type: 'roulette' }), def: (({ view, fs, once, odds, who, hideAfter, win, prizes, people }) => ({ view, fs, once, odds, who, hideAfter, win, p: prizes.length, pe: people.length }))(sanitizeEl({ id: 'q', type: 'roulette' })) };
    });
    eq([r.thrown, r.bad, r.noId], [0, 0, null], 'no exception, every field inside its limits, an element without id is dropped');
    eq(r.def, { view: 'capsule', fs: 4, once: true, odds: true, who: true, hideAfter: 10, win: -1, p: 0, pe: 0 }, 'defaults');
    const lim = await mod.evaluate(() => { const o = sanitizeEl({ id: 'q', type: 'roulette', prizes: Array.from({ length: 99 }, (_, i) => ({ n: 'p' + i, w: 9e9 })), people: Array.from({ length: 999 }, (_, i) => ({ n: 'n' + i, w: -5 })), win: 7, segs: [{ n: 'a', w: 1 }] }); return [o.prizes.length, o.prizes[0].w, o.people.length, o.people[0].w, o.win]; });
    eq(lim, [30, 1000, 200, 1, -1], 'at most 30 prizes (weight ≤ 1000) and 200 participants; a winner outside the snapshot is dropped');
  });

  await step('winner comes from the list and follows the weights', async () => {
    const r = await mod.evaluate(prizes => {
      const el = sanitizeEl({ id: 'q', type: 'roulette', prizes, people: [{ n: 'amy', w: 1 }, { n: 'bob', w: 3 }] });
      const c = {}; for (let i = 0; i < 20000; i++) { const k = el.prizes[roulettePrize(el, Math.random())].n; c[k] = (c[k] || 0) + 1; }
      const pc = {}; for (let i = 0; i < 8000; i++) { const k = el.people[roulettePerson(el, Math.random())].n; pc[k] = (pc[k] || 0) + 1; }
      return { c, pc, edges: [roulettePrize(el, 0), roulettePrize(el, 0.049), roulettePrize(el, 0.051), roulettePrize(el, 0.999999), roulettePrize(el, 1)],
        none: roulettePrize({ prizes: [{ n: 'a', w: 0 }] }, 0.5), noPeople: roulettePerson({ people: [] }, 0.5) };
    }, prizes);
    check(Math.abs(r.c.Skin / 200 - 5) < 1 && Math.abs(r.c.Song / 200 - 30) < 1.5 && Math.abs(r.c.Hello / 200 - 65) < 1.5, `shares match the weights (${['Skin', 'Song', 'Hello'].map(k => (r.c[k] / 200).toFixed(1)).join(' / ')})`);
    check(!('Never' in r.c), 'a prize with weight 0 never drops');
    check(Math.abs(r.pc.bob / 8000 - 0.75) < 0.03, 'participant weight x3 gives three times the chance');
    eq(r.edges, [0, 0, 1, 2, 2], 'boundaries of the weight ranges');
    eq([r.none, r.noPeople], [-1, -1], 'nothing to pick from gives -1');
  });

  await step('the roulette lives in the Giveaways tab: the case tile is gone, the case moved there', async () => {
    check(await mod.$('[data-add=case]') === null, 'the 3D case tile is not in the "Add" tab');
    await mod.click('[data-tab=raffle]');
    eq(await mod.$$eval('#rTools button', b => b.map(x => x.dataset.rtool)), ['raffle', 'case', 'roulette'], 'three tools in the tab');
    await mod.click('[data-rtool=case]');
    check(await mod.isVisible('#caseCreate'), 'case: create button');
    await mod.click('#caseCreate');
    check(await until(() => mod.isVisible('#kOpen')), 'case settings open in the tab');
    await mod.fill('#kDonor', 'etsuitoku'); await mod.click('#kOpen');
    check(await until(() => mod.evaluate(() => !!state.els.find(e => e.type === 'case').openAt)), 'the case opens from the tab');
    check(await until(() => mod.isVisible('#rLiveCase')), 'the tab button shows the case is running');
    check(await until(() => wid.evaluate(() => !!document.querySelector('.case')), 8000), 'case is drawn on stream');
    // a case saved by an older version still works
    const old = await mod.evaluate(() => { const o = sanitizeEl({ id: 'old1', type: 'case', name: 'OLD', items: [{ n: 'a', r: 2, p: 100 }], openAt: 0 }); return [o.type, o.name, o.items.length]; });
    eq(old, ['case', 'OLD', 1], 'an old saved case still loads');
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => e.type !== 'case'); selectedId = null; commit(); });
  });

  await step('roulette: create, prizes with weights, participants', async () => {
    await mod.click('[data-rtool=roulette]'); await mod.click('#rouCreate');
    const el = await mod.evaluate(() => state.els.find(e => e.type === 'roulette'));
    eq([el.view, el.prizes.length, el.prizes.reduce((a, p) => a + p.w, 0)], ['capsule', 5, 100], 'a new roulette: capsule machine with 5 prizes');
    await mod.evaluate(prizes => { beginChange(); const e = state.els.find(x => x.type === 'roulette'); e.prizes = sanitizeEl({ id: 'x', type: 'roulette', prizes }).prizes; commit(); }, prizes);
    await mod.fill('#iRouPeople', 'amy\nbob x3\namy\n  \ncarl*2'); await mod.press('#iRouPeople', 'Tab');
    eq(await mod.evaluate(() => state.els.find(e => e.type === 'roulette').people), [{ n: 'amy', w: 1 }, { n: 'bob', w: 3 }, { n: 'carl', w: 2 }], 'participants parsed: one per line, duplicates dropped, "x3" is the weight');
    eq(await mod.$$eval('#rouPrizes .pc', n => n.map(x => x.textContent)), ['5.0%', '30%', '65%', '—'], 'chance in percent next to every prize');
    check(await until(() => wid.evaluate(() => !!document.querySelector('.rou .rm-machine'))), 'the capsule machine is on the stream screen');
  });

  await step('spin: one result for the panel and the stream (capsule machine)', async () => {
    await mod.fill('#iRouWho', 'etsuitoku'); await mod.click('#rouSpin');
    const el = await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); return { win: e.win, viewer: e.viewer, spinAt: e.spinAt, segs: e.segs.map(s => s.n), people: e.people.map(p => p.n), used: e.used.map(p => p.n) }; });
    check(el.win >= 0 && el.win <= 2 && el.segs[el.win] !== 'Never', 'the winner is one of the prizes with weight');
    eq([el.viewer, el.people.includes('etsuitoku'), el.used], ['etsuitoku', false, []], 'the typed nickname is on the ticket');
    check(await until(async () => (await wid.evaluate(() => lastState.els.find(e => e.type === 'roulette').spinAt)) === el.spinAt), 'the stream got the same spin');
    eq(await wid.evaluate(() => { const e = lastState.els.find(x => x.type === 'roulette'); return [e.win, e.viewer, e.segs[e.win].n]; }), [el.win, 'etsuitoku', el.segs[el.win]], 'same winner and nickname on stream');
    check(await mod.isDisabled('#rouSpin'), 'the spin button is locked while it spins');
    const before = await mod.evaluate(() => state.els.find(e => e.type === 'roulette').spinAt);
    await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); beginChange(); rouSpin(e, 'other', false); });
    eq(await mod.evaluate(() => state.els.find(e => e.type === 'roulette').spinAt), before, 'a second spin during the first is refused');
    // frames of the capsule machine at the same moment on the panel and on stream
    const frame = async (page, ms) => { await page.evaluate(m => { window.__rouFreeze = m; }, ms); await sleep(450);
      return page.evaluate(() => { const c = document.querySelector('.rou'); const p = c.querySelector('.rm-paper'); return { ph: c.dataset.ph, screen: c.querySelector('[data-ref=screen]').textContent, paper: p.hidden ? '' : p.querySelector('.rm-paper__what').textContent, who: p.hidden ? '' : p.querySelector('.rm-paper__who').textContent, caps: !c.querySelector('.rm-capsule').hidden }; }); };
    const want = el.segs[el.win];
    for (const [ms, ph] of [[300, 'ticket'], [3000, 'shake'], [5700, 'drop'], [6300, 'burst'], [7100, 'reveal'], [9000, 'result']]) {
      const a = await frame(wid, ms), b = await frame(mod, ms);
      eq([a.ph, b.ph], [ph, ph], `frame ${ms} ms: phase ${ph} on both`);
      if (ph === 'result') { eq([a.paper, b.paper, a.caps], [want, want, true], 'the paper names the prize, the capsule is open'); check(/ETSUITOKU|etsuitoku/i.test(a.who), 'the paper names the viewer'); }
    }
    await wid.evaluate(() => { window.__rouFreeze = null; }); await mod.evaluate(() => { window.__rouFreeze = null; });
  });

  await step('stream texts follow the stream language', async () => {
    const t = await wid.evaluate(() => { const out = {}; for (const l of ['en', 'uk', 'de']) { STREAM_LANG = l; out[l] = [st('ВСТАВЬТЕ БИЛЕТ'), st('получает'), st('шанс')]; } STREAM_LANG = 'ru'; return out; });
    eq(t, { en: ['INSERT TICKET', 'gets', 'chance'], uk: ['ВСТАВТЕ КВИТОК', 'отримує', 'шанс'], de: ['TICKET EINWERFEN', 'bekommt', 'Chance'] }, 'en, uk, de');
  });

  await step('wheel: the pointer ends on the winning sector, same on the panel and the stream', async () => {
    await mod.click('[data-tab=raffle]'); await mod.click('[data-rtool=roulette]');
    await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); beginChange(); rouReset(e); e.view = 'wheel'; e.title = 'Wheel'; commit(); });
    check(await until(() => wid.evaluate(() => !!document.querySelector('.rou .rm-wheel canvas'))), 'the wheel is drawn on stream');
    await sleep(900);   // let the spin button unlock
    let ok = 0;
    for (let k = 0; k < 4; k++) {
      await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); beginChange(); e.spinAt = 0; if (rouSpin(e, 'viewer' + Date.now() % 1000, false)) commit(); });
      const r = await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); const t = rouTarget(e); const segs = rouSegs(e.segs); const th = (((-t.to) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); const hit = segs.findIndex(s => th >= s.start && th < s.start + s.span); return { win: e.win, hit: e.segs.indexOf(segs[hit].item), n: e.segs.length, from: e.from }; });
      if (r.hit === r.win) ok++;
    }
    eq(ok, 4, 'the end angle puts the winning sector under the pointer (4 of 4)');
    await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); window.__rouFreeze = rouDur(e) + 200; }); await wid.evaluate(() => { window.__rouFreeze = 7200; });
    await sleep(700);
    const seen = async page => page.evaluate(() => { const c = document.querySelector('.rou'); return { ph: c.dataset.ph, paper: c.querySelector('.rm-paper').hidden ? '' : c.querySelector('.rm-paper__what').textContent, badge: c.querySelector('.rm-badge').hidden ? '' : c.querySelector('.rm-badge').textContent }; });
    const a = await seen(wid), b = await seen(mod), win = await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); return e.segs[e.win].n; });
    eq([a.ph, b.ph, a.paper, b.paper], ['result', 'result', win, win], 'result: the plate shows the same prize');
    await wid.evaluate(() => { window.__rouFreeze = 2500; }); await sleep(500);
    eq((await seen(wid)).ph, 'spin', 'mid-spin frame is "spin"');
    await wid.evaluate(() => { window.__rouFreeze = null; }); await mod.evaluate(() => { window.__rouFreeze = null; });
  });

  await step('sounds are synthesized: both views render a WAV', async () => {
    const r = await mod.evaluate(async () => {
      const e = state.els.find(x => x.type === 'roulette'); const out = {};
      for (const v of ['capsule', 'wheel']) { const o = { ...e, view: v }; const blob = await Rou.renderWav(o); const head = new TextDecoder().decode(new Uint8Array(await blob.slice(0, 4).arrayBuffer())); const pcm = new Int16Array((await blob.arrayBuffer()).slice(44)); let peak = 0; for (let i = 0; i < pcm.length; i += 97) peak = Math.max(peak, Math.abs(pcm[i])); out[v] = [head, blob.size > 100000, peak > 500]; }
      return out;
    });
    eq(r, { capsule: ['RIFF', true, true], wheel: ['RIFF', true, true] }, 'WAV with audible sound for the capsule machine and the wheel');
    const events = await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); return [rouDur({ ...e, view: 'capsule' }), rouDur({ ...e, view: 'wheel' })]; });
    check(events[0] > 5000 && events[1] > 5000, 'spin lasts several seconds');
  });

  await step('two moderators spin at the same moment: one result everywhere', async () => {
    await mod.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); beginChange(); rouReset(e); e.view = 'capsule'; e.people = [{ n: 'p1', w: 1 }, { n: 'p2', w: 1 }, { n: 'p3', w: 1 }, { n: 'p4', w: 1 }]; e.used = []; commit(); });
    const inv = await mod.evaluate(() => inviteLink(curRoom()));
    const mod2 = await T.newPage('mod2');
    await mod2.goto(inv); await mod2.waitForFunction(() => typeof curRoom === 'function' && curRoom());
    await T.attach(mod2, host);
    check(await until(async () => (await mod2.getAttribute('#status', 'class')).includes('ok'), 12000), 'mod2 online');
    check(await until(() => mod2.evaluate(() => !!state.els.find(e => e.type === 'roulette'))), 'mod2 sees the roulette');
    await sleep(1200);
    const go = page => page.evaluate(() => { const e = state.els.find(x => x.type === 'roulette'); beginChange(); if (rouSpin(e, '', false)) commit(); });
    await Promise.all([go(mod), go(mod2)]);
    const snap = page => page.evaluate(() => { const e = (typeof lastState !== 'undefined' ? lastState : state).els.find(x => x.type === 'roulette'); return [e.spinAt, e.win, e.viewer, e.segs[e.win]?.n]; });
    check(await until(async () => { const [a, b, c] = [await snap(mod), await snap(mod2), await snap(wid)]; return JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c); }, 10000), 'panel 1, panel 2 and the stream show the same spin, winner and nickname');
    const [a] = [await snap(mod)];
    await sleep(1500);
    eq([await snap(mod), await snap(mod2), await snap(wid)], [a, a, a], 'and it stays that way');
    await mod2.context().close();
  });

  await step('reset hides the result; deleting removes the element', async () => {
    await sleep(8500);
    await mod.click('[data-tab=raffle]'); await mod.click('[data-rtool=roulette]');
    await mod.click('#rouReset');
    check(await until(() => wid.evaluate(() => lastState.els.find(e => e.type === 'roulette').spinAt === 0)), 'reset reaches the stream');
    check(await until(() => wid.evaluate(() => document.querySelector('.rou').querySelector('.rm-paper').hidden)), 'the result plate is gone');
    await mod.click('#rouDel');
    check(await until(() => mod.evaluate(() => !state.els.some(e => e.type === 'roulette'))), 'the roulette is removed');
    check(await until(() => wid.evaluate(() => !document.querySelector('.rou'))), 'and gone from the stream');
  });

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
