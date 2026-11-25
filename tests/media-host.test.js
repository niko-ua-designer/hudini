// Hudini Host as the media server (camera, screen, microphone): permissions off by default, enforced on the Host,
// the streamer's approval in the dock, the rtc topic and the WS /media fallback with limits, revoke. No browser:
// raw MQTT and WebSocket clients. The Host never decrypts any of it; the test seals bodies with the room key only to look like the real clients.
'use strict';
const fs = require('fs'), path = require('path');
const mqtt = require('mqtt'), WebSocket = require('ws');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

const PORT = 17950 + Number(process.env.HUDINI_TEST_PORT_OFFSET || 0), MPORT = PORT + 1;
const PANEL = 'http://localhost:5999';
const P = 'stream-overlay/v1';
const subtle = globalThis.crypto.subtle;

(async () => {
  const host = T.startHost({ OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', OVERLAY_PANEL_ORIGIN: PANEL });
  await host.ready();
  const code = (await host.code()).data, pass = code.pass, room = code.room;
  const base = `${P}/${room}`;
  const aes = await subtle.importKey('raw', Buffer.from(code.k, 'base64url'), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const seal = async obj => {
    const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, Buffer.from(JSON.stringify(obj))));
    return Buffer.concat([Buffer.from([1, 0]), iv, ct]);
  };
  const unseal = async buf => JSON.parse(Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(2, 14) }, aes, buf.subarray(14))).toString());
  const rtc = async (h, body = {}) => {
    const head = Buffer.from(JSON.stringify({ v: 1, ...h })), len = Buffer.alloc(2); len.writeUInt16BE(head.length);
    return Buffer.concat([len, head, await seal({ pad: 'x'.repeat(40), ...body })]);
  };
  const headOf = buf => JSON.parse(buf.subarray(2, 2 + buf.readUInt16BE(0)).toString());
  const connect = (url, o) => new Promise((res, rej) => { const c = mqtt.connect(url, { reconnectPeriod: 0, connectTimeout: 4000, rejectUnauthorized: false, ...o }); c.on('connect', () => res(c)); c.on('error', e => { rej(e); c.end(true); }); });
  // a client that records what the Host delivers on rtc and media
  const track = async (c, who) => {
    const t = { rtc: [], media: [], closed: false, tk: {} };
    c.on('close', () => { t.closed = true; });
    c.on('message', async (topic, buf) => {
      if(topic === `${base}/rtc`) {
        const h = headOf(buf); t.rtc.push(h);
        if(h.t === 'tkt') { try { t.tk[h.sid] = (await unseal(buf.subarray(2 + buf.readUInt16BE(0)))).tk; } catch {} }
      }
      if(topic === `${base}/media`) { try { t.media.push(await unseal(buf)); } catch {} }
    });
    await new Promise(r => c.subscribe([`${base}/rtc`, `${base}/media`], r));
    return t;
  };
  const mod = async n => { const c = await connect(`wss://127.0.0.1:${MPORT}/mqtt`, { clientId: 'mod-' + n, username: 'mod', password: pass }); return { c, id: 'mod-' + n, t: await track(c), pub: async (h, b) => { c.publish(`${base}/rtc`, await rtc(h, b)); } }; };
  const sidn = () => 'sid' + Math.random().toString(36).slice(2, 12);
  const cnt = (t, f) => t.rtc.filter(f).length;
  const dock = () => fetch(`http://localhost:${PORT}/api/status`).then(r => r.json());
  const ctrl = (action, key) => host.api('/api/control', { action, key });
  const perms = p => host.api('/api/perms', { perms: p });

  // widget (no login, this PC) and the streamer's panel (session from a one-time key)
  const wc = await connect(`ws://localhost:${PORT}/mqtt`, { clientId: 'widget-1' });
  const W = await track(wc);
  const k = await host.api('/api/streamer/open', {});
  const ses = await fetch(`http://127.0.0.1:${PORT}/api/streamer/session`, { method: 'POST', headers: { origin: PANEL, 'content-type': 'application/json' }, body: JSON.stringify({ key: k.key }) }).then(r => r.json());
  const sc = await connect(`ws://localhost:${PORT}/mqtt`, { clientId: 'streamer-1', username: 'streamer', password: ses.pass, wsOptions: { headers: { origin: PANEL } } });
  const S = await track(sc);
  const A = await mod('a'), B = await mod('b');
  const sleepMsg = () => sleep(500);

  await step('camera, screen and microphone are off by default, and only an explicit true turns them on', async () => {
    const st = await host.api('/api/status');
    eq([st.perms.cam, st.perms.screen, st.perms.mic], [false, false, false], 'off in the status');
    eq([st.perms.av, st.perms.games], [true, true], 'old permissions keep their default');
    const cfgFile = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8'));
    check(!cfgFile.perms || [cfgFile.perms.cam, cfgFile.perms.screen, cfgFile.perms.mic].every(v => v === false || v === undefined), 'nothing is saved as on');
    const r = await perms({ cam: 'yes', mic: 1 });
    eq([r.perms.cam, r.perms.mic], [false, false], 'a truthy non-true value does not switch it on');
  });

  await step('without the permission a moderator cannot start a stream: dropped, told "no", nothing reaches the widget', async () => {
    const sid = sidn();
    await A.pub({ sid, kind: 'screen', t: 'offer', to: 'widget' });
    await sleepMsg();
    eq(cnt(W, h => h.sid === sid) + cnt(S, h => h.sid === sid), 0, 'not delivered');
    check(A.t.media.some(m => m.ev === 'no' && m.kind === 'screen' && m.cid === A.id && m.why === 'perm'), 'the moderator is told the permission is off');
    check(!A.t.closed, 'the moderator stays connected');
    eq((await dock()).media.pending.length, 0, 'no request reaches the dock either');
  });

  await step('a malformed rtc header disconnects the sender; moderators cannot use other topics for media', async () => {
    const c = await mod('bad');
    const bad = [Buffer.from('nonsense'), await rtc({ sid: 'short', kind: 'cam', t: 'offer', to: 'widget' }), await rtc({ sid: sidn(), kind: 'webcam', t: 'offer', to: 'widget' }), await rtc({ sid: sidn(), kind: 'cam', t: 'offer', to: '*' })];
    c.c.publish(`${base}/rtc`, bad[0]);
    await until(() => c.t.closed, 4000);
    check(c.t.closed, 'garbage closes the connection');
    for(const b of bad.slice(1)) { const x = await mod('bad' + Math.random().toString(36).slice(2, 6)); x.c.publish(`${base}/rtc`, b); check(await until(() => x.t.closed, 4000), 'invalid header closes the connection'); }
    const m2 = await mod('top'); m2.c.publish(`${base}/media`, await seal({ ev: 'ok', cid: m2.id, kind: 'cam' }));
    check(await until(() => m2.t.closed, 4000), 'a moderator cannot publish the media topic');
  });

  await step('with the permission on, the first offer asks the streamer in the dock; denied means dropped, and a retry is possible later', async () => {
    await perms({ cam: true });
    const sid = sidn();
    await A.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    check(await until(async () => (await dock()).media.pending.length === 1), 'a request appears in the dock');
    const q = (await dock()).media.pending[0];
    eq([q.kind, q.key], ['cam', 'cam|' + A.id], 'who and what');
    check(/^\d+\.x\.x\.\d+$/.test(q.ip), 'the address in the dock is masked: ' + q.ip);
    check(A.t.media.some(m => m.ev === 'pending'), 'the moderator is told to wait');
    eq(cnt(W, h => h.sid === sid), 0, 'the offer was not delivered while it is pending');
    await ctrl('mediadeny', q.key);
    check(await until(() => A.t.media.some(m => m.ev === 'no' && m.why === 'denied')), 'the moderator is told it was declined');
    await A.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await sleepMsg();
    eq([cnt(W, h => h.sid === sid), (await dock()).media.pending.length], [0, 0], 'declined: dropped, and no new request right away');
    check(/Denied/.test(host.log()), 'the decision is in the log');
  });

  await step('approval works for the connection session only; the stream then reaches the widget and the streamer', async () => {
    // a fresh moderator connection asks again
    const C = await mod('c'); const sid = sidn();
    await C.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + C.id));
    await ctrl('mediaallow', 'cam|' + C.id);
    check(await until(() => C.t.media.some(m => m.ev === 'ok' && m.kind === 'cam')), 'the moderator is told it is allowed');
    await C.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    check(await until(() => cnt(W, h => h.sid === sid && h.t === 'offer') === 1), 'now the offer reaches the widget');
    check(cnt(S, h => h.sid === sid) === 1, 'and the streamer\'s panel (it listens to everything)');
    await ctrl('mediaallow', 'cam|nobody').catch(() => {});
    eq((await ctrl('mediaallow', 'cam|nobody')).ok, false, 'approving a request that does not exist fails');
    // retained must not be possible: a later subscriber sees nothing
    const late = await connect(`ws://localhost:${PORT}/mqtt`, { clientId: 'widget-late' }); const L = await track(late); await sleepMsg();
    eq(L.rtc.length, 0, 'signalling is not retained'); late.end(true);
    // end this session with the owner leaving
    C.c.end(true);
    check(await until(async () => (await dock()).media.live.length === 0), 'the owner leaving ends the session');
    check(await until(() => cnt(W, h => h.sid === sid && h.t === 'bye') === 1), 'the Host tells everyone "bye"');
  });

  const sidA = sidn(), sidA2 = sidn();
  await step('who may answer: the addressee only; a stranger cannot take or kill someone else\'s sid', async () => {
    await perms({ screen: true });
    await A.pub({ sid: sidA, kind: 'screen', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'screen|' + A.id));
    await ctrl('mediaallow', 'screen|' + A.id);
    await until(() => A.t.media.some(m => m.ev === 'ok' && m.kind === 'screen'));
    await A.pub({ sid: sidA, kind: 'screen', t: 'offer', to: 'widget' });
    check(await until(() => cnt(W, h => h.sid === sidA && h.t === 'offer') === 1), 'screen offer delivered');
    await wc.publish(`${base}/rtc`, await rtc({ sid: sidA, kind: 'screen', t: 'answer' }));
    check(await until(() => cnt(A.t, h => h.sid === sidA && h.t === 'answer') === 1), 'the addressee (widget) can answer');
    await B.pub({ sid: sidA, kind: 'screen', t: 'answer' });
    await B.pub({ sid: sidA, kind: 'screen', t: 'ice' });
    await B.pub({ sid: sidA, kind: 'screen', t: 'bye' });
    await B.pub({ sid: sidA, kind: 'screen', t: 'offer', to: 'widget' });
    await A.pub({ sid: sidA, kind: 'cam', t: 'ice', to: 'widget' });
    await wc.publish(`${base}/rtc`, await rtc({ sid: sidA, kind: 'screen', t: 'offer', to: 'widget' }));
    await wc.publish(`${base}/rtc`, await rtc({ sid: sidn(), kind: 'screen', t: 'answer' }));
    await sleepMsg();
    eq(cnt(A.t, h => h.sid === sidA && h.t === 'answer'), 1, 'a stranger\'s answer did not arrive');
    eq([cnt(W, h => h.sid === sidA && h.t === 'ice'), cnt(W, h => h.sid === sidA && h.t === 'bye')], [0, 0], 'a stranger\'s ice and bye did not arrive');
    eq(cnt(W, h => h.sid === sidA && h.t === 'offer'), 1, 'a stranger cannot offer on someone else\'s sid, and the widget cannot offer at all');
    eq(cnt(W, h => h.sid === sidA && h.kind === 'cam'), 0, 'a header with a different kind is not accepted for a registered sid');
    check(!B.t.closed && !A.t.closed, 'nobody is disconnected for it');
    check((await dock()).media.live.some(l => l.sid === sidA), 'the stream is still alive');
    await sc.publish(`${base}/rtc`, await rtc({ sid: sidA, kind: 'screen', t: 'ice', to: 'streamer' }));   // the streamer is not the owner and not a peer: no ice
    await A.pub({ sid: sidA, kind: 'screen', t: 'ice', to: 'widget' });
    check(await until(() => cnt(W, h => h.sid === sidA && h.t === 'ice') === 1), 'the owner\'s ice to its addressee is delivered');
  });

  await step('WS /media: authorisation, roles and the forwarding of sealed chunks', async () => {
    const open = (port, sid, auth, tls = false, headers) => new Promise(res => {
      const ws = new WebSocket(`${tls ? 'wss' : 'ws'}://${tls ? '127.0.0.1' : 'localhost'}:${port}/media?sid=${sid}`, { rejectUnauthorized: false, headers });
      const r = { ws, got: [], closed: false, opened: false };
      ws.on('message', d => r.got.push(Buffer.from(d))); ws.on('close', () => { r.closed = true; res(r); }); ws.on('error', () => {});
      ws.on('open', () => { r.opened = true; if(auth) ws.send(JSON.stringify(auth)); res(r); });
    });
    const frame = (type, n) => Buffer.concat([Buffer.from([type]), Buffer.alloc(n, 7)]);
    const dead = async r => until(() => r.closed, 4000);
    // no first message → closed within 5 s
    const idle = await open(PORT, sidA, null);
    check(await until(() => idle.closed, 7000), 'a socket that does not log in is dropped in about 5 s');
    // wrong password, wrong client id, a client without MQTT
    const tkA = A.t.tk[sidA], tkW = W.tk[sidA];
    check(typeof tkA === 'string' && tkA.length >= 16 && typeof tkW === 'string' && !B.t.tk[sidA], 'the owner and the widget got tickets; a bystander did not');
    const wrongPass = await open(MPORT, sidA, { u: 'mod', p: 'nope', t: tkA }, true); check(await dead(wrongPass), 'wrong password');
    const noMqtt = await open(MPORT, sidA, { u: 'mod', p: pass, t: 'x'.repeat(32) }, true); check(await dead(noMqtt), 'a made-up ticket');
    const noTicket = await open(MPORT, sidA, { u: 'mod', p: pass, c: A.id }, true); check(await dead(noTicket), 'the right password and client id, but no ticket: no way into someone else\'s session');
    const stranger = await open(MPORT, sidA, { u: 'mod', p: pass, c: B.id, t: tkA.slice(0, -1) + (tkA.endsWith('a') ? 'b' : 'a') }, true); check(await dead(stranger), 'a moderator who is not an addressee of the session cannot receive it');
    const asStr = await open(MPORT, sidA, { u: 'streamer', p: ses.pass, t: tkW }, true); check(await dead(asStr), 'the streamer login does not work on the moderators\' port');
    const badSid = await open(PORT, 'x', { u: 'widget', t: tkW }); check(await dead(badSid), 'a bad sid is refused');
    const noSess = await open(PORT, sidn(), { u: 'widget', t: tkW }); check(await dead(noSess), 'an unknown sid is refused');
    const wrongOrigin = await open(PORT, sidA, { u: 'widget', t: tkW }, false, { origin: 'https://evil.example' }); check(await dead(wrongOrigin), 'a foreign website cannot connect on the local port');
    const widAsPanel = await open(PORT, sidA, { u: 'widget', t: tkW }, false, { origin: PANEL }); check(await dead(widAsPanel), 'the panel origin cannot pose as the widget');
    const panelBad = await open(PORT, sidA, { u: 'streamer', p: 'guess', t: tkW }, false, { origin: PANEL }); check(await dead(panelBad), 'wrong streamer session');
    // sender and receiver
    const snd = await open(MPORT, sidA, { u: 'mod', p: pass, t: tkA }, true);
    const rcv = await open(PORT, sidA, { u: 'widget', t: tkW });
    await sleep(400);
    check(!snd.closed && !rcv.closed, 'the owner and the addressee are in');
    snd.ws.send(frame(0, 100)); snd.ws.send(frame(1, 5000));
    check(await until(() => rcv.got.length === 2), 'the widget gets both chunks');
    eq([rcv.got[0].length, rcv.got[0][0], rcv.got[1].length, rcv.got[1][0]], [101, 0, 5001, 1], 'unchanged bytes (the Host only forwards)');
    const late = await open(PORT, sidA, { u: 'widget', t: tkW });
    check(await until(() => late.got.length === 1 && late.got[0][0] === 0), 'a late receiver gets the stored stream header first');
    late.ws.send(frame(1, 50));
    check(await dead(late), 'a receiver that sends anything is dropped');
    // the sender breaking the rules
    const s2 = await open(MPORT, sidA, { u: 'mod', p: pass, t: A.t.tk[sidA] }, true);   // a new sender replaces the old one
    check(await dead(snd), 'a second sender replaces the first');
    s2.ws.send(frame(9, 100)); check(await dead(s2), 'unknown chunk type');
    const s3 = await open(MPORT, sidA, { u: 'mod', p: pass, t: A.t.tk[sidA] }, true); await sleep(300); s3.ws.send('text'); check(await dead(s3), 'text after login');
    const s4 = await open(MPORT, sidA, { u: 'mod', p: pass, t: A.t.tk[sidA] }, true); await sleep(300); s4.ws.send(Buffer.alloc(5)); check(await dead(s4), 'a chunk that is too small to be sealed');
    const s5 = await open(MPORT, sidA, { u: 'mod', p: pass, t: A.t.tk[sidA] }, true); await sleep(300); s5.ws.send(frame(1, 1048576 + 10)); check(await dead(s5), 'a frame over 1 MB');
    const s6 = await open(MPORT, sidA, { u: 'mod', p: pass, t: A.t.tk[sidA] }, true); await sleep(300); s6.ws.send(frame(1, 900000)); s6.ws.send(frame(1, 900000)); check(await dead(s6), 'faster than 6 Mbit/s breaks the connection');
    check((await dock()).media.live.some(l => l.sid === sidA), 'the session itself survives broken sockets');
    rcv.ws.close();
  });

  await step('revoking the permission cuts the sockets and sends "bye"; approval is forgotten', async () => {
    const snd = await new Promise(res => { const ws = new WebSocket(`wss://127.0.0.1:${MPORT}/media?sid=${sidA}`, { rejectUnauthorized: false }); const r = { ws, closed: false }; ws.on('open', () => { ws.send(JSON.stringify({ u: 'mod', p: pass, t: A.t.tk[sidA] })); res(r); }); ws.on('close', () => { r.closed = true; }); ws.on('error', () => {}); });
    const rcv = await new Promise(res => { const ws = new WebSocket(`ws://localhost:${PORT}/media?sid=${sidA}`); const r = { ws, closed: false }; ws.on('open', () => { ws.send(JSON.stringify({ u: 'widget', t: W.tk[sidA] })); res(r); }); ws.on('close', () => { r.closed = true; }); ws.on('error', () => {}); });
    await sleep(300);
    const byes = cnt(W, h => h.sid === sidA && h.t === 'bye'), n0 = A.t.media.length;
    await perms({ screen: false });
    check(await until(() => snd.closed && rcv.closed), 'both sockets are closed');
    check(await until(() => cnt(W, h => h.sid === sidA && h.t === 'bye') === byes + 1), 'the widget gets the Host\'s "bye"');
    check(await until(() => A.t.media.slice(n0).some(m => m.ev === 'bye' && m.sid === sidA)), 'the moderator is told too');
    eq((await dock()).media.live.filter(l => l.sid === sidA).length, 0, 'the session is gone');
    // switching it on again does not bring the old approval back
    await perms({ screen: true });
    await A.pub({ sid: sidA2, kind: 'screen', t: 'offer', to: 'widget' });
    check(await until(async () => (await dock()).media.pending.some(p => p.key === 'screen|' + A.id)), 'it asks again');
    await ctrl('mediadeny', 'screen|' + A.id);
    check(/Moderator permissions: .*moderator.s screen — denied/.test(host.log()), 'the change is in the log');
  });

  await step('dock: "turn off" on a stream ends it and requires a new request; the global switch ends every moderator stream', async () => {
    const sid = sidn();
    await sleep(100);
    await B.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + B.id));
    await ctrl('mediaallow', 'cam|' + B.id);
    await B.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    check(await until(async () => (await dock()).media.live.some(l => l.sid === sid && l.kind === 'cam')), 'B is live');
    const r = await ctrl('mediastop', sid);
    eq(r.ok, true, 'stop accepted');
    check(await until(async () => !(await dock()).media.live.some(l => l.sid === sid)), 'the stream ended');
    await B.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await sleepMsg();
    eq((await dock()).media.live.length, 0, 'the same moderator cannot just start again');
    // global switch
    await sleep(100);
    await ctrl('mediaoff');
    check((await dock()).media.off === true, 'the switch is on');
    const st = await host.api('/api/status');
    eq(st.perms.cam, true, 'the sliders themselves stay as the streamer set them');
    const sid2 = sidn();
    await B.pub({ sid: sid2, kind: 'cam', t: 'offer', to: 'widget' });
    await sleepMsg();
    eq([cnt(W, h => h.sid === sid2), (await dock()).media.pending.length], [0, 0], 'while it is on, no moderator can even ask');
    check(B.t.media.some(m => m.ev === 'no' && m.why === 'perm'), 'and is told no');
    await ctrl('mediaon');
    eq((await dock()).media.off, false, 'switched off again');
  });

  await step('the streamer\'s own streams need no permission; the widget cannot start any; limits apply', async () => {
    const sid = sidn();
    await sc.publish(`${base}/rtc`, await rtc({ sid, kind: 'screen', t: 'offer', to: 'widget' }));
    check(await until(() => cnt(W, h => h.sid === sid && h.t === 'offer') === 1), 'the streamer\'s offer goes through (screen permission for moderators is not needed)');
    await wc.publish(`${base}/rtc`, await rtc({ sid: sidn(), kind: 'cam', t: 'offer', to: 'streamer' }));
    await B.pub({ sid, kind: 'screen', t: 'bye' });
    await sleepMsg();
    check((await dock()).media.live.some(l => l.sid === sid && l.own === 'streamer'), 'a moderator\'s bye does not end the streamer\'s stream');
    eq((await dock()).media.live.filter(l => l.own === 'streamer').length, 1, 'the widget\'s offer was not registered');
    const mws = new WebSocket(`wss://127.0.0.1:${MPORT}/media?sid=${sid}`, { rejectUnauthorized: false });
    let mclosed = false; mws.on('close', () => { mclosed = true; }); mws.on('error', () => {}); mws.on('open', () => mws.send(JSON.stringify({ u: 'mod', p: pass, c: B.id, t: W.tk[sid] || 'z'.repeat(32) })));
    check(await until(() => mclosed), 'a moderator cannot receive the streamer\'s stream unless it is addressed to them');
    await sc.publish(`${base}/rtc`, await rtc({ sid, kind: 'screen', t: 'bye' }));
    check(await until(async () => (await dock()).media.live.length === 0), 'the streamer\'s bye ends it');
    // limits: 4 per moderator
    await perms({ cam: true });
    const D = await mod('d'); const sids = [1, 2, 3, 4, 5].map(sidn);
    await D.pub({ sid: sids[0], kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + D.id));
    await ctrl('mediaallow', 'cam|' + D.id);
    for(const s of sids) await D.pub({ sid: s, kind: 'cam', t: 'offer', to: 'widget' });
    await sleep(700);
    eq((await dock()).media.live.filter(l => l.own === 'mod').length, 4, 'a moderator has at most 4 sources');
    check(!D.t.closed, 'and is not disconnected for the fifth');
    // peers per session
    const sidP = sids[0];
    for(let i = 0; i < 12; i++) await D.pub({ sid: sidP, kind: 'cam', t: 'offer', to: 'm:peer' + i });
    await sleep(600);
    check(cnt(W, h => h.sid === sidP && h.t === 'offer') >= 1, 'offers to the first peers go through');
    D.c.end(true);
    check(await until(async () => (await dock()).media.live.length === 0), 'sessions end with the owner\'s connection');
  });

  await step('the Host stamps the real sender into the header; nobody can speak for the streamer', async () => {
    await perms({ cam: true });
    const F = await mod('f'), sid = sidn();
    await F.pub({ sid, kind: 'cam', t: 'offer', to: 'widget', from: 'streamer' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + F.id));
    await ctrl('mediaallow', 'cam|' + F.id);
    await until(() => F.t.media.some(m => m.ev === 'ok'));
    await F.pub({ sid, kind: 'cam', t: 'offer', to: 'widget', from: 'streamer' });
    await F.pub({ sid, kind: 'cam', t: 'have', to: 'widget', from: 'host' });
    check(await until(() => W.rtc.filter(h => h.sid === sid && (h.t === 'offer' || h.t === 'have')).length === 2), 'both reach the widget');
    eq(W.rtc.filter(h => h.sid === sid && h.t !== 'tkt').map(h => h.from), ['m:' + F.id, 'm:' + F.id], 'the forged "from" was replaced by the real address');
    await wc.publish(`${base}/rtc`, await rtc({ sid: sidn(), kind: 'cam', t: 'want', from: 'streamer' }));
    await sc.publish(`${base}/rtc`, await rtc({ sid: sidn(), kind: 'cam', t: 'want' }));
    check(await until(() => W.rtc.filter(h => h.t === 'want' && h.from === 'streamer').length >= 1 && W.rtc.some(h => h.t === 'want' && h.from === 'widget')), 'the streamer and the widget are stamped with their own addresses');
    check(typeof W.tk[sid] === 'string' && !S.tk[sid] && !F.t.tk[sid] === false, 'the widget (the addressee) and the owner got tickets for it, the streamer\'s panel did not');
    await F.pub({ sid, kind: 'cam', t: 'tkt', to: 'widget' });
    await sleepMsg();
    check(F.t.closed, 'a client cannot make a ticket packet (the format breaks the connection)');
  });

  await step('receivers are released: bye, disconnect and a full table do not block new addressees', async () => {
    await perms({ cam: true });
    const O = await mod('o'), sid = sidn();
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + O.id));
    await ctrl('mediaallow', 'cam|' + O.id);
    await until(() => O.t.media.some(m => m.ev === 'ok'));
    const R1 = await mod('r1'), R2 = await mod('r2');
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:' + R1.id });
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:' + R2.id });
    for(let i = 0; i < 6; i++) await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:fake' + i });   // widget + R1 + R2 + 5 = 8 (the first offer only asked the streamer)
    await sleepMsg();
    const to = x => W.rtc.filter(h => h.sid === sid && h.t === 'offer' && h.to === x).length;
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:late1' }); await sleepMsg();
    eq(to('m:late1'), 0, 'the ninth addressee is refused while the table is full');
    await R1.pub({ sid, kind: 'cam', t: 'bye' }); await sleepMsg();
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:late1' });
    check(await until(() => to('m:late1') === 1), 'after a receiver\'s bye its place is free');
    R2.c.end(true); await sleep(400);
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:late2' });
    check(await until(() => to('m:late2') === 1), 'after a receiver disconnects its place is free');
    check((await dock()).media.live.some(l => l.sid === sid), 'a receiver\'s bye does not end the stream');
    O.c.end(true);
    check(await until(async () => (await dock()).media.live.length === 0), 'the owner leaving ends it');
  });

  await step('a released receiver loses its /media socket; tickets of dead widgets do not fill the limit', async () => {
    await perms({ cam: true });
    const O = await mod('o2'), sid = sidn();
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + O.id));
    await ctrl('mediaallow', 'cam|' + O.id);
    await until(() => O.t.media.some(m => m.ev === 'ok'));
    const R = await mod('r3'), R2 = await mod('r4');
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:' + R.id });
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:' + R2.id });
    check(await until(() => R.t.tk[sid] && R2.t.tk[sid] && O.t.tk[sid]), 'receivers and owner got tickets');
    const open = (port, auth) => new Promise(res => {
      const ws = new WebSocket(`wss://127.0.0.1:${port}/media?sid=${sid}`, { rejectUnauthorized: false });
      const r = { ws, got: [], closed: false }; ws.on('message', d => r.got.push(Buffer.from(d))); ws.on('close', () => { r.closed = true; }); ws.on('error', () => {});
      ws.on('open', () => { ws.send(JSON.stringify(auth)); res(r); });
    });
    const snd = await open(MPORT, { u: 'mod', p: pass, t: O.t.tk[sid] });
    const r1 = await open(MPORT, { u: 'mod', p: pass, t: R.t.tk[sid] }), r2 = await open(MPORT, { u: 'mod', p: pass, t: R2.t.tk[sid] });
    await sleep(400);
    const fr = (type, n) => Buffer.concat([Buffer.from([type]), Buffer.alloc(n, 7)]);
    snd.ws.send(fr(0, 100));
    check(await until(() => r1.got.length === 1 && r2.got.length === 1), 'both receivers get the chunk');
    await R.pub({ sid, kind: 'cam', t: 'bye' });
    check(await until(() => r1.closed), 'bye closes the receiver\'s /media socket');
    const r1b = await open(MPORT, { u: 'mod', p: pass, t: R.t.tk[sid] }); check(await until(() => r1b.closed), 'the ticket does not let it back in after bye');
    snd.ws.send(fr(1, 100)); await sleep(300);
    eq([r1.got.length, r2.got.length], [1, 2], 'the released receiver gets nothing more, the other one does');
    R2.c.end(true);
    check(await until(() => r2.closed), 'a receiver\'s disconnect closes its /media socket');
    const r2b = await open(MPORT, { u: 'mod', p: pass, t: R2.t.tk[sid] }); check(await until(() => r2b.closed), 'a ticket does not work after the MQTT connection is gone');
    // widgets reloaded in OBS: dead tickets do not use up the limit
    for(let i = 0; i < 30; i++) {
      const c = await connect(`ws://localhost:${PORT}/mqtt`, { clientId: 'widget-r' + i }); const T2 = await track(c);
      await O.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
      check(await until(() => T2.tk[sid]), 'the reloaded widget #' + i + ' gets a ticket');
      c.end(true); await sleep(60);
    }
    O.c.end(true);
    await until(async () => (await dock()).media.live.length === 0);
  });

  await step('a lagging receiver: pieces are skipped until the next stream header, then the flow resumes', async () => {
    await perms({ cam: true });
    const O = await mod('o3'), sid = sidn();
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + O.id));
    await ctrl('mediaallow', 'cam|' + O.id);
    await until(() => O.t.media.some(m => m.ev === 'ok'));
    const R = await mod('r5');
    await O.pub({ sid, kind: 'cam', t: 'offer', to: 'm:' + R.id });
    check(await until(() => R.t.tk[sid] && O.t.tk[sid]), 'tickets are out');
    const open = (port, auth) => new Promise(res => {
      const ws = new WebSocket(`wss://127.0.0.1:${port}/media?sid=${sid}`, { rejectUnauthorized: false });
      const r = { ws, got: [], closed: false }; ws.on('message', d => r.got.push(Buffer.from(d))); ws.on('close', () => { r.closed = true; }); ws.on('error', () => {});
      ws.on('open', () => { ws.send(JSON.stringify(auth)); res(r); });
    });
    const snd = await open(MPORT, { u: 'mod', p: pass, t: O.t.tk[sid] });
    const lag = await open(MPORT, { u: 'mod', p: pass, t: R.t.tk[sid] });
    await sleep(400);
    let seq = 0;
    const fr = (type, n) => { const b = Buffer.alloc(1 + 40 + n, 7); b[0] = type; b.writeUInt32BE(++seq, 1); return b; };
    snd.ws.send(fr(0, 100)); await sleep(100);
    check(lag.got.length === 1 && lag.got[0][0] === 0, 'the first header is delivered');
    // this receiver reads nothing for a while: the Host sees its buffer grow
    lag.ws._socket.pause();
    const t0 = Date.now(); let sent = 0;
    while(Date.now() - t0 < 60000 && !lag.closed) {
      snd.ws.send(fr(1, 70000)); sent++; await sleep(100);
      if(sent * 70 > 14000) break;   // about 14 MB: more than the sockets hold, less than the Host's 16 MB cut-off
    }
    check(!lag.closed, 'the lagging receiver is not dropped (under 16 MB)');
    lag.ws._socket.resume(); await sleep(1500);
    const seqs = lag.got.map(b => b.readUInt32BE(1));
    const lastBefore = seqs[seqs.length - 1];
    check(seqs.length < sent + 1, 'some pieces were skipped for the laggard: got ' + seqs.length + ' of ' + (sent + 1));
    // once it has caught up it still gets nothing until a header arrives
    snd.ws.send(fr(1, 1000)); snd.ws.send(fr(1, 1000)); await sleep(400);
    eq(lag.got.length, seqs.length, 'a piece after a skip is not sent before the next header');
    snd.ws.send(fr(0, 500)); snd.ws.send(fr(1, 1000)); await sleep(400);
    eq(lag.got.slice(seqs.length).map(b => b[0]), [0, 1], 'the next header and what follows it arrive');
    check(seqs.every((s, i) => s === i + 1) && lastBefore < sent + 1, 'what arrived is an unbroken start of the flow; everything after the skip is missing (last ' + lastBefore + ' of ' + (sent + 1) + ')');
    snd.ws.send(fr(1, 1000)); await sleep(300);
    eq(lag.got[lag.got.length - 1][0], 1, 'and the flow continues');
    // a receiver that joins later gets the stored header, then waits for the next one
    const joiner = await open(MPORT, { u: 'mod', p: pass, t: R.t.tk[sid] }); await sleep(100);
    // (the same ticket for the same client: a second socket is a new receiver with its own state)
    check(joiner.got.length === 1 && joiner.got[0][0] === 0, 'a late receiver gets the stored header');
    snd.ws.send(fr(1, 1000)); await sleep(300);
    eq(joiner.got.length, 1, 'but not the middle of a segment');
    snd.ws.send(fr(0, 300)); snd.ws.send(fr(1, 300)); await sleep(300);
    eq(joiner.got.length, 3, 'and everything from the next header on');
    O.c.end(true);
    await until(async () => (await dock()).media.live.length === 0);
  });

  await step('after a drop the same client id is asked again, the approval is not inherited', async () => {
    await perms({ cam: true });
    const G = await mod('g'), sid = sidn();
    await G.pub({ sid, kind: 'cam', t: 'offer', to: 'widget' });
    await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + G.id));
    await ctrl('mediaallow', 'cam|' + G.id);
    await until(() => G.t.media.some(m => m.ev === 'ok'));
    G.c.end(true);
    check(await until(async () => (await dock()).media.live.length === 0), 'the session is closed on the drop');
    const G2 = await mod('g'), sid2 = sidn();
    await G2.pub({ sid: sid2, kind: 'cam', t: 'offer', to: 'widget' }); await sleepMsg();
    eq(cnt(W, h => h.sid === sid2), 0, 'the same client id is not let through without a new question');
    check(await until(async () => (await dock()).media.pending.some(p => p.key === 'cam|' + G2.id)), 'the streamer is asked again');
    G2.c.end(true);
    await perms({ cam: false });
  });

  await step('the moderators\' count of rtc messages is limited, the topic is never retained, and logs show no keys', async () => {
    await perms({ cam: false });
    const E = await mod('e'), before = E.t.rtc.length;
    for(let i = 0; i < 400; i++) E.c.publish(`${base}/rtc`, await rtc({ sid: sidn(), kind: 'cam', t: 'want' }));
    await sleep(800);
    check(W.rtc.filter(h => h.t === 'want').length < 400, 'a flood of requests is cut off by the rate limit: ' + W.rtc.filter(h => h.t === 'want').length);
    check(!E.t.closed, 'without disconnecting');
    const log = host.log();
    check(!log.includes(pass) && !log.includes(code.k) && !log.includes(ses.pass) && !log.includes(k.key), 'no password, room key or session in the log');
    check(!/cloudflare|trycloudflare|emqx/i.test(log), 'no public servers');
  });

  await step('no moderators in at all: nobody can log in to /media', async () => {
    await host.api('/api/mods', { on: false });
    const ws = new WebSocket(`wss://127.0.0.1:${MPORT}/media?sid=${sidn()}`, { rejectUnauthorized: false });
    let ok = false; ws.on('open', () => { ok = true; }); ws.on('error', () => {});
    await sleep(800);
    check(!ok, 'the upgrade is refused while moderators are not allowed');
    await host.api('/api/mods', { on: true });
  });

  await step('a moderator cannot take over the clientId of a widget or the streamer panel', async () => {
    for(const id of ['widget-1', 'streamer-1']){
      const r = await connect(`wss://127.0.0.1:${MPORT}/mqtt`, { clientId: id, username: 'mod', password: pass }).then(c => { c.end(true); return 'in'; }, () => 'refused');
      eq(r, 'refused', id + ' is not taken over');
    }
    check(!wc.disconnected && wc.connected && sc.connected, 'the widget and the streamer panel stay connected');
    const a = await mod('same'), b = await mod('same');   // the same moderator, same address: a quick reconnect works
    check(b.c.connected, 'a reconnect with the same clientId from the same address is allowed');
    a.c.end(true); b.c.end(true);
  });

  for(const c of [wc, sc]) c.end(true);
  await host.stop();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
