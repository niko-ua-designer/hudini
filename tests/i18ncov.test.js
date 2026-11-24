// Every Russian phrase written in the HTML of the app windows must have an en, uk and de translation in web/shared/i18n.js (static check).
// A phrase that is only built in JavaScript is not seen here: add its translation by hand and keep the key identical to the shown text.
'use strict';
const fs = require('fs'), path = require('path');
const { check, step, finish, ROOT } = require('./lib.js');
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;
// not translated on purpose: chat commands, language names, user-content examples inside data-i18n-skip areas
const ALLOW = new Set(['!опрос', '!опрос 60', '!опрос стоп', '!таймер 5м', '!таймер стоп', '!участвую', '!крутить', 'Русский', 'Українська', 'старт', 'сброс', 'Вид',
  // stream texts keyed by language in moderator.js (sT table), units and chat command words
  'Вариант', 'Заказ песни', 'Ещё одна попытка', 'ЧАС!', 'До Нового року', 'Ще одна спроба', 'З НОВИМ РОКОМ!', 'КБ', 'ГБ', 'голосование', 'опрос', 'розыгрыш', 'не картинка',
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
  // Russian string literals inside the scripts of the Host window and the dock (text built in JavaScript): the whole text, or a known fragment of it, must have a key.
  const SCRIPTS = ['server/ui.html', 'server/dock.html', 'web/panel/moderator.js', 'web/panel/streamer.js', 'web/panel/broadcast.js', 'web/panel/cursors.js', 'web/panel/draw.js', 'web/panel/ui.js', 'web/shared/media.js'];
  for(const f of SCRIPTS) await step(f + ': Russian strings built in JavaScript are translated', async () => {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const js = f.endsWith('.html') ? [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n') : raw;
    const keys = Object.keys(dicts.en).filter(k => k.length > 2);
    for(const m of js.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)){
      const t = m[2].replace(/\\n/g, ' ').replace(/\\'/g, "'").trim();
      if(!CYR.test(t) || t.length < 2 || ALLOW.has(t) || /[іїєґІЇЄҐ]/.test(t) || /[A-Za-z]{3}.*[А-Яа-я]{3}.*\$\{/.test(t) && false) continue;   // Ukrainian text is the preset content of the Ukrainian scenarios
      for(const lang of ['en', 'uk', 'de']){ const d = dicts[lang]; check(!!(d[t] || d[strip(t)] || Object.keys(d).some(k => k.length > 2 && CYR.test(k) && t.includes(k))), `${lang}: "${t.slice(0, 70)}"`); }
    }
  });
  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
