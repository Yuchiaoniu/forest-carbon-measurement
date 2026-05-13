## ADDED Requirements

### Requirement: ground_truth 資料表
系統 SHALL 建立 `ground_truth` 資料表記錄高精度測量值與修正因子。

#### Scenario: 有參照物時自動寫入
- **WHEN** referenceUsed=true 且計算完成
- **THEN** 自動寫入 ground_truth：`{ tree_id, actual_dbh_cm, correction_factor=1.0, source="reference" }`

#### Scenario: 人工回報實測值
- **WHEN** 使用者在前端輸入捲尺實測的 DBH
- **THEN** 寫入 ground_truth：`{ tree_id, actual_dbh_cm, correction_factor=actual/estimated, source="manual" }`

### Requirement: 前端回報實測值按鈕
系統 SHALL 在測量結果頁面提供輸入欄位，讓使用者回報捲尺實測的 DBH 值。

#### Scenario: 回報實測值
- **WHEN** 使用者輸入實測 DBH 並送出
- **THEN** 系統計算 correction_factor = actual / estimated，存入 ground_truth，顯示確認訊息

#### Scenario: API 端點
- **WHEN** POST /api/ground-truth { treeId, actualDbhCm }
- **THEN** 寫入 ground_truth 表，回傳 { correctionFactor, message }
