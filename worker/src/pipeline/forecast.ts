import type {
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

export interface ForecastHardEvent {
  effective_at: string;
  type?: string;
}

export interface ComputeNext48hForecastArgs {
  hardEvents: ForecastHardEvent[];
  now: Date;
  sourceHealth?: SourceHealth;
}

/**
 * Deterministic next-48h hard-reset heuristic.
 * Task 1: insufficient_data for <2 hard events; minimal stub for ≥2 (full math Task 2).
 */
export function computeNext48hForecast(
  args: ComputeNext48hForecastArgs,
): Next48hForecastDto {
  const calculatedAt = args.now.toISOString();

  if (args.hardEvents.length < 2) {
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

  // Task 2 will replace this stub with baseline/elapsed/cooldown math.
  return {
    window_hours: FORECAST_WINDOW_HOURS,
    probability: FORECAST_FLOOR,
    band: "low",
    factors: [],
    calculated_at: calculatedAt,
    method: "deterministic_v1",
    disclaimer: FORECAST_DISCLAIMER,
  };
}
