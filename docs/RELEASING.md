# Releasing Hudini

## 1.0.0 (branch `v1`)

One app, Hudini (Tauri 2, `app/`), for both roles; the Bun server runs next to it as the `hudini-server` sidecar.
The version is already `1.0.0` in `server/server.js`, `server/package.json`, `app/src-tauri/Cargo.toml` and
`tauri.conf.json`; download links point to `releases/latest`.

1. All suites green: `cd tests && node run.js`; relay: `cargo test --manifest-path app/relay/Cargo.toml`.
2. Optional dry run: Actions → "Hudini Host release" → Run workflow on `v1` with "dry_run" checked.
   Download one zip and check its layout (see step 4).
3. Merge `v1` into `main` (fast-forward). GitHub Pages publishes the new site in 1–2 minutes.
4. Push the tag: `git tag v1.0.0 && git push origin v1.0.0` (strictly `vX.Y.Z`). The workflow publishes the release
   as latest. **The file names stay as in rc.4**, because rc.4 installs look for them when they update themselves:
   - `HudiniHost-windows-1.0.zip`, `HudiniHost-linux-1.0.zip`, `HudiniHost-mac-arm64-1.0.zip`, `HudiniHost-mac-intel-1.0.zip`:
     a `HudiniHost/` folder with the app (`HudiniHost[.exe]`; macOS: `Hudini.app`), `hudini-server`, `data/` and README.txt.
   - `HudiniHost-windows.exe.zip` and the other single-file names, `SHA256SUMS.txt` and `SHA256SUMS.txt.sig`
     (signed with the same key as rc.4).
   Renaming the zips to `Hudini-<os>-<version>.zip` can happen from 1.0.1 on: the 1.0 updater accepts both names.
5. Live test with [rc-checklist.md](rc-checklist.md), including the rc.4 → 1.0.0 self-update on Windows.
   On macOS rc.4 cannot update itself (it expects `Hudini Host.app`): Mac users install 1.0 by hand, keeping `data/`.

## 1.0.0-rc.4 (released)

Hudini Host becomes a desktop app (Tauri 2, `app/`): a window plus a tray icon, optional autostart,
and the Bun server (`server/server.js`) runs next to it as the `hudini-server` sidecar.

0. Update signing (once): `node tools/signing-key.mjs` writes the private key to `~/hudini-signing.key` without printing it.
   Paste that file into the repository secret `HUDINI_SIGNING_KEY` (Settings → Secrets and variables → Actions),
   keep a copy in a password manager, delete the file. Put `~/hudini-signing.pub` into `const UPDATE_KEY` in `server/server.js`.
   The publish job signs `SHA256SUMS.txt` (`SHA256SUMS.txt.sig`); rc.4 and later refuse an update without a valid signature.
1. Optional dry run: Actions → "Hudini Host release" → Run workflow on `rc4` with "dry_run" checked.
   It builds all four systems and keeps the zips as workflow artifacts; nothing is published.
2. Merge `rc4` into `main` (fast-forward). GitHub Pages publishes the new site in 1–2 minutes.
3. Push the tag: `git tag v1.0.0-rc.4 && git push origin v1.0.0-rc.4`. The "Hudini Host release" workflow
   builds the Tauri app on Windows, Linux (Ubuntu 22.04) and macOS (Apple Silicon and Intel) and publishes
   the pre-release "Hudini 1.0 RC4" with:
   - `HudiniHost-windows-1.0rc4.zip`, `HudiniHost-linux-1.0rc4.zip`, `HudiniHost-mac-arm64-1.0rc4.zip`,
     `HudiniHost-mac-intel-1.0rc4.zip`: a "Hudini Host" folder with the app, `hudini-server`, `data/` and README.txt
     (macOS: `Hudini Host.app` with the server inside the bundle). These are the downloads.
   - `HudiniHost-windows.exe.zip`, `HudiniHost-linux.zip`, `HudiniHost-mac-arm64.zip`, `HudiniHost-mac-intel.zip`:
     single-file server builds with the old names, only so rc.3 installs update themselves.
   - `SHA256SUMS.txt` for all zips.

   File names use the short version: 1.0.0-rc.4 → `1.0rc4`, 1.0.0 → `1.0`, 1.0.2 → `1.0.2`.
4. Once: Actions → "Rename old Overlay Host releases" → Run workflow with "apply" unchecked, check the list,
   then run it again with "apply" checked. The `host-v…` releases become pre-releases titled
   "Overlay Host beta 0.1.0 (host-v1.0.0)" … "Overlay Host beta 0.5.0 (host-v1.4.0)"; tags and files stay.
   Until 1.0.0 no release is marked latest.
5. Live test with [rc-checklist.md](rc-checklist.md), including the tray, autostart and the rc.3 → rc.4 self-update.

## 1.0.0-rc.3 (released)

1. Merge `hud` into `main` (fast-forward). GitHub Pages publishes the new site in 1–2 minutes.
2. Push the tag: `git tag v1.0.0-rc.3 && git push origin v1.0.0-rc.3`. The "Hudini Host release" workflow builds
   Windows, Linux and macOS binaries and publishes a pre-release. rc.2 builds update themselves to rc.3.
3. Live test with [rc-checklist.md](rc-checklist.md), plus the case, the giveaway on a real Twitch chat,
   custom fonts and the HUD styles on live CS2.

## 1.0.0-rc.2 (released)

1. Merge `v1` into `main`. GitHub Pages publishes the new site in 1–2 minutes.
   From that moment Overlay Host 1.4 stops showing uploaded files: the streamer installs rc.1.
2. Push the tag: `git tag v1.0.0-rc.2 && git push origin v1.0.0-rc.2`. The "Hudini Host release" workflow builds
   Windows, Linux and macOS binaries and publishes a pre-release.
3. Live test with [rc-checklist.md](rc-checklist.md).
