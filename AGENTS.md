# AGENTS.md — RESET Radar

## Product (one line)

Zero-login public board: did **Codex / Claude staff** announce a **hard usage reset**? Not personal quota bars.

## Hard rules

1. **False green = P0.** Never green on keyword-only, teaser, hedge-speculation, negation, promo, partial, quote/RT/reply-replay, or banked-as-hard.
2. Client **must not** compute TTL; trust server `display_status`.
3. North-Star green (`active_confirmed*`) = **hard_reset** only; banked → `active_banked`.
4. Green path = allowlisted author + strict template and/or LLM gate **auto-confirm**. Admin = emergency retract / manual pipeline only.
5. Soft funnel ≥ CODEX_STRONG; new strong templates need negative fixtures. `excluded_context` may requeue after template expand; hard rejects (`negation` / teaser / quote) never resurrect.
6. `next_48h` is heuristic only — never notify, never green.
7. No AI account login on the public board; no server-side user tokens.

## Layout

| Path | Role |
|------|------|
| `worker/` | Cloudflare Worker API + free-auto cron |
| `app/` | Flutter Web (primary) + mobile shell |
| `docs/` | PURPOSE, PLAN v4, api-v1-snapshot, HOSTING, spikes |
| `plans/` | `/improve` plans（001–016 landed 2026-07-21） |
| `brand/` | Logo masters |
| `fixtures/` | Gate fixtures |

## Verify

```bash
cd worker && npm test && npm run typecheck
cd app && flutter analyze && flutter test
./scripts/verify-parity.sh
```

## Free-auto flow

```
Cron */10 → FxTwitter → Dayclaw fallback → ingest (allowlist + userId + classify)
  → (duplicate rejected? soft-requeue | requeueExcludedIfClassifyPasses)
  → shouldAutoPublish (negation / hedge / teaser / incoming hard-stops; no LLM override)
  → optional LLM free→go only on weak template misses
  → confirm (effective_at from snowflake) | soft-pending | hard-reject
  → KV store_v1 → optional Telegram
```

Codex templates include `new usage reset` / `usage reset for paid` (2026-07-21 10M post). Do **not**
reintroduce “admin confirm required for green” — that is obsolete (PLAN v4).

See `docs/PURPOSE.md`, `docs/api-v1-snapshot.md`, `README.md`.
