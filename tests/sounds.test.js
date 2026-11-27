// Program sounds: which Host events are heard and when, the Host window and the moderator panel playing them,
// no pile-up of sounds, and silence in the OBS widget.
'use strict';
const fs = require('fs'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const NAMES = ['request', 'error', 'update', 'join', 'leave', 'ok'];
// every sound a page starts, by name
const record = () => { window.__played = []; const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(){ if(this.dataset.sound) window.__played.push(this.dataset.sound); return play.call(this).catch(() => {}); }; };
const played = p => p.evaluate(() => window.__played.slice());

(async () => {
  let host = T.startHost({ OVERLAY_SITE: 'off' }); await host.ready();
  const mqtt = require('mqtt'), clients = [];
  const connect = (url, opts = {}) => new Promise((ok, no) => { const c = mqtt.connect(url, { reconnectPeriod: 0, rejectUnauthorized: false, ...opts }); c.on('connect', () => { clients.push(c); ok(c); }); c.on('error', no); });
  const widget = () => connect(`ws://localhost:${host.port}/mqtt`);
  const mod = async () => connect(`wss://127.0.0.1:${host.modPort}/mqtt`, { username: 'mod', password: (await host.code()).data.pass });
  // what the Host window would be told to play
  async function feed(){
    const stop = new AbortController(), heard = [];
    const r = await fetch(host.admin + '/api/sounds', { headers: { 'x-hudini-token': host.token }, signal: stop.signal });
    (async () => { let buf = ''; try{ for await (const c of r.body){ buf += Buffer.from(c).toString(); let i; while((i = buf.indexOf('\n\n')) >= 0){ const m = /^data: (\S+)$/m.exec(buf.slice(0, i)); if(m) heard.push(m[1]); buf = buf.slice(i + 2); } } }catch{} })();
    return { heard, type: r.headers.get('content-type'), close: () => stop.abort() };
  }

  await step('the six sounds are served by the Host; the event stream only to the Host window', async () => {
    for(const n of NAMES){
      const r = await fetch(`${host.admin}/shared/sounds/${n}.wav`), b = Buffer.from(await r.arrayBuffer());
      check(r.ok && r.headers.get('content-type') === 'audio/wav' && b.equals(fs.readFileSync(path.join(T.ROOT, 'web/shared/sounds', n + '.wav'))), n + '.wav');
    }
    eq((await fetch(host.admin + '/shared/sounds/nothing.wav')).status, 404, 'nothing else');
    eq((await fetch(host.admin + '/shared/sounds.js')).status, 200, 'the player');
    for(const url of [host.admin + '/api/sounds', host.base + '/api/sounds']) eq((await fetch(url)).status, 403, 'refused without the management cookie: ' + url);
  });

  await step('silent until sounds are switched on; a switched off event stays silent', async () => {
    const f = await feed();
    check(/^text\/event-stream/.test(f.type), 'an event stream');
    const w = await widget(); await sleep(500);
    eq(f.heard, [], 'not asked yet: silent');
    await host.api('/api/ui', { sounds: true });
    await host.api('/api/notify', { group: 'moderators', on: false });
    const m = await mod(); await sleep(500);
    eq(f.heard, [], 'the moderators group is off');
    await host.api('/api/notify', { group: 'moderators', on: true });
    const m2 = await mod();
    check(await until(() => f.heard.includes('join')), 'a moderator joined', f.heard);
    m2.end(true); await sleep(500);
    check(!f.heard.includes('leave'), 'leaving is off by default');
    w.end(true); m.end(true); f.close();
  });

  await step('the widget connecting is «ok»; a request is always heard while sounds are on', async () => {
    await host.api('/api/notify', { group: 'obs', on: true });
    await sleep(5600);   // the previous widget is reported as dropped
    for(const g of ['moderators', 'obs', 'system']) await host.api('/api/notify', { group: g, on: false });
    const f = await feed();
    const code = (await host.code()).data;
    await host.api('/api/perms', { perms: { screen: true } });
    const c = await connect(`wss://127.0.0.1:${host.modPort}/mqtt`, { username: 'mod', password: code.pass, clientId: 'asker-1' });
    const head = Buffer.from(JSON.stringify({ v: 1, sid: 'sid-12345678', kind: 'screen', t: 'offer', to: 'widget' })), len = Buffer.alloc(2); len.writeUInt16BE(head.length);
    c.publish(`stream-overlay/v1/${code.room}/rtc`, Buffer.concat([len, head, Buffer.alloc(64, 1)]));
    check(await until(() => f.heard.includes('request'), 5000), 'a request with all groups off', { heard: f.heard, log: host.log().split('\n').slice(-6) });
    check(!f.heard.includes('join'), 'and nothing else');
    c.end(true);
    await host.api('/api/notify', { group: 'obs', on: true });
    await sleep(300);
    const w = await widget();
    check(await until(() => f.heard.includes('ok'), 3000), 'OBS widget connected', f.heard);
    await host.api('/api/ui', { sounds: false });
    await host.api('/api/notify', { group: 'moderators', on: true });
    const n = f.heard.length; const m = await mod(); await sleep(500);
    eq(f.heard.length, n, 'sounds off: silent');
    w.end(true); m.end(true); f.close();
  });

  await step('the Host window: preview on switching on, events heard (also with the window hidden)', async () => {
    // a fresh program: the one above has just reported this moderator, and a repeat is silent for a minute
    await host.stop(); host = T.startHost({ OVERLAY_SITE: 'off' }); await host.ready();
    await host.api('/api/ui', { sounds: false, tourDone: true, seenWhatsNew: true });
    const p = await T.newPage('ui', { app: false, w: 980, h: 760 });
    await p.addInitScript(record);
    await p.goto(`${host.admin}/auth?t=${host.token}`); await p.waitForURL(u => new URL(u).pathname === '/');
    await p.click('#nav [data-go="app"]');
    await p.waitForSelector('#soundsRow', { state: 'visible' });
    await p.click('#soundsOn + .sw');
    check(await until(async () => (await played(p)).join() === 'ok'), 'switching on plays «ok» once', await played(p));
    await sleep(2600);   // the stream opens with the next status poll
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true }); Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' }); });
    const m = await mod();
    check(await until(async () => (await played(p)).includes('join')), 'a moderator joining is heard', await played(p));
    await p.click('#soundsOn + .sw'); await sleep(500);
    const n = (await played(p)).length;
    const m2 = await mod(); await sleep(2000);
    eq((await played(p)).length, n, 'switched off: no sound, none for switching off');
    m.end(true); m2.end(true); await p.context().close();
  });

  await step('sounds do not pile up: one at a time, the most important of the newcomers next', async () => {
    const web = await T.webServer();
    const p = await T.newPage('panel', { tour: false });
    await p.addInitScript(record);
    await p.goto(`${web.url}/app/start.html`);
    await p.addScriptTag({ url: web.url + '/shared/sounds.js' });
    await p.evaluate(() => { for(const n of ['ok', 'ok', 'leave', 'error', 'join', 'ok', 'nonsense']) HudiniSounds.play(n); });
    await sleep(3800);
    eq(await played(p), ['ok', 'error'], 'two, apart from each other');
    await p.context().close(); await web.close();
  });

  await host.stop();
  await step('the panel: its own switch; connected, request answered, connection lost', async () => {
    const s = await T.stack(); const p = s.panel;
    await p.evaluate(record);
    eq(await p.evaluate(() => HudiniSounds.answer()), null, 'not asked yet');
    await p.evaluate(() => HudiniSounds.event('ok'));
    await sleep(400); eq(await played(p), [], 'silent until switched on');
    await p.evaluate(() => HudiniSounds.setOn(true));
    check(await until(async () => (await played(p)).join() === 'ok'), 'the preview', await played(p));
    await sleep(1700);
    await p.evaluate(async () => { const buf = await sealJSON(KEYS, { cid: client.options.clientId, kind: 'screen', ev: 'no', why: 'denied' }); await answerSound(buf); });
    check(await until(async () => (await played(p)).join() === 'ok,error'), 'a refused request', await played(p));
    await sleep(1700);
    await p.evaluate(async () => { const buf = await sealJSON(KEYS, { cid: 'someone-else', kind: 'screen', ev: 'ok' }); await answerSound(buf); });
    await sleep(500); eq((await played(p)).length, 2, 'answers to others are not heard');
    await s.host.stop();
    check(await until(async () => (await played(p)).join() === 'ok,error,error', 12000), 'the connection is lost', await played(p));
    await p.evaluate(() => document.body.classList.add('streamer-panel'));
    await sleep(1700); await p.evaluate(() => HudiniSounds.event('ok')); await sleep(400);
    eq((await played(p)).length, 3, 'the streamer panel window stays silent');
    await p.context().close(); await s.close();
  });

  await step('no sound can come from the OBS widget', async () => {
    for(const f of ['web/widget/widget.html', 'web/shared/core.js', 'web/shared/media.js', 'web/shared/case3d.js'])
      check(!/sounds\.js|HudiniSounds|shared\/sounds\/|api\/sounds/.test(fs.readFileSync(path.join(T.ROOT, f), 'utf8')), f);
  });

  for(const c of clients) c.end(true);
  await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
