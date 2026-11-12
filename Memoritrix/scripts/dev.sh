#!/usr/bin/env bash
# Desenvolvimento: API com recarga automática (8787) + app Expo web (8081) apontando para ela.
set -euo pipefail
cd "$(dirname "$0")/.."
export PORT="${PORT:-8787}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-troque-esta-senha-123}"
trap 'kill 0' EXIT
npm run dev -w @cerebro/api &
EXPO_PUBLIC_API_URL="http://localhost:${PORT}" npm run web -w @cerebro/app &
wait
