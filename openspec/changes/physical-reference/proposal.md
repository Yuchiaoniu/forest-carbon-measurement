## Why

現有系統依賴 Gemini AI 估算相機到樹幹的距離（Z），誤差約 ±25%，導致 DBH 單棵精度受限。加入實體參照物（信用卡或 A4 紙）後，AI 可從已知物理尺寸直接換算比例尺，不需要估距，DBH 精度提升至 ±2-3%，同時這些高精度測量值可作為虛擬估距模式的 ground truth 訓練資料。

## What Changes

- **新增** Gemini 提示語中的參照物偵測邏輯（信用卡 85.6mm、A4 紙 210mm）
- **新增** `calculateWithReference()` 比例尺換算函式
- **新增** `ground_truth` 資料表記錄實際測量值與修正因子
- **新增** 前端「回報實測值」按鈕（人工 ground truth 回報）
- **修改** Gemini response schema 加入參照物欄位
- **修改** 主流程依據有無參照物切換計算路徑
- **修改** 結果回傳加入 `referenceUsed`、`referenceType` 欄位

## Capabilities

### New Capabilities

- `reference-detection`: Gemini 自動偵測幀中的信用卡或 A4 紙，回傳類型與像素寬度
- `reference-calculation`: 依參照物尺寸計算精確比例尺，取代 AI 估距路徑
- `ground-truth-recording`: 記錄 AI 估算值與實際測量值，計算並累積修正因子

### Modified Capabilities

- `ai-trunk-analysis`: Gemini response schema 新增 referenceDetected、referenceType、referencePixelWidth 欄位
- `dbh-calculation`: 新增 reference 路徑，referenceUsed 為 true 時改用比例尺公式

## Impact

- **修改檔案**：`src/services/geminiService.js`、`src/services/calculationService.js`、`src/index.js`、`src/db/init.js`、`src/db/trees.js`
- **新增檔案**：`src/db/groundTruth.js`
- **前端**：`public/index.html` 加入回報實測值的輸入欄位
- **不影響**：上鏈邏輯、Pl@ntNet/iNaturalist 辨識、元數據擷取、幀擷取
- **精度提升**：有參照物時 DBH 誤差 ±2-3%，無參照物維持現有 ±25%
