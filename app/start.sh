#!/bin/bash
# Thumbnail Studio launcher (Mac / Linux)
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
( sleep 2 && (open http://localhost:4626 2>/dev/null || xdg-open http://localhost:4626 2>/dev/null) ) &
node server.js
