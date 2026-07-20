# RESET Radar

**零登入**打開就看：Codex / Claude 有沒有**公開** usage hard RESET。

> Independent utility. Not affiliated with OpenAI, Anthropic, or other AI providers.  
> **綠燈 ≠ 你個人帳號一定補滿。** Banked 公告 ≠ 自動補額。

| | URL |
|--|-----|
| **Web** | https://reset-radar-web.pages.dev |
| **API** | https://reset-radar.taiwan-traffic.workers.dev |
| **Snapshot** | https://reset-radar.taiwan-traffic.workers.dev/v1/snapshot |
| **Stats** | https://reset-radar.taiwan-traffic.workers.dev/v1/stats |
| **Monitor** | https://reset-radar.taiwan-traffic.workers.dev/v1/monitor |

## 現況（2026-07-21）

| 能力 | 說明 |
|------|------|
| 全自動 | Cron `*/10` 拉 `@thsottiaux` / `@ClaudeDevs`（FxTwitter → Dayclaw fallback） |
| 綠燈 | 嚴格模板 auto-confirm；失敗才 LLM（**Zen free → Go**）；**hard_reset only** 為 North-Star 綠 |
| 假綠防護 | teaser / quote / RT / reply 不綠；usage 片語 floor + **收緊的 global scope**；口頭禪 alone 不綠；promote 用 **帖子時間** 算 TTL |
| Claude 臂 | soft classify → strong + floor + all-users scope；擋 API raise / promo / partial |
| Banked | 可確認並顯示 `active_banked`（琥珀），**不**當「公開 RESET 進行中」綠燈 |
| 歷史 / stats | corpus seed；`last_reset_at` / 間隔 / drought = **hard_reset only** |
| UI | **Verdict-first** 主控台：巨大裁決 + 來源健康徽章 + 等寬「Xd ago」+ 節奏 sparkline；卡片等高不裁切；48h 啟發式降級為中性；i18n zh-Hant/Hans/ja/en；品牌 logo |
| 48h 預測 | 自家 hard 間隔 scorer；永不 notify、永不改綠燈 |
| Admin | 緊急 retract / 手動 pipeline；production 需 `X-Admin-Token` |
| 狀態 | SoT = **MemoryStore + KV**；D1 binding **預留未用** |

## 文件地圖

| 檔案 | 內容 |
|------|------|
| [AGENTS.md](AGENTS.md) | Agent／協作硬規則與驗證指令 |
| [docs/PROJECT.md](docs/PROJECT.md) | 目錄角色與真相來源 |
| [docs/PURPOSE.md](docs/PURPOSE.md) | 產品目的與 hard rules |
| [docs/PLAN.md](docs/PLAN.md) | 計劃 **v4**（free-auto 實況） |
| [docs/api-v1-snapshot.md](docs/api-v1-snapshot.md) | 公開 API 契約 |
| [docs/HOSTING.md](docs/HOSTING.md) | Cloudflare 部署 |
| [docs/FULL_AUDIT.md](docs/FULL_AUDIT.md) | 歷史審計（pre-ship；現況以本 README 為準） |
| [docs/spikes/](docs/spikes/) | 方向 spike（notify / OpenAIDevs / 個人層 / 持久化） |
| [design-system/MASTER.md](design-system/MASTER.md) | UI 設計系統 |
| [brand/](brand/) | Logo 主檔與尺寸 |
| [plans/](plans/) | `/improve` 實作計畫索引（001–016 已落地） |
| [docs/superpowers/plans/](docs/superpowers/plans/) | 早期 feature 計畫 |

## Quick start

### 1) API（Worker local）

```bash
cd worker
npm install --legacy-peer-deps
npm test
npm run typecheck
npm run dev:local
# → http://127.0.0.1:8787/v1/snapshot
# → http://127.0.0.1:8787/admin  (ADMIN_DEV_BYPASS=1, loopback only)
```

Secrets 範本：`worker/.env.example`（勿提交真實值）。

### 2) Flutter Web / App

```bash
cd app
flutter pub get
flutter run -d chrome --dart-define=API_BASE=http://127.0.0.1:8787
# production:
# flutter run -d chrome --dart-define=API_BASE=https://reset-radar.taiwan-traffic.workers.dev
```

### 3) 驗證

```bash
./scripts/verify-parity.sh
# 或
cd worker && npm test && npm run typecheck
cd app && flutter analyze && flutter test
```

CI：`.github/workflows/ci.yml`（worker test/typecheck + flutter analyze/test）。

### 4) 歷史 corpus（可選更新）

```bash
node scripts/fetch-codex-resets-corpus.mjs
# 再更新 seed 後 npm test
```

## Public API

| Method | Path | 說明 |
|--------|------|------|
| GET | `/health` | 健康 |
| GET | `/v1/snapshot` | 各 provider 狀態卡（含 `next_48h`） |
| GET | `/v1/events?limit=50&provider=` | 時間軸（可篩 provider） |
| GET | `/v1/stats` | 次數；間隔／drought = hard_reset only |
| GET | `/v1/monitor` | free-auto 模式（無 raw error 字串） |
| GET | `/share` | OG 分享 HTML（已 escape） |

無 Auth。Client **禁止**自算 TTL，一律信 server `display_status`。

### `display_status`（精簡）

| 狀態 | 含義 |
|------|------|
| `active_confirmed` / `_degraded` | **hard_reset** 仍在 TTL 內（North-Star 綠） |
| `active_banked` | banked 公告在 TTL 內（非自動補額） |
| `detected_pending` | 候選未過綠燈閘 |
| `no_recent_confirmed` | 監測正常、無進行中硬重置 |
| `source_unhealthy` | 心跳過期且無硬綠 |
| `cold_start` / `not_monitored` | 從未確認／未監測 |

詳見 [docs/api-v1-snapshot.md](docs/api-v1-snapshot.md)。

## Free-auto pipeline

```
Cron */10
  → FxTwitter /2/profile/{handle}/statuses  (primary)
  → Dayclaw public items                     (fallback)
  → ingest (allowlist + userId 檢查 + classify)
  → shouldAutoPublish (strict templates + scope)
       fail → OpenCode free LLM → infra only → OpenCode Go
  → confirm (effective_at from snowflake) | soft-pending | hard-reject
  → Telegram outbox (optional)
  → KV store_v1
```

| Env / secret | 用途 |
|--------------|------|
| `AUTO_PUBLISH=1` | 自動綠燈 |
| `MONITORING_ENABLED=1` | cron poll |
| `OPENCODE_GO_API_KEY` | LLM gate |
| `LLM_GATE_MODE=opencode_free_then_go` | 免費優先 |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | 推播（可選） |
| `ADMIN_TOKEN` | production admin 寫入 |

```bash
cd worker
npx wrangler secret put OPENCODE_GO_API_KEY
npx wrangler secret put ADMIN_TOKEN
# optional:
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

## Admin

- **Local UI:** http://127.0.0.1:8787/admin（`npm run dev:local`，bypass，**僅 127.0.0.1**）
- **Production:** `ADMIN_DEV_BYPASS=0`；UI 或 curl 帶 `X-Admin-Token`
- 日常 **不需要** 人工 confirm；用於 **retract / 手動 pipeline / 緊急 ingest**

```bash
curl -s -X POST https://reset-radar.taiwan-traffic.workers.dev/admin/v1/pipeline/run \
  -H "content-type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"auto_publish":true}'
```

## Deploy (Cloudflare)

詳見 [docs/HOSTING.md](docs/HOSTING.md)。

```bash
# API
cd worker && npx wrangler deploy

# Web
cd app && flutter build web --release \
  --dart-define=API_BASE=https://reset-radar.taiwan-traffic.workers.dev
npx wrangler pages deploy build/web --project-name=reset-radar-web --commit-dirty=true
```

## Scope

| 做 | 不做（現階段） |
|----|----------------|
| 公開 hard / banked 雷達 | 個人 OAuth / 個人 % 用量 |
| Codex + Claude free-auto | 弱訊號假綠燈 |
| Stats / drought / timeline / 48h 啟發式 | 群眾回報（防 Sybil 前） |
| 可選 TG + LLM | 付費 X API 必備 |
| 假綠防護持續收緊 | D1 全量遷移（仍預留） |

## License / 歸屬

Independent utility. Not affiliated with OpenAI, Anthropic, xAI, or other AI providers.
