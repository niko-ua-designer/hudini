# Changelog

The release workflow copies the section for the tag version (the heading must be exactly `## <version>`) into the release notes.
Hudini Host shows this file too ("What's new"): keep the format described in `docs/RELEASING.md`.

## 1.2.0-rc.1

<!-- date: 2026-11-28 -->

**EN**

#### Hudini Host window and panel

- The Host window is new: sections in a sidebar instead of one long page, with a short tour. Moderator requests for camera, screen and microphone stay on top of every section.
- System notifications for moderators, OBS, CS2 and the app itself. Open a group to switch off single events. While the window is in sight, only camera, screen and microphone requests arrive this way.
- Quiet app sounds in the Host window and the panel. The app asks whether you want them; they can be switched off in the settings, and the OBS widget never plays them.
- The panel shows its tour once after the update and again from the settings.
- The OBS camera as a backdrop: the streamer can show moderators the OBS Virtual Camera under the canvas instead of the screen. It arrives faster than Twitch.
- The panel fits a small window (900x600) better: a more compact header, whole words on buttons, readable lists and fields, a fixed help drawer and many small visual fixes in the Host window and the dock.
- The default chat words of giveaways and the roulette follow the language of the stream texts.

#### Updates

- The app never restarts by itself: a new version is installed only when you press the button. If a stream is running, a separate window asks to confirm.
- Stable and Beta channels, the list of changes inside the app, and a rollback from a beta to the latest stable version with a copy of the settings. Moderators have the same in their app.
- This is a public beta. 1.1 does not update to it by itself: download it and unpack it into a separate folder.

#### Fixes and security

- Widget files from the website are used only with a valid signature. Hudini Host 1.1 and older still take them unsigned until they are updated.
- "Delete unused files" keeps the files that other moderators use.
- A paused moderator sees "paused" instead of "no connection".
- A moderator whose network changes gets back in at once.
- Edits made by several moderators at the same moment no longer overwrite each other.
- Camera and screen connections are more reliable.
- After the update, refresh the OBS browser source once.

**RU**

#### Окно Hudini Host и пульт

- Новое окно Host: разделы в боковом меню вместо одной длинной страницы и короткий тур. Запросы модераторов на камеру, экран и микрофон видны поверх любого раздела.
- Системные уведомления о модераторах, OBS, CS2 и самой программе. Группу можно раскрыть и выключить отдельные события. Пока окно на виду, так приходят только запросы камеры, экрана и микрофона.
- Тихие звуки программы в окне Host и в пульте. Программа спросит, нужны ли они; их можно выключить в настройках, а виджет в OBS их не играет.
- Пульт один раз показывает тур после обновления, и его можно повторить из настроек.
- Камера OBS фоном: стример может показать модераторам под холстом виртуальную камеру OBS вместо экрана. Картинка приходит быстрее, чем с Twitch.
- Пульт лучше помещается в маленькое окно (900x600): компактнее шапка, целые слова на кнопках, читаемые списки и поля, исправленная панель справки и много мелких правок вида в окне Host и доке.
- Слова чата по умолчанию для розыгрышей и рулетки зависят от языка надписей на стриме.

#### Обновления

- Программа никогда не перезапускается сама: новая версия ставится только по кнопке. Если идёт стрим, отдельное окно просит подтверждение.
- Каналы «Стабильная» и «Бета», список изменений прямо в программе и откат с беты на последнюю стабильную версию с копией настроек. У модераторов в их программе то же самое.
- Это открытая бета. 1.1 сама на неё не обновится: скачай её и распакуй в отдельную папку.

#### Исправления и безопасность

- Файлы виджета с сайта принимаются только с верной подписью. Hudini Host 1.1 и старше, пока не обновится, берёт их без подписи.
- «Удалить неиспользуемые файлы» не трогает файлы, которыми пользуются другие модераторы.
- Модератор на паузе видит «пауза», а не «нет связи».
- Модератор, у которого сменилась сеть, входит снова сразу.
- Одновременные правки нескольких модераторов больше не затирают друг друга.
- Соединения камеры и экрана стали надёжнее.
- После обновления один раз обнови источник «Браузер» в OBS.

**UK**

#### Вікно Hudini Host і пульт

- Нове вікно Host: розділи в боковому меню замість однієї довгої сторінки та короткий тур. Запити модераторів на камеру, екран і мікрофон видно поверх будь-якого розділу.
- Системні сповіщення про модераторів, OBS, CS2 і саму програму. Групу можна розгорнути й вимкнути окремі події. Поки вікно на видноті, так приходять лише запити камери, екрана та мікрофона.
- Тихі звуки програми у вікні Host і в пульті. Програма запитає, чи потрібні вони; їх можна вимкнути в налаштуваннях, а віджет в OBS їх не грає.
- Пульт один раз показує тур після оновлення, і його можна повторити з налаштувань.
- Камера OBS тлом: стрімер може показати модераторам під полотном віртуальну камеру OBS замість екрана. Картинка приходить швидше, ніж із Twitch.
- Пульт краще вміщується в маленьке вікно (900x600): компактніша шапка, цілі слова на кнопках, читабельні списки й поля, виправлена панель довідки та багато дрібних правок вигляду у вікні Host і доці.
- Слова чату за замовчуванням для розіграшів і рулетки залежать від мови написів на стримі.

#### Оновлення

- Програма ніколи не перезапускається сама: нова версія ставиться лише по кнопці. Якщо йде стрим, окреме вікно просить підтвердження.
- Канали «Стабільна» і «Бета», список змін прямо в програмі та відкат із бети на останню стабільну версію з копією налаштувань. У модераторів у їхній програмі те саме.
- Це відкрита бета. 1.1 сама на неї не оновиться: завантаж її й розпакуй в окрему теку.

#### Виправлення та безпека

- Файли віджета із сайту приймаються лише з правильним підписом. Hudini Host 1.1 і старіший, доки не оновиться, бере їх без підпису.
- «Видалити невикористані файли» не чіпає файли, якими користуються інші модератори.
- Модератор на паузі бачить «пауза», а не «немає зв'язку».
- Модератор, у якого змінилася мережа, входить знову одразу.
- Одночасні правки кількох модераторів більше не затирають одна одну.
- З'єднання камери та екрана стали надійнішими.
- Після оновлення один раз онови джерело «Браузер» в OBS.

**DE**

#### Hudini-Host-Fenster und Pult

- Das Host-Fenster ist neu: Bereiche in einer Seitenleiste statt einer langen Seite, mit einer kurzen Tour. Anfragen der Moderatoren für Kamera, Bildschirm und Mikrofon bleiben über jedem Bereich sichtbar.
- Systemmitteilungen zu Moderatoren, OBS, CS2 und der App selbst. Jede Gruppe lässt sich öffnen, einzelne Ereignisse lassen sich ausschalten. Solange das Fenster sichtbar ist, kommen so nur Anfragen für Kamera, Bildschirm und Mikrofon.
- Leise Programm-Sounds im Host-Fenster und im Pult. Die App fragt, ob du sie willst; in den Einstellungen lassen sie sich ausschalten, und das OBS-Widget spielt sie nie.
- Das Pult zeigt seine Tour einmal nach dem Update und auf Wunsch erneut aus den Einstellungen.
- Die OBS-Kamera als Hintergrund: Der Streamer kann den Moderatoren statt des Bildschirms die virtuelle Kamera von OBS unter der Fläche zeigen. Das Bild kommt schneller an als über Twitch.
- Das Pult passt besser in ein kleines Fenster (900x600): kompaktere Kopfzeile, ganze Wörter auf Knöpfen, lesbare Listen und Felder, eine reparierte Hilfeleiste und viele kleine optische Korrekturen im Host-Fenster und im Dock.
- Die Standard-Chatwörter für Gewinnspiele und Roulette richten sich nach der Sprache der Stream-Texte.

#### Updates

- Die App startet nie von selbst neu: Eine neue Version wird nur per Knopfdruck installiert. Läuft ein Stream, fragt ein eigenes Fenster nach einer Bestätigung.
- Kanäle „Stabil“ und „Beta“, die Liste der Änderungen in der App und eine Rückkehr von einer Beta zur letzten stabilen Version mit einer Kopie der Einstellungen. Moderatoren haben in ihrer App dasselbe.
- Das ist eine öffentliche Beta. 1.1 aktualisiert sich nicht von selbst darauf: lade sie herunter und entpacke sie in einen eigenen Ordner.

#### Korrekturen und Sicherheit

- Widget-Dateien von der Website werden nur mit gültiger Signatur übernommen. Hudini Host 1.1 und älter nimmt sie bis zum Update ohne Signatur.
- „Unbenutzte Dateien löschen“ behält Dateien, die andere Moderatoren verwenden.
- Ein pausierter Moderator sieht „Pause“ statt „keine Verbindung“.
- Ein Moderator, dessen Netzwerk wechselt, kommt sofort wieder hinein.
- Gleichzeitige Änderungen mehrerer Moderatoren überschreiben sich nicht mehr.
- Kamera- und Bildschirmverbindungen sind zuverlässiger.
- Aktualisiere nach dem Update einmal die Browser-Quelle in OBS.

### Testing

**EN**
- Install into a separate folder. To keep your settings, close Hudini and copy the "data" folder from 1.1 (keep the original).
- After the first start, refresh the browser source in OBS.
- OBS camera as a backdrop: delay, picture, several moderators, what happens when the virtual camera stops.
- App sounds and system notifications, also with the window minimized to the tray.
- Updates: switching channels, "Update and restart", the confirmation window while a stream is live.
- Moderators on 1.1 together with a streamer on the beta.
- macOS and Linux: report anything that looks or works differently.

**RU**
- Ставь в отдельную папку. Чтобы сохранить настройки, закрой Hudini и скопируй папку «data» из 1.1 (оригинал оставь).
- После первого запуска обнови браузерный источник в OBS.
- Камера OBS фоном: задержка, картинка, несколько модераторов, что происходит при остановке виртуальной камеры.
- Звуки программы и системные уведомления, в том числе при окне, свёрнутом в трей.
- Обновления: смена канала, «Обновить и перезапустить», окно подтверждения во время стрима.
- Модераторы на 1.1 вместе со стримером на бете.
- macOS и Linux: сообщай обо всём, что выглядит или работает иначе.

**UK**
- Став в окрему теку. Щоб зберегти налаштування, закрий Hudini і скопіюй теку «data» з 1.1 (оригінал залиш).
- Після першого запуску онови браузерне джерело в OBS.
- Камера OBS тлом: затримка, картинка, кілька модераторів, що відбувається після зупинки віртуальної камери.
- Звуки програми та системні сповіщення, зокрема з вікном, згорнутим у трей.
- Оновлення: зміна каналу, «Оновити й перезапустити», вікно підтвердження під час стриму.
- Модератори на 1.1 разом зі стрімером на беті.
- macOS і Linux: повідомляй про все, що виглядає чи працює інакше.

**DE**
- Installiere in einen eigenen Ordner. Um die Einstellungen zu behalten, schließe Hudini und kopiere den Ordner „data“ aus 1.1 (das Original behalten).
- Aktualisiere nach dem ersten Start die Browser-Quelle in OBS.
- OBS-Kamera als Hintergrund: Verzögerung, Bild, mehrere Moderatoren, was beim Stoppen der virtuellen Kamera passiert.
- Programm-Sounds und Systembenachrichtigungen, auch bei in den Tray minimiertem Fenster.
- Updates: Kanalwechsel, „Aktualisieren und neu starten“, das Bestätigungsfenster während eines Streams.
- Moderatoren mit 1.1 zusammen mit einem Streamer auf der Beta.
- macOS und Linux: melde alles, was anders aussieht oder funktioniert.

## 1.1.3

<!-- date: 2026-11-26 -->

**EN**
- The cross in the library deletes the item again: a click on the icon used to put the element on stream. The same is fixed for the buttons of scenes, scenarios and animation frames.
- Drawing strokes no longer fade away by default: "Fading" is now an option you switch on.
- Moderators can join again after updating from 1.0: a room left from an old config without its private key is replaced once on start, and the Host window shows a notice with buttons to copy the new OBS link and the moderator code. The overlay in OBS stays empty until the new link is there. The old "room from the panel" field is gone.
- Host window: the OBS link card comes first, moderator camera, screen and microphone requests are shown there too, changing the role during a stream asks for confirmation, the Host window and the dock open in the app language, error messages stay on screen longer, the address table fits narrow windows, and there is a Porthole port hint.
- The panel shows a connection hint for every address of the code and says what each network needs.
- "Pause moderators" still lets moderators read files, so images keep loading; uploading and deleting are refused with a clear message. Error messages from the server are translated into English, Ukrainian and German.
- Safer permissions: when the streamer switches off "games", a roulette already on screen is hidden and silent, and a moderator can no longer force the CS2 tab on stream. A moderator can no longer take over the connection of another client with the same id.
- The OBS dock cannot be embedded into another page, and the report page removes OBS links and invitations with keys from what you paste. Home folder names no longer appear in the log and crash report.
- The Host log is in English.
- The app no longer shows a notification permission error.
- Site: a menu on phones, a direct download of the zip, a note on phones that Hudini is for PC, a help table of contents that follows the reader, a better header on tablets, the language is kept between pages, fixes in the report wizard, the connection guides (Radmin VPN, Tailscale, ZeroTier, Porthole) in the download window with links to each tool, smooth page transitions.
- More translations: the Ukrainian text uses "стрімер" everywhere, role names match the real tabs (Streamer, Moderator, Add), English chat command hints in the panel, and the help gets the missing nick cleanup entry in English, Ukrainian and German.
- Calmer look of the panel, the Host window and the dock: visible keyboard focus, clearer buttons and fields, better contrast, larger touch targets.
- A moderator whose network changed (Wi-Fi to mobile, LAN to Tailscale) gets back in within about 20 seconds.

**RU**
- Крестик в библиотеке снова удаляет элемент: клик по иконке выводил элемент на стрим. То же исправлено у кнопок сцен, сценариев и кадров анимации.
- Нарисованное больше не исчезает по умолчанию: «Тают» теперь включают по желанию.
- Модераторы снова могут войти после обновления с 1.0: комната из старого конфига без приватного ключа один раз заменяется при запуске, а окно Host показывает уведомление с кнопками копирования новой ссылки OBS и кода модератора. Пока новая ссылка не вставлена в OBS, оверлей пустой. Старое поле «комната из пульта» убрано.
- Окно Host: сначала карточка со ссылкой OBS, запросы модераторов на камеру, экран и микрофон видны и там, смена роли во время стрима просит подтверждение, окно Host и док открываются на языке приложения, сообщения об ошибках висят дольше, таблица адресов помещается в узкое окно, добавлена подсказка про порт Porthole.
- Пульт показывает подсказку подключения для каждого адреса из кода и говорит, что нужно каждой сети.
- «Пауза модераторов» всё ещё позволяет модераторам читать файлы, так что картинки продолжают загружаться; загрузка и удаление отклоняются с понятным сообщением. Сообщения об ошибках от сервера переведены на английский, украинский и немецкий.
- Права безопаснее: когда стример выключает «игры», уже стоящая рулетка прячется и молчит, а модератор больше не может принудительно показать CS2-таб на стриме. Модератор больше не может занять соединение другого клиента с тем же id.
- OBS-док нельзя встроить в чужую страницу, а страница отчёта убирает из вставленного текста ссылки OBS и приглашения с ключами. Имя папки пользователя больше не попадает в журнал и отчёт о сбое.
- Журнал Host на английском.
- Приложение больше не показывает ошибку про разрешение на уведомления.
- Сайт: меню на телефонах, прямая загрузка zip, пометка на телефонах, что Hudini для ПК, оглавление справки следует за читателем, лучше шапка на планшетах, язык сохраняется между страницами, исправления в мастере отчёта, гайды подключения (Radmin VPN, Tailscale, ZeroTier, Porthole) в окне скачивания со ссылками на каждый инструмент, плавные переходы между страницами.
- Больше переводов: в украинских текстах везде «стрімер», названия ролей совпадают с настоящими вкладками (Стример, Модератор, Добавить), английские подсказки команд чата в пульте, в справке на английском, украинском и немецком появился пункт про чистку ников.
- Спокойнее внешний вид пульта, окна Host и дока: видимый фокус с клавиатуры, понятнее кнопки и поля, лучше контраст, крупнее цели нажатия.
- Модератор, у которого сменилась сеть (с Wi-Fi на мобильную, с LAN на Tailscale), снова входит примерно за 20 секунд.

**UK**
- Хрестик у бібліотеці знову видаляє елемент: клік по іконці виводив елемент на стрім. Те саме виправлено для кнопок сцен, сценаріїв і кадрів анімації.
- Намальоване більше не зникає за замовчуванням: «Тануть» тепер вмикають за бажанням.
- Модератори знову можуть увійти після оновлення з 1.0: кімната зі старого конфігу без приватного ключа один раз замінюється під час запуску, а вікно Host показує сповіщення з кнопками копіювання нового посилання OBS і коду модератора. Поки нове посилання не вставлено в OBS, оверлей порожній. Старе поле «кімната з пульта» прибрано.
- Вікно Host: спершу картка з посиланням OBS, запити модераторів на камеру, екран і мікрофон видно й там, зміна ролі під час стріму просить підтвердження, вікно Host і док відкриваються мовою застосунку, повідомлення про помилки висять довше, таблиця адрес вміщується у вузьке вікно, додано підказку про порт Porthole.
- Пульт показує підказку підключення для кожної адреси з коду й каже, що потрібно кожній мережі.
- «Пауза модераторів» усе ще дозволяє модераторам читати файли, тож картинки далі завантажуються; завантаження й видалення відхиляються зі зрозумілим повідомленням. Повідомлення про помилки від сервера перекладені англійською, українською та німецькою.
- Безпечніші права: коли стрімер вимикає «ігри», рулетка, що вже стоїть, ховається й мовчить, а модератор більше не може примусово показати CS2-таб на стрімі. Модератор більше не може зайняти з’єднання іншого клієнта з тим самим id.
- OBS-док не можна вбудувати в чужу сторінку, а сторінка звіту прибирає зі вставленого тексту посилання OBS і запрошення з ключами. Ім’я домашньої теки більше не потрапляє в журнал і звіт про збій.
- Журнал Host англійською.
- Застосунок більше не показує помилку про дозвіл на сповіщення.
- Сайт: меню на телефонах, пряме завантаження zip, примітка на телефонах, що Hudini для ПК, зміст довідки йде за читачем, краща шапка на планшетах, мова зберігається між сторінками, виправлення в майстрі звіту, гайди підключення (Radmin VPN, Tailscale, ZeroTier, Porthole) у вікні завантаження з посиланнями на кожен інструмент, плавні переходи між сторінками.
- Більше перекладів: в українських текстах скрізь «стрімер», назви ролей збігаються зі справжніми вкладками (Стрімер, Модератор, Додати), англійські підказки команд чату в пульті, у довідці англійською, українською та німецькою з’явився пункт про чистку ніків.
- Спокійніший вигляд пульта, вікна Host і дока: видимий фокус із клавіатури, зрозуміліші кнопки й поля, кращий контраст, більші цілі натискання.
- Модератор, у якого змінилася мережа (з Wi-Fi на мобільну, з LAN на Tailscale), знову входить приблизно за 20 секунд.

**DE**
- Das Kreuz in der Bibliothek löscht den Eintrag wieder: Ein Klick auf das Symbol brachte das Element auf den Stream. Dasselbe ist bei den Knöpfen von Szenen, Szenarien und Animationsbildern behoben.
- Gezeichnetes verschwindet nicht mehr von selbst: das Verblassen ist jetzt eine Option zum Einschalten.
- Mods können nach dem Update von 1.0 wieder beitreten: Ein Raum aus einer alten Konfiguration ohne privaten Schlüssel wird beim Start einmal ersetzt, und das Host-Fenster zeigt einen Hinweis mit Knöpfen zum Kopieren des neuen OBS-Links und des Mod-Codes. Das Overlay in OBS bleibt leer, bis der neue Link eingetragen ist. Das alte Feld „Raum aus dem Pult“ ist entfernt.
- Host-Fenster: Zuerst die Karte mit dem OBS-Link, Anfragen der Mods für Kamera, Bildschirm und Mikrofon erscheinen auch dort, ein Rollenwechsel während des Streams fragt nach, Host-Fenster und Dock öffnen sich in der Sprache der App, Fehlermeldungen bleiben länger sichtbar, die Adresstabelle passt in schmale Fenster, und es gibt einen Porthole-Port-Hinweis.
- Das Pult zeigt für jede Adresse des Codes einen Verbindungshinweis und sagt, was das jeweilige Netzwerk braucht.
- „Mods pausieren“ lässt Mods weiter Dateien lesen, damit Bilder weiter laden; Hochladen und Löschen werden mit einer klaren Meldung abgelehnt. Fehlermeldungen vom Server sind auf Englisch, Ukrainisch und Deutsch übersetzt.
- Sicherere Rechte: Wenn der Streamer „Spiele“ ausschaltet, wird eine bereits sichtbare Roulette ausgeblendet und stumm, und ein Mod kann den CS2-Tab nicht mehr erzwingen. Ein Mod kann die Verbindung eines anderen Clients mit derselben ID nicht mehr übernehmen.
- Das OBS-Dock lässt sich nicht in andere Seiten einbetten, und die Meldeseite entfernt OBS-Links und Einladungen mit Schlüsseln aus eingefügtem Text. Der Name des Benutzerordners erscheint nicht mehr im Protokoll und im Absturzbericht.
- Das Host-Protokoll ist auf Englisch.
- Die App zeigt keinen Fehler zur Benachrichtigungsberechtigung mehr.
- Die Website: ein Menü auf Handys, direkter Zip-Download, auf Handys ein Hinweis, dass Hudini für den PC ist, ein Hilfe-Inhaltsverzeichnis, das dem Leser folgt, ein besserer Kopfbereich auf Tablets, die Sprache bleibt zwischen Seiten erhalten, Korrekturen im Meldeassistenten, die Verbindungsanleitungen (Radmin VPN, Tailscale, ZeroTier, Porthole) im Download-Fenster mit Links zu jedem Tool, sanfte Seitenübergänge.
- Mehr Übersetzungen: im Ukrainischen überall „стрімер“, Rollennamen passen zu den echten Tabs (Streamer, Moderator, Hinzufügen), englische Chat-Befehlshinweise im Pult, und die Hilfe hat den fehlenden Eintrag zur Nick-Bereinigung auf Englisch, Ukrainisch und Deutsch.
- Ruhigeres Aussehen von Pult, Host-Fenster und Dock: sichtbarer Tastaturfokus, klarere Knöpfe und Felder, besserer Kontrast, größere Tippziele.
- Ein Mod, dessen Netzwerk gewechselt hat (WLAN zu Mobilfunk, LAN zu Tailscale), ist nach etwa 20 Sekunden wieder drin.

## 1.1.2

<!-- date: 2026-11-24 -->

**EN**
- More translations in the Hudini Host window: the connection hints (Tailscale, Radmin VPN, Hamachi, ZeroTier, Porthole, port forwarding), the empty online list, copy buttons, the port line, confirmations and update messages now follow the selected language.
- The panel messages about connection problems and the room keys warning are translated too.
- The updater shows a progress bar while the update downloads and the time of the last check.
- The first start offers the language with English as the default.
- “Report a problem” in the program opens the report page on the site in the current language instead of GitHub.

**RU**
- Ещё переводы в окне Hudini Host: подсказки по подключению (Tailscale, Radmin VPN, Hamachi, ZeroTier, Porthole, проброс порта), пустой список «на связи», кнопки копирования, строка про порт, подтверждения и сообщения об обновлении теперь следуют выбранному языку.
- Сообщения пульта о проблемах подключения и предупреждение про ключи комнаты тоже переведены.
- Апдейтер показывает прогресс-бар при скачивании обновления и время последней проверки.
- При первом запуске предлагается выбрать язык, по умолчанию английский.
- «Сообщить о проблеме» в программе открывает страницу сообщения на сайте на текущем языке, а не GitHub.

**UK**
- Ще переклади у вікні Hudini Host: підказки щодо підключення (Tailscale, Radmin VPN, Hamachi, ZeroTier, Porthole, прокидання порту), порожній список «на зв’язку», кнопки копіювання, рядок про порт, підтвердження та повідомлення про оновлення тепер відповідають обраній мові.
- Повідомлення пульта про проблеми підключення та попередження про ключі кімнати теж перекладені.
- Оновлення показує індикатор прогресу під час завантаження та час останньої перевірки.
- Під час першого запуску пропонується обрати мову, за замовчуванням англійська.
- «Повідомити про проблему» в програмі відкриває сторінку повідомлення на сайті поточною мовою, а не GitHub.

**DE**
- Weitere Übersetzungen im Hudini-Host-Fenster: die Verbindungshinweise (Tailscale, Radmin VPN, Hamachi, ZeroTier, Porthole, Portweiterleitung), die leere Online-Liste, Kopier-Knöpfe, die Port-Zeile, Bestätigungen und Update-Meldungen folgen jetzt der gewählten Sprache.
- Die Pult-Meldungen zu Verbindungsproblemen und die Warnung zu Raumschlüsseln sind ebenfalls übersetzt.
- Der Updater zeigt beim Herunterladen einen Fortschrittsbalken und die Zeit der letzten Prüfung.
- Beim ersten Start wird die Sprache angeboten, Englisch ist voreingestellt.
- „Problem melden“ im Programm öffnet die Meldeseite auf der Website in der aktuellen Sprache statt GitHub.

## 1.1.1

<!-- date: 2026-11-24 -->

**EN**
- Fixed missing translations in the Hudini Host window: the moderator code block, the online list, the moderators port, the address hints and the notice about the old links now follow the selected language (English, Ukrainian, German).
- The panel no longer sends cursors to a Host older than 1.1, so a 1.1 panel does not get kicked from a 1.0 Host.
- The streamer's own microphone stays audible on stream while the moderator microphone permission is off.
- A moderator's approval to show the camera, screen or microphone is forgotten when the moderator disconnects: the streamer is asked again.

**RU**
- Исправлены недостающие переводы в окне Hudini Host: блок кода для модератора, список «на связи», порт модераторов, подсказки про адреса и уведомление про старые ссылки теперь следуют выбранному языку (английский, украинский, немецкий).
- Пульт больше не шлёт курсоры на Host старше 1.1, поэтому пульт 1.1 не вылетает с Host 1.0.
- Собственный микрофон стримера слышен на стриме, даже когда разрешение на микрофон модератора выключено.
- Подтверждение камеры, экрана или микрофона модератора забывается при его отключении: стример подтверждает заново.

**UK**
- Виправлено відсутні переклади у вікні Hudini Host: блок коду для модератора, список «на зв’язку», порт модераторів, підказки про адреси та сповіщення про старі посилання тепер відповідають обраній мові (англійська, українська, німецька).
- Пульт більше не надсилає курсори на Host старіший за 1.1, тож пульт 1.1 не вилітає з Host 1.0.
- Власний мікрофон стримера чути на стрімі, навіть коли дозвіл на мікрофон модератора вимкнено.
- Підтвердження камери, екрана чи мікрофона модератора забувається, коли він відключається: стример підтверджує знову.

**DE**
- Fehlende Übersetzungen im Hudini-Host-Fenster behoben: Code-Block für den Moderator, die Online-Liste, der Moderator-Port, die Adress-Hinweise und der Hinweis zu den alten Links folgen jetzt der gewählten Sprache (Englisch, Ukrainisch, Deutsch).
- Das Pult sendet keine Cursor mehr an einen Host älter als 1.1, ein 1.1-Pult fliegt so nicht mehr von einem 1.0-Host.
- Das eigene Mikrofon des Streamers bleibt im Stream hörbar, auch wenn die Mikrofon-Erlaubnis für Moderatoren aus ist.
- Die Freigabe für Kamera, Bildschirm oder Mikrofon eines Moderators wird beim Trennen vergessen: der Streamer wird erneut gefragt.

## 1.1.0

<!-- date: 2026-11-24 -->

**EN**
- Radar for CS2: a compact card in the corner of the screen with small player dots, switches for the card background and the map picture, and redrawn maps.
- Moderators see each other's cursors on the panel canvas.
- Resize from any edge or corner, hold Alt to crop.
- One Animation block per element, with the total duration in seconds.
- A new Giveaways tab: the 3D case now lives there, next to a roulette with weighted prizes.
- Undo and redo work per element and sync between panels.
- Drawing on the canvas.
- Chat: 7TV, BTTV and FFZ emotes.
- Hudini Host: a log of events, an "About" page, per-moderator permissions and a dock for quick controls.
- CS2 add-on: players are numbered 1 to 0 like the observer keys, the fight card follows side swaps and nicknames, the auto tab and the series score.
- Camera, screen and microphone from a moderator or guest: sent directly over WebRTC, with a fallback through Hudini Host. The permissions are off by default and each request is confirmed in the dock.
- Chat roulette: `!крутить` joins or spins, and a points reward can spin it too.
- Grenades on the radar: flying and landed flashbangs, HE, smokes and molotovs, with smoke and fire zones.
- CS2 nick cleanup: Lite/Premium tags are removed from player names, and the word list is configurable.
- CS2 series: a map is counted only on game over; names typed in before a match are no longer wiped.
- One macOS download for both Apple Silicon and Intel: `HudiniHost-mac-<version>.zip`.
- If you run 1.0.0 on a Mac, download 1.1 by hand once (the old updater looks for the old Mac file names) and keep your `data/` folder. After that updates are automatic. Windows and Linux update themselves as before.

**RU**
- Радар для CS2: компактная карточка в углу экрана, мелкие значки игроков, переключатели фона и картинки карты, перерисованные карты.
- Модераторы видят курсоры друг друга на холсте пульта.
- Размер можно менять за любой край или угол, с Alt обрезка.
- Один блок «Анимация» у элемента, общая длительность в секундах.
- Новая вкладка «Розыгрыши»: 3D-кейс теперь там, рядом с рулеткой и призами с весами.
- Отмена и повтор работают по элементам и синхронизируются между пультами.
- Рисование на холсте.
- Чат: смайлы 7TV, BTTV и FFZ.
- Hudini Host: журнал событий, окно «О программе», права для модераторов и док с быстрыми кнопками.
- Для CS2: нумерация игроков 1…0 как клавиши наблюдателя, плашка файта следует за сменой сторон и никами, авто-таб и счёт серии.
- Камера, экран и микрофон от модератора или гостя: напрямую по WebRTC, запасной путь через Hudini Host. Права по умолчанию выключены, каждый запрос подтверждается в доке.
- Рулетка из чата: `!крутить` добавляет или крутит, ещё её можно крутить наградой за баллы.
- Гранаты на радаре: летящие и упавшие флешки, HE, дымы и молотовы, с зонами дыма и огня.
- Чистка ников в CS2: приписки Lite/Premium убираются из имён игроков, список слов настраивается.
- Серия CS2: карта засчитывается только по gameover; имена, вписанные до матча, больше не стираются.
- Одна загрузка для macOS, для Apple Silicon и Intel: `HudiniHost-mac-<версия>.zip`.
- Если на Mac стоит 1.0.0, скачай 1.1 вручную один раз (старый обновлятор ищет старые имена файлов для Mac), папку `data/` сохрани. Дальше обновления автоматические. Windows и Linux обновляются сами, как раньше.

**UK**
- Радар для CS2: компактна картка в куті екрана, дрібні значки гравців, перемикачі фону й картинки мапи, перемальовані мапи.
- Модератори бачать курсори одне одного на полотні пульта.
- Розмір можна змінювати за будь-який край чи кут, з Alt обрізання.
- Один блок «Анімація» в елемента, загальна тривалість у секундах.
- Нова вкладка «Розіграші»: 3D-кейс тепер там, поруч із рулеткою та призами з вагами.
- Скасування й повтор працюють по елементах і синхронізуються між пультами.
- Малювання на полотні.
- Чат: смайли 7TV, BTTV і FFZ.
- Hudini Host: журнал подій, вікно «Про програму», права для модераторів і док зі швидкими кнопками.
- Для CS2: нумерація гравців 1…0 як клавіші спостерігача, плашка файту слідує за зміною сторін і ніками, авто-таб і рахунок серії.
- Камера, екран і мікрофон від модератора чи гостя: напряму через WebRTC, запасний шлях через Hudini Host. Права за замовчуванням вимкнені, кожен запит підтверджується в доці.
- Рулетка з чату: `!крутить` додає або крутить, також її можна крутити нагородою за бали.
- Гранати на радарі: летючі й упавші флешки, HE, дими та молотови, із зонами диму й вогню.
- Чистка ніків у CS2: дописки Lite/Premium прибираються з імен гравців, список слів налаштовується.
- Серія CS2: мапа зараховується лише за gameover; імена, вписані до матчу, більше не стираються.
- Одне завантаження для macOS, для Apple Silicon та Intel: `HudiniHost-mac-<версія>.zip`.
- Якщо на Mac стоїть 1.0.0, завантаж 1.1 вручну один раз (старий оновлювач шукає старі назви файлів для Mac), теку `data/` збережи. Далі оновлення автоматичні. Windows і Linux оновлюються самі, як раніше.

**DE**
- CS2-Radar: kompakte Karte in der Bildecke, kleine Spielerpunkte, Schalter für Kartenhintergrund und Kartenbild, neu gezeichnete Karten.
- Moderatoren sehen gegenseitig ihre Cursor auf der Panel-Fläche.
- Größe an jeder Kante oder Ecke ändern, mit Alt zuschneiden.
- Ein Animationsblock pro Element, Gesamtdauer in Sekunden.
- Neuer Tab "Verlosungen": Der 3D-Koffer wohnt jetzt dort, neben einem Roulette mit gewichteten Preisen.
- Rückgängig und Wiederholen arbeiten pro Element und synchronisieren sich zwischen den Panels.
- Zeichnen auf der Fläche.
- Chat: 7TV-, BTTV- und FFZ-Emotes.
- Hudini Host: Ereignisprotokoll, "Über"-Seite, Rechte für Moderatoren und ein Dock mit Schnellschaltern.
- CS2: Spieler 1 bis 0 wie die Beobachtertasten, die Kampfkarte folgt Seitenwechseln und Nicknames, Auto-Tab und Serienstand.
- Kamera, Bildschirm und Mikrofon von Moderator oder Gast: direkt per WebRTC, Ausweichweg über Hudini Host. Die Rechte sind standardmäßig aus, jede Anfrage wird im Dock bestätigt.
- Chat-Roulette: `!крутить` tritt bei oder dreht, auch eine Punkte-Belohnung kann drehen.
- Granaten auf dem Radar: fliegende und gelandete Flashbangs, HE, Rauch und Molotows, mit Rauch- und Feuerzonen.
- CS2-Nick-Bereinigung: Zusätze wie Lite/Premium werden aus Spielernamen entfernt, die Wortliste ist einstellbar.
- CS2-Serie: Eine Map zählt nur bei Game Over; vor dem Match eingetragene Namen werden nicht mehr gelöscht.
- Ein macOS-Download für Apple Silicon und Intel: `HudiniHost-mac-<Version>.zip`.
- Wer 1.0.0 auf dem Mac nutzt, lädt 1.1 einmal von Hand herunter (der alte Updater sucht die alten Mac-Dateinamen) und behält den Ordner `data/`. Danach laufen Updates automatisch. Windows und Linux aktualisieren sich wie bisher selbst.
