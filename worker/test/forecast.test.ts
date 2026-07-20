import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_DISCLAIMER,
  FORECAST_WINDOW_HOURS,
  computeNext48hForecast,
  detectExplicitFuturePromise,
} from "../src/pipeline/forecast.js";

const MS_PER_DAY = 86_400_000;

/** C1 / C2 fixture: ≥2 hard resets ending at 2026-07-18T03:28:22Z */
const HARD_EVENTS_C1 = [
  { effective_at: "2026-07-01T00:00:00.000Z", type: "hard_reset" },
  { effective_at: "2026-07-18T03:28:22.000Z", type: "hard_reset" },
] as const;

describe("computeNext48hForecast", () => {
  it("insufficient_data when fewer than 2 hard resets", () => {
    const r = computeNext48hForecast({
      hardEvents: [
        { effective_at: "2026-07-16T03:58:48.000Z", type: "hard_reset" },
      ],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
    assert.equal(r.window_hours, FORECAST_WINDOW_HOURS);
    assert.equal(r.window_hours, 48);
    assert.equal(r.method, "deterministic_v1");
    assert.equal(r.disclaimer, FORECAST_DISCLAIMER);
    assert.match(r.disclaimer, /啟發式/);
    assert.ok(r.factors.length >= 1);
    assert.match(r.factors[0]!.label, /至少 2/);
    assert.equal(r.calculated_at, "2026-07-20T12:00:00.000Z");
  });

  it("insufficient_data when zero hard resets", () => {
    const r = computeNext48hForecast({
      hardEvents: [],
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
    assert.equal(r.method, "deterministic_v1");
    assert.equal(r.disclaimer, FORECAST_DISCLAIMER);
  });

  it("returns valid DTO when hard history has at least 2 events", () => {
    const r = computeNext48hForecast({
      hardEvents: [
        { effective_at: "2026-07-01T00:00:00.000Z", type: "hard_reset" },
        { effective_at: "2026-07-16T03:58:48.000Z", type: "hard_reset" },
      ],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });
    assert.notEqual(r.band, "insufficient_data");
    assert.equal(typeof r.probability, "number");
    assert.ok(r.probability !== null && r.probability >= 0 && r.probability <= 100);
    assert.equal(r.window_hours, 48);
    assert.equal(r.method, "deterministic_v1");
    assert.equal(r.disclaimer, FORECAST_DISCLAIMER);
    assert.equal(r.calculated_at, "2026-07-20T12:00:00.000Z");
  });

  // C1: recent hard reset (~2.4d ago), still in cooldown taper
  it("C1: recent reset → low band, cooldown negative, p in [5,40]", () => {
    const r = computeNext48hForecast({
      hardEvents: [...HARD_EVENTS_C1],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });
    assert.equal(r.band, "low");
    assert.ok(r.probability !== null);
    assert.ok(r.probability >= 5 && r.probability <= 40, `p=${r.probability}`);
    const cooldown = r.factors.find((f) => f.id === "cooldown");
    assert.ok(cooldown, "expected cooldown factor");
    assert.ok(cooldown!.delta < 0, `cooldown delta=${cooldown!.delta}`);
    assert.equal(cooldown!.label, "重置後冷卻");
    // always-explain core factors
    assert.ok(r.factors.some((f) => f.id === "baseline"));
    assert.ok(r.factors.some((f) => f.id === "elapsed"));
  });

  // C2: far enough that days_since ≈ avg → higher probability than C1
  it("C2: days_since ≈ avg_interval → probability higher than C1", () => {
    const c1 = computeNext48hForecast({
      hardEvents: [...HARD_EVENTS_C1],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });

    const t0 = Date.parse(HARD_EVENTS_C1[0]!.effective_at);
    const t1 = Date.parse(HARD_EVENTS_C1[1]!.effective_at);
    const avgDays = (t1 - t0) / MS_PER_DAY;
    const nowAtAvg = new Date(t1 + avgDays * MS_PER_DAY);

    const c2 = computeNext48hForecast({
      hardEvents: [...HARD_EVENTS_C1],
      now: nowAtAvg,
      sourceHealth: "fresh",
    });

    assert.ok(c1.probability !== null && c2.probability !== null);
    assert.ok(
      c2.probability! > c1.probability!,
      `C2 p=${c2.probability} should be > C1 p=${c1.probability}`,
    );
    assert.ok(c2.probability! <= 85);
  });

  // C4: deterministic — same inputs → identical output
  it("C4: identical inputs → deepEqual probability and factors", () => {
    const args = {
      hardEvents: [...HARD_EVENTS_C1],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh" as const,
    };
    const a = computeNext48hForecast(args);
    const b = computeNext48hForecast(args);
    assert.equal(a.probability, b.probability);
    assert.deepEqual(a.factors, b.factors);
    assert.equal(a.band, b.band);
    assert.equal(a.calculated_at, b.calculated_at);
  });

  // C6: caller normally passes hard-only; if mixed types, only hard_reset counts
  it("C6: only hard_reset typed events count when mixed types passed", () => {
    // Document: production caller should pass hard-only arrays.
    // Scorer still filters type==='hard_reset' when type is present.
    const mixed = [
      { effective_at: "2026-07-01T00:00:00.000Z", type: "hard_reset" },
      { effective_at: "2026-07-10T00:00:00.000Z", type: "banked" },
      { effective_at: "2026-07-18T03:28:22.000Z", type: "hard_reset" },
    ];
    const hardOnly = [
      { effective_at: "2026-07-01T00:00:00.000Z", type: "hard_reset" },
      { effective_at: "2026-07-18T03:28:22.000Z", type: "hard_reset" },
    ];
    const now = new Date("2026-07-20T12:00:00.000Z");
    const fromMixed = computeNext48hForecast({
      hardEvents: mixed,
      now,
      sourceHealth: "fresh",
    });
    const fromHard = computeNext48hForecast({
      hardEvents: hardOnly,
      now,
      sourceHealth: "fresh",
    });
    assert.equal(fromMixed.probability, fromHard.probability);
    assert.deepEqual(fromMixed.factors, fromHard.factors);
    assert.equal(fromMixed.band, fromHard.band);
  });

  it("C6b: single hard_reset among mixed → insufficient_data", () => {
    const r = computeNext48hForecast({
      hardEvents: [
        { effective_at: "2026-07-01T00:00:00.000Z", type: "banked" },
        { effective_at: "2026-07-18T03:28:22.000Z", type: "hard_reset" },
      ],
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
  });

  it("C5: futurePromise raises probability and includes factor", () => {
    const base = computeNext48hForecast({
      hardEvents: [...HARD_EVENTS_C1],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });
    const withPromise = computeNext48hForecast({
      hardEvents: [...HARD_EVENTS_C1],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
      futurePromise: true,
      promiseEvidenceUrls: ["https://x.com/thsottiaux/status/1"],
    });
    assert.ok(base.probability !== null && withPromise.probability !== null);
    assert.ok(withPromise.probability! > base.probability!);
    assert.ok(withPromise.factors.some((f) => f.id === "future_promise"));
    assert.deepEqual(withPromise.evidence_urls, [
      "https://x.com/thsottiaux/status/1",
    ]);
  });
});

describe("detectExplicitFuturePromise", () => {
  it("hits known promise phrases", () => {
    assert.equal(
      detectExplicitFuturePromise("Don't mind! The resets will continue"),
      true,
    );
    assert.equal(
      detectExplicitFuturePromise("we will reset again soon"),
      true,
    );
    assert.equal(detectExplicitFuturePromise("會再重置給大家"), true);
  });

  it("rejects teasers and negation", () => {
    assert.equal(
      detectExplicitFuturePromise(
        "Should we reset the ChatGPT Work and Codex usage again?",
      ),
      false,
    );
    assert.equal(
      detectExplicitFuturePromise("we will not reset today"),
      false,
    );
    assert.equal(detectExplicitFuturePromise("random chatter"), false);
  });
});
