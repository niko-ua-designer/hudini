// The report page (web/site/report.html): the five-step helper that writes a report and opens a prefilled GitHub issue form.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const T = require('./lib.js');
const { check, step, eq, newPage, closeBrowser, finish } = T;

const ROOT = T.ROOT, SITE = path.join(ROOT, '_site'), PORT = T.PORTS.web + 2;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.woff2':'font/woff2' };
async function siteServer(){
  const srv = http.createServer((req, res) => {
    let f = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if(!f.startsWith(SITE) || !fs.existsSync(f)){ res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(PORT, r));
  return { url: `http://localhost:${PORT}`, close: () => new Promise(r => srv.close(r)) };
}

(async () => {
  execFileSync('sh', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT });
  const site = await siteServer();
  const open = async (lang = 'en') => { const p = await newPage('rep-' + lang, { app: false, lang }); await p.goto(`${site.url}/report.html`); await p.waitForSelector('#stTitle'); return p; };

  await step('helpers: report text, link, redaction, OS', async () => {
    const p = await open();
    const r = await p.evaluate(() => {
      const H = window.HudiniReport, s = { type: 'bug', ver: '1.0.0-rc.5', os: 'Windows', role: 'Streamer', conn: 'Radmin VPN', what: 'The case does not open\nsecond line', steps: '1. click' };
      return { rep: H.buildReport(s), url: H.buildUrl(s), idea: H.buildUrl({ type: 'idea', what: 'Dark mode please' }), lag: H.buildUrl({ ...s, type: 'lag' }), long: H.buildUrl({ ...s, what: 'x'.repeat(5000) }),
        red: H.redact('a hudini1:AbC_123-x b hudini1:zzz'), leak: [H.buildReport({ ...s, what: 'join hudini1:SECRETKEY99 fails' }), H.buildUrl({ ...s, steps: 'paste hudini1:SECRETKEY99' }).url, H.buildUrl({ type: 'idea', what: 'idea hudini1:SECRETKEY99' }).url], link: H.redact('open http://localhost:7777/widget/widget.html?room=ROOMSECRET1&broker=ws%3A%2F%2Flocalhost%3A7777%2Fmqtt&v=9#k=KEYSECRET22&p=PASSSECRET3 then #invite=INVSECRET_4-x end'), os: [H.detectOs('Mozilla/5.0 (Windows NT 10.0)', 'Win32'), H.detectOs('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')] };
    });
    check(r.rep.includes('### What happened\nThe case does not open') && r.rep.includes('### Hudini version\n1.0.0-rc.5') && r.rep.includes('### Connection method\nRadmin VPN'), 'report has the form headings', r.rep);
    const u = new URL(r.url.url); eq(u.origin + u.pathname, 'https://github.com/niko-ua-designer/hudini/issues/new', 'link goes to the repo');
    eq(u.searchParams.get('template'), 'bug.yml', 'bug template'); eq(u.searchParams.get('title'), 'The case does not open', 'title is the first line');
    eq(u.searchParams.get('version'), '1.0.0-rc.5', 'version prefilled'); eq(u.searchParams.get('os'), 'Windows', 'os prefilled'); eq(u.searchParams.get('connection'), 'Radmin VPN', 'connection prefilled');
    const iu = new URL(r.idea.url); eq(iu.searchParams.get('template'), 'idea.yml', 'idea template'); eq(iu.searchParams.get('idea'), 'Dark mode please', 'idea text prefilled');
    check(new URL(r.lag.url).searchParams.get('title').startsWith('[Lag] '), 'lag title prefix');
    check(r.long.truncated && r.long.url.length < 6000, 'long text is cut so the link stays short', String(r.long.url.length));
    eq(r.red.n, 2, 'two room codes redacted'); check(!r.red.text.includes('AbC_123') && r.red.text.includes('hudini1:[removed]'), 'codes are replaced');
    check(r.leak.every(x => !x.includes('SECRETKEY99')), 'a room code typed into the fields never reaches the report or the link', r.leak.join('\n'));
    eq(r.link.n, 4, 'room, key, password and invite of a widget link are counted'); check(!/SECRET/.test(r.link.text) && r.link.text.includes('room=[removed]') && r.link.text.includes('#k=[removed]') && r.link.text.includes('&p=[removed]') && r.link.text.includes('#invite=[removed]') && r.link.text.includes('&v=9'), 'the widget link is cleaned and the rest stays', r.link.text);
    eq(r.os[0], 'Windows', 'detects Windows'); eq(r.os[1], 'Linux', 'detects Linux');
    await p.context().close();
  });

  await step('the link from the program fills version, system, role and connection', async () => {
    const p = await newPage('rep-prefill', { app: false, lang: 'en' });
    await p.goto(`${site.url}/report.html?lang=en&v=1.1.2&os=linux&role=moderator&conn=zerotier`); await p.waitForSelector('#stTitle');
    await p.click('[data-type="bug"]'); await p.click('#next');
    eq(await p.inputValue('#fVer'), '1.1.2', 'version'); eq(await p.inputValue('#fOs'), 'Linux', 'system'); eq(await p.inputValue('#fRole'), 'Moderator', 'role'); eq(await p.inputValue('#fConn'), 'ZeroTier', 'connection');
    await p.context().close();
  });

  await step('wizard: five steps to the GitHub link', async () => {
    const p = await open();
    check((await p.textContent('#stepOf')).includes('1') && (await p.textContent('#stepOf')).includes('5'), 'step counter');
    await p.click('[data-type="bug"]'); await p.click('#next');
    eq(await p.textContent('#stTitle'), 'What to collect', 'step 2');
    check((await p.textContent('.rp-warn')).includes('hudini1:'), 'room code warning is shown');
    await p.fill('#fVer', '1.0.0-rc.5'); await p.selectOption('#fConn', 'Tailscale'); await p.click('#next');
    check(await p.isDisabled('#next'), 'next is blocked until something is written');
    await p.fill('#fWhat', 'The panel freezes when I add a timer'); await p.fill('#fSteps', '1. open timer tab');
    check(!(await p.isDisabled('#next')), 'next unlocks');
    check(!(await p.$('#prev')), 'the report preview is not shown while describing');
    await p.click('#next');
    const href = await p.getAttribute('#gh', 'href'); const u = new URL(href);
    eq(u.searchParams.get('what'), 'The panel freezes when I add a timer', 'link carries the description'); eq(u.searchParams.get('connection'), 'Tailscale', 'link carries the connection');
    check((await p.textContent('.rp-note')).length > 10, 'step 4 asks to attach the log');
    await p.click('#next'); eq(await p.textContent('#stTitle'), 'Attach the log', 'step 5');
    const prev = await p.textContent('#prev'); check(prev.includes('Tailscale') && prev.includes('The panel freezes'), 'the report and Copy are at the very end', prev);
    await p.setInputFiles('#logFile', { name: 'app.log', mimeType: 'text/plain', buffer: Buffer.from('start\njoin hudini1:SECRETKEY123 ok\n') });
    await p.waitForSelector('#dlClean'); check((await p.textContent('#chkOut')).includes('1 room code'), 'finds the room code in a log');
    await p.setInputFiles('#logFile', { name: 'ok.log', mimeType: 'text/plain', buffer: Buffer.from('all fine\n') });
    await p.waitForSelector('.rp-good'); check(!(await p.$('#dlClean')), 'clean log passes');
    await p.click('#next'); eq(await p.textContent('#stTitle'), 'What is it about?', 'restart goes to step 1');
    await p.context().close();
  });

  await step('idea flow opens the idea form', async () => {
    const p = await open();
    await p.click('[data-type="idea"]'); await p.click('#next');
    eq(await p.textContent('#stepOf'), 'Step 2 of 3', 'an idea has three steps');
    await p.fill('#fWhat', 'Please add a dark theme for the panel'); await p.click('#next');
    eq(await p.textContent('#stepOf'), 'Step 3 of 3', 'the idea goes straight to GitHub');
    check(!(await p.$('.rp-note')), 'no log request for an idea');
    eq(new URL(await p.getAttribute('#gh', 'href')).searchParams.get('template'), 'idea.yml', 'idea template');
    await p.context().close();
  });

  await step('four languages, no stray Russian, links from other pages', async () => {
    for(const l of ['en', 'ru', 'uk', 'de']){
      const p = await open(l); const h = await p.textContent('h1');
      check(h && h.length > 10, l + ': heading ' + h);
      if(l === 'en' || l === 'de') check(!/[а-яё]/i.test(await p.textContent('main')), l + ': no stray Russian');
      await p.context().close();
    }
    for(const f of ['index.html', 'help.html', 'moderator.html']){
      const p = await newPage('rep-link', { app: false, lang: 'ru' }); await p.goto(`${site.url}/${f}`);
      await p.waitForSelector('a[data-rep]'); check(/^(\.\.\/)?report\.html/.test(await p.getAttribute('a[data-rep]', 'href')), f + ': link to the report page');
      await p.context().close();
    }
  });

  await site.close(); await closeBrowser();
  process.exit(finish());
})();
