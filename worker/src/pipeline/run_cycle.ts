import { isSoftRejectReason, store } from "../store.js";
import { fetchFxTimeline } from "../sources/fxtwitter.js";
import { fetchDayclawItems } from "../sources/dayclaw.js";
import type { FetchedPost } from "../sources/types.js";
import {
  hasGlobalScopeSignal,
  hasUsagePhraseFloor,
  isBanked,
  shouldAutoPublish,
} from "./auto_publish.js";
import { llmJudgePromote } from "./llm_gate.js";
import { isInfraFailureReason } from "./opencode_zen_gate.js";
import { notifyOutbox } from "../notify.js";
import type { ProviderId } from "../types.js";
import { nowIso } from "../status.js";

/** Content fails that can still promote after LLM becomes available. */
const AWAITING_LLM_REASONS = new Set([
  "no_strong_template",
  "no_scope_signal",
  "no_phrase_floor",
]);

export type MonitoredAccount = {
  handle: string;
  provider: ProviderId;
  userId: string;
};

export const MONITORED_ACCOUNTS: MonitoredAccount[] = [
  {
    handle: "thsottiaux",
    provider: "codex",
    userId: "1953337039510003712",
  },
  {
    handle: "ClaudeDevs",
    provider: "claude",
    userId: "2024518793679294464",
  },
];

export type CycleAccountReport = {
  handle: string;
  provider: ProviderId;
  ok: boolean;
  source?: string;
  fetched: number;
  ingested_new: number;
  duplicates: number;
  promoted: number;
  rejected: number;
  soft_pending: number;
  error?: string;
};

export type PipelineCycleReport = {
  ran_at: string;
  auto_publish: boolean;
  source: string;
  accounts: CycleAccountReport[];
  promoted_event_ids: string[];
};

export type RunCycleOptions = {
  autoPublish?: boolean;
  count?: number;
  fetchImpl?: typeof fetch;
  accounts?: MonitoredAccount[];
};

async function fetchAccountPosts(
  handle: string,
  count: number,
  fetchImpl?: typeof fetch,
): Promise<{ posts: FetchedPost[]; source: string }> {
  const errors: string[] = [];
  try {
    const tl = await fetchFxTimeline(handle, { count, fetchImpl });
    if (tl.posts.length) {
      return {
        posts: tl.posts.map((p) => ({
          ...p,
          sourceAdapter: "fxtwitter_v2" as const,
        })),
        source: "fxtwitter_v2",
      };
    }
    errors.push("fxtwitter_empty");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    const posts = await fetchDayclawItems(handle, { fetchImpl, limit: count });
    if (posts.length) return { posts, source: "dayclaw_public" };
    errors.push("dayclaw_empty");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  throw new Error(errors.join("|") || "all_sources_failed");
}

async function tryPromoteCandidate(
  candId: string,
  autoPublish: boolean,
  fetchImpl: typeof fetch | undefined,
  g: {
    LLM_GATE_URL?: string;
    LLM_GATE_TOKEN?: string;
    LLM_GATE_MODE?: string;
    OPENCODE_GO_API_KEY?: string;
    OPENCODE_ZEN_API_KEY?: string;
    OPENCODE_ZEN_MODEL?: string;
    OPENCODE_ZEN_BASE?: string;
  },
): Promise<
  | { kind: "promoted"; eventId: string }
  | { kind: "hard_reject"; reason: string }
  | { kind: "soft_pending"; reason: string }
  | { kind: "skip" }
> {
  const cand = store.candidates.get(candId);
  if (!cand || cand.status !== "pending_review" || !autoPublish) {
    return { kind: "skip" };
  }

  let gate = shouldAutoPublish(cand);
  let decisionBy = "auto_rules";

  const llmToken =
    g.OPENCODE_GO_API_KEY || g.OPENCODE_ZEN_API_KEY || g.LLM_GATE_TOKEN;

  if (!gate.ok && llmToken) {
    const j = await llmJudgePromote(cand, {
      url: g.LLM_GATE_URL,
      token: llmToken,
      mode: g.LLM_GATE_MODE ?? "opencode_free_then_go",
      model: g.OPENCODE_ZEN_MODEL ?? "deepseek-v4-flash",
      baseUrl: g.OPENCODE_ZEN_BASE ?? "https://opencode.ai/zen/go/v1",
      freeModel: "deepseek-v4-flash-free",
      goModel: "deepseek-v4-flash",
      freeBase: "https://opencode.ai/zen/v1",
      goBase: "https://opencode.ai/zen/go/v1",
      fetchImpl,
    });
    if (j.ok) {
      // Phrase floor: LLM cannot invent green without usage-limit language
      if (!hasUsagePhraseFloor(cand.raw_text)) {
        // Hard reject — same text will never grow a floor; avoid infinite LLM burn
        gate = { ok: false, reason: "llm_no_phrase_floor" };
      } else if (
        j.type !== "banked_credit" &&
        !isBanked(cand.raw_text) &&
        !hasGlobalScopeSignal(cand.raw_text)
      ) {
        // Deterministic scope second gate (P1): no pure "rate limit / 5h" narrative
        gate = { ok: false, reason: "llm_no_scope_signal" };
      } else {
        const via = j.via ? `:${j.via}` : "";
        const type = j.type === "banked_credit" || isBanked(cand.raw_text)
          ? "banked_credit"
          : j.type;
        gate = {
          ok: true,
          reason: j.reason,
          type,
          title:
            type === "banked_credit"
              ? `Banked reset (llm${via})`
              : `Hard reset (llm${via})`,
        };
        decisionBy = "auto_rules_llm";
      }
    } else if (isInfraFailureReason(j.reason) || isSoftRejectReason(j.reason)) {
      return { kind: "soft_pending", reason: j.reason };
    } else {
      gate = { ok: false, reason: j.reason };
    }
  }

  if (gate.ok) {
    const ev = store.confirm(cand.id, {
      type: gate.type,
      title: gate.title,
      decision_by: decisionBy,
      decision_reason: gate.reason,
      body_excerpt: cand.raw_text.slice(0, 280),
    });
    notifyOutbox.enqueue({
      event_id: ev.id,
      kind: "confirmed",
      payload: `✅ ${ev.provider} ${ev.type}: ${ev.title}\n${ev.source_url}`,
    });
    return { kind: "promoted", eventId: ev.id };
  }

  // Soft: infra / transport only — keep pending so next cycle can retry
  if (isSoftRejectReason(gate.reason) || isInfraFailureReason(gate.reason)) {
    return { kind: "soft_pending", reason: gate.reason };
  }

  // No LLM configured yet: hold weak matches for later LLM / template expansion
  if (!llmToken && AWAITING_LLM_REASONS.has(gate.reason)) {
    return { kind: "soft_pending", reason: "llm_unavailable" };
  }

  // Content rejects (including llm_no_phrase_floor / llm_no_scope_signal) are permanent
  store.reject(cand.id, gate.reason);
  return { kind: "hard_reject", reason: gate.reason };
}

/**
 * Full free-auto cycle: multi-source timeline → ingest → strict auto-publish.
 */
export async function runAutoCycle(
  opts: RunCycleOptions = {},
): Promise<PipelineCycleReport> {
  const autoPublish = opts.autoPublish !== false;
  const count = opts.count ?? 10;
  const accounts = opts.accounts ?? MONITORED_ACCOUNTS;
  const report: PipelineCycleReport = {
    ran_at: nowIso(),
    auto_publish: autoPublish,
    source: "multi",
    accounts: [],
    promoted_event_ids: [],
  };

  const g = globalThis as {
    LLM_GATE_URL?: string;
    LLM_GATE_TOKEN?: string;
    LLM_GATE_MODE?: string;
    OPENCODE_GO_API_KEY?: string;
    OPENCODE_ZEN_API_KEY?: string;
    OPENCODE_ZEN_MODEL?: string;
    OPENCODE_ZEN_BASE?: string;
  };

  for (const acc of accounts) {
    const ar: CycleAccountReport = {
      handle: acc.handle,
      provider: acc.provider,
      ok: false,
      fetched: 0,
      ingested_new: 0,
      duplicates: 0,
      promoted: 0,
      rejected: 0,
      soft_pending: 0,
    };

    try {
      const { posts, source } = await fetchAccountPosts(
        acc.handle,
        count,
        opts.fetchImpl,
      );
      ar.source = source;
      ar.fetched = posts.length;
      store.touchHeartbeat(acc.provider);

      for (const post of posts) {
        if (post.authorHandle.toLowerCase() !== acc.handle.toLowerCase()) {
          continue;
        }

        try {
          const result = store.ingest({
            url: post.url,
            provider: acc.provider,
            raw_text: post.text,
            author_handle: post.authorHandle,
            author_user_id: post.authorUserId ?? acc.userId,
            post_id: post.postId,
            is_reply: post.isReply,
            is_quote: post.isQuote,
            is_retweet: post.isRetweet,
          });

          let cand = result.candidate;

          if (result.duplicate) {
            ar.duplicates += 1;
            // Re-open soft rejects so recovered infra can green true positives
            if (cand.status === "rejected") {
              const reopened = store.requeueSoftRejected(cand.id);
              if (reopened) cand = reopened;
              else continue;
            } else if (cand.status === "pending_review") {
              // fall through to re-judge
            } else {
              continue;
            }
          } else {
            ar.ingested_new += 1;
          }

          if (cand.status === "rejected") {
            ar.rejected += 1;
            continue;
          }

          const outcome = await tryPromoteCandidate(
            cand.id,
            autoPublish,
            opts.fetchImpl,
            g,
          );
          if (outcome.kind === "promoted") {
            ar.promoted += 1;
            report.promoted_event_ids.push(outcome.eventId);
          } else if (outcome.kind === "hard_reject") {
            ar.rejected += 1;
          } else if (outcome.kind === "soft_pending") {
            ar.soft_pending += 1;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!ar.error) ar.error = msg;
        }
      }

      ar.ok = true;
    } catch (e) {
      ar.ok = false;
      ar.error = e instanceof Error ? e.message : String(e);
    }

    report.accounts.push(ar);
  }

  await notifyOutbox.drain();
  store.lastPipelineReport = report;
  return report;
}
