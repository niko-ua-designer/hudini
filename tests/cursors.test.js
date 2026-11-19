// Other moderators' cursors on the canvas: two panels on one Host, positions in percent, fading, nothing reaches the stream,
// junk is trimmed, the switch works.
'use strict';
const T = require('./lib');
const path = require('path');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid, host } = S;
  const inv = await mod.evaluate(() => inviteLink(curRoom()));
  const mod2 = await T.newPage('mod2');
  await mod2.goto(inv);
  await mod2.waitForFunction(() => typeof curRoom === 'function' && curRoom());
  await T.attach(mod2, host);
  await until(async () => (await mod2.getAttribute('#status', 'class')).includes('ok'), 12000);
  // record every MQTT frame the widget sends or receives (topics are plain text inside the packets)
  await wid.addInitScript(() => {
    window.__frames = [];
    const dec = b => { try{ return typeof b === 'string' ? b : new TextDecoder('latin1').decode(b instanceof Blob ? new Uint8Array() : b); }catch{ return ''; } };
    const WS = window.WebSocket;
    window.WebSocket = function(...a){
      const ws = new WS(...a); ws.binaryType = 'arraybuffer';
      ws.addEventListener('message', e => window.__frames.push(dec(e.data)));
      const send = ws.send.bind(ws); ws.send = d => { window.__frames.push(dec(d)); return send(d); };
      return ws;
    };
    window.WebSocket.prototype = WS.prototype;
    for(const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) window.WebSocket[k] = WS[k];
  });
  await wid.reload();
  await until(() => wid.evaluate(() => window.__frames.length > 0), 10000);

  const box = p => p.evaluate(() => { const r = stage.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const at = async (p, fx, fy) => { const b = await box(p); await p.mouse.move(b.x + fx * b.w, b.y + fy * b.h, { steps: 3 }); };
  const curs = p => p.evaluate(() => [...document.querySelectorAll('#curLayer .cur')].map(c => ({ x: parseFloat(c.style.left), y: parseFloat(c.style.top), n: c.lastChild.textContent, col: c.style.getPropertyValue('--c') })));
  const shots = process.env.HUDINI_SHOT_DIR || '/tmp/claude-1000/-mnt-2606f0bd-2791-4916-a6ac-8604ac4ba5a0-Documents-Projects-hudini/e92e809b-8c6c-4984-99c4-a74beeaa7e55/scratchpad/cursors';

  await step('the first panel\'s cursor shows on the second at the same place', async () => {
    check(await mod.evaluate(() => document.getElementById('curOn').checked), 'on by default');
    await mod.fill('#curName', 'Anna');
    await at(mod, 0.3, 0.4);
    check(await until(async () => (await curs(mod2)).length === 1, 4000), 'a cursor appears');
    const [c] = await curs(mod2);
    check(Math.abs(c.x - 30) < 1 && Math.abs(c.y - 40) < 1, 'position in percent of the stage', JSON.stringify(c));
    eq(c.n, 'Anna', 'the moderator\'s name');
    eq((await curs(mod)).length, 0, 'own cursor is not shown');
    await at(mod, 0.7, 0.6);
    check(await until(async () => { const [d] = await curs(mod2); return d && Math.abs(d.x - 70) < 1 && Math.abs(d.y - 60) < 1; }, 4000), 'it follows the mouse');
  });

  await step('it stays while the mouse rests, fades without updates, and goes when the mouse leaves', async () => {
    await sleep(3600);
    eq((await curs(mod2)).length, 1, 'a resting mouse keeps the cursor');
    await mod.evaluate(() => { document.getElementById('curOn').checked = true; });
    await mod.evaluate(() => { Cursors.reset(); });   // stop the keep-alive position
    await sleep(3800);
    eq((await curs(mod2)).length, 0, 'no updates for 3 s: the cursor is gone');
    await at(mod, 0.5, 0.5);
    check(await until(async () => (await curs(mod2)).length === 1, 4000), 'it comes back');
    await mod.mouse.move(2, 2, { steps: 2 });   // out of the stage
    check(await until(async () => (await curs(mod2)).length === 0, 3000), 'leaving the canvas hides it at once');
  });

  await step('a dragged element gets a frame in the other colour', async () => {
    await mod.evaluate(() => { beginChange(); state.els = [sanitizeEl({ id: 'tx1', type: 'text', text: 'HELLO', x: 50, y: 50 })]; commit(); });
    await until(async () => mod2.evaluate(() => !!byId('tx1')), 6000);
    await mod.evaluate(() => select('tx1'));
    await at(mod, 0.2, 0.2);
    check(await until(() => mod2.evaluate(() => { const b = document.querySelector('#curLayer .curBox'); return !!b && !b.hidden && b.getBoundingClientRect().width > 5; }), 4000), 'the selected element is framed');
    if(shots){ await mod.screenshot({ path: path.join(shots, 'panel-1.png') }); await mod2.screenshot({ path: path.join(shots, 'panel-2.png') }); }
  });

  await step('nothing goes to the stream', async () => {
    const f = await wid.evaluate(() => window.__frames);
    check(f.some(x => x.includes('/hb')) && f.some(x => x.includes('/state')), 'the frame recorder sees the widget\'s traffic', String(f.length));
    check(!f.some(x => x.includes('/cur')), 'the widget neither subscribes to cur nor receives it');
    const src = require('fs').readFileSync(path.join(__dirname, '../server/server.js'), 'utf8');
    check(/PUB_MOD = new Set\(\[[^\]]*'cur'[^\]]*\]\), PUB_LOCAL = new Set\(\['hb'\]\)/.test(src), 'the Host lets only moderators publish cur');
    const w = require('fs').readFileSync(path.join(__dirname, '../web/widget/widget.html'), 'utf8');
    check(!/\/cur\b|\.cur\b/.test(w), 'the widget page does not mention cur');
  });

  await step('junk is trimmed', async () => {
    const r = await mod2.evaluate(() => {
      Cursors.reset();
      const m = (o) => Cursors.msg(o);
      m({ id: 'a1', x: NaN, y: 5 }); m({ id: 'a2', x: 'x', y: 5 }); m({ id: 'bad id!', x: 5, y: 5 }); m(null); m([1]); m('s'); m({ id: clientId, x: 5, y: 5 }); m({ x: 5, y: 5 });
      const none = Cursors.peers.size;
      m({ id: 'big', x: 1e9, y: -1e9, n: '<b>' + 'N'.repeat(100) + '</b>', s: 'x"y', d: '__proto__' });
      const big = [...document.querySelectorAll('#curLayer .cur')].map(c => ({ x: c.style.left, y: c.style.top, n: c.lastChild.textContent }))[0];
      for(let i = 0; i < 1000; i++) m({ id: 'c' + i, x: 10, y: 10 });
      return { none, big, many: Cursors.peers.size, dom: document.querySelectorAll('#curLayer .cur').length, html: document.getElementById('curLayer').innerHTML.includes('<b>') };
    });
    eq(r.none, 0, 'NaN, non-numbers, bad ids, own id and junk shapes are dropped');
    eq([r.big.x, r.big.y], ['100%', '0%'], 'coordinates are clamped to 0..100');
    check(r.big.n.length <= 24 && !r.big.n.includes('<'), 'the name is cut to 24 and cleaned', r.big.n);
    eq([r.many, r.dom], [12, 12], 'at most 12 cursors');
    check(!r.html, 'names are text, not markup');
    await mod2.evaluate(() => Cursors.reset());
    eq(await mod2.evaluate(() => [Cursors.peers.size, document.querySelectorAll('#curLayer *').length]), [0, 0], 'reset leaves nothing behind');
  });

  await step('the switch turns both showing and sending off', async () => {
    await mod2.evaluate(() => { const c = document.getElementById('curOn'); c.checked = false; c.dispatchEvent(new Event('change')); });
    await at(mod, 0.4, 0.4);
    await sleep(900);
    eq((await curs(mod2)).length, 0, 'cursors of others are not shown when off');
    check(await mod2.evaluate(() => document.getElementById('curLayer').hidden), 'the layer is hidden');
    await mod2.evaluate(() => { const c = document.getElementById('curOn'); c.checked = true; c.dispatchEvent(new Event('change')); });
    await at(mod, 0.45, 0.45);
    check(await until(async () => (await curs(mod2)).length === 1, 4000), 'back on: the cursor is shown again');
    // sending off: mod2 off, mod must see nothing from mod2
    await mod.evaluate(() => Cursors.reset());
    await mod2.evaluate(() => { const c = document.getElementById('curOn'); c.checked = false; c.dispatchEvent(new Event('change')); });
    await at(mod2, 0.6, 0.6);
    await sleep(900);
    eq((await curs(mod)).length, 0, 'a panel with cursors off does not send its own');
    eq(await mod2.evaluate(() => JSON.stringify(HudiniStore.get('overlay.cursors', true))), 'false', 'the choice is remembered');
  });

  await step('changing the room leaves no cursors and no timers', async () => {
    await mod2.evaluate(() => { const c = document.getElementById('curOn'); c.checked = true; c.dispatchEvent(new Event('change')); });
    await at(mod, 0.3, 0.3);
    await until(async () => (await curs(mod2)).length === 1, 4000);
    await mod2.evaluate(() => Cursors.reset());
    eq(await mod2.evaluate(() => Cursors.peers.size), 0, 'after the switch of rooms (reset) the list is empty');
    await mod.mouse.move(2, 2);
    await sleep(1500);
    eq(await mod2.evaluate(() => Cursors.peers.size), 0, 'no timer brings anything back');
  });

  await mod2.context().close();
  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
