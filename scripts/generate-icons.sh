#!/bin/bash
# Generate app icons from the wordmark SVG
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/../public/icons"
SVG_FILE="$SCRIPT_DIR/icon-source.svg"

# Create SVG source matching the BrandMark component
cat > "$SVG_FILE" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1F3D2E"/>
  <text
    x="272"
    y="330"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="bold"
    font-size="320"
    fill="#FBF8F2"
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
