# Plan 009: Admin auth tests, UI token, confirm bounds, bootstrap gate, monitor/CORS harden

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/app.ts worker/src/admin_html.ts worker/src/index.ts worker/src/pipeline/opencode_zen_gate.ts worker/test/`

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED · **Depends on**: 008 · **Category**: security  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Production admin is header-token only, but UI never sends the token; tests always enable bypass so 401 regressions pass CI. Confirm body accepts arbitrary type/TTL. Any HTTP request can bootstrap pipeline+LLM. Public monitor leaks adapter errors; CORS allows admin token from any origin.

## Current state

- `isAdmin` (`app.ts` 17-31): bypass → token equality → else false. Comment mentions CF Access JWT but **never validates** header.
- `ADMIN_HTML` fetch: only `content-type`, no `X-Admin-Token`.
- `integration.test.ts` sets `ADMIN_DEV_BYPASS=1` globally.
- `index.ts` 102-112: bootstrap pipeline on any request if no `lastPipelineReport`.
- `store.confirm` accepts full body type/scope/display_until.
- Global CORS `origin: "*"` allows `X-Admin-Token`.

## Scope

**In:**
- `worker/src/app.ts`
- `worker/src/admin_html.ts` (and `worker/public/admin.html` if duplicate)
- `worker/src/index.ts`
- `worker/src/pipeline/opencode_zen_gate.ts` (truncate reason bodies)
- `worker/test/integration.test.ts` + new `admin_auth.test.ts`

**Out:** full CF Access JWKS; D1; Flutter.

## Steps

### Step 1: Auth test matrix (bypass off)

Create tests that **do not** leave bypass on:

| Case | Expected |
|------|----------|
| no token, bypass 0 | 401 on POST /admin/v1/heartbeat |
| wrong token | 401 |
| correct `X-Admin-Token` | 200 |
| GET /admin HTML | 200 public (or 401 if you choose to lock — **default keep 200** for static UI) |

Pattern: set globalThis flags in before/after; restore after.

### Step 2: Admin UI token field

Add password/text input `adminToken`; every `api()`:

```js
headers: {
  ...(body ? { 'content-type': 'application/json' } : {}),
  ...(token ? { 'X-Admin-Token': token } : {}),
}
```

Store in `sessionStorage` only (never localStorage commit). Fix copy: remove “本地 bypass 開著” when not local.

### Step 3: Bound confirm body

Allowlist fields; enum `type` ∈ hard_reset|banked_credit|policy_change|other; `scope` ∈ all_paid|subset|unknown; cap `display_until` ≤ now + 72h (or CONFIG max); ignore unknown keys.

### Step 4: Remove request bootstrap pipeline

Delete or gate `index.ts` bootstrap `waitUntil(runMonitoringCycle)` on public fetch. Cron remains owner. Optional: only bootstrap from admin pipeline/run.

### Step 5: Minimize `/v1/monitor`

Public: `ok`, `mode`, `last_run_at`, per-account `{ handle, ok }` booleans — strip raw `error` strings to admin-only last report.

### Step 6: CORS split (careful)

- Keep `origin: "*"` for GET public routes **or** leave global * for GET-only methods.
- For `/admin/v1/*` POST: either require specific ops origins via env `ADMIN_CORS_ORIGINS` or omit ACAO * when `X-Admin-Token` present (hard in Hono — simpler approach: document that token must not be used from browsers on untrusted pages; optional allowlist).

Minimum: set `cors` with `origin: (origin) => origin ?? "*"` for public; for admin routes use middleware that sets `Access-Control-Allow-Origin` to configured list only.

If too risky, **document** as residual and only complete steps 1-5.

### Step 7: LLM error body

In `opencode_zen_gate.ts`, reason = `opencode_http_${status}` without response body slice in stored reason.

### Step 8: Fix CF Access comment

Replace with: “Production: ADMIN_TOKEN required; CF Access JWT verification not implemented.”

## Done criteria

- [ ] Auth matrix tests pass with bypass off
- [ ] Admin HTML can send token
- [ ] Confirm body TTL/type capped
- [ ] No public-request bootstrap pipeline
- [ ] Monitor public payload redacted
- [ ] LLM reasons lack response body snippets
- [ ] `npm test` pass

## STOP

- Breaking all integration tests without a clean restore of bypass for remaining suite — refactor test harness first.
- CORS change breaks Pages production (revert CORS step only).
