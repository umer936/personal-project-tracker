#!/usr/bin/env sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TOOLS_DIR="$REPO_ROOT/tools/tailwind"
BIN="$TOOLS_DIR/tailwindcss-linux-x64"
URL="https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64"

mkdir -p "$TOOLS_DIR"

if [ ! -f "$BIN" ]; then
  echo "Downloading Tailwind standalone CLI..."
  curl -L "$URL" -o "$BIN"
  chmod +x "$BIN"
fi

cd "$REPO_ROOT"
"$BIN" -c tailwind.config.js -i php/assets/app.tailwind.css -o php/public/app.css --minify
