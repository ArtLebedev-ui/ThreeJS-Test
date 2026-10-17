#!/usr/bin/env bash
# Render the "Оценочная ( N )" bumper for one episode: frames, sound and an mp4.
#   bash scripts/bumper.sh 42            -> out/bumper-42.mp4
#   WORKERS=4 bash scripts/bumper.sh 7   -> out/bumper-07.mp4 (numbers are padded to two digits)
#   FAST=1 bash scripts/bumper.sh 42     -> quick half-res draft without motion blur
set -euo pipefail
cd "$(dirname "$0")/.."
n=$(printf '%02d' "$((10#${1:?usage: bumper.sh <episode number>}))")
workers=${WORKERS:-2}
frames=out/bumper-$n
extra=()
[[ "${FAST:-0}" == "1" ]] && extra=(--fast --scale 0.5)

mkdir -p "$frames"
pids=()
for ((w = 0; w < workers; w++)); do
  node scripts/render.mjs --page bumper.html --query "number=$n" --out "$frames" --resume --worker "$w/$workers" "${extra[@]}" &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done

node scripts/bumper-sound.mjs "out/bumper-$n.wav" "$n"
bash scripts/encode.sh "$frames" "out/bumper-$n.mp4" "out/bumper-$n.wav"
echo "done: out/bumper-$n.mp4"
