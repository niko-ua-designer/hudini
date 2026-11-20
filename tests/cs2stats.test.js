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
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 27, 1), P('b', 'T', 100, 30, 6)], [], 1000, null);
    eq(r.fight, null, 'a shot with nobody else active and no positions is not a fight');
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 27, 1), P('b', 'T', 100, 25, 6)], [], 1000, null);
    eq(r.fight && r.fight.key, 'a|b', 'both teams shooting (no positions): the fight shows before any damage');
    r = ctx.detectFight({ a: prev.a, c: P('c', 'CT', 100, 30, 2) }, [P('a', 'CT', 60, 30, 1), P('c', 'CT', 100, 20, 2)], [], 1000, null);
    eq(r.fight, null, 'damage inside one team is not a fight');
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 30, 1), P('b', 'T', 100, 30, 6)], [], 4000, { hurt: { b: 1000 }, act: { a: 1000, b: 1000 } });
    eq(r.fight, null, 'activity older than 2 s is forgotten');
    r = ctx.detectFight(prev, [P('a', 'CT', 100, 30, 1), P('b', 'T', 0, 30, 6)], [{ k: 'frag', t: 1000, kid: 'a', vid: 'b' }], 1200, null);
    eq(r.fight && r.fight.key, 'a|b', 'a frag counts too');
    r = ctx.detectFight(prev, [P('x', 'CT', 100, 30, 1), P('y', 'T', 100, 30, 6)], [], 1500, { hurt: { gone: 1000 }, act: { y: 1000 } });
    eq(r.fight, null, 'a player hurt in the previous packet who is gone now does not break the next packet');
  });

  // positions: x, y, forward angle in degrees (0 = +x). Fight candidates by the packet alone, no timers
  await step('fight by shots and by aim: early, before any damage', async () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
    const a = src.indexOf('const FIGHT_WIN'), b = src.indexOf('\nlet fightPrev');
    const vm = require('vm'), ctx = {}; vm.createContext(ctx);
    vm.runInContext(src.slice(a, b) + '\nthis.detectFight = detectFight;', ctx);
    // x, y, fw; ammo falls for the ids in `shot`
    const G = (list, shot = []) => list.map(([id, team, x, y, fw, hp = 100]) => ({ id, name: 'n' + id, team, hp, alive: hp > 0, slot: 0, weapon: 'weapon_ak47', ammo: shot.includes(id) ? 20 : 30, pos: [x, y, 0], fw }));
    const idle = l => Object.fromEntries(G(l).map(p => [p.id, p]));
    const fight = (list, shot, prevList, now = 1000, cur) => ctx.detectFight(idle(prevList || list), G(list, shot), [], now, null, cur).fight;
    // CT a looks along +x at T b 800 units away; T c is behind a
    const L = [['a', 'CT', 0, 0, 0], ['b', 'T', 800, 0, 180], ['c', 'T', -3000, 0, 0], ['d', 'CT', 100, 900, 0]];
    let f = fight(L, ['a']);
    eq(f && f.key, 'a|b', 'a shot at an enemy in view: the fight is there in the same packet, no damage yet');
    f = fight([['a', 'CT', 0, 0, 0], ['b', 'T', 800, 0, 90], ['c', 'T', 0, 700, 0]], ['a']);
    eq(f && f.key, 'a|b', 'the enemy in the cone wins over a nearer one at the side');
    f = fight([['a', 'CT', 0, 0, 0], ['b', 'T', 6000, 0, 180]], ['a']);
    eq(f, null, 'a far enemy gives no fight (looking at it or not)');
    f = fight([['a', 'CT', 0, 0, 0], ['d', 'CT', 400, 0, 0], ['b', 'T', 6000, 0, 0]], ['a']);
    eq(f, null, 'an ally in view gives no fight');
    f = fight([['a', 'CT', 0, 0, 0], ['b', 'T', 5000, 0, 180]], ['b']);
    eq(f, null, 'a far shooter and a far enemy: nothing');
    f = fight([['a', 'CT', 0, 0, 90], ['b', 'T', 600, 0, 0]], ['a']);
    eq(f && f.key, 'a|b', 'a close enemy outside the cone still counts (turn and shoot)');
    f = fight([['a', 'CT', 0, 0, 0, 0], ['b', 'T', 600, 0, 180]], ['a']);
    eq(f, null, 'a dead player does not shoot');
    // pre-fight: both look at each other, within 1500
    f = fight([['a', 'CT', 0, 0, 0], ['b', 'T', 1200, 0, 180]], []);
    eq(f && [f.key, f.pri], ['a|b', 1], 'two enemies look at each other closer than 1500: a pre-fight without shots');
    eq(fight([['a', 'CT', 0, 0, 0], ['b', 'T', 1200, 0, 0]], []), null, 'one looks away: nothing');
    eq(fight([['a', 'CT', 0, 0, 0], ['b', 'T', 1800, 0, 180]], []), null, 'too far: nothing');
    eq(fight([['a', 'CT', 0, 0, 0], ['b', 'T', 1200, 0, 180, 0]], []), null, 'one is dead: nothing');
    eq(fight([['a', 'CT', 0, 0, 0], ['d', 'CT', 1200, 0, 180]], []), null, 'allies looking at each other: nothing');
    eq(fight([['a', 'CT', 0, 0, 0], ['b', 'T', 1000, 1000, 180]], []), null, 'about 45 degrees off: nothing');
    // the pair changes: a new shot beats the pre-fight, the current pair holds against equal ones
    const two = [['a', 'CT', 0, 0, 0], ['b', 'T', 1000, 0, 180], ['e', 'CT', 0, 3000, 270], ['f', 'T', 0, 2000, 90]];
    f = fight(two, ['e']);
    eq(f && f.key, 'e|f', 'a shot (e at f) is stronger than the a|b pre-fight');
    f = fight(two, [], null, 1000, 'a|b');
    eq(f && f.key, 'a|b', 'with no shots the pre-fight pair stays');
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

  await step('the early fight shows in the same packet as the shot and the next pair replaces it', async () => {
    await sleep(100);
    const P2 = (extra, pos) => { const g = spec(extra, 7);
      for(const [id, [x, y, ang]] of Object.entries(pos)){ g.allplayers[id].position = `${x}, ${y}, 0`; g.allplayers[id].forward = `${Math.cos(ang * Math.PI / 180)}, ${Math.sin(ang * Math.PI / 180)}, 0`; } return g; };
    const far = { 101: [0, 0, 0], 102: [0, 4000, 0], 201: [700, 0, 180], 202: [0, -6000, 0] };
    await send(P2({}, far));
    const f0 = await fightOf();
    eq(f0 && [f0.a.name, f0.b.name], ['SaiYeah', 'gospoja'], 'they look at each other: the fight is there before any shot');
    // ct2 and t2 meet: ct2 fires at t2 straight ahead, the pair changes in the same packet
    await send(P2({ 102: { ammo: 29 } }, { ...far, 102: [0, 4000, 0], 202: [900, 4000, 180] }));
    const f1 = await fightOf();
    eq(f1 && [f1.a.name, f1.b.name], ['ct2', 't2'], 'the shot pair replaces the old one at once');
  });

  await step('the hint goes away 4 s after the last action', async () => {
    check(await until(async () => (await fightOf()) === null, 6000), 'gone');
  });

  await step('one team or no damage gives no hint', async () => {
    await send(spec({}, 6));
    await send(spec({ 101: { hp: 50, ammo: 25 }, 102: { ammo: 20 } }, 6));
    eq(await fightOf(), null, 'CT hurt, only CT shooting');
    await sleep(2100);   // the CT damage leaves the 2 s window
    await send(spec({ 101: { hp: 50, ammo: 10 }, 102: { ammo: 15 }, 201: { ammo: 12 }, 202: { ammo: 5 } }, 6));
    check((await fightOf()) !== null, 'both teams shooting (no positions): the fight shows without damage');
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

  // Team names and score travel with the team when sides are swapped (halftime, overtime)
  const side = ({ round, team, ct, t, map = 'de_nuke', phase = 'live' }) => ({
    provider: { steamid: '111' },
    map: { name: map, mode: 'competitive', round, phase: 'live', team_ct: { name: ct[0], score: ct[1] }, team_t: { name: t[0], score: t[1] } },
    round: { phase },
    player: { steamid: '111', name: 'me', team, state: { health: 100, armor: 0, money: 800, round_kills: 0, round_killhs: 0, round_totaldmg: 0 }, match_stats: { kills: 0, deaths: 0, assists: 0 } },
  });
  const teams = async () => { const c = (await host.api('/api/status')).cs2; return [c.ctName, c.ct, c.tName, c.tt, c.sw]; };

  await step('side swap: CS2 left names and score on the old sides, Host moves them with the team', async () => {
    await send(side({ round: 10, team: 'CT', ct: ['A', 5], t: ['B', 6] }));
    eq(await teams(), ['A', 5, 'B', 6, 0], 'first half as is');
    await send(side({ round: 12, team: 'CT', ct: ['A', 5], t: ['B', 7] }));
    // halftime: our player is now T, the packet still carries the old names and scores
    await send(side({ round: 12, team: 'T', ct: ['A', 5], t: ['B', 7] }));
    eq(await teams(), ['B', 7, 'A', 5, 1], 'A moved to T with 5, B to CT with 7');
    await send(side({ round: 13, team: 'T', ct: ['A', 5], t: ['B', 8] }));
    eq(await teams(), ['B', 8, 'A', 5, 1], 'a later round keeps the sides');
    // the rest of the regulation round by round, then the overtime swap
    for(let a = 5, b = 8, r = 14; r < 27; r++){ if(r % 2) b++; else a++; await send(side({ round: r, team: 'T', ct: ['A', a], t: ['B', b] })); }
    await send(side({ round: 27, team: 'CT', ct: ['A', 14], t: ['B', 13] }));
    eq(await teams(), ['A', 14, 'B', 13, 0], 'second swap puts them back');
  });

  await step('side swap: CS2 swapped names and score itself, Host leaves them alone', async () => {
    await send(side({ round: 0, team: 'CT', ct: ['A', 0], t: ['B', 0], map: 'de_ancient' }));
    await send(side({ round: 11, team: 'CT', ct: ['A', 4], t: ['B', 7], map: 'de_ancient' }));
    await send(side({ round: 12, team: 'T', ct: ['B', 7], t: ['A', 4], map: 'de_ancient' }));
    eq(await teams(), ['B', 7, 'A', 4, 1], 'taken as CS2 sent it');
    await send(side({ round: 24, team: 'CT', ct: ['A', 12], t: ['B', 12], map: 'de_ancient' }));
    eq((await teams()).slice(0, 4), ['A', 12, 'B', 12], 'tie at the overtime swap, names follow');
  });

  await step('side swap: a spectator switching between players is not a swap', async () => {
    const spec = (id, team) => ({ ...side({ round: 5, team: 'CT', ct: ['A', 2], t: ['B', 3], map: 'de_overpass' }), provider: { steamid: '999' }, player: { steamid: id, name: id, team, state: { health: 100 } } });
    await send({ ...side({ round: 4, team: 'CT', ct: ['A', 2], t: ['B', 2], map: 'de_overpass' }), provider: { steamid: '999' } });
    await send(spec('201', 'CT')); await send(spec('202', 'T')); await send(spec('201', 'CT'));
    eq((await teams()).slice(0, 4), ['A', 2, 'B', 3], 'no change');
    eq((await teams())[4], 0, 'no swap counted');
  });

  await step('numbering: hud order gives left 1-5, right 6-0 on the Host, in the fight hint and in the panel/widget renderer', async () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
    const vm = require('vm'), ctx = {}; vm.createContext(ctx);
    vm.runInContext(src.slice(src.indexOf('const FIGHT_WIN'), src.indexOf('\nlet fightPrev')) + '\nthis.detectFight = detectFight; this.hudSlots = hudSlots; this.slotKey = slotKey;', ctx);
    // game slots as CS2 hands them out: T is first here (0-4), CT is 5-9, one hole in the middle of CT
    const P = (id, team, slot) => ({ id, name: 'n' + id, team, slot, hp: 100, alive: true });
    const roster = [P('t1', 'T', 0), P('t2', 'T', 1), P('c1', 'CT', 5), P('c2', 'CT', 7), P('c3', 'CT', 9), P('x', 'CT', -1)];
    const hs = ctx.hudSlots(roster);
    eq([hs.c1, hs.c2, hs.c3, hs.t1, hs.t2, 'x' in hs], [0, 1, 2, 5, 6, true], 'CT takes 0..4, T takes 5..9, a player without a game slot is numbered last in his team');
    eq([hs.c1, hs.c3, hs.t1, hs.t2].map(ctx.slotKey), [1, 3, 6, 7], 'keys shown: CT 1 2 3, T 6 7');
    const prev = Object.fromEntries(roster.map(p => [p.id, p]));
    const now = roster.map(p => p.id === 't1' ? { ...p, hp: 60 } : p.id === 'c3' ? { ...p, ammo: 5 } : p);
    const mk = hud => ctx.detectFight(prev, now.map(p => p.id === 't1' ? { ...p, hp: 60, weapon: 'w' } : p), [], 1000, { hurt: {}, act: { c3: 1000 } }, null, hud);
    const g = mk(false).fight, h = mk(true).fight;
    eq(g && [g.a.slot, g.b.slot], [0, 1], 'game numbering: raw slots 9 and 0 → keys 0 and 1');
    eq(h && [h.a.slot, h.b.slot], [3, 6], 'hud numbering: third CT is 3, first T is 6');
    // the renderer in core.js
    const box = { console, URL, Blob, TextEncoder, TextDecoder, Intl, setTimeout, clearTimeout, setInterval() {}, addEventListener() {}, document: { addEventListener() {}, currentScript: null, baseURI: 'http://x/' }, location: { protocol: 'https:', origin: 'https://p.test' } };
    box.window = box; vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'web/shared/core.js'), 'utf8') + '\nthis.R = { cleanCs2Auto, setCs2Num, cs2View, slotLabel };', box);
    const R = box.R, d = { players: roster, observed: roster[2] };
    const lab = v => v.players.map(p => p.id + ':' + R.slotLabel(p.slot)).join(' ');
    R.setCs2Num({ num: 'game' });
    eq(lab(R.cs2View({}, d)), 't1:1 t2:2 c1:6 c2:8 c3:0 x:', 'game numbering: as the game gives it');
    R.setCs2Num({ num: 'hud' });
    eq(lab(R.cs2View({}, d)), 't1:6 t2:7 c1:1 c2:2 c3:3 x:4', 'hud numbering: CT 1-4 left, T 6-7 right');
    eq(R.slotLabel(R.cs2View({}, d).observed.slot), '1', 'the observed player is renumbered too');
    const ten = [...'abcde'].map((c, i) => P('c' + c, 'CT', 5 + i)).concat([...'abcde'].map((c, i) => P('t' + c, 'T', i)));
    eq(R.cs2View({}, { players: ten }).players.map(p => R.slotLabel(p.slot)).join(''), '1234567890', 'ten players: left 1-5, right 6-9 and 0');
    eq([R.cleanCs2Auto(null).num, R.cleanCs2Auto({ num: 'hud' }).num, R.cleanCs2Auto({ num: 'zzz' }).num], ['game', 'hud', 'game'], 'cleanCs2Auto: numbering defaults to the game, plate is off');
  });

  await host.stop();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
