# Hudini Host app (window + tray): build

`host/app` is a Tauri 2 shell around the overlay server. The server (`host/server.js`) is compiled by Bun into
one file and shipped next to the app as a sidecar named `hudini-server`. The app starts it with
`OVERLAY_APP=1`, waits for the `READY <port>` line on its stdout and opens `http://localhost:<port>/` in its window.

The Tauri part has to be built on each OS natively (one runner per OS). The sidecar can be cross-compiled by Bun,
but it is simplest to build it on the same runner.

## Tools

- Bun 1.4.4 (`oven-sh/setup-bun`, as in the current workflow)
- Rust stable (`dtolnay/rust-toolchain@stable`; on the Intel mac job add the target `x86_64-apple-darwin`
  if it is cross-built on an arm64 runner)
- Node 20+ for `npx @tauri-apps/cli@2.12.4`
- Linux only: `sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libdbus-1-dev pkg-config build-essential`
  (build on `ubuntu-22.04` so the binary runs on older glibc)

## 1. Sidecar: compile the server into `src-tauri/binaries/`

Tauri looks for `binaries/hudini-server-<rust target triple>[.exe]` and copies it next to the app
executable as `hudini-server[.exe]`.

```sh
cd host
npm ci --ignore-scripts --no-audit --no-fund
mkdir -p app/src-tauri/binaries
# Windows (x64)
bun build --compile --minify --target=bun-windows-x64  server.js --outfile app/src-tauri/binaries/hudini-server-x86_64-pc-windows-msvc.exe
# Linux (x64)
bun build --compile --minify --target=bun-linux-x64    server.js --outfile app/src-tauri/binaries/hudini-server-x86_64-unknown-linux-gnu
# macOS Apple Silicon
bun build --compile --minify --target=bun-darwin-arm64 server.js --outfile app/src-tauri/binaries/hudini-server-aarch64-apple-darwin
# macOS Intel
bun build --compile --minify --target=bun-darwin-x64   server.js --outfile app/src-tauri/binaries/hudini-server-x86_64-apple-darwin
```

Only the one for the runner's target is needed. Check the triple with `rustc -vV | grep host`.

## 2. App

Run from `host/app/src-tauri`. Optionally keep the app version in sync with the server:
`--config '{"version":"1.0.0-rc.4"}'` (the server version in `server.js` is what the updater compares; the
app version is only metadata).

| OS | Command | Result |
|----|---------|--------|
| Windows | `npx @tauri-apps/cli@2.12.4 build --no-bundle` | `target/release/hudini-host.exe` + `target/release/hudini-server.exe` |
| Linux | `npx @tauri-apps/cli@2.12.4 build --no-bundle` | `target/release/hudini-host` + `target/release/hudini-server` |
| macOS arm64 | `npx @tauri-apps/cli@2.12.4 build --bundles app` | `target/release/bundle/macos/Hudini Host.app` |
| macOS Intel | `npx @tauri-apps/cli@2.12.4 build --bundles app --target x86_64-apple-darwin` | `target/x86_64-apple-darwin/release/bundle/macos/Hudini Host.app` |

On macOS the sidecar ends up inside the bundle: `Hudini Host.app/Contents/MacOS/hudini-server`.
The bundle is not signed or notarized (Tauri ad-hoc signs it on arm64); users open it with right-click → Open the first time.

## 3. Portable zip (what the updater expects)

Asset name: `HudiniHost-<os>-<prettyVer>.zip`, `os` ∈ `windows`, `linux`, `mac-arm64`, `mac-intel`,
`prettyVer`: `1.0.0-rc.4` → `1.0rc4`, `1.0.0` → `1.0`, `1.0.2` → `1.0.2`. Add every zip to `SHA256SUMS.txt`
(the updater refuses a zip whose hash is missing or different).

Every zip holds one folder `Hudini Host/`:

```
Hudini Host/
  Hudini Host.exe        (Windows: target/release/hudini-host.exe renamed)
  hudini-server.exe      (Windows)
  Hudini Host            (Linux: target/release/hudini-host renamed, chmod +x)
  hudini-server          (Linux, chmod +x)
  Hudini Host.app/       (macOS: the whole bundle, the server is inside it)
  README.txt
  data/                  (empty; settings and moderators' files go here)
```

The names must stay the same from release to release: the updater replaces every top-level entry of the zip
except `data/`, then relaunches the app file it was started from.

Packing:

```sh
# Linux (keeps the executable bits)
mkdir -p "pkg/Hudini Host/data"
cp target/release/hudini-host "pkg/Hudini Host/Hudini Host"; cp target/release/hudini-server README.txt "pkg/Hudini Host/"
(cd pkg && zip -9 -r "../HudiniHost-linux-1.0rc4.zip" "Hudini Host")

# macOS (ditto keeps permissions and symlinks inside the .app)
mkdir -p "pkg/Hudini Host/data"
cp -R "target/release/bundle/macos/Hudini Host.app" README.txt "pkg/Hudini Host/"
ditto -c -k --keepParent "pkg/Hudini Host" HudiniHost-mac-arm64-1.0rc4.zip
```

```powershell
# Windows
New-Item -ItemType Directory -Force "pkg/Hudini Host/data" | Out-Null
Copy-Item target/release/hudini-host.exe "pkg/Hudini Host/Hudini Host.exe"
Copy-Item target/release/hudini-server.exe, README.txt "pkg/Hudini Host/"
Push-Location pkg; tar -a -c -f ../HudiniHost-windows-1.0rc4.zip "Hudini Host"; Pop-Location
```

(`Compress-Archive` from Windows PowerShell 5 writes `\` in entry names; the updater accepts that too, but
`tar -a` or 7-Zip give a standard zip.)

The old single-file assets (`HudiniHost-windows.exe.zip`, `HudiniHost-linux.zip`, `HudiniHost-mac-arm64.zip`,
`HudiniHost-mac-intel.zip`, built by `host/build.sh`) stay in the release for rc.3 users: a standalone build
updates only from those, an app build (OVERLAY_APP set) only from the new ones.

## Runtime requirements

- Windows 10/11 with WebView2 (preinstalled on Windows 11 and current Windows 10).
- Linux: `libwebkit2gtk-4.1-0`, `libayatana-appindicator3-1` (tray), a notification daemon for notifications.
- macOS 10.15+. If macOS starts the app from a quarantined download (App Translocation, read-only path), the
  app keeps its data in `~/Library/Application Support/io.github.nikouadesigner.hudinihost/data` and cannot
  update itself; moving `Hudini Host.app` (or the whole folder) to another place with Finder fixes that.

## How the parts talk

- App → server env: `OVERLAY_APP=1`, `OVERLAY_NO_OPEN=1`, `OVERLAY_HOST_DIR=<data>`, `OVERLAY_APP_EXE=<app file>`,
  `OVERLAY_APP_PID=<app pid>`.
- Server stdout: `READY <port>` after listening, `FAIL port <port> <code>` when the port is taken,
  `RESTART` right before it exits after installing an update.
- App → server stdin: `VISIBLE 0` / `VISIBLE 1` (window hidden in the tray or shown). When stdin closes (the
  app quit or crashed) the server shuts down by itself.
- Update: the server unpacks the zip into `data/update/<ver>/`, renames the running files to `*.old`, moves the
  new ones in, starts `<app file> --updated --wait-pid <old app pid> [--minimized]` and exits. The new app waits
  for the old one to exit, then starts its own server; `*.old` files are removed on the next start.
- Autostart: `tauri-plugin-autostart` with `--minimized` (starts hidden in the tray). The management page reads
  and switches it through `plugin:autostart|is_enabled/enable/disable` (allowed for `http://localhost:*` in
  `capabilities/remote.json`).
