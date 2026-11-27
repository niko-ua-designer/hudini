// How the panel looks, in every language, on a 1440 wide window and in the app's smallest one (900x600): words stay whole,
// names are readable, the header keeps one line, the canvas keeps room, dialogs hold their buttons, and the streamer's
// own panel window does not talk about connecting a streamer.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

// visible buttons with a word broken between two lines
const splitWords = p => p.evaluate(() => [...document.querySelectorAll('aside button, .lockbox button')].filter(b => b.offsetParent).flatMap(b => {
  const bad = [], w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
  for(let n = w.nextNode(); n; n = w.nextNode()) for(const m of n.data.matchAll(/[^\s\-/]+/g)){
    const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
    if(new Set([...r.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top))).size > 1) bad.push((b.id || '') + ' ' + m[0]);
  }
  return bad;
}));
// controls that stick out of their column
const outside = p => p.evaluate(() => [...document.querySelectorAll('#panes button, #panes select, #panes input, #right button, #right select')].filter(n => {
  if(!n.offsetParent) return false;
  const r = n.getBoundingClientRect(), a = n.closest('#panes, #right').getBoundingClientRect();
  return r.width > 4 && (r.right > a.right + 1 || r.left < a.left - 1);
}).map(n => n.id || n.textContent.trim().slice(0, 30)));
// sliders and number fields squeezed to nothing
const squeezed = p => p.evaluate(() => [...document.querySelectorAll('#panes input[type=range], #panes input[type=number]')].filter(n => n.offsetParent && n.getBoundingClientRect().width < 36).map(n => n.id));
// the chosen value of a list is readable
const cut = (p, sel) => p.evaluate(sel => { const s = document.querySelector(sel), cs = getComputedStyle(s), c = document.createElement('canvas').getContext('2d'); c.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
  return c.measureText(s.selectedOptions[0].textContent).width > s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; }, sel);

(async () => {
  const web = await T.webServer();
  const open = async (lang, w, h, opts = {}) => {
    const p = await T.newPage('visual-' + lang, { lang, w, h, ...opts });
    await p.goto(`${web.url}/panel/moderator.html`);
    await p.waitForFunction(() => window.hudiniReady && window.HudiniUI, null, { timeout: 15000 });
    return p;
  };

  for(const lang of ['ru', 'en', 'uk', 'de']) for(const [w, h] of [[1440, 880], [900, 600]]) await step(`${lang} ${w}×${h}: side columns, lists, header, dialogs`, async () => {
    const p = await open(lang, w, h);
    const split = [], out = [], thin = [];
    const look = async where => { await sleep(120); split.push(...(await splitWords(p)).map(x => where + ': ' + x)); out.push(...(await outside(p)).map(x => where + ': ' + x)); thin.push(...(await squeezed(p)).map(x => where + ': ' + x)); };
    await p.click('[data-add=poll]'); await look('add');
    // the backdrop source of the streamer's panel
    await p.evaluate(() => { document.getElementById('bcBack').hidden = false; document.getElementById('bcBgSrc').value = 'cam'; });
    check(!(await cut(p, '#bcBgSrc')), 'the backdrop source is readable');
    await p.click('[data-tab=auto]'); await p.click('#scnNew'); await look('scenario');
    await p.click('[data-tab=cs2]'); await look('cs2');
    check(!(await cut(p, '#taNum')), 'the player numbers list is readable');
    await p.click('[data-tab=raffle]'); await p.click('[data-rtool=raffle]'); await p.click('#rafCreate'); await look('raffle');
    await p.click('[data-rtool=case]'); await p.click('#caseCreate'); await look('case');
    const names = async sel => p.evaluate(sel => [...document.querySelectorAll(sel)].map(i => { const r = i.getBoundingClientRect(), pane = document.getElementById('panes').getBoundingClientRect(); return Math.round(r.width / pane.width * 100); }), sel);
    const k = await names('#kItems input[data-f=n]');
    check(k.length && k.every(x => x > 55), 'case item names take most of the column (% of it)', k);
    await p.click('[data-rtool=roulette]'); await p.click('#rouCreate'); await p.evaluate(() => { document.getElementById('rouViewers').open = true; }); await look('roulette');
    const r = await names('#rouPrizes input[data-f=n]');
    check(r.length && r.every(x => x > 55), 'prize names take most of the column (% of it)', r);
    await p.click('[data-tab=room]'); await look('room');
    eq([...new Set(split)], [], 'no word is broken inside a button');
    eq([...new Set(out)], [], 'nothing sticks out of a column');
    eq([...new Set(thin)], [], 'no slider or number field is squeezed');

    if(w === 900){
      await p.click('[data-tab=add]'); await sleep(200);
      const g = await p.evaluate(() => { const t = document.getElementById('toolbar'), s = document.getElementById('stageBox'); return { stage: s.clientWidth, bar: t.offsetHeight, over: t.scrollWidth - t.clientWidth, scroll: getComputedStyle(t).overflowX, page: document.documentElement.scrollWidth }; });
      check(g.stage >= 360, 'the canvas keeps room: ' + g.stage);
      check(g.bar < 70 && g.scroll === 'auto' && g.over > 0 && g.page <= 900, 'the tools are one row that scrolls', g);
      // the tour shows what it talks about: the highlighted part is on screen and the card does not cover it
      await p.evaluate(() => HudiniUI.tour(0));
      const bad = [];
      for(let i = 0; i < 14 && await p.$('#tour'); i++){
        await sleep(450);
        const t = await p.evaluate(() => { const h = document.getElementById('tourHole'), a = h.getBoundingClientRect(), b = document.getElementById('tourBox').getBoundingClientRect();
          const inWin = b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
          const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          return { inWin, center: h.classList.contains('center'), covered: Math.round(x * y / (a.width * a.height || 1) * 100), title: document.querySelector('#tourBox h3').textContent }; });
        if(!t.inWin || (!t.center && t.covered > 5)) bad.push(t);
        if(await p.$('#tourMute')) await p.click('#tourMute'); else await p.click('#tourNext');
      }
      eq(bad, [], 'every tour card fits and leaves its target visible');
    }

    // the header: one line at 1440, also while paused and with the update button; the pause strip spans the window
    if(w === 1440) for(const upd of [false, true]){
      await p.evaluate(upd => { pausedRoom = room; hostStatus(); document.getElementById('updBanner').hidden = !upd; }, upd); await sleep(200);
      const hd = await p.evaluate(() => { const kids = [...document.querySelector('header').children].filter(n => n.offsetParent && !['connStrip', 'moreMenu'].includes(n.id) && n.offsetWidth);
        const mid = kids.map(n => { const r = n.getBoundingClientRect(); return r.top + r.height / 2; }), s = document.getElementById('connStrip').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect();
        return { spread: Math.round(Math.max(...mid) - Math.min(...mid)), right: Math.round(Math.max(...kids.map(n => n.getBoundingClientRect().right))), strip: [Math.round(s.left - h.left), Math.round(h.right - s.right)] }; });
      check(hd.spread < 8 && hd.right <= w, `paused${upd ? ' with the update button' : ''}: the header is one line`, hd);
      eq(hd.strip, [0, 0], 'the pause strip takes the whole width');
    }

    // dialogs
    await p.evaluate(() => { document.getElementById('lock').hidden = false; });
    const lk = await p.evaluate(() => { const b = document.getElementById('lockReset'), box = b.closest('.lockbox').getBoundingClientRect(), r = b.getBoundingClientRect();
      return { fits: r.left >= box.left && r.right <= box.right && b.scrollWidth <= b.clientWidth + 1, bg: getComputedStyle(document.getElementById('lockPass')).backgroundColor }; });
    check(lk.fits, 'the lock dialog holds its buttons');
    eq(lk.bg, 'rgb(29, 33, 42)', 'the password field has the panel style');
    eq(await splitWords(p), [], 'and no broken words');
    await p.evaluate(() => { document.getElementById('lock').hidden = true; });
    eq(await p.evaluate(() => getComputedStyle(document.getElementById('taStrip')).backgroundColor), 'rgb(29, 33, 42)', 'a field without a type has it too');

    // help drawer: the search row sits above the text
    await p.evaluate(() => HudiniUI.openHelp()); await p.waitForSelector('#helpDrawer details');
    await sleep(350);
    const hp = await p.evaluate(() => { const d = document.getElementById('helpDrawer'), bar = d.firstElementChild.getBoundingClientRect(), body = d.querySelector('.hd-body').getBoundingClientRect(), r = d.getBoundingClientRect();
      return { pos: getComputedStyle(d.firstElementChild).position, bar: Math.round(bar.width - r.width), under: body.top >= bar.bottom - 1, q: document.getElementById('hdQ').getBoundingClientRect().width > r.width / 2 }; });
    check(hp.pos === 'static' && Math.abs(hp.bar) <= 2 && hp.under && hp.q, 'the help drawer is laid out: search row, then text', hp);
    await p.context().close();
  });

  await step('the streamer\'s panel window: no link to send, no steps for connecting a streamer', async () => {
    for(const own of [false, true]){
      const p = await open('ru', 1440, 880);
      if(own) await p.evaluate(() => document.body.classList.add('streamer-panel'));
      await p.click('#helpBtn');
      eq(/Как подключить стримера/.test(await p.textContent('#helpMenu')), !own, 'help menu item for the moderator only');
      await p.click('#helpBtn');
      await p.click('#moreBtn');
      eq([await p.isVisible('#link'), await p.isVisible('#copyLink'), await p.isVisible('#clearAll')], [!own, !own, true], 'the Host link under «More» is for the moderator only');
      await p.click('#moreBtn');
      await p.evaluate(() => HudiniUI.tour(0));
      const texts = [];
      for(let i = 0; i < 14 && await p.$('#tour'); i++){ texts.push(await p.textContent('#tourBox h3') + ' ' + await p.textContent('#tourBox p')); if(await p.$('#tourMute')) await p.click('#tourMute'); else await p.click('#tourNext'); }
      eq(/отправь ссылку стримеру|экране стримера|программой стримера|экран стримера/.test(texts.join(' ')), !own, own ? 'the tour speaks to the streamer' : 'the moderator\'s tour is as before');
      await p.click('#status'); await sleep(150);
      eq([await p.isVisible('#hostTip'), await p.isVisible('#connPop')], [!own, own], 'a click on the status: connection steps for the moderator, details for the streamer');
      await p.context().close();
    }
  });

  await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
