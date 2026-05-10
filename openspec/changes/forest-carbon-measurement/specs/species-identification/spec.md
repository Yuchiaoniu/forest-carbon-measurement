## ADDED Requirements

### Requirement: 雙層樹種辨識
系統 SHALL 優先使用 Pl@ntNet API 辨識樹種；若 Pl@ntNet 信心分數低於 0.80，則 fallback 至 Gemini Flash Vision。

#### Scenario: Pl@ntNet 高信心
- **WHEN** Pl@ntNet 回傳最高信心分數 ≥ 0.80
- **THEN** 採用 Pl@ntNet 結果，記錄 `speciesSource: "plantnet"`

#### Scenario: Pl@ntNet 低信心，改用 Gemini
- **WHEN** Pl@ntNet 最高信心分數 < 0.80
- **THEN** 將關鍵幀送至 Gemini Flash，請其辨識樹種，記錄 `speciesSource: "gemini"`

#### Scenario: Pl@ntNet API 不可用
- **WHEN** Pl@ntNet API 呼叫失敗或達每日上限
- **THEN** 自動切換至 Gemini，記錄 `speciesSource: "gemini"`

### Requirement: 台灣常見造林樹種支援
系統 SHALL 能識別以下台灣主要造林樹種並對應台灣林業局材積公式：樟樹、柳杉、台灣杉、相思樹、楓香、光臘樹、木麻黃。

#### Scenario: 辨識到支援樹種
- **WHEN** 辨識結果為系統支援的樹種
- **THEN** 自動載入對應材積公式係數

#### Scenario: 辨識到不支援樹種
- **WHEN** 辨識結果不在支援清單中
- **THEN** 使用通用材積公式，並標記 `formulaSource: "generic"`
