# RESET Radar — 計劃 Dual-Review 報告（Fable 5）

> 日期：2026-07-20
> 審查者：Claude Fable 5（READ-ONLY 計劃審查，未改動任何檔案）
> 審查對象：`docs/PURPOSE.md`、`docs/PLAN.md`
> 審查依據：`.omc/research/dual-review-brief-safe.md`（十大構面 + 六條 HARD RULE）

---

## Verdict：**REQUEST CHANGES**

一句話理由：計劃方向正確、HARD RULE 全數守住，但**現行規格下綠燈可被 game**（自動 confirmed + teaser 推文 + 無 attestation 的匿名黃燈），且有五項未定案的決策會在下週實作時直接擋路。這些都是章節級修訂可解的問題，不是方向問題。

---

## 十大構面總覽

| # | 構面 | 評估 | 對應項目 |
|---|------|------|----------|
| 1 | 目標一致性 | ✅ PURPOSE 與 PLAN 大致對齊 | 少數矛盾見 I3、M5 |
| 2 | 可行性（W1–W4） | ⚠️ W1–W3 合理；W4 明顯過載 | C3、I5 |
| 3 | 訊號策略 | ⚠️ 方向正確；單點依賴與白名單實作有洞 | C1、C3、M4 |
| 4 | 信心狀態機 | ❌ 可被 game；生命週期未定義 | C1、C2、C4 |
| 5 | 商業模式 | ✅ 結構健康；Pro 上線時價值單薄 | I5、O2 |
| 6 | 法務 / ToS / 商店 | ⚠️ 缺商標、隱私、X ToS 細節 | C3、I6、I8 |
| 7 | 技術架構 | ⚠️ 缺 OG 渲染、heartbeat、防濫用元件 | C2、C5、I1 |
| 8 | 競品差異化 | ✅ 足夠但護城河薄；時效是真壁壘 | I4、O1 |
| 9 | Scope creep | ⚠️ 可再砍（Pro、drought 圖、六格） | I5、M2、M3 |
| 10 | 阻塞性待決事項 | ❌ 至少 5 項擋下週實作 | C1–C5、I3 |

---

## Critical（實作前必須修正）

### C1. 「白名單官帳 + 關鍵片語 = confirmed 綠燈」可被 game，且自動／人工判定未定案

PLAN §3 信心規則表寫 confirmed = 「白名單官帳 + 關鍵片語命中」即綠燈；但 §4.2 又有 Admin 元件「手動確認／撤回」。**到底是自動轉綠還是 admin 核准後才綠？兩處互相矛盾，這是整個產品信任模型的核心，未定案無法實作。**

具體可被 game／誤觸的情境：

1. **Teaser 推文**：Tibo（@thsottiaux）慣常在真正按按鈕前發預告／互動文（「should we do it again?」之類）。關鍵字 `another reset` 會命中疑問句 → 假綠燈。這不是理論風險，是這個帳號的已知發文風格。
2. **否定句／引用**：「no reset today」、轉推或 quote 舊公告，關鍵字照樣命中。
3. **帳號被盜**：白名單帳號被入侵發一則假公告 → 自動轉綠 → 信任毀滅。
4. **Handle 搶註**：若白名單比對的是 handle 而非 X user ID，帳號改名後舊 handle 被搶註即可偽造來源。

**要求：**
- MVP 期 confirmed 一律需 admin 人工核准；自動命中只能產生「detected／待確認」中間態。
- 白名單以**不可變的 X user ID** 儲存，不用 handle。
- Classifier 加排除規則：RT／quote／reply 不觸發；含否定詞與疑問句降級。
- 此規則直接對應 HARD RULE 2、3——現行寫法不滿足「綠燈不可被 game」。

### C2. 匿名黃燈（likely）可被 Sybil 攻擊

PLAN §3 likely = 「時間窗內 ≥N 獨立裝置回報」，但「獨立裝置」在零 Auth 產品上無定義——沒有 attestation 的匿名回報端點，一支腳本就能偽造 N 個「裝置」把任意 provider 刷成黃燈，這是對信任的低成本攻擊面。W3 只寫「匿名回報 + 反垃圾」，無任何規格。

**要求：**
- Mobile 端強制 attestation（Play Integrity / DeviceCheck 或 Firebase App Check）；Web 端 Cloudflare Turnstile + IP／裝置雙軌 rate limit。
- 明訂 N 值、時間窗、回報衰減、以及 Web 匿名回報的權重上限（或 Web 回報只計數不觸發黃燈）。
- 若 W3 做不完這套防濫用，**整個群眾回報功能延後**——在 PLAN 明寫它是第一個可砍項（見 I5、M3）。

### C3. X 資料取得管道與成本未定案 — 直接擋 W1

PLAN §4.2 寫「拉 X（API 或合規中繼）」、§10 列為待決。問題：

- 官方 X API 讀取是付費的（近年 Basic 級約 $200/月，免費層讀取額度趨近於零；實作前需確認現價）——這對「小盈利」專案是顯著固定成本。
- 爬蟲或第三方轉發服務違反 X ToS，「合規中繼」目前並沒有實際存在的合規選項，這四個字掩蓋了一個未做的決定。
- 人工＋半自動（admin 看到推文後一鍵輸入）最務實，§10 也已傾向此路。

**要求：**現在就定案「W1 = 人工／半自動 admin 輸入為主」，寫明不採爬蟲；若日後付費 API 划算再升級為自動輪詢。監聽對象只有 2 個帳號，人工路線完全可行。

### C4. 綠燈生命週期、事件去重、狀態轉移未定義 — 擋看板 UI 與 ingest 實作

現行 schema 與信心表沒有回答：

1. **綠燈亮多久？** RESET 是瞬間事件，「🟢 剛 RESET」需要 TTL（建議 6–24h 後轉回 ⚪ 並顯示「上次事件 N 小時前」），否則看板語義是「狀態」還是「事件」都不明。
2. **去重**：Tibo 同一次 reset 常發多則推文（預告＋公告＋補充），會產生重複事件。需要合併 key（provider + 時間窗）。
3. **升級合併**：群眾黃燈先出現、官方推文後到——是升級同一事件還是兩個事件？
4. **retracted 之後**看板顯示什麼？

**要求：**在 PLAN §3 之後補一節「狀態轉移表 + 綠燈 TTL + 事件合併規則」。這是下週寫 board UI 和 ingest 的前置條件。

### C5. 分享／SEO 架構與 Flutter Web 天生衝突 — 冷啟動兩大獲客機制會失效

- **OG 分享卡**（§5 Free 功能、W1「可分享 Web URL」）：TG／X／Discord 的 unfurl 爬蟲不執行 JS，Flutter Web 無法輸出動態 OG meta → 分享卡直接不顯示。
- **SEO**（§8 用「規則說明頁 SEO」當空 feed 的主要緩解）：Flutter Web canvas 渲染對搜尋引擎幾乎不可索引 → 這條緩解在現行架構下不成立。

**要求：**在 §4.2 新增元件——Worker 端 OG／meta 渲染（bot UA 回 HTML、真人導向 app），或規則說明／行銷頁走靜態 HTML（SSG），Flutter 只負責互動看板。不修這條，冷啟動的兩個獲客渠道（分享卡、搜尋流量）同時靜默失效——這正是 brief 要求對「cold start fails」嚴格把關的情境。

---

## Important（實作前應修正）

### I1. 資料新鮮度 heartbeat：管線死掉會偽裝成「平靜」
ingest 靜默失效時，看板顯示 ⚪ 平靜——這比假綠燈更陰險（假陰性無人察覺）。看板必須顯示「資料截至 N 分鐘前」，後端需 staleness 內部告警。這應該列入 §8 風險表與 §4.2 元件表。

### I2. 證據鏈 link rot：推文會被刪
綠燈的可追溯性建立在 source_url 上，但推文可刪、帳號可消失。confirmed 事件的 `evidence[]` 必須存快照（截圖或存檔服務），否則「每則綠燈有來源 URL」（PURPOSE §9.3）在半年後是空話。

### I3. Free 通知通道矛盾
PLAN §4.2 Notify 寫「FCM topic（**Pro**／訂閱者）」，但 §5 Free 含「High 信心 1 路通知」、PURPOSE §3 通知列寫「TG / Web Push / App」。App push 到底是不是 Free？**要求：**明訂 Free = 於 TG／App push／Web Push 中擇一通道、僅 High 事件；Pro = 多通道 + Medium + 細緻控制。這直接決定 notify 元件的實作。

### I4. 時效 SLO 與 admin gate 的衝突（C1 的代價要正面處理）
Tibo 常在台灣深夜時段發文；C1 要求 admin 核准後才綠，等於 solo 開發者睡覺時綠燈延遲數小時——而**通知時效正是本產品對 codex-resets 的核心差異**。建議流程：自動偵測 → 立即發「待確認」黃燈與標註『偵測到官方貼文，待人工確認』的推播 → admin 醒來一鍵轉綠或撤回。同時定義目標延遲（如 High 事件推播 < 偵測後 10 分鐘）。這樣同時滿足 HARD RULE 2／3 與時效價值。

### I5. W4 過載 + Web 付費路徑未解 → 建議 Pro 整段移出 MVP
W4 塞了 Web Push、RevenueCat、PWA／App 殼、隱私政策、上架——單週不可行。且 `purchases_flutter` 不支援 Web，Web 端 Pro 需另接 RevenueCat Web Billing 或 Stripe（實作前確認現況），這是 §10 沒列的待決項。另外 iOS 的 Web Push 需 iOS 16.4+ 且使用者將 PWA 加入主畫面才收得到——W4 的「Web Push」交付對 iOS Safari 使用者近乎無效，app push 才是 iOS 主通道。**建議：**Pro／RevenueCat 骨架整段移到 MVP 後（第 5–6 週），W4 專心 Push + 上架文件 + disclaimer。先免費 beta 驗證訊號價值，再收錢。

### I6. 商店與法務補強
- **Apple 4.2 最低功能**：純 Web 殼有被拒風險——app 端至少要有原生推播、通知設定、timeline 等原生價值。
- **5.2.1 商標**：Codex／Claude／Grok 等名稱以文字 nominative use 可行，但**不要用官方 logo**（用文字或 generic icon）；商店 metadata 與 app 內都要「非官方、不隸屬任何 AI 廠商」聲明。
- **隱私**：匿名回報若收集裝置訊號做反 Sybil，隱私政策與 Apple 隱私標示必須揭露。

### I7. 歷史回填（backfill）— 冷啟動最便宜的解法
W1/W2 應回填過去可查證的 reset 事件（兩個帳號的歷史公告都公開可考），讓 Timeline 與 drought 統計 day-1 就有內容。不回填，上線後看板長期空白（hard reset 是數週一次的低頻事件），「五格永遠灰」的廢感會在最關鍵的前幾週殺死留存。目前 PLAN 完全沒提。

### I8. Phase 2 個人層在 Web 是 CORS 死路 — 現在寫進 PLAN 以免未來違反 HARD RULE 4
瀏覽器直連 provider API 會被 CORS 擋下；到時唯一捷徑是 server proxy，而那正是 HARD RULE 4 禁止的 token 上雲。**現在就在 §7 寫明「個人層僅限 mobile app（Web 不支援）」**，把未來的自己鎖在正確的路上。

---

## Minor / Nitpicks

- **M1 來源誠實分級**：@ClaudeDevs 是官方帳號，@thsottiaux 是員工個人帳號。UI 應區分「官方帳號」vs「官方員工帳號」——這符合 PURPOSE「誠實 > 熱鬧」，也預先化解「你們說的官方其實是個人推特」的質疑。
- **M2 六格縮四格**：GLM／Antigravity 併入「其他」摺疊區，減少灰格廢感與規則卡維護面；有穩定官源再升格（PLAN §7.4 已有此精神，首屏落實它）。
- **M3 W3 drought 圖移到 W4 或 Phase 2**：W3 該把時間全花在反濫用（C2）上。
- **M4 Claude 關鍵片語 exact match 脆弱**：官方換個句式就漏報。用 fuzzy／LLM 二次分類 + 群眾黃燈觸發 admin 告警兜底（漏報可接受、誤報不可接受，所以兜底方向是「提醒人」不是「自動轉綠」）。
- **M5 schema 補欄位**：`retraction_reason`、`admin_confirmed_by`（審計用）；`announced_at` 明訂 UTC 儲存、UI 端轉本地時區。
- **M6 免費 High 推播無安靜時段**：凌晨推播是 uninstall 高風險。建議 Free 至少給「夜間免打擾」開關，細緻排程留給 Pro。
- **M7 名稱／域名**：「RESET Radar」與 codex-resets 的域名近似度、可註冊性、商標快查，W1 前 30 分鐘做完。

---

## Suggested Concrete Edits（章節錨點）

### PURPOSE.md
| 錨點 | 修改 |
|------|------|
| §3 成功表「覆蓋」列 | 「即時公開訊號」改為量化 SLO，或註明 MVP 期為半自動、時效目標另定（對齊 I4） |
| §5 RESET 定義表 | 補「事件 vs 狀態」說明：綠燈是有 TTL 的事件狀態，非永久狀態（對齊 C4） |
| §9 約束與價值觀 | 新增第 6 條「時效透明：看板永遠顯示資料新鮮度」（對齊 I1） |

### PLAN.md
| 錨點 | 修改 |
|------|------|
| §3 信心規則表 | confirmed 行改為「白名單官帳（以 X user ID）+ 片語命中 + **admin 核准**」；新增 `detected`（待確認）中間態（C1） |
| §3 新增小節 | 「狀態轉移與綠燈 TTL」：TTL、去重合併 key、likely→confirmed 升級、retracted 顯示（C4） |
| §3 Classifier | 加排除規則（RT／quote／reply／否定／疑問句）；標注 teaser 文風險（C1） |
| §4.2 元件表 | 新增：OG／meta 渲染（C5）、staleness 監控（I1）、Turnstile + attestation（C2）、Cron Trigger、admin 認證（CF Access） |
| §5 商業表 | 明訂 Free 通知通道「三選一」；Pro 移出 MVP 時同步修改（I3、I5） |
| §6 W1/W2 | 加入歷史事件回填（I7）；W1 加 OG renderer |
| §6 W3 | 反濫用規格化（N、時間窗、attestation）並標註「時程不足時整項可砍」（C2） |
| §6 W4 | 移除 RevenueCat／Pro 骨架，改列 MVP 後第 5–6 週（I5） |
| §7 Phase 2 | 個人層註明「僅 mobile，Web 因 CORS 不支援」（I8） |
| §8 風險表 | 新增三列：管線靜默失效（I1）、推文刪除／link rot（I2)、白名單帳號被盜／handle 搶註（C1） |
| §10 待決表 | 新增：admin gate 政策、綠燈 TTL、Free 通知通道、Web 付費路徑；「X 資料」列直接定案為人工＋半自動（C3） |

---

## Other Observations

- **O1 護城河誠實評估**：功能差異化（多 provider、app、推播、證據鏈）足夠起步，但可複製性高——codex-resets 加上 Claude 監聽只需一個週末。真正的壁壘是**通知時效 + 長期零假綠燈的信任紀錄 + TG 社群**。因此 I4 的時效 SLO 是產品核心而非 nice-to-have，且 admin gate 的人力瓶頸（solo、時區）是本專案最真實的營運風險。
- **O2 免費 TG 頻道會吃掉部分 Pro 動機**：TG 是最好的通知通道，免費放送等於 Pro 的「多通道」賣點自我稀釋。以獲客優先這是正確取捨，但 Pro 的長期賣點應押在「個人對照（Phase 2）+ 細緻通知控制」，不要指望多通道本身撐轉換率。
- **O3 值得肯定**：六條 HARD RULE 在 PLAN 中全數守住——零登入首屏、綠燈需來源、群眾不能單獨轉綠、token 不上雲、弱訊號 provider 誠實 Unknown、核心看板不進付費牆。「刻意不做」清單成熟，pivot 決策記錄清楚。這是高於平均水準的 greenfield 計劃；REQUEST CHANGES 的原因是綠燈可被 game（C1、C2）與五項擋路決策（C1–C5），不是方向或結構問題。
- **O4 低頻事件的留存現實**：hard reset 數週才一次，上線後「長期平靜」是常態而非異常。留存要靠「平靜也有資訊」——上次事件時間、drought 統計、規則說明——建議把這句寫進 UI 文案原則。
- **O5 實作前需線上驗證的外部事實**（本審查基於訓練期知識，未做即時查證）：X API 目前讀取定價與額度；RevenueCat Web Billing 對 Flutter Web 的現行支援方式；iOS Web Push 的 PWA 限制現況。三者任一變動都會影響 C3／I5 的具體選擇，但不改變結論方向。

---

## 結論

**REQUEST CHANGES。** 修正 C1–C5（預估半天到一天的文件工作，不涉及程式碼）後，此計劃即可進入 W1 實作。核心要求濃縮成三句：**綠燈必須過人手（C1）、黃燈必須防機器人（C2）、五個擋路決策現在拍板（C3–C5 + §10 增補）。**
