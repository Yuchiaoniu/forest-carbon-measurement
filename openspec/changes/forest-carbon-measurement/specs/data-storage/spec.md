## ADDED Requirements

### Requirement: SQLite 資料模型
系統 SHALL 建立包含 projects、plots、trees 三張資料表的 SQLite 資料庫。

#### Scenario: 首次啟動建立資料表
- **WHEN** 系統啟動時 data.db 不存在
- **THEN** 自動建立所有資料表與索引

#### Scenario: 儲存測量紀錄
- **WHEN** DBH 計算完成
- **THEN** 將 species、dbh、volume、carbonStock、gps、videoHash、confidence、txHash 寫入 trees 資料表

### Requirement: 影片雜湊去重
系統 SHALL 對上傳影片計算 SHA-256，若相同雜湊已存在則回傳既有結果，不重複分析。

#### Scenario: 重複上傳同一影片
- **WHEN** 用戶上傳與既有紀錄相同的影片
- **THEN** 回傳既有測量結果，不呼叫任何 AI API

#### Scenario: 不同影片
- **WHEN** 影片雜湊不在資料庫中
- **THEN** 正常進行完整分析流程
