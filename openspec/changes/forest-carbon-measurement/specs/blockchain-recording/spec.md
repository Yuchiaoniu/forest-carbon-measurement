## ADDED Requirements

### Requirement: 智能合約部署腳本
系統 SHALL 提供 `scripts/deploy.js`，執行後將 CarbonCredit 合約部署至 .env 指定的 Besu 私鏈，並自動將 CONTRACT_ADDRESS 寫回 .env。

#### Scenario: 成功部署
- **WHEN** 執行 `node scripts/deploy.js` 且 Besu 節點可達
- **THEN** 合約部署成功，CONTRACT_ADDRESS 寫入 .env，顯示確認訊息

#### Scenario: 節點不可達
- **WHEN** BESU_RPC_URL 指向的節點無回應
- **THEN** 顯示明確錯誤訊息，提示檢查 .env 設定

### Requirement: 測量完成自動上鏈
系統 SHALL 在每次 DBH 計算完成後，自動呼叫合約 `recordMeasurement` 寫入測量數據。

#### Scenario: 上鏈成功
- **WHEN** DBH 計算完成且 Besu 節點可達
- **THEN** transaction hash 寫入 SQLite trees 資料表，回傳給前端

#### Scenario: 上鏈失敗（節點暫時不可達）
- **WHEN** 呼叫合約時 Besu 節點無回應
- **THEN** 測量結果仍存入 SQLite，txHash 標記為 "pending"，系統每 5 分鐘重試一次

### Requirement: 合約記錄欄位
CarbonCredit 合約 SHALL 記錄每筆測量的 GPS、樹種、DBH（mm）、材積（cm³ × 100）、碳儲量（g）、影片 SHA-256、時間戳，並發出 `MeasurementRecorded` 事件。

#### Scenario: 查詢鏈上紀錄
- **WHEN** 以 txHash 查詢 Besu 節點
- **THEN** 可取得完整測量數據，與 SQLite 紀錄一致
