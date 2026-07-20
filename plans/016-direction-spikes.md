# Plan 016: Direction spikes (notify, OpenAIDevs, personal mobile) — design only

> **Drift check**: `git diff --stat 40002ad..HEAD -- docs/PURPOSE.md docs/PLAN.md app/lib/services/`

## Status

- **Priority**: P3 · **Effort**: S (docs/spikes only) · **Risk**: LOW if no ship · **Depends on**: 001 · **Category**: direction  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Audit listed grounded product options. Building them now competes with false-green work. This plan only produces **spike writeups** under `docs/spikes/` — **no production feature merge** unless operator later prioritizes.

## Spikes to write (each ≤1 page)

### Spike A — Browser / tab notify

- Evidence: full-auto plan F13; dead `LocalResetNotifier`.
- Options: (1) poll + `Notification` API when tab granted; (2) Web Push VAPID + KV subscriptions.
- Must not notify on forecast-only; only `active_confirmed` hard_reset transitions.
- Open questions: retention of endpoints, spam, Safari.

### Spike B — OpenAIDevs auxiliary poll

- Evidence: allowlist entry with placeholder user id; `MONITORED_ACCOUNTS` only Tibo + ClaudeDevs.
- Requirements: real numeric X user id; fixtures; same strict gate; no green from product marketing posts.
- Blocked until plan 010 userId enforcement.

### Spike C — Phase 2 personal quota (mobile only)

- Evidence: PURPOSE Phase 2; forbid WebView session.
- For each provider: official usage API? OAuth scopes? Token storage on device only?
- Explicit **non-goals**: server-side token proxy, web personal layer.
- Deliverable: go/no-go table, not code.

### Spike D — KV→D1/DO (only after 012)

- Reference LWW tests from plan 012.
- Compare: versioned KV CAS vs Durable Object single writer vs D1 transactions.
- Do not implement in this plan.

## Scope

**In:** `docs/spikes/*.md` create  
**Out:** shipping push, new accounts, OAuth apps, D1 cutover.

## Steps

1. Create `docs/spikes/README.md` index.
2. Write A–D markdown files with evidence links to repo paths.
3. Link from PURPOSE or PLAN “Future” section once.

## Done criteria

- [ ] Four spike docs exist with trade-offs and open questions
- [ ] No production runtime change
- [ ] Explicit “do not implement without new plan”

## STOP

- Operator demands full implementation in this ticket — split to new plans with TDD scopes.
