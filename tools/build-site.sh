#!/bin/sh
# Assembles the GitHub Pages site into _site/ (also handy for a local preview: `sh tools/build-site.sh && python3 -m http.server -d _site`).
#   /            web/site/*      landing page, help, version.json
#   /shared/     web/shared/*    core.js, core.css, fonts, icons, ... (Hudini Host fetches the widget files from here)
#   /widget/     web/widget/*    widget.html for OBS
#   /panel/      redirect stubs  the panel lives in the app now; old links land on the moving page (/moderator.html)
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
<a href="../moderator.html">Hudini</a>
<script>location.replace('../moderator.html' + location.search);</script>
HTML
done
mkdir -p _site/app
cp web/app/store.js web/app/sessions.js _site/app/

# Support page: the relay address is the SUPPORT_API constant in web/site/support.js (the env var SUPPORT_API overrides it for this build).
# Its origin goes into the page's CSP (connect-src), so the browser may talk to that one server and nothing else.
api="${SUPPORT_API:-$(sed -n "s/^const SUPPORT_API = '\(.*\)';.*/\1/p" web/site/support.js)}"
if [ -n "$api" ]; then
  case "$api" in *[!A-Za-z0-9:/._-]*) echo "SUPPORT_API has unexpected characters" >&2; exit 1 ;; esac
  case "$api" in https://*) ;; *) echo "SUPPORT_API must start with https://" >&2; exit 1 ;; esac
  origin=$(printf '%s' "$api" | sed -E 's#^(https://[A-Za-z0-9.-]+(:[0-9]+)?).*#\1#')
  case "$origin" in https://*) ;; *) echo "SUPPORT_API is not a valid https URL" >&2; exit 1 ;; esac
  sed -i "s#connect-src 'self'#connect-src 'self' $origin#" _site/support.html
  sed -i "s#^const SUPPORT_API = '.*';#const SUPPORT_API = '$api';#" _site/support.js
fi
