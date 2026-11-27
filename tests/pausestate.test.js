// Moderator pause as the moderator sees it: connected panels are told about the pause before they are closed, a panel opened
// during the pause shows it at once, "paused" is never replaced by "no connection" while the Host keeps answering that,
// and the panel comes back by itself.
'use strict';
const mqtt = require('mqtt');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const PAUSE = /паузу/;

// every text the status pill has had since the call
const watch = p => p.evaluate(() => { const el = document.getElementById('status'); window.__st = []; window.__stw?.disconnect();
  window.__stw = new MutationObserver(() => { if(window.__st.at(-1) !== el.textContent) window.__st.push(el.textContent); });
  window.__stw.observe(el, { childList: true, subtree: true, characterData: true }); });
const seen = p => p.evaluate(() => window.__st);
const status = p => p.textContent('#status');
const online = async p => (await p.getAttribute('#status', 'class')).includes('ok');

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel, host, web } = S;

  await step('a connected client is told about the pause before it is closed, even while it keeps sending', async () => {
    const { data } = await host.code();
    const key = await crypto.subtle.importKey('raw', Buffer.from(await panel.evaluate(() => curRoom().k), 'base64url'), 'AES-GCM', false, ['decrypt']);
    const open = async b => JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(2, 14) }, key, b.subarray(14))));
    const c = mqtt.connect(`wss://127.0.0.1:${host.modPort}/mqtt`, { username: 'mod', password: data.pass, reconnectPeriod: 0, rejectUnauthorized: false });
    const got = []; let closed = false;
    c.on('message', (t, m, p) => { if(t.endsWith('/host')) got.push({ m, live: !p.retain, closed }); });
    c.on('close', () => { closed = true; }); c.on('error', () => {});
    await new Promise(r => c.on('connect', r));
    await new Promise(r => c.subscribe(`stream-overlay/v1/${data.room}/host`, { qos: 1 }, r));
    const busy = setInterval(() => { if(c.connected) c.publish(`stream-overlay/v1/${data.room}/cur`, 'x'); }, 5);
    await host.api('/api/control', { action: 'pause' });
    const closedAtAnswer = await until(() => closed, 1500, 20);
    clearInterval(busy);
    const live = [];
    for(const x of got) if(x.live) live.push((await open(x.m)).paused);
    check(live.includes(true), 'it received "paused" while connected: ' + JSON.stringify(live));
    check(closedAtAnswer, 'and then it was disconnected');
    c.end(true);
    await host.api('/api/control', { action: 'resume' });
  });

  await step('a connected panel shows the pause and nothing else until it is lifted', async () => {
    check(await until(() => online(panel), 25000), 'online');
    await watch(panel);
    await host.api('/api/control', { action: 'pause' });
    check(await until(async () => PAUSE.test(await status(panel)), 3000), 'shows the pause: ' + await status(panel));
    await sleep(23000);   // long enough for an attempt to get back in
    const all = await seen(panel), from = all.findIndex(x => PAUSE.test(x));   // a delay reading may land before the pause does
    check(from >= 0, 'the pause was recorded');
    eq(all.slice(from).filter(x => !PAUSE.test(x)), [], 'no other state during the pause');
    check(await panel.isVisible('#connStrip') && PAUSE.test(await panel.textContent('#csHead')), 'the strip says why');
    await host.api('/api/control', { action: 'resume' });
    check(await until(() => online(panel), 25000), 'comes back by itself: ' + await status(panel));
    check(!(await panel.isVisible('#connStrip')), 'the strip is gone');
  });

  let late;
  await step('a panel opened during the pause shows it at once', async () => {
    const inv = await panel.evaluate(() => inviteLink(curRoom()));
    await host.api('/api/control', { action: 'pause' });
    late = await T.newPage('panel-late');
    await late.goto(inv);
    await late.waitForFunction(() => typeof curRoom === 'function' && curRoom());
    await T.attach(late, host);
    check(await until(async () => PAUSE.test(await status(late)), 3000), 'pause shown: ' + await status(late));
    await watch(late);
    await sleep(23000);
    eq((await seen(late)).filter(x => !PAUSE.test(x)), [], 'it stays through the retries');
  });

  await step('a wrong password after a pause has its own message', async () => {
    await host.api('/api/code/new', {});
    await host.api('/api/control', { action: 'resume' });
    check(await until(async () => /Неверный пароль/.test(await status(late)), 25000), 'wrong password: ' + await status(late));
    await T.attach(late, host);
    check(await until(() => online(late), 25000), 'the new code gets in');
  });

  await step('a Host that goes away during a pause is not shown as paused', async () => {
    await host.api('/api/control', { action: 'pause' });
    check(await until(async () => PAUSE.test(await status(late)), 3000), 'paused');
    await host.stop();
    check(await until(async () => !PAUSE.test(await status(late)), 25000), 'then: ' + await status(late));
  });

  await host.stop(); await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
