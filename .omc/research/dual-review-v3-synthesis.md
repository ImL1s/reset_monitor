# Dual-Review v3 合成裁決

## 初審

| Reviewer | Verdict |
|----------|---------|
| Fable 5 | **APPROVE WITH MINOR FIXES** |
| Codex | **REQUEST CHANGES**（C1 freshness 文案、C2 測試閘門、C3 契約完整度） |

依 strictest wins → 初審文件閘門未開。

## 同回合修訂（對 Codex C1–C3）

| ID | 處理 |
|----|------|
| C1 | PLAN staleness monitor 改為只依 heartbeat；首屏欄位說明分開 ingest vs heartbeat |
| C2 | PLAN 測試閘門改狀態矩陣；active = confirmed && !retracted && now < display_until；單元測試 retracted / 48h silence |
| C3 | api-v1-snapshot 補 required 規則、DTO 一致、pending shape、欄位表 |

## 合成 Verdict（文件）

**APPROVE WITH MINOR FIXES** — 可進／續 W1。

## 實作驗證（已跑）

- `npm test`：**14 pass**
- `GET /v1/snapshot`：codex=`active_confirmed`，claude=`no_recent_confirmed`，其餘 `not_monitored`
- Flutter Board：`app/lib/main.dart`
- API 本機：`npm run dev:local` → :8787

## 報告路徑

- `.omc/research/dual-review-v3-codex.md`
- `.omc/research/dual-review-v3-fable.md`
