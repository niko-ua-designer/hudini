// What the Host window asks the server for: its own state (sounds, tour, «what is new») and the changelog.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const T = require('./lib');
const { step, check, eq } = T;
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

  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
