# Hudini Host

**[English](#english)** · **[Русский](#русский)**

---

## English

The app for the streamer's PC. Since Hudini 1.0 it is required: it serves the overlay to OBS, stores the moderators' files, receives live CS2 data and lets moderators connect through a tunnel.

### How to use

1. Download the app from [Releases](https://github.com/niko-ua-designer/overlay/releases/latest). For Windows that's `HudiniHost-windows.exe.zip`.
2. Unzip it **into its own folder** (settings and files are saved there) and run it.
   Windows may show "Windows protected your PC": click **More info → Run anyway** (the app isn't code-signed). If Windows asks about network access, allow private networks.
3. The control page `http://localhost:7777` opens:
   - **First start:** choose how much space the moderators' files get (100 MB per file, 2 GB in total, 300 files by default).
   - **Step 1:** paste the link from your moderator (panel button **📋 Copy**). One time only.
   - **Step 2:** copy the **OBS link** and paste it into the URL of an OBS Browser Source (**1920×1080**, then `Ctrl+F`).
   - **Step 3 (CS2, optional):** click **🎯 Connect CS2** and restart the game.
4. Keep the app window open while streaming.

The panel finds the app by itself and shows **online · Hudini Host**.

### Files

Pictures, GIFs, videos and sounds uploaded by moderators are stored in `files/` next to the app, **encrypted with the room key**: the app keeps bytes it can't read, the widget decrypts them and checks the moderator's signature. When the space or file limit is reached, uploads are refused; the panel offers to delete files nobody uses. The app never deletes files by itself. Limits can be changed on the control page at any time.

### CS2

The app writes `gamestate_integration_streamoverlay.cfg` into the CS2 `cfg` folder. This is Valve's official **Game State Integration**: the game itself sends the data. Nothing touches the game's memory or files.

- **As a player:** player card, K/D/A, HP/armor, score, money, weapon, DOUBLE / TRIPLE / QUAD / ACE popup.
- **As a spectator (α):** team panels, scorebar with round timer and bomb status, observed player.

Game events (kill, multi-kill, ACE, death, MVP, round end, bomb) also drive **CS2 scenarios** in the panel.

### Advanced

Under **⚙ Advanced** on the control page:

- **Own address** instead of the free Cloudflare tunnel (Tailscale Funnel, your own Cloudflare tunnel, your own domain). Point it at `http://127.0.0.1:7778` and enter `wss://your-address/mqtt`.
- **Address and password for the panel**, if a moderator has to enter them by hand.
- **New moderator password.** To revoke someone for good, the moderator presses **♻ Change keys** in the panel and you paste the new link into step 1: the app changes the password and disconnects everyone with the old keys.

### Auto-updates

The app checks GitHub Releases at start and every 3 hours, downloads the build for your system and **verifies its SHA-256 checksum**. It never restarts in the middle of a stream: updates apply on start, when idle (no OBS widget and no moderators for a while), or when you click **🔄 Update now**. Release candidates (`-rc`) are offered only to rc builds.

### Security

- The control page and the OBS port are reachable only from this computer; requests from other websites and DNS rebinding are rejected.
- Moderators coming through the tunnel need a random password, which the panel receives encrypted. Five wrong passwords from one address cause a pause that grows each time.
- The public server only carries the encrypted address announcement.
- CS2 data is accepted only with a secret token.

### For developers

```sh
cd host && npm ci
bun run server.js          # run from source
sh build.sh                # build Windows / Linux / macOS binaries into host/dist
```

A release is built when a tag `vX.Y.Z` (or `vX.Y.Z-rc.N`) matching `const VERSION` is pushed.

Environment variables: `OVERLAY_PORT` (7777; the tunnel port is +1), `OVERLAY_NO_UPDATE=1`, `OVERLAY_NO_TUNNEL=1`, `OVERLAY_TUNNEL_URL=wss://your.domain/mqtt`, `OVERLAY_HOST_DIR` (settings folder), `OVERLAY_PUBLIC_BROKER`, `OVERLAY_SITE=off` (use only the embedded widget files).

---

## Русский

Программа для ПК стримера. С версии Hudini 1.0 она обязательна: отдаёт оверлей в OBS, хранит файлы модераторов, принимает данные CS2 и пускает модераторов через туннель.

### Как пользоваться

1. Скачай программу на странице [Releases](https://github.com/niko-ua-designer/overlay/releases/latest): для Windows это `HudiniHost-windows.exe.zip`.
2. Распакуй **в отдельную папку** (там хранятся настройки и файлы) и запусти.
   Windows может написать «Система Windows защитила ваш компьютер»: нажми **Подробнее → Выполнить в любом случае** (у программы нет платной подписи). Если Windows спросит про доступ к сети, разреши для частных сетей.
3. Откроется страница управления `http://localhost:7777`:
   - **Первый запуск:** выбери, сколько места дать файлам модераторов (по умолчанию 100 МБ на файл, 2 ГБ всего, 300 файлов).
   - **Шаг 1:** вставь ссылку от модератора (кнопка в пульте **📋 Копировать**). Один раз.
   - **Шаг 2:** скопируй **ссылку для OBS** и вставь в URL источника «Браузер» (**1920×1080**, потом `Ctrl+F`).
   - **Шаг 3 (CS2, по желанию):** нажми **🎯 Подключить CS2** и перезапусти игру.
4. Не закрывай окно программы, пока идёт стрим.

Пульт находит программу сам и пишет **онлайн · Hudini Host**.

### Файлы

Картинки, GIF, видео и звуки от модераторов лежат в папке `files/` рядом с программой, **зашифрованными ключом комнаты**: программа хранит байты, которые не может прочитать, а виджет расшифровывает их и проверяет подпись модератора. Когда место или лимит файлов кончились, загрузка не проходит, и пульт предлагает удалить неиспользуемые файлы. Сама программа ничего не удаляет. Лимиты можно поменять на странице управления в любой момент.

### CS2

Программа кладёт файл `gamestate_integration_streamoverlay.cfg` в папку `cfg` игры. Это официальная функция Valve **Game State Integration**: игра сама отправляет данные. В память и файлы игры ничего не лезет.

- **Как игрок:** карточка игрока, K/D/A, HP и броня, счёт, деньги, оружие, всплывашка DOUBLE / TRIPLE / QUAD / ACE.
- **Как зритель (α):** панели команд, счёт-бар с таймером раунда и бомбой, наблюдаемый игрок.

События игры (килл, мульти-килл, ACE, смерть, MVP, конец раунда, бомба) запускают **сценарии CS2** в пульте.

### Для продвинутых

В разделе **⚙ Для продвинутых** на странице управления:

- **Свой адрес** вместо бесплатного туннеля Cloudflare (Tailscale Funnel, свой туннель Cloudflare, свой домен). Направь его на `http://127.0.0.1:7778` и впиши `wss://твой-адрес/mqtt`.
- **Адрес и пароль для пульта**, если модератору нужно ввести их вручную.
- **Новый пароль модераторов.** Чтобы закрыть доступ человеку насовсем, модератор нажимает в пульте **♻ Сменить ключи**, а ты вставляешь новую ссылку в шаг 1: программа меняет пароль и отключает всех со старыми ключами.

### Автообновление

Программа проверяет GitHub Releases при запуске и раз в 3 часа, скачивает сборку для твоей системы и **сверяет контрольную сумму SHA-256**. Посреди стрима не перезапускается: обновление ставится при запуске, в простое (нет виджета OBS и модераторов) или по кнопке **🔄 Обновить сейчас**. Предварительные версии (`-rc`) приходят только тем, у кого стоит rc.

### Безопасность

- Страница управления и порт для OBS доступны только с этого компьютера; запросы с чужих сайтов и DNS-rebinding отклоняются.
- Модераторы через туннель входят по случайному паролю, пульт получает его зашифрованным. После 5 неверных паролей с одного адреса вход ставится на паузу, и с каждым разом она дольше.
- Через общий сервер идёт только зашифрованное объявление адреса.
- Данные CS2 принимаются только с секретным токеном.

### Для разработчиков

```sh
cd host && npm ci
bun run server.js          # запуск из исходников
sh build.sh                # сборка для Windows / Linux / macOS в host/dist
```

Релиз собирается, когда пушится тег `vX.Y.Z` (или `vX.Y.Z-rc.N`), совпадающий с `const VERSION`.

Переменные окружения: `OVERLAY_PORT` (7777; порт туннеля на 1 больше), `OVERLAY_NO_UPDATE=1`, `OVERLAY_NO_TUNNEL=1`, `OVERLAY_TUNNEL_URL=wss://твой.домен/mqtt`, `OVERLAY_HOST_DIR` (папка настроек), `OVERLAY_PUBLIC_BROKER`, `OVERLAY_SITE=off` (только встроенные файлы виджета).
