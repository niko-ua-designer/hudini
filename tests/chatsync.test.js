// Chat read by several panels at once: one chat message counts once (polls and chat counters),
// and third-party emotes (7TV, BTTV, FFZ) in the panel feed and on stream.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ irc: true, hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid, host } = S;
  // emote providers without the network: fixed sets, every request counted
  const API = {
    '7tv.io/v3/emote-sets/global': { emotes: [{ id: '01F6MQ33FG000FFJ97ZB8MWV52', name: 'catJAM' }, { id: 'bad id!', name: 'Broken' }, { id: '01F6MQ33FG000FFJ97ZB8MWV53', name: 'two words' }] },
    '7tv.io/v3/users/twitch/12345': { emote_set: { emotes: [{ id: '60ae958e229664e8667aea38', name: 'peepoHey' }, { id: '60ae958e229664e8667aea39', name: 'x'.repeat(101) }] } },
    'api.betterttv.net/3/cached/emotes/global': [{ id: '5590b223b344e2c42a9e28e3', code: 'monkaS' }],
    'api.betterttv.net/3/cached/users/twitch/12345': { channelEmotes: [{ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', code: 'chanBT' }], sharedEmotes: [{ id: 'bbbbbbbbbbbbbbbbbbbbbbbb', code: 'sharedBT' }] },
    'api.frankerfacez.com/v1/set/global': { default_sets: [3], sets: { 3: { emoticons: [{ id: 28136, name: 'LilZ' }] }, 4: { emoticons: [{ id: 1, name: 'NotDefault' }] } } },
    'api.frankerfacez.com/v1/room/id/12345': { room: { set: 999 }, sets: { 999: { emoticons: [{ id: 12345, name: 'ffzChan' }] } } },
  };
  const hits = [];
  const IMG = require('fs').readFileSync(require('path').join(__dirname, 'fixtures/img.png'));
  const mock = async p => {
    await p.context().route(/^https:\/\/(7tv\.io|api\.betterttv\.net|api\.frankerfacez\.com)\//, r => {
      const u = r.request().url().replace(/^https:\/\//, ''); hits.push(u);
      return Object.hasOwn(API, u) ? r.fulfill({ body: JSON.stringify(API[u]), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '{}', headers: { 'access-control-allow-origin': '*' } });
    });
    await p.context().route(/^https:\/\/cdn\.(7tv\.app|betterttv\.net|frankerfacez\.com)\//, r => r.fulfill({ body: IMG, contentType: 'image/png' }));
  };
  await mock(mod); await mock(wid);
  const inv = await mod.evaluate(() => inviteLink(curRoom()));
  const mod2 = await T.newPage('mod2', { irc: true });
  await mod2.goto(inv);
  await mod2.waitForFunction(() => typeof curRoom === 'function' && curRoom());
  await T.attach(mod2, host);
  await until(async () => (await mod2.getAttribute('#status', 'class')).includes('ok'), 12000);
  for(const p of [mod, mod2]) await p.evaluate(() => chatConnect('chan'));
  await sleep(200);
  let n = 0;
  const line = (user, text, id) => `@badge-info=;badges=;color=#1E90FF;display-name=${user};emotes=;id=${id};mod=0;subscriber=0 :${user.toLowerCase()}!${user.toLowerCase()}@x.tmi.twitch.tv PRIVMSG #chan :${text}`;
  // the same chat message reaches both panels: first one panel, then (after its screen arrived) the other, or both at once
  const both = async (user, text, gap) => {
    const l = line(user, text, 'a1b2c3d4-0000-4000-8000-' + String(++n).padStart(12, '0'));
    if(gap){
      const seen = () => mod2.evaluate(() => stateSeenT.get(room) || 0), t0 = await seen();
      await mod.evaluate(x => window.__irc(x), l);
      if(gap > 100) await until(async () => (await seen()) > t0, 5000, 30);   // the screen with this message reached mod2
      else await sleep(gap);
      await mod2.evaluate(x => window.__irc(x), l);
    }
    else await Promise.all([mod, mod2].map(p => p.evaluate(x => window.__irc(x), l)));
  };
  const elOf = (p, id) => p.evaluate(i => { const e = state.els.find(x => x.id === i); return e && { votes: e.votes, value: e.value, vk: Object.keys(e.vk || {}).length }; }, id);
  const same = async (id, want) => until(async () => { const [a, b, w] = await Promise.all([elOf(mod, id), elOf(mod2, id), wid.evaluate(i => nodes.get(i)?._el?.votes || nodes.get(i)?._el?.value, id)]);
    return JSON.stringify(want(a)) === JSON.stringify(want(b)) && JSON.stringify(want(a)) === JSON.stringify(w) && a; }, 6000);

  await step('two panels, one chat: a poll vote counts once', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=poll]'); await mod.click('#pToggle');
    const id = await mod.evaluate(() => state.els.find(e => e.type === 'poll').id);
    check(await until(async () => (await mod2.evaluate(i => !!state.els.find(e => e.id === i && e.running), id))), 'the second panel sees the running poll');
    await both('Anna', '1', 700);    // mod2 already has the screen with Anna's vote when her message reaches it
    await both('Boris', '2', 0);     // both panels count at the same moment
    await both('Chris', '!2', 30);
    await sleep(1500);
    const r = await same(id, x => x.votes);
    eq(r && r.votes, [1, 2, 0], 'three viewers, three votes, the same on both panels and on stream');
    await both('Boris', '1', 0);     // changed their mind: still one vote
    await sleep(1500);
    eq((await same(id, x => x.votes))?.votes, [2, 1, 0], 'a changed vote moves, it does not double');
    await mod2.evaluate(i => { selectedId = i; document.getElementById('pReset').click(); }, id);
    check(await until(async () => JSON.stringify((await elOf(mod, id)).votes) === '[0,0,0]'), 'reset on the other panel clears the votes everywhere');
    await sleep(1500);
    eq((await elOf(mod, id)).votes, [0, 0, 0], 'old votes do not come back from the first panel after a reset');
    await both('Dan', '3', 0); await sleep(1500);
    eq((await same(id, x => x.votes))?.votes, [0, 0, 1], 'a vote after the reset counts once');
  });

  await step('two panels, one chat: a chat counter adds once per message', async () => {
    await mod.click('[data-tab=add]'); await mod.click('[data-add=counter]');
    const id = await mod.evaluate(() => { const e = state.els.filter(x => x.type === 'counter').pop(); beginChange(); Object.assign(e, { cmode: 'chat', kw: 'F', running: true, value: 0 }); commit(); return e.id; });
    check(await until(async () => (await mod2.evaluate(i => state.els.find(e => e.id === i)?.cmode === 'chat', id))), 'the second panel has the chat counter');
    await both('Anna', 'F', 700); await both('Boris', 'F', 0); await both('Chris', 'f f', 30); await both('Dan', 'nope', 0);
    await sleep(1500);
    eq((await same(id, x => x.value))?.value, 3, 'three matching messages, counter is 3 on both panels and on stream');
    // a message only one panel saw (the other one was reconnecting) still counts
    await mod2.evaluate(x => window.__irc(x), line('Eve', 'F', 'a1b2c3d4-0000-4000-8000-ffffffffffff'));
    await sleep(1500);
    eq((await same(id, x => x.value))?.value, 4, 'a message seen by one panel only counts once');
  });

  await step('sanitizeEl keeps the vote map clean', async () => {
    const r = await mod.evaluate(() => {
      const vk = JSON.parse('{"__proto__":1,"constructor":0,"anna":1,"BAD NAME":0,"x":7,"bob":"1","eve":0.5}');
      const e = sanitizeEl({ id: 'p', type: 'poll', opts: ['a', 'b'], vk, votes: [50, 50], vround: 'ab<c>' });
      const c = sanitizeEl({ id: 'c', type: 'counter', cids: ['ok-1', 'b a d', 5, 'x'.repeat(70), ...Array.from({ length: 400 }, (_, i) => 'm' + i)] });
      const big = {}; for(let i = 0; i < 6000; i++) big['v' + i] = 0;
      return { proto: Object.getPrototypeOf(e.vk) === null, keys: Object.keys(e.vk).sort(), votes: e.votes, round: e.vround,
        cids: [c.cids.length, c.cids[0], c.cids.includes('ok-1')], max: Object.keys(sanitizeEl({ id: 'p', type: 'poll', vk: big }).vk).length,
        legacy: sanitizeEl({ id: 'p', type: 'poll', opts: ['a', 'b'], votes: [3, 4] }).votes };
    });
    eq(r, { proto: true, keys: ['anna', 'bob', 'constructor'], votes: [1, 2], round: 'abc', cids: [300, 'm100', false], max: 5000, legacy: [3, 4] },
      'only valid nicknames and options, votes come from the map, 5000 voters and 300 message ids at most, old screens keep their votes');
  });

  await step('7TV, BTTV and FFZ emotes: off by default, then in the panel feed, in messages and chat on stream', async () => {
    const text = 'hi catJAM peepoHey monkaS chanBT sharedBT LilZ ffzChan Kappa NotDefault Broken';
    const kappa = Array.from(text).length - 'Kappa NotDefault Broken'.length;
    const msgLine = id => `@badges=;color=#1E90FF;display-name=Anna;emotes=25:${kappa}-${kappa + 4};id=${id};room-id=12345 :anna!anna@x.tmi.twitch.tv PRIVMSG #chan :${text}`;
    const lastRow = p => p.evaluate(() => { const r = [...document.querySelectorAll('#chatFeed .cm')].pop(); return r && [...r.querySelectorAll('img.m-emote')].map(i => i.alt + '@' + new URL(i.src).host); });
    eq(await mod.evaluate(() => [emx_stv.checked, emx_bttv.checked, emx_ffz.checked, JSON.stringify(emxNow())]), [false, false, false, '{"stv":false,"bttv":false,"ffz":false}'], 'all three are off in a new room');
    await mod.evaluate(x => window.__irc(x), '@emote-only=0;room-id=12345 :tmi.twitch.tv ROOMSTATE #chan');
    await mod.evaluate(x => window.__irc(x), msgLine('e0000001'));
    await sleep(500);
    eq(await lastRow(mod), ['Kappa@static-cdn.jtvnw.net'], 'off: only the Twitch emote is a picture');
    eq(hits.length, 0, 'off: nothing is requested from the emote servers');
    await mod.click('[data-tab=chat]');
    for(const p of ['stv', 'bttv', 'ffz']) await mod.click(`label.chk:has(#emx_${p})`);
    check(await until(async () => (await mod2.evaluate(() => JSON.stringify(emxNow()) + emx_bttv.checked)) === '{"stv":true,"bttv":true,"ffz":true}true'), 'the other panel of the room gets the setting');
    check(await until(async () => (await wid.evaluate(() => JSON.stringify(lastState.emx))) === '{"stv":true,"bttv":true,"ffz":true}'), 'the widget gets it with the screen');
    check(await until(async () => (await lastRow(mod))?.length === 8), 'the feed is repainted once the sets have loaded');
    await mod.evaluate(x => window.__irc(x), msgLine('e0000002'));
    eq(await lastRow(mod), ['catJAM@cdn.7tv.app', 'peepoHey@cdn.7tv.app', 'monkaS@cdn.betterttv.net', 'chanBT@cdn.betterttv.net', 'sharedBT@cdn.betterttv.net', 'LilZ@cdn.frankerfacez.com', 'ffzChan@cdn.frankerfacez.com', 'Kappa@static-cdn.jtvnw.net'],
      'global and channel emotes of all three, junk names and ids are skipped');
    check(await mod.evaluate(() => [...document.querySelectorAll('#chatFeed .cm')].pop().textContent.includes('hi ') && [...document.querySelectorAll('#chatFeed .cm')].pop().textContent.includes('NotDefault Broken')), 'other words stay text');
    eq([...new Set(hits)].sort(), Object.keys(API).sort(), 'the global and channel sets were requested');
    const before = hits.length;
    await mod.evaluate(x => window.__irc(x), msgLine('e0000003')); await sleep(300);
    eq(hits.length, before, 'sets are cached, a new message requests nothing');
    // a message on stream
    await mod.evaluate(() => [...document.querySelectorAll('#chatFeed .cm')].pop().click());
    const streamMsg = () => wid.evaluate(() => [...document.querySelectorAll('.msg .m-emote')].map(i => new URL(i.src).host));
    check(await until(async () => (await streamMsg()).length === 8), 'the message on stream shows the emotes');
    // the chat element on stream reads the chat itself
    await mod.click('[data-tab=add]'); await mod.click('#addChatFeed');
    await mod.evaluate(() => { const e = state.els.find(x => x.type === 'chat'); beginChange(); e.chan = 'chan'; commit(); });
    check(await until(() => wid.evaluate(() => !!window.__irc && !!document.querySelector('.chat'))), 'the stream has its chat');
    await sleep(500);
    await wid.evaluate(x => window.__irc(x), '@emote-only=0;room-id=12345 :tmi.twitch.tv ROOMSTATE #chan');
    check(await until(() => wid.evaluate(() => ['stv', 'bttv', 'ffz'].every(p => ThirdEmotes.sets.get(p + ':12345')?.map))), 'the widget loaded the channel sets (its CSP lets the three APIs through)');
    await wid.evaluate(x => window.__irc(x), msgLine('e0000004'));
    const chatRow = () => wid.evaluate(() => [...document.querySelectorAll('.chat .cl')].pop()?.querySelectorAll('.m-emote').length);
    check(await until(async () => (await chatRow()) === 8), 'chat on stream shows the emotes');
    // switching one provider off
    await mod.click('[data-tab=chat]'); await mod.click('label.chk:has(#emx_stv)');
    check(await until(async () => (await streamMsg()).length === 6 && !(await streamMsg()).includes('cdn.7tv.app')), '7TV off: its emotes leave the message on stream');
    check(await until(async () => (await lastRow(mod))?.length === 6), 'and the panel feed');
    await wid.evaluate(x => window.__irc(x), msgLine('e0000005'));
    check(await until(async () => (await chatRow()) === 6), 'and new chat lines on stream');
    eq(await mod.evaluate(() => { const e = sanitizeEl({ id: 'm', type: 'msg', text: 'a b', xe: [['stv', '01F6MQ33FG000FFJ97ZB8MWV52', 0, 0], ['evil', 'x', 0, 0], ['bttv', '../../x', 2, 2], ['ffz', '12', 2, 2], ['tw', '25', 0, 0]] }); return e.xe; }),
      [['stv', '01F6MQ33FG000FFJ97ZB8MWV52', 0, 0], ['ffz', '12', 2, 2]], 'sanitizeEl keeps only known providers and valid ids');
    await mod.evaluate(() => { beginChange(); state.els = state.els.filter(e => e.type !== 'chat' && e.type !== 'msg'); state.emx = { stv: false, bttv: false, ffz: false }; commit(); });
  });

  await mod2.context().close();
  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
