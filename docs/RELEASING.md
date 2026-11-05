# Releasing Hudini

## 1.0.0-rc.3 (ready on branch `hud`)

1. Merge `hud` into `main` (fast-forward). GitHub Pages publishes the new site in 1–2 minutes.
2. Push the tag: `git tag v1.0.0-rc.3 && git push origin v1.0.0-rc.3`. The "Hudini Host release" workflow builds
   Windows, Linux and macOS binaries and publishes a pre-release. rc.2 builds update themselves to rc.3.
3. Live test with [rc-checklist.md](rc-checklist.md), plus the donation case, the giveaway on a real Twitch chat,
   custom fonts and the HUD styles on live CS2.

## 1.0.0-rc.2 (released)

1. Merge `v1` into `main`. GitHub Pages publishes the new site in 1–2 minutes.
   From that moment Overlay Host 1.4 stops showing uploaded files: the streamer installs rc.1.
2. Push the tag: `git tag v1.0.0-rc.2 && git push origin v1.0.0-rc.2`. The "Hudini Host release" workflow builds
   Windows, Linux and macOS binaries and publishes a pre-release.
3. Live test with [rc-checklist.md](rc-checklist.md).

## 1.0.0

1. Set `const VERSION = '1.0.0'` in `host/server.js`.
2. Point the download links back to `releases/latest`
   (`site.js`, `help-content.js`, `moderator.html`, `moderator.js`, `README.md`, `host/README.md`).
3. Commit to `main`, then `git tag v1.0.0 && git push origin v1.0.0`.
   The workflow publishes the release as latest and marks the old `host-v…` releases as old pre-releases.
   rc builds update themselves to 1.0.0.
