# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**RESET Radar** — a zero-auth public radar that answers one question: does Codex / Claude
currently have a **public, auditable hard RESET** (provider-wide quota refill)? Not personal quota.
Green ≠ your account is refilled. See `docs/PURPOSE.md` for the product contract and hard rules;
it is the source of truth and overrides convenience.

Two deployables in one repo:
- `worker/` — Cloudflare Worker (Hono + TypeScript). The API, auto-detection pipeline, and cron.
- `app/` — Flutter client (Web-first; iOS/Android share the same shell). Package name `reset_radar`.

## Commands

### Worker (from `worker/`)
```bash
npm install --legacy-peer-deps
npm test                       # tsx --test test/*.test.ts (all tests)
tsx --test test/foo.test.ts    # run a single test file
npm run dev:local              # local Hono server on :8787, ADMIN_DEV_BYPASS=1
npm run dev                    # wrangler dev (Worker runtime)
npm run deploy                 # wrangler deploy
```
Local endpoints: `/v1/snapshot`, `/v1/stats`, `/v1/monitor`, `/admin` (bypass on in dev:local).

### Flutter app (from `app/`)
```bash
flutter pub get
flutter run -d chrome --dart-define=API_BASE=http://127.0.0.1:8787   # against local worker
flutter analyze                # MUST pass before commit (see CLAUDE global rules)
flutter test                   # unit/widget tests (test/forecast_model_test.dart, widget_test.dart)
flutter build web --release --dart-define=API_BASE=<prod-url>
```
`API_BASE` defaults to production (`radar_api.dart`) when the define is omitted.

### End-to-end verification
```bash
./scripts/verify-parity.sh     # worker tests + parity checks
./scripts/verify-mvp.sh
```

## Architecture

### Worker: free-auto detection pipeline
Entry `src/index.ts` exposes `fetch` (HTTP) and `scheduled` (cron `*/10`). Both call
`ensureHydrated` (loads KV into the in-memory `store`, seeds historical fixtures on cold start)
then `runMonitoringCycle`. The pipeline (`src/pipeline/run_cycle.ts`):

1. Poll allowlisted staff timelines — `sources/fxtwitter.ts` (primary) → `sources/dayclaw.ts` (fallback).
2. `ingest` (allowlist + classify) → `pipeline/auto_publish.ts` **strict templates**.
3. On template miss, `pipeline/llm_gate.ts` asks an LLM (OpenCode Zen **free** → Go subscription only
   if the free tier has an *infra* failure). LLM can never green a signal that fails the rule floor.
4. Outcome: `confirm` (green) | `soft-pending` (amber, not a RESET) | `hard-reject`.
5. `notify.ts` Telegram outbox (only if secrets set) → persist store to KV (`persist.ts`).

Global config is injected via `applyEnv` writing to `globalThis` (see `Env` in `index.ts`);
`store.ts` is a module-level singleton persisted to KV. `pipeline/forecast.ts` computes the
**NEXT 48h heuristic** from *own* hard-reset intervals only (never scrapes competitors, never notifies).

### The false-green invariant (most important rule)
A false green is the **highest-severity incident**. Guardrails, all enforced worker-side:
- Both rules **and** LLM must clear a usage-phrase floor **+ scope** (all-users). Staff catchphrases
  alone never go green. Teaser / "incoming" / negated sentences are rejected (see `fixtures/`).
- Fail-closed: a source past its freshness SLA shows **source unhealthy / unknown**, never "calm".
- Green has a TTL (`display_until`, default ~24h). Green = "most recent confirmed event still inside
  its window", not a permanent state.
- **The client must never compute TTL or status.** It always trusts the server's `display_status`.
  Any status logic belongs in the worker, not in Flutter.

### Public API (no auth)
`GET /health`, `/v1/snapshot` (provider cards + `display_status`), `/v1/events?limit=`,
`/v1/stats` (count/interval/drought, computed on `effective_at`), `/v1/monitor` (mode + last poll),
`/share` (OG HTML). Admin routes (`/admin/v1/*`: ingest, candidates confirm/reject, retract, pipeline
run, heartbeat) require `X-Admin-Token` in production; day-to-day needs no human confirm — admin is for
**emergency retract / manual pipeline** only. Contract detail: `docs/api-v1-snapshot.md`.

### Flutter client
`main.dart` → `HomeShell` with a `ResponsiveShell` (bottom nav on phone, NavigationRail on
tablet/desktop) over 3 pages: `board_page.dart` (hero "現在有沒有 / 上次多久 / NEXT 48h" + provider
bento grid), `timeline_page.dart`, `about_page.dart`. `services/radar_api.dart` is the only HTTP layer;
`models/api_models.dart` mirrors the API contract; `widgets/provider_status_card.dart` +
`widgets/status_visual.dart` render one provider's status (icon+label+color, color never the sole cue).
Theme lives in `theme/radar_theme.dart` (OLED dark palette, Space Grotesk headings / DM Sans body).

## Design system

`design-system/MASTER.md` is the authoritative UI spec: OLED-dark bento dashboard, exact color roles,
typography, breakpoints (phone <600 / tablet 600–1023 / desktop ≥1024), and status semantics
(status → Material icon + color). UI work should conform to it — icons and labels always accompany
color; touch targets ≥44px; skeletons not blank flashes; respect `prefers-reduced-motion`.

## Localization (i18n)

The Flutter client is fully localized via `flutter gen-l10n` (config in `app/l10n.yaml`,
class `AppL10n`). Sources are ARB files in `app/lib/l10n/` — `app_en.arb` is the **template**
(only it carries `@key` placeholder/plural metadata); `app_zh.arb` (Traditional, the product's
primary written form), `app_zh_Hans.arb` (Simplified), and `app_ja.arb` are complete translations.
Rules:
- **Never hard-code user-facing strings** in widgets — add a key to `app_en.arb`, translate it in
  every other ARB (missing keys silently fall back to English), then use `AppL10n.of(context).<key>`.
- The generated `app/lib/l10n/app_localizations*.dart` are build artifacts; regenerate with
  `flutter gen-l10n` (also runs on `pub get`/build because `generate: true`).
- `StatusVisual.forStatus()` keeps stable **English** labels for logic/tests; localized status copy
  lives in `statusLabelL10n()`. Relative time ("3d ago") is localized in `widgets/relative_time.dart`.
- Locale is device-driven by default; `services/locale_controller.dart` holds an in-session override
  driven by the language menu in the app bar. Adding a language = drop a new `app_<locale>.arb` and
  add it to `kPickerLocales`.

## Web SEO / bot-render (Cloudflare Pages)

Flutter Web (CanvasKit) is invisible to crawlers and to AI answer engines
(GPTBot/ClaudeBot/PerplexityBot run ~0% JS). Two layers fix this:
- `app/web/index.html` bakes real crawlable content (H1/H2 + `<noscript>`) into the
  pre-paint container + full SEO head (canonical, OG, JSON-LD WebApplication/FAQPage).
  `app/web/robots.txt`, `sitemap.xml`, `llms.txt` are static.
- `app/web/_worker.js` — **Cloudflare Pages advanced mode**. UA-sniffs bots and serves
  the Worker `GET /share` (a keyword-rich, JSON-LD, **live dated status** prerender that
  is a pure store read — NO LLM / no OpenCode key); humans get the SPA via
  `env.ASSETS.fetch`. `worker/src/app.ts` `/share` is the prerender source.
- **Deploy gotcha:** the Pages deploy MUST ship `build/web/_worker.js` (advanced mode) —
  the `functions/` directory form is NOT compiled by direct `wrangler pages deploy`. Ensure
  `_worker.js` lands in `build/web/` (cp it in if `flutter build web` drops the `_`-prefixed
  file) before `wrangler pages deploy build/web`. Verify: `curl -A Googlebot <url>/` returns
  the `x-prerender` header + dated status; a normal UA returns `flutter_bootstrap.js`.

## Conventions

- Product UI is fully localized (see above); source ARB copy and most docs are authored **繁中-first**.
- Worker is ESM TypeScript with `.js` import specifiers (compiled by tsx/wrangler) — keep the `.js`
  suffix on relative imports even though the files are `.ts`.
- `fixtures/` holds golden classification cases (positives + negatives like teaser/promo/affected-only);
  tests assert these. When touching classification, add/adjust a fixture rather than loosening the floor.
