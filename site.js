// Hudini website: language picker, landing page texts, the live hero demo and the help page.
// The chosen language is shared with the panel (localStorage "hudini.lang").
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const LANGS = [['en', 'English'], ['ru', 'Русский'], ['uk', 'Українська'], ['de', 'Deutsch']];
  const has = c => LANGS.some(l => l[0] === c);
  function pick(){
    const q = new URLSearchParams(location.search).get('lang');
    let s = null; try{ s = localStorage.getItem('hudini.lang'); }catch{}
    for(const c of [q, s, (navigator.language || '').slice(0, 2).toLowerCase()]) if(has(c)) return c;
    return 'en';
  }
  let lang = pick();
  const DL = 'https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.4';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Line icons (24×24, stroke = currentColor).
  const P = {
    text:'<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    poll:'<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2h5M19 5l1.5 1.5"/>',
    count:'<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    sticker:'<path d="M15.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7.5L21 13.5V6a3 3 0 0 0-3-3z"/><path d="M13 21v-5a3 3 0 0 1 3-3h5M8.5 10h.01M14.5 10h.01M8.5 14.5s1.2 1.5 3 1.5"/>',
    bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    cs:'<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r=".8"/>',
    hide:'<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
    chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    lock:'<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>',
    home:'<path d="M3 11 12 4l9 7M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    code:'<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    browser:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01"/>',
    pc:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    obs:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M4.2 16.5l4.8-2.8M19.8 16.5 15 13.7"/>',
    dl:'<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    // CS2 HUD icons, the same set as the overlay's HUD (core.js HUD_IC; Lucide outlines, ISC, icons/LICENSE-lucide)
    heart:'<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
    shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    helmet:'<path d="M4 19c-1-7.5 3-13.5 8.5-13.5 4.7 0 8 3.7 8.5 9.5H9.5l-1.5 4z"/><path d="M21 15h1.5"/>',
    skull:'<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
    bomb:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><rect x="6.5" y="11" width="7" height="4" rx=".5"/><path d="M17 11v1"/><path d="M17 15v1"/><path d="M7 8V5.5a1.5 1.5 0 0 1 1.5-1.5H11"/>',
    kit:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    hs:'<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
    he:'<path d="M6.5 14a5.5 5.5 0 0 1 11 0v2.5a5.5 5.5 0 0 1-11 0z"/><path d="M9.5 8.5V6h5v2.5"/><path d="M14.5 6.5 18 10"/><circle cx="8" cy="4" r="1.6"/>',
    flash:'<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
    smoke:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    molly:'<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  };
  const ic = (k, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`;

  // Landing texts. Values are trusted HTML written here, never user input.
  const T = {
    en: {
      home:'Home', panel:'Panel', features:'Features', how:'How it works', privacy:'Privacy', help:'Help',
      badge:'1.0 RC4 · free',
      h1:'A stream overlay run by <span>your moderator</span>',
      sub:'Show text, pictures, GIFs, timers, polls and effects on the streamer’s screen. The streamer only starts the app, you do the rest.',
      open:'Open the panel', download:ic('dl') + 'Download Hudini Host', free:'Free · open source · Windows, macOS, Linux',
      demoAria:'Animated demo: a moderator clicks buttons in the panel and the elements appear on stream',
      dOnline:'online · Hudini Host', dText:'Text', dPoll:'Poll', dTimer:'Timer', dCount:'Counter', dSticker:'Sticker', dScen:'Scenario', dHide:'Hide all', dChat:'Twitch chat',
      dMsg:'GG! Next round 🔥', dPollQ:'Which map next?', dPollFoot:'Type a number in chat 1–3 · votes:', dBreak:'BREAK', dDeaths:'Deaths',
      dToast:'Scenario <b>!pog</b> → sticker + confetti', dPower:'Powerful feature', dCap:'CS2 HUD · live data from the game', dRound:'Round', dKills:'5 kills', dSeries:'Major · map 2 of 3',
      fTitle:'What it can do', fLead:'Everything you place in the panel appears on stream within a fraction of a second.',
      f1:['image', 'Anything on screen', 'Text, pictures, GIFs, videos, YouTube, Twitch and websites. Drag, resize, rotate, animate.'],
      f2:['timer', 'Timers and counters', 'Countdowns, stopwatches, "until" timers, clocks and counters with flip-clock style.'],
      f3:['chat', 'Chat and polls <i class="lvl">β</i>', 'Show a chat message on stream with one click, run polls and count chat commands.'],
      f4:['bolt', 'Scenarios <i class="lvl">β</i>', '"If someone types !cringe, show the meme for 5 seconds and fire confetti."'],
      f5:['cs', 'CS2 <i class="lvl">β</i>', 'Live K/D/A, HP, money and DOUBLE/TRIPLE/ACE popups via Valve’s official integration.'],
      f6:['users', 'Together', 'Invite a second moderator and edit the screen at the same time.'],
      hTitle:'How it works', hLead:'Three parts that find each other by themselves.',
      nP:'Moderator’s panel', nPs:'in the browser', nH:'Hudini Host', nHs:'on the streamer’s PC', nO:'OBS', nOs:'Browser source', wire:'AES-256 · signed',
      h1s:'<b>The streamer</b> runs Hudini Host and adds the link it shows to OBS as a Browser source (1920×1080).',
      h2s:'<b>The moderator</b> opens the panel and sends the streamer one link. The panel finds the streamer’s app automatically.',
      h3s:'<b>Everything</b> you do in the panel appears on stream right away: drag, show, hide, play.',
      csTitle:'CS2 HUD like a <span class="grad">tournament broadcast</span>',
      csLead:'Hudini reads live data from the game and draws a HUD like a pro broadcast. The streamer just plays.',
      csList:['K/D/A of every player', 'HP, armor and money', 'Kill feed with weapons and headshots', 'DOUBLE / TRIPLE / ACE popups', 'Team names, logos and score', 'Tournament HUD with the observed player', 'Works through Valve’s official Game State Integration: no cheats, nothing injected into the game'],
      csAria:'Animated CS2 HUD example: scoreboard and duel card', mmPlayer:'Player', mmDuel:'Clutch 1v1',
      pTitle:'Privacy and security', pLead:'Built so that nobody in the middle can read or change what is on stream.',
      p1:['lock', 'Encrypted and signed', 'Every change is encrypted (AES-256) and signed with the moderator’s key. The widget ignores anything unsigned.'],
      p2:['home', 'Files stay with the streamer', 'Uploads are stored encrypted on the streamer’s PC with limits they set. No cloud storage.'],
      p3:['hide', 'No accounts, no trackers', 'Keys live in your browser and in the link after #, which never reaches a server.'],
      p4:['code', 'Open source', 'The code is public under AGPL-3.0, presets and animations under MIT.'],
      lTitle:'What β and α mean', lText:'Everything without a mark is stable. <i class="lvl">β</i> beta works but is still being tested on more computers. <i class="lvl alpha">α</i> alpha is an experiment.',
      ctaTitle:'Ready to run the stream <span class="grad">like a show</span>?', ctaText:'The panel opens right in the browser. Send the streamer Hudini Host, and in five minutes you are on screen.',
      issues:'Report a problem', license:'License', helpLink:'Help',
    },
    ru: {
      home:'Главная', panel:'Пульт', features:'Возможности', how:'Как работает', privacy:'Приватность', help:'Справка',
      badge:'1.0 RC4 · бесплатно',
      h1:'Оверлей для стрима, которым управляет <span>модератор</span>',
      sub:'Показывай на экране стримера текст, картинки, GIF, таймеры, голосования и эффекты. Стример только запускает программу, остальное делаешь ты.',
      open:'Открыть пульт', download:ic('dl') + 'Скачать Hudini Host', free:'Бесплатно · открытый код · Windows, macOS, Linux',
      demoAria:'Анимированное демо: модератор нажимает кнопки в пульте, и элементы появляются на стриме',
      dOnline:'онлайн · Hudini Host', dText:'Текст', dPoll:'Опрос', dTimer:'Таймер', dCount:'Счётчик', dSticker:'Стикер', dScen:'Сценарий', dHide:'Скрыть всё', dChat:'Чат Twitch',
      dMsg:'GG! Ещё раунд 🔥', dPollQ:'Какую карту дальше?', dPollFoot:'Пиши в чат число 1–3 · голосов:', dBreak:'ПЕРЕРЫВ', dDeaths:'Смерти',
      dToast:'Сценарий <b>!pog</b> → стикер + конфетти', dPower:'Мощная фича', dCap:'CS2 HUD · живые данные из игры', dRound:'Раунд', dKills:'5 убийств', dSeries:'Major · карта 2 из 3',
      fTitle:'Что умеет', fLead:'Всё, что ставишь в пульте, появляется на стриме за долю секунды.',
      f1:['image', 'Что угодно на экране', 'Текст, картинки, GIF, видео, YouTube, Twitch и сайты. Двигай, меняй размер, крути, анимируй.'],
      f2:['timer', 'Таймеры и счётчики', 'Обратный отсчёт, секундомер, «отсчёт до», часы и счётчики, в том числе флип-часы.'],
      f3:['chat', 'Чат и голосования <i class="lvl">β</i>', 'Сообщение из чата на стрим в один клик, голосования и счётчики команд.'],
      f4:['bolt', 'Сценарии <i class="lvl">β</i>', '«Если кто-то написал !кринж — показать мем на 5 секунд и запустить конфетти».'],
      f5:['cs', 'CS2 <i class="lvl">β</i>', 'K/D/A, HP, деньги и всплывашки DOUBLE/TRIPLE/ACE через официальную интеграцию Valve.'],
      f6:['users', 'Вместе', 'Пригласи второго модератора и меняйте экран одновременно.'],
      hTitle:'Как это работает', hLead:'Три части, которые находят друг друга сами.',
      nP:'Пульт модератора', nPs:'в браузере', nH:'Hudini Host', nHs:'на ПК стримера', nO:'OBS', nOs:'источник «Браузер»', wire:'AES-256 · подпись',
      h1s:'<b>Стример</b> запускает Hudini Host и ставит в OBS ссылку из программы как источник «Браузер» (1920×1080).',
      h2s:'<b>Модератор</b> открывает пульт и отправляет стримеру одну ссылку. Пульт сам находит программу стримера.',
      h3s:'<b>Всё</b>, что делаешь в пульте, сразу появляется на стриме: двигай, показывай, прячь, запускай.',
      csTitle:'CS2 HUD как на <span class="grad">турнирной трансляции</span>',
      csLead:'Hudini берёт живые данные из игры и рисует HUD как у профессиональной трансляции. Стример просто играет.',
      csList:['K/D/A каждого игрока', 'HP, броня и деньги', 'Килфид с оружием и хедшотами', 'Всплывашки DOUBLE / TRIPLE / ACE', 'Названия, логотипы и счёт команд', 'Турнирный HUD с карточкой наблюдаемого игрока', 'Работает через официальную Game State Integration от Valve: без читов и без вмешательства в игру'],
      csAria:'Анимированный пример CS2 HUD: таблица счёта и карточка дуэли', mmPlayer:'Игрок', mmDuel:'Клатч 1 на 1',
      pTitle:'Приватность и безопасность', pLead:'Устроено так, чтобы никто посередине не мог прочитать или подменить то, что на стриме.',
      p1:['lock', 'Шифрование и подпись', 'Каждое изменение шифруется (AES-256) и подписывается ключом модератора. Виджет не принимает ничего без подписи.'],
      p2:['home', 'Файлы у стримера', 'Загрузки хранятся зашифрованными на ПК стримера, с его лимитами. Никакого облака.'],
      p3:['hide', 'Без аккаунтов и трекеров', 'Ключи живут в твоём браузере и в ссылке после #, а эта часть не уходит на сервер.'],
      p4:['code', 'Открытый код', 'Код открыт под AGPL-3.0, пресеты и анимации под MIT.'],
      lTitle:'Что значат β и α', lText:'Всё без метки стабильное. <i class="lvl">β</i> бета работает, но ещё проверяется на разных компьютерах. <i class="lvl alpha">α</i> альфа — эксперимент.',
      ctaTitle:'Готов вести стрим <span class="grad">как шоу</span>?', ctaText:'Пульт открывается прямо в браузере. Отправь стримеру Hudini Host, и через пять минут ты уже на экране.',
      issues:'Сообщить о проблеме', license:'Лицензия', helpLink:'Справка',
    },
    uk: {
      home:'Головна', panel:'Пульт', features:'Можливості', how:'Як працює', privacy:'Приватність', help:'Довідка',
      badge:'1.0 RC4 · безкоштовно',
      h1:'Оверлей для стриму, яким керує <span>модератор</span>',
      sub:'Показуй на екрані стримера текст, картинки, GIF, таймери, голосування й ефекти. Стример лише запускає програму, решту робиш ти.',
      open:'Відкрити пульт', download:ic('dl') + 'Завантажити Hudini Host', free:'Безкоштовно · відкритий код · Windows, macOS, Linux',
      demoAria:'Анімоване демо: модератор натискає кнопки в пульті, і елементи з’являються на стримі',
      dOnline:'онлайн · Hudini Host', dText:'Текст', dPoll:'Опитування', dTimer:'Таймер', dCount:'Лічильник', dSticker:'Стікер', dScen:'Сценарій', dHide:'Сховати все', dChat:'Чат Twitch',
      dMsg:'GG! Ще раунд 🔥', dPollQ:'Яку карту далі?', dPollFoot:'Пиши в чат число 1–3 · голосів:', dBreak:'ПЕРЕРВА', dDeaths:'Смерті',
      dToast:'Сценарій <b>!pog</b> → стікер + конфеті', dPower:'Потужна фіча', dCap:'CS2 HUD · живі дані з гри', dRound:'Раунд', dKills:'5 вбивств', dSeries:'Major · карта 2 з 3',
      fTitle:'Що вміє', fLead:'Усе, що ставиш у пульті, з’являється на стримі за частку секунди.',
      f1:['image', 'Будь-що на екрані', 'Текст, картинки, GIF, відео, YouTube, Twitch і сайти. Рухай, змінюй розмір, крути, анімуй.'],
      f2:['timer', 'Таймери й лічильники', 'Зворотний відлік, секундомір, «відлік до», годинник і лічильники, зокрема фліп-годинник.'],
      f3:['chat', 'Чат і голосування <i class="lvl">β</i>', 'Повідомлення з чату на стрим в один клік, голосування й лічильники команд.'],
      f4:['bolt', 'Сценарії <i class="lvl">β</i>', '«Якщо хтось написав !крінж — показати мем на 5 секунд і запустити конфеті».'],
      f5:['cs', 'CS2 <i class="lvl">β</i>', 'K/D/A, HP, гроші й спливашки DOUBLE/TRIPLE/ACE через офіційну інтеграцію Valve.'],
      f6:['users', 'Разом', 'Запроси другого модератора й змінюйте екран одночасно.'],
      hTitle:'Як це працює', hLead:'Три частини, які знаходять одна одну самі.',
      nP:'Пульт модератора', nPs:'у браузері', nH:'Hudini Host', nHs:'на ПК стримера', nO:'OBS', nOs:'джерело «Браузер»', wire:'AES-256 · підпис',
      h1s:'<b>Стример</b> запускає Hudini Host і ставить в OBS посилання з програми як джерело «Браузер» (1920×1080).',
      h2s:'<b>Модератор</b> відкриває пульт і надсилає стримеру одне посилання. Пульт сам знаходить програму стримера.',
      h3s:'<b>Усе</b>, що робиш у пульті, одразу з’являється на стримі: рухай, показуй, ховай, запускай.',
      csTitle:'CS2 HUD як на <span class="grad">турнірній трансляції</span>',
      csLead:'Hudini бере живі дані з гри й малює HUD як у професійної трансляції. Стример просто грає.',
      csList:['K/D/A кожного гравця', 'HP, броня й гроші', 'Кілфід зі зброєю та хедшотами', 'Спливашки DOUBLE / TRIPLE / ACE', 'Назви, логотипи й рахунок команд', 'Турнірний HUD з карткою гравця, за яким стежить камера', 'Працює через офіційну Game State Integration від Valve: без читів і без втручання в гру'],
      csAria:'Анімований приклад CS2 HUD: таблиця рахунку й картка дуелі', mmPlayer:'Гравець', mmDuel:'Клатч 1 на 1',
      pTitle:'Приватність і безпека', pLead:'Влаштовано так, щоб ніхто посередині не міг прочитати чи підмінити те, що на стримі.',
      p1:['lock', 'Шифрування й підпис', 'Кожна зміна шифрується (AES-256) і підписується ключем модератора. Віджет не приймає нічого без підпису.'],
      p2:['home', 'Файли у стримера', 'Завантаження зберігаються зашифрованими на ПК стримера, з його лімітами. Жодної хмари.'],
      p3:['hide', 'Без акаунтів і трекерів', 'Ключі живуть у твоєму браузері й у посиланні після #, а ця частина не йде на сервер.'],
      p4:['code', 'Відкритий код', 'Код відкритий під AGPL-3.0, пресети й анімації під MIT.'],
      lTitle:'Що означають β і α', lText:'Усе без позначки стабільне. <i class="lvl">β</i> бета працює, але ще перевіряється на різних комп’ютерах. <i class="lvl alpha">α</i> альфа — експеримент.',
      ctaTitle:'Готовий вести стрим <span class="grad">як шоу</span>?', ctaText:'Пульт відкривається просто в браузері. Надішли стримеру Hudini Host, і за п’ять хвилин ти вже на екрані.',
      issues:'Повідомити про проблему', license:'Ліцензія', helpLink:'Довідка',
    },
    de: {
      home:'Start', panel:'Pult', features:'Funktionen', how:'So funktioniert’s', privacy:'Datenschutz', help:'Hilfe',
      badge:'1.0 RC4 · kostenlos',
      h1:'Ein Stream-Overlay, das <span>dein Mod</span> steuert',
      sub:'Zeig Text, Bilder, GIFs, Timer, Umfragen und Effekte auf dem Bildschirm des Streamers. Der Streamer startet nur das Programm, den Rest machst du.',
      open:'Pult öffnen', download:ic('dl') + 'Hudini Host herunterladen', free:'Kostenlos · Open Source · Windows, macOS, Linux',
      demoAria:'Animierte Demo: Ein Mod klickt Knöpfe im Pult und die Elemente erscheinen im Stream',
      dOnline:'online · Hudini Host', dText:'Text', dPoll:'Umfrage', dTimer:'Timer', dCount:'Zähler', dSticker:'Sticker', dScen:'Szenario', dHide:'Alles ausblenden', dChat:'Twitch-Chat',
      dMsg:'GG! Nächste Runde 🔥', dPollQ:'Welche Map als Nächstes?', dPollFoot:'Schreib 1–3 in den Chat · Stimmen:', dBreak:'PAUSE', dDeaths:'Tode',
      dToast:'Szenario <b>!pog</b> → Sticker + Konfetti', dPower:'Top-Funktion', dCap:'CS2 HUD · Live-Daten aus dem Spiel', dRound:'Runde', dKills:'5 Kills', dSeries:'Major · Map 2 von 3',
      fTitle:'Was es kann', fLead:'Alles, was du im Pult platzierst, erscheint in Sekundenbruchteilen im Stream.',
      f1:['image', 'Alles auf den Bildschirm', 'Text, Bilder, GIFs, Videos, YouTube, Twitch und Websites. Verschieben, skalieren, drehen, animieren.'],
      f2:['timer', 'Timer und Zähler', 'Countdown, Stoppuhr, „bis“-Timer, Uhr und Zähler, auch im Flip-Clock-Stil.'],
      f3:['chat', 'Chat und Umfragen <i class="lvl">β</i>', 'Eine Chatnachricht mit einem Klick in den Stream, Umfragen und Befehlszähler.'],
      f4:['bolt', 'Szenarien <i class="lvl">β</i>', '„Wenn jemand !cringe schreibt, zeig das Meme 5 Sekunden und starte Konfetti.“'],
      f5:['cs', 'CS2 <i class="lvl">β</i>', 'K/D/A, HP, Geld und DOUBLE/TRIPLE/ACE-Popups über Valves offizielle Schnittstelle.'],
      f6:['users', 'Zusammen', 'Lade einen zweiten Mod ein und bearbeitet den Bildschirm gleichzeitig.'],
      hTitle:'So funktioniert’s', hLead:'Drei Teile, die sich von selbst finden.',
      nP:'Pult des Mods', nPs:'im Browser', nH:'Hudini Host', nHs:'auf dem PC des Streamers', nO:'OBS', nOs:'Browser-Quelle', wire:'AES-256 · signiert',
      h1s:'<b>Der Streamer</b> startet Hudini Host und fügt den angezeigten Link in OBS als Browser-Quelle ein (1920×1080).',
      h2s:'<b>Der Mod</b> öffnet das Pult und schickt dem Streamer einen Link. Das Pult findet das Programm des Streamers selbst.',
      h3s:'<b>Alles</b>, was du im Pult machst, erscheint sofort im Stream: verschieben, zeigen, verstecken, abspielen.',
      csTitle:'CS2 HUD wie bei einer <span class="grad">Turnierübertragung</span>',
      csLead:'Hudini liest Live-Daten aus dem Spiel und zeichnet ein HUD wie bei einer Profi-Übertragung. Der Streamer spielt einfach.',
      csList:['K/D/A jedes Spielers', 'HP, Rüstung und Geld', 'Killfeed mit Waffen und Headshots', 'DOUBLE / TRIPLE / ACE-Popups', 'Teamnamen, Logos und Spielstand', 'Turnier-HUD mit dem beobachteten Spieler', 'Läuft über Valves offizielle Game State Integration: keine Cheats, nichts wird ins Spiel eingeschleust'],
      csAria:'Animiertes CS2-HUD-Beispiel: Scoreboard und Duell-Karte', mmPlayer:'Spieler', mmDuel:'Clutch 1v1',
      pTitle:'Datenschutz und Sicherheit', pLead:'So gebaut, dass niemand dazwischen lesen oder ändern kann, was im Stream läuft.',
      p1:['lock', 'Verschlüsselt und signiert', 'Jede Änderung wird verschlüsselt (AES-256) und mit dem Schlüssel des Mods signiert. Das Widget ignoriert alles Unsignierte.'],
      p2:['home', 'Dateien bleiben beim Streamer', 'Uploads liegen verschlüsselt auf dem PC des Streamers, mit seinen Limits. Keine Cloud.'],
      p3:['hide', 'Keine Konten, keine Tracker', 'Die Schlüssel liegen in deinem Browser und im Link nach dem #, der nie einen Server erreicht.'],
      p4:['code', 'Open Source', 'Der Code ist öffentlich unter AGPL-3.0, Presets und Animationen unter MIT.'],
      lTitle:'Was β und α bedeuten', lText:'Alles ohne Markierung ist stabil. <i class="lvl">β</i> Beta funktioniert, wird aber noch auf mehr Computern getestet. <i class="lvl alpha">α</i> Alpha ist ein Experiment.',
      ctaTitle:'Bereit für einen Stream <span class="grad">wie eine Show</span>?', ctaText:'Das Pult öffnet sich direkt im Browser. Schick dem Streamer Hudini Host, und in fünf Minuten bist du auf dem Bildschirm.',
      issues:'Problem melden', license:'Lizenz', helpLink:'Hilfe',
    },
  };

  // ---------- pausable clocks: a demo only advances while it is on screen and the tab is visible ----------
  const clocks = new Set();
  const seen = new IntersectionObserver(es => { for(const e of es) if(e.target._clk) e.target._clk.vis = e.isIntersecting; }, { threshold:0.08 });
  function makeClock(el){
    el._clk?.kill();
    const c = { el, t:0, vis:false, on:false, waits:[], ticks:new Set() };
    c.wait = ms => new Promise(res => c.waits.push({ at:c.t + ms, res }));
    c.kill = () => { clocks.delete(c); c.waits = []; c.ticks.clear(); seen.unobserve(el); if(el._clk === c) el._clk = null; };
    el._clk = c; clocks.add(c); seen.observe(el);
    return c;
  }
  let lastFrame = 0;
  function frame(now){
    const dt = lastFrame ? Math.min(now - lastFrame, 80) : 0; lastFrame = now;
    for(const c of clocks){
      const on = c.vis && !document.hidden;
      if(on !== c.on){ c.on = on; c.el.classList.toggle('paused', !on); }
      if(!on) continue;
      c.t += dt;
      for(const f of c.ticks) f(dt);
      if(c.waits.length){ const due = c.waits.filter(w => w.at <= c.t); if(due.length){ c.waits = c.waits.filter(w => w.at > c.t); due.forEach(w => w.res()); } }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ---------- CS2 HUD scene (self-contained: data, markup, animation; styles under "CS2 HUD" in site.css) ----------
  // player: [nick, hp, kills, deaths, money, weapon, grenades, armor]
  const CS = {
    ct:{ name:'NAVI', logo:'N', score:9, players:[
      ['kyro', 100, 21, 12, 4750, 'AK-47', ['he', 'flash', 'smoke'], 'helmet'],
      ['frost', 100, 14, 13, 3200, 'AWP', ['flash'], 'shield'],
      ['nexa', 84, 11, 15, 2900, 'M4A1-S', ['smoke', 'molly'], 'helmet'],
      ['bolt', 100, 9, 14, 4100, 'M4A4', ['kit', 'he'], 'helmet'],
      ['vexx', 62, 12, 13, 1850, 'Deagle', ['flash'], 'shield']] },
    t:{ name:'Vitality', logo:'V', score:7, players:[
      ['zayn', 100, 18, 14, 5200, 'AWP', ['smoke'], 'helmet'],
      ['rook', 100, 13, 16, 2400, 'AK-47', ['molly', 'flash'], 'helmet'],
      ['mako', 100, 10, 15, 3650, 'AK-47', ['smoke', 'he'], 'shield'],
      ['juno', 100, 15, 13, 4300, 'Galil AR', ['he', 'flash'], 'helmet'],
      ['drift', 100, 8, 16, 1500, 'Tec-9', [], 'shield']] },
    round:17, bomb:38,
    // kyro (observed, CT) takes the whole T side: ACE
    kills:[['rook', 'AK-47', 1], ['mako', 'AK-47', 0], ['juno', 'AK-47', 1], ['drift', 'AK-47', 0], ['zayn', 'AK-47', 1]],
  };
  const initials = n => n.slice(0, 2).toUpperCase();
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const money = v => '$' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const hpColor = hp => hp > 50 ? '#3ddc84' : hp > 25 ? '#f5a623' : '#ff4d5e';
  function csScore(t, mid){
    return `<div class="cs-score gl">
      <div class="cs-team cs-ct"><span class="cs-logo">${CS.ct.logo}</span>${CS.ct.name}</div>
      <div class="cs-sc cs-ct" data-sc="ct">${CS.ct.score}</div>
      <div class="cs-mid"><small>${t.dRound} ${CS.round}</small>${mid}</div>
      <div class="cs-sc cs-t" data-sc="t">${CS.t.score}</div>
      <div class="cs-team cs-t"><span class="cs-logo">${CS.t.logo}</span>${CS.t.name}</div></div>`;
  }
  function csCard(side, p, i){
    const [nick, hp, k, d, m, w, nades, arm] = p, slot = side === 'ct' ? i + 1 : (i + 6) % 10;
    return `<div class="cs-p gl cs-${side}${side === 'ct' && i === 0 ? ' obs' : ''}" data-p="${side}${i}" style="transition-delay:${(side === 'ct' ? i : 4 - i) * 45 + 150}ms">
      <div class="r1"><span class="cs-av">${initials(nick)}</span><b class="cs-hp">${hp}</b><span class="cs-arm">${ic(arm)}</span></div>
      <div class="cs-bar"><i style="width:${hp}%;background:${hpColor(hp)}"></i></div>
      <div class="cs-nick"><i>${slot}</i>${nick}</div>
      <div class="r3"><span class="kd">${k}/${d}</span><span class="m">${money(m)}</span></div>
      <div class="r4"><span class="wp">${w}</span><span class="nd">${nades.map(n => ic(n, n)).join('')}</span></div></div>`;
  }
  function csHTML(t){
    const o = CS.ct.players[0];
    return `<div class="cs-flash"></div>
    <div class="cs-top">${csScore(t, `<span class="cs-bomb">${ic('bomb')}<b>${mmss(CS.bomb)}</b></span>`)}<div class="cs-series gl">${t.dSeries}</div></div>
    <div class="cs-feed"></div>
    <div class="cs-ace"><b>ACE!</b><small class="gl">${o[0]} · ${t.dKills}</small></div>
    <div class="cs-bot">
      <div class="cs-side">${CS.ct.players.map((p, i) => csCard('ct', p, i)).join('')}</div>
      <div class="cs-obs gl cs-ct">
        <span class="cs-av">${initials(o[0])}</span>
        <div class="mid"><div class="nm">${o[0]}</div>
          <div class="bars"><b class="hpn">${o[1]}</b><div class="cs-bar"><i></i></div><span class="ar">${ic('shield')}100</span></div>
          <div class="stats"><i>K</i><b class="ok">${o[2]}</b><i>D</i><b>${o[3]}</b><i>A</i><b>4</b><i>ADR</i><b>118</b><i>HS</i><b>54%</b></div></div>
        <div class="rt"><span class="m">${money(o[4])}</span><span>${o[5]}</span><span class="ammo">30/90</span></div>
      </div>
      <div class="cs-side">${CS.t.players.map((p, i) => csCard('t', p, i)).join('')}</div>
    </div>`;
  }
  // Plays the HUD inside `root` (a .cs element) on the demo clock. Returns when the ACE is over.
  async function csScene(root, t, clk){
    const wait = clk.wait, alive = () => root.isConnected && root.classList.contains('on');
    root.innerHTML = csHTML(t);
    void root.offsetWidth; root.classList.add('on');
    const q = s => root.querySelector(s);
    let bomb = CS.bomb;
    (async () => { while(true){ await wait(1000); if(!alive()) return; bomb = Math.max(0, bomb - 1); q('.cs-bomb b').textContent = mmss(bomb); } })();
    const me = CS.ct.players[0];
    let ammo = 30, kills = me[2];
    const card = id => q(`[data-p="${id}"]`);
    function setHp(id, hp){
      const c = card(id), b = c.querySelector('.cs-hp'), bar = c.querySelector('.cs-bar i');
      bar.style.width = hp + '%'; bar.style.background = hpColor(hp);
      if(hp === 0){ c.classList.add('dead'); b.innerHTML = ic('skull'); c.querySelector('.r4').innerHTML = ''; c.querySelector('.cs-arm').innerHTML = ''; }
      else{ b.textContent = hp; b.classList.toggle('low', hp <= 25); restart(c, 'hit'); }
    }
    const feed = q('.cs-feed');
    const shoot = n => { ammo = Math.max(0, ammo - n); q('.ammo').textContent = `${ammo}/90`; };
    await wait(1300);
    // a hit on juno: floating damage number, HP bar drops
    shoot(3);
    const j = card('t3'), dmg = document.createElement('div'); dmg.className = 'cs-dmg'; dmg.textContent = '-27'; j.appendChild(dmg);
    setHp('t3', 73);
    await wait(900);
    for(const [victim, weapon, hs] of CS.kills){
      shoot(hs ? 2 : 4);
      const row = document.createElement('div'); row.className = 'cs-k gl cs-ct'; row.style.setProperty('--c', 'var(--ct)');
      row.innerHTML = `<span class="a cs-ct">${me[0]}</span><span class="w">${weapon}</span>${hs ? `<span class="hs">${ic('hs')}</span>` : ''}<span class="b cs-t">${victim}</span>`;
      feed.appendChild(row);
      const rows = [...feed.querySelectorAll('.cs-k:not(.out)')];
      if(rows.length > 3){ const r0 = rows[0]; r0.classList.add('out'); wait(340).then(() => r0.remove()); }
      setHp('t' + CS.t.players.findIndex(p => p[0] === victim), 0);
      kills++;
      q('.cs-obs .ok').textContent = kills;
      card('ct0').querySelector('.kd').textContent = `${kills}/${me[3]}`;
      await wait(620);
    }
    q('.cs-ace').classList.add('on'); q('.cs-flash').classList.add('on');
    await wait(900);
    const sc = q('[data-sc="ct"]'); sc.textContent = CS.ct.score + 1; restart(sc, 'bump');
    await wait(1900);
  }

  // ---------- hero demo: panel on the left, stream on the right ----------
  const CHAT = [['nightowl', 'n1'], ['pixelkat', 'n2'], ['b0rsch', 'n3'], ['m1ra', 'n4'], ['zefir', 'n5'], ['kotleta', 'n3'], ['vandal', 'n1'], ['lumen', 'n2']];
  const MOUNTAINS = '<svg viewBox="0 0 160 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60V30l14-7 12 6 20-19 16 13 10-5 18 15 14-11 22 14 16-7 18 9v22z" fill="#1a1733"/><path d="M0 60V42l22-8 20 5 28-14 24 12 22-6 24 9 20-4v24z" fill="#110f22"/></svg>';
  const CURSOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5 19 13.6l-6.6 1.1 3.9 6.9-2.9 1.5-3.8-7L4.4 20z" fill="#fff" stroke="#14131c" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  function heroDemo(el, t){
    const B = [['text', 'text'], ['poll', 'poll'], ['timer', 'timer'], ['count', 'count'], ['sticker', 'sticker'], ['scen', 'bolt'], ['cs', 'cs', 'wide b-cs', 'CS2 HUD'], ['hide', 'hide', 'wide b-hide']];
    const lbl = { text:t.dText, poll:t.dPoll, timer:t.dTimer, count:t.dCount, sticker:t.dSticker, scen:t.dScen, hide:t.dHide };
    el.innerHTML = `
    <div class="dv-bar"><i></i><i></i><i></i><span class="dv-on"><b></b>${t.dOnline}</span><span class="dv-obs">OBS 1920×1080</span></div>
    <div class="dv-body">
      <div class="dv-panel">
        <div class="dp-head"><img src="icons/icon-192.png" alt="">Hudini<span class="dp-room">#etsuitoku</span></div>
        <div class="dp-btns">${B.map(([k, i, cls, name]) => `<div class="dp-b ${cls || ''}" data-b="${k}">${ic(i)}<span>${name || lbl[k]}</span></div>`).join('')}</div>
        <div class="dp-chat"><div class="dp-ct"><b></b>${t.dChat}</div><div class="dp-msgs"></div><div class="dv-toast">${ic('bolt')}<span>${t.dToast}</span></div></div>
      </div>
      <div class="dv-stage"><div class="st">
        <div class="st-bg"><i></i><i></i><i></i><i></i><i></i>${MOUNTAINS}</div>
        <div class="st-live"><b></b>LIVE</div>
        <div class="o o-text">${t.dMsg}</div>
        <div class="o o-poll"><h4>${t.dPollQ}</h4>${['Mirage', 'Inferno', 'Nuke'].map((m, i) => `<div class="pr"><span class="k">${i + 1}</span><span>${m}</span><span class="bar"><i></i></span><span class="v"></span></div>`).join('')}<div class="pf"></div></div>
        <div class="o o-timer"><div class="lb">${t.dBreak}</div><div class="flip"><span class="fd"><span></span></span><span class="fd"><span></span></span><span class="colon">:</span><span class="fd"><span></span></span><span class="fd"><span></span></span></div></div>
        <div class="o o-count"><small>${t.dDeaths}</small><b>6</b></div>
        <div class="o o-sticker">POG!</div>
        <div class="o o-cap"><span>${ic('star')}${t.dPower}</span><p>${t.dCap}</p></div>
        <div class="cs"></div>
        <canvas class="o-conf"></canvas>
      </div></div>
    </div>
    <div class="dv-cur hidden">${CURSOR}</div>`;
    const $ = s => el.querySelector(s), st = $('.st');
    const clk = makeClock(el), wait = clk.wait;
    const btn = k => $(`[data-b="${k}"]`);
    const on = (sel, v = true) => $(sel).classList.toggle('on', v);
    const lit = (k, v = true) => btn(k).classList.toggle('on', v);

    // poll
    const votes = [0, 0, 0];
    function poll(){
      const total = votes.reduce((a, b) => a + b, 0), max = Math.max(...votes);
      el.querySelectorAll('.pr').forEach((r, i) => {
        const pct = total ? Math.round(votes[i] / total * 100) : 0;
        r.querySelector('.bar i').style.width = pct + '%';
        r.querySelector('.v').textContent = `${pct}% · ${votes[i]}`;
        r.classList.toggle('lead', votes[i] === max && total > 0);
      });
      $('.pf').textContent = `${t.dPollFoot} ${total}`;
    }
    // flip clock
    const digits = [...el.querySelectorAll('.fd')];
    function clock(sec){
      const s = String(Math.floor(sec / 60)).padStart(2, '0') + String(sec % 60).padStart(2, '0');
      digits.forEach((d, i) => { const sp = d.firstChild; if(sp.textContent !== s[i]){ sp.textContent = s[i]; if(!reduced) restart(d, 'flipping'); } });
    }
    let timerTok = 0;
    function runTimer(from){
      const tok = ++timerTok; let s = from; clock(s);
      (async () => { while(true){ await wait(1000); if(tok !== timerTok) return; s = Math.max(0, s - 1); clock(s); } })();
    }
    // counter
    const cnt = $('.o-count b');
    const setCount = (n, bump) => { cnt.textContent = n; if(bump) restart(cnt, 'bump'); };
    // chat
    const msgs = $('.dp-msgs'); let ci = 0;
    function say(text, cmd){
      const [n, c] = CHAT[ci++ % CHAT.length];
      const p = document.createElement('p'); if(cmd) p.className = 'cmd';
      p.innerHTML = `<b class="${c}">${n}</b>: ${cmd ? `<em>${text}</em>` : text}`;
      msgs.appendChild(p);
      while(msgs.children.length > 7) msgs.firstChild.remove();
    }
    // confetti on the stream canvas
    const cv = $('.o-conf'), cx = cv.getContext('2d');
    function confetti(){
      const r = st.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const W = cv.width, H = cv.height, cols = ['#7c5cff', '#ff5c9a', '#ffd166', '#4fd8ff', '#8ef0a8', '#ffffff'];
      const ps = Array.from({ length:150 }, (_, i) => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = (0.5 + Math.random() * 0.75) * H * 0.0024;
        return { x:W * (i % 2 ? 0.38 : 0.62), y:H * 0.58, vx:Math.cos(a) * v, vy:Math.sin(a) * v * 1.25, s:(3 + Math.random() * 5) * dpr * r.width / 700, r:Math.random() * 6, vr:(Math.random() - 0.5) * 0.02, c:cols[i % cols.length], life:0 };
      });
      let age = 0;
      const f = dt => {
        age += dt; cx.clearRect(0, 0, W, H);
        for(const p of ps){ p.vy += H * 0.0000045 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
          cx.save(); cx.globalAlpha = Math.max(0, 1 - age / 2600); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); }
        if(age > 2600){ clk.ticks.delete(f); cx.clearRect(0, 0, W, H); }
      };
      clk.ticks.add(f);
    }
    // cursor
    const cur = $('.dv-cur');
    function point(target, dx = 0.5, dy = 0.55){
      const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
      return [b.left - a.left + b.width * dx, b.top - a.top + b.height * dy];
    }
    let cp = [0, 0];
    const moveTo = ([x, y]) => { cp = [x, y]; cur.style.transform = `translate(${x - 4}px,${y - 2}px)`; };
    async function click(k){
      const b = btn(k);
      moveTo(point(b, 0.42)); await wait(900);
      b.classList.add('press');
      const rp = document.createElement('div'); rp.className = 'dv-rip'; rp.style.left = cp[0] + 'px'; rp.style.top = cp[1] + 'px'; el.appendChild(rp);
      wait(600).then(() => rp.remove());
      await wait(150); b.classList.remove('press'); await wait(120);
    }
    const OV = ['.o-text', '.o-poll', '.o-timer', '.o-count', '.o-sticker'];
    function clearStream(){
      OV.forEach(s => on(s, false)); timerTok++;
      el.querySelectorAll('.dp-b').forEach(b => b.classList.remove('on'));
    }

    if(reduced){   // one still frame with the classic overlay
      votes.splice(0, 3, 14, 9, 5); poll(); clock(272); setCount(7);
      OV.forEach(s => on(s)); ['text', 'poll', 'timer', 'count', 'sticker'].forEach(k => lit(k));
      ['1', '2', '1', '!pog'].forEach((m, i) => say(m, i === 3));
      return;
    }

    async function loop(){
      cur.classList.remove('hidden');
      moveTo(point(st, 0.7, 0.75));
      for(;;){
        clearStream(); votes.splice(0, 3, 5, 3, 2); poll(); setCount(6); msgs.replaceChildren();
        say('hi chat'); await wait(700);
        // a. text
        await click('text'); on('.o-text'); lit('text'); say('GG'); await wait(1400);
        // b. poll + votes from chat
        await click('poll'); on('.o-poll'); lit('poll'); await wait(500);
        for(const v of ['1', '2', '1', '3', '1', '2', '1', '1']){ say(v); votes[+v - 1]++; poll(); await wait(380); }
        // c. flip timer + counter
        await click('timer'); runTimer(300); on('.o-timer'); lit('timer'); await wait(500);
        await click('count'); on('.o-count'); lit('count'); await wait(700);
        setCount(7, true); say('F'); await wait(900); setCount(8, true); await wait(700);
        // d. scenario: !pog in chat → sticker + confetti
        moveTo(point(st, 0.62, 0.82)); say('!pog', true); await wait(450);
        on('.dv-toast'); lit('scen'); await wait(650);
        on('.o-sticker'); lit('sticker'); confetti(); say('POGGERS'); await wait(2200);
        on('.dv-toast', false); lit('scen', false);
        // e. CS2 HUD
        await click('cs'); clearStream(); lit('cs'); st.classList.add('cs-mode'); on('.o-cap');
        moveTo(point(st, 0.5, 0.5));
        await wait(500);
        say('ACE incoming?');
        await csScene($('.cs'), t, clk);
        say('ACEEEE');
        await wait(600);
        // f. hide everything
        await click('hide');
        on('.cs', false); on('.o-cap', false); st.classList.remove('cs-mode'); clearStream();
        moveTo(point(st, 0.7, 0.75));
        await wait(1600);
      }
    }
    loop();
  }

  // ---------- CS2 section: scoreboard table ↔ duel comparison (same glass look as the HUD) ----------
  function csMini(el, t){
    const stat = p => { const [n, , k, d] = p, a = (k * 7) % 9 + 2; return { k, d, a, pm:k - d, adr:60 + (k * 13) % 60, hs:30 + (k * 7) % 28 }; };
    const sign = v => (v > 0 ? '+' : '') + v;
    const row = (p, side) => { const s = stat(p); return `<div class="mm-tr" data-n="${p[0]}"><span class="av">${initials(p[0])}</span><span class="nm">${p[0]}</span><b class="k">${s.k}</b><b class="d">${s.d}</b><b>${s.a}</b><b class="pm">${sign(s.pm)}</b><b>${s.adr}</b><b>${money(p[4])}</b></div>`; };
    const head = `<div class="mm-tr th"><span>${t.mmPlayer}</span><b>K</b><b>D</b><b>A</b><b>+/-</b><b>ADR</b><b>$</b></div>`;
    const sec = side => `<div class="mm-sec cs-${side}">${head}${CS[side].players.map(p => row(p, side)).join('')}</div>`;
    const a = CS.ct.players[0], b = CS.t.players[0], sa = stat(a), sb = stat(b);
    const cmp = [['K', sa.k, sb.k], ['ADR', sa.adr, sb.adr], ['HS%', sa.hs, sb.hs], ['$', a[4], b[4]]];
    const side = (p, s) => `<div class="sd cs-${s}"><span class="av">${initials(p[0])}</span><span class="nm">${p[0]}</span><span class="hpl">${ic('heart')}<b>100</b></span></div>`;
    el.innerHTML = `
      <div class="mm-v mm-sb on">
        ${csScore(t, `<b>1:24</b>`).replace('cs-score', 'cs-score mm-score')}
        <div class="mm-ser gl">${t.dSeries}</div>
        <div class="mm-tb gl-none">${sec('ct')}${sec('t')}</div>
      </div>
      <div class="mm-v mm-du">
        ${csScore(t, `<b>0:19</b>`).replace('cs-score', 'cs-score mm-score')}
        <div class="mm-vs gl">
          <div class="mm-vt">${ic('hs')}${t.mmDuel}</div>
          <div class="mm-vh">${side(a, 'ct')}<span class="x">VS</span>${side(b, 't')}</div>
          <div class="mm-cmp">${cmp.map(([l, x, y]) => `<div class="mm-cr"><span class="l${x > y ? ' w' : ''}">${l === '$' ? money(x) : x}</span><span class="bl cs-ct"><i data-w="${Math.round(x / Math.max(x, y) * 100)}"></i></span><span class="lb">${l}</span><span class="br cs-t"><i data-w="${Math.round(y / Math.max(x, y) * 100)}"></i></span><span class="r${y > x ? ' w' : ''}">${l === '$' ? money(y) : y}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="mm-tabs"><i class="on"></i><i></i></div>`;
    const $ = s => el.querySelector(s), views = [$('.mm-sb'), $('.mm-du')], tabs = el.querySelectorAll('.mm-tabs i');
    const show = i => { views.forEach((v, j) => v.classList.toggle('on', i === j)); tabs.forEach((v, j) => v.classList.toggle('on', i === j)); };
    const bars = on => el.querySelectorAll('.mm-cr i').forEach(i => { i.style.width = on ? i.dataset.w + '%' : '0'; });
    const clk = makeClock(el), wait = clk.wait;
    if(reduced){ bars(true); return; }
    const sides = el.querySelectorAll('.mm-vs .sd'), hpl = el.querySelectorAll('.mm-vs .hpl');
    const hp = (i, v) => { hpl[i].querySelector('b').textContent = v; hpl[i].classList.toggle('low', v <= 25); };
    (async () => {
      for(;;){
        show(0);
        const k = $('[data-n="kyro"] .k'), d = $('[data-n="zayn"] .d'), z = $('[data-n="zayn"]');
        k.textContent = sa.k; d.textContent = sb.d; k.classList.remove('hl'); d.classList.remove('hl'); z.classList.remove('dead');
        await wait(2200);
        k.textContent = sa.k + 1; d.textContent = sb.d + 1; restart(k, 'hl'); restart(d, 'hl'); z.classList.add('dead');
        await wait(2600);
        bars(false); hp(0, 100); hp(1, 100); sides.forEach(s => s.classList.remove('lost'));
        show(1); await wait(500); bars(true); await wait(1300);
        hp(0, 54); await wait(900);
        hp(1, 18); await wait(700);
        hp(1, 0); sides[1].classList.add('lost');
        await wait(2400);
      }
    })();
  }

  // ---------- "How it works" diagram ----------
  function flow(el, t){
    const node = (i, b, s) => `<div class="node"><div class="ni">${ic(i)}</div><b>${b}</b><small>${s}</small></div>`;
    const wire = (cls, label) => `<div class="wire ${cls}"><span>${label}</span><i>${ic('lock')}</i><i>${ic('lock')}</i><i>${ic('lock')}</i></div>`;
    el.innerHTML = node('browser', t.nP, t.nPs) + wire('w1', t.wire) + node('pc', t.nH, t.nHs) + wire('w2', 'localhost') + node('obs', t.nO, t.nOs);
  }

  function card(c){ return `<div class="card"><div class="ic">${ic(c[0])}</div><h3>${c[1]}</h3><p>${c[2]}</p></div>`; }
  function landing(t){
    for(const el of document.querySelectorAll('[data-t-aria]')) el.setAttribute('aria-label', t[el.dataset.tAria] || '');
    for(const el of document.querySelectorAll('[data-cards]')) el.innerHTML = el.dataset.cards.split(',').map(k => card(t[k])).join('');
    for(const el of document.querySelectorAll('[data-steps]')) el.innerHTML = el.dataset.steps.split(',').map(k => `<li>${t[k]}</li>`).join('');
    for(const a of document.querySelectorAll('a[data-dl]')) a.href = DL;
    for(const a of document.querySelectorAll('a[data-help]')) a.href = 'help.html?lang=' + lang;
    const list = document.getElementById('csList');
    if(list) list.innerHTML = t.csList.map((s, i, a) => `<li${i === a.length - 1 ? ' class="wide"' : ''}>${ic('check')}<span>${s}</span></li>`).join('');
    const csTag = document.querySelector('[data-t="csTag"]'); if(csTag) csTag.innerHTML = ic('star') + t.dPower;
    const f = document.getElementById('flow'); if(f) flow(f, t);
    const d = document.getElementById('demo'); if(d) heroDemo(d, t);
    const m = document.getElementById('csMini'); if(m) csMini(m, t);
  }
  function landingOnce(){
    // sections fade in as they scroll into view
    const els = document.querySelectorAll('.reveal');
    if(reduced || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('in'));
    else{
      const io = new IntersectionObserver(es => { for(const e of es) if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold:0.12, rootMargin:'0px 0px -40px 0px' });
      els.forEach(e => io.observe(e));
    }
    // feature cards: glow follows the pointer
    document.addEventListener('pointermove', e => {
      const c = e.target.closest?.('.glow .card'); if(!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive:true });
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
    for(const [c, n] of LANGS){ const o = document.createElement('option'); o.value = c; o.textContent = n; o.selected = c === lang; s.appendChild(o); }
    s.onchange = () => setLang(s.value);
  }
  render();
  if(document.body.dataset.page !== 'help') landingOnce();
})();
