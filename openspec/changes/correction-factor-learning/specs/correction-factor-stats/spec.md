## ADDED Requirements

### Requirement: 修正因子統計彙總
系統 SHALL 從 ground_truth 表彙總各樹種的修正因子統計，包含樣本數、加權平均值、標準差。

#### Scenario: 查詢有足夠樣本的樹種
- **WHEN** GET /api/correction-factors
- **THEN** 回傳各樹種的 `{ species, sampleCount, weightedAvg, stdDev, applicable }` 清單，applicable=true 代表樣本數 ≥5

#### Scenario: 查詢特定樹種
- **WHEN** GET /api/correction-factors/:species
- **THEN** 回傳該樹種的統計，若樣本數 < 5 回傳 `{ applicable: false, sampleCount }`

### Requirement: 近期資料加權
系統 SHALL 對 30 天內的 ground_truth 資料給予 2 倍權重。

#### Scenario: 加權計算
- **WHEN** ground_truth 包含新舊資料
- **THEN** 30 天內的資料 weight=2，30 天以前 weight=1，加權平均作為修正因子
