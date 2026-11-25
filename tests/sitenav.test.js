// Landing page: the version written by the build (<html data-ver>), the first-visit language offer, the phone menu,
// the direct download link, the phone download note, tap targets and the page staying readable when the script fails.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const T = require('./lib.js');
const { check, step, eq, newPage, closeBrowser, finish } = T;
const ROOT = T.ROOT, SITE = path.join(ROOT, '_site'), PORT = T.PORTS.web + 4;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' };
const VER = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/package.json'), 'utf8')).version;
const REL = 'https://github.com/niko-ua-designer/hudini/releases/latest';

(async () => {
  execFileSync('sh', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT });
  const srv = http.createServer((req, res) => {
    let f = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if(!f.startsWith(SITE) || !fs.existsSync(f)){ res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(PORT, r));
  const base = `http://localhost:${PORT}`;
  const noLang = p => p.addInitScript(() => { try{ if(!sessionStorage.getItem('sn.once')){ sessionStorage.setItem('sn.once', '1'); localStorage.removeItem('hudini.lang'); } }catch{} });   // runs after the helper that presets the language

  await step('every landing page carries the build version in data-ver and shows it', async () => {
    check(/^\d+\.\d+\.\d+/.test(VER), 'server/package.json has a version: ' + VER);
    for(const [l, dir] of [['en', ''], ['ru', 'ru/'], ['uk', 'uk/'], ['de', 'de/']]){
      const html = fs.readFileSync(path.join(SITE, dir, 'index.html'), 'utf8');
      eq((html.match(/<html[^>]*\sdata-ver="([^"]*)"/) || [])[1], VER, l + ': data-ver on <html>');
      check(!html.includes('{ver}'), l + ': no {ver} placeholder left in the page');
      check(html.includes(VER), l + ': the version appears in the page text');
    }
    const p = await newPage('sn1', { app: false, lang: 'en' });
    await p.goto(`${base}/index.html?lang=en`);
    check((await p.textContent('.pill')).includes(VER), 'the badge shows the version after the script ran');
    await p.context().close();
  });

  await step('download buttons link straight to the zip of the system, the release page stays as a link', async () => {
    const p = await newPage('sn2', { app: false, lang: 'en' });
    await p.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120' }));
    await p.goto(`${base}/index.html?lang=en`);
    eq(await p.$eval('.cta a[data-dl]', a => a.href), `${REL}/download/HudiniHost-linux-${VER}.zip`, 'the main button points at the Linux zip');
    const other = await p.$$eval('#otherOs a', a => a.map(x => x.href));
    eq(other, [`${REL}/download/HudiniHost-windows-${VER}.zip`, `${REL}/download/HudiniHost-mac-${VER}.zip`], 'other systems: Windows and Mac zips');
    await p.click('.cta a[data-dl]'); await p.waitForSelector('.dl-box .chips');
    await p.click('.dl-foot .lo-btn.main'); await p.waitForSelector('.dl-img');
    eq(await p.$eval('.dl-get', a => a.href), `${REL}/download/HudiniHost-linux-${VER}.zip`, 'step 2: the main button downloads the file');
    eq(await p.$eval('.dl-open', a => a.href), REL, 'step 2: the release page is the fallback link');
    check((await p.textContent('.dl-body')).includes(`HudiniHost-linux-${VER}.zip`), 'step 2 names the file');
    await p.context().close();
  });

  await step('on a phone Windows is not the main action: the page says the program is for a PC', async () => {
    const p = await newPage('sn3', { app: false, lang: 'ru', w: 390, h: 844 });
    await p.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' }));
    await p.goto(`${base}/index.html?lang=ru`);
    const label = await p.textContent('.cta a[data-dl]');
    check(!/Windows/.test(label) && /ПК/.test(label), 'the hero button says PC, not Windows: ' + label.trim());
    eq(await p.$eval('.cta a[data-dl]', a => a.href), REL, 'no file link for a phone: the release page');
    eq((await p.$$eval('#otherOs a', a => a.length)), 3, 'all three systems are listed under the button');
    await p.click('.cta a[data-dl]'); await p.waitForSelector('.dl-box');
    check((await p.textContent('.dl-body')).includes('ПК'), 'the window explains it is for a PC');
    eq(await p.$('.dl-chooser'), null, 'no connection step before it');
    await p.context().close();
  });

  await step('language offer: dialog, focus, Escape, remembered', async () => {
    const p = await newPage('sn4', { app: false, lang: 'en' }); await noLang(p);
    await p.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));
    await p.goto(`${base}/index.html`);
    await p.waitForSelector('.lo-box[role="dialog"]');
    eq(await p.getAttribute('.lo-box', 'aria-modal'), 'true', 'aria-modal');
    check(!!(await p.getAttribute('.lo-box', 'aria-label')), 'the dialog has a name');
    eq(await p.$$eval('.lo-box .lo-btn', b => b.map(x => x.textContent)), ['Deutsch', 'English', 'Русский', 'Українська'], 'the browser language comes first');
    eq(await p.evaluate(() => document.activeElement.textContent), 'Deutsch', 'focus on the first button');
    for(let i = 0; i < 5; i++) await p.keyboard.press('Tab');
    check(await p.evaluate(() => !!document.activeElement.closest('.lo-box')), 'Tab stays inside the dialog');
    await p.keyboard.press('Escape'); await p.waitForSelector('.lo-back', { state: 'detached' });
    check(!!(await p.evaluate(() => localStorage.getItem('hudini.lang'))), 'closing the offer remembers a language');
    await p.reload();
    await p.waitForTimeout(400);
    eq(await p.$('.lo-back'), null, 'the offer does not come back');
    await p.context().close();
  });

  await step('phone: header menu opens and closes, tap targets are 44px, no horizontal scroll', async () => {
    const p = await newPage('sn5', { app: false, lang: 'en', w: 390, h: 844 });
    await p.goto(`${base}/index.html?lang=en`);
    eq(await p.isVisible('.top nav'), false, 'the link bar is hidden on a phone');
    eq(await p.getAttribute('.menu-btn', 'aria-expanded'), 'false', 'menu button starts collapsed');
    check((await p.getAttribute('.menu-btn', 'aria-label')) === 'Menu' && (await p.getAttribute('.menu-btn', 'aria-controls')) === (await p.getAttribute('.top nav', 'id')), 'button has a name and points at the menu');
    const box = await p.$eval('.menu-btn', b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
    check(box[0] >= 44 && box[1] >= 44, 'menu button is at least 44px: ' + box);
    await p.click('.menu-btn'); await p.waitForSelector('.top nav', { state: 'visible' });
    eq(await p.getAttribute('.menu-btn', 'aria-expanded'), 'true', 'expanded');
    const links = await p.$$eval('.top nav a', a => a.map(x => Math.round(x.getBoundingClientRect().height)));
    check(links.length >= 4 && links.every(h => h >= 44), 'menu links are at least 44px tall: ' + links);
    await p.keyboard.press('Escape'); eq(await p.isVisible('.top nav'), false, 'Escape closes the menu');
    check(await p.evaluate(() => document.activeElement.classList.contains('menu-btn')), 'focus returns to the button');
    await p.click('.menu-btn'); await p.click('.top nav a[href="#features"]');
    eq(await p.isVisible('.top nav'), false, 'choosing a link closes the menu');
    const small = await p.$$eval('.sh-hero .free a, footer a, .langlinks a', a => a.filter(x => x.offsetParent).map(x => [x.textContent.trim(), Math.round(x.getBoundingClientRect().height)]).filter(x => x[1] < 44));
    eq(small, [], 'hero and footer links are at least 44px tall');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
    await p.context().close();
  });

  await step('sections stay visible when the script fails', async () => {
    const p = await newPage('sn6', { app: false, lang: 'en' });
    await p.route('**/site.js*', r => r.fulfill({ contentType: 'application/javascript', body: "document.documentElement.classList.add('js');" }));
    await p.goto(`${base}/index.html?lang=en`);
    await p.waitForFunction(() => document.documentElement.classList.contains('no-reveal'), null, { timeout: 6000 });
    await p.waitForFunction(() => getComputedStyle(document.getElementById('features')).opacity === '1', null, { timeout: 4000 });
    check(true, 'a reveal section is visible without the script');
    await p.context().close();
  });

  await closeBrowser(); srv.close();
  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
