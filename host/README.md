# Hudini Host

**[English](#english)** · **[Русский](#русский)**

---

## English

An app for the streamer's PC: a local overlay server plus live CS2 data.

**Why:** OBS receives commands directly from the same computer (no extra latency, no dependence on the public broker). Moderators connect through a free Cloudflare tunnel with a password, and the panel finds the address automatically. If the tunnel is down, everything keeps working through the public broker.

### How to use

1. Download the app from [Releases](https://github.com/niko-ua-designer/overlay/releases/latest). For Windows that's `OverlayHost-windows.exe.zip`.
2. Unzip it **into its own folder** (settings are saved there) and run it.
   Windows may show "Windows protected your PC": click **More info → Run anyway** (the app isn't code-signed).
3. The control page `http://localhost:7777` opens:
   - **Step 1:** paste the link from your moderator (panel button **📋 Copy**). This is a one-time step.
   - **Step 2:** copy the **OBS link** and paste it into the URL of an OBS Browser Source (1920×1080, then Ctrl+F).
   - **Step 3 (CS2):** click **🎯 Connect CS2** and restart the game.
4. Keep the black app window open while streaming. Closing it removes the overlay from the stream.

The moderator doesn't need to change anything: they just open the panel on GitHub Pages and it shows **online · streamer's server**.

### CS2

The app writes `gamestate_integration_streamoverlay.cfg` into the CS2 `cfg` folder. This is Valve's official **Game State Integration**: the game itself sends the data. Nothing touches the game's memory or files, and the same feature powers keyboard lighting (SteelSeries, Logitech, Razer) and tournament HUDs.

- **As a player:** player card, K/D/A, HP/armor, score, money, weapon, and an auto DOUBLE / TRIPLE / QUAD / ACE popup.
- **As a spectator** (GOTV, server observer, casting): panels for both teams with every player, a scorebar with the round timer and bomb status, and the observed player card. CS2 sends data about all players only to spectators.

The app also detects **game events** (kill, multi-kill, ACE, death, MVP, round end, bomb planted/defused/exploded) and sends them to the overlay. They power the multi-kill popup (for any player in spectator mode) and **CS2 scenarios** in the panel.

If you already clicked "Connect CS2" in an older version, the app updates the file itself, so just restart CS2.

### Auto-updates

The app checks GitHub Releases at start and every 3 hours, downloads the new version for your system and **verifies its SHA-256 checksum**. It never restarts in the middle of a stream: the update is applied on start (before OBS connects), when idle (no OBS widget and no moderators for a while), or when you click **🔄 Update now** on the control page. You can turn auto-updates off there too. The OBS widget updates itself as well.

### Security

- The control page and the OBS port are only reachable from this computer. The page also rejects requests from other websites and DNS rebinding.
- Moderators coming through the tunnel log in with a random password, which the panel receives encrypted.
- Commands for the screen can't be forged: they're signed with the moderator's key.
- CS2 data is accepted only with a secret token.

### For developers

```sh
cd host && npm install
bun run server.js          # run from source
sh build.sh                # build Windows / Linux / macOS binaries into host/dist
```

GitHub Actions builds the binaries and publishes a release on every push that touches `host/` or the widget.

Environment variables: `OVERLAY_NO_UPDATE=1` (disable auto-update), `OVERLAY_PORT` (7777), `OVERLAY_NO_TUNNEL=1`, `OVERLAY_TUNNEL_URL=wss://your.domain/mqtt` (your own address instead of Cloudflare), `OVERLAY_HOST_DIR` (settings folder), `OVERLAY_PUBLIC_BROKER`.

---

## Русский

Программа для ПК стримера: свой сервер оверлея и живые данные из CS2.

**Зачем:** OBS получает команды прямо с этого же компьютера, без задержек и без зависимости от общего сервера. Модераторы подключаются через бесплатный туннель Cloudflare с паролем, адрес пульт находит сам. Если туннель не поднялся, всё работает через общий сервер.

### Как пользоваться

1. Скачай программу на странице [Releases](https://github.com/niko-ua-designer/overlay/releases/latest): для Windows это `OverlayHost-windows.exe.zip`.
2. Распакуй её **в отдельную папку** (туда же она сохранит настройки) и запусти.
   Windows может показать «Система Windows защитила ваш компьютер»: нажми **«Подробнее» → «Выполнить в любом случае»** (у программы нет платной подписи).
3. Откроется страница управления `http://localhost:7777`:
   - **Шаг 1:** вставь ссылку от модератора (в пульте кнопка **📋 Копировать**). Это делается один раз.
   - **Шаг 2:** скопируй **«Ссылку для OBS»** и вставь её в URL источника «Браузер» в OBS (1920×1080, затем Ctrl+F).
   - **Шаг 3 (CS2):** нажми **«🎯 Подключить CS2»** и перезапусти игру.
4. Чёрное окно программы держи открытым, пока идёт стрим. Закроешь его — оверлей пропадёт со стрима.

Модератору ничего менять не нужно: он просто открывает пульт на GitHub Pages, и там появляется **«онлайн · сервер стримера»**.

### CS2

Программа кладёт в папку `cfg` игры файл `gamestate_integration_streamoverlay.cfg`. Это официальная функция Valve **Game State Integration**: игра сама присылает данные. Программа не трогает ни память, ни файлы игры. Так же работают подсветка клавиатур (SteelSeries, Logitech, Razer) и турнирные HUD-ы.

- **Когда играешь:** карточка игрока, K/D/A, HP и броня, счёт, деньги, оружие, всплывашка DOUBLE / TRIPLE / QUAD / ACE.
- **Когда смотришь матч зрителем** (GOTV, наблюдатель на сервере, кастинг): панели обеих команд со всеми игроками, счёт-бар с таймером раунда и бомбой, карточка того, за кем смотрят. Данные по всем игрокам CS2 отдаёт только зрителям.

Ещё программа замечает **события игры** (килл, мульти-килл, ACE, смерть, MVP, конец раунда, бомба заложена, разминирована или взорвалась) и передаёт их оверлею. На них работают всплывашка мульти-киллов (в режиме наблюдателя для любого игрока) и **сценарии CS2** в пульте.

Если «Подключить CS2» уже нажимали в старой версии, программа сама обновит файл, достаточно перезапустить CS2.

### Автообновление

Программа проверяет GitHub Releases при запуске и раз в 3 часа, скачивает новую версию для твоей системы и **сверяет её контрольную сумму SHA-256**. Посреди стрима она не перезапускается: обновление ставится при запуске (пока OBS не подключился), в простое (ни виджета OBS, ни модераторов какое-то время) или по кнопке **«🔄 Обновить сейчас»** на странице управления. Там же автообновление можно выключить. Виджет в OBS тоже обновляется сам.

### Безопасность

- Страница управления и порт для OBS доступны только с этого компьютера. Запросы с чужих сайтов и DNS-rebinding страница отклоняет.
- Модераторы через туннель входят по случайному паролю, который пульт получает в зашифрованном виде.
- Подделать команды на экран нельзя: они подписаны ключом модератора.
- Данные из CS2 принимаются только с секретным токеном.

### Для разработчиков

```sh
cd host && npm install
bun run server.js          # запуск из исходников
sh build.sh                # сборка для Windows / Linux / macOS в host/dist
```

GitHub Actions собирает программу и выкладывает релиз при каждом изменении в `host/` или в виджете.

Переменные: `OVERLAY_NO_UPDATE=1` (выключить автообновление), `OVERLAY_PORT` (7777), `OVERLAY_NO_TUNNEL=1`, `OVERLAY_TUNNEL_URL=wss://свой.домен/mqtt` (свой адрес вместо Cloudflare), `OVERLAY_HOST_DIR` (папка настроек), `OVERLAY_PUBLIC_BROKER`.
