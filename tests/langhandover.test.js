// Language of the Host window and the OBS dock: ?lang= hands it over from another window, a choice made in the window stays.
'use strict';
const { chromium } = require('playwright');
const T = require('./lib');
const { step, check, eq, until } = T;

(async () => {
  const host = T.startHost({ OVERLAY_SITE: 'off' }); await host.ready();
  await host.api('/api/ui', { tourDone: true });   // the tour of the Host window would cover the switch
  const browser = await chromium.launch();
  const p = await browser.newPage();   // a clean profile: unlike T.newPage nothing presets the language
  p.on('pageerror', e => T.pageErrors.push('hostui: ' + e.message));
  const lang = () => p.evaluate(() => window.HudiniI18n?.lang).catch(() => null);
  // the way the app opens the Host window: its first screen passes its own language
  const open = async l => { await p.goto(`${host.admin}/?lang=${l}`); };
  const pick = async l => { await p.selectOption('[data-i18n-switch] select', l); return until(async () => await lang() === l, 5000); };

  await step('the first start takes the language of the app and asks nothing', async () => {
    await p.goto(`${host.admin}/auth?t=${host.token}&lang=en`);
    check(await until(async () => await lang() === 'en'), 'English, as handed over');
    eq(await p.isVisible('#langPick'), false, 'no second language question');
  });

  await step('a language chosen in the Host window stays: after the reload and after the next start', async () => {
    check(await pick('ru'), 'the switch changes the language');
    await open('en');
    eq(await lang(), 'ru', 'the app still says English, the choice made here stays');
  });

  await step('a language changed on the app start screen reaches the Host window', async () => {
    await open('de');
    eq(await lang(), 'de', 'the new language of the app applies');
    check(await pick('uk'), 'and can be changed here again');
    await open('de');
    eq(await lang(), 'uk', 'which stays');
  });

  await step('after an update the language chosen in the Host window is kept', async () => {
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('hudini.lang', 'de'); });   // what 1.1.2 left
    await open('en');
    eq(await lang(), 'de', 'the app language does not replace it');
  });

  await step('the dock has no switch and follows its link', async () => {
    for(const l of ['de', 'ru', 'en']){
      await p.goto(`${host.base}/dock?lang=${l}`);
      eq(await lang(), l, 'dock link ?lang=' + l);
    }
  });

  await browser.close(); await host.stop();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
