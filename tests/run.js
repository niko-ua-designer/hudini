// Runs every *.test.js in this folder one after another. `node run.js core` runs only the files whose name contains "core".
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const only = process.argv[2];
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only || f.includes(only))).sort();
let failed = 0;
for(const f of files){
  console.log(`\n=== ${f} ===`);
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', timeout: 5 * 60 * 1000 });
  const ok = r.status === 0;
  if(!ok) failed++;
  console.log(`=== ${f}: ${ok ? 'OK' : 'FAILED'} (${Math.round((Date.now() - t) / 1000)} s) ===`);
}
console.log(failed ? `\n${failed} of ${files.length} suites failed` : `\nAll ${files.length} suites passed`);
process.exit(failed ? 1 : 0);
