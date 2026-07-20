# Plan 002: Add CI, AGENTS.md, .env.example, typecheck script

> **Drift check**: `git diff --stat 40002ad..HEAD -- package.json worker/package.json scripts/ .gitignore README.md`

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none · **Category**: dx  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

No `.github/` workflows. False-green regression can merge if nobody runs `npm test` locally. `.gitignore` allows `.env.example` but file missing; no `AGENTS.md` for non-Claude agents; worker has no `typecheck` script; verify scripts hardcode a user FVM path.

## Current state

- Verify: `scripts/verify-parity.sh` runs `cd worker && npm test` and flutter via `/Users/iml1s/fvm/default/bin`.
- Worker scripts: `dev`, `dev:local`, `test`, `deploy` only (`worker/package.json`).
- Secrets named in README: `ADMIN_TOKEN`, `OPENCODE_GO_API_KEY`, `TELEGRAM_*`, flags `AUTO_PUBLISH`, `MONITORING_ENABLED`.
- Never put real secret **values** in examples.

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Worker tests | `cd worker && npm test` | exit 0 |
| Typecheck (after add) | `cd worker && npm run typecheck` | exit 0 |
| Flutter | `cd app && flutter analyze && flutter test` | exit 0 |

## Scope

**In:**
- `.github/workflows/ci.yml` (create)
- `AGENTS.md` (create at repo root)
- `worker/.env.example` and/or `.env.example` (create; empty values only)
- `worker/package.json` (add typecheck)
- `scripts/verify-parity.sh`, `scripts/verify-mvp.sh` (PATH detection)
- `.gitignore` only if adding `**/.dev.vars` (also plan 008)

**Out:** changing runtime auth, enabling paid services.

## Steps

### Step 1: `worker/package.json`

Add: `"typecheck": "tsc -p tsconfig.json --noEmit"`

**Verify**: `cd worker && npm run typecheck` → 0 errors (fix any pre-existing if trivial; if large unrelated errors, STOP and report).

### Step 2: CI workflow

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  worker:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: worker } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm, cache-dependency-path: worker/package-lock.json }
      - run: npm ci --legacy-peer-deps
      - run: npm run typecheck
      - run: npm test
  flutter:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: app } }
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { channel: stable }
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test
```

**Verify**: YAML valid; paths match monorepo layout.

### Step 3: `.env.example`

Document names only, empty values:

```
ADMIN_TOKEN=
ADMIN_DEV_BYPASS=0
AUTO_PUBLISH=1
MONITORING_ENABLED=1
OPENCODE_GO_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
LLM_GATE_MODE=opencode_free_then_go
```

### Step 4: `AGENTS.md`

Include: product one-liner; false-green = P0; client must not compute TTL; free-auto flow; verify commands; link PURPOSE + api-v1-snapshot; forbid inventing admin-only green.

### Step 5: Fix verify scripts PATH

```bash
if command -v flutter >/dev/null; then FLUTTER=flutter
elif command -v fvm >/dev/null; then FLUTTER="fvm flutter"
elif [ -x "$HOME/fvm/default/bin/flutter" ]; then FLUTTER="$HOME/fvm/default/bin/flutter"
else echo "flutter missing"; exit 1; fi
```

## Done criteria

- [ ] CI file exists and covers worker + flutter
- [ ] `npm run typecheck` works
- [ ] AGENTS.md + .env.example exist (no secret values)
- [ ] verify scripts not hardcoding only one absolute FVM path
- [ ] README index 002 DONE

## STOP

- `tsc` reports hundreds of errors (report; don't mass-disable strict).
- Flutter action version unavailable (pick latest documented).
