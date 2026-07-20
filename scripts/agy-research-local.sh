#!/usr/bin/env zsh
# 本機終端執行（Grok/Claude session 內 external CLI 會被擋）
# 用法：
#   chmod +x scripts/agy-research-local.sh
#   ./scripts/agy-research-local.sh
#
# 需要：agy 在 PATH（~/.local/bin）、已登入 Google/Antigravity

set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.omc/research/agy"
mkdir -p "$OUT"

if ! command -v agy >/dev/null 2>&1; then
  echo "agy not found. Install Antigravity CLI first."
  exit 1
fi

run_one() {
  local id="$1"
  local title="$2"
  local prompt_file="$OUT/prompt-${id}.txt"
  local out_file="$OUT/r${id}-${title}.md"
  echo "=== agy job $id: $title ==="
  # PTY via python (script 在非 tty 會失敗)
  python3 - <<PY 2>&1 | tr -d '\004' > "$out_file"
import pty
prompt = open("$prompt_file").read()
cmd = [
  "agy", "-p", prompt,
  "--model", "Gemini 3.5 Flash (High)",
  "--dangerously-skip-permissions",
  "--sandbox",
  "--print-timeout", "480s",
]
pty.spawn(cmd)
PY
  echo "wrote $out_file ($(wc -c < "$out_file") bytes)"
}

cat > "$OUT/prompt-1.txt" <<'EOF'
READ-ONLY. No file edits. No git.
Search the web. Answer in Traditional Chinese WITH source URLs:
1) How codex-resets.com and codex-reset-radar work
2) @thsottiaux Codex hard reset announcement patterns 2026
3) @ClaudeDevs "We've reset 5-hour and weekly" frequency
4) Public hard-reset signals for Grok, Kimi, Antigravity, GLM — any?
5) X API 2026 pay-per-use cost to poll 2 accounts
End with MVP recommendation for zero-auth Codex+Claude RESET radar.
EOF

cat > "$OUT/prompt-2.txt" <<'EOF'
READ-ONLY. No file edits. No git.
Compare zero-auth reset trackers vs personal usage apps (codex-resets, CodexBar, Limits, AI Usage, Code Meter).
Traditional Chinese WITH URLs:
1) Auth requirements
2) Monetization
3) Gaps for multi-provider public board + Telegram
4) Risks of admin semi-manual confirmation
Opinionated 4-week MVP for solo dev.
EOF

cat > "$OUT/prompt-3.txt" <<'EOF'
READ-ONLY. No file edits. No git.
Cloudflare Workers + D1 + Telegram for public status board with admin confirm.
Traditional Chinese WITH Cloudflare docs URLs:
1) Minimal architecture
2) Cloudflare Access for admin
3) Telegram Bot channel notify
4) OG meta HTML for bots from Worker
5) Cost <10k daily requests
6) Pitfalls: stale cache, D1 limits
Week-1 implementation checklist.
EOF

cat > "$OUT/prompt-4.txt" <<'EOF'
READ-ONLY adversarial review. No file edits. No git.
Product: zero-auth Flutter web RESET Radar — Codex/Claude public global usage resets;
MVP admin pastes official tweet URL and confirms; Telegram free notify; no personal OAuth;
Grok/Kimi/GLM/Antigravity as not_monitored.
Traditional Chinese: failure modes, success modes, minimum trust features, GO/NO-GO.
EOF

# 平行 4 路（本機可）
for n in 1 2 3 4; do
  titles=(sources competitors cf-worker steelman)
  (
    run_one "$n" "${titles[$n]}"
  ) &
  echo $! > "/tmp/agy-reset-r${n}.pid"
done

echo "PIDs: $(cat /tmp/agy-reset-r1.pid) $(cat /tmp/agy-reset-r2.pid) $(cat /tmp/agy-reset-r3.pid) $(cat /tmp/agy-reset-r4.pid)"
echo "Waiting..."
wait
echo "All agy jobs done. Outputs in $OUT"
ls -la "$OUT"/r*.md 2>/dev/null || true
