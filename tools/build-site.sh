#!/bin/sh
# Assembles the GitHub Pages site into _site/ (also handy for a local preview: `sh tools/build-site.sh && python3 -m http.server -d _site`).
#   /            web/site/*      landing page, help, version.json
#   /shared/     web/shared/*    core.js, core.css, fonts, icons, ... (Hudini Host fetches the widget files from here)
#   /widget/     web/widget/*    widget.html for OBS
#   /panel/      redirect stubs  the panel lives in the app now; old links land on the moving page (/moderator.html)
#   search     tools/build-seo.js adds /ru/ /uk/ /de/ landing pages, sitemap.xml, robots.txt
set -e
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -R web/site/. _site/
cp -R web/shared _site/shared
cp -R web/widget _site/widget
mkdir -p _site/panel
for f in moderator.html index.html; do
  cat > "_site/panel/$f" <<'HTML'
<!DOCTYPE html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=../moderator.html">
<title>Hudini</title>
<link rel="icon" href="../favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="../favicon.svg" type="image/svg+xml" sizes="any">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<a href="../moderator.html">Hudini</a>
<script>location.replace('../moderator.html' + location.search);</script>
HTML
done
mkdir -p _site/app
cp web/app/store.js web/app/sessions.js _site/app/
node tools/build-seo.js
