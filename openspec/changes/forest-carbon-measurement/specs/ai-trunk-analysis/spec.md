## ADDED Requirements

### Requirement: AI 視覺分析樹幹
系統 SHALL 將 3 張關鍵幀與相機物理常數一併送至 Gemini Flash，取得每幀的樹幹像素寬度（胸高處）與相機到樹幹的距離估算（公尺）。

#### Scenario: 成功取得三幀數據
- **WHEN** Gemini 成功分析 3 幀
- **THEN** 回傳 3 組 `{ pixelWidth, estimatedDistance }` 並取中位數作為最終值

#### Scenario: 部分幀分析失敗
- **WHEN** Gemini 對某幀回傳無效結果（如樹幹被遮蔽）
- **THEN** 忽略該幀，以剩餘有效幀的中位數計算，至少需 1 幀有效

#### Scenario: 全部幀分析失敗
- **WHEN** Gemini 無法從任何幀識別樹幹
- **THEN** 系統回傳錯誤 `"無法識別樹幹，請重新拍攝"`，不進行上鏈

### Requirement: 結構化 Prompt 輸出
系統 SHALL 以固定 JSON schema 要求 Gemini 回傳結果，避免自由文字解析。

#### Scenario: Gemini 回傳有效 JSON
- **WHEN** Gemini 回傳符合 schema 的 JSON
- **THEN** 系統直接解析使用

#### Scenario: Gemini 回傳格式錯誤
- **WHEN** Gemini 回傳無法解析的格式
- **THEN** 系統重試一次，仍失敗則標記該幀為無效
