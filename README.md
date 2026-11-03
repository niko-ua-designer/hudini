# 🎩 Hudini: an OBS overlay controlled by the moderator

**[English](#english)** · **[Русский](#русский)**

The panel and Hudini Host speak English, Українська, Deutsch and Русский: pick a language on first start or with the 🌐 switch in the header.

A browser-based control panel for a stream moderator and a transparent OBS widget for the streamer. The moderator adds text, images, GIFs, videos, YouTube/Twitch clips, timers, counters, chat polls, CS2 stats and animations, then moves them around in real time. Everything appears on the stream instantly at the same position.

- **Control panel:** https://niko-ua-designer.github.io/overlay/moderator.html
- **Streamer app (optional):** [Hudini Host](host/README.md) · [download](https://github.com/niko-ua-designer/overlay/releases/latest)

---

## English

> The panel's interface is currently in Russian. Button names below are given in English with the original label where it helps, e.g. **📋 Copy** = «📋 Копировать».

### Files

| File | What it is |
|---|---|
| `moderator.html` | the moderator's control panel |
| `widget.html` | the transparent screen the streamer adds to OBS as a Browser Source |
| `core.js`, `core.css` | shared code, keep them next to the HTML files |
| `host/` | **Hudini Host**, an optional app for the streamer's PC (own server + CS2 data) |

Messages travel through a free public MQTT broker (`broker.emqx.io`), so you don't need accounts, API keys or a server. Every message is **encrypted and signed** (see [Security](#security)). The broker keeps the latest state, so the overlay comes back after an OBS restart.

### Quick start

1. Open the [control panel](https://niko-ua-designer.github.io/overlay/moderator.html). The status at the top left should turn green: **online**.
2. In **Room**, pick a streamer or click **＋ New** and type their name.
3. Click **📋 Copy** («Копировать») and send the link to the streamer in a private message.

**What the streamer does in OBS:**
1. **Sources → + → Browser**, paste the link into **URL**. Leave "Local file" unchecked.
2. Set **Width × Height** to the OBS canvas resolution (Settings → Video → Base (Canvas) Resolution), usually 1920×1080.
3. Select the source and press **Ctrl+F** (Transform → Fit to screen). **This is required**, otherwise everything ends up shifted and scaled down.
4. Enable **Control audio via OBS**, disable **Shutdown source when not visible**, and move the source **to the top** of the list.

**Check:** press **📐 Frame** in the panel. A pink frame appears on the streamer's screen for 10 seconds and must follow the edges of the stream exactly.

### Hudini Host (streamer app, recommended)

[Hudini Host](host/README.md) runs a local server on the streamer's PC. OBS gets commands directly from that machine, and moderators connect through a free Cloudflare tunnel; the panel finds it automatically. It also feeds **live CS2 data** to the overlay.

1. Moderator: **📋 Copy** → send the link.
2. Streamer: download the app, paste the link into it, copy its **OBS link** and paste that into the Browser Source.
3. Moderator: just open the panel. The status shows **online · streamer's server**.

If the app or the tunnel is down, the panel automatically falls back to the public broker.

On the public broker, uploaded files are limited: images up to 2 MB, GIF/video/audio up to 6 MB, 25 MB per room. When a limit is hit, the panel suggests switching to Hudini Host, which has no such limits.

**Updates are automatic:** the app updates itself (checksum-verified, never mid-stream), the OBS widget reloads itself when a newer panel connects, and the panel shows **🆕 Update panel** when a new version is published.

### What you can show

- **Text**: font, color, outline, background plate.
- **Images, GIFs, videos**: by link or **from your computer** (button, drag & drop onto the canvas, Ctrl+V). Animated GIF/WebP/APNG keep their animation. **Stretch** freely with the side handles or Shift+corner.
- **YouTube & Twitch**: paste a normal link (videos, Shorts, clips, VODs, channels), with optional sound.
- **Websites**: any page with a page-zoom slider. Some sites (Google, X, VK…) forbid embedding.
- **Webcam**: via VDO.Ninja, round/rounded/rectangular with a border.
- **Timers**: countdown, stopwatch, countdown to a date, clock. Styles: **flip cards**, neon, plain. On finish they can show your own text, blink, and play a sound or confetti.
- **Counters**: manual (+/−), **Twitch chat words** (e.g. `F`, `*` = any message, optional once per viewer), automatic every N seconds, goal with a progress bar.
- **📊 Chat polls**: viewers type `1`, `2`… One vote per viewer, live bars, winner highlight.
- **💬 Chat messages on screen**: the **Chat** tab shows the live Twitch chat with emotes and badges. Click a message and it pops up on stream with the viewer's name and color. New messages reuse the position and style of the previous one.
- **🎯 CS2** (needs Hudini Host): player card, K/D/A, HP/armor, score, money, weapon, auto **DOUBLE / TRIPLE / QUAD / ACE** popup (threshold of your choice, **▶ Example** button to position it).
- **👁 CS2 observer mode** (GOTV / spectator / caster): tournament-style **team panels**, **scorebar** with round timer & bomb, **observed player** card. CS2 sends data about all players only to spectators, never to a player in their own match.
- **Full-screen effects**: sound (link or file), confetti, screen shake.

### ⚡ Scenarios ("if … then …")

The **Scenarios** tab lets you automate the overlay:
- **Triggers:** a chat command (`!cringe`, for everyone / subs / mods, with a cooldown), a CS2 event (kill, multi-kill from N, ACE, death, MVP, round won/lost, bomb planted/defused/exploded), a timer finishing, a counter reaching its goal, or manual only.
- **Actions** (run in order): show an element for N seconds, show/hide/toggle, play its animation, sound, confetti, shake, switch scene, change a counter, replace text (`{user}`, `{args}`, `{name}`, `{n}`), show the chat message, restart a timer, wait.

Example: `!cringe` → show a meme for 5 s + sound; ACE → confetti + shake. Scenarios run while the panel is open; if two moderators have it open, enable them in only one panel.

### Editor

- **Multi-select:** Shift/Ctrl+click or drag a selection box over empty space; Ctrl+A selects everything. Moving, arrow keys, hiding, duplicating and deleting work on the whole selection.
- **Groups** (Ctrl+G / Ctrl+Shift+G): grouped elements are selected and moved together.
- **Align & distribute** from the toolbar above the canvas (a single element aligns to the screen).
- **Grid** with snapping (2.5 % … 25 %).

### Animations, scenes, library

- **🎬 Motion**: 12 presets (fly-by, credits, drop with bounce, zoom punch, orbit, DVD logo…) or your own **keyframes** with easing and scale. Modes: loop, once (stay / hide / return), ping-pong. Trigger with ▶, **P**, or ⚡. Save your own animations and apply them to any element.
- **🎞 Scenes**: save the whole screen ("Start", "Break", "Results") and switch in one click.
- **📚 Library**: save finished elements (with their animation and file) and add them to any room in one click.

### Controls

| Action | How |
|---|---|
| Select several | Shift/Ctrl+click, selection box, Ctrl+A |
| Group / ungroup | Ctrl+G / Ctrl+Shift+G |
| Move | drag (stays inside the frame; hold Ctrl while dragging to go past the edge) |
| Resize | corner handle, mouse wheel or slider |
| Stretch image/video | side handles or Shift+corner |
| Rotate | handle above the element, Alt+drag, Shift+wheel; Shift snaps to 15° |
| Show / hide | H, 👁 |
| Show for N seconds | F, ⚡, or **1…9** for the layer with that number |
| Timer start / pause | Space |
| Counter | + / − |
| Play / stop animation | P |
| Duplicate / delete | Ctrl+D / Delete |
| Undo | Ctrl+Z (works after "Clear all" too) |

**🙈 Hide all** instantly removes the whole overlay from the stream without deleting anything.

### Security

- Each room has an encryption key, a public signing key (both are in the OBS link after `#`, which is never sent to GitHub or the broker) and a **private signing key that only exists in the moderators' panels**.
- The widget executes **only signed commands**. Forged messages, garbage, attempts to wipe the screen and replays of intercepted messages are dropped.
- A leaked OBS link only allows viewing, not control. **♻ Change keys** issues a new link anyway.
- **👥 Invite** creates a link for a second moderator (full control, so share it privately).
- **🔓 Password** encrypts the room keys stored in the browser. **Backups** are always password-protected.
- mqtt.js is pinned to 5.16.1 and verified with SRI. Text is rendered as text; third-party sites run in a sandbox.

### Troubleshooting

| Problem | Fix |
|---|---|
| Streamer sees "Old or truncated link" | send a new link: **📋 Copy** |
| New features don't show up on stream | OBS cached an old widget: send a new link or "Refresh cache of current page" in the source properties (the widget auto-updates since v3) |
| Panel shows **OBS: not seen** | the widget isn't connected to this room: wrong link, source hidden, or not in the current scene |
| Everything on stream is shifted or smaller | select the source → **Ctrl+F**, check with **📐 Frame** |
| No sound | OBS: "Control audio via OBS" and the source volume in the mixer |
| Broker is slow | change `BROKER_URL` in `moderator.html` and `widget.html` to `wss://broker.hivemq.com:8884/mqtt`, or use Hudini Host |

---

## Русский

### Файлы

| Файл | Что это |
|---|---|
| `moderator.html` | пульт модератора |
| `widget.html` | прозрачный экран, который стример добавляет в OBS как источник «Браузер» |
| `core.js`, `core.css` | общий код, держи рядом с HTML-файлами |
| `host/` | **Hudini Host**, программа для ПК стримера (свой сервер и данные из CS2), по желанию |

Связь идёт через бесплатный публичный MQTT-брокер (`broker.emqx.io`): регистрация, ключи API и свой сервер не нужны. Все сообщения **шифруются и подписываются** (см. «Безопасность»). Брокер хранит последнее состояние, поэтому после перезапуска OBS всё появляется снова.

### Быстрый старт

1. Открой [пульт](https://niko-ua-designer.github.io/overlay/moderator.html). Слева сверху должно загореться зелёное **«онлайн»**.
2. В блоке **«Комната»** выбери стримера или нажми **＋ Новая** и впиши его ник.
3. Нажми **📋 Копировать** и отправь ссылку стримеру в личку.

**Что делает стример в OBS:**
1. **Источники → + → Браузер**, ссылку вставить в **URL**. Галочку «Локальный файл» не ставить.
2. **Ширина × высота** = разрешение холста OBS (Настройки → Видео → «Базовое (холст) разрешение»), обычно 1920×1080.
3. Выделить источник и нажать **Ctrl+F** («Растянуть по размеру экрана»). **Это обязательно**, иначе всё будет сдвинуто и уменьшено.
4. Включить **«Управлять аудио через OBS»**, выключить **«Выключать источник, когда он не виден»**, источник поставить **наверх списка**.

**Проверка:** нажми в пульте **📐 Рамка**. У стримера на 10 секунд появится розовая рамка, и она должна идти ровно по краям экрана.

### Hudini Host (программа стримера, лучше с ней)

[Hudini Host](host/README.md) поднимает сервер на ПК стримера. OBS получает команды прямо с этого компьютера, а модераторы подключаются через бесплатный туннель Cloudflare, его адрес пульт находит сам. Ещё программа передаёт на оверлей **живые данные из CS2**.

1. Модератор: **📋 Копировать** → отправляет ссылку.
2. Стример: скачивает программу, вставляет в неё ссылку, копирует **«Ссылку для OBS»** и вставляет её в источник «Браузер».
3. Модератор: просто открывает пульт. Вверху будет **«онлайн · сервер стримера»**.

Если программа или туннель не работают, пульт сам переключается на общий сервер.

На общем сервере файлы ограничены: картинка до 2 МБ, GIF, видео и звук до 6 МБ, всего в комнате до 25 МБ. Когда лимит достигнут, пульт предлагает перейти на Hudini Host: там этих лимитов нет.

**Обновления приходят сами:** программа обновляет себя (с проверкой контрольной суммы и никогда посреди стрима), виджет в OBS перезагружается, когда подключается более новый пульт, а пульт показывает кнопку **«🆕 Обновить пульт»**, когда выходит новая версия.

### Что можно выводить

- **Текст**: шрифт, цвет, обводка, плашка.
- **Картинки, GIF, видео**: по ссылке или **с компьютера** (кнопка, перетаскивание на холст, Ctrl+V). Анимированные GIF, WebP и APNG сохраняют анимацию. **Растягивать** можно боковыми ручками или Shift+уголком.
- **YouTube и Twitch**: обычная ссылка (видео, Shorts, клипы, записи, каналы), звук по галочке.
- **Сайты**: любая страница с ползунком масштаба. Некоторые сайты (Google, X, VK…) запрещают встраивание.
- **Вебка** через VDO.Ninja: круг, скругление или прямоугольник, с рамкой.
- **Таймеры**: обратный отсчёт, секундомер, отсчёт до даты, часы. Стили: **флип-карточки**, неон, простой текст. По окончании можно показать свой текст, мигать, включить звук и конфетти.
- **Счётчики**: ручной (+/−), **по словам в чате Twitch** (например `F`, `*` = любое сообщение, можно «один раз на зрителя»), сам каждые N секунд, цель с полосой.
- **📊 Голосование в чате**: зрители пишут `1`, `2`… Один голос на зрителя, полосы обновляются вживую, победитель подсвечивается.
- **💬 Сообщения из чата на экране**: во вкладке **«Чат»** идёт живой чат Twitch с эмоутами и значками. Кликни по сообщению, и оно всплывёт на стриме с ником и цветом зрителя. Новые сообщения появляются на месте прошлого и в том же виде.
- **🎯 CS2** (нужен Hudini Host): карточка игрока, K/D/A, HP и броня, счёт, деньги, оружие, всплывашка **DOUBLE / TRIPLE / QUAD / ACE** (порог на выбор, кнопка **▶ Пример**, чтобы поставить её на место).
- **👁 Режим наблюдателя CS2** (GOTV, зритель, кастер): **панели команд** как на турнирах, **счёт-бар** с таймером раунда и бомбой, карточка того, **за кем смотрят**. Данные по всем игрокам CS2 отдаёт только зрителям, в своём матче их нет.
- **Эффекты на весь экран**: звук (ссылка или файл), конфетти, тряска экрана.

### ⚡ Сценарии («если… то…»)

Во вкладке **«Сценарии»** оверлей можно автоматизировать:
- **Если:** команда в чате (`!кринж`, для всех, сабов или модеров, с перезарядкой), событие CS2 (килл, мульти-килл от N, ACE, смерть, MVP, раунд выигран или проигран, бомба заложена, разминирована или взорвалась), таймер закончился, счётчик дошёл до цели, только вручную.
- **То** (по порядку): показать элемент на N сек, показать, скрыть или переключить, проиграть анимацию, звук, конфетти, тряска, включить сцену, изменить счётчик, поменять текст (`{user}`, `{args}`, `{name}`, `{n}`), показать это сообщение из чата, перезапустить таймер, подождать.

Пример: `!кринж` → мем на 5 сек + звук; ACE → конфетти + тряска. Сценарии работают, пока пульт открыт. Если пульт открыт у двух модераторов, включи их только у одного.

### Редактор

- **Несколько элементов сразу:** Shift/Ctrl+клик или рамка по пустому месту, Ctrl+A выделяет всё. Двигать, стрелки, скрыть, копировать и удалить работают для всего выделения.
- **Группы** (Ctrl+G / Ctrl+Shift+G): элементы группы выделяются и двигаются вместе.
- **Выравнивание и распределение** на панели над холстом (один элемент выравнивается по экрану).
- **Сетка** с примагничиванием (2.5 % … 25 %).

### Анимации, сцены, библиотека

- **🎬 Движение**: 12 готовых анимаций (пролёт, титры, падение с отскоком, зум-удар, орбита, DVD-заставка…) или свои **ключевые кадры** с плавностью и масштабом. Режимы: по кругу, один раз (остаться, исчезнуть или вернуться), туда-обратно. Запуск: ▶, **P** или ⚡. Свои анимации сохраняются и подходят к любому элементу.
- **🎞 Сцены**: весь экран сохраняется целиком («Начало», «Перерыв», «Итоги») и включается одним кликом.
- **📚 Библиотека**: готовые элементы вместе с анимацией и файлом добавляются в любую комнату одним кликом.

### Управление

| Действие | Как |
|---|---|
| Выделить несколько | Shift/Ctrl+клик, рамка, Ctrl+A |
| Сгруппировать / разгруппировать | Ctrl+G / Ctrl+Shift+G |
| Двигать | тащить мышкой (за край кадра не вылезает; с зажатым Ctrl во время перетаскивания можно) |
| Размер | уголок, колёсико или ползунок |
| Растянуть картинку или видео | боковые ручки или Shift+уголок |
| Поворот | кружок над элементом, Alt+тащить, Shift+колёсико; Shift = шаг 15° |
| Скрыть / показать | H, 👁 |
| Показать на N сек | F, ⚡ или **1…9** для слоя с этим номером |
| Таймер старт / пауза | Пробел |
| Счётчик | + / − |
| Анимация: проиграть / стоп | P |
| Копия / удалить | Ctrl+D / Delete |
| Отменить | Ctrl+Z (работает и после «Очистить всё») |

**🙈 Скрыть всё** мгновенно убирает весь оверлей со стрима, ничего не удаляя.

### Безопасность

- У каждой комнаты есть ключ шифрования и открытый ключ подписи. Оба стоят в ссылке для OBS после `#`, а эта часть не уходит ни на GitHub, ни на брокер. Третий ключ, **закрытый ключ подписи, есть только в пультах модераторов**.
- Виджет выполняет **только подписанные команды**. Подделки, мусор, попытки стереть экран и повтор перехваченных сообщений отбрасываются.
- Утёкшая ссылка для OBS даёт только просмотр, не управление. Кнопка **♻ Сменить ключи** всё равно выдаёт новую ссылку.
- **👥 Пригласить** создаёт ссылку для второго модератора. Она даёт полное управление, поэтому отправляй её только в личку.
- **🔓 Пароль** шифрует ключи комнат в браузере. **Бэкап** всегда сохраняется под паролем.
- mqtt.js закреплён на версии 5.16.1 и проверяется по хешу (SRI). Текст выводится как текст, сторонние сайты работают в «песочнице».

### Если что-то не работает

| Проблема | Решение |
|---|---|
| У стримера «Старая или обрезанная ссылка» | отправить новую ссылку: **📋 Копировать** |
| Новые функции не видны на стриме | OBS держит старый виджет в кэше: дать новую ссылку или «Обновить кэш текущей страницы» в свойствах источника (с v3 виджет обновляется сам) |
| В пульте **OBS: не видно** | виджет не подключён к этой комнате: не та ссылка, источник выключен или не в текущей сцене |
| На стриме всё сдвинуто или мельче | выделить источник → **Ctrl+F**, проверить кнопкой **📐 Рамка** |
| Нет звука | OBS: «Управлять аудио через OBS» и громкость источника в микшере |
| Брокер тормозит | поменять `BROKER_URL` в `moderator.html` и `widget.html` на `wss://broker.hivemq.com:8884/mqtt` или поставить Hudini Host |
