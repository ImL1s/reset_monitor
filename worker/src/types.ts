export type ProviderId =
  | "codex"
  | "claude"
  | "grok"
  | "kimi"
  | "glm"
  | "antigravity";

export type EventType =
  | "hard_reset"
  | "banked_credit"
  | "policy_change"
  | "other";

export type Scope = "all_paid" | "subset" | "unknown";

export type AuthorityGrade = "official_product" | "staff" | "other";

export type SourceHealth = "fresh" | "degraded" | "stale" | "disabled";

export type DisplayStatus =
  | "active_confirmed"
  | "active_confirmed_degraded"
  | "active_banked"
  | "detected_pending"
  | "no_recent_confirmed"
  | "source_unhealthy"
  | "cold_start"
  | "not_monitored";

export type CandidateStatus = "pending_review" | "rejected" | "promoted";

export interface EvidenceItem {
  url: string;
  post_id: string;
  author_handle: string;
  author_user_id?: string;
  raw_text: string;
  fetched_at: string;
  content_hash?: string;
}

export interface PublishedEvent {
  id: string;
  provider: ProviderId;
  type: EventType;
  scope: Scope;
  scope_detail?: string | null;
  title: string;
  body_excerpt?: string | null;
  source_url: string;
  source_post_id: string;
  source_author?: string | null;
  authority_grade: AuthorityGrade;
  confidence: "confirmed";
  effective_at: string;
  display_until: string;
  expires_at?: string | null;
  announced_at?: string | null;
  first_seen_at: string;
  verified_at: string;
  decision_by: string;
  decision_reason?: string | null;
  rule_version?: string | null;
  evidence: EvidenceItem[];
  candidate_id?: string | null;
  claim_url?: string | null;
  claim_note?: string | null;
  retracted_at?: string | null;
  retract_reason?: string | null;
  retract_by?: string | null;
}

export interface EventCandidate {
  id: string;
  provider: ProviderId;
  raw_source_id: string;
  suggested_type: EventType;
  suggested_scope: Scope;
  rule_hits: string[];
  rule_version: string;
  status: CandidateStatus;
  reject_reason?: string | null;
  created_at: string;
  updated_at: string;
  source_url: string;
  raw_text: string;
  post_id: string;
  author_handle: string;
  author_user_id?: string;
  is_quote?: boolean;
  is_reply?: boolean;
  is_retweet?: boolean;
}

export interface RawSource {
  id: string;
  platform: string;
  author_user_id?: string;
  author_handle: string;
  post_id: string;
  url: string;
  fetched_at: string;
  raw_text: string;
  is_reply: boolean;
  is_quote: boolean;
  is_retweet: boolean;
  created_at: string;
}

export interface ProviderConfig {
  id: ProviderId;
  display_name: string;
  monitored: boolean;
  authority_hint?: string | null;
  coverage_note?: string | null;
}

export interface ProviderRuntimeMeta {
  last_successful_ingest_at?: string | null;
  last_operator_heartbeat_at?: string | null;
}

export type ForecastBand = "low" | "medium" | "high" | "insufficient_data";

export type ForecastMethod = "deterministic_v1" | "renewal_survival_v2";

export interface ForecastFactorDto {
  id: string; // renewal_k | conditional_elapsed | sample | future_promise | freshness | empirical_baseline
  label: string; // 繁中固定字串
  delta: number; // 整數百分點貢獻，可負（說明性因子用 0）
}

export interface Next48hForecastDto {
  window_hours: 48;
  /** 0–100 integer; null when insufficient_data */
  probability: number | null;
  /** jackknife uncertainty band (integers); null when insufficient_data */
  probability_lo?: number | null;
  probability_hi?: number | null;
  /** hard_reset samples used to fit the renewal model */
  sample_size?: number;
  band: ForecastBand;
  factors: ForecastFactorDto[];
  calculated_at: string; // ISO
  method: ForecastMethod;
  disclaimer: string; // 固定：啟發式，非官方、非確認
  /** optional evidence for future_promise */
  evidence_urls?: string[];
}

export interface ProviderSnapshotCard {
  provider: ProviderId;
  display_name: string;
  monitored: boolean;
  display_status: DisplayStatus;
  event_status: DisplayStatus;
  monitoring_status: SourceHealth;
  as_of: string;
  last_successful_ingest_at?: string | null;
  last_operator_heartbeat_at?: string | null;
  source_health: SourceHealth;
  stale_reason?: string | null;
  authority_hint?: string | null;
  coverage_note?: string | null;
  active_event: PublicEvent | null;
  last_confirmed_event: PublicEvent | null;
  pending_detection: PendingDetection | null;
  /** Heuristic next-48h hard-reset forecast; null when not_monitored */
  next_48h?: Next48hForecastDto | null;
}

export interface PublicEvent {
  id: string;
  type: EventType;
  scope: Scope;
  scope_detail?: string | null;
  title: string;
  body_excerpt?: string | null;
  source_url: string;
  source_post_id: string;
  source_author?: string | null;
  authority_grade: AuthorityGrade;
  confidence: "confirmed";
  effective_at: string;
  display_until: string;
  verified_at: string;
  claim_url?: string | null;
  claim_note?: string | null;
  retracted: boolean;
}

export interface PendingDetection {
  candidate_id: string;
  suggested_type: EventType;
  source_url: string;
  created_at: string;
  message: string;
}

export interface SnapshotResponse {
  schema_version: number;
  generated_at: string;
  providers: ProviderSnapshotCard[];
}

export interface EventsResponse {
  schema_version: number;
  as_of: string;
  items: Array<PublicEvent & { provider: ProviderId; evidence: EvidenceItem[] }>;
  next_cursor: string | null;
  has_more: boolean;
}

export interface ProviderStatsDto {
  provider: ProviderId | "all";
  total_confirmed: number;
  hard_reset_count: number;
  banked_credit_count: number;
  last_reset_at: string | null;
  days_since_last: number | null;
  avg_interval_days: number | null;
  longest_drought_days: number | null;
}

export interface StatsResponse {
  schema_version: number;
  as_of: string;
  providers: ProviderStatsDto[];
  overall: ProviderStatsDto;
}

/** hours */
export const CONFIG = {
  schemaVersion: 1,
  heartbeatFreshHours: 4,
  heartbeatDegradedHours: 12,
  displayTtlHardHours: 24,
  displayTtlBankedHours: 24,
  displayTtlPolicyHours: 72,
  timelineDays: 90,
  ruleVersion: "2026-07-20.1",
} as const;
