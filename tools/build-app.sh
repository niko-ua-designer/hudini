#!/bin/sh
# Assembles the pages bundled into the desktop app (frontendDist of app/src-tauri) into app/dist/. Run before `tauri build`.
#   app/dist/app/      web/app/*      loading page, role and sessions screen
#   app/dist/shared/   web/shared/*   core, translations, icons (the panel and the screens use them)
#   app/dist/panel/    web/panel/*    the moderator panel
set -e
cd "$(dirname "$0")/.."
rm -rf app/dist
mkdir -p app/dist
cp -R web/app app/dist/app
cp -R web/shared app/dist/shared
cp -R web/panel app/dist/panel
# Tauri wants an index.html at the root: it just opens the start screen
printf '%s\n' '<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=app/start.html"><title>Hudini</title>' > app/dist/index.html
