// Every Russian phrase written in the HTML of the app windows must have an en, uk and de translation in web/shared/i18n.js (static check).
// A phrase that is only built in JavaScript is not seen here: add its translation by hand and keep the key identical to the shown text.
'use strict';
const fs = require('fs'), path = require('path');
const { check, step, finish, ROOT } = require('./lib.js');
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;
// not translated on purpose: chat commands, language names, user-content examples inside data-i18n-skip areas
const ALLOW = new Set(['!опрос', '!опрос 60', '!опрос стоп', '!таймер 5м', '!таймер стоп', '!участвую', '!крутить', 'Русский', 'Українська', 'старт', 'сброс', 'Вид',
  'начать ·', 'закрыть через 60 с ·', 'запустить на 5 минут ·', 'копировать и вставить (и в другую комнату) ·', 'вырезать ·']);
const src = fs.readFileSync(path.join(ROOT, 'web/shared/i18n.js'), 'utf8');
const dicts = new Function(src.slice(src.indexOf('const HUDINI_DICT'), src.indexOf('// ---------- runtime')) + ';return HUDINI_DICT')();
const strip = s => s.replace(/^[^\p{L}\p{N}«"(]+/u, '');
const pages = ['server/ui.html', 'server/dock.html', 'web/panel/moderator.html', 'web/app/index.html', 'web/app/start.html'];

(async () => {
  for(const f of pages) await step(f + ': every Russian phrase is translated into en, uk and de', async () => {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    const phrases = new Set();
    for(const m of h.matchAll(/>([^<>]+)</g)){ const t = m[1].replace(/\s+/g, ' ').trim(); if(CYR.test(t)) phrases.add(t); }
    for(const m of h.matchAll(/\b(?:title|placeholder|aria-label|alt)="([^"]+)"/g)){ const t = m[1].trim(); if(CYR.test(t)) phrases.add(t); }
    for(const t of phrases){
      if(ALLOW.has(t)) continue;
      for(const lang of ['en', 'uk', 'de']){ const d = dicts[lang]; check(!!(d[t] || d[strip(t)]), `${lang}: "${t.slice(0, 70)}"`); }
    }
  });
  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
