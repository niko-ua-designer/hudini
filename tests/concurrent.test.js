// Two and three panels editing one screen at the same moment: changes to different elements all survive, panels and the
// stream end up with the same screen, deleted elements stay deleted and the panels stop talking once they agree.
// "At the same moment" is forced: a panel's incoming messages are held until every edit has been sent.
'use strict';
const T = require('./lib');
const { step, check, eq, until, sleep } = T;

(async () => {
  const S = await T.stack({ hostEnv: { OVERLAY_SITE: 'off' } });
  const { panel: mod, widget: wid, host } = S;
  const inv = await mod.evaluate(() => inviteLink(curRoom()));
  const join = async name => {
    const p = await T.newPage(name);
    await p.goto(inv);
    await p.waitForFunction(() => typeof curRoom === 'function' && curRoom());
    await T.attach(p, host);
    await until(async () => (await p.getAttribute('#status', 'class')).includes('ok'), 12000);
    return p;
  };
  const mod2 = await join('mod2'), mod3 = await join('mod3');
  const panels = [mod, mod2, mod3];

  const edit = (p, code) => p.evaluate(`(() => { beginChange(); ${code} commit(); })()`);
  // one line per screen: layers from bottom to top, then the raffle and the volume
  const LINE = `s => s ? s.els.map(e => [e.id, e.text ?? e.title ?? (e.type==='counter' ? e.value : e.type), Math.round(e.x), e.hidden ? 'h' : ''].join(':').replace(/:$/, '')).join(' ') + ' | vol ' + s.vol : ''`;
  const view = p => p.evaluate(`(${LINE})(state)`);
  const widView = () => wid.evaluate(`(${LINE})(lastState)`);
  const views = () => Promise.all([...panels.map(view), widView()]);
  const stage = async (want, ms = 8000) => {
    const ok = await until(async () => (await views()).every(v => v === want), ms, 50);
    if(!ok) console.log('   want:', want, '\n   panels and stream:', await views());
    return ok;
  };
  // how many screens each panel has sent
  const count = p => p.evaluate(() => { window.__sent = 0; if(client.__counted) return; client.__counted = true; const send = client.publish.bind(client); client.publish = (topic, ...rest) => { if(topic.endsWith('/state')) window.__sent++; return send(topic, ...rest); }; });
  const sentCounts = () => Promise.all(panels.map(p => p.evaluate(() => window.__sent)));
  const hold = p => p.evaluate(() => {
    const c = client, real = c.listeners('message'), q = []; c.removeAllListeners('message'); c.on('message', (...a) => q.push(a));
    window.__held = () => q.filter(a => a[0].endsWith('/state')).length;
    window.__release = () => { c.removeAllListeners('message'); for(const f of real) c.on('message', f); for(const a of q) for(const f of real) f(...a); };
  });
  // every panel edits without having seen the others' edits; edits are sent in the given order, so the last one has the newest time
  const together = async (...edits) => {
    for(const p of panels) await hold(p);
    for(const [p, code] of edits){ await edit(p, code); await sleep(30); }
    for(const p of panels) check(await until(async () => (await p.evaluate(() => __held())) >= edits.length, 8000, 30), 'all screens are waiting at the panel');
    for(const p of panels) await p.evaluate(() => __release());
  };
  // after the panels agree, nothing more is sent
  const quiet = async (max, what) => {
    await sleep(500); const a = await sentCounts(); await sleep(1200); const b = await sentCounts();
    eq(b, a, what + ': the panels have stopped sending');
    check(a.reduce((x, y) => x + y, 0) <= max, what + `: at most ${max} screens were sent`, a);
  };
  const text = (id, x, label) => `sanitizeEl({ id: "${id}", type: "text", text: "${label}", x: ${x}, y: 50 })`;
  const reset = async () => {
    await sleep(300);
    await edit(mod, `state.els = [${text('a', 10, 'A')}, ${text('b', 20, 'B')}, ${text('c', 30, 'C')}]; state.vol = 1;`);
    check(await stage('a:A:10 b:B:20 c:C:30 | vol 1'), 'starting screen: a, b, c everywhere');
    // forget the edits of earlier steps, so every step starts clean
    for(const p of panels) await p.evaluate(() => { undoStack.length = 0; redoStack.length = 0; });
    for(const p of panels) await count(p);
  };

  for(const [name, first, second] of [['the second panel sends later', mod, mod2], ['the second panel sends first', mod2, mod]]){
    await step('different elements at once, ' + name, async () => {
      await reset();
      const code = new Map([[mod, 'byId("a").x = 70;'], [mod2, 'byId("b").text = "B2";']]);
      await together([first, code.get(first)], [second, code.get(second)]);
      check(await stage('a:A:70 b:B2:20 c:C:30 | vol 1'), 'both changes are on both panels, the third panel and the stream');
      await quiet(4, 'two edits');
      await mod.evaluate(() => undo());
      check(await stage('a:A:10 b:B2:20 c:C:30 | vol 1'), 'undo takes back only my change');
    });
  }

  await step('three panels at once', async () => {
    await reset();
    await together([mod, 'byId("a").x = 71;'], [mod2, 'byId("b").x = 72;'], [mod3, 'byId("c").x = 73;']);
    check(await stage('a:A:71 b:B:72 c:C:73 | vol 1'), 'all three changes survive');
    await quiet(9, 'three edits');
  });

  await step('new elements, a common setting and an element change at once', async () => {
    await reset();
    await together([mod, `state.els.push(${text('d', 40, 'D')});`], [mod2, `state.els.push(${text('e', 60, 'E')}); byId("a").x = 15;`], [mod3, 'state.vol = 0.5;']);
    check(await until(async () => { const v = await views(); return v.every(x => x === v[0]) && /a:A:15/.test(v[0]) && /d:D:40/.test(v[0]) && /e:E:60/.test(v[0]) && /vol 0\.5/.test(v[0]); }, 8000, 50), 'both new elements, the move and the volume are everywhere', await views());
    await quiet(9, 'three edits');
  });

  await step('layer order and a text change at once', async () => {
    await reset();
    await together([mod, 'state.els.reverse();'], [mod2, 'byId("b").text = "B3";']);
    check(await stage('c:C:30 b:B3:20 a:A:10 | vol 1'), 'new order and new text');
    await quiet(4, 'two edits');
  });

  for(const [name, order] of [['the delete is sent later', ['edit', 'del']], ['the delete is sent first', ['del', 'edit']]]){
    await step('edit against delete, ' + name, async () => {
      await reset();
      const ops = { edit: [mod, 'byId("b").text = "edited"; byId("a").x = 11;'], del: [mod2, 'state.els = state.els.filter(e => e.id !== "b");'] };
      await together(...order.map(k => ops[k]));
      check(await stage('a:A:11 c:C:30 | vol 1'), 'the deleted element is gone everywhere, the other change stays');
      await quiet(4, 'two edits');
      for(const p of panels) await p.evaluate(() => publishNow(1));   // the minute's resend
      await sleep(500);
      check(await stage('a:A:11 c:C:30 | vol 1'), 'and does not come back');
      await mod2.evaluate(() => undo());
      check(await until(async () => (await views()).every(v => /^a:A:11 b:(B|edited):20 c:C:30 /.test(v)), 8000, 50), 'the panel that deleted it can bring it back', await views());
    });
  }

  await step('the same element at once: the newest change wins everywhere', async () => {
    await reset();
    await together([mod, 'byId("a").text = "older";'], [mod2, 'byId("a").text = "newer";']);
    check(await stage('a:newer:10 b:B:20 c:C:30 | vol 1'), 'one winner');
    await quiet(3, 'two edits');
  });

  await step('two changes in a row against one from another panel', async () => {
    await reset();
    await hold(mod); await hold(mod2);
    await edit(mod2, 'byId("b").text = "B4";'); await sleep(30);
    await edit(mod, 'byId("a").x = 12;'); await sleep(30);
    await edit(mod, 'byId("c").x = 33;'); await sleep(200);
    await mod2.evaluate(() => __release()); await mod.evaluate(() => __release());
    check(await stage('a:A:12 b:B4:20 c:C:33 | vol 1'), 'all of them survive');
    await quiet(5, 'three edits');
  });

  await step('another panel\'s screen arrives before my change was sent', async () => {
    await reset();
    await hold(mod);
    await edit(mod2, 'byId("b").text = "early";');
    await until(async () => (await mod.evaluate(() => __held())) >= 1);
    // the send is put off, and the other screen is read in the meantime
    await mod.evaluate(() => { lastSend = performance.now() + 1000; beginChange(); byId('a').x = 44; changed(); __release(); });
    check(await stage('a:A:44 b:early:20 c:C:30 | vol 1'), 'my unsent change and their text are both there');
    await mod.evaluate(() => { commit(); undo(); });
    check(await stage('a:A:10 b:early:20 c:C:30 | vol 1'), 'undo takes back only my change');
  });

  for(const [name, theirsFirst] of [['their screen is older than mine', true], ['their screen is newer than mine', false]]){
    await step('a change still held open on my panel while another panel edits, ' + name, async () => {
      await reset();
      await hold(mod); await hold(mod2);
      const theirs = () => edit(mod2, 'byId("b").text = "mid";');
      const mine = () => mod.evaluate(() => { beginChange(); byId('a').x = 55; changed(); });   // e.g. a slider still held
      for(const send of theirsFirst ? [theirs, mine] : [mine, theirs]){ await send(); await sleep(150); }
      await mod2.evaluate(() => __release()); await mod.evaluate(() => __release());
      check(await stage('a:A:55 b:mid:20 c:C:30 | vol 1'), 'both changes are everywhere');
      await mod.evaluate(() => { byId('a').x = 60; commit(); });
      check(await stage('a:A:60 b:mid:20 c:C:30 | vol 1'), 'the finished change reached everyone');
      await mod.evaluate(() => undo());
      check(await stage('a:A:10 b:mid:20 c:C:30 | vol 1'), 'undo moves a back and leaves their text');
    });
  }

  await step('a counter button pressed while another panel moves another element', async () => {
    await reset();
    await edit(mod, 'state.els.push(sanitizeEl({ id: "n", type: "counter", cmode: "chat", value: 5, x: 80, y: 50 }));');
    check(await stage('a:A:10 b:B:20 c:C:30 n:5:80 | vol 1'), 'a chat counter everywhere');
    for(const p of panels) await count(p);
    await together([mod, 'byId("n").value = 6;'], [mod2, 'byId("a").x = 13;']);
    check(await stage('a:A:13 b:B:20 c:C:30 n:6:80 | vol 1'), 'the count and the move survive');
    await quiet(4, 'two edits');
  });

  await step('a new stroke on a drawing while another panel hides or shows it', async () => {
    await reset();
    const stroke = id => `{ id: "${id}", by: "t", tool: "pen", color: "#ff0000", size: 6, pts: [100, 100, 200, 200], t: Date.now() }`;
    await edit(mod, `state.els.push(sanitizeEl({ id: "w", type: "draw", x: 50, y: 50, strokes: [${stroke('first111')}], del: [] }));`);
    check(await stage('a:A:10 b:B:20 c:C:30 w:draw:50 | vol 1'), 'a drawing everywhere');
    for(const p of panels) await count(p);
    const drawing = () => Promise.all([...panels.map(p => p.evaluate(() => byId('w').strokes.map(k => k.id).sort().join())), wid.evaluate(() => lastState.els.find(e => e.id === 'w').strokes.map(k => k.id).sort().join())]);
    for(const [hideFirst, hidden, id] of [[true, true, 'second22'], [false, false, 'third333']]){
      const eye = [mod, `byId("w").hidden = ${hidden};`], paint = [mod2, `byId("w").strokes = [...byId("w").strokes, ${stroke(id)}];`];
      await together(...hideFirst ? [eye, paint] : [paint, eye]);
      const how = hideFirst ? 'eye sent first' : 'stroke sent first';
      check(await until(async () => (await drawing()).every(s => s.includes(id) && s.includes('first111'))), how + ': the stroke is everywhere', await drawing());
      check(await stage(`a:A:10 b:B:20 c:C:30 w:draw:50${hidden ? ':h' : ''} | vol 1`), how + ': and so is the other change');
    }
    await quiet(10, 'two rounds');
  });

  await step('a screen without version marks (an older panel) is taken as it is', async () => {
    await reset();
    await edit(mod, 'byId("a").x = 80;');
    check(await stage('a:A:80 b:B:20 c:C:30 | vol 1'), 'my move reached everyone');
    for(const p of panels) await count(p);
    await mod2.evaluate(() => sealedPublish(topics(room).state, { v: 2, wv: WIDGET_VER, from: 'mod_older', t: Date.now() + 50, visible: true, vol: 1,
      els: state.els.map(e => e.id === 'a' ? { ...e, x: 10 } : e) }, { qos: 1, retain: true }));
    check(await stage('a:A:10 b:B:20 c:C:30 | vol 1'), 'it replaced the screen, as before');
    await quiet(1, 'old screen');   // the one sent above by hand
    await edit(mod3, 'byId("b").x = 25;');
    check(await stage('a:A:10 b:B:25 c:C:30 | vol 1'), 'and a later change does not bring my move back');
  });

  eq(T.pageErrors, [], 'no page errors');
  await mod2.context().close(); await mod3.context().close();
  await S.close(); await T.closeBrowser();
  process.exit(T.finish());
})().catch(e => { console.error(e); process.exit(1); });
