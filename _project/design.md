## Context

用戶使用 iOS/Android 手機原生相機拍攝樹木影片，上傳至 Web 應用程式。後端透過 ExifTool 擷取相機物理常數（焦距、感光元件尺寸、GPS），FFmpeg 取得清晰關鍵幀，再透過 Gemini Flash Vision 分析像素尺度並估算距離，套用薄透鏡公式計算 DBH，最終寫入 GCP Besu 企業私鏈。系統使用 Node.js + SQLite 作為後端，不依賴複雜的 SfM 或 IMU 數據管道。

## Goals / Non-Goals

**Goals:**
- 單一影片上傳後自動完成從元數據擷取到區塊鏈記錄的全流程
- 零用戶手動輸入（無需距離、身高或實體參照物）
- 支援 iOS 與 Android 手機錄製的影片
- DBH 精度：單棵 ±20-25%，樣區（≥25 棵）平均後 ±5%
- Node.js 單一後端，SQLite 本地儲存，.env 設定即可接入任意 Besu 節點

**Non-Goals:**
- 不追求單棵樹 ±5% 精度（需 LiDAR 或已知參照物）
- 不支援 LiDAR 深度資料（需自訂 iOS App）
- 不做即時影片串流分析
- 不提供碳權交易所對接（只產生上鏈紀錄）
- 不做樹高直接測量（用台灣林業局 H-D 合積式推算）

## Decisions

### D1：AI 模型選擇 — Gemini Flash（免費）＋ Pl@ntNet

**選擇**：Gemini Flash 作為視覺分析主力，Pl@ntNet 作為樹種辨識主力。

**理由**：Gemini Flash 提供每日 1500 次免費 API 呼叫，足夠小規模碳匯調查。Pl@ntNet 是植物分類專門模型，準確率高於通用視覺模型。兩者組合覆蓋所有場景且零成本。

**捨棄方案**：Claude API（需付費）、本地視覺模型（需 GPU 基礎設施）。

### D2：傳關鍵幀而非完整影片給 AI

**選擇**：FFmpeg 從影片取 10 個候選幀，用 Laplacian variance 選最清晰 3 幀，打包進單一 Gemini API 呼叫。

**理由**：Gemini 即使接受影片也是內部取幀，不如我們自己控制品質。3 幀取中位數可排除遮蔽、模糊等異常值。成本僅為傳完整影片的 1/10。

**捨棄方案**：傳完整影片（成本高、品質不可控）、只傳 1 幀（無法排除異常值）。

### D3：距離估算 — AI 估距為主，多信號為輔

**選擇**：Phase 1 由 Gemini 直接估算相機到樹幹距離，作為 Z 代入公式。Phase 2 加入地面平面幾何（Depth-Anything）與 iPhone V9 校準表。

**理由**：AI 估距誤差 ±25%，但樣區平均後符合碳匯精度。Phase 2 優化是獨立模組，不阻擋 MVP 上線。

### D4：資料庫 — SQLite

**選擇**：better-sqlite3，單檔本地資料庫。

**理由**：部署零依賴、效能足夠、可直接備份。碳匯調查資料量不大（每天數百筆），不需要 PostgreSQL。

### D5：區塊鏈寫入 — 每筆測量自動上鏈

**選擇**：ethers.js 連接 Besu JSON-RPC，測量完成後同步呼叫合約 `recordMeasurement`，transaction hash 存入 SQLite。

**理由**：提供不可篡改的碳匯數據記錄，符合碳權交易所對數據可追溯性的要求。

## Risks / Trade-offs

- **AI 估距誤差 ±25%** → 要求用戶每樣區至少測量 25 棵樹，統計平均後達標
- **森林昏暗環境影響辨識** → 選最清晰幀、Gemini 有一定低光處理能力，Pl@ntNet 信心低時自動 fallback 到 Gemini
- **感光元件尺寸需查表** → 內建主流 iPhone/Samsung/Pixel 設備資料庫，未收錄機型 fallback 到 AI 估距（誤差略增）
- **Besu 節點不可用** → 測量結果仍存 SQLite，待節點恢復後補上鏈（隊列機制）
- **Pl@ntNet 每日 500 次上限** → 超過後自動切換 Gemini Vision，樹種辨識準確率略降

## Migration Plan

1. 填寫 `.env`（Besu 節點資訊、API 金鑰）
2. `npm install`
3. `node scripts/deploy.js`（部署 CarbonCredit 合約，自動寫入 CONTRACT_ADDRESS）
4. `npm start`（啟動後端）
5. 開啟瀏覽器上傳第一支影片測試

回滾：刪除 `data.db` 即可重置本地資料；合約已上鏈不可回滾（設計如此）。

## Open Questions

- 台灣林業局各樹種最新材積公式版本？（需確認使用哪年版本）
- Besu 私鏈的 Chain ID 與 RPC URL？（另一視窗的 gcp-besu-private-chain 提供）
- Pl@ntNet 是否有台灣特有種（台灣杉、台灣肖楠）的訓練資料？
