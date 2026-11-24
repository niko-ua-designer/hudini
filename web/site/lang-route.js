// Sends a returning visitor of the English root page to the language folder they chose before.
// Runs only on the built root page (<html data-lang-routes>). An explicit choice always wins:
// ?lang=xx in the link, or the language saved by the picker. A first-time visitor stays here and gets the language offer from site.js.
(() => {
  'use strict';
  if(!document.documentElement.hasAttribute('data-lang-routes')) return;
  const OTHER = ['ru', 'uk', 'de'];
  const q = new URLSearchParams(location.search).get('lang');
  let saved = null; try{ saved = localStorage.getItem('hudini.lang'); }catch{}
  let to = null;
  if(q) to = OTHER.includes(q) ? q : null;
  else if(saved) to = OTHER.includes(saved) ? saved : null;
  if(to) location.replace(to + '/' + location.hash);
})();
