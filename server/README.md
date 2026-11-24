# Hudini Host

**[English](#english)** · **[Русский](#русский)**

---

## English

The server part of the Hudini app (`hudini-server` next to the app). On the streamer's PC it serves the overlay to OBS, stores the moderators' files, receives live CS2 data and accepts moderators on port **7778** (TLS). In the moderator role it opens no ports and only takes care of updates.

### How to use

1. Download the zip for your system from [Releases](https://github.com/niko-ua-designer/hudini/releases/latest), for Windows `HudiniHost-windows-<version>.zip` (Linux: `HudiniHost-linux-<version>.zip`, macOS: `HudiniHost-mac-<version>.zip`, one file for Apple Silicon and Intel).
2. Unzip it and start Hudini from the `HudiniHost` folder (macOS: `Hudini.app`). Choose **Streamer** on the start screen. It's portable: settings, files, certificate and logs live in `data/` next to it. To remove Hudini, delete the folder.
   Windows may show "Windows protected your PC": click **More info → Run anyway** (the app isn't code-signed). Allow Hudini in private networks when the firewall asks.
3. The control page opens in the app window:
   - **First start:** choose how much space the moderators' files get (100 MB per file, 2 GB in total, 300 files by default).
   - **Code for the moderator:** copy the `hudini1:...` code and send it only to your moderator. They paste it in Hudini on the **Moderator** tab.
   - **OBS link:** paste it into an OBS Browser Source (**1920×1080**, then `Ctrl+F`).
   - **CS2 (optional):** click **🎯 Connect CS2** and restart the game.
4. Keep Hudini running while streaming (it can sit in the tray).

### Connecting a moderator

There is no relay server: the moderator connects straight to TCP port 7778 on your PC over a network you share: Radmin VPN, Tailscale, ZeroTier, Porthole (Steam) or port forwarding (enter your public `address:port` on the control page). The connection is TLS; the certificate is checked by the fingerprint inside the code. Guides for each way are on the [site](https://niko-ua-designer.github.io/hudini/).

### Files

Pictures, GIFs, videos and sounds from moderators are stored in `data/files/`, **encrypted with the room key**: the app keeps bytes it can't read, the widget decrypts them and checks the moderator's signature. When the space or file limit is reached, uploads are refused and the panel offers to delete unused files. Limits can be changed on the control page.

### CS2

The app writes `gamestate_integration_streamoverlay.cfg` into the CS2 `cfg` folder. This is Valve's official **Game State Integration**: the game itself sends the data, nothing touches its memory or files. Player card, score, money, weapon and multi-kill popups as a player; team panels and scorebar as a spectator. Game events also drive **CS2 scenarios** in the panel.

### Updates

The app checks GitHub Releases at start and every 3 hours, downloads the zip for your system and installs it only if the **Ed25519 signature** of the release and the file's **SHA-256** match. It never restarts in the middle of a stream: the streamer's app updates on start, when idle (no OBS widget and no moderators) or on **🔄 Update now**; the moderator's app only when you click **Update** on the start screen. Release candidates (`-rc`) are offered only to rc builds.

On macOS, 1.0.0 can't update itself to 1.1 (the app is now one universal `Hudini.app`): download the 1.1 zip once and replace the old app by hand, keeping the `data/` folder.

### Security

See [SECURITY.md](../SECURITY.md). In short: the control page lives only on `127.0.0.1` behind a login cookie; port 7778 needs the random password from the code (repeated wrong passwords pause that address); CS2 data needs a secret token.

### For developers

```sh
cd server && npm ci
bun run server.js          # run from source
sh build.sh                # one-file builds for Windows / Linux / macOS in server/dist (Bun 1.4.4)
```

Releases: [docs/RELEASING.md](../docs/RELEASING.md). Environment variables: `OVERLAY_PORT` (7777), `OVERLAY_MOD_PORT` (port + 1), `OVERLAY_HOST_DIR` (data folder), `OVERLAY_ROLE=mod`, `OVERLAY_NO_UPDATE=1`, `OVERLAY_NO_OPEN=1`, `OVERLAY_SITE=off` (only the embedded widget files). Run on its own, the server prints a login link for the control page.

---

## Русский

Серверная часть программы Hudini (`hudini-server` рядом с программой). На ПК стримера отдаёт оверлей в OBS, хранит файлы модераторов, принимает данные CS2 и пускает модераторов на порт **7778** (TLS). В роли модератора портов не открывает, только следит за обновлениями.

### Как пользоваться

1. Скачай архив для своей системы на странице [Releases](https://github.com/niko-ua-designer/hudini/releases/latest), для Windows это `HudiniHost-windows-<версия>.zip` (Linux: `HudiniHost-linux-<версия>.zip`, macOS: `HudiniHost-mac-<версия>.zip`, один файл для Apple Silicon и Intel).
2. Распакуй и запусти Hudini из папки `HudiniHost` (macOS: `Hudini.app`). На первом экране выбери **Стример**. Программа портативная: настройки, файлы, сертификат и журналы лежат в `data/` рядом с ней. Чтобы удалить Hudini, удали папку.
   Windows может написать «Система Windows защитила ваш компьютер»: нажми **Подробнее → Выполнить в любом случае** (у программы нет платной подписи). Когда брандмауэр спросит, разреши Hudini в частных сетях.
3. В окне программы откроется страница управления:
   - **Первый запуск:** выбери, сколько места дать файлам модераторов (по умолчанию 100 МБ на файл, 2 ГБ всего, 300 файлов).
   - **Код для модератора:** скопируй код `hudini1:...` и отправь только своему модератору. Он вставляет его в Hudini на вкладке **Модератор**.
   - **Ссылка для OBS:** вставь её в источник «Браузер» (**1920×1080**, потом `Ctrl+F`).
   - **CS2 (по желанию):** нажми **🎯 Подключить CS2** и перезапусти игру.
4. Не закрывай Hudini, пока идёт стрим (можно свернуть в трей).

### Как подключается модератор

Чужого сервера посередине нет: модератор подключается прямо к порту TCP 7778 на твоём ПК через общую сеть: Radmin VPN, Tailscale, ZeroTier, Porthole (Steam) или проброс порта (впиши свой внешний `адрес:порт` на странице управления). Связь идёт по TLS, сертификат сверяется по отпечатку из кода. Инструкции для каждого способа есть на [сайте](https://niko-ua-designer.github.io/hudini/).

### Файлы

Картинки, GIF, видео и звуки от модераторов лежат в `data/files/`, **зашифрованными ключом комнаты**: программа хранит байты, которые не может прочитать, а виджет расшифровывает их и проверяет подпись модератора. Когда место или лимит файлов кончились, загрузка не проходит, и пульт предлагает удалить неиспользуемые файлы. Лимиты меняются на странице управления.

### CS2

Программа кладёт файл `gamestate_integration_streamoverlay.cfg` в папку `cfg` игры. Это официальная функция Valve **Game State Integration**: игра сама отправляет данные, в её память и файлы ничего не лезет. Как игрок: карточка игрока, счёт, деньги, оружие, всплывашки мульти-киллов; как зритель: панели команд и счёт-бар. События игры запускают **сценарии CS2** в пульте.

### Обновления

Программа проверяет GitHub Releases при запуске и раз в 3 часа, скачивает архив для твоей системы и ставит его, только если совпали **подпись Ed25519** релиза и **SHA-256** файла. Посреди стрима не перезапускается: у стримера обновление ставится при запуске, в простое (нет виджета OBS и модераторов) или по кнопке **🔄 Обновить сейчас**; у модератора только по кнопке **Обновить** на первом экране. Предварительные версии (`-rc`) приходят только тем, у кого стоит rc.

На macOS версия 1.0.0 не обновится до 1.1 сама (программа теперь одна универсальная `Hudini.app`): один раз скачай архив 1.1 и замени старую программу вручную, папку `data/` оставь.

### Безопасность

Подробно в [SECURITY.md](../SECURITY.md). Коротко: страница управления живёт только на `127.0.0.1` и открывается с cookie входа; порт 7778 пускает по случайному паролю из кода (после нескольких неверных паролей адрес ставится на паузу); данные CS2 принимаются только с секретным токеном.

### Для разработчиков

```sh
cd server && npm ci
bun run server.js          # запуск из исходников
sh build.sh                # сборка одним файлом для Windows / Linux / macOS в server/dist (Bun 1.4.4)
```

Релизы: [docs/RELEASING.md](../docs/RELEASING.md). Переменные окружения: `OVERLAY_PORT` (7777), `OVERLAY_MOD_PORT` (порт + 1), `OVERLAY_HOST_DIR` (папка data), `OVERLAY_ROLE=mod`, `OVERLAY_NO_UPDATE=1`, `OVERLAY_NO_OPEN=1`, `OVERLAY_SITE=off` (только встроенные файлы виджета). Запущенный сам по себе, сервер пишет в консоль ссылку входа на страницу управления.
