# Dual-Review 合成裁決 — RESET Radar Plan

> 日期：2026-07-20  
> Reviewers：Codex GPT-5.6-sol max + Claude Fable 5 xhigh  
> 對象：`docs/PURPOSE.md` v1、`docs/PLAN.md` v1  
> 修訂產出：PURPOSE/PLAN **v2**

---

## Combined Verdict

### 初審：**REQUEST CHANGES**（雙方一致）

依 dual-review 規則：**strictest wins** → 初審不得開工實作產品碼，須先修計劃。

### 修訂後狀態（本 orchestrator）

- v2：吸收 dual-review Critical  
- **v3**（完整審計後）：heartbeat 語意、雙軸狀態、API 金樣、誠實時效  
- 見 `docs/FULL_AUDIT.md`、`docs/api-v1-snapshot.md`  
- 建議：**v3 可進 W1 骨架**（Worker + fixtures + Board mock→真 API）

---

## Critical 合併與處理

| ID | 來源 | 問題 | v2 處理 |
|----|------|------|---------|
| C1 | 雙方 | 關鍵字即綠燈可被 teaser／疑問句 game | **Admin 核准才 confirmed**；自動僅 detected |
| C1b | Fable | Handle 可搶註 | 白名單改 **X user ID** |
| C2 | Fable | 匿名黃燈 Sybil | **群眾回報移出 MVP** |
| C3 | 雙方 | X 管線未定 | **半自動 + admin** 定案；不爬蟲 |
| C4 | 雙方 | 無綠燈 TTL／狀態轉移 | **display_until、狀態表、合併規則** |
| C5 | Fable | Flutter Web 無 OG／SEO | **Worker OG HTML** |
| Cx | Codex | 來源中斷顯示「平靜」 | **source_health fail-closed** |
| Cy | Codex | 四週過載 | **MVP 收斂：Web、兩源、TG、無 Pro** |

---

## Important 合併（已納入或明確延後）

| 項 | 處理 |
|----|------|
| 模型拆 Raw/Candidate/Published/Snapshot/Outbox | PLAN §3.1 |
| 法務檢查表 | PLAN 啟動清單 + W4 disclaimer；細節實作時補全文 |
| 禁 WebView／貼 session | PURPOSE + PLAN Phase 2 |
| Free Timeline vs Pro 歷史 | Free 90 天級；Pro 更長；MVP 無 Pro |
| Free 通知通道 | **Telegram** |
| 歷史回填 | W1/W2 |
| 個人層 Web CORS | **僅 mobile** |
| Pro 移出 MVP | 第 5–6 週+ |

---

## Divergence（雙方視角差異 — 高價值）

| 點 | Codex | Fable | 採納 |
|----|-------|-------|------|
| 自動綠燈 | 官方產品帳可嚴格條件自動 | MVP 一律 admin | **MVP 一律 admin**（較嚴） |
| 四週是否含 TG | 可含單一路通知 | 含 | **含 TG** |
| 員工帳權威 | 不得輕易自動綠 | staff 分級 + admin | **staff + admin** |
| 分享／SEO | 提及 OG | **Critical** 強調 | **Critical 修** |

---

## Decision

| 問題 | 答案 |
|------|------|
| v1 能否直接寫產品碼？ | **否** |
| v2 能否進 W1？ | **是**（建議對照 §11 清單） |
| 是否需再 dual-review？ | 可選 mini；Critical 已閉環則可开工 |
| 下一步 | `worker/` 公開 API + Admin 半自動 + Flutter Web Board + fixtures |

---

## 保留雙方肯定的優點

- 零登入首屏、核心狀態不付費  
- Unknown > 假綠燈  
- 群眾不單獨轉綠  
- Codex + Claude 先做深  
- Pivot 記錄清楚（個人 OAuth → 公開雷達）  

---

## 檔案索引

| 檔 | 路徑 |
|----|------|
| 目的 | `docs/PURPOSE.md` |
| 計劃 | `docs/PLAN.md` |
| Codex 報告 | `.omc/research/dual-review-codex.md` |
| Fable 報告 | `.omc/research/dual-review-fable.md` |
| 本合成 | `.omc/research/dual-review-synthesis.md` |
