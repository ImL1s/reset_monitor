import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeProviderStats } from "../src/pipeline/stats.js";
import type { PublishedEvent } from "../src/types.js";

function ev(
  id: string,
  verifiedAt: string,
  type: "hard_reset" | "banked_credit" = "hard_reset",
): PublishedEvent {
  return {
    id,
    provider: "codex",
    type,
    scope: "all_paid",
    title: "t",
    source_url: `https://x.com/x/status/${id}`,
    source_post_id: id,
    authority_grade: "staff",
    confidence: "confirmed",
    effective_at: verifiedAt,
    display_until: verifiedAt,
    first_seen_at: verifiedAt,
    verified_at: verifiedAt,
    decision_by: "auto_rules",
    evidence: [],
  };
}

describe("computeProviderStats", () => {
  it("computes total, last, days_since, avg, drought", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const events = [
      ev("3", "2026-07-18T03:28:22.000Z"),
      ev("2", "2026-07-16T04:14:09.000Z"),
      ev("1", "2026-07-01T00:00:00.000Z"),
    ];
    const s = computeProviderStats(events, now);
    assert.equal(s.total_confirmed, 3);
    assert.equal(s.last_reset_at, "2026-07-18T03:28:22.000Z");
    assert.ok(s.days_since_last! > 2 && s.days_since_last! < 3);
    assert.ok(s.avg_interval_days! > 0);
    assert.equal(s.hard_reset_count, 3);
    assert.equal(s.banked_credit_count, 0);
  });

  it("empty events", () => {
    const s = computeProviderStats([], new Date("2026-07-20T12:00:00.000Z"));
    assert.equal(s.total_confirmed, 0);
    assert.equal(s.last_reset_at, null);
    assert.equal(s.days_since_last, null);
  });

  it("uses effective_at not verified_at for intervals", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    // Seed re-import: verified_at collapsed same day; effective_at preserves history
    const events: PublishedEvent[] = [
      {
        ...ev("old", "2026-07-20T08:00:00.000Z"),
        effective_at: "2026-07-01T00:00:00.000Z",
      },
      {
        ...ev("mid", "2026-07-20T08:01:00.000Z"),
        effective_at: "2026-07-10T00:00:00.000Z",
      },
      {
        ...ev("new", "2026-07-20T08:02:00.000Z"),
        effective_at: "2026-07-18T00:00:00.000Z",
      },
    ];
    const s = computeProviderStats(events, now);
    assert.equal(s.last_reset_at, "2026-07-18T00:00:00.000Z");
    assert.ok(s.avg_interval_days! >= 8);
    assert.ok(s.days_since_last! >= 2);
  });
});
