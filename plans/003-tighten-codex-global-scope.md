# Plan 003: Tighten Codex hasGlobalScopeSignal (false-green P0)

> **Drift check**: `git diff --stat 40002ad..HEAD -- worker/src/pipeline/auto_publish.ts worker/src/pipeline/run_cycle.ts worker/test/`

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED · **Depends on**: none (001 optional) · **Category**: bug  
- **Planned at**: `40002ad`, 2026-07-21

## Why this matters

**False green is the product’s highest-severity failure.** `hasGlobalScopeSignal` currently matches past-tense/catchphrase residue (`we have reset`, `hard reset`, `keep building`, `in the process`, …) so almost any CODEX_STRONG + usage floor text passes “scope”. Claude already uses a stricter helper. LLM promote path reuses the same Codex helper.

## Current state

```ts
// worker/src/pipeline/auto_publish.ts ~225-229
export function hasGlobalScopeSignal(text: string): boolean {
  if (isBanked(text)) return true;
  return /all paid|all plans|for everyone|…|we have reset|i have reset|we've reset|…|hard reset|double reset|…|keep building|…/i.test(
    text,
  );
}
```

Claude (stricter exemplar):

```ts
// ~200-204
export function hasClaudeGlobalScopeSignal(text: string): boolean {
  return /all users|everyone|all plans|across all|pro and max|…|for all users/i.test(text);
}
```

Used from `shouldAutoPublish` and `run_cycle.ts` LLM branch (~167-174).

On success, `run_cycle` confirm does not set `scope` → often `unknown` on green events (`store.confirm` uses `cand.suggested_scope`).

Corpus: `worker/test/corpus_gate.test.ts` — keep promote rate high on historical goods.

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| All tests | `cd worker && npm test` | fail 0 |
| Corpus | included in npm test | “promotes vast majority” still passes |

## Scope

**In:**
- `worker/src/pipeline/auto_publish.ts`
- `worker/src/pipeline/run_cycle.ts` (pass scope on confirm if needed)
- `worker/test/auto_publish.test.ts`, `hardening.test.ts`, `corpus_gate.test.ts`, new negatives as needed
- Optional fixture JSON under `fixtures/`

**Out:** Claude scope rewrite unless shared helper; forecast; admin UI; Flutter.

## Steps

### Step 1: Failing tests for vacuous scope

In `worker/test/auto_publish.test.ts` (or hardening), add cases where **strong + floor but no global audience** must **not** gate ok:

Examples (adjust wording so they hit CODEX_STRONG + USAGE_PHRASE_FLOOR):
- “We have reset rate limits for our enterprise VIP tier only.”
- “Oops... I did it again. Reset usage limits for a subset of users.”
- “Keep building — hard reset of your usage for the dogfood cohort.”

And positives that must still green:
- “…reset usage limits for all paid users”
- “…for all Codex and ChatGPT Work users”
- banked with banked phrases

**Verify**: `npm test` → new tests **FAIL** (RED).

### Step 2: Rewrite `hasGlobalScopeSignal`

Allow only explicit audience/global signals, e.g.:
- `all paid`, `all users`, `everyone`, `all plans`, `across all`, `plus and pro` / `plus & pro`, `chatgpt work`, `codex users` (careful), `for all paid`, `limits for all`, `subscriptions` only if paired with all/paid, banked via `isBanked`.

**Remove** as sole scope: `we have reset`, `i have reset`, `we've reset`, `hard reset`, `double reset`, `keep building`, `in the process`, bare `limits again`, bare `weekly usage` if too loose.

Align spirit with `hasClaudeGlobalScopeSignal` but keep Codex-specific phrases that appear in real Tibo posts (use corpus failures to expand allowlist, not past-tense).

**Verify**: new negatives pass; run full suite.

### Step 3: Scope on promote

When `gate.ok` and type is hard_reset, pass `scope: "all_paid"` if `hasGlobalScopeSignal`, else do not promote (or `subset` only if you add a real subset path — **prefer reject unknown for auto-green**).

```ts
// run_cycle confirm body
scope: gate.type === "banked_credit" ? "unknown" : "all_paid",
```

Only after signal true.

**Verify**: unit/integration: promoted hard_reset has `scope === "all_paid"`.

### Step 4: Corpus rebalance

If `corpus_gate` fails promote rate, add **only** real global phrases from failed goods into the regex — do not re-add vacuous past-tense.

**Verify**: `npm test` full green; note promote count in commit message if changed.

## Test plan

- Pattern: `worker/test/hardening.test.ts`, `auto_publish.test.ts`.
- Cases: vacuous scope reject; all-paid green; banked green; LLM path still requires new scope (mock if existing).

## Done criteria

- [ ] Vacuous-scope texts cannot `shouldAutoPublish` ok
- [ ] Real global templates still promote (corpus)
- [ ] Auto hard_reset events get `scope: all_paid` when green
- [ ] `npm test` 0 fail
- [ ] No Flutter changes

## STOP

- Corpus promote rate collapses below product threshold without a clear phrase list fix (report failing tweet_ids).
- Need to change Claude helper to fix Codex (report).

## Maintenance

Any new CODEX_STRONG phrase must come with a global-scope fixture. Reviewers: reject PRs that re-add `we have reset` as scope.
