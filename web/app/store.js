// Хранилище приложения: ключ → значение, как localStorage, но в приложении лежит файлом data/store.json на ПК
// (Rust: команды store_load / store_save), а вне приложения (тесты, браузер) — в localStorage.
// HudiniStore.ready — промис «данные загружены»; после него get/set синхронные. Запись откладывается на 250 мс.
(function(){
  'use strict';
  const tauri = window.__TAURI__?.core;
  let data = {}, timer = null, saving = Promise.resolve();
  const lsKeys = () => { try{ return Object.keys(localStorage).filter(k => k.startsWith('store:')); }catch{ return []; } };
  const flush = () => {
    timer = null;
    if(tauri) saving = saving.then(() => tauri.invoke('store_save', { data })).catch(e => console.warn('store_save', e));
  };
  const ready = (async () => {
    if(tauri){ try{ const d = await tauri.invoke('store_load'); if(d && typeof d === 'object' && !Array.isArray(d)) data = d; }catch(e){ console.warn('store_load', e); } }
    else for(const k of lsKeys()){ try{ data[k.slice(6)] = JSON.parse(localStorage.getItem(k)); }catch{} }
  })();
  window.HudiniStore = {
    ready,
    get: (k, d) => k in data ? data[k] : d,
    set(k, v){
      data[k] = v;
      if(tauri){ clearTimeout(timer); timer = setTimeout(flush, 250); }
      else try{ localStorage.setItem('store:' + k, JSON.stringify(v)); }catch{}
    },
    remove(k){ delete data[k]; if(tauri){ clearTimeout(timer); timer = setTimeout(flush, 250); } else try{ localStorage.removeItem('store:' + k); }catch{} },
    // записать сейчас (перед уходом со страницы)
    flushNow(){ if(tauri && timer){ clearTimeout(timer); flush(); } return saving; },
  };
})();
