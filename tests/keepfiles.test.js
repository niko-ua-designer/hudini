// "Delete unused files" and several moderators: every panel tells the Host which files it uses (screen, scenes, library,
// scenarios), and cleaning removes only the files that are in nobody's list.
'use strict';
const fs = require('fs'), path = require('path'), https = require('https');
const T = require('./lib');
const { step, check, eq, until, sleep } = T;
const IMG = [...fs.readFileSync(path.join(__dirname, 'fixtures/img.png'))];

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: a, web, link } = S;
  let host = S.host;
  const dir = host.dir, listFile = path.join(dir, 'files-keep.json');
  const lists = () => { try{ return JSON.parse(fs.readFileSync(listFile, 'utf8')); }catch{ return null; } };
  const { pass } = await host.code();
  const req = (method, p, body, pw = pass) => new Promise((ok, no) => {
    const data = body === undefined || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const r = https.request({ host: '127.0.0.1', port: host.modPort, path: p, method, rejectUnauthorized: false, headers: { authorization: 'Bearer ' + pw, 'content-type': 'application/octet-stream' } },
      res => { let t = ''; res.on('data', d => t += d); res.on('end', () => { let j = {}; try{ j = JSON.parse(t); }catch{} ok({ status: res.statusCode, ...j }); }); });
    r.on('error', no); r.end(data);
  });
  const put = (id, panel) => req('PUT', `/files/${id}?part=0&last=1${panel ? '&panel=' + panel : ''}`, Buffer.alloc(200, 7));
  const have = async () => (await req('GET', '/files')).ids.map(x => x[0]);
  const upload = (p, name) => p.evaluate(async ([img, name]) => (await uploadBlob(new Blob([new Uint8Array(img)], { type: 'image/png' }), name)).slice(6), [IMG, name]);

  const b = await T.newPage('panel-b');
  await b.goto(await a.evaluate(() => inviteLink(curRoom())));
  await b.waitForFunction(() => typeof curRoom === 'function' && curRoom());
  await T.attach(b, host);
  const dialogs = []; b.on('dialog', d => dialogs.push(d.message()));
  let inLib, inScene, inScn, junk;

  await step('files kept only in one moderator\'s library, scenes and scenarios survive another moderator\'s cleaning', async () => {
    check(await until(async () => (await b.getAttribute('#status', 'class')).includes('ok'), 15000), 'the second moderator is online');
    [inLib, inScene, inScn] = [await upload(a, 'lib.png'), await upload(a, 'scene.png'), await upload(a, 'scn.png')];
    await a.evaluate(([l, s, c]) => {
      library.push({ name: 'x', room, el: sanitizeEl({ id: 'x', type: 'image', src: 'asset:' + l, x: 50, y: 50, w: 20 }) }); saveLib();
      (scenes[room] ||= []).push({ name: 's', els: [sanitizeEl({ id: 'y', type: 'image', src: 'asset:' + s, x: 50, y: 50, w: 20 })] }); saveScenes();
      scnList().push(cleanScn({ id: 'scn1', name: 'n', trig: { type: 'manual' }, acts: [{ t: 'sound', url: 'asset:' + c }] })); saveScn();
    }, [inLib, inScene, inScn]);
    junk = await upload(b, 'junk.png');
    check(await until(() => { const l = lists(); return l && Object.values(l.panels).some(x => [inLib, inScene, inScn].every(id => x.ids.includes(id))); }, 8000), 'the Host has the first panel\'s list');
    await b.evaluate(() => cleanFiles());
    check(await until(async () => !(await have()).includes(junk)), 'the file nobody uses is deleted');
    const left = await have();
    eq([inLib, inScene, inScn].filter(id => left.includes(id)).length, 3, 'library, scene and scenario files of the other moderator are still there');
    const q = dialogs.at(-1) || '';
    check(/Удалить 1 файлов/.test(q), 'the question counts only what will be deleted: ' + q);
    check(/не подключались после обновления/.test(q), 'it warns about moderators who have not connected since the update');
  });

  await step('a file that is uploaded but not on the canvas yet survives another moderator\'s cleaning', async () => {
    const fresh = await upload(b, 'fresh.png');
    const listOfB = async () => lists()?.panels[await b.evaluate(() => panelId())]?.ids || [];
    // the panel's list changes for another reason before the new file is placed, so it is sent again
    await b.evaluate(id => { library.push({ name: 'other', room, el: sanitizeEl({ id: 'o', type: 'image', src: 'asset:' + id, x: 50, y: 50, w: 20 }) }); saveLib(); }, inLib);
    check(await until(async () => (await listOfB()).includes(inLib), 8000), 'the new list reached the Host');
    eq((await req('POST', '/files/clean', { keep: [] })).status, 200, 'another panel cleans');
    check((await have()).includes(fresh), 'the new file is still there');
    await b.evaluate(id => { library.push({ name: 'fresh', room, el: sanitizeEl({ id: 'f', type: 'image', src: 'asset:' + id, x: 50, y: 50, w: 20 }) }); saveLib(); }, fresh);
    await sleep(3000);
    await b.evaluate(() => { library.splice(0); saveLib(); });
    check(await until(async () => !(await listOfB()).length, 8000), 'once it was placed and removed, the panel no longer lists it');
    await req('POST', '/files/clean', { keep: [] });
    check(!(await have()).includes(fresh), 'and cleaning removes it');
  });

  await step('the lists survive a Host restart, also for a moderator who is no longer online', async () => {
    await a.context().close();
    await host.stop();
    host = T.startHost({ OVERLAY_HOST_DIR: dir, OVERLAY_SITE: 'off' }); await host.ready();
    check(await until(async () => (await b.getAttribute('#status', 'class')).includes('ok'), 30000), 'the second moderator is back');
    const junk2 = await upload(b, 'junk2.png');
    await b.evaluate(() => cleanFiles());
    check(await until(async () => !(await have()).includes(junk2)), 'junk deleted');
    const left = await have();
    eq([inLib, inScene, inScn].filter(id => left.includes(id)).length, 3, 'the offline moderator\'s files are kept');
  });

  await step('an old panel (no panel id) cleans without touching other lists', async () => {
    await put('oldpaneljunkaaaa'); await put('oldpanelkeepaaaa');
    eq((await req('POST', '/files/clean', { keep: ['oldpanelkeepaaaa'] })).status, 200, 'old style request works');
    const left = await have();
    check(!left.includes('oldpaneljunkaaaa') && left.includes('oldpanelkeepaaaa'), 'its own list is honoured: ' + left);
    eq([inLib, inScene, inScn].filter(id => left.includes(id)).length, 3, 'files from the stored lists are kept');
  });

  await step('an upload by a panel that has not sent a list yet is kept until it sends one', async () => {
    const newbie = 'newbiepanelaaaaaaaaa';
    await put('newbiefileaaaaaaa', newbie);
    await req('POST', '/files/clean', { keep: [] });
    check((await have()).includes('newbiefileaaaaaaa'), 'another panel\'s cleaning keeps it');
    check((await req('GET', '/files')).held.includes('newbiefileaaaaaaa'), 'the listing says it is held');
    check(!(await req('GET', '/files?panel=' + newbie)).held.includes('newbiefileaaaaaaa'), 'but not against its own panel');
    eq((await req('POST', '/files/keep', { id: newbie, keep: [] })).status, 200, 'the panel reports an empty list');
    await req('POST', '/files/clean', { keep: [] });
    check(!(await have()).includes('newbiefileaaaaaaa'), 'now it is nobody\'s file and goes');
  });

  await step('lists are validated and bounded', async () => {
    eq((await req('POST', '/files/keep', { id: '../x', keep: [] })).status, 400, 'bad panel id refused');
    eq((await req('POST', '/files/keep', { id: 'goodpanelaaaaaaa', keep: 'x' })).status, 400, 'no list refused');
    eq((await req('POST', '/files/keep', { id: 'goodpanelaaaaaaa', keep: [] }, 'wrong')).status, 401, 'password needed');
    await req('POST', '/files/keep', { id: 'goodpanelaaaaaaa', keep: [inLib, inLib, '../../etc', 5, null, { a: 1 }, 'nosuchfileaaaaaa'] });
    eq(lists().panels.goodpanelaaaaaaa.ids, [inLib], 'only names of files that exist are stored, once');
    for(let i = 0; i < 80; i++) await req('POST', '/files/keep', { id: 'manypanels' + String(i).padStart(6, '0'), keep: [inLib] });
    const p = Object.keys(lists().panels);
    check(p.length === 64 && p.includes('manypanels000079'), 'at most 64 panels, the newest stay: ' + p.length);
    await host.api('/api/control', { action: 'pause' });
    eq((await req('POST', '/files/keep', { id: 'goodpanelaaaaaaa', keep: [] })).status, 423, 'refused on pause');
    await host.api('/api/control', { action: 'resume' });
  });

  await step('a Host without file lists: the new panel asks once per connection and cleans as before', async () => {
    const c = await T.newPage('panel-old-host');
    let asked = 0;
    await c.context().route(/\/files\/keep$/, r => { if(r.request().method() === 'POST') asked++; return r.fulfill({ status: 400, body: '{"ok":false}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' } }); });
    await c.goto(await b.evaluate(() => inviteLink(curRoom())));
    await c.waitForFunction(() => typeof curRoom === 'function' && curRoom());
    await T.attach(c, host);
    check(await until(async () => (await c.getAttribute('#status', 'class')).includes('ok'), 15000), 'online');
    await until(() => asked > 0, 8000);
    await c.evaluate(() => { library.push({ name: 'z', room, el: sanitizeEl({ id: 'z', type: 'text', text: 'z', x: 1, y: 1 }) }); saveLib(); });
    await sleep(5000);
    eq(asked, 1, 'asked once');
    await c.context().close();
  });

  await step('a 423 answer to the list (pause) is not retried until the next connection', async () => {
    const c = await T.newPage('panel-paused');
    let asked = 0;
    await c.context().route(/\/files\/keep$/, r => { if(r.request().method() === 'POST') asked++; return r.fulfill({ status: 423, body: '{"ok":false}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' } }); });
    await c.goto(await b.evaluate(() => inviteLink(curRoom())));
    await c.waitForFunction(() => typeof curRoom === 'function' && curRoom());
    await T.attach(c, host);
    check(await until(async () => (await c.getAttribute('#status', 'class')).includes('ok'), 15000), 'online');
    await until(() => asked > 0, 8000);
    await c.evaluate(() => { library.push({ name: 'p', room, el: sanitizeEl({ id: 'p', type: 'text', text: 'p', x: 1, y: 1 }) }); saveLib(); });
    await sleep(5000);
    eq(asked, 1, 'asked once');
    await host.api('/api/control', { action: 'pause' });
    check(await until(async () => !(await c.evaluate(() => !!client?.connected)), 10000), 'the pause drops the panel');
    await host.api('/api/control', { action: 'resume' });
    check(await until(() => asked > 1, 40000), 'asks again after reconnecting');
    await c.context().close();
  });

  await step('a new room starts with empty lists', async () => {
    await b.context().close();
    check(Object.keys(lists().panels).length > 0, 'there are lists before');
    await host.api('/api/room/new', { name: 'Новая' });
    eq(Object.keys(lists()?.panels || {}).length, 0, 'recreating the room clears them');
  });

  await host.stop(); await web.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
