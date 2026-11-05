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
    const t1 = await wid.$eval('.sb-time', x => x.textContent); await sleep(2100); const t2 = await wid.$eval('.sb-time', x => x.textContent);
    check(t1 !== t2, `bomb timer ticks ${t1} → ${t2}`);
    check((await mod.$eval('#iCsView option[value=teams]', o => o.textContent)).startsWith('α'), 'observer views carry the α mark');
  });

  await step('editor: multi-select, align, group, undo', async () => {
    await mod.evaluate(() => { beginChange(); state.els = []; commit(); });
    for(const t of ['А', 'Б', 'В']){ await mod.fill('#newText', t); await mod.click('#addText'); }
    await mod.evaluate(() => { [[20, 30], [50, 60], [75, 45]].forEach(([x, y], i) => { state.els[i].x = x; state.els[i].y = y; }); changed(); });
    await mod.keyboard.press('Escape'); await mod.click('#stage', { position: { x: 3, y: 3 } });
    await mod.keyboard.press('Control+KeyA');
    eq(await mod.evaluate(() => msel.size), 3, 'Ctrl+A selects all');
    await mod.click('[data-align="t"]');
    const tops = await mod.evaluate(() => state.els.map(e => Math.round(boxOf(e.id).t * 10)));
    check(new Set(tops).size === 1, 'align top: same top edge ' + tops);
    await mod.click('#tGroup');
    check(await mod.evaluate(() => new Set(state.els.map(e => e.g)).size === 1 && !!state.els[0].g), 'grouped');
    await mod.click('#undoBtn');
    check(await mod.evaluate(() => state.els.every(e => !e.g)), 'undo removes the group');
    check(await mod.$$eval('.lvl', n => n.length) >= 8, 'β/α marks present on beta features');
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
