import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_DISCLAIMER,
  FORECAST_WINDOW_HOURS,
  computeNext48hForecast,
  detectExplicitFuturePromise,
} from "../src/pipeline/forecast.js";

const MS_PER_DAY = 86_400_000;
const BASE = Date.parse("2026-06-01T00:00:00.000Z");
const ev = (dayOffset: number) => ({
  effective_at: new Date(BASE + dayOffset * MS_PER_DAY).toISOString(),
  type: "hard_reset",
});
/** now = last event + t days */
const nowAfter = (lastOffset: number, t: number) =>
  new Date(BASE + (lastOffset + t) * MS_PER_DAY);

// Clustered / heavy-tailed history: tight bursts + long droughts (k well < 1).
const CLUSTERED = [0, 0.5, 1, 1.5, 2, 28, 28.5, 29, 29.5, 30, 60].map(ev);
// Regular history: even spacing (k>1).
const REGULAR = [0, 5, 10, 15, 20, 25].map(ev);
// Minimal history: exactly one gap (exponential fallback).
const ONE_GAP = [ev(0), ev(17)];

describe("computeNext48hForecast (renewal_survival_v2)", () => {
  it("insufficient_data when fewer than 2 hard resets", () => {
    const r = computeNext48hForecast({
      hardEvents: [ev(0)],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
    assert.equal(r.window_hours, FORECAST_WINDOW_HOURS);
    assert.equal(r.window_hours, 48);
    assert.equal(r.method, "renewal_survival_v2");
    assert.equal(r.disclaimer, FORECAST_DISCLAIMER);
    assert.match(r.disclaimer, /啟發式/);
    assert.match(r.factors[0]!.label, /至少 2/);
  });

  it("insufficient_data when zero hard resets", () => {
    const r = computeNext48hForecast({
      hardEvents: [],
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
    assert.equal(r.method, "renewal_survival_v2");
  });

  it("valid, bounded DTO when ≥2 hard resets", () => {
    const r = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now: nowAfter(60, 1),
      sourceHealth: "fresh",
    });
    assert.notEqual(r.band, "insufficient_data");
    assert.equal(typeof r.probability, "number");
    assert.ok(r.probability! >= 5 && r.probability! <= 85);
    assert.equal(r.sample_size, CLUSTERED.length);
    assert.equal(r.method, "renewal_survival_v2");
    // band present and brackets the point estimate
    assert.equal(typeof r.probability_lo, "number");
    assert.equal(typeof r.probability_hi, "number");
    assert.ok(r.probability_lo! <= r.probability!);
    assert.ok(r.probability_hi! >= r.probability!);
  });

  // The core data-correctness fix: clustered process decays with elapsed time,
  // so "just after a reset" is MORE likely than "deep in a drought" (opposite
  // of the old overdue-raises-probability model).
  it("clustered history: hazard decays with elapsed (recent > overdue)", () => {
    const recent = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now: nowAfter(60, 0.5),
      sourceHealth: "fresh",
    });
    const overdue = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now: nowAfter(60, 12),
      sourceHealth: "fresh",
    });
    assert.ok(
      recent.probability! > overdue.probability!,
      `recent=${recent.probability} should exceed overdue=${overdue.probability}`,
    );
    assert.ok(recent.factors.some((f) => f.id === "renewal_k"));
    assert.match(
      recent.factors.find((f) => f.id === "renewal_k")!.label,
      /叢集型/,
    );
  });

  it("regular history fits k>1 (規律型)", () => {
    const r = computeNext48hForecast({
      hardEvents: REGULAR,
      now: nowAfter(25, 4),
      sourceHealth: "fresh",
    });
    assert.match(
      r.factors.find((f) => f.id === "renewal_k")!.label,
      /規律型/,
    );
  });

  // Hand-checked exponential (single gap of 17d): p = 1 − e^(−2/17) ≈ 11.1% → round5 → 10.
  it("single-gap history is memoryless (exponential), hand-checked ≈10%", () => {
    const t1 = computeNext48hForecast({
      hardEvents: ONE_GAP,
      now: nowAfter(17, 1),
      sourceHealth: "fresh",
    });
    const t2 = computeNext48hForecast({
      hardEvents: ONE_GAP,
      now: nowAfter(17, 10),
      sourceHealth: "fresh",
    });
    assert.equal(t1.probability, 10);
    assert.equal(t2.probability, t1.probability); // memoryless: elapsed irrelevant
  });

  it("deterministic: identical inputs → deepEqual output", () => {
    const args = {
      hardEvents: CLUSTERED,
      now: nowAfter(60, 2),
      sourceHealth: "fresh" as const,
    };
    const a = computeNext48hForecast(args);
    const b = computeNext48hForecast(args);
    assert.deepEqual(a, b);
  });

  it("only hard_reset typed events count when mixed types passed", () => {
    const mixed = [ev(0), { ...ev(10), type: "banked" }, ev(18)];
    const hardOnly = [ev(0), ev(18)];
    const now = nowAfter(18, 2);
    const fromMixed = computeNext48hForecast({ hardEvents: mixed, now });
    const fromHard = computeNext48hForecast({ hardEvents: hardOnly, now });
    assert.equal(fromMixed.probability, fromHard.probability);
    assert.deepEqual(fromMixed.factors, fromHard.factors);
  });

  it("single hard_reset among mixed → insufficient_data", () => {
    const r = computeNext48hForecast({
      hardEvents: [{ ...ev(0), type: "banked" }, ev(18)],
      now: nowAfter(18, 2),
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
  });

  it("futurePromise raises probability, adds factor + evidence", () => {
    const now = nowAfter(60, 8);
    const base = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now,
      sourceHealth: "fresh",
    });
    const withPromise = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now,
      sourceHealth: "fresh",
      futurePromise: true,
      promiseEvidenceUrls: ["https://x.com/thsottiaux/status/1"],
    });
    assert.ok(withPromise.probability! > base.probability!);
    assert.ok(withPromise.factors.some((f) => f.id === "future_promise"));
    assert.deepEqual(withPromise.evidence_urls, [
      "https://x.com/thsottiaux/status/1",
    ]);
  });

  it("stale source applies a negative freshness factor", () => {
    const now = nowAfter(60, 8);
    const fresh = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now,
      sourceHealth: "fresh",
    });
    const stale = computeNext48hForecast({
      hardEvents: CLUSTERED,
      now,
      sourceHealth: "stale",
    });
    assert.ok(stale.probability! <= fresh.probability!);
    assert.ok(stale.factors.some((f) => f.id === "freshness" && f.delta < 0));
  });
});

describe("detectExplicitFuturePromise", () => {
  it("hits known promise phrases", () => {
    assert.equal(
      detectExplicitFuturePromise("Don't mind! The resets will continue"),
      true,
    );
    assert.equal(detectExplicitFuturePromise("we will reset again soon"), true);
    assert.equal(detectExplicitFuturePromise("會再重置給大家"), true);
  });

  it("rejects teasers and negation", () => {
    assert.equal(
      detectExplicitFuturePromise(
        "Should we reset the ChatGPT Work and Codex usage again?",
      ),
      false,
    );
    assert.equal(detectExplicitFuturePromise("we will not reset today"), false);
    assert.equal(detectExplicitFuturePromise("random chatter"), false);
  });
});
