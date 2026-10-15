#!/usr/bin/env bash
# Encode rendered PNG frames (+ soundtrack) into a video.
#   bash scripts/encode.sh <frames_dir> <out.mp4> [sound.wav]
# Env: CRF (default 14), FPS (default 30), PRORES=1 also writes a ProRes 422 HQ master next to the mp4.
set -euo pipefail
frames=$1
out=$2
snd=${3:-out/sound.wav}
fps=${FPS:-30}

inputs=(-framerate "$fps" -i "$frames/%05d.png")
audio=()
if [[ -f "$snd" ]]; then
  inputs+=(-i "$snd")
  audio=(-map 0:v -map 1:a -c:a aac -b:a 320k -shortest)
fi

ffmpeg -v warning -stats -y "${inputs[@]}" "${audio[@]}" \
  -c:v libx264 -preset slow -crf "${CRF:-14}" -tune film -profile:v high -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart "$out"

if [[ "${PRORES:-0}" == "1" ]]; then
  pr="${out%.*}.mov"
  pa=()
  [[ -f "$snd" ]] && pa=(-map 0:v -map 1:a -c:a pcm_s16le)
  ffmpeg -v warning -stats -y "${inputs[@]}" "${pa[@]}" -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le "$pr"
fi
