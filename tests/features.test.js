// Features on top of the core flow: chat feed and messages, polls, scenarios, CS2 (player, events, observer),
// editor tools, scenes, password vault and backup.
'use strict';
const fs = require('fs'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ irc: true, hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid, host } = S;
  const cfg = () => JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8'));
  const gsi = body => fetch(`http://127.0.0.1:${host.port}/gsi`, { method: 'POST', headers: { host: `127.0.0.1:${host.port}` }, body: JSON.stringify({ ...body, auth: { token: cfg().gsiToken } }) });
  const irc = (user, text, badges = '') => mod.evaluate(([u, t, x]) => window.__irc(`@badge-info=;badges=${x};color=#1E90FF;display-name=${u};emotes=25:0-4;id=${Math.random()};mod=0;subscriber=0 :${u.toLowerCase()}!${u.toLowerCase()}@x.tmi.twitch.tv PRIVMSG #chan :${t}`), [user, text, badges]);

  await step('chat feed and showing a message on stream', async () => {
    await mod.click('[data-tab=chat]'); await mod.fill('#chatChan', 'chan'); await mod.click('#chatBtn'); await sleep(200);
    await irc('Kappa_Fan', 'Kappa привет стрим!'); await irc('Vasya', 'лол', 'moderator/1');
    eq(await mod.$$eval('.cm', n => n.length), 2, 'two messages in the feed');
    check(await mod.$$eval('.cm img', n => n.length) >= 1, 'emote rendered as image');
    await mod.click('.cm');
    check(await until(async () => (await wid.$$eval('.msg', n => n.map(x => x.textContent))).some(t => t.includes('привет стрим'))), 'message shown on stream');
    check(await mod.evaluate(() => !document.querySelector('.cm script, .cm [onerror]')), 'chat text is not injected as HTML');
    await irc('Evil', '<img src=x onerror=alert(1)>');
    check(await mod.evaluate(() => !document.querySelector('#chatFeed img[src="x"]')), 'HTML in chat stays text');
  });

  await step('every room has its own chat; the old single channel moves to the first room', async () => {
    const p = await T.newPage('rooms', { irc: true, app: false });
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('store:overlay.chat', JSON.stringify('oldchan')); } } catch {} });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const st = () => p.evaluate(() => ({ room: room, chat: curRoom().chat, other: rooms.filter(r => r.code !== room).map(r => r.chat), ws: !!chatWs, field: document.getElementById('chatChan').value, feed: document.querySelectorAll('.cm').length }));
    const first = await st();
    eq([first.chat, first.ws, first.field], ['oldchan', true, 'oldchan'], 'the old channel went to the current room and connected');
    eq(await p.evaluate(() => JSON.parse(localStorage.getItem('store:overlay.chat') || '""')), '', 'the old single key is cleared');
    await p.evaluate(() => window.__irc('@badge-info=;badges=;color=#1E90FF;display-name=Anna;emotes=;id=1;mod=0;subscriber=0 :anna!anna@x.tmi.twitch.tv PRIVMSG #chan :hello'));
    eq((await st()).feed, 1, 'a message in the feed of the first room');
    const code1 = first.room;
    await p.evaluate(async () => { const r = await makeRoom('Second'); rooms.push(r); await switchRoom(r.code); saveRooms(); renderRooms(); });
    const second = await st();
    eq([second.chat, second.ws, second.field, second.feed], [undefined, false, '', 0], 'a new room starts without a chat and with an empty feed');
    eq(second.other, ['oldchan'], 'the first room keeps its channel');
    await p.evaluate(() => chatConnect('second_chan'));
    eq((await st()).chat, 'second_chan', 'the second room has its own channel');
    await p.evaluate(code => switchRoom(code), code1);
    const back = await st();
    eq([back.chat, back.ws, back.field, back.feed], ['oldchan', true, 'oldchan', 0], 'back in the first room its chat reconnects, the feed starts clean');
    await p.evaluate(() => document.getElementById('chatBtn').click());
    eq([(await st()).chat, (await st()).ws], [undefined, false], 'Disconnect clears the channel of this room only');
    eq((await st()).other, ['second_chan'], 'the other room is untouched');
    await p.context().close();
  });

  await step('DVD screensaver bounces off the edges of the element, not its centre', async () => {
    await mod.click('[data-tab=add]');
    for (const [txt, fs] of [['WIDE LOGO TEXT', 9], ['i', 3]]) {
      await mod.fill('#newText', txt); await mod.click('#addText');
      const id = await mod.evaluate(f => { const e = state.els.at(-1); beginChange(); e.fs = f; e.x = 50; e.y = 50; commit(); selectedId = e.id; msel.clear(); renderAll(); return e.id; }, fs);
      await sleep(300);
      const R = await mod.evaluate(i => {
        const box = boxOf(i), hw = (box.r - box.l) / 2, hh = (box.b - box.t) / 2;
        const kf = kfPreset('dvd', state.els.find(e => e.id === i), box), xs = kf.f.map(f => f.x), ys = kf.f.map(f => f.y);
        const eps = 0.05;
        return { hw, hh, n: kf.f.length, inside: kf.f.every(f => f.x >= hw - eps && f.x <= 100 - hw + eps && f.y >= hh - eps && f.y <= 100 - hh + eps),
          wall: kf.f.slice(1).every(f => f.x <= hw + eps || f.x >= 100 - hw - eps || f.y <= hh + eps || f.y >= 100 - hh - eps ),
          reachX: [Math.min(...xs), Math.max(...xs)], reachY: [Math.min(...ys), Math.max(...ys)], d: kf.f.every(f => f.d >= 1), mode: kf.mode };
      }, id);
      check(R.hw > 0.05 && R.n >= 6 && R.mode === 'loop', `${txt}: a loop of ${R.n} keyframes, half-width ${R.hw.toFixed(1)}%`);
      check(R.inside, `${txt}: the whole frame of the element stays on the screen`);
      check(R.wall, `${txt}: every turn after the start happens at a wall`);
      check(Math.abs(R.reachX[0] - R.hw) < 0.05 && Math.abs(R.reachX[1] - (100 - R.hw)) < 0.05, `${txt}: the element touches both side walls (${R.reachX.map(v => v.toFixed(1))})`);
      check(Math.abs(R.reachY[0] - R.hh) < 0.05 && Math.abs(R.reachY[1] - (100 - R.hh)) < 0.05, `${txt}: and the top and bottom (${R.reachY.map(v => v.toFixed(1))})`);
      check(R.d, `${txt}: every step lasts at least a millisecond`);
    }
    await mod.evaluate(() => { beginChange(); state.els = []; selectedId = null; commit(); });
  });

  await step('poll counts chat votes once per viewer', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=poll]'); await mod.click('#pToggle');
    await mod.evaluate(() => { onChat('a', '1'); onChat('b', '!2'); onChat('c', '2'); onChat('c', '1'); onChat('d', 'hello 2'); });
    eq(await mod.evaluate(() => state.els.find(e => e.type === 'poll').votes), [2, 1, 0], 'one vote per viewer, last choice counts (c switched 2→1), "hello 2" is not a vote');
    check(await until(async () => (await wid.$$eval('.poll', n => n.length)) === 1), 'poll on stream');
  });

  await step('counter: one button, chat mode counts words, "moderators only" skips viewers', async () => {
    await mod.click('[data-tab=add]');
    eq(await mod.$$eval('[data-add=chatcounter]', n => n.length), 0, 'no separate chat-counter button');
    await mod.click('[data-add=counter]');
    const id = await mod.evaluate(() => { const e = state.els.filter(x => x.type === 'counter').pop(); return e.id; });
    await mod.evaluate(i => { const e = state.els.find(x => x.id === i); Object.assign(e, { cmode: 'chat', kw: 'F', running: true, value: 0 }); }, id);
    await irc('Anna', 'F'); await irc('Boris', 'f lol'); await irc('Chris', 'nope');
    eq(await mod.evaluate(i => state.els.find(x => x.id === i).value, id), 2, 'chat mode: two matching messages counted');
    await mod.evaluate(i => { state.els.find(x => x.id === i).modsOnly = true; }, id);
    await irc('Anna', 'F'); await irc('Vasya', 'F', 'moderator/1'); await irc('Streamer', 'F', 'broadcaster/1');
    eq(await mod.evaluate(i => state.els.find(x => x.id === i).value, id), 4, 'moderators only: viewer skipped, moderator and broadcaster counted');
    eq(await mod.evaluate(i => sanitizeState({ els: [{ ...state.els.find(x => x.id === i) }] }).els[0].modsOnly, id), true, 'modsOnly survives sanitize');
  });

  await step('giveaway: entries from chat, sub-only and x2, case reel lands on the winner, confirm and reroll', async () => {
    await mod.click('[data-tab=raffle]'); await mod.click('#rafCreate');
    check(await mod.evaluate(() => !state.els.some(e => e.type === 'raffle') && !!state.raffle), 'the giveaway lives in state.raffle, not in the layer list');
    await mod.fill('#iRPrize', 'AK-47 | Redline'); await mod.dispatchEvent('#iRPrize', 'change');
    await mod.fill('#rSecs', '60'); await mod.click('#rStart');
    await irc('Alice', '!участвую'); await irc('Bob', 'привет'); await irc('Carl', '!участвую', 'subscriber/12'); await irc('Alice', '!участвую');
    let r = await mod.evaluate(() => state.raffle);
    eq([r.phase, r.n], ['collect', 2], 'two entrants: keyword only, one entry per viewer');
    check(await until(async () => (await wid.textContent('.raf')).includes('!участвую')), 'stream shows how to join');
    await mod.click('label.tgl:has(#iRSubs)'); await irc('Dan', '!участвую'); await irc('Eve', '!участвую', 'subscriber/3');
    eq(await mod.evaluate(() => [...rafEntries(state.raffle.id).keys()]), ['alice', 'carl', 'eve'], 'subscribers-only blocks Dan');
    const wins = await mod.evaluate(() => { const el = state.raffle; const c = {}; for (let i = 0; i < 3000; i++) { const w = rafPick(el).win[0]; c[w] = (c[w] || 0) + 1; } return c; });
    check(wins.carl > wins.alice * 1.6 && wins.eve > wins.alice * 1.6, `subs win about twice as often (${JSON.stringify(wins)})`);
    await mod.fill('#iRConfirm', '3'); await mod.dispatchEvent('#iRConfirm', 'change');
    await mod.click('#rSpin');
    r = await mod.evaluate(() => state.raffle);
    eq([r.phase, r.reel.length, r.reel[62][0]], ['spin', 72, r.winner], 'reel is built with the winner in the winning slot');
    check(await until(() => wid.evaluate(() => !!document.querySelector('.raf.reveal')), 12000), 'stream reveals the winner after the case and the reel');
    const pos = await wid.evaluate(() => { const m = document.querySelector('.rf-mark').getBoundingClientRect(), c = document.querySelector('.rf-card.win').getBoundingClientRect(); return [m.left, c.left, c.right]; });
    check(pos[0] > pos[1] && pos[0] < pos[2], 'the marker stops on the winning card');
    check((await wid.textContent('.rf-res')).includes(r.winner), 'winner name shown');
    const first = r.winner;
    await irc(first, 'я тут'); await sleep(150);
    check(await mod.evaluate(() => state.raffle.ok), 'winner confirmed by writing in chat');
    await mod.click('#rSpin'); r = await mod.evaluate(() => state.raffle);
    check(r.winner !== first && r.winners.includes(first), 'next winner: previous one drops out');
    const second = r.winner;
    check(await until(async () => (await mod.evaluate(() => state.raffle.winner)) !== second, 16000), 'no reply in time → spins again without them');
    await mod.click('#rDelete');
    check(await mod.evaluate(() => state.raffle === null), 'the delete button removes the giveaway (after a confirmation: it has entrants)');
  });

  await step('giveaway tab: position and size sliders, hide, old screens migrate, scenes never carry it', async () => {
    await mod.click('[data-tab=raffle]');
    check(await mod.isVisible('#rafCreate'), 'empty tab offers to create a giveaway');
    await mod.click('#rafCreate');
    const set = (id, v) => mod.$eval(id, (i, v) => { i.value = v; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); }, v);
    await set('#iRX', '30'); await set('#iRY', '70'); await set('#iRSize', '4.5');
    eq(await mod.evaluate(() => [state.raffle.x, state.raffle.y, state.raffle.fs]), [30, 70, 4.5], 'X, Y and size set the giveaway');
    check(await mod.evaluate(() => nodes.has(state.raffle.id)), 'drawn on the panel canvas');
    check(await mod.evaluate(() => !document.querySelector('#layers').textContent.includes('Розыгрыш')), 'not listed among the layers');
    await mod.click('#rStart');
    check(await until(async () => (await wid.$$eval('.raf', n => n.length)) === 1), 'giveaway drawn on stream');
    check(await until(async () => (await wid.evaluate(id => parseFloat(document.querySelector(`.el[data-id="${id}"]`).style.left), await mod.evaluate(() => state.raffle.id))) === 30), 'stream uses the position from the tab');
    await mod.click('label.tgl:has(#iRShow)');
    check(await until(async () => (await wid.evaluate(() => getComputedStyle(document.querySelector('.raf').closest('.el')).opacity)) === '0'), '"show" off hides the wheel on stream');
    await mod.click('label.tgl:has(#iRShow)');
    // an old screen kept the giveaway as a layer: the first one moves to state.raffle
    const mig = await mod.evaluate(() => { const s = sanitizeState({ els: [{ id: 'a1', type: 'text', text: 'x', x: 10, y: 10 }, { id: 'old1', type: 'raffle', x: 20, y: 25, title: 'Old', phase: 'collect', n: 3 }, { id: 'old2', type: 'raffle', x: 5, y: 5 }] }); return { els: s.els.map(e => e.id), raffle: s.raffle && [s.raffle.id, s.raffle.title, s.raffle.phase, s.raffle.n] }; });
    eq(mig, { els: ['a1'], raffle: ['old1', 'Old', 'collect', 3] }, 'old screen: the first giveaway layer becomes state.raffle');
    eq(await mod.evaluate(() => sanitizeState({ els: [] }).raffle), null, 'no giveaway by default');
    await mod.evaluate(() => { beginChange(); rafReset(state.raffle); state.raffle = null; commit(); });
    check(await until(async () => (await wid.$$eval('.raf', n => n.length)) === 0), 'deleted giveaway disappears from stream');
    await mod.click('[data-tab=add]');
  });

  await step('case: items with chances, 3D opening, honest reel, reveal by rarity', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=case]');
    const el0 = await mod.evaluate(() => state.els.at(-1));
    eq([el0.type, el0.items.length, el0.items.reduce((a, it) => a + it.p, 0)], ['case', 5, 100], 'case with 5 default items, chances add up to 100%');
    await mod.evaluate(() => { const el = state.els.at(-1); el.hideAfter = 60; el.items[0].p = 30; changed(); renderInspector(); });
    check(!(await mod.isHidden('#kFix')), '«To 100%» offered when chances do not add up');
    await mod.click('#kFix'); eq(Math.round(await mod.evaluate(() => state.els.at(-1).items.reduce((a, it) => a + it.p, 0))), 100, 'chances scaled back to 100%');
    const odds = await mod.evaluate(() => { const el = state.els.at(-1); const c = [0, 0, 0, 0, 0]; for (let i = 0; i < 20000; i++) c[casePick(el)]++; return c.map(x => x / 200); });
    check(Math.abs(odds[0] - 37.5) < 2 && Math.abs(odds[4] - 2.5) < 0.8, `weighted drop matches the chances (${odds.map(x => x.toFixed(1)).join(' / ')})`);
    await mod.click('#kOpen'); check(await mod.evaluate(() => !state.els.at(-1).openAt), 'opening needs a donor nickname');
    await mod.fill('#kDonor', 'etsuitoku'); await mod.fill('#kAmount', '500 ₽'); await mod.click('#kOpen');
    const el = await mod.evaluate(() => state.els.at(-1));
    eq([el.reel.length, el.reel[52]], [60, el.win], 'reel built with the dropped item in the winning slot');
    eq([el.kind, el.reel2.length, el.bmode], ['normal', 0, 'under'], 'a new case is a normal one: no second reel');
    check(await until(() => wid.evaluate(() => !!document.querySelector('.case .cs-3d canvas')), 8000), '3D scene runs on stream (WebGL)');
    check((await wid.textContent('.cs-top')).includes('etsuitoku'), 'donor shown');
    await wid.evaluate(() => { window.__caseFreeze = 12950; }); await sleep(600);
    const pos = await wid.evaluate(() => { const m = document.querySelector('.cs-mark').getBoundingClientRect(), c = document.querySelectorAll('.cs-card')[52].getBoundingClientRect(); return [m.left, c.left, c.right]; });
    check(pos[0] > pos[1] && pos[0] < pos[2], 'reel stops on the dropped item');
    await wid.evaluate(() => { window.__caseFreeze = 14500; }); await sleep(500);
    eq(await wid.evaluate(() => document.querySelector('.case').dataset.ph), 'reveal', 'reveal phase');
    check((await wid.textContent('.cs-bname')) === el.items[el.win].n, 'dropped item named on stream');
    eq(await mod.evaluate(() => lsGet('hudini.caseHist', [])[0]?.d), 'etsuitoku', 'opening saved to history');
    await wid.evaluate(() => { window.__caseFreeze = null; });
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => e.type !== 'case'); selectedId = null; commit(); });
  });

  await step('case kinds: normal, bait (both ways), random hides its kind, second chance; panel and stream agree', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=case]');
    const id = await mod.evaluate(() => state.els.at(-1).id);
    await mod.evaluate(i => { selectedId = i; msel.clear(); renderAll(); }, id);
    eq(await mod.$$eval('#kKinds input', n => n.map(x => x.value)), ['normal', 'bait', 'random', 'second'], 'four kinds in the list');
    check(await mod.isHidden('#kSp'), 'no respin button while the kind is normal');
    await mod.click('#kKinds label:has(input[value=second])');
    eq(await mod.evaluate(i => state.els.find(e => e.id === i).kind, id), 'second', 'picking a kind from the list');
    eq(await mod.evaluate(i => state.els.find(e => e.id === i).items.filter(x => x.sp).length, id), 1, 'second chance adds the Respin card to the items');
    check(await mod.isHidden('#kSp'), 'the add button hides once the card exists');
    await mod.evaluate(i => { const el = state.els.find(e => e.id === i); el.items.find(x => x.sp).p = 50; }, id);
    const S = await mod.evaluate(i => {
      const el = state.els.find(e => e.id === i), rarest = el.items.reduce((b, it, k) => it.r > el.items[b].r ? k : b, 0), out = {};
      const run = (kind, n) => {
        el.kind = kind;
        const r = { n, over: 0, under: 0, bait: 0, normal: 0, near: 0, nearTried: 0, reel2: 0, better: 0, jitOk: true, lens: true, spLeak: 0, spMiss: 0 };
        for (let k = 0; k < n; k++) {
          caseOpen(el, 'd', '1');
          if (el.kindNow === 'bait') r.bait++; if (el.kindNow === 'normal') r.normal++;
          if (caseKind(el) === 'bait') { r[el.bmode]++; if (el.win !== rarest) { r.nearTried++; if (el.reel[el.bmode === 'over' ? 53 : 51] === rarest) r.near++; } }
          if (kind !== 'second' && (el.items[el.win].sp || el.reel.some(ix => el.items[ix].sp))) r.spLeak++;
          if (el.reel2.length) { r.reel2++; if (el.items[el.win].sp && !el.items[el.win2].sp && el.reel2[52] === el.win2 && el.reel2.every(ix => !el.items[ix].sp)) r.better++; if (el.reel2.length !== 60) r.lens = false; }
          else if (kind === 'second' && el.items[el.win].sp) r.spMiss++;
          if (kind !== 'bait' && Math.abs(el.jit) > 0.4 + 1e-9) r.jitOk = false;
          el.openAt = 0;
        }
        return r;
      };
      out.normal = run('normal', 100); out.bait = run('bait', 300); out.random = run('random', 400);
      out.second = run('second', 600);
      el.kind = 'bait'; return out;
    }, id);
    eq([S.normal.reel2, S.normal.bait, S.normal.jitOk], [0, 0, true], 'normal: no second reel, stop point inside the card');
    check(S.bait.over > 60 && S.bait.under > 60 && S.bait.over + S.bait.under === 300, `bait: both ways happen (over ${S.bait.over}, under ${S.bait.under})`);
    eq(S.bait.near, S.bait.nearTried, 'bait: the rarest item sits next to the winner on the side the reel is heading to');
    check(S.random.bait > 150 && S.random.normal > 150 && S.random.bait + S.random.normal === 400, `random: the kind of each opening is decided at the opening (${S.random.bait} bait / ${S.random.normal} normal)`);
    check(S.second.reel2 > 120 && S.second.reel2 < 280, `second chance: the Respin card (33% here) starts the second reel (${S.second.reel2} of 600)`);
    check(S.second.better === S.second.reel2 && S.second.lens && S.second.spMiss === 0, 'second reel: 60 plain cards, no Respin in it, the winner on the stop position; every Respin win gets a second reel');
    eq([S.normal.spLeak, S.bait.spLeak, S.random.spLeak], [0, 0, 0], 'the Respin card never shows up on the reel in other kinds');
    // panel and stream draw the same frame
    const readFrame = page => page.evaluate(() => { const c = document.querySelector('.case'); return c && { tf: c._strip.style.transform, tf2: c._strip2 ? c._strip2.style.transform : '', stage: c.dataset.stage, uhh: c.dataset.uhh, up: c.dataset.up, ph: c.dataset.ph }; });
    // freeze the clock and draw that exact frame with the page's own frame function (rAF of a background page may be late)
    const framePos = async (page, ms) => { await page.evaluate(m => { window.__caseFreeze = m; }, ms);
      return page.evaluate(m => { const c = document.querySelector('.case'); if (!c) return null; caseFrame(c, c._el, m);
        return { tf: c._strip.style.transform, tf2: c._strip2 ? c._strip2.style.transform : '', stage: c.dataset.stage, uhh: c.dataset.uhh, up: c.dataset.up, ph: c.dataset.ph }; }, ms); };
    const sameOpening = async id => { const want = await mod.evaluate(i => { const e = state.els.find(x => x.id === i); return [e.openAt, e.bmode, e.kind, e.reel2.length, e.win2]; }, id);
      const got = () => wid.evaluate(() => { const e = lastState.els.find(x => x.type === 'case'); return e && [e.openAt, e.bmode, e.kind, e.reel2.length, e.win2]; });
      const ok = await until(async () => JSON.stringify(await got()) === JSON.stringify(want), 12000);
      if (!ok) console.log('    sameOpening want', JSON.stringify(want), 'got', JSON.stringify(await got()));
      return ok; };
    await mod.evaluate(i => { const el = state.els.find(e => e.id === i); el.kind = 'bait'; el.hideAfter = 60; el.openAt = 0; changed(); }, id);
    await mod.fill('#kDonor', 'etsuitoku'); await mod.click('#kOpen');
    await mod.evaluate(i => { const el = state.els.find(e => e.id === i); el.bmode = 'over'; changed(); publishNow(1); }, id);
    check(await sameOpening(id), 'the stream has received the opening');
    await sleep(300);
    for (const ms of [8000, 11700, 12400, 12950]) {
      const a = await framePos(mod, ms), b = await framePos(wid, ms);
      eq([a.tf, a.uhh, a.ph], [b.tf, b.uhh, b.ph], `bait frame at ${ms} ms is the same in the panel and on stream`);
    }
    eq((await framePos(wid, 11700)).uhh, '1', 'bait: the tension moment is flagged (shake and flash)');
    eq((await framePos(wid, 6000)).uhh, '0', 'bait: not before the tension moment');
    const m0 = await wid.evaluate(() => { const m = document.querySelector('.cs-mark').getBoundingClientRect(), c = document.querySelectorAll('.cs-strip:not(.cs-strip2) .cs-card')[52].getBoundingClientRect(); return [m.left, c.left, c.right]; });
    await framePos(wid, 12990);
    const m1 = await wid.evaluate(() => { const m = document.querySelector('.cs-mark').getBoundingClientRect(), c = document.querySelectorAll('.cs-strip:not(.cs-strip2) .cs-card')[52].getBoundingClientRect(); return [m.left, c.left, c.right]; });
    check(m1[0] > m1[1] && m1[0] < m1[2], 'bait "over": after the roll-back the marker stands on the winner');
    check(await wid.evaluate(() => !document.querySelector('.cs-uhh, .cs-up')), 'no captions on the reel by default');
    await mod.evaluate(i => { const el = state.els.find(e => e.id === i); el.uhhText = 'SO CLOSE'; changed(); publishNow(1); }, id);
    check(await until(async () => (await wid.textContent('.cs-uhh').catch(() => '')) === 'SO CLOSE'), 'own caption shows on stream when set');
    await mod.evaluate(i => { const el = state.els.find(e => e.id === i); el.uhhText = ''; changed(); publishNow(1); }, id);
    await wid.evaluate(() => { window.__caseFreeze = null; }); await mod.evaluate(() => { window.__caseFreeze = null; });
    // second chance: force a second reel
    await mod.evaluate(i => { const el = state.els.find(e => e.id === i); el.kind = 'second'; el.items.find(x => x.sp).p = 100; el.openAt = 0; el.ttl = 0; for (let k = 0; k < 200; k++) { caseOpen(el, 'etsuitoku', '1'); if (el.reel2.length) break; } changed(); publishNow(1); }, id);
    check(await sameOpening(id), 'the stream has received the second reel');
    await sleep(300);
    const T2 = await mod.evaluate(i => { const el = state.els.find(e => e.id === i); return { two: el.reel2.length, ct: caseT(el), n2: el.items[el.win2].n }; }, id);
    eq(T2.two, 60, 'second chance rolled a second reel');
    const f1 = await framePos(wid, 13500), f1p = await framePos(mod, 13500);
    eq([f1.up, f1.stage, f1p.up], ['1', '1', '1'], 'the RESPIN! banner is up between the reels, on stream and in the panel');
    const f2 = await framePos(wid, 20500), f2p = await framePos(mod, 20500);
    eq([f2.stage, f2.tf2 === f2p.tf2, f2.ph], ['2', true, 'reel'], 'second reel: the same position in the panel and on stream');
    const fin = await framePos(wid, T2.ct.reveal + 400);
    eq(fin.ph, 'reveal', 'second chance: the reveal comes after the second reel');
    check((await wid.textContent('.cs-bname')) === T2.n2, 'the item of the second reel is the one shown');
    await wid.evaluate(() => { window.__caseFreeze = null; }); await mod.evaluate(() => { window.__caseFreeze = null; });
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => e.type !== 'case'); selectedId = null; commit(); });
  });

  await step('webcam via VDO.Ninja: sender capped at 720p/30fps, viewer asks for H.264 with the same bitrate ceiling', async () => {
    const r = await mod.evaluate(() => {
      const opened = []; const real = window.open; window.open = u => { opened.push(u); };
      const before = state.els.length; addCam(); window.open = real;
      return { opened, el: state.els.at(-1), added: state.els.length - before };
    });
    eq(r.added, 1, 'camera added to the stage');
    const push = new URL(r.opened[0]), view = new URL(r.el.url), id = view.searchParams.get('view');
    eq([push.host, push.searchParams.get('push'), push.searchParams.has('webcam')], ['vdo.ninja', id, true], 'sender link matches the viewer link');
    eq(['width', 'height', 'maxframerate', 'maxvideobitrate'].map(k => push.searchParams.get(k)), ['1280', '720', '30', '2500'], 'sender capped (resolution, frame rate, bitrate)');
    eq([view.searchParams.get('codec'), view.searchParams.get('videobitrate'), view.searchParams.has('cleanoutput'), view.searchParams.has('transparent')], ['h264', '2500', true, true], 'viewer asks for H.264 and the bitrate ceiling, output stays clean and transparent');
    check(await until(async () => (await wid.$$eval('iframe', n => n.map(x => x.src))).some(s => s.includes(`view=${id}`)), 8000), 'camera frame appears on stream');
    const again = await mod.evaluate(() => { const opened = []; const real = window.open; window.open = u => { opened.push(u); }; selectedId = state.els.at(-1).id; renderInspector(); document.getElementById('openCam').click(); window.open = real; return opened[0]; });
    check(again && new URL(again).searchParams.get('maxvideobitrate') === '2500', '«open camera» for an existing camera uses the same sender link');
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => !String(e.url || '').includes('vdo.ninja')); selectedId = null; commit(); });
  });

  await step('own fonts: dropped onto the stage, stored in Hudini Host, same line height as the built-in font', async () => {
    await mod.click('[data-tab=add]'); await mod.fill('#newText', 'Шрифт 123'); await mod.click('#addText');
    const box = () => wid.evaluate(() => [...document.querySelectorAll('.el')].find(n => n.textContent.includes('Шрифт 123'))?.querySelector('.content')?.getBoundingClientRect().height);
    check(await until(box), 'text on stream');
    const mont = await until(() => wid.evaluate(() => document.fonts.check('900 20px Montserrat')), 8000);
    await sleep(1000); const h0 = await box();
    const font = fs.readFileSync(path.join(__dirname, 'fixtures', 'font.ttf'));
    const dt = await mod.evaluateHandle(b64 => { const d = new DataTransfer(); const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); d.items.add(new File([bin], 'MyFont.ttf')); return d; }, font.toString('base64'));
    await mod.dispatchEvent('#stage', 'drop', { dataTransfer: dt });
    check(await until(() => mod.evaluate(() => (state.fonts || []).some(f => f.name === 'MyFont'))), 'font added to the room list');
    const key = await mod.evaluate(() => state.els.find(e => e.type === 'text' && e.text === 'Шрифт 123').font);
    check(/^u:/.test(key), 'selected element switched to the new font');
    check(await mod.evaluate(() => [...I('iFont').options].some(o => o.textContent === 'MyFont')), 'font is in the font list');
    check(await until(() => wid.evaluate(k => [...document.fonts].some(f => f.family.replace(/"/g, '') === 'hu-' + k.slice(2) && f.status === 'loaded'), key)), 'widget downloads and loads the font from Hudini Host');
    await sleep(200); const h1 = await box();
    if (mont) check(Math.abs(h1 - h0) < 1.5, `auto-fit keeps the height of Montserrat (${h0.toFixed(1)} → ${h1.toFixed(1)})`);
    else check(Math.abs(h1 / (await wid.evaluate(() => parseFloat(getComputedStyle([...document.querySelectorAll('.el')].find(n => n.textContent.includes('Шрифт 123')).querySelector('.txt')).fontSize))) - 1.219) < 0.03, 'auto-fit: line height matches Montserrat proportions (web font offline here)');
  });

  await step('small fixes: custom "tense" case sound survives, IRC tags cannot poison prototypes, silence() mutes the case', async () => {
    const snd = await mod.evaluate(() => sanitizeEl({ id: 'x', type: 'case', snd: { tense: 'https://example.com/a.mp3', bogus: 'https://example.com/b.mp3' } }).snd);
    eq(Object.keys(snd), ['tense'], 'custom "tense" sound is kept, unknown moments are dropped');
    const tags = await mod.evaluate(() => { const t = parseTags('__proto__=x;constructor=y;mod=1'); return [Object.getPrototypeOf(t) === null, ({}).x, t.mod]; });
    eq(tags, [true, undefined, '1'], 'tags parsed into a prototype-less object');
    check(await wid.evaluate(() => typeof Case3D.silence === 'function'), 'Case3D.silence exists on the widget');
  });

  await step('HUD styles and flip digits, line icons in the panel', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=cs2]'); await mod.selectOption('#iCsView', 'card');
    await mod.selectOption('#iCsTheme', 'ko'); await mod.click('label.tgl:has(#iCsFlip)');
    const el = await mod.evaluate(() => state.els.at(-1));
    eq([el.theme, el.flip, el.font], ['ko', true, 'russo'], 'KO style, flip on, blocky font picked for it');
    check(await until(() => wid.evaluate(() => [...document.querySelectorAll('.cs2')].some(c => c.dataset.theme === 'ko'))), 'style reaches the stream');
    eq(await mod.evaluate(() => sanitizeEl({ id: 'x', type: 'cs2' }).theme), 'glass', 'glass is the default style');
    const left = await mod.evaluate(() => { const re = /\p{Extended_Pictographic}/u, out = []; const w = document.createTreeWalker(document.querySelector('aside'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (re.test(n.data) && !n.parentElement.closest('[data-i18n-skip],#stage') && n.parentElement.offsetParent) out.push(n.data.trim()); return out; });
    eq(left, [], 'no emoji left in the panel, only line icons');
    check(await mod.evaluate(() => document.querySelectorAll('aside svg.ic').length > 20), 'icons are drawn');
  });

  await step('chat commands for trusted people, timed poll, timer command', async () => {
    await mod.click('[data-tab=chat]');
    const poll = () => mod.evaluate(() => { const p = state.els.find(e => e.type === 'poll'); return { running:p.running, closeAt:p.closeAt }; });
    await mod.evaluate(() => { const p = state.els.find(e => e.type === 'poll'); p.running = false; changed(); });
    await irc('Viewer', '!опрос 30');
    eq((await poll()).running, false, 'a viewer can not start the poll');
    await irc('ModGuy', '!опрос 30', 'moderator/1');
    const p1 = await poll();
    check(p1.running && p1.closeAt > Date.now() + 25000, 'a chat mod starts it with auto-close in 30 s');
    check(await until(async () => /⏳ 0:[23]\d/.test((await wid.$$eval('.poll', n => n.map(x => x.textContent)))[0] || '')), 'countdown on stream');
    await irc('ModGuy', '!опрос стоп', 'moderator/1');
    eq((await poll()).running, false, '!опрос стоп closes it');
    await mod.selectOption('#cmdMode', 'broadcaster');
    await irc('ModGuy', '!poll', 'moderator/1');
    eq((await poll()).running, false, 'mode "only the streamer" ignores mods');
    await irc('Streamer', '!poll', 'broadcaster/1');
    eq((await poll()).running, true, 'the streamer can');
    await mod.selectOption('#cmdMode', 'list'); await mod.fill('#cmdList', 'Friend1, Other'); await mod.dispatchEvent('#cmdList', 'change');
    await irc('Friend1', '!poll stop');
    eq((await poll()).running, false, 'a nick from my list can');
    await mod.evaluate(() => { const p = state.els.find(e => e.type === 'poll'); p.running = true; p.closeAt = Date.now() + 1500; changed(); });
    check(await until(async () => !(await poll()).running, 5000), 'poll closes by itself at the time');
    await mod.selectOption('#cmdMode', 'mods');
    await mod.click('[data-tab=add]'); await mod.click('[data-add=countdown]'); await mod.click('[data-tab=chat]');
    await irc('ModGuy', '!таймер 2м', 'moderator/1');
    const t = await mod.evaluate(() => { const x = state.els.find(e => e.type === 'timer'); return { running:x.running, dur:x.dur }; });
    check(t.running && t.dur === 120000, '!таймер 2м runs a 2 minute countdown');
    await irc('ModGuy', '!таймер стоп', 'moderator/1');
    eq(await mod.evaluate(() => state.els.find(e => e.type === 'timer').running), false, '!таймер стоп pauses it');
    await mod.click('[data-tab=add]');
  });

  await step('scenario: chat command → flash + confetti, with cooldown', async () => {
    await mod.fill('#newText', 'КРИНЖ'); await mod.click('#addText');
    const id = await mod.evaluate(() => state.els.find(e => e.text === 'КРИНЖ').id);
    await mod.evaluate(id => { const x = byId(id); x.hidden = true; changed(); scnList().push({ id: 'c1', name: 'Кринж', on: true, trig: { type: 'chat', cmd: '!кринж', cd: 30 }, acts: [{ t: 'flash', el: id, secs: 5 }, { t: 'confetti' }] }); saveScn(); renderScn(); }, id);
    await mod.click('[data-tab=auto]'); await mod.check('#scnRun');
    await wid.evaluate(() => { window.__c = 0; const o = confetti; confetti = () => { window.__c++; o(); }; });
    await irc('Petya', '!кринж ахах');
    check(await until(async () => (await wid.evaluate(() => window.__c)) === 1), 'confetti fired');
    check(await mod.evaluate(id => !byId(id).hidden && !!byId(id).ttl, id), 'element flashed for N seconds');
    await irc('Petya', '!кринж снова'); await sleep(500);
    eq(await wid.evaluate(() => window.__c), 1, 'cooldown blocks the second run');
  });

  await step('CS2 player card, events and streak popup', async () => {
    const me = (rk, k, hp = 100) => ({ provider: { steamid: '1' }, map: { name: 'de_dust2', round: 3, team_ct: { score: 1 }, team_t: { score: 2 } }, round: { phase: 'live' },
      player: { steamid: '1', name: 'streamer', team: 'T', state: { health: hp, armor: 50, money: 3000, round_kills: rk, round_killhs: 1 }, match_stats: { kills: k, deaths: 1, assists: 2 }, weapons: { a: { name: 'weapon_ak47', state: 'active', ammo_clip: 20, ammo_clip_max: 30 } } } });
    eq((await fetch(`http://127.0.0.1:${host.port}/gsi`, { method: 'POST', body: JSON.stringify({ auth: { token: 'nope' } }) })).status, 403, 'GSI with wrong token → 403');
    await mod.evaluate(() => { scnList().push({ id: 'ace1', name: 'triple', on: true, trig: { type: 'cs2', ev: 'multikill', n: 3, cd: 0 }, acts: [{ t: 'shake' }] }); saveScn(); renderScn(); });
    await mod.click('[data-tab=add]'); await mod.click('[data-add=cs2]');
    await mod.click('[data-add=cs2]'); await mod.selectOption('#iCsView', 'streak');
    await wid.evaluate(() => { window.__s = 0; const o = shake; shake = () => { window.__s++; o(); }; });
    await gsi(me(0, 5)); await sleep(400);
    check(await until(async () => (await wid.$$eval('.cs2[data-view=card]', n => n.map(x => x.textContent))).some(t => t.includes('streamer') && t.includes('Dust2'))), 'card shows name and map');
    await gsi(me(1, 6)); await sleep(250); await gsi(me(2, 7)); await sleep(250); await gsi(me(3, 8));
    check(await until(async () => (await wid.$$eval('.cs2[data-view=streak]', n => n.map(x => x.textContent))).some(t => t.includes('TRIPLE'))), 'TRIPLE KILL popup');
    check(await until(async () => (await wid.evaluate(() => window.__s)) === 1), 'scenario on multikill shakes the screen');
  });

  await step('CS2 observer mode (alpha)', async () => {
    const names = ['s1mple', 'b1t', 'iM', 'jL', 'Aleksib', 'ZywOo', 'apEX', 'flameZ', 'mezii', 'Spinx'];
    const players = {}; names.forEach((n, i) => players['7650' + i] = { name: n, observer_slot: (i + 1) % 10, team: i < 5 ? 'CT' : 'T', state: { health: i === 3 ? 0 : 100 - i * 7, armor: 100, money: 1000 + i * 650, round_kills: 0 }, match_stats: { kills: 10 + i, deaths: 8, assists: i }, weapons: { w1: { name: 'weapon_ak47', type: 'Rifle', state: 'active', ammo_clip: 20, ammo_clip_max: 30 } } });
    await gsi({ provider: { steamid: '999' }, map: { name: 'de_inferno', round: 17, phase: 'live', team_ct: { score: 9, name: 'NAVI' }, team_t: { score: 8, name: 'Vitality' } }, round: { phase: 'live', bomb: 'planted' }, phase_countdowns: { phase: 'bomb', phase_ends_in: '38.2' },
      player: { steamid: '76505', name: 'ZywOo', team: 'T', observer_slot: 6, state: { health: 65 } }, allplayers: players });
    await mod.click('[data-add=cs2]'); await mod.selectOption('#iCsView', 'teams');
    await mod.click('[data-add=cs2]'); await mod.selectOption('#iCsView', 'scorebar');
    eq(await until(() => wid.$$eval('.tm-row', n => n.length || 0)), 10, 'team panels list 10 players');
    eq(await wid.$$eval('.tm-row.dead', n => n.length), 1, 'dead player marked');
    check(await until(() => wid.$('.sb-time')), 'score bar on stream');
    const t1 = await wid.$eval('.sb-time', x => x.textContent); await sleep(2100); const t2 = await wid.$eval('.sb-time', x => x.textContent);
    check(t1 !== t2, `bomb timer ticks ${t1} → ${t2}`);
    check((await mod.$eval('#iCsView option[value=teams]', o => o.textContent)).startsWith('α'), 'observer views carry the α mark');
  });

  await step('CS2 HUD: tournament, ADR, kill feed, table, compare', async () => {
    const names = ['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5'];
    const P = (hp, k, dmg) => { const o = {}; names.forEach((n, i) => o['9' + i] = { name:n, observer_slot:i, team:i < 5 ? 'CT' : 'T', state:{ health:hp[i], armor:50, money:2000, round_kills:0, round_totaldmg:dmg[i] }, match_stats:{ kills:k[i], deaths:1, assists:0 }, weapons:{ w:{ name:'weapon_ak47', type:'Rifle', state:'active' } } }); return o; };
    const G = (players, phase, round) => ({ provider:{ steamid:'999' }, map:{ name:'de_nuke', round, team_ct:{ score:round + (phase === 'over' ? 1 : 0) }, team_t:{ score:0 } }, round:{ phase }, player:{ steamid:'90', name:'a1', team:'CT', state:{ health:100 } }, allplayers:players });
    const full = Array(10).fill(100), z = Array(10).fill(0);
    await gsi(G(P(full, z, z), 'live', 0));
    await gsi(G(P(full, z, [100, 50, 0, 0, 0, 0, 0, 0, 0, 0]), 'over', 0));
    await gsi(G(P(full, z, z), 'live', 1));
    await mod.click('[data-tab=add]'); await mod.click('[data-add=cs2]'); await mod.selectOption('#iCsView', 'hud_tour');
    await gsi(G(P([100, 100, 100, 100, 100, 0, 100, 100, 100, 100], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], z), 'live', 1));
    eq(await until(() => wid.$$eval('.hd-card', n => n.length || 0)), 10, 'tournament HUD shows 10 player cards');
    check(await until(async () => (await wid.$$eval('.hd-kill', n => n.map(x => x.textContent))).some(t => t.includes('a1') && t.includes('b1'))), 'kill feed: a1 killed b1');
    check(await until(async () => /ADR\s*100/.test(await wid.$eval('.hd-big', x => x.textContent).catch(() => ''))), 'observed card shows ADR 100 after one round');
    await mod.selectOption('#iCsView', 'table');
    eq(await until(() => wid.$$eval('.hd-tr:not(.hd-th)', n => n.length || 0)), 10, 'table lists 10 players');
    await mod.selectOption('#iCsView', 'compare'); await mod.selectOption('#iCsPa', 'a1'); await mod.selectOption('#iCsPb', 'b2');
    check(await until(async () => /a1[\s\S]*b2/.test(await wid.$eval('.hd-vs', x => x.textContent).catch(() => ''))), 'compare shows the two chosen players');
    check(await mod.evaluate(() => { const e = state.els.at(-1); return e.x === 50 && e.y === 50; }), 'full-screen HUD is pinned to the screen');
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => !(e.type === 'cs2' && CS2_FULL.has(e.view))); commit(); });
  });

  await step('snapping to other elements: move, resize, Ctrl and highlight of the target', async () => {
    await mod.click('[data-tab=add]');
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    for(const t of ['Alpha', 'Beta']){ await mod.fill('#newText', t); await mod.click('#addText'); }
    await mod.evaluate(() => { state.els[0].x = 30; state.els[0].y = 20; state.els[1].x = 70; state.els[1].y = 75; changed(); renderAll(); });
    await sleep(1500);   // the entrance animation of new elements must finish: it changes their size
    const box = i => mod.evaluate(i => boxOf(state.els[i].id), i);
    const stageRect = await mod.evaluate(() => { const r = stage.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const centerOf = async i => { const b = await mod.locator(`.el[data-id="${await mod.evaluate(i => state.els[i].id, i)}"] .fx`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const A = await box(0), B = await box(1);
    const dragB = async (dxPct, ctrl) => {
      const c = await centerOf(1);
      await mod.mouse.move(c.x, c.y); await mod.mouse.down();
      if(ctrl) await mod.keyboard.down('Control');
      await mod.mouse.move(c.x + dxPct / 100 * stageRect.w, c.y, { steps: 6 });
      const guide = await mod.evaluate(() => ({ v: $('gv2').classList.contains('show'), t: !!document.querySelector('.el.snapT') }));
      await mod.mouse.up(); if(ctrl) await mod.keyboard.up('Control');
      return guide;
    };
    // Beta's left edge 0.4% to the right of Alpha's right edge, the drag ends exactly there
    let g = await dragB(A.r + 0.4 - B.l);
    let B2 = await box(1);
    check(Math.abs(B2.l - A.r) < 0.15, `left edge of Beta snapped to the right edge of Alpha: ${B2.l.toFixed(2)} vs ${A.r.toFixed(2)}`);
    check(g.v && g.t, 'blue guide and the target element are highlighted while snapping');
    check(await mod.evaluate(() => !document.querySelector('.el.snapT') && !$('gv2').classList.contains('show')), 'highlight gone after release');
    await mod.evaluate(i => { state.els[1].x = 70; changed(); renderAll(); });
    const B3 = await box(1);
    await dragB(A.r + 0.4 - B3.l, true);
    B2 = await box(1);
    check(Math.abs(B2.l - (A.r + 0.4)) < 0.15, `Ctrl turns snapping off: gap ${(B2.l - A.r).toFixed(2)}%`);
    // resize: scale Beta so its right edge lands on Alpha's left edge (Beta stands left of Alpha)
    await mod.evaluate(() => { state.els[1].x = 12; state.els[1].y = 75; state.els[1].fs = 4; changed(); renderAll(); });
    await sleep(300);
    await mod.evaluate(() => { selectedId = state.els[1].id; msel.clear(); renderAll(); });
    const B4 = await box(1), cxB = (B4.l + B4.r) / 2, hwB = (B4.r - B4.l) / 2;
    const hb = await mod.locator('.el.sel .h-size').boundingBox();
    const hc = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
    const cB = await centerOf(1);
    const kWant = (A.l - cxB) / hwB * 0.996;    // a bit short of the line
    await mod.mouse.move(hc.x, hc.y); await mod.mouse.down();
    await mod.mouse.move(cB.x + (hc.x - cB.x) * kWant, cB.y + (hc.y - cB.y) * kWant, { steps: 6 });
    await mod.mouse.up();
    const B5 = await box(1);
    check(Math.abs(B5.r - A.l) < 0.2, `scaling snapped the right edge of Beta to the left edge of Alpha: ${B5.r.toFixed(2)} vs ${A.l.toFixed(2)}`);
  });

  await step('sound tab: master × element volume, mute keeps the slider, effects volume', async () => {
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    await mod.click('[data-tab=sound]');
    eq(await mod.$$eval('#mixer .mx', n => n.length), 2, 'master and effects rows, nothing else yet');
    check(await mod.isVisible('#mixerEmpty'), 'hint about the empty list');
    await mod.click('[data-tab=add]');
    await mod.evaluate(() => { addEl({ type: 'video', src: 'https://example.com/a.mp4', x: 30, y: 30, w: 30, sound: true }); });
    await mod.click('[data-add=case]'); await mod.evaluate(() => addRaffle()); await mod.click('[data-add=countdown]');
    await mod.evaluate(() => { const t = state.els.find(e => e.type === 'timer'); t.endSound = 'https://example.com/end.mp3'; changed(); });
    await mod.click('[data-tab=sound]');
    eq(await mod.$$eval('#mixer .mx', n => n.length), 6, 'video, case, giveaway and a timer with an end sound are listed');
    const ids = await mod.evaluate(() => Object.fromEntries(['video', 'case', 'raffle', 'timer'].map(t => [t, (t === 'raffle' ? state.raffle : state.els.find(e => e.type === t)).id])));
    const slide = (key, v) => mod.$eval(`#mixer .mx[data-key="${key}"] input`, (i, v) => { i.value = v; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); }, v);
    const vol = id => wid.$eval(`.el[data-id="${id}"] video`, v => v.volume).catch(() => -1);
    await slide('master', 50);
    check(await until(async () => Math.abs((await vol(ids.video)) - 0.5) < 0.01), 'video on stream: master 50% × its own 100% = 0.5');
    await slide(ids.video, 40);
    check(await until(async () => Math.abs((await vol(ids.video)) - 0.2) < 0.01), 'video on stream: 50% × 40% = 0.2');
    eq(await wid.evaluate(() => masterVol()), 0.5, 'widget knows the master volume');
    await slide('fx', 30);
    check(await until(async () => Math.abs((await wid.evaluate(() => fxVol())) - 0.3) < 0.01), 'effects volume reaches the widget');
    eq(await mod.evaluate(ids => ['timer', 'raffle', 'case'].map(t => drawList(state).find(e => e.id === ids[t]).vol), ids), [0.8, 1, 0.8], 'default volumes: timer 0.8, giveaway 1, case 0.8');
    // 🔇: the slider keeps its place, the sound is off
    await mod.click(`#mixer .mx[data-key="${ids.video}"] .mxm`);
    check(await until(async () => await wid.$eval(`.el[data-id="${ids.video}"] video`, v => v.muted).catch(() => false)), 'muted video is muted on stream');
    check(await mod.$eval(`#mixer .mx[data-key="${ids.video}"]`, n => n.classList.contains('off')), 'row is shown as muted');
    eq(await mod.evaluate(id => state.els.find(e => e.id === id).vol, ids.video), 0.4, 'slider position stays at 40');
    await mod.click(`#mixer .mx[data-key="${ids.case}"] .mxm`);
    eq(await mod.evaluate(id => state.els.find(e => e.id === id).vol, ids.case), 0, 'case muted: volume 0');
    await mod.click(`#mixer .mx[data-key="${ids.case}"] .mxm`);
    eq(await mod.evaluate(id => state.els.find(e => e.id === id).vol, ids.case), 0.8, 'case unmuted: back to 0.8');
    check(await mod.evaluate(() => { const s = sanitizeState({ vol: 5, fxVol: -1, els: [] }); return s.vol === 1 && s.fxVol === 0; }), 'volumes are clamped to 0..1');
    await mod.click('[data-tab=add]');
  });

  await step('editor: multi-select, align, group, undo', async () => {
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    for(const t of ['А', 'Б', 'В']){ await mod.fill('#newText', t); await mod.click('#addText'); }
    await mod.evaluate(() => { [[20, 30], [50, 60], [75, 45]].forEach(([x, y], i) => { state.els[i].x = x; state.els[i].y = y; }); changed(); });
    await mod.keyboard.press('Escape'); await mod.click('#stage', { position: { x: 3, y: 3 } });
    await mod.keyboard.press('Control+KeyA');
    eq(await mod.evaluate(() => msel.size), 3, 'Ctrl+A selects all');
    await mod.click('[data-align="t"]');
    const tops = await mod.evaluate(() => state.els.map(e => boxOf(e.id).t));
    check(Math.max(...tops) - Math.min(...tops) < 0.3, 'align top: same top edge ' + tops.map(t => t.toFixed(2)));
    await mod.click('#tGroup');
    check(await mod.evaluate(() => new Set(state.els.map(e => e.g)).size === 1 && !!state.els[0].g), 'grouped');
    await mod.click('#undoBtn');
    check(await mod.evaluate(() => state.els.every(e => !e.g)), 'undo removes the group');
    check(await mod.$$eval('.lvl', n => n.length) >= 8, 'β/α marks present on beta features');
    // своя рамка: тянем ручку ширины, размер больше не зависит от содержимого
    await mod.evaluate(() => { selectedId = state.els[0].id; msel.clear(); renderAll(); });
    const hb = await mod.locator('.el.sel .h-sw').boundingBox();
    await mod.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await mod.mouse.down();
    await mod.mouse.move(hb.x + 120, hb.y + hb.height / 2, { steps: 5 }); await mod.mouse.up();
    const bw = await mod.evaluate(() => state.els[0].bw);
    check(bw > 2, 'width handle sets a fixed frame: ' + bw);
    const w1 = await until(() => wid.$eval(`.el[data-id="${'x'}"]`, n => n.offsetWidth).catch(() => 0), 300) ;
    void w1;
    const id0 = await mod.evaluate(() => state.els[0].id);
    const before = await until(() => wid.$eval(`.el[data-id="${id0}"]`, n => n.getBoundingClientRect().width).catch(() => 0));
    await mod.evaluate(() => { state.els[0].text = 'Очень длинный текст, который раньше раздувал элемент'; changed(); });
    await until(async () => (await wid.$eval(`.el[data-id="${id0}"]`, n => n.textContent).catch(() => '')).includes('Очень'));
    const after = await wid.$eval(`.el[data-id="${id0}"]`, n => n.getBoundingClientRect().width);
    check(Math.abs(after - before) < 2 && Math.abs(after - bw / 100 * 1920) < 4, `frame keeps its width on stream (${Math.round(before)} → ${Math.round(after)} px)`);
    await mod.dblclick('.el.sel .h-sw');
    eq(await mod.evaluate(() => state.els[0].bw), 0, 'double-click: size by content again');
    await mod.evaluate(() => { state.els[0].text = 'А'; changed(); });
    await mod.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await mod.click('#stage', { position: { x: 3, y: 3 } }); await mod.keyboard.press('Control+KeyA');
    await mod.keyboard.press('Control+KeyC'); await mod.keyboard.press('Control+KeyV');
    check(await until(() => mod.evaluate(() => state.els.length === 6)), 'Ctrl+C, Ctrl+V pastes copies of all 3');
    const xs = await mod.evaluate(() => state.els.map(e => Math.round(e.x)));
    check(xs[3] === xs[0] + 3, 'pasted copies are shifted: ' + xs);
    await mod.keyboard.press('Control+KeyV');
    check(await until(() => mod.evaluate(() => state.els.length === 9 && Math.round(state.els[6].x) === Math.round(state.els[0].x) + 6)), 'second paste shifts further');
    await mod.keyboard.press('Control+KeyX');
    check(await until(() => mod.evaluate(() => state.els.length === 6)), 'Ctrl+X cuts the selection');
  });

  await step('layers: folders, rename, fold, mass hide, range select, drag over eyes', async () => {
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    for(const t of ['А', 'Б', 'В', 'Г']){ await mod.fill('#newText', t); await mod.click('#addText'); }
    await mod.keyboard.press('Escape');
    const ids = await mod.evaluate(() => state.els.map(e => e.id));
    const row = i => `#layers .layer[data-id="${ids[i]}"]`;
    await mod.click(row(0) + ' .name'); await mod.click(row(1) + ' .name', { modifiers: ['Control'] });
    eq(await mod.evaluate(() => msel.size), 2, 'Ctrl+click adds a row');
    await mod.click('#tGroup');
    eq(await mod.$$eval('#layers .layer.folder', n => n.length), 1, 'one folder row');
    check((await mod.textContent('#layers .layer.folder .name')).trim() === 'Группа 1', 'folder is named "Группа 1"');
    check(await mod.evaluate(() => { const ix = state.els.map((e, i) => e.g ? i : -1).filter(i => i >= 0); return ix.length === 2 && ix[1] - ix[0] === 1; }), 'group members stand next to each other');
    // переименование двойным кликом
    await mod.dblclick('#layers .layer.folder .name');
    await mod.fill('#layers .folderName', 'Алерты'); await mod.keyboard.press('Enter');
    check(await mod.evaluate(() => state.els.filter(e => e.g).every(e => e.gn === 'Алерты')), 'rename sets the name on every member');
    check((await mod.textContent('#layers .layer.folder .name')).trim() === 'Алерты', 'folder row shows the new name');
    await mod.keyboard.press('Escape'); await mod.click('#layers .layer.folder .ico');
    await mod.keyboard.press('F2');
    check(!!(await mod.$('#layers .folderName')), 'F2 starts renaming');
    await mod.keyboard.press('Escape');
    check(!(await mod.$('#layers .folderName')) && await mod.evaluate(() => state.els.find(e => e.g).gn === 'Алерты'), 'Esc cancels the rename');
    // сворачивание живёт после перерисовки
    await mod.click('#layers .layer.folder [data-act=fold]');
    eq(await mod.$$eval('#layers .layer.in', n => n.length), 0, 'folded: members are hidden in the list');
    await mod.evaluate(() => renderAll());
    eq(await mod.$$eval('#layers .layer.in', n => n.length), 0, 'folded state survives a re-render');
    await mod.click('#layers .layer.folder [data-act=fold]');
    eq(await mod.$$eval('#layers .layer.in', n => n.length), 2, 'unfolded');
    // 👁 папки
    await mod.click('#layers .layer.folder [data-act=eye]');
    check(await mod.evaluate(() => state.els.filter(e => e.g).every(e => e.hidden)) && await mod.evaluate(() => state.els.filter(e => !e.g).every(e => !e.hidden)), 'folder eye hides only its members');
    check(await until(async () => (await wid.$$eval('.el', n => n.filter(x => x.style.opacity === '0').length)) === 2), 'stream hides both members');
    await mod.click('#layers .layer.folder [data-act=eye]');
    check(await mod.evaluate(() => state.els.every(e => !e.hidden)), 'folder eye shows them again');
    // диапазон Shift и 👁 на всё выделение
    await mod.click(row(3) + ' .name'); await mod.click('#layers .layer.folder .ico', { modifiers: ['Shift'] });
    eq(await mod.evaluate(() => msel.size), 4, 'Shift+click selects the range, folder included');
    await mod.click(row(2) + ' [data-act=eye]');
    check(await mod.evaluate(() => state.els.every(e => e.hidden)), 'eye of a selected row hides the whole selection');
    await mod.click('#undoBtn');
    check(await mod.evaluate(() => state.els.every(e => !e.hidden)), 'one undo shows all of them again');
    // протяжка по глазкам
    await mod.keyboard.press('Escape'); await mod.click('#stage', { position: { x: 3, y: 3 } });
    const eye = sel => mod.locator(sel + ' [data-act=eye]').boundingBox();
    const b1 = await eye(row(3)), b2 = await eye(row(2)), b3 = await eye('#layers .layer.folder');
    await mod.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2); await mod.mouse.down();
    await mod.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 6 });
    await mod.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2, { steps: 6 }); await mod.mouse.up();
    check(await mod.evaluate(() => state.els.every(e => e.hidden)), 'dragging across the eyes hides every row passed');
    await mod.click('#undoBtn');
    check(await mod.evaluate(() => state.els.every(e => !e.hidden)), 'the whole drag is one undo step');
    // порядок: папка двигается блоком
    await mod.click('#layers .layer.folder .ico'); await mod.locator('#bUp').dispatchEvent('click');
    eq(await mod.evaluate(() => state.els.map(e => e.text).join('')), 'ВАБГ', 'folder jumps over the neighbour as a block');
    await mod.click(row(0) + ' .name'); await mod.locator('#bUp').dispatchEvent('click'); await mod.locator('#bUp').dispatchEvent('click');
    eq(await mod.evaluate(() => state.els.map(e => e.text).join('')), 'ВБАГ', 'a member moves only inside its group, not out of it');
    // разгруппировать
    await mod.click('#layers .layer.folder [data-act=ungroup]');
    check(await mod.evaluate(() => state.els.every(e => !e.g && !e.gn)) && !(await mod.$('#layers .layer.folder')), 'ungroup removes the folder and the name');
  });

  await step('chat on stream: themes, feed, delete, fade, direction, channel', async () => {
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    await mod.click('[data-tab=add]'); await mod.click('#addChatFeed');
    eq(await mod.evaluate(() => state.els.length && state.els[0].type), 'chat', 'the tile adds a chat element');
    await mod.fill('#iChChan', 'https://twitch.tv/Chan'); await mod.press('#iChChan', 'Enter');
    eq(await mod.evaluate(() => state.els[0].chan), 'chan', 'channel is cleaned to a bare name');
    const line = (user, text, id, emotes = '') => `@badge-info=;badges=;color=#1E90FF;display-name=${user};emotes=${emotes};id=${id};mod=0;subscriber=0 :${user.toLowerCase()}!${user.toLowerCase()}@x.tmi.twitch.tv PRIVMSG #chan :${text}`;
    const send = l => wid.evaluate(x => window.__irc(x), l);
    const rows = () => wid.$$eval('.chat .cl', n => n.length);
    check(await until(() => wid.$('.chat[data-theme=glass]')), 'the stream shows the chat element with the default theme');
    check(await until(() => wid.evaluate(() => !!window.__irc)), 'the widget opened its own chat connection');
    await send(line('Kappa_Fan', 'Kappa привет стрим!', 'm1', '25:0-4'));
    await send(line('Vasya', 'второе', 'm2'));
    await send(line('Evil', '<img src=x onerror=alert(1)>', 'm3'));
    check(await until(async () => (await rows()) === 3), 'three messages in the feed');
    eq(await wid.$$eval('.chat .cl:first-child .m-emote', n => n.length), 1, 'emote is an image');
    check(await wid.$eval('.chat .cl:last-child', n => n.textContent.includes('<img') && !n.querySelector('img')), 'HTML in a message stays plain text');
    // удаление модератором и бан
    await send('@login=vasya;room-id=1;target-msg-id=m2;tmi-sent-ts=1 :tmi.twitch.tv CLEARMSG #chan :второе');
    check(await until(async () => (await rows()) === 2), 'a deleted message leaves the stream');
    await send('@ban-duration=600;room-id=1;target-user-id=2 :tmi.twitch.tv CLEARCHAT #chan :kappa_fan');
    check(await until(async () => (await rows()) === 1), 'a timeout removes that viewer messages');
    await send(':tmi.twitch.tv CLEARCHAT #chan');
    check(await until(async () => (await rows()) === 0), 'clear chat empties the feed');
    // исчезание
    await mod.evaluate(() => { state.els[0].fade = 1; changed(); });
    await sleep(900);   // настройка доходит до виджета раньше сообщения
    await send(line('Anna', 'исчезну', 'm4'));
    check(await until(async () => (await rows()) === 1), 'message shown');
    check(await until(async () => (await rows()) === 0, 5000), 'message fades away after the set time');
    await mod.evaluate(() => { state.els[0].fade = 0; changed(); });
    await sleep(900);
    // порядок и тема
    await send(line('A1', 'первое', 'm5')); await send(line('A2', 'второе', 'm6'));
    check(await until(async () => (await rows()) === 2), 'two messages again');
    check(await wid.$eval('.chat .cl:first-child', n => n.textContent.includes('первое')), 'new messages at the bottom by default');
    await mod.evaluate(() => { state.els[0].dir = 'up'; changed(); });
    check(await until(() => wid.$eval('.chat .cl:first-child', n => n.textContent.includes('второе'))), 'switching to new-on-top flips the feed');
    for(const theme of ['bubbles', 'minimal', 'neon', 'panel', 'accent']){
      await mod.evaluate(t => { state.els[0].theme = t; changed(); }, theme);
      check(await until(() => wid.$(`.chat[data-theme=${theme}]`)), 'theme ' + theme);
    }
    await mod.evaluate(() => { state.els[0].theme = 'bogus'; changed(); });
    eq(await mod.evaluate(() => sanitizeEl(state.els[0]).theme), 'glass', 'unknown theme falls back to glass');
    // смена канала
    await mod.evaluate(() => { state.els[0].chan = 'other'; changed(); });
    check(await until(async () => (await rows()) === 0), 'switching the channel clears the feed');
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    check(await until(async () => (await wid.$$('.chat')).length === 0), 'removed from the stream');
    await mod.fill('#newText', 'А'); await mod.click('#addText');   // дальше шагам нужен непустой экран
  });

  await step('browser on the right: tabs, address check, hides under menus, restored, iframe fallback', async () => {
    const calls = () => mod.evaluate(() => window.__calls.filter(c => c[0].startsWith('browser_')));
    const opened = async () => (await calls()).filter(c => c[0] === 'browser_open').map(c => c[1]);
    await mod.evaluate(() => { window.__calls.length = 0; chatConnect('chan'); });
    check(!(await mod.evaluate(() => document.body.classList.contains('web'))), 'the column starts closed');
    await mod.click('#webBtn');
    check(await mod.evaluate(() => document.body.classList.contains('web')), 'the globe button opens the column');
    check(await until(async () => (await opened()).some(a => a.id === 'chat' && a.url === 'https://www.twitch.tv/popout/chan/chat?popout=')), 'the chat tab opens the popout chat of the room channel');
    check((await calls()).some(c => c[0] === 'browser_place' && c[1].w > 100 && c[1].h > 100 && c[1].x > 300), 'the native view is placed inside the column: ' + JSON.stringify((await calls()).filter(c => c[0] === 'browser_place').at(-1)?.[1]));
    // свои вкладки
    await mod.click('#webTabs [data-add]');
    await mod.fill('#webUrl', 'javascript:alert(1)'); await mod.press('#webUrl', 'Enter');
    check(!(await opened()).some(a => /javascript/.test(a.url)), 'a javascript: address is refused');
    await mod.fill('#webUrl', 'http://127.0.0.1:7778/'); await mod.press('#webUrl', 'Enter');
    check(!(await opened()).some(a => /127\.0\.0\.1/.test(a.url)), 'local addresses are refused');
    await mod.fill('#webUrl', 'example.com'); await mod.press('#webUrl', 'Enter');
    check(await until(async () => (await opened()).some(a => a.id !== 'chat' && a.url === 'https://example.com/')), 'an address without a scheme becomes https');
    eq(await mod.$$eval('#webTabs button[data-id]', n => n.length), 2, 'two tabs');
    // меню поверх колонки: нативный webview прячется и возвращается
    await mod.evaluate(() => { window.__calls.length = 0; });
    await mod.click('#moreBtn');
    check(await until(async () => (await calls()).some(c => c[0] === 'browser_visible' && c[1].visible === false)), 'the view hides under an open menu');
    await mod.keyboard.press('Escape');
    check(await until(async () => (await calls()).some(c => c[0] === 'browser_visible' && c[1].visible === true)), 'and comes back when the menu closes');
    // смена канала меняет адрес чата
    await mod.evaluate(() => { window.__calls.length = 0; chatConnect('other'); });
    await mod.click('#webTabs button[data-id=chat]');
    check(await until(async () => (await opened()).some(a => a.id === 'chat' && a.url.includes('/popout/other/chat'))), 'another channel opens that chat');
    // вкладки сохраняются
    const saved = await T.stored(mod, 'overlay.browser');
    check(saved?.open === true && saved.tabs?.length === 1 && saved.tabs[0].url === 'https://example.com/', 'open state and tabs are stored: ' + JSON.stringify(saved));
    // закрытие вкладки
    await mod.evaluate(() => { window.__calls.length = 0; });
    await mod.click('#webTabs [data-close]');
    check(await until(async () => (await calls()).some(c => c[0] === 'browser_close')), 'closing a tab closes its view');
    eq(await mod.$$eval('#webTabs button[data-id]', n => n.length), 1, 'only the chat tab is left');
    await mod.click('#webBtn');
    check(!(await mod.evaluate(() => document.body.classList.contains('web'))), 'the globe button closes the column');
    // без приложения: iframe со встроенным чатом
    const web = await T.newPage('web-iframe', { irc: true, app: false });
    await web.goto(`${S.web.url}/panel/moderator.html`); await web.waitForFunction(() => window.hudiniReady);
    await web.evaluate(() => chatConnect('chan')); await web.click('#webBtn');
    check(await until(() => web.evaluate(() => { const f = document.getElementById('webFrame'); return !f.hidden && /twitch\.tv\/embed\/chan\/chat\?parent=/.test(f.getAttribute('src') || ''); })), 'without the app the chat is an iframe embed');
    await web.context().close();
  });

  await step('scenes: save and restore the screen', async () => {
    mod.removeAllListeners('dialog'); mod.on('dialog', d => d.accept('Начало'));
    await mod.click('[data-tab=scenes]'); await mod.click('#sceneSave');
    const n = await mod.evaluate(() => state.els.length);
    await mod.click('#moreBtn'); await mod.click('#clearAll'); await mod.click('.scene');
    eq(await mod.evaluate(() => state.els.length), n, 'scene brings the elements back');
    check(await until(async () => (await wid.$$eval('.el', x => x.length)) >= n), 'widget shows the scene');
  });

  await step('password vault and encrypted backup', async () => {
    const answers = ['secret123', 'secret123', 'bk-pass-1'];
    mod.removeAllListeners('dialog'); mod.on('dialog', d => d.type() === 'prompt' ? d.accept(answers.shift() ?? '') : d.accept());
    await mod.click('#moreBtn'); await mod.click('#passBtn');
    check(await until(async () => !!(await T.stored(mod, 'overlay.vault2'))?.locked), 'vault locked');
    check(!JSON.stringify(await T.stored(mod, 'overlay.vault2')).includes('"d"'), 'no private key in clear');
    await mod.click('[data-tab=room]');
    const [dl] = await Promise.all([mod.waitForEvent('download'), mod.click('#roomExport')]);
    const bk = fs.readFileSync(await dl.path(), 'utf8');
    check(JSON.parse(bk).overlayBackup === 2 && !bk.includes(await mod.evaluate(() => room)), 'backup is encrypted');
    await mod.reload();
    check(await until(() => mod.isVisible('#lock')), 'lock screen after reload');
    await mod.fill('#lockPass', 'wrong'); await mod.click('#lockGo');
    check(await until(async () => /Неверный/.test(await mod.textContent('#lockErr'))), 'wrong password refused');
    await mod.fill('#lockPass', 'secret123'); await mod.click('#lockGo');
    check(await until(async () => (await mod.getAttribute('#status', 'class')).includes('ok'), 12000), 'unlocked and back online');
  });

  // Пульт без программы и поддельный клиент MQTT: что уходит на экран при смене комнаты и после работы без связи
  await step('room switch and offline edits never wipe the screen of the room', async () => {
    const p = await T.newPage('sync', { app: false });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const r = await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const sent = [];
      const fake = () => ({ connected: true, subscribe(){}, unsubscribe(){}, publish(topic, box, opts, cb){ sent.push(topic); cb(); }, on(){}, end(){} });
      const inject = async msg => { await onMessage(topics(room).state, await sealJSON(KEYS, msg, true), { retain: true }); await sleep(80); };
      const el = (id, text) => ({ id, type: 'text', text });
      const out = {};
      const B = await makeRoom('B'); rooms.push(B);
      addText('ROOM A SCREEN'); scheduleSend();   // отправка ещё ждёт своих 50 мс, а модератор уже выбрал другую комнату
      await switchRoom(B.code); await sleep(120);
      out.pending = pendingOffline;
      useMain(fake()); await sleep(100);
      out.sentBefore = sent.length;
      await inject({ v: 2, from: 'mod_X', t: Date.now() - 1000, els: [el('b1', 'B SCREEN')] });
      out.afterRetained = state.els.map(e => e.text); out.sentAfter = sent.length;
      // без связи добавили элемент, а другой модератор тем временем поменял экран
      useMain(null); addText('OFFLINE NEW'); out.pending2 = pendingOffline === room;
      useMain(fake()); await sleep(50); let s = sent.length;
      await inject({ v: 2, from: 'mod_X', t: Date.now(), els: [el('b1', 'B SCREEN'), el('x2', 'OTHER MOD')] });
      out.merged = state.els.map(e => e.text); out.mergeSent = sent.length - s;
      // без связи поменяли элемент, а экран с тех пор не менялся: наша правка остаётся
      useMain(null); state.els[0].text = 'EDITED OFFLINE'; commit();
      useMain(fake()); await sleep(50); s = sent.length;
      await inject({ v: 2, from: 'mod_X', t: stateSeenT.get(room), els: [el('b1', 'B SCREEN'), el('x2', 'OTHER MOD')] });
      out.unchanged = state.els.map(e => e.text); out.unchangedSent = sent.length - s;
      // сохранённого экрана нет: отправляем после короткого ожидания
      useMain(null); addText('LONELY'); useMain(fake()); s = sent.length; await sleep(1700); out.timeoutSent = sent.length - s;
      return out;
    });
    eq([r.pending, r.sentBefore, r.sentAfter], [null, 0, 0], 'nothing of the old room is sent to the new one');
    eq(r.afterRetained, ['B SCREEN'], 'the saved screen of the new room is shown');
    check(r.pending2, 'an edit without the connection waits for it');
    eq([r.merged, r.mergeSent], [['B SCREEN', 'OTHER MOD', 'OFFLINE NEW'], 1], 'the screen changed meanwhile: it stays, only the new element is added');
    eq([r.unchanged, r.unchangedSent], [['EDITED OFFLINE', 'OTHER MOD', 'OFFLINE NEW'], 1], 'the screen did not change meanwhile: our edit is sent');
    eq(r.timeoutSent, 1, 'no saved screen: the edits are sent after the wait');
    await p.context().close();
  });

  await step('clock skew: edits from a panel with a slow clock are still newer than what it has seen', async () => {
    const p = await T.newPage('skew', { app: false });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const r = await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const sent = [];
      useMain({ connected: true, subscribe(){}, unsubscribe(){}, publish(topic, box, opts, cb){ sent.push(box); cb(); }, on(){}, end(){} });
      const ahead = Date.now() + 120000;   // у другого модератора часы спешат на 2 минуты
      await onMessage(topics(room).state, await sealJSON(KEYS, { v: 2, from: 'mod_B', t: ahead, els: [{ id: 'b1', type: 'text', text: 'FROM_B' }] }, true), { retain: false });
      addText('MINE'); await sleep(100);
      const last = await unsealJSON(KEYS, sent.at(-1), true);
      return { newer: last.t > ahead, els: last.els.map(e => e.text) };
    });
    eq(r, { newer: true, els: ['FROM_B', 'MINE'] }, 'our screen is stamped after the newest one seen');
    await p.context().close();
  });

  await step('a screen from another moderator during a drag is kept, the dragged element keeps its position', async () => {
    const p = await T.newPage('drag-remote', { app: false });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    await p.evaluate(() => {
      window.__sent = [];
      useMain({ connected: true, subscribe(){}, unsubscribe(){}, publish(topic, box, opts, cb){ __sent.push(box); cb(); }, on(){}, end(){} });
      state = { visible: true, vol: 1, fxVol: 1, els: [sanitizeEl({ id: 'm1', type: 'text', text: 'MINE', x: 30, y: 30 })], raffle: null }; renderAll();
    });
    const box = await p.locator('.el[data-id="m1"] .content').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 4 });
    const mid = await p.evaluate(async () => {
      await onMessage(topics(room).state, await sealJSON(KEYS, { v: 2, from: 'mod_E', t: Date.now() + 5, els: [{ id: 'm1', type: 'text', text: 'MINE EDITED', x: 30, y: 30 }, { id: 'e1', type: 'text', text: 'FROM_E' }] }, true), { retain: false });
      return { texts: state.els.map(e => e.text), moved: byId('m1').x > 32, dragging: !!drag };
    });
    eq(mid, { texts: ['MINE EDITED', 'FROM_E'], moved: true, dragging: true }, 'the other screen is taken at once, the dragged element stays under the mouse');
    await p.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 20, { steps: 3 }); await p.mouse.up();
    const sent = await until(() => p.evaluate(async () => { const m = await unsealJSON(KEYS, __sent.at(-1), true); return m.els.length === 2 && m.els.map(e => e.text + (e.x > 32 ? ' moved' : '')); }));
    eq(sent, ['MINE EDITED moved', 'FROM_E'], 'the drag result keeps the other moderator\'s change');
    await p.context().close();
  });

  await step('element limit for duplicate and chat messages; a scene added on top gets its own groups', async () => {
    const p = await T.newPage('limits', { app: false });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const r = await p.evaluate(() => {
      for (let i = 0; i < MAX_ELS; i++) state.els.push(sanitizeEl({ id: 'e' + i, type: 'text', text: 't' + i }));
      renderAll(); msel.clear(); msel.add('e199'); selectedId = 'e199'; duplicate();
      document.getElementById('msgReplace').checked = false;
      showChatMsg({ id: '1', user: 'u', color: '#ffffff', text: 'hi', emotes: [], badge: '', t: Date.now() });
      const n = state.els.length, t = document.getElementById('toast').textContent;
      state = { visible: true, vol: 1, fxVol: 1, els: [sanitizeEl({ id: 'a', type: 'text', text: 'A', g: 'grp', gn: 'G' }), sanitizeEl({ id: 'b', type: 'text', text: 'B', g: 'grp', gn: 'G' }), sanitizeEl({ id: 'c', type: 'text', text: 'C' })], raffle: null };
      applyScene({ name: 's', els: snapshotEls() }, true);
      return { n, t, units: layerUnits().map(u => u.g ? 'folder ' + u.els.map(e => e.text).join('') : u.el.text), groupOfA: groupOf('a').length };
    });
    eq([r.n, /максимум 200/.test(r.t)], [200, true], 'nothing is added past the limit, with a message');
    eq([r.units, r.groupOfA], [['C', 'folder BA', 'C', 'folder BA'], 2], 'the scene on top has its own folder, the old group stays as it was');
    await p.context().close();
  });

  await step('a hostile backup or broken stored data cannot stop the panel', async () => {
    const p = await T.newPage('hostile', { app: false });
    const dialogs = []; p.removeAllListeners('dialog'); p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const code = await p.evaluate(() => room);
    const file = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'hudini-bk-')), 'backup.json');
    fs.writeFileSync(file, JSON.stringify({
      scenarios: { [code]: [{ id: 'x1', name: 'pack', on: true, trig: { type: 'manual' }, acts: [{ t: 'constructor' }, { t: 'flash', el: 'q', secs: '9', evil: 1 }] },
        { id: 'a"b', trig: { type: 'manual' }, acts: [] }, { id: 'z2', trig: { type: 'toString' }, acts: [] }], toString: [{ id: 't1', trig: { type: 'manual' }, acts: [] }] },
      scenes: { [code]: [{ name: 's', els: [{ id: 'k', type: 'text', text: 'ok' }, { type: 'nope' }, 5] }] },
      library: [{ name: 'l', room: code, el: { type: 'text', text: 'lib', items: 7 } }, { name: 'bad', room: code, el: { type: 'web', url: 'http://127.0.0.1:7777/' } }],
    }));
    await p.setInputFiles('#roomFile', file);
    check(await until(() => dialogs.some(m => /без пароля/.test(m))), 'a backup without a password asks first');
    const got = await until(() => p.evaluate(() => scnStore[room]?.length && { scn: scnStore[room], scenes: scenes[room].map(s => s.els.map(e => e.text)), lib: library.map(l => l.el.text), toStr: scnStore.toString?.length, used: usedAssets().size }));
    eq(got?.scn, [{ id: 'x1', name: 'pack', on: true, trig: { type: 'manual' }, acts: [{ t: 'flash', el: 'q', secs: 9 }] }], 'only known actions and fields of a scenario are kept');
    eq([got?.scenes, got?.lib, got?.used], [[['ok']], ['lib'], 0], 'scene and library elements are checked like screen elements');
    eq(got?.toStr, 1, 'a room code like toString works as a key');
    await p.evaluate(c => {
      localStorage.setItem('store:overlay.scn', JSON.stringify({ [c]: [{ id: 'y', trig: { type: 'manual' }, acts: [{ t: 'constructor' }] }] }));
      localStorage.setItem('store:overlay.scenes', JSON.stringify({ [c]: [{ name: 'x', els: [{ id: 'e', type: 'case', items: 5 }] }] }));
    }, code);
    await p.reload();
    check(await until(() => p.evaluate(() => window.hudiniReady), 15000), 'the panel starts with broken stored scenarios and scenes');
    eq(await p.evaluate(() => [document.querySelectorAll('.scn').length, scnStore[room][0].acts.length]), [1, 0], 'the scenario is listed without the unknown action');
    await p.context().close();
  });

  await step('room keys are checked before a room is used', async () => {
    const p = await T.newPage('badroom', { app: false });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const r = await p.evaluate(async () => {
      addText('OLD ROOM TEXT');
      const before = room, bad = { code: 'badroom123', name: 'Bad', k: 'AAAA', p: 'AAAA', s: { kty: 'EC' } };
      const inv = new URL(location.href); inv.search = ''; inv.hash = 'invite=' + b64u.enc(TE.encode(JSON.stringify(bad)));
      const res = await acceptInvite(inv.href);
      const out = { res, same: room === before, els: state.els.map(e => e.text), hasBad: rooms.some(r => r.code === 'badroom123') };
      rooms.push(bad); out.sw = await switchRoom('badroom123'); out.same2 = room === before && !!KEYS;
      await saveRooms(); lsSet('overlay.current', 'badroom123');
      return out;
    });
    eq(r, { res: false, same: true, els: ['OLD ROOM TEXT'], hasBad: false, sw: false, same2: true }, 'an invite with broken keys is refused, a broken room is not opened');
    await p.reload(); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    check(await p.evaluate(() => room !== 'badroom123' && !!KEYS && document.getElementById('link').value.includes('#k=')), 'a broken saved room: the panel starts in another one');
    check(await until(async () => /повреждены/.test(await p.textContent('#toast'))), 'and says why');
    await p.context().close();
  });

  await step('giveaway entries belong to their room; the old key moves to the first room that opens it', async () => {
    const p = await T.newPage('raffle-rooms', { app: false });
    await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('store:hudini.raf.raffle', JSON.stringify([['old_one', { user: 'old_one', color: '#ffffff', sub: false }]])); } });
    await p.goto(`${S.web.url}/panel/moderator.html`); await p.waitForFunction(() => window.hudiniReady, null, { timeout: 15000 });
    const r = await p.evaluate(async () => {
      const join = u => onChat(u, '!участвую', { login: u, user: u, color: '#ffffff' });
      addRaffle(); raf().phase = 'collect';
      const legacy = [...rafEntries('raffle').keys()];
      join('alice_a'); join('bob_a');
      const A = room, B = await makeRoom('B'); rooms.push(B); await switchRoom(B.code);
      addRaffle(); raf().phase = 'collect'; join('dave_b');
      const pool = [...rafEntries('raffle').keys()];
      await switchRoom(A);
      return { legacy, pool, back: [...rafEntries('raffle').keys()], oldKey: localStorage.getItem('store:hudini.raf.raffle') };
    });
    eq(r, { legacy: ['old_one'], pool: ['dave_b'], back: ['old_one', 'alice_a', 'bob_a'], oldKey: null }, 'each room has its own entries');
    await p.context().close();
  });

  await step('help drawer: connection guides are part of the help', async () => {
    await mod.evaluate(() => window.HudiniUI.openHelp('connect'));
    check(await until(async () => /Radmin VPN/.test(await mod.evaluate(() => document.getElementById('helpDrawer')?.textContent || '')), 8000), 'drawer lists Radmin VPN');
    const txt = await mod.evaluate(() => document.getElementById('helpDrawer').textContent);
    check(/Porthole/.test(txt) && /Tailscale/.test(txt) && /ZeroTier/.test(txt), 'all connection methods are in the drawer');
  });

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
