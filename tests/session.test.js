// Пульт в приложении: открытие по ?session=, ретранслятор, индикатор связи, «← Сессии».
// Оболочка приложения заменена заглушкой из lib.js (window.__TAURI__, store в localStorage, TCP→TLS ретранслятор на Node).
'use strict';
const T = require('./lib');
const { step, check, eq, until } = T;

const FP = 'cd'.repeat(32);
const status = p => p.textContent('#status');
const cls = p => p.getAttribute('#status', 'class');

(async () => {
  const web = await T.webServer();
  const host = T.startHost(); await host.ready();
  const { pass } = await host.api('/api/code');
  const base = `${web.url}/panel/moderator.html`;
  const seen = [];   // every address a panel page asked for

  // A panel page whose store already holds the given sessions (and optionally rooms)
  async function open(name, query, seed = {}){
    const p = await T.newPage(name);
    p.on('request', r => seen.push(r.url()));
    await p.addInitScript(seed => { if(!localStorage.getItem('fake.seeded')){ const s = JSON.parse(localStorage.getItem('fake.store') || '{}'); Object.assign(s, seed); localStorage.setItem('fake.store', JSON.stringify(s)); localStorage.setItem('fake.seeded', '1'); } }, seed);
    await p.goto(base + query);
    return p;
  }
  const sess = (id, extra = {}) => ({ id, name: 'etsuitoku', pass, fp: FP, addrs: [{ h: '127.0.0.1', port: host.modPort, net: 'tailscale' }], pinned: false, added: Date.now(), last: 0, lastNet: '', ...extra });
  // keys for a new room, made by the panel's own code
  const keysFrom = async () => { const p = await T.newPage('keys'); await p.goto(base); await p.waitForFunction(() => window.hudiniReady); const k = await p.evaluate(async () => newRoomKeys()); await p.context().close(); return k; };

  await step('opens the streamer of a session: room from its keys, relay with the addresses and fingerprint', async () => {
    const k = await keysFrom();
    const p = await open('panel-s1', '?session=room_one1', { 'app.sessions': [sess('room_one1', k)] });
    check(await until(async () => (await cls(p)).includes('ok'), 15000), 'status online: ' + await status(p));
    eq(await p.evaluate(() => room), 'room_one1', 'panel is in the room of the session');
    eq(await p.evaluate(() => curRoom().k), k.k, 'room has the keys from the session');
    const call = await p.evaluate(() => window.__calls.find(c => c[0] === 'relay_open'));
    eq(call?.[1], { addrs: [{ h: '127.0.0.1', port: host.modPort, net: 'tailscale' }], fp: FP }, 'relay_open got the addresses and the fingerprint');
    check(/Tailscale/.test(await status(p)) && /4 ms/.test(await status(p)), 'status names the network and the delay: ' + await status(p));
    check(!(await p.isHidden('#toSessions')), '← Сессии is shown in the app');
    eq(await p.getAttribute('#toSessions', 'href'), '../app/start.html', '← Сессии leads back to the list');
    eq(new URL(p.url()).search, '', 'the session id is gone from the address bar');
    check(await until(async () => (await T.stored(p, 'app.sessions'))?.[0]?.lastNet === 'tailscale'), 'session remembers the network that worked');
    check(!seen.some(u => /emqx|trycloudflare|unpkg/.test(u) && !/widget/.test(u)), 'the panel asked no public broker or tunnel: ' + seen.filter(u => /emqx|trycloudflare|unpkg/.test(u)).join(' '));
    await p.context().close();
  });

  await step('delay colours: green under 80 ms, yellow under 200, red above', async () => {
    const k = await keysFrom();
    const p = await open('panel-s2', '?session=room_two2', { 'app.sessions': [sess('room_two2', k)] });
    check(await until(async () => (await cls(p)).includes('ok'), 15000), 'online');
    const st = rtt => p.evaluate(rtt => __emit('relay_status', { state: 'online', addr: '127.0.0.1:1', net: 'lan', rtt_ms: rtt, since: Date.now(), reconnects: 2, last_error: '' }), rtt);
    await st(120); check(await until(async () => (await cls(p)).includes('warn')), '120 ms is yellow: ' + await status(p));
    await st(450); check(await until(async () => (await cls(p)).includes('bad')), '450 ms is red');
    await st(30); check(await until(async () => (await cls(p)).includes('ok')), '30 ms is green');
    check(/30 ms/.test(await status(p)) && /Локальная сеть/.test(await status(p)), 'text follows the relay: ' + await status(p));
    check(/Переподключений: 2/.test(await p.getAttribute('#status', 'title')), 'details show the reconnects');
    await p.context().close();
  });

  await step('relay states: no answer, wrong fingerprint, wrong password', async () => {
    const k = await keysFrom();
    const p = await open('panel-s3', '?session=room_thr3', { 'app.sessions': [sess('room_thr3', k)] });
    check(await until(async () => (await cls(p)).includes('ok'), 15000), 'online first');
    await p.evaluate(() => { dropHome(); __emit('relay_status', { state: 'connecting', addr: '', net: '', rtt_ms: null, since: Date.now(), reconnects: 0, last_error: '' }); });
    check(/подключаюсь/.test(await status(p)), 'connecting: ' + await status(p));
    await p.evaluate(() => __emit('relay_status', { state: 'offline', addr: '', net: '', rtt_ms: null, since: Date.now(), reconnects: 1, last_error: 'connect timeout' }));
    check(/сервер не отвечает/.test(await status(p)) && (await cls(p)).includes('bad'), 'offline: ' + await status(p));
    check(/VPN/.test(await p.getAttribute('#status', 'title')), 'the hint names the VPN');
    await p.evaluate(() => __emit('relay_status', { state: 'badcert', addr: '127.0.0.1:1', net: 'lan', rtt_ms: null, since: Date.now(), reconnects: 1, last_error: '' }));
    check(/отпечаток не совпал/.test(await status(p)), 'badcert: ' + await status(p));
    await p.context().close();

    const bad = await open('panel-s4', '?session=room_fou4', { 'app.sessions': [sess('room_fou4', { ...k, pass: 'definitely-wrong' })] });
    check(await until(async () => /пароль/.test(await status(bad)), 15000), 'wrong password: ' + await status(bad));
    check((await cls(bad)).includes('bad'), 'wrong password is red');
    await bad.context().close();
  });

  await step('a session without keys or an unknown one: a clear message and the way back', async () => {
    const a = await open('panel-s5', '?session=room_nok5', { 'app.sessions': [sess('room_nok5')] });
    await a.waitForSelector('#fatal a');
    check(/нет ключей комнаты/.test(await a.textContent('#fatal')), 'no keys: ' + await a.textContent('#fatal'));
    eq(await a.getAttribute('#fatal a', 'href'), '../app/start.html', 'link back to the sessions');
    await a.context().close();
    const b = await open('panel-s6', '?session=room_unk6', { 'app.sessions': [] });
    await b.waitForSelector('#fatal a');
    check(/нет в списке сессий/.test(await b.textContent('#fatal')), 'unknown: ' + await b.textContent('#fatal'));
    await b.context().close();
  });

  await step('keys of a room the panel already has are not replaced by a session', async () => {
    const k1 = await keysFrom(), k2 = await keysFrom();
    const p = await T.newPage('panel-s7'); let alerted = '';
    p.removeAllListeners('dialog'); p.on('dialog', d => { alerted = d.message(); d.accept(); });
    await p.goto(base); await p.waitForFunction(() => window.hudiniReady);
    await p.evaluate(async ([id, k1, s2]) => {
      rooms.push(cleanRoom({ code: id, name: 'Старая', ...k1 })); await saveRooms();
      HudiniStore.set('app.sessions', [{ id, name: 'Новая', pass: 'x', fp: s2.fp, addrs: s2.addrs, pinned: false, added: 1, last: 0, lastNet: '', ...s2.keys }]);
      await HudiniStore.flushNow();
    }, ['room_sam7', k1, { fp: FP, addrs: [{ h: '127.0.0.1', port: host.modPort, net: 'lan' }], keys: k2 }]);
    await p.goto(base + '?session=room_sam7'); await p.waitForFunction(() => window.hudiniReady);
    eq(await p.evaluate(() => curRoom().k), k1.k, 'the saved room kept its keys');
    check(/другими ключами/.test(alerted), 'the moderator was told: ' + alerted);
    await p.context().close();
  });

  await step('the panel shows an app update and applies it', async () => {
    const k = await keysFrom();
    const p = await open('panel-s8', '?session=room_upd8', { 'app.sessions': [sess('room_upd8', k)] });
    await p.waitForFunction(() => window.hudiniReady);
    check(await p.isHidden('#updBanner'), 'no banner without an update');
    await p.evaluate(() => __emit('hudini-update', { state: 'ready', ver: '1.0.1' }));
    check(await until(async () => !(await p.isHidden('#updBanner'))), 'banner appears');
    check(/1\.0\.1/.test(await p.getAttribute('#updBanner', 'title')), 'banner names the version');
    await p.click('#updBanner');
    check(await until(() => p.evaluate(() => window.__calls.some(c => c[0] === 'apply_update'))), 'apply_update called');
    await p.click('[data-tab=room]');
    check(!(await p.isHidden('#dataDir')), 'the data folder button is shown in the app');
    await p.click('#dataDir');
    check(await until(() => p.evaluate(() => window.__calls.some(c => c[0] === 'open_data'))), 'open_data called');
    await p.context().close();
  });

  await T.closeBrowser(); await host.stop(); await web.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
