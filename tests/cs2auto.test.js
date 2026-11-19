// CS2 auto tab, map series and radar.
// Pure parts (series steps on the Host, moment detection, sanitize, radar calibration) run in vm;
// then a real panel + Host + OBS widget: GSI packets with a timeout make the tab slide in and out, the dock switch turns it off,
// two maps with a side switch give a 1:1 series in data/cs2-series.json, the panel changes the format, the radar puts a dot where the calibration says.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const ROOT = path.join(__dirname, '..');

// ---- pure functions ----
const srv = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const sctx = {}; vm.createContext(sctx);
vm.runInContext(srv.slice(srv.indexOf('const SER_BO'), srv.indexOf('\nconst SERIES_FILE')) + '\nthis.S = { seriesStep, seriesView, seriesCmd, cleanSeries };', sctx);
const S = sctx.S;
const noop = () => {};
const box = { console, URL, Blob, TextEncoder, TextDecoder, crypto: require('crypto').webcrypto, atob, btoa, Intl, setTimeout, clearTimeout, setInterval: noop, addEventListener: noop, document: { addEventListener: noop, currentScript: null, baseURI: 'http://x/' }, location: { protocol: 'https:', origin: 'https://panel.test' } };
box.window = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'web/shared/core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'web/shared/cs2-maps.js'), 'utf8')
  + '\nthis.C = { cleanCs2Auto, cs2TabMoment, sanitizeState, cleanSeriesView, cs2MapUV, cs2RadarImg, cs2Lower, cs2Mvp, cs2TabLook, setSeries: v => { CS2_SERIES = v; }, seriesLabel };', box);
const C = box.C;

(async () => {
  // packet as compactGsi makes it
  const P = (map, phase, ct, tt, round, extra = {}) => ({ map, phase, ct, tt, round, ...extra });

  await step('series: two maps, sides switch at half time, no team names', async () => {
    const s = S.cleanSeries(null);
    eq(s.bo, 3, 'BO3 by default');
    S.seriesStep(s, P('de_mirage', 'warmup', 0, 0, 0), 1);
    S.seriesStep(s, P('de_mirage', 'live', 0, 0, 0), 2);          // team 1 starts as CT
    S.seriesStep(s, P('de_mirage', 'live', 8, 4, 12), 3);
    S.seriesStep(s, P('de_mirage', 'intermission', 8, 4, 12), 4); // sides switch: team 1 is T now, team_t.score follows it
    S.seriesStep(s, P('de_mirage', 'live', 4, 8, 12), 5);
    eq(S.seriesView(s, P('de_mirage', 'live', 4, 8, 12)).ctIs, 'b', 'after the switch team 2 is CT');
    S.seriesStep(s, P('de_mirage', 'gameover', 9, 13, 21), 6);
    S.seriesStep(s, P('de_mirage', 'gameover', 9, 13, 21), 7);    // gameover repeats: one record
    eq(s.maps.length, 1, 'one map recorded');
    eq([s.maps[0].a.score, s.maps[0].b.score, s.maps[0].win], [13, 9, 'a'], 'team 1 won 13:9 although it ended as T');
    eq(S.seriesView(s, null).go, 6, 'end of map time for the 15 s result');
    // map 2: names appear; team that starts CT is team 1 again (no names in the series yet → names taken now)
    S.seriesStep(s, P('de_dust2', 'live', 0, 0, 0, { ctName: 'Alpha', tName: 'Bravo' }), 8);
    eq([s.names.a, s.names.b], ['Alpha', 'Bravo'], 'names from the first named map');
    S.seriesStep(s, P('de_dust2', 'intermission', 3, 9, 12, { ctName: 'Alpha', tName: 'Bravo' }), 9);
    S.seriesStep(s, P('de_dust2', 'gameover', 13, 5, 18, { ctName: 'Bravo', tName: 'Alpha' }), 10);
    eq([s.maps[1].map, s.maps[1].a.score, s.maps[1].b.score, s.maps[1].win], ['de_dust2', 5, 13, 'b'], 'by names: Alpha (now T) 5, Bravo (now CT) 13');
    const v = S.seriesView(s, P('de_dust2', 'gameover', 13, 5, 18, { ctName: 'Bravo', tName: 'Alpha' }));
    eq([v.a.w, v.b.w, v.ctIs], [1, 1, 'b'], 'series 1:1, Bravo on CT');
  });

  await step('series: a map changed after live is recorded with the last score, a restart is not', async () => {
    const s = S.cleanSeries({ bo: 5 });
    S.seriesStep(s, P('de_nuke', 'live', 0, 0, 0), 1);
    S.seriesStep(s, P('de_nuke', 'live', 5, 2, 7), 2);
    S.seriesStep(s, P('de_nuke', 'live', 0, 0, 0), 3);              // round went back: restart, nothing recorded
    eq(s.maps.length, 0, 'restart is not a finished map');
    S.seriesStep(s, P('de_nuke', 'live', 6, 3, 9), 4);
    S.seriesStep(s, P('de_inferno', 'warmup', 0, 0, 0), 5);
    eq(s.maps.map(m => [m.map, m.a.score, m.b.score]), [['de_nuke', 6, 3]], 'switching maps after live records the last score');
  });

  await step('series: panel commands and garbage', async () => {
    const s = S.cleanSeries(null);
    check(S.seriesCmd(s, { op: 'bo', bo: 5 }) && s.bo === 5, 'format BO5');
    check(!S.seriesCmd(s, { op: 'bo', bo: 4 }) && s.bo === 5, 'BO4 is refused');
    S.seriesCmd(s, { op: 'edit', names: { a: 'X'.repeat(90), b: '<b>' }, maps: [{ map: 'de_mirage<script>', a: { score: 300 }, b: { score: -4 } }, null, 'x', ...Array(20).fill({ map: 'de_x' })] });
    eq([s.names.a.length, s.names.b], [40, '<b>'], 'names cut to 40, kept as text');
    eq([s.maps.length, s.maps[0].map, s.maps[0].a.score, s.maps[0].b.score, s.maps[0].win], [7, 'de_miragescript', 99, 0, 'a'], 'at most 7 maps, scores 0..99, map name letters only');
    check(S.seriesCmd(s, { op: 'reset' }) && !s.maps.length && !s.names.a, 'reset empties maps and names');
    check(!S.seriesCmd(s, null) && !S.seriesCmd(s, { op: 'nuke' }), 'unknown commands do nothing');
    const g = S.cleanSeries({ bo: '3', cur: { map: '../x', ct: 'a' }, maps: 'no' });
    eq([g.bo, g.maps, g.cur.map, g.cur.ct], [3, [], 'x', 0], 'garbage file is cleaned');
  });

  await step('auto tab: sanitize and moments', async () => {
    eq(C.cleanCs2Auto(null), { on: false, timeout: true, half: true, end: true, theme: 'A', hideBottom: true, hideTop: true }, 'defaults: off, all moments, style A, both hide');
    eq(C.cleanCs2Auto({ on: 'yes', theme: 'E', hideTop: 0, half: false, x: 1 }), { on: false, timeout: true, half: false, end: true, theme: 'A', hideBottom: true, hideTop: true }, 'garbage: on only with true, no style E');
    eq(C.sanitizeState({ els: [], cs2auto: { on: true, theme: 'D', hideBottom: false } }).cs2auto.theme, 'D', 'sanitizeState keeps cs2auto');
    eq(C.sanitizeState({ els: [] }).cs2auto.on, false, 'old screen: auto tab off');
    const a = C.cleanCs2Auto({ on: true }), mem = {};
    eq([C.cs2TabMoment({ phase: 'live', pphase: 'timeout_ct' }, a, mem, 0), C.cs2TabMoment({ phase: 'live', pphase: 'paused' }, a, mem, 0), C.cs2TabMoment({ phase: 'intermission' }, a, mem, 0), C.cs2TabMoment({ phase: 'live', pphase: 'live' }, a, mem, 0)],
      ['timeout', 'timeout', 'half', null], 'timeout, pause, half time, live');
    eq(C.cs2TabMoment({ phase: 'live', pphase: 'timeout_t' }, { ...a, timeout: false }, mem, 0), null, 'moment switched off');
    eq(C.cs2TabMoment({ phase: 'live', pphase: 'timeout_t' }, { ...a, on: false }, mem, 0), null, 'auto tab off');
    const go = { phase: 'gameover', map: 'de_mirage', ct: 13, tt: 9 };
    eq([C.cs2TabMoment(go, a, mem, 1000), C.cs2TabMoment(go, a, mem, 15000), C.cs2TabMoment(go, a, mem, 16100)], ['end', 'end', null], 'end of map stays 15 s');
    C.setSeries(C.cleanSeriesView({ bo: 3, a: { w: 1 }, b: { w: 0 }, ctIs: 'b', map: 'de_mirage', go: 50000 }));
    eq([C.cs2TabMoment(go, a, {}, 60000), C.cs2TabMoment(go, a, {}, 70000)], ['end', null], 'the Host time of the end wins over a late look');
    eq(C.seriesLabel(), 'Серия 0 : 1 · BO3', 'series label follows sides: team 1 is T now');
    C.setSeries(null);
    eq(C.cs2Mvp([{ name: 'a', mvps: 2, k: 10 }, { name: 'b', mvps: 3, k: 5 }, { name: 'c', mvps: 3, k: 7 }]).name, 'c', 'MVP: most MVPs, then kills');
    eq(C.cs2TabLook([]).theme, 'glass', 'no CS2 element: glass');
    eq(C.cs2TabLook([{ type: 'cs2', view: 'card', theme: 'ko' }, { type: 'cs2', view: 'hud_tour', theme: 'classic' }]).theme, 'classic', 'the full-screen HUD sets the theme');
  });

  await step('radar calibration and background files', async () => {
    eq(C.cs2MapUV('de_dust2', [-2476, 3239, 0]), [0, 0], 'pos_x/pos_y is the top-left corner');
    const uv = C.cs2MapUV('de_dust2', [-2476 + 4.4 * 512, 3239 - 4.4 * 256, 0]);
    eq(uv.map(x => +x.toFixed(4)), [0.5, 0.25], '512 px right, 256 px down at scale 4.4');
    eq(C.cs2MapUV('de_unknown', [0, 0, 0]), null, 'unknown map: no calibration');
    eq(C.cs2RadarImg('de_nuke', 'ko', true), '../shared/radar/de_nuke_lower-ko.webp', 'nuke lower level in the ko theme');
    eq(C.cs2RadarImg('de_mirage', 'weird', true), '../shared/radar/de_mirage-glass.webp', 'no lower level on mirage, unknown theme → glass');
    eq([C.cs2Lower('de_nuke', [0, 0, -600]), C.cs2Lower('de_nuke', [0, 0, -400]), C.cs2Lower('de_dust2', [0, 0, -9000])], [true, false, false], 'level by height');
    const src = fs.readFileSync(path.join(ROOT, 'web/shared/cs2-maps.js'), 'utf8'), maps = [...src.matchAll(/^\s+(\w+):\s*\{ x:/gm)].map(m => m[1]);
    const miss = [];
    for(const m of maps) for(const th of ['classic', 'glass', 'ko']) for(const lv of ['', ...(/low:/.test(src.split('\n').find(l => l.includes(m + ':')) || '') ? ['_lower'] : [])]){
      const f = path.join(ROOT, 'web/shared/radar', `${m}${lv}-${th}.webp`);
      if(!fs.existsSync(f) || fs.statSync(f).size > 200 * 1024) miss.push(path.basename(f));
    }
    check(!miss.length, 'every calibrated map has its three backgrounds (and the lower level), each under 200 KB', miss);
  });

  // ---- live: panel + Host + widget ----
  let s;
  await step('stack starts', async () => {
    s = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
    check(s.online, 'panel online');
  });
  const cfg = () => JSON.parse(fs.readFileSync(path.join(s.host.dir, 'overlay-host.json'), 'utf8'));
  const gsi = body => fetch(`http://127.0.0.1:${s.host.port}/gsi`, { method: 'POST', headers: { host: `127.0.0.1:${s.host.port}` }, body: JSON.stringify({ ...body, auth: { token: cfg().gsiToken } }) });
  const ROSTER = [['101', 'SaiYeah', 'CT', 1, [-500, 1500, 0]], ['102', 'gospoja', 'CT', 2, [0, 0, 0]], ['103', 'runorn', 'CT', 3, [0, 0, 0]], ['104', 'pelmech', 'CT', 4, [0, 0, 0]], ['105', 'etsu', 'CT', 5, [0, 0, 0]],
    ['201', 'kirpich', 'T', 6, [0, 0, 0]], ['202', 'mamka', 'T', 7, [0, 0, 0]], ['203', 'lesnik', 'T', 8, [0, 0, 0]], ['204', 'zhuk', 'T', 9, [0, 0, 0]], ['205', 'tapok', 'T', 0, [0, 0, 0]]];
  const spec = ({ map = 'de_dust2', phase = 'live', pphase = 'live', ct = 3, tt = 2, round = 5, names } = {}) => {
    const allplayers = {};
    for(const [id, name, team, slot, pos] of ROSTER) allplayers[id] = { name, team, observer_slot: slot, position: pos.join(', '), forward: '1, 0, 0',
      state: { health: 100, armor: 100, money: 1000 }, match_stats: { kills: 5, deaths: 3, assists: 1, mvps: id === '201' ? 2 : 0 }, weapons: { weapon_0: { name: 'weapon_ak47', type: 'Rifle', state: 'active', ammo_clip: 30, ammo_clip_max: 30, ammo_reserve: 90 } } };
    return { provider: { steamid: '999' }, map: { name: map, mode: 'competitive', round, phase, team_ct: { score: ct, ...(names ? { name: names[0] } : {}) }, team_t: { score: tt, ...(names ? { name: names[1] } : {}) } },
      round: { phase: 'freezetime' }, phase_countdowns: { phase: pphase, phase_ends_in: '24.0' }, player: { steamid: '101', name: 'SaiYeah', team: 'CT', observer_slot: 1, state: { health: 100 } }, allplayers };
  };
  const tabOn = () => s.widget.evaluate(() => { const b = document.getElementById('ctab'); return !b.hidden && b.classList.contains('show') ? { st: b.dataset.st, th: b.dataset.th, m: b.dataset.m, rows: b.querySelectorAll('.pl:not(.ph)').length, hb: document.getElementById('stage').classList.contains('ctab-hb'), ht: document.getElementById('stage').classList.contains('ctab-ht'), text: b.textContent } : null; });

  await step('positions reach the panel and the gsi cfg asks for them', async () => {
    const r = await gsi(spec()); check(r.ok, 'packet accepted');
    const st = await s.host.api('/api/status');
    eq(st.cs2.players.find(p => p.id === '101').pos, [-500, 1500, 0], 'pos [x, y, z] from allplayers position');
    eq(st.cs2.players.find(p => p.id === '101').fw, 0, 'forward 1,0,0 is 0°');
    const cfgText = await (await fetch(`http://127.0.0.1:${s.host.port}/api/gsi/cfg`, { headers: { 'x-hudini-token': T.ADMIN_TOKEN } })).text();
    check(/"allplayers_position"\s+"1"/.test(cfgText), 'gsi cfg has allplayers_position');
  });

  await step('auto tab is off by default: a timeout shows nothing', async () => {
    await gsi(spec({ pphase: 'timeout_ct' }));
    await sleep(700);
    eq(await tabOn(), null, 'no tab');
  });

  await step('switched on in the CS2 tab: a timeout slides it in, both HUD parts go away, live slides it out', async () => {
    await s.panel.click('[data-tab=cs2]');
    await s.panel.$eval('#taOn', e => e.click());
    await until(async () => (await s.widget.evaluate(() => lastState.cs2auto?.on)) === true, 5000);
    await gsi(spec({ pphase: 'timeout_ct' }));
    const t = await until(tabOn, 5000);
    check(t && t.st === 'A' && t.th === 'glass' && t.m === 'timeout', 'style A, glass without a CS2 element, timeout', t);
    eq(t && t.rows, 10, 'ten player rows');
    check(t && t.hb && t.ht, 'bottom cards and top score hide');
    check(t && /ТАЙМАУТ/.test(t.text) && /SaiYeah/.test(t.text), 'title and names');
    await gsi(spec({ pphase: 'live' }));
    check(await until(async () => (await tabOn()) === null, 5000), 'gone after the timeout');
    check(await until(() => s.widget.evaluate(() => document.getElementById('ctab').hidden && !document.getElementById('stage').classList.contains('ctab-hb')), 4000), 'hidden after the slide out, HUD back');
  });

  await step('style, HUD theme and hide switches follow the panel', async () => {
    await s.panel.click('[data-tab=add]'); await s.panel.click('[data-add=cs2]');
    await s.panel.selectOption('#iCsView', 'hud_tour'); await s.panel.selectOption('#iCsTheme', 'ko');
    await s.panel.click('[data-tab=cs2]');
    await s.panel.selectOption('#taStyle', 'D'); await s.panel.$eval('#taHideTop', e => e.click());
    await until(() => s.widget.evaluate(() => lastState.cs2auto?.theme === 'D' && lastState.cs2auto?.hideTop === false), 5000);   // both changes reached the widget
    await gsi(spec({ pphase: 'paused' }));
    const t = await until(tabOn, 5000);
    check(t && t.st === 'D' && t.th === 'ko' && t.hb && !t.ht, 'D in ko, only the bottom cards hide', t);
    check(t && /ПАУЗА/.test(t.text), 'pause title');
    await gsi(spec({ pphase: 'live' }));
    await until(async () => (await tabOn()) === null, 5000);
  });

  await step('the dock switch turns the auto tab off on stream', async () => {
    const ctl = a => fetch(`http://localhost:${s.host.port}/api/control`, { method: 'POST', headers: { host: `localhost:${s.host.port}`, origin: `http://localhost:${s.host.port}`, 'content-type': 'application/json' }, body: JSON.stringify({ action: a }) });
    check((await ctl('taboff')).ok, 'taboff accepted');
    await sleep(400);
    await gsi(spec({ pphase: 'timeout_t' }));
    await sleep(900);
    eq(await tabOn(), null, 'no tab while switched off');
    check(await until(() => s.panel.evaluate(() => !document.getElementById('taOffNote').hidden), 3000), 'the panel says the streamer turned it off');
    check((await ctl('tabon')).ok, 'tabon accepted');
    check(await until(tabOn, 5000), 'back on: the running timeout shows it');
    await gsi(spec({ pphase: 'live' }));
    await until(async () => (await tabOn()) === null, 5000);
  });

  await step('show now from the panel works without a match moment', async () => {
    await s.panel.selectOption('#taMoment', 'end');
    await s.panel.click('#taShow');
    const t = await until(tabOn, 4000);
    check(t && t.m === 'end' && /★/.test(t.text), 'end of map with the MVP star on stream', t);
    check(await s.panel.evaluate(() => document.querySelector('#taBox.show') !== null), 'and in the panel preview');
  });

  await step('series: a map with a side switch and a second map give 1:1, saved in data/cs2-series.json', async () => {
    const file = () => { try{ return JSON.parse(fs.readFileSync(path.join(s.host.dir, 'cs2-series.json'), 'utf8')); }catch{ return null; } };
    await gsi(spec({ map: 'de_mirage', phase: 'warmup', ct: 0, tt: 0, round: 0 }));   // Dust2 of the steps above is recorded here: start the series over
    await s.panel.click('#serReset');
    check(await until(() => file()?.maps?.length === 0, 3000), 'series reset from the panel');
    await gsi(spec({ map: 'de_mirage', ct: 0, tt: 0, round: 0 }));
    await gsi(spec({ map: 'de_mirage', phase: 'intermission', ct: 9, tt: 3, round: 12 }));
    await gsi(spec({ map: 'de_mirage', ct: 3, tt: 9, round: 12 }));
    await gsi(spec({ map: 'de_mirage', phase: 'gameover', ct: 4, tt: 13, round: 17 }));
    const f = await until(() => file()?.maps?.length === 1 && file(), 3000);
    eq(f && [f.maps[0].map, f.maps[0].a.score, f.maps[0].b.score], ['de_mirage', 13, 4], 'team 1 won Mirage 13:4');
    const t = await until(async () => { const x = await tabOn(); return x && /Mirage/.test(x.text) && x; }, 10000);   // the 8 s «show now» of the step above goes first
    check(t && t.m === 'end' && /Серия 0 : 1 · BO3/.test(t.text), 'end of map shows the series, team 1 now on T', t && t.text.slice(0, 200));
    await gsi(spec({ map: 'de_dust2', ct: 0, tt: 0, round: 0 }));
    await gsi(spec({ map: 'de_dust2', phase: 'gameover', ct: 13, tt: 11, round: 23 }));
    check(await until(() => file()?.maps?.length === 2, 3000), 'second map recorded');
    eq(file().maps.map(m => m.win), ['a', 'a'], 'team 1 started CT on Dust2 too and won');
    check(await until(() => s.panel.evaluate(() => document.getElementById('serScore').textContent === '2 : 0'), 4000), 'panel shows 2 : 0');
  });

  await step('series: the panel changes the format, edits and resets', async () => {
    const file = () => JSON.parse(fs.readFileSync(path.join(s.host.dir, 'cs2-series.json'), 'utf8'));
    await s.panel.selectOption('#serBo', '5');
    check(await until(() => file().bo === 5, 4000), 'BO5 saved by the Host');
    await s.panel.fill('#serNa', 'Alpha');
    await s.panel.fill('#serMaps .ser-map:nth-child(2) input[type=number] >> nth=0', '7');
    await s.panel.click('#serSave');
    check(await until(() => file().names.a === 'Alpha' && file().maps[1].a.score === 7 && file().maps[1].win === 'b', 4000), 'manual edit: name and score, winner from the score', file());
    check(await until(() => s.panel.evaluate(() => document.getElementById('serScore').textContent === '1 : 1'), 4000), 'panel shows 1 : 1');
    await s.panel.click('#serReset');
    check(await until(() => file().maps.length === 0, 4000), 'reset');
    check(/Серия CS2/.test(s.host.log()), 'Host log mentions series commands');
  });

  await step('radar: a dot where the calibration puts it, theme background, dots move', async () => {
    await s.panel.click('[data-tab=add]'); await s.panel.click('[data-add=cs2]');
    await s.panel.selectOption('#iCsView', 'radar'); await s.panel.selectOption('#iCsTheme', 'classic');
    await gsi(spec({ map: 'de_dust2', ct: 1, tt: 1, round: 2 }));
    const where = () => s.widget.evaluate(() => { const r = [...document.querySelectorAll('.rd')].pop(); const d = r?.querySelector('.rd-dot.tm-ct'); const img = r?.querySelector('.rd-img');
      return r && d ? { left: parseFloat(d.style.left), top: parseFloat(d.style.top), slot: d.textContent, img: img.getAttribute('src'), ok: r.classList.contains('has-img'), dots: r.querySelectorAll('.rd-dot').length } : null; });
    const w = await until(async () => { const x = await where(); return x && x.ok && /classic/.test(x.img) && x; }, 6000);
    const u = (-500 + 2476) / 4.4 / 1024 * 100, v = (3239 - 1500) / 4.4 / 1024 * 100;
    check(w && Math.abs(w.left - u) < 0.05 && Math.abs(w.top - v) < 0.05, `SaiYeah at ${u.toFixed(2)}% / ${v.toFixed(2)}%`, w);
    check(w && w.slot === '1' && w.dots === 10, 'slot number on the dot, ten players', w);
    eq(w && w.img, '../shared/radar/de_dust2-classic.webp', 'classic background served by the Host');
    ROSTER[0][4] = [0, 1500, 0];
    await gsi(spec({ map: 'de_dust2', ct: 1, tt: 1, round: 2 }));
    check(await until(async () => { const x = await where(); return x && Math.abs(x.left - (2476 / 4.4 / 1024 * 100)) < 0.05; }, 4000), 'the dot moved with the next packet');
  });

  await T.closeBrowser();
  await s?.close();
  process.exit(T.finish());
})();
