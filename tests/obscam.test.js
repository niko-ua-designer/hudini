// OBS Virtual Camera as the moderators' backdrop, against the real Hudini Host: the streamer panel (opened by its one-time key),
// a moderator's panel and the widget. The camera is a Chromium fake device; the third one is renamed to "OBS Virtual Camera"
// (the second fake device gives depth frames, which WebRTC does not encode).
// HUDINI_TEST_LANG=en|uk|de runs the panels in that language; HUDINI_TEST_SHOTS=<folder> keeps the screenshots.
'use strict';
const path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const LANG = process.env.HUDINI_TEST_LANG || 'ru';
const shot = n => path.join(process.env.HUDINI_TEST_SHOTS || require('os').tmpdir(), `obscam-${n}-${LANG}.png`);

T.extraArgs.push('--use-fake-device-for-media-stream=device-count=3', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Entire screen');

(async () => {
  const web = await T.webServer();
  const PORT = T.PORTS.host + 70;
  const host = T.startHost({ OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', OVERLAY_PANEL_ORIGIN: web.url });
  await host.ready();
  await host.api('/api/ui', { tourDone: true });
  const code = (await host.code()).data;
  const st = await host.api('/api/status');
  const online = p => until(async () => (await p.getAttribute('#status', 'class')).includes('ok'), 15000);

  const widget = await T.newPage('widget', { w: 1920, h: 1080 });
  await widget.goto(st.obsLink);
  const mod = await T.newPage('mod', { lang: LANG });
  await mod.addInitScript(sess => { if(!localStorage.getItem('fake.seeded')){ const s = JSON.parse(localStorage.getItem('fake.store') || '{}'); s['app.sessions'] = [sess]; localStorage.setItem('fake.store', JSON.stringify(s)); localStorage.setItem('fake.seeded', '1'); } },
    { id: code.room, name: 'etsuitoku', pass: code.pass, fp: code.fp, addrs: [{ h: '127.0.0.1', port: host.modPort, net: 'lan' }], k: code.k, p: code.p, s: code.s, pinned: false, added: Date.now(), last: 0, lastNet: '' });
  await mod.goto(`${web.url}/panel/moderator.html?session=${code.room}`);
  await online(mod);

  const sp = await T.newPage('streamer', { app: false, lang: LANG });
  // the third fake camera is called "OBS Virtual Camera" while test.obs is set
  await sp.addInitScript(() => {
    const md = navigator.mediaDevices; if(!md) return;   // about:blank
    const real = md.enumerateDevices.bind(md);
    md.enumerateDevices = async () => (await real()).map(d => d.kind === 'videoinput' && d.label === 'fake_device_2' && localStorage.getItem('test.obs')
      ? { kind: d.kind, deviceId: d.deviceId, groupId: d.groupId, label: 'OBS Virtual Camera' } : d);
  });
  const openStreamer = async () => {
    const k = await host.api('/api/streamer/open', {});
    await sp.goto('about:blank');
    await sp.goto(`${k.url}?streamer=1#hk=${k.key}&port=${k.port}`);
    check(await online(sp), 'the streamer panel is online');
    await sp.waitForFunction(() => !!window.hudiniBroadcast);
  };
  const tr = (p, s) => p.evaluate(s => HudiniI18n.t(s), s);
  const picture = async (p, n, id = 'bcBgCamState') => { await p.evaluate(id => $(id).scrollIntoView({ block: 'center' }), id); await p.screenshot({ path: shot(n) }); };
  const text = (p, sel) => p.evaluate(s => document.querySelector(s).textContent, sel);
  const back = () => sp.evaluate(() => { const s = hudiniBroadcast.hub?.backdrop(); return s ? { sid: s.sid, label: s.stream.getVideoTracks()[0].label, peers: [...s.peers.values()].map(p => p.addr), p2: s.p2peers.size, path: hudiniBroadcast.hub.backdropInfo().path } : null; });
  // the moderator's backdrop: which stream, by which road, how big the picture is
  const bg = () => mod.evaluate(() => { const h = hudiniBroadcast.hub, r = h?.bgFor(), v = $('streamBg'); return { shown: !v.hidden && v.videoWidth > 0, w: v.videoWidth, h: v.videoHeight, t: v.currentTime, sid: r?.entry.sid || '', path: r?.entry.path || '', src: (v.getAttribute('src') || '').slice(0, 5), muted: v.muted,
    live: $('stage').classList.contains('live-bg'), twitch: getComputedStyle($('bgLayer')).visibility }; });
  const moving = async () => { const a = await bg(); return !!(await until(async () => { const b = await bg(); return b.shown && b.t > a.t + 0.3; }, 6000, 200)); };
  const setChk = (p, id, on) => p.evaluate(([id, on]) => { $(id).checked = on; $(id).dispatchEvent(new Event('change')); }, [id, on]);
  const layer = kind => widget.evaluate(k => { const n = [...nodes.values()].find(x => x._el.type === 'stream' && x._el.kind === k); const v = n?.querySelector('video'); const e = [...media.recvs.values()].find(x => x.kind === k); return v ? { w: v.videoWidth, sid: e?.sid || '' } : null; }, kind);

  await openStreamer();
  await mod.evaluate(u => applyBg(u), `${web.url}/panel/missing-preview.png`);   // the moderator's own preview (a screenshot link)

  await step('device names: OBS Virtual Camera is recognised; nothing else is picked by itself', async () => {
    const r = await sp.evaluate(() => {
      const M = HudiniMedia, cam = (id, label) => ({ id, label }), list = [cam('a', 'Logitech C920'), cam('b', 'OBS Virtual Camera')];
      return {
        yes: ['OBS Virtual Camera', 'OBS-Camera', 'OBS-Camera2', 'OBS Camera', 'OBS Virtual Camera (platform:v4l2loopback-000)', 'OBS VirtualCam'].filter(l => !M.isObsCam(l)),
        no: ['Logitech C920', 'OBSBOT Tiny 2', 'OBSBOT Virtual Camera', 'JOBS Camera', 'Obsidian Camera', 'Dummy video device (0x0000)', ''].filter(l => M.isObsCam(l)),
        auto: M.pickCamera(list, null)?.id, saved: M.pickCamera(list, { id: 'a', label: 'x' })?.id, byName: M.pickCamera(list, { id: 'old', label: 'Logitech C920' })?.id,
        gone: M.pickCamera(list, { id: 'old', label: 'old' })?.id, none: M.pickCamera([cam('a', 'Logitech C920')], null),
      };
    });
    eq([r.yes, r.no], [[], []], 'OBS names match, others do not');
    eq([r.auto, r.saved, r.byName, r.gone, r.none], ['b', 'a', 'a', 'b', null], 'saved choice by id, then by name, then OBS, else nothing');
  });

  await step('names hidden before the permission: the camera is opened only when asked, then closed', async () => {
    const r = await sp.evaluate(async () => {
      const md = navigator.mediaDevices, en = md.enumerateDevices, gum = md.getUserMedia; let allowed = false, asked = 0, track = null;
      md.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: allowed ? 'id1' : '', label: allowed ? 'OBS Virtual Camera' : '' }];
      md.getUserMedia = async () => { asked++; allowed = true; const c = document.createElement('canvas'); c.getContext('2d'); const s = c.captureStream(); track = s.getVideoTracks()[0]; return s; };
      try{
        const quiet = await HudiniMedia.cameras(), quietAsked = asked, got = await HudiniMedia.cameras({ ask: true }), ended = track.readyState;
        allowed = false; md.getUserMedia = async () => { throw new DOMException('no', 'NotAllowedError'); };
        const denied = await HudiniMedia.cameras({ ask: true });
        return { quiet, quietAsked, got, asked, ended, denied: { n: denied.list.length, hidden: denied.hidden, err: denied.error?.name } };
      }finally{ md.enumerateDevices = en; md.getUserMedia = gum; }
    });
    eq([r.quietAsked, r.quiet.list.length, r.quiet.hidden], [0, 0, true], 'without a click nothing is opened');
    eq([r.asked, r.got.list.map(d => d.label), r.got.hidden, r.ended], [1, ['OBS Virtual Camera'], false, 'ended'], 'asked once, names read, the probe is closed');
    eq(r.denied, { n: 0, hidden: true, err: 'NotAllowedError' }, 'a refusal is reported');
  });

  await step('the source choice belongs to the streamer panel alone', async () => {
    check(await until(() => sp.evaluate(() => !$('bcBack').hidden && $('bcBgSrc').value === 'screen' && !$('bcBgShareRow').hidden && $('bcBgCamBox').hidden && $('bcBgViewRow').hidden)), 'streamer: source choice, screen by default with its box');
    check(await mod.evaluate(() => $('bcBack').hidden && $('bcBgShareRow').hidden && !$('bcBgViewRow').hidden && $('bcBgView').checked), 'moderator: only his own "show backdrop" box');
  });

  await step('camera source without OBS: a hint, nothing is picked or shared', async () => {
    await sp.selectOption('#bcBgSrc', 'cam');
    const hint = await tr(sp, 'OBS Virtual Camera не найдена: нажми в OBS «Запустить виртуальную камеру» или выбери другую камеру.');
    check(await until(async () => await text(sp, '#bcBgCamState') === hint), 'the hint says what to do in OBS: ' + await text(sp, '#bcBgCamState'));
    await picture(sp, '1-streamer-notfound');
    check(await sp.evaluate(() => $('bcBgShareRow').hidden && !$('bcBgCamBox').hidden && $('bcBgCam').value === '' && $('bcBgCam').options.length === 4), 'the cameras are listed, none is selected');
    await sp.click('#bcBgCamGo');
    await sleep(1200);
    eq(await back(), null, 'no camera was opened');
  });

  await step('OBS Virtual Camera appears: preselected, one click, the moderator gets it', async () => {
    await sp.evaluate(() => { localStorage.setItem('test.obs', '1'); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
    check(await until(() => sp.evaluate(() => $('bcBgCam').selectedOptions[0]?.textContent === 'OBS Virtual Camera')), 'preselected');
    await picture(sp, '2-streamer-ready');
    // every rtc message the widget receives
    await widget.evaluate(() => { window.__rtc = []; const real = media.onPacket; media.onPacket = b => { const h = HudiniMedia.unwrapRtc(b)?.head; if(h) __rtc.push(h); return real(b); }; });
    await sp.click('#bcBgCamGo');
    check(await until(async () => (await bg()).shown, 20000), 'the picture is under the moderator\'s canvas');
    check(await moving(), 'and it moves');
    const t0 = Date.now();   // WebRTC starts small and grows to the full size in a few seconds
    check(await until(async () => (await bg()).w === 1280, 30000), `the full 720p picture (${Date.now() - t0} ms after the first frame)`);
    const s = await back(), m = await bg();
    eq(s.label, 'fake_device_2', 'the chosen device was opened');
    check(m.sid === s.sid && m.muted && m.h === 720, `muted: ${m.w}x${m.h}`);
    check(await until(async () => (await back()).path === 'direct' && (await bg()).path === 'direct', 15000), 'by the direct path');
    check(m.live && (await bg()).twitch === 'hidden', 'the moderator\'s Twitch / screenshot preview steps aside');
    eq(await sp.evaluate(() => [state.els.filter(e => e.type === 'stream').length, document.querySelectorAll('#bcList .bcrow').length, !!hudiniBroadcast.hub.local('screen'), !!hudiniBroadcast.hub.local('cam')]), [0, 0, false, false], 'no layer, no layer row, no layer source');
    check(await until(async () => (await text(sp, '#bcBgCamState')).includes(await tr(sp, 'прямое'))), 'the streamer sees the path: ' + await text(sp, '#bcBgCamState'));
    await picture(sp, '3-streamer-on');
    await picture(mod, '4-moderator', 'bcBgViewRow');
  });

  await step('the widget gets nothing of the backdrop, even when it asks', async () => {
    const s = await back();
    await sp.evaluate(() => { window.__wants = 0; const h = hudiniBroadcast.hub, real = h.onPacket; h.onPacket = async b => { const x = HudiniMedia.unwrapRtc(b)?.head; await real(b); if(x?.t === 'want' && x.from === 'widget') window.__wants++; }; });
    await widget.evaluate(async ([port, keys, room, sid]) => {
      const K = await importRoomKeys(keys), c = mqtt.connect(`ws://localhost:${port}/mqtt`, { reconnectPeriod: 0 });
      await new Promise(r => c.on('connect', r));
      for(const w of [{ sid: 'evilwant0001', owner: '', bg: true }, { sid: 'evilwant0002', owner: 'streamer', bg: false }, { sid, owner: 'streamer', bg: true, p2: true }, { sid, owner: '', bg: false, p2: true }]){
        const body = await seal(K, TE.encode(JSON.stringify({ t: 'want', kind: 'screen', from: 'wid_probe', a: 'widget', to: '*', ...w })), false);
        c.publish(`stream-overlay/v1/${room}/rtc`, HudiniMedia.wrapRtc({ v: 1, sid: w.sid, kind: 'screen', t: 'want' }, body), { qos: 0 });
      }
      await new Promise(r => setTimeout(r, 500)); c.end(true);
    }, [PORT, { k: code.k, p: code.p, s: code.s }, code.room, s.sid]);
    check(await until(() => sp.evaluate(() => window.__wants >= 4), 5000), 'the streamer panel has read the four requests');
    await sleep(4500);   // longer than the pause between two `have`
    const after = await back();
    check(after.peers.every(a => a.startsWith('m:')) && after.p2 === 0, 'only moderators are connected: ' + after.peers.join());
    check(await widget.evaluate(sid => !__rtc.some(h => h.sid === sid && (h.t === 'have' || h.to === 'widget')) && media.recvs.size === 0, s.sid), 'no `have`, no offer, no receiver in the widget');
  });

  await step('the webcam and screen layers run at the same time', async () => {
    const s = await back();
    await sp.click('#bcCam');
    check(await until(async () => (await layer('cam'))?.w > 0, 25000), 'the webcam layer plays in the widget');
    await sp.click('#bcScreen');
    check(await until(async () => (await layer('screen'))?.w > 0, 25000), 'the screen layer plays in the widget');
    eq((await back())?.sid, s.sid, 'the backdrop was not restarted');
    check((await layer('screen')).sid !== s.sid && (await layer('cam')).sid !== s.sid, 'the layers are other streams');
    await sleep(8000);
    check(await moving() && (await bg()).sid === s.sid, 'the moderator keeps the camera as the backdrop beside the screen layer');
    check(await mod.evaluate(() => [...document.querySelectorAll('.el[data-type="stream"] video')].filter(v => v.videoWidth > 0).length === 2), 'and sees both layers');
    eq(await sp.evaluate(() => [...document.querySelectorAll('#bcList .bcrow')].map(r => r.dataset.kind)), ['cam', 'screen'], 'two layer rows');
    await sp.click('#bcCam');
    check(await sp.evaluate(() => !hudiniBroadcast.hub.local('cam') && !!hudiniBroadcast.hub.backdrop()), 'stopping the webcam leaves the backdrop');
  });

  await step('the moderator\'s own "show backdrop" box', async () => {
    await setChk(mod, 'bcBgView', false);
    check(await until(async () => { const m = await bg(); return !m.shown && !m.live && m.twitch === 'visible'; }, 5000), 'off: the preview under it is back');
    check(await mod.evaluate(() => ![...hudiniBroadcast.hub.recvs.values()].some(e => e.purpose === 'bg')), 'no backdrop stream is received');
    await setChk(mod, 'bcBgView', true);
    check(await until(async () => (await bg()).shown, 20000), 'on: the camera is back');
  });

  await step('switching the source to the screen and back', async () => {
    await setChk(sp, 'bcBgShare', true);   // the box is hidden while the camera is the source; its value waits
    await sleep(500);
    eq(await sp.evaluate(() => hudiniBroadcast.hub.local('screen').bg), true, 'sanity: the box drives the shared screen');
    await sp.evaluate(() => hudiniBroadcast.hub.setBg(hudiniBroadcast.hub.local('screen').sid, false));
    await sp.selectOption('#bcBgSrc', 'screen');
    eq(await back(), null, 'the camera is closed');
    const screen = await sp.evaluate(() => hudiniBroadcast.hub.local('screen').sid);
    let t = Date.now();
    check(await until(async () => { const m = await bg(); return m.shown && m.sid === screen; }, 20000), `the screen is the backdrop (${Date.now() - t} ms)`);
    await picture(sp, '5-streamer-screen', 'bcBgShareRow');
    await sp.selectOption('#bcBgSrc', 'cam');
    eq(await sp.evaluate(() => hudiniBroadcast.hub.local('screen').bg), false, 'the screen stays on stream, but is no backdrop');
    check(await until(async () => !(await bg()).shown, 8000), 'the moderator drops the screen backdrop at once');
    t = Date.now();
    await sp.click('#bcBgCamGo');
    check(await until(async () => { const m = await bg(), s = await back(); return m.shown && s && m.sid === s.sid; }, 20000), `the camera is the backdrop again (${Date.now() - t} ms)`);
    check((await layer('screen'))?.w > 0, 'the screen layer is still on stream');
    await sp.click('#bcScreen');
  });

  await step('the choice is remembered; nothing starts by itself', async () => {
    await openStreamer();
    check(await until(() => sp.evaluate(() => !$('bcBack').hidden && $('bcBgSrc').value === 'cam' && $('bcBgCam').selectedOptions[0]?.textContent === 'OBS Virtual Camera')), 'source and device are back');
    await sleep(1500);
    eq(await back(), null, 'the camera is not opened until the click');
    check(await until(async () => !(await bg()).shown, 20000), 'the moderator has dropped the old picture');
    await sp.click('#bcBgCamGo');
    check(await until(async () => (await bg()).shown, 20000), 'one click brings it back');
  });

  await step('the road through the Host', async () => {
    await setChk(mod, 'bcBgView', false);
    await sleep(500);
    await mod.evaluate(() => { window.__hudiniForceP2 = true; });
    // the old link of this moderator is dropped by the sender when the new request arrives and the old one is not connected
    await sp.click('#bcBgCamGo'); await sp.click('#bcBgCamGo');
    check(await until(async () => !!(await back()), 8000), 'restarted');
    await setChk(mod, 'bcBgView', true);
    check(await until(async () => { const m = await bg(); return m.shown && m.src === 'blob:' && m.path === 'host'; }, 30000), 'sealed pieces over /media, played through MediaSource');
    check(await moving(), 'and it moves');
    check(await until(async () => (await back()).path === 'host', 8000), 'the streamer panel reports the road through the Host');
    eq(await widget.evaluate(() => media.recvs.size), 0, 'the widget still receives nothing');
    await mod.evaluate(() => { window.__hudiniForceP2 = false; });
  });

  await step('stop, and a camera that disappears', async () => {
    await sp.click('#bcBgCamGo');
    check(await until(async () => { const m = await bg(); return !m.shown && !m.live && m.twitch === 'visible'; }, 8000), 'stop: the moderator is back on his preview at once');
    await sp.click('#bcBgCamGo');
    check(await until(async () => (await bg()).shown, 20000), 'started again');
    await sp.evaluate(() => { const t = hudiniBroadcast.hub.backdrop().stream.getVideoTracks()[0]; t.stop(); t.dispatchEvent(new Event('ended')); });
    const offer = (await tr(sp, '▶ Показать модераторам')).replace('▶ ', '');   // the sign becomes an icon
    check(await until(async () => !(await back()) && (await text(sp, '#bcBgCamGo')).trim() === offer, 5000), 'the track ended: the button offers to start again');
    check(await until(async () => !(await bg()).shown, 8000), 'the moderator lets go');
    if(LANG !== 'ru'){
      const words = p => p.evaluate(() => [$('bcBack'), $('bcBgViewRow'), $('bcBgShareRow')].map(b => b.textContent + [...b.querySelectorAll('[title]')].map(e => e.title).join(' ')).join(' '));
      const left = (await words(sp) + ' ' + await words(mod)).match(/[^<>]*[А-Яа-яЁё][^<>]*/g);
      eq(left, null, 'no Russian text left in either panel');
    }
  });

  await host.stop(); await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
