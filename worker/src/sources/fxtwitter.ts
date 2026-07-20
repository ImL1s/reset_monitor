/**
 * Free timeline discovery via FxTwitter / FxEmbed public API (no X API key).
 * Endpoint proven live 2026-07-20:
 *   GET https://api.fxtwitter.com/2/profile/{handle}/statuses?count=N
 */

import type { FetchedPost } from "./types.js";
export type { FetchedPost } from "./types.js";

export interface FxTimelineResult {
  handle: string;
  posts: FetchedPost[];
  rawCount: number;
}

type FxStatus = {
  type?: string;
  id?: string | number;
  url?: string;
  text?: string;
  replying_to?: unknown;
  quote?: unknown;
  retweet?: unknown;
  reposted_by?: unknown;
  created_at?: string;
  author?: {
    screen_name?: string;
    id?: string | number;
  };
};

function asBoolish(v: unknown): boolean {
  return v != null && v !== false && v !== "";
}

export function normalizeFxStatus(
  item: FxStatus,
  fallbackHandle: string,
): FetchedPost | null {
  const id = item.id != null ? String(item.id) : "";
  if (!id || !/^\d+$/.test(id)) return null;
  const text = (item.text ?? "").trim();
  if (!text) return null;

  const handle = (
    item.author?.screen_name ??
    fallbackHandle
  ).toLowerCase();

  const url =
    item.url ??
    `https://x.com/${handle}/status/${id}`;

  return {
    postId: id,
    url,
    text,
    authorHandle: handle,
    authorUserId:
      item.author?.id != null ? String(item.author.id) : undefined,
    isReply: asBoolish(item.replying_to),
    isQuote: asBoolish(item.quote),
    isRetweet: asBoolish(item.retweet) || asBoolish(item.reposted_by),
    createdAt: item.created_at,
    sourceAdapter: "fxtwitter_v2",
  };
}

export async function fetchFxTimeline(
  handle: string,
  opts: { count?: number; fetchImpl?: typeof fetch } = {},
): Promise<FxTimelineResult> {
  const count = Math.min(Math.max(opts.count ?? 10, 1), 20);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `https://api.fxtwitter.com/2/profile/${encodeURIComponent(handle)}/statuses?count=${count}`;
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RESET-Radar/1.0 (+https://reset-radar-web.pages.dev)",
    },
  });
  if (!res.ok) {
    throw new Error(`fxtwitter_http_${res.status}`);
  }
  const data = (await res.json()) as {
    code?: number;
    results?: FxStatus[];
    message?: string;
  };
  if (data.code != null && data.code !== 200) {
    throw new Error(`fxtwitter_code_${data.code}`);
  }
  const results = Array.isArray(data.results) ? data.results : [];
  const posts: FetchedPost[] = [];
  for (const item of results) {
    const n = normalizeFxStatus(item, handle);
    if (n) posts.push(n);
  }
  return { handle, posts, rawCount: results.length };
}
