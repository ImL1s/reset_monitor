# Plan 015: Document D1 as reserved; prune or quarantine dead surfaces

> **Drift check**: `git diff --stat 40002ad..HEAD -- docs/ wrangler.toml app/lib/services/local_reset_notifier.dart`

## Status

- **Priority**: P3 · **Effort**: S · **Risk**: LOW · **Depends on**: 001 · **Category**: docs / tech-debt  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

D1 is bound and migrated but **never read** in runtime. PLAN still says Worker+D1 as live architecture. `local_reset_notifier.dart` is unused. Dead surfaces mislead agents into wrong migrations.

## Current state

- `worker/wrangler.toml` `[[d1_databases]]`; `migrations/0001_init.sql` exists.
- `Env.DB` typed in `index.ts` but unused.
- `HOSTING.md` already notes MemoryStore+KV; reinforce everywhere.
- `app/lib/services/local_reset_notifier.dart` — no importers.

## Scope

**In:** docs (HOSTING, PLAN, README if needed), optional delete or `// unused` quarantine of `local_reset_notifier.dart`, comment on wrangler D1  
**Out:** implementing D1 dual-write; implementing push.

## Steps

### Step 1: HOSTING + PLAN

Single clear statement:

> **Source of truth today:** in-memory `MemoryStore` + KV key `store_v1`. D1 binding/schema is **reserved** for a future migration; do not assume events live in D1.

### Step 2: wrangler comment

Above `[[d1_databases]]`: `# reserved — not used by runtime yet`

### Step 3: Dead Dart

Either delete `local_reset_notifier.dart` or move to `app/lib/services/unused/` with README — prefer **delete** if truly zero refs (confirm with `rg LocalResetNotifier`).

### Step 4: app/README and pubspec description

Replace Flutter template README blurb with pointer to root README + API_BASE.

## Done criteria

- [ ] No doc claims D1 is live primary store
- [ ] Dead notifier removed or clearly quarantined
- [ ] app README not create-flutter default
- [ ] No runtime behavior change

## STOP

- Discover LocalResetNotifier is wired mid-change (keep file).
