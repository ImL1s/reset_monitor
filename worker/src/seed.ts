/**
 * Seed historical fixtures into MemoryStore for cold-start demo.
 * Idempotent: safe to call multiple times.
 */
import { store } from "./store.js";
import { addHours, nowIso } from "./status.js";
import { shouldAutoPublish } from "./pipeline/auto_publish.js";
import { CODEX_HISTORY } from "./seed_data_codex.js";

function alreadyPublished(provider: string, postId: string): boolean {
  return [...store.events.values()].some(
    (e) =>
      e.provider === provider &&
      e.source_post_id === postId &&
      !e.retracted_at,
  );
}

export function seedHistoricalFixtures(): void {
  store.touchHeartbeat("codex");
  store.touchHeartbeat("claude");

  // Full Codex history from codex-resets.com corpus
  for (const e of CODEX_HISTORY) {
    if (alreadyPublished("codex", e.tweet_id)) continue;
    try {
      const ing = store.ingest({
        url: e.tweet_url,
        provider: "codex",
        author_handle: e.author_handle || "thsottiaux",
        raw_text: e.text,
        post_id: e.tweet_id,
        fetched_at: e.announced_at,
      });
      if (ing.duplicate) continue;
      if (ing.candidate.status !== "pending_review") continue;
      const gate = shouldAutoPublish(ing.candidate);
      if (!gate.ok) continue;
      store.confirm(ing.candidate.id, {
        type: gate.type,
        scope: "all_paid",
        title: gate.title ?? e.text.slice(0, 80),
        body_excerpt: e.text.slice(0, 280),
        effective_at: e.announced_at,
        // Past TTL for old events → last_confirmed only, not active green
        display_until: addHours(e.announced_at, 24),
        decision_by: "seed_history",
        decision_reason: gate.reason,
      });
    } catch {
      /* skip bad rows */
    }
  }

  const claudePost = "2077603834453770467";
  if (!alreadyPublished("claude", claudePost)) {
    const claudeIn = store.ingest({
      url: `https://x.com/ClaudeDevs/status/${claudePost}`,
      provider: "claude",
      author_handle: "ClaudeDevs",
      raw_text: "We've reset 5-hour and weekly rate limits for all users.",
      fetched_at: "2026-07-16T03:58:48.000Z",
    });
    if (claudeIn.candidate.status === "pending_review") {
      store.confirm(claudeIn.candidate.id, {
        type: "hard_reset",
        scope: "all_paid",
        title: "Claude 5h + weekly limits reset for all users",
        body_excerpt: claudeIn.candidate.raw_text,
        effective_at: "2026-07-16T03:58:48.000Z",
        display_until: "2026-07-17T03:58:48.000Z",
        decision_by: "seed@local",
        decision_reason: "historical_fixture_backfill",
      });
    }
  }

  // Teaser — must remain rejected
  const teaserPost = "2077271889626706300";
  const hasTeaser = [...store.raws.values()].some((r) => r.post_id === teaserPost);
  if (!hasTeaser) {
    store.ingest({
      url: `https://x.com/thsottiaux/status/${teaserPost}`,
      provider: "codex",
      author_handle: "thsottiaux",
      raw_text:
        "Embarrassment of riches. But looks like we might hit 9M soon. Should we reset the ChatGPT Work and Codex usage again or give it some space?",
      fetched_at: nowIso(),
    });
  }

  // Keep most recent seed green for demo if still within window relative to seed time
  const latest = "2078320950488297917";
  const latestEv = [...store.events.values()].find(
    (e) => e.source_post_id === latest && e.provider === "codex",
  );
  if (latestEv) {
    latestEv.display_until = addHours(nowIso(), 24);
    latestEv.verified_at = latestEv.effective_at;
    store.events.set(latestEv.id, latestEv);
  }
}
