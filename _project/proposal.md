## Why

台灣林業碳匯交易需要大量樹木胸徑（DBH）測量，傳統人工量測耗時且難以規模化。本系統讓用戶上傳手機拍攝的樹木影片，透過 AI 視覺分析自動估算 DBH、材積與碳儲量，並將測量紀錄寫入 GCP Besu 企業私鏈，提供不可篡改的碳匯數據基礎。

## What Changes

- **新增** 影片上傳 Web 介面（支援 iOS/Android 手機拍攝的 .mov/.mp4）
- **新增** 後端元數據擷取（ExifTool：焦距、GPS、設備型號）
- **新增** 關鍵幀擷取（FFmpeg：從影片取 3 張最清晰幀）
- **新增** 樹種辨識（Pl@ntNet API 為主，Gemini Vision 為備援）
- **新增** AI 視覺分析（Gemini Flash：量樹幹像素寬度、估算距離）
- **新增** DBH 計算引擎（薄透鏡公式 + 台灣林業局材積公式）
- **新增** SQLite 本地資料庫（專案、樣區、單株測量紀錄）
- **新增** Besu 智能合約部署腳本（一次性）
- **新增** 自動上鏈（每次測量完成後寫入私鏈）
- **新增** 三路徑依據幀可溯源化（§29）：`frame_analyses` 表落地每幀 Gemini 判讀；dashboard 三路徑表可展開看 Path 0/A/B 各自依據幀
- **新增** 評估嚴謹度修正（§30，RQ1 循環論證）：`ground_truth.manual_dbh_cm` 拆出人工皮尺實量作獨立基準；evaluationService 改 per-path 計算（Path 0/A/B vs manual）；dashboard 每筆資料加路徑誤差比較區塊

## Capabilities

### New Capabilities

- `video-upload`: 用戶上傳影片，後端接收並暫存
- `metadata-extraction`: ExifTool 擷取焦距、GPS、設備型號、Scene Illuminance
- `frame-extraction`: FFmpeg 取候選幀，選最清晰 3 幀
- `species-identification`: Pl@ntNet + Gemini 雙層樹種辨識
- `ai-trunk-analysis`: Gemini Flash 分析關鍵幀，回傳像素寬度與距離估算
- `dbh-calculation`: 套用薄透鏡公式計算 DBH，再套台灣材積公式得材積與碳儲量
- `data-storage`: SQLite 儲存專案、樣區、測量紀錄
- `blockchain-recording`: ethers.js 連接 Besu 私鏈，自動寫入每筆測量

### Modified Capabilities

（無既有 spec）

## Impact

- **依賴套件**：Node.js、Express、multer、exiftool-vendored、fluent-ffmpeg、@google/generative-ai、axios（Pl@ntNet）、better-sqlite3、ethers
- **外部 API**：Gemini Flash（免費層）、Pl@ntNet（500次/天免費）
- **基礎設施**：GCP 上已有 Besu 私鏈節點，需填入 RPC URL 與 Chain ID
- **精度說明**：單棵樹 DBH 誤差約 ±20-25%，樣區 25 棵以上平均後可達 ±5%，符合 Verra VCS 碳匯樣區精度要求
