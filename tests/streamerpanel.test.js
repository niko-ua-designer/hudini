// «Открыть пульт» у стримера: пульт на том же ПК, что и Hudini Host, без кода и пароля.
// Вход только по одноразовому ключу, который программа сама отдаёт своему окну; localhost сам по себе доступа не даёт.
'use strict';
const fs = require('fs'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const web = await T.webServer();
  const PORT = T.PORTS.host + 50;
  const host = T.startHost({ OVERLAY_PORT: String(PORT), OVERLAY_SITE: 'off', OVERLAY_PANEL_ORIGIN: web.url });
  await host.ready();
  const code = (await host.code()).data;
  const st = await host.api('/api/status');
  const secrets = [];   // every key and session password seen in this test: none may reach a log
  const session = (key, origin = web.url) => fetch(`http://127.0.0.1:${PORT}/api/streamer/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ key }) })
    .then(async r => { const j = await r.json().catch(() => ({})); if(j.pass) secrets.push(j.pass); return { status: r.status, ...j }; });
  const newKey = async (h = host) => { const r = await h.api('/api/streamer/open', {}); if(r.key) secrets.push(r.key); return r; };
  const online = p => until(async () => (await p.getAttribute('#status', 'class')).includes('ok'), 15000);
  const texts = p => p.$$eval('.el .txt', n => n.map(x => x.textContent));

  // OBS widget and a moderator (saved session with the room keys from the Host's code)
  const widget = await T.newPage('widget', { w: 1920, h: 1080 });
  await widget.goto(st.obsLink);
  const mod = await T.newPage('mod');
  await mod.addInitScript(sess => { if(!localStorage.getItem('fake.seeded')){ const s = JSON.parse(localStorage.getItem('fake.store') || '{}'); s['app.sessions'] = [sess]; localStorage.setItem('fake.store', JSON.stringify(s)); localStorage.setItem('fake.seeded', '1'); } },
    { id: code.room, name: 'etsuitoku', pass: code.pass, fp: code.fp, addrs: [{ h: '127.0.0.1', port: host.modPort, net: 'lan' }], k: code.k, p: code.p, s: code.s, pinned: false, added: Date.now(), last: 0, lastNet: '' });
  await mod.goto(`${web.url}/panel/moderator.html?session=${code.room}`);
  await online(mod);

  await step('without the one-time key localhost gives no access', async () => {
    eq((await session('')).status, 403, 'no key → 403');
    eq((await session('A'.repeat(43))).status, 403, 'a made-up key → 403');
    eq((await fetch(`http://127.0.0.1:${PORT}/api/streamer/open`, { method: 'POST', headers: { origin: `http://127.0.0.1:${PORT}` } })).status, 403, 'a key is only given to the management page');
    const r = await widget.evaluate(async port => {
      const tryLogin = opts => new Promise(res => { const c = mqtt.connect(`ws://127.0.0.1:${port}/mqtt`, { reconnectPeriod: 0, connectTimeout: 4000, ...opts });
        c.on('connect', () => { c.end(true); res('connected'); }); c.on('error', e => { c.end(true); res(String(e.message)); }); c.on('close', () => res('closed')); });
      return [await tryLogin({ username: 'streamer', password: 'guess' }), await tryLogin({ username: 'mod', password: 'guess' })];
    }, PORT);
    check(r.every(x => x !== 'connected'), 'MQTT as «streamer» or «mod» with a guess is refused on the local port: ' + r.join(' / '));
    // even with the room keys an anonymous local client cannot put a screen on stream (it may publish only the widget heartbeat)
    await widget.evaluate(async ([port, keys, room]) => {
      const K = await importRoomKeys(keys), c = mqtt.connect(`ws://localhost:${port}/mqtt`, { reconnectPeriod: 0 });
      await new Promise(r => c.on('connect', r));
      c.publish(`stream-overlay/v1/${room}/state`, await seal(K, TE.encode(JSON.stringify({ v: 2, t: Date.now(), visible: true, els: [{ id: 'evil', type: 'text', text: 'ЧУЖОЙ' }] })), true), { qos: 0, retain: true });
      await new Promise(r => setTimeout(r, 300)); c.end(true);
    }, [PORT, { k: code.k, p: code.p, s: code.s }, code.room]);
    await sleep(800);
    check(!(await texts(widget)).includes('ЧУЖОЙ'), 'a screen from an anonymous local client does not reach the stream');
    const page = await T.newPage('evil', { app: false });
    await page.goto(web.url + '/panel/moderator.html');
    const k = await newKey();
    const res = await page.evaluate(async ([port, key]) => { try{ const r = await fetch(`http://127.0.0.1:${port}/api/streamer/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) }); return r.status; }catch(e){ return 'blocked'; } }, [PORT, k.key]);
    check(res === 200, 'sanity: the panel page itself may exchange a key: ' + res);
    await page.context().close();
    const k2 = await newKey();
    eq((await session(k2.key, 'https://evil.example')).status, 403, 'another site with a valid key → 403');
    eq((await session(k2.key, 'null')).status, 403, 'a sandboxed page (Origin: null) → 403');
    check(await until(() => /Login refused: this computer — streamer panel: foreign site/.test(host.log())), 'the refusal is logged with its reason');
  });

  let sp = null, key1 = null;
  await step('the key works once and leaves the address bar', async () => {
    key1 = await newKey();
    eq([typeof key1.key, key1.key.length, key1.port], ['string', 43, PORT], 'the Host gives a 32-byte key and its port');
    sp = await T.newPage('streamer', { app: false });
    const seen = []; sp.on('request', r => seen.push(r.url()));
    await sp.goto(`${key1.url}?streamer=1#hk=${key1.key}&port=${key1.port}`);
    check(await online(sp), 'the streamer panel is online: ' + await sp.textContent('#status'));
    eq(await sp.evaluate(() => [room, homeInfo.url, location.hash]), [code.room, `ws://127.0.0.1:${PORT}/mqtt`, ''], 'own room, straight to the local port, the key is gone from the address');
    check(!seen.some(u => u.includes(key1.key)), 'the key was never sent in a URL');
    const again = await session(key1.key);
    eq(again.status, 403, 'the same key a second time → 403');
    check(/key already used/.test(host.log()), 'reuse is logged');
    check(/Streamer panel opened on this computer/.test(host.log()) && /Streamer panel connected/.test(host.log()), 'the login is logged (without the key)');
  });

  await step('an expired key is refused', async () => {
    const h2 = T.startHost({ OVERLAY_PORT: String(PORT + 10), OVERLAY_SITE: 'off', OVERLAY_PANEL_ORIGIN: web.url, OVERLAY_PANEL_KEY_MS: '300' });
    await h2.ready();
    const k = await newKey(h2);
    await sleep(700);
    const r = await fetch(`http://127.0.0.1:${PORT + 10}/api/streamer/session`, { method: 'POST', headers: { origin: web.url, 'content-type': 'application/json' }, body: JSON.stringify({ key: k.key }) });
    eq(r.status, 403, 'a key older than its lifetime → 403');
    check(await until(() => /key expired/.test(h2.log())), 'logged as expired');
    const fresh = await newKey(h2);
    const ok = await fetch(`http://127.0.0.1:${PORT + 10}/api/streamer/session`, { method: 'POST', headers: { origin: web.url, 'content-type': 'application/json' }, body: JSON.stringify({ key: fresh.key }) }).then(r => r.json());
    if(ok.pass) secrets.push(ok.pass);
    check(ok.ok && ok.room?.s, 'a fresh key works and brings the room keys');
    await h2.stop();
  });

  await step('the streamer and a moderator work at the same time', async () => {
    await sp.fill('#newText', 'ОТ СТРИМЕРА'); await sp.click('#addText');
    check(await until(async () => (await texts(widget)).includes('ОТ СТРИМЕРА')), 'the streamer\'s text is on stream');
    check(await until(async () => (await texts(mod)).includes('ОТ СТРИМЕРА')), 'the moderator sees it');
    await mod.fill('#newText', 'ОТ МОДЕРАТОРА'); await mod.click('#addText');
    check(await until(async () => (await texts(widget)).includes('ОТ МОДЕРАТОРА') && (await texts(sp)).includes('ОТ МОДЕРАТОРА')), 'the moderator\'s text is on stream and in the streamer panel');
    const s = await fetch(host.base + '/api/status').then(r => r.json());
    check(s.ppl.some(p => p.me) && s.ppl.some(p => !p.me), 'the dock lists the streamer panel and the moderator');
    eq(s.mods, 1, 'the streamer panel is not counted as a moderator');
    await sp.setInputFiles('#fileInput', path.join(__dirname, 'fixtures/img.png'));
    check(await until(() => widget.$$eval('img.content', n => n.some(i => i.src.startsWith('blob:') && i.naturalWidth > 0)), 15000), 'a file from the streamer panel reaches the stream');
  });

  await step('pausing the moderators does not lock the streamer out', async () => {
    await host.api('/api/control', { action: 'pause' });
    await sp.fill('#newText', 'ПАУЗА НЕ МЕШАЕТ'); await sp.click('#addText');
    check(await until(async () => (await texts(widget)).includes('ПАУЗА НЕ МЕШАЕТ')), 'the streamer still changes the screen');
    await host.api('/api/control', { action: 'resume' });
  });

  await step('the streamer panel changes the CS2 series format too', async () => {
    const bo = () => JSON.parse(fs.readFileSync(path.join(host.dir, 'cs2-series.json'), 'utf8')).bo;
    await sp.evaluate(() => serCmd({ op: 'bo', bo: 5 }));
    check(await until(() => { try{ return bo() === 5; }catch{ return false; } }), 'the Host takes the command from the streamer panel');
    await until(() => mod.evaluate(() => !!client?.connected), 40000);   // the pause above sent the moderator away for a while
    await mod.evaluate(() => serCmd({ op: 'bo', bo: 1 }));
    check(await until(() => bo() === 1), 'and from a moderator');
  });

  await step('a session ends with the room: new room keys need a new key', async () => {
    const stale = await sp.evaluate(() => homeInfo.pass);
    await host.api('/api/room/new', { name: 'Новая' });
    const r = await sp.evaluate(async ([port, pass]) => new Promise(res => { const c = mqtt.connect(`ws://127.0.0.1:${port}/mqtt`, { username: 'streamer', password: pass, reconnectPeriod: 0 });
      c.on('connect', () => { c.end(true); res('connected'); }); c.on('error', e => { c.end(true); res(String(e.message)); }); }), [PORT, stale]);
    check(r !== 'connected', 'the old session no longer logs in: ' + r);
  });

  await step('the management page has the button; in a browser it opens the panel by itself', async () => {
    const ui = await T.newPage('ui', { app: false });
    await ui.goto(`${host.admin}/auth?t=${host.token}`);
    await until(() => ui.isVisible('#panelCard'));
    check(await ui.isVisible('#openPanel') && await ui.isEnabled('#openPanel'), '«Открыть пульт» is there');
    const [popup] = await Promise.all([ui.context().waitForEvent('page'), ui.click('#openPanel')]);
    check(await online(popup), 'the opened panel is online');
    eq(await popup.evaluate(() => location.hash), '', 'no key left in its address');
    await ui.context().close();
  });

  await step('no key and no session password in the logs, crash reports or the status', async () => {
    const dir = path.join(host.dir, 'logs');
    const all = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + host.log();
    const status = JSON.stringify(await host.api('/api/status')) + JSON.stringify(await fetch(host.base + '/api/status').then(r => r.json()));
    check(secrets.length >= 5, 'collected ' + secrets.length + ' secrets');
    eq(secrets.filter(x => all.includes(x)), [], 'none of them is in the log files or the console');
    eq(secrets.filter(x => status.includes(x)), [], 'none of them is in /api/status');
    check(!fs.readdirSync(dir).some(f => f.startsWith('crash-')), 'no crash report');
  });

  await step('app mode: the key goes to the app window over its own channel', async () => {
    const h3 = T.startHost({ OVERLAY_PORT: String(PORT + 20), OVERLAY_SITE: 'off', OVERLAY_APP: '1', OVERLAY_APP_TOKEN: 'apptok42', OVERLAY_ADMIN_TOKEN: '', OVERLAY_PANEL_ORIGIN: web.url });
    await h3.ready();
    const r = await fetch(`http://127.0.0.1:${PORT + 20}/api/streamer/open`, { method: 'POST', headers: { 'x-hudini-token': 'apptok42', origin: `http://127.0.0.1:${PORT + 20}` } }).then(r => r.json());
    eq(r, { ok: true, app: true }, 'the management page gets no key in the app');
    const line = await until(() => (/apptok42 PANEL ([\w-]{43}) (\d+)/.exec(h3.log()) || [])[0]);
    check(line, 'the app gets «PANEL <key> <port>» with its own prefix');
    h3.proc.stdin.write('PANEL\n');   // the tray menu asks the same way
    check(await until(() => (h3.log().match(/apptok42 PANEL [\w-]{43} \d+/g) || []).length === 2), 'the tray item gets a second key');
    const [, key] = /apptok42 PANEL ([\w-]{43}) (\d+)/.exec(h3.log());
    const p = await T.newPage('streamer-app');   // fake Tauri shell: panel_key hands the key out once
    await p.addInitScript(([key, port]) => { const inv = window.__TAURI__.core.invoke; let k = { key, port };
      window.__TAURI__.core.invoke = async (cmd, args) => { if(cmd === 'panel_key'){ const x = k; k = null; if(!x) throw new Error('no key'); return x; } return inv(cmd, args); }; }, [key, PORT + 20]);
    await p.goto(`${web.url}/panel/moderator.html?streamer=1`);
    check(await online(p), 'the app panel window is online');
    eq(await p.evaluate(() => [new URL(location.href).search, homeInfo.url.endsWith(':' + location.port) === false]), ['?streamer=1', true], 'the window keeps ?streamer=1 and talks to the Host port');
    const logs = fs.readdirSync(path.join(h3.dir, 'logs')).map(f => fs.readFileSync(path.join(h3.dir, 'logs', f), 'utf8')).join('\n');
    check(!logs.includes(key), 'the key is not in the log files');
    await p.context().close();
    await h3.stop();
  });

  await host.stop(); await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
