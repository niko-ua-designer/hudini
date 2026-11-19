// Search-engine markup of the built site: site name (WebSite JSON-LD), icon set, canonical/hreflang/Open Graph.
// Builds _site/ with tools/build-site.sh and checks the HTML files without a browser.
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { check, step, eq, finish, ROOT } = require('./lib.js');

const SITE = path.join(ROOT, '_site');
const BASE = 'https://niko-ua-designer.github.io/hudini/';
const LANDINGS = { en: 'index.html', ru: 'ru/index.html', uk: 'uk/index.html', de: 'de/index.html' };
const INDEXABLE = { ...LANDINGS, help: 'help.html' };
const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const metas = h => [...h.matchAll(/<meta\s+([^>]*)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([a-z:-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
const links = h => [...h.matchAll(/<link\s+([^>]*)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([a-z:-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
const ldBlocks = h => [...h.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(m => JSON.parse(m[1]));
const pngSize = f => { const b = fs.readFileSync(f); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
const htmlFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (['shared', 'widget', 'app'].includes(e.name) && dir === SITE ? [] : htmlFiles(path.join(dir, e.name))) : e.name.endsWith('.html') && !e.name.startsWith('google') ? [path.join(dir, e.name)] : []);

(async () => {
  execFileSync('sh', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT, stdio: 'pipe' });

  await step('site name: WebSite structured data on every indexable page', async () => {
    for(const [name, file] of Object.entries(INDEXABLE)){
      const h = read(file);
      const site = ldBlocks(h).find(b => b['@type'] === 'WebSite');
      check(site, name + ': WebSite JSON-LD present');
      if(!site) continue;
      eq(site.name, 'Hudini', name + ': site name');
      check(Array.isArray(site.alternateName) && site.alternateName.includes('Hudini overlay'), name + ': alternateName', site.alternateName);
      eq(site.url, BASE, name + ': site url is the site root');
      check(metas(h).some(m => m.property === 'og:site_name' && m.content === 'Hudini'), name + ': og:site_name');
    }
    for(const [name, file] of Object.entries(LANDINGS)){
      const h = read(file);
      check(metas(h).some(m => m.name === 'application-name' && m.content === 'Hudini'), name + ': application-name');
      check(ldBlocks(h).some(b => b['@type'] === 'SoftwareApplication' && b.name === 'Hudini'), name + ': SoftwareApplication JSON-LD');
    }
  });

  await step('icons: every page links an icon that exists', async () => {
    const pages = htmlFiles(SITE);
    check(pages.length >= 9, 'pages found: ' + pages.length);
    for(const f of pages){
      const rel = path.relative(SITE, f), icons = links(fs.readFileSync(f, 'utf8')).filter(l => /\bicon\b/.test(l.rel || ''));
      check(icons.length > 0, rel + ': has <link rel="icon">');
      for(const l of icons){
        const target = path.join(path.dirname(f), l.href);
        check(fs.existsSync(target), rel + ': ' + l.href + ' exists');
      }
    }
    for(const [name, file] of Object.entries(INDEXABLE)){
      const h = read(file), dir = path.dirname(path.join(SITE, file));
      const ls = links(h);
      const sizes = ls.filter(l => l.rel === 'icon' && /^\d+x\d+$/.test(l.sizes || '') && l.type === 'image/png');
      check(sizes.length >= 3 && sizes.every(l => parseInt(l.sizes) % 48 === 0), name + ': PNG icons are multiples of 48', sizes.map(l => l.sizes));
      for(const l of sizes) eq(pngSize(path.join(dir, l.href)), l.sizes, name + ': ' + l.href + ' real size');
      check(ls.some(l => l.rel === 'icon' && l.type === 'image/svg+xml'), name + ': SVG icon');
      const touch = ls.find(l => l.rel === 'apple-touch-icon');
      check(touch && pngSize(path.join(dir, touch.href)) === '180x180', name + ': apple-touch-icon 180x180');
      const man = ls.find(l => l.rel === 'manifest');
      check(man && fs.existsSync(path.join(dir, man.href)), name + ': manifest linked');
    }
  });

  await step('icon files and manifest', async () => {
    const ico = fs.readFileSync(path.join(SITE, 'favicon.ico'));
    eq([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1], 'favicon.ico header');
    const n = ico.readUInt16LE(4), dims = [];
    for(let i = 0; i < n; i++) dims.push(ico[6 + i * 16] || 256);
    eq(dims.sort((a, b) => a - b), [16, 32, 48], 'favicon.ico holds 16, 32 and 48');
    check(/<svg[^>]*viewBox/.test(read('favicon.svg')), 'favicon.svg is an SVG with a viewBox');
    const man = JSON.parse(read('site.webmanifest'));
    eq(man.name, 'Hudini', 'manifest name');
    check(man.icons.length >= 3 && man.icons.every(i => fs.existsSync(path.join(SITE, i.src))), 'manifest icons exist');
    for(const i of man.icons) if(/png$/.test(i.src)) eq(pngSize(path.join(SITE, i.src)), i.sizes, 'manifest ' + i.src + ' size');
  });

  await step('canonical, hreflang, Open Graph, title and description', async () => {
    const urlOf = l => BASE + (l === 'en' ? '' : l + '/');
    for(const [name, file] of Object.entries(LANDINGS)){
      const h = read(file), ls = links(h), ms = metas(h);
      eq(ls.filter(l => l.rel === 'canonical').map(l => l.href), [urlOf(name)], name + ': canonical points at itself');
      for(const l of Object.keys(LANDINGS)) check(ls.some(x => x.rel === 'alternate' && x.hreflang === l && x.href === urlOf(l)), name + ': hreflang ' + l);
      check(ls.some(x => x.hreflang === 'x-default' && x.href === BASE), name + ': hreflang x-default');
      const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '', desc = (ms.find(m => m.name === 'description') || {}).content || '';
      check(title.length > 20 && title.length < 70, name + ': title length ' + title.length);
      check(desc.length > 80 && desc.length < 260, name + ': description length ' + desc.length);
      eq((ms.find(m => m.property === 'og:title') || {}).content, title, name + ': og:title equals title');
      eq((ms.find(m => m.property === 'og:url') || {}).content, urlOf(name), name + ': og:url');
      const img = (ms.find(m => m.property === 'og:image') || {}).content || '';
      check(img.startsWith(BASE) && fs.existsSync(path.join(SITE, img.slice(BASE.length))), name + ': og:image exists', img);
      eq(h.match(/<html lang="([a-z]+)"/)[1], name, name + ': <html lang>');
    }
    const sm = read('sitemap.xml');
    for(const l of Object.keys(LANDINGS)) check(sm.includes('<loc>' + urlOf(l) + '</loc>'), 'sitemap lists ' + l);
    for(const f of ['report.html', 'moderator.html', 'case-demo.html']) check(/name="robots" content="noindex"/.test(read(f)), f + ': noindex');
    for(const f of ['report.html', 'moderator.html']) eq((read(f).match(/name="robots"/g) || []).length, 1, f + ': one robots meta');
  });

  process.exit(finish());
})();
