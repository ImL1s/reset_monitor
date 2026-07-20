import type {
  ForecastBand,
  ForecastFactorDto,
  Next48hForecastDto,
  SourceHealth,
} from "../types.js";

export const FORECAST_WINDOW_HOURS = 48 as const;
const WINDOW_DAYS = 2;
export const FORECAST_FLOOR = 5;
export const FORECAST_CAP = 85;
/** additive bumps applied after the renewal model (bounded, explainable) */
const PROMISE_BUMP = 25;

/** Fixed product disclaimer (Traditional Chinese). */
export const FORECAST_DISCLAIMER =
  "啟發式估計，非官方、非確認。綠燈只代表已確認公開 hard reset。";

const MS_PER_DAY = 86_400_000;

const LABELS = {
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
  /** explicit future-promise signal; adds forecast weight only, never green */
  futurePromise?: boolean;
  promiseEvidenceUrls?: string[];
}

/**
 * Rules-only: explicit staff promise of a future hard reset.
 * Adds forecast weight only — never confirms display green.
 */
export function detectExplicitFuturePromise(text: string): boolean {
  const t = text.toLowerCase().replace(/[‘’‛]/g, "'");
  if (/\bshould we reset\b/.test(t)) return false;
  if (/\b(will not|won't|wont)\s+reset\b/.test(t)) return false;
  if (t.includes("resets will continue")) return true;
  if (
    /\bwill\s+(be\s+)?reset(ting)?\b/.test(t) &&
    /\b(soon|again|later|today|tomorrow|shortly|in a bit|next hour|next few)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\banother reset\b/.test(t) && /\b(coming|soon|again)\b/.test(t)) {
    return true;
  }
  if (t.includes("會再重置") || t.includes("即將重置") || t.includes("还会重置") || t.includes("還會重置")) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Weibull renewal survival (deterministic; no PRNG, no Date.now)
// ---------------------------------------------------------------------------

/** Lanczos log-gamma (g=7). Accurate to ~1e-13 for x>0. */
function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // reflection
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
    );
  }
  x -= 1;
  let a = c[0]!;
  const tt = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i]! / (x + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(tt) - tt + Math.log(a)
  );
}

const gammaFn = (x: number): number => Math.exp(lgamma(x));

/** Weibull coefficient of variation as a function of shape k (decreasing in k). */
function weibullCV(k: number): number {
  const g1 = gammaFn(1 + 1 / k);
  const g2 = gammaFn(1 + 2 / k);
  const v = g2 / (g1 * g1) - 1;
  return v <= 0 ? 0 : Math.sqrt(v);
}

/** Invert CV → shape k by bisection (weibullCV is monotone decreasing). */
function invertCvToK(cv: number): number {
  const LO = 0.3;
  const HI = 6;
  if (weibullCV(LO) <= cv) return LO; // heavier-tailed than model floor
  if (weibullCV(HI) >= cv) return HI; // more regular than model ceiling
  let lo = LO;
  let hi = HI;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (weibullCV(mid) > cv) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

interface WeibullFit {
  k: number;
  lambda: number;
  lowConfidence: boolean;
}

function fitWeibull(gaps: number[]): WeibullFit {
  const n = gaps.length;
  const mean = gaps.reduce((s, x) => s + x, 0) / n;
  const safeMean = Math.max(mean, 1e-6);
  if (n < 2) {
    // one gap: no spread info → exponential (memoryless), honest & wide.
    return { k: 1, lambda: safeMean, lowConfidence: true };
  }
  const variance = gaps.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  if (cv <= 1e-6) {
    // Near-constant intervals → very regular (k=6). Keep λ parameterization
    // consistent with the main branch so the model mean matches the data mean.
    return {
      k: 6,
      lambda: Math.max(safeMean / gammaFn(1 + 1 / 6), 1e-6),
      lowConfidence: n < 3,
    };
  }
  const k = invertCvToK(cv);
  const lambda = Math.max(safeMean / gammaFn(1 + 1 / k), 1e-6);
  return { k, lambda, lowConfidence: n < 3 };
}

/** Conditional P(reset within WINDOW_DAYS | already waited t days) = 1 − S(t+Δ)/S(t). */
function conditionalProb(k: number, lambda: number, t: number): number {
  const tt = Math.max(t, 0);
  const a = Math.pow(tt / lambda, k);
  const b = Math.pow((tt + WINDOW_DAYS) / lambda, k);
  const p = 1 - Math.exp(a - b);
  return Math.min(1, Math.max(0, p));
}

interface Empirical {
  atRisk: number;
  within: number;
  hazard: number | null;
}

function empiricalHazard(gaps: number[], t: number): Empirical {
  const atRisk = gaps.filter((g) => g >= t).length;
  const within = gaps.filter((g) => g >= t && g < t + WINDOW_DAYS).length;
  return { atRisk, within, hazard: atRisk > 0 ? within / atRisk : null };
}

/** Deterministic leave-one-out band on the model probability (percent). */
function jackknifeBand(gaps: number[], t: number): [number, number] | null {
  if (gaps.length < 3) return null;
  const ps: number[] = [];
  for (let i = 0; i < gaps.length; i++) {
    const sub = gaps.filter((_, j) => j !== i);
    const { k, lambda } = fitWeibull(sub);
    ps.push(conditionalProb(k, lambda, t) * 100);
  }
  ps.sort((a, b) => a - b);
  return [ps[0]!, ps[ps.length - 1]!];
}

function clamp(lo: number, hi: number, x: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round5(x: number): number {
  return Math.round(x / 5) * 5;
}

function bandFor(probability: number): ForecastBand {
  if (probability < 35) return "low";
  if (probability < 60) return "medium";
  return "high";
}

function filterHardEvents(events: ForecastHardEvent[]): ForecastHardEvent[] {
  const hard = events.filter(
    (e) => e.type === undefined || e.type === "hard_reset",
  );
  return hard.sort(
    (a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at),
  );
}

function freshnessDelta(sourceHealth?: SourceHealth): number {
  if (sourceHealth === "stale") return -8;
  if (sourceHealth === "degraded") return -4;
  return 0;
}

function shapeLabel(k: number): string {
  if (k < 0.85) {
    return `叢集型（k=${k.toFixed(2)}<1：剛重置後較可能，越等越低）`;
  }
  if (k <= 1.15) {
    return `近似無記憶（k≈${k.toFixed(2)}：等待時間影響很小）`;
  }
  return `規律型（k=${k.toFixed(2)}>1：越逾期越可能）`;
}

/**
 * Deterministic next-48h hard-reset heuristic (v2).
 * Fits a Weibull renewal model to inter-reset gaps and returns the
 * elapsed-conditional survival probability, with a jackknife uncertainty band
 * and an empirical conditional-hazard audit baseline. Never turns a card green.
 */
export function computeNext48hForecast(
  args: ComputeNext48hForecastArgs,
): Next48hForecastDto {
  const calculatedAt = args.now.toISOString();
  const hard = filterHardEvents(args.hardEvents);
  // Parse + guard: drop unparseable timestamps so a NaN can never reach the fit.
  const times = hard
    .map((e) => Date.parse(e.effective_at))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  const nEvents = times.length;

  if (nEvents < 2) {
    return {
      window_hours: FORECAST_WINDOW_HOURS,
      probability: null,
      probability_lo: null,
      probability_hi: null,
      sample_size: nEvents,
      band: "insufficient_data",
      factors: [
        {
          id: "insufficient_samples",
          label: "需要至少 2 筆已確認 hard reset 才能估計間隔",
          delta: 0,
        },
      ],
      calculated_at: calculatedAt,
      method: "renewal_survival_v2",
      disclaimer: FORECAST_DISCLAIMER,
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i]! - times[i - 1]!) / MS_PER_DAY);
  }
  const lastAt = times[times.length - 1]!;
  const t = Math.max(0, (args.now.getTime() - lastAt) / MS_PER_DAY);

  const { k, lambda, lowConfidence } = fitWeibull(gaps);
  const pModel = conditionalProb(k, lambda, t); // 0..1
  const emp = empiricalHazard(gaps, t);

  const promise = args.futurePromise === true ? PROMISE_BUMP : 0;
  const fresh = freshnessDelta(args.sourceHealth);
  const offset = promise + fresh;

  const probability = clamp(
    FORECAST_FLOOR,
    FORECAST_CAP,
    round5(pModel * 100 + offset),
  );

  // Uncertainty band (jackknife on the model, shifted by the same offset).
  const raw = jackknifeBand(gaps, t);
  const lowConf = lowConfidence || raw === null || (emp.atRisk > 0 && emp.atRisk < 3);
  let lo: number;
  let hi: number;
  if (raw && !lowConfidence) {
    lo = clamp(FORECAST_FLOOR, FORECAST_CAP, round5(raw[0] + offset));
    hi = clamp(FORECAST_FLOOR, FORECAST_CAP, round5(raw[1] + offset));
  } else {
    // widen when we cannot jackknife / low confidence
    lo = clamp(FORECAST_FLOOR, FORECAST_CAP, probability - 25);
    hi = clamp(FORECAST_FLOOR, FORECAST_CAP, probability + 25);
  }
  lo = Math.min(lo, probability);
  hi = Math.max(hi, probability);

  const factors: ForecastFactorDto[] = [
    { id: "renewal_k", label: shapeLabel(k), delta: 0 },
    {
      id: "conditional_elapsed",
      label: `距上次 ${t.toFixed(1)} 天，模型條件機率 ${Math.round(pModel * 100)}%`,
      delta: 0,
    },
    {
      id: "sample",
      label: `樣本 ${nEvents} 次硬重置（${gaps.length} 段間隔）${lowConf ? "，信心低" : ""}`,
      delta: 0,
    },
  ];
  if (emp.hazard !== null) {
    factors.push({
      id: "empirical_baseline",
      label: `經驗基線：等到此久的 ${emp.atRisk} 次中，${emp.within} 次於 48h 內再現`,
      delta: 0,
    });
  }
  if (promise !== 0) {
    factors.push({
      id: "future_promise",
      label: LABELS.future_promise,
      delta: promise,
    });
  }
  if (fresh !== 0) {
    factors.push({ id: "freshness", label: LABELS.freshness, delta: fresh });
  }

  const out: Next48hForecastDto = {
    window_hours: FORECAST_WINDOW_HOURS,
    probability,
    probability_lo: lo,
    probability_hi: hi,
    sample_size: nEvents,
    band: bandFor(probability),
    factors,
    calculated_at: calculatedAt,
    method: "renewal_survival_v2",
    disclaimer: FORECAST_DISCLAIMER,
  };
  if (promise !== 0 && args.promiseEvidenceUrls?.length) {
    out.evidence_urls = args.promiseEvidenceUrls;
  }
  return out;
}
