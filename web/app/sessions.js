// Сохранённые сессии модератора: разбор кода «hudini1:…», слияние с уже сохранённой сессией, порядок в списке.
// Чистая логика без DOM: её же проверяют тесты в node (tests/app.test.js).
(function(root){
  'use strict';
  const NETS = ['tailscale', 'radmin', 'hamachi', 'zerotier', 'lan', 'inet', 'porthole', 'ext'];
  const NET_NAMES = { tailscale:'Tailscale', radmin:'Radmin VPN', hamachi:'Hamachi', zerotier:'ZeroTier', lan:'Локальная сеть', inet:'Интернет', porthole:'Porthole', ext:'Проброс порта' };
  const validRoom = c => typeof c === 'string' && /^[a-z0-9_-]{4,64}$/i.test(c) && !['__proto__', 'constructor', 'prototype'].includes(c.toLowerCase());
  const b64uDecode = s => { const b = s.replace(/-/g, '+').replace(/_/g, '/'); const bin = typeof atob === 'function' ? atob(b + '='.repeat((4 - b.length % 4) % 4)) : Buffer.from(b, 'base64').toString('binary'); return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))); };

  function cleanAddrs(a){
    if(!Array.isArray(a)) return [];
    const out = [];
    for(const x of a.slice(0, 16)){
      const port = Number(x?.port);
      if(x && typeof x.h === 'string' && x.h.length > 0 && x.h.length <= 255 && !/[\s/\\@]/.test(x.h) && Number.isInteger(port) && port > 0 && port < 65536)
        out.push({ h:x.h, port, net:NETS.includes(x.net) ? x.net : 'inet' });
    }
    return out;
  }

  // Код для модератора → чистый объект или null. Пароль и отпечаток обязательны: без них не подключиться.
  function parseCode(text){
    const m = /hudini1:([A-Za-z0-9_-]+)/.exec(String(text || ''));
    if(!m) return null;
    let o; try{ o = JSON.parse(b64uDecode(m[1])); }catch{ return null; }
    if(!o || o.v !== 1 || !validRoom(o.room) || typeof o.pass !== 'string' || !o.pass || o.pass.length > 200) return null;
    if(typeof o.fp !== 'string' || !/^[0-9a-f]{64}$/i.test(o.fp)) return null;
    const addrs = cleanAddrs(o.addrs);
    if(!addrs.length) return null;
    const r = { room:o.room, name:String(o.name || '').trim().slice(0, 40) || 'Стример', pass:o.pass, fp:o.fp.toLowerCase(), addrs };
    // Ключи комнаты есть только у комнаты, созданной самим сервером
    if(typeof o.k === 'string' && typeof o.p === 'string' && o.s && typeof o.s === 'object' && !Array.isArray(o.s)) Object.assign(r, { k:o.k, p:o.p, s:o.s });
    return r;
  }

  // Новый код для известной комнаты обновляет только адреса, отпечаток и пароль; ключи существующей комнаты не трогает.
  // Возвращает { list, session, created, keysDiffer }.
  function addCode(list, code, now = Date.now()){
    const i = list.findIndex(s => s.id === code.room);
    if(i < 0){
      const s = { id:code.room, name:code.name, pass:code.pass, fp:code.fp, addrs:code.addrs, pinned:false, added:now, last:0, lastNet:'' };
      if(code.k) Object.assign(s, { k:code.k, p:code.p, s:code.s });
      return { list:[...list, s], session:s, created:true, keysDiffer:false };
    }
    const old = list[i], has = !!old.k;
    const keysDiffer = !!code.k && has && (old.k !== code.k || old.p !== code.p || JSON.stringify(old.s) !== JSON.stringify(code.s));
    const s = { ...old, pass:code.pass, fp:code.fp, addrs:code.addrs };
    if(code.k && !has) Object.assign(s, { k:code.k, p:code.p, s:code.s });
    const out = list.slice(); out[i] = s;
    return { list:out, session:s, created:false, keysDiffer };
  }

  const sortSessions = list => [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.last || b.added || 0) - (a.last || a.added || 0) || a.name.localeCompare(b.name));

  // Читаемое и безопасное из того, что лежит в хранилище (его могли испортить руками)
  function cleanList(v){
    if(!Array.isArray(v)) return [];
    const seen = new Set(), out = [];
    for(const s of v){
      if(!s || !validRoom(s.id) || seen.has(s.id) || typeof s.pass !== 'string' || typeof s.fp !== 'string') continue;
      const addrs = cleanAddrs(s.addrs);
      seen.add(s.id);
      const c = { id:s.id, name:String(s.name || 'Стример').slice(0, 40), pass:s.pass, fp:s.fp, addrs, pinned:!!s.pinned, added:+s.added || 0, last:+s.last || 0, lastNet:NETS.includes(s.lastNet) ? s.lastNet : '' };
      if(typeof s.k === 'string' && typeof s.p === 'string' && s.s && typeof s.s === 'object') Object.assign(c, { k:s.k, p:s.p, s:s.s });
      out.push(c);
    }
    return out;
  }

  // Сеть, в которой заходили в последний раз; иначе первая из адресов
  const netOf = s => s.lastNet || s.addrs[0]?.net || 'inet';

  // «сегодня, 18:42» / «вчера» / «3 дня назад» на языке интерфейса (lang: ru, en, uk, de)
  function whenText(ts, lang, now = Date.now()){
    if(!ts) return { key:'ещё не заходил' };
    const d = new Date(ts), n = new Date(now), day = x => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 864e5);
    const diff = day(n) - day(d);
    if(diff <= 0) return { key:'сегодня, {t}', t:d.toLocaleTimeString(lang, { hour:'2-digit', minute:'2-digit' }) };
    if(diff === 1) return { key:'вчера' };
    return { rel:new Intl.RelativeTimeFormat(lang, { numeric:'always' }).format(-diff, 'day') };
  }

  const api = { NETS, NET_NAMES, validRoom, parseCode, addCode, sortSessions, cleanList, netOf, whenText };
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.HudiniSessions = api;
})(typeof window !== 'undefined' ? window : globalThis);
