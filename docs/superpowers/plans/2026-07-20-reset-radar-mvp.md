# RESET Radar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a zero-auth public RESET board (Codex + Claude) with semi-manual admin path, state-machine tests, Flutter board, historical seed demo, and verification evidence.

**Architecture:** Hono API (local MemoryStore; CF Worker-ready) exposes `GET /v1/snapshot` + admin confirm flow. Flutter Web/App reads snapshot only. Freshness from operator heartbeat; green light only after admin confirm.

**Tech Stack:** TypeScript + Hono + tsx tests; Flutter + http; fixtures JSON; docs in `docs/`.

**Spec sources:** `docs/PURPOSE.md`, `docs/PLAN.md` v3, `docs/api-v1-snapshot.md`

---

## File map

| Path | Responsibility |
|------|----------------|
| `worker/src/types.ts` | Domain types + CONFIG |
| `worker/src/status.ts` | Health, display_status, classifiers |
| `worker/src/store.ts` | MemoryStore ingest/confirm/retract |
| `worker/src/app.ts` | HTTP routes public + admin |
| `worker/src/seed.ts` | Historical backfill |
| `worker/src/notify.ts` | Telegram outbox stub |
| `worker/src/local-server.ts` | Node serve :8787 (ADMIN_DEV_BYPASS=1) |
| `worker/test/*.test.ts` | Unit + integration + notify |
| `worker/public/admin.html` | Minimal admin UI |
| `app/lib/main.dart` | Board + Timeline |
| `fixtures/*.json` | Classifier fixtures |
| `scripts/verify-mvp.sh` | Verification gate |
| `scripts/agy-research-local.sh` | Local multi-agy research |

---

### Task 1: Integration tests — DONE

- [x] integration.test.ts ingest→confirm→retract
- [x] npm test 21 pass

### Task 2: Admin HTML — DONE

- [x] worker/public/admin.html + GET /admin

### Task 3: Flutter Timeline + tests — DONE

- [x] Board + Timeline nav
- [x] flutter test pass

### Task 4: Telegram stub — DONE

- [x] notify.ts + tests + confirm/retract enqueue

### Task 5: Verify script — DONE

- [x] scripts/verify-mvp.sh → VERIFY_MVP_OK

### Task 6–7: Review + verification

- [x] Grok verifier REQUEST CHANGES → fixed admin fail-closed
- [x] Code reviewer dispatched
- [x] Fresh verification evidence: tests + curl + flutter

---

## Out of MVP (explicit)

- Real Telegram bot token
- D1 production persistence
- Auto X crawl
- Six-provider fake greens
- App store release
