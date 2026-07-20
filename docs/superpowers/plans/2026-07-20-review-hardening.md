# Review Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all Critical/High and high-value Medium gaps from the free-auto code review so production never false-greens, never permanently drops true resets on infra blips, and can retry Telegram delivery.

**Architecture:** Keep free-auto pipeline; change reject vs pending semantics; persist notify outbox in KV with the store snapshot; tighten auto-publish for "incoming" wording; require mid-strength phrases for LLM promote.

**Tech Stack:** TypeScript Worker (Hono), MemoryStore + KV, existing tests with tsx.

---

## File map

| Path | Responsibility |
|------|----------------|
| `worker/src/pipeline/run_cycle.ts` | pending vs reject; re-open soft rejects on re-fetch |
| `worker/src/pipeline/auto_publish.ts` | incoming → not hard green; phrase helpers export |
| `worker/src/pipeline/opencode_zen_gate.ts` | timeout on LLM fetch |
| `worker/src/notify.ts` | retry failed; attempts; max retries |
| `worker/src/persist.ts` | serialize/hydrate outbox |
| `worker/src/store.ts` | requeueSoftRejected helper |
| `worker/src/app.ts` | monitor last source accuracy |
| `app/lib/pages/timeline_page.dart` | free-auto empty copy |
| `worker/test/*.ts` | regressions |

---

### Task 1: Soft reject vs hard reject (infra never permanent)

**Files:** Modify `worker/src/pipeline/run_cycle.ts`, `worker/src/store.ts`, tests

- Content rejects (teaser, negation, no_strong_template, llm_reject): `reject`
- Infra reasons (`opencode_http_`, `opencode_network`, `llm_parse`, free_fail|go_fail): leave `pending_review`
- On duplicate: if candidate is rejected with soft reason older or any pending, re-evaluate gate

### Task 2: Notify outbox KV + retry failed

**Files:** `notify.ts`, `persist.ts`, `index.ts` hydrate outbox

- Persist items with status pending/failed
- drain retries failed with attempts < 5
- stub without secrets marks skipped not sent (so real secrets can send later) — careful: may spam. Better: status `skipped_no_config` and only retry when token appears; don't mark as sent.

### Task 3: Incoming wording not immediate hard_reset green

**Files:** `auto_publish.ts`

- If text matches future/incoming patterns without past-tense confirmation, return ok:false reason `scheduled_incoming` (or promote with type note — plan said scheduled type). Simplest: reject hard green with `scheduled_incoming` so stays pending or content-reject without green until past-tense post.

Actually historical corpus includes "rate limit reset incoming" as events on codex-resets - they treated as resets. Reviewer said risk of early green. Compromise:
- If ONLY incoming future language without "have reset" / "I have reset" past → `ok:false` reason `scheduled_incoming` keep pending? That permanently pend. Better: still auto publish but title "Reset incoming (auto)" and shorter TTL 6h OR leave pending.

Simplest shipping fix per reviewer: do not treat pure "reset incoming" as enough for strong alone without past confirmation phrases.

### Task 4: LLM promote phrase floor

Require at least one of mid-strength usage phrases in text before accepting LLM promote.

### Task 5: Polish monitor source + timeline copy + LLM timeout

### Task 6: Full test, deploy, commit, push
