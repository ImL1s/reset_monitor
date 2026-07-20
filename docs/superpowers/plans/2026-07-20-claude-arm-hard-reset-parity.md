# Claude Arm Hard-Reset Parity Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make Claude public hard-reset detection as solid as Codex free-auto: soft classify funnel → strict templates + phrase floor + scope → optional LLM; zero false green on known negatives.

**Architecture:** Keep free-auto cron/FxTwitter/Dayclaw unchanged. Fix Claude-only gap: `classifyClaudeText` must not hard-kill variants before `pending_review`; expand `CLAUDE_STRONG`; require global scope on Claude rules path; add fixtures + gate tests. Public announcement radar only — no personal quota.

**Tech Stack:** Cloudflare Worker TypeScript, node:test, existing auto_publish / status / store pipeline.

**Research inputs:** multi-agent critic/architect/code-reviewer + user agy A4/A5 (codex-resets + ClaudeDevs).

---

### Task 1: Soft classify for Claude (stop ingest false-quiet)

**Files:**
- Modify: `worker/src/status.ts` — `classifyClaudeText`
- Modify: `worker/test/status.test.ts`

**Done when:**
- Variant texts (`just`, `the`, co-presence reset+limits) → `excluded: false`, hits > 0
- Teaser / negation still hard excluded
- Bare chatter without reset+usage co-presence → still `no_phrase_hit` excluded (no LLM spam)
- API "raised rate limits" / promo higher: either excluded as hard-negative OR pending but must not strong-green (Task 2–3)

---

### Task 2: Expand CLAUDE_STRONG + Claude scope gate

**Files:**
- Modify: `worker/src/pipeline/auto_publish.ts`
- Modify: `worker/test/auto_publish.test.ts`, `worker/test/hardening.test.ts`

**Done when:**
- Known goods green: fixture, everyone variant, Pro/Max variant, `the`/`just` variants
- Claude rules require `hasGlobalScopeSignal` (or Pro/Max scope)
- Bare "rate limits for all users" without reset → no strong green
- Catchphrase-style / raised / 50% higher / everyone affected → not ok

---

### Task 3: Negative + positive fixtures + claude_gate test

**Files:**
- Create: `fixtures/claude-neg-api-raise.json`
- Create: `fixtures/claude-neg-promo-higher.json`
- Create: `fixtures/claude-neg-affected-only.json`
- Create: `fixtures/claude-hard-reset-variant-the.json`
- Create: `worker/test/claude_gate.test.ts`

**Done when:**
- All positives promote; all negatives reject; no false green

---

### Task 4: Pipeline E2E mock soft-path

**Files:**
- Modify: `worker/test/pipeline.test.ts` if needed
- Run: `cd worker && npm test`

**Done when:** 0 fail

---

### Task 5: Docs + commit + deploy

**Files:**
- Modify: `README.md` one line Claude soft/strong
- Commit, push, wrangler deploy (worker)

**Out of scope:** personal quota, 6 providers, trq212 poll (defer), paid X API, architecture rewrite

---
