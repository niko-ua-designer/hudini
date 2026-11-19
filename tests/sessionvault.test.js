// Panel password also protects the keys (k, p, s) of saved sessions: in store.json they live only inside the encrypted vault.
'use strict';
const T = require('./lib');
const { step, check, eq, until } = T;

const FP = 'cd'.repeat(32), PW = 'secret123';
(async () => {
  const web = await T.webServer();
  const host = T.startHost(); await host.ready();
  const { pass } = await host.api('/api/code');
  const base = `${web.url}/panel/moderator.html`;
  const sess = (id, extra = {}) => ({ id, name: 'etsuitoku', pass, fp: FP, addrs: [{ h: '127.0.0.1', port: host.modPort, net: 'tailscale' }], pinned: false, added: Date.now(), last: 0, lastNet: '', ...extra });
  const keysFrom = async () => { const p = await T.newPage('keys'); await p.goto(base); await p.waitForFunction(() => window.hudiniReady); const k = await p.evaluate(async () => newRoomKeys()); await p.context().close(); return k; };
  async function open(name, query, seed = {}){
    const p = await T.newPage(name);
    await p.addInitScript(seed => { if(!localStorage.getItem('fake.seeded')){ const s = JSON.parse(localStorage.getItem('fake.store') || '{}'); Object.assign(s, seed); localStorage.setItem('fake.store', JSON.stringify(s)); localStorage.setItem('fake.seeded', '1'); } }, seed);
    await p.goto(base + query);
    return p;
  }
  const rawStore = p => p.evaluate(() => localStorage.getItem('fake.store') || '');
  // password dialogs: answers in order
  const answer = (p, list) => T.answerPw(p, list);
  const unlock = async (p, pw) => { await p.waitForSelector('#lockPass', { state: 'visible' }); await p.fill('#lockPass', pw); await p.click('#lockGo'); };
  const online = p => until(async () => (await p.getAttribute('#status', 'class')).includes('ok'), 15000);
  // a secret value that must not appear in plain: the signing material as JSON text
  const secretText = k => JSON.stringify(k.s);

  await step('set password: session keys leave store.json and entering the session still works', async () => {
    const k = await keysFrom();
    const p = await open('pv1', '', { 'app.sessions': [sess('room_vault1', k)] });
    await p.waitForFunction(() => window.hudiniReady);
    await answer(p, [[PW, PW]]);
    await p.click('#moreBtn'); await p.click('#passBtn');
    check(await until(async () => { const s = (await T.stored(p, 'app.sessions'))?.[0]; return s && s.sealed === 1 && s.k === undefined; }), 'session is sealed, no k');
    const raw = await rawStore(p);
    check(!raw.includes(k.k) && !raw.includes(k.p) && !raw.includes(secretText(k)), 'store.json has no k, p or s');
    const s0 = (await T.stored(p, 'app.sessions'))[0];
    check(!('p' in s0) && !('s' in s0), 'no p/s fields either');
    eq(s0.pass, '', 'host password is gone from the session too');
    check(!raw.includes(pass), 'store.json has no plain host password');
    check(!!(await T.stored(p, 'overlay.vault2'))?.locked, 'vault is locked');
    // reopen, unlock, enter via ?session=
    await p.goto(base + '?session=room_vault1');
    await unlock(p, PW);
    check(await online(p), 'online after unlock');
    eq(await p.evaluate(() => room), 'room_vault1', 'in the room of the session');
    eq(await p.evaluate(() => curRoom().k), k.k, 'room has the keys from the vault');
    check(!(await rawStore(p)).includes(k.k) && !(await rawStore(p)).includes(pass), 'still no plain k or host password after entering');
    eq(await p.evaluate(() => homeInfo.pass), pass, 'Host connection uses the password from the vault');
    await p.context().close();
  });

  await step('wrong password reveals nothing', async () => {
    const k = await keysFrom();
    const p = await open('pv2', '', { 'app.sessions': [sess('room_vault2', k)] });
    await p.waitForFunction(() => window.hudiniReady);
    await answer(p, [[PW, PW]]); await p.click('#moreBtn'); await p.click('#passBtn');
    check(await until(async () => (await T.stored(p, 'app.sessions'))?.[0]?.sealed === 1), 'sealed');
    await p.goto(base + '?session=room_vault2');
    await unlock(p, 'wrong-password');
    check(await until(async () => /Неверный/.test(await p.textContent('#lockErr'))), 'error shown');
    check(!(await p.isHidden('#lock')), 'lock screen stays');
    eq(await p.evaluate(() => rooms.length), 0, 'no rooms loaded');
    eq(await p.evaluate(() => typeof sessSecrets === 'object' ? Object.keys(sessSecrets).length : 0), 0, 'no session secrets loaded');
    check(!(await rawStore(p)).includes(k.k) && !(await rawStore(p)).includes(pass), 'store.json has no plain key or host password');
    eq(await p.evaluate(() => homeInfo?.pass || ''), '', 'no Host connection');
    await p.context().close();
  });

  await step('remove password: the keys come back to the sessions', async () => {
    const k = await keysFrom();
    const p = await open('pv3', '', { 'app.sessions': [sess('room_vault3', k)] });
    await p.waitForFunction(() => window.hudiniReady);
    await answer(p, [[PW, PW]]); await p.click('#moreBtn'); await p.click('#passBtn');
    check(await until(async () => (await T.stored(p, 'app.sessions'))?.[0]?.sealed === 1), 'sealed');
    await answer(p, [[PW, '', '']]); await p.click('#moreBtn'); await p.click('#passBtn');
    check(await until(async () => (await T.stored(p, 'overlay.vault2'))?.plain), 'vault is plain again');
    const s = (await T.stored(p, 'app.sessions'))[0];
    eq([s.k, s.p, s.s, s.sealed, s.pass], [k.k, k.p, k.s, undefined, pass], 'keys and host password are back, marker gone');
    check(!JSON.stringify(await T.stored(p, 'overlay.vault2')).includes('"sess"'), 'plain vault carries no session secrets');
    await p.goto(base + '?session=room_vault3');
    check(await online(p), 'enters the session without a password');
    eq(await p.evaluate(() => curRoom().k), k.k, 'keys work');
    eq(await p.evaluate(() => homeInfo.pass), pass, 'Host connection uses the restored password');
    await p.context().close();
  });

  await step('legacy plain session without a password keeps working', async () => {
    const k = await keysFrom();
    const p = await open('pv4', '?session=room_vault4', { 'app.sessions': [sess('room_vault4', k)] });
    check(await online(p), 'online');
    eq(await p.evaluate(() => curRoom().k), k.k, 'room has the session keys');
    const s = (await T.stored(p, 'app.sessions'))[0];
    eq([s.k, s.sealed, s.pass], [k.k, undefined, pass], 'session stays plain, nothing sealed');
    eq(await p.evaluate(() => homeInfo.pass), pass, 'Host connection uses the plain password');
    await p.context().close();
  });

  await step('legacy plain session with a password is migrated at unlock; a session added later too', async () => {
    const k1 = await keysFrom(), k2 = await keysFrom();
    const p = await open('pv5', '', { 'app.sessions': [sess('room_vault5', k1)] });
    await p.waitForFunction(() => window.hudiniReady);
    await answer(p, [[PW, PW]]); await p.click('#moreBtn'); await p.click('#passBtn');
    check(await until(async () => (await T.stored(p, 'app.sessions'))?.[0]?.sealed === 1), 'first sealed');
    // the sessions window has no password: a new session with keys arrives in plain form
    await p.evaluate(([s]) => { HudiniStore.set('app.sessions', [...HudiniStore.get('app.sessions', []), s]); }, [sess('room_vault6', k2)]);
    check(await until(async () => (await rawStore(p)).includes(k2.k)), 'the new session sits plain until the next unlock');
    await p.goto(base + '?session=room_vault6');
    await unlock(p, PW);
    check(await online(p), 'online in the new session');
    eq(await p.evaluate(() => curRoom().k), k2.k, 'keys of the new session work');
    check(await until(async () => !(await rawStore(p)).includes(k2.k)), 'migrated: no plain key left');
    const list = await T.stored(p, 'app.sessions');
    eq(list.map(s => s.sealed), [1, 1], 'both sealed');
    check(!(await rawStore(p)).includes(k1.k) && !(await rawStore(p)).includes(pass), 'first key and host password are not plain either');
    eq((await T.stored(p, 'app.sessions')).map(s => s.pass), ['', ''], 'host passwords sealed in both');
    // and the first one is still reachable
    await p.goto(base + '?session=room_vault5'); await unlock(p, PW);
    await p.waitForFunction(() => window.hudiniReady);
    eq(await p.evaluate(() => room), 'room_vault5', 'first session opens too');
    check(await online(p), 'first session connects with the vaulted password');
    await p.context().close();
  });

  await T.closeBrowser(); await host.stop(); await web.close();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
