// Хранилище приложения: ключ → значение, как localStorage, но в приложении лежит файлом data/store.json на ПК
// (Rust: команды store_load / store_save), а вне приложения (тесты, браузер) — в localStorage.
// HudiniStore.ready — промис «данные загружены»; после него get/set синхронные. Запись откладывается на 250 мс.
(function(){
  'use strict';
  const tauri = window.__TAURI__?.core;
  let data = {}, timer = null, saving = Promise.resolve(), warned = false;
  // store_load не смог прочитать файл (например, его держит антивирус): data пуст не потому, что хранилище пусто.
  // Пока так, не пишем ничего (иначе первая же запись затёрла бы сессии и ключи комнат), а изменения копим в pending
  let loadFailed = false, retryTimer = null; const pending = new Map();
  const lsKeys = () => { try{ return Object.keys(localStorage).filter(k => k.startsWith('store:')); }catch{ return []; } };
  // Запись не удалась (в браузере кончилось место, в приложении ошибка диска): один раз сообщаем странице событием
  // hudini-store-error, страница сама решает, как показать
  const failed = e => {
    console.warn('HudiniStore: не удалось сохранить', e);
    if(warned) return; warned = true;
    try{ dispatchEvent(new CustomEvent('hudini-store-error', { detail: { app: !!tauri, error: String(e?.message || e) } })); }catch{}
  };
  const flush = () => {
    timer = null;
    if(tauri && !loadFailed) saving = saving.then(() => tauri.invoke('store_save', { data })).catch(failed);
  };
  const isObj = d => d && typeof d === 'object' && !Array.isArray(d);
  const loadError = e => {
    console.warn('store_load', e);
    try{ dispatchEvent(new CustomEvent('hudini-store-error', { detail: { app: true, load: true, error: String(e?.message || e) } })); }catch{}
  };
  // Повторяем чтение в фоне; когда получилось, накладываем сверху то, что успели поменять, и разрешаем запись
  const retryLoad = () => {
    if(retryTimer) return;
    retryTimer = setInterval(async () => {
      let d; try{ d = await tauri.invoke('store_load'); }catch{ return; }
      if(!isObj(d)) return;
      clearInterval(retryTimer); retryTimer = null;
      data = d;
      for(const [k, e] of pending) if(e.del) delete data[k]; else data[k] = e.v;
      pending.clear(); loadFailed = false;
      clearTimeout(timer); timer = setTimeout(flush, 0);
    }, 3000);
  };
  const ready = (async () => {
    if(tauri){ try{ const d = await tauri.invoke('store_load'); if(isObj(d)) data = d; }catch(e){ loadFailed = true; loadError(e); retryLoad(); } }
    else for(const k of lsKeys()){ try{ data[k.slice(6)] = JSON.parse(localStorage.getItem(k)); }catch{} }
  })();
  window.HudiniStore = {
    ready,
    get: (k, d) => k in data ? data[k] : d,
    set(k, v){
      data[k] = v;
      if(loadFailed) pending.set(k, { v });
      if(tauri){ clearTimeout(timer); timer = setTimeout(flush, 250); }
      else try{ localStorage.setItem('store:' + k, JSON.stringify(v)); }catch(e){ failed(e); }
    },
    remove(k){ delete data[k]; if(loadFailed) pending.set(k, { del: true }); if(tauri){ clearTimeout(timer); timer = setTimeout(flush, 250); } else try{ localStorage.removeItem('store:' + k); }catch{} },
    // записать сейчас (перед уходом со страницы)
    flushNow(){ if(tauri && timer){ clearTimeout(timer); flush(); } return saving; },
  };
  // Страницу закрывают или перезагружают раньше, чем сработал таймер записи: отдаём данные сразу
  addEventListener('pagehide', () => window.HudiniStore.flushNow());
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') window.HudiniStore.flushNow(); });
})();
