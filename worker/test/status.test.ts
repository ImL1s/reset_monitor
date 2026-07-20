import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyClaudeText,
  classifyCodexText,
  computeSourceHealth,
  deriveDisplayStatus,
  isActiveEvent,
} from "../src/status.js";
import type { PublishedEvent } from "../src/types.js";

describe("classifyCodexText", () => {
  it("hits hard reset phrases", () => {
    const r = classifyCodexText(
      "Oops... I did it again. Enjoy reset usage limits for all paid users",
    );
    assert.ok(r.hits.length > 0);
    assert.equal(r.excluded, false);
    assert.equal(r.scope, "all_paid");
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
