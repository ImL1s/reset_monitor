import type { EventCandidate, EventType } from "../types.js";

export async function llmJudgePromote(
  cand: EventCandidate,
  opts: {
    url: string;
    token: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ ok: boolean; type?: EventType; reason: string }> {
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
