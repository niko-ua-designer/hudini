// What the Host window asks the server for: its own state (sounds, tour, «what is new»), the changelog and
// the notification settings; the «NOTIFY» lines the app turns into system notifications.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const VERSION = /^const VERSION = '([^']+)';/m.exec(fs.readFileSync(path.join(T.ROOT, 'server/server.js'), 'utf8'))[1];
const PORT = T.PORTS.host + 300;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-state-'));
const cfgOf = dir => JSON.parse(fs.readFileSync(path.join(dir, 'overlay-host.json'), 'utf8'));
async function start(dir, env = {}){
  const h = T.startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', ...env });
  process.on('exit', () => h.proc.kill('SIGKILL'));   // a step that threw must not leave its Host on the port
  await h.ready(); return h;
}

(async () => {
  await step('a fresh install: no «what is new», the tour and the question about sounds are open', async () => {
    const dir = tmp(); let h = await start(dir);
    eq((await h.api('/api/status')).ui, { sounds: null, tourDone: false, whatsNew: null }, 'ui state');
    await h.stop(); h = await start(dir);
    eq((await h.api('/api/status')).ui.whatsNew, null, 'nothing new after a restart either');
    const r = await h.api('/api/ui', { sounds: false });
    eq([r.ok, r.ui.sounds, r.ui.tourDone], [true, false, false], 'sounds alone');
    await h.api('/api/ui', { tourDone: true, sounds: true });
    await h.api('/api/ui', { sounds: 'yes', tourDone: 1, seenWhatsNew: 'x' });   // wrong types change nothing
    await h.stop(); h = await start(dir);
    eq((await h.api('/api/status')).ui, { sounds: true, tourDone: true, whatsNew: null }, 'kept over a restart');
    const foreign = await fetch(`http://localhost:${PORT}/api/ui`, { method: 'POST', headers: { origin: `http://localhost:${PORT}`, 'content-type': 'application/json' }, body: '{"sounds":false}' });
    eq(foreign.status, 403, 'only the management page may change it');
    await h.stop();
  });

  await step('upgrade from an older version: «what is new» until dismissed, and the tour', async () => {
    for(const [what, extra] of [['settings without ui', {}], ['another seenVer', { ui: { sounds: true, tourDone: true, seenVer: '0.0.1' } }]]){
      const dir = tmp(); fs.writeFileSync(path.join(dir, 'overlay-host.json'), JSON.stringify({ modPass: 'old-pass-123', ...extra }));
      let h = await start(dir);
      const ui = (await h.api('/api/status')).ui;
      eq(ui.whatsNew, { ver: VERSION, beta: VERSION.includes('-') }, what + ': what is new');
      eq([ui.sounds, ui.tourDone], extra.ui ? [true, true] : [null, false], what + ': tour and sounds');
      await h.stop(); h = await start(dir);
      check(!!(await h.api('/api/status')).ui.whatsNew, what + ': still there after a restart');
      eq((await h.api('/api/ui', { seenWhatsNew: true })).ui.whatsNew, null, what + ': dismissed');
      await h.stop(); h = await start(dir);
      eq((await h.api('/api/status')).ui.whatsNew, null, what + ': stays dismissed');
      eq([cfgOf(dir).ui.seenVer, cfgOf(dir).modPass], [VERSION, 'old-pass-123'], what + ': saved next to the other settings');
      await h.stop();
    }
  });

  await step('changelog: built from CHANGELOG.md, newest first, the installed version is an entry', async () => {
    const h = await start(tmp());
    const md = fs.readFileSync(path.join(T.ROOT, 'CHANGELOG.md'), 'utf8');
    const heads = [...md.matchAll(/^## (\d\S*)/gm)].map(m => m[1]);
    for(const lang of ['en', 'ru', 'uk', 'de']){
      const j = await h.api('/api/changelog?lang=' + lang);
      eq(j.current, VERSION, lang + ': current');
      eq(j.entries.map(e => e.ver), heads, lang + ': every version, newest first');
      check(j.entries.some(e => e.ver === VERSION), lang + ': the installed version has an entry');
      check(j.entries.every(e => /^\d{4}-\d\d-\d\d$/.test(e.date) && e.sections.length && e.sections.every(s => s.items.length)), lang + ': dates and items everywhere');
      check(j.entries.every(e => e.beta === e.ver.includes('-') && (e.beta || !e.testing.length)), lang + ': testing only for betas');
      check(!j.entries.some(e => e.sections.some(s => s.items.some(i => /\*\*|`|<!--/.test(i) || i.length > 1000))), lang + ': plain text, limited');
    }
    const first = async l => (await h.api('/api/changelog' + l)).entries[0].sections[0].items[0];
    const [en, ru, none, odd] = [await first('?lang=en'), await first('?lang=ru'), await first(''), await first('?lang=__proto__')];
    check(/[а-я]/i.test(ru) && !/[а-я]/i.test(en.replace(/"[^"]*"/g, '')), 'the language follows ?lang=');
    eq([none, odd], [en, en], 'no or unknown language: English');
    eq((await fetch(`http://localhost:${PORT}/api/changelog`)).status, 403, 'the widget origin does not get it');
    await h.stop();
  });

  await step('changelog format: parts, testing, wrapped lines, markup and release notes', async () => {
    const src = fs.readFileSync(path.join(T.ROOT, 'server/server.js'), 'utf8');
    const part = src.slice(src.indexOf('const NOTE_LANGS'), src.indexOf('const CHANGES'));
    const { parseNotes, noteLang } = new Function(part + '; return { parseNotes, noteLang };')();
    const r = parseNotes(['**EN:** intro of a release', '', "## What's new", '', '<!-- date: 2026-01-01 -->', '', '**EN**', '- one **bold** `code` [a link](https://x.y)', '  goes on', '#### Part', '- two', '',
      '**RU**', '- раз', '', '### Testing', '', '**EN**', '- check <b>this</b>', '', 'Website / Сайт: https://x.y', '- not a note'].join('\r\n'));
    eq(r.main.en, [{ title: '', items: ['one bold code a link goes on'] }, { title: 'Part', items: ['two'] }], 'English parts');
    eq(r.main.ru, [{ title: '', items: ['раз'] }], 'Russian');
    eq(r.testing.en, [{ title: '', items: ['check <b>this</b>'] }], 'testing; text after the blocks is not a note, markup stays plain text');
    eq(noteLang(r.main, 'de'), r.main.en, 'a missing language falls back to English');
    eq(parseNotes('no format here\n- x'), { main: {}, testing: {} }, 'unknown text gives nothing');
    const big = parseNotes('**EN**\n' + ('- ' + 'x'.repeat(5000) + '\n').repeat(500));
    eq([big.main.en[0].items.length, big.main.en[0].items[0].length], [60, 1000], 'sizes are limited');
  });

  const DEFAULTS = { moderators: { on: true, kinds: { join: true, leave: false } }, media: { locked: true, kinds: { cam: true, screen: true, mic: true } },
    obs: { on: true, kinds: { widgetUp: true, widgetDown: true, dock: false } }, cs2: { on: false, kinds: { appeared: true } },
    system: { on: true, kinds: { updateReady: true, updateError: true, modPort: true, roomNew: true } } };

  await step('notification settings: groups and kinds are switched and kept; media cannot be', async () => {
    const dir = tmp(); let h = await start(dir);
    eq((await h.api('/api/status')).notify, { visibleOnlyMedia: true, groups: DEFAULTS }, 'defaults');
    eq((await h.api('/api/notify', { group: 'moderators', kind: 'leave', on: true })).notify.groups.moderators, { on: true, kinds: { join: true, leave: true } }, 'one kind');
    eq((await h.api('/api/notify', { group: 'obs', on: false })).notify.groups.obs, { on: false, kinds: DEFAULTS.obs.kinds }, 'a whole group keeps its kinds');
    for(const bad of [{ group: 'media', on: false }, { group: 'media', kind: 'cam', on: false }, { group: 'nope', on: true }, { group: '__proto__', on: true }, { group: 'obs', kind: 'join', on: true }, { group: 'obs', kind: 'constructor', on: true }, { group: 'obs', on: 'yes' }])
      eq((await h.api('/api/notify', bad)).ok, false, 'refused: ' + JSON.stringify(bad));
    await h.stop(); h = await start(dir);
    const g = (await h.api('/api/status')).notify.groups;
    eq([g.moderators.kinds.leave, g.obs.on, g.media], [true, false, DEFAULTS.media], 'kept over a restart');
    await h.stop();
  });

  await step('the app gets «NOTIFY» lines only for enabled events while the window is out of sight', async () => {
    const TOKEN = 'app-line-token', dir = tmp();
    const h = T.startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', OVERLAY_APP: '1', OVERLAY_APP_TOKEN: TOKEN });
    process.on('exit', () => h.proc.kill('SIGKILL'));
    const said = () => h.log().split('\n').filter(l => l.startsWith(TOKEN + ' NOTIFY ')).map(l => l.split(' ').slice(2).join(' '));
    const kinds = () => said().map(l => l.split(' ')[0]);
    const visible = async v => { h.proc.stdin.write(`VISIBLE ${v}\n`); await sleep(300); };
    check(await until(() => h.log().includes(TOKEN + ' READY ')), 'ready');
    await visible(1);
    const code = (await h.code()).data, mqtt = require('mqtt');
    const connect = (url, opts = {}) => new Promise((ok, no) => { const c = mqtt.connect(url, { reconnectPeriod: 0, rejectUnauthorized: false, ...opts }); c.on('connect', () => ok(c)); c.on('error', no); });
    const widget = () => connect(`ws://localhost:${PORT}/mqtt`);
    const mod = () => connect(`wss://127.0.0.1:${PORT + 1}/mqtt`, { username: 'mod', password: code.pass });
    const end = c => new Promise(r => c.end(true, {}, r));
    const newRoom = () => h.api('/api/room/new', { name: 'x' });
    await newRoom(); let w = await widget(); await sleep(500);
    eq(said(), [], 'window in sight: nothing about OBS or the room');
    await end(w); await sleep(5600);
    await visible(0);
    await h.api('/api/notify', { group: 'moderators', kind: 'leave', on: true });
    const code2 = (await h.code()).data; code.pass = code2.pass;
    let m = await mod(); w = await widget();
    check(await until(() => kinds().includes('join') && kinds().includes('widgetUp')), 'hidden: moderator and widget', said());
    eq(said().find(l => l.startsWith('join ')), 'join {"ip":"127.x.x.1","net":"Porthole"}', 'a masked address and nothing else');   // loopback is where Porthole comes from
    await end(m); check(await until(() => kinds().includes('leave')), 'leaving');
    m = await mod(); await sleep(500);
    eq(kinds().filter(k => k === 'join').length, 1, 'the same moderator coming back at once is not announced again');
    await end(m);
    await newRoom(); check(await until(() => kinds().includes('roomNew')), 'room recreated');
    const dock = () => fetch(`http://localhost:${PORT}/api/status`);
    await dock(); await sleep(400);
    check(!kinds().includes('dock'), 'the dock is off by default');
    await h.api('/api/notify', { group: 'cs2', on: true });
    const gsi = JSON.parse(fs.readFileSync(path.join(dir, 'overlay-host.json'), 'utf8')).gsiToken;
    await fetch(`http://127.0.0.1:${PORT}/gsi`, { method: 'POST', body: JSON.stringify({ auth: { token: gsi } }) });
    check(await until(() => kinds().includes('appeared'), 8000), 'CS2 appeared');
    await h.api('/api/notify', { group: 'obs', on: false }); await end(w); await sleep(5600);
    check(!kinds().includes('widgetDown'), 'a switched off group says nothing');
    const all = said().join('\n');
    check(![code.pass, code.k, code2.k, gsi].some(x => x && all.includes(x)) && !all.includes('127.0.0.1'), 'no secrets and no full addresses');

    // a request to show the camera reaches the app even with the window in sight
    await visible(1);
    await h.api('/api/perms', { perms: { cam: true } });
    const now = (await h.code()).data, c = await connect(`wss://127.0.0.1:${PORT + 1}/mqtt`, { username: 'mod', password: now.pass, clientId: 'asker-1' });
    const head = Buffer.from(JSON.stringify({ v: 1, sid: 'sid-12345678', kind: 'cam', t: 'offer', to: 'widget' })), len = Buffer.alloc(2); len.writeUInt16BE(head.length);
    c.publish(`stream-overlay/v1/${now.room}/rtc`, Buffer.concat([len, head, Buffer.alloc(64, 1)]));
    check(await until(() => kinds().includes('cam')), 'the camera request', said());
    await end(c);
    h.proc.stdin.end(); await h.stop();
  });

  await step('the dock is announced on its first poll after a gap', async () => {
    const TOKEN = 'app-line-token', dir = tmp();
    fs.writeFileSync(path.join(dir, 'overlay-host.json'), JSON.stringify({ notify: { obs: { on: true, kinds: { dock: true } } } }));
    const h = T.startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', OVERLAY_APP: '1', OVERLAY_APP_TOKEN: TOKEN });
    process.on('exit', () => h.proc.kill('SIGKILL'));
    const count = () => h.log().split('\n').filter(l => l.startsWith(TOKEN + ' NOTIFY dock ')).length;
    check(await until(() => h.log().includes(TOKEN + ' READY ')), 'ready');
    h.proc.stdin.write('VISIBLE 0\n'); await sleep(300);
    for(let i = 0; i < 4; i++){ await fetch(`http://localhost:${PORT}/api/status`); await sleep(150); }
    await h.api('/api/status');   // the window itself is not a dock
    eq(count(), 1, 'once for a dock that keeps polling');
    h.proc.stdin.end(); await h.stop();
  });

  await step('a moderators port that cannot be opened is announced', async () => {
    const TOKEN = 'app-line-token', blocker = require('net').createServer();
    await new Promise(r => blocker.listen(PORT + 1, '0.0.0.0', r));
    const h = T.startHost({ OVERLAY_HOST_DIR: tmp(), OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', OVERLAY_APP: '1', OVERLAY_APP_TOKEN: TOKEN });
    process.on('exit', () => h.proc.kill('SIGKILL'));
    h.proc.stdin.write('VISIBLE 0\n');   // as the app does right after the start
    check(await until(() => h.log().includes(`${TOKEN} NOTIFY modPort {"port":${PORT + 1}}`)), 'said even this early');
    h.proc.stdin.end(); await h.stop(); blocker.close();
  });

  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
