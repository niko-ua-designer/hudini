#!/bin/sh
# Renders the site icon set in web/site/ from web/site/favicon.svg (needs ImageMagick with the RSVG delegate).
# The PNG/ICO files are committed, so a normal site build does not need ImageMagick.
set -e
cd "$(dirname "$0")/../web/site"
for s in 48 96 192 512; do
  magick -background none -density 1200 favicon.svg -resize ${s}x${s} -strip "favicon-$s.png"
done
# iOS rounds the corners itself and paints transparent pixels black, so the touch icon is a full-bleed square
sed 's/ rx="112"//' favicon.svg > .apple.svg
magick -background none -density 1200 .apple.svg -resize 180x180 -strip apple-touch-icon.png
rm -f .apple.svg
magick -background none -density 1200 favicon.svg \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 48x48 \) -delete 0 -strip favicon.ico
