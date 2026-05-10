## ADDED Requirements

### Requirement: 薄透鏡公式計算 DBH
系統 SHALL 使用公式 `DBH = (pixelWidth × sensorWidth × distance) / (imageWidth × focalLength)` 計算胸徑，單位公分。

#### Scenario: 完整參數計算
- **WHEN** pixelWidth、sensorWidth、distance、imageWidth、focalLength 均有效
- **THEN** 系統計算 DBH 並四捨五入至小數點後一位（公分）

#### Scenario: 距離估算為零或異常
- **WHEN** estimatedDistance ≤ 0 或 > 50
- **THEN** 系統標記 `dbhConfidence: "low"` 並使用預設距離 3.0m 繼續計算

### Requirement: 台灣林業局材積公式
系統 SHALL 根據樹種套用對應材積公式，計算單株材積（m³）與碳儲量（kg C）。

#### Scenario: 樟樹材積計算
- **WHEN** 樹種為樟樹，DBH 已知
- **THEN** 套用樟樹 H-D 關係式估算樹高，再以圓柱體積分公式計算材積

#### Scenario: 碳儲量換算
- **WHEN** 材積計算完成
- **THEN** 碳儲量 = 材積 × 木材密度 × 生物量擴展係數 × 0.5（碳含量比例）

### Requirement: 信心等級標記
系統 SHALL 根據 frameQuality 與距離估算品質，輸出 `confidence: "high" | "medium" | "low"`。

#### Scenario: 高信心測量
- **WHEN** frameQuality 為 "good" 且 3 幀距離估算標準差 < 20%
- **THEN** 標記 `confidence: "high"`

#### Scenario: 低信心測量
- **WHEN** frameQuality 為 "low" 或距離估算標準差 ≥ 20%
- **THEN** 標記 `confidence: "low"` 並建議重新拍攝
