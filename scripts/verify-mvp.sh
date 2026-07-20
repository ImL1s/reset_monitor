#!/usr/bin/env zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/worker"

echo "== unit + integration tests =="
npm test

echo "== snapshot check =="
if curl -sf http://127.0.0.1:8787/health >/dev/null; then
  curl -sf http://127.0.0.1:8787/v1/snapshot | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d.get('schema_version')==1, d
ps={p['provider']:p['display_status'] for p in d['providers']}
print('providers', ps)
assert 'codex' in ps and 'claude' in ps
assert ps.get('grok')=='not_monitored'
print('snapshot OK')
"
  curl -sf -o /dev/null -w "admin_html %{http_code}\n" http://127.0.0.1:8787/admin
else
  echo "API not running on :8787 — start with: cd worker && npm run dev:local"
  echo "(tests already passed; live HTTP skipped)"
fi

echo "== flutter test =="
export PATH="$HOME/fvm/default/bin:$PATH"
cd "$ROOT/app"
flutter test

echo "VERIFY_MVP_OK"
