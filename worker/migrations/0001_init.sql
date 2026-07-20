-- RESET Radar D1 schema v1
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  monitored INTEGER NOT NULL DEFAULT 0,
  authority_hint TEXT,
  coverage_note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'x',
  platform_user_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  authority_grade TEXT NOT NULL,
  providers_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (platform, platform_user_id)
);

CREATE TABLE IF NOT EXISTS raw_source_records (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'x',
  author_user_id TEXT,
  author_handle TEXT,
  post_id TEXT NOT NULL,
  url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  content_hash TEXT,
  raw_text TEXT NOT NULL,
  is_reply INTEGER NOT NULL DEFAULT 0,
  is_quote INTEGER NOT NULL DEFAULT 0,
  is_retweet INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (platform, post_id)
);

CREATE TABLE IF NOT EXISTS event_candidates (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  raw_source_id TEXT NOT NULL,
  suggested_type TEXT NOT NULL,
  suggested_scope TEXT NOT NULL DEFAULT 'unknown',
  rule_hits_json TEXT NOT NULL DEFAULT '[]',
  rule_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS published_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'unknown',
  scope_detail TEXT,
  title TEXT NOT NULL,
  body_excerpt TEXT,
  source_url TEXT NOT NULL,
  source_post_id TEXT NOT NULL,
  source_author TEXT,
  authority_grade TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'confirmed',
  effective_at TEXT NOT NULL,
  display_until TEXT NOT NULL,
  expires_at TEXT,
  announced_at TEXT,
  first_seen_at TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  decision_by TEXT NOT NULL,
  decision_reason TEXT,
  rule_version TEXT,
  evidence_snapshot_json TEXT NOT NULL DEFAULT '[]',
  candidate_id TEXT,
  claim_url TEXT,
  claim_note TEXT,
  retracted_at TEXT,
  retract_reason TEXT,
  retract_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, source_post_id)
);

CREATE TABLE IF NOT EXISTS provider_meta (
  provider TEXT PRIMARY KEY,
  last_successful_ingest_at TEXT,
  last_operator_heartbeat_at TEXT,
  source_health_override TEXT,
  stale_reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
