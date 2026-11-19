// CS2 match stats on the Host: ADR and HS% from per-round maxima, persistence across a restart, reset on a new map or match.
// No browser: packets go straight to /gsi and the result is read from /api/status.
// Fight hint: allplayers packets with damage between teams give "slot name ↔ slot name" in /api/status for the dock.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hudini-stats-'));
  const env = { OVERLAY_HOST_DIR: dir, OVERLAY_PORT: String(T.PORTS.host + 40), OVERLAY_SITE: 'off' };
  let host = T.startHost(env); await host.ready();
  const cfg = () => JSON.parse(fs.readFileSync(path.join(dir, 'overlay-host.json'), 'utf8'));
  const gsi = body => fetch(`http://127.0.0.1:${host.port}/gsi`, { method: 'POST', headers: { host: `127.0.0.1:${host.port}` }, body: JSON.stringify({ ...body, auth: { token: cfg().gsiToken } }) });
  // One packet about our own player
  const pkt = ({ round, phase = 'live', score = [0, 0], dmg = 0, kills = 0, hs = 0, hp = 100, map = 'de_dust2', mphase = 'live' }) => ({
    provider: { steamid: '111' },
    map: { name: map, mode: 'competitive', round, phase: mphase, team_ct: { score: score[0] }, team_t: { score: score[1] } },
    round: { phase },
    player: { steamid: '111', name: 'me', team: 'CT', state: { health: hp, armor: 0, money: 800, round_kills: kills, round_killhs: hs, round_totaldmg: dmg }, match_stats: { kills: 0, deaths: 0, assists: 0 } },
  });
  const read = async () => { const c = (await host.api('/api/status')).cs2; return [c.adr, c.hsp]; };
  const send = async p => { const r = await gsi(p); check(r.ok, 'packet accepted'); };
  const statsFile = () => { try{ return JSON.parse(fs.readFileSync(path.join(dir, 'cs2-stats.json'), 'utf8')); }catch{ return null; } };

  await step('warmup damage is ignored', async () => {
    await send(pkt({ round: 0, dmg: 500, kills: 4, hs: 4, mphase: 'warmup' }));
    eq(await read(), [0, 0], 'no stats from warmup');
  });

  await step('ADR and HS% from per-round maxima, a death mid-round keeps the last known damage', async () => {
    // round 0: damage and kills grow, then the round ends
    await send(pkt({ round: 0, dmg: 40, kills: 1 }));
    await send(pkt({ round: 0, dmg: 80, kills: 2, hs: 1 }));
    await send(pkt({ round: 0, phase: 'over', score: [1, 0], dmg: 80, kills: 2, hs: 1 }));
    eq(await read(), [80, 50], 'after round 0: ADR 80, HS 1 of 2 kills');
    // round 1: died with 60 damage and 1 kill, the counters read 0 in the packets after death
    await send(pkt({ round: 1, score: [1, 0], dmg: 0 }));
    await send(pkt({ round: 1, score: [1, 0], dmg: 60, kills: 1 }));
    await send(pkt({ round: 1, score: [1, 0], dmg: 0, kills: 0, hp: 0 }));
    eq((await read())[0], 80, 'the round in progress does not count into ADR yet');
    await send(pkt({ round: 1, phase: 'over', score: [1, 1], dmg: 0, kills: 0, hp: 0 }));
    eq(await read(), [70, 33], 'after round 1: (80 + 60) / 2 = 70, HS 1 of 3 = 33%');
    // round 2 live with a lot of damage: still not counted
    await send(pkt({ round: 2, score: [1, 1], dmg: 100 }));
    eq((await read())[0], 70, 'live round 2 is not in ADR');
    await send(pkt({ round: 2, phase: 'over', score: [2, 1], dmg: 100 }));
    eq((await read())[0], 80, 'after round 2: (80 + 60 + 100) / 3 = 80');
  });

  await step('stats are saved to data/cs2-stats.json', async () => {
    const f = statsFile();
    check(f && f.v === 1 && f.key === 'de_dust2|competitive', 'file with the map key');
    eq(f.stats['111'].dmg, { 0: 80, 1: 60, 2: 100 }, 'damage by round');
    eq(f.stats['111'].k, { 0: 2, 1: 1 }, 'kills by round');
  });

  await step('restart in the middle of a match keeps ADR and HS%', async () => {
    await host.stop();
    host = T.startHost(env); await host.ready();
    await send(pkt({ round: 3, score: [2, 1], dmg: 0 }));
    eq(await read(), [80, 33], 'same numbers after the restart');
    await send(pkt({ round: 3, score: [2, 1], dmg: 50, kills: 1, hs: 1 }));
    await send(pkt({ round: 3, phase: 'over', score: [3, 1], dmg: 50, kills: 1, hs: 1 }));
    eq(await read(), [73, 50], 'and it goes on: (240 + 50) / 4 = 73, HS 2 of 4');
  });

  await step('a new map resets, and so does a new match on the same map', async () => {
    await send(pkt({ round: 0, map: 'de_inferno', dmg: 30 }));
    eq(await read(), [0, 0], 'new map starts from zero');
    await send(pkt({ round: 0, phase: 'over', map: 'de_inferno', score: [1, 0], dmg: 90, kills: 1, hs: 1 }));
    await send(pkt({ round: 1, map: 'de_inferno', score: [1, 0], dmg: 20 }));
    await send(pkt({ round: 0, map: 'de_inferno', dmg: 10 }));
    eq(await read(), [0, 0], 'round counter went back: a new match, stats are cleared');
  });

  // ---- fight hint ----
  // allplayers packet as a spectator sees it: players by steamid, observer_slot is the observer key
  const ROSTER = [['101', 'SaiYeah', 'CT', 2], ['102', 'ct2', 'CT', 0], ['201', 'gospoja', 'T', 6], ['202', 't2', 'T', 9]];
  const spec = (over = {}, round = 5) => {
    const allplayers = {};
    for(const [id, name, team, slot] of ROSTER){
      const o = over[id] || {};
      allplayers[id] = { name, team, observer_slot: slot, state: { health: o.hp ?? 100, armor: 100, money: 1000, round_kills: 0 },
        match_stats: { kills: o.k ?? 0, deaths: 0, assists: 0 }, weapons: { weapon_0: { name: 'weapon_ak47', type: 'Rifle', state: 'active', ammo_clip: o.ammo ?? 30, ammo_clip_max: 30, ammo_reserve: 90 } } };
    }
    return { provider: { steamid: '999' }, map: { name: 'de_mirage', mode: 'competitive', round, phase: 'live', team_ct: { score: 0 }, team_t: { score: 0 } },
      round: { phase: 'live' }, player: { steamid: '101', name: 'SaiYeah', team: 'CT', observer_slot: 2, state: { health: 100 } }, allplayers };
  };
  // the dock reads /api/status without logging in (localhost, as the widget's origin)
  const dockStatus = async () => (await fetch(`http://localhost:${host.port}/api/status`, { headers: { host: `localhost:${host.port}` } })).json();
  const fightOf = async () => (await dockStatus()).fight;

  await step('fight helpers: slotKey and detectFight are exported', async () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
    check(/^export \{[^}]*\bdetectFight\b[^}]*\bslotKey\b[^}]*\};/m.test(src), 'export line in server.js');
    const a = src.indexOf('const FIGHT_WIN'), b = src.indexOf('\nlet fightPrev');
    const vm = require('vm'), ctx = {}; vm.createContext(ctx);
    vm.runInContext(src.slice(a, b) + '\nthis.detectFight = detectFight; this.slotKey = slotKey;', ctx);
    eq([0, 4, 8, 9, 10, null, undefined, -1, 2.5].map(ctx.slotKey), [1, 5, 9, 0, null, null, null, null, null], 'observer_slot 0..9 → observer key 1 2 .. 9 0');
    const P = (id, team, hp, ammo, slot) => ({ id, name: 'n' + id, team, hp, ammo, weapon: 'weapon_ak47', slot });   // slot = raw observer_slot 0..9
    const prev = { a: P('a', 'CT', 100, 30, 1), b: P('b', 'T', 100, 30, 6) };
    let r = ctx.detectFight(prev, [P('a', 'CT', 100, 27, 1), P('b', 'T', 73, 30, 6)], [], 1000, null);
    eq(r.fight && [r.fight.a.slot, r.fight.a.name, r.fight.b.slot, r.fight.b.name], [2, 'na', 7, 'nb'], 'CT shoots, T loses HP: CT left, T right');
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 27, 1), P('b', 'T', 100, 25, 6)], [], 1000, null);
    eq(r.fight, null, 'shots without damage are not a fight');
    r = ctx.detectFight({ a: prev.a, c: P('c', 'CT', 100, 30, 2) }, [P('a', 'CT', 60, 30, 1), P('c', 'CT', 100, 20, 2)], [], 1000, null);
    eq(r.fight, null, 'damage inside one team is not a fight');
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 30, 1), P('b', 'T', 100, 30, 6)], [], 4000, { hurt: { b: 1000 }, act: { a: 1000, b: 1000 } });
    eq(r.fight, null, 'activity older than 2 s is forgotten');
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 30, 1), P('b', 'T', 0, 30, 6)], [{ k: 'frag', t: 1000, kid: 'a', vid: 'b' }], 1200, null);
    eq(r.fight && r.fight.key, 'a|b', 'a frag counts too');
  });

  await step('fight hint: damage between teams shows both slots and nicks in the dock status', async () => {
    await send(spec());
    eq(await fightOf(), null, 'first packet: nothing to compare yet');
    await send(spec({ 101: { ammo: 26 }, 201: { hp: 73 } }));
    const f = await fightOf();
    check(f && f.ttl > 3000 && f.ttl <= 4000, 'hint lives up to 4 s');
    eq(f && [f.a.slot, f.a.name, f.a.team, f.b.slot, f.b.name, f.b.team], [3, 'SaiYeah', 'CT', 7, 'gospoja', 'T'], 'SaiYeah (3) vs gospoja (7)');
    const st = await host.api('/api/status');
    check(st.fight && st.fight.b.name === 'gospoja', 'the management page sees it too');
  });

  await step('fight hint goes away 4 s after the last damage', async () => {
    await sleep(2200);
    check((await fightOf()) !== null, 'still there after 2 s');
    check(await until(async () => (await fightOf()) === null, 4000), 'gone after 4 s');
  });

  await step('one team or no damage gives no hint', async () => {
    await send(spec({}, 6));
    await send(spec({ 101: { hp: 50, ammo: 25 }, 102: { ammo: 20 } }, 6));
    eq(await fightOf(), null, 'CT hurt, only CT shooting');
    await sleep(2100);   // the CT damage leaves the 2 s window
    await send(spec({ 101: { hp: 50, ammo: 10 }, 102: { ammo: 15 }, 201: { ammo: 12 }, 202: { ammo: 5 } }, 6));
    eq(await fightOf(), null, 'both teams shooting, nobody hurt');
  });

  await step('only the panel subscribes to cs2fight, the widget does not', async () => {
    const root = path.join(__dirname, '..', 'web');
    const widget = fs.readFileSync(path.join(root, 'widget', 'widget.html'), 'utf8'), panel = fs.readFileSync(path.join(root, 'panel', 'moderator.js'), 'utf8');
    check(!/cs2fight/.test(widget), 'widget.html never mentions cs2fight');
    check(/mainTopics = \(\) => \[[^\]]*'\/cs2fight'/.test(panel), 'panel subscribes to cs2fight');
    const srv = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
    check(/topic:T\('cs2fight'\).*retain:false/.test(srv), 'published without retain');
    check(!/PUB_(MOD|LOCAL) = new Set\([^)]*cs2fight/.test(srv), 'clients cannot publish it');
  });

  await host.stop();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
