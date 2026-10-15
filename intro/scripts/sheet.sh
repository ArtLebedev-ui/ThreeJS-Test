#!/usr/bin/env bash
# Render stills at given times and tile them into out/sheet.jpg
set -e
cd "$(dirname "$0")/.."
rm -rf out/stills && node scripts/render.mjs --times "$1" --out out/stills ${2:-} | tail -1
n=$(ls out/stills | wc -l); cols=${COLS:-3}
ffmpeg -v error -y -pattern_type glob -i 'out/stills/t*.png' -vf "scale=${SW:-853}:-1,tile=${cols}x$(( (n + cols - 1) / cols )):padding=6:color=gray" -frames:v 1 out/sheet.jpg
