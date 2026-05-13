## 1. 修正因子統計服務

- [x] 1.1 新增 src/services/correctionFactorService.js，實作 getFactorBySpecies(species) 查詢加權平均
- [x] 1.2 實作 getAllFactors() 彙總所有樹種統計（含樣本數、加權平均、標準差、applicable 旗標）
- [x] 1.3 近期資料加權邏輯：30 天內 weight=2，超過 weight=1

## 2. API 端點

- [x] 2.1 新增 GET /api/correction-factors，回傳所有樹種修正因子統計
- [x] 2.2 新增 GET /api/correction-factors/:species，回傳特定樹種統計

## 3. 套用修正因子到測量流程

- [x] 3.1 在 index.js 計算完 DBH 後，若 referenceUsed=false 則查詢修正因子
- [x] 3.2 樣本數 ≥5 時套用：adjustedDbhCm = dbhCm × correctionFactor
- [x] 3.3 結果加入 correctionApplied、originalDbhCm、correctionFactor 欄位

## 4. 前端摘要頁面

- [x] 4.1 新增 public/correction-factors.html，呼叫 /api/correction-factors 並顯示表格
- [x] 4.2 顯示各樹種：學名、樣本數、修正因子、是否可用
- [x] 4.3 主頁面 index.html 導覽列加入「修正因子」連結

## 5. 測試

- [x] 5.1 手動插入 5 筆 Ficus microcarpa ground_truth，修正因子 0.7716 正確計算
- [x] 5.2 其他樹種無 ground_truth 時 correctionApplied=false（已驗證）
- [x] 5.3 referenceUsed=true 時不套用修正（程式碼條件保證）
