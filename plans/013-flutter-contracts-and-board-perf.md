# Plan 013: Flutter API contract tests + board parallel fetch + events Cache-Control

> **Drift check**: `git diff --stat 40002ad..HEAD -- app/lib/ worker/src/app.ts docs/api-v1-snapshot.md app/test/`

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: LOW · **Depends on**: 006 optional · **Category**: tests / perf  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Flutter only lightly tests next_48h parse + shell. Board does 4 serial network calls. `/v1/events` lacks Cache-Control while snapshot/stats have it.

## Current state

- `app/test/`: `forecast_model_test.dart`, `widget_test.dart`.
- `board_page.dart` refresh: await snapshot then stats then monitor then events.
- `app.ts` events route: no Cache-Control header.

## Scope

**In:**
- `app/test/` new golden JSON tests for Snapshot/Stats/Event models
- `app/lib/pages/board_page.dart`
- `app/lib/services/radar_api.dart` if needed for provider query
- `worker/src/app.ts` Cache-Control on events
- `docs/api-v1-snapshot.md` cache note

**Out:** Riverpod migration; redesign UI.

## Steps

### Step 1: Golden fixtures

Create `app/test/fixtures/snapshot_sample.json` shaped like production `/v1/snapshot` (minimal 2 providers). Parse with `SnapshotResponse.fromJson` / `ProviderCardData`. Assert:
- display_status present
- next_48h optional
- no throw on null active_event

Also stats + one timeline item. Fix `TimelineResponse` force unwrap if needed to return null-safe.

### Step 2: Parallel board fetch

```dart
final snapFut = api.fetchSnapshot();
final statsFut = api.fetchStats().then<StatsResponse?>((v) => v).catchError((_) => null);
// same for monitor, events
final snap = await snapFut;
final results = await Future.wait([statsFut, monFut, eventsFut]);
```

Or:
```dart
final snap = await api.fetchSnapshot();
await Future.wait([
  () async { try { st = await api.fetchStats(); } catch (_) {} }(),
  ...
]);
```

Keep snapshot failure as hard error; others soft.

### Step 3: Events cache on worker

Match snapshot:

```
Cache-Control: public, max-age=15, s-maxage=30, stale-while-revalidate=60
```

### Step 4: Analyze + test

```bash
cd app && flutter analyze && flutter test
cd worker && npm test
```

## Done criteria

- [ ] ≥3 new Flutter model tests with fixtures
- [ ] Board refresh not strictly serial for secondary calls
- [ ] Events endpoint has Cache-Control
- [ ] analyze clean; tests pass

## STOP

- Golden fixture drifts from live API fields (update fixture, don't invent fields).
