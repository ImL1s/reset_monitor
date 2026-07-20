# 48h Forecast Mechanisms Research (2026-07-20)

Live + multi-agent synthesis. Implementation plan:
`docs/superpowers/plans/2026-07-20-next-48h-forecast.md`

## Competitors

### codex-resets.com
- History / drought only. **No 48h %.**

### codexresetradar.com (A) — most transparent
- `GET /api/status` public JSON.
- Separates **fact** (`factStatus`, `latestReset`) from **forecast** (`windowHours: 48`, `probability`, `band`, `factors[]`, `aiAdjustment`, history log).
- Observed factors: baseline, elapsed, cooldown, future-promise (+evidence URLs), stale-source, probability-floor, source authority, AI consistency.
- zh-hant UI: “未來 48 小時再次重置機率” + factor breakdown.

### codexradar.com (B)
- `GET /current.json` public summary: `prediction.probability_24h/48h`, `level`, narrative; `window.open`; `tibo_presence` (do **not** copy); full API auth-gated.
- Do not depend on their API in production.

## Our legal inputs only
- Own `hard_reset` events (`effective_at`), stats intervals, optional pending explicit-promise text, optional source_health.
- Never scrape competitors; never personal quota.

## Product freeze
- Third axis heuristic only; never green; never notify.
- Codex-first; Claude &lt;2 hard → insufficient_data.
- Deterministic v1; AI adjustment out of v1.
