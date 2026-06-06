#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/assets/icon.svg"
ICONSET="$ROOT/build/icon.iconset"
ICNS="$ROOT/build/icon.icns"
TMP=$(mktemp -d)

mkdir -p "$ICONSET" "$ROOT/build"

echo "Rendering SVG → PNG..."
qlmanage -t -s 1024 -o "$TMP" "$SVG" 2>/dev/null || true
BASE="$TMP/icon.svg.png"

if [ ! -f "$BASE" ]; then
  echo "qlmanage failed, trying rsvg-convert..."
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 1024 -h 1024 "$SVG" -o "$BASE"
  else
    echo "Errore: installa librsvg con: brew install librsvg"
    exit 1
  fi
fi

echo "Creating iconset sizes..."
for size in 16 32 128 256 512; do
  sips -z $size $size "$BASE" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  dbl=$((size * 2))
  sips -z $dbl $dbl "$BASE" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
cp "$BASE" "$ICONSET/icon_512x512@2x.png"

echo "Building .icns..."
iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$TMP"
echo "✓ Icon ready: $ICNS"
