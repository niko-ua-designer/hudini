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
    await put([{ id: 'tx1', type: 'text', text: 'всегда' }, { id: 'im1', type: 'image', src: 'https://example.com/a.png' }, { id: 'po1', type: 'poll', title: 'Карта?', opts: ['A', 'B'] }, { id: 'vi1', type: 'video', src: 'https://example.com/a.mp4' }]);
    const s = await until(async () => { const s = await shown(); return s.tx1 && s.im1 && s.po1 && s.vi1 && s; });
    check(s, 'all four are on stream: ' + JSON.stringify(await shown()));
    eq((await host.api('/api/status')).perms, { av: true, web: true, fx: true, games: true }, 'everything is allowed by default');
  });

  await step('«Кейсы, розыгрыши, опросы, CS2» off: the poll leaves the stream, the panel hides the tiles', async () => {
    const r = await perms({ games: false });
    eq(r.perms.games, false, 'saved');
    check(await until(async () => { const s = await shown(); return !s.po1 && s.tx1 && s.im1; }), 'poll is hidden on stream, the rest stays: ' + JSON.stringify(await shown()));
    check(await until(() => panel.evaluate(() => document.querySelector('[data-add="poll"]').classList.contains('perm-off') && document.querySelector('[data-add="case"]').classList.contains('perm-off'))), 'poll and case tiles are hidden in the panel');
    check(/кейсы, розыгрыши, опросы, CS2/.test(await panel.textContent('#permNote')), 'the panel says what the streamer turned off: ' + await panel.textContent('#permNote'));
    check(await panel.evaluate(() => nodes.get('po1').classList.contains('host-off') && !nodes.get('tx1').classList.contains('host-off')), 'the poll on the panel canvas is marked');
    const cfgFile = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8'));
    eq(cfgFile.perms.games, false, 'kept in the Host settings');
    check(/Права модераторов: кейсы, розыгрыши, опросы, CS2 — нельзя/.test(host.log()), 'the change is in the log');
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
    check(/Стример выключил на стриме: чат/.test(host.log()), 'logged');
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

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
