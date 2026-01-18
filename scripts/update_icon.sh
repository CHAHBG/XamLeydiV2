#!/bin/bash
# Script to replace the app icon with a new image

# Usage: ./scripts/update_icon.sh path/to/new-icon.png

NEW_ICON="$1"
ASSETS_DIR="$(dirname "$0")/../assets"

if [ -z "$NEW_ICON" ]; then
  echo "Usage: $0 <path-to-new-icon.png>"
  echo "Example: $0 ~/Downloads/new-icon.png"
  exit 1
fi

if [ ! -f "$NEW_ICON" ]; then
  echo "Error: File not found: $NEW_ICON"
  exit 1
fi

# Backup old icon
if [ -f "$ASSETS_DIR/xamleydi-icon-v2.png" ]; then
  mv "$ASSETS_DIR/xamleydi-icon-v2.png" "$ASSETS_DIR/xamleydi-icon-v2-backup-$(date +%Y%m%d-%H%M%S).png"
  echo "✓ Backed up old icon"
fi

# Copy new icon
cp "$NEW_ICON" "$ASSETS_DIR/xamleydi-icon-v2.png"

# Verify it's a valid PNG
file "$ASSETS_DIR/xamleydi-icon-v2.png" | grep -q "PNG image data"
if [ $? -eq 0 ]; then
  echo "✓ New icon installed: $ASSETS_DIR/xamleydi-icon-v2.png"
  echo ""
  echo "Next steps:"
  echo "  1. Run: npx expo prebuild --clean"
  echo "  2. Rebuild your app"
else
  echo "⚠ Warning: The file may not be a valid PNG image"
fi
