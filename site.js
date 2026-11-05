// Hudini website: language picker, landing page texts and the help page.
// The chosen language is shared with the panel (localStorage "hudini.lang").
(() => {
  'use strict';
  const LANGS = [['en', 'English'], ['ru', 'Русский'], ['uk', 'Українська'], ['de', 'Deutsch']];
  const has = c => LANGS.some(l => l[0] === c);
  function pick(){
    const q = new URLSearchParams(location.search).get('lang');
    let s = null; try{ s = localStorage.getItem('hudini.lang'); }catch{}
    for(const c of [q, s, (navigator.language || '').slice(0, 2).toLowerCase()]) if(has(c)) return c;
    return 'en';
  }
  let lang = pick();
  const DL = 'https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.3';

  // Landing texts. Values are trusted HTML written here, never user input.
  const T = {
    en: {
      home:'Home', panel:'Panel', features:'Features', how:'How it works', privacy:'Privacy', help:'Help',
      h1:'A stream overlay run by <span>your moderator</span>',
      sub:'Show text, pictures, GIFs, timers, polls and effects on the streamer’s screen. The streamer only starts the app, you do the rest.',
      open:'Open the panel', download:'⬇ Download Hudini Host', free:'Free · open source · Windows, macOS, Linux',
      fTitle:'What it can do', fLead:'Everything you place in the panel appears on stream within a fraction of a second.',
      f1:['🖼', 'Anything on screen', 'Text, pictures, GIFs, videos, YouTube, Twitch and websites. Drag, resize, rotate, animate.'],
      f2:['⏱', 'Timers and counters', 'Countdowns, stopwatches, "until" timers, clocks and counters with flip-clock style.'],
      f3:['💬', 'Chat and polls <i class="lvl">β</i>', 'Show a chat message on stream with one click, run polls and count chat commands.'],
      f4:['⚡', 'Scenarios <i class="lvl">β</i>', '"If someone types !cringe, show the meme for 5 seconds and fire confetti."'],
      f5:['🎯', 'CS2 <i class="lvl">β</i>', 'Live K/D/A, HP, money and DOUBLE/TRIPLE/ACE popups via Valve’s official integration.'],
      f6:['👥', 'Together', 'Invite a second moderator and edit the screen at the same time.'],
      hTitle:'How it works', hLead:'Three parts that find each other by themselves.',
      h1s:'<b>The streamer</b> runs Hudini Host and adds the link it shows to OBS as a Browser source (1920×1080).',
      h2s:'<b>The moderator</b> opens the panel and sends the streamer one link. The panel finds the streamer’s app automatically.',
      h3s:'<b>Everything</b> you do in the panel appears on stream right away: drag, show, hide, play.',
      pTitle:'Privacy and security', pLead:'Built so that nobody in the middle can read or change what is on stream.',
      p1:['🔐', 'Encrypted and signed', 'Every change is encrypted (AES-256) and signed with the moderator’s key. The widget ignores anything unsigned.'],
      p2:['🏠', 'Files stay with the streamer', 'Uploads are stored encrypted on the streamer’s PC with limits they set. No cloud storage.'],
      p3:['🙈', 'No accounts, no trackers', 'Keys live in your browser and in the link after #, which never reaches a server.'],
      p4:['📖', 'Open source', 'The code is public under AGPL-3.0, presets and animations under MIT.'],
      lTitle:'What β and α mean', lText:'Everything without a mark is stable. <i class="lvl">β</i> beta works but is still being tested on more computers. <i class="lvl alpha">α</i> alpha is an experiment.',
      issues:'Report a problem', license:'License', helpLink:'Help',
    },
    ru: {
      home:'Главная', panel:'Пульт', features:'Возможности', how:'Как работает', privacy:'Приватность', help:'Справка',
      h1:'Оверлей для стрима, которым управляет <span>модератор</span>',
      sub:'Показывай на экране стримера текст, картинки, GIF, таймеры, голосования и эффекты. Стример только запускает программу, остальное делаешь ты.',
      open:'Открыть пульт', download:'⬇ Скачать Hudini Host', free:'Бесплатно · открытый код · Windows, macOS, Linux',
      fTitle:'Что умеет', fLead:'Всё, что ставишь в пульте, появляется на стриме за долю секунды.',
      f1:['🖼', 'Что угодно на экране', 'Текст, картинки, GIF, видео, YouTube, Twitch и сайты. Двигай, меняй размер, крути, анимируй.'],
      f2:['⏱', 'Таймеры и счётчики', 'Обратный отсчёт, секундомер, «отсчёт до», часы и счётчики, в том числе флип-часы.'],
      f3:['💬', 'Чат и голосования <i class="lvl">β</i>', 'Сообщение из чата на стрим в один клик, голосования и счётчики команд.'],
      f4:['⚡', 'Сценарии <i class="lvl">β</i>', '«Если кто-то написал !кринж — показать мем на 5 секунд и запустить конфетти».'],
      f5:['🎯', 'CS2 <i class="lvl">β</i>', 'K/D/A, HP, деньги и всплывашки DOUBLE/TRIPLE/ACE через официальную интеграцию Valve.'],
      f6:['👥', 'Вместе', 'Пригласи второго модератора и меняйте экран одновременно.'],
      hTitle:'Как это работает', hLead:'Три части, которые находят друг друга сами.',
      h1s:'<b>Стример</b> запускает Hudini Host и ставит в OBS ссылку из программы как источник «Браузер» (1920×1080).',
      h2s:'<b>Модератор</b> открывает пульт и отправляет стримеру одну ссылку. Пульт сам находит программу стримера.',
      h3s:'<b>Всё</b>, что делаешь в пульте, сразу появляется на стриме: двигай, показывай, прячь, запускай.',
      pTitle:'Приватность и безопасность', pLead:'Устроено так, чтобы никто посередине не мог прочитать или подменить то, что на стриме.',
      p1:['🔐', 'Шифрование и подпись', 'Каждое изменение шифруется (AES-256) и подписывается ключом модератора. Виджет не принимает ничего без подписи.'],
      p2:['🏠', 'Файлы у стримера', 'Загрузки хранятся зашифрованными на ПК стримера, с его лимитами. Никакого облака.'],
      p3:['🙈', 'Без аккаунтов и трекеров', 'Ключи живут в твоём браузере и в ссылке после #, а эта часть не уходит на сервер.'],
      p4:['📖', 'Открытый код', 'Код открыт под AGPL-3.0, пресеты и анимации под MIT.'],
      lTitle:'Что значат β и α', lText:'Всё без метки стабильное. <i class="lvl">β</i> бета работает, но ещё проверяется на разных компьютерах. <i class="lvl alpha">α</i> альфа — эксперимент.',
      issues:'Сообщить о проблеме', license:'Лицензия', helpLink:'Справка',
    },
    uk: {
      home:'Головна', panel:'Пульт', features:'Можливості', how:'Як працює', privacy:'Приватність', help:'Довідка',
      h1:'Оверлей для стриму, яким керує <span>модератор</span>',
      sub:'Показуй на екрані стримера текст, картинки, GIF, таймери, голосування й ефекти. Стример лише запускає програму, решту робиш ти.',
      open:'Відкрити пульт', download:'⬇ Завантажити Hudini Host', free:'Безкоштовно · відкритий код · Windows, macOS, Linux',
      fTitle:'Що вміє', fLead:'Усе, що ставиш у пульті, з’являється на стримі за частку секунди.',
      f1:['🖼', 'Будь-що на екрані', 'Текст, картинки, GIF, відео, YouTube, Twitch і сайти. Рухай, змінюй розмір, крути, анімуй.'],
      f2:['⏱', 'Таймери й лічильники', 'Зворотний відлік, секундомір, «відлік до», годинник і лічильники, зокрема фліп-годинник.'],
      f3:['💬', 'Чат і голосування <i class="lvl">β</i>', 'Повідомлення з чату на стрим в один клік, голосування й лічильники команд.'],
      f4:['⚡', 'Сценарії <i class="lvl">β</i>', '«Якщо хтось написав !крінж — показати мем на 5 секунд і запустити конфеті».'],
      f5:['🎯', 'CS2 <i class="lvl">β</i>', 'K/D/A, HP, гроші й спливашки DOUBLE/TRIPLE/ACE через офіційну інтеграцію Valve.'],
      f6:['👥', 'Разом', 'Запроси другого модератора й змінюйте екран одночасно.'],
      hTitle:'Як це працює', hLead:'Три частини, які знаходять одна одну самі.',
      h1s:'<b>Стример</b> запускає Hudini Host і ставить в OBS посилання з програми як джерело «Браузер» (1920×1080).',
      h2s:'<b>Модератор</b> відкриває пульт і надсилає стримеру одне посилання. Пульт сам знаходить програму стримера.',
      h3s:'<b>Усе</b>, що робиш у пульті, одразу з’являється на стримі: рухай, показуй, ховай, запускай.',
      pTitle:'Приватність і безпека', pLead:'Влаштовано так, щоб ніхто посередині не міг прочитати чи підмінити те, що на стримі.',
      p1:['🔐', 'Шифрування й підпис', 'Кожна зміна шифрується (AES-256) і підписується ключем модератора. Віджет не приймає нічого без підпису.'],
      p2:['🏠', 'Файли у стримера', 'Завантаження зберігаються зашифрованими на ПК стримера, з його лімітами. Жодної хмари.'],
      p3:['🙈', 'Без акаунтів і трекерів', 'Ключі живуть у твоєму браузері й у посиланні після #, а ця частина не йде на сервер.'],
      p4:['📖', 'Відкритий код', 'Код відкритий під AGPL-3.0, пресети й анімації під MIT.'],
      lTitle:'Що означають β і α', lText:'Усе без позначки стабільне. <i class="lvl">β</i> бета працює, але ще перевіряється на різних комп’ютерах. <i class="lvl alpha">α</i> альфа — експеримент.',
      issues:'Повідомити про проблему', license:'Ліцензія', helpLink:'Довідка',
    },
    de: {
      home:'Start', panel:'Pult', features:'Funktionen', how:'So funktioniert’s', privacy:'Datenschutz', help:'Hilfe',
      h1:'Ein Stream-Overlay, das <span>dein Mod</span> steuert',
      sub:'Zeig Text, Bilder, GIFs, Timer, Umfragen und Effekte auf dem Bildschirm des Streamers. Der Streamer startet nur das Programm, den Rest machst du.',
      open:'Pult öffnen', download:'⬇ Hudini Host herunterladen', free:'Kostenlos · Open Source · Windows, macOS, Linux',
      fTitle:'Was es kann', fLead:'Alles, was du im Pult platzierst, erscheint in Sekundenbruchteilen im Stream.',
      f1:['🖼', 'Alles auf den Bildschirm', 'Text, Bilder, GIFs, Videos, YouTube, Twitch und Websites. Verschieben, skalieren, drehen, animieren.'],
      f2:['⏱', 'Timer und Zähler', 'Countdown, Stoppuhr, „bis“-Timer, Uhr und Zähler, auch im Flip-Clock-Stil.'],
      f3:['💬', 'Chat und Umfragen <i class="lvl">β</i>', 'Eine Chatnachricht mit einem Klick in den Stream, Umfragen und Befehlszähler.'],
      f4:['⚡', 'Szenarien <i class="lvl">β</i>', '„Wenn jemand !cringe schreibt, zeig das Meme 5 Sekunden und starte Konfetti.“'],
      f5:['🎯', 'CS2 <i class="lvl">β</i>', 'K/D/A, HP, Geld und DOUBLE/TRIPLE/ACE-Popups über Valves offizielle Schnittstelle.'],
      f6:['👥', 'Zusammen', 'Lade einen zweiten Mod ein und bearbeitet den Bildschirm gleichzeitig.'],
      hTitle:'So funktioniert’s', hLead:'Drei Teile, die sich von selbst finden.',
      h1s:'<b>Der Streamer</b> startet Hudini Host und fügt den angezeigten Link in OBS als Browser-Quelle ein (1920×1080).',
      h2s:'<b>Der Mod</b> öffnet das Pult und schickt dem Streamer einen Link. Das Pult findet das Programm des Streamers selbst.',
      h3s:'<b>Alles</b>, was du im Pult machst, erscheint sofort im Stream: verschieben, zeigen, verstecken, abspielen.',
      pTitle:'Datenschutz und Sicherheit', pLead:'So gebaut, dass niemand dazwischen lesen oder ändern kann, was im Stream läuft.',
      p1:['🔐', 'Verschlüsselt und signiert', 'Jede Änderung wird verschlüsselt (AES-256) und mit dem Schlüssel des Mods signiert. Das Widget ignoriert alles Unsignierte.'],
      p2:['🏠', 'Dateien bleiben beim Streamer', 'Uploads liegen verschlüsselt auf dem PC des Streamers, mit seinen Limits. Keine Cloud.'],
      p3:['🙈', 'Keine Konten, keine Tracker', 'Die Schlüssel liegen in deinem Browser und im Link nach dem #, der nie einen Server erreicht.'],
      p4:['📖', 'Open Source', 'Der Code ist öffentlich unter AGPL-3.0, Presets und Animationen unter MIT.'],
      lTitle:'Was β und α bedeuten', lText:'Alles ohne Markierung ist stabil. <i class="lvl">β</i> Beta funktioniert, wird aber noch auf mehr Computern getestet. <i class="lvl alpha">α</i> Alpha ist ein Experiment.',
      issues:'Problem melden', license:'Lizenz', helpLink:'Hilfe',
    },
  };

  function card(c){ return `<div class="card"><div class="ic">${c[0]}</div><h3>${c[1]}</h3><p>${c[2]}</p></div>`; }
  function landing(t){
    for(const el of document.querySelectorAll('[data-t]')){ const v = t[el.dataset.t]; if(typeof v === 'string') el.innerHTML = v; }
    for(const el of document.querySelectorAll('[data-cards]')) el.innerHTML = el.dataset.cards.split(',').map(k => card(t[k])).join('');
    for(const el of document.querySelectorAll('[data-steps]')) el.innerHTML = el.dataset.steps.split(',').map(k => `<li>${t[k]}</li>`).join('');
    for(const a of document.querySelectorAll('a[data-dl]')) a.href = DL;
    for(const a of document.querySelectorAll('a[data-help]')) a.href = 'help.html?lang=' + lang;
  }

  function helpPage(){
    const H = window.HUDINI_HELP?.[lang] || window.HUDINI_HELP?.en; if(!H) return;
    document.title = 'Hudini · ' + H.title;
    const toc = document.getElementById('toc'), art = document.getElementById('content'), q = document.getElementById('q');
    q.placeholder = H.search;
    toc.replaceChildren(); art.replaceChildren();
    for(const [id, title, html] of H.sections){
      const a = document.createElement('a'); a.href = '#' + id; a.textContent = title; a.dataset.id = id; toc.appendChild(a);
      const s = document.createElement('section'); s.id = id;
      const h = document.createElement('h2'); h.textContent = title; s.appendChild(h);
      const body = document.createElement('div'); body.innerHTML = html; s.appendChild(body);   // trusted text from help-content.js
      art.appendChild(s);
    }
    const none = document.createElement('p'); none.textContent = H.empty; none.hidden = true; none.className = 'empty'; art.appendChild(none);
    q.oninput = () => {
      const w = q.value.trim().toLowerCase(); let shown = 0;
      for(const s of art.querySelectorAll('section')){ const ok = !w || s.textContent.toLowerCase().includes(w); s.hidden = !ok; toc.querySelector(`[data-id="${s.id}"]`).hidden = !ok; if(ok) shown++; }
      none.hidden = shown > 0;
    };
    const io = new IntersectionObserver(es => { for(const e of es) if(e.isIntersecting) toc.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.id === e.target.id)); }, { rootMargin:'-30% 0px -60% 0px' });
    art.querySelectorAll('section').forEach(s => io.observe(s));
    if(location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  function render(){
    document.documentElement.lang = lang;
    const t = T[lang] || T.en;
    for(const el of document.querySelectorAll('[data-t]')){ const v = t[el.dataset.t]; if(typeof v === 'string') el.innerHTML = v; }
    if(document.body.dataset.page === 'help') helpPage(); else landing(t);
  }
  function setLang(l){
    if(!has(l)) return;
    lang = l; try{ localStorage.setItem('hudini.lang', l); }catch{}
    const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u);
    render();
  }
  for(const s of document.querySelectorAll('select.lang')){
    for(const [c, n] of LANGS){ const o = document.createElement('option'); o.value = c; o.textContent = '🌐 ' + n; o.selected = c === lang; s.appendChild(o); }
    s.onchange = () => setLang(s.value);
  }
  render();
})();
