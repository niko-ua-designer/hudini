// The Host journal (log(...) / logc(...) in server/server.js) is English only, whatever the UI language.
'use strict';
const fs = require('fs'), path = require('path');
const { check, step, finish, ROOT } = require('./lib.js');
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const src = fs.readFileSync(path.join(ROOT, 'server/server.js'), 'utf8');

// Collect the text of every log(...)/logc(...) call, with nested brackets and string literals handled.
function calls(){
  const out = [], re = /(?<![\w.$])logc?\(/g; let m;
  while((m = re.exec(src))){
    let i = re.lastIndex, depth = 1, q = null;
    for(; i < src.length && depth > 0; i++){
      const c = src[i];
      if(q){ if(c === '\\') i++; else if(c === q) q = null; continue; }
      if(c === "'" || c === '"' || c === '`') q = c;
      else if(c === '(') depth++;
      else if(c === ')') depth--;
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, text: src.slice(m.index, i) });
  }
  return out;
}
step('journal lines in server.js contain no Cyrillic', () => {
  const all = calls();
  check(all.length > 50, `found ${all.length} log calls`);
  for(const c of all) check(!CYR.test(c.text), `server.js:${c.line} has Russian in a log call: ${c.text.slice(0, 100)}`);
}).then(() => process.exit(finish()));
