// Hudini help in four languages. Used by help.html and by the help drawer in the panel (❓ → Справка).
// Each section: [id, title, html]. Keep the same ids and order in every language.
window.HUDINI_HELP = {
ru: {
  title: 'Справка Hudini', search: 'Поиск по справке…', empty: 'Ничего не нашлось',
  sections: [
['about', 'Что такое Hudini', `
<p>Hudini — оверлей для стрима, которым управляет модератор. Ты показываешь на экране стримера текст, картинки, GIF, видео, таймеры, голосования и эффекты, а стример ничего не нажимает.</p>
<ul>
<li><b>Пульт модератора</b> — сайт или приложение, где ты всё делаешь.</li>
<li><b>Hudini Host</b> — программа на компьютере стримера. Она хранит файлы и передаёт всё в OBS.</li>
<li><b>Виджет</b> — источник «Браузер» в OBS, который рисует оверлей поверх стрима.</li>
</ul>
<p>Работает с Twitch, YouTube и любой платформой, где стримят через OBS.</p>`],
['streamer', 'Стример: первый запуск', `
<ol>
<li>Скачай <b>Hudini Host</b> со страницы <a href="https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.4" target="_blank" rel="noopener">Releases</a> (Windows: <code>HudiniHost-windows-1.0rc4.zip</code>), распакуй в отдельную папку и запусти.</li>
<li>Откроется страница программы. При первом запуске она спросит, сколько места дать файлам модераторов (обычно 100 МБ на файл, 2 ГБ всего, 300 файлов).</li>
<li>Модератор присылает тебе ссылку из пульта. Вставь её в шаг 1 и нажми «Сохранить».</li>
<li>Скопируй ссылку для OBS из шага 2. В OBS: Источники → <b>+</b> → <b>Браузер</b>, вставь ссылку, ширина <b>1920</b>, высота <b>1080</b>.</li>
<li>Выдели источник и нажми <kbd>Ctrl+F</kbd>, чтобы он занял весь экран.</li>
</ol>
<p><b>Панель в OBS:</b> меню Доки → Пользовательские доки браузера, адрес <code>http://127.0.0.1:7777/dock</code>. Там статус и кнопки «Спрятать оверлей», «Остановить звуки», «Пауза модераторов».</p>
<p>Не закрывай окно программы, пока идёт стрим. Windows может спросить про доступ к сети: разреши для частных сетей.</p>`],
['mod', 'Модератор: первый запуск', `
<ol>
<li>Открой пульт. Комната для твоего стримера создастся сама.</li>
<li>Нажми <b>📋 Копировать</b> вверху и отправь ссылку стримеру в личку. Он вставит её в Hudini Host.</li>
<li>Когда плашка слева вверху станет зелёной («онлайн · Hudini Host»), всё готово. Плашка «OBS» покажет, что виджет у стримера работает.</li>
</ol>
<p>Второму модератору нужна <b>ссылка-приглашение</b>: Комната → 👥 Пригласить. Она даёт полное управление, поэтому отправляй её только тем, кому доверяешь.</p>
<p>Пульт можно установить как приложение: в Chrome или Edge значок установки в адресной строке.</p>`],
['panel', 'Пульт: что где', `
<ul>
<li><b>Слева вкладки</b>: ➕ Добавить (текст, картинки, виджеты, эффекты), 🎞 Сцены и библиотека, 💬 Чат, ⚡ Сценарии, ⚙ Комната (ключи, бэкап, вид пульта).</li>
<li><b>В центре холст</b> — это экран стримера. Тащи элемент, меняй размер за уголок, крути за кружок. Картинку можно перетащить из папки или вставить через <kbd>Ctrl+V</kbd>.</li>
<li><b>Справа слои и настройки</b> выбранного элемента: шрифт, цвет, анимации, «показать на N секунд». Глазик 👁 прячет со стрима, не удаляя.</li>
<li><b>Сцены</b> запоминают весь экран, а <b>библиотека</b> хранит отдельные элементы для любой комнаты.</li>
<li><b>Ctrl+C / Ctrl+V</b> копируют элементы, в том числе в другую комнату.</li>
</ul>`],
['files', 'Файлы и место', `
<p>Картинки, GIF и видео с компьютера хранятся у стримера в Hudini Host, <b>зашифрованными</b>: программа не может их прочитать, расшифровывает только виджет.</p>
<p>В пульте под кнопкой «Файл» видно, сколько места осталось. Если место кончилось, загрузка не пройдёт, и пульт предложит <b>🧹 Удалить неиспользуемые файлы</b>: удалятся те, которых нет на экране, в сценах, библиотеке и сценариях. Сама программа ничего не удаляет.</p>
<p>Лимиты меняет стример на странице Hudini Host.</p>`],
['chat', 'Чат, голосования, счётчики β', `
<p>Вкладка 💬 Чат читает чат Twitch без входа в аккаунт. Клик по сообщению показывает его на стриме.</p>
<p><b>Голосование</b>: зрители пишут цифру варианта. Один зритель — один голос, засчитывается последний выбор. <b>Счётчик чата</b> считает команду или слово (например, «F»).</p>
<p>Подключай чат только в одном пульте, иначе всё посчитается дважды.</p>
<p><b>Команды в чате</b> (Чат → «Команды в чате», выбери, кому можно): <code>!опрос</code>, <code>!опрос 60</code> — закрыть само через 60 с, <code>!опрос стоп</code>; <code>!таймер 5м</code>, <code>!таймер стоп</code> / <code>старт</code> / <code>сброс</code>.</p>`],
['scenarios', 'Сценарии β', `
<p>«Если… → то…»: например, кто-то написал <code>!кринж</code> → показать картинку на 5 секунд и запустить конфетти. Условия: команда в чате, событие CS2, конец таймера, цель счётчика или кнопка.</p>
<p>Сценарии выполняет открытый пульт. Если пульт открыт у двух модераторов, включи «Выполнять сценарии» только у одного.</p>`],
['cs2', 'CS2 β', `
<p>На странице Hudini Host нажми <b>🎯 Подключить CS2</b> и перезапусти игру. Это официальная функция Valve (Game State Integration): игра сама отправляет данные программе. Ничего не внедряется в игру, бана за это нет.</p>
<p>В пульте добавь виджет 🎯 CS2 и выбери вид: карточка игрока, K/D/A, HP, деньги, оружие, всплывашка DOUBLE / TRIPLE / ACE. Виды «наблюдатель» (α) работают, когда стример смотрит игру зрителем.</p>`],
['labels', 'Что значат β и α', `
<p>Всё без меток стабильное. <b>β (бета)</b> работает, но мало проверено на разных компьютерах. <b>α (альфа)</b> — эксперимент, может ломаться и меняться. Нажми на метку в пульте, чтобы сообщить о проблеме.</p>`],
['layout', 'Вид пульта и обучение', `
<p>Комната → 🎛 Вид пульта: готовые раскладки (Классика, Большой холст, Ноутбук, Свободные окна), размер текста, анимации, компактный режим. Колонки тянутся за край, вкладки перетаскиваются, разделы сворачиваются кликом по заголовку.</p>
<p>Вид хранится только в этом браузере. Его можно сохранить в файл и загрузить в другом браузере. Если сохранённый вид не загрузится, пульт вернёт прошлую версию или стандартный.</p>
<p>Кнопка <b>❓</b> вверху повторит обучение и откроет эту справку.</p>`],
['security', 'Безопасность и данные', `
<ul>
<li>Всё, что уходит на экран, <b>шифруется</b> (AES-256) и <b>подписывается</b> ключом модератора. Виджет отбрасывает всё, что не подписано.</li>
<li>Ключи комнаты лежат в ссылке после <code>#</code>: эта часть ссылки не уходит ни на один сервер.</li>
<li>Общий сервер нужен только чтобы пульт нашёл программу стримера. Экран, файлы и данные CS2 через него не идут.</li>
<li>Пароль на пульт (🔓 Пароль) шифрует комнаты и ключи в браузере. Бэкап тоже шифруется паролем.</li>
<li>Если ссылка утекла: Комната → ♻ Сменить ключи. Стример вставляет новую ссылку в Hudini Host, и программа отключает всех со старыми ключами.</li>
</ul>`],
['trouble', 'Если что-то не работает', `
<ul>
<li><b>«Ждём Hudini Host»</b>: у стримера не запущена программа или в неё не вставлена ссылка. Нажми на плашку, там пошаговая инструкция.</li>
<li><b>«OBS: не видно»</b>: источник «Браузер» выключен, не в текущей сцене или в нём старая ссылка. В свойствах источника нажми «Обновить кэш текущей страницы».</li>
<li><b>«OBS: ⚠ не 16:9»</b>: в источнике стоит не тот размер (по умолчанию 800×600). Поставь 1920×1080 и нажми <kbd>Ctrl+F</kbd>.</li>
<li><b>Виджет пишет «Нужна программа Hudini Host»</b>: в OBS стоит старая ссылка с сайта. Возьми ссылку на странице программы (http://localhost:7777/…).</li>
<li><b>Не грузится файл</b>: проверь место (под кнопкой «Файл») и лимит на один файл.</li>
<li><b>Пропали комнаты</b>: браузер очистил данные сайта. Восстанови из бэкапа (Комната → ⬆ Из бэкапа) и включи 💾 Надёжное хранение.</li>
</ul>
<p>Не помогло? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Напиши о проблеме</a>.</p>`],
['keys', 'Клавиши', `
<ul>
<li><kbd>Ctrl+Z</kbd> отменить · <kbd>Del</kbd> удалить · <kbd>Esc</kbd> снять выделение</li>
<li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> копировать и вставить · <kbd>Ctrl+X</kbd> вырезать · <kbd>Ctrl+D</kbd> копия рядом</li>
<li><kbd>Shift</kbd>+клик или рамкой — выделить несколько · <kbd>Ctrl+A</kbd> всё · <kbd>Ctrl+G</kbd> группа</li>
<li><kbd>H</kbd> скрыть/показать · <kbd>F</kbd> показать на N секунд · <kbd>1</kbd>…<kbd>9</kbd> слой с этим номером</li>
<li>Стрелки — сдвиг (<kbd>Shift</kbd> сильнее) · колёсико — размер · <kbd>Alt</kbd>+колёсико — поворот</li>
<li><kbd>Пробел</kbd> таймер · <kbd>+</kbd>/<kbd>−</kbd> счётчик · <kbd>P</kbd> анимация</li>
</ul>`],
  ],
},
en: {
  title: 'Hudini help', search: 'Search help…', empty: 'Nothing found',
  sections: [
['about', 'What is Hudini', `
<p>Hudini is a stream overlay run by a moderator. You show text, pictures, GIFs, videos, timers, polls and effects on the streamer's screen, and the streamer doesn't have to click anything.</p>
<ul>
<li><b>Moderator panel</b>: the website or app where you do everything.</li>
<li><b>Hudini Host</b>: the app on the streamer's PC. It stores files and passes everything to OBS.</li>
<li><b>Widget</b>: a Browser source in OBS that draws the overlay on top of the stream.</li>
</ul>
<p>Works with Twitch, YouTube and any platform you stream to with OBS.</p>`],
['streamer', 'Streamer: first start', `
<ol>
<li>Download <b>Hudini Host</b> from <a href="https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.4" target="_blank" rel="noopener">Releases</a> (Windows: <code>HudiniHost-windows-1.0rc4.zip</code>), unzip it into its own folder and run it.</li>
<li>The app's page opens. On the first start it asks how much space to give the moderators' files (usually 100 MB per file, 2 GB in total, 300 files).</li>
<li>Your moderator sends you a link from the panel. Paste it into step 1 and press Save.</li>
<li>Copy the OBS link from step 2. In OBS: Sources → <b>+</b> → <b>Browser</b>, paste the link, width <b>1920</b>, height <b>1080</b>.</li>
<li>Select the source and press <kbd>Ctrl+F</kbd> so it fills the screen.</li>
</ol>
<p><b>Panel inside OBS:</b> menu Docks → Custom Browser Docks, URL <code>http://127.0.0.1:7777/dock</code>. It shows the status and has “Hide overlay”, “Stop sounds” and “Pause moderators”.</p>
<p>Keep the app window open while you stream. If Windows asks about network access, allow it for private networks.</p>`],
['mod', 'Moderator: first start', `
<ol>
<li>Open the panel. A room for your streamer is created automatically.</li>
<li>Press <b>📋 Copy</b> at the top and send the link to the streamer in a private message. They paste it into Hudini Host.</li>
<li>When the badge at the top turns green ("online · Hudini Host"), you're ready. The "OBS" badge shows that the streamer's widget is running.</li>
</ol>
<p>A second moderator needs an <b>invite link</b>: Room → 👥 Invite. It gives full control, so only send it to people you trust.</p>
<p>You can install the panel as an app: in Chrome or Edge, use the install icon in the address bar.</p>`],
['panel', 'The panel at a glance', `
<ul>
<li><b>Tabs on the left</b>: ➕ Add (text, pictures, widgets, effects), 🎞 Scenes and library, 💬 Chat, ⚡ Scenarios, ⚙ Room (keys, backup, panel look).</li>
<li><b>The canvas in the middle</b> is the streamer's screen. Drag an element, resize it by the corner, rotate it by the circle. Drop a picture from a folder or paste it with <kbd>Ctrl+V</kbd>.</li>
<li><b>Layers and settings on the right</b> for the selected element: font, color, animations, "show for N seconds". The eye 👁 hides it from the stream without deleting it.</li>
<li><b>Scenes</b> remember the whole screen, the <b>library</b> keeps single elements for any room.</li>
<li><b>Ctrl+C / Ctrl+V</b> copy elements, also into another room.</li>
</ul>`],
['files', 'Files and storage', `
<p>Pictures, GIFs and videos from your computer are stored on the streamer's PC in Hudini Host, <b>encrypted</b>: the app can't read them, only the widget decrypts them.</p>
<p>Under the File button the panel shows how much space is left. When it's full, the upload is refused and the panel offers <b>🧹 Delete unused files</b>: files that aren't on screen, in scenes, the library or scenarios are removed. The app itself never deletes anything.</p>
<p>The streamer changes the limits on the Hudini Host page.</p>`],
['chat', 'Chat, polls, counters β', `
<p>The 💬 Chat tab reads Twitch chat without logging in. Click a message to show it on stream.</p>
<p><b>Poll</b>: viewers type the number of an option. One viewer, one vote; the last choice counts. The <b>chat counter</b> counts a command or a word (for example "F").</p>
<p>Connect the chat in one panel only, otherwise everything is counted twice.</p>
<p><b>Chat commands</b> (Chat → “Chat commands”, choose who may use them): <code>!poll</code>, <code>!poll 60</code> to close by itself in 60 s, <code>!poll stop</code>; <code>!timer 5m</code>, <code>!timer stop</code> / <code>start</code> / <code>reset</code>.</p>`],
['scenarios', 'Scenarios β', `
<p>"If… → then…": for example, someone types <code>!cringe</code> → show a picture for 5 seconds and fire confetti. Triggers: a chat command, a CS2 event, a timer ending, a counter goal or a button.</p>
<p>Scenarios run in an open panel. If two moderators have the panel open, turn on "Run scenarios" in only one of them.</p>`],
['cs2', 'CS2 β', `
<p>On the Hudini Host page press <b>🎯 Connect CS2</b> and restart the game. This is an official Valve feature (Game State Integration): the game itself sends data to the app. Nothing is injected into the game, so there's no ban risk.</p>
<p>In the panel add the 🎯 CS2 widget and pick a view: player card, K/D/A, HP, money, weapon, DOUBLE / TRIPLE / ACE popup. The "observer" views (α) work when the streamer watches a match as a spectator.</p>`],
['labels', 'What β and α mean', `
<p>Everything without a mark is stable. <b>β (beta)</b> works but hasn't been tested on many computers yet. <b>α (alpha)</b> is an experiment and may break or change. Click a mark in the panel to report a problem.</p>`],
['layout', 'Panel look and tour', `
<p>Room → 🎛 Panel look: ready layouts (Classic, Big canvas, Laptop, Free windows), text size, animations, compact mode. Drag the column edges, drag the tabs into another order, fold sections by clicking their headings.</p>
<p>The look is stored only in this browser. You can save it to a file and load it in another browser. If the saved look fails to load, the panel goes back to the previous version or the default.</p>
<p>The <b>❓</b> button at the top replays the tour and opens this help.</p>`],
['security', 'Security and data', `
<ul>
<li>Everything sent to the screen is <b>encrypted</b> (AES-256) and <b>signed</b> with the moderator's key. The widget drops anything that isn't signed.</li>
<li>The room keys are in the link after <code>#</code>: that part of a link never goes to any server.</li>
<li>The public server only helps the panel find the streamer's app. The screen, files and CS2 data don't go through it.</li>
<li>A panel password (🔓 Password) encrypts rooms and keys in the browser. Backups are encrypted with a password too.</li>
<li>If a link leaked: Room → ♻ Change keys. The streamer pastes the new link into Hudini Host, and the app disconnects everyone with the old keys.</li>
</ul>`],
['trouble', 'If something doesn’t work', `
<ul>
<li><b>"Waiting for Hudini Host"</b>: the app isn't running on the streamer's PC or the link isn't pasted in. Click the badge for step-by-step help.</li>
<li><b>"OBS: not visible"</b>: the Browser source is off, not in the current scene, or has an old link. In the source properties press "Refresh cache of current page".</li>
<li><b>"OBS: ⚠ not 16:9"</b>: the source has the wrong size (800×600 by default). Set 1920×1080 and press <kbd>Ctrl+F</kbd>.</li>
<li><b>The widget says "Hudini Host needed"</b>: OBS has an old link from the website. Take the link from the app's page (http://localhost:7777/…).</li>
<li><b>A file won't upload</b>: check the space (under the File button) and the per-file limit.</li>
<li><b>Rooms are gone</b>: the browser cleared the site data. Restore from a backup (Room → ⬆ From backup) and turn on 💾 Reliable storage.</li>
</ul>
<p>Still stuck? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Report a problem</a>.</p>`],
['keys', 'Shortcuts', `
<ul>
<li><kbd>Ctrl+Z</kbd> undo · <kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect</li>
<li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> copy and paste · <kbd>Ctrl+X</kbd> cut · <kbd>Ctrl+D</kbd> duplicate</li>
<li><kbd>Shift</kbd>+click or drag a box to select several · <kbd>Ctrl+A</kbd> all · <kbd>Ctrl+G</kbd> group</li>
<li><kbd>H</kbd> hide/show · <kbd>F</kbd> show for N seconds · <kbd>1</kbd>…<kbd>9</kbd> layer with that number</li>
<li>Arrows move (<kbd>Shift</kbd> more) · wheel resizes · <kbd>Alt</kbd>+wheel rotates</li>
<li><kbd>Space</kbd> timer · <kbd>+</kbd>/<kbd>−</kbd> counter · <kbd>P</kbd> animation</li>
</ul>`],
  ],
},
uk: {
  title: 'Довідка Hudini', search: 'Пошук у довідці…', empty: 'Нічого не знайдено',
  sections: [
['about', 'Що таке Hudini', `
<p>Hudini — оверлей для стриму, яким керує модератор. Ти показуєш на екрані стримера текст, картинки, GIF, відео, таймери, голосування й ефекти, а стримеру нічого не треба натискати.</p>
<ul>
<li><b>Пульт модератора</b> — сайт або застосунок, де ти все робиш.</li>
<li><b>Hudini Host</b> — програма на комп'ютері стримера. Вона зберігає файли й передає все в OBS.</li>
<li><b>Віджет</b> — джерело «Браузер» в OBS, яке малює оверлей поверх стриму.</li>
</ul>
<p>Працює з Twitch, YouTube і будь-якою платформою, куди стримлять через OBS.</p>`],
['streamer', 'Стример: перший запуск', `
<ol>
<li>Завантаж <b>Hudini Host</b> зі сторінки <a href="https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.4" target="_blank" rel="noopener">Releases</a> (Windows: <code>HudiniHost-windows-1.0rc4.zip</code>), розпакуй в окрему папку й запусти.</li>
<li>Відкриється сторінка програми. Під час першого запуску вона спитає, скільки місця дати файлам модераторів (зазвичай 100 МБ на файл, 2 ГБ загалом, 300 файлів).</li>
<li>Модератор надсилає тобі посилання з пульта. Встав його в крок 1 і натисни «Зберегти».</li>
<li>Скопіюй посилання для OBS із кроку 2. В OBS: Джерела → <b>+</b> → <b>Браузер</b>, встав посилання, ширина <b>1920</b>, висота <b>1080</b>.</li>
<li>Виділи джерело й натисни <kbd>Ctrl+F</kbd>, щоб воно зайняло весь екран.</li>
</ol>
<p><b>Панель в OBS:</b> меню Доки → Користувацькі доки браузера, адреса <code>http://127.0.0.1:7777/dock</code>. Там статус і кнопки «Сховати оверлей», «Зупинити звуки», «Пауза модераторів».</p>
<p>Не закривай вікно програми, поки йде стрим. Якщо Windows спитає про доступ до мережі, дозволь для приватних мереж.</p>`],
['mod', 'Модератор: перший запуск', `
<ol>
<li>Відкрий пульт. Кімната для твого стримера створиться сама.</li>
<li>Натисни <b>📋 Копіювати</b> вгорі й надішли посилання стримеру в особисті. Він вставить його в Hudini Host.</li>
<li>Коли плашка вгорі стане зеленою («онлайн · Hudini Host»), усе готово. Плашка «OBS» покаже, що віджет у стримера працює.</li>
</ol>
<p>Другому модератору потрібне <b>посилання-запрошення</b>: Кімната → 👥 Запросити. Воно дає повне керування, тож надсилай його лише тим, кому довіряєш.</p>
<p>Пульт можна встановити як застосунок: у Chrome чи Edge значок встановлення в адресному рядку.</p>`],
['panel', 'Пульт: що де', `
<ul>
<li><b>Ліворуч вкладки</b>: ➕ Додати (текст, картинки, віджети, ефекти), 🎞 Сцени й бібліотека, 💬 Чат, ⚡ Сценарії, ⚙ Кімната (ключі, бекап, вигляд пульта).</li>
<li><b>У центрі полотно</b> — це екран стримера. Тягни елемент, змінюй розмір за куточок, крути за кружечок. Картинку можна перетягнути з папки або вставити через <kbd>Ctrl+V</kbd>.</li>
<li><b>Праворуч шари й налаштування</b> вибраного елемента: шрифт, колір, анімації, «показати на N секунд». Око 👁 ховає зі стриму, не видаляючи.</li>
<li><b>Сцени</b> запам'ятовують увесь екран, а <b>бібліотека</b> зберігає окремі елементи для будь-якої кімнати.</li>
<li><b>Ctrl+C / Ctrl+V</b> копіюють елементи, зокрема в іншу кімнату.</li>
</ul>`],
['files', 'Файли й місце', `
<p>Картинки, GIF і відео з комп'ютера зберігаються у стримера в Hudini Host, <b>зашифрованими</b>: програма не може їх прочитати, розшифровує лише віджет.</p>
<p>Під кнопкою «Файл» видно, скільки місця лишилося. Якщо місце скінчилося, завантаження не пройде, і пульт запропонує <b>🧹 Видалити невикористані файли</b>: видаляться ті, яких немає на екрані, у сценах, бібліотеці й сценаріях. Сама програма нічого не видаляє.</p>
<p>Ліміти змінює стример на сторінці Hudini Host.</p>`],
['chat', 'Чат, голосування, лічильники β', `
<p>Вкладка 💬 Чат читає чат Twitch без входу в акаунт. Клік по повідомленню показує його на стримі.</p>
<p><b>Голосування</b>: глядачі пишуть цифру варіанта. Один глядач — один голос, зараховується останній вибір. <b>Лічильник чату</b> рахує команду чи слово (наприклад, «F»).</p>
<p>Підключай чат лише в одному пульті, інакше все порахується двічі.</p>
<p><b>Команди в чаті</b> (Чат → «Команди в чаті», вибери, кому можна): <code>!опрос</code>, <code>!опрос 60</code> — закрити саме через 60 с, <code>!опрос стоп</code>; <code>!таймер 5м</code>, <code>!таймер стоп</code> / <code>старт</code> / <code>сброс</code>.</p>`],
['scenarios', 'Сценарії β', `
<p>«Якщо… → то…»: наприклад, хтось написав <code>!крінж</code> → показати картинку на 5 секунд і запустити конфеті. Умови: команда в чаті, подія CS2, кінець таймера, мета лічильника або кнопка.</p>
<p>Сценарії виконує відкритий пульт. Якщо пульт відкритий у двох модераторів, увімкни «Виконувати сценарії» лише в одного.</p>`],
['cs2', 'CS2 β', `
<p>На сторінці Hudini Host натисни <b>🎯 Підключити CS2</b> і перезапусти гру. Це офіційна функція Valve (Game State Integration): гра сама надсилає дані програмі. Нічого не впроваджується в гру, бану за це немає.</p>
<p>У пульті додай віджет 🎯 CS2 і вибери вигляд: картка гравця, K/D/A, HP, гроші, зброя, спливашка DOUBLE / TRIPLE / ACE. Вигляди «спостерігач» (α) працюють, коли стример дивиться гру глядачем.</p>`],
['labels', 'Що означають β і α', `
<p>Усе без позначок стабільне. <b>β (бета)</b> працює, але мало перевірене на різних комп'ютерах. <b>α (альфа)</b> — експеримент, може ламатися й змінюватися. Натисни на позначку в пульті, щоб повідомити про проблему.</p>`],
['layout', 'Вигляд пульта й навчання', `
<p>Кімната → 🎛 Вигляд пульта: готові розкладки (Класика, Велике полотно, Ноутбук, Вільні вікна), розмір тексту, анімації, компактний режим. Колонки тягнуться за край, вкладки перетягуються, розділи згортаються кліком по заголовку.</p>
<p>Вигляд зберігається лише в цьому браузері. Його можна зберегти у файл і завантажити в іншому браузері. Якщо збережений вигляд не завантажиться, пульт поверне попередню версію або стандартний.</p>
<p>Кнопка <b>❓</b> вгорі повторить навчання й відкриє цю довідку.</p>`],
['security', 'Безпека й дані', `
<ul>
<li>Усе, що йде на екран, <b>шифрується</b> (AES-256) і <b>підписується</b> ключем модератора. Віджет відкидає все, що не підписано.</li>
<li>Ключі кімнати лежать у посиланні після <code>#</code>: ця частина посилання не йде на жоден сервер.</li>
<li>Спільний сервер потрібен лише, щоб пульт знайшов програму стримера. Екран, файли й дані CS2 через нього не йдуть.</li>
<li>Пароль на пульт (🔓 Пароль) шифрує кімнати й ключі в браузері. Бекап теж шифрується паролем.</li>
<li>Якщо посилання витекло: Кімната → ♻ Змінити ключі. Стример вставляє нове посилання в Hudini Host, і програма відключає всіх зі старими ключами.</li>
</ul>`],
['trouble', 'Якщо щось не працює', `
<ul>
<li><b>«Чекаємо Hudini Host»</b>: у стримера не запущена програма або в неї не вставлене посилання. Натисни на плашку, там покрокова інструкція.</li>
<li><b>«OBS: не видно»</b>: джерело «Браузер» вимкнене, не в поточній сцені або в ньому старе посилання. У властивостях джерела натисни «Оновити кеш поточної сторінки».</li>
<li><b>«OBS: ⚠ не 16:9»</b>: у джерелі не той розмір (за замовчуванням 800×600). Постав 1920×1080 і натисни <kbd>Ctrl+F</kbd>.</li>
<li><b>Віджет пише «Потрібна програма Hudini Host»</b>: в OBS старе посилання з сайту. Візьми посилання на сторінці програми (http://localhost:7777/…).</li>
<li><b>Не вантажиться файл</b>: перевір місце (під кнопкою «Файл») і ліміт на один файл.</li>
<li><b>Зникли кімнати</b>: браузер очистив дані сайту. Віднови з бекапу (Кімната → ⬆ З бекапу) й увімкни 💾 Надійне зберігання.</li>
</ul>
<p>Не допомогло? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Напиши про проблему</a>.</p>`],
['keys', 'Клавіші', `
<ul>
<li><kbd>Ctrl+Z</kbd> скасувати · <kbd>Del</kbd> видалити · <kbd>Esc</kbd> зняти виділення</li>
<li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> копіювати й вставити · <kbd>Ctrl+X</kbd> вирізати · <kbd>Ctrl+D</kbd> копія поруч</li>
<li><kbd>Shift</kbd>+клік або рамкою — виділити кілька · <kbd>Ctrl+A</kbd> усе · <kbd>Ctrl+G</kbd> група</li>
<li><kbd>H</kbd> сховати/показати · <kbd>F</kbd> показати на N секунд · <kbd>1</kbd>…<kbd>9</kbd> шар із цим номером</li>
<li>Стрілки — зсув (<kbd>Shift</kbd> сильніше) · коліщатко — розмір · <kbd>Alt</kbd>+коліщатко — поворот</li>
<li><kbd>Пробіл</kbd> таймер · <kbd>+</kbd>/<kbd>−</kbd> лічильник · <kbd>P</kbd> анімація</li>
</ul>`],
  ],
},
de: {
  title: 'Hudini-Hilfe', search: 'Hilfe durchsuchen…', empty: 'Nichts gefunden',
  sections: [
['about', 'Was ist Hudini', `
<p>Hudini ist ein Stream-Overlay, das ein Moderator steuert. Du zeigst Text, Bilder, GIFs, Videos, Timer, Umfragen und Effekte auf dem Bildschirm des Streamers, und der Streamer muss nichts klicken.</p>
<ul>
<li><b>Moderatoren-Pult</b>: die Website oder App, in der du alles machst.</li>
<li><b>Hudini Host</b>: das Programm auf dem PC des Streamers. Es speichert Dateien und gibt alles an OBS weiter.</li>
<li><b>Widget</b>: eine Browser-Quelle in OBS, die das Overlay über den Stream legt.</li>
</ul>
<p>Funktioniert mit Twitch, YouTube und jeder Plattform, auf die du mit OBS streamst.</p>`],
['streamer', 'Streamer: erster Start', `
<ol>
<li>Lade <b>Hudini Host</b> unter <a href="https://github.com/niko-ua-designer/hudini/releases/tag/v1.0.0-rc.4" target="_blank" rel="noopener">Releases</a> herunter (Windows: <code>HudiniHost-windows-1.0rc4.zip</code>), entpacke es in einen eigenen Ordner und starte es.</li>
<li>Die Seite des Programms öffnet sich. Beim ersten Start fragt es, wie viel Platz die Dateien der Mods bekommen (meist 100 MB pro Datei, 2 GB insgesamt, 300 Dateien).</li>
<li>Dein Mod schickt dir einen Link aus dem Pult. Füge ihn in Schritt 1 ein und klicke auf Speichern.</li>
<li>Kopiere den OBS-Link aus Schritt 2. In OBS: Quellen → <b>+</b> → <b>Browser</b>, Link einfügen, Breite <b>1920</b>, Höhe <b>1080</b>.</li>
<li>Markiere die Quelle und drücke <kbd>Strg+F</kbd>, damit sie den ganzen Bildschirm füllt.</li>
</ol>
<p><b>Panel in OBS:</b> Menü Docks → Benutzerdefinierte Browser-Docks, URL <code>http://127.0.0.1:7777/dock</code>. Dort siehst du den Status und hast „Overlay verstecken“, „Töne stoppen“ und „Mods pausieren“.</p>
<p>Lass das Programmfenster offen, solange du streamst. Wenn Windows nach Netzwerkzugriff fragt, erlaube ihn für private Netzwerke.</p>`],
['mod', 'Moderator: erster Start', `
<ol>
<li>Öffne das Pult. Ein Raum für deinen Streamer wird automatisch angelegt.</li>
<li>Klicke oben auf <b>📋 Kopieren</b> und schick den Link dem Streamer per Privatnachricht. Er fügt ihn in Hudini Host ein.</li>
<li>Wenn die Anzeige oben grün wird („online · Hudini Host“), bist du bereit. Die Anzeige „OBS“ zeigt, dass das Widget beim Streamer läuft.</li>
</ol>
<p>Ein zweiter Mod braucht einen <b>Einladungslink</b>: Raum → 👥 Einladen. Er gibt volle Kontrolle, schick ihn also nur Leuten, denen du vertraust.</p>
<p>Du kannst das Pult als App installieren: in Chrome oder Edge über das Installationssymbol in der Adressleiste.</p>`],
['panel', 'Das Pult im Überblick', `
<ul>
<li><b>Tabs links</b>: ➕ Hinzufügen (Text, Bilder, Widgets, Effekte), 🎞 Szenen und Bibliothek, 💬 Chat, ⚡ Szenarien, ⚙ Raum (Schlüssel, Backup, Aussehen des Pults).</li>
<li><b>Die Leinwand in der Mitte</b> ist der Bildschirm des Streamers. Zieh ein Element, ändere die Größe an der Ecke, dreh es am Kreis. Bilder kannst du aus einem Ordner hineinziehen oder mit <kbd>Strg+V</kbd> einfügen.</li>
<li><b>Ebenen und Einstellungen rechts</b> für das gewählte Element: Schrift, Farbe, Animationen, „für N Sekunden zeigen“. Das Auge 👁 versteckt es im Stream, ohne es zu löschen.</li>
<li><b>Szenen</b> merken sich den ganzen Bildschirm, die <b>Bibliothek</b> hebt einzelne Elemente für jeden Raum auf.</li>
<li><b>Strg+C / Strg+V</b> kopieren Elemente, auch in einen anderen Raum.</li>
</ul>`],
['files', 'Dateien und Speicherplatz', `
<p>Bilder, GIFs und Videos von deinem Computer liegen beim Streamer in Hudini Host, <b>verschlüsselt</b>: Das Programm kann sie nicht lesen, nur das Widget entschlüsselt sie.</p>
<p>Unter dem Datei-Knopf zeigt das Pult, wie viel Platz frei ist. Ist er voll, wird der Upload abgelehnt und das Panel bietet <b>🧹 Unbenutzte Dateien löschen</b> an: Gelöscht wird, was weder auf dem Bildschirm noch in Szenen, Bibliothek oder Szenarien vorkommt. Das Programm selbst löscht nie etwas.</p>
<p>Die Limits ändert der Streamer auf der Seite von Hudini Host.</p>`],
['chat', 'Chat, Umfragen, Zähler β', `
<p>Der Tab 💬 Chat liest den Twitch-Chat ohne Anmeldung. Ein Klick auf eine Nachricht zeigt sie im Stream.</p>
<p><b>Umfrage</b>: Zuschauer schreiben die Nummer einer Option. Ein Zuschauer, eine Stimme; die letzte Wahl zählt. Der <b>Chat-Zähler</b> zählt einen Befehl oder ein Wort (zum Beispiel „F“).</p>
<p>Verbinde den Chat nur in einem Pult, sonst wird alles doppelt gezählt.</p>
<p><b>Chat-Befehle</b> (Chat → „Chat-Befehle“, wähle, wer sie nutzen darf): <code>!poll</code>, <code>!poll 60</code> schließt nach 60 s, <code>!poll stop</code>; <code>!timer 5m</code>, <code>!timer stop</code> / <code>start</code> / <code>reset</code>.</p>`],
['scenarios', 'Szenarien β', `
<p>„Wenn… → dann…“: Zum Beispiel schreibt jemand <code>!cringe</code> → ein Bild 5 Sekunden zeigen und Konfetti starten. Auslöser: ein Chat-Befehl, ein CS2-Ereignis, ein abgelaufener Timer, ein Zählerziel oder ein Knopf.</p>
<p>Szenarien laufen in einem offenen Pult. Haben zwei Mods das Pult offen, schalte „Szenarien ausführen“ nur bei einem ein.</p>`],
['cs2', 'CS2 β', `
<p>Klicke auf der Seite von Hudini Host auf <b>🎯 CS2 verbinden</b> und starte das Spiel neu. Das ist eine offizielle Valve-Funktion (Game State Integration): Das Spiel schickt die Daten selbst an das Programm. Es wird nichts ins Spiel eingeschleust, also kein Bann-Risiko.</p>
<p>Füge im Pult das Widget 🎯 CS2 hinzu und wähle eine Ansicht: Spielerkarte, K/D/A, HP, Geld, Waffe, DOUBLE / TRIPLE / ACE-Popup. Die „Zuschauer“-Ansichten (α) funktionieren, wenn der Streamer ein Match als Zuschauer verfolgt.</p>`],
['labels', 'Was β und α bedeuten', `
<p>Alles ohne Markierung ist stabil. <b>β (Beta)</b> funktioniert, ist aber noch auf wenigen Computern getestet. <b>α (Alpha)</b> ist ein Experiment und kann kaputtgehen oder sich ändern. Klicke im Pult auf eine Markierung, um ein Problem zu melden.</p>`],
['layout', 'Aussehen des Pults und Tour', `
<p>Raum → 🎛 Aussehen des Pults: fertige Layouts (Klassisch, Große Leinwand, Laptop, Freie Fenster), Textgröße, Animationen, Kompaktmodus. Spalten lassen sich am Rand ziehen, Tabs umsortieren, Abschnitte per Klick auf die Überschrift einklappen.</p>
<p>Das Aussehen wird nur in diesem Browser gespeichert. Du kannst es als Datei sichern und in einem anderen Browser laden. Lässt es sich nicht laden, nimmt das Pult die vorige Version oder den Standard.</p>
<p>Der Knopf <b>❓</b> oben wiederholt die Tour und öffnet diese Hilfe.</p>`],
['security', 'Sicherheit und Daten', `
<ul>
<li>Alles, was auf den Bildschirm geht, wird <b>verschlüsselt</b> (AES-256) und mit dem Schlüssel des Mods <b>signiert</b>. Das Widget verwirft alles Unsignierte.</li>
<li>Die Raumschlüssel stehen im Link nach dem <code>#</code>: Dieser Teil eines Links geht an keinen Server.</li>
<li>Der öffentliche Server hilft dem Pult nur, das Programm des Streamers zu finden. Bildschirm, Dateien und CS2-Daten laufen nicht darüber.</li>
<li>Ein Pult-Passwort (🔓 Passwort) verschlüsselt Räume und Schlüssel im Browser. Backups werden ebenfalls mit Passwort verschlüsselt.</li>
<li>Wenn ein Link geleakt ist: Raum → ♻ Schlüssel ändern. Der Streamer fügt den neuen Link in Hudini Host ein, und das Programm trennt alle mit den alten Schlüsseln.</li>
</ul>`],
['trouble', 'Wenn etwas nicht klappt', `
<ul>
<li><b>„Warte auf Hudini Host“</b>: Das Programm läuft beim Streamer nicht oder der Link ist nicht eingefügt. Klick auf die Anzeige für eine Schritt-für-Schritt-Hilfe.</li>
<li><b>„OBS: nicht sichtbar“</b>: Die Browser-Quelle ist aus, nicht in der aktuellen Szene oder hat einen alten Link. Klicke in den Eigenschaften der Quelle auf „Cache der aktuellen Seite aktualisieren“.</li>
<li><b>„OBS: ⚠ nicht 16:9“</b>: Die Quelle hat die falsche Größe (standardmäßig 800×600). Stell 1920×1080 ein und drücke <kbd>Strg+F</kbd>.</li>
<li><b>Das Widget schreibt „Hudini Host nötig“</b>: In OBS steht ein alter Link von der Website. Nimm den Link von der Seite des Programms (http://localhost:7777/…).</li>
<li><b>Eine Datei lädt nicht hoch</b>: Prüfe den Platz (unter dem Datei-Knopf) und das Limit pro Datei.</li>
<li><b>Räume sind weg</b>: Der Browser hat die Website-Daten gelöscht. Stell sie aus dem Backup wieder her (Raum → ⬆ Aus Backup) und schalte 💾 Zuverlässige Speicherung ein.</li>
</ul>
<p>Hilft nichts? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Problem melden</a>.</p>`],
['keys', 'Tastenkürzel', `
<ul>
<li><kbd>Strg+Z</kbd> rückgängig · <kbd>Entf</kbd> löschen · <kbd>Esc</kbd> Auswahl aufheben</li>
<li><kbd>Strg+C</kbd> / <kbd>Strg+V</kbd> kopieren und einfügen · <kbd>Strg+X</kbd> ausschneiden · <kbd>Strg+D</kbd> duplizieren</li>
<li><kbd>Umschalt</kbd>+Klick oder Rahmen ziehen: mehrere wählen · <kbd>Strg+A</kbd> alle · <kbd>Strg+G</kbd> gruppieren</li>
<li><kbd>H</kbd> verstecken/zeigen · <kbd>F</kbd> für N Sekunden zeigen · <kbd>1</kbd>…<kbd>9</kbd> Ebene mit dieser Nummer</li>
<li>Pfeiltasten verschieben (<kbd>Umschalt</kbd> weiter) · Mausrad ändert die Größe · <kbd>Alt</kbd>+Mausrad dreht</li>
<li><kbd>Leertaste</kbd> Timer · <kbd>+</kbd>/<kbd>−</kbd> Zähler · <kbd>P</kbd> Animation</li>
</ul>`],
  ],
},
};
