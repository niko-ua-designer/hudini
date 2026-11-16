// Sends a first-time visitor of the English root page to the language folder that matches the browser language.
// Runs only on the built root page (<html data-lang-routes>). An explicit choice always wins:
// ?lang=xx in the link, or the language saved by the picker. Search crawlers send English and stay on the root.
(() => {
  'use strict';
  if(!document.documentElement.hasAttribute('data-lang-routes')) return;
  const OTHER = ['ru', 'uk', 'de'];
  const q = new URLSearchParams(location.search).get('lang');
  let saved = null; try{ saved = localStorage.getItem('hudini.lang'); }catch{}
  let to = null;
  if(q) to = OTHER.includes(q) ? q : null;
  else if(saved) to = OTHER.includes(saved) ? saved : null;
  else for(const l of navigator.languages?.length ? navigator.languages : [navigator.language]){
    const c = (l || '').slice(0, 2).toLowerCase();
    if(c === 'en') break;
    if(OTHER.includes(c)){ to = c; break; }
  }
  if(to) location.replace(to + '/' + location.hash);
})();
