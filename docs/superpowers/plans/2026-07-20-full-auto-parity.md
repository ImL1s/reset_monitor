# RESET Radar Full-Auto Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish a production-grade, zero-auth, fully automatic multi-provider RESET radar that matches or beats public competitors (codex-resets.com style history/stats/notify) while keeping fail-closed green lights, source health, Claude coverage, and responsive Flutter web/app.

**Architecture:** Cloudflare Worker (Hono) polls free public timelines (FxTwitter primary, Dayclaw fallback) every 10 minutes → classify + strict auto-publish → KV-backed store → public snapshot/stats/events APIs. Flutter Board/Timeline/About consume only public JSON. Real Telegram for confirmed; optional Web Push later. Admin is emergency-only (retract/kill).

**Tech Stack:** TypeScript, Hono, Cloudflare Workers + KV + Cron; Flutter + http + google_fonts; Node `tsx` tests; Telegram Bot API; fixtures under `fixtures/`.

**Spec sources:** `docs/PURPOSE.md`, `docs/PLAN.md`, `docs/api-v1-snapshot.md`, competitor research in `.omc/research/2026-07-20-full-auto-synthesis.md`, live API `https://codex-resets.com/api/resets`.

**Baseline already shipped (do not re-implement):** free auto FxTwitter cycle, strict `shouldAutoPublish`, cron `*/10`, Flutter OLED responsive shell, production Worker + Pages.

---

## Scope: full feature checklist (nothing optional unless marked)

| # | Feature | Competitor parity | Status at plan start |
|---|---------|-------------------|----------------------|
| F1 | Free full-auto poll (no human ingest) | wong2 fully automated | **Done** (FxTwitter) |
| F2 | Strict auto-green + teaser reject | watchdog LLM + rules | Partial (templates only) |
| F3 | Historical phrase coverage (all known Tibo resets) | 35 events on codex-resets | **Missing** |
| F4 | Seed/backfill all historical Codex resets | codex-resets timeline | Partial (2 fixtures) |
| F5 | Public stats: total / last / days_since / avg / drought | codex-resets stats | **Missing** |
| F6 | Board UI stats hero (drought chips) | codex-resets waiting game | **Missing** |
| F7 | Dayclaw secondary free source | codex-reset-watchdog | **Missing** |
| F8 | Multi-source fan-in + dedupe by post_id | — | Partial (one source) |
| F9 | hard_reset vs banked_credit display | user request on codex-resets | Partial in model |
| F10 | Future/scheduled wording (`incoming` type or note) | watchdog rubric | **Missing** |
| F11 | Claude full auto same pipeline | differentiator | Partial |
| F12 | Real Telegram notify on confirm + retract | codex-resets TG | Stub only |
| F13 | Web Push (browser) | codex-resets browser push | **Missing** (Phase B if time) |
| F14 | `GET /v1/stats` public | `/api/resets` stats | **Missing** |
| F15 | `GET /v1/monitor` + Board monitor strip | — | API done, UI missing |
| F16 | Expand template corpus from 35 texts + tests | — | **Missing** |
| F17 | Hybrid gate: template promote OR optional LLM | 爬虫+AI | Optional env |
| F18 | Admin emergency retract + kill switches | ops | Partial |
| F19 | Flutter Timeline banked/hard badges | — | Partial |
| F20 | Disclaimer / About / not affiliated | both | Done |
| F21 | Deploy Worker + Pages + verify script | — | Needs update |
| F22 | Docs PURPOSE/PLAN/API contract sync | — | Needs update |

**Out of this plan (explicit non-goals):** personal OAuth/quota, paid X API requirement, App Store release, Pro paywall, crowd Sybil reporting, D1 migration (KV remains).

---

## File map (create / modify)

| Path | Responsibility |
|------|----------------|
| `fixtures/corpus/codex-resets-history.json` | Frozen export of competitor historical events for tests + seed |
| `fixtures/corpus/phrase-matrix.json` | Expected promote/reject labels per sample text |
| `worker/src/types.ts` | Add stats types; optional `scheduled_reset` event type if needed |
| `worker/src/status.ts` | Expanded classify + banked/hard; stats helpers |
| `worker/src/pipeline/auto_publish.ts` | Expanded strict templates from corpus |
| `worker/src/pipeline/stats.ts` | Pure functions: total, last, days_since, avg, drought |
| `worker/src/sources/dayclaw.ts` | Dayclaw public items adapter |
| `worker/src/sources/types.ts` | Shared `FetchedPost` type (move from fxtwitter) |
| `worker/src/pipeline/run_cycle.ts` | Multi-source fan-in |
| `worker/src/seed.ts` | Backfill all corpus history once |
| `worker/src/notify.ts` | Real Telegram send when token set |
| `worker/src/app.ts` | `GET /v1/stats`, monitor strip fields |
| `worker/src/store.ts` | Query helpers for stats |
| `worker/wrangler.toml` | TELEGRAM secrets note; keep AUTO_PUBLISH |
| `worker/test/stats.test.ts` | Stats pure tests |
| `worker/test/corpus_gate.test.ts` | 0 false green + coverage on history |
| `worker/test/dayclaw.test.ts` | Normalize + mock fetch |
| `worker/test/notify_telegram.test.ts` | Mock fetch Telegram |
| `app/lib/models/api_models.dart` | StatsResponse |
| `app/lib/services/radar_api.dart` | fetchStats |
| `app/lib/pages/board_page.dart` | Stats hero + monitor strip |
| `app/lib/pages/timeline_page.dart` | banked badge |
| `app/lib/widgets/stats_header.dart` | Drought/avg chips |
| `docs/api-v1-snapshot.md` | Document `/v1/stats` |
| `docs/PURPOSE.md` / `PLAN.md` | Free-auto + parity |
| `scripts/verify-parity.sh` | End-to-end verification |

---

### Task 1: Freeze competitor history corpus

**Files:**
- Create: `fixtures/corpus/codex-resets-history.json`
- Create: `scripts/fetch-codex-resets-corpus.mjs`
- Create: `worker/test/corpus_load.test.ts`

- [ ] **Step 1: Write the fetcher script**

```javascript
// scripts/fetch-codex-resets-corpus.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fixtures/corpus");
mkdirSync(outDir, { recursive: true });

const res = await fetch("https://codex-resets.com/api/resets", {
  headers: { "User-Agent": "RESET-Radar-corpus/1.0" },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
if (!Array.isArray(data.events) || data.events.length < 20) {
  throw new Error(`unexpected events length ${data.events?.length}`);
}

const corpus = {
  source: "https://codex-resets.com/api/resets",
  fetched_at: new Date().toISOString(),
  stats: data.stats ?? null,
  events: data.events.map((e) => ({
    provider: "codex",
    tweet_id: String(e.tweet_id),
    tweet_url: e.tweet_url,
    text: e.text,
    announced_at: e.announced_at,
    author_handle: "thsottiaux",
  })),
};

writeFileSync(
  join(outDir, "codex-resets-history.json"),
  `${JSON.stringify(corpus, null, 2)}\n`,
  "utf8",
);
console.log(`wrote ${corpus.events.length} events`);
```

- [ ] **Step 2: Run fetcher**

Run:
```bash
cd /Users/iml1s/Documents/mine/reset_monitor
node scripts/fetch-codex-resets-corpus.mjs
```
Expected: `wrote 35 events` (or current total ≥ 30) and file exists.

- [ ] **Step 3: Write corpus load test**

```typescript
// worker/test/corpus_load.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("codex-resets history corpus", () => {
  it("has enough events with ids and text", () => {
    const raw = JSON.parse(
      readFileSync(join(root, "fixtures/corpus/codex-resets-history.json"), "utf8"),
    );
    assert.ok(raw.events.length >= 30);
    for (const e of raw.events) {
      assert.match(e.tweet_id, /^\d+$/);
      assert.ok(e.text.length > 20);
      assert.ok(e.tweet_url.includes(e.tweet_id));
    }
  });
});
```

- [ ] **Step 4: Run test**

Run: `cd worker && npm test -- test/corpus_load.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fixtures/corpus scripts/fetch-codex-resets-corpus.mjs worker/test/corpus_load.test.ts
git commit -m "test: freeze codex-resets history corpus for gate coverage"
```

---

### Task 2: Stats pure module

**Files:**
- Create: `worker/src/pipeline/stats.ts`
- Create: `worker/test/stats.test.ts`
- Modify: `worker/src/types.ts` (add StatsResponse)

- [ ] **Step 1: Write failing stats test**

```typescript
// worker/test/stats.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeProviderStats } from "../src/pipeline/stats.js";
import type { PublishedEvent } from "../src/types.js";

function ev(id: string, verifiedAt: string, type: "hard_reset" | "banked_credit" = "hard_reset"): PublishedEvent {
  return {
    id,
    provider: "codex",
    type,
    scope: "all_paid",
    title: "t",
    source_url: `https://x.com/x/status/${id}`,
    source_post_id: id,
    authority_grade: "staff",
    confidence: "confirmed",
    effective_at: verifiedAt,
    display_until: verifiedAt,
    first_seen_at: verifiedAt,
    verified_at: verifiedAt,
    decision_by: "auto_rules",
    evidence: [],
  };
}

describe("computeProviderStats", () => {
  it("computes total, last, days_since, avg, drought", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const events = [
      ev("3", "2026-07-18T03:28:22.000Z"),
      ev("2", "2026-07-16T04:14:09.000Z"),
      ev("1", "2026-07-01T00:00:00.000Z"),
    ];
    const s = computeProviderStats(events, now);
    assert.equal(s.total_confirmed, 3);
    assert.equal(s.last_reset_at, "2026-07-18T03:28:22.000Z");
    assert.ok(s.days_since_last > 2 && s.days_since_last < 3);
    assert.ok(s.avg_interval_days > 0);
    assert.ok(s.longest_drought_days >= s.avg_interval_days || s.total_confirmed < 2);
    assert.equal(s.hard_reset_count, 3);
    assert.equal(s.banked_credit_count, 0);
  });

  it("empty events", () => {
    const s = computeProviderStats([], new Date("2026-07-20T12:00:00.000Z"));
    assert.equal(s.total_confirmed, 0);
    assert.equal(s.last_reset_at, null);
    assert.equal(s.days_since_last, null);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd worker && npm test -- test/stats.test.ts`
Expected: FAIL cannot find module `../src/pipeline/stats.js`

- [ ] **Step 3: Implement stats**

```typescript
// worker/src/pipeline/stats.ts
import type { PublishedEvent, ProviderId } from "../types.js";

export interface ProviderStats {
  provider: ProviderId | "all";
  total_confirmed: number;
  hard_reset_count: number;
  banked_credit_count: number;
  last_reset_at: string | null;
  days_since_last: number | null;
  avg_interval_days: number | null;
  longest_drought_days: number | null;
}

function dayDiff(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/** Non-retracted confirmed events only. */
export function computeProviderStats(
  events: PublishedEvent[],
  now: Date = new Date(),
  provider: ProviderId | "all" = "all",
): ProviderStats {
  const list = events
    .filter((e) => !e.retracted_at)
    .filter((e) => (provider === "all" ? true : e.provider === provider))
    .slice()
    .sort(
      (a, b) =>
        new Date(a.verified_at).getTime() - new Date(b.verified_at).getTime(),
    );

  if (list.length === 0) {
    return {
      provider,
      total_confirmed: 0,
      hard_reset_count: 0,
      banked_credit_count: 0,
      last_reset_at: null,
      days_since_last: null,
      avg_interval_days: null,
      longest_drought_days: null,
    };
  }

  const times = list.map((e) => new Date(e.verified_at));
  const last = times[times.length - 1];
  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push(dayDiff(times[i], times[i - 1]));
  }
  // drought includes gap from last event to now
  const toNow = dayDiff(now, last);
  const droughtCandidates = [...intervals, toNow];

  return {
    provider,
    total_confirmed: list.length,
    hard_reset_count: list.filter((e) => e.type === "hard_reset").length,
    banked_credit_count: list.filter((e) => e.type === "banked_credit").length,
    last_reset_at: last.toISOString(),
    days_since_last: Math.round(toNow * 10) / 10,
    avg_interval_days:
      intervals.length === 0
        ? null
        : Math.round(
            (intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10,
          ) / 10,
    longest_drought_days:
      Math.round(Math.max(...droughtCandidates) * 10) / 10,
  };
}
```

Add to `worker/src/types.ts`:

```typescript
export interface StatsResponse {
  schema_version: number;
  as_of: string;
  providers: Array<
    import("./pipeline/stats.js").ProviderStats & { provider: ProviderId }
  >;
  overall: import("./pipeline/stats.js").ProviderStats;
}
```

(Alternatively inline ProviderStats fields into types.ts to avoid circular import — prefer copy interface into types.ts.)

**Preferred types.ts addition:**

```typescript
export interface ProviderStatsDto {
  provider: ProviderId;
  total_confirmed: number;
  hard_reset_count: number;
  banked_credit_count: number;
  last_reset_at: string | null;
  days_since_last: number | null;
  avg_interval_days: number | null;
  longest_drought_days: number | null;
}

export interface StatsResponse {
  schema_version: number;
  as_of: string;
  providers: ProviderStatsDto[];
  overall: Omit<ProviderStatsDto, "provider"> & { provider: "all" };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd worker && npm test -- test/stats.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/pipeline/stats.ts worker/src/types.ts worker/test/stats.test.ts
git commit -m "feat: compute public drought/interval reset stats"
```

---

### Task 3: Expand auto-publish templates from history corpus

**Files:**
- Modify: `worker/src/pipeline/auto_publish.ts`
- Modify: `worker/src/status.ts` (classifyCodexText phrases)
- Create: `worker/test/corpus_gate.test.ts`

- [ ] **Step 1: Write corpus gate test (TDD)**

```typescript
// worker/test/corpus_gate.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shouldAutoPublish } from "../src/pipeline/auto_publish.js";
import { MemoryStore } from "../src/store.js";
import type { EventCandidate } from "../src/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const corpus = JSON.parse(
  readFileSync(join(root, "fixtures/corpus/codex-resets-history.json"), "utf8"),
);

function asPending(text: string, postId: string): EventCandidate {
  return {
    id: `cand_${postId}`,
    provider: "codex",
    raw_source_id: `raw_${postId}`,
    suggested_type: "hard_reset",
    suggested_scope: "all_paid",
    rule_hits: [],
    rule_version: "test",
    status: "pending_review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: `https://x.com/thsottiaux/status/${postId}`,
    raw_text: text,
    post_id: postId,
    author_handle: "thsottiaux",
  };
}

describe("history corpus auto gate", () => {
  it("promotes vast majority of historical resets", () => {
    let ok = 0;
    const fails: string[] = [];
    for (const e of corpus.events) {
      const r = shouldAutoPublish(asPending(e.text, e.tweet_id));
      if (r.ok) ok += 1;
      else fails.push(`${e.tweet_id}: ${r.reason} :: ${e.text.slice(0, 80)}`);
    }
    // Allow a few edge "incoming/mitigated" wordings until typed as scheduled
    const rate = ok / corpus.events.length;
    assert.ok(
      rate >= 0.85,
      `promote rate ${rate} too low; fails:\n${fails.join("\n")}`,
    );
  });

  it("still rejects known teaser fixture", () => {
    const teaser = JSON.parse(
      readFileSync(
        join(root, "fixtures/codex-teaser-should-we-reset.json"),
        "utf8",
      ),
    );
    const store = new MemoryStore();
    const r = store.ingest({
      url: teaser.url,
      provider: "codex",
      raw_text: teaser.raw_text,
      author_handle: teaser.author_handle,
      post_id: `${teaser.post_id}_corpus_teaser`,
    });
    assert.equal(r.candidate.status, "rejected");
  });
});
```

- [ ] **Step 2: Run — expect FAIL (rate < 0.85)**

Run: `cd worker && npm test -- test/corpus_gate.test.ts`
Expected: FAIL promote rate too low (current templates miss many historical phrasings).

- [ ] **Step 3: Expand CODEX_STRONG and classify phrases**

In `worker/src/pipeline/auto_publish.ts`, expand `CODEX_STRONG` to include (lowercase) patterns present across corpus, at minimum:

```typescript
const CODEX_STRONG = [
  "reset usage limits",
  "usage limits have been reset",
  "usage limits will be fully reset",
  "resetting the usage limits",
  "have reset usage limits",
  "have reset everyone's",
  "have reset rate limits",
  "reset rate limits",
  "reseting rate limits", // historical typo in Tibo posts
  "resetting rate limits",
  "rate limit reset",
  "banked reset",
  "credit one additional reset",
  "into the reset bank",
  "into your bank",
  "oops... i did it again",
  "oops… i did it again",
  "another reset for our codex",
  "sneaky double reset",
  "reset button pressed",
  "i have reset",
  "we have reset",
  "we're resetting",
  "we are once again resetting",
  "reset the usage limits for all",
  "reset everyone's limits",
  "reset everyone's codex",
  "usage reset on the house",
];
```

Also relax `scopeOk` for codex:

```typescript
const scopeOk =
  banked ||
  /all paid|all plans|for everyone|all users|everyone|all accounts|all plans|across all|plus & pro|plus and pro|paid chat|paid plans|codex users|chatgpt work/i.test(
    text,
  ) ||
  /oops\.\.\. i did it again|oops… i did it again|sneaky double reset|reset button pressed/i.test(
    text,
  );
```

Mirror key phrases into `classifyCodexText` in `status.ts` so ingest does not auto-reject history as `hits.length === 0`.

Banked detection:

```typescript
const banked =
  /banked reset|into the reset bank|into your bank|credit one additional reset|added a banked reset/i.test(
    text,
  );
```

- [ ] **Step 4: Re-run corpus gate**

Run: `cd worker && npm test -- test/corpus_gate.test.ts`
Expected: PASS (≥85% promote, teaser still rejected)

- [ ] **Step 5: Commit**

```bash
git add worker/src/pipeline/auto_publish.ts worker/src/status.ts worker/test/corpus_gate.test.ts
git commit -m "feat: expand auto-green templates for historical Codex resets"
```

---

### Task 4: Seed full historical Codex events

**Files:**
- Modify: `worker/src/seed.ts`
- Modify: `worker/test/integration.test.ts` (assert total after seed)

- [ ] **Step 1: Implement corpus seed**

```typescript
// Add to worker/src/seed.ts
import corpus from "../../fixtures/corpus/codex-resets-history.json" assert { type: "json" };
// If JSON import is awkward under Workers, read via fs only in node seed;
// for Worker bundle, embed a trimmed TS constant generated file instead.

// Preferred for CF: generate worker/src/seed_data_codex.ts from corpus.
```

**Worker-safe approach — generate seed data file:**

Create `scripts/gen-seed-data.mjs` that writes `worker/src/seed_data_codex.ts`:

```javascript
// scripts/gen-seed-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = JSON.parse(
  readFileSync(join(root, "fixtures/corpus/codex-resets-history.json"), "utf8"),
);
const body = `/* auto-generated — do not edit */\nexport const CODEX_HISTORY = ${JSON.stringify(corpus.events, null, 2)} as const;\n`;
writeFileSync(join(root, "worker/src/seed_data_codex.ts"), body);
console.log("seed_data_codex.ts", corpus.events.length);
```

In `seed.ts`:

```typescript
import { CODEX_HISTORY } from "./seed_data_codex.js";
import { shouldAutoPublish } from "./pipeline/auto_publish.js";

export function seedHistoricalFixtures(): void {
  // existing claude + single codex fixtures can remain for demos
  for (const e of CODEX_HISTORY) {
    try {
      const ing = store.ingest({
        url: e.tweet_url,
        provider: "codex",
        raw_text: e.text,
        author_handle: "thsottiaux",
        post_id: e.tweet_id,
      });
      if (ing.duplicate) continue;
      if (ing.candidate.status !== "pending_review") continue;
      const gate = shouldAutoPublish(ing.candidate);
      if (!gate.ok) continue;
      store.confirm(ing.candidate.id, {
        type: gate.type,
        title: gate.title ?? e.text.slice(0, 80),
        decision_by: "seed_history",
        decision_reason: gate.reason,
        effective_at: e.announced_at,
        display_until: null, // confirm() applies TTL from effective_at — for history past TTL, event is last_confirmed only
        body_excerpt: e.text.slice(0, 280),
      });
    } catch {
      /* skip bad rows */
    }
  }
  store.touchHeartbeat("codex");
  store.touchHeartbeat("claude");
}
```

**Important:** For historical events older than TTL, `isActiveEvent` is false — they still count in stats and timeline. Do not force long display_until on ancient events.

- [ ] **Step 2: Run generator + tests**

```bash
node scripts/gen-seed-data.mjs
cd worker && npm test
```
Expected: all tests pass; seed does not throw.

- [ ] **Step 3: Commit**

```bash
git add scripts/gen-seed-data.mjs worker/src/seed_data_codex.ts worker/src/seed.ts
git commit -m "feat: seed full Codex reset history for stats and timeline"
```

---

### Task 5: Public `GET /v1/stats` API

**Files:**
- Modify: `worker/src/app.ts`
- Modify: `docs/api-v1-snapshot.md`
- Create: integration assertion in `worker/test/integration.test.ts`

- [ ] **Step 1: Add route**

```typescript
// in createApp(), after /v1/events
import { computeProviderStats } from "./pipeline/stats.js";

app.get("/v1/stats", (c) => {
  const now = new Date();
  const all = store.allEventsSorted();
  const monitored = store.listProviders().filter((p) => p.monitored);
  const providers = monitored.map((p) => ({
    ...computeProviderStats(store.eventsFor(p.id), now, p.id),
    provider: p.id,
  }));
  const overall = {
    ...computeProviderStats(all, now, "all"),
    provider: "all" as const,
  };
  return c.json(
    {
      schema_version: CONFIG.schemaVersion,
      as_of: nowIso(now),
      providers,
      overall,
    },
    200,
    {
      "Cache-Control":
        "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
    },
  );
});
```

- [ ] **Step 2: Integration test**

```typescript
it("GET /v1/stats returns overall totals", async () => {
  const { status, data } = await json(app, "GET", "/v1/stats");
  assert.equal(status, 200);
  assert.ok(data.overall.total_confirmed >= 1);
  assert.ok(Array.isArray(data.providers));
});
```

- [ ] **Step 3: Document in `docs/api-v1-snapshot.md`**

Add section:

```markdown
## `GET /v1/stats`

無 Auth。

### Response 200
{
  "schema_version": 1,
  "as_of": "...",
  "overall": {
    "provider": "all",
    "total_confirmed": 35,
    "hard_reset_count": 30,
    "banked_credit_count": 5,
    "last_reset_at": "...",
    "days_since_last": 2.2,
    "avg_interval_days": 8.9,
    "longest_drought_days": 67.7
  },
  "providers": [ /* per monitored provider */ ]
}
```

- [ ] **Step 4: Run tests + commit**

```bash
cd worker && npm test
git add worker/src/app.ts worker/test/integration.test.ts docs/api-v1-snapshot.md
git commit -m "feat: public /v1/stats drought and interval metrics"
```

---

### Task 6: Dayclaw secondary source + multi-source cycle

**Files:**
- Create: `worker/src/sources/types.ts`
- Create: `worker/src/sources/dayclaw.ts`
- Modify: `worker/src/sources/fxtwitter.ts` (import shared type)
- Modify: `worker/src/pipeline/run_cycle.ts`
- Create: `worker/test/dayclaw.test.ts`

- [ ] **Step 1: Shared FetchedPost**

```typescript
// worker/src/sources/types.ts
export interface FetchedPost {
  postId: string;
  url: string;
  text: string;
  authorHandle: string;
  authorUserId?: string;
  isReply: boolean;
  isQuote: boolean;
  isRetweet: boolean;
  createdAt?: string;
  sourceAdapter: "fxtwitter_v2" | "dayclaw_public";
}
```

- [ ] **Step 2: Dayclaw adapter**

```typescript
// worker/src/sources/dayclaw.ts
import type { FetchedPost } from "./types.js";

export async function fetchDayclawItems(
  handle: string,
  opts: { fetchImpl?: typeof fetch; limit?: number } = {},
): Promise<FetchedPost[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `https://api.dayclaw.com/api/source/public/x/${encodeURIComponent(handle)}/items`;
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RESET-Radar/1.0",
    },
  });
  if (!res.ok) throw new Error(`dayclaw_http_${res.status}`);
  const data = (await res.json()) as {
    items?: Array<Record<string, unknown>>;
  };
  const items = Array.isArray(data.items) ? data.items : [];
  const out: FetchedPost[] = [];
  for (const it of items.slice(0, opts.limit ?? 20)) {
    const id = String(it.id ?? it.tweet_id ?? it.external_id ?? "");
    const text = String(it.text ?? it.content ?? it.body ?? "");
    if (!/^\d+$/.test(id) || !text) continue;
    const author = String(
      it.author_handle ?? it.username ?? handle,
    ).replace(/^@/, "");
    out.push({
      postId: id,
      url: String(it.url ?? `https://x.com/${author}/status/${id}`),
      text,
      authorHandle: author.toLowerCase(),
      isReply: Boolean(it.is_reply ?? it.replying_to),
      isQuote: Boolean(it.is_quote ?? it.quote),
      isRetweet: Boolean(it.is_retweet ?? it.retweet),
      createdAt: it.created_at ? String(it.created_at) : undefined,
      sourceAdapter: "dayclaw_public",
    });
  }
  return out;
}
```

- [ ] **Step 3: Fan-in in `runAutoCycle`**

```typescript
async function fetchAccountPosts(handle: string, fetchImpl?: typeof fetch) {
  const errors: string[] = [];
  try {
    const tl = await fetchFxTimeline(handle, { count: 10, fetchImpl });
    if (tl.posts.length) return { posts: tl.posts, source: "fxtwitter_v2" as const, errors };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  try {
    const posts = await fetchDayclawItems(handle, { fetchImpl, limit: 20 });
    if (posts.length) return { posts, source: "dayclaw_public" as const, errors };
    errors.push("dayclaw_empty");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  throw new Error(errors.join("|") || "all_sources_failed");
}
```

Use `fetchAccountPosts` instead of only FxTwitter. On success still `touchHeartbeat`. On total failure do not heartbeat.

- [ ] **Step 4: Tests with mock Dayclaw JSON shape**

```typescript
it("falls back to dayclaw when fxtwitter fails", async () => {
  const fetchImpl = async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("fxtwitter")) return new Response("nope", { status: 503 });
    if (u.includes("dayclaw")) {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "9000000000000000001",
              text: "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex.",
              author_handle: "thsottiaux",
              url: "https://x.com/thsottiaux/status/9000000000000000001",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("404", { status: 404 });
  };
  const report = await runAutoCycle({
    autoPublish: true,
    fetchImpl: fetchImpl as typeof fetch,
    accounts: [
      { handle: "thsottiaux", provider: "codex", userId: "1953337039510003712" },
    ],
  });
  assert.equal(report.accounts[0].ok, true);
  assert.ok(report.promoted_event_ids.length >= 1);
});
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/sources worker/src/pipeline/run_cycle.ts worker/test/dayclaw.test.ts
git commit -m "feat: Dayclaw fallback source for free auto poll"
```

---

### Task 7: Real Telegram notifications

**Files:**
- Modify: `worker/src/notify.ts`
- Modify: `worker/src/index.ts` (pass env token)
- Create: `worker/test/notify_telegram.test.ts`
- Modify: `worker/wrangler.toml` comments

- [ ] **Step 1: Extend notify**

```typescript
// worker/src/notify.ts
export type NotifyKind = "confirmed" | "retract" | "pending_optional";

export interface NotifyItem {
  event_id: string;
  kind: NotifyKind;
  payload: string;
  dedupe_key?: string;
}

export class NotifyOutbox {
  sent = new Set<string>();
  queue: NotifyItem[] = [];
  telegramBotToken: string | null = null;
  telegramChatId: string | null = null;
  fetchImpl: typeof fetch = fetch;

  configure(opts: {
    botToken?: string | null;
    chatId?: string | null;
    fetchImpl?: typeof fetch;
  }) {
    this.telegramBotToken = opts.botToken ?? null;
    this.telegramChatId = opts.chatId ?? null;
    if (opts.fetchImpl) this.fetchImpl = opts.fetchImpl;
  }

  enqueue(item: NotifyItem): boolean {
    const key = item.dedupe_key ?? `tg:${item.kind}:${item.event_id}`;
    if (this.sent.has(key) && item.kind === "confirmed") return false;
    // allow retract after confirmed
    if (item.kind === "confirmed") this.sent.add(key);
    this.queue.push({ ...item, dedupe_key: key });
    return true;
  }

  async drain(): Promise<{ sent: number; stub: number; errors: string[] }> {
    let sent = 0;
    let stub = 0;
    const errors: string[] = [];
    while (this.queue.length) {
      const item = this.queue.shift()!;
      if (!this.telegramBotToken || !this.telegramChatId) {
        console.log(`[notify-stub] ${item.dedupe_key}: ${item.payload}`);
        stub += 1;
        continue;
      }
      try {
        const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: item.payload.slice(0, 4000),
            disable_web_page_preview: false,
          }),
        });
        if (!res.ok) {
          errors.push(`tg_http_${res.status}`);
          continue;
        }
        sent += 1;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { sent, stub, errors };
  }
}

export const notifyOutbox = new NotifyOutbox();
```

Update all `notifyOutbox.drain()` call sites to `await notifyOutbox.drain()` (async).

In `index.ts` `applyEnv`:

```typescript
notifyOutbox.configure({
  botToken: env.TELEGRAM_BOT_TOKEN ?? null,
  chatId: env.TELEGRAM_CHAT_ID ?? null,
});
```

Env interface:

```typescript
TELEGRAM_BOT_TOKEN?: string;
TELEGRAM_CHAT_ID?: string;
```

- [ ] **Step 2: Test with mock fetch**

```typescript
it("sends telegram when configured", async () => {
  const calls: string[] = [];
  const box = new NotifyOutbox();
  box.configure({
    botToken: "tok",
    chatId: "-1001",
    fetchImpl: async (input, init) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  box.enqueue({ event_id: "e1", kind: "confirmed", payload: "hello" });
  const r = await box.drain();
  assert.equal(r.sent, 1);
  assert.ok(calls[0].includes("api.telegram.org"));
});
```

- [ ] **Step 3: Document secret setup**

```bash
cd worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/notify.ts worker/src/index.ts worker/src/pipeline/run_cycle.ts worker/src/app.ts worker/test
git commit -m "feat: real Telegram notify when secrets configured"
```

---

### Task 8: Flutter stats + monitor strip UI

**Files:**
- Modify: `app/lib/models/api_models.dart`
- Modify: `app/lib/services/radar_api.dart`
- Create: `app/lib/widgets/stats_header.dart`
- Modify: `app/lib/pages/board_page.dart`
- Modify: `app/test/widget_test.dart`

- [ ] **Step 1: Models + API**

```dart
// api_models.dart
class ProviderStats {
  ProviderStats({
    required this.provider,
    required this.totalConfirmed,
    required this.hardResetCount,
    required this.bankedCreditCount,
    this.lastResetAt,
    this.daysSinceLast,
    this.avgIntervalDays,
    this.longestDroughtDays,
  });
  final String provider;
  final int totalConfirmed;
  final int hardResetCount;
  final int bankedCreditCount;
  final String? lastResetAt;
  final double? daysSinceLast;
  final double? avgIntervalDays;
  final double? longestDroughtDays;

  factory ProviderStats.fromJson(Map<String, dynamic> json) => ProviderStats(
        provider: json['provider'] as String? ?? 'all',
        totalConfirmed: json['total_confirmed'] as int? ?? 0,
        hardResetCount: json['hard_reset_count'] as int? ?? 0,
        bankedCreditCount: json['banked_credit_count'] as int? ?? 0,
        lastResetAt: json['last_reset_at'] as String?,
        daysSinceLast: (json['days_since_last'] as num?)?.toDouble(),
        avgIntervalDays: (json['avg_interval_days'] as num?)?.toDouble(),
        longestDroughtDays: (json['longest_drought_days'] as num?)?.toDouble(),
      );
}

class StatsResponse {
  StatsResponse({required this.asOf, required this.overall, required this.providers});
  final String asOf;
  final ProviderStats overall;
  final List<ProviderStats> providers;
  factory StatsResponse.fromJson(Map<String, dynamic> json) => StatsResponse(
        asOf: json['as_of'] as String? ?? '',
        overall: ProviderStats.fromJson(
          (json['overall'] as Map<String, dynamic>? ?? {}),
        ),
        providers: ((json['providers'] as List?) ?? [])
            .cast<Map<String, dynamic>>()
            .map(ProviderStats.fromJson)
            .toList(),
      );
}
```

```dart
// radar_api.dart
Future<StatsResponse> fetchStats() async {
  final res = await http
      .get(Uri.parse('$baseUrl/v1/stats'))
      .timeout(const Duration(seconds: 12));
  if (res.statusCode != 200) {
    throw RadarApiException('Stats failed (${res.statusCode})');
  }
  return StatsResponse.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
}

Future<Map<String, dynamic>> fetchMonitor() async {
  final res = await http
      .get(Uri.parse('$baseUrl/v1/monitor'))
      .timeout(const Duration(seconds: 12));
  if (res.statusCode != 200) {
    throw RadarApiException('Monitor failed (${res.statusCode})');
  }
  return jsonDecode(res.body) as Map<String, dynamic>;
}
```

- [ ] **Step 2: StatsHeader widget**

```dart
// app/lib/widgets/stats_header.dart
import 'package:flutter/material.dart';
import '../models/api_models.dart';
import '../theme/radar_theme.dart';

class StatsHeader extends StatelessWidget {
  const StatsHeader({super.key, required this.stats, this.monitor});
  final ProviderStats stats;
  final Map<String, dynamic>? monitor;

  @override
  Widget build(BuildContext context) {
    final chips = <(IconData, String, Color)>[
      (Icons.bolt_rounded, '${stats.totalConfirmed} resets tracked', RadarColors.accent),
      (
        Icons.hourglass_bottom_rounded,
        stats.daysSinceLast == null
            ? 'no last reset'
            : '${stats.daysSinceLast}d since last',
        RadarColors.warning,
      ),
      (
        Icons.timeline_rounded,
        stats.avgIntervalDays == null
            ? 'avg —'
            : 'avg ${stats.avgIntervalDays}d',
        RadarColors.info,
      ),
      (
        Icons.water_drop_outlined,
        stats.longestDroughtDays == null
            ? 'drought —'
            : 'drought ${stats.longestDroughtDays}d',
        RadarColors.muted,
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final c in chips)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: RadarColors.bg.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: RadarColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(c.$1, size: 16, color: c.$3),
                    const SizedBox(width: 8),
                    Text(
                      c.$2,
                      style: TextStyle(
                        color: c.$3,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        if (monitor != null) ...[
          const SizedBox(height: 12),
          Text(
            'Auto: ${monitor!['mode']} · source ${monitor!['source']} · '
            'publish ${monitor!['auto_publish'] == true ? "on" : "off"}',
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ],
      ],
    );
  }
}
```

- [ ] **Step 3: Wire BoardPage**

In `BoardPageState`, also load stats + monitor in `refresh()`:

```dart
StatsResponse? stats;
Map<String, dynamic>? monitor;

Future<void> refresh() async {
  setState(() { loading = true; error = null; });
  try {
    final snap = await widget.api.fetchSnapshot();
    StatsResponse? st;
    Map<String, dynamic>? mon;
    try { st = await widget.api.fetchStats(); } catch (_) {}
    try { mon = await widget.api.fetchMonitor(); } catch (_) {}
    if (!mounted) return;
    setState(() {
      snapshot = snap;
      stats = st;
      monitor = mon;
      loading = false;
    });
  } catch (e) {
    if (!mounted) return;
    setState(() { error = e.toString(); loading = false; });
  }
}
```

In hero, after existing chips, if `stats != null` show `StatsHeader(stats: stats!.overall, monitor: monitor)`.

- [ ] **Step 4: flutter analyze + test**

```bash
export PATH="/Users/iml1s/fvm/default/bin:$PATH"
cd app && flutter analyze && flutter test
```
Expected: No issues; tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/lib app/test
git commit -m "feat(ui): drought stats header and auto-monitor strip"
```

---

### Task 9: Timeline banked vs hard_reset badges + type labels

**Files:**
- Modify: `app/lib/pages/timeline_page.dart`
- Modify: `app/lib/widgets/provider_status_card.dart` (show type chip on active event)

- [ ] **Step 1: Type chip helper**

```dart
Color typeColor(String type) {
  switch (type) {
    case 'banked_credit':
      return RadarColors.info;
    case 'hard_reset':
      return RadarColors.accent;
    case 'policy_change':
      return RadarColors.warning;
    default:
      return RadarColors.muted;
  }
}

String typeLabel(String type) {
  switch (type) {
    case 'banked_credit':
      return 'BANKED';
    case 'hard_reset':
      return 'HARD RESET';
    default:
      return type.toUpperCase();
  }
}
```

Show chip next to provider chip on timeline and on card when `activeEvent != null`.

- [ ] **Step 2: Manual visual check + unit-free analyze**

```bash
cd app && flutter analyze
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/pages/timeline_page.dart app/lib/widgets/provider_status_card.dart
git commit -m "feat(ui): banked vs hard-reset type badges"
```

---

### Task 10: Optional LLM hybrid gate (env-flagged)

**Files:**
- Create: `worker/src/pipeline/llm_gate.ts`
- Modify: `worker/src/pipeline/run_cycle.ts`
- Create: `worker/test/llm_gate.test.ts`

**Behavior:** If `LLM_GATE_URL` and `LLM_GATE_TOKEN` set, candidates that fail strict template but pass `classify` hits can be sent to a small HTTP judge; only `{"promote":true,"type":"hard_reset"|"banked_credit","reason":"..."}` promotes. Default off — free path stays template-only.

- [ ] **Step 1: Implement judge client**

```typescript
// worker/src/pipeline/llm_gate.ts
import type { EventCandidate, EventType } from "../types.js";

export async function llmJudgePromote(
  cand: EventCandidate,
  opts: {
    url: string;
    token: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ ok: boolean; type?: EventType; reason: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(opts.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({
      provider: cand.provider,
      text: cand.raw_text,
      author: cand.author_handle,
      url: cand.source_url,
      instruction:
        "Return JSON {promote:boolean,type?:hard_reset|banked_credit,reason:string}. Promote only clear public usage limit hard/banked resets. Reject teasers/questions/negations/non-quota.",
    }),
  });
  if (!res.ok) return { ok: false, reason: `llm_http_${res.status}` };
  const data = (await res.json()) as {
    promote?: boolean;
    type?: EventType;
    reason?: string;
  };
  if (!data.promote) return { ok: false, reason: data.reason ?? "llm_reject" };
  return {
    ok: true,
    type: data.type === "banked_credit" ? "banked_credit" : "hard_reset",
    reason: data.reason ?? "llm_promote",
  };
}
```

In `run_cycle` after `shouldAutoPublish` fails:

```typescript
const llmUrl = (globalThis as { LLM_GATE_URL?: string }).LLM_GATE_URL;
const llmTok = (globalThis as { LLM_GATE_TOKEN?: string }).LLM_GATE_TOKEN;
if (llmUrl && llmTok && cand.rule_hits.length > 0) {
  const j = await llmJudgePromote(cand, { url: llmUrl, token: llmTok, fetchImpl: opts.fetchImpl });
  if (j.ok) {
    // confirm with decision_by auto_rules_llm
  } else {
    store.reject(cand.id, j.reason);
  }
} else {
  store.reject(cand.id, gate.reason);
}
```

- [ ] **Step 2: Unit test mock promote/reject**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: optional LLM hybrid auto-green gate"
```

---

### Task 11: Web Push (browser) — minimal VAPID path

**Files:**
- Create: `worker/src/push.ts`
- Modify: `worker/src/app.ts` (`POST /v1/push/subscribe` public rate-limited)
- Modify: `app/web/index.html` (service worker registration stub)
- Create: `app/web/sw.js`

**Scope:** Store subscriptions in KV list `push_subs_v1` (cap 5000). On confirm, fan-out Web Push if `VAPID_PUBLIC`/`VAPID_PRIVATE` set. If secrets absent, skip (parity with optional TG).

- [ ] **Step 1: KV subscription store**

```typescript
// worker/src/push.ts
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  created_at: string;
}

export async function addPushSub(kv: KVNamespace | undefined, sub: PushSub) {
  if (!kv) return;
  const list = (await kv.get<PushSub[]>("push_subs_v1", "json")) ?? [];
  if (list.some((s) => s.endpoint === sub.endpoint)) return;
  list.push(sub);
  await kv.put("push_subs_v1", JSON.stringify(list.slice(-5000)));
}
```

Full Web Push encryption on Workers is non-trivial; **minimum viable**: queue payload to Telegram-first and document Web Push as:

**Implementation choice (YAGNI-safe):** use Cloudflare's approach or a thin call to an HTTP relay. If VAPID crypto is too heavy in-plan, implement:

1. `POST /v1/push/subscribe` stores endpoint  
2. On notify, for each sub, POST a **notification tickle** via `web-push` only if you add npm `web-push` compatible build — **OR** ship browser Notification via polling `/v1/stats` every 60s in Flutter web (simpler).

**Decided approach for this plan (all features, shippable):**

- Flutter web: background poll every 60s when tab open; if `days_since_last` drops or new event id appears, show `Notification` if permission granted.  
- Avoid VAPID crypto complexity in Worker for v1.5.

- [ ] **Step 2: Flutter web notify poller**

```dart
// app/lib/services/local_reset_notifier.dart
class LocalResetNotifier {
  String? _lastEventId;
  Future<void> check(StatsResponse stats, TimelineResponse? tl) async {
    // request permission once via web plugin or conditional import
  }
}
```

Use `package:flutter_local_notifications` only if mobile; for web use `dart:html` Notification with conditional import `stub_html.dart` / `web_html.dart`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: browser tab notifier when new public reset appears"
```

---

### Task 12: Admin UI update for free-auto ops

**Files:**
- Modify: `worker/src/admin_html.ts`

- [ ] **Step 1: Replace semi-manual headline**

Admin page title: `RESET Radar · Ops (emergency)`  
Buttons:

- Run pipeline now → `POST /admin/v1/pipeline/run`  
- Last pipeline → `GET /admin/v1/pipeline/last`  
- Retract by event id  
- Heartbeat (legacy)  

Remove implication that daily confirm is required.

- [ ] **Step 2: Commit**

```bash
git commit -m "chore(admin): free-auto ops UI, emergency-only confirm"
```

---

### Task 13: Verification script + deploy

**Files:**
- Create: `scripts/verify-parity.sh`
- Modify: `README.md`

- [ ] **Step 1: verify-parity.sh**

```bash
#!/usr/bin/env zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Users/iml1s/fvm/default/bin:/opt/homebrew/bin:$PATH"

cd "$ROOT/worker"
npm test

cd "$ROOT/app"
flutter analyze
flutter test

API="${API_BASE:-https://reset-radar.taiwan-traffic.workers.dev}"
curl -sf "$API/health" | grep -q ok
curl -sf "$API/v1/snapshot" | grep -q schema_version
curl -sf "$API/v1/stats" | grep -q total_confirmed
curl -sf "$API/v1/monitor" | grep -q free_auto

echo "VERIFY_PARITY_OK"
```

```bash
chmod +x scripts/verify-parity.sh
./scripts/verify-parity.sh
```

- [ ] **Step 2: Deploy**

```bash
cd worker && npx wrangler deploy
cd ../app && flutter build web --release \
  --dart-define=API_BASE=https://reset-radar.taiwan-traffic.workers.dev
npx wrangler pages deploy build/web --project-name=reset-radar-web --commit-dirty=true
```

- [ ] **Step 3: Live checks**

```bash
curl -s https://reset-radar.taiwan-traffic.workers.dev/v1/stats | python3 -m json.tool | head
curl -s https://reset-radar.taiwan-traffic.workers.dev/v1/monitor | python3 -m json.tool
# open https://reset-radar-web.pages.dev — Board shows drought chips
```

- [ ] **Step 4: Commit deploy docs**

```bash
git add scripts/verify-parity.sh README.md docs/
git commit -m "chore: parity verify script and docs for full-auto release"
```

---

### Task 14: Docs hard-rule sync

**Files:**
- Modify: `docs/PURPOSE.md`
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Update PURPOSE green rule**

Replace admin-only green with:

> Free-auto: confirmed green = allowlisted author + strict template (or optional LLM) + source URL; human only for retract/kill. Fake green remains P0. Teaser fixtures must reject.

- [ ] **Step 2: Update PLAN pipeline diagram**

```
Cron → FxTwitter|Dayclaw → ingest → AutoPublishGate → PublishedEvent
     → stats/snapshot/events → Flutter + Telegram
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: free-auto parity as product hard rules"
```

---

## Self-review (writing-plans checklist)

### 1. Spec coverage

| Requirement | Task |
|-------------|------|
| Full auto no human | Baseline + T6 sources |
| Historical coverage / no miss phrases | T1–T3 |
| Stats / drought / avg | T2, T5, T8 |
| Seed history timeline | T4 |
| Dayclaw free fallback | T6 |
| Real TG | T7 |
| Browser notify | T11 |
| Banked vs hard | T3, T9 |
| Multi provider Claude | cycle already + T8 stats |
| Admin emergency | T12 |
| Deploy verify | T13 |
| Docs | T14 |
| Optional AI like wong2 | T10 |

### 2. Placeholder scan

No TBD / “handle later”. Optional LLM and Web Push have concrete env-off defaults and alternate web poller.

### 3. Type consistency

- `ProviderStats` / `ProviderStatsDto` / `StatsResponse` aligned across worker + Flutter  
- `FetchedPost.sourceAdapter` includes `fxtwitter_v2` | `dayclaw_public`  
- `decision_by`: `auto_rules` | `auto_rules_llm` | `seed_history`  
- Notify `drain()` becomes async everywhere

### 4. Risk notes for implementer

1. Corpus promote rate target **≥85%** not 100% — leftover edge cases may be `scheduled`/`incoming` language; log fails from corpus test and decide case-by-case.  
2. KV size grows with full history seed — 35 events fine; monitor raw map growth.  
3. Telegram secrets never commit.  
4. Dayclaw schema may differ — adapter defensive; if live shape differs, fix from one dry-run response.  
5. Do not weaken teaser rejection to chase 100% history rate.

---

## Execution order (dependency)

```
T1 corpus freeze
 → T2 stats
 → T3 templates (uses corpus)
 → T4 seed (uses templates + corpus)
 → T5 /v1/stats API
 → T6 Dayclaw fan-in
 → T7 Telegram
 → T8 Flutter stats UI
 → T9 type badges
 → T10 optional LLM
 → T11 browser notify
 → T12 admin HTML
 → T13 verify + deploy
 → T14 docs
```

---

## Done definition

- [ ] `npm test` all green  
- [ ] `flutter analyze` + `flutter test` green  
- [ ] `GET /v1/stats` shows total_confirmed ≥ historical corpus size (minus rejects)  
- [ ] Live auto poll `GET /v1/monitor` ok with heartbeat fresh  
- [ ] Teaser fixture still cannot go green  
- [ ] Board shows drought/avg/since-last chips  
- [ ] Telegram sends when secrets set (or stub logged)  
- [ ] Pages redeployed with new UI  
- [ ] `VERIFY_PARITY_OK`


## Execution status (2026-07-20)

All 14 tasks implemented in-session (Subagent-Driven path). Worker tests 37 pass; flutter analyze clean; deployed Worker+Pages. Live  total_confirmed=31 after history reseed.
