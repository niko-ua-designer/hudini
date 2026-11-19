// Search-engine side of the site build (run by tools/build-site.sh after _site/ is assembled):
//   - one static landing page per language: _site/ (English), _site/ru/, _site/uk/, _site/de/
//     (texts are pre-rendered from web/site/site-texts.js so crawlers see them without running JS)
//   - canonical + hreflang + Open Graph + Twitter + JSON-LD in every landing page
//   - _site/sitemap.xml and _site/robots.txt
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), out = path.join(root, '_site');
const BASE = 'https://niko-ua-designer.github.io/hudini/';
const REL = 'https://github.com/niko-ua-designer/hudini/releases';
const LANGS = [['en', 'English', 'en_US'], ['ru', 'Русский', 'ru_RU'], ['uk', 'Українська', 'uk_UA'], ['de', 'Deutsch', 'de_DE']];

const load = (file, key) => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx); return ctx.window[key]; };
const T = load('web/site/site-texts.js', 'HUDINI_SITE_T');
const G = load('web/shared/connect-guides.js', 'HUDINI_CONNECT');
const tpl = fs.readFileSync(path.join(root, 'web/site/index.html'), 'utf8');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const url = l => BASE + (l === 'en' ? '' : l + '/');
// Site name for search results (Google reads WebSite structured data from the home page and its language versions).
const WEBSITE = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': BASE + '#website', name: 'Hudini', alternateName: ['Hudini overlay', 'Hudini stream overlay'], url: BASE };
const need = (c, m) => { if(!c) throw new Error('build-seo: ' + m); };

function page(lang){
  const t = T[lang], g = G[lang] || G.en, pre = lang === 'en' ? '' : '../';
  need(t && t.seoTitle && t.seoDesc, 'seoTitle/seoDesc missing for ' + lang);
  let h = tpl;

  // 1. pre-rendered texts (site.js re-renders the same content in the browser)
  h = h.replace(/(<[a-z0-9]+\b[^>]*\sdata-t="([A-Za-z0-9]+)"[^>]*>)(<\/[a-z0-9]+>)/g, (m, open, key, close) => typeof t[key] === 'string' ? open + t[key] + close : m);
  h = h.replace(/(<div class="cards[^"]*" data-cards="([^"]+)">)(<\/div>)/g, (m, open, keys, close) =>
    open + keys.split(',').map(k => `<div class="card"><h3>${t[k][1]}</h3><p>${t[k][2]}</p></div>`).join('') + close);
  for(const id of ['sSteps', 'mSteps']) h = h.replace(`<ol id="${id}"></ol>`, `<ol id="${id}">${t[id].map(x => `<li>${x}</li>`).join('')}</ol>`);
  h = h.replace('<ul class="ticks" id="csList"></ul>', `<ul class="ticks" id="csList">${t.csList.map(s => `<li><span>${s}</span></li>`).join('')}</ul>`);
  h = h.replace('<h2 id="cTitle"></h2>', `<h2 id="cTitle">${g.title}</h2>`).replace('<p class="lead" id="cLead"></p>', `<p class="lead" id="cLead">${g.lead}</p>`);
  h = h.replace(/<a class="btn ([a-z ]+)" data-dl data-os-label /g, (m, c) => `<a class="btn ${c}" href="${REL}" data-dl data-os-label `);
  h = h.replace(/(data-os-label[^>]*>)(<\/a>)/g, (m, o, c) => o + t.dlFor.replace('{os}', 'Windows') + c);

  // 2. links and assets relative to the language folder
  if(pre){
    h = h.replace(/(href|src)="(?!https?:|#|\/|mailto:|data:)([^"]*)"/g, (m, a, v) => v === 'index.html' ? `${a}="./"` : `${a}="${pre}${v}"`);
  }
  h = h.replace(/(<a href="[^"]*)(" data-help)/g, `$1?lang=${lang}$2`).replace(/(<a href="[^"]*)(" data-rep)/g, `$1?lang=${lang}$2`);

  // 3. <html> attributes
  h = h.replace('<html lang="en">', lang === 'en' ? '<html lang="en" data-lang-routes>' : `<html lang="${lang}" data-root="../" data-static-lang="${lang}">`);
  if(lang !== 'en') h = h.replace(/<script src="(\.\.\/)?lang-route\.js[^"]*"><\/script>\n/, '');

  // 4. head: title, description, canonical, hreflang, social, structured data
  const img = BASE + `img/og-${lang}.png`, self = url(lang);
  const ld = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Hudini', url: self, inLanguage: lang, description: t.seoDesc, image: img,
    applicationCategory: 'MultimediaApplication', operatingSystem: 'Windows, Linux, macOS', isAccessibleForFree: true, downloadUrl: REL,
    license: 'https://github.com/niko-ua-designer/hudini/blob/main/LICENSE', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'niko-ua-designer', url: 'https://github.com/niko-ua-designer' } };
  const head = [
    `<title>${esc(t.seoTitle)}</title>`,
    `<meta name="description" content="${esc(t.seoDesc)}">`,
    `<link rel="canonical" href="${self}">`,
    ...LANGS.map(([l]) => `<link rel="alternate" hreflang="${l}" href="${url(l)}">`),
    `<link rel="alternate" hreflang="x-default" href="${url('en')}">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="Hudini">`,
    `<meta property="og:title" content="${esc(t.seoTitle)}"><meta property="og:description" content="${esc(t.seoDesc)}">`,
    `<meta property="og:url" content="${self}"><meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(t.seoTitle)}">`,
    `<meta property="og:locale" content="${LANGS.find(l => l[0] === lang)[2]}">`,
    ...LANGS.filter(([l]) => l !== lang).map(([, , loc]) => `<meta property="og:locale:alternate" content="${loc}">`),
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t.seoTitle)}"><meta name="twitter:description" content="${esc(t.seoDesc)}"><meta name="twitter:image" content="${img}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    `<script type="application/ld+json">${JSON.stringify(WEBSITE).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
  h = h.replace(/<title>[^<]*<\/title>\n<meta name="description"[^>]*>/, head);
  need(h.includes('rel="canonical"'), 'head block not replaced');

  // 5. crawlable language links in the footer (the English one carries ?lang=en so the root does not bounce a returning visitor)
  const links = LANGS.map(([l, name]) => {
    const href = lang === 'en' ? (l === 'en' ? './?lang=en' : l + '/') : (l === 'en' ? '../?lang=en' : l === lang ? './' : '../' + l + '/');
    return `<a href="${href}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${name}</a>`;
  }).join('');
  h = h.replace('<!--LANGS-->', links);
  return h;
}

for(const [l] of LANGS){
  const dir = l === 'en' ? out : path.join(out, l);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(l));
}

const alt = LANGS.map(([l]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${url(l)}"/>`).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${url('en')}"/>`;
fs.writeFileSync(path.join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  LANGS.map(([l]) => `<url><loc>${url(l)}</loc>${alt}</url>`).join('\n') + `\n<url><loc>${BASE}help.html</loc></url>\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
console.log('seo: ' + LANGS.map(l => l[0]).join(', ') + ' pages, sitemap.xml, robots.txt');
