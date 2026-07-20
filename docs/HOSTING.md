# Hosting 決策（2026-07-20）

## 決策摘要

| 排名 | 平台 | 角色 |
|------|------|------|
| **1** | **Cloudflare** | **主平台**：API Worker + KV + Cron + Pages |
| **2** | Firebase Hosting | **僅可選**：Flutter Web 靜態；**不當** event API |
| **3** | Vercel | **僅可選**：靜態；**不當** API |

## 生產拓樸

```
Flutter Web  →  Cloudflare Pages  (reset-radar-web)
                  API_BASE → Worker
Public API   →  Cloudflare Worker (reset-radar)
State        →  KV STATE (store_v1 + notify outbox)
Cron         →  */10 * * * * free-auto poll
LLM (opt)    →  OpenCode Zen free → Go fallback
Notify (opt) →  Telegram Bot API
D1           →  provisioned, runtime still MemoryStore+KV (D1 reserved)
```

## 已部署 URL

| 服務 | URL |
|------|-----|
| Worker | https://reset-radar.taiwan-traffic.workers.dev |
| Pages | https://reset-radar-web.pages.dev |
| Snapshot | …/v1/snapshot |
| Stats | …/v1/stats |
| Monitor | …/v1/monitor |

## Secrets（wrangler）

| Secret | 必要 | 說明 |
|--------|------|------|
| `OPENCODE_GO_API_KEY` | LLM 時 | OpenCode Go key（可打 free + Go） |
| `ADMIN_TOKEN` | production admin | fail-closed 寫入 |
| `TELEGRAM_BOT_TOKEN` | 可選 | 推播 |
| `TELEGRAM_CHAT_ID` | 可選 | 推播目標 |

Vars（`worker/wrangler.toml`）：`AUTO_PUBLISH`、`MONITORING_ENABLED`、`LLM_GATE_MODE=opencode_free_then_go`、`OPENCODE_ZEN_MODEL`、`OPENCODE_ZEN_BASE`。

## 部署口令

```bash
# API
cd worker && npx wrangler deploy

# Web
cd app && flutter build web --release \
  --dart-define=API_BASE=https://reset-radar.taiwan-traffic.workers.dev
npx wrangler pages deploy build/web --project-name=reset-radar-web --commit-dirty=true
```

## 為何不是 Firebase / Vercel 主幹

- 零 Auth 公開 JSON + 事件狀態機 → edge Worker + KV 足夠  
- 已有 wrangler / cron / multi-isolate hydrate  
- FCM 僅 Phase 2 native 可選  

## 運維注意

- KV last-write-wins：cron 與 request 並發可能互蓋（可接受 MVP；長期 D1/DO）  
- Free-auto 假綠 = P0：改模板／LLM 要跑 `worker/test/corpus_gate.test.ts`  
- Seed 歷史 **不** 強制延長 TTL（見 `clampSeedHistoryTtl`）  
