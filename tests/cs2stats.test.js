// CS2 match stats on the Host: ADR and HS% from per-round maxima, persistence across a restart, reset on a new map or match.
// No browser: packets go straight to /gsi and the result is read from /api/status.
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

  await host.stop();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
