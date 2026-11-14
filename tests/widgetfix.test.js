// core.js helpers: blockedEmbed, poll defaults per language, widget restart URL, Case3D failure counter.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { step, check, eq, finish } = require('./lib');
const SH = path.join(__dirname, '../web/shared');
const noop = () => {};
const sandbox = { console, URL, TextEncoder, TextDecoder, crypto: require('crypto').webcrypto, atob, btoa, Intl, setTimeout, clearTimeout, setInterval: noop, addEventListener: noop, document: { addEventListener: noop, currentScript: null, baseURI: 'http://x/' }, location: { protocol: 'https:', origin: 'https://panel.test' } };
sandbox.window = sandbox;
vm.createContext(sandbox);
try{ vm.runInContext(fs.readFileSync(path.join(SH, 'core.js'), 'utf8') + '\n;this.__t={blockedEmbed,sanitizeEl,sanitizeState,parseEmbed,embedSrc,setLang:l=>{STREAM_LANG=l}}', sandbox); }catch(e){ console.error('core.js does not load in node:', e.message); process.exit(1); }
const T = sandbox.__t;

(async () => {
  await step('blockedEmbed refuses local and LAN addresses', async () => {
    for(const u of ['http://127.0.0.1/', 'http://localhost:7777/', 'http://a.localhost/', 'http://localhost./', 'http://2130706433/', 'http://0x7f.1/', 'http://0.0.0.0/',
      'http://[::1]/', 'http://[::]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:192.168.0.1]/', 'http://[::ffff:a00:1]/',
      'http://10.1.2.3/', 'http://172.16.0.1/', 'http://172.31.255.255/', 'http://192.168.1.1/', 'http://169.254.169.254/', 'http://100.64.0.1/', 'http://100.127.255.255/',
      'http://[fc00::1]/', 'http://[fd12::1]/', 'http://[fe80::1]/', 'http://[febf::1]/',
      'http://127.0.0.1.nip.io/', 'http://10-0-0-1.sslip.io/', 'http://nip.io/', 'http://foo.localtest.me/', 'http://localtest.me/', 'http://x.lvh.me/', 'http://127.0.0.1.example.com/', 'http://127.1.2.3.evil.org/', 'not a url'])
      check(T.blockedEmbed(u), 'blocked: ' + u);
  });
  await step('blockedEmbed lets public sites through', async () => {
    for(const u of ['https://example.com/', 'https://www.twitch.tv/popout/x/chat', 'https://172.32.0.1/', 'https://172.15.0.1/', 'https://100.128.0.1/', 'https://100.63.0.1/', 'https://8.8.8.8/',
      'https://[2001:db8::1]/', 'https://[fec0::1]/x'.replace('fec0', '2606'), 'https://notnip.io.example.com/', 'https://mylocalhost.com/', 'https://192.169.0.1/', 'https://169.253.0.1/', 'https://127.example.com/'])
      check(!T.blockedEmbed(u), 'allowed: ' + u);
    check(T.blockedEmbed('https://panel.test/x') && T.blockedEmbed('https://niko-ua-designer.github.io/hudini/'), 'own origin and Hudini site stay blocked');
  });
  await step('poll defaults follow the stream language', async () => {
    const want = { ru: ['Да', 'Нет'], en: ['Yes', 'No'], uk: ['Так', 'Ні'], de: ['Ja', 'Nein'] };
    for(const [l, o] of Object.entries(want)){
      eq(T.sanitizeState({ lang: l, els: [{ id: 'p1', type: 'poll', opts: [] }] }).els[0].opts, o, 'sanitizeState ' + l);
    }
    T.setLang('ru');
    eq(T.sanitizeEl({ id: 'p', type: 'poll', opts: ['A', 'B'] }).opts, ['A', 'B'], 'explicit options are kept');
    eq(T.sanitizeEl({ id: 'p', type: 'poll' }).opts, ['Да', 'Нет'], 'no state language keeps Russian');
    T.sanitizeState({ lang: 'de', els: [] });
    eq(T.sanitizeEl({ id: 'p', type: 'poll' }).opts, ['Да', 'Нет'], 'stream language is restored after sanitizeState');
  });
  await step('widget restart URL puts _r before the fragment', async () => {
    const html = fs.readFileSync(path.join(__dirname, '../web/widget/widget.html'), 'utf8');
    const fn = /function restartUrl\([\s\S]*?\n\}/.exec(html);
    check(fn, 'restartUrl exists');
    const restartUrl = new Function('URL', fn[0] + '; return restartUrl;')(URL);
    eq(restartUrl('https://a.com/app#/page', 3), 'https://a.com/app?_r=3#/page', 'hash without query');
    eq(restartUrl('https://a.com/app?x=1#/p', 4), 'https://a.com/app?x=1&_r=4#/p', 'hash with query');
    eq(restartUrl('https://a.com/app?_r=1', 5), 'https://a.com/app?_r=5', 'old _r replaced');
    check(/restartUrl\(src, el\.restart\)/.test(html), 'applyState uses it');
  });
  await step('widget calibration text is translated', async () => {
    const html = fs.readFileSync(path.join(__dirname, '../web/widget/widget.html'), 'utf8');
    check(!/Окно источника: <b>/.test(html) && html.includes("st('Окно источника')"), 'calib goes through st()');
    for(const l of ['en', 'uk', 'de']) for(const k of ['Окно источника', 'Да', 'Нет', 'Растянуть на экран']){
      T.setLang(l); check(vm.runInContext(`st(${JSON.stringify(k)})`, sandbox) !== k, l + ' has ' + k);
    }
    T.setLang('ru');
  });
  await step('Case3D failure counter (no GPU needed)', async () => {
    const cs = fs.readFileSync(path.join(SH, 'case3d.js'), 'utf8');
    check(/MAX_FAILS = 3/.test(cs) && !/failed = true; (return null|dispose)/.test(cs), 'render errors go through the counter');
    check(/c\._tryKey !== el\.openAt[^\n]*failed = false/.test(cs) && cs.indexOf('c._tryKey') < cs.indexOf('if(failed)'), 'failed is reset on a new openAt before the check');
    check(/failed = loadFailed = true/.test(cs) && /if\(!loadFailed\)/.test(cs), 'three.js load failure stays permanent');
  });
  await step('old VDO.Ninja camera elements are plain sites now', async () => {
    const url = 'https://vdo.ninja/?view=abc&cleanoutput&transparent';
    eq(T.parseEmbed(url).kind, 'site', 'vdo.ninja view link is a site');
    eq(T.embedSrc({ url, sound: false }, 'panel.test'), url, 'the link is used as is (no camera-specific rewriting)');
  });

  finish();
})().catch(e => { console.error(e); process.exit(1); });
