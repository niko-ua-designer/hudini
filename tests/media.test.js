// Camera, screen and microphone (client side): capture, WebRTC with host candidates only, the fallback through the Host's /media socket,
// the stream layer, the panel background, permissions and sealed signaling.
//
// These tests run the real panels and the real widget against a small stand-in for the Host: an MQTT broker over WebSocket plus a /media relay
// with the same first-message login. The stand-in applies none of the Host's policy; what depends on the real Host is listed at the end of the file.
'use strict';
const http = require('http');
const T = require('./lib');
const { WebSocketServer, Server } = require('ws');
const { step, check, eq, until, sleep } = T;
// screenshots go where HUDINI_TEST_SHOTS points (the project's temp folder), else the system temp folder
const shot = n => require('path').join(process.env.HUDINI_TEST_SHOTS || require('os').tmpdir(), n + '.png');
const WSS = WebSocketServer || Server;

T.extraArgs.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Entire screen');

// ---------- stand-in Host ----------
async function stubHost(port){
  const { Aedes } = await import('aedes');
  const { createWebSocketStream } = require('ws');
  const aedes = await Aedes.createBroker();
  const stats = { rtc: [], media: 0, mediaSocks: 0, auth: [], types: new Set() };
  const srv = http.createServer((q, r) => { r.setHeader('access-control-allow-origin', '*'); r.setHeader('access-control-allow-headers', '*'); r.statusCode = q.method === 'OPTIONS' ? 204 : 404; r.end(); });
  const mqttWss = new WSS({ noServer: true, handleProtocols: p => (p.has ? (p.has('mqtt') ? 'mqtt' : false) : p.includes?.('mqtt') ? 'mqtt' : false) });
  const mediaWss = new WSS({ noServer: true, maxPayload: 1 << 20 });
  const bySid = new Map();
  aedes.on('publish', (pkt, c) => { if(c && pkt.topic.endsWith('/rtc')) stats.rtc.push(Buffer.from(pkt.payload)); });
  srv.on('upgrade', (req, sock, head) => {
    const u = new URL(req.url, 'http://x');
    if(u.pathname === '/mqtt') return mqttWss.handleUpgrade(req, sock, head, ws => aedes.handle(createWebSocketStream(ws), req));
    if(u.pathname === '/media' && /^[A-Za-z0-9_-]{8,32}$/.test(u.searchParams.get('sid') || '')) return mediaWss.handleUpgrade(req, sock, head, ws => {
      const sid = u.searchParams.get('sid'); stats.mediaSocks++;
      if(!bySid.has(sid)) bySid.set(sid, new Set()); bySid.get(sid).add(ws);
      ws.on('message', (d, bin) => {
        if(typeof d === 'string'){ stats.auth.push(d); ws._authed = true; return; }   // the stand-in takes every login
        stats.media++; stats.types.add(d[0]);
        for(const o of bySid.get(sid)) if(o !== ws && o.readyState === 1 && o._authed) o.send(d, { binary: true });
      });
      ws.on('close', () => bySid.get(sid)?.delete(ws));
    });
    sock.destroy();
  });
  await new Promise(r => srv.listen(port, r));
  return { aedes, stats, port, async close(){ for(const s of bySid.values()) for(const w of s) w.terminate(); await new Promise(r => aedes.close(r)); srv.close(); } };
}

(async () => {
  const web = await T.webServer();
  const stub = await stubHost(T.PORTS.host);
  const brokerUrl = `ws://127.0.0.1:${stub.port}/mqtt`;
  const panel = await T.newPage('panel');          // the streamer's panel
  await panel.goto(`${web.url}/panel/moderator.html`);
  await panel.waitForFunction(() => window.hudiniReady && typeof room === 'string' && !!KEYS && !!window.hudiniBroadcast, null, { timeout: 20000 });
  const R = await panel.evaluate(() => { const r = curRoom(); return { code: r.code, k: r.k, p: r.p, s: r.s }; });
  await panel.evaluate(u => { document.body.classList.add('streamer-panel'); openHome({ url: u, pass: 'x', user: 'streamer' }); }, brokerUrl);
  check(await until(() => panel.evaluate(() => !!client?.connected)), 'the streamer panel is connected to the stand-in Host');

  const mod = await T.newPage('panel2');           // a moderator's panel
  await mod.goto(`${web.url}/panel/moderator.html`);
  await mod.waitForFunction(() => window.hudiniReady && !!KEYS && !!window.hudiniBroadcast, null, { timeout: 20000 });
  await mod.evaluate(async r => { rooms.push(cleanRoom({ code: r.code, name: 'T', k: r.k, p: r.p, s: r.s })); saveRooms(); await switchRoom(r.code); }, R);
  await mod.evaluate(u => openHome({ url: u, pass: 'x', user: 'mod' }), brokerUrl);
  check(await until(() => mod.evaluate(() => !!client?.connected && room !== null)), 'the moderator panel is connected');
  const modCid = await mod.evaluate(() => client.options.clientId);

  // the Host's sealed messages, made the way the real Host does it
  const hostPub = async (topic, obj, retain) => {
    const arr = await panel.evaluate(async o => Array.from(await sealJSON(KEYS, o, false)), obj);
    await new Promise(r => stub.aedes.publish({ cmd: 'publish', topic: `stream-overlay/v1/${R.code}/${topic}`, payload: Buffer.from(arr), qos: retain ? 1 : 0, retain: !!retain, dup: false }, r));
  };
  const allOn = { av: true, web: true, fx: true, games: true, cam: true, screen: true, mic: true };
  const setPerms = o => hostPub('perms', { t: Date.now(), ...o }, true);
  const widgetUrl = () => `http://localhost:${T.PORTS.web}/widget/widget.html?room=${R.code}&broker=${encodeURIComponent(`ws://localhost:${stub.port}/mqtt`)}#k=${R.k}&p=${R.p}`;
  let wid = await T.newPage('widget', { w: 1920, h: 1080 });
  await wid.goto(widgetUrl());
  check(await until(() => panel.evaluate(() => [...widgets.values()].length > 0)), 'the widget is online in the panel');

  // the streamer's layer of a kind in the widget
  const vid = (kind = 'cam', owner = 'streamer') => wid.evaluate(([k, o]) => { const n = [...nodes.values()].find(x => x._el.kind === k && x._el.owner === o); const v = n?.querySelector('video'); return v ? { w: v.videoWidth, t: v.currentTime, so: !!v.srcObject, src: (v.getAttribute('src') || '').slice(0, 5), muted: v.muted, vol: v.volume, clip: v.style.clipPath, vis: getComputedStyle(n).visibility } : null; }, [kind, owner]);
  const alive = async (kind = 'cam', owner = 'streamer') => { const a = await vid(kind, owner); await sleep(700); const b = await vid(kind, owner); return !!a && !!b && b.w > 0 && b.t > a.t; };
  const edit = (page, kind, patch, owner = 'streamer') => page.evaluate(([k, p, o]) => { const e = state.els.find(x => x.type === 'stream' && x.kind === k && x.owner === o); beginChange(); for(const key of Object.keys(p)) { if(p[key] === null) delete e[key]; else e[key] = p[key]; } commit(); }, [kind, patch, owner]);

  // ---------- pure functions ----------
  await step('wire format and sanitizers (pure)', async () => {
    const r = await panel.evaluate(async () => {
      const M = HudiniMedia, sealed = new Uint8Array(40).fill(1), head = { v: 1, sid: 'abcdefghij12', kind: 'cam', t: 'have', to: 'widget' };
      const f = M.wrapRtc(head, sealed), u = M.unwrapRtc(f);
      const base = { t: 'have', kind: 'cam', sid: 'abcdefghij12', from: 'mod_x', to: '*' };
      const bad = h => { try{ M.wrapRtc(h, sealed); return false; }catch{ return true; } };
      const withTo = to => { const h = new TextEncoder().encode(JSON.stringify({ v: 1, sid: 'abcdefghij12', kind: 'cam', t: 'have', to })); const o = new Uint8Array(2 + h.length + 40); o[0] = h.length >> 8; o[1] = h.length & 255; o.set(h, 2); o.set(sealed, 2 + h.length); return M.unwrapRtc(o); };
      return {
        round: u && u.head.kind === 'cam' && u.head.sid === 'abcdefghij12' && u.head.to === 'widget' && u.body.length === 40 && f[0] * 256 + f[1] === f.length - 2 - 40,
        badHead: bad({ ...head, kind: 'tv' }) && bad({ ...head, sid: 'x' }) && bad({ ...head, t: 'eval' }),
        badLen: M.unwrapRtc(new Uint8Array(80)) === null,
        toOk: !!withTo('m:mod_abc.1') && !!withTo('streamer') && !!withTo('*'), toBad: withTo('wi dget') === null && withTo('evil') === null && withTo('m:') === null,
        ok: !!M.cleanRtc(base),
        badT: M.cleanRtc({ ...base, t: 'eval' }), badKind2: M.cleanRtc({ ...base, kind: 'tv' }), badFrom: M.cleanRtc({ ...base, from: '<b>' }), badTo2: M.cleanRtc({ ...base, to: 'a b' }),
        badSid2: M.cleanRtc({ ...base, sid: '../../x' }),
        noAddr: M.cleanRtc({ ...base, t: 'want' }), withAddr: !!M.cleanRtc({ ...base, t: 'want', a: 'm:mod_abc' }), badAddr: M.cleanRtc({ ...base, t: 'want', a: 'evil' }),
        sdpStrip: M.cleanSdp('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=candidate:1 1 udp 1 203.0.113.9 5000 typ host\r\na=end-of-candidates\r\n').includes('203.0.113.9'),
        sdpBig: M.cleanSdp('v=0\r\n' + 'a=x\r\n'.repeat(20000)), sdpNo: M.cleanSdp('hello'), sdpMany: M.cleanSdp('v=0\r\nm=a\r\nm=a\r\nm=a\r\nm=a\r\nm=a\r\n'),
        pub: M.candOk('candidate:1 1 udp 2113937151 203.0.113.9 5000 typ host generation 0'),
        priv: M.candOk('candidate:1 1 udp 2113937151 192.168.1.5 5000 typ host generation 0'),
        vpn: M.candOk('candidate:1 1 udp 2113937151 100.101.102.103 5000 typ host generation 0'),
        mdns: M.candOk('candidate:1 1 udp 2113937151 d7ebbf0d-390f-410b-8d93-c31450d61dd5.local 5000 typ host generation 0'),
        loop: M.candOk('candidate:1 1 udp 2113937151 127.0.0.1 5000 typ host generation 0'),
        srflx: M.candOk('candidate:1 1 udp 1 192.168.1.5 5000 typ srflx raddr 0.0.0.0 rport 0'),
        relay: M.candOk('candidate:1 1 udp 1 10.0.0.5 5000 typ relay'),
        junk: M.candOk('candidate:evil <script>'),
        v6pub: M.candOk('candidate:1 1 udp 1 2001:db8::1 5000 typ host'), v6ula: M.candOk('candidate:1 1 udp 1 fd12:3456::1 5000 typ host'),
        cand: M.cleanRtc({ t: 'ice', kind: 'cam', sid: 'abcdefghij12', from: 'a', to: 'b', cand: { candidate: 'candidate:1 1 udp 1 8.8.8.8 5000 typ host' } }),
      };
    });
    check(r.round && r.badHead && r.badLen, 'header [u16][json][sealed]: round trip; bad kind, sid, type and length refused');
    check(r.toOk && r.toBad, 'header "to": widget, streamer, m:<id> and * pass; anything else is refused');
    check(r.ok && r.badT === null && r.badKind2 === null && r.badFrom === null && r.badTo2 === null && r.badSid2 === null, 'rtc body: unknown type, kind, odd ids refused');
    check(r.noAddr === null && r.withAddr && r.badAddr === null, 'a want/offer needs a valid Host address to answer to');
    check(!r.sdpStrip && r.sdpBig === null && r.sdpNo === null && r.sdpMany === null, 'SDP: candidates stripped, oversized/odd SDP refused');
    check(r.priv && r.vpn && r.mdns && r.loop && r.v6ula, 'candidates: LAN, VPN, loopback, mDNS, ULA allowed');
    check(!r.pub && !r.srflx && !r.relay && !r.junk && !r.v6pub && r.cand === null, 'candidates: public addresses, srflx/relay and junk dropped');
  });

  await step('stream element: sanitizeEl', async () => {
    const r = await panel.evaluate(() => ({
      ok: sanitizeEl({ id: 'a', type: 'stream', owner: 'mod_abc', kind: 'cam', x: 50, y: 50, w: 500, crop: [10, 0, 10, 0], sound: 1, vol: 5 }),
      noOwner: sanitizeEl({ id: 'a', type: 'stream', kind: 'cam' }), badOwner: sanitizeEl({ id: 'a', type: 'stream', owner: '<img onerror=1>', kind: 'cam' }),
      badKind: sanitizeEl({ id: 'a', type: 'stream', owner: 'x', kind: 'tv' }), objOwner: sanitizeEl({ id: 'a', type: 'stream', owner: { a: 1 }, kind: 'cam' }),
      longOwner: sanitizeEl({ id: 'a', type: 'stream', owner: 'x'.repeat(41), kind: 'cam' }),
    }));
    check(r.ok && r.ok.w === 200 && r.ok.vol === 1 && r.ok.sound === true && r.ok.crop && r.ok.crop[0] === 10, 'valid element kept, numbers clamped, crop kept');
    check(!r.noOwner && !r.badOwner && !r.badKind && !r.objOwner && !r.longOwner, 'no owner, markup in owner, unknown kind, object or long owner: refused');
  });

  // ---------- the streamer's camera: WebRTC path ----------
  await step('the streamer shows the camera: frames arrive in the widget over WebRTC, no permission needed', async () => {
    await panel.click('#bcCam');
    check(await until(() => panel.evaluate(() => state.els.some(e => e.type === 'stream' && e.kind === 'cam' && e.owner === 'streamer'))), 'a camera layer owned by "streamer" was added');
    check(await until(() => alive(), 25000), 'frames play in the widget');
    const w = (await vid()).w;
    check(w >= 320, 'video has a size: ' + w);
    check(await until(async () => (await panel.evaluate(() => hudiniBroadcast.hub.info('streamer', 'cam')))?.path === 'direct', 10000), 'the panel reports the direct path');
    check(stub.stats.media === 0, 'nothing went through /media on the direct path');
    const txt = await panel.evaluate(() => document.querySelector('#bcList .bcp')?.textContent);
    check(/прямое|direct/.test(txt || ''), 'the path and latency are shown: ' + txt);
    check(await panel.evaluate(() => { const v = document.querySelector('.el[data-type="stream"] video'); return !!v && !!v.srcObject && v.muted; }), 'the panel preview shows the local picture, muted');
    check(!stub.stats.rtc.some(b => b.includes(Buffer.from('v=0'))), 'signaling on the wire is sealed (no SDP in the clear)');
    check(stub.stats.rtc.every(b => { const n = b[0] * 256 + b[1]; const h = JSON.parse(b.subarray(2, 2 + n).toString()); return h.v === 1 && /^[A-Za-z0-9_-]{8,32}$/.test(h.sid) && ['cam', 'screen', 'mic'].includes(h.kind) && n <= 300; }), 'every message carries the open header the Host reads');
    await panel.screenshot({ path: shot('media-panel') }).catch(() => {});
  });

  await step('crop: the layer is clipped like any image', async () => {
    await edit(panel, 'cam', { crop: [10, 20, 30, 5] });
    check(await until(async () => /inset\(20% 30% 5% 10%\)/.test((await vid())?.clip || '')), 'the widget clips the picture: ' + (await vid())?.clip);
    check(await panel.evaluate(() => /inset/.test(document.querySelector('.el[data-type="stream"] video').style.clipPath)), 'the panel clips the picture too');
    await edit(panel, 'cam', { crop: null });
  });

  await step('hiding the layer releases the stream; showing it brings the picture back', async () => {
    await edit(panel, 'cam', { hidden: true });
    check(await until(async () => { const v = await vid(); return v && !v.so; }, 8000), 'a hidden layer drops the stream');
    await edit(panel, 'cam', { hidden: false });
    check(await until(() => alive(), 25000), 'the picture returns');
  });

  // ---------- a moderator's camera and the permissions ----------
  await step('a moderator: the buttons are off until the streamer allows (default off)', async () => {
    check(await mod.evaluate(() => $('bcCam').disabled && $('bcScreen').disabled && $('bcMic').disabled), 'all three buttons are disabled');
    check((await mod.evaluate(() => $('bcCam').title)).length > 0, 'the button says the streamer has not allowed it');
    check(await mod.evaluate(() => hudiniPermOff({ type: 'stream', kind: 'cam', owner: 'x' }) === true && hudiniPermOff({ type: 'stream', kind: 'cam', owner: 'streamer' }) === false), 'hudiniPermOff: stream layers are off by default, the streamer\'s own is not');
    await setPerms({ av: true, web: true, fx: true, games: true, cam: false, screen: false, mic: false });
    await sleep(600);
    check(await mod.evaluate(() => $('bcCam').disabled), 'still disabled when the Host sends cam:false');
  });

  let modOwner = '';
  await step('a moderator shares the camera after the Host allows it; the widget needs PERMS.cam', async () => {
    const blocked = await wid.evaluate(() => blockedEl({ type: 'stream', kind: 'cam', owner: 'mod_x', id: 'z' }) && !blockedEl({ type: 'stream', kind: 'cam', owner: 'streamer', id: 'z' }));
    check(blocked, 'widget: a moderator\'s stream is blocked by default, the streamer\'s own is not');
    await setPerms(allOn);
    check(await until(() => mod.evaluate(() => !$('bcCam').disabled)), 'with the permission the button is on');
    await mod.click('#bcCam');
    modOwner = await mod.evaluate(() => hudiniBroadcast.hub.id);
    check(modOwner && modOwner !== 'streamer', 'the moderator is known by his own id: ' + modOwner);
    check(await until(() => mod.evaluate(() => state.els.some(e => e.type === 'stream' && e.kind === 'cam' && e.owner !== 'streamer'))), 'the moderator\'s layer was added');
    check(await until(() => wid.evaluate(o => [...nodes.values()].some(n => n._el.owner === o), modOwner)), 'the layer reached the widget');
    check(await until(() => alive('cam', modOwner), 25000), 'the moderator\'s camera plays in the widget');
  });

  await step('permission taken back: the moderator\'s capture stops and the picture disappears', async () => {
    await setPerms({ ...allOn, cam: false });
    check(await until(() => mod.evaluate(() => !hudiniBroadcast.hub.local('cam')), 8000), 'the capture is stopped on the moderator\'s side');
    check(await mod.evaluate(() => $('bcCam').disabled), 'and the button is off');
    check(await until(async () => { const v = await vid('cam', modOwner); return !v || !v.so; }, 8000), 'the widget shows nothing of it');
    check(await until(() => wid.evaluate(() => [...media.recvs.values()].filter(e => e.owner !== 'streamer').length === 0), 8000), 'no receiver for the moderator is left in the widget');
    check(await alive(), 'the streamer\'s own camera keeps running');
    await setPerms(allOn);
  });

  await step('the Host\'s answers reach the moderator: pending, ok, no (topic media)', async () => {
    await mod.click('#bcMic');
    check(await until(() => mod.evaluate(() => !!hudiniBroadcast.hub.local('mic'))), 'the moderator shares the microphone');
    await hostPub('media', { ev: 'pending', cid: modCid, kind: 'mic', t: Date.now() });
    check(await until(() => mod.evaluate(() => hudiniBroadcast.hub.info(hudiniBroadcast.hub.id, 'mic')?.path === 'pending')), 'pending: "waiting for the streamer"');
    await hostPub('media', { ev: 'ok', cid: modCid, kind: 'mic', t: Date.now() });
    check(await until(() => mod.evaluate(() => hudiniBroadcast.hub.info(hudiniBroadcast.hub.id, 'mic')?.path !== 'pending')), 'ok: the offers go out again');
    await hostPub('media', { ev: 'no', cid: 'someone_else', kind: 'mic', why: 'denied', t: Date.now() });
    await sleep(600);
    check(await mod.evaluate(() => !!hudiniBroadcast.hub.local('mic')), 'a message for another moderator is ignored');
    await hostPub('media', { ev: 'no', cid: modCid, kind: 'mic', why: 'denied', t: Date.now() });
    check(await until(() => mod.evaluate(() => !hudiniBroadcast.hub.local('mic'))), 'no: the capture is stopped');
  });

  await step('security: forged signaling does not get on stream', async () => {
    const before = await wid.evaluate(() => media.recvs.size);
    await panel.evaluate(async () => {
      const mk = async (t, kind, extra, keys, sign, headKind, sid) => {
        const sd = sid || 'zzzzzzzzzzzz';
        const b = await seal(keys, TE.encode(JSON.stringify({ t, kind, sid: sd, from: 'mod_stranger', a: 'm:mod_stranger', to: '*', ...extra })), sign);
        return HudiniMedia.wrapRtc({ v: 1, sid: sd, kind: headKind || kind, t }, b);
      };
      const pub = b => client.publish(topics(room).base + '/rtc', b, { qos: 0 });
      const other = await importRoomKeys(await newRoomKeys());
      const sdp = 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
      pub(await mk('have', 'screen', {}, KEYS, false));                                      // unsigned: not from a panel
      pub(await mk('offer', 'screen', { sdp }, KEYS, false));
      pub(await mk('have', 'screen', {}, other, true));                                        // sealed with another room key
      pub(await mk('have', 'screen', {}, KEYS, true, 'cam'));                                  // the header says another kind than the body
      pub(await mk('offer', 'cam', { sdp }, KEYS, true));                                      // signed, but no layer names this owner
      pub(await mk('offer', 'cam', { sdp }, KEYS, true, 'cam', 'qqqqqqqqqqqq'));
      pub(new Uint8Array(200).fill(7));                                                        // garbage
      pub(new Uint8Array([0, 5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));         // a header that is not JSON
    });
    await sleep(1500);
    check((await wid.evaluate(() => media.recvs.size)) === before, 'the widget receives nothing new: ' + before);
    check(await alive(), 'the real picture is not disturbed');
    // an unsigned `bye` that is not from the Host does not cut a stream; one from the Host does
    const sid = await wid.evaluate(() => [...media.recvs.values()].find(e => e.kind === 'cam')?.sid);
    await panel.evaluate(async sid => {
      const b = await seal(KEYS, TE.encode(JSON.stringify({ t: 'bye', kind: 'cam', sid, from: 'mod_x', to: '*' })), false);
      client.publish(topics(room).base + '/rtc', HudiniMedia.wrapRtc({ v: 1, sid, kind: 'cam', t: 'bye', to: '*' }, b), { qos: 0 });
    }, sid);
    await sleep(800);
    check((await wid.evaluate(() => media.recvs.size)) === before, 'an unsigned bye from a non-Host does not end the stream');
    await panel.evaluate(async sid => {
      const b = await seal(KEYS, TE.encode(JSON.stringify({ t: 'bye', sid, kind: 'cam', from: 'host', why: 'test', ts: Date.now() })), false);
      client.publish(topics(room).base + '/rtc', HudiniMedia.wrapRtc({ v: 1, sid, kind: 'cam', t: 'bye', to: '*' }, b), { qos: 0 });
    }, sid);
    check(await until(() => wid.evaluate(s => ![...media.recvs.values()].some(e => e.sid === s), sid), 5000), 'a bye from the Host ends it at once');
    // the same Host message also reaches the sender (it is the dock's "stop"): the capture ends, and the streamer can start again
    check(await until(() => panel.evaluate(() => !hudiniBroadcast.hub.local('cam')), 5000), 'a bye from the Host on our own sid stops the capture');
    await panel.click('#bcCam');
    check(await until(() => alive(), 25000), 'the streamer starts again and the picture returns');
  });

  // ---------- the microphone ----------
  await step('microphone: a sound-only layer with volume and mute', async () => {
    await panel.click('#bcMic');
    check(await until(() => panel.evaluate(() => state.els.some(e => e.type === 'stream' && e.kind === 'mic'))), 'a microphone layer was added');
    check(await until(async () => (await vid('mic'))?.so, 25000), 'the widget plays the microphone');
    const a = await vid('mic');
    check(a.vis === 'hidden', 'the microphone layer has no picture');
    check(a.muted === false, 'sound on by default for the microphone');
    await edit(panel, 'mic', { vol: 0.4 });
    check(await until(async () => Math.abs((await vid('mic')).vol - 0.4) < 0.02), 'volume follows the layer');
    await edit(panel, 'mic', { sound: false });
    check(await until(async () => (await vid('mic')).muted), 'mute follows the layer');
    check(await panel.evaluate(() => [...document.querySelectorAll('.el[data-kind="mic"] video')].every(v => v.muted)), 'the panel never plays the microphone back');
    check(await panel.evaluate(() => [...document.querySelectorAll('#mixer .mxn')].some(n => /Микрофон/.test(n.textContent))), 'the microphone is in the mixer');
    await panel.click('#bcMic');
    check(await panel.evaluate(() => !hudiniBroadcast.hub.local('mic')), 'stopping the microphone ends the capture');
  });

  // ---------- the screen ----------
  await step('screen share', async () => {
    await panel.click('#bcScreen');
    check(await until(() => panel.evaluate(() => state.els.some(e => e.type === 'stream' && e.kind === 'screen'))), 'a screen layer was added');
    check(await until(async () => (await vid('screen'))?.w > 0, 25000), 'the screen arrives in the widget');
    await panel.click('#bcScreen');
  });

  // ---------- path 2 ----------
  await step('path 2 (forced, as when UDP is blocked): sealed pieces through /media', async () => {
    await wid.close();
    wid = await T.newPage('widget', { w: 1920, h: 1080 });
    await wid.addInitScript(() => { window.__hudiniForceP2 = true; });
    const media0 = stub.stats.media, auth0 = stub.stats.auth.length;
    await wid.goto(widgetUrl());
    check(await until(async () => { const v = await vid(); return v && v.w > 0 && v.src === 'blob:'; }, 30000), 'the picture plays through MediaSource: ' + JSON.stringify(await vid()));
    check(await until(() => alive(), 10000), 'and keeps moving');
    check(await until(() => stub.stats.media > media0 + 5, 6000), 'pieces went through /media: ' + (stub.stats.media - media0));
    check(stub.stats.types.has(0) && stub.stats.types.has(1) && ![...stub.stats.types].some(t => t > 2), 'frame types: 0 = stream header, then 1');
    const logins = stub.stats.auth.slice(auth0).map(x => { try{ return JSON.parse(x); }catch{ return null; } });
    check(logins.some(l => l?.u === 'widget') && logins.some(l => l?.u === 'streamer' && typeof l.p === 'string'), 'the first message on /media is the login: widget and streamer: ' + JSON.stringify(logins.map(l => l && l.u)));
    check(await until(async () => ['host', 'both'].includes((await panel.evaluate(() => hudiniBroadcast.hub.info('streamer', 'cam')))?.path), 8000), 'the panel reports the path through the Host');
    const ms = await wid.evaluate(() => [...media.recvs.values()].map(e => e.ms));
    check(ms.length >= 1 && ms[0] != null && ms[0] < 3000, 'latency measured: ' + ms);
    await panel.screenshot({ path: shot('media-panel-p2') }).catch(() => {});
    await wid.screenshot({ path: shot('media-widget-p2') }).catch(() => {});
  });

  await step('path 2: the Host sees only sealed bytes; forged pieces are ignored', async () => {
    const WebSocket = require('ws');
    const sid = await panel.evaluate(() => hudiniBroadcast.hub.local('cam').sid);
    const frames = [];
    const ws = new WebSocket(`ws://127.0.0.1:${stub.port}/media?sid=${sid}`);
    await new Promise(r => ws.on('open', r));
    ws.send(JSON.stringify({ u: 'widget' }));
    ws.on('message', d => frames.push(Buffer.from(d)));
    await sleep(1800);
    ws.close();
    check(frames.length > 0, 'a listener on the Host gets the pieces');
    check(frames.every(f => f[0] <= 2 && f[1] === 1 && !f.includes(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))), 'every piece is [type][sealed, signed] with no WebM bytes in the clear');
    check(frames.every(f => f.length <= 1 << 20), 'pieces stay under 1 MB');
    const before = await vid();
    const ws2 = new WebSocket(`ws://127.0.0.1:${stub.port}/media?sid=${sid}`);
    await new Promise(r => ws2.on('open', r));
    ws2.send(JSON.stringify({ u: 'widget' }));
    ws2.send(Buffer.concat([Buffer.from([1]), Buffer.alloc(300, 9)]), { binary: true });
    ws2.send(Buffer.concat([Buffer.from([0]), Buffer.alloc(300, 9)]), { binary: true });
    await sleep(800); ws2.close();
    check((await vid()).w === before.w, 'forged pieces do not break the picture');
  });

  await step('when the sender stops, path 2 ends too', async () => {
    await panel.evaluate(() => hudiniBroadcast.hub.stopKind('cam'));
    check(await until(async () => { const v = await vid(); return v && !v.so && v.src !== 'blob:'; }, 12000), 'the widget drops the stream');
    check(await until(() => wid.evaluate(() => media.recvs.size === 0), 12000), 'no receiver is left');
  });

  // ---------- falling back from path 1 to path 2 by timeout ----------
  await step('ICE fails (host candidates blocked): after 5 s the picture comes through the Host', async () => {
    await panel.click('#bcCam');
    await wid.close();
    wid = await T.newPage('widget', { w: 1920, h: 1080 });
    // no candidates at all on the widget's side (relay-only without a relay), so ICE cannot come up
    await wid.addInitScript(() => { const R = window.RTCPeerConnection; window.RTCPeerConnection = function(c){ return new R({ ...c, iceTransportPolicy: 'relay' }); }; window.RTCPeerConnection.prototype = R.prototype; });
    const t0 = Date.now();
    await wid.goto(widgetUrl());
    check(await until(async () => { const v = await vid(); return v && v.w > 0 && v.src === 'blob:'; }, 35000), 'the picture comes through MediaSource');
    check(Date.now() - t0 >= 4000, 'not before the 5 s wait: ' + (Date.now() - t0) + ' ms');
  });

  // ---------- the panel background ----------
  await step('the streamer\'s screen as a backdrop in a moderator\'s panel', async () => {
    check(await mod.evaluate(() => $('bcBgShareRow').hidden), 'a moderator has no "share my screen as a backdrop" box');
    check(await panel.evaluate(() => !$('bcBgShareRow').hidden), 'the streamer has it');
    await panel.click('#bcScreen');
    check(await until(() => panel.evaluate(() => !!hudiniBroadcast.hub.local('screen'))), 'the streamer shares the screen');
    await sleep(4500);
    check(await mod.evaluate(() => $('streamBg').hidden), 'no backdrop while the streamer has not allowed it');
    await panel.evaluate(() => { $('bcBgShare').checked = true; $('bcBgShare').dispatchEvent(new Event('change')); });
    check(await until(() => mod.evaluate(() => { const v = $('streamBg'); return !v.hidden && v.videoWidth > 0; }), 30000), 'the backdrop shows the streamer\'s screen');
    await mod.screenshot({ path: shot('media-bg') }).catch(() => {});
    await mod.evaluate(() => { $('bcBgView').checked = false; $('bcBgView').dispatchEvent(new Event('change')); });
    check(await until(() => mod.evaluate(() => $('streamBg').hidden), 5000), 'the moderator can switch the backdrop off for himself');
    check(await mod.evaluate(() => ![...hudiniBroadcast.hub.recvs.values()].some(e => e.purpose === 'bg')), 'and no separate backdrop stream is kept (the layer\'s own stream serves it when there is one)');
    await panel.evaluate(() => { $('bcBgShare').checked = false; $('bcBgShare').dispatchEvent(new Event('change')); });
  });

  // Not checked here (needs the real Host, see media-host.test.js): authorizePublish for `rtc` against the header, the dock confirmation,
  // the limits of /media, the real first-message login.

  await web.close(); await stub.close(); await T.closeBrowser();
  const code = T.finish();
  process.exit(code);
})().catch(e => { console.error(e); process.exit(1); });
