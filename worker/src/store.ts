import {
  EventCandidate,
  ProviderConfig,
  ProviderId,
  ProviderRuntimeMeta,
  PublishedEvent,
  RawSource,
} from "./types.js";
import {
  addHours,
  classifyClaudeText,
  classifyCodexText,
  nowIso,
  parseTweetUrl,
  simpleHash,
  ttlHoursForType,
} from "./status.js";

const PROVIDERS: ProviderConfig[] = [
  {
    id: "codex",
    display_name: "Codex",
    monitored: true,
    authority_hint: "staff",
  },
  {
    id: "claude",
    display_name: "Claude",
    monitored: true,
    authority_hint: "official_product",
  },
  {
    id: "grok",
    display_name: "Grok",
    monitored: false,
    coverage_note: "尚無穩定公開 hard-reset 官源",
  },
  {
    id: "kimi",
    display_name: "Kimi",
    monitored: false,
    coverage_note: "尚無穩定公開 hard-reset 官源",
  },
  {
    id: "glm",
    display_name: "GLM / z.ai",
    monitored: false,
    coverage_note: "尚無穩定公開 hard-reset 官源",
  },
  {
    id: "antigravity",
    display_name: "Antigravity",
    monitored: false,
    coverage_note: "尚無穩定公開 hard-reset 官源",
  },
];

/** Allowlisted handles → real X user ids (from FxTwitter profile, 2026-07-20). */
export const AUTHOR_ALLOWLIST: Record<
  string,
  { userId: string; grade: "official_product" | "staff"; providers: ProviderId[] }
> = {
  thsottiaux: {
    userId: "1953337039510003712",
    grade: "staff",
    providers: ["codex"],
  },
  claudedevs: {
    userId: "2024518793679294464",
    grade: "official_product",
    providers: ["claude"],
  },
  openaidevs: {
    userId: "xuid_openaidevs_mvp",
    grade: "official_product",
    providers: ["codex"],
  },
};

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export class MemoryStore {
  providers = PROVIDERS;
  raws = new Map<string, RawSource>();
  candidates = new Map<string, EventCandidate>();
  events = new Map<string, PublishedEvent>();
  meta = new Map<ProviderId, ProviderRuntimeMeta>();
  /** Last free-auto pipeline report (in-memory + KV via serialize). */
  lastPipelineReport: unknown = null;

  constructor() {
    for (const p of PROVIDERS) {
      this.meta.set(p.id, {});
    }
  }

  listProviders(): ProviderConfig[] {
    return this.providers;
  }

  getMeta(id: ProviderId): ProviderRuntimeMeta {
    return this.meta.get(id) ?? {};
  }

  touchHeartbeat(provider: ProviderId, at: string = nowIso()): void {
    const m = this.getMeta(provider);
    this.meta.set(provider, {
      ...m,
      last_operator_heartbeat_at: at,
    });
  }

  touchIngest(provider: ProviderId, at: string = nowIso()): void {
    const m = this.getMeta(provider);
    this.meta.set(provider, {
      ...m,
      last_successful_ingest_at: at,
      last_operator_heartbeat_at: at,
    });
  }

  eventsFor(provider: ProviderId): PublishedEvent[] {
    return [...this.events.values()].filter((e) => e.provider === provider);
  }

  pendingFor(provider: ProviderId): EventCandidate | null {
    const list = [...this.candidates.values()]
      .filter((c) => c.provider === provider && c.status === "pending_review")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return list[0] ?? null;
  }

  allEventsSorted(): PublishedEvent[] {
    return [...this.events.values()].sort(
      (a, b) =>
        new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime(),
    );
  }

  ingest(input: {
    url: string;
    provider: ProviderId;
    raw_text: string;
    author_handle?: string;
    author_user_id?: string;
    post_id?: string;
    is_reply?: boolean;
    is_quote?: boolean;
    is_retweet?: boolean;
    fetched_at?: string;
  }): { raw: RawSource; candidate: EventCandidate; duplicate: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const parsed = parseTweetUrl(input.url);
    const postId = input.post_id ?? parsed?.postId;
    if (!postId) {
      throw new Error("invalid_url_or_post_id");
    }
    const handle = (
      input.author_handle ??
      parsed?.handle ??
      "unknown"
    ).toLowerCase();

    const allow = AUTHOR_ALLOWLIST[handle];
    if (!allow) {
      throw new Error("author_not_allowlisted");
    }
    if (!allow.providers.includes(input.provider)) {
      warnings.push("provider_author_mismatch");
    }

    // unique platform+post_id
    for (const r of this.raws.values()) {
      if (r.post_id === postId) {
        const cand = [...this.candidates.values()].find(
          (c) => c.raw_source_id === r.id,
        );
        if (cand) {
          return { raw: r, candidate: cand, duplicate: true, warnings };
        }
      }
    }

    const now = nowIso();
    const raw: RawSource = {
      id: uid("raw"),
      platform: "x",
      author_user_id: input.author_user_id ?? allow.userId,
      author_handle: handle,
      post_id: postId,
      url: input.url,
      fetched_at: input.fetched_at ?? now,
      raw_text: input.raw_text,
      is_reply: !!input.is_reply,
      is_quote: !!input.is_quote,
      is_retweet: !!input.is_retweet,
      created_at: now,
    };
    this.raws.set(raw.id, raw);

    const clf =
      input.provider === "claude"
        ? classifyClaudeText(input.raw_text)
        : classifyCodexText(input.raw_text);

    if (raw.is_retweet || raw.is_quote || raw.is_reply) {
      warnings.push("reply_quote_or_rt");
    }
    if (clf.excluded) {
      warnings.push(clf.excludeReason ?? "excluded");
    }

    const autoReject =
      clf.excluded ||
      raw.is_retweet ||
      (raw.is_quote && clf.hits.length === 0) ||
      raw.is_reply;

    const candidate: EventCandidate = {
      id: uid("cand"),
      provider: input.provider,
      raw_source_id: raw.id,
      suggested_type: clf.type,
      suggested_scope: clf.scope,
      rule_hits: clf.hits,
      rule_version: "2026-07-20.1",
      status: autoReject ? "rejected" : "pending_review",
      reject_reason: autoReject
        ? (clf.excludeReason ?? "excluded_context")
        : null,
      created_at: now,
      updated_at: now,
      source_url: raw.url,
      raw_text: raw.raw_text,
      post_id: raw.post_id,
      author_handle: raw.author_handle,
      author_user_id: raw.author_user_id,
    };
    this.candidates.set(candidate.id, candidate);
    this.touchIngest(input.provider, now);
    return { raw, candidate, duplicate: false, warnings };
  }

  confirm(
    candidateId: string,
    body: {
      type?: PublishedEvent["type"];
      scope?: PublishedEvent["scope"];
      title?: string;
      body_excerpt?: string;
      effective_at?: string;
      display_until?: string | null;
      decision_by?: string;
      decision_reason?: string;
      claim_url?: string;
      claim_note?: string;
    } = {},
  ): PublishedEvent {
    const cand = this.candidates.get(candidateId);
    if (!cand) throw new Error("candidate_not_found");
    if (cand.status !== "pending_review") throw new Error("candidate_not_pending");

    // unique published
    for (const e of this.events.values()) {
      if (
        e.provider === cand.provider &&
        e.source_post_id === cand.post_id &&
        !e.retracted_at
      ) {
        throw new Error("duplicate_published");
      }
    }

    const allow = AUTHOR_ALLOWLIST[cand.author_handle.toLowerCase()];
    const now = nowIso();
    const effective = body.effective_at ?? now;
    const type = body.type ?? cand.suggested_type;
    const displayUntil =
      body.display_until ?? addHours(effective, ttlHoursForType(type));

    const ev: PublishedEvent = {
      id: uid("evt"),
      provider: cand.provider,
      type,
      scope: body.scope ?? cand.suggested_scope,
      title:
        body.title ??
        (type === "banked_credit"
          ? "Banked reset announced"
          : "Usage limits reset"),
      body_excerpt: body.body_excerpt ?? cand.raw_text.slice(0, 280),
      source_url: cand.source_url,
      source_post_id: cand.post_id,
      source_author: cand.author_handle,
      authority_grade: allow?.grade ?? "other",
      confidence: "confirmed",
      effective_at: effective,
      display_until: displayUntil,
      first_seen_at: cand.created_at,
      verified_at: now,
      decision_by: body.decision_by ?? "admin@local",
      decision_reason: body.decision_reason ?? "admin_confirm",
      rule_version: cand.rule_version,
      evidence: [
        {
          url: cand.source_url,
          post_id: cand.post_id,
          author_handle: cand.author_handle,
          author_user_id: cand.author_user_id,
          raw_text: cand.raw_text,
          fetched_at: now,
          content_hash: simpleHash(cand.raw_text),
        },
      ],
      candidate_id: cand.id,
      claim_url: body.claim_url ?? null,
      claim_note:
        body.claim_note ??
        (type === "banked_credit"
          ? "需自行在產品內兌換，非自動補滿"
          : null),
    };

    cand.status = "promoted";
    cand.updated_at = now;
    this.candidates.set(cand.id, cand);
    this.events.set(ev.id, ev);
    this.touchHeartbeat(cand.provider, now);
    return ev;
  }

  reject(candidateId: string, reason: string): EventCandidate {
    const cand = this.candidates.get(candidateId);
    if (!cand) throw new Error("candidate_not_found");
    cand.status = "rejected";
    cand.reject_reason = reason;
    cand.updated_at = nowIso();
    this.candidates.set(cand.id, cand);
    return cand;
  }

  /** Re-open soft-rejected candidates so a later poll can re-judge (infra recover). */
  requeueSoftRejected(candidateId: string): EventCandidate | null {
    const cand = this.candidates.get(candidateId);
    if (!cand || cand.status !== "rejected") return null;
    const reason = cand.reject_reason ?? "";
    if (!isSoftRejectReason(reason)) return null;
    cand.status = "pending_review";
    cand.reject_reason = null;
    cand.updated_at = nowIso();
    this.candidates.set(cand.id, cand);
    return cand;
  }

  findCandidateByPostId(postId: string): EventCandidate | null {
    for (const c of this.candidates.values()) {
      if (c.post_id === postId) return c;
    }
    return null;
  }

  retract(eventId: string, reason: string, by = "admin@local"): PublishedEvent {
    const ev = this.events.get(eventId);
    if (!ev) throw new Error("event_not_found");
    ev.retracted_at = nowIso();
    ev.retract_reason = reason;
    ev.retract_by = by;
    this.events.set(ev.id, ev);
    return ev;
  }
}

/** Soft rejects may be re-opened; hard content rejects stay dead. */
export function isSoftRejectReason(reason: string): boolean {
  return (
    reason.startsWith("opencode_http_") ||
    reason.startsWith("opencode_network") ||
    reason.startsWith("llm_http_") ||
    reason.startsWith("llm_parse:") ||
    reason.startsWith("free_fail:") ||
    reason.includes("opencode_http_") ||
    reason.includes("infra_") ||
    reason === "llm_unavailable"
  );
}

export const store = new MemoryStore();
