# Hosting 決策（2026-07-20）

## 決策摘要

| 排名 | 平台 | 角色 |
|------|------|------|
| **1** | **Cloudflare** | **主平台**：API Worker + D1 +（前端）Pages |
| **2** | Firebase Hosting | **僅可選**：Flutter Web 靜態；**不當** event API／DB |
| **3** | Vercel | **僅可選**：Flutter Web 靜態；**不當** API |

**不選 Vercel／Firebase 當全家桶的原因：**  
本 repo 已是 Hono Worker + D1 契約；你的 Firebase 生態強在 App／FCM，不是 edge SQL 狀態機。Vercel 帳號有一些 Node 站，但對 D1／Admin／OG 無增益。

## 依你本機現況的證據

| 系統 | 現況 |
|------|------|
| Firebase CLI | 登入 `dio071512@gmail.com`，多專案（clawnode、pdf-god…） |
| Firebase 生態 | 大量上架 App 用 mikuxyuki／aa22396584；Hosting 有經驗（如 flashclaw.web.app） |
| Vercel | 登入 `aa22396584-6131`，多為 React／demo／Node，**無**此產品對應專案 |
| Cloudflare | `wrangler whoami` → `aa22396584@gmail.com`，**workers + d1 + pages write** |

## 目標拓樸

```
Flutter Web  →  Cloudflare Pages  (build/web, API_BASE=Worker URL)
Public+Admin →  Cloudflare Worker (Hono)
Events       →  D1 (reset-radar)
Cron         →  Worker triggers (health/TTL recompute)
Notify       →  Worker → Telegram (W3)
(Optional)   →  Firebase Messaging only for native later
```

## 為何不是 Firebase 主幹

- MVP **零 Auth** 公開 JSON，不需要 Firebase Auth／Firestore 即時同步  
- 事件是關聯狀態機（candidate／confirm／retract／audit）→ **SQL/D1**  
- 已寫好 Worker；搬 Functions = 重寫  
- FCM 是 Phase 2 可選，不綁死現在  

## 為何不是 Vercel 主幹

- 無 D1；Preview 對 Flutter Web 價值有限  
- Hono 可跑但與現 wrangler／migration 脫節  

## 部署口令

見 README「Deploy」與 `worker/wrangler.toml`。
