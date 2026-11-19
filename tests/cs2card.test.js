// The big observed-player card of the CS2 tournament HUD keeps its size and place whatever weapon, grenades, money and numbers it shows,
// and nothing in it overlaps (themes classic/glass/ko, sizes 3/4/6/10, languages ru/de). Pure layout check on core.js + core.css.
'use strict';
const T = require('./lib');
const { step, check } = T;

const WEAPONS = [
  { weapon: 'weapon_ak47', money: 4550, nades: ['flash', 'smoke', 'molly', 'he'], kit: true },
  { weapon: 'weapon_fiveseven', ammoMax: 20, ammo: 20, reserve: 100, money: 4550, nades: [] },
  { weapon: 'weapon_deagle', ammoMax: 7, ammo: 7, reserve: 35, money: 16000, nades: ['flash'] },
  { weapon: 'weapon_knife', money: 0, nades: ['he', 'he', 'smoke', 'molly', 'flash', 'flash'], bomb: true },
  { weapon: 'weapon_flashbang', money: 800, nades: [] },
  { weapon: 'weapon_awp', ammoMax: 10, ammo: 3, reserve: 30, money: 12, nades: ['smoke'] },
  { weapon: 'weapon_mp5sd', ammoMax: 30, ammo: 30, reserve: 120, money: 900, nades: ['flash', 'he', 'molly'] },
];

(async () => {
  const web = await T.webServer();
  const p = await T.newPage('widget-card', { w: 1920, h: 1080 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${web.url}/shared/core.css"><script src="${web.url}/shared/core.js"></script>
    <style>body{margin:0;background:#556}.stage{position:relative;width:1920px;height:1080px;overflow:hidden;--u:10.8px}</style></head><body><div class="stage" id="stage"></div></body></html>`);
  await p.waitForFunction(() => typeof buildNode === 'function');
  const show = (view, theme, fs, lang, o) => p.evaluate(([view, theme, fs, lang, o]) => {
    const P = (n, team, slot, x = {}) => ({ id: 's' + slot, name: n, team, slot: (slot + 9) % 10, hp: 100, armor: 100, helmet: true, money: 50, k: 4, d: 1, a: 1, adr: 86, hsp: 0, mvps: 0, alive: true, weapon: 'weapon_knife', nades: [], kit: false, bomb: false, ...x });
    const players = [P('LuIsetsiKk', 'CT', 1, o), P('b', 'CT', 2), P('c', 'CT', 3), P('d', 'CT', 4), P('e', 'CT', 5), P('f', 'T', 6), P('g', 'T', 7), P('h', 'T', 8), P('i', 'T', 9), P('j', 'T', 0)];
    CS2 = { at: Date.now(), map: 'de_dust2', round: 3, ct: 2, tt: 1, ...players[0], players, observed: players[0], obs: 's1', evs: [] };
    STREAM_LANG = lang;
    const el = sanitizeEl({ id: 'x', type: 'cs2', view, theme, fs });
    const st = document.getElementById('stage'); st.replaceChildren();
    const n = buildNode(el); st.appendChild(n); paintNode(n, el, 1);
  }, [view, theme, fs, lang, o]);
  const measure = () => p.evaluate(() => {
    const R = s => document.querySelector(s).getBoundingClientRect();
    const c = R('.hd-big'), box = x => [x.left, x.top, x.width, x.height].map(v => Math.round(v * 10) / 10).join();
    const ov = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    // every visible leaf of the card: no two of them overlap and none sticks out of the card
    const leaves = [...document.querySelectorAll('.hd-big *')].filter(e => (!e.children.length || e.matches('b,i,.hd-bbars,.hd-bst,.hd-bstats,.hd-bright')) && !e.closest('.hd-bav') && !e.closest('svg') && !e.matches('.hd-bstats,.hd-bright,.hd-bbars,.hd-bst'))
      .map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width && x.r.height);
    let overlaps = 0; for(let i = 0; i < leaves.length; i++) for(let j = i + 1; j < leaves.length; j++) if(!leaves[i].e.contains(leaves[j].e) && !leaves[j].e.contains(leaves[i].e) && ov(leaves[i].r, leaves[j].r)) overlaps++;
    const out = leaves.filter(x => x.r.right > c.right + 1 || x.r.left < c.left - 1 || x.r.bottom > c.bottom + 1 || x.r.top < c.top - 1).length;
    return { card: box(c), score: box(R('.hd-score')), left: box(R('.hd-side.tm-ct .hd-card')), right: box(R('.hd-side.tm-t .hd-card')), overlaps, out };
  });

  for(const theme of ['classic', 'glass', 'ko']) for(const fs of [3, 4, 6, 10]) for(const lang of ['ru', 'de']) await step(`${theme} size ${fs} ${lang}`, async () => {
    const seen = [];
    for(let i = 0; i < WEAPONS.length; i++){
      await show('hud_tour', theme, fs, lang, { ...WEAPONS[i], adr: i % 2 ? 5 : 186, a: i * 3, k: i * 4 + 1, d: i, hsp: i % 2 ? 100 : 0 });
      seen.push({ w: WEAPONS[i].weapon, ...await measure() });
    }
    const first = seen[0];
    for(const m of seen){
      check(m.card === first.card, `card size and place the same for ${m.w}: ${m.card} vs ${first.card}`);
      check(m.score === first.score && m.left === first.left && m.right === first.right, `neighbouring blocks stay put for ${m.w}`);
      check(m.overlaps === 0 && m.out === 0, `nothing overlaps or leaves the card for ${m.w}`, m);
    }
  });
  await step('slots 0..9 are labelled 1 2 3 4 5 6 7 8 9 0, a missing slot is empty', async () => {
    await show('hud_tour', 'classic', 4, 'ru', {});
    const lab = side => p.evaluate(s => [...document.querySelectorAll(`.hd-side.tm-${s} .hd-slot`)].map(e => e.textContent).join(' '), side);
    check(await lab('ct') === '1 2 3 4 5' && await lab('t') === '6 7 8 9 0', 'HUD sides: ' + await lab('ct') + ' | ' + await lab('t'));
    const odd = await p.evaluate(() => [-1, null, undefined, 10, 'x'].map(slotLabel).join('|') + '#' + [-1, 3, 0].map(slotOrd).join());
    check(odd === '||||#99,3,0', 'bad slots give no label: ' + odd);
  });
  await T.closeBrowser(); await web.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
