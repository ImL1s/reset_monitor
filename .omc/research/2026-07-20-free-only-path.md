# Free-only full-auto path (no paid X API)

**Date:** 2026-07-20  
**User constraint:** 花錢的以外全部都看（exclude paid X API / paid third-party APIs）  
**Status:** Research only — not implemented

---

## Decision filter

| Included | Excluded |
|----------|----------|
| FxTwitter / vxTwitter public | Official X API pay-per-use |
| Jina reader | twitterapi.io / Apify paid |
| Nitter / xcancel / public RSS if free | Any paid proxy |
| Existing rule engine + CF free cron | Paid streams |

---

## Live free matrix (same day)

| Source | Timeline discovery | Full text | Notes |
|--------|-------------------|-----------|-------|
| **FxTwitter v2** `/2/profile/{handle}/statuses?count=5` | **YES** (both accounts) | YES in payload | Best free discovery |
| FxTwitter status `/{id}` | N/A | YES | Hydrate / fixtures |
| vxTwitter status | N/A | YES | Alternate hydrate |
| FxTwitter `/{user}` (v1) | NO (profile only) | — | Do not use |
| Jina `r.jina.ai` profile | Tibo partial IDs; **Claude empty** | via status API | Unreliable discovery |
| Nitter public RSS | Mostly dead (403/empty) | — | Not primary |
| Syndication CDN | empty / 429 | — | Not primary |

**Conclusion:** Free-only full-auto **can ship** with **FxTwitter v2 timeline as sole primary**, if user accepts grey ToS and third-party dependency risk.

---

## Recommended free architecture

```
Cron every 10 min (CF free)
  → FxTwitter GET /2/profile/thsottiaux/statuses?count=10
  → FxTwitter GET /2/profile/ClaudeDevs/statuses?count=10
  → filter: author screen_name match + not reply (replying_to)
  → post_id dedupe via KV store
  → store.ingest
  → AutoPublishGate (STRICT templates — not loose classify alone)
       PASS → confirm(decision_by=auto_rules)
       FAIL → reject / ignore
  → successful poll → heartbeat
  → KV persist
```

**No human** in happy path.  
**Emergency admin** still for retract / kill switch (ops, not daily).

### Strict auto-green (mandatory)

- Closed templates from fixtures (not single word `reset`)
- Teaser fixture must REJECT
- Skip `replying_to != null`
- Prefer original posts; quotes need own text match
- Max 1 green / provider / 6h (anti-spam)
- Poll fail → source_unhealthy

### Flags

- `SOURCE_PRIMARY=fxtwitter` (only free mode)
- `AUTO_PUBLISH=1` after fixture tests
- `MONITORING_ENABLED` kill switch in KV

---

## Risks (must accept)

1. **X ToS** — unofficial fetch is scraping-by-proxy  
2. **FxTwitter outage / schema change** — board goes `source_unhealthy`  
3. **False green** — mitigated by strict templates + fixture suite  
4. **False negative** — slangy announcements may miss until phrases updated  
5. **CF Worker egress** — rate politely (10 min, max 10 posts)

---

## What we will NOT do under free-only

- Depend on paid X API  
- Depend on jina as sole Claude discovery (proven empty)  
- Depend on public Nitter  
- LLM auto-green without rule gate  

---

## Proof before code complete

1. Fixture replay: 2 hard reset PROMOTE, teaser REJECT  
2. Live poll once: both accounts return ≥1 post  
3. Cron dry-run log: 0 human steps  
4. Kill switch: AUTO_PUBLISH=0 stops greens  

---

## Implementation estimate (when approved)

~1 focused session: sources adapter + auto gate + scheduled handler + tests + deploy + docs HARD RULE update.
