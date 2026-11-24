# Releasing Hudini

## 1.1.2 (patch, branch `v1`)

Same steps as 1.1.1; version `1.1.2`, `## 1.1.2` in `CHANGELOG.md`. Before every release open the Host window and the panel on en, uk and de and check that no Russian is left (`tests/i18ncov.test.js` covers the HTML and the Host scripts, not the panel scripts).

## 1.1.1 (patch, branch `v1`)

Same steps and archive names as 1.1.0 (`HudiniHost-<system>-1.1.1.zip`). Version `1.1.1` is in `server/server.js`, `server/package.json`, `app/src-tauri/Cargo.toml`, `app/relay/Cargo.toml` and `tauri.conf.json`; add a `## 1.1.1` section to `CHANGELOG.md`.

## 1.1.0 (branch `v1`)

Version `1.1.0` is in `server/server.js`, `server/package.json`, `app/src-tauri/Cargo.toml` and `tauri.conf.json`.
The release has exactly three archives, plus the checksums:
- `HudiniHost-windows-1.1.zip`, `HudiniHost-linux-1.1.zip` and one universal `HudiniHost-mac-1.1.zip` (Apple Silicon and Intel).
  Windows and Linux: a `HudiniHost/` folder with the app (`HudiniHost[.exe]`), `hudini-server[.exe]` next to it, `data/` and README.txt.
  macOS: the same folder holds `Hudini.app` (the `hudini-server` sidecar is inside the bundle, in `Contents/MacOS/`, not next to it), `data/` and README.txt.
- A manual run publishes only with all three systems selected; a partial set is refused for a real release, use `dry_run` for partial builds.
- `SHA256SUMS.txt` and `SHA256SUMS.txt.sig` cover these three zips (same signing key as before).
- The single-file legacy zips (`HudiniHost-windows.exe.zip`, ...) and the `legacy` job are gone, so rc.3 and older installs no longer update themselves.
- Windows and Linux keep the `HudiniHost-` names, so 1.0 installs still update themselves. 1.1 picks `HudiniHost-mac-<ver>.zip`
  (or `Hudini-mac-<ver>.zip`) on both Mac architectures.
  **1.0.0 on a Mac cannot self-update** (it looks for `mac-arm64` / `mac-intel`): the user downloads 1.1 by hand once and keeps `data/`. The changelog says so.

How the macOS archive is built (one `build` matrix entry, `triple: universal-apple-darwin`): the Bun server is compiled for `bun-darwin-arm64`
and `bun-darwin-x64` and combined with `lipo` into `binaries/hudini-server-universal-apple-darwin`. Tauri's universal build also needs the two
per-arch sidecars (`-aarch64-apple-darwin`, `-x86_64-apple-darwin`), which the workflow leaves in place. Both Rust targets are installed;
the app comes from `target/universal-apple-darwin/release/bundle/macos/Hudini.app`.

Release notes: add a `## 1.1.0` section to `CHANGELOG.md` (EN, RU, UK, DE lines; the heading is exactly the version). The publish job takes the
section for the tag version, puts it under "What's new" in the release body after the download instructions, and fails if the section is missing.

1. All suites green: `cd tests && node run.js`.
2. Dry run: Actions -> "Hudini Host release" -> Run workflow on `v1` with "dry_run" checked. Download the mac zip and check it is universal
   (`lipo -archs` on the binaries in `Hudini.app/Contents/MacOS/` shows `x86_64 arm64`), and that the Windows/Linux layouts are unchanged.
3. Merge `v1` into `main` (fast-forward) and raise `"panel"` in `web/site/version.json` as needed.
4. Push the tag `v1.1.0` (strictly `vX.Y.Z`), approve the `release` environment, check the release body and the three zips.
5. Live test: 1.0.0 -> 1.1.0 self-update on Windows and Linux; fresh Mac install on Apple Silicon and Intel.

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
