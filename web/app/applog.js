// Ошибки страницы → журнал приложения (data/logs/app-*.log). Подключается первым скриптом страниц из пакета приложения.
(function(){
  'use strict';
  const invoke = window.__TAURI__?.core?.invoke;
  if(!invoke) return;
  // код комнаты в журнал не попадает: журналы прикладывают к отчётам
  const send = text => { try{ invoke('app_log', { text:String(text).replace(/hudini1:[A-Za-z0-9_-]+/g, 'hudini1:[removed]').slice(0, 2000) }).catch(() => {}); }catch{} };
  addEventListener('error', e => send(`${e.message} at ${(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}:${e.colno}`));
  addEventListener('unhandledrejection', e => send('unhandled rejection: ' + (e.reason?.stack || e.reason?.message || e.reason)));
})();
