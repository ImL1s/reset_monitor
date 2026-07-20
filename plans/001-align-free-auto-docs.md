# Plan 001: Align PLAN/PURPOSE with free-auto production truth

> **Executor instructions**: Follow step by step. Verify each gate. STOP if drift. Update `plans/README.md` status when done.
>
> **Drift check**: `git diff --stat 40002ad..HEAD -- docs/PLAN.md docs/PURPOSE.md docs/FULL_AUDIT.md README.md docs/HOSTING.md`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `40002ad`, 2026-07-21

## Why this matters

Runtime is **free-auto** (cron + strict templates + optional LLM → green). `docs/PLAN.md` still says green requires **admin confirm**. Executors and humans reintroduce human gates or distrust the real pipeline. Docs that lie are worse than missing docs.

## Current state

- **Truth**: `worker/wrangler.toml` `AUTO_PUBLISH = "1"`; `worker/src/pipeline/run_cycle.ts` auto `store.confirm`; `README.md` free-auto table; `docs/PURPOSE.md` success metrics mention auto-confirm.
- **Stale**: `docs/PLAN.md` HARD RULE #2 (~line 22): “Confirmed 綠燈 = … **admin 核准**”; §3.5 / decision table still admin-confirm; checklist may show unfinished items already shipped.
- **FULL_AUDIT.md**: pre-ship narrative (“Admin API 可開工”) while production URLs exist.

Conventions: Traditional Chinese ok in docs; keep English code identifiers.

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Diff only docs | `git diff --stat` | only docs/README listed |
| Grep stale claim | `rg -n "admin 核准|Admin confirm" docs/PLAN.md` | no remaining HARD RULE claiming admin is required for green |

## Scope

**In scope:**
- `docs/PLAN.md`
- `docs/PURPOSE.md` (only contradictory rows)
- `docs/FULL_AUDIT.md` (banner only)
- `README.md` only if it still contradicts free-auto

**Out of scope:** any `worker/` or `app/` code; enabling/disabling AUTO_PUBLISH.

## Git workflow

- Branch: `advisor/001-align-free-auto-docs`
- Commit: `docs: align PLAN with free-auto green and emergency-only admin`

## Steps

### Step 1: Rewrite PLAN hard rules

In `docs/PLAN.md`:

1. HARD RULE #2 → green = **allowlisted staff post + strict template and/or LLM gate auto-confirm**; admin is **emergency retract / manual ingest / pipeline trigger only**.
2. Update transition table so `promoted` includes `auto_rules` / `auto_rules_llm`.
3. Mark checklist items done when code already ships (Board, free-auto, fixtures, admin HTML, TG optional).
4. Fix tech stack: **MemoryStore + KV** (not “D1 live”); Flutter **no Riverpod/go_router** unless already added (as of plan: IndexedStack).
5. Remove “自動只到 detected” if present.

**Verify**: `rg -n "admin 核准|人工 confirm.*綠" docs/PLAN.md` → no false requirement for green.

### Step 2: PURPOSE decision table consistency

If PURPOSE still says “X 資料人工／半自動” next to free-auto green, change X ingest to “free-auto poll (FxTwitter/Dayclaw) + rules/LLM”. Keep Phase 2 personal mobile-only.

**Verify**: open PURPOSE success + decision tables; no internal contradiction on how green is created.

### Step 3: FULL_AUDIT banner

Top of `docs/FULL_AUDIT.md`:

```markdown
> **Historical** (2026-07-20 pre-ship). Current truth: root `README.md`, `docs/PURPOSE.md`, free-auto pipeline.
```

**Verify**: first 15 lines contain “Historical”.

## Test plan

- No code tests. Human: README free-auto section still accurate.

## Done criteria

- [ ] PLAN no longer requires admin for normal green
- [ ] PURPOSE free-auto narrative consistent
- [ ] FULL_AUDIT marked historical
- [ ] No worker/app code changed
- [ ] `plans/README.md` row 001 → DONE

## STOP conditions

- Product owner insists admin-only green must return (report; do not change runtime).
- Files above missing or heavily rewritten beyond excerpts.

## Maintenance notes

Any future product change to reintroduce human confirm must update PLAN + PURPOSE in the same PR as `AUTO_PUBLISH=0`.
