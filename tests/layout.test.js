// No button sticks out of its panel or gets cut off, in every language, on a laptop and a Full HD screen.
'use strict';
const T = require('./lib');
const { step, check } = T;
(async () => {
  const web = await T.webServer();
  for(const lang of ['ru', 'en', 'uk', 'de']) for(const [w, h] of [[1366, 768], [1920, 1080]]) await step(`${lang} ${w}×${h}`, async () => {
    const p = await T.newPage('panel-' + lang, { w, h, lang });
    await p.goto(`${web.url}/panel/moderator.html`); await p.waitForTimeout(800);
    await p.click('[data-add=poll]');
    await p.click('[data-add=poll]');   // две вещи и папка с длинным именем: строки слоёв не должны вылезать
    await p.keyboard.press('Escape'); await p.keyboard.press('Control+KeyA'); await p.click('#tGroup');
    await p.evaluate(() => { state.els.forEach(e => { if(e.g) e.gn = 'Очень длинное название папки слоёв для проверки'; }); renderAll(); });
    await p.click('#addChatFeed');   // выбран чат на стриме: проверяем и его инспектор
    await p.click('#webBtn'); await p.waitForTimeout(300);   // и колонку браузера справа
    const stageW = await p.evaluate(() => document.getElementById('stageBox').clientWidth);
    check(stageW > 330, 'the canvas keeps a usable width with the browser open: ' + stageW);
    const bad = [];
    for(const tab of ['add', 'scenes', 'chat', 'auto', 'raffle', 'sound', 'room']){
      await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(120);
      bad.push(...await p.evaluate(tab => [...document.querySelectorAll('button, select, .pill, input')].filter(b => {
        if(!b.offsetParent) return false;
        const r = b.getBoundingClientRect(), box = b.closest('aside, header, #toolbar'); if(r.width < 4 || !box) return false;
        const pr = box.getBoundingClientRect();
        const clipped = b.tagName === 'BUTTON' && !b.querySelector('.lvl') && b.scrollWidth > b.clientWidth + 2;
        // a label broken into a tall narrow column (e.g. "С отсчётом" squeezed next to an input)
        const squeezed = b.tagName === 'BUTTON' && !b.closest('.tiles, #tabs') && r.height > 64 && r.width < 140;
        return clipped || squeezed || r.right > pr.right + 1 || r.left < pr.left - 1;
      }).map(b => tab + ': ' + (b.id || b.textContent.trim().slice(0, 30))), tab));
    }
    check(!bad.length, 'every control fits', [...new Set(bad)]);
    // two header buttons hide the left and the right panel; the canvas takes the room; the choice is remembered
    const hb = await p.evaluate(() => ['hideLBtn', 'hideRBtn'].map(id => { const b = document.getElementById(id), r = b?.getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect(); return !!b && b.offsetParent !== null && r.width > 8 && r.left >= h.left && r.right <= h.right + 1 && r.right <= innerWidth && /\S/.test(b.title); }));
    check(hb[0] && hb[1], 'both panel buttons are in the header, fit, and have a title', hb);
    const geo = () => p.evaluate(() => ({ l: document.getElementById('left').offsetParent !== null, r: document.getElementById('right').offsetParent !== null, stage: document.getElementById('stageBox').clientWidth, fit: document.getElementById('stage').getBoundingClientRect().width }));
    const g0 = await geo();
    await p.click('#hideLBtn'); await p.waitForTimeout(250);
    const g1 = await geo();
    check(!g1.l && g1.r && g1.stage > g0.stage + 200 && g1.fit > g0.fit, 'the left button hides the left panel and the canvas grows', [g0, g1]);
    await p.click('#hideRBtn'); await p.waitForTimeout(250);
    const g2 = await geo();
    check(!g2.l && !g2.r && g2.stage > g1.stage + 200, 'the right button hides the right panel too', [g1, g2]);
    await p.waitForTimeout(500);   // the view is saved a moment after the click
    await p.reload(); await p.waitForTimeout(800);
    const g3 = await geo();
    check(!g3.l && !g3.r && Math.abs(g3.stage - g2.stage) < 20, 'both stay hidden after a reload', [g2, g3]);
    await p.click('#hideLBtn'); await p.click('#hideRBtn'); await p.waitForTimeout(250);
    const g4 = await geo();
    check(g4.l && g4.r && g4.stage < g3.stage - 200, 'the buttons bring the panels back', g4);
    await p.context().close();
  });
  await T.closeBrowser(); await web.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
