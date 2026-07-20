import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_DISCLAIMER,
  FORECAST_WINDOW_HOURS,
  computeNext48hForecast,
} from "../src/pipeline/forecast.js";

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

  it("returns valid stub DTO when hard history has at least 2 events", () => {
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
});
