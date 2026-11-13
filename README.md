# Hudini

A free, open-source stream overlay for OBS with a remote control for your moderator.
Timers, polls, counters, pictures, a 3D case and more appear on the stream while a moderator runs them from their own PC.

One app, two roles: the same download is installed on the streamer's PC and on the moderator's PC. The role is chosen on the first start (**I am a streamer** / **I am a moderator**).

- Site, downloads and guides: <https://niko-ua-designer.github.io/hudini/>
- Releases: <https://github.com/niko-ua-designer/hudini/releases>

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

- Text, pictures, GIFs and websites by link
- Move, scale, rotate; squeeze and stretch pictures by the side handles
- Select several elements and group them
- Polls that count votes from chat
- Flip-clock timers and counters
- 3D case with 4 kinds
- Raffle
- Scenarios on chat commands ("if ... then ...": chat command, CS2 event, timer end, counter goal or a button)
- Sound tab
- CS2 tournament HUD with live data from the game (beta)

## Project structure

| Path | What is there |
|---|---|
| `web/shared/` | Shared code and assets: `core.js`, `core.css` (render), `case3d.js`, `i18n.js` (en/uk/de), `icons.js`, `help-content.js`, `connect-guides.js`, presets, vendor, fonts, icons |
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
