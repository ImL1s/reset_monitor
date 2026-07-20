# Plan 014: Dayclaw fallback tests + free-auto HTTP pipeline test + store isolation notes

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/pipeline/run_cycle.ts worker/src/sources/dayclaw.ts worker/test/`

## Status

- **Priority**: P2 · **Effort**: S–M · **Risk**: LOW–MED · **Depends on**: 009 · **Category**: tests  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

FxTwitter empty → Dayclaw is production fallback but untested. Free-auto HTTP path (`POST /admin/v1/pipeline/run`) not covered; only manual ingest→confirm. Global `store` singleton risks test order flakes.

## Current state

- `run_cycle.ts` ~74-104: primary Fx, fallback Dayclaw.
- `pipeline.test.ts`: Fx success or total fail; no Dayclaw success.
- Integration: bypass on; no pipeline/run.

## Scope

**In:** `worker/test/pipeline.test.ts`, `worker/test/integration.test.ts` or new files; minimal DI only if required  
**Out:** rewriting source adapters for beauty; D1.

## Steps

### Step 1: Dayclaw fallback unit test

Mock fetch:
1. FxTwitter returns empty statuses / error.
2. Dayclaw returns one allowlisted hard-reset post JSON shape supported by `dayclaw.ts`.
3. Expect report `source` includes dayclaw (check actual field names in report) and candidate/event created when autoPublish true.

### Step 2: HTTP pipeline/run

With admin token (plan 009) or bypass in controlled test:

- Mock global fetch used by runAutoCycle if injectable; if not, inject `fetchImpl` already supported by `runAutoCycle({ fetchImpl })` — wire admin route to pass mock in tests via exporting runAutoCycle only (unit) **or** test `runAutoCycle` directly (already) **plus** one Hono test that MONITORING_ENABLED=0 returns 503.

Minimum HTTP:
- monitoring disabled → 503
- with bypass + mock cycle → 200 ok (if hard to mock inside route, unit-test runAutoCycle + route flag only).

### Step 3: Store isolation

Add `store.resetForTests?.()` or document `beforeEach` clearing maps if methods exist. If no public reset, add:

```ts
// store.ts test-only
export function __resetStoreForTests() { ... clear maps ... }
```

Only if flakes observed; otherwise note in maintenance.

## Done criteria

- [ ] Dayclaw fallback covered green path
- [ ] pipeline/run flag behavior tested
- [ ] `npm test` stable (run twice if possible)

## STOP

- Dayclaw response shape undocumented and samples unavailable (capture sample from code comments or source parser branches).
