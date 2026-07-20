# Dual-Review v3 — Fable 5 審查報告

> Reviewer：Claude Fable 5（READ-ONLY 文件審查，無程式碼變更）
> 日期：2026-07-20
> 審查對象：`docs/PURPOSE.md` v3、`docs/PLAN.md` v3、`docs/api-v1-snapshot.md`（schema_version 1）、`docs/FULL_AUDIT.md`
> 依據 brief：`.omc/research/dual-review-v3-brief-safe.md`

---

## 裁決：**APPROVE WITH MINOR FIXES**

v3 已實質關閉 v2 dual-review 的全部 Critical 與對抗稽核 H1–H7。三份文件的核心語意（heartbeat、雙軸狀態、綠燈×stale 政策、誠實時效、admin gate）一致且自洽。**沒有擋 W1 開工的 Critical。**

殘餘問題全部屬於「凍結契約的精確度補強」層級：3 項 Important（建議在 Flutter client 依賴契約前補上，均為半小時內可完成的規格增補，不是設計缺陷）+ 若干 Minor。可以邊開 W1 邊修。

---

## 維度 1：v2 dual-review Critical 是否真的關閉

| v2 Critical | v3 證據 | 判定 |
|-------------|---------|------|
| 禁關鍵字直綠、admin gate | PLAN HARD RULE 2（PLAN.md:22）、§3.5 confirmed 四條件（白名單 user id + 非排除上下文 + admin 核准 + source_url，PLAN.md:213-219）、§3.2 LLM 不得直接發布 confirmed（PLAN.md:168） | ✅ 關閉 |
| 綠燈 TTL | PURPOSE §5 hard reset 24h（PURPOSE.md:77）、PLAN §3.4 TTL 表 + 過期推導（PLAN.md:199-210）、API 金樣 effective_at→display_until 恰為 24h（api-v1-snapshot.md:47-48） | ✅ 關閉 |
| 防假平靜（stale ≠ calm） | HARD RULE 7（PLAN.md:27）、`source_unhealthy` 禁寫「平靜」（PLAN.md:193）、測試閘門「source stale 不得顯示平靜或綠」（PLAN.md:303） | ✅ 關閉 |
| 砍四週 scope | PLAN §6「移出四週」明列群眾回報、Pro、Drought、商店上架、六格假平等卡（PLAN.md:329-333）；§10 拍板表（PLAN.md:384-399） | ✅ 關閉 |

四項全部關閉，且不是口頭關閉——各有對應的資料欄位、狀態機分支或測試閘門承接。

---

## 維度 2：對抗稽核 H1–H7 是否關閉

| ID | 原問題 | v3 對策與證據 | 判定 |
|----|--------|---------------|------|
| **H1** (Critical) | 「6h 無 ingest = stale」把正常平靜打成中斷；或寫死 fresh 變劇場 | Freshness 改為 **operator heartbeat**（HARD RULE 8，PLAN.md:28；§3.6，PLAN.md:221-238）；stale 門檻放寬至 **>12h** 並明言「避免 6h 誤傷睡眠」（api-v1-snapshot.md:128）；`POST /admin/v1/heartbeat` + 開 Admin 自動 ping（PLAN.md:287）；「劇場」風險由 cron 只重算不假爬（PLAN.md:236）+ W3 stale 演練（PLAN.md:326）+ 測試閘門承接 | ✅ 關閉 |
| **H2** (Critical) | stale 時熄滅仍在 TTL 的綠燈 = 錯維度 | 新增 `active_confirmed_degraded`：綠燈保留 + 強制「監測中斷」badge（PLAN.md:180-181、191；api-v1-snapshot.md:113-114）；HARD RULE 7 明文「已確認且在 TTL 內的事件不因監測中斷而偷偷取消」 | ✅ 關閉 |
| **H3** (Critical) | display_status 缺優先序／雙軸 | 雙軸（event_status × monitoring_status）+ 凍結優先序 pseudocode，PLAN §3.3 與 API 文件兩處一致（PLAN.md:176-186；api-v1-snapshot.md:107-119）；明定「僅 server 推導、client 禁自算 TTL」（PLAN.md:197） | ✅ 關閉（一處 `!retracted` 精確度問題見 Important-1） |
| **H4** (Critical) | 無 snapshot JSON 金樣 | `docs/api-v1-snapshot.md` 已建，含完整 200 response 金樣、三種 provider 形態（active_confirmed / no_recent_confirmed / not_monitored）、Cache-Control、UTC ISO-8601 約定 | ✅ 關閉（`pending_detection` 形狀未給樣本，見 Important-2） |
| **H5** (Important) | 暗示「比 codex-resets 更快」= 產品謊言 | PURPOSE §2 明文「MVP 不追求更快時效」（PURPOSE.md:28-29）、§3 非成功指標、PLAN §6 誠實版 SLO（PLAN.md:335-341）、§10 拍板「不以快過 codex-resets 為目標」 | ✅ 關閉 |
| **H6** (Important) | detected 10–15min SLO 是空 KPI | SLO 改寫為「URL 入庫後 pending 立即可見；confirm 後綠燈+TG 立即；**不**承諾貼文後 10 分鐘自動偵測」（PLAN.md:337-340） | ✅ 關閉 |
| **H7** (Important) | banked 缺 claim_url／非自動到帳欄位 | PURPOSE §5 banked 列 `claim_url`/`claim_note`（PURPOSE.md:78）；API active_event 含兩欄（api-v1-snapshot.md:50-51）；PLAN §3.4 banked 註「需自行兌換，非自動補滿」（PLAN.md:205） | ✅ 關閉 |

H1–H7 全數關閉。

---

## 維度 3：PURPOSE / PLAN / API 一致性

逐項核對結果：

| 項目 | PURPOSE | PLAN | API | 判定 |
|------|---------|------|-----|------|
| 綠燈 TTL 24h | §5 ✅ | §3.4、§10 ✅ | 金樣 24h ✅ | 一致 |
| Stale 門檻 12h | —（未涉及數值）| §3.6 >12h、§10 ✅ | 128 行 12h ✅ | 一致 |
| Heartbeat 語意（≠ 新推文） | §10 決策記錄 ✅ | HARD RULE 8、§3.6 ✅ | 121-127 行 ✅ | 一致 |
| Admin-only 綠燈 | §3、§10 ✅ | HARD RULE 2、§3.5 ✅ | confidence: confirmed ✅ | 一致 |
| 授權分級 staff / official_product | §5 隱含 | §2.3 明列 ✅ | authority_hint/grade ✅ | 一致 |
| TG 唯一 Free 通道 | §3、§8 ✅ | §5、§10 ✅ | n/a | 一致 |
| 90 天歷史 | — | §5「例如 90 天」 | events 硬限 90 天 ✅ | 一致 |
| 零登入首屏 | §4 ✅ | §2.1 禁登入牆 ✅ | /v1/snapshot 無 Auth ✅ | 一致 |
| display_status 七態 | — | §3.3 表七態 ✅ | 優先序七態 ✅ | 一致 |
| 個人層僅 mobile、禁 WebView session | §4、§10 ✅ | §7 ✅ | n/a | 一致 |
| X 成本敘事（$1–5/月、主因是信任） | §10「錢不是主因」✅ | §4.2 ✅ | n/a | 與 FULL_AUDIT §3.3 一致 |

九條 HARD RULES（brief 版）逐條核對：**全部在 PURPOSE/PLAN/API 中有明文承接，無違反。**

發現的不一致均屬 Minor 級（見下方清單）：`monitoring_status` 與 `source_health` 疑似重複欄位、PLAN §3.1 ProviderSnapshot 缺 heartbeat 欄、PURPOSE 殘留「High ≡ confirmed」舊詞與「即時監測」措辭。

---

## 維度 4：W1 開工前殘餘 blocker

**無 Critical blocker。** 狀態機、資料模型、Admin API 面、測試閘門、W1 完成定義（「用歷史事件端到端走完 confirm→顯示→過期；無新事件也能 demo」）都已具備可實作的精確度。FULL_AUDIT §6 確認 CF Worker + D1 架構可開工。

以下 Important 項建議在 **Flutter client 開始依賴凍結契約之前**（即 W1 內、不必在 W1 之前）補上。

---

## 發現清單

### Critical

**無。**

### Important（3 項，均為契約精確度增補，不改設計）

**I-1：「active TTL event」定義未在所有分支排除 retracted**
- 位置：`docs/api-v1-snapshot.md:110-115`、`docs/PLAN.md:178-183`
- 問題：優先序第 4 分支寫 `active event in TTL && !retracted → active_confirmed`，但第 2、3 分支（stale 路徑）只寫「HAS active TTL event」。若事件在監測 stale 期間被 retract，字面實作會走到 `active_confirmed_degraded`——**對已撤回事件顯示綠燈**，直接違反「假綠燈 = 最高嚴重度事故」。
- 修法：在兩份文件為「active TTL event」下統一定義：`confirmed && now < display_until && !retracted`，並註明適用於優先序全部分支。加一條 fixture：「stale 期間 retract → 不得 active_confirmed_degraded」。

**I-2：`pending_detection` 物件形狀未定義**
- 位置：`docs/api-v1-snapshot.md:55、80、93`（三個樣本皆為 `null`）
- 問題：`detected_pending` 是 W1 就會出現的狀態（半自動流程中「已入庫待核准」），Board 必須渲染 🟡 卡片，但凍結契約裡 `pending_detection` 從未出現非 null 樣本，Flutter 端無從凍結解析。
- 修法：補一個金樣，例如 `{ "candidate_id", "suggested_type", "first_seen_at", "source_url" }`（欄位由你定，但必須入契約）。同理建議補 `active_confirmed_degraded` 與 `source_unhealthy` 形態各一個 provider 樣本（含 `stale_reason` 非 null 的例子）。

**I-3：`GET /v1/events` 缺 response 金樣**
- 位置：`docs/api-v1-snapshot.md:133-144`
- 問題：只定義了 query 參數與 90 天硬限，沒有 response schema／分頁 envelope（`events[]`？`next_cursor`？）。Timeline 是 W2 交付，但契約自稱「凍結」，缺口應補齊。
- 修法：補 200 金樣（含 cursor 分頁 envelope 與 retracted 事件在 `include_retracted=true` 時的形態）。

### Minor（7 項）

**M-1：`monitoring_status` 與 `source_health` 疑似完全重複**
`api-v1-snapshot.md:27、31` 兩欄值域相同、來源相同（heartbeat）。凍結契約中的重複狀態是漂移溫床。建議：明文「monitoring_status ≡ source_health（alias，保留一版本週期後移除其一）」或直接刪一個。

**M-2：`degraded` 一詞雙義**
`source_health: degraded`（4–12h，PLAN.md:233）**不會**觸發 `active_confirmed_degraded`（後者由 stale/disabled 觸發，PLAN.md:180）。同字不同義，實作者易接錯線。建議 display_status 改名為 `active_confirmed_monitoring_lost` 之類，或在兩份文件加警語。

**M-3：`no_recent_confirmed` 的 UI 文案「監測正常」在 health=degraded 時不精確**
PLAN.md:192 表格寫「⚪ 監測正常、近期無 confirmed」，但 health 為 degraded（例如營運者睡覺 4–12h）時仍會落在此狀態。建議 UI 規格註明：degraded 時附「監測降級」小標，避免文案說謊。

**M-4：PLAN §3.1 `ProviderSnapshot` 欄位落後於 API**
PLAN.md:132-141 缺 `last_operator_heartbeat_at`、`event_status`、`monitoring_status`（API 金樣皆有）。建議補齊，維持「PLAN 資料模型 ⊇ API 投影」的關係。

**M-5：PURPOSE 殘留 v2 舊詞**
- PURPOSE.md:42「High ≡ confirmed」——v3 信心等級表（PLAN §3.5）已無 High/Medium 標度，建議改寫為「通知僅 confirmed」。
- PURPOSE.md:41「Codex + Claude **即時**監測」——與 H5 誠實定位相扞格（半自動人工流程並非即時），建議改「半自動監測」。

**M-6：`last_confirmed_event` 是否可為 retracted 事件未定義**
Claude 樣本帶 `retracted: false`（api-v1-snapshot.md:78），暗示可能出現 true。建議明文：retracted 事件是否仍可作為 `last_confirmed_event` 展示（建議：顯示最近一筆未撤回者，另以更正註記呈現撤回歷史）。

**M-7：`not_monitored` provider 的欄位省略規則未明文**
Grok 樣本省略了 `as_of`、`last_successful_ingest_at` 等欄（api-v1-snapshot.md:83-94）。凍結契約應明定哪些欄位在 `monitored: false` 時可省略／必為 null，避免 client 解析歧義。另建議：`event_status: "not_monitored"` 把監測概念漏進事件軸，可改為 `none` 或 null。

### 順帶觀察（不計入裁決）

- Heartbeat 為 per-provider（`{"provider": "codex"}`）；雙 provider 後營運者要打兩次。可考慮支援 `{"providers": ["codex","claude"]}` 或「開 Admin 自動 ping 全部 monitored」——PLAN.md:287 已暗示後者，落實即可。
- Evidence snapshot 保存推文全文有 X 內容轉載的灰區；目前用 `body_excerpt`（節錄）+ 原文連結已屬合理緩解，維持節錄原則即可。
- 快取（max-age 15 / s-maxage 30）與「confirm 後立即」的體感落差最多約 30–60 秒，與誠實時效定位相容，不需改。

---

## 結論

| 審查維度 | 結果 |
|----------|------|
| 1. v2 Criticals 關閉 | ✅ 4/4 全關，且有欄位／狀態機／測試閘門承接 |
| 2. H1–H7 關閉 | ✅ 7/7 全關 |
| 3. 三文件一致性 | ✅ 核心語意一致；僅 Minor 級措辭與欄位滯後 |
| 4. W1 前 blocker | 無 Critical；3 項 Important 為契約增補，W1 內完成即可 |
| 5. 裁決 | **APPROVE WITH MINOR FIXES** |

**放行條件（非擋門，W1 期間完成）：**
1. I-1 統一「active TTL event」定義（含 `!retracted`）並加對應 fixture——這是唯一有假綠燈風險的殘洞，請優先。
2. I-2 / I-3 補齊 `pending_detection` 與 `/v1/events` 金樣後，契約才真正稱得上「凍結」。
3. Minor 項可隨手清，不擋任何進度。

v3 相對 v2 的改善是實質的：heartbeat 語意、雙軸狀態與綠燈×stale 政策把「fail-closed 但不誤殺已確認事件」這條最難的線畫對了。可以開工 W1。
