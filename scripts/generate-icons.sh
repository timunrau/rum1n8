#!/bin/bash
# Generate app icons from the wordmark SVG
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/../public/icons"
SVG_FILE="$SCRIPT_DIR/icon-source.svg"

# Create SVG source matching the BrandMark component
cat > "$SVG_FILE" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3768c6"/>
      <stop offset="100%" stop-color="#214889"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text
    x="272"
    y="330"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="bold"
    font-size="320"
    fill="white"
  >r</text>
</svg>
SVGEOF

echo "Generating icons from SVG..."

# Generate each size using rsvg-convert
for size in 48 72 96 128 144 152 192 256 384 512; do
  rsvg-convert -w "$size" -h "$size" "$SVG_FILE" -o "$ICONS_DIR/icon-${size}x${size}.png"
  echo "  Generated ${size}x${size}"
done

rm "$SVG_FILE"
echo "Done."
