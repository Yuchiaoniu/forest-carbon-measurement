## ADDED Requirements

### Requirement: 比例尺換算取代 AI 估距
系統 SHALL 在偵測到有效參照物時，使用比例尺公式計算 DBH，不使用 AI 估算距離。

#### Scenario: 信用卡換算 DBH
- **WHEN** referenceDetected=true 且 referenceType=creditcard
- **THEN** scale = 85.6mm / referencePixelWidth，DBH = trunkPixelWidth × scale，結果標記 `referenceUsed=true`

#### Scenario: A4 紙換算 DBH
- **WHEN** referenceDetected=true 且 referenceType=a4
- **THEN** scale = 210mm / referencePixelWidth，DBH = trunkPixelWidth × scale，結果標記 `referenceUsed=true`

#### Scenario: 無參照物維持舊行為
- **WHEN** referenceDetected=false
- **THEN** 使用現有薄透鏡公式與 AI 估距，`referenceUsed=false`

### Requirement: 結果標記參照物資訊
系統 SHALL 在測量結果中包含 `referenceUsed`、`referenceType`、`referenceScaleMmPerPx` 欄位。

#### Scenario: 有參照物的結果
- **WHEN** 使用信用卡計算完成
- **THEN** 回傳 `{ referenceUsed: true, referenceType: "creditcard", referenceScaleMmPerPx: 0.046 }`
