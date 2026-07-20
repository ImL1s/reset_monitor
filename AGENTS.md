# AGENTS.md — RESET Radar

## Product (one line)

Zero-login public board: did **Codex / Claude staff** announce a **hard usage reset**? Not personal quota bars.

## Hard rules

1. **False green = P0.** Never green on keyword-only, teaser, promo, partial, quote-replay, or banked-as-hard.
2. Client **must not** compute TTL; trust server `display_status`.
3. Green = allowlisted author + strict template and/or LLM gate **auto-confirm**. Admin = emergency retract / manual pipeline only.
4. `next_48h` is heuristic only — never notify, never green.
5. No AI account login on the public board; no server-side user tokens.

## Layout

| Path | Role |
|------|------|
| `worker/` | Cloudflare Worker API + free-auto cron |
| `app/` | Flutter Web (primary) + mobile shell |
| `docs/` | PURPOSE, PLAN, api-v1-snapshot, HOSTING |
| `plans/` | Advisor implementation plans |
| `fixtures/` | Gate fixtures |

## Verify

```bash
cd worker && npm test
cd worker && npm run typecheck   # if present
cd app && flutter analyze && flutter test
./scripts/verify-parity.sh
```

## Free-auto flow

```
Cron */10 → FxTwitter → Dayclaw fallback → ingest (allowlist + classify)
  → shouldAutoPublish → optional LLM free→go → confirm | soft-pending | reject
  → KV persist → optional Telegram
```

See `docs/PURPOSE.md`, `docs/api-v1-snapshot.md`, `README.md`.
