#!/bin/bash
# Generate regular and maskable app icons from the source PNGs
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/../public/icons"
SOURCES_DIR="$SCRIPT_DIR/../assets/icons"
REGULAR_SOURCE="$SOURCES_DIR/icon.png"
MASKABLE_SOURCE="$SOURCES_DIR/icon-maskable.png"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required to generate icons." >&2
  exit 1
fi

echo "Generating regular and maskable icons..."

for size in 48 72 96 128 144 152 192 256 384 512; do
  magick "$REGULAR_SOURCE" -resize "${size}x${size}" "$ICONS_DIR/icon-${size}x${size}.png"
  magick "$MASKABLE_SOURCE" -resize "${size}x${size}" "$ICONS_DIR/icon-maskable-${size}x${size}.png"
  echo "  Generated regular and maskable ${size}x${size} icons"
done

echo "Done."
