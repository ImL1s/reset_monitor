# Fully Automatic RESET Monitoring — Feasibility Explore

**Date:** 2026-07-20  
**Repo:** `reset_monitor` (RESET Radar)  
**Scope:** Codex (`@thsottiaux`) + Claude (`@ClaudeDevs`) on **Cloudflare Workers**  
**Constraint:** Research only — no product source changes  
**Question:** Is **fully automatic** monitoring (no human admin confirm) feasible?

---

## 0. Executive verdict

| Item | Value |
|------|--------|
| **Feasibility verdict** | **GO-with-caveats** |
| **Confidence** | **72 / 100** |
| **Recommended path** | **Phase A:** X API pay-per-use (PPU) cron → auto-ingest candidates only. **Phase B (optional, product-breaking):** ultra-strict auto-promote only for *closed* phrase templates + fail-closed gates. Do **not** auto-green on current `classify*` hits alone. |
| **One-liner** | Auto-**detect** is cheap and Worker-native; auto-**green** conflicts with product hard rules and still needs fail-closed rules that will miss real but slangy announcements. |

### Split the question (critical)

| Layer | Meaning | Feasible? |
|-------|---------|-----------|
| **L1 Auto-ingest** | Cron discovers new posts from allowlisted authors → `RawSource` + `EventCandidate` without human pasting URL/text | **Yes** — primary path is official X API PPU |
| **L2 Auto-confirm** | Candidate → `PublishedEvent` / green light / Telegram without human | **Risky** — possible only with *much* stricter gates than current rules; product docs currently forbid keyword→green |
| **L3 Full unattended ops** | No heartbeat/admin at all; source health always correct | **Partial** — successful poll can replace operator heartbeat, but outages still need fail-closed `source_unhealthy` |

User ask = **L1 + L2**. Verdict GO-with-caveats = ship L1 confidently; L2 only as opt-in ultra-strict mode after fixture proof, not as drop-in replace of admin gate.

---

## 1. Current repo baseline (evidence)

### 1.1 Product intent (`docs/PURPOSE.md`, `docs/PLAN.md`)

- North star: zero-login board answering “is there a high-confidence public RESET right now?”
- **Fake green = highest severity accident**
- Explicit **不要**: 關鍵字命中即自動綠燈
- MVP green = **admin confirm** + allowlisted author + source URL
- X data MVP: **人工／半自動**；Phase 1.5 already sketched: PPU auto-pull → **candidate only**
- Cost note (FULL_AUDIT / PLAN v3): reading 2 accounts is ~**$1–5/mo**; semi-manual is about **trust**, not money

### 1.2 Pipeline today

```
Admin POST /admin/v1/ingest {url, provider, raw_text, flags}
  → AUTHOR_ALLOWLIST handle check
  → classifyCodexText | classifyClaudeText
  → auto-reject: RT | reply | (quote w/o hits) | excluded phrases
  → else pending_review  (YELLOW detected_pending)
Admin POST /admin/v1/candidates/:id/confirm
  → PublishedEvent confidence=confirmed  (GREEN + TTL)
```

Key files:

| File | Role |
|------|------|
| `worker/src/store.ts` | Ingest/confirm; allowlist `thsottiaux`, `claudedevs`, `openaidevs`; **handles**, not real X user IDs yet |
| `worker/src/status.ts` | `classifyCodexText` / `classifyClaudeText`; teaser/negation exclusions (Codex); display status dual-axis |
| `worker/src/app.ts` | Admin ingest/confirm; no cron poller |
| `worker/src/index.ts` | `fetch` only — **no `scheduled` handler** |
| `worker/wrangler.toml` | D1 + KV; **no `[triggers] crons`** |
| `fixtures/*` | Hard resets + teaser that **must** exclude |

### 1.3 Classifier snapshot (as of 2026-07-20)

**Codex positive phrases** (substring):  
`reset usage limits`, `for all paid`, `banked reset`, `100% weekly`, `hard reset`, `another reset`, `resetting the usage limits`, `usage limits have been reset`, `oops... i did it again`

**Codex exclusions:** question teaser (`?` + should/shall/maybe we); negation (`no reset`, `not reset`, …)

**Claude positive:**  
`we've reset 5-hour and weekly`, `reset 5-hour and weekly rate limits`, `rate limits for all users`, `reset everyone's 5-hour and weekly`  
**Almost no teaser/negation layer** — weaker for auto-confirm.

**Structural auto-reject:** `is_retweet`, `is_reply`, quote-without-hits.

### 1.4 Proven false-green near-miss

Fixture `fixtures/codex-teaser-should-we-reset.json`:

> “Should we reset the ChatGPT Work and Codex usage again…”

Contains “reset” language; **must stay excluded**. Current code catches via `question_teaser`. Any auto-confirm path that weakens this is a product P0.

### 1.5 Local free-path probe (same-day, this repo)

`.omc/research/2026-07-20-x-probe-local.json` already tested:

| Endpoint | Result for timeline discovery |
|----------|-------------------------------|
| `api.fxtwitter.com/{user}` | 200 profile only — **no status IDs** |
| `api.vxtwitter.com/{user}` | 200 profile only — **no tweets** |
| `r.jina.ai/http://x.com/thsottiaux` | 200; scraped some status IDs (stale/noisy) |
| `r.jina.ai/.../ClaudeDevs` | 200; **no status IDs** |
| syndication profile | 429 / empty body |

→ Free “just fetch a mirror” paths are **not reliable discovery** for production green lights.

---

## 2. How competitors / trackers typically get X posts

Public sites like [codex-resets.com](https://codex-resets.com/) market “we watch @thsottiaux so you don’t have to” but **do not publish** their ingest stack. Industry patterns in 2026:

| Method | Used by | Reliability | CF Worker fit | ToS / risk |
|--------|---------|-------------|---------------|------------|
| **Official X API** user timeline / filtered activity | Serious products | High (contractual) | Excellent (`fetch` + cron) | Compliant if app approved |
| **Unofficial scrape APIs** (twitterapi.io, etc.) | Many reset/usage bots | Medium | Good | Grey; vendor lock; can ban |
| **FxTwitter / FixTweet** status API | Embed / single post | High for known ID | Excellent | Third-party; **no timeline poll** |
| **Nitter / xcancel RSS** | Hobby RSS | Low–medium 2026 (instances die; needs cookies) | Poor (host Nitter elsewhere) | Against X ToS spirit; ops burden |
| **Guest-token GraphQL** | Scrapers | Breaks every few weeks; DC IP banned | Bad (proxies, state) | High ToS / ban risk |
| **Jina Reader** `r.jina.ai` | LLM tooling | Medium latency; HTML fragile | OK for assist | Third-party dependency |
| **Syndication widgets** | Old embeds | Rate-limit / empty | Weak | Unofficial |

**Implication for THIS repo:** treat official X API as default; treat free scrapes as **secondary heartbeat assist**, never sole authority for green.

---

## 3. Free vs paid paths (2026)

### 3.1 Official X API — pay-per-use (default for new apps)

Source: [docs.x.com pricing](https://docs.x.com/x-api/getting-started/pricing) (fetched 2026-07-20).

| Fact | Value |
|------|--------|
| Model | Credits; **no subscription required** for PPU |
| Free tier for new apps | **Effectively gone** for real read volume (legacy Free/Basic/Pro grandfathered / closed narratives in secondary blogs) |
| Post read | **$0.005 / post resource** |
| User read | **$0.010 / user** |
| Cap | 2M post reads / month (PPU) |
| Dedup | Same resource re-read **same UTC day** usually not re-billed |
| User timeline | `GET /2/users/:id/tweets` (third-party reads = full post rate, not “owned read”) |
| Activity / webhooks | `post.create` events **$0.005** each (if available for followed users — verify product eligibility before designing around webhooks) |

**Cost model for THIS product (2 users, poll every 5 min, `max_results=5–10`):**

- Quiet day: few unique posts → mostly repeated timeline objects → daily dedup keeps cost tiny  
- Ballpark: **~$1–5/month** for Codex+Claude only (aligns with FULL_AUDIT)  
- Aggressive 1-min poll does **not** 30× cost if dedup works; still burns rate limits / worker invocations  

**Worker compatibility:** excellent — bearer token in secrets, short JSON `fetch`, no browser.

### 3.2 FxTwitter / VxTwitter

- Documented: `https://api.fxtwitter.com/:screen_name?/status/:id` (single status)  
- Local probe: user profile OK, **no timeline list**  
- Role in architecture: **hydrate known post_id** (evidence snapshot, deleted-check)  
- Not a replacement for discovery

### 3.3 Jina Reader

- Free tier with RPM limits; latency often multi-second  
- Can extract some status links from profile markdown  
- Failure modes: login walls, empty timelines, stale IDs, rate limits  
- OK as **backup “is the account alive”** signal; **not** fail-open for green

### 3.4 Nitter / RSS

- 2026 consensus: public instances flaky; self-host needs account/session hygiene  
- Not CF Worker–native (run Nitter on a VPS, Worker polls RSS)  
- Reject as primary production path for a trust product

### 3.5 Guest GraphQL / headless browser

- Breaks often; residential proxies; long sessions  
- **Incompatible** with Worker model (no long browser, CPU/time limits)  
- Conflicts with PURPOSE anti-scrape / trust positioning  

---

## 4. Cloudflare Worker constraints (relevant)

| Constraint | Implication |
|------------|-------------|
| Cron min interval **1 minute** (`* * * * *`) | Sub-minute detection needs external push (X webhook) or client-side irrelevance |
| Cron triggers per Worker limited (~3 free / ~5 paid class limits vary) | One poll cron + optional cleanup cron enough |
| No headless browser / no Playwright in Worker | Scraping GraphQL is a non-starter on-Worker |
| Subrequest / CPU / wall-clock limits | Poll 2 timelines + classify + D1 write is fine; Jina dual-fetch + parse is OK if kept light |
| No durable long-lived TCP stream on plain Worker | Prefer short poll over streaming; webhooks via `fetch` handler if X Activity available |
| Secrets | `X_BEARER_TOKEN` (or OAuth), `ADMIN_TOKEN`, optional `TELEGRAM_*` |
| Multi-isolate state | Prefer **D1** for post_id dedupe (KV ok for MVP but racey); PLAN already wants D1 |

**Freshness redesign if auto-poll exists:**

- Today: `last_operator_heartbeat_at` = human ops signal  
- Auto mode: **successful allowlist poll** should update `last_successful_ingest_at` **and** a `last_source_poll_ok_at` used for `source_health`  
- Do **not** treat “no new tweets” as stale  
- Failed N consecutive polls → `source_unhealthy` / degraded (fail-closed, never fake calm)

---

## 5. Three ranked automatic architectures (for THIS repo)

Simplest first.

### Architecture 1 — Official X PPU poll → candidate only (recommended Phase A)

```
Cron (*/5 * * * *)
  → GET /2/users/{real_x_user_id}/tweets?exclude=replies&max_results=5
     for thsottiaux + ClaudeDevs (+ optional OpenAIDevs)
  → map to store.ingest({ url, raw_text, is_*, author_user_id })
  → pending_review | rejected
  → optional Telegram: “🟡 pending” to admin-only chat
  → human confirm still required for green
```

| Dimension | Assessment |
|-----------|------------|
| **Secrets** | `X_API_BEARER_TOKEN` (or app keys), real user IDs in config; existing `ADMIN_TOKEN` for confirm |
| **False-green risk** | **Near zero** (same as MVP) — no auto-confirm |
| **Latency** | Poll interval (5–15 min typical) + human lag for green |
| **Cost** | ~$1–5/mo X + CF free/paid worker negligible |
| **Failure modes** | Token expire; rate limit; account rename (mitigate with **immutable user id**); CF cron miss; billing zero credits |
| **Fits PURPOSE?** | Yes — Phase 1.5 already planned; does **not** violate keyword→green ban |
| **Complexity** | Low–medium: `scheduled` handler, id resolution once, dedupe by `post_id` |

**Also needed:** replace synthetic `xuid_*_mvp` with real X IDs (probe already has numeric ids for both accounts).

---

### Architecture 2 — Same poll + **ultra-strict auto-promote** (optional Phase B)

Same L1 as Arch 1, plus:

```
if candidate passes STRICT_CONFIRM_RULES:
  store.confirm(..., decision_by="auto-strict", decision_reason=rule_id)
  notify TG public channel
else if soft hits:
  pending_review + admin-only alert
else:
  reject / ignore
```

**STRICT_CONFIRM_RULES (mandatory set — see §6):**

1. Author `user_id` ∈ allowlist (not handle alone)  
2. Not reply / not RT / not pure quote  
3. Closed phrase templates (exact or near-exact), **not** bare “reset”  
4. Codex: require conjunction e.g. (`reset usage limits` OR `oops... i did it again`) **AND** (`all paid` OR `for all paid` OR `everyone`)  
5. Claude: require full template like “We've reset 5-hour and weekly rate limits for all users”  
6. Negation / teaser / question / “should we” / “maybe” / “thinking about” → never  
7. Rate limit: max 1 auto-green per provider per N hours (anti account-compromise spam)  
8. Optional dual-source: second evidence within T minutes (e.g. OpenAIDevs RT or mirror) — if missing, yellow only  
9. Retract path + admin override always available  

| Dimension | Assessment |
|-----------|------------|
| **Secrets** | Same as Arch 1 + public TG bot |
| **False-green risk** | **Low–medium** if rules stay closed; **high** if reusing current loose `classifyCodexText` hits (e.g. lone `hard reset` or `oops...`) |
| **Latency** | ~poll interval (1–5 min possible) — can approach competitor “watch the feed” UX |
| **Cost** | Same ~$1–5/mo |
| **Failure modes** | Novel phrasing → false **negative** (acceptable under PURPOSE); account hijack → need rate caps + human retract; classifier drift |
| **Fits PURPOSE?** | **Requires product decision change** — currently forbids auto green; must update PURPOSE/PLAN HARD RULES if shipping |
| **Complexity** | Medium — split `classify*` into `score` vs `auto_promote_eligible` |

---

### Architecture 3 — Free multi-mirror harvest (no X bill)

```
Cron
  → try Jina profile markdown / Nitter RSS / occasional syndication
  → parse status URLs
  → hydrate text via api.fxtwitter.com/status/:id
  → ingest → ?confirm
```

| Dimension | Assessment |
|-----------|------------|
| **Secrets** | Optional Jina key; none for FxTwitter |
| **False-green risk** | High if auto-confirm; medium for candidates (stale/wrong IDs, missing posts) |
| **Latency** | Unpredictable (Jina 1–60s; mirrors down) |
| **Cost** | $0 cash, high **ops** cost |
| **Failure modes** | Proven same-day: FxTwitter no timeline; Jina Claude empty; syndication 429 — **systemic blind spots** |
| **Fits PURPOSE?** | Weak — “來源健康” becomes theater when mirrors lie about emptiness |
| **Complexity** | High brittle parsers; worse than paying $5 |

**Rank:** 3 = last resort lab experiment only.

---

## 6. Is auto-confirm on rule hits safe enough without human?

### Short answer

**No — not with current `classify*` as the sole gate.**  
**Conditionally yes — only with a separate, stricter auto-promote gate + product acceptance of false negatives.**

### Why current rules are not enough

| Gap | Example |
|-----|---------|
| Codex single weak hit | Phrase `hard reset` or `oops... i did it again` alone could promote without “all paid” scope |
| Claude thin exclusions | No teaser/negation parity with Codex |
| Slang / new wording | Real resets with new jokes miss auto rules → if humans gone, board stays false-calm unless health UX is honest |
| Staff account compromise | Automated green + TG blast is an incident amplifier |
| Quote/context | Flags help, but metadata must come from API fields (not human-pasted flags) |
| PURPOSE conflict | “關鍵字命中即自動綠燈” is explicitly out of scope for MVP identity |

### Mandatory fail-closed rules (if any auto-green ships)

| # | Rule | Action |
|---|------|--------|
| F1 | Author **immutable user id** allowlist only | else drop |
| F2 | `is_retweet` / `is_reply` | never green |
| F3 | `is_quote` | never auto-green (admin only) |
| F4 | Question / teaser / hedging | never green |
| F5 | Negation | never green |
| F6 | Require **scope cue** for Codex (`all paid` / `everyone` / …) | else yellow max |
| F7 | Closed templates preferred over open keyword list | else yellow |
| F8 | Max auto-greens / provider / window | excess → quarantine |
| F9 | Poll failure ≠ “no reset” | `source_unhealthy` |
| F10 | Always retain retract + evidence snapshot | incident recovery |
| F11 | LLM classifier **may assist**, never sole confirm | PURPOSE already |
| F12 | Handle rename / id mismatch | hard fail closed |

### Product-safe compromise (recommended default)

| Mode | Auto-ingest | Public UI | Notify |
|------|-------------|-----------|--------|
| **Default (trust product)** | Yes | Yellow `detected_pending` until human | Admin TG only |
| **Strict auto (opt-in later)** | Yes | Green only if F1–F12 | Public TG + retract SOP |
| **Never** | — | Green on soft keyword alone | — |

This preserves PURPOSE while still removing “human must paste URL” toil.

---

## 7. Recommended path (actionable)

### Ship order

1. **Prove X API access** for this developer account (credits, app tier, `users/:id/tweets` on both ids).  
2. **Implement Architecture 1 only** (auto-ingest → candidate).  
3. Wire cron success → source health (`last_source_poll_ok_at`).  
4. Expand fixtures: auto-promote **must-fail** suite (teaser, RT, reply, negation, banked vs hard, hijack flood).  
5. Only after N historical posts replay with **0 false greens** and acceptable false-negative rate, consider Architecture 2 behind a feature flag.  
6. Do **not** invest primary effort in Nitter/Jina/syndication for green-path authority.

### Secrets checklist (Arch 1)

| Secret / binding | Purpose |
|------------------|---------|
| `X_BEARER_TOKEN` | App-only timeline reads |
| Allowlist config with **numeric user ids** | Anti handle-squat |
| `ADMIN_TOKEN` / CF Access | Manual confirm & retract |
| `STATE` / `DB` | Dedupe + durable events |
| Optional: admin Telegram | Yellow alerts while solo sleeps |

### Latency expectations (honest)

| Stage | Target |
|-------|--------|
| Post → candidate on board | ≈ cron interval (recommend **5 min**; 1 min max CF) |
| Candidate → green (Arch 1) | Human-dependent (solo sleep = hours) — **same as today** |
| Candidate → green (Arch 2 strict) | ≈ cron interval when phrase matches |

Still **not** a guarantee to beat codex-resets.com on wall-clock; PURPOSE already rejects that KPI.

---

## 8. Open risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Product identity break if silent auto-green | Critical | Feature flag; update PURPOSE first |
| False green from weak phrase | Critical | Separate strict gate; fixture suite |
| False calm when poll dead | Critical | Fail-closed source_health |
| X pricing / policy change | Medium | Spending caps; keep manual ingest fallback |
| Free mirror temptation | Medium | Documented NO-GO as sole source |
| Staff account joke posts | Medium | Scope conjunction + rate limits |
| Claude phrase drift | Medium | Broader yellow detect, narrow green |
| Solo operator still needed for Arch 1 greens | Medium | Accept or invest in Arch 2 after proof |
| Multi-isolate race on confirm | Low | D1 unique `(provider, source_post_id)` |
| Activity API eligibility unknown for third-party users | Medium | Design poll-first; webhook later if proven |

---

## 9. What must be proven **before coding** product auto-pipeline

### Proof gates (hard)

| # | Proof | Pass criteria |
|---|-------|---------------|
| P1 | X developer app can call `GET /2/users/:id/tweets` for both real user ids | 200 JSON with text + `referenced_tweets` / reply fields |
| P2 | Cost estimate under expected poll rate | ≤ ~$10/mo worst-case with spending limit set |
| P3 | Map API fields → `is_reply` / `is_retweet` / `is_quote` correctly | No silent mis-flag |
| P4 | Replay all fixtures + last 6–12 months known reset posts through classifier | Zero false greens on strict gate; document false negatives |
| P5 | Teaser fixture remains rejected under any auto path | Automated test |
| P6 | Product decision recorded | PURPOSE/PLAN: either keep human confirm, or explicitly allow strict auto |
| P7 | Cron + secret storage plan on Workers | `wrangler` triggers + secret names |
| P8 | Failure drill | Kill token → UI shows unhealthy, not “calm no reset” |

### Soft / optional before Arch 2

| # | Proof |
|---|-------|
| S1 | Admin-only yellow TG for 2 weeks with zero “missed real reset that rules would have auto-greened safely” regrets |
| S2 | Dual-signal experiment (OpenAIDevs) value vs cost |
| S3 | Whether X Activity `post.create` webhook is available for non-owned users at acceptable cost |

### Explicitly do **not** need before Arch 1

- Beating competitor latency  
- Free scrape reliability  
- LLM auto-confirm  

---

## 10. Mapping to existing PLAN phases

| PLAN language | This report |
|---------------|-------------|
| MVP semi-manual + admin green | Status quo — correct for trust |
| Phase 1.5 PPU → candidate only | **= Architecture 1** — **GO**, should be first auto step |
| Phase 2+ “still candidate” | PLAN never promised full auto-green |
| User request “全自動不要人工” | Exceeds PLAN; only Arch 2 with caveats |

---

## 11. Confidence breakdown

| Component | Confidence | Notes |
|-----------|------------|-------|
| Arch 1 technical feasibility on CF Worker | **90** | Standard pattern; cost known |
| Free-path primary ingest | **25** | Local probe already fails timelines |
| Auto-confirm with **current** rules | **20** | Unsafe |
| Auto-confirm with **strict** closed templates | **65** | Needs fixture proof + product yes |
| Overall “full no-human product” | **72** | L1 yes; L2 only under caveats |
| Cost <$10/mo for 2 accounts | **85** | Dedup + low volume |

---

## 12. Bottom line for the user

- **可以全自動「發現」**（不用人貼 URL）：用 **X API PPU + Worker cron**，接進現有 `ingest` → 黃燈。這與 PURPOSE / PLAN Phase 1.5 一致，**建議做**。  
- **不建議立刻全自動「綠燈」**：與現有 hard rule、teaser fixture、假綠燈事故等級衝突；現有 `classify*` 不夠當唯一閘。  
- 若堅持不要人確認：只能 **GO-with-caveats** — 另建 strict auto-promote、fail-closed 監測健康、接受漏報、並先改產品文件。  
- **不要**把 Nitter / Jina / FxTwitter user endpoint 當主幹；同日 probe 已顯示 timeline 不可靠。  
- **寫碼前必過 P1–P8**；未過前只應實作手動管線與測試，不應宣稱全自動。

---

## 13. Sources (web / local)

- X API pricing (official): https://docs.x.com/x-api/getting-started/pricing  
- Secondary pricing context 2026: postproxy / blotato / sorsa blogs (legacy Basic/Pro closed narratives)  
- FxTwitter status API: FixTweet wiki Status Fetch API  
- CF Cron min 1 minute: Cloudflare Workers Cron Triggers docs  
- Nitter reliability: 2026 RSS guides (self-host gamble)  
- Scrape fragility: scrapfly / webparsers guest-token notes  
- Local: `docs/PURPOSE.md`, `docs/PLAN.md`, `docs/FULL_AUDIT.md`, `worker/src/{store,status,app,index}.ts`, `fixtures/*`, `.omc/research/2026-07-20-x-probe-local.json`

---

*End of explore report. No product code modified.*
