// The "how to connect" guide lives in the download window of the landing page: it opens from the Download button and from #connect.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const T = require('./lib.js');
const { check, step, eq, newPage, closeBrowser, finish } = T;
const ROOT = T.ROOT, SITE = path.join(ROOT, '_site'), PORT = T.PORTS.web + 3;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' };

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
  const tools = p => p.$$eval('.dl-tool', a => a.map(x => [x.href, x.rel, x.target]));

  await step('the page has no #connect section; Download opens the guide on step 1', async () => {
    const p = await newPage('cg1', { app: false, lang: 'en' });
    await p.goto(`${base}/index.html?lang=en`);
    eq(await p.$('#connect'), null, 'no #connect section on the page');
    await p.click('a[data-dl]:visible'); await p.waitForSelector('.dl-box .chips');
    check(await p.$('.dl-box [data-pick="easy"].on'), 'the easiest way is selected');
    const t = await tools(p);
    eq(t.map(x => x[0]), ['https://www.radmin-vpn.com/', 'https://store.steampowered.com/app/4963920/Porthole_Local_Port_Sharing/'], 'Radmin VPN and Porthole buttons');
    check(t.every(x => /noopener/.test(x[1]) && /noreferrer/.test(x[1]) && x[2] === '_blank'), 'external links: new tab, noopener noreferrer');
    for(const [k, url] of [['tailscale', 'https://tailscale.com/'], ['zerotier', 'https://www.zerotier.com/'], ['radmin', 'https://www.radmin-vpn.com/']]){
      await p.click(`[data-pick="${k}"]`); eq((await tools(p)).map(x => x[0]), [url], k + ' download link');
    }
    await p.click('[data-pick="port"]'); eq((await tools(p)).length, 0, 'no download button for the router way');
    await p.click('.dl-foot .lo-btn.main'); await p.waitForSelector('.dl-img');
    check(await p.$('.dl-open[rel="noopener noreferrer"]'), 'step 2 links to the release page');
    await p.keyboard.press('Escape'); await p.waitForSelector('.lo-back', { state: 'detached' });
    await p.context().close();
  });

  await step('#connect in the address and the header link open the guide', async () => {
    const p = await newPage('cg2', { app: false, lang: 'ru' });
    await p.goto(`${base}/index.html?lang=ru#connect`); await p.waitForSelector('.dl-box .chips');
    check(true, 'opened by the address');
    await p.click('.dl-x'); await p.waitForSelector('.lo-back', { state: 'detached' });
    await p.click('.top nav a[href="#connect"]'); await p.waitForSelector('.dl-box .chips');
    check(true, 'opened by the header link');
    await p.context().close();
  });

  await closeBrowser(); srv.close();
  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
