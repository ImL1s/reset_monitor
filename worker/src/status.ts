import {
  CONFIG,
  DisplayStatus,
  EventCandidate,
  EventType,
  ProviderConfig,
  ProviderRuntimeMeta,
  ProviderSnapshotCard,
  PublicEvent,
  PublishedEvent,
  SourceHealth,
} from "./types.js";
import {
  computeNext48hForecast,
  detectExplicitFuturePromise,
} from "./pipeline/forecast.js";
import {
  isHedgeSpeculation,
  isNegation,
  isQuestionTeaser,
} from "./pipeline/auto_publish.js";

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

export function ttlHoursForType(type: EventType): number {
  switch (type) {
    case "banked_credit":
      return CONFIG.displayTtlBankedHours;
    case "policy_change":
      return CONFIG.displayTtlPolicyHours;
    default:
      return CONFIG.displayTtlHardHours;
  }
}

export function computeSourceHealth(
  meta: ProviderRuntimeMeta,
  monitored: boolean,
  now: Date = new Date(),
): { health: SourceHealth; stale_reason: string | null } {
  if (!monitored) {
    return { health: "disabled", stale_reason: "not_monitored" };
  }
  const hb = meta.last_operator_heartbeat_at;
  if (!hb) {
    return {
      health: "stale",
      stale_reason: "no_operator_heartbeat",
    };
  }
  const ageH = (now.getTime() - new Date(hb).getTime()) / 3_600_000;
  if (ageH <= CONFIG.heartbeatFreshHours) {
    return { health: "fresh", stale_reason: null };
  }
  if (ageH <= CONFIG.heartbeatDegradedHours) {
    return {
      health: "degraded",
      stale_reason: `heartbeat_age_hours=${ageH.toFixed(1)}`,
    };
  }
  return {
    health: "stale",
    stale_reason: `heartbeat_older_than_${CONFIG.heartbeatDegradedHours}h`,
  };
}

export function isActiveEvent(ev: PublishedEvent, now: Date = new Date()): boolean {
  if (ev.retracted_at) return false;
  return new Date(ev.display_until).getTime() > now.getTime();
}

/** Twitter/X snowflake → ms since epoch (for pending post age). */
export function snowflakeToMs(postId: string): number | null {
  try {
    const id = BigInt(postId);
    if (id <= 0n) return null;
    return Number((id >> 22n) + 1288834974657n);
  } catch {
    return null;
  }
}

/**
 * Pending only surfaces when it could still matter vs last public blessing.
 * Hides months-old teaser candidates that were re-ingested with fresh created_at.
 */
export function isActionablePending(
  pending: EventCandidate | null,
  lastConfirmed: PublishedEvent | null,
  now: Date = new Date(),
): boolean {
  if (!pending || pending.status !== "pending_review") return false;
  const postMs = snowflakeToMs(pending.post_id);
  if (postMs != null) {
    if (lastConfirmed) {
      const lastEff = new Date(lastConfirmed.effective_at).getTime();
      if (postMs < lastEff) return false;
    }
    // Soft cap: candidates from posts older than 21d rarely change wording
    if (now.getTime() - postMs > 21 * 86_400_000) return false;
  }
  return true;
}

export function eventTimeMs(e: { effective_at?: string; verified_at: string }): number {
  return new Date(e.effective_at || e.verified_at).getTime();
}

export function toPublicEvent(ev: PublishedEvent): PublicEvent {
  return {
    id: ev.id,
    type: ev.type,
    scope: ev.scope,
    scope_detail: ev.scope_detail ?? null,
    title: ev.title,
    body_excerpt: ev.body_excerpt ?? null,
    source_url: ev.source_url,
    source_post_id: ev.source_post_id,
    source_author: ev.source_author ?? null,
    authority_grade: ev.authority_grade,
    confidence: "confirmed",
    effective_at: ev.effective_at,
    display_until: ev.display_until,
    verified_at: ev.verified_at,
    claim_url: ev.claim_url ?? null,
    claim_note: ev.claim_note ?? null,
    retracted: !!ev.retracted_at,
  };
}

/**
 * Dual-axis display_status priority (PLAN v3 / api-v1-snapshot).
 */
export function deriveDisplayStatus(args: {
  monitored: boolean;
  sourceHealth: SourceHealth;
  activeEvent: PublishedEvent | null;
  pending: EventCandidate | null;
  everConfirmed: boolean;
}): { display: DisplayStatus; eventStatus: DisplayStatus } {
  const { monitored, sourceHealth, activeEvent, pending, everConfirmed } = args;

  if (!monitored) {
    return { display: "not_monitored", eventStatus: "not_monitored" };
  }

  const unhealthy = sourceHealth === "stale" || sourceHealth === "disabled";
  // North-Star green only for hard_reset (banked is a different public signal)
  const hardActive =
    activeEvent?.type === "hard_reset" ? activeEvent : null;
  const bankedOnly =
    !!activeEvent &&
    activeEvent.type === "banked_credit" &&
    !hardActive;
  const hasHard = !!hardActive;

  let eventStatus: DisplayStatus;
  if (hasHard) {
    eventStatus = unhealthy
      ? "active_confirmed_degraded"
      : "active_confirmed";
  } else if (bankedOnly) {
    eventStatus = "active_banked";
  } else if (pending && pending.status === "pending_review") {
    eventStatus = "detected_pending";
  } else if (!everConfirmed) {
    eventStatus = "cold_start";
  } else {
    eventStatus = "no_recent_confirmed";
  }

  // Priority matrix
  if (unhealthy && !hasHard && !bankedOnly) {
    return { display: "source_unhealthy", eventStatus };
  }
  if (unhealthy && hasHard) {
    return { display: "active_confirmed_degraded", eventStatus };
  }
  if (hasHard) {
    return { display: "active_confirmed", eventStatus };
  }
  if (bankedOnly) {
    return { display: "active_banked", eventStatus };
  }
  if (pending && pending.status === "pending_review") {
    return { display: "detected_pending", eventStatus };
  }
  if (!everConfirmed) {
    return { display: "cold_start", eventStatus };
  }
  return { display: "no_recent_confirmed", eventStatus };
}

export function buildProviderCard(args: {
  config: ProviderConfig;
  meta: ProviderRuntimeMeta;
  events: PublishedEvent[];
  pending: EventCandidate | null;
  now?: Date;
}): ProviderSnapshotCard {
  const now = args.now ?? new Date();
  const asOf = nowIso(now);
  const { health, stale_reason } = computeSourceHealth(
    args.meta,
    args.config.monitored,
    now,
  );

  const nonRetracted = args.events.filter((e) => !e.retracted_at);
  // Newest announcement first — active must be latest still-in-TTL
  const sorted = [...nonRetracted].sort(
    (a, b) => eventTimeMs(b) - eventTimeMs(a),
  );
  const active = sorted.find((e) => isActiveEvent(e, now)) ?? null;
  const lastConfirmed =
    sorted.find((e) => !active || e.id !== active.id) ?? null;

  const pendingLive = isActionablePending(args.pending, lastConfirmed, now)
    ? args.pending
    : null;

  const { display, eventStatus } = deriveDisplayStatus({
    monitored: args.config.monitored,
    sourceHealth: health,
    activeEvent: active,
    pending: pendingLive,
    // include retracted: once confirmed, never cold_start again
    everConfirmed: args.events.length > 0,
  });

  // Third axis: NEXT 48h heuristic only — never affects display_status / notify
  let next_48h: ProviderSnapshotCard["next_48h"] = null;
  if (args.config.monitored) {
    const hard = nonRetracted.filter((e) => e.type === "hard_reset");
    const promiseText = pendingLive?.raw_text ?? "";
    const futurePromise = promiseText
      ? detectExplicitFuturePromise(promiseText)
      : false;
    next_48h = computeNext48hForecast({
      hardEvents: hard.map((e) => ({
        effective_at: e.effective_at || e.verified_at,
        type: e.type,
      })),
      now,
      sourceHealth: health,
      futurePromise,
      promiseEvidenceUrls:
        futurePromise && pendingLive?.source_url
          ? [pendingLive.source_url]
          : undefined,
    });
  }

  return {
    provider: args.config.id,
    display_name: args.config.display_name,
    monitored: args.config.monitored,
    display_status: display,
    event_status: eventStatus,
    monitoring_status: health,
    as_of: asOf,
    last_successful_ingest_at: args.meta.last_successful_ingest_at ?? null,
    last_operator_heartbeat_at: args.meta.last_operator_heartbeat_at ?? null,
    source_health: health,
    stale_reason,
    authority_hint: args.config.authority_hint ?? null,
    coverage_note: args.config.coverage_note ?? null,
    active_event: active ? toPublicEvent(active) : null,
    last_confirmed_event: lastConfirmed ? toPublicEvent(lastConfirmed) : null,
    pending_detection:
      pendingLive && pendingLive.status === "pending_review"
        ? {
            candidate_id: pendingLive.id,
            suggested_type: pendingLive.suggested_type,
            source_url: pendingLive.source_url,
            created_at: pendingLive.created_at,
            message: "偵測到候選（自動規則未達綠燈門檻）",
          }
        : null,
    next_48h,
  };
}

/** Rule prefill — candidate only, never green. */
export function classifyCodexText(text: string): {
  hits: string[];
  type: EventType;
  scope: "all_paid" | "unknown";
  excluded: boolean;
  excludeReason?: string;
} {
  const lower = text.toLowerCase().replace(/[\u2018\u2019\u201b]/g, "'");
  // Soft funnel must be ≥ CODEX_STRONG coverage so true hard posts reach gate
  const phrases = [
    "reset usage limits",
    "reset of your usage",
    "full reset of your usage",
    "for all paid",
    "banked reset",
    "100% weekly",
    "hard reset",
    "another reset",
    "another usage limit reset",
    "usage limit reset",
    "resetting the usage limits",
    "usage limits have been reset",
    "usage limits will be fully reset",
    "oops... i did it again",
    "have reset usage limits",
    "have reset rate limits",
    "have reset everyone's",
    "i have reset",
    "we have reset",
    "we've reset",
    "reset rate limits",
    "reseting rate limits",
    "resetting rate limits",
    "reseting the rate limit",
    "resetting the rate limit",
    "reset the rate limits",
    "rate limit reset",
    "rate limits reset",
    "sneaky double reset",
    "reset button pressed",
    "usage reset on the house",
    // 2026-07-21 Tibo 10M — match CODEX_STRONG; no bare "usage reset" (LLM surface)
    "new usage reset",
    "usage reset for paid",
    "into the reset bank",
    "into your bank",
    "credit one additional reset",
    "added a banked reset",
    "we are once again resetting",
    "we're resetting",
    "we are resetting",
    "and yes we are resetting",
    "resetting the limits",
    "reset everyone's",
    "across all paid",
    "all plans",
    "pressing the button",
    "team will reset rate limits",
    "will be reseting rate limits",
    "will be resetting rate limits",
  ];
  const hits = phrases.filter((p) => lower.includes(p));

  // crude exclusions — shared with shouldAutoPublish (false-green P0)
  if (isQuestionTeaser(text)) {
    return {
      hits,
      type: "hard_reset",
      scope: "unknown",
      excluded: true,
      excludeReason: "question_teaser",
    };
  }
  if (isNegation(text)) {
    return {
      hits,
      type: "hard_reset",
      scope: "unknown",
      excluded: true,
      excludeReason: "negation",
    };
  }
  if (isHedgeSpeculation(text)) {
    return {
      hits,
      type: "hard_reset",
      scope: "unknown",
      excluded: true,
      excludeReason: "hedge_speculation",
    };
  }

  // Explicit hard reset wording wins over incidental "banked resets" mention
  const type: EventType =
    /\bthis is a hard reset\b|\bhard reset given\b/i.test(text)
      ? "hard_reset"
      : /banked reset|into the reset bank|into your bank|added a banked reset|credit one additional reset/i.test(
            text,
          ) && !/\bhard reset\b/i.test(text)
        ? "banked_credit"
        : "hard_reset";
  const scope =
    /all paid|all plans|everyone|all users|all accounts|codex users|chatgpt work|across all|paid plans|plus and pro|plus & pro/i.test(
      text,
    )
      ? "all_paid"
      : "unknown";

  return { hits, type, scope, excluded: hits.length === 0 };
}

/** Soft funnel for Claude public reset posts — never green alone. */
export function classifyClaudeText(text: string): {
  hits: string[];
  type: EventType;
  scope: "all_paid" | "unknown";
  excluded: boolean;
  excludeReason?: string;
} {
  // Normalize curly apostrophes so we've / we’ve match the same patterns
  const lower = text.toLowerCase().replace(/[\u2018\u2019\u201b]/g, "'");

  if (/\?/.test(text) && /should we|shall we|maybe|might we/i.test(text)) {
    return {
      hits: [],
      type: "hard_reset",
      scope: "unknown",
      excluded: true,
      excludeReason: "question_teaser",
    };
  }
  if (/\bno reset\b|not reset|won't reset|will not reset/i.test(text)) {
    return {
      hits: [],
      type: "hard_reset",
      scope: "unknown",
      excluded: true,
      excludeReason: "negation",
    };
  }

  // Hard-negative: policy raise / promo WITHOUT a hard-reset verb
  // (do not kill "We've reset … Last month we raised …")
  const hasResetVerb =
    /\b(we've|we have|we)\s+(just\s+)?reset\b|\breset\b.{0,40}\b(rate|usage)\s+limits?\b|\b(rate|usage)\s+limits?\b.{0,40}\b(have been\s+)?reset\b|\bgone ahead and reset\b/i.test(
      text,
    );
  if (
    !hasResetVerb &&
    (/\braised\b.{0,60}\brate limits?\b|\brate limits?\b.{0,60}\braised\b/i.test(
      text,
    ) ||
      /\bincreasing\b.{0,40}\b(limits?|usage)\b/i.test(text) ||
      /\bkeeping\b.{0,40}\b(limits?|usage).{0,20}\bhigher\b/i.test(text) ||
      /\b50%\s*higher\b|\b2x\b.{0,30}\blimits?\b/i.test(text))
  ) {
    return {
      hits: [],
      type: "hard_reset",
      scope: "unknown",
      excluded: true,
      excludeReason: "policy_raise_or_promo",
    };
  }

  // Soft patterns: wider than CLAUDE_STRONG so variants reach pending/LLM
  const softPatterns = [
    "we've reset 5-hour and weekly",
    "we have reset 5-hour and weekly",
    "we've reset the 5-hour and weekly",
    "we have reset the 5-hour and weekly",
    "we've just reset 5-hour",
    "we've just reset the 5-hour",
    "reset 5-hour and weekly",
    "reset the 5-hour and weekly",
    "reset everyone's 5-hour and weekly",
    "reset 5-hour and weekly rate limits",
    "reset 5-hour and weekly usage limits",
    "5-hour and weekly rate limits",
    "5-hour and weekly usage limits",
    "gone ahead and reset 5-hour",
    "usage limits for everyone",
    "usage limits for all",
    "rate limits for all users", // only counts with reset co-presence below
    "rate limits for everyone",
    "we've reset rate limits",
    "we have reset rate limits",
    "reset rate limits for all",
    "reset usage limits for all",
    "reset usage limits for everyone",
  ];

  let hits = softPatterns.filter((p) => lower.includes(p));

  // Co-presence: reset + (5-hour|5h|weekly) + (rate|usage) limit language
  const hasWindow =
    /5-hour|5 hour|5h|weekly/i.test(text) ||
    /rate limits?|usage limits?/i.test(text);
  if (hasResetVerb && hasWindow) {
    hits = [...new Set([...hits, "co_presence_reset_limits"])];
  }

  // Drop bare "rate limits for all users" without any reset verb (API raise risk)
  if (!hasResetVerb) {
    hits = hits.filter(
      (h) =>
        h !== "rate limits for all users" &&
        h !== "rate limits for everyone" &&
        h !== "5-hour and weekly rate limits" &&
        h !== "5-hour and weekly usage limits",
    );
  }

  const scope =
    /all users|everyone|all plans|across all|pro and max|subscribers/i.test(
      text,
    )
      ? "all_paid"
      : hits.length
        ? "unknown"
        : "unknown";

  return {
    hits,
    type: "hard_reset",
    scope,
    excluded: hits.length === 0,
    excludeReason: hits.length === 0 ? "no_phrase_hit" : undefined,
  };
}

export function parseTweetUrl(url: string): { postId: string; handle?: string } | null {
  const m = url.match(
    /(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/i,
  );
  if (!m) return null;
  return { handle: m[1], postId: m[2] };
}

export function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}
