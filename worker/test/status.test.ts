import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProviderCard,
  classifyClaudeText,
  classifyCodexText,
  computeSourceHealth,
  deriveDisplayStatus,
  isActionablePending,
  isActiveEvent,
} from "../src/status.js";
import type { EventCandidate, PublishedEvent } from "../src/types.js";

describe("classifyCodexText", () => {
  it("hits hard reset phrases", () => {
    const r = classifyCodexText(
      "Oops... I did it again. Enjoy reset usage limits for all paid users",
    );
    assert.ok(r.hits.length > 0);
    assert.equal(r.excluded, false);
    assert.equal(r.scope, "all_paid");
  });

  it("soft-matches previously missing hard posts", () => {
    for (const t of [
      "Introducing... another usage limit reset for all our ChatGPT Work and Codex users. Should land over next 30 minutes.",
      "And yes we are resetting the limits again too as I mentioned yesterday.",
      "We have now fixed this issue and are reseting the rate limit for all plus and pro users to compensate.",
      "usage limits will be fully reset again in the next hour and we will credit one additional reset into your bank",
    ]) {
      const r = classifyCodexText(t);
      assert.equal(r.excluded, false, t.slice(0, 50));
    }
  });

  it("explicit hard reset not typed as banked only", () => {
    const r = classifyCodexText(
      "This is a hard reset given some users had stacked up banked resets already.",
    );
    assert.equal(r.type, "hard_reset");
  });

  it("excludes question teaser", () => {
    const r = classifyCodexText(
      "Should we reset the ChatGPT Work and Codex usage again?",
    );
    assert.equal(r.excluded, true);
    assert.equal(r.excludeReason, "question_teaser");
  });

  it("detects banked", () => {
    const r = classifyCodexText(
      "We have added a banked reset to everyone's account",
    );
    assert.equal(r.type, "banked_credit");
  });
});

describe("classifyClaudeText", () => {
  it("matches official sentence", () => {
    const r = classifyClaudeText(
      "We've reset 5-hour and weekly rate limits for all users.",
    );
    assert.ok(r.hits.length > 0);
    assert.equal(r.excluded, false);
  });

  it("soft-matches the/just variants (not ingest-kill)", () => {
    for (const t of [
      "We've reset the 5-hour and weekly rate limits for all users.",
      "We've just reset 5-hour and weekly rate limits for all users.",
    ]) {
      const r = classifyClaudeText(t);
      assert.equal(r.excluded, false, t);
      assert.ok(r.hits.length > 0, t);
    }
  });

  it("excludes API raise and promo higher", () => {
    const raise = classifyClaudeText(
      "We've raised Claude Platform API rate limits for all users.",
    );
    assert.equal(raise.excluded, true);
    assert.equal(raise.excludeReason, "policy_raise_or_promo");
    const promo = classifyClaudeText(
      "We're keeping weekly limits 50% higher through August.",
    );
    assert.equal(promo.excluded, true);
  });

  it("excludes bare adjusting without reset", () => {
    const r = classifyClaudeText(
      "We're adjusting rate limits for all users this week.",
    );
    assert.equal(r.excluded, true);
  });
});

describe("computeSourceHealth", () => {
  it("stale without heartbeat", () => {
    const { health } = computeSourceHealth({}, true);
    assert.equal(health, "stale");
  });

  it("fresh with recent heartbeat", () => {
    const { health } = computeSourceHealth(
      { last_operator_heartbeat_at: new Date().toISOString() },
      true,
    );
    assert.equal(health, "fresh");
  });

  it("disabled when not monitored", () => {
    const { health } = computeSourceHealth({}, false);
    assert.equal(health, "disabled");
  });
});

describe("deriveDisplayStatus", () => {
  const baseEvent = {
    id: "e1",
    provider: "codex",
    type: "hard_reset",
    scope: "all_paid",
    title: "t",
    source_url: "https://x.com/x/status/1",
    source_post_id: "1",
    authority_grade: "staff",
    confidence: "confirmed",
    effective_at: new Date().toISOString(),
    display_until: new Date(Date.now() + 3600_000).toISOString(),
    first_seen_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
    decision_by: "a",
    evidence: [],
  } as PublishedEvent;

  it("active_confirmed when fresh + active", () => {
    const r = deriveDisplayStatus({
      monitored: true,
      sourceHealth: "fresh",
      activeEvent: baseEvent,
      pending: null,
      everConfirmed: true,
    });
    assert.equal(r.display, "active_confirmed");
  });

  it("keeps green degraded when stale + active", () => {
    const r = deriveDisplayStatus({
      monitored: true,
      sourceHealth: "stale",
      activeEvent: baseEvent,
      pending: null,
      everConfirmed: true,
    });
    assert.equal(r.display, "active_confirmed_degraded");
  });

  it("source_unhealthy when stale and no active", () => {
    const r = deriveDisplayStatus({
      monitored: true,
      sourceHealth: "stale",
      activeEvent: null,
      pending: null,
      everConfirmed: true,
    });
    assert.equal(r.display, "source_unhealthy");
  });

  it("last public reset prefers effective_at over verified_at", () => {
    const olderAnnounce: PublishedEvent = {
      ...baseEvent,
      id: "old",
      source_post_id: "2077607697487188198",
      effective_at: "2026-07-16T04:14:09.000Z",
      verified_at: "2026-07-20T12:00:00.000Z",
      display_until: "2026-07-17T04:14:09.000Z",
    };
    const newerAnnounce: PublishedEvent = {
      ...baseEvent,
      id: "new",
      source_post_id: "2078320950488297917",
      title: "Oops hard reset",
      effective_at: "2026-07-18T03:28:22.000Z",
      verified_at: "2026-07-18T03:28:22.000Z",
      display_until: "2026-07-19T03:28:22.000Z",
    };
    const card = buildProviderCard({
      config: {
        id: "codex",
        display_name: "Codex",
        monitored: true,
        authority_hint: "staff",
      },
      meta: { last_operator_heartbeat_at: new Date().toISOString() },
      events: [olderAnnounce, newerAnnounce],
      pending: null,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    assert.equal(card.last_confirmed_event?.source_post_id, "2078320950488297917");
    assert.equal(card.display_status, "no_recent_confirmed");
  });

  it("stale pending older than last blessing does not dominate", () => {
    const last: PublishedEvent = {
      ...baseEvent,
      effective_at: "2026-07-18T03:28:22.000Z",
      verified_at: "2026-07-18T03:28:22.000Z",
      display_until: "2026-07-19T03:28:22.000Z",
      source_post_id: "2078320950488297917",
    };
    // March 2026 snowflake-ish id 2031216405266481489
    const pending: EventCandidate = {
      id: "cand_old",
      provider: "codex",
      raw_source_id: "r",
      suggested_type: "hard_reset",
      suggested_scope: "all_paid",
      rule_hits: [],
      rule_version: "t",
      status: "pending_review",
      created_at: "2026-07-20T08:00:00.000Z",
      updated_at: "2026-07-20T08:00:00.000Z",
      source_url: "https://x.com/thsottiaux/status/2031216405266481489",
      raw_text: "we will be reseting rate limits in a bit",
      post_id: "2031216405266481489",
      author_handle: "thsottiaux",
    };
    assert.equal(isActionablePending(pending, last, new Date("2026-07-20T12:00:00.000Z")), false);
    const card = buildProviderCard({
      config: {
        id: "codex",
        display_name: "Codex",
        monitored: true,
        authority_hint: "staff",
      },
      meta: { last_operator_heartbeat_at: new Date().toISOString() },
      events: [last],
      pending,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    assert.equal(card.display_status, "no_recent_confirmed");
    assert.equal(card.pending_detection, null);
  });

  it("never calm when stale without events", () => {
    const r = deriveDisplayStatus({
      monitored: true,
      sourceHealth: "stale",
      activeEvent: null,
      pending: null,
      everConfirmed: false,
    });
    assert.notEqual(r.display, "no_recent_confirmed");
    assert.equal(r.display, "source_unhealthy");
  });
});

describe("isActiveEvent", () => {
  it("false when past display_until", () => {
    const ev = {
      display_until: "2020-01-01T00:00:00.000Z",
      retracted_at: null,
    } as PublishedEvent;
    assert.equal(isActiveEvent(ev), false);
  });

  it("false when retracted even if TTL remains", () => {
    const ev = {
      display_until: new Date(Date.now() + 3600_000).toISOString(),
      retracted_at: new Date().toISOString(),
    } as PublishedEvent;
    assert.equal(isActiveEvent(ev), false);
  });
});

describe("heartbeat without ingest stays fresh", () => {
  it("48h silence with recent heartbeat is fresh", () => {
    const { health } = computeSourceHealth(
      {
        last_operator_heartbeat_at: new Date().toISOString(),
        last_successful_ingest_at: new Date(
          Date.now() - 48 * 3600_000,
        ).toISOString(),
      },
      true,
    );
    assert.equal(health, "fresh");
  });
});
