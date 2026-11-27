// Is the stream live? The OBS widget asks OBS (window.obsstudio) and says it in its heartbeat; the Host reports it in
// /api/status as live: on | unknown | off, and asks for a confirmation before a restart. Only this computer can say it.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

// The object OBS gives a browser source. level 0: the source has no permission to read OBS, getStatus stays silent
function fakeObs(o){
  window.__obs = { streaming: o.streaming, recording: o.recording };
  window.obsstudio = { getStatus(cb){ if(o.level) setTimeout(() => cb({ ...window.__obs }), 5); } };
  window.__obsEvent = name => window.dispatchEvent(new CustomEvent(name));
}

(async () => {
  const host = T.startHost({ OVERLAY_SITE: 'off' }); await host.ready();
  const status = () => host.api('/api/status');
  const live = async want => !!(await until(async () => (await status()).live === want, 8000, 100));
  const link = (await status()).obsLink;
  async function widget(obs){
    const p = await T.newPage('widget', { w: 1280, h: 720 });
    if(obs) await p.addInitScript(fakeObs, obs);
    await p.goto(link);
    await until(async () => (await status()).obsOnline, 8000);
    return p;
  }
  // a widget that is gone stops counting after a few seconds
  const gone = async p => { await p.context().close(); return !!(await until(async () => (await status()).live === 'off', 15000, 300)); };

  await step('no widget: off', async () => {
    eq((await status()).live, 'off', 'nothing connected');
  });

  await step('a widget outside OBS does not know', async () => {
    const p = await widget(null);
    check(await live('unknown'), 'unknown');
    check(await gone(p), 'closed: off again');
  });

  await step('OBS with the default permission: the status, then the events at once; recording is not streaming', async () => {
    const p = await widget({ level: 1, streaming: false, recording: true });
    check(await live('off'), 'recording only: off');
    await p.evaluate(() => { window.__obs.streaming = true; __obsEvent('obsStreamingStarted'); });
    check(!!(await until(async () => (await status()).live === 'on', 1500, 50)), 'started: known without waiting for the next heartbeat');
    await p.evaluate(() => { window.__obs.streaming = false; __obsEvent('obsStreamingStopped'); });
    check(!!(await until(async () => (await status()).live === 'off', 1500, 50)), 'stopped');
    await p.evaluate(() => { window.__obs.streaming = true; });
    check(await live('on'), 'a missed event: the regular question to OBS finds out');
    await p.reload();
    check(await live('on') || await live('off'), 'reloaded');
    await p.context().close();
  });

  await step('OBS without the permission: unknown until an event says otherwise', async () => {
    await until(async () => (await status()).live === 'off', 15000, 300);
    const p = await widget({ level: 0, streaming: true });
    check(await live('unknown'), 'getStatus stays silent: unknown');
    await p.evaluate(() => __obsEvent('obsStreamingStarted'));
    check(await live('on'), 'the event is enough');
    await p.evaluate(() => __obsEvent('obsStreamingStopped'));
    check(await live('off'), 'and the end');
    check(await gone(p), 'closed');
  });

  await step('two widgets: one that is live wins, one that knows beats one that does not', async () => {
    const a = T.fakeWidget(host.port, link, null), b = T.fakeWidget(host.port, link, false);
    await sleep(1500);
    eq((await status()).live, 'off', 'known off and unknown: off');
    const c = T.fakeWidget(host.port, link, true);
    check(await live('on'), 'one live: on');
    for(const w of [a, b, c]) w.stop();
    check(!!(await until(async () => (await status()).live === 'off', 15000, 300)), 'all gone');
    const old = T.fakeWidget(host.port, link, undefined);
    check(await live('unknown'), 'an older widget without the field: unknown');
    old.stop();
  });

  await step('a moderator cannot say the stream is live', async () => {
    await until(async () => (await status()).live === 'off', 15000, 300);
    const mqtt = require('mqtt'), crypto = require('crypto');
    const code = (await host.code()).data, u = new URL(link);
    const key = Buffer.from(new URLSearchParams(u.hash.slice(1)).get('k'), 'base64url');
    const iv = crypto.randomBytes(12), box = crypto.createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([box.update(JSON.stringify({ id: 'mod', live: true })), box.final(), box.getAuthTag()]);
    const m = mqtt.connect(`wss://127.0.0.1:${host.modPort}/mqtt`, { username: 'mod', password: code.pass, rejectUnauthorized: false, reconnectPeriod: 0 });
    check(!!(await until(() => m.connected, 5000)), 'connected as a moderator');
    m.publish(`stream-overlay/v1/${u.searchParams.get('room')}/hb`, Buffer.concat([Buffer.from([1, 0]), iv, body]), { qos: 0 });
    await sleep(1000);
    const s = await status();
    eq([s.live, s.obsOnline], ['off', false], 'ignored');
    m.end(true);
  });

  await host.stop(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
