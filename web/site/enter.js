// Runs first in <head>: decides, before the first paint, whether this page plays the "enter" animation.
// A page the visitor left through the site's own transition (see site.js) sets a short-lived flag in sessionStorage; here it is consumed.
// Nothing is hidden by default: without this script, or with animations off, the page simply shows at once.
(() => {
  'use strict';
  const d = document.documentElement;
  try{
    const off = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.webdriver && !window.__forceAnim);   // automated tests run without animation
    if(off) d.classList.add('no-anim');
    const t = Number(sessionStorage.getItem('hudini.tr')); sessionStorage.removeItem('hudini.tr');
    if(!off && t && Date.now() - t < 6000){ d.classList.add('enter'); setTimeout(() => d.classList.remove('enter'), 900); }   // safety: nothing stays held back
  }catch{}
})();
