#!/bin/sh
# Сборка программы стримера в один файл для каждой системы (нужен Bun: npm i -g bun)
set -e
cd "$(dirname "$0")"
npm install --no-audit --no-fund
mkdir -p dist
bun build --compile --minify --target=bun-windows-x64 server.js --outfile dist/OverlayHost-windows.exe
bun build --compile --minify --target=bun-linux-x64   server.js --outfile dist/OverlayHost-linux
bun build --compile --minify --target=bun-darwin-arm64 server.js --outfile dist/OverlayHost-mac-arm64
bun build --compile --minify --target=bun-darwin-x64  server.js --outfile dist/OverlayHost-mac-intel
ls -lh dist
