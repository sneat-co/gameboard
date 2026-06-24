#!/usr/bin/env bash
# Builds the SPA, then runs gameboardd serving it (same origin → no CORS).
set -euo pipefail
cd "$(dirname "$0")/.."
FRONTEND_DIR="$PWD"
node_modules/.bin/ng build
cd ../backend
exec env \
  GAMEBOARD_ADDR=:8099 \
  GAMEBOARD_STATIC_DIR="$FRONTEND_DIR/dist/browser" \
  GOPROXY=direct GOSUMDB=off \
  go run ./cmd/gameboardd
