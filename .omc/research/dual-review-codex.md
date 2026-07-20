# RESET Radar 計畫唯讀審查

審查範圍僅限「docs/PURPOSE.md」與「docs/PLAN.md」，未對參考連結、市場敘述、X 帳號權威性、套件能力或平台政策做外部查證。

## Verdict

**REQUEST CHANGES**

PURPOSE 與 PLAN 在「首屏零登入、公開事件優先、群眾回報不能轉綠、Free 保留核心狀態、個人額度延後」等核心方向高度一致，產品定位也比一般個人 quota tracker 清楚。然而目前仍不是可安全開工的執行規格：綠燈沒有明確有效期限，事件狀態與來源健康度混在一起，來源中斷可能被顯示成「平靜」，而「白名單帳號加關鍵字」也不足以證明官方真的完成全站 RESET。這些缺口會直接產生假綠燈、過期綠燈與假陰性，正好傷害本產品唯一不能失守的信任核心。

此外，四週內同時完成兩條來源管線、三端 Flutter、管理後台、群眾反垃圾、Telegram、Web Push、RevenueCat、PWA／TestFlight 與法務文件，對單人或小團隊不具可信度。若不先收斂，最可能得到的是介面完成但訊號管線與營運機制不可靠的 beta。

## Critical（實作前必修）

### 1. 綠燈不是完整的時間狀態，舊事件可能永久看起來仍在 RESET

PLAN §2.1 把卡片描述為「剛 RESET」，但 §3 的資料模型只有 announced_at、first_seen_at、verified_at，沒有顯示起點、有效期限、過期原因或目前快照的計算規則。confirmed 是「事件曾被確認」，不等於「此刻仍應顯示綠燈」；hard reset、banked credit 與 policy change 也不應共用同一段綠燈時效。

必須在實作前補上：

- 把「事件驗證狀態」與「首屏顯示狀態」拆開。事件至少應有 candidate、pending、confirmed、rejected、expired、retracted 的轉移；首屏則由事件類型、effective_at、display_until 與來源健康度推導。
- 為每種事件定義 display window。逾時後只能顯示「上次確認事件」，不能繼續亮綠。
- banked credit 必須有可領取條件、領取連結與 expires_at；它是可兌換事件，不應讓使用者誤認為帳號已自動補滿。
- 首次上線、沒有歷史資料時顯示「自監測開始尚無已確認事件」，不能顯示「平靜」。
- 每張卡顯示「資料截至時間」與「上次成功檢查時間」。

### 2. confirmed 規則可被語句、帳號分類與上下文誤判

PLAN §3 目前以「白名單官帳加關鍵片語命中」直接形成 confirmed，且 Codex 白名單核心來源是個人員工帳號；PURPOSE 又要求綠燈必須有官方來源或等價強證據。兩份文件沒有定義何謂官帳、員工高可信來源及「等價強證據」，因此來源 URL 必填仍不足以證明事件成立。

關鍵字「Oops... I did it again」尤其不能單獨成為綠燈依據。引用舊文、否定句、條件句、玩笑、回覆他人、事件僅適用部分方案、貼文遭編輯或刪除，都可能命中但不代表新的全站 RESET。可選 LLM 也只能協助分類，不能成為發布綠燈的最終權威。

必須在實作前補上：

- 建立來源登錄表，明列帳號、平台、authority_grade、可接受事件類型、是否允許自動確認、最後人工複核日期與失效處理。
- 官方產品帳號可在「作者身分驗證、原始貼文、語意明確、scope 明確、非引用／轉貼／回覆、貼文 ID 未處理過」全部成立後自動確認。
- 員工個人帳號最多先進 pending；若要自動綠燈，必須在文件中提出可審計的「等價強證據」標準。否則由管理者確認。
- 關鍵字只能產生候選事件；含糊短句不能單獨發布。
- 以 provider 加 source_post_id 做唯一鍵，保存確認人、確認理由、規則版本與撤回事由。
- 群眾 cluster 永遠只能是黃色調查訊號；通知與 UI 文案不得使用容易被理解成「已確認」的火焰或警報語氣。

### 3. 來源失效與「近期無事件」未分離，會造成危險的假陰性

PLAN §2.1 有「平靜」與「未知」，但 §4 沒有來源健康狀態、輪詢成功時間、延遲門檻、失敗重試或降級規則。若 X API 權限失效、額度耗盡、排程停止或解析器壞掉，使用者仍可能看到白色「平靜」，並誮信沒有 RESET。

必須採 fail-closed 規則：

- source health 至少區分 fresh、degraded、stale、disabled。
- 超過明定 freshness SLA 未成功取得來源時，卡片必須轉為「來源中斷／未知」，不得顯示「近期無事件」。
- Public API 快照必須回傳 as_of、last_successful_ingest_at、source_health、schema_version 與 stale_reason。
- 建立來源延遲告警、重試、游標、去重、死信／人工補登流程，以及事件刪除、編輯與撤回後的快取失效及更正通知。
- 冷啟動時必須先以歷史 fixture 回放與人工核對建立基準，不能因資料庫為空就宣告平靜。

### 4. 四週 MVP 範圍過大，且完成定義依賴不可控制的真實事件

W1–W4 同時包含三端 Flutter、兩家來源 ingest、分類器、公開 API、管理操作、Timeline、證據抽屜、Telegram、匿名回報與反垃圾、drought 圖、Web Push、RevenueCat、PWA／App 殼、TestFlight 與法務。對單人或小團隊而言，這不是四週可充分驗證的信任型產品範圍。

W2 的「至少 1 條 Claude 或 Codex 完整證據鏈」若要求新事件真的發生，驗收不可重現；若只用假資料，又不能證明 live ingest。W4 的「TestFlight 或 Web 公開 beta」也讓三平台目標與本期完成定義不一致。

建議把四週 beta 改為：

1. 第 1 週：完成來源取得與條款可行性 spike、歷史貼文 fixture、事件狀態機、來源健康度、人工確認與 API 契約。
2. 第 2 週：完成 Codex、Claude 候選管線與可重放測試，發布 Web Board、Timeline、Evidence；尚無新事件時以歷史資料驗證端到端流程。
3. 第 3 週：完成 Telegram 單一路通知、去重、撤回通知、監控、故障降級與管理稽核。
4. 第 4 週：公開 Web beta、完成隱私／免責／來源準則、效能與故障演練；Flutter 原生端只要求可建置與內部 smoke，不承諾商店 beta。

匿名群眾回報、drought 圖、RevenueCat、Web Push、Discord、iOS／Android 商店發布應移出此四週 MVP。先證明訊號可靠與有人回訪，再做付費和多端發布。

## Important（應在實作前修正）

### 1. 事件模型混合了原始證據、候選判定、已發布事件與首屏快照

單一 ResetEvent 不足以支援可追溯發布。至少要區分：

- RawSourceRecord：原始來源、取得時間、內容雜湊、作者身分、編輯／刪除狀態。
- EventCandidate：解析結果、命中規則、規則版本、建議 scope 與人工審核狀態。
- PublishedEvent：核准後的正式事件、effective_at、display_until、decision_by、decision_reason、retraction。
- ProviderSnapshot：首屏衍生狀態、資料截至時間、來源健康度與最近事件。
- NotificationOutbox：通道、去重鍵、發送結果與撤回更正。

若不拆開，未來無法回答「為何亮綠、哪條規則判斷、誰批准、何時過期、為何撤回」。

### 2. 核心技術與營運決策仍是二選一或空白

PLAN §4.2 與 §10 尚未選定 CF Worker 或 Firebase，也未定 X 官方 API、合規中繼或人工半自動。這兩項不是普通實作細節，而是產品能否即時、合法、穩定運作的核心依賴。

開工門檻應包含：兩個來源都能實際取得資料的證明、成本與輪詢頻率、資料保留限制、貼文刪改處理、備援方式、管理者身分驗證、祕密管理、速率限制、觀測告警、備份與回復。管理後台尤其不能只是架構表的一列；它是早期綠燈公信力的發布權限面，至少需要強式登入、最小權限與不可否認的稽核紀錄。

### 3. 法務、平台政策與隱私範圍不足

目前只有「公開資訊聚合工具、非官方、不代登」一句，尚不足以進入公開 beta。至少要形成明確檢查表：

- 確認 X 或其他來源的 API、顯示、快取、原文摘要、刪除同步與資料保留要求；在確認前不要把「第三方抓取」視為可直接上線的備案。
- 提供非官方關係、商標歸屬、資訊可能延遲／錯誤、不能保證個人帳號額度的免責聲明。
- 說明 Web Push／FCM token、Telegram 識別、IP、反垃圾資料、分析事件的蒐集目的、保存期限與刪除方式。
- 若群眾回報內容會公開，補上檢舉、封鎖、審核、濫用處理與服務條款；若只顯示聚合數字，也要明定不展示自由文字。
- Pro 屬數位服務時，原生 App 內的購買、恢復購買、訂閱管理與跨平台 entitlement 必須先確認各商店規則及實際技術路徑。

### 4. Phase 2 的 WebView／貼 token 描述應移除

PLAN §7 的「Codex WebView／貼 token；Claude 貼 token」與 PURPOSE 的隱私價值觀雖未必形成字面上的「上傳伺服器」，但會引入憑證截取、日誌／崩潰回報外洩、供應商條款、憑證撤銷與使用者誤解等高風險。

應改成：只支援供應商正式文件允許的 OAuth 或 API；憑證僅存於系統安全儲存，不進伺服器、分析、日誌或備份；若沒有合規介面，就不提供該 provider 的個人層。嵌入登入頁以取得 session token 不應列為計畫選項。

### 5. Free／Pro 邊界有矛盾，且付費價值可能鼓勵低信心訊號

PURPOSE 與 PLAN 都保證 Free 有完整 Board，但 PLAN §5 同時寫 Free 有「完整 Timeline」、Pro 有「歷史」，未定義差別；「High 信心 1 路通知」也未說明免費通道究竟是 Telegram 或 Web Push。Pro 將 Medium 信心列為賣點，容易形成「為了付費價值而放大不可靠訊號」的錯誤誘因。

建議明定：

- Free：完整即時 Board、證據、最近固定期間的 Timeline，以及一個明確的免費通知通道。
- Pro：較長保存期、跨通道投遞、安靜時段、每 provider 規則、匯出與日曆；不販售較低的真實性標準。
- 所有通道的 confirmed 判定完全一致；Pro 只能增加便利性，不得降低綠燈門檻。
- RevenueCat 與價格實驗延後到訊號頻率、通知留存與付費意願有初步證據後。

### 6. 競爭差異存在，但尚不足以證明需要三端 App

「多 provider、離桌推播、零登入」相對 Codex 個人用量工具有清楚差異，但第一階段實際只有 Codex 與 Claude，其他卡片長期 Unknown；若 hard reset 頻率很低，Telegram 加 Web 頁面已可能滿足大部分需求。現有文件沒有事件頻率、搜尋需求、候補用戶或留存假設的摘要，因而無法判定原生 App 與 Pro 是否值得同步投入。

建議把差異化聚焦在「跨 provider 的可稽核證據鏈、來源健康透明、快速更正、公開歷史資料」，並用 Web／Telegram beta 驗證事件頻率、訂閱成長、通知開啟與七日／三十日回訪，再決定原生 App 與付費時點。六家卡片不應等同六家產品覆蓋；MVP 首屏可只突出兩家正在監測的 provider，其餘放在「尚未具備可靠官源」的覆蓋說明區。

### 7. 缺少可重現的測試與品質閘門

計畫沒有明定分類器 fixture、時間邊界、失敗模式與通知去重測試。至少應加入：

- 正例、否定句、引用舊文、部分方案、banked、刪文、改文與重複抓取 fixture。
- candidate 到 confirmed／rejected／expired／retracted 的狀態轉移測試。
- source stale 時不得顯示平靜或綠燈的回歸測試。
- 快取過期、API 離線、時鐘偏差、重複通知與撤回通知測試。
- Web 首屏冷啟動、低速網路、無資料與 stale snapshot 的 smoke。
- 可量測的偵測延遲、人工確認延遲、撤回延遲、重複通知率與來源 freshness SLA。

## Minor / nitpicks

1. PLAN §2.1 使用 hard、banked，§3 schema 使用 hard_reset、banked_credit；應統一名稱，避免 API 與 UI 映射分叉。
2. P0、P1、P2 同時被用作產品層級與時程語意；「Claude P0/P1 完整管線」不清楚，建議改成「MVP／MVP 後／個人層」。
3. UI 同時使用綠、黃、白、藍、黑與 emoji；必須搭配文字、圖示與可存取性標籤，不能只靠顏色。
4. 「來源數」不等於可信度。單一官方原文可能高於大量匿名回報，應優先顯示來源等級與判定理由。
5. 所有儲存時間應規定為 UTC，UI 再依使用者時區呈現，並顯示相對時間與絕對時間。
6. scope 為 subset 或 unknown 時，不宜使用「全站 RESET」標題；卡片文案必須直接揭露適用方案與未知範圍。
7. 「打開小於 3 秒」應定義測試裝置、網路條件與百分位數；否則不能驗收。
8. 分享 OG 卡若由 Flutter Web 單獨產生，需先定義伺服器端 metadata 或靜態分享頁方案，不能只列為 UI 功能。
9. retracted 不宜只用布林值；應記錄時間、原因、替代事件與是否已發送更正通知。
10. 「S 級來源」目前沒有文件化等級標準，應移除口語評級或補上正式定義。

## Suggested concrete edits to PURPOSE.md / PLAN.md（章節錨點）

### PURPOSE.md

- §3「成功長什麼樣子」：新增「每張卡顯示資料截至時間」「來源逾 freshness SLA 必須轉未知」「假綠燈為最高嚴重度事故」「撤回與更正有時限」。
- §5「RESET 定義」：新增「綠燈是最近一個已確認事件在明定顯示期內，不代表個人帳號此刻一定有額度」；分別定義 hard reset 與 banked credit 的顯示期限及過期行為。
- §7「與競品差異」：把主差異補成「跨 provider、可稽核證據鏈、來源健康度、快速撤回」，不要只依賴 App 與推播。
- §8「商業目的」：明定免費通知通道、Free Timeline 保存期及 Pro 歷史保存期；刪除「Medium 信心」作為付費品質差異。
- §9「約束與價值觀」：新增「來源失效時寧可 Unknown，不得顯示平靜」「只使用正式允許的個人授權方式，不以 WebView 或貼 session token 取憑證」。

### PLAN.md

- §2.1「首屏」：將狀態改成「近期已確認事件／調查中／近期無已確認事件／來源中斷／尚未監測」，每張卡加入 as_of、last_successful_check、display_until 與 scope。
- §2.3「Provider 策略」：MVP 首屏預設只展示 Codex、Claude；弱訊號 provider 移至覆蓋說明，直到有可驗證官源才升為 live 卡片。
- §3「事件模型」：拆成 RawSourceRecord、EventCandidate、PublishedEvent、ProviderSnapshot、NotificationOutbox；新增 authority_grade、effective_at、display_until、expires_at、decision_by、decision_reason、rule_version、source_health、stale_reason。
- §3「信心規則」：把關鍵字命中降為 candidate；補上來源等級、上下文排除、scope 判定、人工核准條件、唯一鍵及完整狀態轉移。明文規定 LLM 不得直接發布綠燈。
- §4「技術架構」：在 sprint 前選定後端與資料來源；補上排程、游標、重試、去重、管理者驗證、稽核、監控、快取失效、撤回、更正通知及資料保留。
- §5「商業」：消除 Free Timeline 與 Pro 歷史矛盾，指定免費通道；把 Pro 定義成便利性與保存期，而非較低信心內容。
- §6「四週 MVP」：改成 Web first、兩家來源、人工確認、單一路通知與可靠性驗證；移出群眾回報、圖表、RevenueCat、多通道與商店 beta。
- §7「Phase 2+」：刪除 WebView／貼 token，改為「僅支援供應商正式允許的 OAuth／API；無合規介面即不支援」。
- §8「風險」：新增來源中斷假陰性、帳號被盜／貼文刪改、錯誤 scope、通知重複、管理權限外洩、X 條款與資料保留等風險及處置。
- §9「指標」：加入來源 freshness、候選偵測延遲、人工確認延遲、假綠燈數、撤回延遲、重複通知率；North Star 的「正確」需有可稽核判定方式。
- §10「近期決策待定」：將後端與 X 資料來源改成有截止點的開工閘門；新增來源權威分級、綠燈有效期、免費通知通道與 beta 平台範圍四項決策。
- §11「啟動檢查清單」：在 flutter create 前加入「兩個來源取得 spike 通過、條款檢查完成、狀態機核准、歷史 fixture 通過、來源中斷演練通過」。

## Other observations

### 十項審查維度總評

| 維度 | 評語 |
|---|---|
| 目標清晰度 | PURPOSE 與 PLAN 的主軸一致；事件與即時狀態、Free Timeline 與 Pro 歷史仍有矛盾。 |
| 可行性 | Web-first 的兩來源 beta 可行；目前 W1–W4 全包範圍不可信。 |
| 訊號策略 | Codex、Claude 先做深，其餘 Unknown 的方向正確；六格首屏仍會稀釋價值。 |
| 信心狀態機 | 群眾不得轉綠是正確護欄；TTL、來源健康、權威分級與上下文判定是阻斷缺口。 |
| 商業模式 | Free 保留核心狀態有利獲客；Pro 權益矛盾且價值尚未驗證。 |
| 法務／條款／商店 | 已有非官方方向，但來源使用、資料保留、UGC、隱私、訂閱與個人憑證規範不足。 |
| 技術架構 | Worker 加 Flutter 的大方向合理；發布管線、管理權限、觀測、快取撤回與通知一致性未設計。 |
| 競爭差異 | 有定位差異，但目前可能只是更漂亮的 Web 加 Telegram；可信證據鏈與來源健康才是可防守差異。 |
| 範圍蔓延 | 群眾回報、drought、RevenueCat、多通道及原生商店 beta 應更晚。 |
| 實作阻斷決策 | 資料取得、後端、權威來源、綠燈時效、免費通道、beta 平台與驗收 fixture 均需拍板。 |

### 值得保留的部分

- 首屏零登入與核心狀態不付費，是正確且一致的產品底線。
- 「Unknown 優於假綠燈」及「群眾不能單獨轉綠」是此產品最重要的兩條護欄。
- Codex、Claude 先做深，比追求 provider 數量更合理。
- 公開原文連結、撤回保留審計、個人額度延後，均符合信任型產品的正確排序。

### 可轉為 APPROVE 的最低條件

1. 文件化並測試「候選、確認、過期、撤回」狀態機及來源 stale 的 fail-closed 行為。
2. 明定來源權威等級，移除「關鍵字命中即 confirmed」與含糊短句自動綠燈。
3. 以實際 spike 證明 Codex、Claude 兩條來源可合規、穩定取得，並選定後端與營運備援。
4. 把四週範圍收斂為 Web、兩來源、人工確認、單一路通知、可重現 fixture 與可靠性演練。
5. 移除 WebView／貼 session token 的 Phase 2 方向，補齊來源、隱私、免責、UGC 與訂閱檢查清單。

以上五項完成後，這份計畫可望升為「APPROVE WITH MINOR FIXES」；在此之前直接實作，最可能先做出好看的看板，卻尚未建立可信的 RESET 雷達。
