// Version constants and cache-busting numbers must agree everywhere (static check, no browser).
'use strict';
const fs = require('fs'), path = require('path');
const { check, step, eq, finish, ROOT } = require('./lib.js');
const WEB = path.join(ROOT, 'web');
const read = f => fs.readFileSync(path.join(WEB, f), 'utf8');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'vendor' || e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(html|js)$/.test(e.name) ? [path.join(d, e.name)] : []);

(async () => {
  await step('panel, widget and version.json agree on the widget version', async () => {
    const panel = Number(read('panel/moderator.js').match(/const WIDGET_VER\s*=\s*(\d+)/)?.[1]);
    const widget = Number(read('widget/widget.html').match(/const WIDGET_VER\s*=\s*(\d+)/)?.[1]);
    const site = JSON.parse(read('site/version.json')).panel;
    check(panel > 0 && widget > 0 && site > 0, 'all three constants found', { panel, widget, site });
    eq(panel, widget, 'moderator.js WIDGET_VER equals widget.html WIDGET_VER');
    eq(site, widget, 'version.json panel equals widget.html WIDGET_VER');
  });

  await step('one file, one ?v= number in every page and script that loads it', async () => {
    const seen = {};
    for(const f of walk(WEB)){
      const txt = fs.readFileSync(f, 'utf8');
      for(const m of txt.matchAll(/([A-Za-z0-9_-]+\.(?:js|css))\?v=(\d+)/g)){
        (seen[m[1]] ||= new Map()).set(m[2], path.relative(WEB, f));
      }
    }
    check(Object.keys(seen).length > 10, 'found versioned includes', Object.keys(seen).length);
    for(const [name, vers] of Object.entries(seen)) check(vers.size === 1, name + ' has a single version', [...vers]);
  });

  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
