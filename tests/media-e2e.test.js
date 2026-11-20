// Camera, screen and microphone against the real Hudini Host: a moderator's panel, the widget and the Host's rules together
// (permission off by default, the streamer's approval in the dock, the direct path, the path through the Host's /media, revoke).
// It needs a Host that has the media server (server/server.js with the `rtc` topic and /media) and that serves shared/media.js to the widget.
// Run it with HUDINI_TEST_SERVER_DIR pointing at such a Host build; without it the file only prints a note and passes.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
// screenshots go where HUDINI_TEST_SHOTS points (the project's temp folder), else the system temp folder
const shot = n => require('path').join(process.env.HUDINI_TEST_SHOTS || require('os').tmpdir(), n + '.png');

if(!process.env.HUDINI_TEST_SERVER_DIR && !require('fs').readFileSync(require('path').join(__dirname, '../server/server.js'), 'utf8').includes("'rtc'")){
  console.log('skipped: this Host has no media server yet (set HUDINI_TEST_SERVER_DIR to a build that has)');
  process.exit(0);
}
T.extraArgs.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Entire screen');

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel, host } = S;
  let wid = S.widget;
  const perms = p => host.api('/api/perms', { perms: p });
  const dock = async () => (await (await fetch(`http://localhost:${host.port}/api/status`)).json()).media;   // what the dock in OBS sees
  const owner = () => panel.evaluate(() => hudiniBroadcast.hub.id);
  const vid = o => wid.evaluate(o => { const n = [...nodes.values()].find(x => x._el.type === 'stream' && x._el.owner === o); const v = n?.querySelector('video'); return v ? { w: v.videoWidth, t: v.currentTime, so: !!v.srcObject, src: (v.getAttribute('src') || '').slice(0, 5) } : null; }, o);
  const alive = async o => { const a = await vid(o); await sleep(700); const b = await vid(o); return !!a && !!b && b.w > 0 && b.t > a.t; };

  await step('off by default: the moderator\'s buttons are disabled', async () => {
    eq((await host.api('/api/status')).perms.cam, false, 'the Host reports cam off');
    check(await until(() => panel.evaluate(() => $('bcCam').disabled && $('bcScreen').disabled && $('bcMic').disabled)), 'the three buttons are disabled in the panel');
  });

  await step('permission on: the moderator asks, the streamer approves in the dock, the picture reaches the widget', async () => {
    await perms({ cam: true });
    check(await until(() => panel.evaluate(() => !$('bcCam').disabled)), 'the button is on');
    await panel.click('#bcCam');
    const o = await owner();
    check(await until(async () => (await dock()).pending.length === 1, 10000), 'the request is in the dock');
    check(await until(() => panel.evaluate(() => hudiniBroadcast.hub.info(hudiniBroadcast.hub.id, 'cam')?.path === 'pending')), 'the panel says it waits for the streamer');
    check(!(await vid(o))?.so, 'nothing on the widget before the answer');
    const d = await dock();
    await host.api('/api/control', { action: 'mediaallow', key: d.pending[0].key });
    check(await until(() => alive(o), 30000), 'after the approval the camera plays in the widget');
    check(await until(async () => (await panel.evaluate(() => hudiniBroadcast.hub.info(hudiniBroadcast.hub.id, 'cam')))?.path === 'direct', 15000), 'by the direct path');
    check((await dock()).live.some(s => s.kind === 'cam' && s.own === 'mod'), 'the dock lists the broadcast');
    await panel.screenshot({ path: shot('media-e2e-panel') }).catch(() => {});
    await wid.screenshot({ path: shot('media-e2e-widget') }).catch(() => {});
  });

  await step('the Host\'s "stop" in the dock ends it at once and blocks asking again for a minute', async () => {
    const o = await owner();
    const live = (await dock()).live.find(s => s.kind === 'cam');
    await host.api('/api/control', { action: 'mediastop', key: live.sid });
    check(await until(() => panel.evaluate(() => !hudiniBroadcast.hub.local('cam')), 8000), 'the moderator\'s capture stops');
    check(await until(async () => { const v = await vid(o); return !v || !v.so; }, 8000), 'the widget drops the picture');
    await panel.click('#bcCam');
    await sleep(1500);
    check((await dock()).pending.length === 0, 'asking again right away does not reach the dock');
    check(await until(() => panel.evaluate(() => !hudiniBroadcast.hub.local('cam')), 8000), 'and the moderator is told no');
  });

  await step('the path through the Host: sealed pieces over /media, moderator login', async () => {
    // a fresh start: allow again through a new request after the refusal window is gone is slow; use the microphone, a kind not refused
    await perms({ cam: true, mic: true });
    await wid.close();
    const u = new URL(S.obsLink); u.searchParams.set('p2', '1');
    wid = await T.newPage('widget', { w: 1920, h: 1080 });
    await wid.goto(u.href);
    await panel.click('#bcMic');
    const o = await owner();
    check(await until(async () => (await dock()).pending.some(p => p.kind === 'mic'), 10000), 'the microphone request is in the dock');
    await host.api('/api/control', { action: 'mediaallow', key: (await dock()).pending.find(p => p.kind === 'mic').key });
    check(await until(() => wid.evaluate(o => { const n = [...nodes.values()].find(x => x._el.owner === o && x._el.kind === 'mic'); const v = n?.querySelector('video'); return !!v && (v.getAttribute('src') || '').startsWith('blob:'); }, o), 30000), 'the widget plays through MediaSource');
    check(await until(async () => ((await dock()).live.find(s => s.kind === 'mic')?.viewers || 0) >= 1, 8000), 'the dock sees a viewer on the Host road');
    check(await until(async () => (await panel.evaluate(() => hudiniBroadcast.hub.info(hudiniBroadcast.hub.id, 'mic')))?.path === 'host', 8000), 'the panel reports the road through the Host');
  });

  await step('permission taken back: the Host ends the broadcast, the client stops', async () => {
    await perms({ cam: true, mic: false });
    check(await until(() => panel.evaluate(() => !hudiniBroadcast.hub.local('mic')), 8000), 'the moderator\'s microphone stops');
    check(await until(() => wid.evaluate(() => media.recvs.size === 0), 8000), 'the widget lets go');
    check(await panel.evaluate(() => $('bcMic').disabled), 'and the button is off');
  });

  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
