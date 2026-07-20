# RESET Radar

**零登入**打開就看：Codex / Claude 有沒有**公開** usage hard RESET。

> Independent utility. Not affiliated with OpenAI, Anthropic, or other AI providers.  
> 綠燈 ≠ 你個人帳號一定補滿。

## Docs

| 檔案 | 內容 |
|------|------|
| [docs/PURPOSE.md](docs/PURPOSE.md) | 目的 |
| [docs/PLAN.md](docs/PLAN.md) | 計劃 v3 |
| [docs/api-v1-snapshot.md](docs/api-v1-snapshot.md) | API 契約 |
| [docs/FULL_AUDIT.md](docs/FULL_AUDIT.md) | 完整審計 |

## Quick start

### 1) API（Worker local）

```bash
cd worker
npm install --legacy-peer-deps
npm test
npm run dev:local
# → http://127.0.0.1:8787/v1/snapshot
```

### 2) Flutter Web / App

```bash
cd app
flutter pub get
flutter run -d chrome --dart-define=API_BASE=http://127.0.0.1:8787
```

### 3) 本機多路 agy 研究（session 外）

```bash
chmod +x scripts/agy-research-local.sh
./scripts/agy-research-local.sh
# 輸出：.omc/research/agy/r*.md
```

## Admin

- **UI:** http://127.0.0.1:8787/admin （僅 `npm run dev:local` 開 bypass）
- **Production Worker:** `ADMIN_DEV_BYPASS=0`（預設）；需設 `ADMIN_TOKEN` + header `X-Admin-Token`

```bash
# heartbeat（local）
curl -s -X POST http://127.0.0.1:8787/admin/v1/heartbeat \
  -H 'content-type: application/json' \
  -d '{"provider":"codex"}'

# ingest + confirm
curl -s -X POST http://127.0.0.1:8787/admin/v1/ingest \
  -H 'content-type: application/json' \
  -d '{"url":"https://x.com/thsottiaux/status/1","provider":"codex","author_handle":"thsottiaux","raw_text":"Enjoy reset usage limits for all paid users"}'
```

## Verify

```bash
./scripts/verify-mvp.sh
```

## Deploy (decided: Cloudflare, not Firebase/Vercel)

See `docs/HOSTING.md`.

| 服務 | URL |
|------|-----|
| API Worker | https://reset-radar.taiwan-traffic.workers.dev |
| Public snapshot | https://reset-radar.taiwan-traffic.workers.dev/v1/snapshot |
| Web (Pages) | 見 deploy 輸出 `*.pages.dev` |

```bash
# API
cd worker && npx wrangler deploy

# Web
cd app && flutter build web --release \
  --dart-define=API_BASE=https://reset-radar.taiwan-traffic.workers.dev
npx wrangler pages deploy build/web --project-name=reset-radar-web
```

Admin production: `npx wrangler secret put ADMIN_TOKEN` then header `X-Admin-Token`.

## MVP scope

- P0：Codex + Claude 公開事件看板  
- 綠燈：admin confirm only  
- 其餘 provider：`not_monitored`  
- 個人 OAuth：Phase 2 mobile only  
