// The Host window: sidebar navigation that survives polling, controls that appear only when the program sends their data,
// moderator requests reachable everywhere, notification settings, updates, "what is new" and the window tour.
// The newer fields of /api/status and their endpoints are faked here by intercepting the page's requests.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const VIEWS = ['home', 'obs', 'code', 'rights', 'notify', 'app', 'log'];
const EVIL = '<img src=x onerror="window.__pwned=1">';

(async () => {
  const host = T.startHost({ OVERLAY_SITE: 'off', OVERLAY_PANEL_ORIGIN: 'http://localhost:1' }); await host.ready();   // an origin for the panel: the button exists
  // what the fake program says on top of the real status, and what the window sent to it
  let fake = null; const sent = [], asked = [];
  async function open(opts = {}) {
    const p = await T.newPage('ui', { app: false, w: 980, h: 760, ...opts });
    p.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) asked.push(u.pathname); });
    // without a fake the page sees a program that sends none of the newer fields, whatever the real one sends
    const bare = j => { delete j.notify; delete j.ui; for(const k of ['channel', 'kind', 'rollback', 'notes']) delete j.upd?.[k]; return j; };
    await p.route('**/api/status', async r => { const res = await r.fetch(), j = await res.json(); await r.fulfill({ json: fake ? fake.status(j) : bare(j) }); });
    for (const path of ['notify', 'update/channel', 'update/rollback', 'update/apply', 'ui', 'control'])
      await p.route('**/api/' + path, async r => { if (!fake) return r.continue(); const body = r.request().postDataJSON(); sent.push([path, body]); fake.post(path, body); await r.fulfill({ json: { ok: true } }); });
    await p.route('**/api/changelog*', r => fake ? r.fulfill({ json: fake.changelog }) : r.continue());
    await p.goto(`${host.admin}/auth?t=${host.token}`);
    await p.waitForURL(u => new URL(u).pathname === '/');
    await p.waitForFunction(() => document.getElementById('ver').textContent !== '—');
    return p;
  }
  function newFake() {
    const f = {
      pending: [], ready: false, found: false, kind: null, latest: '9.9.9', channel: 'stable', rollback: null,
      notify: { visibleOnlyMedia: true, groups: {
        moderators: { on: true, kinds: { join: true, leave: false } }, media: { locked: true, kinds: { cam: true, screen: true, mic: true } },
        obs: { on: true, kinds: { widgetUp: true, widgetDown: true, dock: false } }, cs2: { on: false, kinds: { appeared: true } },
        system: { on: true, kinds: { updateReady: true, updateError: true, modPort: true, roomNew: true } } } },
      ui: { sounds: false, tourDone: true, whatsNew: null },
      changelog: { current: '9.9.0-rc.1', entries: [{ ver: '9.9.0-rc.1', date: '2026-11-28', beta: true, sections: [{ title: 'Часть ' + EVIL, items: ['пункт ' + EVIL] }], testing: ['проверка ' + EVIL] },
        { ver: '9.8.0', date: '2026-11-01', beta: false, sections: [{ title: 'Старое', items: ['раньше'] }], testing: [] }] },
      status(s) {
        s.media = { pending: f.pending, live: [] }; s.notify = f.notify; s.ui = f.ui; s.roomNotice = false;
        s.upd = { state: f.ready ? 'ready' : f.found ? 'available' : 'latest', latest: f.latest, err: '', auto: true, ready: f.ready, compiled: true, checkedAt: Date.now(), prog: null, channel: f.channel, kind: f.kind, rollback: f.rollback,
          notes: f.ready ? { ver: f.latest, sections: [{ title: 'Обновление', items: [EVIL] }] } : undefined };
        return s;
      },
      post(path, b) {
        if (path === 'notify') { const g = f.notify.groups[b.group]; if (b.kind) g.kinds[b.kind] = b.on; else g.on = b.on; }
        if (path === 'update/channel') { f.channel = b.channel; f.rollback = b.channel === 'stable' ? { ver: '9.8.0' } : null; }
        if (path === 'ui') { if ('sounds' in b) f.ui.sounds = b.sounds; if ('tourDone' in b) f.ui.tourDone = b.tourDone; if (b.seenWhatsNew) f.ui.whatsNew = null; }
        if (path === 'control') f.pending = f.pending.filter(x => x.key !== b.key);
      },
    };
    return f;
  }
  const hidden = async (p, ids) => (await Promise.all(ids.map(async id => await p.isVisible('#' + id) ? id : null))).filter(Boolean);
  const page = p => p.evaluate(() => [...document.querySelectorAll('[data-page]')].filter(s => !s.hidden).map(s => s.dataset.page).join());
  const polls = () => sleep(4600);   // at least two status requests
  const go = (p, v) => p.click(`#nav [data-go="${v}"]`);
  const posts = path => sent.filter(x => x[0] === path).map(x => x[1]);

  await step('against a program without the new fields: nothing new shows and nothing new is requested', async () => {
    const p = await open();
    eq(await hidden(p, ['navNotify', 'tour', 'newsModal', 'updOverlay', 'tipUpd']), [], 'no new navigation, windows or tips');
    await go(p, 'app');
    eq(await hidden(p, ['chanRow', 'rollBox', 'uiCard', 'newsCard', 'updKind', 'updNotes', 'updAutoHint']), [], 'no channel, rollback, sounds, changelog');
    check(await p.isVisible('#updCheck') && await p.isVisible('#updAuto + .sw'), 'the existing update controls stay');
    check(/пока стрим|стрим не идёт/.test(await p.textContent('#updAutoRow')), 'the automatic update is described as this program does it');
    await p.evaluate(() => { location.hash = 'notify'; });
    check(await until(async () => await page(p) === 'home'), 'a section the program does not have leads to the overview');
    await polls();
    eq(asked.filter(u => /changelog|api\/notify|api\/ui$/.test(u)), [], 'no requests to endpoints it lacks');
    await p.context().close();
  });

  await step('every section opens; each card and its ids are in place', async () => {
    const p = await open();
    for (const [v, ids] of [['home', ['codeBox', 'copyCode', 'modsOn', 'obs', 'copyObs', 'modBox']], ['obs', ['obs', 'copyObs', 'dockUrl', 'copyDock', 'gsiInstall', 'gsiDl']],
      ['code', ['codeBox', 'copyCode', 'newPass', 'newRoom', 'fpTxt', 'addrBody', 'extAddr']], ['rights', ['permCard', 'limCard', 'limSave']], ['app', ['updCard', 'aboutCard', 'reportLink']], ['log', ['sObs', 'sTun', 'logs', 'logCopy']]]) {
      await go(p, v);
      eq([await page(p), (await Promise.all(ids.map(async id => await p.$eval('#' + id, e => !!e.getClientRects().length) ? null : id))).filter(Boolean)], [v, []], 'section ' + v);
    }
    eq(await p.$$eval('#panelCard #openPanel', n => n.length), 1, 'the panel button is in the sidebar');
    check(await p.isVisible('#openPanel'), 'and visible from any section');
    await p.context().close();
  });

  await step('polling does not move the reader: section, focus, scroll, typed text, open groups', async () => {
    fake = newFake();
    const p = await open({ w: 720, h: 520 });
    await go(p, 'code');
    await p.fill('#extAddr', 'half-typed'); await p.focus('#extAddr');
    await polls();
    eq([await page(p), await p.evaluate(() => document.activeElement.id), await p.inputValue('#extAddr')], ['code', 'extAddr', 'half-typed'], 'section, focus and text stay');
    await go(p, 'notify');
    await p.click('#ng_cs2'); await p.click('#ng_moderators');
    await p.focus('#ng_system');
    await p.evaluate(() => { document.getElementById('scroll').scrollTop = 120; });
    await polls();
    eq(await p.$$eval('.ng-open', n => n.map(b => b.getAttribute('aria-expanded'))), ['false', 'true', 'true', 'true', 'false'], 'open groups stay');
    eq(await p.evaluate(() => [document.activeElement.id, document.getElementById('scroll').scrollTop]), ['ng_system', 120], 'focus and scroll stay');
    await p.reload(); await p.waitForFunction(() => document.querySelector('.ng'));
    eq([await page(p), await p.getAttribute('#ng_cs2', 'aria-expanded')], ['notify', 'true'], 'the section and the groups are remembered after a reload');
    await p.goto(`${host.admin}/`); await p.waitForFunction(() => document.querySelector('.ng'));
    eq(await page(p), 'notify', 'also without the address fragment');
    await p.context().close();
  });

  await step('a moderator request is visible and answerable in every section', async () => {
    fake = newFake(); fake.pending = [{ kind: 'cam', ip: '10.0.0.7', key: 'k1' }];
    const p = await open({ w: 720, h: 520 });
    const bad = [];
    for (const v of VIEWS) {
      await go(p, v);
      await p.evaluate(() => { document.getElementById('scroll').scrollTop = 1e6; });
      if (!await p.locator('#askBox button').first().isVisible()) bad.push(v);
    }
    eq(bad, [], 'in all sections, also scrolled to the end');
    check(/10\.0\.0\.7/.test(await p.textContent('#askBox')) && /^\(1\)/.test(await p.title()), 'who asks, and the count in the title');
    await p.click('#askBox button.primary');
    check(await until(async () => await p.isHidden('#askCard')), 'answered');
    eq(posts('control').pop(), { action: 'mediaallow', key: 'k1' }, 'the same call as before');
    await p.context().close();
  });

  await step('notification settings: groups and single kinds are switched; camera, screen and microphone cannot be', async () => {
    fake = newFake(); sent.length = 0;
    const p = await open();
    await go(p, 'notify');
    eq(await p.$$eval('.ng', n => n.map(g => g.dataset.group)), ['moderators', 'media', 'obs', 'cs2', 'system'], 'five groups');
    eq(await p.$$eval('[data-group="media"] input', n => n.length), 0, 'no switches for media requests');
    eq(await p.textContent('[data-group="moderators"] .ng-title small'), 'включено 1 из 2', 'summary');
    await p.click('#nt_moderators_leave + .sw');
    check(await until(async () => posts('notify').length === 1), 'sent');
    eq(posts('notify')[0], { group: 'moderators', kind: 'leave', on: true }, 'one kind');
    await p.click('#nt_obs + .sw');
    check(await until(async () => await p.isDisabled('#nt_obs_dock')), 'a switched-off group greys out its kinds');
    eq(posts('notify')[1], { group: 'obs', on: false }, 'a whole group');
    await p.focus('#nt_cs2'); await p.keyboard.press('Space');
    check(await until(async () => posts('notify').length === 3), 'with the keyboard');
    await polls();
    eq(await p.evaluate(() => [document.activeElement.id, document.activeElement.checked]), ['nt_cs2', true], 'focus stays on the switch');
    await p.context().close();
  });

  await step('updates: channel, rollback or wait, and the changelog as plain text', async () => {
    fake = newFake(); sent.length = 0; fake.channel = 'beta';
    const p = await open();
    await go(p, 'app');
    check(await until(() => p.isVisible('#newsCard')), 'the changelog is shown');
    eq(await p.$$eval('#newsList details', n => n.map(d => d.open)), [true, false], 'the installed version is open');
    await p.click('#newsList details:nth-child(2) summary');
    await p.click('#chanRow label:first-of-type');
    check(await until(() => p.isVisible('#rollBox')), 'going back to stable offers a rollback');
    eq(posts('update/channel'), [{ channel: 'stable' }], 'channel sent');
    await p.click('#rollWait');
    check(await p.isHidden('#rollWait') && await p.isVisible('#rollNow'), 'waiting keeps the rollback at hand');
    await polls();
    check(await p.isHidden('#rollWait'), 'and the choice is remembered');
    eq(await p.$$eval('#newsList details', n => n.map(d => d.open)), [true, true], 'opened versions stay open');
    await p.click('#rollNow');
    check(await until(async () => posts('update/rollback').length === 1), 'rollback after a confirmation');
    check((await p.textContent('#newsList')).includes('пункт ' + EVIL), 'server text is shown as written');
    eq(await p.evaluate(() => [window.__pwned || 0, document.querySelectorAll('#newsList img').length]), [0, 0], 'and never becomes markup');
    await p.context().close();
  });

  await step('a downloaded update is offered over the whole window; "Later" holds for that version', async () => {
    fake = newFake(); sent.length = 0; Object.assign(fake, { ready: true, kind: 'hotfix' }); fake.pending = [{ kind: 'mic', ip: '10.0.0.8', key: 'k2' }];
    const p = await open({ w: 720, h: 520 });
    check(await until(() => p.isVisible('#updOverlay')), 'the offer is open');
    eq(await p.evaluate(() => [document.activeElement.id, document.getElementById('side').inert, document.getElementById('scroll').inert]), ['ovLater', true, true], 'focus on "Later", the rest is not clickable');
    const inside = new Set();
    for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); inside.add(await p.evaluate(() => document.activeElement.closest('#updOverlay') ? 'offer' : document.activeElement.closest('#global') ? 'request' : 'outside')); }
    eq([...inside].sort(), ['offer', 'request'], 'Tab goes round the offer and the request');
    const [ask, box] = await Promise.all([p.locator('#askCard').boundingBox(), p.locator('#updOverlay .rbox').boundingBox()]);
    check(ask.y >= 0 && ask.y + ask.height <= box.y + 1, 'the request lies above the offer, not under it', { ask, box });
    await p.click('#askBox button:not(.primary)');   // a real click: nothing covers it
    check(await until(async () => posts('control').some(b => b.action === 'mediadeny')), 'the request can be answered');
    eq(await p.evaluate(() => [window.__pwned || 0, document.querySelectorAll('#ovNotes img').length]), [0, 0], 'release notes stay text');
    await p.focus('#ovLater'); await p.keyboard.press('Escape');
    check(await p.isHidden('#updOverlay'), 'Escape means "Later"');
    check(await p.isVisible('#navUpd') && await p.isVisible('#tipUpd'), 'the sidebar keeps a badge');
    await p.reload(); await p.waitForFunction(() => !document.getElementById('navUpd').hidden); await polls();
    check(await p.isHidden('#updOverlay'), 'not offered again after a reload');
    fake.latest = '9.9.10';
    check(await until(() => p.isVisible('#updOverlay')), 'the next version is offered');
    await p.click('#ovApply');
    check(await until(async () => posts('update/apply').length === 1), '"Update and restart" applies it');
    await p.context().close();
  });

  await step('a found update that is not downloaded: the button downloads it and restarts', async () => {
    fake = newFake(); sent.length = 0; Object.assign(fake, { found: true, kind: 'version' });
    const p = await open();
    check(await until(() => p.isVisible('#tipUpd')), 'a tip on the first page');
    eq(await hidden(p, ['updOverlay', 'navUpd']), ['navUpd'], 'a badge, no full-window offer');
    await go(p, 'app');
    check((await p.textContent('#updApply')).includes('Скачать и перезапустить') && (await p.textContent('#updInfo')).includes('9.9.9'), 'the button says what it does');
    await p.click('#updApply');
    check(await until(async () => posts('update/apply').length === 1), 'sent after a confirmation');
    await p.context().close();
  });

  await step('what is new: shown once after an update, then the tour; the tour asks about sounds even when skipped', async () => {
    fake = newFake(); sent.length = 0; fake.ui = { sounds: null, tourDone: false, whatsNew: { ver: '9.9.0-rc.1', beta: true } }; fake.pending = [{ kind: 'screen', ip: '10.0.0.9', key: 'k3' }];
    const p = await open();
    check(await until(() => p.isVisible('#newsModal')), 'the popup is open');
    const text = await p.textContent('#nwBody');
    check(text.includes('Что входит в бету') && text.includes('Что тестируется') && text.includes('проверка ' + EVIL), 'a beta tells what it includes and what is tested');
    check(await p.isHidden('#tour'), 'the tour waits');
    check(await p.locator('#askBox button').first().isVisible(), 'the request is visible');
    await p.click('#nwOk');
    check(await until(() => p.isVisible('#tour')), 'the tour follows');
    eq(posts('ui')[0], { seenWhatsNew: true }, 'the popup is reported as seen');
    await p.click('#askBox button:not(.primary)');
    check(await until(async () => posts('control').length === 1), 'a request can be answered during the tour');
    await p.click('#tourNext'); await p.click('#tourNext');
    eq(await page(p), 'home', 'the tour shows the main actions on the overview');
    await p.click('#tourBack');
    await polls();
    check(/^2 /.test(await p.textContent('#tourCount')), 'polling keeps the step');
    await p.click('#tourSkip');
    check(await p.isVisible('#tourSoundOn') && await p.isHidden('#tourSkip'), 'skipping leads to the sound question');
    await p.click('#tourSoundOn');
    check(await until(async () => posts('ui').length === 2), 'saved');
    eq(posts('ui')[1], { tourDone: true, sounds: true }, 'tour done and sounds on');
    await polls();
    check(await p.isHidden('#tour') && await p.isHidden('#newsModal'), 'neither comes back');
    await go(p, 'app');
    check(await p.isChecked('#soundsOn'), 'the sound switch in the settings shows the answer');
    await p.click('#soundsOn + .sw');
    check(await until(async () => posts('ui').length === 3), 'sent');
    eq(posts('ui')[2], { sounds: false }, 'and switches sounds off');
    await p.click('#tourReplay');
    check(await p.isVisible('#tour'), 'the tour can be replayed');
    let steps = 1; while (await p.isVisible('#tourNext') && steps < 20) { const last = await p.textContent('#tourNext') === 'Готово'; await p.click('#tourNext'); if (last) break; steps++; }
    eq(steps, 8, 'no sound question once it is answered');
    check(await until(async () => await p.isHidden('#tour') && await page(p) === 'app'), 'back where it started');
    await p.context().close();
  });

  await host.stop(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
