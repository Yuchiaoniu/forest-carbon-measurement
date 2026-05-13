## ADDED Requirements

### Requirement: 自動偵測信用卡或 A4 紙
系統 SHALL 在 Gemini 視覺分析時同時偵測畫面中是否有信用卡（85.6×53.98mm）或 A4 紙（210×297mm），並回傳類型與像素寬度。

#### Scenario: 偵測到信用卡
- **WHEN** 關鍵幀中有清晰可見的信用卡
- **THEN** Gemini 回傳 `referenceDetected=true`、`referenceType="creditcard"`、`referencePixelWidth=實測像素數`

#### Scenario: 偵測到 A4 紙
- **WHEN** 關鍵幀中有清晰可見的 A4 紙
- **THEN** Gemini 回傳 `referenceDetected=true`、`referenceType="a4"`、`referencePixelWidth=短邊像素數`

#### Scenario: 未偵測到參照物
- **WHEN** 關鍵幀中沒有信用卡或 A4 紙
- **THEN** Gemini 回傳 `referenceDetected=false`，系統繼續使用 AI 估距路徑

### Requirement: 長寬比驗證防止誤判
系統 SHALL 驗證偵測到的參照物長寬比，超出合理範圍則視為偵測失敗。

#### Scenario: 信用卡長寬比驗證
- **WHEN** Gemini 回傳 referenceType=creditcard 但長寬比超出 1.586 ±15%
- **THEN** 系統忽略此次偵測，改用 AI 估距

#### Scenario: A4 紙長寬比驗證
- **WHEN** Gemini 回傳 referenceType=a4 但長寬比超出 1.414 ±15%
- **THEN** 系統忽略此次偵測，改用 AI 估距
