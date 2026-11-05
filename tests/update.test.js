// Self-update of Hudini Host: a compiled rc build updates to the stable release from a fake GitHub,
// verifies SHA-256, ignores old host-v tags, refuses a tampered download, and a stable build ignores rc releases.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const T = require('./lib');
const { step, check, eq, until } = T;
const HOST = path.join(T.ROOT, 'host');
const ASSET = { linux:'HudiniHost-linux', darwin: os.arch() === 'arm64' ? 'HudiniHost-mac-arm64' : 'HudiniHost-mac-intel', win32:'HudiniHost-windows.exe' }[process.platform];

function build(version, out){
  const src = fs.readFileSync(path.join(HOST, 'server.js'), 'utf8').replace(/^const VERSION = '[^']+';/m, `const VERSION = '${version}';`);
  const tmp = path.join(HOST, `.update-test-${version}.js`);
  fs.writeFileSync(tmp, src);
  try{ execFileSync('bun', ['build', '--compile', tmp, '--outfile', out], { cwd: HOST, stdio: 'pipe' }); }
  finally{ fs.rmSync(tmp, { force: true }); }
}
function zipOne(file, name){   // minimal stored zip with one entry
  const data = fs.readFileSync(file), nameB = Buffer.from(name);
  const crc = (() => { let c, t = []; for(let n = 0; n < 256; n++){ c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xFFFFFFFF; for(const b of data) x = t[(x ^ b) & 0xFF] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; })();
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameB.length, 28);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + nameB.length, 12); eocd.writeUInt32LE(30 + nameB.length + data.length, 16);
  return Buffer.concat([lh, nameB, data, cd, nameB, eocd]);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-upd-'));
  const rel = path.join(dir, 'rel'), app = path.join(dir, 'app'); fs.mkdirSync(rel); fs.mkdirSync(app);
  console.log('building two Host versions (takes a little while)…');
  build('1.0.0-rc.1', path.join(app, ASSET));
  build('1.0.0', path.join(rel, ASSET));
  const zip = zipOne(path.join(rel, ASSET), ASSET);
  fs.writeFileSync(path.join(rel, ASSET + '.zip'), zip);
  let sums = crypto.createHash('sha256').update(zip).digest('hex') + '  ' + ASSET + '.zip\n';
  let list = [];
  const port = 19300, url = f => `http://localhost:${port}/${f}`;
  const assets = [{ name: ASSET + '.zip', browser_download_url: url(ASSET + '.zip') }, { name: 'SHA256SUMS.txt', browser_download_url: url('SHA256SUMS.txt') }];
  const srv = http.createServer((q, s) => {
    if(q.url === '/releases'){ s.setHeader('content-type', 'application/json'); return s.end(JSON.stringify(list)); }
    if(q.url === '/SHA256SUMS.txt') return s.end(sums);
    const f = path.join(rel, q.url.slice(1)); if(fs.existsSync(f)) return s.end(fs.readFileSync(f)); s.statusCode = 404; s.end();
  });
  await new Promise(r => srv.listen(port, r));
  const env = { ...process.env, OVERLAY_RELEASES_API: url('releases'), OVERLAY_NO_TUNNEL: '1', OVERLAY_NO_OPEN: '1', OVERLAY_SITE: 'off', OVERLAY_PUBLIC_BROKER: 'ws://localhost:1', OVERLAY_PORT: '17830' };
  const status = async () => { try{ return await (await fetch('http://localhost:17830/api/status')).json(); }catch{ return null; } };
  const run = () => { const p = spawn(path.join(app, ASSET), [], { cwd: app, env, detached: true }); p.unref(); return p; };
  const stopAll = async () => { const s = await status(); if(!s) return; try{ execFileSync('pkill', ['-f', path.join(app, ASSET)]); }catch{} await until(async () => !(await status()), 5000); };

  await step('rc build updates to the stable release', async () => {
    list = [{ tag_name: 'host-v1.4.0', assets }, { tag_name: 'v1.0.0', assets }, { tag_name: 'v0.9.0', assets }, { tag_name: 'v1.1.0', draft: true, assets }];
    run();
    check(await until(async () => (await status())?.version === '1.0.0-rc.1', 10000) || (await status())?.version === '1.0.0', 'rc build started');
    const s = await until(async () => { const x = await status(); return x?.version === '1.0.0' && x; }, 30000);
    check(!!s, 'restarted as 1.0.0 (old host-v1.4.0 and drafts ignored)');
    check(!fs.existsSync(path.join(app, ASSET + '.new')), 'no leftover .new file');
    await stopAll();
  });

  await step('stable build ignores rc releases', async () => {
    list = [{ tag_name: 'v1.0.1-rc.1', prerelease: true, assets }, { tag_name: 'v1.0.0', assets }];
    run();
    const s = await until(async () => { const x = await status(); return x && x.upd.state === 'latest' && x; }, 15000);
    eq(s && s.version, '1.0.0', 'still 1.0.0, rc not offered');
    await stopAll();
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

  srv.close(); fs.rmSync(dir, { recursive: true, force: true });
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
