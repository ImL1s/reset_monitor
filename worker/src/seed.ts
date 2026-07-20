/**
 * Seed historical fixtures into MemoryStore for cold-start demo.
 * Idempotent: safe to call multiple times.
 */
import { store } from "./store.js";
import { addHours, nowIso } from "./status.js";

function alreadyPublished(provider: string, postId: string): boolean {
  return [...store.events.values()].some(
    (e) => e.provider === provider && e.source_post_id === postId && !e.retracted_at,
  );
}

export function seedHistoricalFixtures(): void {
  store.touchHeartbeat("codex");
  store.touchHeartbeat("claude");

  const codexPost = "2078320950488297917";
  if (!alreadyPublished("codex", codexPost)) {
    const codexIn = store.ingest({
      url: `https://x.com/thsottiaux/status/${codexPost}`,
      provider: "codex",
      author_handle: "thsottiaux",
      raw_text:
        "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex and ChatGPT Work. Super grateful for an incredible team who is iterating at lightspeed and keeping the infra up as we scale faster than ever. Enjoy the weekend!",
      fetched_at: "2026-07-18T03:28:22.000Z",
    });
    if (codexIn.candidate.status === "pending_review") {
      store.confirm(codexIn.candidate.id, {
        type: "hard_reset",
        scope: "all_paid",
        title: "Codex hard reset — all paid (Codex + ChatGPT Work)",
        body_excerpt: codexIn.candidate.raw_text.slice(0, 200),
        effective_at: "2026-07-18T03:28:22.000Z",
        display_until: addHours(nowIso(), 24),
        decision_by: "seed@local",
        decision_reason: "historical_fixture_backfill",
      });
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

  // Teaser pending — only if not already ingested
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
}
