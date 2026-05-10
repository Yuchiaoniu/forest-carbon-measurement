## 1. 專案初始化

- [x] 1.1 建立 Node.js 專案結構（src/、scripts/、public/）
- [x] 1.2 安裝依賴：express、multer、exiftool-vendored、fluent-ffmpeg、@google/generative-ai、axios、better-sqlite3、ethers、dotenv
- [x] 1.3 建立 .env.example 含所有必要環境變數說明
- [x] 1.4 建立感光元件尺寸設備資料庫（src/data/sensorDb.js）

## 2. 影片上傳端點

- [x] 2.1 建立 Express 伺服器入口（src/index.js）
- [x] 2.2 實作 POST /api/upload（multer 接收、SHA-256 去重檢查）
- [x] 2.3 實作 GET /api/status/:jobId（輪詢進度）
- [x] 2.4 建立簡易 HTML 上傳介面（public/index.html）

## 3. SQLite 資料庫

- [x] 3.1 實作資料庫初始化（src/db/init.js，建立 projects/plots/trees 資料表）
- [x] 3.2 實作 trees 資料表 CRUD 操作（src/db/trees.js）
- [x] 3.3 實作影片雜湊去重查詢

## 4. 元數據擷取

- [x] 4.1 實作 ExifTool 元數據擷取（src/services/metadataService.js）
- [x] 4.2 實作設備型號查詢感光元件尺寸邏輯
- [x] 4.3 處理缺少 GPS 或未知設備的 fallback

## 5. 關鍵幀擷取

- [x] 5.1 實作 FFmpeg 均勻取 10 候選幀（src/services/frameService.js）
- [x] 5.2 實作 Laplacian variance 清晰度評分，選出最佳 3 幀
- [x] 5.3 實作 frameQuality 標記邏輯

## 6. 樹種辨識

- [x] 6.1 實作 Pl@ntNet API 呼叫（src/services/plantnetService.js）
- [x] 6.2 實作 Gemini Vision fallback 樹種辨識（src/services/geminiService.js）
- [x] 6.3 建立台灣造林樹種材積公式係數表（src/data/formulaDb.js）

## 7. AI 視覺分析

- [x] 7.1 實作 Gemini Flash 多幀分析 prompt（含結構化 JSON schema 要求）
- [x] 7.2 實作 3 幀結果中位數計算邏輯
- [x] 7.3 實作格式錯誤重試機制（最多 1 次）

## 8. DBH 與材積計算

- [x] 8.1 實作薄透鏡公式 DBH 計算（src/services/calculationService.js）
- [x] 8.2 實作各樹種材積公式（H-D 關係式 + 圓柱體積分）
- [x] 8.3 實作碳儲量換算（材積 × 密度 × BEF × 0.5）
- [x] 8.4 實作 confidence 信心等級評估邏輯

## 9. 區塊鏈整合

- [x] 9.1 撰寫 CarbonCredit.sol 智能合約（含 recordMeasurement、MeasurementRecorded 事件）
- [x] 9.2 實作合約部署腳本（scripts/deploy.js，自動寫入 .env）
- [x] 9.3 實作 ethers.js 合約呼叫服務（src/services/blockchainService.js）
- [x] 9.4 實作上鏈失敗時寫入 pending 並定時重試（每 5 分鐘）

## 10. 整合測試

- [x] 10.1 端對端測試：上傳 iPhone 影片 → 取得 DBH 結果
- [ ] 10.2 驗證 Besu 上鏈紀錄與 SQLite 一致
- [ ] 10.3 測試 Pl@ntNet 低信心 fallback 到 Gemini
- [ ] 10.4 測試影片重複上傳去重功能
- [ ] 10.5 測試 Besu 節點不可達時的 pending 重試機制
