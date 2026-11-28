// Updates in the moderator role of the app: the program answers «UI …» lines (it has no ports in this role), and the
// start screen and the panel show the channel switch, automatic download, the offer, «what is new» and the changes.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const TOKEN = 'app-line-token';
const EVIL = '<img src=x onerror="window.__pwned=1">';
// an rc build starts on the beta channel, a finished version on the stable one
const VERSION = /^const VERSION = '([^']+)'/m.exec(fs.readFileSync(path.join(T.ROOT, 'server', 'server.js'), 'utf8'))[1];
const CHANNEL = VERSION.includes('-') ? 'beta' : 'stable';

// the app around the page: its program answers app_ui with the event hudini-info
function fakeProgram(opts){
  const F = window.__prog = {
    upd: { state: 'latest', latest: '9.9.0', err: '', auto: true, ready: false, compiled: true, checkedAt: Date.now(), prog: null, channel: 'stable', kind: null, rollback: null },
    ui: { sounds: null, tourDone: false, whatsNew: null }, sent: [],
    entries: [{ ver: '9.9.0', date: '2026-11-28', beta: false, sections: [{ title: 'Part ' + opts.evil, items: ['item ' + opts.evil] }], testing: [] },
      { ver: '9.8.0', date: '2026-11-01', beta: false, sections: [{ title: 'Old', items: ['before'] }], testing: [] }],
  };
  Object.assign(F.upd, opts.upd); Object.assign(F.ui, opts.ui);
  if(opts.sounds) localStorage.setItem('fake.store', JSON.stringify({ 'hudini.sounds': true }));
  const real = window.__TAURI__.core.invoke;
  window.__TAURI__.core.invoke = async (cmd, args) => {
    if(cmd === 'app_state'){ await real(cmd, args); return { role: 'mod', remember: true, running: 'mod', version: '9.9.0', update: F.upd.ready ? { state: 'ready', ver: F.upd.latest } : null }; }
    if(cmd !== 'app_ui') return real(cmd, args);
    const r = args.request; F.sent.push([r.op, r.value]); (F.requests ||= []).push(r);
    if(r.op === 'channel'){ F.upd.channel = r.value; F.upd.rollback = r.value === 'stable' ? { ver: '9.8.0' } : null; }
    if(r.op === 'auto') F.upd.auto = r.value;
    if(r.op === 'seen') F.ui.whatsNew = null;
    const info = structuredClone({ upd: F.upd, ui: F.ui, current: '9.9.0', ...(r.log ? { entries: F.entries } : {}) });
    setTimeout(() => window.__emit('hudini-info', info), 30);
  };
  window.__played = []; const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(){ if(this.dataset.sound) window.__played.push(this.dataset.sound); return play.call(this).catch(() => {}); };
}

(async () => {
  await step('the program in the moderator role answers «UI» lines and opens no ports', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-mod-'));
    const h = T.startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_SITE: 'off', OVERLAY_APP: '1', OVERLAY_APP_TOKEN: TOKEN, OVERLAY_ROLE: 'mod' });
    const infos = () => h.log().split('\n').filter(l => l.startsWith(TOKEN + ' INFO ')).map(l => JSON.parse(l.slice(TOKEN.length + 6)));
    async function ask(req){ const n = infos().length; h.proc.stdin.write('UI ' + JSON.stringify(req) + '\n'); await until(() => infos().length > n, 5000); return infos()[n]; }
    const a = await ask({ op: 'info', lang: 'en', log: true });
    check(a && a.upd.channel === CHANNEL && a.upd.auto === true && /^\d+\.\d+\.\d+/.test(a.current) && a.entries.length > 0 && a.ui.sounds === null, 'state and changes', a && { ...a, entries: a.entries?.length });
    const b = await ask({ op: 'channel', value: 'beta' });
    eq([b.upd.channel, b.error, b.entries], ['beta', undefined, undefined], 'the channel is switched; changes only when asked');
    eq((await ask({ op: 'auto', value: false })).upd.auto, false, 'automatic download off');
    check(!!(await ask({ op: 'channel', value: 'nightly' })).error, 'an unknown channel is refused');
    check(!!(await ask({ op: 'rollback' })).error, 'nothing to roll back to');
    await ask({ op: 'seen' });
    h.proc.stdin.write('UI not json\nUI null\n'); await sleep(300);
    check(h.proc.exitCode === null, 'bad lines change nothing');
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'overlay-host.json'), 'utf8'));
    eq([cfg.channel, cfg.autoUpdate], ['beta', false], 'saved');
    check(await fetch(`http://127.0.0.1:${h.port}/api/status`).then(() => false, () => true), 'no port');
    h.proc.stdin.end(); await h.stop();
  });

  await step('the Host of the streamer role does not answer them', async () => {
    const h = T.startHost({ OVERLAY_SITE: 'off', OVERLAY_APP: '1', OVERLAY_APP_TOKEN: TOKEN }); await h.ready();
    h.proc.stdin.write(`UI {"op":"channel","value":"${CHANNEL === 'beta' ? 'stable' : 'beta'}"}\n`); await sleep(700);
    check(!h.log().includes(TOKEN + ' INFO ') && (await h.api('/api/status')).upd.channel === CHANNEL, 'ignored');
    h.proc.stdin.end(); await h.stop();
  });

  const web = await T.webServer();
  async function open(url, opts = {}, lang = 'ru'){
    const p = await T.newPage('panel', { w: 980, h: 760, lang });
    p.on('pageerror', e => console.log(e.stack));
    await p.addInitScript(fakeProgram, { evil: EVIL, ...opts });
    await p.goto(web.url + url);
    return p;
  }
  const sent = (p, op) => p.evaluate(op => window.__prog.sent.filter(x => x[0] === op).map(x => x[1] ?? true), op);
  const calls = (p, cmd) => p.evaluate(c => window.__calls.filter(x => x[0] === c).length, cmd);
  const view = p => p.evaluate(() => document.getElementById('auModal')?.dataset.view || '');
  const focused = p => p.evaluate(() => document.activeElement.id);
  const applied = p => p.evaluate(() => window.__calls.filter(x => x[0] === 'apply_update').map(x => x[1]));

  await step('start screen: «what is new» once, then the offer of a downloaded update; «Later» keeps the app running', async () => {
    const p = await open('/app/start.html', { sounds: true, upd: { state: 'ready', ready: true, latest: '9.9.1', kind: 'hotfix', notes: { ver: '9.9.1', sections: [{ title: 'Fix', items: [EVIL] }] } }, ui: { whatsNew: { ver: '9.9.0', beta: false } } });
    check(await until(async () => await view(p) === 'news'), '«what is new» first');
    check((await p.textContent('#auModal')).includes('item ' + EVIL), 'the notes of this version, as text');
    check(await until(async () => (await p.evaluate(() => window.__played)).join() === 'update'), 'an update is heard', await p.evaluate(() => window.__played));
    await p.click('#auOk');
    check(await until(async () => await view(p) === 'offer'), 'then the offer');
    eq(await sent(p, 'seen'), [true], 'reported as seen');
    check((await p.textContent('#auModal')).includes('9.9.0 → v9.9.1'), 'from and to');
    await p.click('#auLater'); await sleep(500);
    eq([await view(p), await calls(p, 'apply_update')], ['', 0], 'closed, nothing installed');
    await p.reload(); await until(async () => await view(p) === 'news'); await p.click('#auOk'); await sleep(900);
    eq(await view(p), '', 'not offered again before the next start');
    check(await p.isVisible('#updBanner'), 'the banner stays');
    await p.evaluate(() => sessionStorage.clear()); await p.reload();
    check(await until(async () => await view(p) === 'news'), 'a fresh fake program');
    await p.click('#auOk'); await until(async () => await view(p) === 'offer'); await p.click('#auNow');
    check(await p.isVisible('#auConfirm') && await p.isVisible('#auModal'), '«Update and restart» asks in a window of its own');
    eq([await focused(p), await calls(p, 'apply_update'), await p.textContent('#auAskTitle')], ['auNo', 0, 'Перезапустить приложение?'], '«Cancel» has the focus, nothing installed yet');
    await p.keyboard.press('Enter');
    eq([await p.locator('#auConfirm').count(), await view(p), await calls(p, 'apply_update')], [0, 'offer', 0], 'Enter cancels');
    await p.click('#auNow'); await p.keyboard.press('Escape');
    eq([await p.locator('#auConfirm').count(), await calls(p, 'apply_update')], [0, 0], 'Escape cancels');
    await p.click('#auNow'); await p.click('#auYes');
    check(await until(async () => await calls(p, 'apply_update') === 1), 'confirmed: installs');
    eq(await applied(p), [{ confirmed: true }], 'and says so to the program');
    check(!(await p.evaluate(() => window.__pwned)), 'no markup from the notes');
    await p.context().close();
  });

  await step('start screen: the updates window with channel, automatic download, rollback and changes', async () => {
    const p = await open('/app/start.html');
    check(await until(() => p.isVisible('#updOpen')), 'the button');
    await p.click('#updOpen');
    check(await until(async () => (await p.textContent('#auState')).includes('9.9.0')), 'state');
    eq(await p.locator('#auLog details').count(), 2, 'the list of changes');
    check(await p.isChecked('input[name=auChannel][value=stable]') && await p.isChecked('#auAuto') && await p.isHidden('#auApply'), 'current settings, nothing to install');
    await p.click('input[name=auChannel][value=beta]'); await p.click('#auAuto'); await p.click('#auCheck');
    check(await until(async () => (await sent(p, 'check')).length === 1), 'check');
    eq([await sent(p, 'channel'), await sent(p, 'auto')], [['beta'], [false]], 'channel and automatic download');
    await p.click('input[name=auChannel][value=stable]');
    check(await until(() => p.isVisible('#auRollNow')), 'rollback is offered');
    await p.click('#auRollWait'); check(await p.isHidden('#auRollWait') && await p.isVisible('#auRollNow'), 'or waiting');
    await p.click('#auRollNow');
    check((await p.textContent('#auConfirm')).includes('9.8.0') && !(await p.textContent('#auConfirm')).includes('в простое'), 'the question names the version; 9.8 does not install by itself');
    eq((await sent(p, 'rollback')).length, 0, 'not sent yet');
    await p.click('#auYes');
    check(await until(async () => (await sent(p, 'rollback')).length === 1), 'sent after a confirmation');
    eq(await p.evaluate(() => window.__prog.requests.find(r => r.op === 'rollback').confirm), true, 'with the confirmation');
    await p.evaluate(() => { window.__prog.upd.rollback = { ver: '1.1.3' }; window.__emit('hudini-update', { state: 'latest', ver: '9.9.0' }); });
    check(await until(async () => (await p.textContent('#auRollNow')).includes('1.1.3')), 'an old stable version');
    await p.click('#auRollNow');
    check((await p.textContent('#auConfirm')).includes('1.1.3 программа стримера снова сама ставит обновления в простое'), 'the question warns that it installs updates by itself again');
    await p.click('#auNo');
    await p.evaluate(() => { Object.assign(window.__prog.upd, { state: 'available', latest: '9.9.2' }); window.__emit('hudini-update', { state: 'available', ver: '9.9.2' }); });
    check(await until(() => p.isVisible('#auApply')), 'a found version: download and restart');
    eq(await calls(p, 'apply_update'), 0, 'nothing installs by itself');
    await p.click('#auClose'); await p.click('#tabStr');
    check(await p.isHidden('#updOpen'), 'gone for the streamer role');
    await p.context().close();
  });

  await step('panel: the banner opens the offer instead of restarting; the settings have the updates window', async () => {
    const p = await open('/panel/moderator.html', { upd: { state: 'ready', ready: true, latest: '9.9.1', kind: 'version' }, ui: { whatsNew: { ver: '9.9.0' } } });
    check(await until(() => p.isVisible('#updBanner'), 15000), 'the banner');
    await sleep(500);
    eq(await view(p), '', 'nothing pops up over the panel');
    await p.click('#updBanner');
    check(await until(async () => await view(p) === 'offer'), 'the offer');
    eq(await calls(p, 'apply_update'), 0, 'not installed yet');
    await p.click('#auLater'); await p.click('[data-tab=room]'); await p.click('#uiUpdates');
    check(await until(async () => await view(p) === 'settings'), 'the updates window');
    await p.keyboard.press('Escape'); eq(await view(p), '', 'closed by Escape');
    await p.context().close();
  });

  await step('moderator panel: the question knows the stream of the streamer, and keys stay in it', async () => {
    const p = await open('/panel/moderator.html', { upd: { state: 'ready', ready: true, latest: '9.9.1', kind: 'version' } });
    check(await until(() => p.isVisible('#updBanner'), 15000), 'the banner');
    await p.waitForFunction(() => window.hudiniReady);
    await p.evaluate(() => { widgets.set('w', { at: Date.now(), live: true }); });
    await p.click('#updBanner'); await until(async () => await view(p) === 'offer'); await p.click('#auNow');
    const text = await p.textContent('#auConfirm');
    check(text.includes('Сейчас идёт стрим') && text.includes('пульт перезапустятся'), 'live: says the panel restarts', text);
    eq(await focused(p), 'auNo', '«Cancel» has the focus');
    await p.evaluate(() => { window.__keys = 0; document.addEventListener('keydown', () => window.__keys++); });
    await p.keyboard.press('Delete'); await p.keyboard.press('Control+z'); await p.keyboard.press('Tab');
    eq([await p.evaluate(() => window.__keys), await focused(p)], [0, 'auYes'], 'keys reach nothing behind the question, Tab stays inside');
    await p.keyboard.press('Tab'); eq(await focused(p), 'auNo', 'and goes round');
    await p.click('#auNo');
    await p.evaluate(() => { widgets.clear(); widgets.set('w', { at: Date.now(), live: null }); });
    await p.click('#auNow');
    check((await p.textContent('#auAskTitle')) === 'Возможно, сейчас идёт стрим', 'a widget that does not know: softer words');
    eq(await calls(p, 'apply_update'), 0, 'nothing installed');
    await p.context().close();
  });

  await step('start screen in the streamer tab: the banner asks the program, then confirms', async () => {
    const p = await T.newPage('panel', { w: 980, h: 760 });
    await p.goto(web.url + '/app/start.html');
    await p.waitForFunction(() => window.hudiniStartReady);
    await p.evaluate(() => __emit('hudini-update', { state: 'ready', ver: '9.9.1' }));
    await p.click('#updBtn');
    eq([await applied(p), await p.isDisabled('#updBtn')], [[{ confirmed: false }], true], 'asked the program, the button waits');
    await p.evaluate(() => __emit('hudini-confirm', { action: 'apply', live: 'on', ver: '9.9.1', download: false }));
    check(await until(() => p.isVisible('#auConfirm')) && !(await p.isDisabled('#updBtn')), 'live: the question, the button is free again');
    await p.click('#auYes');
    check(await until(async () => await calls(p, 'apply_update') === 2), 'confirmed');
    eq((await applied(p)).at(-1), { confirmed: true }, 'sent with the confirmation');
    await p.context().close();
  });

  await step('streamer panel: the banner installs at once, and asks when the program says the stream is live', async () => {
    const p = await T.newPage('panel', { w: 980, h: 760 });
    await p.goto(web.url + '/panel/moderator.html');
    await p.waitForFunction(() => window.hudiniReady);
    await p.evaluate(() => __emit('hudini-update', { state: 'ready', ver: '9.9.1' }));
    await p.evaluate(() => __emit('hudini-confirm', { action: 'apply', live: 'on', ver: '9.9.1', download: false }));
    eq(await p.locator('#auConfirm').count(), 0, 'a question this page did not cause is not shown');
    await p.click('#updBanner');
    check(await until(async () => await calls(p, 'apply_update') === 1), 'asked the program');
    eq(await applied(p), [{ confirmed: false }], 'without a confirmation');
    await p.evaluate(() => __emit('hudini-confirm', { action: 'apply', live: 'on', ver: '9.9.1', download: false }));
    check(await until(() => p.isVisible('#auConfirm')), 'live: the question');
    check((await p.textContent('#auConfirm')).includes('оверлей пропадёт со стрима'), 'says the overlay disappears');
    eq(await focused(p), 'auNo', '«Cancel» has the focus');
    await p.click('#auNo');
    check(!(await p.isDisabled('#updBanner')) && await calls(p, 'apply_update') === 1, 'cancelled: nothing more is sent, the button works');
    await p.click('#updBanner'); await p.evaluate(() => __emit('hudini-confirm', { action: 'apply', live: 'unknown', ver: '9.9.1', download: false }));
    await p.click('#auYes');
    check(await until(async () => await calls(p, 'apply_update') === 3), 'confirmed');
    eq((await applied(p)).at(-1), { confirmed: true }, 'sent with the confirmation');
    await p.context().close();
  });

  await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
