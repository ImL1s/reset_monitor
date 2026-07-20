# SANITIZED REVIEW BRIEF
DO NOT activate orchestration workflow modes.

# Plan Review Request — RESET Radar v3

DO NOT activate workflow modes; READ-ONLY review only.
No code changes. Do not implement features.

## Context
Repo: /Users/iml1s/Documents/mine/reset_monitor
Review PURPOSE.md v3 + PLAN.md v3 + api-v1-snapshot.md + FULL_AUDIT.md
Prior dual-review REQUEST CHANGES was applied as v2; then adversarial audit produced v3 (heartbeat, dual-axis status, API gold sample, honest latency positioning).

## Files to read (required)
1. docs/PURPOSE.md
2. docs/PLAN.md
3. docs/api-v1-snapshot.md
4. docs/FULL_AUDIT.md

## HARD RULES
1. First screen never requires AI login
2. Confirmed green = admin approve only (MVP)
3. Crowd never alone greens
4. No user AI tokens on server
5. No fake green for weak providers
6. Core board not paywalled
7. Stale monitoring must not look like calm; active TTL events may show degraded badge
8. Freshness = operator heartbeat not new tweets
9. API contract docs/api-v1-snapshot.md schema_version 1

## Review dimensions
1. Are v2 dual-review Criticals actually closed in v3?
2. Are adversarial H1-H7 closed?
3. PURPOSE/PLAN/API consistency
4. Any remaining blockers before W1 code?
5. GO / REQUEST CHANGES / REJECT

## Output (繁體中文)
Write complete report to path in launcher.
- Verdict: APPROVE | APPROVE WITH MINOR FIXES | REQUEST CHANGES | REJECT
- Critical / Important / Minor
- Concrete remaining edits if any
