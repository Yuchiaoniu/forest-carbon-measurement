## Why

系統目前的 DBH 估算在無實體參照物時誤差約 ±25%，主要來自 AI 距離估算的不確定性。透過累積 ground_truth 資料（實體參照物自動寫入 + 用戶手動回報），可以統計各樹種、各拍攝條件下的系統性偏差，計算修正因子，讓無參照物的測量精度隨資料累積而持續改善。

## What Changes

- **新增** 修正因子統計分析 API（GET /api/correction-factors/stats）
- **新增** 修正因子套用邏輯：查詢 ground_truth 統計，在 DBH 計算後自動乘以修正因子
- **新增** 修正因子信心評估（樣本數 < 5 時不套用）
- **新增** 前端修正因子摘要頁面（顯示各樹種的修正因子與樣本數）
- **新增** 管理 API：手動觸發修正因子重新計算

## Capabilities

### New Capabilities

- `correction-factor-stats`: 從 ground_truth 表彙總各條件的修正因子統計
- `correction-factor-application`: 在 DBH 計算後查詢並套用對應修正因子
- `correction-factor-dashboard`: 前端頁面展示修正因子學習進度

### Modified Capabilities

- `dbh-calculation`: 計算完成後若有足夠樣本的修正因子則自動套用

## Impact

- **修改檔案**：`src/services/calculationService.js`、`src/index.js`、`public/index.html`
- **新增檔案**：`src/services/correctionFactorService.js`
- **資料庫**：使用既有 `ground_truth` 表，不新增表
- **不影響**：影片上傳流程、樹種辨識、上鏈邏輯、physical-reference 路徑（已是高精度，不套修正）
- **精度預期**：累積 10+ 筆 ground_truth 後，無參照物 DBH 誤差可從 ±25% 降至 ±15%
