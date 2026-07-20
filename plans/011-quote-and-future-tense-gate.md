# Plan 011: Block quote-tweet auto-green and pure future-tense greens

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/store.ts worker/src/pipeline/auto_publish.ts worker/test/`

## Status

- **Priority**: P1 · **Effort**: S–M · **Risk**: MED · **Depends on**: 003 · **Category**: bug  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

1. **Quotes** with phrase hits stay `pending_review` and can auto-green on a **new post_id**, replaying language.
2. **CODEX_STRONG** includes `usage limits will be fully reset` while **INCOMING_ONLY** does not catch all pure-future phrasing → premature green before completion.

## Current state

```ts
// store.ts ~219-223
const autoReject =
  clf.excluded ||
  raw.is_retweet ||
  (raw.is_quote && clf.hits.length === 0) ||
  raw.is_reply;
// quotes WITH hits remain pending
```

`INCOMING_ONLY` / `isScheduledIncomingOnly` in `auto_publish.ts` ~85-94, 243-251.

## Scope

**In:** `store.ts`, `auto_publish.ts`, tests, optional fixtures  
**Out:** rewriting all CODEX_STRONG; LLM prompts beyond existing floors.

## Steps

### Step 1: Quotes — auto-reject for auto path

Preferred: treat **all quotes** like retweets for **auto** promote:

- Option A: `store.ingest` autoReject if `is_quote` (admin can still force later via different path — today confirm requires pending; so quotes become rejected → admin must re-ingest as original).
- Option B: leave pending but `shouldAutoPublish` / `tryPromoteCandidate` refuse `is_quote`.

**Prefer B** if candidate retains raw flags on candidate object; check if `EventCandidate` has is_quote — may only be on raw. Then A or pass flag onto candidate.

If candidate lacks quote flag, add `is_quote?: boolean` on candidate at ingest.

RED: quote + strong text → not promoted.

### Step 2: Future-only

Expand detection:

- Pure future without past-done: `will be fully reset`, `will reset`, `going to reset`, `resetting soon` without have/has been reset / are resetting (live progressive may be OK for product — freeze: **progressive “are resetting” may green**; pure “will be fully reset” alone → incoming).

Add to INCOMING_ONLY or strengthen `isScheduledIncomingOnly` to fire when future modal + usage floor without past-done.

RED: “Usage limits will be fully reset again in the next hour for all paid users.” with **no** past-done → `shouldAutoPublish` false reason scheduled/incoming.

GREEN still: past “have reset … for all paid”.

### Step 3: Corpus check

If historical goods are pure future that product historically greened, STOP and list ids for product decision.

## Done criteria

- [ ] Quotes cannot auto-green
- [ ] Pure future-only cannot auto-green
- [ ] Past-tense global templates still green
- [ ] `npm test` + corpus gate OK

## STOP

- Corpus full of pure-future staff posts intentionally greened historically — need product call before failing them.
