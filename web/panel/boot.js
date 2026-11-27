// Запуск пульта. В приложении хранилище (data/store.json) приходит из Rust не сразу: пульт запускаем, когда оно загружено.
// Иначе настройки, которые moderator.js читает при загрузке (свои анимации, сетка, команды чата, свёрнутые папки, вкладка),
// взялись бы по умолчанию, и первая же запись затёрла бы сохранённые.
(function(){
  'use strict';
  const start = () => {
    for(const src of ['streamer.js?v=5', 'moderator.js?v=10', 'broadcast.js?v=4', 'draw.js?v=2', 'cursors.js?v=2','ui.js?v=8']){
      const s = document.createElement('script'); s.src = src; s.async = false;   // по порядку: ui.js нужен готовый moderator.js, а boot() в moderator.js — готовый streamer.js
      document.body.appendChild(s);
    }
  };
  window.HudiniStore.ready.then(start, start);
})();
