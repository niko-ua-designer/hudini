// Widget files from the website: Hudini Host takes them only with a valid signature over the manifest, all or nothing,
// never an older manifest or an older widget, and checks its saved copies again at start.
// The manifest is made by tools/site-manifest.mjs and signed by the script of .github/workflows/site-sign.yml,
// with a test key swapped into a temp copy of server.js; a fake HTTP site stands in for Pages and the release.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const T = require('./lib');
const { step, check, eq, until } = T;
const HOST = path.join(T.ROOT, 'server');
const FILES = ['widget/widget.html', 'shared/core.js', 'shared/core.css', 'shared/case3d.js', 'shared/media.js', 'shared/cs2-maps.js'];
const ORIG = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(T.ROOT, 'web', f), 'utf8')]));
const VER = Number(/const WIDGET_VER\s*=\s*(\d+)/.exec(ORIG['widget/widget.html'])[1]);
const SEQ = 1_780_000_000;
const OFF = Number(process.env.HUDINI_TEST_PORT_OFFSET || 0);
const HPORT = T.PORTS.host + 60, SPORT = 19400 + OFF;
const TEST_SERVER = path.join(HOST, '.sitesig-test.js');

const KEYS = crypto.generateKeyPairSync('ed25519');
const PUB = KEYS.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const PEM = KEYS.privateKey.export({ format: 'pem', type: 'pkcs8' });
const OTHER = crypto.generateKeyPairSync('ed25519').privateKey;
const signText = (domain, seq, text, key = KEYS.privateKey) => crypto.sign(null, Buffer.from(`${domain}\n${seq}\n${text}`), key).toString('base64');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-sitesig-'));
  const source = fs.readFileSync(path.join(HOST, 'server.js'), 'utf8');
  const testSource = source.replace(/^const UPDATE_KEY = '[^']*';/m, `const UPDATE_KEY = '${PUB}';`);
  fs.writeFileSync(TEST_SERVER, testSource);
  // the sign step of the workflow, run as it is
  const workflow = fs.readFileSync(path.join(T.ROOT, '.github/workflows/site-sign.yml'), 'utf8');
  const signScript = /name: Sign\n[\s\S]*?node -e '\n([\s\S]*?)\n +'\n/.exec(workflow)?.[1];

  // One published state of the site: the six files with a mark, their manifest and its signature
  let releases = 0;
  function release(mark, seq, { widgetVer = VER, key = PEM } = {}){
    const root = path.join(dir, 'release-' + (++releases)), site = path.join(root, '_site');
    const files = {};
    for(const f of FILES){
      let txt = ORIG[f];
      if(f === 'widget/widget.html') txt = txt.replace(/(const WIDGET_VER\s*=\s*)\d+/, '$1' + widgetVer) + `\n<!-- site ${mark} -->\n`;
      else txt += `\n/* site ${mark} */\n`;
      files[f] = txt;
      fs.mkdirSync(path.dirname(path.join(site, f)), { recursive: true }); fs.writeFileSync(path.join(site, f), txt);
    }
    fs.mkdirSync(path.join(root, 'server'));
    fs.writeFileSync(path.join(root, 'server/server.js'), testSource);
    execFileSync(process.execPath, [path.join(T.ROOT, 'tools/site-manifest.mjs'), site, String(seq), path.join(root, 'site-manifest.json')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['-e', signScript], { cwd: root, env: { ...process.env, HUDINI_SIGNING_KEY: key }, stdio: 'pipe' });
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    return { mark, seq, files, manifest: read('site-manifest.json'), sig: read('site-manifest.json.sig') };
  }

  // The fake site: `pub` is what it serves now; null = nothing there
  let pub = null, hits = 0;
  const srv = http.createServer((q, s) => {
    const p = new URL(q.url, 'http://x').pathname;
    let body;
    if(p === '/rel/site-manifest.json'){ hits++; body = pub?.manifest; }
    else if(p === '/rel/site-manifest.json.sig') body = pub?.sig;
    else if(p.startsWith('/site/')) body = pub?.files[p.slice(6)];
    if(body == null){ s.statusCode = 404; return s.end(); }
    s.end(body);
  });
  await new Promise(r => srv.listen(SPORT, r));

  let host = null;
  const newData = () => fs.mkdtempSync(path.join(dir, 'data-'));
  async function start(data, { server = TEST_SERVER, env = {} } = {}){
    await stop();
    const proc = spawn('bun', ['run', server], { cwd: HOST, env: { ...process.env, OVERLAY_HOST_DIR: data, OVERLAY_NO_OPEN: '1', OVERLAY_NO_UPDATE: '1',
      OVERLAY_ADMIN_TOKEN: T.ADMIN_TOKEN, OVERLAY_PORT: String(HPORT), OVERLAY_MOD_PORT: String(HPORT + 1),
      OVERLAY_SITE: `http://localhost:${SPORT}/site`, OVERLAY_SITE_MANIFEST: `http://localhost:${SPORT}/rel/site-manifest.json`, ...env } });
    host = { proc, log: '' };
    proc.stdout.on('data', d => { host.log += d; }); proc.stderr.on('data', d => { host.log += d; });
    check(await until(async () => (await fetch(`http://127.0.0.1:${HPORT}/api/status`, { headers: { 'x-hudini-token': T.ADMIN_TOKEN } })).ok, 15000), 'Host started');
  }
  async function stop(){
    const p = host?.proc; if(!p) return;
    if(p.exitCode === null){ p.kill('SIGTERM'); await until(() => p.exitCode !== null, 3000); if(p.exitCode === null) p.kill('SIGKILL'); }
    host = null;
  }
  const logged = re => until(() => re.test(host.log), 8000);
  const get = async (f, query = '') => (await fetch(`http://localhost:${HPORT}/${f}${query}`)).text();
  // Which version every file the Host serves comes from: a mark, or 'built-in'
  const marks = async () => Promise.all(FILES.map(async f => /(?:<!--|\/\*) site (\S+) (?:-->|\*\/)/.exec(await get(f))?.[1] || 'built-in'));
  const serves = async (mark, what) => eq(await marks(), FILES.map(() => mark), what);
  const cacheFile = data => path.join(data, 'cache', 'site-signed.json');
  const savedSeq = data => JSON.parse(fs.readFileSync(path.join(data, 'overlay-host.json'), 'utf8')).siteSeq;

  const A = release('A', SEQ), B = release('B', SEQ + 100), C = release('C', SEQ + 200);
  const main = newData();   // one install that lives through the steps below

  await step('manifest tool and sign step', async () => {
    check(!!signScript, 'sign script found in the workflow');
    const m = JSON.parse(A.manifest);
    eq([m.seq, m.widgetVer, Object.keys(m.files)], [SEQ, VER, FILES], 'seq, widget version and exactly the files the Host serves');
    eq(m.files['shared/core.js'], crypto.createHash('sha256').update(A.files['shared/core.js']).digest('hex'), 'SHA-256 of the file');
    let refused = '';
    try{ release('X', SEQ, { key: OTHER.export({ format: 'pem', type: 'pkcs8' }) }); }catch(e){ refused = String(e.stderr); }
    check(/does not match UPDATE_KEY/.test(refused), 'a secret that does not match UPDATE_KEY is refused', refused);
    refused = '';
    try{ release('X', Math.floor(Date.now() / 1000) + 86400); }catch(e){ refused = String(e.stderr); }
    check(/in the future/.test(refused), 'a commit time in the future is not signed', refused);
  });

  await step('a valid signature is applied', async () => {
    pub = A;
    await start(main);
    check(await logged(/Widget files updated from the site \(signature verified\)/), 'logged');
    await serves('A', 'all six files come from the site');
    eq(savedSeq(main), SEQ, 'accepted seq saved');
    check(fs.existsSync(cacheFile(main)), 'files saved together with the manifest and signature');
  });

  await step('saved verified files are used while the site is unreachable', async () => {
    pub = null;
    await start(main);
    await serves('A', 'saved copies served');
    check(await logged(/site-manifest\.json: HTTP 404\), keeping the current ones/), 'missing manifest logged');
  });

  await step('newer files without a signature are not taken, and said once', async () => {
    pub = { ...A, files: B.files };
    hits = 0;
    await start(main);
    check(await logged(/differ from the signed ones/), 'logged');
    await serves('A', 'previous files kept');
    await get('widget/widget.html', '?upd=1');   // the widget asks for fresh files: a second round
    eq(hits, 2, 'the site was asked again');
    eq(host.log.split('differ from the signed ones').length - 1, 1, 'the same reason is logged once');
    await serves('A', 'previous files still served');
  });

  await step('the next signed version is applied', async () => {
    pub = B;
    await start(main);
    check(await logged(/signature verified/), 'logged');
    await serves('B', 'new files served');
    eq(savedSeq(main), SEQ + 100, 'seq raised');
  });

  const refusedKeeping = async (state, re, what) => {
    pub = state;
    await start(main);
    check(await logged(re), what + ': refused and logged', host.log);
    await serves('B', what + ': previous files kept');
    eq(savedSeq(main), SEQ + 100, what + ': seq unchanged');
  };
  const BAD = /Could not update widget files from the site \(bad signature\)/;

  await step('a wrong signature is refused', async () => {
    await refusedKeeping({ ...C, sig: signText('hudini-site', C.seq, C.manifest, OTHER) }, BAD, 'another key');
    await refusedKeeping({ ...C, sig: signText('hudini-update', C.seq, C.manifest) }, BAD, 'signature made for an app update');
    await refusedKeeping({ ...C, manifest: C.manifest.replace(String(C.seq), String(C.seq + 1)) }, BAD, 'manifest edited after signing');
    await refusedKeeping({ ...C, manifest: 'not json' }, BAD, 'garbage manifest');
  });

  await step('a missing signature is refused', async () => {
    await refusedKeeping({ ...C, sig: null }, /site-manifest\.json\.sig: HTTP 404/, 'no .sig');
    const data = newData();
    await start(data);
    check(await logged(/site-manifest\.json\.sig: HTTP 404/), 'fresh install: logged');
    await serves('built-in', 'fresh install: built-in files');
    check(!fs.existsSync(cacheFile(data)), 'nothing saved');
  });

  await step('an older signed manifest is refused (no rollback)', async () => {
    await refusedKeeping(A, /older than the one already accepted/, 'older seq');
    fs.rmSync(cacheFile(main));
    await start(main);
    check(await logged(/older than the one already accepted/), 'without the saved files: still refused');
    await serves('built-in', 'built-in files');
    pub = B;
    await start(main);
    check(await logged(/signature verified/), 'the same seq is accepted again');
    await serves('B', 'files restored');
  });

  await step('one tampered or missing file: nothing is taken', async () => {
    await refusedKeeping({ ...C, files: { ...C.files, 'shared/media.js': C.files['shared/media.js'] + 'alert(1)' } }, /differ from the signed ones/, 'tampered file');
    await refusedKeeping({ ...C, files: { ...C.files, 'shared/cs2-maps.js': null } }, /cs2-maps\.js: HTTP 404/, 'missing file');
  });

  await step('a corrupted cache is rejected at start', async () => {
    const good = fs.readFileSync(cacheFile(main), 'utf8');
    const edit = fn => { const c = JSON.parse(good); fn(c); return JSON.stringify(c); };
    const cases = [
      ['changed file', edit(c => { c.files['shared/core.js'] = Buffer.from('alert(1) /* site EVIL */').toString('base64'); }), /does not match the signed list/],
      ['file removed', edit(c => { delete c.files['shared/media.js']; }), /does not match the signed list/],
      ['foreign signature', edit(c => { c.sig = signText('hudini-site', B.seq, c.manifest, OTHER); }), /bad signature/],
      ['truncated', good.slice(0, 100), /Saved widget files not used/],
      ['null', 'null', /Saved widget files not used/],
    ];
    pub = null;
    for(const [what, text, re] of cases){
      fs.writeFileSync(cacheFile(main), text);
      await start(main);
      check(await logged(re) && /Saved widget files not used/.test(host.log), what + ': logged', host.log);
      await serves('built-in', what + ': built-in files');
    }
    fs.writeFileSync(cacheFile(main), good);
    await start(main);
    await serves('B', 'the intact cache is used again');
  });

  await step('unsigned cache files of 1.1 are ignored', async () => {
    const data = newData(); fs.mkdirSync(path.join(data, 'cache'));
    for(const f of FILES) fs.writeFileSync(path.join(data, 'cache', f.replace(/\//g, '_')), A.files[f]);
    pub = null;
    await start(data);
    await serves('built-in', 'built-in files');
  });

  await step('a widget older than the built-in one is refused', async () => {
    const old = release('OLD', SEQ + 300, { widgetVer: VER - 1 });
    const re = new RegExp(`signed widget ${VER - 1} is older than the built-in ${VER}`);
    await refusedKeeping(old, re, 'from the site');
    // saved before an app update that brought a newer widget
    const data = newData(); fs.mkdirSync(path.join(data, 'cache'));
    const files = Object.fromEntries(FILES.map(f => [f, Buffer.from(old.files[f]).toString('base64')]));
    fs.writeFileSync(cacheFile(data), JSON.stringify({ manifest: old.manifest, sig: old.sig, files }));
    pub = null;
    await start(data);
    check(await logged(new RegExp('Saved widget files not used \\(' + re.source)), 'saved copy: logged', host.log);
    await serves('built-in', 'saved copy: built-in files');
    pub = release('NEW', SEQ + 400, { widgetVer: VER + 1 });
    await start(data);
    check(await logged(/signature verified/), 'a newer widget is accepted');
    await serves('NEW', 'newer files served');
  });

  await step('changing the addresses does not change the signature check', async () => {
    pub = C;   // signed with the test key; the real server.js knows only the release key
    const data = newData();
    await start(data, { server: path.join(HOST, 'server.js') });
    check(await logged(BAD), 'refused by the unmodified Host');
    await serves('built-in', 'built-in files');
  });

  await step('OVERLAY_SITE=off asks nothing', async () => {
    hits = 0;
    await start(newData(), { env: { OVERLAY_SITE: 'off' } });
    await get('widget/widget.html', '?upd=1');
    eq(hits, 0, 'no requests');
    await serves('built-in', 'built-in files');
  });

  await stop(); srv.close(); srv.closeAllConnections();
  fs.rmSync(TEST_SERVER, { force: true }); fs.rmSync(dir, { recursive: true, force: true });
  process.exit(T.finish());
})().catch(e => { console.error(e); fs.rmSync(TEST_SERVER, { force: true }); process.exit(1); });
