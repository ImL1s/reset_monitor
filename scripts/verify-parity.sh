#!/usr/bin/env zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Users/iml1s/fvm/default/bin:/opt/homebrew/bin:$PATH"

cd "$ROOT/worker"
npm test

cd "$ROOT/app"
flutter analyze
flutter test

API="${API_BASE:-https://reset-radar.taiwan-traffic.workers.dev}"
curl -sf "$API/health" | grep -q ok
curl -sf "$API/v1/snapshot" | grep -q schema_version
curl -sf "$API/v1/stats" | grep -q total_confirmed
curl -sf "$API/v1/monitor" | grep -q free_auto

echo "VERIFY_PARITY_OK"
