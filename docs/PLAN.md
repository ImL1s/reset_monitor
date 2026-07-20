# RESET Radar — 計劃書（Plan）

> 對齊：`docs/PURPOSE.md` v3、`docs/api-v1-snapshot.md`、`docs/FULL_AUDIT.md`  
> 日期：2026-07-20 **v3**（完整審計：heartbeat、雙軸狀態、API 金樣、誠實時效）  
> 審查紀錄：dual-review + 對抗稽核 + 公開源／CF／steelman 探索

---

## 0. 摘要

**Flutter Web 優先**（App 殼可後置）：打開即見「有沒有公開 RESET」，無需登入。

| 層 | 內容 |
|----|------|
| **MVP 公開層** | 半自動 ingest（Codex + Claude）→ 狀態機 → 公開 API → Web Board + TG |
| **MVP 後** | 推播多通道、Pro、群眾回報（防 Sybil 後）、原生商店 |
| **Phase 2** | 個人用量（僅 mobile、合規 OAuth／API） |

**HARD RULES**

1. 首屏永不要求 AI 帳號登入  
2. **Confirmed 綠燈 = 官源候選 + admin 核准**（MVP）；關鍵字 alone 不夠  
3. 群眾回報永不單獨轉綠  
4. 不上傳使用者 AI token／session 代查  
5. 弱訊號 provider 不造假綠燈  
6. 核心看板不進付費牆  
7. 來源監測 stale → 不得偽「平靜」；**已確認且在 TTL 內的事件不因監測中斷而偷偷取消**（改 `active_confirmed_degraded` + badge）  
8. 半自動 freshness = **operator heartbeat**，不是「有無新推文」  
9. 公開 API 契約以 `docs/api-v1-snapshot.md` 為準（schema_version 1）

---

## 1. 問題與方案

見 PURPOSE。方案 = **公開事件雷達（zero-auth）** + 可選個人層（後）。

```
Cron */10 (free-auto)
  → FxTwitter v2 timeline (primary) | Dayclaw public items (fallback)
  → RawSourceRecord + EventCandidate
  → AutoPublishGate (strict templates)
       fail → OpenCode Zen free LLM → infra fail only → OpenCode Go
  → confirm | soft-pending (requeue) | hard-reject
  → ProviderSnapshot + /v1/stats + /v1/events + /v1/monitor
  → Flutter Web Board + Telegram outbox (KV, retry)
Admin: emergency retract / pipeline only
```

---

## 2. 產品範圍

### 2.1 首屏：Live Status Board（零 Auth）

**MVP 主卡片：僅 Codex + Claude。**  
其餘 provider 放「覆蓋說明／尚未具備可靠官源」區（可後升格）。

每張監測中卡片：

| 欄位 | 說明 |
|------|------|
| 顯示狀態 | 見 §3.3（非原始 confidence  alone） |
| 上次已確認事件 | 相對 + 絕對時間 |
| 類型 | hard_reset / banked_credit / policy_change / … |
| 信心／來源等級 | confirmed 才綠；detected = 待確認黃 |
| 原文 + 證據 | source_url 必填（confirmed） |
| **as_of** | 本快照生成時間（server clock） |
| **last_operator_heartbeat_at** | 來源最後人工確認／心跳（**freshness 唯一來源**） |
| **last_successful_ingest_at** | 最近一次成功入庫 raw/candidate（≠ freshness） |
| **source_health** | fresh / degraded / stale / disabled（= monitoring_status） |
| scope | all_paid / subset / unknown — 文案不得謊稱全站 |

**禁止登入牆。**

### 2.2 其他畫面

| 畫面 | MVP |
|------|-----|
| Event Timeline | ✅ 含歷史回填 |
| Provider Detail | ✅ 規則說明 + 證據 |
| Evidence drawer | ✅ |
| Notify（TG） | ✅ Free 唯一通道 |
| Admin 確認台 | ✅ 內部工具 |
| My Quota | ❌ Phase 2 |
| Drought 炫圖 | ❌ MVP 後 |
| Pro paywall | ❌ MVP 後 |

### 2.3 Provider 策略

| Provider | 訊號 | MVP |
|----------|------|-----|
| Codex | @thsottiaux（員工個人帳，**authority: staff**） | 完整管線 + 回填 |
| Claude | @ClaudeDevs（**authority: official_product**） | 完整管線 + 回填 |
| 其他 | 弱 | 覆蓋說明 only |

UI 文案區分「官方產品帳」vs「官方員工帳」。

---

## 3. 資料模型與狀態機

### 3.1 分層實體（勿混成單一 blob）

```text
RawSourceRecord {
  id, platform, author_user_id, author_handle,
  post_id, url, fetched_at, content_hash,
  raw_text, is_reply, is_quote, is_retweet,
  deleted_or_missing: bool
}

EventCandidate {
  id, provider, raw_source_id,
  suggested_type, suggested_scope,
  rule_hits[], rule_version,
  status: pending_review | rejected | promoted,
  created_at
}

PublishedEvent {
  id, provider, type, scope,
  title, body_excerpt,
  source_url, source_post_id, source_author,
  authority_grade: official_product | staff | other,
  confidence: confirmed,          # 發布後的公開等級
  effective_at,                   # 事件生效
  display_until,                  # 綠燈結束
  expires_at?,                    # banked 等
  announced_at, first_seen_at, verified_at,
  decision_by, decision_reason, rule_version,
  evidence_snapshot[],            # 防 link rot
  retraction?: { at, reason, by, replacement_event_id? }
}

ProviderSnapshot {
  provider,
  display_status,                 # §3.3
  as_of,
  last_successful_ingest_at,
  source_health,
  stale_reason?,
  active_event_id?,               # 若仍在 display_until 內
  last_confirmed_event_id?,
  schema_version
}

NotificationOutbox {
  id, channel, event_id, dedupe_key,
  status, sent_at, correction_of?
}
```

唯一鍵：`provider + source_post_id`（防重複抓取）。

### 3.2 候選規則（只產生 candidate，不發綠燈）

**白名單：以不可變 X user ID 儲存**（非 handle）。

**Codex 片語（staff）**  
`reset usage limits` | `for all paid` | `banked reset` | `100% weekly` | `hard reset` | `another reset` …

**Claude 片語（official）**  
`We've reset 5-hour and weekly` | `rate limits for all users` …（可 fuzzy／人工兜底）

**排除／降級（不自動 pending 高優先）：**

- RT / quote / reply（預設忽略或僅 rumor）  
- 否定句、疑問句、明顯 teaser（「should we reset?」）  
- 僅 emoji／過短無 scope  

**LLM**：可輔助分類，**不得**直接發布 confirmed。

### 3.3 首屏狀態（雙軸 + 優先序；**僅 server 推導**）

**軸 A — event_status：** 有無顯示期內 confirmed / pending  
**軸 B — monitoring_status：** heartbeat 是否新鮮（`last_operator_heartbeat_at`）

**display_status 優先序（凍結，見 api-v1-snapshot）：**

```
!monitored → not_monitored
monitoring stale/disabled && NO active TTL event → source_unhealthy
monitoring stale/disabled && HAS active TTL event → active_confirmed_degraded  // 綠保留 +「監測中斷」
active TTL confirmed → active_confirmed
pending candidate → detected_pending   // 半自動：= admin 已 ingest 未 confirm
never confirmed → cold_start
else → no_recent_confirmed
```

| display_status | UI 含義 |
|----------------|---------|
| `active_confirmed` | 🟢 顯示期內已確認 RESET |
| `active_confirmed_degraded` | 🟢+⚠ 事件仍有效，但監測心跳過期 |
| `detected_pending` | 🟡 已入庫待核准（非全網自動偵測） |
| `no_recent_confirmed` | ⚪ 監測正常、近期無 confirmed |
| `source_unhealthy` | ⚫ 監測中斷且無有效事件 — **禁止**寫「平靜」 |
| `cold_start` | 自監測起尚無任何 confirmed |
| `not_monitored` | 覆蓋說明 only |

Client **禁止**自算 TTL；一律信 server。

### 3.4 綠燈 TTL 與合併

| type | 預設 display window |
|------|---------------------|
| hard_reset | **24h**（可設定） |
| banked_credit | **24h** 公告期；另註「需自行兌換，非自動補滿」 |
| policy_change | **72h** 或至下一則取代 |

**合併：** 同 provider、±2h 窗、同 type 的多則官推 → 一條 PublishedEvent（保留全部 source 作 evidence）。  
**升級：** detected_pending 後 admin 核准 → 同一邏輯事件升 confirmed，不雙開。  
**過期：** display_until 後 → no_recent_confirmed，保留「上次事件」。  
**撤回：** retracted 顯示更正；可發 TG 更正；保留審計。

### 3.5 信心與核准（MVP）

| 公開等級 | 條件 |
|----------|------|
| **confirmed** | 白名單 user id + 非排除上下文 + **admin 核准** + source_url |
| **detected**（僅 UI 黃） | 規則命中候選，待核准 |
| **likely** | 群眾 cluster（**MVP 不做**；見 §6） |
| **rumor** | 不進首屏主狀態 |

### 3.6 Source health（半自動語意 — 凍結）

| 欄位 | 含義 |
|------|------|
| `last_operator_heartbeat_at` | 營運者最後一次成功 heartbeat **或** ingest/confirm |
| `last_successful_ingest_at` | 最後一次寫入 raw/candidate 成功時間 |
| **不是** | 「X 上有沒有新推文」 |

| health | 條件（預設 config） |
|--------|---------------------|
| fresh | now − heartbeat ≤ 4h |
| degraded | 4h–12h |
| stale | > **12h** 無 heartbeat |
| disabled | 人工關閉監測 |

- Cron 只**重算** health／過期綠燈，不假裝在爬 X  
- Admin：`POST /admin/v1/heartbeat` `{ "provider": "codex" }` — 即使無新事件也應定期打  
- Public API：見 `docs/api-v1-snapshot.md`

### 3.7 狀態轉移表（Candidate → Published）

| From | To | 觸發 |
|------|-----|------|
| — | raw created | admin ingest |
| — | candidate pending_review | 規則預填（可人工改 type/scope） |
| pending_review | rejected | admin reject + reason |
| pending_review | promoted + published created | admin confirm + source_url |
| published active | display expired | now ≥ display_until（**推導**，不必改 row status） |
| published | retracted | admin retract + reason |
| raw A,B 同 provider/type ±2h | merge evidence | confirm 時 `merge_into_event_id` 或 server 建議 |
| 唯一鍵 | provider+source_post_id | 防雙 confirmed |

關聯：`PublishedEvent.candidate_id`；`merged_source_post_ids[]` 可選。

---

## 4. 技術架構

### 4.1 客戶端

- Flutter **Web first**（Board / Timeline / Detail）  
- iOS/Android：可 scaffold，**不承諾** W4 商店 beta  
- Riverpod + go_router  
- 只讀公開 API  

### 4.2 後端（定案）

**Cloudflare Worker + D1（或 KV）+ Cron Trigger**

| 元件 | 職責 |
|------|------|
| Admin API | 貼文 URL／手動錄入 → Raw + Candidate；**一鍵 confirm／reject／retract** |
| Auth | Cloudflare Access 或同等（admin only） |
| Classifier assist | 可選規則預填，不自動綠 |
| Public API | `GET /v1/snapshot`、`GET /v1/events` |
| OG / share HTML | **Bot UA 回靜態 meta HTML**（真人導向 Flutter）；修分享卡 |
| Staleness monitor | Cron **只依 `last_operator_heartbeat_at`** 推導 health；ingest 時間**不得**決定 freshness；可另告警「久未入庫」但那不是 source_unhealthy |
| Telegram mirror | confirmed 與 retract 更正 |
| Audit log | decision_by / reason / rule_version |

**X 資料（MVP 定案）：人工／半自動**  
營運者看到 Tibo／ClaudeDevs 貼文 → Admin 貼 URL 或欄位 → 規則預填 → **人工 confirm**。  
不採爬蟲。  
**成本澄清：** 官方 X PPU 讀 2 帳號約 **$1–5／月**（非主因）；半自動主因是 **admin 信任閘** 與合規。  
**Phase 1.5：** 可加 PPU 自動拉白名單 timeline → **只進 candidate**，仍不自動綠。

**Heartbeat：** 即使無新事件，營運者應定期 `POST /admin/v1/heartbeat`（或每次打開 Admin 自動 ping），避免假 stale。

### 4.3 目錄草案

```
lib/          # Flutter
docs/         # PURPOSE, PLAN, …
worker/       # CF Worker: public + admin + og
fixtures/     # 歷史貼文 JSON 回放測試
```

### 4.4 測試閘門（MVP 必備）

- Fixture：正例、否定、疑問 teaser、quote、banked、重複 post_id、刪文  
- 狀態轉移：candidate → confirmed / rejected / expired / retracted  
- **狀態矩陣（必須）**  
  - stale + 無 active → `source_unhealthy`（不得寫平靜、不得綠）  
  - stale + active（`confirmed && !retracted && now < display_until`）→ `active_confirmed_degraded`（綠保留 + 中斷 badge）  
  - stale + 僅 retracted／expired → 不得綠  
  - fresh + active → `active_confirmed`  
  - 48h 無新貼文但每 4h heartbeat → 必須 **fresh** + `no_recent_confirmed`  
- active predicate 唯一：`confirmed && !retracted && now < display_until`  
- 通知 dedupe + 撤回更正  
- Web 冷啟動／空資料／stale snapshot smoke

---

## 5. 商業

| Free（MVP） | Pro（**MVP 後** 第 5–6 週+） |
|-------------|------------------------------|
| Board + Evidence + Timeline（例如 90 天） | 更長保存、多通道、安靜時段細控、iCal／CSV |
| **Telegram 1 路**，僅 confirmed | App／Web Push 等；**判定門檻與 Free 相同** |
| 分享頁（Worker OG） | 可選個人對照（Phase 2） |

不把 Medium／likely 當付費升級內容。

---

## 6. 四週 MVP（收斂版）

| 週 | 交付 | 完成定義 |
|----|------|----------|
| **W1** | 狀態機 + Admin 半自動錄入 + Public API + Web Board（Codex 為主）+ **歷史回填 fixture** + OG share 頁 + as_of／health | 用歷史事件端到端走完 confirm→顯示→過期；無新事件也能 demo |
| **W2** | Claude 管線 + Timeline + Evidence drawer + 雙 provider 回填 | 兩家卡片 + 至少各 1 條歷史 confirmed 可稽核 |
| **W3** | Telegram 通知 + dedupe + retract 更正 + staleness 告警 + 故障演練 + 管理稽核 | 人為 stale／retract 演練通過 |
| **W4** | 公開 Web beta + 隱私／免責／來源準則頁 + 效能與可靠性檢查清單；Flutter mobile **可建置 smoke**（非商店必須） | 陌生人零登入可用；disclaimer 上線 |

### 移出四週

- 匿名群眾回報（需 attestation／Turnstile 規格後另開）  
- Drought 炫圖、RevenueCat／Pro、Discord、Web Push 主力、商店上架  
- 六格假平等 provider 卡  

### 時效 SLO（營運 — 誠實版）

- **URL 入庫後**：pending 立即在 Board 可見（黃）  
- **Admin confirm 後**：綠燈 + TG **立即**  
- **不**承諾「貼文出現後 10 分鐘內自動偵測」（MVP 無自動拉流）  
- Solo 睡覺：可能數小時無 confirmed；**不得**為此放寬綠燈門檻  
- 產品成功標準 **不是** 快過 codex-resets.com

---

## 7. Phase 2+

1. 付費 X API 自動拉白名單 timeline → 仍進 candidate  
2. Pro + 多通道推播  
3. 群眾回報（DeviceCheck／Play Integrity／Turnstile + N 與時間窗寫死）  
4. **個人層僅 mobile**：僅供應商正式 OAuth／API；**禁止** WebView 抓 session、禁止鼓勵貼 session token；**Web 不做個人層**（CORS → 禁 proxy 代持）  
5. Widget、Grok 等升格（有官源才）  

---

## 8. 風險與緩解

| 風險 | 緩解 |
|------|------|
| 假綠燈 | Admin gate；排除 teaser；retract 流程 |
| 來源中斷假陰性 | source_health；禁止偽平靜 |
| 推文刪除 link rot | evidence_snapshot |
| Handle 搶註 | 存 user id |
| 帳號被盜假公告 | Admin 仍需 sanity；異常高頻告警 |
| Solo 時區延遲 | detected 黃燈 + 文案 |
| X API 成本 | MVP 半自動 |
| 低頻事件留存差 | 回填歷史；平靜也顯示上次／規則 |
| 分享卡失敗 | Worker OG HTML |
| App 純殼拒審 | 商店前必備原生價值（推播等） |

---

## 9. 指標

- North Star（可稽核「正確」）  
- 來源 freshness SLA 達標率  
- 候選→確認延遲、確認→推播延遲  
- **假綠燈數（目標 0）**、撤回延遲  
- 重複通知率  
- TG 訂閱成長、D7 回訪  
- （後）Pro 轉換  

---

## 10. 已拍板決策（開工閘門）

| 項目 | 決定 |
|------|------|
| 後端 | **Cloudflare Worker + D1** |
| X 資料 MVP | **人工／半自動 + Admin 核准** |
| 綠燈 | **Admin confirm**；自動只到 detected |
| 綠燈 TTL | hard **24h** 預設 |
| Heartbeat stale | **>12h** 無 heartbeat → monitoring stale |
| Free 通知 | **Telegram**（W3；W1 可不做） |
| MVP 平台 | **Web 公開 beta**；mobile 非必須上架 |
| API 契約 | **`docs/api-v1-snapshot.md` schema_version 1** |
| Pro | **移出四週 MVP** |
| 群眾回報 | **移出**至防 Sybil 規格完成後 |
| 個人層 | Phase 2 mobile only；禁 WebView session |
| 時效 KPI | **不**以快過 codex-resets 為目標 |

仍可微調但不擋 W1：產品最終名、域名。

---

## 11. 實作啟動檢查清單

- [x] PURPOSE + PLAN 初稿  
- [x] Dual-review（Codex + Fable）→ REQUEST CHANGES  
- [x] Critical 修訂入 v2  
- [x] 完整審計 + 多路探索 → v3（heartbeat、雙軸、API 金樣）  
- [x] `docs/api-v1-snapshot.md` 契約  
- [ ] Admin 工具最小 UI／CLI + heartbeat  
- [ ] Fixtures 歷史貼文（Codex 為主；Claude W2）  
- [ ] Worker + D1 實作 snapshot／ingest／confirm  
- [ ] Flutter Web Board 接真 API  
- [ ] Telegram bot + channel（W3）  
- [ ] Disclaimer / 隱私草稿  
- [ ] source_unhealthy／degraded 演練通過  

---

## 12. 參考連結

- https://codex-resets.com/  
- https://t.me/codex_resets  
- https://t.me/codexreset  
- https://codex-reset-radar.pages.dev/  
- https://www.willcodexquotareset.com/  
- https://x.com/thsottiaux  
- https://x.com/ClaudeDevs  
- https://x.com/OpenAIDevs  
- https://docs.x.com/x-api/getting-started/pricing  
- https://github.com/steipete/CodexBar  
- `docs/FULL_AUDIT.md`、`docs/api-v1-snapshot.md`

---

## 13. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-07-20 | v1：零 Auth 公開雷達 pivot |
| 2026-07-20 | **v2**：dual-review 後——admin 綠燈、TTL、source health、模型分層、MVP 收斂、半自動 X、TG Free、Pro／群眾移出、OG Worker、禁 WebView session |
| 2026-07-20 | **v3**：完整審計——heartbeat 語意、雙軸狀態、綠燈×stale 政策、API 金樣、誠實時效定位、X 成本澄清、競品表擴充 |
