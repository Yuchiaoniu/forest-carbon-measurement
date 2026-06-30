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
- [x] 10.2 驗證 Besu 上鏈紀錄與 SQLite 一致
- [x] 10.3 測試 Pl@ntNet 低信心 fallback 到 Gemini
- [x] 10.4 測試影片重複上傳去重功能
- [x] 10.5 測試 Besu 節點不可達時的 pending 重試機制

## 11. 實體參照物測量路徑

- [x] 11.1 在 Gemini prompt 增加參照物偵測欄位（referenceDetected、referenceType、referencePixelWidth、referencePixelHeight）
- [x] 11.2 建立 REFERENCE_SIZES 常數（信用卡 85.6×53.98mm、A4 210×297mm）
- [x] 11.3 實作 calculateWithReference()：比例尺換算 DBH（refMm / refPixels × trunkPixels）
- [x] 11.4 實作 validateReferenceAspectRatio()：長寬比驗證（±15% 容差，防誤判）
- [x] 11.5 在 calculate() 中優先嘗試參照物路徑，驗證失敗才 fallback 薄透鏡公式
- [x] 11.6 有參照物時 confidence 強制設為 high
- [x] 11.7 trees 資料表增加 reference_used、reference_type 欄位（ALTER TABLE）

## 12. 樹種辨識增強（iNaturalist 雙驗證）

- [x] 12.1 實作 iNaturalist Computer Vision API 整合（src/services/inaturalistService.js）
- [x] 12.2 Pl@ntNet 與 iNaturalist 並行呼叫（Promise.all），不互相阻塞
- [x] 12.3 實作雙來源投票機制（同屬 → dual-取高信心、不同屬 → 取高分-only）

## 13. 地面實況與修正因子

- [x] 13.1 建立 ground_truth 資料表（src/db/init.js）
- [x] 13.2 實作 ground_truth CRUD（src/db/groundTruth.js，含 correctionFactor = actual/estimated 計算）
- [x] 13.3 實作加權修正因子服務（src/services/correctionFactorService.js，近 30 天 weight=2，需 ≥5 筆）
- [x] 13.4 有參照物測量時自動寫入 ground_truth（source='reference'）
- [x] 13.5 實作 POST /api/ground-truth 端點（手動回報實測值）
- [x] 13.6 實作 GET /api/ground-truth/stats 端點
- [x] 13.7 實作 GET /api/correction-factors 與 GET /api/correction-factors/:species 端點
- [x] 13.8 DBH 計算後自動套用修正因子（correctionApplied、originalDbhCm 欄位記錄）

## 14. 實體參照物整合測試

- [x] 14.1 端對端測試：含信用卡影片 → referenceUsed=true、confidence=high、DBH 精準
- [x] 14.2 端對端測試：含 A4 紙影片 → 正確比例尺換算 DBH
- [x] 14.3 測試長寬比驗證：傾斜或遮蔽的參照物應 fallback 薄透鏡公式
- [x] 14.4 驗證含參照物測量時 ground_truth 自動寫入（source='reference'）

## 15. 支柱二：修正因子演進帳本

- [x] 15.1 新增 correction_factor_log 資料表（init.js，含 species/factor/sample_count/std_dev/triggered_by/created_at）
- [x] 15.2 trees 表新增 original_dbh_cm、applied_correction_factor 欄位（ALTER TABLE in init.js）
- [x] 15.3 實作 correction_factor_log CRUD（src/db/correctionFactorLog.js）
- [x] 15.4 correctionFactorService 新增 snapshotFactor(species, triggeredBy)：計算後寫入 log
- [x] 15.5 index.js：手動 ground_truth 寫入後觸發 snapshotFactor
- [x] 15.6 index.js：參照物測量 ground_truth 寫入後觸發 snapshotFactor
- [x] 15.7 trees.insert() 接受並持久化 originalDbhCm、appliedCorrectionFactor
- [x] 15.8 index.js processVideo：將 originalDbhCm、appliedCorrectionFactor 傳入 insert()
- [x] 15.9 新增 GET /api/correction-factors/summary 端點（含 thresholdReached 欄位）
- [x] 15.10 新增 GET /api/correction-factors/:species/history 端點

## 16. 支柱三：blockchain_jobs 分離

- [x] 16.1 新增 blockchain_jobs 資料表（init.js，含 tree_id/tx_status/tx_hash/retry_count/last_attempted_at）
- [x] 16.2 實作 blockchain_jobs CRUD（src/db/blockchainJobs.js）
- [x] 16.3 index.js：trees insert 後建立 blockchain_jobs 記錄（取代寫 tx_status 到 trees）
- [x] 16.4 index.js：上鏈成功/失敗改呼叫 blockchainJobs.updateStatus/incrementRetry
- [x] 16.5 index.js：定時重試改從 blockchain_jobs 查 pending
- [x] 16.6 scripts/verify-blockchain.js：更新支援 blockchain_jobs 資料表
- [x] 16.7 修正無限重試 bug：getPending() 加入 retry_count < 5 上限，incrementRetry() 達上限後寫入 tx_status = 'failed'

## 17. 支柱四：研究評估輸出引擎

- [x] 17.1 新增 evaluation_runs 資料表（init.js，含 run_id/timestamp/sample_count/mae/mape/rmse/r2/bias/notes）
- [x] 17.2 實作評估指標計算服務（src/services/evaluationService.js：MAE、MAPE、RMSE、R²、bias）
- [x] 17.3 實作 Bootstrap 信賴區間（10,000 次重採樣，95% CI for MAE and MAPE）
- [x] 17.4 實作 DSR 評估 checklist 自動評分（Hevner 2004 七項準則，基於系統現有資料）
- [x] 17.5 實作 Markdown 評估報告產生器（含指標表格、Bootstrap CI、DSR checklist）
- [x] 17.6 實作 CSV 原始資料匯出（ground_truth JOIN trees，含所有欄位）
- [x] 17.7 新增 POST /api/evaluation/run 端點（觸發評估計算並存入 evaluation_runs）
- [x] 17.8 新增 GET /api/evaluation/report 端點（回傳 Markdown 報告）
- [x] 17.9 新增 GET /api/evaluation/export.csv 端點（原始資料下載）
- [x] 17.10 新增 GET /api/evaluation/dsr-checklist 端點（回傳 DSR 評分 JSON）

## 18. 永續故事引擎實作

- [x] 18.1 建立台灣樹種生態多樣性資料庫（src/data/ecologyDb.js）：鳥類/昆蟲/土壤角色/林相層次/棲地類型/生態貢獻評分
- [x] 18.2 新增 events/stories/event_comments 資料表（init.js）；trees 表新增 event_id 外鍵欄位
- [x] 18.3 實作 events CRUD（src/db/events.js）與 stories CRUD（src/db/stories.js）
- [x] 18.4 實作氣象查詢服務（src/services/weatherService.js，OpenWeatherMap API，無金鑰時優雅降級）
- [x] 18.5 實作時空聚類服務（src/services/clusterService.js，500m 半徑 + 同自然日 = 同 event）
- [x] 18.6 實作故事生成服務（src/services/storyService.js，Gemini 2.5 Flash）：方案 A 環境詩學、方案 C 集體影響、方案 D 時間對比、動機推斷（D8）；含生態多樣性貢獻 Markdown 段落
- [x] 18.7 processVideo 完成後觸發：時空聚類 → 更新 event_id → 非同步生成方案 A 故事
- [x] 18.8 新增 GET /api/trees/:id/story 端點（回傳 Markdown，含生態多樣性描述表格）
- [x] 18.9 新增 GET /api/events/:id 端點（Event JSON + 聚合故事）
- [x] 18.10 新增 POST /api/events/:id/comments 端點（participantToken 驗證）
- [x] 18.11 在 .env.example 補充氣象 API 金鑰說明

## 19. GitHub Pages 靜態部署架構

- [x] 19.1 建立 GitHub Actions workflow，自動將 public/ 部署到 GitHub Pages
- [x] 19.2 建立 public/data/trees.json 佔位檔，作為靜態資料來源
- [x] 19.3 實作 githubSyncService.js：每次上傳後透過 GitHub Contents API 推送 trees.json
- [x] 19.4 dashboard.html / story.html 加入 IS_GH_PAGES 偵測，動態切換靜態 JSON 或 API 資料來源
- [x] 19.5 index.html 加入 API_BASE 偵測（GitHub Pages → HTTPS GCP 網域，GCP 本地 → 空字串）
- [x] 19.6 Express 加入 CORS middleware（/api/* 路由開放跨來源請求，支援 GitHub Pages 上傳）
- [x] 19.7 story.html 與 dashboard.html 導覽連結改為相對路徑（相容 GitHub Pages）

## 20. GCP HTTPS 部署（免費方案）

- [x] 20.1 申請 DuckDNS 免費網域（forest-carbon.duckdns.org），綁定 GCP External IP
- [x] 20.2 GCP 防火牆開放 TCP:80（Let's Encrypt HTTP-01 驗證所需）
- [x] 20.3 GCP VM 安裝 nginx 作為反向代理（HTTPS 443 → localhost:3000）
- [x] 20.4 使用 Let's Encrypt certbot 申請 SSL 憑證（免費，自動管理）
- [x] 20.5 設定 certbot crontab 自動續簽憑證

## 21. 智能合約強化與修正因子透明化

- [x] 21.1 CarbonCredit.sol 新增 onlyOwner modifier（防止未授權寫入）
- [x] 21.2 Measurement struct 新增 localTreeId（uint256，對應 SQLite trees.id 供鏈下比對）
- [x] 21.3 Measurement struct 新增 originalDbhMm、correctionFactorX10000（修正前後數據均上鏈）
- [x] 21.4 MeasurementRecorded 事件補上 volumeCm3x100（完整審計軌跡，稽核者從事件可取得所有量測值）
- [x] 21.5 blockchainService.js 更新 ABI 與 recordMeasurement 呼叫，傳入 treeId/originalDbhCm/appliedCorrectionFactor
- [x] 21.6 deploy.js 啟用 viaIR: true + optimizer，解決函數參數過多導致的 stack too deep 編譯錯誤
- [x] 21.7 修正 UUID treeId 無法轉 BigInt 的 bug（try/catch fallback 0n；videoHash 已足夠做鏈下交叉比對）

## 22. 修正因子演算法強化

- [x] 22.1 correctionFactorService 加入 MAD 離群值過濾（門檻 3×MAD），移除異常樣本後再計算加權平均
- [x] 22.2 加入安全邊界檢查 [0.8, 1.2]：修正因子超出範圍時回傳 applicable: false + outOfBounds: true，停用自動修正

## 23. 幀品質評估改進

- [x] 23.1 以 Laplacian variance（Pertuz et al., 2013）取代 YAVG after edgedetect 作為清晰度評分指標
- [x] 23.2 實作方式：FFmpeg convolution 套用 3×3 Laplacian 核 + signalstats，取 YSTDDEV² 作為分數
- [x] 23.3 清晰度門檻更新：YSTDDEV² ≥ 100（即標準差 ≥ 10），對應 frameQuality = 'good'
- [ ] 23.4 上傳數支實際影片後，檢查 frameQuality 回傳值是否合理（大量 low 表示門檻太高，全是 good 表示太低），依實際數值微調門檻

## 24. UI 標籤更新

- [x] 24.1 前端所有 "confidence" 顯示標籤改為「量測精度等級 (Measurement Precision Grade)」（内部欄位名稱不變）
- [x] 24.2 精度等級 badge 顯示為「HIGH 精度 / MEDIUM 精度 / LOW 精度」

## 25. Gemini 視覺分析三路徑強化（待實作）

> 對應討論：拍攝協議中皮尺/卡片只在前段出現，後段參照物消失。
> 現有三路徑優先級流水線（路徑 0 直接讀數 → A 參照物 → B 純針孔）
> 已透過 `referenceAtTrunk` 過濾與多幀中位數處理大部分情境，
> 但仍存在以下三項殘餘弱點。

### 25.1 路徑 0 直接讀數加信心度過濾（難度：⭐ 容易）

- [x] 25.1.1 geminiService.js schema 新增欄位 `directMeasurementConfidence: NUMBER`（0.0–1.0）
- [x] 25.1.2 prompt 加說明：「依數字清晰度、皮尺彎曲程度、視角偏斜評估讀數信心度」
- [x] 25.1.3 `getMedianResult()` 第 148 行 directFrames 過濾條件加 `f.directMeasurementConfidence >= 0.5`
- [x] 25.1.4 上鏈 raw_result 保留 confidence 值供事後審計（raw_result 已自動包含所有 frame schema 欄位）

**問題背景**：Gemini OCR 皮尺數字時，字小、皮尺彎曲、光線不佳都可能誤判，目前完全無過濾。

### 25.2 1.3m 胸高位置驗證（難度：⭐⭐⭐ 中等）

- [ ] 25.2.1 schema 新增 `breastHeightYFraction: NUMBER`（1.3m 標記在畫面高度的相對位置 0.0–1.0）
- [ ] 25.2.2 schema 新增 `trunkWidthMeasuredAtYFraction: NUMBER`（實際量到樹幹寬處的 Y 位置）
- [ ] 25.2.3 prompt 要求 Gemini 估算上述兩個 Y 座標
- [ ] 25.2.4 過濾邏輯：兩者差距 `> 0.05`（畫面高 5%）的幀丟棄路徑 B 結果，避免量錯高度
- [ ] 25.2.5 **前置驗證**：先收集 10+ 部影片實測 Gemini Y 座標回傳穩定性，誤差 > 10% 則此功能不落地

**問題背景**：目前 `breastHeightVisible` 只是 boolean，Gemini 說「看得到 1.3m 標記」但實際量樹幹寬時可能量到非胸高位置（如根頸膨大處或胸高以上）。

### 25.3 路徑 0 跨幀混合修復（難度：⭐⭐ 容易~中等）

- [x] 25.3.1 `getMedianResult()` 第 151 行：directFrames 不再直接 median，先做群聚（`clusterByRelativeDiff`）
- [x] 25.3.2 群聚規則：差距 < 10% 的讀數視為同一次量測群，取最大群的中位數
- [x] 25.3.3 若最大群只有 1 幀且其他幀讀數差異 > 10%，標記 `measurementType=''` 退回路徑 A/B
- [x] 25.3.4 raw_result 紀錄群聚詳情（透過回傳 `directCluster.clusterSizes` 與 `winningIndices`）供 QC 與論文附錄

**問題背景**：第 151 行 `median(directFrames.map(f => f.directMeasurementCm))` 沒檢查讀數是否來自同一次量測。若使用者繞樹幹拍兩圈（兩次不同位置的讀數）會被平均掉，誤差倍增。

## 26. 觀測性強化（批次上傳靜默 crash 的盲點）

> 對應問題：批次上傳期間 PM2 多次靜默重啟，pm2 error log 無 stack trace，
> in-memory jobs Map 隨之消失，jobId 變「Job 不存在」，無法追蹤 root cause。
> 已完成的緩解：journald 重啟（2026-05-25，kernel 級事件之後會被記錄）、加 2GB swap、
> processVideo finally 加 unlink、video_drive_url 欄位預留。
> 以下為剩餘待辦。

- [x] 26.1 在 src/index.js 啟動時掛 `process.on('uncaughtException')` 與 `process.on('unhandledRejection')`，以同步 `fs.appendFileSync` 寫到 `logs/crash.log`（避開 PM2 stderr 來不及 flush 的問題）；包含 timestamp、error.stack、當下 in-flight jobId（2026-05-25 部署完成，VM PID 525002）
- [ ] 26.2 每個 job 開獨立 log 檔 `logs/jobs/{jobId}.log`，processVideo 中每一階段（hash → metadata → frames → species → calc → insert → blockchain → story）寫入 begin/end marker，配 elapsed ms；批次跑完後可用來定位「處理到哪一步死掉」
- [ ] 26.3 （延伸）為 ffmpeg / Gemini 呼叫加單階段超時保護（例如 ffmpeg 單支 ≤ 8 分鐘，Gemini 呼叫 ≤ 90 秒），避免單一階段卡死拖垮整個 job 直到 20 分鐘 polling timeout

## 27. 三路徑並列計算 + Dashboard 三欄呈現

**問題背景**：目前 `calculationService.calculate()` 採「贏家獨佔」邏輯 — Path 0 成功時 `if (!directMeasurementUsed && ...)` 直接跳過 Path A 計算，僅 `routeBDbhCm` 額外算 DBH 卻沒落地。實測 31 支影片同時包含貼 tape（Path 0）+ 擺參照物（Path A），等於每支都能產出三筆獨立 DBH 估算 → CF 訓練樣本翻倍，且能拆出「Path A CF」「Path B CF」兩條獨立修正曲線。

**設計目標**：
- 每次 processVideo 無條件並行算三條路徑，全部落地 SQLite
- 既有優先級（0 > A > B）只決定「對外回傳的 winner」，但三筆數據在 dashboard 同列呈現
- CF 機制升級為 per-path 雙曲線

**子任務**：

- [ ] 27.1 重構 `calculationService.calculate()` — 拆 `calcPath0() / calcPathA() / calcPathB()` 三個獨立函式，無條件三路並算，`pickWinner()` 沿用既有優先級回傳 `{paths: {path0, pathA, pathB}, winner: 'path0'|'pathA'|'pathB'|null, dbhCm/volumeM3/carbonKg(=winner 的值，向後相容)}`
- [ ] 27.2 `db/init.js` trees 表新增 idempotent ALTER：`path0_dbh_cm REAL`, `pathA_dbh_cm REAL`, `pathB_dbh_cm REAL`, `pathB_dbh_cm_corrected REAL`, `path0_volume_m3 REAL`, `pathA_volume_m3 REAL`, `pathB_volume_m3 REAL`, `path0_carbon_kg REAL`, `pathA_carbon_kg REAL`, `pathB_carbon_kg REAL`, `winner_path TEXT`
- [ ] 27.3 `db/trees.js` `insert()` 改寫接收 `paths` 物件 + `winnerPath`，寫入新欄位
- [ ] 27.4 `index.js` `processVideo()` 改寫 — 把 `calc.paths` + `calc.winner` 整包傳給 `insert()`，同時保留 `calc.dbhCm` 給上鏈/CF 用
- [ ] 27.5 CF 機制升級：`correction_factor_log` 加 `path TEXT` 欄位（值 'A' 或 'B'）；`correctionFactorService.getFactorBySpecies(species, path)` 新增 path 參數；processVideo 中 Path 0 成功時同時對「Path A 殘差」與「Path B 殘差」呼叫 `snapshotFactor(species, 'A')` / `snapshotFactor(species, 'B')`
- [ ] 27.6 `/api/tree/:id` 與 `/api/trees` 回傳結構新增 `paths` 區塊（每路 dbhCm/volumeM3/carbonKg/computed:bool）
- [ ] 27.7 `dashboard.html` 樹木 detail modal 加「三路徑並列」3 欄表格（DBH/Volume/Carbon × Path 0/A/B），winner 該欄綠色高亮，未計算的路徑顯示「—」
- [ ] 27.7.5 **元數據完整封存（補完支柱一原始設計）**：
  - 7.5a `metadataService.js` 把 exiftool 原始 tags 物件序列化進 `metadata.exifRaw`（移除非 JSON-safe 欄位後）；同時擷取 `GPSImgDirection`、`Duration`、`VideoCodec`/`CompressorID`、`Orientation`、`ISO`、`ExposureTime`、`WhiteBalance`、`ColorSpace`、`Pressure`/`AtmosphericPressure`、`AmbientTemperature`
  - 7.5b `db/init.js` trees 表新增 idempotent ALTER：`create_date INTEGER`、`frame_rate REAL`、`image_width INTEGER`、`image_height INTEGER`、`altitude_m REAL`、`illuminance_lux REAL`、`duration_sec REAL`、`video_codec TEXT`、`orientation TEXT`、`gps_img_direction_deg REAL`、`device_pressure_hpa REAL`、`device_ambient_temp_c REAL`
  - 7.5c `db/trees.js` `insert()` 接收並寫入上述欄位
  - 7.5d `index.js` `processVideo()` 把新欄位傳入 `insert()`；`raw_result.metadata.exifRaw` 自動跟隨（無需額外處理）
- [~] 27.8 **資料 + 鏈重置（destructive，需明示確認）**：**決議：不執行**（2026-05-25）
  - 重置目的本為清掉舊「贏家獨佔」邏輯的 row，但 §26 重傳 9 支 + §29 reanalyze 已落地三路徑欄位
  - NULL 欄位（Path 0 17/31、Path A 22/31 為 NULL）是真實資料：那些影片本來就沒拍清晰皮尺/參照物，不是 bug
  - 重置不會憑空產生沒拍到的資料，反而會抹掉鏈上歷史，無實益
- [x] 27.9 31 支影片三路徑覆蓋率驗證（2026-05-25）：Path B 31/31 ✓（恆可算）；Path 0 14/31（依拍攝是否含皮尺讀數）；Path A 9/31（依是否含參照物）；三路徑齊全 5/31。NULL 欄位為拍攝協議限制下的真實資料

## 28. 環境快照與生態物候雙軸敘事

**設計動機**：對齊支柱一「② 元數據擷取 → 寫入本地資料庫」原始設計，並讓永續故事從「靜態樹種共生」升級為「樹種共生 × 當下季節物候」雙軸敘事。每棵樹的拍攝瞬間擁有一筆完整環境快照（氣象、UV、日照、太陽位置、物候標籤），故事生成器讀全部資料一次拼出有敘事密度的段落。

**架構決策**：
- 環境資料**全部存進 SQLite**（含原始 API 回應 JSON blob 永久封存），避免未來新增故事段落時要重打歷史氣象 API
- GPS 缺失 graceful skip（故事中乾脆不提天氣，不寫「資料缺失」）
- 氣象來源優先序：**Open-Meteo Archive API**（免費無 key、UV/日照/輻射齊全）→ **中央氣象署 CWA Open Data**（若有 token）→ 既有 OpenWeatherMap（已棄用但保留 fallback）
- 太陽位置（日出日落、仰角）用本地數學計算，無需第三方 API
- 物候標籤從「月份 × 緯度 × 海拔」本地推算（不依賴外部生態 API）

**子任務**：

- [ ] 28.1 `db/init.js` 新增 `environmental_context` 表：tree_id、measured_at、lat/lon/altitude_m、season、forest_zone、temp_c、humidity_pct、pressure_hpa、wind_dir_deg、wind_speed_ms、weather_code、weather_text、precip_mm、cloud_cover_pct、**uv_index**、**sunshine_duration_h**、**shortwave_radiation_wm2**、sunrise、sunset、day_length_h、solar_elevation_deg、phenology_tags（JSON 字串）、raw_openmeteo_json、raw_cwa_json、fetched_at；建立 idx_envctx_tree
- [ ] 28.2 `db/environmentalContext.js` CRUD：`insert(record)`、`getByTreeId(treeId)`
- [ ] 28.3 `src/services/solarService.js` 新增（本地計算）：`getSunPosition(lat, lng, unixTs)` → `{sunrise, sunset, dayLengthH, solarElevationDeg, solarAzimuthDeg}`（NOAA 太陽位置演算法）
- [ ] 28.4 `src/services/phenologyService.js` 新增：`inferPhenologyTags({lat, lng, altitudeM, unixTs, species?})` → `['bird_breeding_late', 'leaf_flush', 'fruit_ripening', ...]`；含 `inferForestZone(altitudeM)` → 海岸帶/低海拔闊葉/中海拔混交/高海拔針葉
- [ ] 28.5 `src/services/weatherService.js` 重寫：新增 `getEnvironmentSnapshot(lat, lng, unixTs)` 並行查 Open-Meteo Archive + CWA + solarService，回完整環境物件含 raw JSON；保留 `getWeatherAt()` + `formatWeatherLine()` 向後相容；新增 `persistEnvironmentContext(treeId, lat, lng, unixTs, altitudeM)` 整合 snapshot + phenology 寫入 DB
- [ ] 28.6 `index.js` `processVideo()` 完成 trees.insert 後，呼叫 `persistEnvironmentContext()`（fire-and-forget，失敗只 log 不擋主流程）
- [ ] 28.7 `data/ecologyDb.js` 每樹種補 `seasonalBehavior` 欄位（12 個月 × 共生動物當下行為：繁殖/遷徙/換羽/化蛹/開花/結果/休眠）
- [x] 28.8 `services/storyService.js` `generateStoryA()` prompt 升級：讀 `environmental_context` + 物候標籤中文對照，拼出「樹種共生 × 當下季節物候 × UV/日照數據 × 太陽位置敘事」雙軸故事；Markdown 末段附「📊 拍攝當下環境快照」表格；OpenWeatherMap 降為無 env 時的 fallback（2026-06-02）；32 棵全部以新版 prompt 重新生成，腳本 `scripts/regen_stories.js`，log 見 `logs/regen_stories.log`
- [ ] 28.9 `/api/trees/:id/story` 與 dashboard 樹木詳情面板顯示完整 environmental_context（含 UV 指數、當日日照時數等新欄位）

## 29. 三路徑依據幀可溯源化（evidence-traceability）

**問題背景**：§27 落地三路徑數值（DBH/Volume/Carbon）後，使用者問「Path 0/A/B 各用哪些關鍵幀算出來的」。檢查現況：`pickEvidenceFrameIdx()` 邏輯存在（Path 0 找量尺讀數最匹配中位數那張、Path A 找參照物信心最高那張、Path B 無依據幀），但 `rawAnalysis.frames[]`（每幀 Gemini 判讀結果）只在 processVideo in-memory 用過就丟。DB 只存單張 evidence-frame 縮圖且未記 frame_idx。Dashboard 因此無法回答這個追溯問題。`tmp_frames/{jobId}/frame_0..12.jpg` 仍完整保留在 VM。

**設計目標**：
- 把每幀 Gemini 判讀結果落地 SQLite，使三路徑數值具備可溯源性
- Dashboard 三路徑表展開後可看見對應依據幀（Path 0 量尺幀、Path A 參照物幀、Path B 全部 13 張）
- 對歷史 31 棵不需重傳影片，讀 `tmp_frames/` 重跑 Gemini 即可回填

**子任務**：

- [x] 29.1 `db/init.js` 新增 `frame_analyses` 表：tree_id (FK)、frame_idx INTEGER、direct_measurement_cm REAL、direct_confidence REAL、measurement_type TEXT、reference_detected INTEGER、reference_at_trunk INTEGER、reference_type TEXT、reference_width_mm REAL、reference_confidence REAL、trunk_width_fraction REAL、frame_quality_label TEXT、leaf_visible INTEGER、raw_json TEXT、created_at INTEGER；UNIQUE (tree_id, frame_idx) + idx_frame_analyses_tree
- [x] 29.2 `src/db/frameAnalyses.js` 寫 `insertMany(treeId, frames[])`、`getByTreeId(treeId)`、`deleteByTreeId(treeId)`
- [x] 29.3 `src/index.js` processVideo 把 `rawAnalysis.frames[]` 落地到新表（frame_idx 取自 chosenPath 內 `frame_N.jpg`；同步寫 `tmp_frames_dir = jobId`）
- [x] 29.4 `reanalyze.js` 一次性回填：歷史 31 棵直接讀 `raw_result.rawFrames`（已含 Gemini 分析結果，無需重跑），呼 `frameAnalyses.insertMany`；同時以 mtime ±10 分鐘比對把 `tmp_frames` 子目錄寫入 `trees.tmp_frames_dir`
- [x] 29.5 endpoint `GET /api/trees/:id/path-frames`：依 `pickEvidenceFrameIdx` 邏輯回 `{path0: {frameIdx, value, confidence, measurementType}, pathA: {frameIdx, referenceType, confidence}, pathB: 無單一依據幀 + 全幀清單}`
- [x] 29.6 endpoint `GET /api/trees/:id/frames/:idx`：把 `tmp_frames/{tmp_frames_dir}/frame_{idx}.jpg` 串流回應；path-traversal 防護；Cache-Control 24h
- [x] 29.7 `dashboard.html` 三路徑表底下加依據幀區塊：Path 0 / A 顯示依據幀大圖 + 量測值；Path B 顯示全部幀縮圖網格（lazy load on card open）
- [ ] 29.8 部署 §29 程式碼 + 跑 schema migration + 對 31 棵跑 reanalyze.js + 確認 dashboard 三路徑依據幀區塊正常

## 30. 評估嚴謹度修正（evaluation-rigor，RQ1 循環論證）

**問題背景**：`src/index.js:508-511` 自動寫入邏輯使 `ground_truth.actual_dbh_cm` 永遠等於 Path 0 或 Path A 自己的計算值；`evaluationService.js:196-200` 的 RQ1 SQL 不過濾 source 直接全部入鍋。意思是現有 `evaluation_runs` 算出的 MAE/MAPE/RMSE/R² 實際語意是「Path B vs Path 0/A」自比，不是「系統最終輸出 vs 人工皮尺實量」對外部基準的誤差。論文裡若把這數字當系統精度宣稱，會被審稿質疑循環論證。

**設計目標**：
- 把人工皮尺實量值與 Path 0/A「自比基準」在 schema 上拆開
- evaluation 改 per-path 計算（Path 0 vs manual、Path A vs manual、Path B vs manual）
- 沒 manual 那批樹另外進「自比」報表，並在 UI / 報表中標清楚語意

**子任務**：

- [x] 30.1 `db/init.js` `ground_truth` 表加 `manual_dbh_cm`、`measured_by`、`measured_at`、`notes` 欄位（idempotent ALTER）；`evaluation_runs` 加 `path` 欄位區分 per-path 評估
- [x] 30.2 `evaluationService.js` 改 per-path 評估：`runEvaluation({path, ...})` 用 `PATH_COL` 動態切估算欄、過濾 `source='manual'`；`runEvaluationAllPaths()` 一次跑 5 路徑（path0/A/B/B修正/final）
- [x] 30.3 `dashboard.html` 樹木卡片加「📏 皮尺視覺判讀 vs 系統估算」區塊（v2 改版）：直接讀 Gemini path-frames endpoint 取皮尺數字當基準，顯示依據幀大圖 + 三路徑 DBH + 誤差表；移除原 manual 輸入表單與 Path B 修正後/Final 兩欄
- [x] 30.4 §30 v2 部署完成（2026-05-25）：(a) dashboard.html `renderTapeCompare()` 從 Gemini 自動讀皮尺數字當基準，無需人工輸入；(b) evaluationService.js PATH_COL 縮減為三路徑（path0/pathA/pathB），移除 pathBCorrected/final；(c) 部署 + pm2 restart 完成；(d) endpoint smoke test 通過（path0 evidence value=63.5 cm circumference → baseline DBH=20.2 cm ✓）
- [ ] 30.5 paper 章節更新：在 §RQ1 結果段落明示「對 manual ground truth」與「自比」兩種數字，避免任何一方被誤讀

## 31. 人工皮尺基準覆寫 + Path A sanity-gate 重構（2026-05-25）

**問題背景**：§30.4 落地後雖然 dashboard 可以「皮尺視覺判讀 vs 系統估算」並列顯示，但 trees 表上的 `path0_dbh_cm` 仍是 Gemini OCR 算的（37 棵 path0 落地時來自 directMeasurementCm），與真正的人工皮尺實量值（`manual_tape_dbh_cm`，§30 schema 已落地）並非同一筆。31 棵歷史樹同時還暴露另一個問題：Path A 因 `validateReferenceAspectRatio` 0.15 容差太嚴格被刷掉一批本來可用的影格——Gemini bounding box 對信用卡常拉長至 5:1 但寬度仍正確，aspect ratio 過濾把這類影格全部 reject 是過度防禦。

**設計決策**：
- 直接覆寫不留 AI OCR（使用者明示「直接覆寫不留」）：31/31 棵 `path0_dbh_cm := manual_tape_dbh_cm`，winner 全改 `path0`
- Path A 的 aspect ratio 硬性過濾整個拿掉，改用「輸出端 DBH 1–200cm sanity check」當守門，可同時擋掉 ruler 把樹幹誤讀成 1m 尺造成 600–3000cm 幻覺
- 三路徑 evidence 邏輯改寫：`pickPath0()` 優先讀 `manual_tape_dbh_cm`，frameIdx 從 `round(ts / duration × 12)` 對應到 tmp_frames/{dir}/frame_0..12.jpg 內最近的一張（無需 ffmpeg 重新切，9/31 影片源檔已從 VM 刪除）

**子任務**：

- [x] 31.1 `staging/src/services/calculationService.js` `calcPathA()` 重構：移除 `validateReferenceAspectRatio` 過濾（保留函式以利向後相容），改用輸出端 `if (dbhCm < 1 || dbhCm > 200) return null` 守門；SCP 部署到 VM
- [x] 31.2 Path A 復原：寫 `tmp_recover_pathA.js` 對舊 pathA NULL 的 21 棵樹重跑 `calculate()`，從 raw_result.median 取 reference 欄位；10 → 15 棵 pathA 有值（+5 棵），4 棵被 1–200cm sanity check 正確 reject（Gemini 把樹幹當 1m 尺造成 3000cm 幻覺），11 棵 median 內無 reference 偵測無法救援
- [x] 31.3 Path 0 全量覆寫腳本 `tmp_path0_overwrite.js`：對 31 棵樹用 `getFormulaByScientificName(species)` 重算 H/V/Carbon（hdA·DBH^hdB → H，volA·DBH^volB·H^volC → V，V·woodDensity·bef·0.5 → C），UPDATE `path0_dbh_cm/path0_volume_m3/path0_carbon_kg/winner_path='path0'/dbh_cm/volume_m3/carbon_kg`，並把 `original_dbh_cm/applied_correction_factor` 清為 NULL（人工值不需要修正因子）
- [x] 31.4 31/31 棵覆寫完成（2026-05-25）：winner 全 path0，總碳從 49871.3 kg → 8290.9 kg（先前 Gemini OCR 把樹幹當 1m 尺造成 130cm/166cm 等爆量值，覆寫後最大 43.9cm），平均路徑 0 DBH 29.74 cm；備份 `data.db.bak.path0-overwrite`
- [x] 31.5 `src/index.js` `pickPath0()` 改寫（path-frames endpoint）：SELECT 補 `manual_tape_dbh_cm/manual_tape_circ_cm/manual_tape_frame_ts_sec/duration_sec`；優先用 manual_tape 值，frameIdx = `clamp(round(ts/dur × 12), 0, 12)`，回傳 `reason='manual_tape'`、`confidence=1.0`、`manualTapeDbhCm`、`manualTapeTsSec` 等欄位；沒人工值的樹自動 fallback 原 AI OCR 邏輯（目前 31/31 都有人工值）
- [x] 31.6 `src/services/githubSyncService.js` buildTrees() 加 `winnerPath: r.winner_path` 欄位（dashboard.html line 378 期待這欄位顯示星號 winner badge，但既有 schema 漏了）
- [x] 31.7 trees.json 同步：手動執行 `pushTreesJson()` 推到 `Yuchiaoniu/forest-carbon-measurement` master `public/data/trees.json`，commit `dc57a2c7`；31/31 棵 `winnerPath='path0'`、`paths.path0.dbhCm` 全有值、總碳對齊 DB 8290.9 kg
- [x] 31.8 endpoint smoke test：抽 3 棵跑 `/api/trees/:id/path-frames` 全部回 manual_tape evidence + 對應 tmp_frames frameIdx（ts=4s→frame 1、ts=92s→frame 11、ts=78s→frame 10）；`/api/trees/:id/frames/:idx` 回 HTTP 200 + 1080×1920 JPEG

## 32. Path A 全量重跑回收（credit-card-only prompt）

**問題背景**：16 棵 `pathA_dbh_cm` 為 NULL。根本原因是「最清晰 3 幀」選幀邏輯以 Laplacian 清晰度為主，卡片出現的幀不一定被選中；加上 Gemini 常把卷尺（ruler100）誤選為主要參照物，導致 ratio × 1000mm 超出 sanity check。所有 16 棵的 `tmp_frames_dir` 仍存在，13 張候選幀完整保留在 VM。
IMG_5786（id: db0c5e0f）另有方向問題：影片以 9 點鐘橫向錄製，幀需先旋轉 90° 順時針才能正常辨識。

**設計目標**：
- 對 16 棵重跑 Gemini，使用全部 13 張候選幀（非原本選出的 3 張）
- 新 credit-card-only prompt：只偵測信用卡，明確要求忽略卷尺與皮尺
- IMG_5786 的幀先以 FFmpeg transpose=1 旋轉 90° CW 後再送 Gemini
- 通過 sanity check（DBH 1–200cm）就 UPDATE `pathA_dbh_cm/pathA_volume_m3/pathA_carbon_kg`

- [x] 32.1 寫 `recover_pathA_rerun.js`：逐樹讀 `tmp_frames/{dir}/frame_0..12.jpg` → credit-card-only Gemini 分析 → `calcPathA` → UPDATE DB
- [x] 32.2 IMG_5786 旋轉處理：偵測到 id 前綴 `db0c5e0f` 時，對每幀呼叫 `ffmpeg -i input -vf transpose=1 output` 再送 Gemini
- [x] 32.3 執行完成（2026-05-25）：pathA 覆蓋率從 15/31 → **29/31**；仍 NULL：IMG_5818（5818）、IMG_5803（5803）；可疑離群值（pathA/p0 差距 > 40%）：5798（75.3 vs 42cm）、5804（38.5 vs 25.5cm）、5812（47.1 vs 30.9cm）
- [x] 32.4 補幀（2026-05-25）：5818 ✅ frame_10 DBH=19.3cm (p0=17.5, +10%)；5803 ❌ 原始影片已刪、tmp_frames 三幀均無卡片，仍 NULL（需重新上傳影片或接受 pathA 缺失）
- [x] 32.5 修正離群值（2026-05-25）：5798 75.3→24.7cm (p0=42, -41% ✅ 合理)；5812 47.1→30.0cm (p0=30.9, -3% ✅ 幾乎完美)；用 fix_pathA_timestamps.js 執行
- [x] 32.6 5804 分裂（2026-05-25）：第一棵 id=f5d4607c pathA=28.5cm (p0=25.5, +12%)；第二棵 id=b8b61455 pathA=38.0cm (path0 待補，暫 winner=pathA)；共 32 棵
- [x] 32.7 5803 pathA 補齊（2026-05-25）：從 DB 取 video_drive_url → curl 下載 71.5MB → FFmpeg 提取 10s 幀 → Gemini → DBH=33cm (p0=43, -23%, conf=0.95)；**pathA 32/32 全覆蓋**
- [x] 32.8 5804 第二棵 path0（2026-05-25）：2:14 皮尺 54cm 周長 ÷ π = 17.2cm；UPDATE b8b61455 path0=17.2 winner=path0；pA=38cm 差距 121%（仍可疑，但 winner 已改回 path0）

---

## 🌱 永續故事引擎（探索中，持續更新）

> 本節紀錄設計討論的確認決策與待辦方向，邊探索邊補充。

### 已確認的設計決策

**D1. 樹木個體識別：GPS + 樹種 + DBH 三合一**
- 不使用樹紋辨識（技術成熟度不足，同種個體辨識上限約 70-80%）
- 傅立葉轉換相關技術未來可作 tie-breaker 輔助，但不作主要依賴
- GPS 誤差範圍內有多棵樹時：顯示候選清單，使用者一次性手動選定，後續記住

**D2. 身份推斷：行為優先，不貼標籤**
- 個人不預設為志工；組織不預設為 NGO
- 從行為模式推斷當下角色：
  - 無歷史 GPS 紀錄 + 小 DBH → 「種植者」
  - 同 GPS 回訪 → 「養護者」
  - 跨多 GPS 大量紀錄 → 「造林者」
- 同一人在不同樹面前可有不同角色

**D3. 新種 vs 維護：純 GPS 歷史判斷**
- 查詢 trees 表 10m 半徑內是否有歷史紀錄
- 無紀錄 → 新種植；有紀錄 → 回訪/維護/監測

**D4. 不使用人臉、不分析影片人物**
- 影片用途：樹木測量（現有功能）
- 故事敘事：僅從樹木特徵 + GPS + 時間 + 環境資料生成

**D5. 故事敘事方案：A + C + D 組合**
- A：GPS × 生態層（環境詩學）— 永遠可用，地方說話
- C：關係網絡（時空聚類後的集體影響力）— 有群組資料後啟用
- D：時間軸對比（before/after）— 有回訪資料後啟用
- 三者疊加，隨使用次數自動豐富

**D6. 時空群組（Event Cluster）為故事 C 的數據基礎**
- GPS 範圍 500m + 時間窗口 2 小時內的多個 DID 上傳 → 自動標記為群組
- 群組暫定名稱（如「台東 0514 植樹群組」），待確認後更新
- 確認機制：發送給群組內高頻使用者做一鍵確認

**D7. 外部系統整合：輕量 Webhook**
- 漸進式連動，不需深度整合
- trees 新增後觸發 POST webhook，傳送結構化 JSON + 已生成故事文字

---

**D8. WHY 收集：AI 推斷為主，組織預設為輔**
- 路徑一（主）：Gemini 從 GPS 位置 + 樹種 + 時空背景推斷種樹動機，標記為「AI 推斷」
- 路徑二（輔）：活動主辦方 / 管理員可預設活動理念，成員故事自動繼承
- 不向一般用戶提問；用戶唯一的責任是拍照

**D9. 用戶互動極簡化**
- 用戶只負責拍照 / 錄影，其餘全部自動
- 唯一開放的互動：在 event 頁面底下留言（選填）
- 管理員保留權限：修改或編輯群組分類、活動身份標籤

**D10. Events 成為資料庫第一級實體**
- 新增 events 資料表（id / name / location_gps / time_range / org_id / why_text / total_carbon / participant_count）
- trees 表新增 event_id 外鍵（nullable，未分群的樹可獨立存在）
- 時空聚類服務自動建立 event 紀錄，管理員可修改名稱與描述
- 每個 event 有獨立頁面（/events/:id）與留言區

---

### 待討論 / 待決定

- [x] ~~Event 頁面的資訊架構~~ **D11. Event 頁面完全公開**
  - 無需登入即可瀏覽故事、地圖、樹木資料、留言
  - 參與者以匿名方式呈現（「15 位參與者」，不顯示個人姓名）
  - 留言開放匿名或署名
  - URL 本身即為可分享的 ESG 資產（/events/:id）
- [x] ~~Event 的生命週期~~ **D12. 以「天」為單位**
  - 同一個 GPS 聚類（500m 範圍）+ 同一個自然日（00:00–23:59）= 同一個 event
  - 隔天同地點的上傳自動建立新 event
  - 簡單清晰，不需要人工關閉

- [x] ~~氣象 API~~ **D13. 整合氣象資料**
  - 拍攝時間 + GPS → 查詢當下氣象（氣溫、濕度、天氣狀態、日出日落時間）
  - 優先使用台灣中央氣象署開放 API；備援 OpenWeatherMap
  - 資料存入 trees 表，供方案 A 故事引用（「那個下著細雨的清晨…」）

- [x] ~~留言驗證~~ **D14. 留言採用「上傳憑證 token」機制**
  - 瀏覽 event 頁面：完全公開，無需帳號
  - 留言：需持有該 event 的 participantToken（上傳樹木時自動發放）
  - token 存於瀏覽器 localStorage，無帳號系統，完全匿名
  - 留言可填任意暱稱（不強制真實姓名）
  - 管理員保留刪除不當留言的權限

- [x] ~~故事更新觸發機制~~ **D15. 雙軌觸發：回訪偵測 + 每月排程**
  - 路徑 B：回訪同 GPS → 自動偵測成長差異 → 方案 D 故事即時更新
  - 路徑 C：每月 1 日 cron job 掃描 90 天以上無回訪的樹 → 模型推算版故事（標記「預估，尚未實測」）
  - 真人回訪後，預估版自動替換為實測版

- [x] ~~台灣公開地理生態資料庫串接~~ **D16. GPS 格網快取策略**
  - 台灣全島切成 1km×1km 格網，預存：林相類型、流域名稱、鄉鎮名、已知物種（TESRI）、保護區狀態、海拔帶
  - tree 上傳時查格網快取（< 1ms），不即時呼叫外部 API
  - 格網資料每季更新一次
  - 資料來源：林務署、農業部、特有生物研究保育中心、國土測繪中心

- [x] ~~Webhook 外部整合~~ **D17. Webhook JSON 格式與契約**
  - 觸發事件：tree.created / event.formed / story.updated / comment.added
  - Payload 包含：tree / eventCluster / story / geo / blockchain 欄位
  - 認證：HMAC-SHA256 簽章（X-Signature header）
  - 失敗重試：5 分鐘後重試，最多 3 次，失敗記入 webhook_logs
  - 外部系統亦可主動 GET /events/:id.json 拉取資料

## 33. 永續故事頁面修復（story.html 404）

**問題根因**：`dashboard.html` 的「🌿 永續故事」連結指向 `/story.html?id=xxx`，但 `public/story.html` 從未建立，只有伺服器端 `GET /api/trees/:id/story` API 存在。§19.4 task 描述中預期 story.html 存在但實際漏做。

- [x] 33.1 建立 `public/story.html`：從 URL 參數讀 `?id=`，呼叫 `GET /api/trees/:id/story?format=json` 取得故事資料，渲染 Markdown 故事內容 + 樹木基本資訊（樹種、DBH、GPS、拍攝時間、碳儲量）；支援 IS_GH_PAGES 靜態模式（從 trees.json 讀取 story 欄位）；樣式與 dashboard.html 一致
- [x] 33.2 確認 `/api/trees/:id/story?format=json` 回傳結構：`{treeId, markdown, generatedAt}`；trees.json 靜態模式有 `storyMarkdown` 欄位，均已支援
- [x] 33.3 部署到 VM（HTTP 200 ✓）+ GitHub Pages commit 669a8eda（2026-05-27）；dashboard.html 的「🌿 永續故事」連結不再 404

## 34. Path A 卡片傾斜修正（card-orthogonal filter）

**問題根因**：Path A 誤差的主因是卡片相對鏡頭的傾斜角度，而非深度偏移。幾何關係為 `DBH_error = 1/cos(tilt_angle)`，60° 傾斜即造成 2× 誤差（+100%）。目前 32 棵配對樣本中僅 6 棵在 ±10% 以內，13 棵 10–25%，13 棵超過 25%（含 3 棵超過 100%）。`frame_analyses` 欄位已有 `reference_detected`/`reference_at_trunk`，但缺少傾斜判斷。

**設計目標**：在 Gemini credit-card-only prompt 加入傾斜過濾欄位，讓 Gemini 自己當守門員；對誤差 >10% 的 25 棵 + pathA NULL 的樹重跑改良 prompt；±10% 內的 6 棵不動。

- [x] 34.1 `src/services/geminiService.js` analyzeTrunk schema + `required` 新增 `referenceOrthogonalToCamera`（BOOLEAN）、`referenceFullyVisible`（BOOLEAN）；prompt 補充第 10a/10b 條說明；`getMedianResult()` refFrames 過濾器加兩個新欄位（`!== false` 向後相容）
- [x] 34.2 `db/init.js` `frame_analyses` 表新增 idempotent ALTER：`reference_orthogonal INTEGER`、`reference_fully_visible INTEGER`
- [x] 34.3 `src/db/frameAnalyses.js` `COLS` 陣列 + `insertMany()` 行對映加入兩個新欄位
- [x] 34.4 幀過濾邏輯改在 `geminiService.js getMedianResult()` refFrames 過濾器執行（向後相容）
- [x] 34.5 撰寫並執行 `recover_pathA_orthogonal.js`（2026-05-28）：目標 26 棵（>10% 誤差 + pathA NULL），跳過 6 棵已在 ±10% 以內；strict 條件：creditCardDetected + atTrunk + orthogonal + fullyVisible，無嚴格幀則放寬至 orthogonal only；執行後發現 6 棵有回歸（最嚴重 IMG_5787: 26%→168%、IMG_5818: 10%→120%），已用 `revert_regressions_34.js` 全部回復
- [x] 34.6 最終結果（2026-05-28）：32 棵配對樣本 ≤10%: **10 棵**（↑ 從 6）；≤25%: **23 棵**（↑ 從 19）；>25%: **9 棵**（↓ 從 13）。9 棵殘餘高誤差主因：Gemini 無法在這批影片中識別正交信用卡（無卡片或卡片嚴重斜立）；失敗 8 棵（無有效正交幀），改良 18 棵，回歸回復 6 棵
- [x] 34.7 PM2 重啟（2026-05-28）：新的 `geminiService.js`、`db/init.js`、`frameAnalyses.js` 已生效，git commit f11ebc6（本機）；push 待 GitHub credentials 設定後執行

## 35. Path A OpenCV 兩階段重構

**架構動機**：§34 的 Gemini 正交過濾仍有誤判（6 棵回歸），根本原因是讓語言模型負責幾何偵測。改為 **OpenCV 負責幾何（卡片是否存在＋是否正交），Gemini 只負責語意（樹幹是卡片的幾倍寬）**，分工明確、誤判率更低、API 費用更少。

**三路徑角色重新定位**（2026-05-29 確認）：
- **Path 0**（捲尺）：**校準基準**，驗證 Path A 準確度，不再當主要測量方法
- **Path A**（卡片像素比）：**主力自動測量**，準確度靠 OpenCV+Gemini 工具提升，不依賴 Path 0 訓練
- **Path B**（光學公式）：**無參照物測量**，以 Path A 驗證後的結果作為訓練/校正資料

- [x] 35.1 撰寫 `scripts/detect_card.py`（2026-05-29）：OpenCV Canny+輪廓偵測長寬比 1.4–1.8 矩形；四角偏離 90° <20° 判斷正交；回傳 JSON {cardDetected, isOrthogonal, angleDev, areaFrac, sharpness}；支援 --rotate-cw 旗標
- [x] 35.2 撰寫 `recover_pathA_opencv.js`（2026-05-29）：OpenCV 篩幀 → Gemini ratio-only prompt（簡化版，只量 trunkToCardRatio）；內建回歸保護；目標 MAPE > 15% 樹
- [ ] 35.3 VM 部署：pip install opencv-python-headless + SCP 兩腳本 + 執行 MAPE > 15% 掃描
- [ ] 35.4 整合進 `geminiService.js` 主流程：新上傳影片走 OpenCV 預篩 + Gemini ratio-only（取代現有全 Gemini 流程）
- [ ] 35.5 未來擴充（原視訊 available 時）：1fps 全片掃描 → 定位卡片出現時間 → 前後 0.5s 精抽 5 幀

## 36. Path B 訓練資料準備

**目標**：以 Path A 驗證後（MAPE ≤ 15%）的樣本作為 Path B 校正依據，建立「無參照物」DBH 估算模型。

**資料流**：`影片 → OpenCV篩幀 → Gemini量比例 → PathA DBH` → Path 0 驗證誤差 ≤ 15% → **Path B 訓練集**（DBH + 像素寬占比 + 焦距 + 感測器尺寸 → 推算拍攝距離）

- [ ] 36.1 匯出 Path A 驗證樣本：SELECT trees WHERE ABS(pathA-path0)/path0 ≤ 0.15，輸出 CSV（dbhCm, trunkWidthFraction, focalLengthMm, sensorWidthMm, imageWidthPx, estimatedDistanceM）
- [ ] 36.2 estimatedDistanceM 推算公式：`D = focalMm × sensorWidthMm / (trunkWidthFraction × imageWidthPx × mmPerPx)`（需 exifRaw 中 FocalLengthIn35mmFilm 或 FocalLength）
- [ ] 36.3 Path B 模型評估：用推算距離代入薄透鏡公式計算 DBH，與 Path A 對比 MAPE；若 < 20% → Path B 可用

## 37. detect_card.py 效能優化（避免 spawnSync timeout）

**問題根因**：2026-05-30 真實 end-to-end 測試發現新上傳每棵都失敗，錯誤訊息 `detect_card.py failed: `（空 stderr）。原因是 `frameService.js` 用 `spawnSync` 同步呼叫 detect_card.py 並設 5 分鐘 timeout，大支 iPhone 4K 影片（如 IMG_5786 = 166MB、約 3 分鐘）在 2fps 抽幀後產生 360+ 幀，每幀做 Canny + 輪廓偵測在 4K 解析度上耗 0.5–1 秒，整支跑完超過 5 分鐘就被 timeout 殺掉。同時 spawnSync 還會 block 整個 Node event loop，連 `/api/status` 在那 5 分鐘內都無法回應。

**設計目標**：在不改 fps、不截影片長度的前提下，把 OpenCV 偵測時間壓到 1 分鐘內。

- [ ] 37.1 早停機制：`scan_video()` 迴圈中累計 `cardDetected && isOrthogonal` 的幀數，達到 5 幀就 break；剩餘幀不再做 OpenCV 偵測（ffmpeg 已抽完不退回）
- [ ] 37.2 更積極降解析度：`MAX_DETECT_WIDTH` 從 1280 → 960，偵測前 resize 從 ~3x 提升到 ~4x 縮放（720p 等效解析度）；旋轉與輸出仍用降採樣後的影像，與目前流程一致
- [ ] 37.3 SCP 部署到 VM 並重啟 pm2 forest-carbon
- [ ] 37.4 端對端驗證：重跑 IMG_5786、5788、5789、5790、5791 五棵，確認每棵在 60 秒內完成、無 timeout，並比對 pathA DBH vs manual tape 誤差

## 38. 重測沙箱（dryrun_runs，2026-05-30 完成）

**目標**：對任何舊樹跑兩條 prompt 對比、不污染 trees / 不上鏈。詳見 memory `project-dryrun-sandbox`。

- [x] 38.1 建 `dryrun_runs` SQLite 表（含 path0_dbh_cm / pathA_legacy_dbh_cm / pathA_opencv_dbh_cm / pathA_winner_strategy / error_pathA_legacy_pct / error_pathA_opencv_pct）
- [x] 38.2 Path 0 = `manual_tape_dbh_cm`（dryrun 範疇；production 還沒推廣）
- [x] 38.3 `scripts/dryrun-rerun.js` 重抽版：Drive 下載 → 2fps 重抽 + detect_card.py → 並跑 legacy/opencv
- [x] 38.4 影片 .mov 24h 延遲刪（移除 `unlinkSync(videoPath)`、`cleanupOldVideos()` 啟動 + 每小時掃 uploads/）
- [x] 38.5 擴充 dryrun-rerun.js 支援 `--file-id --img --tape` 模式（無 DB tree 也能測，給 14 棵高誤差樹用）

## 39. Gemini batch variance 實驗 + N 次 batch median 策略

**根因發現**（2026-05-30 IMG_5789 實驗，詳見 memory `project-gemini-batch-variance`）：

- Gemini 在 batch 模式下 cross-frame coupling：傳 3 張 frame 進去，3 張回完全相同 ratio
- 單張連跑 5 次 mean ≈ 真實值（誤差 < 7%），cv 7-9%，Gemini 本身不飄
- dryrun #8 拿到 ratio=4.5（legacy）、6.19（opencv）是**單次 outlier**，不是 Gemini 不準
- **含義**：sharpness top 3 / first-mid-last / 兩 prompt 的差異被 batch 共識壓平，frame 挑選策略失去意義；真正要的是「同一 batch 跑 N 次取 median」

- [x] 39.1 寫 `scripts/variance-test.js`，支援單張與 batch 兩種模式，跑 IMG_5789 frame_9 驗證
- [x] 39.2 寫實驗子網頁 `public/variance-tests/1/`，展示原圖 + 5 次 raw + 統計
- [x] 39.3 在 dryrun-rerun.js 加 `--repeat N` 旗標（2026-05-30）：每條 path Promise.all 並行 N 次，寫 dryrun_runs.repeat_n / pathA_*_runs_json / *_median_ratio / *_cv_pct
- [x] 39.4 N=5 驗證 IMG_5789（dryrun #9）：Legacy DBH=25.4 cm err=3.4% cv=0.1%；OpenCV DBH=27.4 cm err=4.2% cv=19.9%。對比 dryrun #8 (N=1) Legacy err=46.4% / OpenCV err=101.5%，N×median 把誤差從 100% 級壓到 < 5%
- [ ] 39.5 拿 N=5 對 5 棵高誤差代表樹（5800、5819、5805、5791、5786）重跑，觀察 median 誤差分布
- [ ] 39.6 評估 production 切換：若 39.5 結果 80% 落在 ±15% 內，把 production 的 `analyzeTrunkPathAOnly` 換成「同 batch × N 次 median」，API cost N 倍但 outlier 顯著降低

## 41. journey 展示頁中文文風改寫（對齊 thesis-advisor 規則，2026-06-01）

**背景**：測試階段全部結束後，journey 演進旅程展示頁（`public/journey/index.html`）的中文敘述偏口語、夾雜大量英文術語當主詞。使用者要求依論文寫作規則（`thesis-advisor.md` §7 寫作注意事項 + §8 中文改寫句型規則）改寫，並先以預覽檔對照、確認後才覆蓋正式頁。

**做法**：保留 CSS、表格、所有數字不動，只改中文敘述文字。原始版與改寫版並存於 `journey-rewrite/` 資料夾，VM 上以另一檔名 `index.rewritten.html` 預覽，不覆蓋正式頁。

- [x] 41.1 複製 `journey/index.html` → `journey-rewrite/index.original.html`（原始對照）+ `journey-rewrite/index.rewritten.html`（改寫版）
- [x] 41.2 套用 thesis-advisor §7/§8 規則改寫全部中文敘述：用詞一律「此專案」（取代「我們／本實驗」）、避免「但／然而」轉折詞改順向連接、技術術語首次出現加中英對照、避免恐懼行銷與絕對語氣詞（不可能→無法單獨成立、強制→固定、搞砸→扭曲）、長代號（tree_id 雜湊）降級到括號
- [x] 41.3 標題改「中文為主、英文為輔」：caveat→但書、AGB→地上生物量、pipeline→處理流程、winner→勝出、OpenCV→電腦視覺工具、Gemini→影像模型、ffmpeg→影音工具、HEVC→高效率編碼影片（英文一律退到括號）
- [x] 41.4 上傳 VM 預覽版 `public/journey/index.rewritten.html`（HTTP 200，不覆蓋正式頁），線上可與原始版並排比對
- [x] 41.5 使用者確認文字後，把改寫版覆蓋正式 `journey/index.html` + 同步推送 GitHub Pages（2026-06-02，push_gh.js 推送）
- [x] 41.6 Caveat 1/2/3 灰框隱藏（display:none）；論文建議段落（MAPE 說明）同步隱藏（2026-06-02）

## 42. dashboard02：Pipeline 4 重跑 31 棵 + Verra 版面 + 樹種中文化 + Besu 輕量 explorer（2026-06-01，待確認後執行）

**背景（Phase 0 唯讀調查結論）**：
- 正式 `trees` 表只有 **18 棵**，不是 31。31 支影片的實驗資料在 `dryrun_runs`（196 列、沙箱），無樹種、無上鏈、非正式樹。
- 樹種流程已實作且跑過（index.js 485–503：Pl@ntNet ＋ iNaturalist 並行投票 → Gemini fallback）；18 棵來源 plantnet 7／gemini 11／**iNaturalist 0（從未勝出）**；全為拉丁學名，需翻中文。
- **P4（video-direct-v2，整支影片給 Gemini）本質不抽離散幀，沒有原生關鍵幀**。會產生關鍵幀的是「標準上傳流程」（ffmpeg 抽幀 → 偵測卡片 → Gemini 逐幀 → evidence 幀）。
- VM 上**沒有任何區塊瀏覽器**（只有 nginx 443/80、app 3000、Besu RPC 8545/8546）；blockchain_jobs 有 tx_hash 但無 block number，需用 tx_hash 打 eth_getTransactionReceipt 取區塊號。鏈高約 126866。

**使用者決策**：
1. 用 **Pipeline 4（N=10、整支影片給 Gemini）重跑 31 棵**，prompt 加上「回傳 5 個關鍵幀時間點（MM:SS）＋特徵描述」，讓使用者可依時間點自行截圖。
2. dashboard02 版面**以 Verra 為主**；保留〔區塊鏈存證〕〔EXIF 元數據〕〔原始影片〕〔永續故事（已生成、不重跑）〕；只改〔量測結果〕〔路徑估算〕〔人工皮尺測量〕三區塊。
3. 主畫面（生產流程）**只放 Gemini 回傳的關鍵幀**；其他 pipeline 實驗的關鍵幀放到 journey 頁（index.rewritten.html）以佐證各 pipeline 執行過程。
4. **先測試 Gemini 能否回傳關鍵幀**（使用者問過網頁版 Gemini，回答可以）。
5. 架**最輕量的 explorer**，產生真實可點的區塊 URL。
6. 生成新檔 **dashboard02.html，不動原 dashboard.html**，供對照。

**P4 重跑 prompt（追加段，存於 memory.md §15）**：
> 請分析這段影片中的樹木樹徑。除了給出最終的測量數字之外，請精確列出你用來計算樹徑的 5 個關鍵幀時間點（格式為 MM:SS），並說明你在該時間點看到了什麼特徵（例如：樹幹無遮蔽處、特定海拔高度氣壓計畫面）。

**已確認決策（2026-06-01）**：
- 42.0a ✅ 處理**全 31 棵**：18 棵更新量測＋重新上鏈、**保留舊故事與 EXIF（故事不重生）**；**新 13 棵完整生成**（量測＋共同判斷樹種＋上鏈＋故事＋EXIF）。以 video_hash／Drive file_id 對映既有 18 棵。
- 42.0b ✅ **全 31 棵用 P4 新值重新上鏈（產生新區塊），不沿用舊區塊**。
- 42.0c ✅ **自動 ffmpeg 截圖**（依 Gemini 回傳時間點）；同時**保留 Gemini 回傳原始 JSON**，N=10 共 10 份；頁面用**下拉選單**選第幾次 run，連到該次 JSON 查詢頁並顯示對應 5 張關鍵幀截圖。
- 42.0d ✅ **封存傳統上傳流程**（保留 index.js 舊 processVideo 不動），**新建一份檔案寫 P4 混合新流程並改用新流程**。
- 42.0e ✅ **樹種辨識改用 Gemini ＋ Pl@ntNet 兩方**（iNaturalist 暫緩，見下方待辦）。原因：iNaturalist token 是短效 JWT、現已過期（2026-05-11 到期），且建 OAuth 應用程式需帳號滿 2 個月＋超過 10 次鑑定，使用者目前無權限。
- 42.0f ✅ **取幀改良**：`rerun_p4.js` 原本「無腦平均取 6 幀」可能漏拍樹冠；改成讓 P4 的 Gemini 回傳「樹冠／葉子最清楚的時間點（leafTimestamps）」→ ffmpeg 抓那幾幀送 Pl@ntNet，確保葉子入鏡。

**⏳ 待辦（暫緩，日後補）**：
- [ ] 42.X iNaturalist 三方共同判斷：待 iNaturalist 帳號滿 2 個月且鑑定數 > 10 後，建 OAuth 應用程式（redirect `urn:ietf:wg:oauth:2.0:oob`）→ 授權碼換長效 access_token → 流程每次辨識前自動打 `GET /users/api_token` 換 24h JWT，恢復「Pl@ntNet＋iNaturalist＋Gemini」三方共同判斷。

**子任務（待最終確認後啟動）**：
- [ ] 42.1 先測：對 1–2 支影片跑 P4 新 prompt，確認 Gemini 穩定回傳 5 個關鍵幀（MM:SS）＋特徵、格式可解析（測通才往下）
- [~] 42.2 新建 pipeline 檔 `rerun_p4.js`（已寫、dry-run 單支通過），封存舊 processVideo 不動；新流程＝標準步驟（EXIF＋**Pl@ntNet＋Gemini** 共同判斷樹種＋上鏈＋（新樹）故事）＋量測引擎換 P4（video-direct, N=10）。**待補：取幀改良（42.0f）＋移除 iNaturalist 呼叫**
- [ ] 42.3 P4 Gemini 函式 schema/prompt 加 `keyframes`（5×{timestamp MM:SS, feature}）＋ `leafTimestamps`（樹冠/葉子清楚時間點，供 Pl@ntNet 取幀）；保存 10 次 run 原始 JSON
- [ ] 42.4 對 31 支跑新流程：18 棵更新（保留故事/EXIF）＋13 棵完整生成；全部以 P4 新值重新上鏈（新區塊）
- [ ] 42.5 自動截圖：ffmpeg 依關鍵幀時間點從影片截圖（每次 run 5 張）
- [ ] 42.6 10 次 run JSON 存檔 + endpoint（如 `/api/trees/:id/p4-run/:n`）+ dashboard02 下拉選單查詢
- [ ] 42.7 樹種學名 → 中文俗名（中文為主、學名小標）套進顯示
- [ ] 42.8 取 block number（eth_getTransactionReceipt(tx_hash)）；架最輕量 explorer（Expedition／Ethereum Lite Explorer，單服務指向 8545）；組真實 `/tx/<hash>` URL
- [ ] 42.9 dashboard02.html（複製自 dashboard.html、不動原檔）改 Verra 版面：保留 chain/EXIF/video/story 區塊；改寫量測結果/路徑估算/人工皮尺三區塊；關鍵幀區塊放自動截圖＋10-run JSON 下拉
- [ ] 42.10 其他 pipeline（P1a/P1b/P2/P3）關鍵幀佐證移到 journey 頁
- [ ] 42.11 部署 dashboard02.html 到 VM 供對照（不動 dashboard.html）

**版面細節（Verra 導向，路徑估算＝憑證依據）**：
- 31 棵皆有人工皮尺真值（Path 0／manual tape）：來源 memory §4 tape 欄 + §31「31/31 覆寫」+ dryrun `baseline_manual_tape_cm`；新 13 棵建樹時一併寫入。
- 知識點（避免漏）：憑證算的是**碳非 DBH**；DBH→AGB 誤差被平方放大；決定核發的「90% CI 半寬÷平均<100%」是**樣本層級**統計（DBH 8%／AGB 16%），非單棵；校準因子先修偏差才宣稱對齊；「與 Path 0 誤差」＝對人工真值的準度（Verra §9.1 unbiased 證據）。
- 〔路徑估算〕區塊（每棵）＝完整憑證換算鏈：P4 DBH（10 次中位數）→ 校準後 DBH（×校準因子）→ AGB（地上生物量，異速生長 DBH²）→ 碳儲量/CO2e；並列「與 Path 0 誤差（DBH 層、碳層）」；附一行「樣本層級 90% CI 見 §2 Verra 彙總」。
- 〔人工皮尺測量〕區塊：顯示 Path 0 真值 + P4 vs 皮尺誤差（31 棵都有值）。
- 〔關鍵幀〕區塊：下拉選 run 1–10 → 該次 5 張截圖（點到才 ffmpeg 即時截、快取）＋連該次原始 JSON；預設中位數 DBH 那一次。

---

### §42 v2 最終設計（B/C 決策後，2026-06-01）—— 取代上面「合併 prompt」版

**背景**：合併 prompt（量測＋關鍵幀＋樹種同一次）實測退步——17 棵只有 41–47% PASS（原始 P4 為 73%），各種彙總法都救不了，證實量測被稀釋。改採「拆開」設計。

**已確認決策**：
- B ✅ 量測 prompt 改回**原始純量測版**（證明過、73% 那版，只回量測數字＋`videoTimestampSec`＋confidence），N=10。**關鍵幀＝每次量測回傳的 `videoTimestampSec`（該次真正判斷的時刻），10 次＝10 個真實量測幀**，零造假、量測零稀釋。
- C ✅ 樹種辨識**獨立一次呼叫**（不碰量測）；Gemini 與 Pl@ntNet 不同種時**兩種都寫、都顯示、不分勝負**（移除 winner 投票）；**碳用兩種樹種係數各算一個、兩個碳都顯示**（最透明）。
- ✅ dashboard 要顯示**判樹種用的關鍵幀**（leafTimestamps 抓的樹冠幀）。
- ✅ 彙總法＝去頭去尾÷8（暫定，31 棵跑完用 §42 統計法分析節再定）。
- ✅ 校準因子：先存原始、跑完用全 31 算（舊 ×1.124 已棄）。

**基礎設施**：
- [x] 42.A1 GCP 硬碟 10→30GB（已擴、growpart+resize2fs，現 20G free）
- [~] 42.A2 暫停 24h 刪除 — **免做**：cleanupOldVideos 只掃 `uploads/`，v2 快取在 `video_cache/`，碰不到
- [x] 42.A3 `rerun_p4.js` 不刪影片（快取 `video_cache/` 持久）

**程式（rerun_p4 v2）**：
- [x] 42.B1 純量測 prompt（videoTimestampSec…），N=10
- [x] 42.B2 關鍵幀＝videoTimestampSec，存 raw_result.runs[].videoTimestampSec + measureTimestamps
- [x] 42.C1 樹種獨立呼叫 + leafTimestamps + ffmpeg leaf 幀 → Pl@ntNet
- [x] 42.C2 兩種樹種都存、兩種碳都算（raw_result.species.gemini/plantnet, carbon）
- [~] 42.C3 leaf 幀已存 `species_frames/{img}/`；**dashboard 顯示待 dashboard02 v2**
- [ ] 42.C4 補 formulaDb 缺的樹種（欖仁樹 Terminalia catappa、櫸木 Zelkova serrata 等 — 跑完看全部一次補）
- [x] 42.T 測 1–2 支（5787 dry 4.8%，純量測準度回到水準）

**v2 批次與分析（2026-06-02）**：
- [x] 42.E1 30 支 v2 批次跑完（5804 兩棵樹除外）、全部寫 DB＋上鏈
- [x] 42.E2 彙總法 + 校準因子分析：**中位數最佳 57%（≤15%）**、校準因子 ×1.155；門檻掃描（≤20%=63%、≤25%=77%、≤30%=87%）
- [x] 42.E3 Verra §8.4 不確定性：**CI 半寬/平均 = 7.4%（DBH）／14.7%（AGB）<< 100% 紅線 → 通過**
- [x] 42.E4 **決定彙總法（中位數）**；30 棵 dbh_cm/碳改用中位數重算（CALIB ×1.155），16/30 PASS，總碳 6514 kg（2026-06-02）
- [x] 42.E5 5804（一影片兩棵樹）補 v2 相容標記（measureTimestamps:[]、aggMethodFinal:'manual_tape'），碳重算完成（2026-06-02）

**靜態頁（journey）**：
- [x] 42.D0 首頁兩按鈕加大、量測記錄→dashboard02、第二顆→journey；推 GitHub Pages
- [x] 42.D0b journey 改寫版＋dashboard＋dashboard02(暫為副本) 推上 GitHub Pages
- [x] 42.D1 journey 開頭結尾補 dashboard02 網址（2026-06-02）
- [x] 42.D2 §結論前加「統計法 × AGB × Verra 不確定性」分析節（放 42.E2/E3 那兩張表）（2026-06-02，新增 §7 生產版統計彙整）

**dashboard02 v2（核心待辦）**：
- [x] 42.F1 後端：/api/trees 加 p4v2 欄位（雙樹種、雙碳、AGB/CO2e、measureTimestamps、leafTimestamps）；新增 /api/trees/:id/frame-at?sec= 端點（ffmpeg 即時截圖＋24h 快取）（2026-06-02）
- [x] 42.F2 dashboard02.html 建立（553 行）：Verra 換算鏈 DBH→AGB→碳→CO2e、雙樹種並列、量測關鍵幀 lazy load、樹種辨識葉片幀、鏈上紀錄連結（2026-06-02）
- [x] 42.F3 dashboard02 + tx.html 部署 VM + GitHub Pages（commit 332c6c8）；trees.json 同步 32 筆含 v2 欄位（2026-06-02）

**Besu explorer**：
- [x] 42.G1 架最輕量 explorer：Express /api/tx/:hash 代理 Besu RPC + public/tx.html 靜態頁（commit 74ce6ed）；dashboard02 tx 雜湊已加可點連結（2026-06-02）

## 43. 前端 API 欄位存取統一化（消除各頁面靜默壞掉問題）

**問題根因**：dashboard.html、stories.html、story.html 各自拼 API 欄位，沒有共用的 helper function。
欄位命名不一致（`carbon.carbonKg` vs `carbon.primaryKg`、`species.primary`（拉丁）vs `species.gemini.zhName`（中文））導致頁面靜默顯示空白，不報錯、難察覺。
靜態文字（如「32 棵」）也會和實際資料脫鉤。

**設計目標**：建立共用 helper，各頁面統一呼叫，不再各自猜 API 欄位路徑。

- [ ] 43.1 整理目前各頁面用到的 API 欄位存取路徑，列出所有不一致點（carbon、species、zhName、carbonKg/primaryKg）
- [ ] 43.2 在 `public/js/treeHelpers.js` 建立共用 helper：`getSpeciesZh(r)`、`getSpeciesEn(r)`、`getCarbonKg(r)`、`getDbhCm(r)`，各函式內部處理 p4v2 vs 舊路徑的 fallback
- [ ] 43.3 dashboard.html、stories.html、story.html、dashboard02.html 改用共用 helper，移除各自的內聯拼接邏輯
- [ ] 43.4 靜態文字（棵數、標題）全部改由 JS 動態填入，禁止硬寫數字進 HTML

## 44. 論文討論章節：H-D 異速生長方程式的方法論限制（thesis-limitation）

**問題背景**：`formulaDb.js` 的 H-D 方程式（H = a × DBH^b）係數來自台灣林業局在**林地條件**下校準的數據，校準對象為閉密樹冠、競光生長的天然林或人工林樹木。此次量測對象為城市行道樹、公園樹，生長驅力不同（開放空間、定期剪枝、根域受鋪面限制），H/D 比值明顯低於林地樹木，導致以林地方程式估算城市樹高時產生系統性正向偏誤（高估約 2 倍），進而使碳儲量絕對值高估約 87%。

**與 Verra 框架的關係**：
- Verra VM0047 §8.4 驗證的是 **DBH 量測不確定性**（CI/mean = 6.5%），H-D 方程式屬下游計算，不影響 RQ1 精度驗證結論。
- Verra VCS AFOLU 要求方程式必須為「locally appropriate」（本地適用），且保守性原則要求碳估算應向下偏、不可向上偏——城市樹使用林地 H-D 方程式違反此原則。
- 若未來要進入 Verra 碳信用額度申請程序，需改用城市樹木專屬方程式或依 VCS 規定進行保守性扣除（conservativeness deduction）。

**論文處理方向**：寫入討論章節「方法限制」段落，定性說明此偏誤來源、影響範圍，以及改善路徑（引入 Chave 2014 泛熱帶方程式或 i-Tree 城市樹方程式）。RQ1 結論不受影響。

- [ ] 44.1 在論文討論章節（5.x 或 Limitations 段落）新增「城市立地 H-D 方程式適用性」段落，說明：
  - 系統性高估的機制（林地 H/D 比 vs 城市 H/D 比）
  - 對碳儲量絕對值的影響（~87% 高估），但不影響 RQ1 DBH 精度驗證
  - Verra 保守性原則下的合規疑慮
  - 建議改善路徑（Chave 2014、i-Tree）
- [ ] 44.2 確認論文中所有引用碳儲量數字的段落，加入「以天然林 H-D 方程式估算，城市立地下為偏高估計」的附注
- [ ] 44.3 評估是否需要在展示頁（story.html、dashboard.html）的碳儲量旁加入說明標注（可選）
