// Chunked upload PUT /files/<id>?part=N: retries, order, failures and quota
'use strict';
const T = require('./lib');
const { step, check, eq } = T;
const PORT = 17810 + Number(process.env.HUDINI_TEST_PORT_OFFSET || 0) + 40;

(async () => {
  const host = T.startHost({ OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off' });
  await host.ready();
  const { pass } = await host.code();
  const put = (id, part, body, last) => fetch(`${host.base}/files/${id}?part=${part}${last ? '&last=1' : ''}`,
    { method: 'PUT', headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/octet-stream' }, body });
  const get = async id => Buffer.from(await (await fetch(`${host.base}/files/${id}`)).arrayBuffer());
  const used = async () => (await (await fetch(`${host.base}/files`, { headers: { authorization: 'Bearer ' + pass } })).json()).storage.used;
  const A = Buffer.alloc(1000, 1), B = Buffer.alloc(700, 2), C = Buffer.alloc(300, 3);

  await step('multi-part upload gives the exact bytes', async () => {
    eq((await put('multiaaaaaaaaaa', 0, A)).status, 200, 'part 0');
    eq((await put('multiaaaaaaaaaa', 1, B)).status, 200, 'part 1');
    const r = await put('multiaaaaaaaaaa', 2, C, true);
    eq([r.status, (await r.json()).size], [200, 2000], 'last part, total size');
    check((await get('multiaaaaaaaaaa')).equals(Buffer.concat([A, B, C])), 'bytes match');
  });

  await step('a repeated part does not corrupt the file', async () => {
    const id = 'retryaaaaaaaaaa';
    await put(id, 0, A);
    const r1 = await (await put(id, 1, B)).json(), r2 = await put(id, 1, B);
    eq([r2.status, (await r2.json()).size], [200, r1.size], 'repeat of part 1 answers the same');
    const r0 = await put(id, 1, B);
    eq(r0.status, 200, 'and again');
    const f = await put(id, 2, C, true), f2 = await put(id, 2, C, true);
    eq([f.status, f2.status, (await f2.json()).size], [200, 200, 2000], 'repeat of the last part is fine too');
    check((await get(id)).equals(Buffer.concat([A, B, C])), 'bytes match, nothing doubled');
  });

  await step('out-of-order parts give 409', async () => {
    const id = 'orderaaaaaaaaaa';
    eq((await put(id, 1, B)).status, 409, 'part 1 without part 0');
    await put(id, 0, A);
    eq((await put(id, 2, C)).status, 409, 'skipping a part');
    eq((await put(id, 1, B)).status, 200, 'the upload is still alive after a refused part');
    eq((await put(id, 2, C, true)).status, 200, 'and finishes');
    check((await get(id)).equals(Buffer.concat([A, B, C])), 'bytes match');
  });

  await step('a restarted part 0 starts cleanly', async () => {
    const id = 'restartaaaaaaaa';
    await put(id, 0, A); await put(id, 1, B);
    await put(id, 0, C);                     // different size = a restart
    eq((await put(id, 1, B, true)).status, 200, 'finish');
    check((await get(id)).equals(Buffer.concat([C, B])), 'old bytes are gone');
  });

  await step('an abandoned or failed upload is not counted twice', async () => {
    const before = await used();
    await put('abandonaaaaaaaa', 0, A);
    eq(await used(), before + 1000, 'unfinished part counts');
    eq((await put('abandonaaaaaaaa', 1, B, true)).status, 200, 'the other upload completes');
    eq(await used(), before + 1700, 'only finished bytes remain');
  });

  await step('moderators on pause can still read files but cannot upload, delete or clean; the streamer side keeps working', async () => {
    const https = require('https');
    const mreq = (method, p, body) => new Promise((ok, no) => { const r = https.request({ host: '127.0.0.1', port: host.modPort, path: p, method, rejectUnauthorized: false, headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/octet-stream' } }, res => { res.resume(); res.on('end', () => ok(res.statusCode)); }); r.on('error', no); r.end(body); });
    eq(await mreq('PUT', '/files/modpauseaaaaaaa?part=0&last=1', A), 200, 'before the pause a moderator uploads');
    await host.api('/api/control', { action: 'pause' });
    eq(await mreq('PUT', '/files/modpausebbbbbbb?part=0&last=1', A), 423, 'upload refused');
    eq(await mreq('DELETE', '/files/modpauseaaaaaaa'), 423, 'delete refused');
    eq(await mreq('POST', '/files/clean', '{}'), 423, 'clean refused');
    eq(await mreq('GET', '/files'), 200, 'the listing still works');
    eq(await mreq('GET', '/files/modpauseaaaaaaa'), 200, 'a file can still be read');
    eq((await put('streameraaaaaaaa', 0, A, true)).status, 200, 'the streamer side still uploads');
    await host.api('/api/control', { action: 'resume' });
    eq(await mreq('DELETE', '/files/modpauseaaaaaaa'), 200, 'after resume delete works');
  });

  await step('the Host log does not contain the user name from the settings folder path', async () => {
    const fs = require('fs'), os = require('os'), path = require('path');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-home-')), user = path.join(home, 'SecretPerson');
    fs.mkdirSync(path.join(user, 'data'), { recursive: true });
    const h2 = T.startHost({ OVERLAY_PORT: String(PORT + 10), OVERLAY_SITE: 'off', HOME: user, USERPROFILE: user, OVERLAY_HOST_DIR: path.join(user, 'data') });
    await h2.ready(); await T.sleep(500);
    const lg = h2.log();
    check(/Папка настроек: ~/.test(lg) || !/Папка настроек/.test(lg), 'the settings folder is shown with ~', lg.split('\n').filter(x => /настроек/.test(x)).join('|'));
    check(!/SecretPerson/.test(lg), 'the user name is not in the log');
    check(!/SecretPerson/.test(fs.readdirSync(path.join(user, 'data', 'logs')).map(f => fs.readFileSync(path.join(user, 'data', 'logs', f), 'utf8')).join('')), 'nor in the log file');
    await h2.stop();
  });

  await host.stop();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
