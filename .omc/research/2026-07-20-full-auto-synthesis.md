# Full-auto pipeline — synthesis (pre-implementation gate)

**Date:** 2026-07-20  
**Status:** RESEARCH ONLY — do not implement until user picks path  
**Inputs:** explore agent, plan agent, web research agent, local live probes

---

## Verdict

| Question | Answer |
|----------|--------|
| Can we go fully automatic (no human paste/confirm)? | **GO-with-caveats** |
| Confidence | **~75/100** for L1 auto-fetch; **~55/100** for L2 auto-green on unofficial sources |
| Blocker for coding now? | **Product choice** of primary source + whether auto-green is allowed |
| Ready to implement without secrets? | **Partial** — FxTwitter v2 timeline works today without keys; production-safe path wants X API bearer |

### Split the ask

| Layer | Meaning | Feasible without human? |
|-------|---------|-------------------------|
| **L1 Discover** | Cron finds new posts from allowlisted accounts | **Yes** |
| **L2 Publish green** | Rules alone promote to confirmed / green board | **Yes only with stricter gates than current classify** |
| **L3 Forever unattended** | Never need human for retract/outage | **No** — keep emergency admin |

User “全自動不要人工” = L1 + L2. L3 emergency override still recommended.

---

## What we proved live (same day)

### Works

1. **FxTwitter status-by-id**  
   - `GET https://api.fxtwitter.com/status/{id}`  
   - Fixture hard resets + teaser all return full text + author.

2. **FxTwitter v2 profile timeline** (critical discovery)  
   - `GET https://api.fxtwitter.com/2/profile/thsottiaux/statuses?count=5` → 200 + real posts  
   - `GET https://api.fxtwitter.com/2/profile/ClaudeDevs/statuses?count=5` → 200 + real posts  
   - Enough to implement L1 without X API token for hobby / bootstrap.

3. **Rule engine on fixtures**  
   - Codex hard reset → hits  
   - Teaser “Should we reset…” → excluded (`question_teaser`)  
   - Claude hard reset → hits  

### Does not work / weak

| Path | Result |
|------|--------|
| `api.fxtwitter.com/{user}` (no `/2/...`) | Profile only, no tweets |
| `api.vxtwitter.com/{user}` | Profile only |
| Jina reader ClaudeDevs | Login wall-ish, **no status IDs** |
| Jina thsottiaux | Some IDs but noisy / not author-safe |
| Nitter public RSS | 403 / refused / empty |
| RSSHub twitter user | 404 |
| Syndication CDN | empty / 429 |
| Official X API without bearer | 401 |

---

## Source ranking for THIS product

| Rank | Source | Cost | Stability | ToS | Use |
|------|--------|------|-----------|-----|-----|
| **P0** | Official X API v2 `GET /2/users/:id/tweets` + `since_id` | ~$1–15/mo careful; can spike if naive | High | Compliant | **Production primary** |
| **P1** | FxTwitter `GET /2/profile/{handle}/statuses` | Free | Medium (third-party guest token) | Grey (scraping proxy) | Hobby primary / prod fallback for L1 only |
| **P2** | FxTwitter status-by-id | Free | Medium | Grey | Hydrate known IDs |
| **Avoid** | Jina / Nitter / syndication alone | Free | Low | Grey–bad | Not sole green authority |

**Cost warning (official API):** naive `max_results=5` every 10 min × 2 users can bill **hundreds/month** if every poll returns full set without 24h dedupe assumptions. Must use `since_id`, small max_results, spending limit.

---

## Auto-green (L2) safety

### Current `classify*` is NOT enough for auto-green

- Codex phrase `hard reset` / partial substrings can be too broad over time.  
- Claude classifier has almost **no** teaser/negation layer.  
- PURPOSE hard rule historically: **keyword alone must not green**.  
- User now wants no human → product rule must be **explicitly revised** to allow auto-green with closed templates.

### Mandatory fail-closed gates for auto-green

1. Author **immutable user id** (not only handle)  
2. Not reply / not retweet; quote only if own text also matches strict template  
3. **Closed templates** (full sentence families), not single word `reset`  
4. Codex: require co-occurrence e.g. (`reset usage limits` OR `usage limits have been reset` OR banked templates) **AND** scope signal (`all paid` / banked language) where applicable  
5. Teaser/question/negation reject  
6. Rate limit: max 1 auto-green per provider per N hours (anti-spam)  
7. Source adapter tag: prefer only high-trust sources for L2 (`x_api_v2`); optional FxTwitter L2 only if user accepts risk  
8. Poll failure → `source_unhealthy`, never fake “平靜”  
9. **Never auto-retract** — human/emergency only  

### Fixture acceptance criteria before ship L2

| Fixture | Expected auto decision |
|---------|------------------------|
| codex hard reset 2026-07-18 | **PROMOTE** |
| claude hard reset 2026-07-16 | **PROMOTE** |
| codex teaser should-we-reset | **REJECT** |
| banked reset wording | **PROMOTE** as `banked_credit` + claim_note |
| random non-reset thsottiaux tweet | **REJECT / ignore** |

0 false greens on fixtures = gate to enable `AUTO_PUBLISH=1`.

---

## Recommended architecture (single design)

```
CF Cron every 10 min
  → load STATE KV (store + since_ids + flags)
  → for each monitored account:
       primary: X API v2 timeline if X_BEARER_TOKEN set
       else/fallback: FxTwitter /2/profile/{handle}/statuses
  → normalize → store.ingest(...)
  → if AUTO_PUBLISH=0: leave pending_review (yellow)  [Phase A]
  → if AUTO_PUBLISH=1: AutoPublishGate
         PASS → confirm(decision_by=auto_rules, decision_reason=strict_template)
         FAIL → reject (no sticky yellow noise on board)
  → successful poll → touchHeartbeat(provider)
  → save STATE KV
```

**Admin:** emergency retract / kill switch / force ingest only — not daily ops.

**Flags (kill switches):**

- `MONITORING_ENABLED` (default 1 when ship)  
- `AUTO_PUBLISH` (default 0 until fixtures green)  
- `SOURCE_PRIMARY=x_api|fxtwitter`  
- KV override for instant disable without redeploy  

**Heartbeat:** successful auto poll replaces operator heartbeat.

---

## Implementation phases (only after user GO)

### Phase A — Auto discover (safe)

- Cron + sources + ingest + heartbeat  
- Board may show `detected_pending` briefly  
- No auto green  
- Prove: polls both accounts, dedupes post_id, persists since_id  

### Phase B — Auto green

- Strict AutoPublishGate  
- Fixture tests 0 false green  
- `AUTO_PUBLISH=1`  
- decision_by = `auto_rules`  
- Update PURPOSE/PLAN hard rules  

### Phase C — Ops

- Real Telegram on confirm  
- Real X user ids in allowlist  
- Spending alerts for X API  
- Admin only emergency  

---

## Open decisions for user

1. **Primary source:** Official X API (need bearer + pay-per-use) **vs** FxTwitter-only hobby path?  
2. **L2 on day one?** Or Phase A only first (auto fetch, still no green without rules ship)?  
3. Accept **grey ToS** if using FxTwitter in production?  
4. Confirm product rule change: allow auto-green with strict templates?

---

## Artifacts

| File | Role |
|------|------|
| `.omc/research/2026-07-20-auto-pipeline-explore.md` | Explore agent feasibility |
| `.omc/research/2026-07-20-x-source-web-research.md` | Web research sources/pricing/ToS |
| `.omc/research/2026-07-20-x-probe-local.json` | Live probe results |
| `.omc/plans/2026-07-20-full-auto-pipeline.md` | Plan agent full design |
| `.omc/research/2026-07-20-full-auto-synthesis.md` | This synthesis |

**Product code not modified.**
