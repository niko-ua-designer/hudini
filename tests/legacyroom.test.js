// A Host config left over from an old version (a room link without the room's private key) gives a moderator code
// without keys, and the moderator cannot join. On start the Host makes its own room once and asks to update OBS.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { check, step, eq, finish, startHost } = require('./lib.js');

const PORT = '27900';
function legacyDir(extra = {}){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-legacy-'));
  const k = crypto.randomBytes(32).toString('base64url');
  const jwk = crypto.generateKeyPairSync('ec', { namedCurve:'P-256' }).publicKey.export({ format:'jwk' });
  const p = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
  fs.writeFileSync(path.join(dir, 'overlay-host.json'), JSON.stringify({ port:7777, direct:1, name:'Hudini', modPass:'oldpass123',
    link:`https://example.github.io/hudini/widget/widget.html?room=legacyroom01#k=${k}&p=${p}`, ...extra }));
  return dir;
}
const cfgOf = dir => JSON.parse(fs.readFileSync(path.join(dir, 'overlay-host.json'), 'utf8'));

(async () => {
  await step('old config: the Host makes its own room, the code carries the keys, a notice asks to update OBS', async () => {
    const dir = legacyDir();
    let host = startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_PORT: PORT });
    try{
      check(await host.ready(), 'Host started');
      const c = await host.code();
      check(c.data.room !== 'legacyroom01', 'a new room replaced the old one', c.data.room);
      check(typeof c.data.k === 'string' && typeof c.data.p === 'string' && c.data.s && typeof c.data.s === 'object', 'moderator code has k, p and s');
      const st = await host.api('/api/status');
      check(st.roomNotice === true && st.ownRoom === true, 'status shows the notice and an own room', { roomNotice: st.roomNotice, ownRoom: st.ownRoom });
      const room = c.data.room;
      await host.stop();
      host = startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_PORT: PORT });
      check(await host.ready(), 'Host restarted');
      eq((await host.code()).data.room, room, 'the second start keeps the new room');
      await host.api('/api/notice', { id: 'room' });
      check(!cfgOf(dir).roomNotice && !(await host.api('/api/status')).roomNotice, '"Got it" hides the notice for good');
    } finally { await host.stop(); }
  });

  await step('a room set through /api/link on purpose is kept', async () => {
    const dir = legacyDir({ linkSet: true });
    const host = startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_PORT: PORT });
    try{
      check(await host.ready(), 'Host started');
      eq((await host.code()).data.room, 'legacyroom01', 'room stays');
      check(!(await host.api('/api/status')).roomNotice, 'no notice');
    } finally { await host.stop(); }
  });

  await step('the management page has no "old way" link field any more', async () => {
    const ui = fs.readFileSync(path.join(__dirname, '..', 'server', 'ui.html'), 'utf8');
    check(!/id="saveLink"|id="link"/.test(ui), 'no link input in the Host window');
    check(/id="roomNotice"/.test(ui), 'the room notice exists');
  });

  finish();
})();
