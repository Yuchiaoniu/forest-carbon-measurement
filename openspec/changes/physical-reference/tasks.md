## 1. Gemini 參照物偵測擴充

- [x] 1.1 擴充 response schema 加入 referenceDetected、referenceType、trunkToReferenceRatio
- [x] 1.2 加入 referenceAtTrunk（參照物是否接觸樹幹）欄位，getMedianResult() 僅用 referenceAtTrunk=true 幀計算 Route A
- [x] 1.3 加入 referenceOffTrunkDetected：偵測到但不在樹幹旁時輸出警告，confidence 降為 medium
- [x] 1.4 更新 prompt 支援 10 種已知類型（creditcard, businesscard, a4, a5, b5notebook, ruler30, ruler100, banknote100, banknote500, banknote1000）+ "unknown" 開放辨識
- [x] 1.5 加入 referenceEstimatedWidthMm（unknown 類型時 Gemini 估算寬度）、referenceConfidence（0–1）
- [x] 1.6 getMedianResult() 對同一 referenceType 取 trunkToReferenceRatio 中位數；referenceConfidence < 0.4 的幀排除

## 2. 路徑 0：直接量測讀數（OCR）

- [x] 2.1 Gemini schema 加入 directMeasurementCm、measurementType 欄位
- [x] 2.2 prompt 加入捲尺/直尺讀數辨識說明（circumference=周長讀數，diameter=直徑讀數）
- [x] 2.3 directMeasurementCm 從所有原始幀（含特寫）取中位數，不受有效幀篩選限制
- [x] 2.4 calculationService.js 路徑 0：circumference → DBH = cm / π，diameter → DBH 直接使用

## 3. Route A 計算邏輯

- [x] 3.1 REFERENCE_SIZES 擴充至 10 種已知參照物，含 width/height（mm）
- [x] 3.2 Route A 計算：DBH = trunkToReferenceRatio × refWidthMm ÷ 10（cm）
- [x] 3.3 unknown 類型使用 referenceEstimatedWidthMm 作為 refWidthMm
- [x] 3.4 優先順序：路徑 0 > 路徑 A > 路徑 B；路徑 0/A 成功時同步計算 routeBDbhCm 供修正因子學習

## 4. 葉片幀標記與辨識整合

- [x] 4.1 Gemini schema 加入 leafVisible 欄位（葉片細節清楚才標 true）
- [x] 4.2 getMedianResult() 輸出 leafFrameIndices（有葉片幀的索引陣列）
- [x] 4.3 index.js 流程改為 Gemini 先執行，PlantNet/iNaturalist 優先使用 leafFrameIndices 幀；無葉片幀時退回全幀

## 5. 資料庫

- [x] 5.1 新增 ground_truth 資料表（tree_id, actual_dbh_cm, estimated_dbh_cm, correction_factor, source, created_at）
- [x] 5.2 新增 src/db/groundTruth.js，實作 insert() 與 getByTreeId()
- [x] 5.3 trees 資料表新增 reference_used、reference_type 欄位

## 6. 主流程整合

- [x] 6.1 index.js 計算步驟加入路徑 0/A/B 判斷分支，傳入 referenceOffTrunkDetected
- [x] 6.2 路徑 0 或 A 成功時自動寫入 ground_truth（source='direct_measurement' 或 'reference'）
- [x] 6.3 routeBDbhCm（路徑 B 平行估算值）存入 ground_truth.estimated_dbh_cm，供修正因子學習使用
- [x] 6.4 結果回傳加入 referenceUsed、referenceType、referenceWidthMm、directMeasurementUsed、routeBDbhCm

## 7. API 端點

- [x] 7.1 POST /api/ground-truth：接受 { treeId, actualDbhCm }，寫入 ground_truth（source=manual）
- [x] 7.2 計算 correction_factor = actualDbhCm / estimated，驗證正確

## 8. 前端

- [x] 8.1 測量結果加入「回報實測值」輸入欄與送出按鈕
- [x] 8.2 結果顯示參照物類型與量測路徑標示（路徑 0/A/B）
- [x] 8.3 上傳說明加入拍攝建議（可放任何已知尺寸物件碰到樹幹）

## 9. 田野驗證測試

- [ ] 9.1 拍攝含參照物接觸樹幹的影片（名片或 A4），驗證 Route A，DBH 落在合理範圍
- [ ] 9.2 測試多種參照物類型（至少 3 種），各自驗證辨識正確
- [ ] 9.3 路徑 0：拍攝含捲尺讀數的影片，驗證 DBH = 讀數 ÷ π（周長量測）
- [ ] 9.4 拍攝無參照物的影片，驗證行為與原 Route B 相同，confidence 正確降級
- [ ] 9.5 測試手動回報實測值 API，驗證 correction_factor 正確計算並存入 ground_truth
