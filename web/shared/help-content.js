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
<li><b>Слои.</b> Строки слоёв тащатся мышью: так меняется порядок. Элемент, брошенный на папку, входит в неё, вытащенный из папки выходит. У строки есть кнопка удаления.</li>
<li><b>Скрыть всё</b> в шапке закрывает глазки у видимых элементов и запоминает их. «Показать всё» открывает ровно их, а то, что ты открыл вручную в промежутке, остаётся открытым.</li>
<li><b>Боковые панели.</b> Две кнопки в шапке прячут левую и правую панель, холст растягивается. Выбор запоминается.</li>
<li><b>Отмена по элементам.</b> <kbd>Ctrl+Z</kbd> отменяет последнее действие, <kbd>Ctrl+Y</kbd> или <kbd>Ctrl+Shift+Z</kbd> возвращает. Отмена касается только твоих правок: если другой модератор в это время менял другой элемент, его работа не откатится.</li>
</ul>`],
['stream', 'Камера, экран и микрофон', `
<p>В пульте вкладка ➕ Добавить, блок <b>Трансляция</b>: кнопки <b>Камера</b>, <b>Экран</b> и <b>Микрофон</b>. Нажми кнопку, выбери устройство (для экрана или окна откроется системный выбор), и на холсте появится слой. Это обычный слой: двигай, меняй размер, обрезай (Alt + край), прячь глазком. Кнопка ещё раз или ■ в списке останавливает трансляцию.</p>
<ul>
<li><b>Стример</b> показывает свои камеру, экран и микрофон без разрешений. Картинка идёт <b>прямо</b> в виджет OBS на этом же ПК.</li>
<li><b>Модератор</b> может делиться камерой, экраном и микрофоном, только если стример включил это ползунками в Hudini Host (по умолчанию всё выключено). Без разрешения кнопки неактивны. Стример подтверждает каждую трансляцию в доке и в любой момент может выключить её, тогда слой на стриме гаснет сразу.</li>
<li><b>Микрофон</b> появляется слоем без картинки: у него громкость и мьют, он есть и во вкладке «Звук».</li>
<li><b>Фон пульта.</b> Галочка «Показывать мой экран модераторам как фон» у стримера кладёт его экран подложкой под холст у модераторов. У каждого модератора есть своя галочка «Показывать экран стримера фоном». На стрим фон не попадает.</li>
</ul>
<p><b>Как это едет.</b> Сначала пробуется прямое соединение (WebRTC): с задержкой в десятки миллисекунд, без серверов посередине. Между разными ПК оно работает по адресам VPN (Tailscale, Radmin, ZeroTier) и в одной локальной сети. Если за 5 секунд прямая связь не поднялась (Porthole, проброс порта, закрытый UDP), картинка идёт запасным путём через Hudini Host стримера, задержка около секунды. Какой путь сейчас, видно в списке трансляций и на слое: «прямое · 40 мс» или «через Host · ~1 с».</p>
<p><b>Безопасность.</b> Всё зашифровано: договорённость о соединении запечатана ключом комнаты, видео идёт по DTLS-SRTP, а запасной путь шлёт куски, запечатанные ключом комнаты, так что Hudini Host не может их посмотреть. Публичных серверов нет, адреса из сети в договорённость не попадают.</p>
<p>Если кнопка «Экран» не работает в приложении на Linux, системе нужны пакеты WebRTC и PipeWire.</p>`],
['draw', 'Рисование', `
<p>Добавить → <b>Рисунок</b> создаёт слой для рисования. Рисуешь прямо на холсте пульта, над холстом появляется полоса с инструментами.</p>
<ul>
<li><b>Кисти</b>: ручка, маркер, неон, фигуры и стрелки (прямая, стрелка, круг, прямоугольник) и ластик.</li>
<li><b>Кисть из фото</b>: выбери картинку и один из двух режимов. «Штамп» ставит копии картинки вдоль линии, «текстура» заливает линию фотографией.</li>
<li><b>Пипетка</b> берёт цвет с холста или из фото. <b>Палитра из фото</b> показывает 6–8 главных цветов картинки.</li>
<li><b>«Вживую»</b>: штрих виден на стриме сразу. <b>«По кнопке»</b>: стрим увидит рисунок после «Показать».</li>
<li><b>Штрихи тают</b>: галочка прячет линии через заданное время (по умолчанию 5 с, ползунок от 1 до 60 с).</li>
<li>Рисовать могут все модераторы сразу, штрихи не теряются. Готовый рисунок сохраняется в библиотеку, как любой элемент.</li>
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
<p><b>Команды в чате</b> (Чат → «Команды в чате», выбери, кому можно): <code>!опрос</code>, <code>!опрос 60</code> — закрыть само через 60 с, <code>!опрос стоп</code>; <code>!таймер 5м</code>, <code>!таймер стоп</code> / <code>старт</code> / <code>сброс</code>.</p>
<p><b>Смайлы 7TV, BTTV и FFZ.</b> В настройках чата три галочки на каждую комнату, по умолчанию выключены. Включённые смайлы видны в ленте пульта, в чате и в сообщениях на стриме. Смайлы грузятся с внешних серверов, на это есть подпись рядом с галочками.</p>`],
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
<li><b>Запуск зрителями</b> (блок «💬 Запуск зрителями», входить в Twitch не нужно): <b>команда в чате</b> (по умолчанию «!крутить», слово меняется), «кто может»: стример и модераторы, сабы или все. Режим «добавить в участники» кладёт зрителя в список, «крутить сразу» запускает рулетку с его ником. «Пауза» не даёт запускать чаще, «лимит на зрителя» ограничивает число запусков одного человека (0 значит без лимита). Если открыто несколько пультов, сообщение обработает только один.</li>
<li><b>Награда за баллы</b>: создай награду в Twitch и включи ей <b>«Требовать от зрителя ввести текст»</b> (Панель управления → Награды за баллы канала → Добавить → «Требовать ввод текста»). Без ввода текста награда в чат не приходит. Потом в пульте нажми «🔍 Определить награду», попроси кого-нибудь (или сам) получить награду и выбери её в списке. Фильтр «только одно слово» (по умолчанию включён) отбрасывает длинные тексты, можно указать слово, которое обязательно ввести. Всё отброшенное видно в списке «Пропущено».</li>
</ul>`],
['giveaway', 'Розыгрыши', `
<p>Вкладка <b>🎁 Розыгрыши</b>: розыгрыш с рулеткой. На экране один розыгрыш, он рисуется поверх всех слоёв, а положение и размер задаются ползунками.</p>`],
['sound', 'Звук', `
<p>Вкладка <b>🔊 Звук</b>: общая громкость (та же, что в шапке), громкость эффектов и отдельный ползунок на каждый звук.</p>
<p>У видео, сайтов, кейса, таймера и розыгрыша своя громкость, на стриме она умножается на общую. Значок 🔇 выключает звук элемента (у видео и сайтов это их собственный звук).</p>`],
['cs2', 'CS2 β', `
<p>В окне Hudini стримера нажми <b>🎯 Подключить CS2</b> и перезапусти игру. Это официальная функция Valve (Game State Integration): игра сама отправляет данные программе. Ничего не внедряется в игру, бана за это нет.</p>
<p>В пульте добавь виджет 🎯 CS2 и выбери вид: карточка игрока, K/D/A, HP, деньги, оружие, всплывашка DOUBLE / TRIPLE / ACE. Виды «наблюдатель» (α) работают, когда стример смотрит игру зрителем.</p>
<ul>
<li><b>Киллфид</b> Hudini по умолчанию выключен, на экране виден киллфид самой игры. Включается галочкой у элемента CS2.</li>
<li><b>K/D</b> показывается значками: прицел 12 · череп 5. Коэффициент 2.40 остался там, где был.</li>
<li><b>«Файт».</b> Над холстом пульта на 2–5 секунд появляется плашка вроде «Файт: 3 SaiYeah ↔ 7 gospoja». Она видна на любой вкладке и в доке, на стрим не идёт.</li>
<li><b>Серия карт</b>: формат BO1, BO3 или BO5. Host сам записывает итог каждой карты, счёт можно сбросить или поправить вручную. Серия видна в scorebar, hud_tour и в авто-табе.</li>
<li><b>Авто-таб</b>: анимированная таблица со всеми игроками (K/D, ADR, HS%, деньги, оружие, счёт, серия). Появляется сама на тактических таймаутах и паузе, при смене сторон и в конце карты с итогами и MVP. Тумблер и выбор моментов во вкладке CS2, есть четыре стиля.</li>
<li><b>Номера игроков.</b> В авто-табе есть переключатель: «как в игре» (клавиши наблюдателя CS2) или «по порядку в худе» (слева 1–5, справа 6–0).</li>
<li><b>Пролёты камеры</b> (вкладка CS2): когда ты смотришь матч зрителем или демку, камера сама облетает карту на закупке, паузе, таймауте и разминке. Пути рисуются в пульте на радаре: точки из игры (getpos), вручную или мышью, у каждого отрезка «плавно» или «обрыв» (мгновенный прыжок), время на отрезок, цепочки путей с паузами, импорт и экспорт файлом. Всё хранится только в данных Host (data/cs2-flights.json).
<ol><li>В Steam: CS2 → Свойства → Параметры запуска, добавь <code>-netconport 27015</code> (любой порт от 1024) и перезапусти игру.</li><li>Во вкладке CS2 включи «Пролёты» и укажи тот же порт.</li><li>Наблюдай матч или демку, на закупке нажми «Точка из игры» несколько раз, потом «Прогнать пролёт».</li></ol>
Как это устроено и что запрещено: Hudini шлёт в консоль игры только <code>spec_goto</code>, <code>getpos</code>, <code>spec_mode</code>, <code>spec_autodirector</code> и <code>cl_draw_only_deathnotices</code> через официальный параметр <code>-netconport</code>. Никаких инжектов в процесс, чтения и записи памяти, хуков, оверлеев поверх игры, эмуляции клавиш и мыши, и ни одного файла в папке игры. Пока ты играешь сам (не зритель и не демка), Hudini не открывает порт и ничего не шлёт. На время пролёта Hudini шлёт ещё <code>spec_autodirector 0</code>; если у тебя он и так выключен постоянно (например, в autoexec), галочку «Выключать автодиректор на время пролёта» можно снять. Пролётами могут управлять и модераторы, но только если стример включил им это в Hudini Host («Модераторы управляют камерой и консолью CS2 (пролёты, автодиректор, интерфейс)»). Вверху вкладки CS2 и в доке OBS есть быстрые кнопки: «только килл-фид» (<code>cl_draw_only_deathnotices</code>), автодиректор вкл/выкл и запуск пролёта вручную. Они работают только пока ты смотришь игру зрителем или демку; «вкл/выкл» показывает последнюю отправленную команду, а не состояние игры.
<b>Осторожно:</b> на FACEIT и в других сторонних античитах (ESEA, Gamersclub и т.п.) пролёты не включай: они могут не любить любое управление игрой извне. Решение и риск на тебе.</li>
<li><b>Радар</b>: где стоит каждый игрок, цвет команды, номер слота, мёртвые и бомба. Фирменные карты в трёх темах.</li>
</ul>`],
['perms', 'Права модераторов и док OBS', `
<p><b>Права.</b> В настройках Hudini стример выбирает, что разрешено модераторам. Четыре галочки, все включены по умолчанию: звуки и видео; сайты и файлы; чат, рисование и эффекты; кейсы, розыгрыши, опросы и CS2. Выключенное пропадает из пульта и не проходит на стрим.</p>
<p><b>Быстрые выключатели</b> в доке OBS отключают на стриме прямо сейчас чат, CS2-HUD, звуки, рисунки или эффекты.</p>
<p><b>Док OBS</b> теперь показывает статусы, список элементов на экране с глазками (стример сам прячет лишнее), блок «Кто на связи» (модераторы, пинг, способ связи, кнопка «отключить») и блок CS2 со счётом, наблюдаемым игроком и крупной подсказкой «файт».</p>
<p><b>Стример сам себе модератор.</b> Кнопка <b>«Открыть пульт»</b> в Hudini открывает полный пульт на этом же ПК без кода и пароля. Модераторы могут работать параллельно.</p>
<p><b>Журнал и «О программе».</b> В окне Hudini есть журнал подключений (адреса модераторов записаны частично, например <code>100.x.x.12 (Tailscale)</code>) и раздел «О программе» с версией и благодарностями тестерам.</p>`],
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
<li><kbd>Ctrl+Z</kbd> отменить · <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd> вернуть · <kbd>Del</kbd> удалить · <kbd>Esc</kbd> снять выделение</li>
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
<li><b>Layers.</b> Drag layer rows to change the order. An element dropped on a folder goes inside, one pulled out of a folder leaves it. Every row has a delete button.</li>
<li><b>Hide all</b> in the header closes the eyes of the visible elements and remembers them. "Show all" opens exactly those, and anything you opened by hand in between stays open.</li>
<li><b>Side panels.</b> Two buttons in the header hide the left and the right panel, and the canvas stretches. The choice is remembered.</li>
<li><b>Undo per element.</b> <kbd>Ctrl+Z</kbd> undoes your last action, <kbd>Ctrl+Y</kbd> or <kbd>Ctrl+Shift+Z</kbd> redoes it. It only touches your own edits: if another moderator changed a different element meanwhile, their work is not rolled back.</li>
</ul>`],
['stream', 'Camera, screen and microphone', `
<p>In the panel open ➕ Add, block <b>Broadcast</b>: buttons <b>Camera</b>, <b>Screen</b> and <b>Microphone</b>. Press one, pick a device (for a screen or a window the system picker opens) and a layer appears on the canvas. It is a normal layer: move it, resize, crop (Alt + edge), hide it with the eye. Press the button again, or ■ in the list, to stop.</p>
<ul>
<li>The <b>streamer</b> shows their own camera, screen and microphone without any permission. The picture goes <b>straight</b> to the OBS widget on the same PC.</li>
<li>A <b>moderator</b> can share a camera, screen or microphone only if the streamer switched it on with the sliders in Hudini Host (everything is off by default). Without permission the buttons are disabled. The streamer confirms every broadcast in the dock and can cut it at any moment: the layer disappears from the stream at once.</li>
<li>The <b>microphone</b> is a layer without a picture: it has a volume and a mute, and it is in the Sound tab too.</li>
<li><b>Panel backdrop.</b> The streamer's box "Show my screen to moderators as a backdrop" puts their screen under the canvas in the moderators' panels. Each moderator has their own box, "Show the streamer's screen as a backdrop". The backdrop never reaches the stream.</li>
</ul>
<p><b>How it travels.</b> First a direct connection (WebRTC) is tried: tens of milliseconds, no server in between. Between different PCs it works over VPN addresses (Tailscale, Radmin, ZeroTier) and inside one local network. If the direct link does not come up in 5 seconds (Porthole, a forwarded port, blocked UDP), the picture takes the fallback road through the streamer's Hudini Host, about a second of delay. The current road shows in the broadcast list and on the layer: "direct · 40 ms" or "via Host · ~1 s".</p>
<p><b>Security.</b> Everything is encrypted: the connection set-up is sealed with the room key, video runs over DTLS-SRTP, and the fallback sends pieces sealed with the room key, so Hudini Host cannot look at them. No public servers; network addresses stay inside the private ranges.</p>
<p>If the Screen button does not work in the app on Linux, the system needs the WebRTC and PipeWire packages.</p>`],
['draw', 'Drawing', `
<p>Add → <b>Drawing</b> creates a layer to draw on. You draw right on the panel canvas, and a toolbar appears above it.</p>
<ul>
<li><b>Brushes</b>: pen, marker, neon, shapes and arrows (line, arrow, circle, rectangle) and an eraser.</li>
<li><b>Photo brush</b>: pick a picture and one of two modes. "Stamp" puts copies of the picture along the line, "texture" fills the line with the photo.</li>
<li><b>Eyedropper</b> picks a colour from the canvas or from a photo. <b>Palette from a photo</b> shows the 6-8 main colours of the picture.</li>
<li><b>"Live"</b>: a stroke shows on stream at once. <b>"On button"</b>: the stream sees the drawing after you press Show.</li>
<li><b>Fading strokes</b>: the tick hides lines after a set time (5 s by default, slider from 1 to 60 s).</li>
<li>All moderators can draw at the same time and no strokes get lost. A finished drawing goes to the library like any element.</li>
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
<p><b>Chat commands</b> (Chat → “Chat commands”, choose who may use them): <code>!poll</code>, <code>!poll 60</code> to close by itself in 60 s, <code>!poll stop</code>; <code>!timer 5m</code>, <code>!timer stop</code> / <code>start</code> / <code>reset</code>.</p>
<p><b>7TV, BTTV and FFZ emotes.</b> In the chat settings there are three ticks per room, off by default. Emotes you turn on show in the panel feed, in the chat and in messages on stream. They load from outside servers, and a note next to the ticks says so.</p>`],
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
<li><b>Launch by viewers</b> (the “💬 Launch by viewers” block, no Twitch login needed): a <b>chat command</b> (“!крутить” by default, the word is editable) with “who can”: streamer and moderators, subs or everyone. “Add to participants” puts the viewer on the list, “spin right away” starts the roulette with their nickname. “Pause” stops it from starting too often, the “per-viewer limit” caps how many times one person can start it (0 means no limit). If several panels are open, only one of them handles the message.</li>
<li><b>Channel-points reward</b>: create a reward in Twitch and switch on <b>“Require viewer to enter text”</b> (Creator Dashboard → Viewer Rewards → Channel Points → Add New Custom Reward). A reward without text input does not reach the chat. Then press “🔍 Find the reward” in the panel, have someone (or yourself) redeem it and pick it from the list. The “only one word” filter (on by default) drops long texts, and you can set a word that must be typed. Everything dropped is listed under “Skipped”.</li>
</ul>`],
['giveaway', 'Giveaways', `
<p>The <b>🎁 Giveaways</b> tab: a giveaway with a roulette. There is one giveaway on the screen, it is drawn above all layers, and its position and size are set with sliders.</p>`],
['sound', 'Sound', `
<p>The <b>🔊 Sound</b> tab: the overall volume (the same as in the header), the effects volume and a separate slider for every sound.</p>
<p>Videos, websites, the case, the timer and the giveaway have their own volume, which is multiplied by the overall one on stream. The 🔇 icon mutes an element (for videos and websites that is their own sound).</p>`],
['cs2', 'CS2 β', `
<p>In the streamer's Hudini window press <b>🎯 Connect CS2</b> and restart the game. This is an official Valve feature (Game State Integration): the game itself sends data to the app. Nothing is injected into the game, so there's no ban risk.</p>
<p>In the panel add the 🎯 CS2 widget and pick a view: player card, K/D/A, HP, money, weapon, DOUBLE / TRIPLE / ACE popup. The "observer" views (α) work when the streamer watches a match as a spectator.</p>
<ul>
<li><b>Kill feed.</b> Hudini's own kill feed is off by default, so the game's kill feed shows on screen. Turn it on with the tick on the CS2 element.</li>
<li><b>K/D</b> uses icons: crosshair 12 · skull 5. The 2.40 ratio stays where it was.</li>
<li><b>"Fight".</b> A strip like "Fight: 3 SaiYeah ↔ 7 gospoja" appears above the panel canvas for 2-5 seconds. It shows on any tab and in the dock, and does not go to the stream.</li>
<li><b>Map series</b>: format BO1, BO3 or BO5. Hudini records the result of each map itself, and you can reset the score or fix it by hand. The series shows in the scorebar, hud_tour and the auto scoreboard.</li>
<li><b>Auto scoreboard</b>: an animated table with all players (K/D, ADR, HS%, money, weapon, score, series). It appears on its own during tactical timeouts and pauses, at the side switch and at the end of the map with results and MVP. The switch and the choice of moments are in the CS2 tab, and there are four styles.</li>
<li><b>Player numbers.</b> The auto scoreboard has a switch: "as in the game" (the CS2 spectator keys) or "in HUD order" (left 1–5, right 6–0).</li>
<li><b>Camera flights</b> (CS2 tab): while you watch a match as a spectator or a demo, the camera flies around the map on its own during buy time, pauses, timeouts and warmup. Paths are drawn in the panel on the radar: points from the game (getpos), typed in or moved with the mouse, every segment is "smooth" or "cut" (an instant jump), time per segment, chains of paths with pauses, import and export as a file. Everything is stored only in Host's data (data/cs2-flights.json).
<ol><li>In Steam: CS2 → Properties → Launch options, add <code>-netconport 27015</code> (any port from 1024) and restart the game.</li><li>In the CS2 tab turn flights on and enter the same port.</li><li>Watch a match or a demo, press "Point from game" a few times during buy time, then "Run the flight".</li></ol>
How it works and what is ruled out: Hudini sends only <code>spec_goto</code>, <code>getpos</code>, <code>spec_mode</code>, <code>spec_autodirector</code> and <code>cl_draw_only_deathnotices</code> to the game console through the official <code>-netconport</code> launch option. No injection into the process, no reading or writing memory, no hooks, no overlays on the game, no keyboard or mouse emulation, and not a single file in the game folder. While you play yourself (not a spectator and not a demo), Hudini does not open the port and sends nothing. During a flight Hudini also sends <code>spec_autodirector 0</code>; if you already keep it at 0 permanently (for example in autoexec), you can untick "Turn off the auto-director during a flight". Moderators can manage flights only if the streamer allows it in Hudini Host ("Moderators control the CS2 camera and console (flights, auto-director, interface)"). At the top of the CS2 tab and in the OBS dock there are quick buttons: "kill feed only" (<code>cl_draw_only_deathnotices</code>), auto-director on/off and running a flight by hand. They work only while you watch a game as a spectator or a demo; on/off shows the last command sent, not the state of the game.
<b>Careful:</b> do not turn flights on on FACEIT or other third-party anti-cheats (ESEA, Gamersclub and similar): they may object to any outside control of the game. The decision and the risk are yours.</li>
<li><b>Radar</b>: where each player stands, team colour, slot number, the dead and the bomb. Branded maps in three themes.</li>
</ul>`],
['perms', 'Moderator permissions and the OBS dock', `
<p><b>Permissions.</b> In Hudini's settings the streamer chooses what moderators may do. Four ticks, all on by default: sounds and video; websites and files; chat, drawing and effects; cases, giveaways, polls and CS2. Whatever is off disappears from the panel and does not reach the stream.</p>
<p><b>Quick switches</b> in the OBS dock turn off chat, the CS2 HUD, sounds, drawings or effects on the stream right now.</p>
<p><b>The OBS dock</b> now shows the status, a list of elements on screen with eyes (the streamer hides extras on their own), a "Who is online" block (moderators, ping, connection method, a "disconnect" button) and a CS2 block with the score, the watched player and a big "fight" hint.</p>
<p><b>Streamer as their own moderator.</b> The <b>"Open panel"</b> button in Hudini opens the full panel on the same PC with no code and no password. Moderators can work at the same time.</p>
<p><b>Log and "About".</b> Hudini's window has a connection log (moderator addresses are partly hidden, for example <code>100.x.x.12 (Tailscale)</code>) and an "About" section with the version and thanks to the testers.</p>`],
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
<li><kbd>Ctrl+Z</kbd> undo · <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd> redo · <kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect</li>
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
<li><b>Шари.</b> Рядки шарів тягаються мишею: так змінюється порядок. Елемент, кинутий на папку, входить до неї, витягнутий з папки виходить. У рядка є кнопка видалення.</li>
<li><b>Сховати все</b> у шапці закриває очка видимих елементів і запам'ятовує їх. «Показати все» відкриває саме їх, а те, що ти відкрив вручну між цим, лишається відкритим.</li>
<li><b>Бокові панелі.</b> Дві кнопки в шапці ховають ліву й праву панель, полотно розтягується. Вибір запам'ятовується.</li>
<li><b>Скасування по елементах.</b> <kbd>Ctrl+Z</kbd> скасовує останню дію, <kbd>Ctrl+Y</kbd> або <kbd>Ctrl+Shift+Z</kbd> повертає. Скасування стосується лише твоїх правок: якщо інший модератор змінював інший елемент, його робота не відкотиться.</li>
</ul>`],
['stream', 'Камера, екран і мікрофон', `
<p>У пульті вкладка ➕ Додати, блок <b>Трансляція</b>: кнопки <b>Камера</b>, <b>Екран</b> і <b>Мікрофон</b>. Натисни кнопку, обери пристрій (для екрана чи вікна відкриється системний вибір), і на полотні з'явиться шар. Це звичайний шар: рухай, змінюй розмір, обрізай (Alt + край), ховай оком. Кнопка ще раз або ■ у списку зупиняє трансляцію.</p>
<ul>
<li><b>Стример</b> показує свої камеру, екран і мікрофон без дозволів. Картинка йде <b>напряму</b> у віджет OBS на цьому ж ПК.</li>
<li><b>Модератор</b> може ділитися камерою, екраном і мікрофоном, лише якщо стример увімкнув це повзунками в Hudini Host (за замовчуванням усе вимкнено). Без дозволу кнопки неактивні. Стример підтверджує кожну трансляцію в доці й будь-коли може її вимкнути, тоді шар на стрімі гасне одразу.</li>
<li><b>Мікрофон</b> з'являється шаром без картинки: у нього є гучність і мʼют, він є і у вкладці «Звук».</li>
<li><b>Тло пульта.</b> Галочка «Показувати мій екран модераторам як тло» у стримера кладе його екран підкладкою під полотно в модераторів. У кожного модератора є своя галочка «Показувати екран стримера тлом». На стрім тло не потрапляє.</li>
</ul>
<p><b>Як це їде.</b> Спочатку пробується пряме зʼєднання (WebRTC): із затримкою в десятки мілісекунд, без серверів посередині. Між різними ПК воно працює за адресами VPN (Tailscale, Radmin, ZeroTier) і в одній локальній мережі. Якщо за 5 секунд пряма звʼязь не піднялася (Porthole, прокинутий порт, закритий UDP), картинка йде запасним шляхом через Hudini Host стримера, затримка близько секунди. Який шлях зараз, видно в списку трансляцій і на шарі: «пряме · 40 мс» або «через Host · ~1 с».</p>
<p><b>Безпека.</b> Усе зашифровано: домовленість про зʼєднання запечатана ключем кімнати, відео йде по DTLS-SRTP, а запасний шлях шле шматки, запечатані ключем кімнати, тож Hudini Host не може їх переглянути. Публічних серверів немає, адреси з мережі не виходять за межі приватних діапазонів.</p>
<p>Якщо кнопка «Екран» не працює в застосунку на Linux, системі потрібні пакети WebRTC і PipeWire.</p>`],
['draw', 'Малювання', `
<p>Додати → <b>Малюнок</b> створює шар для малювання. Малюєш просто на полотні пульта, над полотном з'являється смуга з інструментами.</p>
<ul>
<li><b>Пензлі</b>: ручка, маркер, неон, фігури й стрілки (пряма, стрілка, коло, прямокутник) та гумка.</li>
<li><b>Пензель із фото</b>: вибери картинку й один із двох режимів. «Штамп» ставить копії картинки вздовж лінії, «текстура» заливає лінію фотографією.</li>
<li><b>Піпетка</b> бере колір з полотна або з фото. <b>Палітра з фото</b> показує 6–8 головних кольорів картинки.</li>
<li><b>«Наживо»</b>: штрих видно на стрімі одразу. <b>«За кнопкою»</b>: стрім побачить малюнок після «Показати».</li>
<li><b>Штрихи тануть</b>: галочка ховає лінії через заданий час (за замовчуванням 5 с, повзунок від 1 до 60 с).</li>
<li>Малювати можуть усі модератори одразу, штрихи не губляться. Готовий малюнок зберігається в бібліотеку, як будь-який елемент.</li>
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
<p><b>Команди в чаті</b> (Чат → «Команди в чаті», вибери, кому можна): <code>!опрос</code>, <code>!опрос 60</code> — закрити саме через 60 с, <code>!опрос стоп</code>; <code>!таймер 5м</code>, <code>!таймер стоп</code> / <code>старт</code> / <code>сброс</code>.</p>
<p><b>Смайли 7TV, BTTV і FFZ.</b> У налаштуваннях чату три галочки на кожну кімнату, за замовчуванням вимкнені. Увімкнені смайли видно в стрічці пульта, у чаті й у повідомленнях на стрімі. Смайли вантажаться із зовнішніх серверів, про це є підпис біля галочок.</p>`],
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
<li><b>Запуск глядачами</b> (блок «💬 Запуск глядачами», входити в Twitch не треба): <b>команда в чаті</b> (за замовчуванням «!крутить», слово змінюється), «хто може»: стример і модератори, саби або всі. Режим «додати в учасники» кладе глядача в список, «крутити одразу» запускає рулетку з його ніком. «Пауза» не дає запускати частіше, «ліміт на глядача» обмежує кількість запусків однієї людини (0 означає без ліміту). Якщо відкрито кілька пультів, повідомлення обробить лише один.</li>
<li><b>Нагорода за бали</b>: створи нагороду в Twitch і ввімкни їй <b>«Вимагати від глядача ввести текст»</b> (Панель керування → Нагороди за бали каналу → Додати → «Вимагати введення тексту»). Без введення тексту нагорода в чат не приходить. Потім у пульті натисни «🔍 Визначити нагороду», попроси когось (або зроби сам) отримати нагороду й обери її в списку. Фільтр «лише одне слово» (за замовчуванням увімкнено) відкидає довгі тексти, можна вказати слово, яке обов’язково ввести. Усе відкинуте видно в списку «Пропущено».</li>
</ul>`],
['giveaway', 'Розіграші', `
<p>Вкладка <b>🎁 Розіграші</b>: розіграш із рулеткою. На екрані один розіграш, він малюється поверх усіх шарів, а положення й розмір задаються повзунками.</p>`],
['sound', 'Звук', `
<p>Вкладка <b>🔊 Звук</b>: загальна гучність (та сама, що в шапці), гучність ефектів і окремий повзунок на кожен звук.</p>
<p>Відео, сайти, кейс, таймер і розіграш мають власну гучність, на стримі вона множиться на загальну. Значок 🔇 вимикає звук елемента (у відео й сайтів це їхній власний звук).</p>`],
['cs2', 'CS2 β', `
<p>У вікні Hudini стримера натисни <b>🎯 Підключити CS2</b> і перезапусти гру. Це офіційна функція Valve (Game State Integration): гра сама надсилає дані програмі. Нічого не впроваджується в гру, бану за це немає.</p>
<p>У пульті додай віджет 🎯 CS2 і вибери вигляд: картка гравця, K/D/A, HP, гроші, зброя, спливашка DOUBLE / TRIPLE / ACE. Вигляди «спостерігач» (α) працюють, коли стример дивиться гру глядачем.</p>
<ul>
<li><b>Кілфід</b> Hudini за замовчуванням вимкнений, на екрані видно кілфід самої гри. Вмикається галочкою в елемента CS2.</li>
<li><b>K/D</b> показується значками: приціл 12 · череп 5. Коефіцієнт 2.40 лишився там, де був.</li>
<li><b>«Файт».</b> Над полотном пульта на 2–5 секунд з'являється плашка на кшталт «Файт: 3 SaiYeah ↔ 7 gospoja». Вона видна на будь-якій вкладці й у доці, на стрім не йде.</li>
<li><b>Серія карт</b>: формат BO1, BO3 або BO5. Host сам записує підсумок кожної карти, рахунок можна скинути або поправити вручну. Серія видна в scorebar, hud_tour і в авто-табі.</li>
<li><b>Авто-таб</b>: анімована таблиця з усіма гравцями (K/D, ADR, HS%, гроші, зброя, рахунок, серія). З'являється сама на тактичних таймаутах і паузі, під час зміни сторін і в кінці карти з підсумками та MVP. Перемикач і вибір моментів на вкладці CS2, є чотири стилі.</li>
<li><b>Номери гравців.</b> В авто-табі є перемикач: «як у грі» (клавіші спостерігача CS2) або «за порядком у худі» (ліворуч 1–5, праворуч 6–0).</li>
<li><b>Прольоти камери</b> (вкладка CS2): коли ти дивишся матч глядачем або демку, камера сама облітає карту на закупівлі, паузі, таймауті й розминці. Шляхи малюються в пульті на радарі: точки з гри (getpos), вручну або мишею, у кожного відрізка «плавно» або «обрив» (миттєвий стрибок), час на відрізок, ланцюжки шляхів із паузами, імпорт та експорт файлом. Усе зберігається лише в даних Host (data/cs2-flights.json).
<ol><li>У Steam: CS2 → Властивості → Параметри запуску, додай <code>-netconport 27015</code> (будь-який порт від 1024) і перезапусти гру.</li><li>У вкладці CS2 увімкни «Прольоти» й вкажи той самий порт.</li><li>Дивись матч або демку, на закупівлі кілька разів натисни «Точка з гри», потім «Прогнати проліт».</li></ol>
Як це влаштовано й що заборонено: Hudini шле в консоль гри лише <code>spec_goto</code>, <code>getpos</code>, <code>spec_mode</code>, <code>spec_autodirector</code> і <code>cl_draw_only_deathnotices</code> через офіційний параметр <code>-netconport</code>. Жодних інжектів у процес, читання чи запису пам'яті, хуків, оверлеїв поверх гри, емуляції клавіш і миші та жодного файлу в теці гри. Поки ти граєш сам (не глядач і не демка), Hudini не відкриває порт і нічого не шле. На час прольоту Hudini шле ще <code>spec_autodirector 0</code>; якщо в тебе він і так вимкнений постійно (наприклад, в autoexec), галочку «Вимикати автодиректор на час прольоту» можна зняти. Прольотами можуть керувати й модератори, але лише якщо стример дозволив це в Hudini Host («Модератори керують камерою й консоллю CS2 (прольоти, автодиректор, інтерфейс)»). Угорі вкладки CS2 і в доці OBS є швидкі кнопки: «лише кілфід» (<code>cl_draw_only_deathnotices</code>), автодиректор увімк/вимк і запуск прольоту вручну. Вони працюють, лише поки ти дивишся гру глядачем або демку; «увімк/вимк» показує останню надіслану команду, а не стан гри.
<b>Обережно:</b> на FACEIT та в інших сторонніх античитах (ESEA, Gamersclub тощо) прольоти не вмикай: вони можуть не любити будь-яке керування грою ззовні. Рішення й ризик на тобі.</li>
<li><b>Радар</b>: де стоїть кожен гравець, колір команди, номер слота, мертві й бомба. Фірмові карти в трьох темах.</li>
</ul>`],
['perms', 'Права модераторів і док OBS', `
<p><b>Права.</b> У налаштуваннях Hudini стример обирає, що дозволено модераторам. Чотири галочки, усі ввімкнені за замовчуванням: звуки й відео; сайти й файли; чат, малювання й ефекти; кейси, розіграші, опитування й CS2. Вимкнене зникає з пульта й не проходить на стрім.</p>
<p><b>Швидкі вимикачі</b> в доці OBS вимикають на стрімі просто зараз чат, CS2-HUD, звуки, малюнки або ефекти.</p>
<p><b>Док OBS</b> тепер показує статуси, список елементів на екрані з очками (стример сам ховає зайве), блок «Хто на зв'язку» (модератори, пінг, спосіб зв'язку, кнопка «відключити») і блок CS2 з рахунком, гравцем, за яким стежать, і великою підказкою «файт».</p>
<p><b>Стример сам собі модератор.</b> Кнопка <b>«Відкрити пульт»</b> у Hudini відкриває повний пульт на цьому ж ПК без коду й пароля. Модератори можуть працювати паралельно.</p>
<p><b>Журнал і «Про програму».</b> У вікні Hudini є журнал підключень (адреси модераторів записано частково, наприклад <code>100.x.x.12 (Tailscale)</code>) і розділ «Про програму» з версією та подяками тестерам.</p>`],
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
<li><kbd>Ctrl+Z</kbd> скасувати · <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd> повернути · <kbd>Del</kbd> видалити · <kbd>Esc</kbd> зняти виділення</li>
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
<li><b>Ebenen.</b> Ebenenzeilen lassen sich mit der Maus ziehen, so ändert sich die Reihenfolge. Ein Element, das auf einen Ordner fallen gelassen wird, kommt hinein, eines, das herausgezogen wird, verlässt ihn. Jede Zeile hat eine Löschtaste.</li>
<li><b>Alles ausblenden</b> in der Kopfzeile schließt die Augen der sichtbaren Elemente und merkt sie sich. „Alles zeigen“ öffnet genau diese, und was du zwischendurch von Hand geöffnet hast, bleibt offen.</li>
<li><b>Seitenleisten.</b> Zwei Tasten in der Kopfzeile blenden die linke und die rechte Leiste aus, die Fläche wird größer. Die Wahl wird gemerkt.</li>
<li><b>Rückgängig pro Element.</b> <kbd>Ctrl+Z</kbd> macht deine letzte Aktion rückgängig, <kbd>Ctrl+Y</kbd> oder <kbd>Ctrl+Shift+Z</kbd> stellt sie wieder her. Das betrifft nur deine eigenen Änderungen: Hat ein anderer Moderator inzwischen ein anderes Element geändert, wird seine Arbeit nicht zurückgedreht.</li>
</ul>`],
['stream', 'Kamera, Bildschirm und Mikrofon', `
<p>Im Pult: Tab ➕ Hinzufügen, Block <b>Übertragung</b> mit den Knöpfen <b>Kamera</b>, <b>Bildschirm</b> und <b>Mikrofon</b>. Knopf drücken, Gerät wählen (bei Bildschirm oder Fenster öffnet sich die Systemauswahl), und auf der Fläche erscheint eine Ebene. Das ist eine normale Ebene: verschieben, skalieren, zuschneiden (Alt + Kante), mit dem Auge ausblenden. Der Knopf noch einmal oder ■ in der Liste beendet die Übertragung.</p>
<ul>
<li>Der <b>Streamer</b> zeigt seine Kamera, seinen Bildschirm und sein Mikrofon ohne Erlaubnis. Das Bild geht <b>direkt</b> ins OBS-Widget auf demselben PC.</li>
<li>Ein <b>Moderator</b> darf Kamera, Bildschirm oder Mikrofon nur teilen, wenn der Streamer es mit den Reglern in Hudini Host eingeschaltet hat (standardmäßig ist alles aus). Ohne Erlaubnis sind die Knöpfe gesperrt. Der Streamer bestätigt jede Übertragung im Dock und kann sie jederzeit abschalten, dann verschwindet die Ebene sofort vom Stream.</li>
<li>Das <b>Mikrofon</b> ist eine Ebene ohne Bild, mit Lautstärke und Stummschaltung, auch im Tab „Ton“.</li>
<li><b>Hintergrund im Pult.</b> Das Häkchen „Meinen Bildschirm den Moderatoren als Hintergrund zeigen“ legt den Bildschirm des Streamers unter die Fläche der Moderatoren. Jeder Moderator hat sein eigenes Häkchen „Bildschirm des Streamers als Hintergrund zeigen“. Auf den Stream gelangt der Hintergrund nie.</li>
</ul>
<p><b>Der Weg.</b> Zuerst wird eine direkte Verbindung (WebRTC) versucht: einige Dutzend Millisekunden, kein Server dazwischen. Zwischen verschiedenen PCs klappt das über VPN-Adressen (Tailscale, Radmin, ZeroTier) und im selben lokalen Netz. Steht die direkte Verbindung nach 5 Sekunden nicht (Porthole, weitergeleiteter Port, gesperrtes UDP), nimmt das Bild den Ersatzweg über das Hudini Host des Streamers, etwa eine Sekunde Verzögerung. Der aktuelle Weg steht in der Liste und auf der Ebene: „direkt · 40 ms“ oder „über Host · ~1 s“.</p>
<p><b>Sicherheit.</b> Alles ist verschlüsselt: Der Verbindungsaufbau ist mit dem Raumschlüssel versiegelt, das Video läuft über DTLS-SRTP, und der Ersatzweg sendet mit dem Raumschlüssel versiegelte Stücke, die Hudini Host nicht ansehen kann. Keine öffentlichen Server; Netzadressen bleiben in den privaten Bereichen.</p>
<p>Funktioniert der Knopf „Bildschirm“ in der App unter Linux nicht, braucht das System die Pakete WebRTC und PipeWire.</p>`],
['draw', 'Zeichnen', `
<p>Hinzufügen → <b>Zeichnung</b> erstellt eine Ebene zum Zeichnen. Du zeichnest direkt auf der Fläche des Pults, über der Fläche erscheint eine Werkzeugleiste.</p>
<ul>
<li><b>Pinsel</b>: Stift, Marker, Neon, Formen und Pfeile (Linie, Pfeil, Kreis, Rechteck) und ein Radierer.</li>
<li><b>Fotopinsel</b>: Wähle ein Bild und einen von zwei Modi. „Stempel“ setzt Kopien des Bildes entlang der Linie, „Textur“ füllt die Linie mit dem Foto.</li>
<li><b>Pipette</b> nimmt eine Farbe von der Fläche oder aus einem Foto. Die <b>Palette aus einem Foto</b> zeigt die 6–8 Hauptfarben des Bildes.</li>
<li><b>„Live“</b>: Ein Strich ist sofort im Stream zu sehen. <b>„Per Knopf“</b>: Der Stream sieht die Zeichnung nach „Zeigen“.</li>
<li><b>Striche verblassen</b>: Das Häkchen blendet Linien nach einer festen Zeit aus (standardmäßig 5 s, Regler von 1 bis 60 s).</li>
<li>Alle Moderatoren können gleichzeitig zeichnen, Striche gehen nicht verloren. Eine fertige Zeichnung kommt wie jedes Element in die Bibliothek.</li>
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
<p><b>Chat-Befehle</b> (Chat → „Chat-Befehle“, wähle, wer sie nutzen darf): <code>!poll</code>, <code>!poll 60</code> schließt nach 60 s, <code>!poll stop</code>; <code>!timer 5m</code>, <code>!timer stop</code> / <code>start</code> / <code>reset</code>.</p>
<p><b>Emotes von 7TV, BTTV und FFZ.</b> In den Chat-Einstellungen gibt es drei Häkchen pro Raum, standardmäßig aus. Eingeschaltete Emotes erscheinen im Feed des Pults, im Chat und in Nachrichten im Stream. Sie werden von externen Servern geladen, ein Hinweis neben den Häkchen sagt das.</p>`],
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
<li><b>Start durch Zuschauer</b> (Block „💬 Start durch Zuschauer“, ohne Twitch-Anmeldung): ein <b>Chat-Befehl</b> (standardmäßig „!крутить“, das Wort lässt sich ändern) mit „Wer darf“: Streamer und Moderatoren, Subs oder alle. „Zu den Teilnehmern hinzufügen“ setzt den Zuschauer auf die Liste, „sofort drehen“ startet die Roulette mit seinem Namen. „Pause“ verhindert zu häufiges Starten, das „Limit pro Zuschauer“ begrenzt, wie oft eine Person starten darf (0 heißt unbegrenzt). Sind mehrere Panels offen, verarbeitet nur eines die Nachricht.</li>
<li><b>Kanalpunkte-Belohnung</b>: Lege in Twitch eine Belohnung an und aktiviere <b>„Zuschauer muss Text eingeben“</b> (Creator-Dashboard → Kanalpunkte → Neue benutzerdefinierte Belohnung). Eine Belohnung ohne Texteingabe kommt nicht im Chat an. Dann im Panel „🔍 Belohnung erkennen“ drücken, die Belohnung einlösen lassen (auch selbst) und in der Liste wählen. Der Filter „nur ein Wort“ (standardmäßig an) verwirft lange Texte, außerdem kannst du ein Wort festlegen, das eingegeben werden muss. Alles Verworfene steht unter „Übersprungen“.</li>
</ul>`],
['giveaway', 'Verlosungen', `
<p>Der Tab <b>🎁 Verlosungen</b>: eine Verlosung mit Roulette. Auf dem Bildschirm gibt es eine Verlosung, sie wird über allen Ebenen gezeichnet, Position und Größe stellst du mit Reglern ein.</p>`],
['sound', 'Ton', `
<p>Der Tab <b>🔊 Ton</b>: Gesamtlautstärke (dieselbe wie in der Kopfzeile), Effektlautstärke und ein eigener Regler für jeden Ton.</p>
<p>Videos, Websites, Case, Timer und Verlosung haben eine eigene Lautstärke, die im Stream mit der Gesamtlautstärke multipliziert wird. Das Symbol 🔇 schaltet ein Element stumm (bei Videos und Websites ist das ihr eigener Ton).</p>`],
['cs2', 'CS2 β', `
<p>Klicke im Hudini-Fenster des Streamers auf <b>🎯 CS2 verbinden</b> und starte das Spiel neu. Das ist eine offizielle Valve-Funktion (Game State Integration): Das Spiel schickt die Daten selbst an das Programm. Es wird nichts ins Spiel eingeschleust, also kein Bann-Risiko.</p>
<p>Füge im Pult das Widget 🎯 CS2 hinzu und wähle eine Ansicht: Spielerkarte, K/D/A, HP, Geld, Waffe, DOUBLE / TRIPLE / ACE-Popup. Die „Zuschauer“-Ansichten (α) funktionieren, wenn der Streamer ein Match als Zuschauer verfolgt.</p>
<ul>
<li><b>Killfeed.</b> Der eigene Killfeed von Hudini ist standardmäßig aus, auf dem Bildschirm ist der Killfeed des Spiels zu sehen. Mit dem Häkchen am CS2-Element schaltest du ihn ein.</li>
<li><b>K/D</b> erscheint mit Symbolen: Fadenkreuz 12 · Totenkopf 5. Das Verhältnis 2.40 bleibt, wo es war.</li>
<li><b>„Fight“.</b> Über der Fläche des Pults erscheint 2–5 Sekunden ein Streifen wie „Fight: 3 SaiYeah ↔ 7 gospoja“. Er ist auf jedem Tab und im Dock sichtbar und geht nicht in den Stream.</li>
<li><b>Kartenserie</b>: Format BO1, BO3 oder BO5. Host speichert das Ergebnis jeder Karte selbst, den Stand kannst du zurücksetzen oder von Hand korrigieren. Die Serie steht im Scorebar, im hud_tour und im Auto-Tab.</li>
<li><b>Auto-Tab</b>: eine animierte Tabelle mit allen Spielern (K/D, ADR, HS%, Geld, Waffe, Stand, Serie). Sie erscheint von selbst bei taktischen Auszeiten und Pausen, beim Seitenwechsel und am Kartenende mit Ergebnis und MVP. Schalter und Auswahl der Momente sind im CS2-Tab, es gibt vier Stile.</li>
<li><b>Spielernummern.</b> Der Auto-Tab hat einen Schalter: „wie im Spiel“ (die Zuschauertasten von CS2) oder „in HUD-Reihenfolge“ (links 1–5, rechts 6–0).</li>
<li><b>Kameraflüge</b> (Tab CS2): Wenn du ein Match als Zuschauer oder eine Demo ansiehst, fliegt die Kamera in der Kaufphase, bei Pausen, Timeouts und im Warmup von selbst über die Karte. Die Pfade zeichnest du im Panel auf dem Radar: Punkte aus dem Spiel (getpos), von Hand oder mit der Maus, jedes Segment ist „weich“ oder „Schnitt“ (sofortiger Sprung), Zeit pro Segment, Ketten aus Pfaden mit Pausen, Import und Export als Datei. Alles liegt nur in den Daten von Host (data/cs2-flights.json).
<ol><li>In Steam: CS2 → Eigenschaften → Startoptionen, <code>-netconport 27015</code> hinzufügen (beliebiger Port ab 1024) und das Spiel neu starten.</li><li>Im Tab CS2 die Flüge einschalten und denselben Port eintragen.</li><li>Ein Match oder eine Demo ansehen, in der Kaufphase mehrmals „Punkt aus dem Spiel“ drücken, dann „Flug abspielen“.</li></ol>
So funktioniert es und das ist ausgeschlossen: Hudini schickt nur <code>spec_goto</code>, <code>getpos</code>, <code>spec_mode</code>, <code>spec_autodirector</code> und <code>cl_draw_only_deathnotices</code> über die offizielle Startoption <code>-netconport</code> an die Spielkonsole. Keine Injektion in den Prozess, kein Lesen oder Schreiben des Speichers, keine Hooks, keine Overlays über dem Spiel, keine Tastatur- oder Mausemulation und keine einzige Datei im Spielordner. Solange du selbst spielst (weder Zuschauer noch Demo), öffnet Hudini den Port nicht und sendet nichts. Während eines Flugs sendet Hudini außerdem <code>spec_autodirector 0</code>; wenn er bei dir ohnehin dauerhaft aus ist (z. B. in der autoexec), kannst du „Autodirektor während des Flugs ausschalten“ abwählen. Moderatoren dürfen Flüge nur steuern, wenn der Streamer es in Hudini Host erlaubt („Moderatoren steuern Kamera und Konsole von CS2 (Flüge, Autodirektor, Oberfläche)“). Oben im CS2-Tab und im OBS-Dock gibt es Schnelltasten: „nur Kill-Feed“ (<code>cl_draw_only_deathnotices</code>), Autodirektor an/aus und Flug von Hand starten. Sie wirken nur, solange du als Zuschauer oder in einer Demo schaust; an/aus zeigt den zuletzt gesendeten Befehl, nicht den Spielzustand.
<b>Vorsicht:</b> Auf FACEIT und bei anderen Drittanbieter-Anti-Cheats (ESEA, Gamersclub u. ä.) die Flüge nicht einschalten: Sie mögen jede Steuerung des Spiels von außen nicht. Entscheidung und Risiko liegen bei dir.</li>
<li><b>Radar</b>: wo jeder Spieler steht, Teamfarbe, Slot-Nummer, Tote und die Bombe. Eigene Karten in drei Themen.</li>
</ul>`],
['perms', 'Rechte der Moderatoren und das OBS-Dock', `
<p><b>Rechte.</b> In den Einstellungen von Hudini legt der Streamer fest, was Moderatoren dürfen. Vier Häkchen, standardmäßig alle an: Sounds und Videos; Websites und Dateien; Chat, Zeichnen und Effekte; Cases, Verlosungen, Umfragen und CS2. Was aus ist, verschwindet aus dem Pult und gelangt nicht in den Stream.</p>
<p><b>Schnellschalter</b> im OBS-Dock schalten Chat, CS2-HUD, Sounds, Zeichnungen oder Effekte im Stream sofort aus.</p>
<p><b>Das OBS-Dock</b> zeigt jetzt den Status, eine Liste der Elemente auf dem Bildschirm mit Augen (der Streamer blendet Überflüssiges selbst aus), einen Block „Wer ist online“ (Moderatoren, Ping, Verbindungsart, Knopf „trennen“) und einen CS2-Block mit Spielstand, beobachtetem Spieler und einem großen „Fight“-Hinweis.</p>
<p><b>Streamer als eigener Moderator.</b> Die Taste <b>„Pult öffnen“</b> in Hudini öffnet das volle Pult auf demselben PC ohne Code und Passwort. Moderatoren können gleichzeitig arbeiten.</p>
<p><b>Protokoll und „Über das Programm“.</b> Das Hudini-Fenster hat ein Verbindungsprotokoll (Moderator-Adressen sind teilweise verdeckt, zum Beispiel <code>100.x.x.12 (Tailscale)</code>) und einen Bereich „Über das Programm“ mit Version und Dank an die Tester.</p>`],
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
<li><kbd>Strg+Z</kbd> rückgängig · <kbd>Strg+Y</kbd> / <kbd>Strg+Umschalt+Z</kbd> wiederholen · <kbd>Entf</kbd> löschen · <kbd>Esc</kbd> Auswahl aufheben</li>
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
