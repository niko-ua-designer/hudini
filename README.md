# Hudini

A free, open-source stream overlay for OBS with a remote control for your moderator.
Text, pictures, GIFs, timers, polls, giveaways and more appear on the stream while a moderator runs them from their own PC.

One app, two roles: the same download goes on the streamer's PC and on the moderator's PC. Pick the role on the first start (**I am a streamer** / **I am a moderator**).

- Site, guides and downloads: <https://niko-ua-designer.github.io/hudini/>
- Latest release: <https://github.com/niko-ua-designer/hudini/releases/latest>

## Download

Grab one archive from the [latest release](https://github.com/niko-ua-designer/hudini/releases/latest):

| System | Archive |
|---|---|
| Windows | `HudiniHost-windows-<version>.zip` |
| Linux | `HudiniHost-linux-<version>.zip` |
| macOS (Apple Silicon and Intel) | `HudiniHost-mac-<version>.zip` (one universal build) |

Unzip it anywhere and start the app. Your settings live in the `data/` folder next to it.
Windows and Linux update themselves. If you run 1.0.0 on a Mac, download 1.1 by hand once and keep your `data/` folder; after that updates are automatic.

## Quick start

1. Streamer: start Hudini, choose **I am a streamer**, add the Browser source link to OBS.
2. Streamer: copy the room code (`hudini1:...`) and send it to the moderator.
3. Moderator: start Hudini, choose **I am a moderator**, paste the code and connect.

## What's new in 1.1

- Camera, screen and microphone from a moderator or guest. The permissions are off by default and each request is confirmed in the dock.
- Moderators see each other's cursors, and you can draw right on the canvas.
- Resize from any edge or corner; hold Alt to crop.
- Undo and redo work per element and sync between panels.
- 7TV, BTTV and FFZ emotes in chat.
- Hudini Host: an event log, per-moderator permissions and a dock with quick controls.
- Giveaways in one tab: the 3D case and a roulette with weighted prizes.
- CS2 add-on: radar with grenades, players numbered 1-0, series score.

Full list: [`CHANGELOG.md`](CHANGELOG.md).

## How it works

- The streamer's app serves the overlay picture to OBS (a Browser source link) and listens on port 7778 for moderators.
- The moderator pastes a room code (`hudini1:...`) and connects straight to the streamer's PC.
- The connection is encrypted with TLS. The server certificate is self-signed and checked by its SHA-256 fingerprint, which is part of the room code.
- There is no Cloudflare and no third-party server in the middle: the streamer and the moderator only need a network in common.

## Connecting

| Way | Notes |
|---|---|
| Radmin VPN | Easiest. Windows, both join one network, like Hamachi. |
| Porthole (Steam) | No VPN and no router settings: share TCP 7778 in a private lobby and invite the moderator. |
| Tailscale | Most reliable, works through any router. |
| ZeroTier | Good if you already have a network. |
| Port forwarding | Forward TCP 7778 to the streamer's PC and enter the public address in the app. |

Step-by-step guides for each way (streamer side, moderator side, how to check, what to do if it fails) are on the site and in
[`web/shared/connect-guides.js`](web/shared/connect-guides.js). On the first start Windows asks about the firewall: allow Hudini in private networks.

## Features

- Text, pictures, GIFs, videos and websites by link
- Move, scale, rotate, crop and group elements
- Polls that count votes from chat
- Flip-clock timers and counters
- Chat on screen with 7TV, BTTV and FFZ emotes
- Giveaways: 3D case and roulette
- Scenarios on chat commands ("if ... then ...": chat command, timer end, counter goal or a button)
- Sound tab
- Camera, screen and microphone from moderators
- Several moderators at once, with permissions
- CS2 tournament HUD with radar and live data from the game (add-on, beta)

## Project structure

| Path | What is there |
|---|---|
| `web/shared/` | Shared code and assets: `core.js`, `core.css` (render), `case3d.js`, `i18n.js` (panel translations: en/uk/de; Russian is the built-in source text), `icons.js`, `help-content.js`, `connect-guides.js`, presets, vendor, fonts, icons |
| `web/widget/` | `widget.html`, the OBS browser source |
| `web/panel/` | The moderator panel (`moderator.html`, `moderator.js`, `ui.js`, `ui.css`) |
| `web/app/` | App start screen, saved sessions, log and data storage pages |
| `web/site/` | Landing page, help, the "Report a problem" helper (`report.html`), the moving page, `version.json` |
| `server/` | Hudini server (Bun, built into one file) |
| `app/` | The desktop app (Tauri 2) and the connection relay (`app/relay`, Rust) |
| `tests/` | End-to-end tests (Playwright) |
| `tools/` | Build scripts |
| `docs/` | Release notes and checklists |

## Tests

```sh
cd tests
npm install    # once
node run.js
```

Single files can be run on their own, for example `node core.test.js`.

## Build

- App (Tauri + sidecar server): see [`app/BUILD.md`](app/BUILD.md). Run `sh tools/build-app.sh` first to assemble `app/dist/`.
- Server only: `sh server/build.sh` (needs Bun 1.4.4), builds one file per system.
- Site for GitHub Pages: `sh tools/build-site.sh`, output in `_site/`.
- Release steps: [`docs/RELEASING.md`](docs/RELEASING.md).

## Security and problems

See [SECURITY.md](SECURITY.md) for the security model and how to report a vulnerability.
For bugs, open an issue: the form asks for the logs from `data/logs/`.

## License

[GNU AGPL v3](LICENSE).
