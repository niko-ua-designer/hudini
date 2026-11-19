// Hudini help in four languages. Used by help.html and by the help drawer in the panel (❓ → Справка).
// Each section: [id, title, html]. Keep the same ids and order in every language.
// The "connect" section is built from shared/connect-guides.js (load that file first); without it the section is left out.
window.HUDINI_HELP = {
ru: {
  title: 'Справка Hudini', search: 'Поиск по справке…', empty: 'Ничего не нашлось',
  sections: [
['about', 'Что такое Hudini', `
<p>Hudini — оверлей для стрима, которым управляет модератор. Ты показываешь на экране стримера текст, картинки, GIF, видео, сайты, таймеры, голосования, кейсы и эффекты, а стример ничего не нажимает.</p>
<p>Приложение <b>одно</b>, оно ставится на оба компьютера. При первом запуске выбираешь, кто ты:</p>
<ul>
<li><b>Я стример</b>: Hudini на ПК стримера хранит файлы, принимает модераторов и отдаёт оверлей в OBS.</li>
<li><b>Я модератор</b>: Hudini на твоём ПК с пультом. Вставляешь код от стримера и управляешь его экраном.</li>
<li><b>Виджет</b> — источник «Браузер» в OBS, который рисует оверлей поверх стрима.</li>
</ul>
<p>Модератор подключается <b>напрямую</b> к ПК стримера, сервера Hudini посередине нет. Работает с Twitch, YouTube и любой платформой, где стримят через OBS.</p>`],
['streamer', 'Стример: первый запуск', `
<ol>
<li>Скачай Hudini для своей системы со страницы <a href="https://github.com/niko-ua-designer/hudini/releases" target="_blank" rel="noopener">Releases</a>, распакуй и запусти.</li>
<li>Выбери <b>Я стример</b> и нажми «Запустить». Галочка «Запоминать роль» пропустит этот экран в следующий раз.</li>
<li>В окне управления в карточке <b>«Ссылка для OBS»</b> нажми «Копировать». В OBS: Источники → <b>+</b> → <b>Браузер</b>, вставь ссылку, ширина <b>1920</b>, высота <b>1080</b>, затем выдели источник и нажми <kbd>Ctrl+F</kbd>.</li>
<li>Выберите с модератором способ связи (раздел «Как подключиться» ниже). Windows при первом запуске спросит про брандмауэр: разреши для частных сетей.</li>
<li>В карточке <b>«🔑 Код для модератора»</b> нажми «Скопировать код» и отправь его модератору в личку.</li>
</ol>
<p><b>Код — это ключ доступа</b>: в нём пароль, ключи комнаты, отпечаток сертификата и адреса. Отдавай его только тем, кому доверяешь. «Новый код» отключает всех модераторов, и старый код перестаёт работать.</p>
<p><b>Панель в OBS (по желанию):</b> карточка «🎛 Панель в OBS» подскажет, как добавить маленькую панель со статусом и кнопками «Спрятать оверлей», «Остановить звуки», «Пауза модераторов».</p>
<p>Не закрывай Hudini, пока идёт стрим. Вернуться к выбору роли можно через значок в трее («Сменить роль»).</p>`],
['mod', 'Модератор: первый запуск', `
<ol>
<li>Скачай Hudini, запусти и выбери <b>Я модератор</b>.</li>
<li>Стример присылает тебе код. Вставь его в строку вверху (<kbd>Ctrl+V</kbd>) или перетащи в окно и нажми <b>Войти</b>.</li>
<li>Стример добавится в список. Его можно закрепить 📌, переименовать или удалить, а в следующий раз просто нажать «Войти».</li>
<li>Когда капсула вверху позеленеет и покажет пинг, связь есть. Надпись «OBS: виден» значит, что виджет у стримера работает.</li>
</ol>
<p>Второму модератору стример отправляет тот же код. Он даёт полное управление, поэтому отправляй его только доверенным людям.</p>`],
['connect', '', ``],
['panel', 'Пульт: что где', `
<ul>
<li><b>Шапка</b>: капсула связи (сеть, <b>пинг</b>, состояние OBS), общая громкость, «Отменить», «Скрыть всё», ❓ и меню <b>⋯ Ещё</b> (рамка, пароль, очистить всё).</li>
<li><b>Слева рейка вкладок</b>: ➕ Добавить (текст, картинки, видео, сайты, виджеты, эффекты), 🎞 Сцены и библиотека, 💬 Чат, ⚡ Сценарии, 🎁 Розыгрыши, 🔊 Звук, ⚙ Комната.</li>
<li><b>В центре холст</b> — экран стримера. Тащи элемент, меняй размер за угол, <b>растягивай картинку за боковые маркеры</b>, крути за кружок. Над холстом выравнивание, группировка 🔗, показать/скрыть, копия и удаление. Картинку можно перетащить из папки или вставить через <kbd>Ctrl+V</kbd>.</li>
<li><b>Справа слои</b> и настройки выбранного элемента: шрифт, цвет, анимации, «показать на N секунд». Глазик 👁 прячет со стрима, не удаляя.</li>
<li><b>Папки в слоях.</b> Выдели несколько элементов (Shift+клик по слоям выделяет диапазон, Ctrl+клик добавляет один) и нажми Ctrl+G: они станут папкой «Группа 1», которая двигается вместе. Двойной клик по имени или F2 переименует папку, ▸ сворачивает её. 👁 и ⚡ папки действуют на всё внутри. Чтобы скрыть сразу много слоёв, зажми 👁 и проведи по строкам.</li>
<li><b>Сцены</b> запоминают весь экран, а <b>библиотека</b> хранит отдельные элементы.</li>
<li><b>Ctrl+C / Ctrl+V</b> копируют элементы, в том числе в другую комнату. Подробнее о клавишах в конце справки.</li>
</ul>`],
['files', 'Файлы и место', `
<p>Картинки, GIF и видео с компьютера хранятся у стримера в Hudini, <b>зашифрованными</b>: программа не может их прочитать, расшифровывает только виджет.</p>
<p>В пульте под кнопкой «Файл» видно, сколько места осталось. Если место кончилось, загрузка не пройдёт, и пульт предложит <b>🧹 Удалить неиспользуемые файлы</b>: удалятся те, которых нет на экране, в сценах, библиотеке и сценариях. Сама программа ничего не удаляет.</p>
<p>Лимиты меняет стример в окне Hudini стримера.</p>`],
['chat', 'Чат, голосования, счётчики β', `
<p>Вкладка 💬 Чат читает чат Twitch без входа в аккаунт. Клик по сообщению показывает его на стриме.</p>
<p>Кнопка <b>💬 Чат на стриме</b> во вкладке «Добавить» выводит на стрим ленту всех сообщений канала сбоку. Тему оформления (стекло, пузыри, минимализм, неон, панель, карточки), исчезание сообщений через N секунд, порядок (новые снизу или сверху) и значки настраивают справа. Сообщение, которое модератор удалил, или зритель, которого забанили или отправили в таймаут, сразу пропадают и с экрана. Показ одного сообщения кликом работает как раньше.</p>
<p>Кнопка <b>🌐</b> в шапке открывает браузер справа. По умолчанию там чат Twitch твоего канала: войди в свой аккаунт один раз, и все кнопки модератора (удалить, таймаут, бан) работают как на сайте. Кнопка «+» добавляет вкладки с любыми сайтами. Ширина колонки меняется за её левый край. Это работает в программе Hudini; на сайте вместо неё встроенный чат.</p>
<p><b>Голосование</b>: зрители пишут цифру варианта. Один зритель — один голос, засчитывается последний выбор. <b>Счётчик</b> в режиме «По сообщениям в чате» считает команду или слово (например, «F»), можно только от модераторов.</p>
<p>Подключай чат только в одном пульте, иначе всё посчитается дважды.</p>
<p><b>Команды в чате</b> (Чат → «Команды в чате», выбери, кому можно): <code>!опрос</code>, <code>!опрос 60</code> — закрыть само через 60 с, <code>!опрос стоп</code>; <code>!таймер 5м</code>, <code>!таймер стоп</code> / <code>старт</code> / <code>сброс</code>.</p>`],
['scenarios', 'Сценарии β', `
<p>«Если… → то…»: например, кто-то написал <code>!кринж</code> → показать картинку на 5 секунд и запустить конфетти. Условия: команда в чате, событие CS2, конец таймера, цель счётчика или кнопка.</p>
<p>Сценарии выполняет открытый пульт. Если пульт открыт у двух модераторов, включи «Выполнять сценарии» только у одного.</p>`],
['case', 'Кейс', `
<p>Вкладка <b>🎁 Розыгрыши → 📦 Кейс</b> → «Создать 3D-кейс». Модератор открывает кейс кнопкой: он падает на экран, открывается, лента крутится и показывает выигрыш.</p>
<ul>
<li><b>Вид кейса</b>: <b>Обычный</b> (честная лента), <b>Байтовый</b> (почти выпало, но нет), <b>Рандомный</b> (вид выбирается сам, зрители не знают), <b>Второй шанс</b> (выпала карточка «Перекрут», и лента крутится ещё раз).</li>
<li><b>Предметы</b>: название, редкость, шанс в процентах и картинка. Кнопка «⚖ До 100%» подгоняет шансы пропорционально.</li>
<li><b>Открыть</b>: впиши ник зрителя (сумму можно не писать) и нажми «Открыть кейс». Кнопка «Тест» открывает кейс для проверки. История открытий лежит под списком.</li>
<li><b>Звуки и вид</b>: громкость, сколько показывать итог, свои звуки и «лёгкий режим для слабого ПК».</li>
</ul>`],
['roulette', 'Рулетка', `
<p>Вкладка <b>🎁 Розыгрыши → 🎰 Рулетка</b> → «Создать рулетку». Два вида: <b>капсульный автомат</b> (билет с ником, тряска, капсула, бумажка с призом) и <b>колесо</b>.</p>
<ul>
<li><b>Призы</b>: название, цвет и вес. Чем больше вес, тем чаще приз выпадает; шанс в процентах считается сам. Вес 0 значит, что приз не выпадет.</li>
<li><b>Крутить</b>: впиши ник зрителя или оставь поле пустым, тогда ник возьмётся из списка участников. Приз выбирается случайно здесь, в пульте, а стрим и другие модераторы показывают тот же результат. Пока рулетка крутится, кнопка заблокирована.</li>
<li><b>Участники</b>: один ник в строке, «ник x3» даёт тройной шанс. Выпавший уходит из списка, если включена галочка; «Вернуть выбывших» кладёт всех обратно.</li>
<li><b>Вид и звук</b>: ник и шанс на бумажке, громкость, сколько показывать итог. Звуки синтезируются сами, файлы не нужны.</li>
</ul>`],
['giveaway', 'Розыгрыши', `
<p>Вкладка <b>🎁 Розыгрыши</b>: розыгрыш с рулеткой. На экране один розыгрыш, он рисуется поверх всех слоёв, а положение и размер задаются ползунками.</p>`],
['sound', 'Звук', `
<p>Вкладка <b>🔊 Звук</b>: общая громкость (та же, что в шапке), громкость эффектов и отдельный ползунок на каждый звук.</p>
<p>У видео, сайтов, кейса, таймера и розыгрыша своя громкость, на стриме она умножается на общую. Значок 🔇 выключает звук элемента (у видео и сайтов это их собственный звук).</p>`],
['cs2', 'CS2 β', `
<p>В окне Hudini стримера нажми <b>🎯 Подключить CS2</b> и перезапусти игру. Это официальная функция Valve (Game State Integration): игра сама отправляет данные программе. Ничего не внедряется в игру, бана за это нет.</p>
<p>В пульте добавь виджет 🎯 CS2 и выбери вид: карточка игрока, K/D/A, HP, деньги, оружие, всплывашка DOUBLE / TRIPLE / ACE. Виды «наблюдатель» (α) работают, когда стример смотрит игру зрителем.</p>`],
['labels', 'Что значат β и α', `
<p>Всё без меток стабильное. <b>β (бета)</b> работает, но мало проверено на разных компьютерах. <b>α (альфа)</b> — эксперимент, может ломаться и меняться. Нажми на метку в пульте, чтобы сообщить о проблеме.</p>`],
['layout', 'Вид пульта и обучение', `
<p>Комната → 🎛 Вид пульта: готовые раскладки (Классика, Большой холст, Ноутбук, Свободные окна), размер текста, анимации, компактный режим. Колонки тянутся за край, вкладки перетаскиваются, разделы сворачиваются кликом по заголовку.</p>
<p>Вид хранится только в этом браузере. Его можно сохранить в файл и загрузить в другом браузере. Если сохранённый вид не загрузится, пульт вернёт прошлую версию или стандартный.</p>
<p>Кнопка <b>❓</b> вверху повторит обучение и откроет эту справку.</p>`],
['security', 'Безопасность и данные', `
<ul>
<li>Модератор подключается <b>напрямую</b> к ПК стримера по TLS. Отпечаток сертификата лежит в коде, и Hudini его проверяет: подмена по дороге не пройдёт.</li>
<li>Всё, что уходит на экран, <b>шифруется</b> (AES-256) и <b>подписывается</b> ключом модератора. Виджет отбрасывает всё, что не подписано.</li>
<li>У Hudini нет своих серверов и аккаунтов. Экран, файлы и данные CS2 идут только через ПК стримера.</li>
<li>Файлы хранятся у стримера зашифрованными: программа не может их прочитать, расшифровывает только виджет.</li>
<li>Пароль на пульт (⋯ Ещё → Пароль) шифрует комнаты и ключи на ПК модератора. Бэкап тоже шифруется паролем.</li>
<li>Если код утёк, стример нажимает «Новый код» в окне Hudini: все отключаются, старый код не работает.</li>
<li>Если используешь Porthole, держи лобби приватным и приглашай только своего модератора.</li>
</ul>`],
['migrate', 'Переезд с rc.4', `
<p>Раньше пульт был сайтом, а на ПК стримера стоял Hudini Host. Теперь это <b>одно приложение Hudini</b>, пульт внутри него. Данные пульта лежали в браузере и сами не переедут.</p>
<p><b>Модератор:</b></p>
<ol>
<li>На старом сайте открой пульт → вкладка ⚙ Комната → <b>Бэкап</b>, задай пароль и сохрани файл.</li>
<li>Поставь Hudini, выбери «Я модератор», войди к стримеру по новому коду.</li>
<li>В пульте: ⚙ Комната → <b>Из бэкапа</b>, выбери файл и введи пароль.</li>
</ol>
<p><b>Стример:</b> поставь новую версию. Комната создастся заново, поэтому возьми <b>ссылку для OBS</b> и <b>код для модератора</b> из окна Hudini ещё раз. Старый Hudini Host больше не нужен. <b>На Mac</b> rc.4 сам не обновится: скачай архив для macOS с сайта, распакуй и запусти Hudini.app.</p>`],
['trouble', 'Если что-то не работает', `
<ul>
<li><b>Капсула вверху пишет «Ждём Hudini Host»</b>: нет связи со стримером. Проверь, что Hudini у стримера запущен, что вы в одной сети (VPN, Porthole или проброс порта), что код свежий (если адреса менялись, нужен новый) и что Windows не блокирует программу. Подробнее в разделе «Как подключиться».</li>
<li><b>Пишет про сертификат или отпечаток</b>: стример пересоздал комнату или сертификат. Попроси у него новый код.</li>
<li><b>«OBS: не видно»</b>: источник «Браузер» выключен, не в текущей сцене или в нём старая ссылка. В свойствах источника нажми «Обновить кэш текущей страницы».</li>
<li><b>«OBS: ⚠ не 16:9»</b>: в источнике стоит не тот размер (по умолчанию 800×600). Поставь 1920×1080 и нажми <kbd>Ctrl+F</kbd>.</li>
<li><b>Не грузится файл</b>: проверь место (под кнопкой «Файл») и лимит на один файл.</li>
<li><b>Пропали сессии или комнаты</b>: восстанови из бэкапа (⚙ Комната → Из бэкапа).</li>
<li><b>Нужен журнал</b>: на первом экране Hudini кнопка «📁 Журналы». Приложи файл, когда пишешь о проблеме.</li>
</ul>
<p>Не помогло? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Напиши о проблеме</a>.</p>`],
['keys', 'Клавиши', `
<ul>
<li><kbd>Ctrl+Z</kbd> отменить · <kbd>Del</kbd> удалить · <kbd>Esc</kbd> снять выделение</li>
<li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> копировать и вставить · <kbd>Ctrl+X</kbd> вырезать · <kbd>Ctrl+D</kbd> копия рядом</li>
<li><kbd>Shift</kbd>+клик или рамкой — выделить несколько · <kbd>Ctrl+A</kbd> всё · <kbd>Ctrl+G</kbd> группа</li>
<li><kbd>H</kbd> скрыть/показать · <kbd>F</kbd> показать на N секунд · <kbd>1</kbd>…<kbd>9</kbd> слой с этим номером</li>
<li>Стрелки — сдвиг (<kbd>Shift</kbd> сильнее) · колёсико — размер · <kbd>Alt</kbd>+колёсико — поворот</li>
<li>Элемент прилипает к краям и центрам других (голубая линия) · <kbd>Ctrl</kbd> при перетаскивании отключает привязку</li>
<li><kbd>Пробел</kbd> таймер · <kbd>+</kbd>/<kbd>−</kbd> счётчик · <kbd>P</kbd> анимация</li>
</ul>`],
  ],
},
en: {
  title: 'Hudini help', search: 'Search help…', empty: 'Nothing found',
  sections: [
['about', 'What is Hudini', `
<p>Hudini is a stream overlay run by a moderator. You show text, pictures, GIFs, video, websites, timers, polls, cases and effects on the streamer's screen, and the streamer clicks nothing.</p>
<p>It is <b>one app</b>, installed on both computers. On the first start you choose who you are:</p>
<ul>
<li><b>I'm the streamer</b>: Hudini on the streamer's PC stores the files, accepts moderators and feeds the overlay to OBS.</li>
<li><b>I'm the moderator</b>: Hudini on your PC with the panel. You paste the streamer's code and run their screen.</li>
<li><b>The widget</b> is a Browser source in OBS that draws the overlay over the stream.</li>
</ul>
<p>The moderator connects <b>straight</b> to the streamer's PC, there is no Hudini server in the middle. It works with Twitch, YouTube and any platform you stream to through OBS.</p>`],
['streamer', 'Streamer: first start', `
<ol>
<li>Download Hudini for your system from <a href="https://github.com/niko-ua-designer/hudini/releases" target="_blank" rel="noopener">Releases</a>, unpack it and run it.</li>
<li>Choose <b>I'm the streamer</b> and press Start. The "Remember the role" tick skips this screen next time.</li>
<li>In the control window, in the card <b>"Link for OBS"</b>, press Copy. In OBS: Sources → <b>+</b> → <b>Browser</b>, paste the link, width <b>1920</b>, height <b>1080</b>, then select the source and press <kbd>Ctrl+F</kbd>.</li>
<li>Agree with your moderator on how to connect (the "How do we connect?" section below). On the first start Windows asks about the firewall: allow private networks.</li>
<li>In the card <b>"🔑 Code for the moderator"</b> press Copy code and send it to the moderator in a private message.</li>
</ol>
<p><b>The code is an access key</b>: it holds the password, the room keys, the certificate fingerprint and the addresses. Give it only to people you trust. "New code" disconnects every moderator and the old code stops working.</p>
<p><b>Panel inside OBS (optional):</b> the card "🎛 Panel in OBS" shows how to add a small panel with the status and the buttons "Hide overlay", "Stop sounds" and "Pause moderators".</p>
<p>Keep Hudini open while you stream. To get back to the role choice use the tray icon ("Change role").</p>`],
['mod', 'Moderator: first start', `
<ol>
<li>Download Hudini, run it and choose <b>I'm the moderator</b>.</li>
<li>The streamer sends you a code. Paste it into the line at the top (<kbd>Ctrl+V</kbd>) or drag it into the window and press <b>Join</b>.</li>
<li>The streamer is added to the list. You can pin 📌, rename or delete them, and next time just press "Join".</li>
<li>When the capsule at the top turns green and shows the ping, you are connected. "OBS: visible" means the widget works on the streamer's side.</li>
</ol>
<p>The streamer sends a second moderator the same code. It gives full control, so share it only with people you trust.</p>`],
['connect', '', ``],
['panel', 'The panel: what is where', `
<ul>
<li><b>Header</b>: the connection capsule (network, <b>ping</b>, OBS state), overall volume, "Undo", "Hide all", ❓ and the <b>⋯ More</b> menu (frame, password, clear all).</li>
<li><b>Tab rail on the left</b>: ➕ Add (text, pictures, video, websites, widgets, effects), 🎞 Scenes and library, 💬 Chat, ⚡ Scenarios, 🎁 Giveaways, 🔊 Sound, ⚙ Room.</li>
<li><b>The canvas in the middle</b> is the streamer's screen. Drag an element, resize it by a corner, <b>stretch a picture by the side handles</b>, rotate it by the circle. Above the canvas: align, group 🔗, show/hide, copy and delete. Drag a picture in from a folder or paste it with <kbd>Ctrl+V</kbd>.</li>
<li><b>Layers on the right</b> and the settings of the selected element: font, color, animations, "show for N seconds". The eye 👁 hides it from the stream without deleting it.</li>
<li><b>Folders in layers.</b> Select several elements (Shift+click selects a range of layers, Ctrl+click adds one) and press Ctrl+G: they become a folder called "Group 1" that moves together. Double-click the name or press F2 to rename it, ▸ folds it. The folder's 👁 and ⚡ act on everything inside. To hide many layers at once, hold 👁 and drag over the rows.</li>
<li><b>Scenes</b> remember the whole screen, the <b>library</b> keeps single elements.</li>
<li><b>Ctrl+C / Ctrl+V</b> copy elements, also into another room. Keys are listed at the end of this help.</li>
</ul>`],
['files', 'Files and storage', `
<p>Pictures, GIFs and videos from your computer are stored on the streamer's PC in Hudini, <b>encrypted</b>: the app can't read them, only the widget decrypts them.</p>
<p>Under the File button the panel shows how much space is left. When it's full, the upload is refused and the panel offers <b>🧹 Delete unused files</b>: files that aren't on screen, in scenes, the library or scenarios are removed. The app itself never deletes anything.</p>
<p>The streamer changes the limits in the streamer's Hudini window.</p>`],
['chat', 'Chat, polls, counters β', `
<p>The 💬 Chat tab reads Twitch chat without logging in. Click a message to show it on stream.</p>
<p>The <b>💬 Chat on stream</b> button in the Add tab puts a feed of all channel messages on the side of the stream. Set the theme (glass, bubbles, minimal, neon, panel, cards), how long a message stays, the order (new at the bottom or on top) and the badges on the right. A message a moderator deletes, or a viewer who is banned or timed out, disappears from the screen right away. Showing a single message by click works as before.</p>
<p>The <b>🌐</b> button in the header opens a browser on the right. By default it shows the Twitch chat of your channel: log in once and all moderator buttons (delete, timeout, ban) work like on the site. The «+» button adds tabs with any website. Drag the column's left edge to resize it. This works in the Hudini app; on the website an embedded chat is shown instead.</p>
<p><b>Poll</b>: viewers type the number of an option. One viewer, one vote; the last choice counts. The <b>counter</b> in "By chat messages" mode counts a command or a word (for example "F"), optionally from moderators only.</p>
<p>Connect the chat in one panel only, otherwise everything is counted twice.</p>
<p><b>Chat commands</b> (Chat → “Chat commands”, choose who may use them): <code>!poll</code>, <code>!poll 60</code> to close by itself in 60 s, <code>!poll stop</code>; <code>!timer 5m</code>, <code>!timer stop</code> / <code>start</code> / <code>reset</code>.</p>`],
['scenarios', 'Scenarios β', `
<p>"If… → then…": for example, someone types <code>!cringe</code> → show a picture for 5 seconds and fire confetti. Triggers: a chat command, a CS2 event, a timer ending, a counter goal or a button.</p>
<p>Scenarios run in an open panel. If two moderators have the panel open, turn on "Run scenarios" in only one of them.</p>`],
['case', 'Case', `
<p>Tab <b>🎁 Giveaways → 📦 Case</b> → “Create a 3D case”. The moderator opens the case with a button: it drops onto the screen, opens, the reel spins and shows the prize.</p>
<ul>
<li><b>Case kind</b>: <b>Normal</b> (an honest reel), <b>Bait</b> (almost dropped, but not), <b>Random</b> (the kind is picked for you, viewers do not know), <b>Second chance</b> (the "Respin" card drops and the reel spins once more).</li>
<li><b>Items</b>: name, rarity, chance in percent and a picture. "⚖ To 100%" scales the chances proportionally.</li>
<li><b>Open</b>: type the viewer's name (the amount is optional) and press "Open the case". "Test" opens a case for checking. The opening history is under the list.</li>
<li><b>Sounds and look</b>: volume, how long to show the result, your own sounds and a "light mode for a weak PC".</li>
</ul>`],
['roulette', 'Roulette', `
<p>Tab <b>🎁 Giveaways → 🎰 Roulette</b> → “Create a roulette”. Two looks: a <b>capsule machine</b> (a ticket with the nickname, shaking, a capsule, a paper with the prize) and a <b>wheel</b>.</p>
<ul>
<li><b>Prizes</b>: name, colour and weight. The bigger the weight, the more often it drops; the percent chance is worked out for you. Weight 0 means it never drops.</li>
<li><b>Spin</b>: type a viewer nickname or leave it empty to take one from the participant list. The prize is picked at random here in the panel, and the stream and the other moderators show the same result. The button is locked while it spins.</li>
<li><b>Participants</b>: one nickname per line, “nick x3” gives a triple chance. The one who is picked leaves the list when the switch is on; “Bring them back” puts everyone back.</li>
<li><b>Look and sound</b>: nickname and chance on the paper, volume, how long the result stays. Sounds are synthesized, no files needed.</li>
</ul>`],
['giveaway', 'Giveaways', `
<p>The <b>🎁 Giveaways</b> tab: a giveaway with a roulette. There is one giveaway on the screen, it is drawn above all layers, and its position and size are set with sliders.</p>`],
['sound', 'Sound', `
<p>The <b>🔊 Sound</b> tab: the overall volume (the same as in the header), the effects volume and a separate slider for every sound.</p>
<p>Videos, websites, the case, the timer and the giveaway have their own volume, which is multiplied by the overall one on stream. The 🔇 icon mutes an element (for videos and websites that is their own sound).</p>`],
['cs2', 'CS2 β', `
<p>In the streamer's Hudini window press <b>🎯 Connect CS2</b> and restart the game. This is an official Valve feature (Game State Integration): the game itself sends data to the app. Nothing is injected into the game, so there's no ban risk.</p>
<p>In the panel add the 🎯 CS2 widget and pick a view: player card, K/D/A, HP, money, weapon, DOUBLE / TRIPLE / ACE popup. The "observer" views (α) work when the streamer watches a match as a spectator.</p>`],
['labels', 'What β and α mean', `
<p>Everything without a mark is stable. <b>β (beta)</b> works but hasn't been tested on many computers yet. <b>α (alpha)</b> is an experiment and may break or change. Click a mark in the panel to report a problem.</p>`],
['layout', 'Panel look and tour', `
<p>Room → 🎛 Panel look: ready layouts (Classic, Big canvas, Laptop, Free windows), text size, animations, compact mode. Drag the column edges, drag the tabs into another order, fold sections by clicking their headings.</p>
<p>The look is stored only in this browser. You can save it to a file and load it in another browser. If the saved look fails to load, the panel goes back to the previous version or the default.</p>
<p>The <b>❓</b> button at the top replays the tour and opens this help.</p>`],
['security', 'Security and data', `
<ul>
<li>The moderator connects <b>straight</b> to the streamer's PC over TLS. The certificate fingerprint is inside the code and Hudini checks it: nobody can swap the connection on the way.</li>
<li>Everything sent to the screen is <b>encrypted</b> (AES-256) and <b>signed</b> with the moderator's key. The widget drops anything unsigned.</li>
<li>Hudini has no servers or accounts of its own. The screen, files and CS2 data only pass through the streamer's PC.</li>
<li>Files are stored encrypted on the streamer's PC: the app cannot read them, only the widget decrypts them.</li>
<li>The panel password (⋯ More → Password) encrypts rooms and keys on the moderator's PC. The backup is encrypted with the password too.</li>
<li>If the code leaks, the streamer presses "New code" in the Hudini window: everyone is disconnected and the old code stops working.</li>
<li>If you use Porthole, keep the lobby private and invite only your moderator.</li>
</ul>`],
['migrate', 'Moving from rc.4', `
<p>The panel used to be a website and the streamer ran Hudini Host. Now it is <b>one app, Hudini</b>, with the panel inside. The panel's data lived in the browser and will not move by itself.</p>
<p><b>Moderator:</b></p>
<ol>
<li>On the old site open the panel → the ⚙ Room tab → <b>Backup</b>, set a password and save the file.</li>
<li>Install Hudini, choose "I'm the moderator" and join the streamer with the new code.</li>
<li>In the panel: ⚙ Room → <b>From backup</b>, pick the file and enter the password.</li>
</ol>
<p><b>Streamer:</b> install the new version. The room is created again, so take the <b>link for OBS</b> and the <b>code for the moderator</b> from the Hudini window once more. The old Hudini Host is no longer needed. <b>On a Mac</b> rc.4 does not update itself: download the macOS archive from the site, unpack it and start Hudini.app.</p>`],
['trouble', 'If something does not work', `
<ul>
<li><b>The capsule at the top says "Waiting for Hudini Host"</b>: there is no connection to the streamer. Check that Hudini runs on the streamer's side, that you are on one network (VPN, Porthole or a forwarded port), that the code is fresh (if the addresses changed you need a new one) and that Windows is not blocking the program. See "How do we connect?".</li>
<li><b>It talks about a certificate or fingerprint</b>: the streamer re-created the room or the certificate. Ask for a new code.</li>
<li><b>"OBS: not visible"</b>: the Browser source is off, not in the current scene or has an old link. In the source properties press "Refresh cache of current page".</li>
<li><b>"OBS: ⚠ not 16:9"</b>: the source has the wrong size (800×600 by default). Set 1920×1080 and press <kbd>Ctrl+F</kbd>.</li>
<li><b>A file does not upload</b>: check the free space (under the "File" button) and the single-file limit.</li>
<li><b>Sessions or rooms are gone</b>: restore from a backup (⚙ Room → From backup).</li>
<li><b>You need a log</b>: the first Hudini screen has a "📁 Logs" button. Attach the file when you report a problem.</li>
</ul>
<p>Still stuck? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Report a problem</a>.</p>`],
['keys', 'Shortcuts', `
<ul>
<li><kbd>Ctrl+Z</kbd> undo · <kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect</li>
<li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> copy and paste · <kbd>Ctrl+X</kbd> cut · <kbd>Ctrl+D</kbd> duplicate</li>
<li><kbd>Shift</kbd>+click or drag a box to select several · <kbd>Ctrl+A</kbd> all · <kbd>Ctrl+G</kbd> group</li>
<li><kbd>H</kbd> hide/show · <kbd>F</kbd> show for N seconds · <kbd>1</kbd>…<kbd>9</kbd> layer with that number</li>
<li>Arrows move (<kbd>Shift</kbd> more) · wheel resizes · <kbd>Alt</kbd>+wheel rotates</li>
<li>An element snaps to the edges and centers of others (blue line) · hold <kbd>Ctrl</kbd> while dragging to turn snapping off</li>
<li><kbd>Space</kbd> timer · <kbd>+</kbd>/<kbd>−</kbd> counter · <kbd>P</kbd> animation</li>
</ul>`],
  ],
},
uk: {
  title: 'Довідка Hudini', search: 'Пошук у довідці…', empty: 'Нічого не знайдено',
  sections: [
['about', 'Що таке Hudini', `
<p>Hudini — оверлей для стриму, яким керує модератор. Ти показуєш на екрані стримера текст, картинки, GIF, відео, сайти, таймери, голосування, кейси й ефекти, а стример нічого не натискає.</p>
<p>Застосунок <b>один</b>, він ставиться на обидва комп'ютери. Під час першого запуску обираєш, хто ти:</p>
<ul>
<li><b>Я стример</b>: Hudini на ПК стримера зберігає файли, приймає модераторів і віддає оверлей в OBS.</li>
<li><b>Я модератор</b>: Hudini на твоєму ПК з пультом. Вставляєш код від стримера й керуєш його екраном.</li>
<li><b>Віджет</b> — джерело «Браузер» в OBS, що малює оверлей поверх стриму.</li>
</ul>
<p>Модератор підключається <b>напряму</b> до ПК стримера, сервера Hudini посередині немає. Працює з Twitch, YouTube і будь-якою платформою, де стримлять через OBS.</p>`],
['streamer', 'Стример: перший запуск', `
<ol>
<li>Завантаж Hudini для своєї системи зі сторінки <a href="https://github.com/niko-ua-designer/hudini/releases" target="_blank" rel="noopener">Releases</a>, розпакуй і запусти.</li>
<li>Обери <b>Я стример</b> і натисни «Запустити». Галочка «Запам'ятовувати роль» пропустить цей екран наступного разу.</li>
<li>У вікні керування в картці <b>«Посилання для OBS»</b> натисни «Копіювати». В OBS: Джерела → <b>+</b> → <b>Браузер</b>, встав посилання, ширина <b>1920</b>, висота <b>1080</b>, потім виділи джерело й натисни <kbd>Ctrl+F</kbd>.</li>
<li>Домовтеся з модератором про спосіб зв'язку (розділ «Як підключитися» нижче). Під час першого запуску Windows спитає про брандмауер: дозволь для приватних мереж.</li>
<li>У картці <b>«🔑 Код для модератора»</b> натисни «Скопіювати код» і надішли його модератору в особисті.</li>
</ol>
<p><b>Код — це ключ доступу</b>: у ньому пароль, ключі кімнати, відбиток сертифіката й адреси. Віддавай його лише тим, кому довіряєш. «Новий код» відключає всіх модераторів, і старий код перестає працювати.</p>
<p><b>Панель в OBS (за бажанням):</b> картка «🎛 Панель в OBS» підкаже, як додати маленьку панель зі статусом і кнопками «Сховати оверлей», «Зупинити звуки», «Пауза модераторів».</p>
<p>Не закривай Hudini, поки йде стрим. Повернутися до вибору ролі можна через значок у треї («Змінити роль»).</p>`],
['mod', 'Модератор: перший запуск', `
<ol>
<li>Завантаж Hudini, запусти й обери <b>Я модератор</b>.</li>
<li>Стример надсилає тобі код. Встав його в рядок угорі (<kbd>Ctrl+V</kbd>) або перетягни у вікно й натисни <b>Увійти</b>.</li>
<li>Стример додасться до списку. Його можна закріпити 📌, перейменувати або видалити, а наступного разу просто натиснути «Увійти».</li>
<li>Коли капсула вгорі зазеленіє й покаже пінг, зв'язок є. Напис «OBS: видно» означає, що віджет у стримера працює.</li>
</ol>
<p>Другому модератору стример надсилає той самий код. Він дає повне керування, тому надсилай його лише довіреним людям.</p>`],
['connect', '', ``],
['panel', 'Пульт: що де', `
<ul>
<li><b>Шапка</b>: капсула зв'язку (мережа, <b>пінг</b>, стан OBS), загальна гучність, «Скасувати», «Сховати все», ❓ і меню <b>⋯ Ще</b> (рамка, пароль, очистити все).</li>
<li><b>Ліворуч рейка вкладок</b>: ➕ Додати (текст, картинки, відео, сайти, віджети, ефекти), 🎞 Сцени й бібліотека, 💬 Чат, ⚡ Сценарії, 🎁 Розіграші, 🔊 Звук, ⚙ Кімната.</li>
<li><b>У центрі полотно</b> — екран стримера. Тягни елемент, змінюй розмір за кут, <b>розтягуй картинку за бічні маркери</b>, крути за гурток. Над полотном вирівнювання, групування 🔗, показати/сховати, копія й видалення. Картинку можна перетягнути з теки або вставити через <kbd>Ctrl+V</kbd>.</li>
<li><b>Праворуч шари</b> і налаштування вибраного елемента: шрифт, колір, анімації, «показати на N секунд». Око 👁 ховає зі стриму, не видаляючи.</li>
<li><b>Папки в шарах.</b> Виділи кілька елементів (Shift+клік по шарах виділяє діапазон, Ctrl+клік додає один) і натисни Ctrl+G: вони стануть папкою «Група 1», яка рухається разом. Подвійний клік по назві або F2 перейменує папку, ▸ згортає її. 👁 і ⚡ папки діють на все всередині. Щоб сховати одразу багато шарів, затисни 👁 і проведи по рядках.</li>
<li><b>Сцени</b> запам'ятовують весь екран, а <b>бібліотека</b> зберігає окремі елементи.</li>
<li><b>Ctrl+C / Ctrl+V</b> копіюють елементи, зокрема в іншу кімнату. Клавіші описані наприкінці довідки.</li>
</ul>`],
['files', 'Файли й місце', `
<p>Картинки, GIF і відео з комп'ютера зберігаються у стримера в Hudini, <b>зашифрованими</b>: програма не може їх прочитати, розшифровує лише віджет.</p>
<p>Під кнопкою «Файл» видно, скільки місця лишилося. Якщо місце скінчилося, завантаження не пройде, і пульт запропонує <b>🧹 Видалити невикористані файли</b>: видаляться ті, яких немає на екрані, у сценах, бібліотеці й сценаріях. Сама програма нічого не видаляє.</p>
<p>Ліміти змінює стример у вікні Hudini стримера.</p>`],
['chat', 'Чат, голосування, лічильники β', `
<p>Вкладка 💬 Чат читає чат Twitch без входу в акаунт. Клік по повідомленню показує його на стримі.</p>
<p>Кнопка <b>💬 Чат на стрімі</b> на вкладці «Додати» виводить на стрім стрічку всіх повідомлень каналу збоку. Тему оформлення (скло, бульбашки, мінімалізм, неон, панель, картки), зникання повідомлень через N секунд, порядок (нові знизу або зверху) та значки налаштовують праворуч. Повідомлення, яке модератор видалив, або глядач, якого забанили чи відправили в таймаут, одразу зникають і з екрана. Показ одного повідомлення кліком працює як раніше.</p>
<p>Кнопка <b>🌐</b> у шапці відкриває браузер праворуч. За замовчуванням там чат Twitch твого каналу: увійди у свій акаунт один раз, і всі кнопки модератора (видалити, таймаут, бан) працюють як на сайті. Кнопка «+» додає вкладки з будь-якими сайтами. Ширина колонки змінюється за її лівий край. Це працює в програмі Hudini; на сайті замість неї вбудований чат.</p>
<p><b>Голосування</b>: глядачі пишуть цифру варіанта. Один глядач — один голос, зараховується останній вибір. <b>Лічильник чату</b> рахує команду чи слово (наприклад, «F»).</p>
<p>Підключай чат лише в одному пульті, інакше все порахується двічі.</p>
<p><b>Команди в чаті</b> (Чат → «Команди в чаті», вибери, кому можна): <code>!опрос</code>, <code>!опрос 60</code> — закрити саме через 60 с, <code>!опрос стоп</code>; <code>!таймер 5м</code>, <code>!таймер стоп</code> / <code>старт</code> / <code>сброс</code>.</p>`],
['scenarios', 'Сценарії β', `
<p>«Якщо… → то…»: наприклад, хтось написав <code>!крінж</code> → показати картинку на 5 секунд і запустити конфеті. Умови: команда в чаті, подія CS2, кінець таймера, мета лічильника або кнопка.</p>
<p>Сценарії виконує відкритий пульт. Якщо пульт відкритий у двох модераторів, увімкни «Виконувати сценарії» лише в одного.</p>`],
['case', 'Кейс', `
<p>Вкладка <b>🎁 Розіграші → 📦 Кейс</b> → «Створити 3D-кейс». Модератор відкриває кейс кнопкою: він падає на екран, відкривається, стрічка крутиться й показує виграш.</p>
<ul>
<li><b>Вид кейса</b>: <b>Звичайний</b> (чесна стрічка), <b>Байтовий</b> (майже випало, але ні), <b>Рандомний</b> (вид обирається сам, глядачі не знають), <b>Другий шанс</b> (випала картка «Перекрут», і стрічка крутиться ще раз).</li>
<li><b>Предмети</b>: назва, рідкість, шанс у відсотках і картинка. Кнопка «⚖ До 100%» підганяє шанси пропорційно.</li>
<li><b>Відкрити</b>: впиши нік глядача (суму можна не писати) і натисни «Відкрити кейс». Кнопка «Тест» відкриває кейс для перевірки. Історія відкриттів під списком.</li>
<li><b>Звуки й вигляд</b>: гучність, скільки показувати підсумок, власні звуки та «легкий режим для слабкого ПК».</li>
</ul>`],
['roulette', 'Рулетка', `
<p>Вкладка <b>🎁 Розіграші → 🎰 Рулетка</b> → «Створити рулетку». Два вигляди: <b>капсульний автомат</b> (квиток з ніком, трясіння, капсула, папірець із призом) і <b>колесо</b>.</p>
<ul>
<li><b>Призи</b>: назва, колір і вага. Чим більша вага, тим частіше приз випадає; шанс у відсотках рахується сам. Вага 0 означає, що приз не випаде.</li>
<li><b>Крутити</b>: впиши нік глядача або залиш поле порожнім, тоді нік візьметься зі списку учасників. Приз обирається випадково тут, у пульті, а стрім і інші модератори показують той самий результат. Поки рулетка крутиться, кнопка заблокована.</li>
<li><b>Учасники</b>: один нік у рядку, «нік x3» дає потрійний шанс. Той, кому випало, виходить зі списку, якщо ввімкнено галочку; «Повернути вибулих» кладе всіх назад.</li>
<li><b>Вигляд і звук</b>: нік і шанс на папірці, гучність, скільки показувати підсумок. Звуки синтезуються самі, файли не потрібні.</li>
</ul>`],
['giveaway', 'Розіграші', `
<p>Вкладка <b>🎁 Розіграші</b>: розіграш із рулеткою. На екрані один розіграш, він малюється поверх усіх шарів, а положення й розмір задаються повзунками.</p>`],
['sound', 'Звук', `
<p>Вкладка <b>🔊 Звук</b>: загальна гучність (та сама, що в шапці), гучність ефектів і окремий повзунок на кожен звук.</p>
<p>Відео, сайти, кейс, таймер і розіграш мають власну гучність, на стримі вона множиться на загальну. Значок 🔇 вимикає звук елемента (у відео й сайтів це їхній власний звук).</p>`],
['cs2', 'CS2 β', `
<p>У вікні Hudini стримера натисни <b>🎯 Підключити CS2</b> і перезапусти гру. Це офіційна функція Valve (Game State Integration): гра сама надсилає дані програмі. Нічого не впроваджується в гру, бану за це немає.</p>
<p>У пульті додай віджет 🎯 CS2 і вибери вигляд: картка гравця, K/D/A, HP, гроші, зброя, спливашка DOUBLE / TRIPLE / ACE. Вигляди «спостерігач» (α) працюють, коли стример дивиться гру глядачем.</p>`],
['labels', 'Що означають β і α', `
<p>Усе без позначок стабільне. <b>β (бета)</b> працює, але мало перевірене на різних комп'ютерах. <b>α (альфа)</b> — експеримент, може ламатися й змінюватися. Натисни на позначку в пульті, щоб повідомити про проблему.</p>`],
['layout', 'Вигляд пульта й навчання', `
<p>Кімната → 🎛 Вигляд пульта: готові розкладки (Класика, Велике полотно, Ноутбук, Вільні вікна), розмір тексту, анімації, компактний режим. Колонки тягнуться за край, вкладки перетягуються, розділи згортаються кліком по заголовку.</p>
<p>Вигляд зберігається лише в цьому браузері. Його можна зберегти у файл і завантажити в іншому браузері. Якщо збережений вигляд не завантажиться, пульт поверне попередню версію або стандартний.</p>
<p>Кнопка <b>❓</b> вгорі повторить навчання й відкриє цю довідку.</p>`],
['security', 'Безпека й дані', `
<ul>
<li>Модератор підключається <b>напряму</b> до ПК стримера по TLS. Відбиток сертифіката лежить у коді, і Hudini його перевіряє: підміна по дорозі не пройде.</li>
<li>Усе, що йде на екран, <b>шифрується</b> (AES-256) і <b>підписується</b> ключем модератора. Віджет відкидає все, що не підписано.</li>
<li>У Hudini немає власних серверів і акаунтів. Екран, файли й дані CS2 ідуть лише через ПК стримера.</li>
<li>Файли зберігаються у стримера зашифрованими: програма не може їх прочитати, розшифровує лише віджет.</li>
<li>Пароль на пульт (⋯ Ще → Пароль) шифрує кімнати й ключі на ПК модератора. Бекап теж шифрується паролем.</li>
<li>Якщо код витік, стример натискає «Новий код» у вікні Hudini: усі відключаються, старий код не працює.</li>
<li>Якщо користуєшся Porthole, тримай лобі приватним і запрошуй лише свого модератора.</li>
</ul>`],
['migrate', 'Переїзд з rc.4', `
<p>Раніше пульт був сайтом, а на ПК стримера стояв Hudini Host. Тепер це <b>один застосунок Hudini</b>, пульт усередині. Дані пульта лежали в браузері й самі не переїдуть.</p>
<p><b>Модератор:</b></p>
<ol>
<li>На старому сайті відкрий пульт → вкладка ⚙ Кімната → <b>Бекап</b>, задай пароль і збережи файл.</li>
<li>Постав Hudini, обери «Я модератор», увійди до стримера за новим кодом.</li>
<li>У пульті: ⚙ Кімната → <b>З бекапу</b>, обери файл і введи пароль.</li>
</ol>
<p><b>Стример:</b> постав нову версію. Кімната створиться заново, тому візьми <b>посилання для OBS</b> і <b>код для модератора</b> з вікна Hudini ще раз. Старий Hudini Host більше не потрібен. <b>На Mac</b> rc.4 сам не оновиться: завантаж архів для macOS із сайту, розпакуй і запусти Hudini.app.</p>`],
['trouble', 'Якщо щось не працює', `
<ul>
<li><b>Капсула вгорі пише «Чекаємо Hudini Host»</b>: немає зв'язку зі стримером. Перевір, що Hudini у стримера запущений, що ви в одній мережі (VPN, Porthole або прокинутий порт), що код свіжий (якщо адреси змінилися, потрібен новий) і що Windows не блокує програму. Докладніше в розділі «Як підключитися».</li>
<li><b>Пише про сертифікат чи відбиток</b>: стример перестворив кімнату або сертифікат. Попроси в нього новий код.</li>
<li><b>«OBS: не видно»</b>: джерело «Браузер» вимкнене, не в поточній сцені або в ньому старе посилання. У властивостях джерела натисни «Оновити кеш поточної сторінки».</li>
<li><b>«OBS: ⚠ не 16:9»</b>: у джерела не той розмір (типово 800×600). Постав 1920×1080 і натисни <kbd>Ctrl+F</kbd>.</li>
<li><b>Не вантажиться файл</b>: перевір місце (під кнопкою «Файл») і ліміт на один файл.</li>
<li><b>Зникли сесії чи кімнати</b>: відновлюй із бекапу (⚙ Кімната → З бекапу).</li>
<li><b>Потрібен журнал</b>: на першому екрані Hudini є кнопка «📁 Журнали». Додай файл, коли пишеш про проблему.</li>
</ul>
<p>Не допомогло? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Напиши про проблему</a>.</p>`],
['keys', 'Клавіші', `
<ul>
<li><kbd>Ctrl+Z</kbd> скасувати · <kbd>Del</kbd> видалити · <kbd>Esc</kbd> зняти виділення</li>
<li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> копіювати й вставити · <kbd>Ctrl+X</kbd> вирізати · <kbd>Ctrl+D</kbd> копія поруч</li>
<li><kbd>Shift</kbd>+клік або рамкою — виділити кілька · <kbd>Ctrl+A</kbd> усе · <kbd>Ctrl+G</kbd> група</li>
<li><kbd>H</kbd> сховати/показати · <kbd>F</kbd> показати на N секунд · <kbd>1</kbd>…<kbd>9</kbd> шар із цим номером</li>
<li>Стрілки — зсув (<kbd>Shift</kbd> сильніше) · коліщатко — розмір · <kbd>Alt</kbd>+коліщатко — поворот</li>
<li>Елемент прилипає до країв і центрів інших (блакитна лінія) · <kbd>Ctrl</kbd> під час перетягування вимикає прилипання</li>
<li><kbd>Пробіл</kbd> таймер · <kbd>+</kbd>/<kbd>−</kbd> лічильник · <kbd>P</kbd> анімація</li>
</ul>`],
  ],
},
de: {
  title: 'Hudini-Hilfe', search: 'Hilfe durchsuchen…', empty: 'Nichts gefunden',
  sections: [
['about', 'Was ist Hudini', `
<p>Hudini ist ein Stream-Overlay, das ein Mod steuert. Du zeigst auf dem Bildschirm des Streamers Text, Bilder, GIFs, Videos, Websites, Timer, Umfragen, Cases und Effekte, und der Streamer klickt nichts.</p>
<p>Es ist <b>eine App</b>, die auf beiden Computern installiert wird. Beim ersten Start wählst du, wer du bist:</p>
<ul>
<li><b>Ich bin der Streamer</b>: Hudini auf dem PC des Streamers speichert die Dateien, nimmt Mods auf und gibt das Overlay an OBS weiter.</li>
<li><b>Ich bin der Mod</b>: Hudini auf deinem PC mit dem Pult. Du fügst den Code des Streamers ein und steuerst seinen Bildschirm.</li>
<li><b>Das Widget</b> ist eine Browser-Quelle in OBS, die das Overlay über den Stream legt.</li>
</ul>
<p>Der Mod verbindet sich <b>direkt</b> mit dem PC des Streamers, ein Hudini-Server dazwischen existiert nicht. Funktioniert mit Twitch, YouTube und jeder Plattform, auf die du über OBS streamst.</p>`],
['streamer', 'Streamer: erster Start', `
<ol>
<li>Lade Hudini für dein System von <a href="https://github.com/niko-ua-designer/hudini/releases" target="_blank" rel="noopener">Releases</a> herunter, entpacke es und starte es.</li>
<li>Wähle <b>Ich bin der Streamer</b> und drücke „Starten“. Das Häkchen „Rolle merken“ überspringt diesen Bildschirm beim nächsten Mal.</li>
<li>Drücke im Steuerfenster in der Karte <b>„Link für OBS“</b> auf Kopieren. In OBS: Quellen → <b>+</b> → <b>Browser</b>, Link einfügen, Breite <b>1920</b>, Höhe <b>1080</b>, dann die Quelle auswählen und <kbd>Strg+F</kbd> drücken.</li>
<li>Vereinbart mit deinem Mod, wie ihr euch verbindet (Abschnitt „Wie verbinden wir uns?“ unten). Beim ersten Start fragt Windows nach der Firewall: erlaube private Netzwerke.</li>
<li>Drücke in der Karte <b>„🔑 Code für den Mod“</b> auf Code kopieren und schick ihn dem Mod privat.</li>
</ol>
<p><b>Der Code ist ein Zugangsschlüssel</b>: Er enthält Passwort, Raumschlüssel, Zertifikat-Fingerabdruck und Adressen. Gib ihn nur Leuten, denen du vertraust. „Neuer Code“ trennt alle Mods, und der alte Code funktioniert nicht mehr.</p>
<p><b>Panel in OBS (optional):</b> Die Karte „🎛 Panel in OBS“ zeigt, wie du ein kleines Panel mit Status und den Knöpfen „Overlay verstecken“, „Töne stoppen“ und „Mods pausieren“ hinzufügst.</p>
<p>Lass Hudini offen, solange du streamst. Zur Rollenwahl kommst du über das Tray-Symbol („Rolle wechseln“) zurück.</p>`],
['mod', 'Mod: erster Start', `
<ol>
<li>Lade Hudini herunter, starte es und wähle <b>Ich bin der Mod</b>.</li>
<li>Der Streamer schickt dir einen Code. Füge ihn in die Zeile oben ein (<kbd>Strg+V</kbd>) oder zieh ihn ins Fenster und drücke <b>Beitreten</b>.</li>
<li>Der Streamer erscheint in der Liste. Du kannst ihn anpinnen 📌, umbenennen oder löschen und beim nächsten Mal einfach „Beitreten“ drücken.</li>
<li>Wird die Kapsel oben grün und zeigt den Ping, steht die Verbindung. „OBS: sichtbar“ heißt, dass das Widget beim Streamer läuft.</li>
</ol>
<p>Einem zweiten Mod schickt der Streamer denselben Code. Er gibt volle Kontrolle, also teile ihn nur mit vertrauten Leuten.</p>`],
['connect', '', ``],
['panel', 'Das Pult: was wo ist', `
<ul>
<li><b>Kopfzeile</b>: Verbindungskapsel (Netzwerk, <b>Ping</b>, OBS-Status), Gesamtlautstärke, „Rückgängig“, „Alles verstecken“, ❓ und das Menü <b>⋯ Mehr</b> (Rahmen, Passwort, alles löschen).</li>
<li><b>Tab-Leiste links</b>: ➕ Hinzufügen (Text, Bilder, Video, Websites, Widgets, Effekte), 🎞 Szenen und Bibliothek, 💬 Chat, ⚡ Szenarien, 🎁 Verlosungen, 🔊 Ton, ⚙ Raum.</li>
<li><b>In der Mitte die Fläche</b> — der Bildschirm des Streamers. Element ziehen, an der Ecke skalieren, <b>ein Bild an den seitlichen Griffen strecken</b>, am Kreis drehen. Über der Fläche: ausrichten, gruppieren 🔗, zeigen/verstecken, kopieren und löschen. Ein Bild lässt sich aus einem Ordner hineinziehen oder mit <kbd>Strg+V</kbd> einfügen.</li>
<li><b>Rechts die Ebenen</b> und die Einstellungen des gewählten Elements: Schrift, Farbe, Animationen, „für N Sekunden zeigen“. Das Auge 👁 versteckt es im Stream, ohne zu löschen.</li>
<li><b>Ordner in den Ebenen.</b> Wähle mehrere Elemente (Shift+Klick wählt einen Bereich von Ebenen, Strg+Klick fügt eine hinzu) und drücke Strg+G: Sie werden zu einem Ordner „Gruppe 1“, der sich gemeinsam bewegt. Doppelklick auf den Namen oder F2 benennt ihn um, ▸ klappt ihn zu. 👁 und ⚡ des Ordners wirken auf alles darin. Um viele Ebenen auf einmal zu verstecken, halte 👁 gedrückt und ziehe über die Zeilen.</li>
<li><b>Szenen</b> merken sich den ganzen Bildschirm, die <b>Bibliothek</b> einzelne Elemente.</li>
<li><b>Strg+C / Strg+V</b> kopieren Elemente, auch in einen anderen Raum. Die Tasten stehen am Ende dieser Hilfe.</li>
</ul>`],
['files', 'Dateien und Speicherplatz', `
<p>Bilder, GIFs und Videos von deinem Computer liegen beim Streamer in Hudini, <b>verschlüsselt</b>: Das Programm kann sie nicht lesen, nur das Widget entschlüsselt sie.</p>
<p>Unter dem Datei-Knopf zeigt das Pult, wie viel Platz frei ist. Ist er voll, wird der Upload abgelehnt und das Panel bietet <b>🧹 Unbenutzte Dateien löschen</b> an: Gelöscht wird, was weder auf dem Bildschirm noch in Szenen, Bibliothek oder Szenarien vorkommt. Das Programm selbst löscht nie etwas.</p>
<p>Die Limits ändert der Streamer im Hudini-Fenster des Streamers.</p>`],
['chat', 'Chat, Umfragen, Zähler β', `
<p>Der Tab 💬 Chat liest den Twitch-Chat ohne Anmeldung. Ein Klick auf eine Nachricht zeigt sie im Stream.</p>
<p>Die Schaltfläche <b>💬 Chat im Stream</b> im Tab „Hinzufügen“ zeigt am Rand des Streams einen Feed aller Kanalnachrichten. Design (Glas, Blasen, Minimal, Neon, Panel, Karten), wie lange eine Nachricht stehen bleibt, die Reihenfolge (neue unten oder oben) und die Abzeichen stellst du rechts ein. Eine vom Moderator gelöschte Nachricht oder ein gesperrter bzw. stummgeschalteter Zuschauer verschwindet sofort auch vom Bildschirm. Einzelne Nachrichten per Klick zeigen funktioniert wie bisher.</p>
<p>Die Schaltfläche <b>🌐</b> in der Kopfzeile öffnet rechts einen Browser. Standardmäßig zeigt er den Twitch-Chat deines Kanals: Melde dich einmal an, und alle Moderatorknöpfe (löschen, Timeout, Bann) funktionieren wie auf der Seite. Mit «+» fügst du Tabs mit beliebigen Websites hinzu. Die Breite änderst du am linken Rand der Spalte. Das funktioniert in der Hudini-App; auf der Website wird stattdessen ein eingebetteter Chat gezeigt.</p>
<p><b>Umfrage</b>: Zuschauer schreiben die Nummer einer Option. Ein Zuschauer, eine Stimme; die letzte Wahl zählt. Der <b>Chat-Zähler</b> zählt einen Befehl oder ein Wort (zum Beispiel „F“).</p>
<p>Verbinde den Chat nur in einem Pult, sonst wird alles doppelt gezählt.</p>
<p><b>Chat-Befehle</b> (Chat → „Chat-Befehle“, wähle, wer sie nutzen darf): <code>!poll</code>, <code>!poll 60</code> schließt nach 60 s, <code>!poll stop</code>; <code>!timer 5m</code>, <code>!timer stop</code> / <code>start</code> / <code>reset</code>.</p>`],
['scenarios', 'Szenarien β', `
<p>„Wenn… → dann…“: Zum Beispiel schreibt jemand <code>!cringe</code> → ein Bild 5 Sekunden zeigen und Konfetti starten. Auslöser: ein Chat-Befehl, ein CS2-Ereignis, ein abgelaufener Timer, ein Zählerziel oder ein Knopf.</p>
<p>Szenarien laufen in einem offenen Pult. Haben zwei Mods das Pult offen, schalte „Szenarien ausführen“ nur bei einem ein.</p>`],
['case', 'Case', `
<p>Tab <b>🎁 Gewinnspiele → 📦 Case</b> → „3D-Case erstellen“. Der Mod öffnet das Case per Knopf: Es fällt auf den Bildschirm, öffnet sich, die Rolle dreht sich und zeigt den Gewinn.</p>
<ul>
<li><b>Case-Art</b>: <b>Normal</b> (ehrliche Rolle), <b>Köder</b> (fast gefallen, aber nein), <b>Zufällig</b> (die Art wird selbst gewählt, Zuschauer wissen es nicht), <b>Zweite Chance</b> (die Karte „Respin“ fällt und die Rolle dreht sich noch einmal).</li>
<li><b>Gegenstände</b>: Name, Seltenheit, Chance in Prozent und ein Bild. „⚖ Auf 100%“ skaliert die Chancen proportional.</li>
<li><b>Öffnen</b>: Namen des Zuschauers eintragen (der Betrag ist optional), „Case öffnen“ drücken. „Test“ öffnet ein Case zur Probe. Der Verlauf steht unter der Liste.</li>
<li><b>Töne und Aussehen</b>: Lautstärke, wie lange das Ergebnis bleibt, eigene Töne und ein „Lite-Modus für schwache PCs“.</li>
</ul>`],
['roulette', 'Roulette', `
<p>Tab <b>🎁 Gewinnspiele → 🎰 Roulette</b> → „Roulette erstellen“. Zwei Looks: ein <b>Kapselautomat</b> (Ticket mit Namen, Rütteln, Kapsel, Zettel mit dem Preis) und ein <b>Glücksrad</b>.</p>
<ul>
<li><b>Preise</b>: Name, Farbe und Gewicht. Je größer das Gewicht, desto öfter fällt der Preis; die Chance in Prozent wird automatisch berechnet. Gewicht 0 heißt: fällt nie.</li>
<li><b>Drehen</b>: Zuschauernamen eintippen oder leer lassen, dann kommt einer aus der Teilnehmerliste. Der Preis wird hier im Panel zufällig gewählt, Stream und andere Moderatoren zeigen dasselbe Ergebnis. Solange es sich dreht, ist der Knopf gesperrt.</li>
<li><b>Teilnehmer</b>: ein Name pro Zeile, „Name x3“ gibt dreifache Chance. Wer gezogen wurde, verlässt die Liste, wenn der Schalter an ist; „Ausgeschiedene zurückholen“ legt alle zurück.</li>
<li><b>Aussehen und Ton</b>: Name und Chance auf dem Zettel, Lautstärke, wie lange das Ergebnis bleibt. Die Töne werden selbst erzeugt, keine Dateien nötig.</li>
</ul>`],
['giveaway', 'Verlosungen', `
<p>Der Tab <b>🎁 Verlosungen</b>: eine Verlosung mit Roulette. Auf dem Bildschirm gibt es eine Verlosung, sie wird über allen Ebenen gezeichnet, Position und Größe stellst du mit Reglern ein.</p>`],
['sound', 'Ton', `
<p>Der Tab <b>🔊 Ton</b>: Gesamtlautstärke (dieselbe wie in der Kopfzeile), Effektlautstärke und ein eigener Regler für jeden Ton.</p>
<p>Videos, Websites, Case, Timer und Verlosung haben eine eigene Lautstärke, die im Stream mit der Gesamtlautstärke multipliziert wird. Das Symbol 🔇 schaltet ein Element stumm (bei Videos und Websites ist das ihr eigener Ton).</p>`],
['cs2', 'CS2 β', `
<p>Klicke im Hudini-Fenster des Streamers auf <b>🎯 CS2 verbinden</b> und starte das Spiel neu. Das ist eine offizielle Valve-Funktion (Game State Integration): Das Spiel schickt die Daten selbst an das Programm. Es wird nichts ins Spiel eingeschleust, also kein Bann-Risiko.</p>
<p>Füge im Pult das Widget 🎯 CS2 hinzu und wähle eine Ansicht: Spielerkarte, K/D/A, HP, Geld, Waffe, DOUBLE / TRIPLE / ACE-Popup. Die „Zuschauer“-Ansichten (α) funktionieren, wenn der Streamer ein Match als Zuschauer verfolgt.</p>`],
['labels', 'Was β und α bedeuten', `
<p>Alles ohne Markierung ist stabil. <b>β (Beta)</b> funktioniert, ist aber noch auf wenigen Computern getestet. <b>α (Alpha)</b> ist ein Experiment und kann kaputtgehen oder sich ändern. Klicke im Pult auf eine Markierung, um ein Problem zu melden.</p>`],
['layout', 'Aussehen des Pults und Tour', `
<p>Raum → 🎛 Aussehen des Pults: fertige Layouts (Klassisch, Große Leinwand, Laptop, Freie Fenster), Textgröße, Animationen, Kompaktmodus. Spalten lassen sich am Rand ziehen, Tabs umsortieren, Abschnitte per Klick auf die Überschrift einklappen.</p>
<p>Das Aussehen wird nur in diesem Browser gespeichert. Du kannst es als Datei sichern und in einem anderen Browser laden. Lässt es sich nicht laden, nimmt das Pult die vorige Version oder den Standard.</p>
<p>Der Knopf <b>❓</b> oben wiederholt die Tour und öffnet diese Hilfe.</p>`],
['security', 'Sicherheit und Daten', `
<ul>
<li>Der Mod verbindet sich <b>direkt</b> per TLS mit dem PC des Streamers. Der Zertifikat-Fingerabdruck steckt im Code und Hudini prüft ihn: Auf dem Weg kann niemand die Verbindung austauschen.</li>
<li>Alles, was auf den Bildschirm geht, wird <b>verschlüsselt</b> (AES-256) und mit dem Schlüssel des Mods <b>signiert</b>. Das Widget verwirft alles Unsignierte.</li>
<li>Hudini hat keine eigenen Server oder Konten. Bildschirm, Dateien und CS2-Daten laufen nur über den PC des Streamers.</li>
<li>Dateien liegen verschlüsselt beim Streamer: Das Programm kann sie nicht lesen, nur das Widget entschlüsselt sie.</li>
<li>Das Pult-Passwort (⋯ Mehr → Passwort) verschlüsselt Räume und Schlüssel auf dem PC des Mods. Auch das Backup wird mit dem Passwort verschlüsselt.</li>
<li>Ist der Code durchgesickert, drückt der Streamer im Hudini-Fenster „Neuer Code“: Alle werden getrennt, der alte Code funktioniert nicht mehr.</li>
<li>Wenn du Porthole nutzt, halte die Lobby privat und lade nur deinen Mod ein.</li>
</ul>`],
['migrate', 'Umzug von rc.4', `
<p>Früher war das Pult eine Website und beim Streamer lief Hudini Host. Jetzt ist es <b>eine App, Hudini</b>, mit dem Pult darin. Die Daten des Pults lagen im Browser und ziehen nicht von selbst um.</p>
<p><b>Mod:</b></p>
<ol>
<li>Öffne auf der alten Seite das Pult → Tab ⚙ Raum → <b>Backup</b>, vergib ein Passwort und speichere die Datei.</li>
<li>Installiere Hudini, wähle „Ich bin der Mod“ und tritt dem Streamer mit dem neuen Code bei.</li>
<li>Im Pult: ⚙ Raum → <b>Aus Backup</b>, Datei wählen und Passwort eingeben.</li>
</ol>
<p><b>Streamer:</b> Installiere die neue Version. Der Raum wird neu erstellt, hole dir also den <b>Link für OBS</b> und den <b>Code für den Mod</b> noch einmal aus dem Hudini-Fenster. Das alte Hudini Host brauchst du nicht mehr. <b>Auf dem Mac</b> aktualisiert sich rc.4 nicht selbst: Lade das macOS-Archiv von der Website, entpacke es und starte Hudini.app.</p>`],
['trouble', 'Wenn etwas nicht klappt', `
<ul>
<li><b>Die Kapsel oben sagt „Warte auf Hudini Host“</b>: keine Verbindung zum Streamer. Prüfe, ob Hudini beim Streamer läuft, ob ihr im selben Netzwerk seid (VPN, Porthole oder Portweiterleitung), ob der Code aktuell ist (haben sich Adressen geändert, braucht ihr einen neuen) und ob Windows das Programm blockiert. Mehr unter „Wie verbinden wir uns?“.</li>
<li><b>Es geht um Zertifikat oder Fingerabdruck</b>: Der Streamer hat den Raum oder das Zertifikat neu erstellt. Bitte um einen neuen Code.</li>
<li><b>„OBS: nicht sichtbar“</b>: Die Browser-Quelle ist aus, nicht in der aktuellen Szene oder hat einen alten Link. Drücke in den Quelleneigenschaften „Cache der aktuellen Seite aktualisieren“.</li>
<li><b>„OBS: ⚠ nicht 16:9“</b>: Die Quelle hat die falsche Größe (standardmäßig 800×600). Stelle 1920×1080 ein und drücke <kbd>Strg+F</kbd>.</li>
<li><b>Eine Datei lädt nicht hoch</b>: Prüfe den freien Platz (unter dem Knopf „Datei“) und das Limit pro Datei.</li>
<li><b>Sitzungen oder Räume fehlen</b>: Stelle sie aus einem Backup wieder her (⚙ Raum → Aus Backup).</li>
<li><b>Du brauchst ein Protokoll</b>: Der erste Hudini-Bildschirm hat den Knopf „📁 Protokolle“. Hänge die Datei an, wenn du ein Problem meldest.</li>
</ul>
<p>Weiter nichts? <a href="https://github.com/niko-ua-designer/hudini/issues" target="_blank" rel="noopener">Problem melden</a>.</p>`],
['keys', 'Tastenkürzel', `
<ul>
<li><kbd>Strg+Z</kbd> rückgängig · <kbd>Entf</kbd> löschen · <kbd>Esc</kbd> Auswahl aufheben</li>
<li><kbd>Strg+C</kbd> / <kbd>Strg+V</kbd> kopieren und einfügen · <kbd>Strg+X</kbd> ausschneiden · <kbd>Strg+D</kbd> duplizieren</li>
<li><kbd>Umschalt</kbd>+Klick oder Rahmen ziehen: mehrere wählen · <kbd>Strg+A</kbd> alle · <kbd>Strg+G</kbd> gruppieren</li>
<li><kbd>H</kbd> verstecken/zeigen · <kbd>F</kbd> für N Sekunden zeigen · <kbd>1</kbd>…<kbd>9</kbd> Ebene mit dieser Nummer</li>
<li>Pfeiltasten verschieben (<kbd>Umschalt</kbd> weiter) · Mausrad ändert die Größe · <kbd>Alt</kbd>+Mausrad dreht</li>
<li>Ein Element rastet an Kanten und Mitten anderer ein (blaue Linie) · <kbd>Strg</kbd> beim Ziehen schaltet das Einrasten aus</li>
<li><kbd>Leertaste</kbd> Timer · <kbd>+</kbd>/<kbd>−</kbd> Zähler · <kbd>P</kbd> Animation</li>
</ul>`],
  ],
},
};

// Fill the "connect" section from the shared guides, in every language.
(function(){
  const C = window.HUDINI_CONNECT; if(!C) { for(const l in window.HUDINI_HELP) window.HUDINI_HELP[l].sections = window.HUDINI_HELP[l].sections.filter(s => s[0] !== 'connect'); return; }
  const list = a => '<ol>' + a.map(x => '<li>' + x + '</li>').join('') + '</ol>';
  for(const l in window.HUDINI_HELP){
    const g = C[l] || C.en, s = window.HUDINI_HELP[l].sections.find(x => x[0] === 'connect'); if(!s) continue;
    s[1] = g.title;
    s[2] = '<p>' + g.lead + '</p>' + ['radmin', 'porthole', 'tailscale', 'zerotier', 'port'].map(k => g.methods[k]).map(m =>
      '<h3>' + m.name + '</h3><p class="hint">' + m.tag + '</p><p>' + m.when + '</p>' +
      '<p><b>' + g.secS + '</b></p>' + list(m.s) + '<p><b>' + g.secM + '</b></p>' + list(m.m) +
      (m.warn ? '<p class="warnText">⚠ ' + m.warn + '</p>' : '') +
      '<p><b>' + g.secFix + '</b></p><ul>' + m.fix.map(x => '<li>' + x + '</li>').join('') + '</ul>').join('') +
      '<p>' + g.firewall + '</p><p><b>' + g.secCheck + '.</b> ' + g.check + '</p>';
  }
})();
