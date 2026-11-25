// Стример решает сам: права модераторов (настройки Hudini Host), быстрые выключатели и глазики в доке OBS.
// Главная защита на стороне стримера: виджет не показывает запрещённое, что бы ни прислал пульт.
'use strict';
const fs = require('fs'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel, widget, host } = S;
  // opacity of each widget node by element id ('' while it fades in)
  const shown = () => widget.evaluate(() => Object.fromEntries([...nodes].map(([id, n]) => [id, n.style.opacity !== '0'])));
  const put = els => panel.evaluate(els => { for(const e of els){ const x = sanitizeEl(e); if(x) state.els.push(x); } renderAll(); publishNow(1); }, els);
  const perms = p => host.api('/api/perms', { perms: p });

  await step('setup: text, picture, poll and video on the screen', async () => {
    await put([{ id: 'tx1', type: 'text', text: 'всегда' }, { id: 'im1', type: 'image', src: 'https://example.com/a.png' }, { id: 'po1', type: 'poll', title: 'Карта?', opts: ['A', 'B'] }, { id: 'vi1', type: 'video', src: 'https://example.com/a.mp4' }, { id: 'ro1', type: 'roulette' }]);
    const s = await until(async () => { const s = await shown(); return s.tx1 && s.im1 && s.po1 && s.vi1 && s; });
    check(s, 'all four are on stream: ' + JSON.stringify(await shown()));
    eq((await host.api('/api/status')).perms, { av: true, web: true, fx: true, games: true, cam: false, screen: false, mic: false }, 'everything is allowed by default, except camera, screen and microphone');
  });

  await step('«Кейсы, розыгрыши, опросы, CS2» off: the poll leaves the stream, the panel hides the tiles', async () => {
    const r = await perms({ games: false });
    eq(r.perms.games, false, 'saved');
    check(await until(async () => { const s = await shown(); return !s.po1 && s.tx1 && s.im1; }), 'poll is hidden on stream, the rest stays: ' + JSON.stringify(await shown()));
    check(await widget.evaluate(() => blockedEl({ id: 'ro1', type: 'roulette' })), 'the roulette is blocked while games are off');
    check(await widget.evaluate(() => nodes.get('ro1')?._el?.hidden === true), 'the roulette on stream is hidden (and silent)');
    check(await until(() => panel.evaluate(() => document.querySelector('[data-add="poll"]').classList.contains('perm-off') && document.querySelector('[data-tab="raffle"]').classList.contains('perm-off'))), 'poll tile and the giveaways tab are hidden in the panel');
    check(/кейсы, розыгрыши, опросы, CS2/.test(await panel.textContent('#permNote')), 'the panel says what the streamer turned off: ' + await panel.textContent('#permNote'));
    check(await panel.evaluate(() => nodes.get('po1').classList.contains('host-off') && !nodes.get('tx1').classList.contains('host-off')), 'the poll on the panel canvas is marked');
    const cfgFile = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8'));
    eq(cfgFile.perms.games, false, 'kept in the Host settings');
    check(/Moderator permissions: cases, giveaways, polls, CS2 — denied/.test(host.log()), 'the change is in the log');
  });

  await step('a moderator cannot publish the perms topic', async () => {
    // a second connection with the moderator's password (a rejected publish drops the connection)
    await panel.evaluate(async () => {
      const c = mqttClient(homeInfo.url, 'x', { username: 'mod', password: homeInfo.pass });
      await new Promise(r => c.on('connect', r));
      c.publish(topics(room).base + '/perms', await sealJSON(KEYS, { av: true, web: true, fx: true, games: true }, false), { qos: 0, retain: true });
      await new Promise(r => setTimeout(r, 300)); c.end(true);
    });
    await sleep(800);
    eq(await widget.evaluate(() => PERMS.games), false, 'widget still has games off');
    check(!(await shown()).po1, 'the poll stays hidden');
  });

  await step('«Сайты и файлы» off hides pictures; «Звуки и видео» off hides video and mutes sounds', async () => {
    await perms({ web: false, av: false });
    check(await until(async () => { const s = await shown(); return !s.im1 && !s.vi1 && s.tx1; }), 'picture and video are hidden');
    check(await until(() => panel.evaluate(() => document.getElementById('addUrl').closest('.row').classList.contains('perm-off') && document.getElementById('playSound').classList.contains('perm-off'))), 'link, file and sound buttons are hidden in the panel');
    await widget.evaluate(() => { window.__snd = 0; const A = window.Audio; window.Audio = function(...a){ window.__snd++; return new A(...a); }; });
    await panel.evaluate(() => sendFx({ type: 'sound', src: 'https://example.com/a.mp3', vol: 0.5 }));
    await sleep(800);
    eq(await widget.evaluate(() => window.__snd), 0, 'a sound from the panel does not play');
    await perms({ av: true });
    check(await until(async () => { await panel.evaluate(() => sendFx({ type: 'sound', src: 'https://example.com/a.mp3', vol: 0.5 })); return widget.evaluate(() => window.__snd > 0); }, 8000, 600), 'with sounds allowed again it plays');
    check(await until(async () => (await shown()).vi1), 'video is back');
  });

  await step('«Чат, рисование, эффекты» off: confetti and shake do not run', async () => {
    await perms({ fx: false });
    await panel.evaluate(() => sendFx({ type: 'confetti' }));
    await sleep(800);
    eq(await widget.evaluate(() => parts.length), 0, 'no confetti on stream');
    await perms({ fx: true });
    check(await until(async () => { await panel.evaluate(() => sendFx({ type: 'confetti' })); return widget.evaluate(() => parts.length > 0); }, 8000, 600), 'confetti runs when allowed');
  });

  await step('all back on: everything returns', async () => {
    await perms({ av: true, web: true, fx: true, games: true });
    check(await until(async () => { const s = await shown(); return s.tx1 && s.im1 && s.po1 && s.vi1; }), 'all four are on stream again');
    check(await until(() => panel.evaluate(() => !document.getElementById('permNote') && !document.querySelector('.perm-off'))), 'the panel shows every button again');
  });

  // the dock in OBS calls this from http://localhost:<port> without the management cookie
  const control = async body => { const r = await fetch(host.base + '/api/control', { method: 'POST', headers: { origin: host.base, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };

  await step('quick switches in the dock: chat and CS2-HUD off on stream right now', async () => {
    await put([{ id: 'ms1', type: 'msg', user: 'viewer', text: 'привет' }, { id: 'cs1', type: 'cs2', view: 'card' }]);
    check(await until(async () => { const s = await shown(); return s.ms1 && s.cs1; }), 'message and CS2 are on stream');
    const r = await control({ action: 'off', key: 'chat', on: true });
    eq([r.status, r.ctl?.off?.chat], [200, true], 'chat is switched off');
    await control({ action: 'off', key: 'cs2', on: true });
    check(await until(async () => { const s = await shown(); return !s.ms1 && !s.cs1 && s.tx1; }), 'message and CS2 leave the stream, text stays: ' + JSON.stringify(await shown()));
    check(await until(() => panel.evaluate(() => nodes.get('ms1').classList.contains('host-off') && /выключено на стриме/.test(nodes.get('cs1').textContent))), 'the panel marks them as off on stream');
    check(/Стример выключил на стриме: чат, CS2-HUD/.test(await panel.textContent('#permNote')), 'the panel says which switches are off: ' + await panel.textContent('#permNote'));
    eq(JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8')).ctlOff.chat, true, 'switches survive a restart (kept in the settings)');
    check(/Streamer turned off on stream: chat/.test(host.log()), 'logged');
    eq((await control({ action: 'off', key: 'evil', on: true })).status, 400, 'unknown switch → 400');
    const foreign = await fetch(host.base + '/api/control', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'off', key: 'fx', on: true }) });
    eq(foreign.status, 403, 'another site cannot flip a switch');
  });

  await step('quick switches: sounds and effects off', async () => {
    await control({ action: 'off', key: 'sound', on: true }); await control({ action: 'off', key: 'fx', on: true });
    await until(() => widget.evaluate(() => OFF.sound && OFF.fx));
    await until(() => widget.evaluate(() => parts.length === 0), 12000);   // confetti of the step above has fallen
    const before = await widget.evaluate(() => window.__snd);
    await panel.evaluate(() => { sendFx({ type: 'sound', src: 'https://example.com/b.mp3', vol: 0.5 }); sendFx({ type: 'confetti' }); });
    await sleep(1000);
    eq(await widget.evaluate(() => [window.__snd, parts.length]), [before, 0], 'no sound and no confetti');
    for(const key of ['chat', 'cs2', 'sound', 'fx']) await control({ action: 'off', key, on: false });
    check(await until(async () => { const s = await shown(); return s.ms1 && s.cs1; }), 'message and CS2 are back');
    check(await until(async () => { await panel.evaluate(() => sendFx({ type: 'sound', src: 'https://example.com/b.mp3', vol: 0.5 })); return widget.evaluate(b => window.__snd > b, before); }, 8000, 600), 'sounds play again');
    check(await until(() => panel.evaluate(() => !document.getElementById('permNote'))), 'the panel note is gone');
  });

  await step('the dock and the Host page cannot be put in a frame', async () => {
    for(const [base, p] of [[host.base, '/dock'], [host.admin, '/']]){
      const r = await fetch(base + p, { headers: { 'x-hudini-token': host.token } });
      eq(r.headers.get('x-frame-options'), 'DENY', p + ' x-frame-options');
      check(/frame-ancestors 'none'/.test(r.headers.get('content-security-policy') || ''), p + ' frame-ancestors');
    }
  });

  // ---------- the new OBS dock: tabs Статус / Элементы / Люди / CS2 ----------
  const dock = await T.newPage('dock', { w: 360, h: 640, app: false });
  await dock.goto(host.base + '/dock');
  const tab = async t => { await dock.click(`#tabs [data-tab="${t}"]`); };

  await step('dock: four tabs, status pills and the quick switches', async () => {
    eq(await dock.$$eval('#tabs button', b => b.map(x => x.textContent)), ['Статус', 'Элементы', 'Люди', 'CS2'], 'tabs as in the chosen design');
    check(await until(async () => /OBS видит оверлей/.test(await dock.textContent('#pills'))), 'status pills: ' + await dock.textContent('#pills'));
    eq(await dock.$$eval('#togs .sw', b => b.map(x => x.dataset.tog + ':' + x.classList.contains('on'))), ['chat:true', 'cs2:true', 'sound:true', 'draw:true', 'fx:true', 'tab:true'], 'six switches (with the CS2 auto tab), all on');
    await dock.click('#togs [data-tog="tab"]');
    check(await until(() => /Streamer turned off on stream: CS2 auto-tab/.test(host.log())), 'the auto tab switch is logged by its name');
    check(await until(() => panel.evaluate(() => !$('taOffNote').hidden)), 'the panel says the auto tab is off on stream');
    await dock.click('#togs [data-tog="tab"]');
    check(await until(() => panel.evaluate(() => $('taOffNote').hidden)), 'and that it is back');
    await dock.click('#togs [data-tog="chat"]');
    check(await until(async () => !(await shown()).ms1), 'the chat switch in the dock hides the message on stream');
    check(await until(() => dock.$eval('#togs [data-tog="chat"]', b => !b.classList.contains('on'))), 'the switch shows it is off');
    await dock.click('#togs [data-tog="chat"]');
    check(await until(async () => (await shown()).ms1), 'and brings it back');
  });

  await step('dock: elements with eyes; the eye hides on stream only', async () => {
    await tab('els');
    check(await until(async () => (await dock.textContent('#els')).includes('всегда')), 'the dock lists the screen: ' + await dock.textContent('#els'));
    const st = await fetch(host.base + '/api/status').then(r => r.json());
    check(st.els.every(e => JSON.stringify(Object.keys(e)) === '["id","type","name","hidden"]'), 'the status gives only id, type, name and hidden of each element');
    eq(st.els.find(e => e.id === 'im1')?.name, 'example.com', 'a picture is named by its site, without the full address');
    await dock.click('#els [data-eye="tx1"]');
    check(await until(async () => !(await shown()).tx1), 'the text is hidden on stream');
    eq(await panel.evaluate(() => byId('tx1').hidden), false, 'the moderators\' screen is not changed');
    check(await until(() => panel.evaluate(() => /скрыто стримером/.test(nodes.get('tx1').textContent))), 'the panel marks it as hidden by the streamer');
    await dock.click('#els [data-eye="tx1"]');
    check(await until(async () => (await shown()).tx1), 'the second click brings it back');
  });

  await step('dock: a big screen (over 16 KB, e.g. a drawing) is still listed', async () => {
    const strokes = Array.from({ length: 60 }, (_, i) => ({ id: 'stk' + String(i).padStart(4, '0'), tool: 'pen', color: '#ffffff', size: 6, t: 1, pts: Array.from({ length: 200 }, (_, j) => (i * 7 + j * 3) % 1000) }));
    await put([{ id: 'big1', type: 'text', text: 'большой экран' }, { id: 'pad0', type: 'draw', x: 50, y: 50, strokes, del: [], hidden: true }]);
    check(await panel.evaluate(() => JSON.stringify(state).length) > 20000, 'the screen is bigger than 16 KB');
    check(await until(async () => (await fetch(host.base + '/api/status').then(r => r.json())).els?.some(e => e.id === 'big1')), 'the dock sees the new element');
    await panel.evaluate(() => { state.els = state.els.filter(e => e.id !== 'big1' && !e.id.startsWith('pad')); renderAll(); publishNow(1); });
  });

  await step('dock: who is online, masked address, kick one moderator', async () => {
    await tab('ppl');
    const t = await until(async () => { const t = await dock.textContent('#ppl'); return /Модератор/.test(t) && t; });
    check(/127\.x\.x\.1/.test(t) && !/127\.0\.0\.1/.test(t), 'the moderator is listed with a masked address: ' + t);
    await dock.click('#ppl .kick');
    check(await until(() => /Streamer disconnected a moderator/.test(host.log())), 'kick is logged');
    check(await until(async () => (await panel.getAttribute('#status', 'class')).includes('ok'), 15000), 'the moderator can come back (kick is not a ban)');
  });

  await step('dock: CS2 score and the «Файт» hint over the tabs', async () => {
    const token = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8')).gsiToken;
    const gsi = { auth: { token }, provider: { steamid: '7' }, map: { name: 'de_mirage', phase: 'live', round: 4, team_ct: { score: 3 }, team_t: { score: 1 } }, player: { steamid: '7', name: 'etsu', team: 'CT', state: { health: 77 } } };
    eq((await fetch(host.base + '/gsi', { method: 'POST', body: JSON.stringify(gsi) })).status, 200, 'GSI packet accepted');
    await tab('cs2');
    const t = await until(async () => { const t = await dock.textContent('#cs2'); return /3:1/.test(t.replace(/\s/g, '')) && t; });
    check(t && /mirage/.test(t) && /etsu/.test(t) && /HP 77/.test(t), 'score, map and the player: ' + t);
    // the fight hint comes from CS2 (another part of the Host): here the status is faked to see the dock show it
    await dock.route('**/api/status', async r => { const res = await r.fetch(); const j = await res.json(); j.fight = { a: { slot: 3, name: 'SaiYeah' }, b: { slot: 7, name: 'gospoja' } }; await r.fulfill({ json: j }); });
    check(await until(async () => (await dock.isVisible('#fight')) && /Файт: 3 SaiYeah ↔ 7 gospoja/.test(await dock.textContent('#fight'))), 'the hint shows over the tabs: ' + await dock.textContent('#fight'));
    await tab('els');
    check(await dock.isVisible('#fight'), 'on any tab');
    await dock.unroute('**/api/status');
    check(await until(async () => !(await dock.isVisible('#fight'))), 'and goes away with the fight');
  });

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
