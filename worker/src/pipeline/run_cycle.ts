import { store } from "../store.js";
import { fetchFxTimeline } from "../sources/fxtwitter.js";
import { fetchDayclawItems } from "../sources/dayclaw.js";
import type { FetchedPost } from "../sources/types.js";
import { shouldAutoPublish } from "./auto_publish.js";
import { llmJudgePromote } from "./llm_gate.js";
import { notifyOutbox } from "../notify.js";
import type { ProviderId } from "../types.js";
import { nowIso } from "../status.js";

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

          if (result.duplicate) {
            ar.duplicates += 1;
            continue;
          }
          ar.ingested_new += 1;

          const cand = result.candidate;
          if (cand.status === "rejected") {
            ar.rejected += 1;
            continue;
          }

          if (cand.status === "pending_review" && autoPublish) {
            let gate = shouldAutoPublish(cand);
            let decisionBy = "auto_rules";

            const llmToken =
              g.OPENCODE_GO_API_KEY ||
              g.OPENCODE_ZEN_API_KEY ||
              g.LLM_GATE_TOKEN;
            // LLM second look: free Zen first, Go only if free infra dies
            if (!gate.ok && llmToken && cand.status === "pending_review") {
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
                fetchImpl: opts.fetchImpl,
              });
              if (j.ok) {
                const via = j.via ? `:${j.via}` : "";
                gate = {
                  ok: true,
                  reason: j.reason,
                  type: j.type,
                  title:
                    j.type === "banked_credit"
                      ? `Banked reset (llm${via})`
                      : `Hard reset (llm${via})`,
                };
                decisionBy = "auto_rules_llm";
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
              ar.promoted += 1;
              report.promoted_event_ids.push(ev.id);
              notifyOutbox.enqueue({
                event_id: ev.id,
                kind: "confirmed",
                payload: `✅ ${ev.provider} ${ev.type}: ${ev.title}\n${ev.source_url}`,
              });
            } else {
              store.reject(cand.id, gate.reason);
              ar.rejected += 1;
            }
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
