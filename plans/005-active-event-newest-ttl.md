# Plan 005: Select active_event as newest still-in-TTL event

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/status.ts worker/test/status.test.ts`

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none · **Category**: bug  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

`active = nonRetracted.find(isActiveEvent)` uses Map insertion order. Two overlapping TTL windows can show the **older** post as active and the newer as last_confirmed.

## Current state

```ts
// status.ts ~199-208
const nonRetracted = args.events.filter((e) => !e.retracted_at);
const active = nonRetracted.find((e) => isActiveEvent(e, now)) ?? null;
const sorted = [...nonRetracted].sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
const lastConfirmed =
  sorted.find((e) => !active || e.id !== active.id) ?? sorted[0] ?? null;
```

## Scope

**In:** `worker/src/status.ts`, `worker/test/status.test.ts`  
**Out:** Flutter (consumes active_event as-is).

## Steps

### Step 1: RED — two overlapping actives

Build two hard_reset events with different effective_at, both display_until > now. Older inserted first. Assert active is the **newer** by effective_at.

### Step 2: Implement

```ts
const sorted = [...nonRetracted].sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
const active = sorted.find((e) => isActiveEvent(e, now)) ?? null;
const lastConfirmed =
  sorted.find((e) => !active || e.id !== active.id) ?? null;
```

### Step 3: `npm test`

## Done criteria

- [ ] Newest in-TTL is active_event
- [ ] last_confirmed prefers next by effective_at
- [ ] existing status tests still pass
