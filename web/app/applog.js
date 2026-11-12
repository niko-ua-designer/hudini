// Ошибки страницы → журнал приложения (data/logs/app-*.log). Подключается первым скриптом страниц из пакета приложения.
(function(){
  'use strict';
  const invoke = window.__TAURI__?.core?.invoke;
  if(!invoke) return;
  const send = text => { try{ invoke('app_log', { text:String(text).slice(0, 2000) }).catch(() => {}); }catch{} };
  addEventListener('error', e => send(`${e.message} at ${(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}:${e.colno}`));
  addEventListener('unhandledrejection', e => send('unhandled rejection: ' + (e.reason?.stack || e.reason?.message || e.reason)));
})();
