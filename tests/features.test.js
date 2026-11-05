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

  await step('poll counts chat votes once per viewer', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=poll]'); await mod.click('#pToggle');
    await mod.evaluate(() => { onChat('a', '1'); onChat('b', '!2'); onChat('c', '2'); onChat('c', '1'); onChat('d', 'hello 2'); });
    eq(await mod.evaluate(() => state.els.find(e => e.type === 'poll').votes), [2, 1, 0], 'one vote per viewer, last choice counts (c switched 2→1), "hello 2" is not a vote');
    check(await until(async () => (await wid.$$eval('.poll', n => n.length)) === 1), 'poll on stream');
  });

  await step('giveaway: entries from chat, sub-only and x2, case reel lands on the winner, confirm and reroll', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=raffle]');
    await mod.fill('#iRPrize', 'AK-47 | Redline'); await mod.dispatchEvent('#iRPrize', 'change');
    await mod.fill('#rSecs', '60'); await mod.click('#rStart');
    await irc('Alice', '!участвую'); await irc('Bob', 'привет'); await irc('Carl', '!участвую', 'subscriber/12'); await irc('Alice', '!участвую');
    let r = await mod.evaluate(() => state.els.find(e => e.type === 'raffle'));
    eq([r.phase, r.n], ['collect', 2], 'two entrants: keyword only, one entry per viewer');
    check(await until(async () => (await wid.textContent('.raf')).includes('!участвую')), 'stream shows how to join');
    await mod.click('label.tgl:has(#iRSubs)'); await irc('Dan', '!участвую'); await irc('Eve', '!участвую', 'subscriber/3');
    eq(await mod.evaluate(() => [...rafEntries(state.els.find(e => e.type === 'raffle').id).keys()]), ['alice', 'carl', 'eve'], 'subscribers-only blocks Dan');
    const wins = await mod.evaluate(() => { const el = state.els.find(e => e.type === 'raffle'); const c = {}; for (let i = 0; i < 3000; i++) { const w = rafPick(el).win[0]; c[w] = (c[w] || 0) + 1; } return c; });
    check(wins.carl > wins.alice * 1.6 && wins.eve > wins.alice * 1.6, `subs win about twice as often (${JSON.stringify(wins)})`);
    await mod.fill('#iRConfirm', '3'); await mod.dispatchEvent('#iRConfirm', 'change');
    await mod.click('#rSpin');
    r = await mod.evaluate(() => state.els.find(e => e.type === 'raffle'));
    eq([r.phase, r.reel.length, r.reel[62][0]], ['spin', 72, r.winner], 'reel is built with the winner in the winning slot');
    check(await until(() => wid.evaluate(() => !!document.querySelector('.raf.reveal')), 12000), 'stream reveals the winner after the case and the reel');
    const pos = await wid.evaluate(() => { const m = document.querySelector('.rf-mark').getBoundingClientRect(), c = document.querySelector('.rf-card.win').getBoundingClientRect(); return [m.left, c.left, c.right]; });
    check(pos[0] > pos[1] && pos[0] < pos[2], 'the marker stops on the winning card');
    check((await wid.textContent('.rf-res')).includes(r.winner), 'winner name shown');
    const first = r.winner;
    await irc(first, 'я тут'); await sleep(150);
    check(await mod.evaluate(() => state.els.find(e => e.type === 'raffle').ok), 'winner confirmed by writing in chat');
    await mod.click('#rSpin'); r = await mod.evaluate(() => state.els.find(e => e.type === 'raffle'));
    check(r.winner !== first && r.winners.includes(first), 'next winner: previous one drops out');
    const second = r.winner;
    check(await until(async () => (await mod.evaluate(() => state.els.find(e => e.type === 'raffle').winner)) !== second, 16000), 'no reply in time → spins again without them');
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => e.type !== 'raffle'); selectedId = null; commit(); });
  });

  await step('own fonts: dropped onto the stage, stored in Hudini Host, same line height as the built-in font', async () => {
    await mod.click('[data-tab=add]'); await mod.fill('#newText', 'Шрифт 123'); await mod.click('#addText');
    const box = () => wid.evaluate(() => [...document.querySelectorAll('.el')].find(n => n.textContent.includes('Шрифт 123'))?.querySelector('.content')?.getBoundingClientRect().height);
    check(await until(box), 'text on stream');
    const mont = await until(() => wid.evaluate(() => document.fonts.check('900 20px Montserrat')), 8000);
    await sleep(300); const h0 = await box();
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
    const G = (players, phase, round) => ({ provider:{ steamid:'999' }, map:{ name:'de_nuke', round, team_ct:{ score:1 }, team_t:{ score:2 } }, round:{ phase }, player:{ steamid:'90', name:'a1', team:'CT', state:{ health:100 } }, allplayers:players });
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

  await step('scenes: save and restore the screen', async () => {
    mod.removeAllListeners('dialog'); mod.on('dialog', d => d.accept('Начало'));
    await mod.click('[data-tab=scenes]'); await mod.click('#sceneSave');
    const n = await mod.evaluate(() => state.els.length);
    await mod.click('#clearAll'); await mod.click('.scene');
    eq(await mod.evaluate(() => state.els.length), n, 'scene brings the elements back');
    check(await until(async () => (await wid.$$eval('.el', x => x.length)) >= n), 'widget shows the scene');
  });

  await step('password vault and encrypted backup', async () => {
    const answers = ['secret123', 'secret123', 'bk-pass-1'];
    mod.removeAllListeners('dialog'); mod.on('dialog', d => d.type() === 'prompt' ? d.accept(answers.shift() ?? '') : d.accept());
    await mod.click('#passBtn');
    check(await until(() => mod.evaluate(() => !!JSON.parse(localStorage.getItem('overlay.vault2')).locked)), 'vault locked');
    check(!(await mod.evaluate(() => localStorage.getItem('overlay.vault2').includes('"d"'))), 'no private key in clear');
    check(await mod.evaluate(() => !localStorage.getItem('overlay.vault2').includes(curRoom().home?.pass || 'zzz')), 'Host password is inside the encrypted vault too');
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

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
