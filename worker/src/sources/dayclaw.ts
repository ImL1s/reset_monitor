/**
 * Free public X items via Dayclaw (used by codex-reset-watchdog).
 * GET https://api.dayclaw.com/api/source/public/x/{handle}/items
 */
import type { FetchedPost } from "./types.js";

export async function fetchDayclawItems(
  handle: string,
  opts: { fetchImpl?: typeof fetch; limit?: number } = {},
): Promise<FetchedPost[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `https://api.dayclaw.com/api/source/public/x/${encodeURIComponent(handle)}/items`;
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RESET-Radar/1.0",
    },
  });
  if (!res.ok) throw new Error(`dayclaw_http_${res.status}`);
  const data = (await res.json()) as {
    items?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
    results?: Array<Record<string, unknown>>;
  };
  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.results)
        ? data.results
        : [];

  const out: FetchedPost[] = [];
  for (const it of items.slice(0, opts.limit ?? 20)) {
    const id = String(
      it.id ?? it.tweet_id ?? it.external_id ?? it.status_id ?? "",
    );
    const text = String(it.text ?? it.content ?? it.body ?? it.raw_text ?? "");
    if (!/^\d+$/.test(id) || !text) continue;
    const author = String(it.author_handle ?? it.username ?? it.screen_name ?? handle)
      .replace(/^@/, "")
      .toLowerCase();
    out.push({
      postId: id,
      url: String(it.url ?? it.tweet_url ?? `https://x.com/${author}/status/${id}`),
      text,
      authorHandle: author,
      authorUserId: it.author_id != null ? String(it.author_id) : undefined,
      isReply: Boolean(it.is_reply ?? it.replying_to ?? it.in_reply_to),
      isQuote: Boolean(it.is_quote ?? it.quote),
      isRetweet: Boolean(it.is_retweet ?? it.retweet ?? it.reposted_by),
      createdAt: it.created_at != null ? String(it.created_at) : undefined,
      sourceAdapter: "dayclaw_public",
    });
  }
  return out;
}
