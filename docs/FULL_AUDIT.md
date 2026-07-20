# 完整審計報告 — RESET Radar

> 日期：2026-07-20  
> 範圍：PURPOSE / PLAN / dual-review / 多路探索代理 / 本機與 X·Web 搜尋  
> agy：環境阻擋 external CLI（僅 probe 成功）；探索代理 ×4 + 主線搜尋已完成  

---

## 1. 你的目的（完整理解）

| # | 目的 | 文件位置 |
|---|------|----------|
| 1 | 打開就知道 **有沒有 RESET**，**不要 Auth** | PURPOSE §1–2 |
| 2 | 覆蓋你在用的工具：Codex / Claude / Grok / Antigravity / Kimi / GLM | 研究後：**僅前兩家有公開 hard-reset 流** |
| 3 | Flutter App + Web | PLAN：MVP **Web first** |
| 4 | 小盈利：廣告／推播／訂閱 | Free 看板 + TG；Pro **延後** |
| 5 | 跟市面競品學最好做法 | 零 Auth 學 codex-resets；信任學 dual-review 修訂 |

**關鍵糾偏（用戶）：** 不是「先個人 OAuth 看 %」，是「公開雷達」。

---

## 2. 文件現況盤點

| 檔案 | 狀態 | 說明 |
|------|------|------|
| `docs/PURPOSE.md` | v2 → **建議 v3** | 需誠實時效定位、High≡confirmed |
| `docs/PLAN.md` | v2 → **建議 v3** | 需 heartbeat、雙軸狀態、API 金樣 |
| `docs/api-v1-snapshot.md` | **新建** | 凍結契約 |
| dual-review codex/fable | 完成 | 雙方 REQUEST CHANGES → 已吸收入 v2 |
| synthesis | 略樂觀 | 對抗稽核指出 v2 仍有 4 blocker |
| 對抗稽核（explore） | 完成 | CONDITIONAL FAIL → 修 v3 |
| 公開源研究（explore） | 完成 | 僅 Codex+Claude 有強訊號 |
| CF 架構（explore） | 完成 | D1 schema + Admin API 可開工 |
| Steelman（explore） | 完成 | **有條件 GO** |

---

## 3. 競品與訊號源（新搜尋合併）

### 3.1 公開 hard-reset 訊號強度

| Provider | 公開 hard reset？ | Primary 源 | 可用性 |
|----------|-------------------|------------|--------|
| **Codex** | 極強 | @thsottiaux；輔 @OpenAIDevs / @OpenAI / @sama | ★★★★★ |
| **Claude** | 強、句型固定 | @ClaudeDevs「We've reset 5-hour and weekly…」約 5–10 天一次（2026 中） | ★★★★★ |
| Grok / SuperGrok | **無穩定流** | 個人週期 | ☆ |
| Kimi | **無** | 政策／容量公告 | ☆ |
| GLM / z.ai | **無** | 促銷倍率 | ☆ |
| Antigravity | **無** | rolling 5h；用戶「安靜恢復」傳聞 | ☆ |

### 3.2 既有產品

| 產品 | 類型 | Auth | 對你的啟示 |
|------|------|------|------------|
| [codex-resets.com](https://codex-resets.com/) | Codex 公開雷達 | 零 | 標竿；你要多源+稽核 |
| [codex-reset-radar.pages.dev](https://codex-reset-radar.pages.dev/) | 中文生態雷達 | 零 | 競品密度 |
| [willcodexquotareset.com](https://www.willcodexquotareset.com/) | 預測 | 零 | 可作冗餘，勿 sole source |
| [t.me/codexreset](https://t.me/codexreset) | TG 推播 | 零 | Free 通道對標 |
| CodexBar | 個人 % | 本機 | **互補** |
| Limits / AI Usage | 個人 % | 登入 | 第二層 |
| Status pages | 掛了沒 | 零 | **≠** usage reset |

### 3.3 X API 成本（讀 2 帳號）

官方 pay-per-use 約 **$0.005/post read**（見 [X API pricing](https://docs.x.com/x-api/getting-started/pricing)）。  
只跟 Tibo + ClaudeDevs：**安靜月約 $1–5**。  
→ PLAN 寫「X API 太貴所以半自動」**過度**；半自動主因應是 **信任／admin gate／合規**，不是錢。  
**建議 v3：** MVP 仍半自動；**Phase 1.5 可加便宜 PPU 自動拉 candidate**（仍不自動綠）。

---

## 4. Dual-review 結論回顧

| | Codex | Fable |
|--|-------|-------|
| Verdict | REQUEST CHANGES | REQUEST CHANGES |
| 共識 | 禁關鍵字直綠、要 TTL、防假平靜、砍四週 scope | 同 |
| 修進 v2 | admin 綠、TTL、health 表、半自動、TG Free、Pro 移出 | 同 |

---

## 5. 對抗稽核（完整看一遍 v2）— 仍開著的洞

| ID | 問題 | 嚴重度 |
|----|------|--------|
| **H1** | 半自動下「6h 無 ingest = stale」會把正常平靜打成中斷，或實作寫死 fresh 變成劇場 | Critical |
| **H2** | stale 時若熄滅仍在 TTL 的綠燈 = 錯維度（監控故障 ≠ 否定已發布事件） | Critical |
| **H3** | display_status 缺優先序／雙軸；不是完整狀態機 | Critical |
| **H4** | 無 snapshot JSON 金樣 → Flutter 不能當契約凍結 | Critical |
| **H5** | 對外若暗示「比 codex-resets 更快」= 產品謊言（人肉更慢） | Important |
| **H6** | detected 10–15min SLO 在無自動偵測下是空 KPI | Important |
| **H7** | banked 缺 claim_url／「非自動到帳」資料欄 | Important |

---

## 6. 架構結論（CF Worker）

- **可開工**：D1 分表、Admin ingest/confirm、Public snapshot、OG、TG outbox  
- **必加 heartbeat API**：更新 `last_operator_heartbeat_at`  
- **低流量 $0** 可行；注意 poll 頻率撞 Free 10萬 req/日 → s-maxage + 客戶端 30–60s  
- 完整 schema 見探索報告（可落入 `worker/migrations`）

---

## 7. Steelman / Attack / GO-NO-GO

### Steelman
信任產品：零登入、可稽核、fail-closed、與 CodexBar 互補。

### Attack
假綠燈一次致命；solo 延遲；事件過稀；與 codex-resets 無感差異。

### 裁決：**有條件 GO**

| GO 若 | NO-GO 若 |
|-------|----------|
| 接受「信任／雙源」定位，不拼 Codex 時效第一 | 為 demo 放寬 confirm |
| W1 鎖 Codex 管線 + 契約 + Board | 堅持一週六家+Pro+爬蟲 |
| 假綠燈 = P0 | 北星改成預測 reset 或個人 % |

---

## 8. 對 PURPOSE / PLAN 的 v3 必修清單

見同日提交的 PURPOSE/PLAN v3 修訂：

1. 誠實定位：不追求優於 codex-resets 的時效  
2. heartbeat + 雙軸狀態 + 綠燈×stale 政策  
3. API 金樣 `docs/api-v1-snapshot.md`  
4. 轉移表與 merge 鍵  
5. 修正 SLO 文案  
6. X API 成本敘事修正  
7. 競品表加入 codex-reset-radar / willcodex / t.me/codexreset  

---

## 9. 代理與搜尋產出來源

| 來源 | 產出 |
|------|------|
| Codex dual-review | `.omc/research/dual-review-codex.md` |
| Fable dual-review | `.omc/research/dual-review-fable.md` |
| 合成 | `.omc/research/dual-review-synthesis.md` |
| 對抗稽核 explore | 本報告 §5 |
| 公開源 explore | 本報告 §3 |
| CF 架構 explore | 可落 `worker/` |
| Steelman explore | 本報告 §7 |
| 主線 X/Web search | ClaudeDevs / Tibo 實推、X pricing |
| agy | **環境 hook 阻擋 external CLI**；無法完成本輪多路 agy 報告（首次 probe `AGY_OK` 曾成功） |

---

## 10. 最終一句

**目的清楚且正確；計劃 v2 方向對，但仍有 4 個工程 Critical。**  
修完 v3（heartbeat + API 金樣 + 雙軸狀態 + 誠實定位）後 → **Conditional GO 進 W1 骨架**。  
六家工具裡，**公開 RESET 雷達只能先吃飽 Codex + Claude**；其餘只能「覆蓋說明」，否則假綠燈。
