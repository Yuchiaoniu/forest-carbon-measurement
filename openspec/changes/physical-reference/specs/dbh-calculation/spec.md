## MODIFIED Requirements

### Requirement: 薄透鏡公式計算 DBH
系統 SHALL 在 referenceUsed=true 時改用比例尺公式，referenceUsed=false 時維持原薄透鏡公式。

#### Scenario: 比例尺路徑（有參照物）
- **WHEN** referencePixelWidth > 0 且長寬比驗證通過
- **THEN** DBH = trunkPixelWidth × (referencePhysicalWidthMm / referencePixelWidth)，精度 ±2-3%

#### Scenario: 薄透鏡路徑（無參照物）
- **WHEN** referenceDetected=false
- **THEN** 使用原公式 DBH = (pixelWidth × sensorWidth × Z) / (imageWidth × focalLength)，行為不變

### Requirement: 信心等級反映參照物使用
系統 SHALL 在 referenceUsed=true 時自動標記 confidence="high"，不受 frameQuality 或距離標準差影響。

#### Scenario: 有參照物時信心為 high
- **WHEN** referenceUsed=true
- **THEN** confidence="high"，不論其他條件
