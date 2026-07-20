import type { PublishedEvent, ProviderId, ProviderStatsDto } from "../types.js";

function dayDiff(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/** Non-retracted confirmed events only. */
export function computeProviderStats(
  events: PublishedEvent[],
  now: Date = new Date(),
  provider: ProviderId | "all" = "all",
): ProviderStatsDto {
  const eventTime = (e: PublishedEvent) =>
    new Date(e.effective_at || e.verified_at).getTime();

  const list = events
    .filter((e) => !e.retracted_at)
    .filter((e) => (provider === "all" ? true : e.provider === provider))
    .slice()
    .sort((a, b) => eventTime(a) - eventTime(b));

  if (list.length === 0) {
    return {
      provider,
      total_confirmed: 0,
      hard_reset_count: 0,
      banked_credit_count: 0,
      last_reset_at: null,
      days_since_last: null,
      avg_interval_days: null,
      longest_drought_days: null,
    };
  }

  // Timing axes are hard_reset-only (banked must not move "days since last reset")
  const hard = list.filter((e) => e.type === "hard_reset");
  const times = hard.map((e) => new Date(e.effective_at || e.verified_at));
  if (times.length === 0) {
    return {
      provider,
      total_confirmed: list.length,
      hard_reset_count: 0,
      banked_credit_count: list.filter((e) => e.type === "banked_credit").length,
      last_reset_at: null,
      days_since_last: null,
      avg_interval_days: null,
      longest_drought_days: null,
    };
  }

  const last = times[times.length - 1]!;
  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push(dayDiff(times[i]!, times[i - 1]!));
  }
  const toNow = dayDiff(now, last);
  const droughtCandidates = [...intervals, toNow];

  return {
    provider,
    total_confirmed: list.length,
    hard_reset_count: hard.length,
    banked_credit_count: list.filter((e) => e.type === "banked_credit").length,
    last_reset_at: last.toISOString(),
    days_since_last: Math.round(toNow * 10) / 10,
    avg_interval_days:
      intervals.length === 0
        ? null
        : Math.round(
            (intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10,
          ) / 10,
    longest_drought_days: Math.round(Math.max(...droughtCandidates) * 10) / 10,
  };
}
