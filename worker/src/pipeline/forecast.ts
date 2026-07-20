import type {
  ForecastBand,
  ForecastFactorDto,
  Next48hForecastDto,
  SourceHealth,
} from "../types.js";

export const FORECAST_WINDOW_HOURS = 48;
export const FORECAST_FLOOR = 5;
export const FORECAST_CAP = 85;
/** hours after last hard reset with strong negative cooldown */
export const COOLDOWN_FULL_HOURS = 36;
export const COOLDOWN_TAPER_HOURS = 72;
/** max |delta| for each factor */
export const DELTA = {
  baseline: 25,
  elapsed: 20,
  cooldown: -35,
  future_promise: 40,
  freshness: -8,
} as const;

/** Fixed product disclaimer (Traditional Chinese). */
export const FORECAST_DISCLAIMER =
  "啟發式估計，非官方、非確認。綠燈只代表已確認公開 hard reset。";

const MS_PER_DAY = 86_400_000;

const LABELS = {
  baseline: "歷史基線",
  elapsed: "距上次硬重置",
  cooldown: "重置後冷卻",
  freshness: "來源新鮮度懲罰",
  future_promise: "明確未來重置承諾",
} as const;

export interface ForecastHardEvent {
  effective_at: string;
  type?: string;
}

export interface ComputeNext48hForecastArgs {
  hardEvents: ForecastHardEvent[];
  now: Date;
  sourceHealth?: SourceHealth;
  /** Task 4: explicit future-promise signal; default false */
  futurePromise?: boolean;
}

function clamp(lo: number, hi: number, x: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function bandFor(probability: number): ForecastBand {
  if (probability < 35) return "low";
  if (probability < 60) return "medium";
  return "high";
}

function filterHardEvents(events: ForecastHardEvent[]): ForecastHardEvent[] {
  // If type is present, only hard_reset counts; untyped entries are treated as hard
  // (caller may pass hard-only without type).
  const hard = events.filter(
    (e) => e.type === undefined || e.type === "hard_reset",
  );
  return hard.sort(
    (a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at),
  );
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function freshnessDelta(sourceHealth?: SourceHealth): number {
  if (sourceHealth === "stale") return DELTA.freshness; // -8
  if (sourceHealth === "degraded") return -4;
  return 0;
}

function cooldownDelta(hoursSince: number): number {
  if (hoursSince < COOLDOWN_FULL_HOURS) {
    return DELTA.cooldown;
  }
  if (hoursSince < COOLDOWN_TAPER_HOURS) {
    // Linear taper from DELTA.cooldown (-35) at FULL → 0 at TAPER
    const span = COOLDOWN_TAPER_HOURS - COOLDOWN_FULL_HOURS;
    const remaining = COOLDOWN_TAPER_HOURS - hoursSince;
    return Math.round(DELTA.cooldown * (remaining / span));
  }
  return 0;
}

/**
 * Deterministic next-48h hard-reset heuristic (v1).
 * Uses baseline / elapsed / cooldown (+ optional freshness / future_promise).
 */
export function computeNext48hForecast(
  args: ComputeNext48hForecastArgs,
): Next48hForecastDto {
  const calculatedAt = args.now.toISOString();
  const hard = filterHardEvents(args.hardEvents);

  if (hard.length < 2) {
    const factors: ForecastFactorDto[] = [
      {
        id: "insufficient_samples",
        label: "需要至少 2 筆已確認 hard reset 才能估計間隔",
        delta: 0,
      },
    ];
    return {
      window_hours: FORECAST_WINDOW_HOURS,
      probability: null,
      band: "insufficient_data",
      factors,
      calculated_at: calculatedAt,
      method: "deterministic_v1",
      disclaimer: FORECAST_DISCLAIMER,
    };
  }

  // Intervals (days) between consecutive hard events
  const times = hard.map((e) => Date.parse(e.effective_at));
  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push((times[i]! - times[i - 1]!) / MS_PER_DAY);
  }
  const avg = mean(intervals);
  const lastAt = times[times.length - 1]!;
  const daysSince = (args.now.getTime() - lastAt) / MS_PER_DAY;
  const hoursSince = daysSince * 24;

  // baseline
  const prior = Math.min(1, FORECAST_WINDOW_HOURS / 24 / avg);
  const deltaBaseline = clamp(
    0,
    DELTA.baseline,
    Math.round(prior * DELTA.baseline),
  );

  // elapsed
  const ratio = daysSince / avg;
  const deltaElapsed = clamp(
    0,
    DELTA.elapsed,
    Math.round((ratio - 0.3) * DELTA.elapsed),
  );

  // cooldown
  const deltaCooldown = cooldownDelta(hoursSince);

  // future_promise (Task 4; default off)
  const deltaPromise =
    args.futurePromise === true ? DELTA.future_promise : 0;

  // freshness
  const deltaFresh = freshnessDelta(args.sourceHealth);

  const factors: ForecastFactorDto[] = [
    { id: "baseline", label: LABELS.baseline, delta: deltaBaseline },
    { id: "elapsed", label: LABELS.elapsed, delta: deltaElapsed },
    { id: "cooldown", label: LABELS.cooldown, delta: deltaCooldown },
  ];
  if (deltaPromise !== 0) {
    factors.push({
      id: "future_promise",
      label: LABELS.future_promise,
      delta: deltaPromise,
    });
  }
  if (deltaFresh !== 0) {
    factors.push({
      id: "freshness",
      label: LABELS.freshness,
      delta: deltaFresh,
    });
  }

  const raw =
    deltaBaseline +
    deltaElapsed +
    deltaCooldown +
    deltaPromise +
    deltaFresh;
  const probability = clamp(FORECAST_FLOOR, FORECAST_CAP, raw);

  return {
    window_hours: FORECAST_WINDOW_HOURS,
    probability,
    band: bandFor(probability),
    factors,
    calculated_at: calculatedAt,
    method: "deterministic_v1",
    disclaimer: FORECAST_DISCLAIMER,
  };
}
