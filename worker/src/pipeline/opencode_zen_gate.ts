/**
 * OpenCode LLM judge: free Zen first, Go subscription fallback.
 *
 * OpenCode Zen free:
 * - Base: https://opencode.ai/zen/v1
 * - Model: deepseek-v4-flash-free (default free)
 *
 * OpenCode Go (subscription) fallback when free is down / rate-limited:
 * - Base: https://opencode.ai/zen/go/v1
 * - Model: deepseek-v4-flash
 *
 * Same API key often works for both (Go key).
 * Fallback only on infrastructure failure — not when free says promote=false.
 */

import type { EventCandidate, EventType } from "../types.js";

export const OPENCODE_ZEN_FREE_BASE = "https://opencode.ai/zen/v1";
export const OPENCODE_GO_BASE = "https://opencode.ai/zen/go/v1";
export const OPENCODE_FREE_MODEL = "deepseek-v4-flash-free";
export const OPENCODE_GO_MODEL = "deepseek-v4-flash";

const SYSTEM = [
  "You classify public AI coding USAGE LIMIT reset announcements.",
  'Reply with ONLY minified JSON (no markdown): {"promote":boolean,"type":"hard_reset"|"banked_credit"|null,"reason":string}.',
  "promote=true only for clear global hard resets or banked reset grants already announced.",
  "Reject: questions/teasers, speculation, personal quota, git reset, pure chatter, outages without limit reset, negation.",
  "If a banked reset was granted, type=banked_credit and promote=true.",
  "Do not invent security/vulnerability narratives; only use the given text.",
].join(" ");

function parseJsonObject(content: string): {
  promote?: boolean;
  type?: string | null;
  reason?: string;
} {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("llm_no_json");
  return JSON.parse(content.slice(s, e + 1)) as {
    promote?: boolean;
    type?: string | null;
    reason?: string;
  };
}

/** True when free path is broken (should try Go). */
export function isInfraFailureReason(reason: string): boolean {
  return (
    reason.startsWith("opencode_http_") ||
    reason.startsWith("llm_parse:") ||
    reason.includes("opencode_network") ||
    reason.includes("fetch failed") ||
    reason.includes("AbortError") ||
    reason.includes("Timeout")
  );
}

export type JudgeResult = {
  ok: boolean;
  type?: EventType;
  reason: string;
  via?: "zen_free" | "go_sub" | "single";
};

export async function opencodeZenJudge(
  cand: EventCandidate,
  opts: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    via?: JudgeResult["via"];
  },
): Promise<JudgeResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = (opts.baseUrl ?? OPENCODE_GO_BASE).replace(/\/$/, "");
  const model = opts.model ?? OPENCODE_GO_MODEL;
  try {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "RESET-Radar/1.0 (+opencode-llm-gate)",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Author: ${cand.author_handle}\nProvider: ${cand.provider}\nURL: ${cand.source_url}\nText: ${cand.raw_text}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `opencode_http_${res.status}:${body.slice(0, 120)}`,
        via: opts.via ?? "single",
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    try {
      const j = parseJsonObject(content);
      if (!j.promote) {
        return {
          ok: false,
          reason: j.reason ?? "llm_reject",
          via: opts.via ?? "single",
        };
      }
      const type: EventType =
        j.type === "banked_credit" ? "banked_credit" : "hard_reset";
      return {
        ok: true,
        type,
        reason: j.reason ?? "llm_promote",
        via: opts.via ?? "single",
      };
    } catch (e) {
      return {
        ok: false,
        reason: `llm_parse:${e instanceof Error ? e.message : String(e)}`,
        via: opts.via ?? "single",
      };
    }
  } catch (e) {
    return {
      ok: false,
      reason: `opencode_network:${e instanceof Error ? e.message : String(e)}`,
      via: opts.via ?? "single",
    };
  }
}

/**
 * Prefer Zen free model; on infra failure fall back to Go subscription model.
 * Decision promote=false from free is final (does not burn Go quota).
 */
export async function opencodeFreeThenGoJudge(
  cand: EventCandidate,
  opts: {
    apiKey: string;
    freeModel?: string;
    goModel?: string;
    freeBase?: string;
    goBase?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<JudgeResult> {
  const free = await opencodeZenJudge(cand, {
    apiKey: opts.apiKey,
    model: opts.freeModel ?? OPENCODE_FREE_MODEL,
    baseUrl: opts.freeBase ?? OPENCODE_ZEN_FREE_BASE,
    fetchImpl: opts.fetchImpl,
    via: "zen_free",
  });

  if (free.ok) return free;
  if (!isInfraFailureReason(free.reason)) {
    // Valid reject from free model — do not spend Go
    return free;
  }

  const go = await opencodeZenJudge(cand, {
    apiKey: opts.apiKey,
    model: opts.goModel ?? OPENCODE_GO_MODEL,
    baseUrl: opts.goBase ?? OPENCODE_GO_BASE,
    fetchImpl: opts.fetchImpl,
    via: "go_sub",
  });
  // Annotate that free failed first
  if (!go.ok && isInfraFailureReason(go.reason)) {
    return {
      ...go,
      reason: `free_fail:${free.reason}|go_fail:${go.reason}`,
      via: "go_sub",
    };
  }
  return {
    ...go,
    reason: go.ok
      ? `go_fallback:${go.reason}`
      : go.reason,
  };
}
