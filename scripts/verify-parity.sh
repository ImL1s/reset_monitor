#!/usr/bin/env zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
if command -v flutter >/dev/null 2>&1; then
  :
elif command -v fvm >/dev/null 2>&1; then
  flutter() { fvm flutter "$@"; }
elif [[ -x "$HOME/fvm/default/bin/flutter" ]]; then
  export PATH="$HOME/fvm/default/bin:$PATH"
else
  echo "flutter not found on PATH" >&2
  exit 1
fi

cd "$ROOT/worker"
npm test
npm run typecheck

cd "$ROOT/app"
flutter analyze
flutter test

API="${API_BASE:-https://reset-radar.taiwan-traffic.workers.dev}"
curl -sf "$API/health" | grep -q ok
curl -sf "$API/v1/snapshot" | grep -q schema_version
curl -sf "$API/v1/stats" | grep -q total_confirmed
curl -sf "$API/v1/monitor" | grep -q free_auto

echo "VERIFY_PARITY_OK"
