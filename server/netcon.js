// Пролёты камеры CS2 для наблюдателя и демки: клиент консоли игры (параметр запуска -netconport) и проигрыватель маршрутов.
// Защита от бана и от подмены: соединение только с 127.0.0.1; в консоль уходят три команды (spec_goto, getpos, spec_mode),
// числа проверяются и форматируются здесь, текст из пульта в консоль не попадает никогда. Пока GSI не показывает наблюдателя
// или демку (out.spec), порт даже не открывается: когда стример играет сам, этот файл молчит полностью.
// ЖЁСТКОЕ ОГРАНИЧЕНИЕ: никаких инжектов в процесс игры, чтения или записи её памяти, хуков, оверлеев поверх процесса,
// эмуляции клавиш и мыши. Никаких файлов игры: не создаём, не меняем и не подменяем ничего ни в папке игры, ни в её cfg/.
// Только консольные команды через штатный -netconport (параметр запуска, который стример добавляет сам).
// Этот файл вообще не работает с диском и процессами (нет fs и child_process): чтение и запись data/cs2-flights.json
// делает server.js через load/save, переданные в createFlight. Проверяет tests/cs2flight.test.js.
import net from 'node:net';

export const NETCON_HOST = '127.0.0.1';
const MAX_ABS = 100000;                      // координаты карты CS2 по модулю не больше этого
const NUM_RE = /^-?\d{1,6}(\.\d{1,6})?$/;

// ---------- команды: единственное место, где строится текст для консоли ----------
const fmt = v => (typeof v==='number' && Number.isFinite(v) && Math.abs(v) <= MAX_ABS) ? v.toFixed(2) : null;
export function buildCmd(name, ...args){
  if(name==='getpos') return args.length ? null : 'getpos';
  if(name==='spec_mode'){ const n = args[0]; return args.length===1 && Number.isInteger(n) && n>=0 && n<=6 ? `spec_mode ${n}` : null; }
  if(name==='spec_goto'){
    if(args.length!==5) return null;
    const f = args.map(fmt); return f.every(Boolean) ? `spec_goto ${f.join(' ')}` : null;
  }
  return null;
}
// Последняя проверка перед записью в сокет: строка должна совпасть с одной из трёх форм целиком
const WIRE_RE = /^(getpos|spec_mode [0-6]|spec_goto (-?\d{1,6}\.\d\d )(-?\d{1,6}\.\d\d )(-?\d{1,6}\.\d\d )(-?\d{1,6}\.\d\d )-?\d{1,6}\.\d\d)$/;
export const isWireOk = s => typeof s==='string' && WIRE_RE.test(s);

// Ответ на getpos: «setpos x y z;setang pitch yaw roll». Возвращает { p:[x,y,z], a:[pitch,yaw,roll] } или null.
export function parseGetpos(line){
  const m = /setpos\s+(\S+)\s+(\S+)\s+(\S+)\s*;\s*setang\s+(\S+)\s+(\S+)\s+(\S+)/.exec(String(line ?? '').slice(0, 400));
  if(!m) return null;
  const v = m.slice(1).map(s => NUM_RE.test(s) ? Number(s) : NaN);
  if(!v.every(Number.isFinite) || v.some(x => Math.abs(x) > MAX_ABS)) return null;
  return { p:v.slice(0, 3), a:v.slice(3) };
}

// ---------- клиент консоли ----------
export const cleanPort = v => { const n = Number(v); return Number.isInteger(n) && n>=1024 && n<=65535 ? n : 0; };
export class Netcon {
  // gate() — разрешено ли сейчас трогать игру (наблюдатель/демка); connectFn подменяют тесты
  constructor({ port, gate, onLine, onState, now = Date.now, connectFn = net.connect }){
    this.port = cleanPort(port); this.gate = gate; this.onLine = onLine || (() => {}); this.onState = onState || (() => {});
    this.now = now; this.connectFn = connectFn; this.sock = null; this.up = false; this.buf = ''; this.retryAt = 0; this.sent = []; this.log = [];
  }
  open(){
    if(this.sock || !this.port || !this.gate()) return false;
    if(this.now() < this.retryAt) return false;
    const s = this.sock = this.connectFn({ host:NETCON_HOST, port:this.port });
    s.setEncoding?.('utf8');
    s.on('connect', () => { this.up = true; this.onState(true); });
    s.on('data', d => {
      this.buf += d; if(this.buf.length > 65536) this.buf = this.buf.slice(-4096);
      let i; while((i = this.buf.indexOf('\n')) >= 0){ const ln = this.buf.slice(0, i).replace(/\r$/, ''); this.buf = this.buf.slice(i+1); if(ln) this.onLine(ln); }
    });
    const gone = () => { if(this.sock !== s) return; this.sock = null; const was = this.up; this.up = false; this.buf = ''; this.retryAt = this.now() + 3000; if(was) this.onState(false); };
    s.on('error', gone); s.on('close', gone);
    return true;
  }
  close(){ const s = this.sock; this.sock = null; this.up = false; this.buf = ''; try{ s?.destroy(); }catch{} }
  // Единственный способ что-то отправить. false — команда отвергнута или нельзя (не наблюдатель, нет связи, слишком часто).
  send(name, ...args){
    if(!this.gate()){ this.close(); return false; }
    const line = buildCmd(name, ...args);
    if(!line || !isWireOk(line)) return false;
    if(!this.sock) this.open();
    if(!this.up) return false;
    const t = this.now(); this.sent = this.sent.filter(x => t - x < 1000);
    if(this.sent.length >= 150) return false;                   // потолок 150 команд в секунду
    this.sent.push(t);
    try{ this.sock.write(line + '\n'); }catch{ return false; }
    return true;
  }
}

// ---------- сплайн Catmull-Rom ----------
const wrap180 = a => ((a + 540) % 360 + 360) % 360 - 180;
// pts: [{p:[x,y,z], a:[pitch,yaw,roll]}], u 0..1 → { p, a }; угол yaw разворачиваем, чтобы не крутить камеру через весь круг
export function splineAt(pts, u, ws){
  const n = pts.length; if(!n) return null;
  if(n===1) return { p:pts[0].p.slice(), a:pts[0].a.slice(0, 2) };
  u = Math.min(Math.max(u, 0), 1);
  // ws — длительности отрезков (n-1 чисел > 0): позиция по времени переходит в параметр сплайна
  if(Array.isArray(ws) && ws.length===n-1){
    const tot = ws.reduce((x, y) => x + y, 0); let acc = 0; const target = u * tot;
    for(let i = 0; i < ws.length; i++){ if(target <= acc + ws[i] || i===ws.length-1){ u = (i + (ws[i] ? Math.min(1, (target - acc) / ws[i]) : 0)) / (n - 1); break; } acc += ws[i]; }
  }
  const yaws = [pts[0].a[1]]; for(let i = 1; i < n; i++) yaws.push(yaws[i-1] + wrap180(pts[i].a[1] - yaws[i-1]));
  const t = Math.min(Math.max(u, 0), 1) * (n - 1), i = Math.min(n - 2, Math.floor(t)), f = t - i;
  const at = (k, get) => get(Math.min(n - 1, Math.max(0, k)));
  const cr = (get) => { const p0 = at(i-1, get), p1 = at(i, get), p2 = at(i+1, get), p3 = at(i+2, get), f2 = f*f, f3 = f2*f;
    return .5 * ((2*p1) + (-p0 + p2)*f + (2*p0 - 5*p1 + 4*p2 - p3)*f2 + (-p0 + 3*p1 - 3*p2 + p3)*f3); };
  return { p:[0, 1, 2].map(c => cr(k => pts[k].p[c])), a:[Math.max(-89, Math.min(89, cr(k => pts[k].a[0]))), wrap180(cr(k => yaws[k]))] };
}
// ---------- план пролёта: пути, обрывы, паузы ----------
// steps: [{ pts, join:'smooth'|'cut', pause }] (join и pause первого шага не нужны). Точка с j:1 — обрыв: камера прыгает в неё одним spec_goto.
// Сплайн на обрыве разрывается; плавное соединение путей без паузы продолжает тот же сплайн, с паузой камера стоит и потом плывёт дальше.
export const HOLD1 = 0.05;
export function runsOf(steps){
  const runs = [];
  steps.forEach((st, si) => {
    let cur = null, pend = 0;
    if(si > 0){
      const prev = runs[runs.length - 1], pause = st.pause > 0 ? st.pause : 0;
      if(st.join !== 'cut'){ if(pause > 0){ cur = { pause, pts:[prev.pts[prev.pts.length - 1]], w:[] }; runs.push(cur); } else cur = prev; }
      else pend = pause;
    }
    st.pts.forEach((q, i) => {
      if(!cur || (i > 0 && q.j === 1)){ cur = { pause:i===0 ? pend : 0, pts:[q], w:[] }; runs.push(cur); }
      else { cur.pts.push(q); cur.w.push(q.t > 0 ? q.t : 0); }
    });
  });
  return runs;
}
// Фиксированное время плана (паузы и стоянка на одиночных точках) и число секунд, которое уйдёт на движение при весе 1
export const fixedSec = runs => runs.reduce((a, r) => a + r.pause + (r.pts.length===1 ? HOLD1 : 0), 0);
// Раскладка по времени: moveSec — секунды на плавное движение (всё остальное — паузы). Возвращает { runs (с t0, dur, ws), total }
export function layout(runs, moveSec){
  const all = runs.flatMap(r => r.w), pos = all.filter(x => x > 0), avg = pos.length ? pos.reduce((a, b) => a + b, 0) / pos.length : 1;
  const raw = runs.map(r => r.w.map(x => x > 0 ? x : avg)), W = raw.flat().reduce((a, b) => a + b, 0), k = W > 0 ? Math.max(0.1, moveSec) / W : 0;
  let t = 0;
  const out = runs.map((r, i) => { const ws = raw[i].map(x => x * k), dur = r.pts.length===1 ? HOLD1 : ws.reduce((a, b) => a + b, 0);
    const o = { pts:r.pts, ws, t0:t + r.pause, dur }; t = o.t0 + dur; return o; });
  return { runs:out, total:t };
}
// Что слать в момент el секунд от старта: { i, pos } (pos null — камера стоит на паузе), done — план кончился
export function planAt(plan, el){
  for(let i = 0; i < plan.runs.length; i++){
    const r = plan.runs[i];
    if(el < r.t0) return { i:i - 1, pos:null, done:false };
    if(el < r.t0 + r.dur || i===plan.runs.length - 1){
      const u = r.dur > 0 ? ease((el - r.t0) / r.dur) : 1;
      return { i, pos:splineAt(r.pts, u, r.pts.length > 1 ? r.ws : undefined), done:el >= r.t0 + r.dur };
    }
  }
  return { i:-1, pos:null, done:true };
}
export const ease = s => { const x = Math.min(Math.max(s, 0), 1); return x*x*x*(x*(6*x - 15) + 10); };   // плавный разгон и торможение

// ---------- маршруты и настройки ----------
export const FL_MAX = { maps:40, routes:8, pts:40, name:40 };
const mapKey = v => String(v ?? '').replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 40);
const nm = v => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, FL_MAX.name);
const idOf = v => String(v ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
const vec = (v, k) => Array.isArray(v) && v.length>=k && v.slice(0, k).every(x => typeof x==='number' && Number.isFinite(x) && Math.abs(x) <= MAX_ABS) ? v.slice(0, k).map(x => Math.round(x*100)/100) : null;
function cleanPts(a){
  const out = []; for(const q of (Array.isArray(a) ? a : []).slice(0, FL_MAX.pts)){
    const p = vec(q?.p, 3), an = vec(q?.a, 3), t = Number(q?.t);
    if(p && an) out.push({ p, a:an, t:Number.isFinite(t) && t > 0 ? Math.min(120, Math.round(t*10)/10) : 0, j:q?.j===1 || q?.j===true ? 1 : 0 });
  }
  return out;
}
const TRG_KEYS = ['freeze', 'tech', 'timeout', 'warmup'];
const cleanTrg = t => ({ freeze:t?.freeze!==false, tech:t?.tech===true, timeout:t?.timeout!==false, warmup:t?.warmup===true });
export function cleanRoute(r, id){
  const dur = Number(r?.dur);
  return { id:idOf(id ?? r?.id), name:nm(r?.name) || 'Route', pts:cleanPts(r?.pts), dur:Number.isFinite(dur) && dur > 0 ? Math.min(300, Math.round(dur*10)/10) : 0, trg:cleanTrg(r?.trg) };
}
// Цепочка пролётов на момент: до 6 путей подряд; join — как попасть в начало следующего (плавно/обрыв), pause — секунды стоянки перед ним
export const CHAIN_MAX = 6;
const cleanStep = q => { const pa = Number(q?.pause); return { id:idOf(q?.id), join:q?.join==='cut' ? 'cut' : 'smooth', pause:Number.isFinite(pa) && pa > 0 ? Math.min(60, Math.round(pa*10)/10) : 0 }; };
export const cleanChains = ch => Object.fromEntries(TRG_KEYS.map(k => [k, (Array.isArray(ch?.[k]) ? ch[k] : []).slice(0, CHAIN_MAX).map(cleanStep).filter(q => q.id)]));
export function cleanFlights(j){
  const maps = {};
  for(const [k, list] of Object.entries(j?.maps && typeof j.maps==='object' ? j.maps : {}).slice(0, FL_MAX.maps)){
    const key = mapKey(k); if(!key) continue;
    const rs = (Array.isArray(list) ? list : []).slice(0, FL_MAX.routes).map(r => cleanRoute(r)).filter(r => r.id);
    if(rs.length) maps[key] = rs;
  }
  const chains = {};
  for(const [k, ch] of Object.entries(j?.chains && typeof j.chains==='object' ? j.chains : {}).slice(0, FL_MAX.maps)){
    const key = mapKey(k), o = cleanChains(ch); if(key && TRG_KEYS.some(x => o[x].length)) chains[key] = o;
  }
  const c = j?.cfg || {};
  const cfg = { on:c.on===true, port:cleanPort(c.port) || 27015,
    pick:['rr', 'random'].includes(c.pick) ? c.pick : 'rr',
    returnMode:Number.isInteger(c.returnMode) && c.returnMode>=0 && c.returnMode<=6 ? c.returnMode : 4 };
  return { v:1, cfg, maps, chains };
}

// Триггер по пакету GSI. null — ничего. Только наблюдатель/демка (out.spec) — иначе всегда null.
const ALL_TRG = { freeze:true, tech:true, timeout:true, warmup:true };
export function triggerOf(out, trg){
  if(!out || out.spec !== true) return null;
  const pp = out.pphase, ph = out.phase;
  if(trg.warmup && (ph==='warmup' || pp==='warmup')) return { kind:'warmup', key:'warmup|'+(out.map||'') };
  if(trg.freeze && pp==='freezetime' && ph==='live') return { kind:'freeze', key:`fz|${out.map}|${out.round}` };
  if(trg.tech && pp==='paused') return { kind:'tech', key:`tech|${out.map}|${out.round}` };
  if(trg.timeout && (pp==='timeout_ct' || pp==='timeout_t')) return { kind:'timeout', key:`to|${out.map}|${out.round}|${pp}` };
  return null;
}

// ---------- контроллер: запись точек, проигрывание, триггеры ----------
// d — зависимости (в тестах подменяются): load() → объект, save(data); контроллер знает spec сам по последнему пакету GSI
export function createFlight(d = {}){
  const now = d.now || Date.now, log = d.log || (() => {}), tickMs = d.tickMs || 16, staleMs = d.staleMs || 3500;
  const setT = d.setInterval || setInterval, clrT = d.clearInterval || clearInterval;
  let data = cleanFlights(null);
  if(d.load){ try{ data = cleanFlights(d.load()); }catch{} }
  let edit = '', last = null, lastAt = 0, done = new Set(), fly = null, timer = null, note = '', want = null, nc = null, ncKey = '', pubFn = d.onChange || (() => {});
  const save = () => { try{ d.save?.(data); }catch{} };
  const spec = () => !!last && last.spec === true && now() - lastAt < staleMs;
  const client = () => {
    const key = String(data.cfg.port);
    if(!nc || ncKey!==key){ nc?.close(); ncKey = key;
      nc = new Netcon({ port:data.cfg.port, gate:() => data.cfg.on && spec(), onLine:onLine, onState:() => pubFn(), now, connectFn:d.connectFn || net.connect }); }
    return nc;
  };
  function onLine(ln){
    if(!want) return;
    const r = parseGetpos(ln); if(!r) return;
    const w = want; want = null; clearTimeout(w.t); w.cb(r);
  }
  function askPos(cb){
    if(!data.cfg.on || !spec()) return cb(null, 'Включи пролёты и зайди в игру как наблюдатель или в демку');
    const c = client();
    if(want){ clearTimeout(want.t); want = null; }
    const w = want = { cb, t:setTimeout(() => { if(want===w){ want = null; cb(null, 'Игра не ответила на getpos: проверь -netconport'); } }, d.askMs || 2500) };
    if(!c.up) c.open();
    // порт открывается не мгновенно: пробуем отправить, пока сокет не поднялся
    let tries = 0; const go = () => { if(want!==w) return; if(c.send('getpos')) return; if(++tries > 30){ want = null; clearTimeout(w.t); cb(null, 'Нет связи с консолью игры (порт, -netconport)'); } else setTimeout(go, 100); };
    go();
  }
  function routesFor(map){ return data.maps[mapKey(map)] || []; }
  const rrN = {}, qOf = {};
  // шаги пролёта для момента kind: цепочка карты, если задана, иначе один путь (по кругу или случайный) среди путей с этим моментом
  function pickSteps(map, kind){
    const k = mapKey(map), all = routesFor(k), ok = r => r && r.pts.length >= 2;
    const ch = (data.chains[k]?.[kind] || []).map(q => ({ r:all.find(r => r.id===q.id), q })).filter(x => ok(x.r));
    if(ch.length) return ch.map(x => ({ pts:x.r.pts, join:x.q.join, pause:x.q.pause, dur:x.r.dur }));
    const rs = all.filter(r => ok(r) && r.trg[kind]); if(!rs.length) return null;
    const r = data.cfg.pick==='random' ? rs[Math.floor(Math.random() * rs.length)] : rs[(rrN[k] = ((rrN[k] ?? -1) + 1) % rs.length)];
    return [{ pts:r.pts, join:'smooth', pause:0, dur:r.dur }];
  }
  function stopFly(back){
    if(!fly) return; clrT(timer); timer = null;
    const f = fly; fly = null;
    if(back && spec() && data.cfg.on) client().send('spec_mode', data.cfg.returnMode);   // назад к игроку; не наблюдатель — ни звука
    pubFn(); return f;
  }
  // totalSec — сколько секунд всего (с паузами); 0 — подогнать под phaseSec. Движение получает всё, что остаётся после пауз
  function start(steps, totalSec, kind){
    if(fly || !steps?.length || !spec() || !data.cfg.on) return false;
    const runs = runsOf(steps), fixed = fixedSec(runs);
    const plan = layout(runs, Math.max(0.5, totalSec - fixed));
    const c = client(); c.open();
    fly = { plan, t0:now(), kind, sent:false, lastRun:-2 };
    timer = setT(tick, tickMs); pubFn(); return true;
  }
  function tick(){
    if(!fly) return;
    if(!spec()){ stopFly(false); return; }                   // стример вернулся в игру: молча
    const el = now() - fly.t0, c = client();
    if(!c.up){ if(el > 4000) { note = 'Нет связи с консолью игры'; stopFly(false); } else c.open(); return; }
    if(!fly.sent){ c.send('spec_mode', 6); fly.sent = true; fly.t0 = now(); return; }   // свободная камера, дальше летим
    const r = planAt(fly.plan, el / 1000);
    if(r.pos) c.send('spec_goto', r.pos.p[0], r.pos.p[1], r.pos.p[2], r.pos.a[0], r.pos.a[1]);
    if(r.done) stopFly(true);
  }
  const api = {
    get data(){ return data; },
    // пакет GSI (сжатый, из compactGsi)
    onGsi(out){
      last = out; lastAt = now();
      if(!data.cfg.on){ if(fly) stopFly(false); return; }
      if(!out?.spec){ if(fly) stopFly(false); nc?.close(); return; }   // игрок: закрыть порт, ничего не слать
      const tg = triggerOf(out, ALL_TRG);
      if(fly){ if(fly.kind!=='preview' && (!tg || tg.key!==fly.key)) stopFly(true); return; }
      if(!tg || done.has(tg.key)) return;
      const steps = pickSteps(out.map, tg.kind); if(!steps) return;
      done.add(tg.key); if(done.size > 200) done = new Set([...done].slice(-50));
      const left = out.pend ? (out.pend - now()) / 1000 : 20;
      const want = steps.every(q => q.dur > 0) ? steps.reduce((a, q) => a + q.dur, 0) + steps.reduce((a, q, i) => a + (i ? q.pause : 0), 0) : 0;
      const sec = want > 0 ? Math.min(want, left - 1.2) : Math.min(90, left - 1.2);
      if(sec < 2) return;
      if(start(steps, sec, tg.kind)) fly.key = tg.key;
    },
    // команда пульта: все поля чистятся тут, наружу в консоль идёт только buildCmd
    cmd(m){
      const a = m?.a, gm = mapKey(last?.map);
      const reply = (ok, msg) => { note = msg || ''; pubFn(); return ok; };
      if(a==='cfg'){
        const c = data.cfg;
        if(typeof m.on==='boolean') c.on = m.on;
        if(cleanPort(m.port)) c.port = cleanPort(m.port);
        if(m.pick==='rr' || m.pick==='random') c.pick = m.pick;
        if(Number.isInteger(m.returnMode) && m.returnMode>=0 && m.returnMode<=6) c.returnMode = m.returnMode;
        if(!c.on){ stopFly(false); nc?.close(); }
        save(); pubFn(); return true;
      }
      if(a==='stop'){ stopFly(true); return true; }
      if(a==='edit'){ edit = mapKey(m.map); pubFn(); return true; }
      const map = mapKey(m.map) || edit || gm;
      if(!map) return reply(false, 'Карта неизвестна: выбери карту');
      const route = () => (data.maps[map] || []).find(r => r.id===idOf(m.id));
      const mk = r => { const rs = data.maps[map] ||= []; rs.push(r); edit = map; save(); return reply(true, ''); };
      const room = () => (data.maps[map] || []).length < FL_MAX.routes && (map in data.maps || Object.keys(data.maps).length < FL_MAX.maps);
      const newId = () => Math.random().toString(36).slice(2, 10);
      if(a==='new'){ if(!room()) return reply(false, 'Слишком много маршрутов или карт'); return mk(cleanRoute({ name:m.name || 'Route', trg:{} }, newId())); }
      if(a==='import'){ if(!room()) return reply(false, 'Слишком много маршрутов или карт'); return mk(cleanRoute(m.route, newId())); }
      if(a==='dup'){ const r = route(); if(!r || !room()) return reply(false, 'Слишком много маршрутов или карт'); return mk(cleanRoute({ ...r, name:r.name + ' 2' }, newId())); }
      if(a==='del'){ const rs = data.maps[map] || [], i = rs.findIndex(r => r.id===idOf(m.id)); if(i<0) return false; rs.splice(i, 1); if(!rs.length) delete data.maps[map]; save(); return reply(true, ''); }
      if(a==='set'){   // правка маршрута целиком: имя, точки (порядок, значения, время), длительность, моменты
        const r = route(); if(!r) return false;
        const q = Number(m.q);   // порядковый номер правки от пульта: запоздавшая старая правка не затирает новую
        if(q > 0){ if(q <= (qOf[r.id] || 0)) return false; qOf[r.id] = q; }
        const c = cleanRoute({ ...r, ...(m.route && typeof m.route==='object' ? m.route : {}) }, r.id);
        Object.assign(r, c); save(); return reply(true, '');
      }
      if(a==='point'){
        const r = route(); if(!r) return false;
        if(r.pts.length >= FL_MAX.pts) return reply(false, 'В маршруте не больше '+FL_MAX.pts+' точек');
        askPos((pos, err) => { if(!pos) return void reply(false, err || ''); if(r.pts.length < FL_MAX.pts) r.pts.push({ ...pos, t:0, j:0 }); save(); reply(true, ''); });
        return true;
      }
      if(a==='chain'){   // цепочка пролётов для момента карты
        if(!TRG_KEYS.includes(m.kind)) return false;
        if(!(map in data.chains) && Object.keys(data.chains).length >= FL_MAX.maps) return reply(false, 'Слишком много карт');
        const o = data.chains[map] ||= cleanChains(null); o[m.kind] = cleanChains({ [m.kind]:m.steps })[m.kind];
        if(!TRG_KEYS.some(x => o[x].length)) delete data.chains[map];
        save(); return reply(true, '');
      }
      if(a==='preview'){
        let steps, sec;
        if(TRG_KEYS.includes(m.kind)){ steps = pickSteps(map, m.kind); sec = steps && (steps.every(q => q.dur > 0) ? steps.reduce((x, q, i) => x + q.dur + (i ? q.pause : 0), 0) : 12 + steps.reduce((x, q, i) => x + (i ? q.pause : 0), 0)); }
        else { const r = route(); if(r && r.pts.length >= 2){ steps = [{ pts:r.pts, join:'smooth', pause:0, dur:r.dur }]; sec = r.dur || 12; } }
        if(!steps) return reply(false, 'Для предпросмотра нужно две точки');
        if(Number(m.sec) > 0) sec = Math.min(300, Math.max(3, Number(m.sec)));
        if(!spec() || !data.cfg.on) return reply(false, 'Включи пролёты и зайди в игру как наблюдатель или в демку');
        return start(steps, sec, 'preview') ? reply(true, '') : reply(false, 'Пролёт уже идёт');
      }
      return false;
    },
    view(){
      const gm = mapKey(last?.map), em = edit || gm;
      return { on:data.cfg.on, port:data.cfg.port, pick:data.cfg.pick, returnMode:data.cfg.returnMode,
        link:!!nc?.up, spec:spec(), flying:fly ? fly.kind : '', map:gm, edit:em,
        chains:data.chains[em] || cleanChains(null), maps:Object.entries(data.maps).map(([k, v]) => [k, v.length]),
        routes:routesFor(em).map(r => ({ id:r.id, name:r.name, pts:r.pts, dur:r.dur, trg:r.trg })), note };
    },
    close(){ stopFly(false); nc?.close(); },
  };
  return api;
}
