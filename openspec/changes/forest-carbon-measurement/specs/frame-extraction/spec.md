## ADDED Requirements

### Requirement: 擷取候選關鍵幀
系統 SHALL 使用 FFmpeg 從影片均勻擷取 10 個候選幀，再以 Laplacian variance 評分選出最清晰的 3 幀。

#### Scenario: 正常影片擷取
- **WHEN** 影片時長超過 3 秒
- **THEN** 系統產出 3 張 JPEG 關鍵幀，每張清晰度分數高於閾值 100

#### Scenario: 超短影片
- **WHEN** 影片時長少於 3 秒
- **THEN** 系統取全部可用幀（至少 1 張），繼續後續分析

#### Scenario: 所有幀均模糊
- **WHEN** 所有候選幀 Laplacian variance 低於 100
- **THEN** 系統仍取分數最高的 3 幀並標記 `frameQuality: "low"`，不中斷流程

### Requirement: 幀品質標記
系統 SHALL 對每張關鍵幀記錄清晰度分數，並在結果中回報 `frameQuality: "good" | "low"`。

#### Scenario: 品質良好
- **WHEN** 最佳幀 Laplacian variance ≥ 100
- **THEN** 回傳 `frameQuality: "good"`

#### Scenario: 品質偏低
- **WHEN** 最佳幀 Laplacian variance < 100
- **THEN** 回傳 `frameQuality: "low"` 並在結果附帶警告訊息
