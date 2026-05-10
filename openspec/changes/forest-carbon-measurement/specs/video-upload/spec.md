## ADDED Requirements

### Requirement: 接受手機影片上傳
系統 SHALL 提供 HTTP POST `/api/upload` 端點，接受 .mov 與 .mp4 格式影片，最大檔案大小 500MB。

#### Scenario: 成功上傳
- **WHEN** 用戶透過表單上傳有效影片檔案
- **THEN** 系統回傳 200 與 `{ jobId, status: "processing" }`

#### Scenario: 格式不支援
- **WHEN** 用戶上傳非 .mov/.mp4 檔案
- **THEN** 系統回傳 400 與錯誤訊息 `"僅支援 .mov 及 .mp4 格式"`

#### Scenario: 檔案過大
- **WHEN** 上傳檔案超過 500MB
- **THEN** 系統回傳 413 並拒絕接收

### Requirement: 非同步處理回報
系統 SHALL 提供 GET `/api/status/:jobId` 讓前端輪詢處理進度。

#### Scenario: 處理中
- **WHEN** 前端查詢仍在處理的 jobId
- **THEN** 系統回傳 `{ status: "processing", step: "<current_step>" }`

#### Scenario: 處理完成
- **WHEN** 前端查詢已完成的 jobId
- **THEN** 系統回傳完整測量結果包含 DBH、材積、碳儲量、txHash
