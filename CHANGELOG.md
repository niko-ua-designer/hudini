# Changelog

The release workflow copies the section for the tag version (the heading must be exactly `## <version>`) into the release notes.

## 1.1.3

**EN**
- Safer permissions: when the streamer switches off "games", a roulette already on screen is hidden and silent, and a moderator can no longer force the CS2 tab on stream.
- "Pause moderators" also stops moderators from uploading and deleting files; a moderator can no longer take over the connection of another client with the same id.
- The OBS dock cannot be embedded into another page, and the report page removes OBS links and invitations with keys from what you paste.
- Home folder names no longer appear in the log and crash report.
- More translations, the Ukrainian text uses "стрімер" everywhere, role names match the real tabs (Streamer, Moderator, Add), and the help gets the missing nick cleanup entry in English, Ukrainian and German.
- The site: the connection guides (Radmin VPN, Tailscale, ZeroTier, Porthole) moved into the download window with links to download each tool, smooth page transitions, and the project README in four languages.
- Calmer look of the panel, the Host window and the dock: visible keyboard focus, clearer buttons and fields, better contrast, larger touch targets.

**RU**
- Права безопаснее: когда стример выключает «игры», уже стоящая рулетка прячется и молчит, а модератор больше не может принудительно показать CS2-таб на стриме.
- «Пауза модераторов» запрещает модераторам и загрузку, и удаление файлов; модератор больше не может занять соединение другого клиента с тем же id.
- OBS-док нельзя встроить в чужую страницу, а страница отчёта убирает из вставленного текста ссылки OBS и приглашения с ключами.
- Имя папки пользователя больше не попадает в журнал и отчёт о сбое.
- Больше переводов, в украинских текстах везде «стрімер», названия ролей совпадают с настоящими вкладками (Стример, Модератор, Добавить), в справке на английском, украинском и немецком появился пункт про чистку ников.
- Сайт: гайды подключения (Radmin VPN, Tailscale, ZeroTier, Porthole) переехали в окно скачивания со ссылками на скачивание каждого инструмента, плавные переходы между страницами, README проекта на четырёх языках.
- Спокойнее внешний вид пульта, окна Host и дока: видимый фокус с клавиатуры, понятнее кнопки и поля, лучше контраст, крупнее цели нажатия.

**UK**
- Безпечніші права: коли стрімер вимикає «ігри», рулетка, що вже стоїть, ховається й мовчить, а модератор більше не може примусово показати CS2-таб на стрімі.
- «Пауза модераторів» забороняє модераторам і завантаження, і видалення файлів; модератор більше не може зайняти з’єднання іншого клієнта з тим самим id.
- OBS-док не можна вбудувати в чужу сторінку, а сторінка звіту прибирає зі вставленого тексту посилання OBS і запрошення з ключами.
- Ім’я домашньої теки більше не потрапляє в журнал і звіт про збій.
- Більше перекладів, в українських текстах скрізь «стрімер», назви ролей збігаються зі справжніми вкладками (Стрімер, Модератор, Додати), у довідці англійською, українською та німецькою з’явився пункт про чистку ніків.
- Сайт: гайди підключення (Radmin VPN, Tailscale, ZeroTier, Porthole) переїхали у вікно завантаження з посиланнями на завантаження кожного інструмента, плавні переходи між сторінками, README проєкту чотирма мовами.
- Спокійніший вигляд пульта, вікна Host і дока: видимий фокус із клавіатури, зрозуміліші кнопки й поля, кращий контраст, більші цілі натискання.

**DE**
- Sicherere Rechte: Wenn der Streamer „Spiele“ ausschaltet, wird eine bereits sichtbare Roulette ausgeblendet und stumm, und ein Mod kann den CS2-Tab nicht mehr erzwingen.
- „Mods pausieren“ stoppt auch das Hochladen und Löschen von Dateien; ein Mod kann die Verbindung eines anderen Clients mit derselben ID nicht mehr übernehmen.
- Das OBS-Dock lässt sich nicht in andere Seiten einbetten, und die Meldeseite entfernt OBS-Links und Einladungen mit Schlüsseln aus eingefügtem Text.
- Der Name des Benutzerordners erscheint nicht mehr im Protokoll und im Absturzbericht.
- Mehr Übersetzungen, im Ukrainischen überall „стрімер“, Rollennamen passen zu den echten Tabs (Streamer, Moderator, Hinzufügen), und die Hilfe hat den fehlenden Eintrag zur Nick-Bereinigung auf Englisch, Ukrainisch und Deutsch.
- Die Website: Die Verbindungsanleitungen (Radmin VPN, Tailscale, ZeroTier, Porthole) sind ins Download-Fenster gezogen, mit Links zum Download jedes Tools, sanfte Seitenübergänge und die Projekt-README in vier Sprachen.
- Ruhigeres Aussehen von Pult, Host-Fenster und Dock: sichtbarer Tastaturfokus, klarere Knöpfe und Felder, besserer Kontrast, größere Tippziele.

## 1.1.2

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
