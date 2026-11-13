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
    check(ok.status === 302 && /hudini_admin=/.test(cookie) && /HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie), 'right token → cookie HttpOnly, SameSite=Strict: ' + cookie);
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

  await step('logs on disk and no crash log after a normal exit', async () => {
    const dir = path.join(host.dir, 'logs'), files = fs.readdirSync(dir);
    const main = files.find(f => /^host-\d{4}-\d\d-\d\d\.log$/.test(f));
    check(main, 'host-YYYY-MM-DD.log exists');
    const text = fs.readFileSync(path.join(dir, main), 'utf8');
    check(/\[conn\].*Модератор подключился/.test(text) && /\[conn\].*Неверный пароль/.test(text), 'connections and wrong passwords are logged');
    check(!/hudini1:/.test(text) && !text.includes((await host.api('/api/code')).pass), 'no passwords or codes in the log');
    const st = await host.api('/api/status');
    check(st.connLogs.length > 0 && st.connLogs.every(l => /Модератор|пароль|Подбор|Отключил|модератор/i.test(l)), 'status has a connections-only log');
    await host.stop();
    check(!fs.readdirSync(dir).some(f => f.startsWith('crash-')), 'SIGTERM is not a crash');
  });

  await step('app mode: the entry token is single-use', async () => {
    const h2 = T.startHost({ OVERLAY_PORT: String(PORT + 10), OVERLAY_APP: '1', OVERLAY_APP_TOKEN: 'apptoken123', OVERLAY_ADMIN_TOKEN: '', OVERLAY_SITE: 'off' });
    await h2.ready();
    const B = `http://127.0.0.1:${PORT + 10}`;
    eq((await fetch(B + '/auth?t=apptoken123', { redirect: 'manual' })).status, 302, 'the window gets in with the app token');
    eq((await fetch(B + '/auth?t=apptoken123', { redirect: 'manual' })).status, 403, 'the same token a second time → 403');
    eq((await fetch(B + '/api/status', { headers: { 'x-hudini-token': 'apptoken123' } }).then(r => r.json())).role, 'streamer', 'the app itself can read the status with the header');
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
