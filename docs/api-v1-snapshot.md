# API v1 — 凍結契約（W1）

> schema_version: **1**  
> 日期：2026-07-20  
> 對齊：PLAN v3

---

## `GET /v1/stats`

無 Auth。  
`Cache-Control: public, max-age=15, s-maxage=30, stale-while-revalidate=60`

### Response 200

```json
{
  "schema_version": 1,
  "as_of": "2026-07-20T12:00:00.000Z",
  "overall": {
    "provider": "all",
    "total_confirmed": 35,
    "hard_reset_count": 30,
    "banked_credit_count": 5,
    "last_reset_at": "2026-07-18T03:28:22.000Z",
    "days_since_last": 2.2,
    "avg_interval_days": 8.9,
    "longest_drought_days": 67.7
  },
  "providers": []
}
```

## `GET /v1/monitor`

公開監控模式（無 secrets）。

| 欄位 | 說明 |
|------|------|
| `mode` | `free_auto` |
| `source` | last poll adapters（如 `fxtwitter_v2` 或 `fxtwitter_v2+dayclaw_public`） |
| `auto_publish` | bool |
| `monitoring_enabled` | bool |
| `llm_gate_mode` | 如 `opencode_free_then_go` |
| `last_run` | `{ ran_at, source, accounts[] }` |

綠燈路徑：strict templates → optional LLM（free then Go）。  
infra 失敗不永久 reject（soft pending / requeue）。

## `GET /v1/snapshot`

無 Auth。  
`Cache-Control: public, max-age=15, s-maxage=30, stale-while-revalidate=60`

### Response 200

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-20T12:00:00.000Z",
  "providers": [
    {
      "provider": "codex",
      "display_name": "Codex",
      "monitored": true,
      "display_status": "active_confirmed",
      "event_status": "active_confirmed",
      "monitoring_status": "fresh",
      "as_of": "2026-07-20T11:58:00.000Z",
      "last_successful_ingest_at": "2026-07-20T11:55:00.000Z",
      "last_operator_heartbeat_at": "2026-07-20T11:55:00.000Z",
      "source_health": "fresh",
      "stale_reason": null,
      "authority_hint": "staff",
      "coverage_note": null,
      "active_event": {
        "id": "evt_01",
        "type": "hard_reset",
        "scope": "all_paid",
        "scope_detail": null,
        "title": "Usage limits reset for all paid",
        "body_excerpt": "…",
        "source_url": "https://x.com/thsottiaux/status/…",
        "source_post_id": "2078320950488297917",
        "source_author": "thsottiaux",
        "authority_grade": "staff",
        "confidence": "confirmed",
        "effective_at": "2026-07-20T10:00:00.000Z",
        "display_until": "2026-07-21T10:00:00.000Z",
        "verified_at": "2026-07-20T10:05:00.000Z",
        "claim_url": null,
        "claim_note": null,
        "retracted": false
      },
      "last_confirmed_event": null,
      "pending_detection": null
    },
    {
      "provider": "claude",
      "display_name": "Claude",
      "monitored": true,
      "display_status": "no_recent_confirmed",
      "event_status": "no_recent_confirmed",
      "monitoring_status": "fresh",
      "as_of": "2026-07-20T11:58:00.000Z",
      "last_successful_ingest_at": "2026-07-20T11:50:00.000Z",
      "last_operator_heartbeat_at": "2026-07-20T11:50:00.000Z",
      "source_health": "fresh",
      "stale_reason": null,
      "authority_hint": "official_product",
      "active_event": null,
      "last_confirmed_event": {
        "id": "evt_claude_prev",
        "type": "hard_reset",
        "title": "We've reset 5-hour and weekly rate limits for all users.",
        "source_url": "https://x.com/ClaudeDevs/status/2077603834453770467",
        "display_until": "2026-07-17T03:58:48.000Z",
        "verified_at": "2026-07-16T03:58:48.000Z",
        "retracted": false
      },
      "pending_detection": null
    },
    {
      "provider": "grok",
      "display_name": "Grok",
      "monitored": false,
      "display_status": "not_monitored",
      "event_status": "not_monitored",
      "monitoring_status": "disabled",
      "source_health": "disabled",
      "coverage_note": "尚無穩定公開 hard-reset 官源",
      "active_event": null,
      "last_confirmed_event": null,
      "pending_detection": null
    }
  ]
}
```

### 雙軸狀態（server 推導，client 禁止自算 TTL）

| 軸 | 欄位 | 含義 |
|----|------|------|
| **事件** | `event_status` | 有無顯示期內 confirmed／pending |
| **監測** | `monitoring_status` / `source_health` | 營運心跳是否新鮮 |
| **合成** | `display_status` | UI 主狀態（見下） |

**`display_status` 優先序：**

```
if !monitored → not_monitored
elif monitoring_status in (stale, disabled) AND no active event
    → source_unhealthy
elif monitoring_status in (stale, disabled) AND active event still in TTL
    → active_confirmed_degraded   // 綠燈保留 + 必須顯示「監測中斷」badge
elif active event in TTL && !retracted → active_confirmed
elif pending candidate → detected_pending
elif never confirmed → cold_start
else → no_recent_confirmed
```

**半自動 freshness 語意（凍結）：**

| 時間欄位 | 語意 | 可否代填 |
|----------|------|----------|
| `generated_at` | 整份 snapshot 生成時刻 | 否 |
| `as_of` | 快照時間（可與 generated_at 相同） | 否用 ingest 代 |
| `last_operator_heartbeat_at` | **freshness 唯一輸入** | heartbeat 或 ingest/confirm 可更新 |
| `last_successful_ingest_at` | 最近一次 raw/candidate 寫入 | **不得**單獨決定 health |

- `source_health` **必須等於** `monitoring_status`  
- stale 門檻預設 **12h** 無 heartbeat  
- 無新事件但 heartbeat 新鮮 → `no_recent_confirmed` + `fresh`  
- **active predicate 唯一：** `confirmed && !retracted && now < display_until`  
- 已 retract：**永不**進 active 分支  

時間一律 **UTC ISO-8601**。

### 欄位 required（schema_version 1）

**provider 必填：** `provider`, `display_name`, `monitored`, `display_status`, `event_status`, `monitoring_status`, `source_health`, `as_of`, `active_event`, `last_confirmed_event`, `pending_detection`

**可 null：** heartbeat/ingest 時間、`stale_reason`、`authority_hint`、`coverage_note`；三個 nested 無資料時為 `null`

**可選 additive（schema_version 仍 1）：** `next_48h` — 未來 48h hard-reset **啟發式**（第三軸；**永不**改變 `display_status`、**永不**觸發通知）

```json
{
  "window_hours": 48,
  "probability": 12,
  "band": "low",
  "factors": [
    { "id": "baseline", "label": "歷史基線", "delta": 12 },
    { "id": "elapsed", "label": "距上次硬重置", "delta": 0 },
    { "id": "cooldown", "label": "重置後冷卻", "delta": -15 }
  ],
  "calculated_at": "2026-07-20T12:00:00.000Z",
  "method": "deterministic_v1",
  "disclaimer": "啟發式估計，非官方、非確認。綠燈只代表已確認公開 hard reset。"
}
```

| 規則 | 說明 |
|------|------|
| 輸入 | 僅**本站**已確認 `hard_reset`（`effective_at`）；可選 pending 明示未來承諾 |
| `band` | `low` / `medium` / `high` / `insufficient_data`（hard 樣本 &lt; 2 → probability null） |
| `not_monitored` | `next_48h` 為 `null` |
| 禁止 | 刮競品 API、個人額度、與綠燈聯動 |

**PublicEvent（active 與 last_confirmed 同一完整 DTO）：**  
必填：`id`, `type`, `scope`, `title`, `source_url`, `source_post_id`, `authority_grade`, `confidence`, `effective_at`, `display_until`, `verified_at`, `retracted`  
可 null：`scope_detail`, `body_excerpt`, `source_author`, `claim_url`, `claim_note`

**pending_detection 非 null：**

```json
{
  "candidate_id": "cand_…",
  "suggested_type": "hard_reset",
  "source_url": "https://x.com/…/status/…",
  "created_at": "2026-07-20T11:50:00.000Z",
  "message": "偵測到官方貼文，待確認"
}
```

---

## `GET /v1/events`

| Query | 說明 |
|-------|------|
| `provider` | 可選 |
| `include_retracted` | 預設 false |
| `limit` | 預設 50，max 100 |
| `cursor` | opaque |

MVP 硬限：`verified_at >= now - 90 days`。

---

## Admin（最小）

| Method | Path |
|--------|------|
| POST | `/admin/v1/ingest` |
| POST | `/admin/v1/candidates/{id}/confirm` |
| POST | `/admin/v1/candidates/{id}/reject` |
| POST | `/admin/v1/events/{id}/retract` |
| POST | `/admin/v1/heartbeat` body: `{ "provider": "codex" }` |
| POST | `/admin/v1/snapshots/recompute` |
| GET | `/admin/v1/candidates?status=pending_review` |

Auth：Cloudflare Access JWT（`Cf-Access-Jwt-Assertion`）。

---

## OG

| Path | 行為 |
|------|------|
| `GET /share` | 全站摘要 meta HTML（bot） |
| `GET /share/events/{id}` | 單事件 |

Bot UA → HTML；真人 → 302 Flutter origin。
