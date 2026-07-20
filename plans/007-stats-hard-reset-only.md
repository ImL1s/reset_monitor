# Plan 007: Stats timing and board cadence from hard_reset only (Codex-scoped cadence)

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/pipeline/stats.ts app/lib/pages/board_page.dart docs/api-v1-snapshot.md worker/test/stats.test.ts`

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: MED (public stats numbers change) · **Depends on**: none · **Category**: bug  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

`/v1/stats` uses **all** event types for `last_reset_at` / intervals / drought. Banked announcements move “days since last reset”. Board builds cadence intervals from **all providers’** hard_resets while UI labels Codex metrics.

## Current state

- `worker/src/pipeline/stats.ts` — filters non-retracted only; intervals from all types.
- Forecast already hard-only (`status.ts` / `forecast.ts`).
- `board_page.dart` `fetchEvents(limit: 60)` no provider filter.

## Scope

**In:** `stats.ts`, `stats.test.ts`, `board_page.dart` (and helper `_intervalsFromEvents`), `api-v1-snapshot.md` stats section  
**Out:** changing hard_reset_count formulas beyond documenting; forecast.

## Steps

### Step 1: RED stats tests

Two hard + one banked between them: `last_reset_at` must equal last **hard**; avg interval ignores banked.

### Step 2: Implement stats

```ts
const hard = list.filter((e) => e.type === "hard_reset");
// compute last/avg/drought from hard only
// keep banked_credit_count / total_confirmed as today
```

If zero hard: null timing fields like empty.

### Step 3: Board cadence

Filter `events.items.where((e) => e.provider == 'codex' && e.type == 'hard_reset')` or pass `provider=codex` if API supports (it does: `app.ts` query `provider`).

Prefer API filter: `fetchEvents(limit: 60, provider: 'codex')` if RadarApi allows; else client filter.

### Step 4: Document in api-v1-snapshot

“last_reset_at / avg_interval_days / longest_drought_days are hard_reset-only.”

## Done criteria

- [ ] Banked does not move last_reset_at
- [ ] Cadence intervals Codex hard only
- [ ] tests pass; docs note

## STOP

- External consumers require mixed-type drought (unlikely; document breaking change in commit).
