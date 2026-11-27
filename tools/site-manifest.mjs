// Lists the widget files of a built site that Hudini Host may load, with their SHA-256:
//   node tools/site-manifest.mjs <site dir> <seq> [output file, default site-manifest.json]
// <site dir> is what tools/build-site.sh makes; <seq> is the commit time of the signed commit (git log -1 --format=%ct):
// Hudini Host never goes back to a smaller one. The file list is the EMBED table of server/server.js.
// .github/workflows/site-sign.yml signs the result.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [dir, seqArg, out = 'site-manifest.json'] = process.argv.slice(2);
const die = msg => { console.error(msg); process.exit(1); };
const seq = Number(seqArg);
if(!dir || !/^[0-9]+$/.test(seqArg || '') || !Number.isSafeInteger(seq) || seq <= 0) die('usage: node tools/site-manifest.mjs <site dir> <seq> [output file]');

const server = fs.readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const table = /^const EMBED = \{(.*)\};/m.exec(server)?.[1] || '';
const names = [...table.matchAll(/'([^']+)'\s*:/g)].map(m => m[1]);
if(!names.includes('widget/widget.html')) die('EMBED table not found in server/server.js');

const files = {};
for(const f of names) files[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex');
const widgetVer = Number(/const WIDGET_VER\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(dir, 'widget/widget.html'), 'utf8'))?.[1]);
if(!widgetVer) die('WIDGET_VER not found in widget/widget.html');

fs.writeFileSync(out, JSON.stringify({ seq, widgetVer, files }) + '\n');
console.log(`${out}: seq ${seq}, widget ${widgetVer}, ${names.length} files`);
