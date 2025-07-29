#!/bin/bash
URL=$1
QUALITY=$2
OUTPUT_ZIP=$3

TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

yt-dlp \
  --extract-audio \
  --audio-format mp3 \
  --audio-quality "${QUALITY}K" \
  --add-metadata \
  --embed-thumbnail \
  --yes-playlist \
  -o "%(title)s.%(ext)s" \
  "$URL"

zip -r "$OUTPUT_ZIP" *.mp3
rm -rf "$TEMP_DIR"