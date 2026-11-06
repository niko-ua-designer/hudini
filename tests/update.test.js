// Self-update of Hudini Host: a compiled rc build updates to the stable release from a fake GitHub,
// verifies SHA-256, ignores old host-v tags and v0.x betas, refuses a tampered download, and a stable build ignores rc releases.
// App mode (window and tray, OVERLAY_APP): picks the new HudiniHost-<os>-<ver>.zip, unpacks every file and relaunches the app.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const T = require('./lib');
const { step, check, eq, until } = T;
const HOST = path.join(T.ROOT, 'host');
const ASSET = { linux:'HudiniHost-linux', darwin: os.arch() === 'arm64' ? 'HudiniHost-mac-arm64' : 'HudiniHost-mac-intel', win32:'HudiniHost-windows.exe' }[process.platform];

// Test signing key: builds get its public half instead of the real one, the fake GitHub signs with the private half
const KEYS = crypto.generateKeyPairSync('ed25519');
const PUB = KEYS.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const signFor = (ver, sums) => crypto.sign(null, Buffer.from(`hudini-update\n${ver}\n${sums}`), KEYS.privateKey).toString('base64');
function build(version, out){
  const src = fs.readFileSync(path.join(HOST, 'server.js'), 'utf8').replace(/^const VERSION = '[^']+';/m, `const VERSION = '${version}';`)
    .replace(/^const UPDATE_KEY = '[^']*';/m, `const UPDATE_KEY = '${PUB}';`);
  const tmp = path.join(HOST, `.update-test-${version}.js`);
  fs.writeFileSync(tmp, src);
  try{ execFileSync('bun', ['build', '--compile', tmp, '--outfile', out], { cwd: HOST, stdio: 'pipe' }); }
  finally{ fs.rmSync(tmp, { force: true }); }
}
function crc32(data){
  let x = 0xFFFFFFFF;
  for(const b of data){ x ^= b; for(let k = 0; k < 8; k++) x = x & 1 ? 0xEDB88320 ^ (x >>> 1) : x >>> 1; }
  return (x ^ 0xFFFFFFFF) >>> 0;
}
// Minimal stored zip. entries: [{ name, data?, mode? }]; a name ending in / is a folder; mode = unix permissions
function zipMany(entries){
  const loc = [], cen = []; let off = 0;
  for(const e of entries){
    const data = e.data || Buffer.alloc(0), nameB = Buffer.from(e.name), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(e.mode ? (3 << 8) | 20 : 20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameB.length, 28);
    if(e.mode) cd.writeUInt32LE(((e.name.endsWith('/') ? 0o040000 : 0o100000) | e.mode) * 65536 >>> 0, 38);
    cd.writeUInt32LE(off, 42);
    loc.push(lh, nameB, data); cen.push(cd, nameB); off += 30 + nameB.length + data.length;
  }
  const cdBuf = Buffer.concat(cen);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...loc, cdBuf, eocd]);
}
const zipOne = (file, name) => zipMany([{ name, data: fs.readFileSync(file) }]);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-upd-'));
  const rel = path.join(dir, 'rel'), app = path.join(dir, 'app'); fs.mkdirSync(rel); fs.mkdirSync(app);
  console.log('building two Host versions (takes a little while)…');
  build('1.0.0-rc.1', path.join(app, ASSET));
  build('1.0.0', path.join(rel, ASSET));
  const zip = zipOne(path.join(rel, ASSET), 'Hudini Host/' + ASSET);   // same layout as the portable release zip
  fs.writeFileSync(path.join(rel, ASSET + '.zip'), zip);
  // New release layout (app with window and tray): HudiniHost-<os>-<version>.zip, folder «Hudini Host/» with several files
  const APP_OS = { linux:'linux', darwin: os.arch() === 'arm64' ? 'mac-arm64' : 'mac-intel', win32:'windows' }[process.platform];
  const APP_ZIP = `HudiniHost-${APP_OS}-1.0.zip`;
  const newServer = fs.readFileSync(path.join(rel, ASSET));
  const fakeApp = '#!/bin/sh\necho "$@" > "$(dirname "$0")/launched.txt"\n';   // the new «app»: records how it was started
  const appZip = zipMany([
    { name: 'Hudini Host/', mode: 0o755 },
    { name: 'Hudini Host/Hudini Host', data: Buffer.from(fakeApp), mode: 0o755 },
    { name: 'Hudini Host/hudini-server', data: newServer },   // no unix mode: made executable by name
    { name: 'Hudini Host/README.txt', data: Buffer.from('new readme') },
    { name: 'Hudini Host/data/' },
    { name: 'Hudini Host/data/overlay-host.json', data: Buffer.from('{"modPass":"from-zip"}') },
  ]);
  fs.writeFileSync(path.join(rel, APP_ZIP), appZip);
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  let sums = sha(zip) + '  ' + ASSET + '.zip\n' + sha(appZip) + '  ' + APP_ZIP + '\n';
  let list = [], sigVer = '1.0.0', sigMode = 'ok';   // sigMode: ok | bad (signed by another key) | none
  const port = 19300, url = f => `http://localhost:${port}/${f}`;
  const assets = [{ name: APP_ZIP, browser_download_url: url(APP_ZIP) }, { name: ASSET + '.zip', browser_download_url: url(ASSET + '.zip') }, { name: 'SHA256SUMS.txt', browser_download_url: url('SHA256SUMS.txt') }, { name: 'SHA256SUMS.txt.sig', browser_download_url: url('SHA256SUMS.txt.sig') }];
  // the app-mode install starts from the same rc build
  const inst = path.join(dir, 'Hudini Host'); fs.mkdirSync(path.join(inst, 'data'), { recursive: true });
  fs.copyFileSync(path.join(app, ASSET), path.join(inst, 'hudini-server')); fs.chmodSync(path.join(inst, 'hudini-server'), 0o755);
  fs.writeFileSync(path.join(inst, 'Hudini Host'), '#!/bin/sh\necho old app\n', { mode: 0o755 });
  fs.writeFileSync(path.join(inst, 'README.txt'), 'old readme');
  const srv = http.createServer((q, s) => {
    if(q.url === '/releases'){ s.setHeader('content-type', 'application/json'); return s.end(JSON.stringify(list)); }
    if(q.url === '/SHA256SUMS.txt') return s.end(sums);
    if(q.url === '/SHA256SUMS.txt.sig'){
      if(sigMode === 'none'){ s.statusCode = 404; return s.end(); }
      if(sigMode === 'bad') return s.end(crypto.sign(null, Buffer.from(`hudini-update\n${sigVer}\n${sums}`), crypto.generateKeyPairSync('ed25519').privateKey).toString('base64'));
      return s.end(signFor(sigVer, sums));
    }
    const f = path.join(rel, q.url.slice(1)); if(fs.existsSync(f)) return s.end(fs.readFileSync(f)); s.statusCode = 404; s.end();
  });
  await new Promise(r => srv.listen(port, r));
  const env = { ...process.env, OVERLAY_RELEASES_API: url('releases'), OVERLAY_NO_TUNNEL: '1', OVERLAY_NO_OPEN: '1', OVERLAY_SITE: 'off', OVERLAY_PUBLIC_BROKER: 'ws://localhost:1', OVERLAY_PORT: '17830' };
  const status = async () => { try{ return await (await fetch('http://127.0.0.1:17830/api/status')).json(); }catch{ return null; } };
  const run = () => { const p = spawn(path.join(app, ASSET), [], { cwd: app, env, detached: true }); p.unref(); return p; };
  const stopAll = async () => { const s = await status(); if(!s) return; try{ execFileSync('pkill', ['-f', path.join(app, ASSET)]); }catch{} await until(async () => !(await status()), 5000); };

  await step('legacy standalone build picks the old one-file asset', async () => {
    list = [{ tag_name: 'host-v1.4.0', assets }, { tag_name: 'v1.0.0', assets }, { tag_name: 'v0.9.0', assets }, { tag_name: 'v0.5.0', prerelease: true, assets }, { tag_name: 'v1.1.0', draft: true, assets }];
    fs.writeFileSync(path.join(app, 'overlay-host.json'), JSON.stringify({ modPass: 'legacy-pass-123' }));   // settings of a pre-1.0 install
    run();
    check(await until(async () => (await status())?.version === '1.0.0-rc.1', 10000) || (await status())?.version === '1.0.0', 'rc build started');
    const s = await until(async () => { const x = await status(); return x?.version === '1.0.0' && x; }, 30000);
    check(!!s, 'restarted as 1.0.0 (old host-v1.4.0 and drafts ignored, new-style app zip ignored)');
    check(s && s.standalone === true && s.app === false, 'status says: standalone build without window');
    check(!fs.existsSync(path.join(app, ASSET + '.new')), 'no leftover .new file');
    const cfg = path.join(app, 'data', 'overlay-host.json');
    check(fs.existsSync(cfg) && JSON.parse(fs.readFileSync(cfg, 'utf8')).modPass === 'legacy-pass-123' && !fs.existsSync(path.join(app, 'overlay-host.json')), 'portable: old settings moved into data/');
    await stopAll();
  });

  await step('stable build ignores rc releases', async () => {
    list = [{ tag_name: 'v1.0.1-rc.1', prerelease: true, assets }, { tag_name: 'v1.0.0', assets }];
    run();
    const s = await until(async () => { const x = await status(); return x && x.upd.state === 'latest' && x; }, 15000);
    eq(s && s.version, '1.0.0', 'still 1.0.0, rc not offered');
    await stopAll();
  });

  await step('release with a wrong or missing signature is refused', async () => {
    build('0.9.0', path.join(app, ASSET));   // an older build again
    list = [{ tag_name: 'v1.0.0', assets }];
    for(const [mode, re] of [['bad', /подпись/], ['none', /подпис/]]){
      sigMode = mode;
      run();
      const s = await until(async () => { const x = await status(); return x && x.upd.state === 'error' && x; }, 20000);
      check(s && re.test(s.upd.err), `${mode} signature refused: ` + (s && s.upd.err));
      eq(s && s.version, '0.9.0', 'kept running the old version');
      await stopAll();
    }
    sigMode = 'ok';
    sigVer = '0.9.1';   // a valid signature, but for another version (old release under a new tag)
    run();
    const s = await until(async () => { const x = await status(); return x && x.upd.state === 'error' && x; }, 20000);
    check(s && /подпись/.test(s.upd.err), 'signature for another version refused: ' + (s && s.upd.err));
    await stopAll();
    sigVer = '1.0.0';
  });

  await step('tampered download is refused', async () => {
    build('0.9.0', path.join(app, ASSET));   // an older build again
    list = [{ tag_name: 'v1.0.0', assets }];
    sums = '0'.repeat(64) + '  ' + ASSET + '.zip\n';
    run();
    const s = await until(async () => { const x = await status(); return x && x.upd.state === 'error' && x; }, 20000);
    check(s && /контрольная сумма/.test(s.upd.err), 'checksum mismatch reported: ' + (s && s.upd.err));
    eq(s && s.version, '0.9.0', 'kept running the old version');
    await stopAll();
  });

  if(process.platform !== 'win32') await step('app mode: picks HudiniHost-<os>-<ver>.zip, unpacks all files, relaunches the app', async () => {
    list = [{ tag_name: 'v1.0.0', assets }];
    sums = sha(zip) + '  ' + ASSET + '.zip\n' + sha(appZip) + '  ' + APP_ZIP + '\n';
    fs.writeFileSync(path.join(inst, 'data', 'overlay-host.json'), JSON.stringify({ modPass: 'app-pass-456' }));
    const appEnv = { ...env, OVERLAY_APP: '1', OVERLAY_APP_EXE: path.join(inst, 'Hudini Host'), OVERLAY_APP_PID: '4242', OVERLAY_HOST_DIR: path.join(inst, 'data') };
    const p = spawn(path.join(inst, 'hudini-server'), [], { cwd: inst, env: appEnv, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = ''; p.stdout.on('data', d => { out += d; });
    check(await until(() => /^READY 17830$/m.test(out), 10000), 'prints READY <port> for the app');
    p.stdin.write('VISIBLE 0\n');   // window hidden in the tray
    const launched = path.join(inst, 'launched.txt');
    check(await until(() => fs.existsSync(launched), 30000), 'new app started after the update');
    eq(fs.readFileSync(launched, 'utf8').trim(), '--updated --wait-pid 4242 --minimized', 'app relaunched with wait-pid, stays in the tray');
    check(/^RESTART$/m.test(out), 'told the app to close (RESTART)');
    check(fs.readFileSync(path.join(inst, 'hudini-server')).equals(newServer), 'server replaced from the zip');
    check((fs.statSync(path.join(inst, 'hudini-server')).mode & 0o111) !== 0, 'server is executable');
    eq(fs.readFileSync(path.join(inst, 'README.txt'), 'utf8'), 'new readme', 'README replaced');
    eq(fs.readFileSync(path.join(inst, 'Hudini Host'), 'utf8'), fakeApp, 'app executable replaced');
    check(fs.existsSync(path.join(inst, 'Hudini Host.old')) && fs.existsSync(path.join(inst, 'hudini-server.old')), 'old files kept as .old until next start');
    eq(JSON.parse(fs.readFileSync(path.join(inst, 'data', 'overlay-host.json'), 'utf8')).modPass, 'app-pass-456', 'data/ from the zip does not overwrite settings');
    check(!fs.existsSync(path.join(inst, 'data', 'update')), 'staging folder removed');
    check(await until(() => p.exitCode !== null, 5000), 'old server exited');
  });

  if(process.platform !== 'win32') await step('app mode: cleans .old files, exits when the app closes stdin', async () => {
    const appEnv = { ...env, OVERLAY_APP: '1', OVERLAY_APP_EXE: path.join(inst, 'Hudini Host'), OVERLAY_HOST_DIR: path.join(inst, 'data') };
    const p = spawn(path.join(inst, 'hudini-server'), [], { cwd: inst, env: appEnv, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = ''; p.stdout.on('data', d => { out += d; });
    check(await until(() => /^READY 17830$/m.test(out), 10000), 'new server ready');
    const s = await until(async () => { const x = await status(); return x && x.upd.state === 'latest' && x; }, 15000);
    check(s && s.version === '1.0.0' && s.app === true && s.standalone === false, 'runs 1.0.0 in app mode');
    check(!fs.existsSync(path.join(inst, 'Hudini Host.old')) && !fs.existsSync(path.join(inst, 'hudini-server.old')), '.old files removed on start');
    p.stdin.end();
    check(await until(() => p.exitCode !== null, 5000), 'exits when stdin closes (no orphan process)');
  });

  if(process.platform !== 'win32') await step('app mode: a zip whose symlink points outside the app folder is refused', async () => {
    const evil = `HudiniHost-${APP_OS}-1.0.1.zip`;
    fs.writeFileSync(path.join(rel, evil), zipMany([
      { name: 'Hudini Host/Hudini Host', data: Buffer.from(fakeApp), mode: 0o755 },
      { name: 'Hudini Host/esc', data: Buffer.from('../..'), mode: 0o120777 },   // symlink to two levels up
      { name: 'Hudini Host/esc/pwned.txt', data: Buffer.from('x') },
    ]));
    list = [{ tag_name: 'v1.0.1', assets: [{ name: evil, browser_download_url: url(evil) }, ...assets.slice(2)] }];
    sums = sha(fs.readFileSync(path.join(rel, evil))) + '  ' + evil + '\n'; sigVer = '1.0.1';
    const appEnv = { ...env, OVERLAY_APP: '1', OVERLAY_APP_EXE: path.join(inst, 'Hudini Host'), OVERLAY_HOST_DIR: path.join(inst, 'data') };
    const p = spawn(path.join(inst, 'hudini-server'), [], { cwd: inst, env: appEnv, stdio: ['pipe', 'ignore', 'ignore'] });
    const s = await until(async () => { const x = await status(); return x && x.upd.state === 'error' && x; }, 20000);
    check(s && /архив повреждён/.test(s.upd.err), 'escaping symlink refused: ' + (s && s.upd.err));
    check(!fs.existsSync(path.join(dir, 'pwned.txt')) && !fs.existsSync(path.join(inst, '..', 'pwned.txt')), 'nothing written outside');
    eq(s && s.version, '1.0.0', 'kept running');
    p.stdin.end(); await until(() => p.exitCode !== null, 5000);
  });

  srv.close(); fs.rmSync(dir, { recursive: true, force: true });
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
