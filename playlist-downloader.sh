#!/bin/bash
URL=$1
QUALITY=$2
OUTPUT_ZIP=$3
MAX_ITEMS=${4:-10} # Limite par défaut à 10 éléments

TEMP_DIR=$(mktemp -d -t ytdl-XXXXXX) || exit 1
cd "$TEMP_DIR" || exit 1

# Journalisation
LOG_FILE="$TEMP_DIR/yt-dlp.log"
echo "Début du téléchargement à $(date)" >> "$LOG_FILE"

yt-dlp \
  --extract-audio \
  --audio-format mp3 \
  --audio-quality "${QUALITY}K" \
  --add-metadata \
  --embed-thumbnail \
  --yes-playlist \
  --max-downloads "$MAX_ITEMS" \
  --ignore-errors \
  -o "%(title)s.%(ext)s" \
  "$URL" >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ] && [ "$(ls -1 *.mp3 2>/dev/null | wc -l)" -gt 0 ]; then
  zip -r "$OUTPUT_ZIP" *.mp3 >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
else
  EXIT_CODE=1
fi

# Nettoyage
if [ $EXIT_CODE -eq 0 ]; then
  rm -f *.mp3 *.webp *.webm
fi
rm -f "$LOG_FILE"
cd ..
rmdir "$TEMP_DIR"

exit $EXIT_CODE