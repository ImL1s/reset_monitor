# X/Twitter 自動監控公告：2025–2026 現況研究

**研究日期：** 2026-07-20  
**目的：** 無人值守監控少數 X 帳號（例如 Codex reset 公告來源 `@thsottiaux`）的可行取數路徑，特別是 Cloudflare Workers / serverless。  
**範圍：** 僅研究；不實作 `worker/` 或 `app/` 產品碼。  
**輔助實證：** 同日本地 probe `.omc/research/2026-07-20-x-probe-local.json`

---

## TL;DR

| 路徑 | 適合 | 成本（2 帳號 / 5–15 分） | 穩定度 | ToS |
|------|------|--------------------------|--------|-----|
| **官方 X API v2 pay-per-use** | Production 合規 | 約 **$2–15/月**（視 max_results 與是否每 post 計費） | 高 | 合法 |
| **FxTwitter API v2 profile statuses** | Hobby → 半正式（有 fallback） | 免費公開；可 self-host | 中高（依賴上游 / guest token） | 技術上是非官方 scraping 代理 |
| **第三方 read API**（twitterapi.io 等） | Production 想便宜又懶管 scraper | 約 **$0.01–1/月** 級（極低量） | 中 | 第三方 ToS 風險；對 X 仍屬非官方 |
| **vxTwitter status-by-id** | 已知 tweet ID 再取全文 | 免費 | 中 | 非官方 |
| **jina.ai reader `r.jina.ai`** | 實驗 / 應急 | 免費額度 | **不可靠**（login wall / 空 timeline） | 代理爬 x.com |
| **Nitter RSS** | 自架 hobby | 自架成本 | **2026 仍 fragile** | 非官方 session |
| **直接 scrap x.com / syndication** | 不建議 | — | 差（429、空 body） | **明確禁止** |

**Production 推薦：** 官方 X API pay-per-use（或 Activity webhook 若只監控自己帳號／已授權路徑）；讀 2 個公開帳號每 5–15 分鐘在成本上可接受。  
**Hobby 推薦：** FxTwitter `GET /2/profile/{handle}/statuses?count=5&since=…` + CF Worker cron + KV 去重；準備官方 API 或付費第三方當 fallback。

---

## 1. X API v2：User timeline 與定價

### 1.1 關鍵 endpoint

官方文件：

- Timelines 總覽：https://docs.x.com/x-api/posts/timelines/introduction  
- User posts：https://docs.x.com/x-api/users/get-posts  
- Pricing：https://docs.x.com/x-api/getting-started/pricing  
- Developer console：https://console.x.com  
- Developer Policy：https://docs.x.com/developer-terms/policy  

| Method | Path | 用途 |
|--------|------|------|
| `GET` | `/2/users/:id/tweets` | 指定 user 的 posts（最多約 3200 最近） |
| `GET` | `/2/users/:id/mentions` | mentions |
| `GET` | `/2/users/:id/timelines/reverse_chronological` | **自己的** home timeline（需 user OAuth） |

**監控公開帳號公告** → 用 `GET /2/users/:id/tweets`。

實用 query 參數：

- `max_results`：5–100  
- `since_id` / `until_id`：增量  
- `start_time` / `end_time`：ISO8601  
- `exclude=retweets,replies`：只要原發  
- `tweet.fields=created_at,text,entities,…`  
- 需先用 `GET /2/users/by/username/:username` 換 user id（User: Read 計費）

Auth：Bearer（app-only）即可讀公開 timeline。  
Base：`https://api.x.com`

### 1.2 2026 定價現況（new developers）

官方與第三方彙整（2026-02 起 pay-per-use 為預設；Basic/Pro 多為 legacy 既有訂戶）：

| 資源 | 單價 |
|------|------|
| **Posts: Read** | **$0.005 / post returned** |
| **User: Read** | **$0.010 / user** |
| Post create | $0.015（含 URL 則 $0.20） |
| **Owned Reads**（自己帳號資料） | $0.001 / resource（**不適用**於讀別人 timeline） |
| 月 cap | **2M post reads**（再高走 Enterprise） |
| 去重 | 同一 resource 在 **24h UTC** 內多數只收一次 |

來源：

- https://docs.x.com/x-api/getting-started/pricing  
- https://docs.x.com/x-api/getting-started/about-x-api  
- https://postproxy.dev/blog/x-api-pricing-2026/  
- https://developer.x.com/（產品頁亦標 Posts: Read $0.005）

Free tier：新開發者實質上不可用（僅個案「for-good」）；既有 free 曾遷移到 pay-per-use + 一次性 voucher（第三方報導）。

Streaming / filtered stream：歷史上屬 Pro/Enterprise 能力；pay-per-use 文件強調 credit 模型，**低量輪詢 timeline 不需 stream**。

### 1.3 成本模型：2 accounts，每 5–15 分鐘

假設：

- 帳號 A、B（例如 `@thsottiaux` + 備援）
- Cron：每 **10 分鐘** → 6 次/小時 × 24 × 30 ≈ **4,320 輪/月**
- 每輪每帳 `max_results=5`（或 10）
- 使用 `since_id`；多數回應 **0 則新 post**（仍可能回最近 posts 視 API 行為——實務應確認空結果是否計 0）

**悲觀計費（每次都回 5 posts 且不去重）：**

```
2 accounts × 5 posts × 4,320 polls × $0.005
= 43,200 post-reads × $0.005
= $216 / 月
```

**樂觀（24h 去重生效 + 多數輪無新帖、只收「已見過」的 0 次或 1 次）：**

- 若每輪 API 仍回 5 條但同一 id 24h 只收費一次：  
  每帳每天最多收 5 次 post 費 ≈ 5 × $0.005 × 2 × 30 = **$1.50/月**  
- 另加 username→id 查詢：2 × $0.01 一次（可 cache 永久）≈ 可忽略  
- 若只有新帖才出現在計費結果：兩帳號假設每月各 30 則公告 → 60 × $0.005 = **$0.30/月**

**實務建議：**

1. 永久 cache `user_id`（避免反覆 User: Read）。  
2. 一律 `since_id` + 小 `max_results`（5）。  
3. 在 Developer Console 設 **spending limit** + auto-recharge 門檻。  
4. 每 15 分鐘比每 5 分鐘省 3× 輪詢；對「人工發公告」通常 10–15 分延遲可接受。

**Activity API / webhooks：** `post.create` 事件 **$0.005/event**，但主要綁訂閱規則／授權範圍；**讀任意第三方公開帳號** 仍以 timeline poll 最直觀。勿把 Owned Reads ($0.001) 誤套在別人的 `/users/{id}/tweets`。

### 1.4 Serverless 適配

- CF Worker cron triggers：`*/10 * * * *` 等。  
- Secrets：Bearer token。  
- 狀態：KV / D1 存 `last_seen_id`、user_id map。  
- 無需 headless browser。

---

## 2. FxTwitter / FixTweet / vxTwitter

### 2.1 FxEmbed / FxTwitter（最強非官方選項）

- 專案：https://github.com/FxEmbed/FxEmbed  
- 文件：https://docs.fxembed.com/  
- API overview：https://docs.fxembed.com/api/introduction/  
- OpenAPI：https://api.fxtwitter.com/2/openapi.json  
- 別名：`fxtwitter.com`、`fixupx.com`（embed 域名）

**Base：** `https://api.fxtwitter.com`

| Endpoint | 用途 |
|----------|------|
| `GET /2/status/{id}` | 依 snowflake 取單帖 |
| `GET /2/profile/{handle}/statuses` | **使用者 timeline（監控用）** |
| `GET /2/profile/{handle}` | profile |
| `GET /2/thread/{id}`、`/2/conversation/{id}` | 串文 |
| `GET /2/search` | 搜尋 |
| Legacy | `/:screen_name/status/:id` 仍可用但不完整 |

**Timeline 參數（文件）：**

```http
GET https://api.fxtwitter.com/2/profile/thsottiaux/statuses?count=5
GET https://api.fxtwitter.com/2/profile/thsottiaux/statuses?count=5&since=<unix>
```

- `count`：1–100，預設 20  
- `cursor`：分頁  
- `since`：無新帖可回 **204**（適合 cron 省解析）  
- `with_replies`、`groupthreads`、`lang`  
- 回應含 `results[].id`、`text`、`created_timestamp`、`cursor`

**Rate limit（公開 API v2）：** 約 **1000 req/min/IP**（文件宣稱；可 self-host 若需更高）。

**Self-host：** https://docs.fxembed.com/deployment/（MIT）

**本地 probe 補充（legacy）：**

- `https://api.fxtwitter.com/thsottiaux` → **200**，僅 **user profile**，**無 status_ids**  
- 監控必須打 **`/2/profile/{handle}/statuses`**，不要只用舊版 user path

**歷史：** 2023 年因 Twitter API 變更多次中斷（例：FixTweet issue #333）；2026 仍在維護且文件完整，但屬 **guest/session 抓取 X 非公開 API 的封裝**，隨時可能壞。

### 2.2 vxTwitter / BetterTwitFix

- 專案：https://github.com/dylanpdx/BetterTwitFix  
- Embed：`vxtwitter.com` / `fixvx.com`  
- Status API：`https://api.vxtwitter.com/{user}/status/{id}`  
- 文件：https://github.com/dylanpdx/BetterTwitFix/blob/main/api.md  

**能力：** 強項是 **已知 status ID → JSON**（text、media、metrics）。  
**弱點：** 沒有與 FxTwitter v2 同級的「正式 timeline poll + since」文件；本地 probe 對 `api.vxtwitter.com/thsottiaux` 只拿到 **profile**，無 recent status list。

**角色定位：** 在已有 ID 後取詳情 / media；**不適合單獨當 timeline 監控主路徑**。

### 2.3 與 CF Workers

兩者皆為簡單 HTTPS GET + JSON → Worker 友好。  
風險：公開 instance 被濫用、IP 封鎖、上游 X 變更。Production 應 **self-host FxEmbed** 或 **官方 API fallback**。

---

## 3. jina.ai Reader 讀 x.com profile

### 3.1 用法

```http
GET https://r.jina.ai/https://x.com/thsottiaux
GET https://r.jina.ai/http://x.com/thsottiaux
```

文件：https://jina.ai/（`r.jina.ai` URL reader）

### 3.2 可靠度（2024–2026）

| 現象 | 證據 |
|------|------|
| Login wall | GitHub jina-ai/reader#145：回傳 “Don’t miss what’s happening / People on X…” |
| 偶可拿到 status ID | 本地 probe：`r.jina.ai/http://x.com/thsottiaux` **HTTP 200**，從 markdown **抽出數個 status_ids**（含重複、偏舊 ID） |
| 另一帳號失敗 | 同 probe：`ClaudeDevs` **status_ids 空**，僅 shell 頁 |
| 代理生態 | Agent-Reach 等仍建議 cookie + `twitter-cli` 做 timeline，**不把 jina 當主讀取** |

**結論：** jina 讀 **單一 status URL** 有時可用；讀 **profile 當 recent ID 來源不可靠**——login wall、SSR 空洞、ID 重複/陳舊。  
**不建議** 作 CF Worker 的 production 主源；最多作 tertiary 實驗 fallback。

社群 skill 例：用 jina 讀 **單帖** markdown（https://mcpmarket.com/tools/skills/twitter-reader-1）——前提是已知 permalink。

---

## 4. Nitter RSS（2026）

### 4.1 專案狀態

- 上游：https://github.com/zedeus/nitter（仍活躍；wiki Instances 2026-07 仍有編修）  
- 重要變更：需 **真實帳號 session tokens**（Twitter 拔掉舊 guest 路徑）  
  見 README note + https://github.com/zedeus/nitter/wiki/Creating-session-tokens  
- 功能：HTML 前端 + **`/{user}/rss`**  
- 實例列表：https://github.com/zedeus/nitter/wiki/Instances  
- 狀態儀表（社群）：https://status.d420.de/

### 4.2 可靠度判斷

| 事實 | 含義 |
|------|------|
| 2024 曾「官方死」／大量實例掛掉 | 公有 RSS 不能當 SLA |
| 2026-03 NewsBlur 討論：有人「又用得起來」，仍 hit-and-miss | https://forum.newsblur.com/t/twitter-rss-solution/13529 |
| 自架需維護 session、Redis/Valkey、被 X 封 token | 運維負擔高 |
| Discussion：RSS ≈ 載入 profile；低頻可接受 | https://github.com/zedeus/nitter/discussions/1294 |

**結論：**  
- **Public Nitter RSS：** 不適合 production CF Worker 單點依賴。  
- **Self-hosted Nitter + 自己的 session：** hobby 可行，但 session 輪換與 ToS 風險仍在。  
- 2026 整體：**fragile, not dead**——有人用，沒人能保證。

---

## 5. Open-source「Codex reset tracker」與取數方式

### 5.1 重要區分

社群「codex reset」工具 **絕大多數讀 OpenAI/Codex 後端用量**，**不是** 爬 X 上的 reset 公告。

| 專案 | 取數方式 | 與 X 的關係 |
|------|----------|-------------|
| [jordan-edai/codex-reset-watcher](https://github.com/jordan-edai/codex-reset-watcher) | 本地 `~/.codex/auth.json` → `GET https://chatgpt.com/backend-api/wham/usage` + `…/rate-limit-reset-credits` | **無 X** |
| [drmajsai/check-codex-resets](https://github.com/drmajsai/check-codex-resets) | 同上，bash+stdlib Python 包一層 | **無 X** |
| 其他 `codex-usage` / SessionWatcher 類 | CLI / 本地 auth 或付費桌面 | **無 X** |

### 5.2 真正「監控 X 上 reset 公告」的需求

- CodexBar feature idea：poll **@thsottiaux** 的 upcoming limit resets  
  https://github.com/steipete/CodexBar/issues/1103（closed as not planned）  
- 社群認知：reset 常由 **Tibo (@thsottiaux)** 在 X 宣布（例：  
  https://x.com/thsottiaux 、  
  https://community.openai.com/t/codex-rate-limits-reset-incoming/1381065 ）  
- Reddit 有人半開玩笑：`systemctl` + X API webhook 盯 Tibo  

**現況：沒有成熟的「開源 codex-reset-twitter-poller」成為標準實作。**  
若要做，取數層會落在本文件 §1–2 的路徑；解析層則關鍵字：`reset`、`usage limits`、`banked`、`Codex` 等。

### 5.3 通用 X monitor 參考（非 Codex）

- https://github.com/Desearch-ai/x-monitor — poll 固定帳號/關鍵字 → Discord（具體後端需看 repo 是否用官方或第三方 API）  
- 商業替代：https://twitterapi.io/（pay-as-you-go ~$0.15/1k tweets；stream 方案 $29+/mo）

---

## 6. 法律 / ToS 風險（尤其 CF Workers 上的非官方爬蟲）

### 6.1 X 明文禁止

**Terms of Service**（Effective 2026-04-10）：https://x.com/tos  

> crawling or scraping the Services in any form, for any purpose without our prior written consent is expressly prohibited  

另有 liquidated damages 條款：24h 內請求/檢視 >1M posts → 約 **$15,000 / 1M posts**（美）／€15,000（歐）等——針對大規模濫用，但顯示執法姿態。

**Developer Policy：** https://docs.x.com/developer-terms/policy  

- 必須走提供的 API 介面與條款  
- 禁止規避 rate limit、干擾服務  
- 自動化寫入另受 Automation Rules 約束  

### 6.2 對各路徑的風險分級

| 做法 | 風險 | 說明 |
|------|------|------|
| 官方 X API + 核准 use case | **低** | 合規；費用可預期 |
| 付費第三方「X data API」 | **中** | 對你可能「合法訂閱」；上游仍可能違 X ToS；供應商可消失 |
| 呼叫公開 FxTwitter/vxTwitter | **中–高** | 你自己不一定直接 scrap x.com，但依賴違 ToS 的 upstream；production 品牌風險 |
| Worker 直連 x.com HTML / guest API / syndication | **高** | 直接違反 ToS；易 429；IP 被封 |
| 自架 Nitter + 偷來的 session | **高** | 帳號 ban + ToS |
| jina 代理讀 x.com | **中–高** | 仍是自動化抓取 X 頁面 |

### 6.3 CF Workers 特別注意

1. **共用 egress IP：** 攻擊性爬蟲會連累同區其他使用者的成功率；官方 API 較穩。  
2. **Cloudflare 自身 ToS：** 勿用 Workers 進行明顯違約／濫用第三方服務的大規模爬取（視具體條款與 abuse）。  
3. **Production 建議：** 合規路徑優先；非官方僅 hobby 或 short-term，並實作 **熔斷 + 多源 fallback + 明確錯誤告警**。  
4. **不要** 在 production 用 cookie/session 模擬登入 X。  

*本節非法律意見；上線前若有商業曝光應自行諮詢律師。*

---

## 7. 歷史上「什麼有效過」

| 時期 | 做法 | 結果 |
|------|------|------|
| 2022 前 | 官方 free API + `user_timeline` | 廣泛可用 |
| 2023 | API 收費、v1.1 讀取縮限 | 大量 bot/RSS 掛掉 |
| 2023–24 | Nitter 公實例潮起潮落 | 「官方死」→ 部分復活但要 session |
| 2023–26 | FxTwitter/vxTwitter embed 生態 | Discord 主流；API 逐漸產品化（Fx v2） |
| 2024–26 | jina/reader 讀 X | 常 login wall |
| 2026 | X pay-per-use $0.005/read | 低量監控重新變「付得起」 |
| 2026 | syndication.twitter.com timeline | probe：429 / 空 body |

---

## 8. 推薦架構

### 8.1 Production path（推薦）

```
CF Worker Cron (every 10–15 min)
  → X API GET /2/users/:id/tweets?since_id=…&max_results=5&exclude=retweets,replies
  → KV: last_seen_id per account
  → filter keywords (reset / usage limits / …)
  → notify (Telegram / Discord / email / queue)
```

**為什麼：**

- ToS 清晰  
- 2 帳號成本可壓到數美元/月甚至更低（去重 + 低流量）  
- 無 headless  
- 文件與 SDK 完整  

**Checklist：**

1. https://console.x.com 建立 app、買 credits、設 spending limit  
2. 寫清 use case（account monitoring / alerting）  
3. Cache user ids  
4. 監控 credit balance（Usage endpoint）  

**可選升級：** 若日後要「近即時」且量更大，評估 filtered stream（歷史上 Pro/Enterprise）或第三方 webhook stream（接受供應商風險）。

### 8.2 Hobby path（推薦）

```
CF Worker Cron
  → primary: GET https://api.fxtwitter.com/2/profile/{handle}/statuses?count=5&since={last_ts}
  → on 5xx/timeout: fallback B (optional self-hosted FxEmbed or twitterapi.io)
  → never hard-depend on jina or public nitter alone
  → KV dedupe by status id
  → keyword filter → notify
```

**進階 hobby：** Docker 自架 FxEmbed 或 Nitter，Worker 只打你自己的 origin。

### 8.3 不建議

- 單一依賴 `r.jina.ai/x.com/profile`  
- 單一依賴隨機 Nitter 公實例 RSS  
- Worker 直接解析 x.com HTML  
- syndication timeline（2026 probe 失效）  
- 把「讀 Codex `/wham/usage`」與「讀 X 公告」混成同一 source（兩者互補，不是替代）

### 8.4 針對 reset_monitor 的產品意涵

| 需求 | Source |
|------|--------|
| 我的 banked reset / weekly % | Codex auth → `chatgpt.com/backend-api/wham/*`（見 codex-reset-watcher） |
| 全站/慶祝型「大家一起 reset」公告 | **X 上 @thsottiaux（+ 備援帳）** |
| 兩者合併 | 雙 pipeline；X 側用 §8.1 或 §8.2 |

---

## 9. 具體 URL 速查

| 資源 | URL |
|------|-----|
| X API timelines | https://docs.x.com/x-api/posts/timelines/introduction |
| GET user posts | https://docs.x.com/x-api/users/get-posts |
| X API pricing | https://docs.x.com/x-api/getting-started/pricing |
| X Developer Policy | https://docs.x.com/developer-terms/policy |
| X ToS | https://x.com/tos |
| FxEmbed docs | https://docs.fxembed.com/ |
| FxTwitter statuses | https://docs.fxembed.com/api/twitter/operations/2profilehandlestatuses/ |
| FxTwitter status by id | https://docs.fxembed.com/api/twitter/operations/2statusid/ |
| FxEmbed GitHub | https://github.com/FxEmbed/FxEmbed |
| vxTwitter API | https://github.com/dylanpdx/BetterTwitFix#api |
| Nitter | https://github.com/zedeus/nitter |
| Nitter instances | https://github.com/zedeus/nitter/wiki/Instances |
| Jina reader | https://r.jina.ai/https://example.com |
| Codex Reset Watcher | https://github.com/jordan-edai/codex-reset-watcher |
| check-codex-resets | https://github.com/drmajsai/check-codex-resets |
| CodexBar X poll idea | https://github.com/steipete/CodexBar/issues/1103 |
| Pricing 第三方解讀 | https://postproxy.dev/blog/x-api-pricing-2026/ |
| twitterapi.io | https://twitterapi.io/ |
| 本地 probe | `.omc/research/2026-07-20-x-probe-local.json` |

---

## 10. 開放問題 / 實作前應再驗證

1. **官方 API：** 當 `since_id` 之後無新帖時，回應 `data` 是否為空、是否仍計 Posts: Read（影響成本上限）。  
2. **FxTwitter `/2/profile/…/statuses`：** 對 `@thsottiaux` 的實際 latency、204 `since` 行為、從 CF 出口 IP 的成功率（建議 staging 連打 24–48h）。  
3. **公告語意：** Tibo 文案是否穩定含 “reset” 等詞；是否需要 LLM 分類假陽性。  
4. **備援帳號：** 除 `@thsottiaux` 外是否還有 OpenAI 官方帳同步宣布。  

---

## 11. 建議決策（給 reset_monitor）

| 階段 | 決策 |
|------|------|
| **MVP hobby** | FxTwitter v2 `profile/statuses` + Worker cron 10–15m + KV；關鍵字過濾 |
| **正式 / 對外** | 官方 X API pay-per-use 為 primary；FxTwitter 可作 soft fallback |
| **用量面板** | 繼續走 Codex `wham` endpoints（與 X 無關） |
| **明確不做** | jina-primary、公有 Nitter-primary、直 scrap x.com |

---

*研究完成。僅寫入 `.omc/research/`；未修改 `worker/` 或 `app/`。*
