/**
 * Strict auto-green gate — closed templates from codex-resets history corpus.
 * Teaser fixtures must REJECT.
 *
 * Precision rules (2026-07-20 review):
 * - Catchphrases never green alone (require usage phrase floor + scope).
 * - Rules path requires usage phrase floor (same as LLM path).
 * - Global/all-paid (or banked) scope signal required for hard_reset.
 */

import type { EventCandidate, EventType, ProviderId } from "../types.js";

export type AutoGateResult = {
  ok: boolean;
  reason: string;
  type?: EventType;
  title?: string;
};

/**
 * Strong usage-reset templates.
 * Catchphrases may appear here but alone still fail phrase floor / scope.
 */
const CODEX_STRONG = [
  "reset usage limits",
  "reset of your usage",
  "full reset of your usage",
  "usage limits have been reset",
  "usage limits will be fully reset",
  "resetting the usage limits",
  "have reset usage limits",
  "have reset everyone's",
  "have reset rate limits",
  "i have reset",
  "we have reset",
  "we've reset",
  "reset rate limits",
  "reseting rate limits",
  "resetting rate limits",
  "resetting the limits",
  "rate limit reset",
  "rate limits reset",
  "banked reset",
  "credit one additional reset",
  "into the reset bank",
  "into your bank",
  "added a banked reset",
  "another reset for our codex",
  // Catchphrases: require floor+scope — alone cannot green
  "oops... i did it again",
  "oops… i did it again",
  "sneaky double reset",
  "reset button pressed",
  "pressing the button",
  "we're resetting",
  "we are once again resetting",
  "we are resetting",
  "reset the usage limits for all",
  "reset everyone's limits",
  "reset everyone's codex",
  "usage reset on the house",
  "usage limit reset",
  "resetting the usage limits for all",
  "i have allowed codex to reset",
  "allowed codex to reset its own",
  "and we are resetting the limits",
  "and yes we are resetting",
  "reset rate limits for all",
  "reset rate limits across",
  "have now reset usage limits",
  "have now been reset",
  "limits have now been reset",
  "are reseting the rate limit",
  "are resetting the rate limit",
  "have reset the rate limits",
  "we have reset the rate limits",
  "reset the rate limits",
  "team will reset rate limits",
  "to celebrate, we're resetting",
  "resetting rate limits so",
  "another usage limit reset",
];

/** Future-only phrasing without clear completed reset — no immediate green. */
const INCOMING_ONLY = [
  "reset incoming",
  "rate limit reset incoming",
  "will be reseting rate limits",
  "will be resetting rate limits",
  "will reset rate limits",
  "will reset usage",
  "resetting tomorrow",
  "should be showing in your accounts in the next",
];

/** Required before rules or LLM promote (blocks catchphrase-only green). */
export const USAGE_PHRASE_FLOOR = [
  "usage limit",
  "usage limits",
  "rate limit",
  "rate limits",
  "banked reset",
  "reset bank",
  "into the reset bank",
  "into your bank",
  "reset usage",
  "usage reset",
  "your usage",
  "reset of your",
  "limits have been reset",
  "limits reset",
  "resetting the limits",
  "everyone's limits",
  "reset everyone's",
  "weekly limit",
  "5-hour",
  "5h",
];

/**
 * Claude strong templates (closed). Curly apostrophes normalized at match time.
 * Do NOT list bare "rate limits for all users" without reset co-presence.
 */
const CLAUDE_STRONG = [
  "we've reset 5-hour and weekly rate limits for all users",
  "we've reset 5-hour and weekly rate limits",
  "we've reset 5-hour and weekly",
  "we've reset the 5-hour and weekly",
  "we've just reset 5-hour and weekly",
  "we've just reset the 5-hour and weekly",
  "we have reset 5-hour and weekly",
  "we have reset the 5-hour and weekly",
  "we've reset everyone's 5-hour and weekly",
  "reset everyone's 5-hour and weekly rate limits",
  "reset everyone's 5-hour and weekly",
  "reset 5-hour and weekly rate limits",
  "reset 5-hour and weekly usage limits",
  "reset the 5-hour and weekly rate limits",
  "gone ahead and reset 5-hour and weekly",
  "5-hour and weekly rate limits for all users",
  "5-hour and weekly usage limits for everyone",
  "usage limits for everyone, across all plans",
  "usage limits for all subscribers",
  "reset rate limits for all claude",
  "we've reset rate limits for all",
];

function normalizeQuotes(s: string): string {
  return s.toLowerCase().replace(/[\u2018\u2019\u201b]/g, "'");
}

/** Claude strong hit; some templates require explicit \\breset\\b. */
function claudeStrongHit(text: string): string | null {
  const lower = normalizeQuotes(text);
  const needReset = new Set([
    "5-hour and weekly rate limits for all users",
    "5-hour and weekly usage limits for everyone",
    "usage limits for everyone, across all plans",
    "usage limits for all subscribers",
  ]);
  for (const p of CLAUDE_STRONG) {
    if (!lower.includes(p)) continue;
    if (needReset.has(p) && !/\breset\b/i.test(text)) continue;
    return p;
  }
  return null;
}

/** True hard-reset past verb (not "raised" / "increasing"). */
export function hasClaudeResetVerb(text: string): boolean {
  return /\b(we've|we have|we)\s+(just\s+)?reset\b|\breset\b.{0,40}\b(rate|usage)\s+limits?\b|\b(rate|usage)\s+limits?\b.{0,40}\b(have been\s+)?reset\b|\bgone ahead and reset\b/i.test(
    text,
  );
}

/**
 * Partial / promo / API raise — never auto-green (rules or LLM).
 * Raise/promo only when there is no hard-reset verb (avoid false quiet on
 * "we reset … Last month we raised").
 */
export function isClaudePartialOrPromo(text: string): boolean {
  if (/\beveryone affected\b|\baffected users?\b|\baffected only\b/i.test(text)) {
    return true;
  }
  if (hasClaudeResetVerb(text)) return false;
  if (
    /\braised\b.{0,60}\brate limits?\b|\brate limits?\b.{0,60}\braised\b/i.test(
      text,
    ) ||
    /\bincreasing\b.{0,40}\blimits?\b|\bkeeping\b.{0,40}\bhigher\b|\b50%\s*higher\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

/** Claude global scope — stricter than Codex (no bare "we've reset" / "for all"). */
export function hasClaudeGlobalScopeSignal(text: string): boolean {
  return /all users|everyone|all plans|across all|pro and max|pro & max|subscribers|for all users|for all subscribers|for all plans|for all claude/i.test(
    text,
  );
}

function isQuestionTeaser(text: string): boolean {
  return (
    /\?/.test(text) &&
    /should we|shall we|maybe we|might we|do we reset/i.test(text)
  );
}

function isNegation(text: string): boolean {
  return /\bno reset\b|not reset|won't reset|will not reset|no hard reset/i.test(
    text,
  );
}

export function hasUsagePhraseFloor(text: string): boolean {
  const lower = text.toLowerCase();
  return USAGE_PHRASE_FLOOR.some((p) => lower.includes(p));
}

/** Global/all-paid/banked scope — required for hard_reset promote (rules + LLM). */
export function hasGlobalScopeSignal(text: string): boolean {
  if (isBanked(text)) return true;
  return /all paid|all plans|for everyone|all users|everyone|all accounts|across all|plus & pro|plus and pro|paid chat|paid plans|codex users|chatgpt work|all our|across plans|across codex|all plus|pro users|subscriptions|weekly usage|rate limits for|limits for all|limits across|limits again|limits in the process|in the process|you can keep building|keep building|hard reset|double reset|for all paid|all paid users|free usage|give free usage|global outage|we have reset|i have reset|we've reset|have reset usage|have reset rate|have reset the rate|usage limits for|usage limits in|resetting the limits/i.test(
    text,
  );
}

export function isBanked(text: string): boolean {
  return /banked reset|credit one additional reset|into your bank|into the reset bank|added a banked reset/i.test(
    text,
  );
}

/** True when text only promises a future reset without completed past-tense. */
export function isScheduledIncomingOnly(text: string): boolean {
  const lower = text.toLowerCase();
  const hasIncoming = INCOMING_ONLY.some((p) => lower.includes(p));
  if (!hasIncoming) return false;
  const pastDone =
    /have reset|has reset|i have reset|we have reset|we've reset|limits have been reset|i did it again|sneaky double reset|added a banked reset|reset usage limits for all|are resetting the usage|we are once again resetting|another usage limit reset for/i.test(
      text,
    );
  return !pastDone;
}

/**
 * Decide whether a pending candidate may become a confirmed green event
 * without a human.
 */
export function shouldAutoPublish(cand: EventCandidate): AutoGateResult {
  if (cand.status !== "pending_review") {
    return { ok: false, reason: "not_pending" };
  }

  const text = cand.raw_text;
  const lower = text.toLowerCase();

  if (isQuestionTeaser(text)) {
    return { ok: false, reason: "question_teaser" };
  }
  if (isNegation(text)) {
    return { ok: false, reason: "negation" };
  }
  if (isScheduledIncomingOnly(text)) {
    return { ok: false, reason: "scheduled_incoming" };
  }

  if (cand.provider === "codex") {
    const strongHits = CODEX_STRONG.filter((p) => lower.includes(p));
    if (strongHits.length === 0) {
      return { ok: false, reason: "no_strong_template" };
    }

    // P0: catchphrase / strong alone never green without usage language
    if (!hasUsagePhraseFloor(text)) {
      return { ok: false, reason: "no_phrase_floor" };
    }

    const banked = isBanked(text);
    if (!banked && !hasGlobalScopeSignal(text)) {
      return { ok: false, reason: "no_scope_signal" };
    }

    const type: EventType = banked ? "banked_credit" : "hard_reset";
    return {
      ok: true,
      reason: `codex_strict:${strongHits[0]}`,
      type,
      title: banked
        ? "Banked reset announced (auto)"
        : "Codex hard reset — all paid (auto)",
    };
  }

  if (cand.provider === "claude") {
    if (isClaudePartialOrPromo(text)) {
      return { ok: false, reason: "partial_or_promo" };
    }
    const strong = claudeStrongHit(text);
    if (!strong) {
      return { ok: false, reason: "no_strong_template" };
    }
    if (!hasUsagePhraseFloor(text)) {
      return { ok: false, reason: "no_phrase_floor" };
    }
    if (!hasClaudeGlobalScopeSignal(text)) {
      return { ok: false, reason: "no_scope_signal" };
    }
    const proMax =
      /pro and max|pro & max/i.test(text) &&
      !/everyone|across all plans|all subscribers/i.test(text);
    return {
      ok: true,
      reason: `claude_strict:${strong}`,
      type: "hard_reset",
      title: proMax
        ? "Claude rate limits reset for Pro/Max (auto)"
        : "Claude rate limits reset for all users (auto)",
    };
  }

  return { ok: false, reason: "provider_not_auto" };
}

export function autoGateProviderSupported(id: ProviderId): boolean {
  return id === "codex" || id === "claude";
}
