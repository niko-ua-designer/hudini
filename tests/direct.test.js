// Direct connection (Hudini 1.0): TLS port for moderators with a pinned fingerprint, the moderator code, admin cookie on 127.0.0.1,
// password limits (including Porthole), pause and "don't let moderators in", logs. No browser: raw HTTPS, MQTT and sockets.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), tls = require('tls');
const mqtt = require('mqtt');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

const PORT = 17810 + Number(process.env.HUDINI_TEST_PORT_OFFSET || 0), MPORT = PORT + 1;
const lan = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'));
const dial = (url, password) => new Promise(res => {
  const c = mqtt.connect(url, { username: 'mod', password, reconnectPeriod: 0, connectTimeout: 4000, rejectUnauthorized: false });
  c.on('connect', () => res({ ok: true, c })); c.on('error', e => { res({ ok: false, err: String(e.message), c }); c.end(true); });
});

(async () => {
  const host = T.startHost({ OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off' });
  await host.ready();
  const A = `http://127.0.0.1:${PORT}`;

  await step('the Host makes its own room and the moderator code', async () => {
    const st = await host.api('/api/status');
    check(st.room && st.ownRoom && st.obsLink.startsWith(`http://localhost:${PORT}/widget/widget.html?room=`), 'room created at first start, OBS link points to this PC');
    const c = await host.code();
    check(c.code.startsWith('hudini1:'), 'code starts with hudini1:');
    const d = c.data;
    eq([d.v, d.room === st.room, typeof d.k, typeof d.p, d.s && d.s.kty, d.pass === c.pass], [1, true, 'string', 'string', 'EC', true], 'code carries room, keys (AES, public, private JWK) and password');
    check(/^[0-9a-f]{64}$/.test(d.fp), 'code carries the SHA-256 fingerprint');
    check(d.addrs.some(a => a.h === '127.0.0.1' && a.port === MPORT && a.net === 'porthole'), 'addresses always include 127.0.0.1 for Porthole');
    check(d.addrs.every(a => a.port === MPORT), 'every address points at the moderators\' port');
    check(!/cloudflare|trycloudflare|emqx/i.test(host.log()), 'no Cloudflare or public broker in the log');
  });

  await step('TLS: the fingerprint in the code is the certificate the port presents', async () => {
    const { data } = await host.code();
    const peer = await new Promise((res, rej) => { const s = tls.connect({ host: '127.0.0.1', port: MPORT, rejectUnauthorized: false }, () => { const p = s.getPeerCertificate(); s.end(); res(p); }); s.on('error', rej); });
    eq(peer.fingerprint256.replace(/:/g, '').toLowerCase(), data.fp, 'fp matches the presented certificate');
    const plain = await new Promise(r => require('http').get({ host: '127.0.0.1', port: MPORT, path: '/ping', timeout: 2000 }, res => { res.resume(); r(res.statusCode); }).on('error', () => r('refused')).on('timeout', function(){ this.destroy(); }));
    check(plain !== 200, 'plain HTTP on the moderators\' port is not served: ' + plain);
    eq((await fetch(`https://127.0.0.1:${MPORT}/ping`)).status, 200, '/ping answers without a password');
    eq((await fetch(`https://127.0.0.1:${MPORT}/`)).status, 404, 'no management page on the moderators\' port');
    eq((await fetch(`https://127.0.0.1:${MPORT}/api/status`)).status, 404, 'no API on the moderators\' port');
    check(fs.existsSync(path.join(host.dir, 'tls', 'cert.pem')), 'certificate stored in data/tls');
  });

  await step('127.0.0.1:7777 is closed without the admin cookie', async () => {
    eq((await fetch(A + '/api/status')).status, 200, 'status without cookie is only "alive"');
    const bare = await (await fetch(A + '/api/status')).json();
    check(bare.alive && !('obsLink' in bare) && !('addrs' in bare), 'no secrets in the open status: ' + JSON.stringify(bare));
    eq((await fetch(A + '/api/code')).status, 403, '/api/code without cookie → 403');
    eq((await fetch(A + '/')).status, 403, 'management page without cookie → 403');
    eq((await fetch(A + '/auth?t=wrong', { redirect: 'manual' })).status, 403, 'wrong token → 403');
    const ok = await fetch(A + `/auth?t=${T.ADMIN_TOKEN}`, { redirect: 'manual' });
    const cookie = (ok.headers.get('set-cookie') || '');
    check(ok.status === 200 && /http-equiv="refresh" content="0;url=\/"/.test(await ok.text()) && /hudini_admin=/.test(cookie) && /HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie), 'right token → cookie HttpOnly, SameSite=Strict, page goes on to / by itself: ' + cookie);
    const ck = cookie.split(';')[0];
    eq((await fetch(A + '/', { headers: { cookie: ck } })).status, 200, 'management page with the cookie');
    const full = await (await fetch(A + '/api/status', { headers: { cookie: ck } })).json();
    check(full.obsLink && full.addrs && full.fp, 'full status with the cookie');
    eq((await fetch(A + '/api/code', { headers: { cookie: 'hudini_admin=nope' } })).status, 403, 'a forged cookie does not work');
    const rebound = await new Promise(r => require('http').get({ host: '127.0.0.1', port: PORT, path: '/api/code', headers: { host: 'evil.example:' + PORT, cookie: ck } }, res => { res.resume(); r(res.statusCode); }).on('error', () => r(0)));
    eq(rebound, 421, 'DNS rebinding with the right cookie → 421');
  });

  await step('MQTT over TLS: right password, status of connected moderators, wrong password', async () => {
    const { pass } = await host.api('/api/code');
    const good = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass);
    check(good.ok, 'right password connects: ' + good.err);
    await sleep(300);
    const st = await host.api('/api/status');
    check(st.mods === 1 && st.modList.length === 1 && st.modList[0].net === 'porthole', 'status lists the moderator with its network: ' + JSON.stringify(st.modList));
    const st2 = await until(async () => { const x = await host.api('/api/status'); return typeof x.modList[0]?.rtt === 'number' && x; }, 8000);
    check(st2, 'latency measured by ws ping: ' + st2?.modList[0]?.rtt + ' ms');
    good.c.end(true);
    const bad = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, 'wrong');
    check(!bad.ok, 'wrong password refused: ' + bad.err);
  });

  await step('password limits: loopback (Porthole) is rate-limited but the real password still works', async () => {
    const { pass } = await host.api('/api/code');
    await sleep(100);
    const codes = [];
    for(let i = 0; i < 7; i++) codes.push((await fetch(`https://127.0.0.1:${MPORT}/files`, { headers: { authorization: 'Bearer nope' + i } })).status);
    // the wrong MQTT password above already used one of the five
    eq(codes, [401, 401, 401, 401, 429, 429, 429], 'five wrong passwords a minute, then 429');
    eq((await fetch(`https://127.0.0.1:${MPORT}/files`, { headers: { authorization: 'Bearer ' + pass } })).status, 200, 'the real password is not locked out (one guest cannot lock the others)');
  });

  await step('cf-connecting-ip is not trusted: the address comes from the socket', async () => {
    if(!lan){ console.log('  (no non-loopback IPv4 address here: skipped)'); return; }
    const codes = [];
    for(let i = 0; i < 7; i++) codes.push((await fetch(`https://${lan.address}:${MPORT}/files`, { headers: { authorization: 'Bearer nope' + i, 'cf-connecting-ip': `203.0.113.${i + 1}`, 'x-forwarded-for': `198.51.100.${i + 1}` } })).status);
    eq(codes, [401, 401, 401, 401, 401, 429, 429], 'rotating spoofed addresses does not reset the per-address lock');
  });

  await step('pause and "let moderators in" switch', async () => {
    const { pass } = await host.api('/api/code');
    await host.api('/api/mods', { on: false });
    const off = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass);
    check(!off.ok, 'moderators refused while the switch is off: ' + off.err);
    eq((await fetch(`https://127.0.0.1:${MPORT}/files`, { headers: { authorization: 'Bearer ' + pass } })).status, 503, 'files API also closed');
    await host.api('/api/mods', { on: true });
    const on = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass);
    check(on.ok, 'moderators come back when it is on'); on.c.end(true);
    const before = (await host.api('/api/code')).pass;
    const joined = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, before);
    let dropped = false; joined.c.on('close', () => { dropped = true; });
    const n = await host.api('/api/code/new', {});
    check(await until(() => dropped, 4000), 'new code drops connected moderators');
    check((await host.api('/api/code')).pass !== before, 'password changed');
    check(!(await dial(`wss://127.0.0.1:${MPORT}/mqtt`, before)).ok, 'old code no longer works');
    check(n.code.startsWith('hudini1:'), 'new code returned');
  });

  await step('own address (port forwarding) goes into the code', async () => {
    await host.api('/api/extaddr', { addr: 'my-pc.example.com:7778' });
    check((await host.code()).data.addrs.some(a => a.h === 'my-pc.example.com' && a.port === 7778 && a.net === 'ext'), 'external address in the code');
    const bad = await fetch(A + '/api/extaddr', { method: 'POST', headers: { 'x-hudini-token': T.ADMIN_TOKEN, 'content-type': 'application/json', origin: A }, body: JSON.stringify({ addr: 'wss://x/mqtt' }) });
    eq(bad.status, 400, 'a wrong format is refused');
    await host.api('/api/extaddr', { addr: '' });
  });

  await step('new room: new keys, new password, old OBS link is gone', async () => {
    const a = await host.code(), obs0 = (await host.api('/api/status')).obsLink;
    const r = await host.api('/api/room/new', { name: 'etsuitoku' });
    const b = await host.code();
    check(r.ok && b.data.room !== a.data.room && b.data.k !== a.data.k && b.data.pass !== a.data.pass && b.data.name === 'etsuitoku', 'room, keys, password and name changed');
    check(r.obsLink && r.obsLink !== obs0, 'new OBS link');
  });

  await step('an upload cut off mid-body does not crash the Host', async () => {
    const { pass } = await host.api('/api/code');
    for(let i = 0; i < 3; i++) await new Promise(res => {
      const s = tls.connect({ host: '127.0.0.1', port: MPORT, rejectUnauthorized: false }, () => {
        s.write(`PUT /files/abort${i}xyz12?part=0&last=1 HTTP/1.1\r\nHost: x\r\nAuthorization: Bearer ${pass}\r\nContent-Length: 100000\r\n\r\n`);
        s.write(Buffer.alloc(1000));
        setTimeout(() => { s.destroy(); res(); }, 200);
      });
      s.on('error', res);
    });
    await sleep(800);
    eq(host.proc.exitCode, null, 'Host still running');
    eq((await fetch(`https://127.0.0.1:${MPORT}/ping`)).status, 200, 'moderators\' port still answers');
    const st = await host.api('/api/status');
    check(st.storage && st.storage.used === 0, 'nothing half-written is counted: ' + JSON.stringify(st.storage));
  });

  await step('moderators\' port: no memory for clients that have not logged in', async () => {
    const WebSocket = require('ws');
    const rss = () => { try{ return Number(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${host.proc.pid}/status`, 'utf8'))[1]) / 1024; }catch{ return 0; } };
    const varint = n => { const v = []; do{ let b = n % 128; n = Math.floor(n / 128); if(n) b |= 128; v.push(b); }while(n); return v; };
    // opens a socket, sends the CONNECT header with the declared length, then `chunks` frames; resolves with what happened
    const flood = (url, declared, chunk, chunks) => new Promise(res => {
      const ws = new WebSocket(url, 'mqtt', { rejectUnauthorized: false }); let sent = 0; const t0 = Date.now();
      ws.on('error', () => {}); ws.on('close', () => res({ closed: true, sent, ms: Date.now() - t0 }));
      ws.on('open', async () => {
        ws.send(Buffer.from([0x10, ...varint(declared)]));
        for(let k = 0; k < chunks && ws.readyState === 1; k++){ ws.send(Buffer.alloc(chunk)); sent += chunk; await sleep(30); }
        await sleep(1500); if(ws.readyState === 1){ ws.terminate(); res({ closed: false, sent }); }
      });
    });
    const url = `wss://127.0.0.1:${MPORT}/mqtt`;
    const small = await flood(url, 10 * 1048576, 8192, 40);   // declares 10 MB, trickles 320 KB
    check(small.closed && small.sent <= 128 * 1024, 'cut off after ~64 KB without a password: ' + JSON.stringify(small));
    const before = rss();
    const big = await Promise.all([0, 1, 2].map(() => flood(url, 250 * 1048576, 15 * 1048576, 16)));   // declares 250 MB in 15 MB frames
    check(big.every(x => x.closed), 'a 250 MB CONNECT is dropped: ' + JSON.stringify(big));
    await sleep(500);
    if(before) check(rss() - before < 150, `memory stays flat: ${Math.round(before)} → ${Math.round(rss())} MB`);
    eq(host.proc.exitCode, null, 'Host still running');
    // a moderator with the password still sends a large screen state (over the 64 KB limit)
    const { pass } = await host.api('/api/code'), room = (await host.api('/api/status')).room;
    const a = await dial(url, pass), b = await dial(url, pass);
    check(a.ok && b.ok, 'moderators connect');
    const topic = `stream-overlay/v1/${room}/state`, size = 12 * 1048576;
    const got = new Promise(r => { b.c.on('message', (t, m) => { if(t === topic) r(m.length); }); });
    await new Promise(r => b.c.subscribe(topic, r));
    a.c.publish(topic, Buffer.alloc(size, 7));
    eq(await Promise.race([got, sleep(15000).then(() => 'timeout')]), size, '12 MB state goes through after login');
    a.c.end(true); b.c.end(true);
    if(lan){
      const opened = [];
      for(let i = 0; i < 10; i++) opened.push(await new Promise(r => {
        const ws = new WebSocket(`wss://${lan.address}:${MPORT}/mqtt`, 'mqtt', { rejectUnauthorized: false });
        ws.on('open', () => r(ws)); ws.on('error', () => r(null));
      }));
      eq(opened.map(Boolean).filter(Boolean).length, 8, 'at most 8 connections from one non-loopback address');
      opened.forEach(ws => ws && ws.terminate());
    }
    await sleep(300);
    const idle = [];
    for(let i = 0; i < 18; i++) idle.push(await new Promise(r => {
      const ws = new WebSocket(url, 'mqtt', { rejectUnauthorized: false });
      ws.on('open', () => r(ws)); ws.on('error', () => r(null));
    }));
    eq(idle.filter(Boolean).length, 16, 'at most 16 connections waiting for login at once');
    idle.forEach(ws => ws && ws.terminate());
    await sleep(300);
    const again = await dial(url, pass);
    check(again.ok, 'a moderator logs in once they are gone'); again.c.end(true);
  });

  await step('journal: events without duplicates, addresses only masked', async () => {
    const { pass } = await host.api('/api/code');
    const file = () => fs.readFileSync(path.join(host.dir, 'logs', fs.readdirSync(path.join(host.dir, 'logs')).find(f => /^host-\d{4}-\d\d-\d\d\.log$/.test(f))), 'utf8');
    const count = re => (file().match(re) || []).length;
    const from = file().length;   // earlier steps log their own connections; only this step's lines are checked for repeats
    const gsiToken = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8')).gsiToken;
    // CS2: one packet; "appeared" now, "gone" after the 15 s threshold (checked every 5 s), watched at the end
    await fetch(`http://127.0.0.1:${PORT}/gsi`, { method: 'POST', headers: { host: `127.0.0.1:${PORT}` }, body: JSON.stringify({
      provider: { steamid: '1' }, map: { name: 'de_dust2', mode: 'competitive', round: 0, phase: 'live', team_ct: { score: 0 }, team_t: { score: 0 } }, round: { phase: 'live' },
      player: { steamid: '1', name: 'me', team: 'CT', state: { health: 100 }, match_stats: {} }, auth: { token: gsiToken } }) });
    const cs2At = Date.now();
    // the "let moderators in" line is written only when the switch changes; polling the status never writes it
    const sw = () => count(/Модераторов (пускаю|не пускаю)/g);
    await host.api('/api/mods', { on: true }); await host.api('/api/status'); await host.api('/api/status');
    const n0 = sw();
    await host.api('/api/mods', { on: true });
    eq(sw(), n0, 'the same value again writes nothing');
    await host.api('/api/mods', { on: false });
    eq(sw(), n0 + 1, 'switching off writes one line');
    const refused = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass);
    check(!refused.ok, 'refused while the switch is off');
    const refused2 = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass);
    check(!refused2.ok, 'refused again');
    await sleep(300);
    eq(count(/Отказ входа: 127\.x\.x\.1 \(Porthole\) — вход закрыт/g), 1, 'the refusal is logged once with the reason, the address masked, even when repeated at once');
    await host.api('/api/mods', { on: true });
    eq(sw(), n0 + 2, 'switching on writes one more line');
    // a moderator: connect and disconnect with the way of connecting and the time on line
    const m = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass); check(m.ok, 'moderator connects');
    await sleep(300); m.c.end(true);
    check(await until(() => /Модератор отключился: 127\.x\.x\.1 \(Porthole\) — на связи \d+ с/.test(file())), 'moderator leaving is logged with the time on line');
    eq(count(/Модератор подключился: 127\.x\.x\.1 \(Porthole\)/g) >= 1, true, 'moderator joining is logged with the masked address and the network');
    // the OBS widget: 0 → 1 once, a page reload (back within 5 s) does not write "dropped"
    const obs = () => new Promise(r => { const c = mqtt.connect(`ws://localhost:${PORT}/mqtt`, { reconnectPeriod: 0 }); c.on('connect', () => r(c)); });
    const o1 = await obs(); await sleep(200);
    eq(count(/Виджет OBS подключился/g), 1, 'widget joining is logged');
    o1.end(true); await sleep(1000);
    const o2 = await obs(); await sleep(6500);
    eq([count(/Виджет OBS подключился/g), count(/Виджет OBS отвалился/g)], [1, 0], 'a reload within 5 s writes neither "joined" nor "dropped"');
    o2.end(true);
    check(await until(() => /Виджет OBS отвалился/.test(file()), 9000), 'the widget staying away is logged after 5 s');
    eq(count(/Виджет OBS отвалился/g), 1, 'dropped once');
    // wrong password / many attempts
    for(let i = 0; i < 3; i++) await dial(`wss://127.0.0.1:${MPORT}/mqtt`, 'wrong' + i);
    check(/Отказ входа: 127\.x\.x\.1 \(Porthole\) — неверный пароль/.test(file()), 'a wrong password is logged as a refusal');
    // pause
    await host.api('/api/control', { action: 'pause' });
    const paused = await dial(`wss://127.0.0.1:${MPORT}/mqtt`, pass); check(!paused.ok, 'refused on pause');
    await host.api('/api/control', { action: 'resume' });
    check(/Отказ входа: .* — пауза модераторов/.test(file()), 'pause is logged as a reason');
    // addresses: masked everywhere, own address too
    await host.api('/api/extaddr', { addr: 'my-pc.example.com:7778' });
    await host.api('/api/extaddr', { addr: '203.0.113.45:7778' });
    await host.api('/api/extaddr', { addr: '' });
    const text = file();
    check(!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(text), 'no full IPv4 address in the journal: ' + (text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/) || [''])[0]);
    check(!text.includes('my-pc') && !text.includes('203.0.113.45') && (!lan || !text.includes(lan.address)), 'the own address and the LAN address are masked');
    check(/Свой внешний адрес: 203\.x\.x\.45:7778/.test(text) && /Адреса для модераторов: .*127\.x\.x\.1:\d+ porthole/.test(text), 'masked forms are used');
    // CS2: appears at once, goes away 15 s without packets
    check(/CS2 появился/.test(file()), 'CS2 appearing is logged');
    check(await until(() => /CS2 пропал/.test(file()), Math.max(1000, 22000 - (Date.now() - cs2At)), 500), 'CS2 going silent is logged');
    eq([count(/CS2 появился/g), count(/CS2 пропал/g)], [1, 1], 'CS2 events once each');
    // no line twice in a row
    const lines = file().slice(from).split('\n').map(l => l.replace(/^\S+\s+/, '')).filter(Boolean);
    const twin = lines.find((l, i) => i > 0 && l === lines[i - 1]);
    check(!twin, 'no identical neighbouring lines: ' + twin);
  });

  await step('logs on disk and no crash log after a normal exit', async () => {
    const dir = path.join(host.dir, 'logs'), files = fs.readdirSync(dir);
    const main = files.find(f => /^host-\d{4}-\d\d-\d\d\.log$/.test(f));
    check(main, 'host-YYYY-MM-DD.log exists');
    const text = fs.readFileSync(path.join(dir, main), 'utf8');
    check(/\[conn\].*Модератор подключился/.test(text) && /\[conn\].*Отказ входа.*неверный пароль/.test(text), 'connections and wrong passwords are logged');
    check(!/hudini1:/.test(text) && !text.includes((await host.api('/api/code')).pass), 'no passwords or codes in the log');
    const st = await host.api('/api/status');
    check(st.connLogs.length > 0 && st.connLogs.every(l => /Модератор|пароль|Подбор|Отключил|модератор|Отказ входа|Виджет OBS|CS2|Модераторов/i.test(l)), 'status has a connections-only log');
    await host.stop();
    check(!fs.readdirSync(dir).some(f => f.startsWith('crash-')), 'SIGTERM is not a crash');
  });

  await step('app mode: the entry token is single-use', async () => {
    const h2 = T.startHost({ OVERLAY_PORT: String(PORT + 10), OVERLAY_APP: '1', OVERLAY_APP_TOKEN: 'apptoken123', OVERLAY_ADMIN_TOKEN: '', OVERLAY_SITE: 'off' });
    await h2.ready();
    const B = `http://127.0.0.1:${PORT + 10}`;
    eq((await fetch(B + '/auth?t=apptoken123', { redirect: 'manual' })).status, 200, 'the window gets in with the app token');
    eq((await fetch(B + '/auth?t=apptoken123', { redirect: 'manual' })).status, 403, 'the same token a second time → 403');
    eq((await fetch(B + '/api/status', { headers: { 'x-hudini-token': 'apptoken123' } }).then(r => r.json())).role, 'streamer', 'the app itself can read the status with the header');
    check(!/auth\?t=/.test(h2.log()), 'no login link on stdout (the app copies it into crash reports)');
    await h2.stop();
  });

  await step('moderator role: no ports are opened', async () => {
    const h3 = T.startHost({ OVERLAY_PORT: String(PORT + 20), OVERLAY_APP: '1', OVERLAY_APP_TOKEN: 'modtoken123', OVERLAY_ADMIN_TOKEN: '', OVERLAY_ROLE: 'mod', OVERLAY_SITE: 'off' });
    check(await until(() => /modtoken123 READY 0/.test(h3.log()), 15000), 'reports READY 0 on stdout');
    await sleep(500);
    const open = port => new Promise(r => require('net').connect({ host: '127.0.0.1', port }).on('connect', function(){ this.destroy(); r(true); }).on('error', () => r(false)));
    eq([await open(PORT + 20), await open(PORT + 21)], [false, false], 'neither the management port nor the moderators\' port listens');
    await h3.stop();
  });

  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
