# Plan 010: Enforce author allowlist by stable userId

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/store.ts worker/src/pipeline/run_cycle.ts worker/src/sources/`

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: MED · **Depends on**: 009 · **Category**: security  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Ingest allowlist keys only on **handle**. `author_user_id` is stored from input or allowlist default **without** equality check. Placeholder `xuid_openaidevs_mvp` can never match real X ids. Handle spoof weakens the root of auto-green trust.

## Current state

- `AUTHOR_ALLOWLIST` in `store.ts` (~70+): maps handle → `{ userId, authority }`.
- Ingest (~170-194): handle check only.
- Auto cycle filters handle match but may not assert userId.

## Scope

**In:** `store.ts` ingest, `run_cycle.ts` account filter, fixtures/tests, allowlist entries (real ids only when known)  
**Out:** adding OpenAIDevs to poll list (plan 016); paid X API.

## Steps

### Step 1: Policy freeze

1. If `author_user_id` **present** and allowlist has `userId`, require **exact match** or reject.
2. If `author_user_id` **absent** (adapter gap):  
   - Auto path: **reject** promote (fail closed) **or** allow handle-only with warning for one release — **prefer fail closed for auto-green**; admin ingest may allow handle-only with `warnings.push("missing_user_id")`.
3. Remove or disable placeholder OpenAIDevs until real id known.

### Step 2: RED tests

- Mismatched userId → ingest rejected / no pending promote.
- Matching userId + handle → ok.
- Missing userId on auto path → no green.

### Step 3: Wire FxTwitter/Dayclaw ids

Confirm adapters pass `authorUserId` into ingest. If not, map field names.

### Step 4: Full suite

## Done criteria

- [ ] Mismatched userId cannot publish
- [ ] Placeholder OpenAIDevs not auto-trusted
- [ ] Tests cover match/mismatch/missing
- [ ] `npm test` pass

## STOP

- Adapters never provide user ids in production payloads (report; need adapter fix before fail-closed auto).
