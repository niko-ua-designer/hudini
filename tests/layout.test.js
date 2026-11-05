// No button sticks out of its panel or gets cut off, in every language, on a laptop and a Full HD screen.
'use strict';
const T = require('./lib');
const { step, check } = T;
(async () => {
  const pub = await T.publicBroker(), web = await T.webServer();
  for(const lang of ['ru', 'en', 'uk', 'de']) for(const [w, h] of [[1366, 768], [1920, 1080]]) await step(`${lang} ${w}×${h}`, async () => {
    const p = await T.newPage('panel-' + lang, { w, h, lang });
    await p.goto(`${web.url}/moderator.html?broker=${encodeURIComponent(pub.url)}`); await p.waitForTimeout(800);
    await p.click('[data-add=poll]');
    const bad = [];
    for(const tab of ['add', 'scenes', 'chat', 'auto', 'room']){
      await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(120);
      bad.push(...await p.evaluate(tab => [...document.querySelectorAll('button, select, .pill, input')].filter(b => {
        if(!b.offsetParent) return false;
        const r = b.getBoundingClientRect(), box = b.closest('aside, header, #toolbar'); if(r.width < 4 || !box) return false;
        const pr = box.getBoundingClientRect();
        const clipped = b.tagName === 'BUTTON' && !b.querySelector('.lvl') && b.scrollWidth > b.clientWidth + 2;
        return clipped || r.right > pr.right + 1 || r.left < pr.left - 1;
      }).map(b => tab + ': ' + (b.id || b.textContent.trim().slice(0, 30))), tab));
    }
    check(!bad.length, 'every control fits', [...new Set(bad)]);
    await p.context().close();
  });
  await T.closeBrowser(); await pub.close(); await web.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
