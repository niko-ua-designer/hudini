// Moderator pause and files: a paused moderator still reads files (images on the canvas), writing is refused with 423,
// and the panel shows a translated message instead of "HTTP 423".
'use strict';
const path = require('path');
const T = require('./lib');
const { step, check, eq, until } = T;
const shot = n => path.join(process.env.HUDINI_TEST_SHOTS || require('os').tmpdir(), n + '.png');
const PNG = path.join(__dirname, 'fixtures/img.png');

(async () => {
  for(const [lang, want] of [['en', 'The streamer has paused the moderators'], ['de', 'Der Streamer hat die Moderatoren pausiert']]){
    const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' }, lang });
    const { panel, host } = S;
    await step(lang + ': paused moderator reads files, cannot write, panel message is translated', async () => {
      const https = require('https'), { pass } = await host.code();
      const req = (method, p, body) => new Promise((ok, no) => { const r = https.request({ host: '127.0.0.1', port: host.modPort, path: p, method, rejectUnauthorized: false, headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/octet-stream' } }, res => { res.resume(); res.on('end', () => ok(res.statusCode)); }); r.on('error', no); r.end(body); });
      const A = Buffer.alloc(300, 1);
      eq(await req('PUT', '/files/pausefilesaaaaaa?part=0&last=1', A), 200, 'upload before the pause');
      await host.api('/api/control', { action: 'pause' });
      eq(await req('GET', '/files/pausefilesaaaaaa'), 200, 'GET of a file works on pause');
      eq(await req('GET', '/files'), 200, 'the listing works on pause');
      eq(await req('PUT', '/files/pausefilesbbbbbb?part=0&last=1', A), 423, 'upload refused');
      eq(await req('DELETE', '/files/pausefilesaaaaaa'), 423, 'delete refused');
      eq(await req('POST', '/files/clean', '{}'), 423, 'clean refused');
      eq(await req('PATCH', '/files/pausefilesaaaaaa', A), 423, 'any other modifying method is refused too');
      // the pause drops the moderator's live connection, so point the panel's file calls at the moderator port directly (a request in flight when the pause starts)
      await panel.evaluate(([base, auth]) => { window.homeHttp = () => ({ base, auth }); }, [`https://127.0.0.1:${host.modPort}`, 'Bearer ' + pass]);
      await panel.setInputFiles('#fileInput', PNG);
      check(await until(() => panel.evaluate(w => document.getElementById('toast').textContent.includes(w), want), 8000), 'the panel toast says: ' + want);
      const t = await panel.textContent('#toast');
      check(!/HTTP 423|пауз/.test(t), 'no raw status or Russian text: ' + t);
      await panel.screenshot({ path: shot('review-pause-' + lang) });
      await host.api('/api/control', { action: 'resume' });
    });
    await S.close();
  }
  await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
