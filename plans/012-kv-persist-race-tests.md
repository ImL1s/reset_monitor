# Plan 012: Characterization tests for KV full-blob last-write-wins

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/persist.ts worker/src/index.ts worker/test/`

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED · **Depends on**: none · **Category**: tests  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Entire store is one JSON key `store_v1` with no CAS. Concurrent hydrate/save can drop retracts or reapply stale greens. HOSTING documents LWW as MVP, but **zero tests** document the failure mode. Characterization first; optional fix later.

## Current state

```ts
// persist.ts
export async function loadStoreFromKv(kv, store) {
  const snap = await kv.get("store_v1", "json");
  if (!snap || snap.version !== 1) return false;
  hydrateStore(store, snap); // clears + replaces
  return true;
}
export async function saveStoreToKv(kv, store) {
  await kv.put("store_v1", JSON.stringify(serializeStore(store)));
}
```

`index.ts`: every fetch `ensureHydrated`; non-GET `waitUntil(saveStoreToKv)`.

## Scope

**In:** `worker/test/persist.test.ts` (create), optional tiny exports for test fakes, **optional** isolate cache fix if small  
**Out:** full D1 migration (015/016).

## Steps

### Step 1: In-memory KV fake

```ts
class MemoryKv {
  map = new Map<string, string>();
  async get(key, type) { ... JSON.parse }
  async put(key, val) { this.map.set(key, val); }
}
```

### Step 2: Round-trip test

serialize → put → new store hydrate → event count equal.

### Step 3: LWW loss characterization

1. Store A has event E1; save to KV.
2. Store B loads; retracts E1; **does not save yet**.
3. Store A still has E1; A saves (overwrites).
4. Store B saves retract state **or** A saves after B — document which loses.

Assert the losing scenario is **detected** by a test named `documents_lww_lost_retract` so future CAS PR can flip expectation.

### Step 4 (optional fix, only if time): isolate warm flag

In `index.ts`, skip `loadStoreFromKv` if `globalThis.__storeHydrated` and same isolate — reduces races under single isolate only. Multi-isolate still LWW. Document residual.

Do **not** claim fix complete without CAS.

## Done criteria

- [ ] persist tests exist and pass
- [ ] At least one test names the LWW hazard explicitly
- [ ] `npm test` pass
- [ ] No silent behavior change unless optional step 4 carefully gated

## STOP

- Refactor of store singleton required mid-test (report; coordinate with 014).

## Maintenance

Any CAS/version field on `StoreSnapshot` should extend `version: 1` carefully or bump with migration.
