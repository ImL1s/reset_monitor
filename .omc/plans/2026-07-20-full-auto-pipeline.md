# Full-Auto RESET Pipeline Plan

> 日期：2026-07-20  
> 狀態：**計畫 only（未實作）**  
> 範圍：僅 worker 後端自動偵測／自動發綠；不改 Flutter UI 為必須項  
> 對齊現況：`worker/src/{store,status,index,persist,app,notify}.ts`、`docs/{PLAN,PURPOSE,api-v1-snapshot}.md`  
> 探測證據：`.omc/research/2026-07-20-x-probe-local.json`  
> 可行性探索：`.omc/research/2026-07-20-auto-pipeline-explore.md`（GO-with-caveats, conf ~72）  
> 源現況研究：`.omc/research/2026-07-20-x-source-web-research.md`（X PPU + FxTwitter v2 timeline）

---

## Executive Summary

### 能不能「沒有人」就上線？

**分兩層回答：**

| Layer | 含義 | 可否無人類 |
|-------|------|------------|
| **L1 Auto-fetch / ingest** | cron 發現白名單官帳新帖 → Raw + Candidate | **是** — 便宜、Worker-native、與 PLAN Phase 1.5 一致 |
| **L2 Auto-publish 綠燈** | Candidate → confirmed 無人工 | **有條件是** — 必須 **遠嚴於** 現有 `classify*` 命中；且產品文件需改 HARD RULE |
| **L3 全自動運維** | 含 health、retract、規則進化 | **否** — retract／假綠補救／規則版本仍需人 |

**對「FULLY AUTOMATIC green lights」：**  
可 ship，但 **不是**「把現有 classify 結果直接 confirm」。  
必須是：**X API 主幹 poll → ingest → 獨立 `AutoPublishGate`（closed phrase templates）→ 可選 confirm**；預設 rollout 先 L1 再 L2。

這會**偏離** PURPOSE/PLAN v3「綠燈必須 admin 核准」；上線前需接受：

| 可接受 | 不可接受 |
|--------|----------|
| 偶發漏抓（假陰性 → 白燈） | 假綠燈當 P0（規則收斂 + **人工** retract） |
| 時效 5–15 分鐘（cron） | 免費爬蟲 sole source 卻宣稱官源可靠 |
| Admin 只做緊急 override | Auto-retract、關鍵字 alone、群眾轉綠、LLM 直綠 |

**Verdict：** **GO-with-caveats**。  
先自信 ship **L1**；**L2** 僅 `AUTO_PUBLISH=1` opt-in，fixture 證明 0 假綠後再開。

### 單一推薦設計（Ship this）

```
Cron */10 * * * *  (steady 可 */5；成本與延遲折衷先 10)
  → SourceFetchLayer
       PRIMARY: X API v2 GET /2/users/:id/tweets
                (since_id + max_results=5 + exclude=replies,retweets)
       FALLBACK discovery: FxTwitter v2 GET /2/profile/{handle}/statuses
                （舊 /{user} 只有 profile——本地 probe 已證）
       TERTIARY: jina profile id 抽樣 → fxtwitter/vx status hydrate
       規則: 無 X bearer 時强制 AUTO_PUBLISH 有效=0；
             L2 綠僅接受 source_adapter=x_api_v2
  → FetchedPost[]  {thsottiaux→codex, ClaudeDevs→claude}
  → MemoryStore.ingest
  → flags:
       AUTO_PUBLISH=0 → pending_review (L1 黃) 或 reject noise
       AUTO_PUBLISH=1 → AutoPublishGate (STRICT ≠ classify hits)
            PASS → confirm(decision_by="auto_rules") + notify
            FAIL → reject（不公開黃）
  → poll 成功 per provider → touchHeartbeat
  → saveStoreToKv + cursors + lock
```

**一句話：**  
cron 拉白名單 timeline 取代「人貼 URL」；**獨立 strict gate** 在 flag 開啟時取代「人按 confirm」；**retract / kill switch 永遠留給人**。

**日常運維？** 0 人。  
**永久無人？** 不行——假綠、文案變體、帳號被盜、token 失效仍需人。

---

## 0. 現況基線（Explore 結論）

| 元件 | 現況 | Full-auto 缺口 |
|------|------|----------------|
| Ingest | allowlist handle、post_id 去重、classify、autoReject teaser/RT/reply | 無外部 fetch |
| Confirm | admin HTTP；`decision_by` 預設 `admin@local` | 無 auto path |
| Classify | Codex 有 teaser/negation；**Claude 幾乎無 teaser 層** | **不得** `hits>0` 直綠 |
| Snapshot | 雙軸 OK；pending → 黃 | L2 下 public pending 近乎消失 |
| Heartbeat | 人打或 ingest/confirm | 成功 poll 必須更新 |
| Persist | KV `store_v1` | Cron 也要 save |
| Cron | **無** | 必須新增 |
| Notify | confirm 後 stub | auto 同路 |
| Admin | 全套 write | 降為 emergency |
| D1 | migration 有、runtime 未用 | 非 blocker |
| 源探測 | 舊 fxtwitter user **無 tweets**；jina 部分 id；syndication 429 | X API primary；**Fx v2 timeline 可作 L1 fallback** |

**真實 user id：**

| Handle | X user id | Provider | authority |
|--------|-----------|----------|-----------|
| `thsottiaux` | `1953337039510003712` | codex | staff |
| `ClaudeDevs` | `2024518793679294464` | claude | official_product |

改掉 synthetic `xuid_*_mvp`。

**已證假綠近失：** `fixtures/codex-teaser-should-we-reset.json` — 弱化 teaser 排除 = P0。

**競品注意：** 部分 “codex reset watcher” 讀的是 ChatGPT `/wham/usage`（個人／banked 維度），**不是** X 公告雷達；本產品仍以 @thsottiaux / @ClaudeDevs 為準。

---

## 1. Source fetch layer

### 1.1 介面（`worker/src/sources/types.ts`）

```ts
export interface FetchedPost {
  platform: "x";
  author_handle: string;
  author_user_id: string;
  post_id: string;
  url: string;
  raw_text: string;
  created_at?: string;
  is_reply: boolean;
  is_quote: boolean;
  is_retweet: boolean;
  fetched_at: string;
  source_adapter: string; // "x_api_v2" | "fxtwitter_v2" | "fxtwitter_status" | "jina_profile"
}

export interface SourceFetchResult {
  adapter: string;
  ok: boolean;
  posts: FetchedPost[];
  error?: string;
  fetched_at: string;
}

export interface SourceAdapter {
  readonly name: string;
  fetchTimeline(handle: string, userId: string, opts: {
    sinceId?: string;
    maxResults?: number;
  }): Promise<SourceFetchResult>;
}
```

### 1.2 Adapter 優先序

| Priority | Adapter | Endpoint / 條件 | 角色 |
|----------|---------|-----------------|------|
| **P0** | `XApiV2UserTimeline` | `GET https://api.x.com/2/users/:id/tweets?max_results=5&since_id=…&exclude=replies,retweets&tweet.fields=created_at,text,referenced_tweets` + `X_BEARER_TOKEN` | **Production discovery**；**唯一**允許驅動 `AUTO_PUBLISH=1` |
| **P1** | `FxTwitterV2ProfileStatuses` | `GET https://api.fxtwitter.com/2/profile/{handle}/statuses?count=5&since=…`（docs.fxembed.com；可 204） | **L1 hobby / X 失敗時 discovery**；ToS 灰區；**不得** L2 sole green |
| **P2** | `FxTwitterStatus` / vxTwitter | `/status/:id` 或 vxtwitter status | 已知 id hydrate／刪文檢查 |
| **P3** | `JinaProfileReader` | `r.jina.ai/http://x.com/{handle}` | 嘈雜；Claude 常空；tertiary only |
| **P4** | Nitter RSS / syndication | 預設關 | fragile；X ToS 禁 scrape |

> 本地 probe 的 `api.fxtwitter.com/{user}`（無 `/2/profile/.../statuses`）= **profile only**，不要當 timeline。

**Waterfall：**

```
if X_BEARER_TOKEN:
  try P0
  on HTTP 2xx → poll_ok (even 0 new posts)
  on fail → try P1 (L1 only) then P3/P2
else:
  effective_AUTO_PUBLISH = 0   // hard
  try P1 → P3/P2 for candidate-only
if all adapters fail for provider:
  do NOT touchHeartbeat(provider)
  never auto-confirm
```

**硬規則：**

- 只監控 2 個 **user id**；永不全站 search  
- 回傳 author id 必須 ∈ allowlist  
- `AUTO_PUBLISH=1` 且 `passesAutoGate` → 要求 `source_adapter === "x_api_v2"`  
- user id 永久 cache（避免反覆 User: Read $0.01）  
- Developer Console 設 **spending limit**  

### 1.3 白名單

```ts
export const MONITORED_AUTHORS = [
  {
    handle: "thsottiaux",
    userId: "1953337039510003712",
    providers: ["codex"] as const,
    grade: "staff" as const,
  },
  {
    handle: "claudedevs",
    userId: "2024518793679294464",
    providers: ["claude"] as const,
    grade: "official_product" as const,
  },
] as const;
```

### 1.4 成本 / rate（務必讀）

| 情境 | 估算 |
|------|------|
| X PPU 樂觀（24h resource dedup + since_id + max=5） | 約 **$1–5/月** 級（對齊 FULL_AUDIT） |
| X PPU 悲觀（每 10min 兩帳各回 5 posts 全計費、無有效 dedup） | 可到 **~$100+/月** 量級 — **必須** since_id + spending cap |
| Owned Reads $0.001 | **不適用** 讀別人 timeline |
| Fx v2 profile statuses | $0；~1000 req/min/IP（第三方）；不穩則降級 |
| Cron | 建議 **10–15 min** rollout；公告場景不需 1 min |

**實務：**

1. `since_id` 必存 KV  
2. `max_results=5`  
3. 永久 cache user id  
4. 監控每月 credit；異常尖刺 → 降 cron 或停 AUTO_FETCH  

### 1.5 Cursor / meta

```ts
{
  codex:  { since_id?, last_poll_at, last_adapter, last_error, consecutive_failures },
  claude: { ... }
}
```

Cold start：N=5–10；既有 post_id → ingest dedupe。

### 1.6 檔案落點

```
worker/src/sources/
  types.ts
  x_api_v2.ts
  fxtwitter_v2.ts      # /2/profile/{handle}/statuses
  fxtwitter_status.ts  # single status hydrate
  jina_profile.ts
  index.ts
worker/src/pipeline/
  run_cycle.ts
  auto_publish.ts      # STRICT gate
  flags.ts
```

---

## 2. Ingest → classify → auto-publish

### 2.1 流程

```
FetchedPost
  → map provider
  → store.ingest(...)
  → duplicate → skip
  → rejected → done
  → pending_review:
       !AUTO_PUBLISH → leave pending (L1 黃)
       AUTO_PUBLISH && passesAutoGate → confirm(auto_rules) + notify
       else → reject("auto_not_eligible")
```

### 2.2 為何不能 classify 直通

`classifyCodexText` 任一弱片語（如單獨 `hard reset`）即可 `!excluded`。  
PURPOSE 禁「關鍵字命中即自動綠燈」。

→ **`passesAutoGate` = 獨立 closed template 集合。**  
`classify*` 只服務預填 / 黃燈 / admin。

### 2.3 `passesAutoGate`（全部 AND）

1. flags：`MONITORING_ENABLED` + `AUTO_PUBLISH`  
2. `source_adapter === "x_api_v2"`  
3. allowlist user id + provider map  
4. `!is_reply && !is_retweet && !is_quote`  
5. **Closed templates：**

**Codex auto_confirm：**

- `reset usage limits` **且** (`for all paid` | `all paid users` | `chatgpt work and codex`)  
- `usage limits have been reset`  
- `oops... i did it again` **且** `reset usage limits`  
- `banked reset` **且** 非疑問  

**不進 auto：** 僅 `hard reset` / `another reset` / `100% weekly` alone、teaser。

**Claude auto_confirm：**

- `we've reset 5-hour and weekly` / `reset 5-hour and weekly rate limits`  
- `rate limits for all users` 須與 reset 句共現  
- **先補** teaser/negation 到 classifyClaude（L1 也需要）  

6. 長度 20–2000  
7. 無 duplicate published  
8. **熔斷：** provider 24h auto-confirm `< 3`  
9. `decision_reason` 含 rule_version  

### 2.4 confirm

```ts
decision_by: "auto_rules",
decision_reason: "auto_publish:2026-07-20.2",
```

### 2.5 規則版本

升 `CONFIG.ruleVersion`；CI **分開**測 classify vs auto gate。

---

## 3. Cron / scheduled + heartbeat

### 3.1 wrangler

```toml
[triggers]
crons = ["*/10 * * * *"]
```

Steady 可 `*/5`；成本敏感用 `*/15`。

### 3.2 Entry

```ts
export default {
  async fetch(request, env, ctx) { /* ... */ },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runAutoCycle(env));
  },
};
```

`runAutoCycle`：load → flags → fetch → ingest → auto? → heartbeat → save。

| 條件 | heartbeat | ingest_at |
|------|-----------|-----------|
| provider 至少一 adapter 成功（含 0 新帖） | **更新** | 僅新 raw |
| 全失敗 | **不更新** | 不變 |
| auto confirm | 更新 | 不變 |

AUTO 語意：`last_operator_heartbeat_at` ≡ **last successful monitor poll**。

### 3.3 鎖

`KV lock:auto_cycle` TTL 240–300s；新鮮則 skip。

### 3.4 Persist

scheduled **自己** `saveStoreToKv`；cursors → `fetch_meta_v1` 或 snapshot 擴欄。

### 3.5 Debug

- `POST /admin/v1/pipeline/run`  
- `GET /admin/v1/pipeline/status`  

---

## 4. `display_status` 變化

| 情境 | display_status |
|------|----------------|
| 成功 poll、無綠 | `no_recent_confirmed` / `cold_start` |
| auto 綠 TTL 內 | `active_confirmed` |
| poll 失敗 >12h、無 active | `source_unhealthy` |
| poll 失敗 + 綠仍在 | `active_confirmed_degraded` |

**黃燈：**

| Flags | 行為 |
|-------|------|
| FETCH=1, PUBLISH=0 | L1 公開黃 |
| PUBLISH=1 | reject 或直綠 → 黃近乎消失 |
| 人 ingest 未 confirm | 仍可黃 |

契約 **schema_version 1** 不破；Flutter 通常零改。

---

## 5. Dedup 與 Retract

**Dedup：** platform+post_id；provider+source_post_id；notify key；since_id+lock。

**Merge ±2h：** L2 MVP 可不做。

**Retract：永不 auto。**

| 動作 | 誰 |
|------|-----|
| 撤綠 | **僅 admin** |
| 源 404 | 標 deleted + 告警；不 auto retract |
| 假綠 | 人 retract + `AUTO_PUBLISH=0` + 修 template |
| 漏綠 | 人 confirm 或擴 template |

Runbook：retract → kill publish → fixture 回歸 → 再開。

---

## 6. Testing strategy

### Unit

- 既有 status tests  
- **新** `auto_publish.test.ts`：正例 pass；teaser/weak/reply fail；熔斷  
- **新** `sources_parse.test.ts`：X JSON、Fx v2 JSON、jina md fixtures  

### Integration（mock adapters）

- PUBLISH=1 + Fake X adapter → green + `auto_rules`  
- 同 post 第二 cycle → 無 dup  
- PUBLISH=0 → pending  
- adapter fail → heartbeat 凍 → 12h unhealthy  
- **fallback-only + PUBLISH=1 → 不綠**  

CI 禁真網。

### Soak

R1 24–72h → R2 → 投毒 teaser → retract 演練。

---

## 7. Secrets / env vars

| Name | 類型 | 預設 | 說明 |
|------|------|------|------|
| `AUTO_FETCH` | var/KV | `"0"` | poll |
| `AUTO_PUBLISH` | var/KV | `"0"` | auto 綠 |
| `MONITORING_ENABLED` | var/KV | `"1"` | kill 全停 |
| `X_BEARER_TOKEN` | secret | — | L2 必要 |
| `ADMIN_TOKEN` | secret | 既有 | emergency |
| `ADMIN_DEV_BYPASS` | var | `"0"` | prod 0 |
| `TELEGRAM_*` | 可後 | — | |
| `FETCH_TIMEOUT_MS` | var | `"4000"` | |

**KV `config_flags_v1` 覆寫 env** → 秒級 kill 不 redeploy。  
`POST /admin/v1/flags`。

---

## 8. Rollout

| Phase | Flags | 行為 | 退出 |
|-------|-------|------|------|
| R0 | off | 半自動 | tests |
| R1 | FETCH=1, PUBLISH=0 | L1 黃 | 24–72h 乾淨 |
| R2 | + PUBLISH=1 | L2 綠 | 0 假綠 fixture；bearer OK |
| R3 | steady | 改 PURPOSE/PLAN | |

Kill：`MONITORING_ENABLED=0` > `AUTO_PUBLISH=0` > `AUTO_FETCH=0`。

觀測：`last_cycle_v1` JSON。

---

## 9. Admin-only → emergency override

保留：ingest/confirm/reject/**retract**/heartbeat/pipeline/flags/`/admin` UI。

文件遷移（實作 PR）：PURPOSE 綠燈定義、PLAN HARD RULE #2、api-v1 heartbeat 語意、README flags。

相容：清 teaser pending；歷史 event 不動；public v1 不破。

---

## 10. Explicit non-goals

1. LLM 直綠  
2. 非白名單／全站搜  
3. **Auto-retract**  
4. 群眾轉綠  
5. 強制先搬 D1  
6. 個人 quota / wham 當本產品主訊號（可後期分層）  
7. 秒級競速 SLO  
8. 假監測弱 provider  
9. Guest GraphQL / headless  
10. Fallback sole L2 green  
11. Flutter 大改 / Pro  

---

## 11. 實作步驟

### A — 骨架（0.5–1d）

1. `flags.ts`  
2. `auto_publish.ts` + fixture tests（**先 gate**）  
3. `run_cycle.ts` DI  
4. Claude teaser/negation  

### B — Fetch（1d）

1. `x_api_v2.ts`（since_id, max=5, exclude）  
2. `fxtwitter_v2.ts` timeline + status hydrate + jina  
3. waterfall；**無 bearer → 禁 L2**  
4. spending-limit 文件註記  

### C — Wire（0.5d）

1. scheduled + cron `*/10`  
2. lock + persist  
3. heartbeat-on-poll-ok  
4. admin pipeline/flags/status  
5. 真實 user id  

### D — Rollout

R1 soak → R2 → docs  

### E — 後置

TG 真送、D1、`verified_by`、template 版本 UI  

---

## 12. 風險

| 風險 | 級 | 緩解 |
|------|-----|------|
| 假綠 | P0 | closed templates；熔斷；人 retract；kill |
| 假陰 | P1 | 人 confirm；擴 templates |
| X 費用暴衝 | P1 | since_id；max=5；10–15min；console spending limit |
| Token 失效 | P1 | unhealthy；禁 fallback 綠 |
| Fx/jina 不穩 | P2 | 僅 L1；心跳僅認成功 poll |
| Claude 弱排除 | P0 | 補 exclusion 後再開 L2 |
| HARD RULE 未改就開 L2 | P0 | 文件+flag 同步；預設 0 |
| KV 競態 | P2 | lock + unique post |

---

## 13. 成功標準

| 指標 | 目標 |
|------|------|
| 日常人工 | 0 |
| 假綠 | 0 |
| Poll 成功（有 token） | >95%/日 |
| 無事件 health | 空 poll 仍 fresh |
| API | v1 不破 |
| 測試 | auto gate 全綠；teaser 永不綠 |
| 成本 | 有 cap；無意外 $100+ 月 |

---

## 14. 決策記錄

| 項目 | 決定 |
|------|------|
| L1 | 做；X primary；Fx v2 timeline 可 L1 fallback |
| L2 | 做；strict gate + flag；≠ classify 直通；**僅 x_api_v2** |
| Cron 預設 | **10 min**（可調 5/15） |
| pending 黃 | L1 有；L2 無 |
| Retract | 僅人 |
| Heartbeat | 成功 poll |
| Kill | KV flags |
| Fallback sole green | **禁止** |

---

## 15. 關鍵錨點

| 檔案 | 改動 |
|------|------|
| `worker/src/index.ts` | scheduled、env、cycle |
| `worker/src/store.ts` | 真實 user id |
| `worker/src/status.ts` | Claude 排除；templates 可放 pipeline |
| `worker/src/app.ts` | pipeline/flags |
| `worker/src/persist.ts` | cursors/flags |
| `worker/wrangler.toml` | crons + vars |
| **新** `sources/*`、`pipeline/*` | 核心 |
| **新** tests | auto + pipeline + parse |
| docs | 綠燈定義 |

---

## 16. 給實作者的一句話

> **先 L1（X poll → candidate；Fx v2 僅備援），再用獨立 closed-template `AutoPublishGate` + `AUTO_PUBLISH` 做 L2；成功 poll 當 heartbeat；人只負責 retract 與關開關。`classify*` alone 絕不直綠；無 bearer 不開 L2。**

---

## 17. 參考

- `.omc/research/2026-07-20-auto-pipeline-explore.md`  
- `.omc/research/2026-07-20-x-source-web-research.md`  
- `.omc/research/2026-07-20-x-probe-local.json`  
- https://docs.x.com/x-api/getting-started/pricing  
- https://docs.x.com/x-api/posts/timelines/introduction  
- https://docs.fxembed.com/（FxTwitter v2 profile statuses）  
- `docs/PLAN.md` Phase 1.5  
- `docs/PURPOSE.md`  
- `docs/api-v1-snapshot.md`  
- `fixtures/*`  
