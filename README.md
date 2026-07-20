# RESET Radar

**零登入**打開就看：Codex / Claude 有沒有**公開** usage hard RESET。

> Independent utility. Not affiliated with OpenAI, Anthropic, or other AI providers.  
> 綠燈 ≠ 你個人帳號一定補滿。

| | URL |
|--|-----|
| **Web** | https://reset-radar-web.pages.dev |
| **API** | https://reset-radar.taiwan-traffic.workers.dev |
| **Snapshot** | https://reset-radar.taiwan-traffic.workers.dev/v1/snapshot |
| **Stats** | https://reset-radar.taiwan-traffic.workers.dev/v1/stats |
| **Monitor** | https://reset-radar.taiwan-traffic.workers.dev/v1/monitor |

## 現況（2026-07-20）

| 能力 | 說明 |
|------|------|
| 全自動 | Cron 每 10 分拉 `@thsottiaux` / `@ClaudeDevs`（FxTwitter → Dayclaw fallback） |
| 綠燈 | 嚴格模板 auto-confirm；失敗才問 LLM（**Zen free → Go 訂閱 fallback**） |
| 假綠防護 | teaser / incoming / 否定句 reject；**規則與 LLM 皆需 usage 片語 floor + scope**；口頭禪 alone 不綠；seed 不延長 TTL |
| 歷史 | corpus seed + `/v1/stats`（以 `effective_at` 算 avg / drought，避免 re-import 失真） |
| UI | 首屏說明綠/琥珀；Pending = Detected · not confirmed；About 與 free-auto 對齊 |
| Admin | 僅緊急 retract / pipeline；production 需 `ADMIN_TOKEN` |
| TG | 可選；缺 secrets 不標 sent；設好後**同一次** drain 可送出 |

## Docs

| 檔案 | 內容 |
|------|------|
| [docs/PURPOSE.md](docs/PURPOSE.md) | 目的與 hard rules |
| [docs/PLAN.md](docs/PLAN.md) | 計劃 v3 + free-auto 管線 |
| [docs/api-v1-snapshot.md](docs/api-v1-snapshot.md) | API 契約（snapshot / events / stats / monitor） |
| [docs/HOSTING.md](docs/HOSTING.md) | Cloudflare 部署 |
| [docs/FULL_AUDIT.md](docs/FULL_AUDIT.md) | 完整審計 |
| [design-system/MASTER.md](design-system/MASTER.md) | UI 設計系統 |
| [docs/superpowers/plans/](docs/superpowers/plans/) | 實作計畫 |

## Quick start

### 1) API（Worker local）

```bash
cd worker
npm install --legacy-peer-deps
npm test
npm run dev:local
# → http://127.0.0.1:8787/v1/snapshot
# → http://127.0.0.1:8787/v1/stats
# → http://127.0.0.1:8787/admin  (ADMIN_DEV_BYPASS=1)
```

### 2) Flutter Web / App

```bash
cd app
flutter pub get
flutter run -d chrome --dart-define=API_BASE=http://127.0.0.1:8787
# 或 production API：
# flutter run -d chrome --dart-define=API_BASE=https://reset-radar.taiwan-traffic.workers.dev
```

### 3) 驗證

```bash
./scripts/verify-parity.sh
# 或
cd worker && npm test
cd app && flutter analyze && flutter test
```

### 4) 歷史 corpus（可選更新）

```bash
node scripts/fetch-codex-resets-corpus.mjs
# 再產生 seed_data（若你有 gen 腳本）後 npm test
```

## Public API

| Method | Path | 說明 |
|--------|------|------|
| GET | `/health` | 健康 |
| GET | `/v1/snapshot` | 各 provider 狀態卡 |
| GET | `/v1/events?limit=50` | 時間軸 |
| GET | `/v1/stats` | 次數 / 間隔 / drought |
| GET | `/v1/monitor` | free-auto 模式與 last poll |
| GET | `/share` | OG 分享 HTML |

無 Auth。Client **禁止**自算 TTL，一律信 server `display_status`。

## Free-auto pipeline

```
Cron */10
  → FxTwitter /2/profile/{handle}/statuses  (primary)
  → Dayclaw public items                     (fallback)
  → ingest (allowlist + classify)
  → shouldAutoPublish (strict templates)
       fail → OpenCode free LLM (deepseek-v4-flash-free)
            fail infra only → OpenCode Go (deepseek-v4-flash)
  → confirm | soft-pending | hard-reject
  → Telegram outbox (optional secrets)
  → KV persist
```

| Env / secret | 用途 |
|--------------|------|
| `AUTO_PUBLISH=1` | 自動綠燈 |
| `MONITORING_ENABLED=1` | cron poll |
| `OPENCODE_GO_API_KEY` | LLM gate（free+Go 同一 key 可） |
| `LLM_GATE_MODE=opencode_free_then_go` | 免費優先 |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | 推播（可選） |
| `ADMIN_TOKEN` | production admin |

```bash
cd worker
npx wrangler secret put OPENCODE_GO_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN   # optional
npx wrangler secret put TELEGRAM_CHAT_ID     # optional
npx wrangler secret put ADMIN_TOKEN          # production admin
```

## Admin

- **Local UI:** http://127.0.0.1:8787/admin（`npm run dev:local` bypass）
- **Production:** `ADMIN_DEV_BYPASS=0`；header `X-Admin-Token: $ADMIN_TOKEN`
- 日常不需要人工 confirm；admin 用於 **retract / 手動 pipeline**

```bash
# 手動跑一輪 free-auto
curl -s -X POST https://reset-radar.taiwan-traffic.workers.dev/admin/v1/pipeline/run \
  -H "content-type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"auto_publish":true}'
```

## Deploy (Cloudflare)

See [docs/HOSTING.md](docs/HOSTING.md).

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
| 公開 hard / banked RESET 雷達 | 個人 OAuth / 個人 % 用量 |
| Codex + Claude 全自動 | 弱訊號假綠燈 |
| Stats / drought / timeline | App Store 上架 |
| 可選 TG + LLM | 付費 X API 必備 |
