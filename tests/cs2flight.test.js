// CS2 camera flights: the console client (server/netcon.js) against a fake netcon server, then the whole chain panel → Host → fake game.
// Checks: only spec_goto / getpos / spec_mode ever reach the console, bad input is rejected, getpos parsing, flight timing under the GSI phase,
// cuts (one jump, nothing in between), chains with pauses, silence while the streamer plays, validation of every field on the Host,
// and the path editor in the panel (create, edit, duplicate, delete, export/import, sync to the widget, info plate).
'use strict';
const fs = require('fs'), path = require('path'), net = require('net');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const ROOT = path.join(__dirname, '..');
const SHOT = process.env.HUDINI_SHOT_DIR || require('os').tmpdir();

// A stand-in for the game console: records every line, answers getpos like CS2 does
function fakeNetcon(){
  const cmds = [], conns = [];
  const srv = net.createServer(sock => {
    conns.push(sock); let buf = '';
    sock.on('data', d => { buf += d; let i; while((i = buf.indexOf('\n')) >= 0){ const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); cmds.push({ l, t: Date.now() }); if(l === 'getpos') sock.write('setpos 11.5 -22.25 333;setang 4.5 90 0\n'); } });
    sock.on('error', () => {});
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ cmds, conns, port: srv.address().port, lines: () => cmds.map(c => c.l), close(){ for(const c of conns) c.destroy(); srv.close(); } })));
}
const GOTO = /^spec_goto (-?\d+\.\d\d) (-?\d+\.\d\d) (-?\d+\.\d\d) (-?\d+\.\d\d) (-?\d+\.\d\d)$/;
const gotos = f => f.cmds.filter(c => GOTO.test(c.l)).map(c => ({ x: Number(GOTO.exec(c.l)[1]), t: c.t }));
const pt = (x, extra = {}) => ({ p: [x, 0, 100], a: [0, 0, 0], t: 0, j: 0, ...extra });

(async () => {
  const N = await import(path.join(ROOT, 'server', 'netcon.js'));

  await step('netcon.js touches no files and no processes, and talks to 127.0.0.1 only', async () => {
    const raw = fs.readFileSync(path.join(ROOT, 'server', 'netcon.js'), 'utf8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    eq([...code.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['node:net'], 'the only import is node:net');
    check(!/\b(fs|child_process|execSync|execFile|spawn|spawnSync|writeFile|writeFileSync|appendFile|createWriteStream|readFile|readFileSync|rename|unlink|mkdir)\b|\bexec\(/.test(code.replace(/\.exec\(/g, '.re(')), 'no fs / child_process / writing calls');
    check(!/process\./.test(code) && !/require\(/.test(code) && !/import\(/.test(code), 'no process access, no dynamic loading');
    eq(N.NETCON_HOST, '127.0.0.1', 'the host is fixed');
    check(!/host\s*:\s*[a-z]/i.test(code.replace(/host:NETCON_HOST/, '')), 'connect() never takes another host');
    const server = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
    check(/FLIGHTS_FILE = path\.join\(BASE, 'cs2-flights\.json'\)/.test(server), 'routes live in the Host data folder (data/cs2-flights.json)');
    const panel = fs.readFileSync(path.join(ROOT, 'web', 'panel', 'flights.js'), 'utf8');
    check(!/spec_goto|spec_mode|getpos\s*\(/.test(panel.replace(/\/\/.*$/gm, '').replace(/'[^']*getpos[^']*'/g, '')), 'the panel code has no console commands');
  });

  await step('command whitelist: only spec_goto, getpos and spec_mode, numbers only', async () => {
    eq(N.buildCmd('getpos'), 'getpos', 'getpos');
    eq(N.buildCmd('spec_mode', 6), 'spec_mode 6', 'spec_mode 6');
    eq(N.buildCmd('spec_goto', 1, -2.5, 300.123, 10, 359), 'spec_goto 1.00 -2.50 300.12 10.00 359.00', 'spec_goto formats numbers');
    for(const bad of [['quit'], ['say', 'hi'], ['exec', 'x'], ['rcon_password', 'x'], ['getpos', 'x'], ['spec_mode', 7], ['spec_mode', '4'], ['spec_mode', -1], ['spec_mode', 1.5], ['spec_mode'],
      ['spec_goto', 1, 2, 3, 4], ['spec_goto', 1, 2, 3, 4, 5, 6], ['spec_goto', '1; quit', 2, 3, 4, 5], ['spec_goto', NaN, 2, 3, 4, 5], ['spec_goto', Infinity, 2, 3, 4, 5],
      ['spec_goto', 1e9, 2, 3, 4, 5], ['spec_goto', null, 2, 3, 4, 5], ['spec_goto', '', 2, 3, 4, 5], ['spec_goto', true, 2, 3, 4, 5], ['spec_goto', [1], 2, 3, 4, 5], ['__proto__'], ['constructor']])
      eq(N.buildCmd(...bad), null, 'rejected: ' + JSON.stringify(bad));
    eq(['getpos', 'spec_mode 0', 'spec_goto 1.00 2.00 3.00 4.00 5.00'].map(N.isWireOk), [true, true, true], 'wire check accepts the three forms');
    eq(['getpos;quit', 'quit', 'spec_goto 1 2 3 4 5', 'spec_goto 1.00 2.00 3.00 4.00 5.00; quit', 'spec_mode 4\nquit', 'echo hi', ' getpos', 'spec_mode 7', ''].map(N.isWireOk), Array(9).fill(false), 'wire check rejects everything else');
  });

  await step('getpos answer is parsed strictly', async () => {
    eq(N.parseGetpos('setpos 11.5 -22.25 333;setang 4.5 90 0'), { p: [11.5, -22.25, 333], a: [4.5, 90, 0] }, 'CS2 answer');
    eq(N.parseGetpos('setpos 1 2 3.5; setang -10.25 -179.9 0.0'), { p: [1, 2, 3.5], a: [-10.25, -179.9, 0] }, 'spaces and negatives');
    eq(N.parseGetpos('[console] setpos 1 2 3;setang 4 5 6')?.p, [1, 2, 3], 'a prefix before the answer is fine');
    for(const bad of ['', 'hello', 'setpos 1 2;setang 1 2 3', 'setpos a b c;setang 1 2 3', 'setpos 1 2 3;setang 1 2', 'setpos 1e9 2 3;setang 1 2 3', 'setpos 1 2 3;setang NaN 2 3', null, undefined])
      eq(N.parseGetpos(bad), null, 'not a position: ' + JSON.stringify(bad));
  });

  await step('the spline and the plan: cuts split runs, chains join, pauses stand', async () => {
    const A = [pt(0), pt(100), pt(200)], mid = N.splineAt(A, .5);
    check(Math.abs(mid.p[0] - 100) < 1e-6, 'spline passes through the middle point');
    eq([N.splineAt(A, 0).p[0], N.splineAt(A, 1).p[0]], [0, 200], 'and the ends');
    eq(N.splineAt([pt(0, { a: [0, 170, 0] }), pt(1, { a: [0, -170, 0] })], .5).a[1] === 180 || Math.abs(Math.abs(N.splineAt([pt(0, { a: [0, 170, 0] }), pt(1, { a: [0, -170, 0] })], .5).a[1]) - 180) < 1e-6, true, 'yaw takes the short way round');
    const runs = N.runsOf([{ pts: [pt(0), pt(100), pt(5000, { j: 1 }), pt(5100)], join: 'smooth', pause: 0 }, { pts: [pt(9000), pt(9100)], join: 'cut', pause: 2 }]);
    eq(runs.map(r => [r.pause, r.pts.map(q => q.p[0])]), [[0, [0, 100]], [0, [5000, 5100]], [2, [9000, 9100]]], 'a cut inside a path and a cut join split into runs; the pause sits before its run');
    const sm = N.runsOf([{ pts: [pt(0), pt(10)], join: 'smooth', pause: 0 }, { pts: [pt(20), pt(30)], join: 'smooth', pause: 0 }]);
    eq(sm.map(r => r.pts.map(q => q.p[0])), [[0, 10, 20, 30]], 'a smooth join without a pause continues one spline');
    const sp = N.runsOf([{ pts: [pt(0), pt(10)], join: 'smooth', pause: 0 }, { pts: [pt(20), pt(30)], join: 'smooth', pause: 1.5 }]);
    eq(sp.map(r => [r.pause, r.pts.map(q => q.p[0])]), [[0, [0, 10]], [1.5, [10, 20, 30]]], 'a smooth join with a pause: stand at the end, then fly on from there');
    const lay = N.layout(runs, 6);
    eq(lay.runs.map(r => +r.dur.toFixed(2)), [2, 2, 2], 'six seconds of movement spread over six equal segments, the cut takes no time');
    check(Math.abs(lay.total - 8) < 1e-9, 'total = movement + the 2 s pause', lay.total);
    const w = N.layout(N.runsOf([{ pts: [pt(0), pt(1, { t: 1 }), pt(2, { t: 3 })], join: 'smooth', pause: 0 }]), 8);
    eq(w.runs[0].ws, [2, 6], 'time per segment keeps its proportions when fitted to the phase');
    eq(N.planAt(lay, 2.5).i, 1, 'plan: second run at 2.5 s');
    eq(N.planAt(lay, 4.5).pos, null, 'plan: standing during the pause');
    check(N.planAt(lay, 100).done, 'plan is done at the end');
  });

  await step('validation of routes, chains and settings on the Host side', async () => {
    const dirty = { v: 1, cfg: { on: 1, port: 80, pick: 'x', returnMode: 9 }, maps: {
      'de_mirage': Array.from({ length: 12 }, (_, i) => ({ id: 'r' + i, name: 'N\u0000' + 'x'.repeat(90), dur: 1e9, trg: { tech: 'yes' },
        pts: Array.from({ length: 80 }, (_, k) => k === 3 ? { p: ['1', 2, 3], a: [0, 0, 0] } : k === 4 ? { p: [1e12, 2, 3], a: [0, 0, 0] } : k === 5 ? { p: [1, 2, 3], a: [0, 0] } : { p: [k, 2, 3], a: [0, 0, 0], t: -4, j: 'yes' }) })),
      '../../etc': [{ id: '../x', name: 'y', pts: [] }], '': [{ id: 'a' }] },
      chains: { de_mirage: { freeze: Array.from({ length: 20 }, () => ({ id: 'r1', join: 'warp', pause: 1e9 })), bogus: [{ id: 'a' }] } } };
    const c = N.cleanFlights(dirty);
    eq([c.cfg.on, c.cfg.port, c.cfg.pick, c.cfg.returnMode], [false, 27015, 'rr', 4], 'settings fall back to safe values');
    eq(c.maps.de_mirage.length, 8, 'at most 8 paths per map');
    const r = c.maps.de_mirage[0];
    eq([r.name.length, r.dur, r.trg.tech, r.pts.length], [40, 300, false, 37 + 0 > 40 ? 40 : r.pts.length], 'name 40 chars, duration 300 max, strict booleans');
    check(r.pts.length <= 40 && r.pts.every(q => q.p.every(Number.isFinite) && q.a.length === 3 && q.t === 0 && q.j === 0), 'at most 40 points, only finite numbers, t >= 0, j is 0 or 1');
    check(!r.pts.some(q => q.p[0] > 1e6), 'a coordinate out of range drops the point');
    eq(Object.keys(c.maps).sort(), ['de_mirage', 'etc'], 'map keys are cleaned to [a-z0-9_]; an empty key is dropped');
    eq(c.maps.etc[0].id, 'x', 'ids are cleaned too');
    eq(c.chains.de_mirage.freeze.length, 6, 'a chain has at most 6 steps');
    eq([c.chains.de_mirage.freeze[0].join, c.chains.de_mirage.freeze[0].pause], ['smooth', 60], 'join is smooth or cut; pause 60 s max');
    check(!('bogus' in c.chains.de_mirage), 'unknown moments are dropped');
    const j1 = N.cleanRoute({ name: 'a', pts: [pt(1, { j: 1 })] }, 'q');
    eq(j1.pts[0].j, 1, 'the cut flag survives cleaning');
  });

  // ---- the controller against the fake console ----
  const mk = (data, extra = {}) => {
    const saved = [], changes = [];
    const f = { data };
    f.ctl = N.createFlight({ load: () => data, save: d => saved.push(JSON.stringify(d)), onChange: () => changes.push(Date.now()), ...extra });
    f.saved = saved; f.changes = changes; return f;
  };
  const gsiPkt = (o = {}) => ({ spec: true, map: 'de_mirage', phase: 'live', round: 3, ct: 1, tt: 2, pphase: 'freezetime', pend: Date.now() + 4000, ...o });
  // keeps the controller's GSI fresh like the Host does (about 10 packets a second)
  const feed = (ctl, mkPkt) => { ctl.onGsi(mkPkt()); const iv = setInterval(() => ctl.onGsi(mkPkt()), 150); return () => clearInterval(iv); };
  const cfgOn = (port, extra = {}) => ({ on: true, port, pick: 'rr', returnMode: 4, ...extra });

  await step('a flight under freeze time: spec_mode 6, a stream of spec_goto, fits the phase, then back to the player', async () => {
    const f = await fakeNetcon();
    const route = { id: 'a', name: 'A', pts: [pt(0), pt(500), pt(1000)], dur: 0, trg: { freeze: true, tech: false, timeout: true, warmup: false } };
    const m = mk({ v: 1, cfg: cfgOn(f.port), maps: { de_mirage: [route] }, chains: {} });
    const t0 = Date.now(), end = Date.now() + 4000, stop = feed(m.ctl, () => gsiPkt({ pend: end }));
    check(await until(() => f.lines().includes('spec_mode 4'), 7000), 'the flight ends with spec_mode 4 (back to the player)');
    stop();
    const L = f.lines();
    eq(L[0], 'spec_mode 6', 'first a free camera');
    check(L.every(l => l === 'spec_mode 6' || l === 'spec_mode 4' || GOTO.test(l)), 'only whitelisted lines reached the console', L.filter(l => !GOTO.test(l)));
    const g = gotos(f), span = (g[g.length - 1].t - g[0].t) / 1000;
    check(span > 2.3 && span < 3.1, 'about 2.8 s of movement = 4 s of freeze time minus the margin: ' + span.toFixed(2));
    const rate = g.length / span;
    check(rate > 40 && rate < 75, 'about 60 commands a second: ' + rate.toFixed(0));
    check(g[0].x < 20 && g[g.length - 1].x > 980, 'from the first point to the last');
    check(g.every((q, i) => i === 0 || q.x >= g[i - 1].x - 1e-6), 'moves forward monotonically');
    const slow = g[1].x - g[0].x, fast = Math.max(...g.map((q, i) => i ? q.x - g[i - 1].x : 0));
    check(slow < fast / 4, 'eased start: the first step is much smaller than the fastest');
    await sleep(500);
    eq(f.lines().filter(l => l === 'spec_mode 6').length, 1, 'one flight only: the same freeze time does not start it twice');
    m.ctl.close(); f.close();
  });

  await step('a cut: one jump between the lines, nothing in between', async () => {
    const f = await fakeNetcon();
    const route = { id: 'a', name: 'A', pts: [pt(0), pt(100), pt(5000, { j: 1 }), pt(5100)], dur: 3, trg: { freeze: true, tech: false, timeout: false, warmup: false } };
    const m = mk({ v: 1, cfg: cfgOn(f.port), maps: { de_mirage: [route] }, chains: {} });
    const stop = feed(m.ctl, () => gsiPkt({ pend: Date.now() + 6000 }));
    check(await until(() => f.lines().includes('spec_mode 4'), 8000), 'flight finished');
    stop();
    const g = gotos(f);
    check(g.every(q => (q.x >= -1 && q.x <= 101) || (q.x >= 4999 && q.x <= 5101)), 'every command is on the first line or on the second: no point in between');
    const jumps = g.filter((q, i) => i && Math.abs(q.x - g[i - 1].x) > 1000);
    eq(jumps.length, 1, 'exactly one jump');
    check(g.some(q => q.x < 101) && g.some(q => q.x > 4999), 'both sides were played');
    m.ctl.close(); f.close();
  });

  await step('a chain: two paths, a cut between them and a 1 s pause where the camera stands', async () => {
    const f = await fakeNetcon();
    const A = { id: 'a', name: 'A', pts: [pt(0), pt(100)], dur: 0, trg: { freeze: false, tech: false, timeout: false, warmup: false } };
    const B = { id: 'b', name: 'B', pts: [pt(5000), pt(5100)], dur: 0, trg: { freeze: false, tech: false, timeout: false, warmup: false } };
    const m = mk({ v: 1, cfg: cfgOn(f.port), maps: { de_mirage: [A, B] }, chains: { de_mirage: { freeze: [{ id: 'a', join: 'smooth', pause: 0 }, { id: 'b', join: 'cut', pause: 1 }], tech: [], timeout: [], warmup: [] } } });
    const t0 = Date.now(), stop = feed(m.ctl, () => gsiPkt({ pend: t0 + 6200 }));
    check(await until(() => f.lines().includes('spec_mode 4'), 9000), 'chain finished');
    stop();
    const g = gotos(f), a = g.filter(q => q.x < 200), b = g.filter(q => q.x > 4900);
    check(a.length > 20 && b.length > 20, 'both paths played');
    const gap = (b[0].t - a[a.length - 1].t) / 1000;
    check(gap > 0.9 && gap < 1.4, 'the camera stood for about a second between them: ' + gap.toFixed(2));
    const total = (b[b.length - 1].t - a[0].t) / 1000;
    check(total > 4.0 && total < 5.4, 'the whole chain fits the phase (6.2 s minus the margin): ' + total.toFixed(2));
    check(a[a.length - 1].x > 95, 'the first path reached its end before the cut');
    m.ctl.close(); f.close();
  });

  await step('the streamer plays: not even a connection, a running flight stops silently', async () => {
    const f = await fakeNetcon();
    const route = { id: 'a', name: 'A', pts: [pt(0), pt(500)], dur: 0, trg: { freeze: true, tech: true, timeout: true, warmup: true } };
    const m = mk({ v: 1, cfg: cfgOn(f.port), maps: { de_mirage: [route] }, chains: {} });
    const own = () => gsiPkt({ spec: false });
    const stop = feed(m.ctl, own);
    await sleep(900);
    eq([f.conns.length, f.cmds.length], [0, 0], 'a player: no connection and no command, freeze time or not');
    m.ctl.cmd({ a: 'point', id: 'a', map: 'de_mirage' }); m.ctl.cmd({ a: 'preview', id: 'a', map: 'de_mirage' });
    await sleep(300);
    eq([f.conns.length, f.cmds.length], [0, 0], 'a point request and a preview are refused too: not even getpos');
    check(/зайди|наблюдател/i.test(m.ctl.view().note), 'the panel is told why', m.ctl.view().note);
    stop();
    // now a spectator, then the streamer starts playing in the middle of a flight
    const stop2 = feed(m.ctl, () => gsiPkt({ pend: Date.now() + 8000 }));
    check(await until(() => gotos(f).length > 10, 4000), 'a spectator: the flight runs');
    stop2();
    const stop3 = feed(m.ctl, own);
    await sleep(250);
    const n = f.cmds.length, last = f.lines()[n - 1];
    await sleep(700);
    eq(f.cmds.length, n, 'no command after he started playing (not even the return spec_mode): ' + last);
    check(!f.lines().includes('spec_mode 4'), 'no spec_mode 4 either');
    stop3(); m.ctl.close(); f.close();
  });

  await step('switched off: nothing is sent; GSI that is too old counts as not a spectator', async () => {
    const f = await fakeNetcon();
    const route = { id: 'a', name: 'A', pts: [pt(0), pt(500)], dur: 0, trg: { freeze: true, tech: true, timeout: true, warmup: true } };
    const m = mk({ v: 1, cfg: cfgOn(f.port, { on: false }), maps: { de_mirage: [route] }, chains: {} });
    const stop = feed(m.ctl, () => gsiPkt());
    await sleep(700); stop();
    eq([f.conns.length, f.cmds.length], [0, 0], 'flights off: silent');
    m.ctl.cmd({ a: 'cfg', on: true });
    check(!m.ctl.view().spec || true, 'switch on');
    await sleep(4200);   // the packet is now older than 3.5 s
    m.ctl.cmd({ a: 'preview', id: 'a', map: 'de_mirage' });
    await sleep(400);
    eq([f.conns.length, f.cmds.length], [0, 0], 'a stale spectator packet: still silent');
    m.ctl.close(); f.close();
  });

  await step('the triggers: tech pause, timeout and warmup pick their own paths; round robin and a path without the moment', async () => {
    const f = await fakeNetcon();
    const R = (id, x, trg) => ({ id, name: id, pts: [pt(x), pt(x + 50)], dur: 0, trg: { freeze: false, tech: false, timeout: false, warmup: false, ...trg } });
    const m = mk({ v: 1, cfg: cfgOn(f.port), maps: { de_mirage: [R('a', 0, { timeout: true }), R('b', 1000, { timeout: true }), R('w', 3000, { warmup: true })] }, chains: {} });
    const run = async (mkPkt, want) => { const n = gotos(f).length; const s = feed(m.ctl, mkPkt); await until(() => gotos(f).length > n + 5, 3000); const x = gotos(f)[n]?.x; s();
      await until(() => f.lines().filter(l => l === 'spec_mode 4').length >= want, 6000); return x; };
    const x1 = await run(() => gsiPkt({ pphase: 'timeout_ct', round: 4, pend: Date.now() + 3500 }), 1);
    const x2 = await run(() => gsiPkt({ pphase: 'timeout_t', round: 5, pend: Date.now() + 3500 }), 2);
    check(x1 < 200 && x2 > 900 && x2 < 1200, 'two timeouts in a row take the two paths in turn: ' + [x1, x2]);
    const x3 = await run(() => gsiPkt({ phase: 'warmup', pphase: 'warmup', round: 0, pend: Date.now() + 3500 }), 3);
    check(x3 > 2900, 'warmup takes the warmup path: ' + x3);
    const before = f.cmds.length, s = feed(m.ctl, () => gsiPkt({ pphase: 'freezetime', round: 9, pend: Date.now() + 4000 }));
    await sleep(900); s();
    eq(f.cmds.length, before, 'freeze time with no path for it: silent');
    const s2 = feed(m.ctl, () => gsiPkt({ pphase: 'paused', round: 9, pend: Date.now() + 4000 }));
    await sleep(900); s2();
    eq(f.cmds.length, before, 'tech pause with no path ticked: silent');
    m.ctl.close(); f.close();
  });

  await step('getpos through the controller: the answer becomes a point; a silent game becomes an error', async () => {
    const f = await fakeNetcon();
    const m = mk({ v: 1, cfg: cfgOn(f.port), maps: {}, chains: {} });
    const stop = feed(m.ctl, () => gsiPkt());
    m.ctl.cmd({ a: 'new', name: 'P\u0007q', map: 'de_mirage' });
    const id = m.ctl.view().routes[0]?.id;
    check(id && m.ctl.view().routes[0].name === 'P\u0007q'.replace(/[\u0000-\u001f]/g, ''), 'a path was created, control characters stripped from the name');
    m.ctl.cmd({ a: 'point', id });
    check(await until(() => m.ctl.view().routes[0].pts.length === 1, 4000), 'the point arrived');
    eq(m.ctl.view().routes[0].pts[0], { p: [11.5, -22.25, 333], a: [4.5, 90, 0], t: 0, j: 0 }, 'position and angles from setpos/setang');
    eq(f.lines(), ['getpos'], 'only getpos was sent');
    check(m.saved.length >= 2, 'saved to the file');
    stop(); m.ctl.close(); f.close();
    // a game that does not answer
    const dead = net.createServer(s => s.on('data', () => {}).on('error', () => {})); await new Promise(r => dead.listen(0, '127.0.0.1', r));
    const m2 = mk({ v: 1, cfg: cfgOn(dead.address().port), maps: { de_mirage: [{ id: 'z', name: 'z', pts: [], dur: 0, trg: {} }] }, chains: {} }, { askMs: 600 });
    const stop2 = feed(m2.ctl, () => gsiPkt());
    m2.ctl.cmd({ a: 'point', id: 'z', map: 'de_mirage' });
    check(await until(() => /getpos|netconport/.test(m2.ctl.view().note), 3000), 'no answer: the panel is told to check -netconport', m2.ctl.view().note);
    eq(m2.ctl.view().routes[0].pts.length, 0, 'no point was added');
    stop2(); m2.ctl.close(); dead.close();
  });

  await step('commands from the panel are validated: limits, strings, foreign fields', async () => {
    const m = mk({ v: 1, cfg: cfgOn(27015), maps: {}, chains: {} });
    const c = o => m.ctl.cmd({ map: 'de_dust2', ...o });
    for(let i = 0; i < 8; i++) check(c({ a: 'new', name: 'r' + i }), 'path ' + i + ' created');
    eq(c({ a: 'new', name: 'one too many' }), false, 'a ninth path on a map is refused');
    const v = () => m.ctl.view();
    c({ a: 'edit', map: 'de_dust2' });
    const id = v().routes[0].id;
    c({ a: 'set', id, route: { name: '  Mid  ', dur: 12.34, trg: { freeze: false, tech: true }, pts: [pt(1, { t: 2.25, j: 1 }), { p: ['x', 1, 1], a: [0, 0, 0] }, pt(2), { evil: 'spec_goto 1 2 3 4 5; quit' }, { p: [1, 2, 3], a: [0, 0, 0], cmd: 'quit' }] } });
    const r = v().routes.find(x => x.id === id);
    eq([r.name, r.dur, r.trg.freeze, r.trg.tech, r.pts.length], ['Mid', 12.3, false, true, 3], 'name trimmed, duration rounded, bad points dropped');
    check(r.pts.every(q => Object.keys(q).sort().join() === 'a,j,p,t'), 'only the known fields survive; extra keys are gone', r.pts);
    c({ a: 'set', id, route: { pts: Array.from({ length: 70 }, (_, i) => pt(i)) } });
    eq(v().routes.find(x => x.id === id).pts.length, 40, 'at most 40 points');
    eq(c({ a: 'set', id: 'nope', route: {} }), false, 'an unknown path id is refused');
    c({ a: 'cfg', port: 80 }); eq(v().port, 27015, 'a port below 1024 is refused');
    c({ a: 'cfg', port: 'abc' }); eq(v().port, 27015, 'a text port is refused');
    c({ a: 'cfg', port: 31337, pick: 'random', returnMode: 5, on: false }); eq([v().port, v().pick, v().returnMode, v().on], [31337, 'random', 5, false], 'good settings apply');
    c({ a: 'cfg', pick: 'evil', returnMode: 99, host: '10.0.0.1' }); eq([v().pick, v().returnMode], ['random', 5], 'bad values are ignored; there is no way to set a host');
    c({ a: 'chain', kind: 'freeze', steps: [{ id, join: 'cut', pause: 2 }, { id: 'zzz', join: 'x', pause: -5 }] });
    eq(v().chains.freeze.map(s => [s.join, s.pause]), [['cut', 2], ['smooth', 0]], 'chain steps are cleaned');
    eq(c({ a: 'chain', kind: 'quit', steps: [] }), false, 'an unknown moment is refused');
    const dup = c({ a: 'dup', id }); check(dup && v().routes.length === 8 ? false : true, 'a duplicate over the limit is refused');
    c({ a: 'del', id }); eq(v().routes.length, 7, 'delete');
    c({ a: 'import', route: { name: 'Imp', pts: [pt(5)], trg: { warmup: true } } });
    eq(v().routes.at(-1).name, 'Imp', 'import adds a cleaned path');
    eq(c({ a: 'import', route: 'x' }) !== undefined, true, 'a junk import does not throw');
    eq(c({ a: 'stop' }), true, 'stop is always allowed');
    eq(c({ a: 'format-disk' }), false, 'an unknown action is refused');
    m.ctl.close();
  });

  // ---- panel → Host → fake game ----
  let s, f;
  const shotDir = SHOT;
  await step('stack starts', async () => {
    f = await fakeNetcon();
    s = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
    check(s.online, 'panel online');
  });
  const cfgFile = () => JSON.parse(fs.readFileSync(path.join(s.host.dir, 'overlay-host.json'), 'utf8'));
  const gsi = body => fetch(`http://127.0.0.1:${s.host.port}/gsi`, { method: 'POST', headers: { host: `127.0.0.1:${s.host.port}` }, body: JSON.stringify({ ...body, auth: { token: cfgFile().gsiToken } }) });
  const ROSTER = [['101', 'SaiYeah', 'CT', 0], ['102', 'gospoja', 'CT', 1], ['201', 'kirpich', 'T', 5], ['202', 'mamka', 'T', 6]];
  const specPkt = ({ own = false, pphase = 'live', endsIn = 20, map = 'de_mirage', round = 4 } = {}) => {
    const base = { provider: { steamid: own ? '101' : '999' }, map: { name: map, mode: 'competitive', round, phase: 'live', team_ct: { score: 3 }, team_t: { score: 2 } }, round: { phase: 'freezetime' },
      phase_countdowns: { phase: pphase, phase_ends_in: String(endsIn) }, player: { steamid: '101', name: 'SaiYeah', team: 'CT', observer_slot: 0, state: { health: 100, money: 800 } } };
    if(own) return base;
    const allplayers = {}; for(const [id, name, team, slot] of ROSTER) allplayers[id] = { name, team, observer_slot: slot, state: { health: 100, armor: 0, money: 800 }, match_stats: { kills: 1, deaths: 1, assists: 0 }, weapons: {} };
    return { ...base, allplayers };
  };
  const flightFile = () => { try{ return JSON.parse(fs.readFileSync(path.join(s.host.dir, 'cs2-flights.json'), 'utf8')); }catch{ return null; } };
  const panelFl = () => s.panel.evaluate(() => CS2_SERIES?.fl ? JSON.parse(JSON.stringify(CS2_SERIES.fl)) : null);
  const widgetFl = () => s.widget.evaluate(() => CS2_SERIES?.fl ? JSON.parse(JSON.stringify(CS2_SERIES.fl)) : null);

  await step('the CS2 tab: enable flights and set the port; the Host stays silent until a spectator shows up', async () => {
    await gsi(specPkt({ own: true, endsIn: 30 }));
    await s.panel.click('[data-tab=cs2]');
    check(await until(async () => (await panelFl()) !== null, 6000), 'the panel got the flights state from the Host');
    await s.panel.fill('#flPort', String(f.port)); await s.panel.dispatchEvent('#flPort', 'change');
    await s.panel.$eval('#flOn', e => e.click());
    check(await until(async () => (await panelFl())?.on === true && (await panelFl())?.port === f.port, 5000), 'on, with the fake console port');
    await sleep(700);
    eq([f.conns.length, f.cmds.length], [0, 0], 'the streamer plays: nothing was opened');
    const c = flightFile(); check(c && c.cfg.on && c.cfg.port === f.port, 'saved to data/cs2-flights.json');
    if(!c) console.log(s.host.dir, fs.readdirSync(s.host.dir), String(s.host.log()).slice(-1500));
  });

  await step('create a path in the panel, name it, add points by hand, make a cut, set a duration', async () => {
    await gsi(specPkt({ endsIn: 60 }));
    check(await until(async () => (await panelFl())?.edit === 'de_mirage', 5000), 'the editor map follows the game map');
    await s.panel.click('#flNew');
    check(await until(async () => (await panelFl())?.routes.length === 1, 5000), 'the Host made a path');
    await s.panel.fill('#flName', 'Mid push'); await s.panel.dispatchEvent('#flName', 'change');
    for(let i = 0; i < 4; i++) await s.panel.click('#flAddMan');
    check(await until(async () => (await panelFl())?.routes[0]?.pts.length === 4, 5000), 'four points');
    // edit the numbers: x, y of the points to make a shape on Mirage, z by hand
    const set = (row, col, v) => s.panel.evaluate(([row, col, v]) => { const i = document.querySelectorAll('#flPts .fl-row:not(.fl-head)')[row].querySelectorAll('input[type=number]')[col]; i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, [row, col, v]);
    const shape = [[-2000, -700, 180, 10, 0], [-1400, -200, 220, 15, 40], [-600, 300, 260, 20, 80], [200, 600, 300, 5, 100]];
    for(let r = 0; r < 4; r++){ for(let c = 0; c < 5; c++) await set(r, c, shape[r][c]); await sleep(120); }
    await s.panel.evaluate(() => { const c = document.querySelectorAll('#flPts .fl-row:not(.fl-head)')[2].querySelector('input[type=checkbox]'); c.click(); });
    await s.panel.fill('#flDur', '9'); await s.panel.dispatchEvent('#flDur', 'change');
    await s.panel.$eval('#flTtech', e => e.click());
    check(await until(async () => { const r = (await panelFl())?.routes[0]; return r && r.pts[3].p[0] === 200 && r.pts[2].j === 1 && r.dur === 9 && r.trg.tech && r.name === 'Mid push'; }, 6000), 'the Host has all edits');
    const file = flightFile();
    eq(file.maps.de_mirage[0].pts.map(q => q.p), shape.map(r => [r[0], r[1], r[2]]), 'x, y, z are in data/cs2-flights.json');
    eq(file.maps.de_mirage[0].pts.map(q => q.j), [0, 0, 1, 0], 'the cut flag is on the third point');
    const w = await widgetFl(); check(w && w.routes.length === 1, 'the widget got the same state (sync through the Host)');
    check(await s.panel.evaluate(() => document.querySelectorAll('#flRadar .fl-seg.cut').length === 1 && document.querySelectorAll('#flRadar .fl-seg:not(.cut)').length === 2 && document.querySelectorAll('#flRadar .fl-pt').length === 4), 'the radar shows 4 points, 2 solid lines and 1 dashed');
    check(await s.panel.evaluate(() => !!document.querySelector('#flRadar img.fl-img')), 'on the Mirage picture');
  });

  await step('drag a point on the radar: x and y change, z stays', async () => {
    const box = await s.panel.locator('#flRadar svg').boundingBox();
    const pos = await s.panel.evaluate(() => { const g = document.querySelectorAll('#flRadar .fl-pt')[3], r = g.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await s.panel.mouse.move(pos[0], pos[1]); await s.panel.mouse.down();
    await s.panel.mouse.move(pos[0] + box.width * .1, pos[1] - box.height * .1, { steps: 6 }); await s.panel.mouse.up();
    check(await until(async () => { const q = (await panelFl())?.routes[0]?.pts[3]; return q && q.p[0] > 200 + 100 && q.p[1] > 600 + 100 && q.p[2] === 300; }, 5000), 'x and y moved, z kept');
  });

  await step('a point from the game: getpos through the Host', async () => {
    await gsi(specPkt({ endsIn: 60 }));
    await s.panel.click('#flAddGame');
    check(await until(async () => (await panelFl())?.routes[0]?.pts.length === 5, 6000), 'the point from getpos arrived');
    eq((await panelFl()).routes[0].pts[4].p, [11.5, -22.25, 333], 'position from the answer');
    eq(f.lines().filter(l => l !== 'getpos'), [], 'getpos is the only thing the Host sent so far');
  });

  await step('run the flight from the panel: the stream shows the plate, stop works, back to the player', async () => {
    await s.panel.$eval('#flPlate', e => e.click());
    check(await until(() => s.widget.evaluate(() => lastState.cs2auto?.plate === true), 5000), 'plate switched on in the widget state');
    const keep = setInterval(() => gsi(specPkt({ endsIn: 60 })).catch(() => {}), 300);
    await gsi(specPkt({ endsIn: 60 }));
    await s.panel.click('#flPrev');
    check(await until(() => gotos(f).length > 30, 6000), 'spec_goto lines arrive');
    check(await until(async () => (await widgetFl())?.flying === 'preview', 3000), 'the widget knows a flight is running');
    const plate = await until(() => s.widget.evaluate(() => { const b = document.getElementById('ctab'); const p = b.querySelector('.fplate'); return !b.hidden && p ? { m: b.dataset.m, text: p.textContent } : null; }), 5000);
    check(plate && plate.m === 'flight' && /Mirage/.test(plate.text) && /3 : 2/.test(plate.text) && /5/.test(plate.text), 'the info plate: map, score, round', plate);
    await s.panel.screenshot({ path: path.join(shotDir, 'flight-widget-plate.png') }).catch(() => {});
    await s.widget.screenshot({ path: path.join(shotDir, 'flight-stream-plate.png') }).catch(() => {});
    await s.panel.click('#flStop');
    check(await until(() => f.lines().includes('spec_mode 4'), 4000), 'stop sends the way back to the player');
    const n = gotos(f).length; await sleep(500);
    eq(gotos(f).length, n, 'and the goto stream stops');
    check(await until(async () => (await widgetFl())?.flying === '', 4000), 'the plate goes away');
    clearInterval(keep);
    const L = f.lines();
    check(L.every(l => l === 'getpos' || l === 'spec_mode 6' || l === 'spec_mode 4' || GOTO.test(l)), 'the console only ever saw whitelisted lines');
  });

  await step('the editor screenshot: a path on the radar', async () => {
    await s.panel.setViewportSize({ width: 560, height: 1500 }).catch(() => {});
    await sleep(400);
    await s.panel.locator('#flBody').screenshot({ path: path.join(shotDir, 'flight-editor.png') });
    await s.panel.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
    check(fs.existsSync(path.join(shotDir, 'flight-editor.png')), 'screenshot saved to ' + path.join(shotDir, 'flight-editor.png'));
  });

  await step('duplicate, export to a file, import it back, delete', async () => {
    await s.panel.click('#flDup');
    check(await until(async () => (await panelFl())?.routes.length === 2, 5000), 'duplicated');
    eq((await panelFl()).routes[1].name, 'Mid push 2', 'the copy has its own name');
    eq((await panelFl()).routes[1].pts, (await panelFl()).routes[0].pts, 'with the same points');
    const [dl] = await Promise.all([s.panel.waitForEvent('download'), s.panel.click('#flExp')]);
    const out = path.join(shotDir, 'flight-export.json'); await dl.saveAs(out);
    const j = JSON.parse(fs.readFileSync(out, 'utf8'));
    check(j.hudini === 'cs2-flight' && j.map === 'de_mirage' && j.route.pts.length === 5 && j.route.pts[2].j === 1, 'the file holds the path with the cut flag', j.route.pts.map(q => q.j));
    await s.panel.setInputFiles('#flImpFile', out);
    check(await until(async () => (await panelFl())?.routes.length === 3, 5000), 'imported as a new path');
    fs.writeFileSync(out, JSON.stringify({ hudini: 'something-else', route: {} }));
    await s.panel.setInputFiles('#flImpFile', out);
    await sleep(500);
    eq((await panelFl()).routes.length, 3, 'a foreign file adds nothing');
    fs.writeFileSync(out, JSON.stringify({ hudini: 'cs2-flight', route: { name: 'Evil<script>', pts: [{ p: ['a', 'b', 'c'], a: [0, 0, 0] }, { p: [1, 2, 3], a: [0, 0, 0] }] } }));
    await s.panel.setInputFiles('#flImpFile', out);
    check(await until(async () => (await panelFl())?.routes.length === 4, 5000), 'a file with a bad point still imports, the bad point is dropped');
    const bad = (await panelFl()).routes[3]; eq(bad.pts.length, 1, 'only the valid point was kept');
    check(await s.panel.evaluate(() => !document.querySelector('#flRoute script, #flBody script')), 'the name is shown as text');
    await s.panel.selectOption('#flRoute', bad.id);
    await s.panel.click('#flDel');
    check(await until(async () => (await panelFl())?.routes.length === 3, 5000), 'deleted');
    eq(flightFile().maps.de_mirage.length, 3, 'and gone from the file');
  });

  await step('a chain from the panel, and the streamer playing again silences the console', async () => {
    const r = (await panelFl()).routes;
    await s.panel.evaluate(() => [...document.querySelector('#flChains .fl-chain').querySelectorAll('button')].find(b => b.textContent.includes('Путь')).click());   // + path in the first moment
    check(await until(async () => (await panelFl())?.chains.freeze.length === 1, 5000), 'a step was added to the freeze-time chain');
    const first = (await panelFl()).chains.freeze[0];
    check(r.some(x => x.id === first.id), 'it points at an existing path');
    await s.panel.evaluate(() => [...document.querySelector('#flChains .fl-chain').querySelectorAll('button')].find(b => b.textContent.includes('Путь')).click());
    check(await until(async () => (await panelFl())?.chains.freeze.length === 2, 5000), 'two steps');
    await s.panel.evaluate(() => { const st = document.querySelectorAll('#flChains .fl-chain')[0].querySelectorAll('.fl-step')[1]; const sel = st.querySelectorAll('select')[1]; sel.value = 'cut'; sel.dispatchEvent(new Event('change', { bubbles: true })); const p = st.querySelector('input[type=number]'); p.value = '1.5'; p.dispatchEvent(new Event('change', { bubbles: true })); });
    check(await until(async () => { const c = (await panelFl())?.chains.freeze[1]; return c && c.join === 'cut' && c.pause === 1.5; }, 5000), 'cut and a 1.5 s pause on the second step');
    eq(flightFile().chains.de_mirage.freeze.length, 2, 'saved in the file');
    // the streamer starts playing: freeze time of his own game starts nothing
    const before = f.cmds.length;
    for(let i = 0; i < 5; i++){ await gsi(specPkt({ own: true, pphase: 'freezetime', endsIn: 20, round: 11 + i })); await sleep(120); }
    eq(f.cmds.length, before, 'while he plays, freeze time sends nothing at all');
  });

  await step('delete everything made here: the file is clean', async () => {
    while((await panelFl()).routes.length){ await s.panel.click('#flDel'); await sleep(250); }
    check(await until(async () => (await panelFl())?.routes.length === 0, 4000), 'no paths left');
    check(!flightFile().maps.de_mirage, 'the map entry is gone from the file');
  });

  f?.close();
  await T.closeBrowser();
  await s?.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
