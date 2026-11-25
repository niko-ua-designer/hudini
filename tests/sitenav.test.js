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

  await step('help page: the TOC highlights the section the reader is at', async () => {
    for(const [lang, w, h] of [['de', 1865, 911], ['de', 1280, 800], ['ru', 1865, 911], ['ru', 1280, 800]]){
      const p = await newPage('sn7', { app: false, lang, w, h });
      await p.goto(`${base}/help.html?lang=${lang}`); await p.waitForSelector('#toc a');
      const on = () => p.$$eval('#toc a.on', a => a.map(x => x.dataset.id));
      const ids = await p.$$eval('#content section', s => s.map(x => x.id));
      // the shortest section (not the first) that can still be brought under the header by scrolling
      const pick = await p.evaluate(() => {
        const hb = document.querySelector('header.top').getBoundingClientRect().bottom, max = document.documentElement.scrollHeight - innerHeight;
        const c = [...document.querySelectorAll('#content section')].slice(1).map(s => ({ id: s.id, h: s.offsetHeight, y: s.getBoundingClientRect().top + scrollY - hb - 4 })).filter(x => x.y < max - 1 && x.h < innerHeight * .5);
        c.sort((a, b) => a.h - b.h); return c[0];
      });
      check(!!pick, `${lang} ${w}: a short section exists`);
      await p.evaluate(y => scrollTo(0, y), pick.y); await p.waitForTimeout(150);
      eq(await on(), [pick.id], `${lang} ${w}: the short section at the top is the only active item (${pick.id})`);
      await p.screenshot({ path: path.join(ROOT, 'temp', `pkgd-help-${lang}-${w}-short.png`) });
      const other = ids.find(i => i !== pick.id && i !== ids[0]);
      await p.click(`#toc a[data-id="${other}"]`); await p.waitForTimeout(150);
      eq(await on(), [other], `${lang} ${w}: a click makes the clicked item active`);
      await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
      await p.mouse.wheel(0, 10); await p.waitForTimeout(150);
      eq(await on(), [ids[ids.length - 1]], `${lang} ${w}: at the bottom the last section is active`);
      await p.screenshot({ path: path.join(ROOT, 'temp', `pkgd-help-${lang}-${w}-bottom.png`) });
      await p.fill('#q', ids.length ? (await p.$eval(`#content section:last-of-type h2`, e => e.textContent)).slice(0, 8) : '');
      await p.waitForTimeout(150);
      const vis = await p.$$eval('#toc a:not([hidden])', a => a.map(x => x.dataset.id));
      check(vis.length > 0 && (await on()).every(i => vis.includes(i)), `${lang} ${w}: hidden sections are never active`);
      await p.context().close();
    }
  });

  await step('every local link, script, image and poster of the built pages exists (also in the language folders)', async () => {
    const missing = [];
    for(const dir of ['', 'ru/', 'uk/', 'de/']) for(const f of ['index.html', ...(dir ? [] : ['help.html', 'report.html', 'moderator.html'])]){
      const html = fs.readFileSync(path.join(SITE, dir, f), 'utf8');
      for(const m of html.matchAll(/\s(?:href|src|poster)="([^"#?]+)(?:[?#][^"]*)?"/g)){
        const u = m[1]; if(/^(https?:|mailto:|data:|\/\/)/.test(u)) continue;
        const target = path.join(SITE, dir, u);
        if(!fs.existsSync(target) && !(u.endsWith('/') && fs.existsSync(path.join(target, 'index.html')))) missing.push(`${dir}${f}: ${u}`);
      }
    }
    eq(missing, [], 'nothing is missing');
  });

  await step('header: links fit or move into the menu at every width, in every language, on every page', async () => {
    const bad = [];
    for(const page of ['index.html', 'help.html', 'report.html', 'moderator.html']) for(const lang of ['ru', 'de']) for(const w of [768, 1000, 1180]){
      const p = await newPage('sn8', { app: false, lang, w, h: 700 });
      await p.goto(`${base}/${page}?lang=${lang}`); await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const t = document.querySelector('header.top'), out = [];
        for(const k of t.children){ if(getComputedStyle(k).display === 'none') continue; const b = k.getBoundingClientRect(); if(b.right > innerWidth + .5 || b.left < -.5) out.push('off-screen ' + (k.className || k.tagName)); }
        if(t.getBoundingClientRect().height > 70) out.push('header wraps');
        return out;
      });
      if(r.length) bad.push(`${page} ${lang} ${w}: ${r}`);
      await p.context().close();
    }
    eq(bad, [], 'no overflow or wrapping');
  });

  await step('links between pages carry the language and keep their anchor; a search with no results is not hidden under the header', async () => {
    const p = await newPage('sn9', { app: false, lang: 'ru', w: 1280, h: 800 });
    await p.goto(`${base}/help.html?lang=de`); await p.waitForSelector('#toc a');
    eq(await p.$eval('[data-rep]', a => new URL(a.href).search), '?lang=de', 'report link has ?lang=de although the stored language is ru');
    check((await p.$eval('header.top a[href^="index.html"]', a => a.href)).includes('?lang=de'), 'home link has the language');
    await p.goto(`${base}/moderator.html?lang=en`); await p.waitForSelector('[data-help]');
    eq(await p.$eval('[data-help]', a => new URL(a.href).search + new URL(a.href).hash), '?lang=en#migrate', 'help link keeps its #migrate anchor');
    await p.goto(`${base}/help.html?lang=en`); await p.waitForSelector('#toc a');
    await p.evaluate(() => scrollTo({ top: 5000, behavior: 'instant' })); await p.waitForTimeout(100);
    await p.fill('#q', 'zzzzqq'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ y: scrollY, top: document.querySelector('.empty').getBoundingClientRect().top, hdr: document.querySelector('header.top').getBoundingClientRect().bottom }));
    check(r.top >= r.hdr, `the "nothing found" text is below the header (${JSON.stringify(r)})`);
    await p.context().close();
  });

  await step('report wizard: the buttons are not cut in German at 390px', async () => {
    const p = await newPage('sn10', { app: false, lang: 'de', w: 390, h: 844 });
    await p.goto(`${base}/report.html?lang=de`); await p.waitForSelector('[data-type="bug"]');
    await p.click('[data-type="bug"]');
    for(let i = 0; i < 4; i++){
      if(await p.$eval('#next', e => e.disabled)) await p.fill('#fWhat', 'The case does not open after I press the button twice');
      await p.click('#next'); await p.waitForTimeout(150);
    }
    const r = await p.evaluate(() => [...document.querySelectorAll('.rp-nav .btn')].filter(b => getComputedStyle(b).visibility !== 'hidden').map(b => { const x = b.getBoundingClientRect(); return { t: b.textContent, h: Math.round(x.height), over: b.scrollWidth > b.clientWidth + 1, out: x.right > innerWidth }; }));
    check(r.every(b => !b.over && !b.out), 'no clipped or overflowing button: ' + JSON.stringify(r));
    check(r.every(b => b.h < 80), 'no tall wrapped buttons: ' + JSON.stringify(r));
    await p.context().close();
  });

  await closeBrowser(); srv.close();
  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
