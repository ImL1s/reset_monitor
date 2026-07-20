# Plan 006: Banked credit must not drive North-Star “public RESET” green

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/status.ts worker/src/types.ts app/lib/ docs/api-v1-snapshot.md`

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED · **Depends on**: 005 · **Category**: bug  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

PURPOSE: banked announcement **≠** personal refill / hard global blessing. Today any active event (including `banked_credit`) sets `display_status` to `active_confirmed`, so the hero “NOW: public RESET” fires on banked-only.

## Current state

- `deriveDisplayStatus`: `hasActive = !!activeEvent` regardless of type (`status.ts` ~147-169).
- Flutter `verdict_hero` / board treat `active_confirmed` as live RESET.
- Card shows claim_note for banked but same green pill.

## Product decision (freeze for executor)

1. **North-Star green** (`active_confirmed` / degraded): only when **active hard_reset** (and policy_change if product wants — default **hard_reset only**).
2. Active banked → new status e.g. `active_banked` **or** keep `no_recent_confirmed` + show banked as secondary banner (prefer **`active_banked`** additive status for clarity).
3. Notify may still fire for banked (already type in payload) — do not remove notify; fix display only.
4. Additive API field preferred; if new DisplayStatus, update Flutter switch defaults to non-green colors (warning/info, not accent green).

## Scope

**In:**
- `worker/src/types.ts` (`DisplayStatus` union)
- `worker/src/status.ts` (`deriveDisplayStatus`, maybe `buildProviderCard`)
- `worker/test/status.test.ts`
- `app/lib/widgets/status_visual.dart`, `verdict_hero.dart`, `board_page.dart` as needed
- `docs/api-v1-snapshot.md` one table row

**Out:** changing auto_publish banked detection logic; forecast.

## Steps

### Step 1: RED tests

- Active banked only → display **not** `active_confirmed`.
- Active hard_reset → still `active_confirmed`.
- Active hard_reset + banked both in TTL → hard wins green; banked can appear in last or body.

### Step 2: deriveDisplayStatus

Thread `activeEvent` type:

```ts
const hardActive = activeEvent?.type === "hard_reset" ? activeEvent : null;
const bankedActive = activeEvent?.type === "banked_credit" ? activeEvent : null;
// priority: hard green > banked special > pending > …
```

Or: only pass hard as `activeEvent` into derive for green, attach banked separately on card (cleaner for API: `active_event` remains any active for detail, but `display_status` uses hard-only).

**Recommended API (minimal break):**
- `active_event` remains the newest in-TTL event of any type (after plan 005).
- `display_status` green only if that event (or any in-TTL) is hard_reset.
- If only banked active → `active_banked` (new enum value).

### Step 3: Flutter StatusVisual

Map `active_banked` → amber/info label e.g. `NOW: banked offer · not auto refill`, color `RadarColors.warning` or `info`, **not** accent green.

Hero `hasNow` true only for hard green statuses.

### Step 4: Docs + `npm test` + flutter test

## Done criteria

- [ ] Banked-only never yields `active_confirmed`
- [ ] Hard-reset active still green
- [ ] Flutter maps new status without green “public RESET”
- [ ] api-v1-snapshot documents status
- [ ] worker + app tests pass

## STOP

- Breaking schema_version clients without additive path — prefer additive status string clients ignore safely.
- Product owner wants banked as green (report; do not implement opposite of PURPOSE without confirmation).
