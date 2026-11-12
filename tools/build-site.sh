#!/bin/sh
# Assembles the GitHub Pages site into _site/ (also handy for a local preview: `sh tools/build-site.sh && python3 -m http.server -d _site`).
#   /            web/site/*      landing page, help, version.json
#   /shared/     web/shared/*    core.js, core.css, fonts, icons, ... (Hudini Host fetches the widget files from here)
#   /widget/     web/widget/*    widget.html for OBS
#   /panel/      web/panel/*     the panel; temporary, removed together with the old panel in phase 7
set -e
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -R web/site/. _site/
cp -R web/shared _site/shared
cp -R web/widget _site/widget
cp -R web/panel _site/panel
mkdir -p _site/app
cp web/app/store.js web/app/sessions.js _site/app/
