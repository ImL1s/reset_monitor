# NEXT 48h Hard-Reset Forecast Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a **third public axis** — “未來 48 小時內會不會再硬重置？” — as an **honest heuristic only** (never green confirm, never notify), driven solely by **our** published hard-reset history + optional explicit-promise signals we already ingest; document competitor mechanisms so we do not cargo-cult or scrape them as truth.

**Architecture:** Pure deterministic scorer in Worker (`worker/src/pipeline/forecast.ts`) computed at snapshot/stats time from `PublishedEvent[]` (hard_reset only) + optional pending explicit-promise flag. Attach `next_48h` DTO on each monitored `ProviderSnapshotCard`. Flutter board shows Q3 under NOW / LAST with band + % + short factor chips + permanent “heuristic, not confirmation” copy. Claude with &lt;2 hard intervals → `insufficient_data`, not a fake mid %.

**Tech Stack:** Cloudflare Worker TypeScript (node:test), existing store/stats/status pipeline; Flutter web models + `ProviderStatusCard` / board hero; no new paid APIs, no competitor API dependency.

**Research inputs (2026-07-20, multi-agent + live fetch):**
- Subagents: competitor mechanisms (explore), local feasibility (architect), BUILD_HEURISTIC Codex-first (critic), methodology/API scrape.
- Live: `https://codexresetradar.com/api/status`, `https://codexradar.com/current.json`, our `https://reset-radar.taiwan-traffic.workers.dev/v1/stats`.

---

## 0. Research: 機制從哪裡來？（必讀，執行前不要跳過）

### 0.1 三家產品對照

| 產品 | 角色 | 有沒有 48h 預測 | 預測資料從哪來 | 事實軸 |
|------|------|-----------------|----------------|--------|
| **codex-resets.com** | 歷史聖殿 | **無** | N/A；只計 blessings / drought | 已確認 hard post 列表 |
| **codexresetradar.com** (A) | 預測雷達 | **有**（主產品） | 自家 factor sum + 可選 AI 調整；公開 `GET /api/status` | `factStatus` + `latestReset` **與** `forecast` 分離 |
| **codexradar.com** (B) | 窗口 + 預測 + 周邊 | **有** 24h/48h | 公開 `current.json` 的 `prediction`；完整 API 需授權 | `window.open` + community_confirmed 等 |
| **我們 reset-radar** | 零登入確認雷達 | **目前無 → 本 plan 加** | **只用自己的** hard_reset 歷史 + 可選自家 pending 明示承諾 | 雙軸 `display_status` + heartbeat；預測是**第三軸** |

### 0.2 Competitor A — codexresetradar.com（機制最透明）

**公開端點（已驗證 200）：** `GET https://codexresetradar.com/api/status`

**結構（2026-07-20 實抓摘要）：**

```json
{
  "schemaVersion": 2,
  "generatedAt": "…",
  "factStatus": "confirmed_recent",
  "latestReset": {
    "id": "2078320950488297917",
    "occurredAt": "2026-07-18T03:28:22.589Z",
    "source": "https://x.com/thsottiaux/status/…",
    "confidence": 1
  },
  "forecast": {
    "windowHours": 48,
    "probability": 34,
    "band": "LOW",
    "factors": [
      { "id": "baseline", "label": "Historical baseline", "delta": 12 },
      { "id": "elapsed", "label": "Time since last reset", "delta": 2 },
      { "id": "cooldown", "label": "Post-reset cooldown", "delta": -25 },
      { "id": "future-promise", "label": "Explicit future reset promise", "delta": 45,
        "evidenceUrls": ["https://x.com/thsottiaux/status/2079058575440359695"] }
    ],
    "aiAdjustment": 0,
    "calculatedAt": "…",
    "history": [ /* probability floor / stale-source 等調整日誌 */ ]
  },
  "evidence": [ /* 一手貼文，含 phase: ambiguous / confirmed 等 */ ]
}
```

**UI 文案（zh-hant 實抓）也列出更多因子標籤：**

| factor id / 標籤 | 方向 | 含義（研究推論） |
|------------------|------|------------------|
| `baseline` 歷史基線 | + | 長期 hard reset 頻率 → 48h 先驗機率 |
| `elapsed` 距上次重置時間 | + | 離上次越久，越接近「又該來」 |
| `cooldown` 重置後冷卻期 | − | 剛 reset 完，短期再來機率下修 |
| `future-promise` 明確未來重置承諾 | +大 | 官方/負責人「resets will continue」類明示 |
| 主要來源權威度 | + | staff 權重（我們用 authority 已在 confirm 閘） |
| AI 語意判斷一致 | ± | **可選**；他們有 `aiAdjustment` 欄 |
| `stale-source` 來源新鮮度懲罰 | − | 監測/來源不新鮮 |
| `probability-floor` | 抬底 | 避免算完變 0；history 裡常見 |

**關鍵產品原則（我們要學）：**

1. **FACT ≠ FORECAST** — 已確認 7/18 reset 是事實；48h % 是另一欄。  
2. Factor 可解釋、有 evidence URL 時要帶出。  
3. 明確預告仍是預測，**完成前不當 confirmed**。

**不要抄的：** 把 AI 調成主驅動、把 % 畫成「即將發生」的綠色確認感、依賴他們 API 當我們的資料源。

### 0.3 Competitor B — codexradar.com

**公開端點：** `GET https://codexradar.com/current.json`（`type: public_summary`）

```json
{
  "window": { "open": false, "closed_at": "…", "source_url": "…" },
  "prediction": {
    "level": "low",
    "probability_24h": 0.14,
    "probability_48h": 0.27,
    "summary": "（敘事段落）",
    "updated_at": "…"
  },
  "tibo_presence": { "probability": 0.2, "timezone": "America/Los_Angeles", … },
  "api_access": { "full_api_status": "authorization_required" }
}
```

| 機制 | 說明 | 我們是否採用 |
|------|------|--------------|
| 24h + 48h 雙窗 | 機率 0–1 | **只做 48h 一個窗**（YAGNI；可日後加） |
| `window.open` | 「官方速蹬窗口是否開著」 | **不另做**；我們已有 `active_confirmed` TTL |
| 敘事 summary | LLM/人工長文 | v1 **不做長文**；只用 factor labels |
| `tibo_presence` | 粗略時區/在線猜測 | **永不做**（隱私/creepy/與產品無關） |
| 依賴其 full API | 需授權 | **禁止**當 production 依賴 |
| model_iq 等 | 周邊產品 | 無視 |

### 0.4 我們現有、可餵給 scorer 的資料（唯一合法輸入）

| 來源 | 路徑 | 用途 |
|------|------|------|
| 已確認 hard_reset 序列 | `store.eventsFor(provider)`，`type === "hard_reset"`，`!retracted`，時間用 `effective_at` | baseline / elapsed / cooldown |
| 統計 | `computeProviderStats` → `days_since_last`, `avg_interval_days`, `hard_reset_count` | 可重用或內嵌 |
| pending | `store.pendingFor` + 既有 classify（teaser / scheduled 已分流） | **可選** explicit-promise（僅當文字是「將會 reset」類，且**永不**改 display 綠燈） |
| source_health | `buildProviderCard` 已算 | 可選 −freshness；health stale 時仍給 heuristic，但 UI 註「來源不新鮮」 |
| 競品 API | — | **禁止**當 input |
| 個人額度 / 帳號 | — | **禁止**（產品定義不是這個） |

**Live 我方 stats（2026-07-20）：** Codex hard≈26、avg_interval≈10.5d、days_since_last≈2.4；Claude hard=1、avg=null → Claude **必須** `insufficient_data`。

### 0.5 產品裁決（多代理共識 → 凍結）

| 裁決 | 內容 |
|------|------|
| P0 | 預測 **永不** 寫入 `display_status`；**永不** 觸發 Telegram/notify |
| P0 | 文案固定：**啟發式 / 非確認 / 非官方** |
| P0 | **hard_reset only** 算間隔（banked 不進 baseline） |
| P0 | Codex-first 調參；Claude &lt;2 hard intervals → `insufficient_data` |
| P1 | Factor 可解釋、可測、deterministic（同 events + now → 同輸出） |
| P1 | v1 **無** AI adjustment（避免假精準）；v1.1 可加 ±cap 若 free LLM 已有 |
| P2 | explicit future-promise factor（有 evidence URL）— 實作在 Task 4，可 feature-flag |
| OUT | tibo_presence、刮競品、24h 第二窗、預測推播、綠燈聯動 |

---

## 1. Target API shape

### 1.1 掛在 snapshot provider card（推薦，一次請求）

在 `ProviderSnapshotCard` 增加可 null 欄位：

```ts
export type ForecastBand = "low" | "medium" | "high" | "insufficient_data";

export interface ForecastFactorDto {
  id: string;           // baseline | elapsed | cooldown | future_promise | floor | freshness
  label: string;        // 繁中固定字串
  delta: number;        // 整數百分點貢獻，可負
}

export interface Next48hForecastDto {
  window_hours: 48;
  /** 0–100 integer; null when insufficient_data */
  probability: number | null;
  band: ForecastBand;
  factors: ForecastFactorDto[];
  calculated_at: string; // ISO
  method: "deterministic_v1";
  disclaimer: string;    // 固定：啟發式，非官方、非確認
  /** optional evidence for future_promise */
  evidence_urls?: string[];
}
```

`ProviderSnapshotCard.next_48h: Next48hForecastDto | null`  
- `not_monitored` → `null`  
- monitored → 永遠有 object（含 `insufficient_data`）

### 1.2 不動 schema_version 大跳

維持 `schema_version: 1`，**additive** 欄位；client 缺欄當無預測。若專案慣例要 bump，只 +0 說明於 `docs/api-v1-snapshot.md`。

### 1.3 可選獨立 endpoint（YAGNI 預設不做）

`/v1/forecast?provider=codex` — 只有 snapshot 塞不下或 debug 需要時再加。

---

## 2. Deterministic scorer v1（凍結公式）

實作於 `worker/src/pipeline/forecast.ts`。輸入：hard events sorted by `effective_at` ascending + `now` + optional promise signal.

### 2.1 Constants（命名 export，可測）

```ts
export const FORECAST_WINDOW_HOURS = 48;
export const FORECAST_FLOOR = 5;
export const FORECAST_CAP = 85;
/** hours after last hard reset with strong negative cooldown */
export const COOLDOWN_FULL_HOURS = 36;
export const COOLDOWN_TAPER_HOURS = 72;
/** max |delta| for each factor */
export const DELTA = {
  baseline: 25,
  elapsed: 20,
  cooldown: -35,
  future_promise: 40,
  freshness: -8,
} as const;
```

### 2.2 Factor math（pseudo → 實作照抄可測）

1. **Filter** hard only, non-retracted, sort by effective_at.  
2. If `hard.length < 2` → return `band: insufficient_data`, `probability: null`, factors explaining need ≥2 hard resets.  
3. **Intervals** days between consecutive hard; `avg = mean(intervals)`.  
4. **baseline**  
   - Prior 48h rate ≈ `min(1, FORECAST_WINDOW_HOURS/24 / avg)`  
   - `delta_baseline = round(prior * DELTA.baseline * 100/25)` clamp 0..DELTA.baseline  
   - 直覺：avg 10.5d → 48h 先驗 ≈ 2/10.5 ≈ 0.19 → baseline ~ +12（對齊競品量級即可，**以測試鎖定具體數**）  
5. **elapsed**  
   - `days_since = (now - last.effective_at) / 864e5`  
   - `ratio = days_since / avg`  
   - `delta_elapsed = clamp(0, DELTA.elapsed, round((ratio - 0.3) * DELTA.elapsed))`  
   - 剛 reset（ratio≪1）→ 0；接近/超過 avg → 上升  
6. **cooldown**  
   - `hours_since = days_since * 24`  
   - if `hours_since < COOLDOWN_FULL_HOURS` → `delta_cooldown = DELTA.cooldown` (−35)  
   - else if `< COOLDOWN_TAPER_HOURS` → linear taper to 0  
   - else 0  
7. **future_promise**（Task 4，default 0）  
   - 僅當 pipeline 標記 `explicit_future_promise`（規則命中，見下）→ +40 並帶 evidence_urls  
8. **freshness**（optional）  
   - source_health === `stale` → −8；`degraded` → −4；else 0  
9. **Sum** `raw = sum(deltas)`；`probability = clamp(FORECAST_FLOOR, FORECAST_CAP, raw)`  
10. **Band**  
    - `insufficient_data` if null  
    - `low` if p &lt; 35  
    - `medium` if p &lt; 60  
    - `high` if p ≥ 60  

**測試鎖定案例（必須寫進 test）：**

| Case | 輸入摘要 | 期望 |
|------|----------|------|
| C1 剛 reset 2.4d、avg 10.5d、無 promise | 類似現況 | band `low`，cooldown 仍負或 taper，p 約 5–40 |
| C2 距上次 ≥ avg | days_since ≥ avg | p 明顯高於 C1，仍 ≤ CAP |
| C3 &lt;2 hard | Claude-like | `insufficient_data`, probability null |
| C4 同 events 不同 now 1s | — | 同結果（秒級穩定；用整點小時若需） |
| C5 promise on | + future_promise | p 升一檔，factors 含 id |
| C6 banked only 夾在中間 | intervals 不算 banked | hard-only |
| C7 永不觸發 notify / display green | 單元 + 整合 | display_status 與 forecast 解耦 |

### 2.3 Explicit future-promise 規則（Task 4）

**只加分，不確認。** 候選來源：

- pending candidate raw_text，或  
- 最近 7d 已抓但未當 hard 的 staff 文（若 pipeline 已存）

**命中示例（大小寫不敏感）：**

- `resets will continue`  
- `will reset` + (`soon` \| `again` \| `later` \| `today` \| `tomorrow`)  
- `another reset` + future tense / `coming`  
- 中文可選：`會再重置`、`即將重置`（有則加；無則先英）

**硬排除（已有 classify 應擋）：** teaser 問題句、否定、partial/promo、個人 limit。

實作建議：`export function detectExplicitFuturePromise(text: string): boolean` 純函式 + 單元測；**不要**走 LLM。

---

## 3. UI / 文案（繁中優先）

### 3.1 卡片第三軸

在 `ProviderStatusCard`，NOW pill 與 LAST 區塊之後：

```
NEXT 48h（啟發式）
  低 · 約 28%
  冷卻中 · 非確認
```

- `insufficient_data` →「資料不足（硬重置樣本 &lt; 2）」**不顯示假 %**  
- 顏色：用 **muted / warning 黃**，**禁止**用 `StatusVisual` 綠燈色  
- 可展開 factors：`歷史基線 +12` / `冷卻 −25` …  

### 3.2 Board hero

可加一句：「第三問：48h 內再重置？= 啟發式統計，不是綠燈。」

### 3.3 About

一行：`next_48h` 由已確認 hard_reset 間隔推算；不是官方預告；有明示承諾才會大加分。

### 3.4 固定 disclaimer 字串

```
啟發式估計，非官方、非確認。綠燈只代表已確認公開 hard reset。
```

---

## 4. Tasks（TDD bite-sized）

### Task 1: Forecast types + pure scorer skeleton

**Files:**
- Create: `worker/src/pipeline/forecast.ts`
- Modify: `worker/src/types.ts` — `Next48hForecastDto`, `ForecastBand`, `ForecastFactorDto`; add `next_48h?` on `ProviderSnapshotCard`
- Create: `worker/test/forecast.test.ts`

**Step 1: Write failing tests for C3 + C1 shape**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeNext48hForecast } from "../src/pipeline/forecast.js";

describe("computeNext48hForecast", () => {
  it("insufficient_data when fewer than 2 hard resets", () => {
    const r = computeNext48hForecast({
      hardEvents: [
        { effective_at: "2026-07-16T03:58:48.000Z", type: "hard_reset" },
      ],
      now: new Date("2026-07-20T12:00:00.000Z"),
      sourceHealth: "fresh",
    });
    assert.equal(r.band, "insufficient_data");
    assert.equal(r.probability, null);
    assert.equal(r.window_hours, 48);
    assert.equal(r.method, "deterministic_v1");
    assert.match(r.disclaimer, /啟發式/);
  });
});
```

**Step 2: Run**

```bash
cd worker && npm test -- --test-name-pattern=computeNext48hForecast
```

Expected: FAIL module not found / function not defined.

**Step 3: Minimal implementation**

- Export `computeNext48hForecast` returning insufficient_data for &lt;2 hard; stub low for ≥2 (exact math Task 2).

**Step 4: Tests pass for C3**

**Step 5: Commit**

```bash
git add worker/src/pipeline/forecast.ts worker/src/types.ts worker/test/forecast.test.ts
git commit -m "feat(forecast): types + insufficient_data for sparse hard history"
```

---

### Task 2: Implement baseline / elapsed / cooldown math + lock cases

**Files:**
- Modify: `worker/src/pipeline/forecast.ts`
- Modify: `worker/test/forecast.test.ts`

**Step 1: Add tests C1, C2, C6, C4**

- C1: two+ hard events ending 2026-07-18T03:28:22Z, now 2026-07-20T12:00Z → `band === "low"`, probability between 5 and 40 inclusive, factors include `cooldown` with delta &lt; 0.  
- C2: same events, now = last + avg_interval days → probability &gt; C1.  
- C6: insert banked between hard — intervals ignore banked (pass only hard array from caller).  
- C4: same inputs → deepEqual factors + probability.

**Step 2: RED** — run tests fail on stubs.

**Step 3: GREEN** — implement §2.2 math; only hard events.

**Step 4: Commit**

```bash
git commit -m "feat(forecast): deterministic baseline/elapsed/cooldown scorer"
```

---

### Task 3: Wire into `buildProviderCard` + snapshot

**Files:**
- Modify: `worker/src/status.ts` — `buildProviderCard`  
- Modify: `worker/test/status.test.ts`  
- Modify: `docs/api-v1-snapshot.md` — document `next_48h`  
- Optional: `worker/src/app.ts` — only if card not built via status (it is)

**Step 1: Failing test**

```ts
// status.test.ts
it("attaches next_48h heuristic without changing display_status green rules", () => {
  const card = buildProviderCard({ /* fixture with 2+ hard, no active TTL */ });
  assert.equal(card.display_status, "no_recent_confirmed");
  assert.ok(card.next_48h);
  assert.equal(card.next_48h.window_hours, 48);
  assert.notEqual(card.display_status, "active_confirmed"); // still grey if no active
});
```

**Step 2: Implement**

In `buildProviderCard` after lastConfirmed:

```ts
const hard = nonRetracted.filter((e) => e.type === "hard_reset");
const next_48h = args.config.monitored
  ? computeNext48hForecast({
      hardEvents: hard,
      now,
      sourceHealth: health,
    })
  : null;
// include next_48h on return object
```

**Never** call notify from forecast path.

**Step 3: `cd worker && npm test`** — all green.

**Step 4: Commit**

```bash
git commit -m "feat(forecast): attach next_48h on provider snapshot cards"
```

---

### Task 4: Optional future_promise factor (rules only)

**Files:**
- Modify: `worker/src/pipeline/forecast.ts` — `detectExplicitFuturePromise`  
- Modify: `worker/src/status.ts` — pass pending text if actionable  
- Modify: `worker/test/forecast.test.ts`  
- Fixtures optional: `fixtures/codex-future-promise-sample.json` (text only)

**Step 1: Tests** for phrase table hit/miss (teaser question false; “resets will continue” true).

**Step 2: Wire** `promise: detectExplicitFuturePromise(pending?.raw_text ?? "")` into scorer; on hit add factor + evidence_urls `[pending.source_url]`.

**Step 3: Confirm** display_status still not green from promise alone.

**Step 4: Commit**

```bash
git commit -m "feat(forecast): optional explicit future-promise factor (rules only)"
```

---

### Task 5: Flutter models + card UI + hero copy

**Files:**
- Modify: `app/lib/models/api_models.dart` — parse `next_48h`  
- Modify: `app/lib/widgets/provider_status_card.dart` — NEXT 48h block  
- Modify: `app/lib/pages/board_page.dart` and/or `about_page.dart` — one-line legend  
- Modify: `app/test/widget_test.dart` if present; else add parse unit test file `app/test/forecast_model_test.dart`

**Step 1: Dart parse test**

```dart
test('parses next_48h insufficient_data', () {
  final j = {
    'provider': 'claude',
    'display_name': 'Claude',
    'monitored': true,
    'display_status': 'no_recent_confirmed',
    'source_health': 'fresh',
    'as_of': '2026-07-20T00:00:00.000Z',
    'active_event': null,
    'last_confirmed_event': null,
    'pending_detection': null,
    'next_48h': {
      'window_hours': 48,
      'probability': null,
      'band': 'insufficient_data',
      'factors': [],
      'calculated_at': '2026-07-20T00:00:00.000Z',
      'method': 'deterministic_v1',
      'disclaimer': '啟發式估計，非官方、非確認。',
    },
  };
  final c = ProviderCardData.fromJson(j);
  expect(c.next48h?.band, 'insufficient_data');
  expect(c.next48h?.probability, isNull);
});
```

**Step 2: UI**

- Band label map: low→「低」, medium→「中」, high→「高」, insufficient_data→「資料不足」  
- Color: `RadarColors.muted` / `warning` only  
- Subtitle: `c.next48h.disclaimer` one line max  

**Step 3: Verify**

```bash
cd app && dart analyze && flutter test
```

**Step 4: Commit**

```bash
git commit -m "feat(ui): show NEXT 48h heuristic on provider cards"
```

---

### Task 6: Docs, README, regression, deploy

**Files:**
- Modify: `README.md` — 產品一句：第三軸 48h 啟發式  
- Modify: `docs/PURPOSE.md` — 可選一句「不是預測主產品，是輔助」  
- Modify: `docs/api-v1-snapshot.md` — 完整欄位  
- Run: `cd worker && npm test`  
- Deploy: worker + pages（既有流程）

**Done when:**

1. Worker tests 全綠（含 forecast）。  
2. Live `/v1/snapshot` Codex 有 `next_48h.probability` number；Claude `insufficient_data`。  
3. Live board 可見 NEXT 48h，**灰色 NOW 不會因高 % 變綠**。  
4. 無新 notify 呼叫路徑。  
5. README 寫清：資料來自**我們的** hard_reset 歷史，不是刮競品。

**Commit + deploy**

```bash
git commit -m "docs: next_48h forecast methodology and API"
# then wrangler deploy + pages deploy per HOSTING.md
```

---

## 5. Out of scope（本 plan 禁止順手做）

- 個人用量 / OAuth  
- tibo_presence / 時區跟蹤  
- 依賴 codexresetradar 或 codexradar API  
- 預測推播  
- LLM 主驅動機率  
- 把 banked 算進 hard 間隔  
- 重寫雙軸 display_status  

---

## 6. Verification checklist（完成前必須勾）

- [ ] `cd worker && npm test` 0 fail  
- [ ] Unit: C1–C7 全過  
- [ ] `curl -sS …/v1/snapshot | jq '.providers[] | {p:.provider, d:.display_status, f:.next_48h.band, pct:.next_48h.probability}'`  
- [ ] Codex: band low/medium/high + number；Claude: insufficient_data  
- [ ] UI screenshot / live pages：NEXT 區塊存在且非綠色確認 pill  
- [ ] grep notify：forecast 路徑無 `notifyOutbox`  
- [ ] 文件寫明機制來源與「不刮競品」  

---

## 7. Execution handoff

Plan complete and saved to:

`docs/superpowers/plans/2026-07-20-next-48h-forecast.md`

**Two execution options:**

1. **Subagent-Driven (this session)** — fresh subagent per task, review between tasks (`superpowers:subagent-driven-development`)  
2. **Parallel Session (separate)** — new session with `superpowers:executing-plans`, batch + checkpoints  

Which approach?
