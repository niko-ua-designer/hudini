// web/app/store.js с подменённым window.__TAURI__: запись не должна затирать хранилище, которое не удалось прочитать.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app', 'store.js'), 'utf8');
let fails = 0;
const eq = (a, b, m) => { if(JSON.stringify(a) !== JSON.stringify(b)){ fails++; console.log('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function harness(load){
  const saves = [], events = [], w = { __calls: saves, events };
  w.window = w; Object.assign(w, { setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, JSON, String, Array, Object, Error });
  w.__TAURI__ = { core: { async invoke(cmd, args){
    if(cmd === 'store_load') return load();
    if(cmd === 'store_save'){ saves.push(JSON.parse(JSON.stringify(args.data))); return null; }
  } } };
  w.addEventListener = () => {}; w.dispatchEvent = e => { events.push(e.detail); return true; };
  w.CustomEvent = class { constructor(t, o){ this.type = t; this.detail = o?.detail; } };
  w.document = { addEventListener(){}, visibilityState: 'visible' };
  w.console = { warn(){}, log: console.log };
  vm.runInNewContext(src, w);
  return w;
}

(async () => {
  // store_load отказывает: ничего не пишем, потом чтение удалось: данные слиты и сохранены
  let ok = false;
  let w = harness(() => { if(!ok) throw new Error('locked'); return { old: 1, keep: 2 }; });
  await w.HudiniStore.ready;
  eq(w.events.length, 1, 'load error is reported');
  w.HudiniStore.set('fresh', 5); w.HudiniStore.remove('keep');
  await sleep(400);
  eq(w.__calls.length, 0, 'no store_save while the load has failed');
  await w.HudiniStore.flushNow();
  eq(w.__calls.length, 0, 'flushNow does not save either');
  ok = true;
  await sleep(3500);
  eq(w.__calls.at(-1), { old: 1, fresh: 5 }, 'loaded data merged with keys set meanwhile and saved');
  eq(w.HudiniStore.get('old'), 1, 'old key readable');
  w.HudiniStore.set('x', 1); await sleep(400);
  eq(w.__calls.at(-1), { old: 1, fresh: 5, x: 1 }, 'saving works after recovery');

  // чистый старт ({} при NotFound)
  w = harness(() => ({}));
  await w.HudiniStore.ready;
  w.HudiniStore.set('a', 1); await sleep(400);
  eq(w.__calls, [{ a: 1 }], 'empty store: saving works');
  eq(w.events.length, 0, 'no error event on a fresh start');
  process.exit(fails ? 1 : 0);
})();
