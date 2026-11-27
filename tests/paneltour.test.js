// The tour of the moderator panel: on the first start and once for a panel updated from an older version, with the
// question about program sounds, and replayable from the settings.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const web = await T.webServer();
  async function open(ui, lang = 'ru'){
    const p = await T.newPage('panel', { tour: true, lang });
    if(ui) await p.addInitScript(v => { if(!localStorage.getItem('hudini.ui')) localStorage.setItem('hudini.ui', v); }, JSON.stringify(ui));
    await p.goto(`${web.url}/panel/moderator.html`);
    await p.waitForFunction(() => window.hudiniReady && window.HudiniUI, null, { timeout: 15000 });
    return p;
  }
  const title = p => p.textContent('#tourBox h3');
  const answer = p => p.evaluate(() => HudiniSounds.answer());
  const seen = p => p.evaluate(() => JSON.parse(localStorage.getItem('hudini.ui') || '{}').tour);
  const gone = async p => { await sleep(1500); return !(await p.$('#tour')); };
  async function walk(p){   // to the question about sounds
    for(let i = 0; i < 20 && !(await p.$('#tourSoundOn')); i++) await p.click('#tourNext');
  }

  await step('first start: the tour, with the question about sounds before the last step', async () => {
    const p = await open();
    check(await until(() => p.isVisible('#tour')), 'it opens');
    await walk(p);
    check(await p.isVisible('#tourSoundOn') && await p.isHidden('#tourNext') && await p.isHidden('#tourSkip'), 'only the two answers (and back)');
    eq(await answer(p), null, 'not answered yet');
    await p.click('#tourSoundOn');
    eq(await answer(p), true, 'sounds on');
    check((await title(p)).includes('Настроим под тебя'), 'the last step follows');
    await p.click('#tourNext');
    check(await until(async () => await seen(p) === 2), 'remembered', await seen(p));
    await p.reload(); await p.waitForFunction(() => window.hudiniReady && window.HudiniUI);
    check(await gone(p), 'not shown again');
    await p.click('[data-tab=room]');
    check(await p.isChecked('#uiSounds'), 'the switch in the settings shows the answer');
    await p.click('#uiSounds'); eq(await answer(p), false, 'and changes it');
    await p.click('#uiTour');
    check(await until(() => p.isVisible('#tour')), 'replayed from the settings');
    let asked = false; for(let i = 0; i < 20 && await p.$('#tour'); i++){ asked ||= !!(await p.$('#tourSoundOn')); await p.click('#tourNext'); }
    check(!asked, 'no question once it is answered');
    await p.context().close();
  });

  await step('updated from an older version: once more; skipping still asks about sounds', async () => {
    const p = await open({ v: 1, tour: 1, fs: 14 });
    check(await until(() => p.isVisible('#tour')), 'the tour of the new version opens');
    await p.click('#tourNext'); await p.click('#tourSkip');
    check(await p.isVisible('#tourSoundOn'), 'the question');
    await p.click('#tourMute');
    check(!(await p.$('#tour')), 'and the tour ends');
    eq(await answer(p), false, 'sounds off');
    check(await until(async () => await seen(p) === 2), 'remembered');
    await p.reload(); await p.waitForFunction(() => window.hudiniReady && window.HudiniUI);
    check(await gone(p), 'only once');
    await p.context().close();
  });

  await step('answered before: skip closes the tour at once', async () => {
    const p = await T.newPage('panel', { tour: true });
    await p.addInitScript(() => localStorage.setItem('fake.store', JSON.stringify({ 'hudini.sounds': true, 'overlay.vaultWarn': Date.now() + 864e5 })));
    await p.goto(`${web.url}/panel/moderator.html`);
    check(await until(() => p.isVisible('#tour'), 15000), 'opens');
    await p.click('#tourNext'); await p.click('#tourSkip');
    check(!(await p.$('#tour')), 'closed');
    await p.context().close();
  });

  await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
