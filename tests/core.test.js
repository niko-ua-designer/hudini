// Main flow of Hudini 1.0: panel ↔ Hudini Host ↔ OBS widget, files on disk, limits, attacks, recovery.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const mqtt = require('mqtt');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const IMG = path.join(__dirname, 'fixtures/img.png'), GIF = path.join(__dirname, 'fixtures/anim.gif');

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel, widget, host } = S;
  const texts = p => p.$$eval('.el .txt', n => n.map(x => x.textContent));
  const room = await panel.evaluate(() => room);
  const P = 'stream-overlay/v1/' + room;

  await step('panel finds Hudini Host through the public broker', async () => {
    check(S.online, 'panel status is online via Hudini Host');
    check(/OBS: 1920×1080/.test(await panel.textContent('#obsStatus')), 'panel sees the OBS widget');
    check(!S.obsLink.includes('broker.emqx') && S.obsLink.startsWith(host.base + '/widget.html'), 'OBS link points to the Host');
  });

  await step('text reaches the widget', async () => {
    await panel.fill('#newText', 'ПРИВЕТ'); await panel.click('#addText');
    eq(await until(async () => (await texts(widget)).includes('ПРИВЕТ') && await texts(widget)), ['ПРИВЕТ'], 'widget shows the text');
  });

  await step('content does not go through the public broker', async () => {
    const seen = new Set();
    const spy = mqtt.connect(S.pub.url); await new Promise(r => spy.on('connect', r));
    spy.subscribe('#'); spy.on('message', t => seen.add(t.split('/').pop()));
    await panel.fill('#newText', 'ЕЩЁ'); await panel.click('#addText'); await panel.click('#confetti');
    await sleep(1500); spy.end(true);
    eq([...seen], ['srv'], 'only the encrypted address announcement is on the public broker');
  });

  await step('files are stored encrypted on disk and shown in OBS', async () => {
    await panel.setInputFiles('#fileInput', IMG);
    const img = await until(() => widget.$$eval('img.content', n => n.filter(i => i.src.startsWith('blob:') && i.naturalWidth > 0).length), 10000);
    check(img === 1, 'widget shows the uploaded picture');
    const dir = path.join(host.dir, 'files', room), files = fs.readdirSync(dir);
    eq(files.length, 1, 'one file on disk');
    const raw = fs.readFileSync(path.join(dir, files[0])), png = fs.readFileSync(IMG);
    check(!raw.includes(png.subarray(0, 8)) && !raw.includes(Buffer.from('image/png')), 'file on disk is ciphertext (no PNG header, no mime)');
    const info = await until(async () => { const t = await panel.textContent('#storageInfo'); return /файлов: 1 \/ 300/.test(t) && t; });
    check(info, 'panel shows storage: ' + info);
  });

  await step('GIF stays animated (original bytes, image/gif)', async () => {
    await panel.setInputFiles('#fileInput', GIF);
    const types = await until(async () => { const t = await widget.evaluate(async () => Promise.all([...document.querySelectorAll('img.content')].map(async i => (await (await fetch(i.src)).blob()).type))); return t.includes('image/gif') && t; }, 10000);
    check(types && types.includes('image/gif'), 'widget got image/gif');
  });

  await step('a second moderator panel loads files from the Host', async () => {
    const inv = await panel.evaluate(() => inviteLink(curRoom()));
    const mod2 = await T.newPage('mod2');
    await mod2.goto(inv.replace('moderator.html', 'moderator.html?broker=' + encodeURIComponent(S.pub.url)));
    check(await until(async () => (await mod2.getAttribute('#status', 'class')).includes('ok'), 12000), 'mod2 online');
    check(await until(() => mod2.$$eval('#elLayer img.content', n => n.filter(i => i.naturalWidth > 0).length === 2), 10000), 'mod2 preview shows both files');
    await mod2.fill('#newText', 'ОТ ВТОРОГО'); await mod2.click('#addText');
    check(await until(async () => (await texts(widget)).includes('ОТ ВТОРОГО')), 'widget got text from mod2');
    await mod2.context().close();
  });

  await step('files API: password, lockout, local rules', async () => {
    const tun = host.tunnel;
    eq((await fetch(tun + '/files')).status, 401, 'tunnel without password → 401');
    const ids = fs.readdirSync(path.join(host.dir, 'files', room));
    eq((await fetch(`${host.base}/files/${ids[0]}`)).status, 200, 'widget on this PC reads a file without password');
    eq((await fetch(`${host.base}/files`)).status, 401, 'listing on this PC needs the password');
    const rebound = await new Promise(r => require('http').get({ host: '127.0.0.1', port: host.port, path: '/files/' + ids[0], headers: { host: 'evil.example:' + host.port } }, res => { res.resume(); r(res.statusCode); }).on('error', () => r(0)));
    eq(rebound, 421, 'wrong Host header (DNS rebinding) → 421');
    const r = await fetch(`${host.admin}/api/link`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
    eq(r.status, 403, 'control API from another site → 403');
    eq((await fetch(`${host.base}/api/modpass`)).status, 403, 'widget origin (localhost) cannot read the moderators password');
    const dockSt = await (await fetch(`${host.base}/api/status`)).json();
    check(dockSt.ctl && !('logs' in dockSt) && !('obsLink' in dockSt) && !('fixedUrl' in dockSt), 'widget origin gets only the short dock status');
    eq((await fetch(`${host.base}/`, { redirect: 'manual' })).headers.get('location'), `${host.admin}/`, 'management page moves to 127.0.0.1');
    eq((await fetch(`${host.base}/files`, { headers: { origin: 'https://evil.example' } })).status, 403, 'another site cannot hit the files API on this PC');
    const wsFrom = origin => new Promise(res => { const w = new (require('ws'))(`ws://localhost:${host.port}/mqtt`, 'mqtt', { origin }); w.on('open', () => { w.close(); res('open'); }); w.on('error', () => res('refused')); });
    eq(await wsFrom('https://evil.example'), 'refused', 'local MQTT refuses a WebSocket from another site');
    eq(await wsFrom(`http://localhost:${host.port}`), 'open', 'local MQTT accepts the widget origin');
    const codes = [];
    for(let i = 0; i < 6; i++) codes.push((await fetch(tun + '/files', { headers: { authorization: 'Bearer wrong' + i, 'cf-connecting-ip': '203.0.113.9' } })).status);
    eq(codes, [401, 401, 401, 401, 401, 429], 'five wrong passwords from one address → pause');
    const ok = await panel.evaluate(async () => (await fetch(homeHttp().base + '/files', { headers: { authorization: homeHttp().auth } })).status);
    eq(ok, 200, 'the panel with the real password still works');
  });

  await step('limits: full storage is refused with a clear message and cleanup frees space', async () => {
    await host.api('/api/limits', { fileMB: 1, totalMB: 10, files: 2 });
    await panel.setInputFiles('#fileInput', IMG);
    check(await until(() => panel.isVisible('#hostTip')), 'dialog shown when the file limit is reached');
    check(await panel.isVisible('#hostTipClean'), 'dialog offers 🧹 cleanup');
    check(/файлов уже столько/.test(await panel.textContent('#hostTipWhy')), 'message says why: ' + await panel.textContent('#hostTipWhy'));
    await panel.click('#hostTipOk');
    // remove the GIF from the screen, then clean
    await panel.evaluate(() => { beginChange(); state.els = state.els.filter(e => !(e.type === 'image' && Assets.meta.get(assetId(e.src))?.mime === 'image/gif')); commit(); });
    await panel.click('#hostTipOk').catch(() => {});
    await panel.click('#cleanFiles');
    check(await until(() => fs.readdirSync(path.join(host.dir, 'files', room)).length === 1), 'unused GIF deleted, used picture kept');
    check(await until(async () => /файлов: 1 \/ 2/.test(await panel.textContent('#storageInfo'))), 'storage indicator updated');
    await host.api('/api/limits', { fileMB: 100, totalMB: 2048, files: 300 });
  });

  await step('attacks on the Host broker are ignored by the widget', async () => {
    const atk = mqtt.connect(`ws://localhost:${host.port}/mqtt`); await new Promise(r => atk.on('connect', r));
    const cap = {};
    atk.subscribe(P + '/#'); atk.on('message', (t, p) => { if(p.length) cap[t] = Buffer.from(p); });
    await until(() => cap[P + '/state'], 3000);
    const before = await texts(widget);
    check(cap[P + '/state'] && !cap[P + '/state'].includes(Buffer.from('ПРИВЕТ')), 'local snooper sees ciphertext only', Object.keys(cap));
    atk.publish(P + '/state', JSON.stringify({ visible: true, els: [{ id: 'evil', type: 'text', text: 'ВЗЛОМ', x: 50, y: 50 }] }), { retain: true });
    const fake = Buffer.alloc(140); fake[0] = 1; fake[1] = 1; crypto.randomFillSync(fake, 2); atk.publish(P + '/state', fake);
    atk.publish(P + '/state', '', { retain: true });
    await sleep(700);
    eq(await texts(widget), before, 'forged, garbage and wipe messages change nothing');
    const old = cap[P + '/state'];
    await panel.fill('#newText', 'НОВЫЙ'); await panel.click('#addText'); await sleep(600);
    atk.publish(P + '/state', old); await sleep(600);
    check((await texts(widget)).includes('НОВЫЙ'), 'replayed old state is ignored');
    await widget.evaluate(() => { window.__conf = 0; const o = confetti; confetti = () => { window.__conf++; o(); }; });
    await panel.click('#confetti'); await sleep(600);
    const fx = cap[P + '/fx']; atk.publish(P + '/fx', fx); await sleep(500);
    eq(await widget.evaluate(() => window.__conf), 1, 'replayed effect fires only once');
    let leaked = 0;
    atk.subscribe('stream-overlay/v1/otherroom/#'); atk.on('message', t => { if(t.includes('otherroom')) leaked++; });
    const atk2 = mqtt.connect(`ws://localhost:${host.port}/mqtt`); await new Promise(r => atk2.on('connect', r));
    let kicked = false; atk2.on('close', () => { kicked = true; });
    atk2.publish('stream-overlay/v1/otherroom/state', 'x'); await sleep(700);
    check(leaked === 0, 'other rooms are off-limits (ACL): nothing delivered'); check(kicked, 'publisher to another room is dropped');
    atk2.end(true); atk.end(true);
    // widget reload restores the real screen
    await panel.evaluate(() => publishNow(1)); await widget.reload();
    check(await until(async () => (await texts(widget)).includes('НОВЫЙ'), 8000), 'widget restores the real screen after reload');
  });

  await step('asset format: no swapping, no tampering', async () => {
    const r = await panel.evaluate(async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
      const box = await packAsset(KEYS, blob, 'aaaa1111bbbb', 'x.png');
      const good = !!(await openAsset(KEYS, box, 'aaaa1111bbbb'));
      const swapped = await openAsset(KEYS, box, 'cccc2222dddd');
      const t = box.slice(); t[t.length - 1] ^= 1; const tampered = await openAsset(KEYS, t, 'aaaa1111bbbb');
      const other = await importRoomKeys(await newRoomKeys()); const foreign = await openAsset(other, box, 'aaaa1111bbbb');
      return { good, swapped, tampered, foreign };
    });
    eq(r, { good: true, swapped: null, tampered: null, foreign: null }, 'only the right id, untouched bytes and the room key open a file');
  });

  await step('widget size check', async () => {
    const small = await T.newPage('widget-800', { w: 800, h: 600 });
    await small.goto(S.obsLink);
    check(await until(() => small.isVisible('#sizeWarn')), 'widget at 800×600 shows a warning');
    check(/800×600/.test(await small.textContent('#sizeWarn')), 'warning names the size');
    check(await until(async () => /не 16:9/.test(await panel.textContent('#obsStatus'))), 'panel OBS pill says "не 16:9"');
    await small.context().close();
    check(!(await widget.isVisible('#sizeWarn')), '1920×1080 widget has no warning');
  });

  await step('widget without Hudini Host explains what to do', async () => {
    const w = await T.newPage('widget-pages');
    await w.goto(S.obsLink.replace(host.base, S.web.url).replace(/&broker=[^&#]+/, ''));
    check(await until(() => w.isVisible('#need')), 'old link shows "Нужна программа Hudini Host"');
    await w.context().close();
  });

  await step('OBS dock: hide overlay, stop sounds, pause moderators', async () => {
    const dock = await T.newPage('dock', { w: 320, h: 500 });
    await dock.goto(host.base + '/dock');
    check(await until(async () => /виджет работает/.test(await dock.textContent('#rows'))), 'dock shows the OBS widget status');
    await dock.click('#hide');
    check(await until(() => widget.evaluate(() => document.body.classList.contains('host-hidden'))), 'widget hides the overlay');
    check(await until(async () => /спрятано стримером/.test(await panel.textContent('#obsStatus'))), 'panel says the streamer hid it');
    await dock.click('#hide');
    check(await until(() => widget.evaluate(() => !document.body.classList.contains('host-hidden'))), 'overlay back');
    const atk = mqtt.connect(`ws://localhost:${host.port}/mqtt`); await new Promise(r => atk.on('connect', r));
    let dropped = false; atk.on('close', () => { dropped = true; });
    atk.publish(P + '/host', 'x'); await sleep(500); atk.end(true);
    check(dropped, 'nobody but the app may publish dock commands');
    await dock.click('#pause');
    check(await until(async () => /паузу/.test(await panel.textContent('#status')), 10000), 'panel shows the pause: ' + await panel.textContent('#status'));
    await dock.click('#pause');
    check(await until(async () => (await panel.getAttribute('#status', 'class')).includes('ok'), 25000), 'panel reconnects after the pause');
    await dock.context().close();
  });

  await step('rekey: Host rotates the password and drops old moderators', async () => {
    const before = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8')).modPass;
    await panel.click('[data-tab=room]'); await panel.click('#roomRekey');
    await panel.waitForFunction(old => document.getElementById('link').value !== old, S.link);
    const link = await panel.inputValue('#link');
    const set = await host.api('/api/link', { link });
    const after = JSON.parse(fs.readFileSync(path.join(host.dir, 'overlay-host.json'), 'utf8')).modPass;
    check(set.ok && before !== after, 'moderator password changed');
    check(await until(async () => (await panel.getAttribute('#status', 'class')).includes('ok'), 12000), 'panel reconnects with the new keys');
    await widget.goto(set.obsLink);
    check(await until(async () => (await texts(widget)).includes('НОВЫЙ'), 8000), 'screen moved to the new room');
    S.link = link; S.obsLink = set.obsLink;
  });

  await step('public broker down: panel uses the last known address', async () => {
    await S.pub.close();
    await panel.reload();
    check(await until(async () => (await panel.getAttribute('#status', 'class')).includes('ok'), 12000), 'panel online without the public broker');
  });

  await step('Host stopped: panel says so', async () => {
    await host.stop();
    check(await until(async () => !(await panel.getAttribute('#status', 'class')).includes('ok'), 12000), 'panel is no longer online: ' + await panel.textContent('#status'));
  });

  await T.closeBrowser(); await S.web.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
