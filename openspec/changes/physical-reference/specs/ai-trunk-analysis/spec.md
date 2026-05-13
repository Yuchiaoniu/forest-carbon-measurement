## MODIFIED Requirements

### Requirement: 結構化 Prompt 輸出
Gemini response schema SHALL 新增參照物相關欄位，每幀回傳 `referenceDetected`、`referenceType`、`referencePixelWidth`、`referencePixelHeight`。

#### Scenario: Gemini 回傳含參照物資訊
- **WHEN** 送出含參照物偵測要求的 prompt
- **THEN** 每幀結果包含 `{ trunkDetected, pixelWidth, estimatedDistanceM, breastHeightVisible, referenceDetected, referenceType, referencePixelWidth, referencePixelHeight }`

#### Scenario: 無參照物時欄位仍存在
- **WHEN** 畫面中沒有參照物
- **THEN** 回傳 `{ referenceDetected: false, referenceType: null, referencePixelWidth: 0, referencePixelHeight: 0 }`
