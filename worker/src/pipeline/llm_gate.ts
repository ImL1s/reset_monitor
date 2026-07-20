import type { EventCandidate, EventType } from "../types.js";
import {
  opencodeFreeThenGoJudge,
  opencodeZenJudge,
} from "./opencode_zen_gate.js";

/**
 * LLM second-look for auto-green.
 *
 * Default mode `opencode_free_then_go`:
 *   1) Zen free  deepseek-v4-flash-free @ /zen/v1
 *   2) if free infra fails → Go sub deepseek-v4-flash @ /zen/go/v1
 *
 * Modes:
 *   opencode_free_then_go (default)
 *   opencode_go
 *   opencode_zen
 *   custom (LLM_GATE_URL)
 */
export async function llmJudgePromote(
  cand: EventCandidate,
  opts: {
    url?: string;
    token: string;
    mode?: string;
    model?: string;
    baseUrl?: string;
    freeModel?: string;
    goModel?: string;
    freeBase?: string;
    goBase?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ ok: boolean; type?: EventType; reason: string; via?: string }> {
  const mode = opts.mode ?? "opencode_free_then_go";

  if (mode === "opencode_free_then_go") {
    return opencodeFreeThenGoJudge(cand, {
      apiKey: opts.token,
      freeModel: opts.freeModel,
      goModel: opts.goModel ?? opts.model,
      freeBase: opts.freeBase,
      goBase: opts.goBase ?? opts.baseUrl,
      fetchImpl: opts.fetchImpl,
    });
  }

  if (mode === "opencode_go" || mode === "opencode_zen") {
    const baseUrl =
      opts.baseUrl ??
      (mode === "opencode_zen"
        ? "https://opencode.ai/zen/v1"
        : "https://opencode.ai/zen/go/v1");
    const model =
      opts.model ??
      (mode === "opencode_zen"
        ? "deepseek-v4-flash-free"
        : "deepseek-v4-flash");
    return opencodeZenJudge(cand, {
      apiKey: opts.token,
      model,
      baseUrl,
      fetchImpl: opts.fetchImpl,
      via: mode === "opencode_zen" ? "zen_free" : "go_sub",
    });
  }

  if (!opts.url) {
    // fallback cascade if misconfigured
    return opencodeFreeThenGoJudge(cand, {
      apiKey: opts.token,
      fetchImpl: opts.fetchImpl,
    });
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(opts.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({
      provider: cand.provider,
      text: cand.raw_text,
      author: cand.author_handle,
      url: cand.source_url,
      instruction:
        "Return JSON {promote:boolean,type?:hard_reset|banked_credit,reason:string}. Promote only clear public usage limit hard/banked resets. Reject teasers/questions/negations/non-quota.",
    }),
  });
  if (!res.ok) return { ok: false, reason: `llm_http_${res.status}` };
  const data = (await res.json()) as {
    promote?: boolean;
    type?: EventType;
    reason?: string;
  };
  if (!data.promote) return { ok: false, reason: data.reason ?? "llm_reject" };
  return {
    ok: true,
    type: data.type === "banked_credit" ? "banked_credit" : "hard_reset",
    reason: data.reason ?? "llm_promote",
  };
}
