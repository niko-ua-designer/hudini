// A moderator who changes network: the panel proves with its resume secret that it is the same one and takes its place at once.
// Without the matching secret (from any address), or with a wrong password, the busy clientId is refused.
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), os = require('os');
const mqtt = require('mqtt');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel, host, web } = S;
  const socks = [];
  // a pass-through proxy that reaches the Host from its own address; freeze() cuts the panel's side and leaves the Host's side
  // open and silent, like a network that is gone
  const proxy = async () => {
    const mine = [], p = { from: '127.0.0.1' };
    const srv = net.createServer(c => {
      const up = net.connect({ host: '127.0.0.1', port: host.modPort, localAddress: p.from }); mine.push([c, up]); socks.push(c, up);
      c.pipe(up); up.pipe(c); c.on('error', () => {}); up.on('error', () => c.destroy());
      c.on('close', () => { if(!up.frozen) up.destroy(); }); up.on('close', () => c.destroy());
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    p.port = srv.address().port; p.url = `wss://127.0.0.1:${p.port}/mqtt`;
    p.freeze = () => { for(const [c, up] of mine.splice(0)){ up.frozen = true; up.unpipe(c); c.unpipe(up); up.pause(); c.destroy(); } };
    p.close = () => srv.close();
    return p;
  };
  const { pass } = await host.api('/api/code');
  const A = await proxy(), B = await proxy(); B.from = '127.0.0.2';
  const secret = 'resumeSecretAAAAAAAAAAAAAAAAAAAA', other = 'resumeSecretBBBBBBBBBBBBBBBBBBBB';
  const open = (via, id, resume, password = pass) => new Promise(res => {
    const c = mqtt.connect(via.url + (resume ? '?resume=' + resume : ''), { clientId: id, username: 'mod', password, reconnectPeriod: 0, connectTimeout: 4000, keepalive: 30, rejectUnauthorized: false });
    const r = { c, closed: false }; c.on('close', () => { r.closed = true; res({ ...r, ok: false }); });
    c.on('connect', () => { r.ok = true; res(r); }); c.on('error', e => { r.err = String(e.message); c.end(true); res(Object.assign(r, { ok: false })); });
  });
  const mods = async () => (await host.api('/api/status')).modList.filter(m => !m.me).length;
  const base = await mods();   // the stack's own panel

  await step('the same secret from another address replaces the old connection', async () => {
    const old = await open(A, 'mod_moving', secret);
    check(old.ok, 'in');
    const no = await open(B, 'mod_moving');
    check(!no.ok && !old.closed, 'no secret from another address: refused: ' + no.err);
    const wrong = await open(B, 'mod_moving', other);
    check(!wrong.ok && !old.closed, 'a wrong secret: refused: ' + wrong.err);
    const bad = await open(B, 'mod_moving', secret, 'wrong');
    await sleep(500);
    check(!bad.ok && !old.closed, 'the right secret with a wrong password: refused, the old one stays: ' + bad.err);
    eq(await mods(), base + 1, 'one moving moderator on the list');
    const now = await open(B, 'mod_moving', secret);
    check(now.ok, 'the right secret and password get in: ' + now.err);
    check(await until(() => old.closed, 4000), 'the old connection is closed');
    eq(await mods(), base + 1, 'still one on the list');
    await sleep(18000);   // longer than the Host waits for a silent connection
    check(!now.closed && now.c.connected, 'the new connection stays');
    const m = (await host.api('/api/status')).modList.filter(x => !x.me);
    check(m.length === base + 1 && m.every(x => typeof x.rtt === 'number'), 'and is still listed and pinged: ' + JSON.stringify(m));
    now.c.end(true);
    check(await until(async () => (await mods()) === base, 4000), 'leaves the list when it leaves');
  });

  await step('a panel with a secret is not replaced from its own address without it', async () => {
    const old = await open(A, 'mod_samenat', secret);
    check(old.ok, 'in');
    const no = await open(A, 'mod_samenat');
    check(!no.ok && !old.closed, 'no secret from the same address: refused: ' + no.err);
    const wrong = await open(A, 'mod_samenat', other);
    check(!wrong.ok && !old.closed, 'a wrong secret from the same address: refused: ' + wrong.err);
    const now = await open(A, 'mod_samenat', secret);
    check(now.ok, 'the same panel reconnects from its address: ' + now.err);
    check(await until(() => old.closed, 4000), 'the old connection is closed');
    eq(await mods(), base + 1, 'listed once');
    now.c.end(true);
    check(await until(async () => (await mods()) === base, 4000), 'leaves the list when it leaves');
  });

  await step('media approval is not inherited: the new connection asks the streamer again', async () => {
    await host.api('/api/perms', { perms: { cam: true } });
    const room = (await host.api('/api/status')).room;
    const offer = (c, sid) => { const head = Buffer.from(JSON.stringify({ v: 1, sid, kind: 'cam', t: 'offer', to: 'widget' })), len = Buffer.alloc(2); len.writeUInt16BE(head.length); c.publish(`stream-overlay/v1/${room}/rtc`, Buffer.concat([len, head, Buffer.alloc(60, 1)])); };
    const media = async () => (await host.api('/api/status')).media;
    const old = await open(A, 'mod_cam', secret);
    offer(old.c, 'sidoneaaaaaa');
    const ask = await until(async () => (await media()).pending[0]);
    await host.api('/api/control', { action: 'mediaallow', key: ask?.key });
    offer(old.c, 'sidoneaaaaaa');
    check(await until(async () => (await media()).live.length === 1), 'the camera is live');
    const now = await open(B, 'mod_cam', secret);
    check(now.ok, 'back from another address');
    check(await until(async () => (await media()).live.length === 0), 'the old stream ended');
    offer(now.c, 'sidtwoaaaaaa');
    check(await until(async () => (await media()).pending.length === 1), 'a new request waits for the streamer');
    await sleep(500);
    eq((await media()).pending.length, 1, 'and nothing removed it');
    now.c.end(true);
  });

  await step('an old panel without a secret is never replaced from another address', async () => {
    const old = await open(A, 'mod_oldpanel');
    const no = await open(B, 'mod_oldpanel', secret);
    check(!no.ok && !old.closed, 'refused: ' + no.err);
    const again = await open(A, 'mod_oldpanel');
    check(again.ok, 'the same address reconnects as before');
    again.c.end(true);
  });

  await step('the panel changes network and is back within seconds', async () => {
    const P = await proxy();
    await T.attach(panel, { api: p => host.api(p), modPort: P.port });
    const online = async () => (await panel.getAttribute('#status', 'class')).includes('ok') && panel.evaluate(() => !!client?.connected);
    check(await until(online, 15000), 'online through the first network');
    const id = await panel.evaluate(() => client.options.clientId);
    P.from = '127.0.0.2'; P.freeze(); const at = Date.now();
    check(await until(async () => !(await panel.evaluate(() => !!client?.connected)), 5000, 50), 'the connection is lost');
    check(await until(online, 25000), 'online again');
    const took = (Date.now() - at) / 1000;
    check(took < 9, 'without waiting for the old connection to time out: ' + took.toFixed(1) + ' s');
    eq(await panel.evaluate(() => client.options.clientId), id, 'under the same clientId');
    eq(await mods(), 1, 'listed once');
    P.close();
  });

  await step('the secret is not logged or published', async () => {
    const sent = await panel.evaluate(() => RESUME);
    check(/^[a-z0-9]{32}$/.test(sent), 'the panel has a random secret');
    const dir = path.join(host.dir, 'logs');
    const all = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + host.log() + JSON.stringify(await host.api('/api/status'))
      + fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8');
    eq([sent, secret, other].filter(x => all.includes(x) || all.includes('resume=')), [], 'neither in the logs, the status nor the settings');
    eq(await panel.evaluate(() => JSON.stringify([homeInfo, Object.entries(localStorage)]).includes(RESUME)), false, 'and the panel does not store it');
  });

  for(const s of socks) s.destroy();
  A.close(); B.close(); await host.stop(); await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
