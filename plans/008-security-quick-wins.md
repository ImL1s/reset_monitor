# Plan 008: Security quick wins (share XSS, token compare, loopback, headers, gitignore)

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/app.ts worker/src/local-server.ts .gitignore worker/test/`

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none · **Category**: security  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

Several small, high-confidence fixes reduce XSS, LAN admin exposure, and secret hygiene without architecture change.

## Current state

1. **Share HTML** (`app.ts` ~255-281): `desc` from titles; only `"` → `'`; body `<p>${desc}</p>` unescaped.
2. **Admin token** (`app.ts` ~24-27): `got === expected`.
3. **local-server** (`local-server.ts:7,31`): `ADMIN_DEV_BYPASS=1`, `serve({ fetch, port })` no hostname → all interfaces.
4. **No security headers** on `/admin` and `/share`.
5. **`.gitignore`**: ignores `.env` but not Wrangler `.dev.vars`.

## Scope

**In:** `worker/src/app.ts`, `worker/src/local-server.ts`, `.gitignore`, small `worker/test/` for escape + token compare if extracted  
**Out:** CF Access JWKS implementation; CORS redesign (plan 009); admin UI token field (009).

## Steps

### Step 1: `escapeHtml` helper

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Use for OG content and body text on `/share`.

**Verify**: unit test or integration: title with `<script>` appears escaped in response body.

### Step 2: timing-safe admin compare

```ts
function adminTokenOk(got: string, expected: string): boolean {
  if (!expected || !got) return false;
  const a = new TextEncoder().encode(got);
  const b = new TextEncoder().encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle /* or node crypto.timingSafeEqual in tests */ 
}
```

Workers support `crypto.subtle` — for timing-safe equality on equal length, use:

```ts
import { timingSafeEqual } from "node:crypto"; // may not work on Workers
```

On Workers, implement constant-time loop over bytes (no early return on mismatch beyond length check).

**Verify**: wrong token still 401; right token 200 when ADMIN_TOKEN set (with plan 009 tests, or temporary unit on pure function).

### Step 3: local-server bind

```ts
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
```

Log the same.

### Step 4: HTML security headers

For `/admin` and `/share` responses:

```
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

(Adjust if CSP breaks admin inline script — admin uses inline script so `script-src 'unsafe-inline'` required unless externalize.)

### Step 5: gitignore

```
.dev.vars
**/.dev.vars
!.dev.vars.example
```

## Done criteria

- [ ] Share escapes HTML special chars
- [ ] Token compare constant-time for equal lengths
- [ ] local-server binds 127.0.0.1
- [ ] HTML routes send CSP/frame-ancestors
- [ ] .dev.vars ignored
- [ ] `npm test` pass

## STOP

- CSP breaks admin page in browser (relax carefully; report).
- Workers runtime rejects chosen crypto API (use pure JS constant-time).

## Note

Never write real token values into tests; use random strings generated in test.
