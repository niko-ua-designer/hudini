// What the Host window asks the server for: its own state (sounds, tour, «what is new»).
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

  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
