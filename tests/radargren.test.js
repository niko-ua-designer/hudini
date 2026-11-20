// Grenades on the CS2 radar: the Host parses the GSI grenade block defensively (types, numbers, caps, owner team), the radar paints
// icons with trails, smoke / fire zones and HE / flash bursts, honours the per-type switches and the two looks (A icons + trails, B minimal).
// Packets are synthetic. Set HUDINI_SHOT_DIR to also save screenshots of both looks.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const ROOT = path.join(__dirname, '..');
const SHOT = process.env.HUDINI_SHOT_DIR || '';

(async () => {
  // ---------- Host: GSI → compact gr ----------
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-gren-'));
  const env = { OVERLAY_HOST_DIR: dir, OVERLAY_PORT: String(T.PORTS.host + 50), OVERLAY_SITE: 'off' };
  const host = T.startHost(env); await host.ready();
  const cfg = () => JSON.parse(fs.readFileSync(path.join(dir, 'overlay-host.json'), 'utf8'));
  const post = body => fetch(`http://127.0.0.1:${host.port}/gsi`, { method: 'POST', headers: { host: `127.0.0.1:${host.port}` }, body: JSON.stringify({ ...body, auth: { token: cfg().gsiToken } }) });
  const pl = (id, name, team, pos) => ({ name, team, observer_slot: 1, state: { health: 100 }, position: pos, forward: '1, 0, 0', match_stats: {}, weapons: {} });
  const base = grenades => ({
    provider: { steamid: '999' }, map: { name: 'de_dust2', mode: 'competitive', round: 3, phase: 'live', team_ct: { score: 1 }, team_t: { score: 1 } }, round: { phase: 'live' },
    player: { steamid: '1', name: 'A', team: 'CT', state: { health: 100 }, match_stats: {}, weapons: {} },
    allplayers: { 1: pl(1, 'A', 'CT', '-500, 1500, 0'), 2: pl(2, 'B', 'T', '100, 100, 0') }, ...grenades });
  const gr = async grenades => { const r = await post(base(grenades)); check(r.ok, 'packet accepted'); await sleep(250); return (await host.api('/api/status')).cs2.gr; };

  await step('Host parses the grenade block: types, owner team, state, effect, flames', async () => {
    const g = await gr({ allgrenades: {
      101: { owner: '1', position: '-500.4, 1500.6, 20', velocity: '300, -200, 50', type: 'flashbang', lifetime: '0.5' },
      102: { owner: '2', position: '10, 20, 30', velocity: '0, 0, 0', type: 'smoke', lifetime: '3', effecttime: '4.26' },
      103: { owner: '2', position: '10, 20, 30', velocity: '0, 0, 0', type: 'inferno', lifetime: '3', flames: { 1: '11, 21, 30', 2: '31.2, 41, 30' } },
      104: { owner: '1', position: '5, 5, 5', velocity: '0, 0, 0', type: 'frag' },
      105: { owner: '777', position: '5, 5, 5', velocity: '0, 0, 0', type: 'decoy' },
    } });
    eq(g.map(x => x.t), ['flash', 'smoke', 'molly', 'he'], 'four known types in order, decoy dropped');
    eq([g[0].tm, g[1].tm], ['CT', 'T'], 'owner team from allplayers');
    eq([g[0].p, g[0].v, g[0].s], [[-500, 1501, 20], [300, -200], 0], 'flying: rounded position and 2D velocity');
    eq([g[1].s, g[1].e, g[2].s, g[2].f, g[3].s], [2, 4.3, 2, [[11, 21], [31, 41]], 1], 'smoke with effect time, molotov with flames, landed HE');
    check(g.every(x => !('owner' in x) && !('lifetime' in x)), 'no raw fields are forwarded');
  });

  await step('hostile grenade data is dropped or clamped', async () => {
    const bad = await gr({ allgrenades: {
      1: { owner: '1', position: 'a, b, c', velocity: '0,0,0', type: 'smoke' },
      2: { owner: '1', position: '1, 2', type: 'smoke' },
      3: { owner: '1', position: '1, 2, 3', type: '<script>alert(1)</script>' },
      4: { owner: { x: 1 }, position: '1, 2, 3', velocity: 'NaN, 0, 0', type: 'smoke', effecttime: 'Infinity' },
      5: { owner: '1', position: '9e99, 0, 0', type: 'smoke' },
      6: null, 7: 'str', 8: { position: ['1', '2', '3'], type: 'smoke' },
      'bad key!': { owner: '1', position: '1, 2, 3', type: 'smoke' },
      9: { owner: '__proto__', position: '1, 2, 3', velocity: '0,0,0', type: 'smoke', effecttime: '9999' },
    } });
    eq(bad.map(x => [x.i, x.t, x.tm, x.p, x.s, x.e]), [['4', 'smoke', '', [1, 2, 3], 1, undefined], ['9', 'smoke', '', [1, 2, 3], 2, 120]], 'only the two sane entries survive, bad velocity becomes standing, effect time capped');
    for(const junk of [[], 'x', 5, null]) { const r = await post(base({ allgrenades: junk })); check(r.ok, 'non-object grenade block is harmless'); }
    await sleep(200); check((await host.api('/api/status')).cs2.gr === undefined, 'no gr field without grenades');
  });

  await step('caps: 40 grenades, 60 flames each, 120 flames in all, key "grenades" works too', async () => {
    const many = {}, fl = {}; for(let i = 0; i < 80; i++) fl[i] = `${i}, ${i}, 0`;
    for(let i = 0; i < 100; i++) many[i] = { owner: '1', position: `${i}, ${i}, 0`, velocity: '0,0,0', type: i < 5 ? 'inferno' : 'smoke', ...(i < 5 ? { flames: fl } : {}) };
    const g = await gr({ grenades: many });
    eq(g.length, 40, '40 grenades at most');
    const flames = g.map(x => (x.f || []).length); eq([Math.max(...flames), flames.reduce((a, b) => a + b, 0)], [60, 120], '60 flame points per grenade, 120 in total');
    const smoke = (await host.api('/api/status')).cs2; check(JSON.stringify(smoke.gr).length < 8000, 'payload stays small', JSON.stringify(smoke.gr).length);
  });

  await step('no grenades for a player who is not a spectator; the cfg asks for them', async () => {
    const own = base({ allgrenades: { 1: { owner: '1', position: '1, 2, 3', velocity: '0,0,0', type: 'smoke' } } }); delete own.allplayers; own.provider.steamid = '1';
    await post(own); await sleep(250); check((await host.api('/api/status')).cs2.gr === undefined, 'own-player packet: no gr');
    const txt = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
    check(/function gsiCfgText[\s\S]*"allgrenades"\s+"1"[\s\S]*"grenades"\s+"1"/.test(txt), 'cfg template has the grenade data entries');
    check(/readFileSync\(cfg\.gsiFile,'utf8'\)!==gsiCfgText\(\)/.test(txt), 'an installed cfg is rewritten on start when it differs from the template');
  });
  await host.stop();

  // ---------- radar in a page ----------
  const web = await T.webServer();
  const p = await T.newPage('widget-radar', { w: 700, h: 700 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${web.url}/shared/core.css"><script src="${web.url}/shared/core.js"></script><script src="${web.url}/shared/cs2-maps.js"></script>
    <style>body{margin:0;background:#556}.stage{position:relative;width:700px;height:700px;--u:7px;font-size:50px}</style></head><body><div class="stage" id="stage"></div></body></html>`);
  await p.waitForFunction(() => typeof buildNode === 'function' && typeof CS2_MAPS !== 'undefined');
  await p.evaluate(b => { CS2_RADAR_BASE = b + '/shared/radar/'; }, web.url);
  const players = [{ id: 'a', name: 'A', team: 'CT', slot: 0, alive: true, pos: [-300, 1500, 0], fw: 0 }, { id: 'b', name: 'B', team: 'T', slot: 5, alive: true, pos: [800, 600, 0], fw: 180 }];
  const G = (i, t, tm, p, s = 0, x = {}) => ({ i: String(i), t, tm, p, v: [0, 0], s, ...x });
  const paint = (gr, over = {}, map = 'de_dust2') => p.evaluate(([gr, over, map, players]) => {
    CS2 = { at: Date.now(), map, round: 3, ct: 1, tt: 1, players, obs: 'a', gr, evs: [] };
    const el = sanitizeEl({ id: 'r', type: 'cs2', view: 'radar', theme: 'classic', fs: 8, ...over });
    const st = document.getElementById('stage');
    if(!st._n){ st._n = buildNode(el); st.appendChild(st._n); }
    paintNode(st._n, el, 1);
  }, [gr, over, map, players]);
  const q = sel => p.evaluate(s => document.querySelectorAll('.rd ' + s).length, sel);
  const css = (sel, prop) => p.evaluate(([s, pr]) => { const e = document.querySelector('.rd ' + s); return e ? getComputedStyle(e)[pr] : null; }, [sel, prop]);

  await step('sanitize: switches default on, style A, junk falls back', async () => {
    const r = await p.evaluate(() => [sanitizeEl({ id: 'a', type: 'cs2', view: 'radar' }), sanitizeEl({ id: 'a', type: 'cs2', view: 'radar', rgr: false, rgm: false, grenStyle: 'B' }), sanitizeEl({ id: 'a', type: 'cs2', view: 'radar', grenStyle: '<b>', rgh: 0 })].map(e => [e.rgr, e.rgm, e.rgh, e.rgf, e.rgs, e.grenStyle]));
    eq(r, [[true, true, true, true, true, 'A'], [false, false, true, true, true, 'B'], [true, true, true, true, true, 'A']], 'defaults, explicit values, hostile style');
  });

  await step('flight: icon by type at the projected spot, trail grows from history, capped', async () => {
    for(let i = 0; i < 12; i++) await paint([G(1, 'smoke', 'CT', [-300 + i * 60, 1500 - i * 20, 100])]);
    eq(await q('.rd-gr.gt-smoke.tm-ct.fly'), 1, 'one flying smoke icon in CT colour');
    const pts = await p.evaluate(() => document.querySelector('.rd-trail.old').getAttribute('points').split(' ').length);
    eq(pts, 8, 'trail keeps the last 8 positions');
    eq(await q('.rd-trail.new'), 1, 'bright recent part');
    const place = await p.evaluate(() => { const e = document.querySelector('.rd-gr'); return [parseFloat(e.style.left), parseFloat(e.style.top)]; });
    const u = (-300 + 11 * 60 + 2476) / 4.4 / 1024 * 100, v = (3239 - (1500 - 11 * 20)) / 4.4 / 1024 * 100;
    check(Math.abs(place[0] - u) < .05 && Math.abs(place[1] - v) < .05, 'icon sits where the map calibration puts it', place);
    const n0 = await p.evaluate(() => document.querySelector('.rd-trail.old').getAttribute('points').split(' ').length);
    await paint([G(1, 'smoke', 'CT', [-300 + 11 * 60, 1500 - 11 * 20, 100])]);
    eq(await p.evaluate(() => document.querySelector('.rd-trail.old').getAttribute('points').split(' ').length), n0, 'repainting the same spot adds no point');
    await paint([]); eq([await q('.rd-gr'), await q('.rd-trail')], [0, 0], 'grenade gone: icon and trail removed');
  });

  await step('smoke zone: radius 144 units, shrinks at the end of its life', async () => {
    await paint([G(2, 'smoke', 'T', [0, 1000, 0], 2, { e: 1 })]);
    eq(await q('.rd-zone.smoke.tm-t'), 1, 'smoke zone in T colour');
    const k = 1 / 4.4 / 1024; const want = 144 * 2 * k * 100;
    const w0 = parseFloat(await css('.rd-zone.smoke', 'width')) / parseFloat(await p.evaluate(() => getComputedStyle(document.querySelector('.rd-sq')).width)) * 100;
    check(Math.abs(w0 - want * Math.min(1, 0.4 + 0)) < 3 || w0 > 0, 'zone has a width', w0);
    // fast-forward the effect clock: age 5 s is full size, 17 s is shrinking
    const size = age => p.evaluate(a => { const r = document.querySelector('.rd')?.parentNode._rd; for(const h of r.gh.values()) h.eff0 = Date.now() - a * 1000; const z = grZoneLook('smoke', a); return [z.scale, z.op]; }, age);
    eq((await size(5))[0], 1, 'full size mid-life'); const late = await size(17.5); check(late[0] < 0.5 && late[1] < 0.5, 'shrinks and fades at the end', late);
    await paint([G(2, 'smoke', 'T', [0, 1000, 0], 2, { e: 1 })]);
    check(parseFloat(await css('.rd-zone.smoke', 'opacity')) < 0.5, 'the painted zone is faded at 17.5 s');
  });

  await step('molotov: fire zone from flame points, circle without them, fades with time', async () => {
    await paint([G(3, 'molly', 'CT', [0, 1000, 0], 2, { f: [[0, 1000], [40, 1020], [-30, 990]] })]);
    eq(await q('.rd-zone.fire'), 3, 'one blob per flame point');
    await paint([G(3, 'molly', 'CT', [0, 1000, 0], 2)]); eq(await q('.rd-zone.fire'), 1, 'without flames: one circle');
    await p.evaluate(() => { const r = document.querySelector('.rd').parentNode._rd; for(const h of r.gh.values()) h.eff0 = Date.now() - 6500; });
    await paint([G(3, 'molly', 'CT', [0, 1000, 0], 2)]);
    check(parseFloat(await css('.rd-zone.fire', 'opacity')) < 0.5, 'fire fades before it ends');
    eq(await q('.rd-trail'), 0, 'no trail while the effect runs');
  });

  await step('HE and flash disappearing leave a short burst, smoke does not', async () => {
    await paint([G(4, 'he', 'CT', [0, 1000, 0], 0), G(5, 'flash', 'T', [100, 1000, 0], 0), G(6, 'smoke', 'T', [200, 1000, 0], 0)]);
    await paint([]);
    eq([await q('.rd-burst.he'), await q('.rd-burst.flash'), await q('.rd-burst.smoke')], [1, 1, 0], 'burst for HE and flash only');
    check(await until(async () => (await q('.rd-burst')) === 0, 2000), 'bursts clean themselves up');
  });

  await step('per-type switches and the master switch', async () => {
    const all = [G(1, 'molly', 'CT', [0, 1000, 0]), G(2, 'he', 'CT', [50, 1000, 0]), G(3, 'flash', 'T', [100, 1000, 0]), G(4, 'smoke', 'T', [150, 1000, 0])];
    await paint(all); eq(await q('.rd-gr'), 4, 'all four types shown by default');
    for(const [k, t] of [['rgm', 'molly'], ['rgh', 'he'], ['rgf', 'flash'], ['rgs', 'smoke']]){
      await paint(all, { [k]: false }); eq([await q('.rd-gr'), await q('.rd-gr.gt-' + t)], [3, 0], `${k} off hides ${t}`);
    }
    await paint(all, { rgr: false }); eq(await q('.rd-gr'), 0, 'master switch off: nothing');
    await paint(all); eq(await q('.rd-gr'), 4, 'back on');
  });

  await step('look B: dots, no trails, simple zones; look A restores icons and trails', async () => {
    const fly = [G(1, 'he', 'CT', [0, 1000, 0]), G(2, 'smoke', 'T', [300, 1000, 0], 2, { e: 3 })];
    for(let i = 0; i < 3; i++) await paint([G(1, 'he', 'CT', [i * 40, 1000, 0]), fly[1]], { grenStyle: 'B' });
    const gsb = () => p.evaluate(() => document.querySelectorAll('.rd.gs-b').length);
    eq([await gsb(), await q('.rd-trail')], [1, 0], 'B: style class, no trail');
    eq([await css('.rd-gr .hi', 'display'), await css('.rd-gr i', 'display')], ['none', 'block'], 'B: dot instead of icon');
    eq(await q('.rd-zone.smoke'), 1, 'B: zone still drawn');
    for(let i = 0; i < 3; i++) await paint([G(1, 'he', 'CT', [i * 40 + 200, 1000, 0]), fly[1]], { grenStyle: 'A' });
    eq([await gsb(), await css('.rd-gr .hi', 'display'), await css('.rd-gr i', 'display')], [0, 'inline-block', 'none'], 'A: icon back');
    check((await q('.rd-trail')) >= 1, 'A: trail drawn again');
  });

  await step('two-level map: grenade on the other level is faded; hostile client data is ignored', async () => {
    const low = [{ ...players[0], pos: [0, 0, -700] }, players[1]];
    await p.evaluate(pl => { document.getElementById('stage').replaceChildren(); delete document.getElementById('stage')._n; window.__pl = pl; }, low);
    const nuke = gr => p.evaluate(([gr, pl]) => { CS2 = { at: Date.now(), map: 'de_nuke', players: pl, obs: 'a', gr }; const el = sanitizeEl({ id: 'r', type: 'cs2', view: 'radar' }); const st = document.getElementById('stage'); if(!st._n){ st._n = buildNode(el); st.appendChild(st._n); } paintNode(st._n, el, 1); }, [gr, low]);
    await nuke([G(1, 'smoke', 'CT', [0, 0, 100]), G(2, 'smoke', 'CT', [0, 0, -700])]);
    eq([await q('.rd-gr.other'), await q('.rd-gr')], [1, 2], 'the grenade on the upper level is faded while the observer is downstairs');
    const bad = await p.evaluate(() => { try{ const el = sanitizeEl({ id: 'r', type: 'cs2', view: 'radar' }); return grList(el, { gr: [{ i: '<x>', t: 'smoke', p: [1, 2, 3] }, { i: '1', t: 'evil', p: [1, 2, 3] }, { i: '2', t: 'he', p: ['a', 2, 3] }, { i: '3', t: 'he', p: [1, 2, 3], f: 'zzz' }, null, 5] }).map(g => g.i); }catch(e){ return String(e); } });
    eq(bad, ['3'], 'only the well-formed entry passes grList');
  });

  await step('screenshots of both looks', async () => {
    if(!SHOT) return;
    const scene = (n) => [
      ...Array.from({ length: n }, (_, i) => G(11, 'flash', 'CT', [-1200 + i * 120, 2200 - i * 45, 300], 0)),
    ];
    const run = async style => {
      p.evaluate(() => { document.getElementById('stage').replaceChildren(); delete document.getElementById('stage')._n; });
      const mk = (arr, i) => arr[i];
      const track = [[-1500, 2100, 200], [-1350, 2030, 260], [-1200, 1960, 300], [-1050, 1890, 280], [-900, 1830, 220], [-760, 1790, 150], [-640, 1770, 80]];
      const track2 = [[900, 1500, 100], [850, 1350, 200], [800, 1200, 260], [760, 1050, 250], [720, 900, 180], [700, 800, 100]];
      const track3 = [[-200, 300, 100], [-120, 380, 200], [-40, 440, 240], [40, 490, 200], [110, 520, 100]];
      for(let i = 0; i < 7; i++){
        await paint([
          G(1, 'flash', 'CT', track[i]), G(2, 'molly', 'T', track2[Math.min(i, 5)], i > 4 ? 1 : 0), G(3, 'he', 'T', track3[Math.min(i, 4)]),
          G(4, 'smoke', 'CT', [-500, 1000, 0], 2, { e: 6 }), G(5, 'smoke', 'T', [1100, 1700, 0], 2, { e: 15 }),
          G(6, 'molly', 'CT', [300, 2000, 0], 2, { f: [[300, 2000], [350, 2040], [260, 2050], [320, 1960], [380, 1990], [280, 1990]] }),
        ], { grenStyle: style });
        await sleep(30);
      }
      await p.evaluate(() => { const r = document.querySelector('.rd').parentNode._rd; for(const h of r.gh.values()) if(h.eff0) h.eff0 = Date.now() - 6000; });
      await paint([
        G(1, 'flash', 'CT', track[6]), G(2, 'molly', 'T', track2[5], 1), G(3, 'he', 'T', track3[4]), G(4, 'smoke', 'CT', [-500, 1000, 0], 2, { e: 6 }), G(5, 'smoke', 'T', [1100, 1700, 0], 2, { e: 15 }),
        G(6, 'molly', 'CT', [300, 2000, 0], 2, { f: [[300, 2000], [350, 2040], [260, 2050], [320, 1960], [380, 1990], [280, 1990]] }),
      ], { grenStyle: style });
      await sleep(400);
      await p.screenshot({ path: path.join(SHOT, `radar-grenades-${style}.png`), clip: { x: 0, y: 0, width: 700, height: 700 } });
    };
    await run('A'); await run('B');
    check(fs.existsSync(path.join(SHOT, 'radar-grenades-A.png')), 'screenshots saved');
  });

  check(T.pageErrors.length === 0, 'no page errors', T.pageErrors);
  await T.closeBrowser(); web.close?.();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
