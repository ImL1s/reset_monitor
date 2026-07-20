# Plan 004: Set auto-promote effective_at from post time (not poll time)

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/pipeline/run_cycle.ts worker/src/status.ts worker/src/store.ts worker/test/`

## Status

- **Priority**: P0 · **Effort**: S · **Risk**: LOW · **Depends on**: none · **Category**: bug  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Auto path calls `store.confirm` without `effective_at`. Store defaults to **now**, so a late re-ingest of an old hard-reset post opens a **fresh 24h green window**. Seed path already uses announcement time. Product contract: green = confirmed event still inside TTL from the **event**, not discovery.

## Current state

```ts
// run_cycle.ts ~201-207
const ev = store.confirm(cand.id, {
  type: gate.type,
  title: gate.title,
  decision_by: decisionBy,
  decision_reason: gate.reason,
  body_excerpt: cand.raw_text.slice(0, 280),
});
```

```ts
// store.ts ~282-285
const effective = body.effective_at ?? now;
const displayUntil = body.display_until ?? addHours(effective, ttlHoursForType(type));
```

`snowflakeToMs` exists in `status.ts` (~71-80). Sources expose `createdAt` on posts.

## Commands

| Tests | `cd worker && npm test` | 0 fail |

## Scope

**In:** `worker/src/pipeline/run_cycle.ts`, maybe tiny helper in `status.ts` export already, `worker/test/pipeline.test.ts` or new unit.

**Out:** changing seed history; admin confirm may keep body override (document).

## Steps

### Step 1: RED test

Simulate candidate with known snowflake post_id whose tweet time is >24h ago; promote path must not leave `display_until` > now if using effective+24h from announcement (or assert `effective_at` equals snowflake time, not confirm time).

### Step 2: Compute announcement time

```ts
function announcementIso(cand: EventCandidate): string {
  const ms = snowflakeToMs(cand.post_id);
  if (ms != null) return new Date(ms).toISOString();
  // optional: cand has no created_at field today — snowflake is primary
  return nowIso(); // last resort
}
```

Pass to confirm:

```ts
const effective_at = announcementIso(cand);
const ttlH = /* same as store ttlHoursForType */;
const display_until = addHours(effective_at, ttlH);
// If display_until <= now, still confirm for history but no active green (desired)
store.confirm(cand.id, { ..., effective_at, display_until });
```

Import `snowflakeToMs`, `addHours` from status; use existing `ttlHoursForType` if exported or duplicate switch for hard_reset 24h from CONFIG.

### Step 3: GREEN + full suite

## Done criteria

- [ ] Auto promote sets effective_at from snowflake when possible
- [ ] Late poll of old post does not create active green past natural TTL
- [ ] `npm test` pass
- [ ] plans/README 004 DONE

## STOP

- Snowflake helper wrong for non-X ids (if Claude uses non-snowflake, fall back safely without crashing).
