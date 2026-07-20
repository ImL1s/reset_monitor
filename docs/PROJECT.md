# 專案整理（2026-07-21）

## 目錄角色

| 路徑 | 是否進 repo | 說明 |
|------|-------------|------|
| `worker/` | ✅ | API + free-auto cron；測試 `npm test` |
| `app/` | ✅ | Flutter Web 優先 |
| `docs/` | ✅ | 產品／契約／部署／spikes |
| `plans/` | ✅ | improve 執行計畫（已 DONE） |
| `brand/` | ✅ | Logo 資產 |
| `fixtures/` | ✅ | 分類／gate fixtures |
| `scripts/` | ✅ | verify / corpus |
| `.github/` | ✅ | CI |
| `.omc/` / `**/.omc/` | ❌ gitignore | Agent 運行狀態；勿 commit |
| `worker/.wrangler/` | ❌ | 本機 wrangler |
| `app/build/` | ❌ | Flutter build |

## 真相來源優先序

1. **Runtime 行為** — `worker/src`、`app/lib`
2. **README.md** — 現況與連結
3. **docs/api-v1-snapshot.md** — 公開契約
4. **docs/PURPOSE.md** / **PLAN.md v4** — 產品意圖
5. **docs/FULL_AUDIT.md** — 歷史 only
6. **plans/** — 已執行改善追蹤

## 驗證

```bash
cd worker && npm test && npm run typecheck
cd app && flutter analyze && flutter test
./scripts/verify-parity.sh
```

## 部署

見 `docs/HOSTING.md`。
