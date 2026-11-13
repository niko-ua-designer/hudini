// The moving page (web/site/moderator.html): finds the old panel's data in the browser and writes a backup the panel imports.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const T = require('./lib.js');
const { check, step, eq, webServer, newPage, closeBrowser, finish } = T;

const ROOT = T.ROOT, SITE = path.join(ROOT, '_site'), SITE_PORT = T.PORTS.web + 1;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.woff2':'font/woff2' };
async function siteServer(){
  const srv = http.createServer((req, res) => {
    let f = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if(!f.startsWith(SITE) || !fs.existsSync(f)){ res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(SITE_PORT, r));
  return { url: `http://localhost:${SITE_PORT}`, close: () => new Promise(r => srv.close(r)) };
}

(async () => {
  execFileSync('sh', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT });
  const web = await webServer(), site = await siteServer();
  // real keys for the old rooms, made by the panel itself
  const maker = await newPage('maker', { app: false });
  await maker.goto(`${web.url}/panel/moderator.html`);
  await maker.waitForFunction(() => typeof rooms !== 'undefined' && rooms.length > 0);
  const rooms = await maker.evaluate(() => JSON.parse(JSON.stringify(rooms)));
  const locked = await maker.evaluate(async r => ({ locked: await lockJSON('secret1', { rooms: r }) }), rooms);
  const lib = [{ name: 'Old logo', room: rooms[0].code, el: { type: 'text', text: 'hello', x: 50, y: 50 } }];
  const anims = [{ name: 'Old wobble', mode: 'loop', end: 'stay', f: [{ t: 0, x: 0 }, { t: 1, x: 5 }] }];
  const scenes = { [rooms[0].code]: [{ name: 'Intro', els: [{ id: 'a', type: 'text', text: 'hi', x: 50, y: 50 }] }] };
  const scn = { [rooms[0].code]: [{ id: 's1', trig: { type: 'cmd', cmd: 'pog' }, acts: [{ type: 'show' }] }] };

  const seed = (page, vault, raw = true) => page.evaluate(([vault, lib, anims, scenes, scn, raw]) => {
    localStorage.clear(); const pre = raw ? '' : 'store:';
    localStorage.setItem('hudini.lang', 'en');
    localStorage.setItem(pre + 'overlay.vault2', JSON.stringify(vault)); localStorage.setItem(pre + 'overlay.lib', JSON.stringify(lib));
    localStorage.setItem(pre + 'overlay.anims', JSON.stringify(anims)); localStorage.setItem(pre + 'overlay.scenes', JSON.stringify(scenes));
    localStorage.setItem(pre + 'overlay.scn', JSON.stringify(scn));
  }, [vault, lib, anims, scenes, scn, raw]);
  const open = async (lang = 'en') => {
    const p = await newPage('mig-' + lang, { app: false, lang }); await p.goto(`${site.url}/moderator.html`); return p;
  };

  await step('nothing in this browser', async () => {
    const p = await open();
    await p.waitForSelector('#scan .mig-none');
    check(!(await p.$('#saveBtn')), 'no save button when there is nothing to save');
    check((await p.textContent('#scan')).includes('Nothing to save'), 'says there is nothing to save');
    await p.context().close();
  });

  let file;
  await step('plain data → password-protected backup', async () => {
    const p = await open();
    await seed(p, { plain: { rooms } }); await p.reload();
    await p.waitForSelector('#saveBtn');
    const txt = await p.textContent('#scan');
    check(/rooms:\s*1/.test(txt) && /library items:\s*1/.test(txt) && /animations:\s*1/.test(txt) && /scenes:\s*1/.test(txt) && /scenarios:\s*1/.test(txt), 'counts of rooms, library, animations, scenes, scenarios', txt);
    await p.fill('#pNew', 'abc'); await p.fill('#pNew2', 'abc'); await p.click('#saveBtn');
    check((await p.textContent('#err')).includes('6 characters'), 'short password is refused');
    await p.fill('#pNew', 'goodpass1'); await p.fill('#pNew2', 'other-one'); await p.click('#saveBtn');
    check((await p.textContent('#err')).includes('do not match'), 'different passwords are refused');
    await p.fill('#pNew2', 'goodpass1');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#saveBtn')]);
    eq(dl.suggestedFilename(), 'overlay-backup.json', 'file name');
    file = path.join(require('os').tmpdir(), 'hudini-mig-test-backup.json'); await dl.saveAs(file);
    const body = fs.readFileSync(file, 'utf8');
    check(JSON.parse(body).overlayBackup === 2 && !body.includes(rooms[0].code) && !body.includes('Old logo'), 'backup is encrypted');
    check(await p.isVisible('#ok'), 'success message');
    await p.context().close();
  });

  await step('the panel imports that file', async () => {
    const p = await newPage('panel', { app: false });
    await p.goto(`${web.url}/panel/moderator.html`);
    await p.waitForFunction(() => typeof library !== 'undefined');
    p.removeAllListeners('dialog'); p.on('dialog', d => d.accept('goodpass1'));
    const before = await p.evaluate(() => ({ lib: library.length, anims: myAnims.length, rooms: rooms.length }));
    await p.setInputFiles('#roomFile', file);
    await T.until(async () => (await p.evaluate(() => library.length)) > before.lib, 6000);
    const after = await p.evaluate(() => ({ lib: library.length, anims: myAnims.length, rooms: rooms.length, names: library.map(l => l.name), sc: Object.keys(scenes).length, scn: Object.keys(scnStore).length }));
    check(after.names.includes('Old logo'), 'library item arrived', after);
    eq(after.anims, before.anims + 1, 'animation arrived');
    eq(after.rooms, before.rooms + 1, 'the old room is added next to the new one');
    check(after.sc >= 1 && after.scn >= 1, 'scenes and scenarios arrived', after);
    await p.context().close();
  });

  await step('locked panel: password first, then the same password protects the file', async () => {
    const p = await open('ru');
    await seed(p, locked); await p.reload();
    await p.waitForSelector('#pPanel');
    check((await p.textContent('#scan')).includes('Пульт закрыт паролем'), 'Russian text, asks for the panel password');
    await p.fill('#pPanel', 'wrong-one'); await p.click('#saveBtn');
    await p.waitForFunction(() => document.getElementById('err').textContent);
    check((await p.textContent('#err')).includes('Неверный пароль'), 'wrong password is refused');
    await p.fill('#pPanel', 'secret1'); await p.click('#saveBtn');
    await p.waitForSelector('#scan .mig-count');
    check(/комнат:\s*1/.test(await p.textContent('#scan')), 'counts after unlocking');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#saveBtn')]);
    const body = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    const data = await maker.evaluate(([box]) => unlockJSON('secret1', box), [body.box]);
    check(data && data.rooms.length === 1 && data.library.length === 1, 'opens with the panel password', data && Object.keys(data));
    await p.context().close();
  });

  await step('data written by the later site panel ("store:" keys)', async () => {
    const p = await open();
    await seed(p, { plain: { rooms } }, false); await p.reload();
    await p.waitForSelector('#saveBtn');
    check(/library items:\s*1/.test(await p.textContent('#scan')), 'found under the store: prefix');
    await p.context().close();
  });

  await step('old panel links land on the moving page', async () => {
    const p = await newPage('old', { app: false }); await p.goto(`${site.url}/panel/moderator.html`);
    await p.waitForURL(/\/moderator\.html$/); check(await p.isVisible('.mig-steps'), 'redirected');
    await p.context().close();
  });

  await step('texts in all languages', async () => {
    for(const l of ['en', 'ru', 'uk', 'de']){
      const p = await open(l);
      const h = await p.textContent('h1');
      check(h && h.length > 10 && p.url().includes('moderator.html'), l + ': heading ' + h);
      if(l !== 'ru') check(!/[а-яё]/i.test((await p.textContent('main')).replace(/[іїєґ]/gi, '')) || l === 'uk', l + ': no stray Russian');
      await p.context().close();
    }
  });

  await maker.context().close();
  await web.close(); await site.close(); await closeBrowser();
  process.exit(finish());
})();
