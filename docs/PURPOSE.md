# 專案目的（Purpose）

> 狀態：2026-07-21 **v3.1**（free-auto 落地 + improve 001–016；契約見 api-v1-snapshot）  
> 產品暫名：**RESET Radar**（可改）  
> Repo：`reset_monitor`  
> 審查：dual-review + `docs/FULL_AUDIT.md`

---

## 1. 我為什麼要做這個

AI coding 時代，開發者同時訂閱多個工具（Codex / Claude / Grok / Antigravity / Kimi / GLM…）。  
最痛的不是「不會用」，而是：

1. **撞上 usage limit** 時不知道還要等多久  
2. 更常發生的是：**官方突然全站 RESET（補額）**——只有一直刷 X / 朋友群才知道  
3. 現有工具要**登入、裝桌面、貼 token**，摩擦太大  
4. 我想要：**打開 App / 網頁，立刻知道「有沒有 RESET」——不用 Auth**

這是個人痛點，也是明確的市場空位。

---

## 2. 核心目的（一句話）

**做一個零登入的「有沒有公開 RESET」雷達：以 Codex + Claude 的可稽核全站／半官方補額事件為核心，打開就看；個人用量是可選第二層（僅 mobile）。**

> MVP **不追求**比 codex-resets.com 更快的 Codex 時效（free-auto 仍可能慢於競品；差異在可稽核雙源與假綠防護）。  
> 可防守差異 = **證據鏈、雙源（+Claude）、來源健康、撤回、fail-closed**——不是速度軍備賽。

---

## 3. 成功長什麼樣子

| 指標 | 定義 |
|------|------|
| **North Star** | 零登入用戶在 **10 秒內**正確回答：「現在哪家處於高信心 RESET（且仍在顯示期內）？」——「正確」必須可對照 published event + evidence |
| 產品體驗 | 首屏**無登入牆**；狀態 + 上次時間 + 可選 48h 啟發式 + 來源 + **資料截至時間** |
| 訊號品質 | 綠燈 = 嚴格模板（+ 可選 LLM）**自動確認**且有來源；**假綠燈 = 最高嚴重度事故**；admin 僅緊急撤回 |
| 來源健康 | 來源逾 freshness SLA → 顯示 **來源中斷／未知**，**不得**顯示「平靜」 |
| 覆蓋 | MVP：**Codex + Claude** 即時監測；其餘誠實 Unknown／規則說明 |
| 通知 | **Confirmed** 事件走 **1 路 Free 通道**（MVP：Telegram）；High ≡ confirmed |
| 盈利（小利潤） | Free 看板養信任；Pro **延後**到訊號與留存有證據後（便利性，不賣較低信心） |

**不是**成功指標：追上 CodexBar 63 providers、個人 % 精度、精準預測下次 staff 按鍵時間。  
48h 啟發式是**輔助第三軸**（可解釋統計），不是 North Star；假綠燈仍是最高嚴重度事故。

---

## 4. 明確「要」與「不要」

### 要

- 公開 **Global / Hard RESET** 與 **Banked 公告** 的雷達  
- 證據鏈、信心等級、**綠燈 TTL**、來源健康度  
- Flutter：**Web 優先**；iOS/Android 可同 repo 殼，商店 beta 可後置  
- Freemium 架構預留；**MVP 可不收費**  
- 可選後期：群眾回報（必須防 Sybil 才上）  
- 可選 Phase 2：個人 OAuth／**官方允許的 API**（**僅 mobile**）

### 不要

- 首屏要求登入任何 AI 帳號  
- Token／session 上傳伺服器代查  
- WebView 抓 session／鼓勵貼 session token  
- 關鍵字命中即自動綠燈  
- 與 CodexBar 搶桌面 menu bar  
- 弱訊號 provider 假綠燈  
- Auto-Wake／代發訊息  
- 宣稱官方附屬或可繞過 limit  

---

## 5. 「RESET」在本專案的定義

| 類型 | 定義 | 首屏角色 |
|------|------|----------|
| **Hard RESET（Global Blessing）** | 官方對大量付費用戶同步補額 | 主事件；綠燈有 **TTL**（預設 24h，可調） |
| **Banked 公告** | 官方發放可自行兌換的重置券 | 分標籤；**不**等同帳號已自動補滿；資料欄 `claim_url` / `claim_note` 可知則填 |
| **Scheduled window** | 個人 5h／週滾動窗 | 只做規則說明 |
| **Personal** | 只有你的帳號 | Phase 2 mobile only |
| **Detected / 待確認** | 官帳片語命中、未達自動綠燈門檻 | 黃燈「偵測到，待確認」 |
| **Rumor / cluster** | 群眾回報 | 最多黃燈調查中；永不單獨轉綠 |

> **綠燈 =「最近一個已確認事件仍在 display_until 內」**，不是永久狀態，也**不保證**你的個人帳號此刻一定有額度。

---

## 6. 目標用戶

1. 同時用 Codex + Claude 的 AI coder  
2. 不在電腦前也想知道有沒有又放了  
3. 願意訂閱 Telegram／推播的人  
4. 非目標：只要本機 JSONL 成本報表的 CLI 用戶  

---

## 7. 與競品的目的差異

| 產品 | 他們的目的 | 我們的目的 |
|------|------------|------------|
| codex-resets.com | 只盯 Codex／Tibo | 多平台 + **可稽核證據鏈** + 來源健康 + 快速撤回 + App／推播 |
| CodexBar | 桌面個人 % | **公開事件**，離桌可用 |
| Limits / AI Usage | 個人 usage | 零 Auth 雷達為主 |

定位句：

> **桌面看 CodexBar；出門看 RESET Radar。**  
> **打開就知道有沒有 RESET，不用登入。**  
> **寧可 Unknown，不要假綠燈。**

可防守差異：**可稽核證據鏈、來源健康透明、fail-closed、快速更正**——不是「又多一個網頁」。

---

## 8. 商業目的（小盈利，非 VC）

| 層 | 內容 |
|----|------|
| **Free（MVP 必備）** | 完整 Board + Evidence + 近期 Timeline；**1 路通知 = Telegram**（僅 High／confirmed） |
| **Pro（MVP 後）** | 多通道、安靜時段、較長歷史、iCal／匯出、可選個人對照；**不賣較低信心內容** |
| 廣告 | 可選輕贊助；警報當下不插全屏 |

**硬規則：即時「有沒有 RESET」不進付費牆。**

---

## 9. 約束與價值觀

1. **誠實 > 熱鬧**：Unknown 優於假綠燈  
2. **隱私**：公開層零憑證；個人層本機優先、僅合規 OAuth／API  
3. **可追溯**：每則 confirmed 有來源 URL + 快照（防 link rot）  
4. **Fail-closed**：來源失效 → 中斷／未知，**不是**平靜  
5. **時效透明**：看板永遠顯示資料新鮮度（as_of）  
6. **互補不樹敵**  
7. **先訊號後功能**：Codex + Claude 做深  

---

## 10. 決策記錄

| 項目 | 決定 |
|------|------|
| 首要 UX | 零 Auth 公開雷達 |
| 客戶端 | Flutter；**MVP Web first** |
| 商業 | Freemium 架構；**MVP 可不啟 Pro** |
| 綠燈（full-auto parity 2026-07-20；usage-reset 模板 2026-07-22） | **嚴格模板自動 confirm**（`decision_by=auto_rules`，FxTwitter v2 + Dayclaw fallback cron）；可選 LLM gate；admin 僅緊急撤回。歷史 corpus ≥85% 覆蓋；teaser / hedge / negation fixture 必須 reject；`excluded_context` 可在模板擴充後 requeue。Stats：total / days_since / avg / drought |
| X 資料（MVP） | **Free-auto**（FxTwitter／Dayclaw 輪詢）+ 嚴格規則／LLM 閘（信任閘；非爬蟲農場） |
| 監測心跳 | **Admin heartbeat** 更新 freshness；≠「有無新推文」 |
| Free 通知 | **Telegram** |
| 個人層 | Phase 2；**僅 mobile**；禁 WebView 抓 session |
| 時效定位 | **不**以快過 codex-resets 為成功標準 |

---

## 11. 給協作者的一句話

若功能無法回答「**這有助於零登入用戶更快、更準、更可信地知道有沒有公開 RESET 嗎？**」——預設不做。
