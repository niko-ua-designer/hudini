// The real Hudini case (core.js + case3d.js, the same code the stream widget runs) for the landing page demo.
// The page waits for {type:'open'} from the landing page, runs one opening and stays quiet until {type:'reset'}.
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  const lang = STREAM_LANGS.includes(q.get('lang')) ? q.get('lang') : 'en';
  STREAM_LANG = lang;
  document.documentElement.lang = lang;
  const NAMES = {   // item names are text of the case element itself, so they are written per language here
    en: ['Sticker', 'Pistol skin', 'Rifle skin', 'AK-47 | Redline', 'Knife'],
    ru: ['Наклейка', 'Скин на пистолет', 'Скин на винтовку', 'AK-47 | Redline', 'Нож'],
    uk: ['Наліпка', 'Скін на пістолет', 'Скін на гвинтівку', 'AK-47 | Redline', 'Ніж'],
    de: ['Sticker', 'Pistolen-Skin', 'Gewehr-Skin', 'AK-47 | Redline', 'Messer'],
  }[lang];
  const stage = document.getElementById('stage');
  const fit = () => stage.style.setProperty('--u', (stage.clientHeight / 100) + 'px');
  addEventListener('resize', fit); fit();

  let node = null, el = null, raf = 0;
  function start(){
    stop();
    const items = [[2, 50], [3, 25], [4, 15], [5, 8], [6, 2]].map(([r, p], i) => ({ n: NAMES[i], r, p, img: '' }));
    const pick = () => { let x = Math.random() * 100; for(let i = 0; i < items.length; i++){ x -= items[i].p; if(x < 0) return i; } return 0; };
    const win = 4;   // the knife: gold reveal
    const reel = Array.from({ length: CASE_REEL }, pick);
    reel[CASE_WIN] = win; reel[CASE_WIN - 1] = 2; reel[CASE_WIN + 1] = pick();
    const state = sanitizeState({ lang, visible: true, els: [{ id: 'demo', type: 'case', x: 50, y: 50, fs: 4, font: 'montserrat', color: '#ffffff',
      name: 'HUDINI CASE', cc: '#7c5cff', items, hideAfter: 600, vol: 0, kind: 'normal', donor: 'nightowl', amount: '',
      reel, win, bmode: 'under', jit: 0.15, reel2: [], win2: -1, jit2: 0, openAt: Date.now() + 300 }] });
    el = state.els[0];
    el.ttl = el.openAt + caseT(el).reveal + el.hideAfter * 1000;
    node = buildNode(el); node._el = el; node._z = 1; node._noPh = true;
    stage.appendChild(node); paintNode(node, el, 1); node.style.opacity = el.op;
    const loop = () => { tickNode(node, el, nowMs()); raf = setTimeout(loop, 100); };
    loop();
  }
  function stop(){
    clearTimeout(raf); window.Case3D?.silence?.(); if(node){ window.Case3D?.stop(node.querySelector('.case') || node); node.remove(); }
    node = el = null; stage.replaceChildren();
  }
  addEventListener('message', e => {
    if(e.origin !== location.origin || e.source !== parent) return;
    if(e.data?.type === 'open') start(); else if(e.data?.type === 'reset') stop();
  });
  parent.postMessage({ type: 'ready' }, location.origin);
})();
