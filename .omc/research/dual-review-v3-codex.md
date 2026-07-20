# RESET Radar v3 唯讀審查報告（Codex）

> 審查日期：2026-07-20  
> 審查範圍：`docs/PURPOSE.md`、`docs/PLAN.md`、`docs/api-v1-snapshot.md`、`docs/FULL_AUDIT.md`  
> 審查性質：唯讀；未檢查或修改程式碼

## Verdict

**REQUEST CHANGES**

v3 的產品方向正確，也已實質修掉多數 v2 問題：零登入首屏、admin 才能綠燈、事件 TTL、Codex + Claude 收斂、Pro／群眾回報移出 MVP、誠實延遲定位與 banked 欄位都已寫清楚。因此本案不是 `REJECT`，也不需要重做架構。

但目前仍不應直接進入 W1 實作。原因不是缺少更多功能，而是四份文件對幾個 P0 契約仍有互相衝突：heartbeat 的唯一 freshness 來源、stale 時有效綠燈的處理、retracted 事件是否仍算 active，以及 snapshot 所謂「凍結契約」的實際型別。這些歧義會讓後端、Flutter 與測試各自做出不同答案，並可能重新製造假 stale 或假綠燈。

本輪結論：**方向 GO；文件／契約閘門尚未 GO。先完成下列 Critical 修訂，再開始 W1 code。**

## 一、v2 dual-review Criticals 是否關閉

| v2 共識問題 | v3 結果 | 判定 |
|---|---|---|
| 關鍵字命中直接綠燈 | `PLAN` 明定 candidate 與 PublishedEvent 分層，且 confirmed 需白名單、排除上下文、admin 核准與 source URL（`PLAN:152-168, 212-219`） | **已關閉** |
| 綠燈沒有 TTL | hard reset／banked／policy change 都有 display window，client 禁止自行算 TTL（`PLAN:197-210`） | **已關閉** |
| stale 被誤顯示成「平靜」 | 主狀態設計已加入 `source_unhealthy` 與 `active_confirmed_degraded`，但 freshness 實作與測試條文互相衝突 | **部分關閉，仍阻擋 W1** |
| 四週同時做六家、Pro、群眾與商店 | MVP 已收斂為 Web first、Codex + Claude、Telegram；Pro、群眾、六格 provider 與商店上架移出（`PLAN:320-351`） | **已關閉** |

## 二、對抗稽核 H1–H7 複查

| ID | v3 狀態 | 複查結論 |
|---|---|---|
| **H1**：無 ingest 被誤判 stale | **部分關閉／阻擋** | `PLAN §3.6` 與 API 正確改用 `last_operator_heartbeat_at`，但 `PLAN:277` 又要求 staleness cron 檢查 `last_successful`；首屏欄位也把 `last_successful_ingest_at` 描述成「上次成功檢查」。實作者仍可能照錯欄位重建 H1。 |
| **H2**：stale 熄滅仍在 TTL 的綠燈 | **部分關閉／阻擋** | 主優先序正確保留 `active_confirmed_degraded`，但 `PLAN:302` 的測試閘門寫成「source stale 不得顯示平靜或綠」，直接要求相反結果；retracted + stale 也存在誤綠漏洞。 |
| **H3**：缺雙軸與優先序 | **部分關閉／阻擋** | 已有雙軸與優先序，但 active predicate、enum、nullable／required 欄位及 `monitoring_status` 與 `source_health` 的關係未凍結，尚不足以形成唯一狀態機。 |
| **H4**：沒有 snapshot JSON 金樣 | **部分關閉／阻擋** | 已新增一份 JSON 範例，但它只涵蓋 fresh active、fresh idle、not monitored；關鍵的 pending、stale、degraded-active、cold start、banked、retracted 都沒有非 null 金樣或型別定義，且 PLAN model 與 JSON 本身不一致。檔名雖稱凍結，契約仍無法唯一實作。 |
| **H5**：不誠實的速度定位 | **已關閉** | `PURPOSE:28-29` 與 `PLAN:335-341` 都明確承認半自動較慢，不以快過 codex-resets.com 為成功條件。 |
| **H6**：無自動拉流卻承諾 10–15 分鐘偵測 | **已關閉** | SLO 已改成「URL 入庫後」與「admin confirm 後」，並明說不承諾貼文出現後自動偵測。 |
| **H7**：banked 缺 claim 語意 | **已關閉，仍有一項小修** | `claim_url`／`claim_note` 已進 snapshot，`PLAN:203-205` 也要求顯示「需自行兌換，非自動補滿」。建議再把這句變成 `type=banked_credit` 的固定 UI invariant，不依賴 `claim_note` 是否有值。 |

## 三、Critical

### C1. Freshness 的唯一資料源仍自相矛盾，H1 會被重新實作

**證據**

- 正確契約：`PLAN:221-238` 指定 health 由 operator heartbeat 推導；`last_successful_ingest_at` 只是最後一次 raw／candidate 寫入時間。
- 正確 API：`api-v1-snapshot.md:121-127` 也明定沒有新事件但 heartbeat 新鮮時，必須仍為 `no_recent_confirmed + fresh`。
- 衝突指令：`PLAN:277` 卻寫「Staleness monitor：Cron 檢查 last_successful；告警」。
- 首屏欄位說明又把 `last_successful_ingest_at` 稱為「上次成功檢查」，與 `PLAN:226` 的「最後一次寫入 raw/candidate」不同。

**影響**

半自動模式長時間沒有事件是正常狀態。若 cron 或 UI 用 ingest 時間判 freshness，正常平靜會變成 source unhealthy；若為避免它而虛構 ingest，freshness 又會變成劇場。這正是 H1 的原始 Critical。

**必要修訂**

1. 把 `PLAN:277` 改為：cron **只依 `last_operator_heartbeat_at`** 推導 `monitoring_status/source_health`，另可獨立監控 ingest pipeline，但 ingest 時間不得決定 freshness。
2. 把首屏 `last_successful_ingest_at` 說明改為「最近一次成功入庫／寫入」，另顯示 operator heartbeat 作「來源最後人工確認時間」。
3. 在 API 契約明寫：`as_of`、`generated_at`、heartbeat、ingest 四者各自語意，禁止互相代填。
4. 加入「48 小時無新貼文、但每 4 小時 heartbeat」的 fixture；預期必須保持 fresh，而不是 stale。

### C2. stale 狀態、retraction 與測試閘門存在假綠燈／錯誤熄燈兩種相反風險

**證據**

- 正確產品規則：`PLAN:177-195` 與 `api-v1-snapshot.md:109-119` 要求 stale + 有效 TTL event 顯示 `active_confirmed_degraded`。
- 相反測試規則：`PLAN:302` 寫「source stale 不得顯示平靜或綠」，會迫使測試在 stale 時把有效綠燈熄掉。
- API 的 stale 分支只檢查「active event still in TTL」（`api-v1-snapshot.md:111-114`），沒有像下一個 fresh 分支一樣檢查 `!retracted`（`:115`）。
- `PLAN` 的 `active_event_id` 註解只說「仍在 display_until 內」（`PLAN:139`），也沒有排除 retracted；但 `PLAN:209-210` 又要求撤回後顯示更正。

**影響**

- 若照測試條文做：監控中斷會錯誤否定一個仍有效的已發布事件，重開 H2。
- 若照 API pseudo-code 直譯：已撤回但 TTL 尚未到的事件，在監測 stale 時可能仍得到 `active_confirmed_degraded`，形成 P0 假綠燈。

**必要修訂**

1. 凍結唯一 predicate：`active_event := confirmed && !retracted && now < display_until`。所有 snapshot、優先序、查詢與 cache 都只能使用這個 predicate。
2. 撤回完成後，下一次 snapshot 的 `active_event` 必須為 `null`；更正資訊應放在明確的 correction／last event 結構，不可繼續被 active 分支命中。
3. 把 `PLAN:302` 改成狀態矩陣：
   - stale + 無 active event → `source_unhealthy`，不得寫平靜、不得綠；
   - stale + active non-retracted TTL event → `active_confirmed_degraded`，綠燈保留且必須有中斷 badge；
   - stale + retracted／expired event → 不得綠；
   - fresh + active event → `active_confirmed`。
4. 明定 TTL 邊界為 `now < display_until`；`now >= display_until` 一律 expired。

### C3. `api-v1-snapshot.md` 尚不是可凍結、可驗證的 schema_version 1 契約

**證據**

- `PLAN` 的 `ProviderSnapshot`（`PLAN:132-142`）沒有 API 已出現的 `monitored`、`event_status`、`monitoring_status`、`last_operator_heartbeat_at` 與三個 nested objects；反之 PLAN 把 `schema_version` 放在 provider 內，JSON 卻只放在 top level（`api-v1-snapshot.md:18`）。
- `active_event` 與 `last_confirmed_event` 看似同類事件，欄位集合卻不同（`api-v1-snapshot.md:35-55` 對 `:71-80`），未說明後者是 summary DTO 還是欄位可任意省略。
- Codex、Claude、Grok provider objects 的欄位集合不同，文件沒有 required／nullable 規則。
- `event_status`、`monitoring_status`、`source_health`、`display_status` 沒有完整 enum 與關係定義；`monitoring_status` 與 `source_health` 目前看似重複，但沒有說是否必須永遠相等。
- `pending_detection` 只有 `null`，W1 必做的 ingest → 黃燈無任何非 null shape；同樣沒有 stale、`active_confirmed_degraded`、cold start、banked 或 retracted 的金樣。

**影響**

Flutter 無法安全決定欄位是否必填、是否 nullable、事件 DTO 是否共用；Worker 也無法用一份機器可驗證的 fixture 證明自己符合 schema 1。這不是文件美化問題，而是 W1 後端與 client 會立即分歧的契約 blocker。

**必要修訂**

1. 在同一文件加入 JSON Schema／OpenAPI，或至少加入等價的欄位表：型別、required、nullable、enum、default、條件 invariant。
2. 決定 `schema_version` 只在 top level，或每個 provider 都有；兩份文件只能保留一種。
3. 決定 `monitoring_status` 與 `source_health` 是同一欄位、相容 alias，或不同概念；若保留兩者，必須定義可接受組合。
4. 將 `active_event` 與 `last_confirmed_event` 定義成同一完整 DTO，或明確命名為不同 DTO 並列出各自 required 欄位。
5. 至少提供並自動驗證這些 schema 1 fixtures：fresh idle、fresh pending、fresh active、degraded、stale idle、stale active、cold start、not monitored、expired、retracted、banked。
6. 把 `event_status` 的完整 enum 與合成矩陣寫死；client 只 render server 結果，不自行猜欄位組合。

## 四、Important

### I1. Evidence chain 是核心承諾，但 confirm 條件與公開 API 都沒有把它變成 invariant

`PURPOSE:37, 129-133` 要求使用者能以 published event + evidence 核對，且每則 confirmed 都有來源 URL + 快照。`PLAN:128` 有 `evidence_snapshot[]`，但 confirmed 條件（`PLAN:214-217`）只要求 source URL；API active event 也沒有 evidence 欄位，而 `/v1/events` 沒有 response schema。

**具體修訂：** confirm 必須由 server 驗證非空 evidence snapshot（至少 captured_at、原文／content hash、保存位置或不可變內容）；若允許快照稍後補，必須明定這段期間不能成為 confirmed 綠燈。另在 `/v1/events` 或明確 evidence endpoint 凍結公開 DTO，讓 W2 Evidence drawer 不必改 schema 1。

### I2. Admin confirm 目前只有路徑清單，沒有足以保護 P0 綠燈的 server contract

`api-v1-snapshot.md:146-158` 只有 endpoint 名稱，沒有 request／response、validation、idempotency 或錯誤碼。`PublishedEvent.authority_grade` 又允許 `other`（`PLAN:121`），而 MVP 硬規則只允許官方產品帳或員工官源候選經 admin 核准。

**具體修訂：** 在 W1 前凍結 confirm 的 server-side preconditions：candidate 狀態為 pending、immutable user id 在 provider whitelist、authority grade 為 MVP 允許集合、排除規則通過、source URL 與 evidence 完整、事件未重複；不符合時回傳明確 4xx，不能靠 Admin UI 自律。定義 `provider + source_post_id` 的 idempotent 行為及 merge 衝突回應。

### I3. `as_of` 尚未定義，可能製造「資料比實際監看更新」的錯覺

sample 中 `generated_at=12:00`、`as_of=11:58`、heartbeat=11:55`，但沒有說 11:58 代表什麼。對本產品而言，資料截至時間是信任訊號，不應只是 snapshot recompute 時間。

**具體修訂：** 建議明定：`generated_at` 是 server 產生 response 的時間；`as_of` 是該 provider 最後被實際覆蓋／人工確認到的時間，半自動 MVP 應等於或受限於 `last_operator_heartbeat_at`；`last_successful_ingest_at` 只描述資料寫入。UI 文案也依此區分。

### I4. `/v1/events` 與 retraction/correction 的公開形狀未定義

Timeline、Evidence drawer、撤回更正都是 MVP，但 API 只列 query，沒有 response body、cursor envelope、event/correction DTO，也沒說 retracted event 是否能成為 `last_confirmed_event`。若等到 W2/W3 才決定，W1 的 D1 schema 與 snapshot 很可能返工。

**具體修訂：** W1 前至少凍結 event envelope、event id 穩定性、evidence、retraction `{at, reason, replacement_event_id}`、cursor 與 `include_retracted` 語意；公開 `retracted` 不要只剩 boolean，否則 UI 無法呈現「更正了什麼」。

### I5. 撤回後的 cache 可見時間沒有安全界線

Snapshot 允許 `s-maxage=30, stale-while-revalidate=60`。若沒有 purge／bypass 規則，retract 後舊綠燈可能繼續由 CDN 提供一段時間；文件同時把假綠燈列為最高嚴重度事故。

**具體修訂：** 定義 confirm／retract／expire 後的 recompute 與 cache purge 流程，以及「更正最多多久全網可見」的 SLO。若接受最多約 90 秒舊資料，也要明寫並納入故障測試；retract 最好主動 purge，而不是只等 SWR。

## 五、Minor

### M1. Solo 延遲的緩解寫成 `detected 黃燈` 不成立

`PLAN:364` 寫「Solo 時區延遲 → detected 黃燈 + 文案」，但 MVP 沒有自動拉流；營運者睡覺時連 candidate 都不會入庫，因此不會有 detected 黃燈。應改成「heartbeat/source health 誠實顯示 + 不承諾貼文到偵測時效」，避免文件再次暗示不存在的能力。

### M2. `High ≡ confirmed` 是展示別名，最好不要成為第二套信心模型

`PURPOSE` 使用 High／confirmed，而 PLAN/API 只保留 confirmed。建議文件明寫 High 只是通知／UI copy，不是可獨立儲存或付費分級的 confidence enum；或直接統一只用 confirmed。

### M3. banked 的「非自動到帳」應由 type 保證，不應依賴可空欄位

`claim_url`、`claim_note` 可為 null 是合理的，但 `type=banked_credit` 時，client 仍必須固定顯示「需自行兌換／不代表帳號已補滿」。將此列為 schema/UI invariant，可完全鎖住 H7。

## 六、PURPOSE／PLAN／API 一致性總結

| 主題 | 結果 |
|---|---|
| 零 Auth 首屏／公開 API | **一致** |
| Admin 才能 confirmed 綠燈 | **產品規則一致；Admin server contract 尚未凍結** |
| 群眾不能單獨轉綠 | **一致，且已移出 MVP** |
| 不代持使用者 AI token/session | **一致** |
| 弱 provider 不造假綠 | **一致；`not_monitored` sample 正確** |
| 核心 Board 不付費 | **一致** |
| stale 不得偽平靜、active TTL 可保留綠燈 | **主設計一致，但測試條文與 retraction predicate 衝突** |
| freshness = operator heartbeat | **PURPOSE/API/PLAN §3.6 一致，但 PLAN 後端元件列衝突** |
| schema_version 1 | **版本號一致；實際 schema 尚未完整凍結** |
| 誠實時效定位 | **一致** |
| Evidence／快速更正 | **目的明確；API 與 confirm invariant 尚不完整** |

## 七、W1 開工前的最小修訂清單

這些都是文件／契約修訂，不要求新增產品 scope：

1. 統一 freshness：所有 health 推導只讀 `last_operator_heartbeat_at`；修掉 `last_successful` 的衝突描述。
2. 定義唯一 active predicate：confirmed、未撤回、`now < display_until`。
3. 把 stale 測試閘門改成完整狀態矩陣，特別覆蓋 stale + active、stale + retracted。
4. 將 snapshot schema 1 補成可驗證契約，統一 PLAN model、top-level version、enum、required／nullable 與 event DTO。
5. 新增 pending、stale、degraded-active、cold start、expired、retracted、banked 金樣。
6. 凍結 Admin confirm 的 server-side validation 與 idempotency；`other` 不得在 MVP 被 confirm 成綠燈。
7. 將 evidence snapshot 變成 confirmed 的必要條件，並定義公開 evidence／events DTO。
8. 定義 `as_of` 與 cache purge／retraction propagation SLO。

## 最終裁決

**REQUEST CHANGES。**

v3 已通過產品方向與 MVP scope 審查；剩餘問題集中在狀態機和 API 契約，修復面小但風險高。完成 C1–C3 與對應金樣／矩陣後，可直接升為 **APPROVE WITH MINOR FIXES** 並進 W1；在此之前開始寫 Worker 或 Flutter，會把同一組歧義固化成兩套實作，不建議開工。
