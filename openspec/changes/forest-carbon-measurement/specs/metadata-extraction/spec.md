## ADDED Requirements

### Requirement: 擷取相機物理常數
系統 SHALL 使用 ExifTool 從影片擷取焦距、GPS 座標、設備型號、拍攝時間，並從內建設備資料庫查詢感光元件寬度（mm）。

#### Scenario: iPhone 影片成功擷取
- **WHEN** 上傳 iPhone 拍攝的 .mov 影片
- **THEN** 系統擷取到 FocalLength（mm）、GPSCoordinates、Model、CreateDate、SceneIlluminance

#### Scenario: 未知設備型號
- **WHEN** 影片設備型號不在內建資料庫中
- **THEN** 系統使用預設感光元件寬度 6.4mm 並標記 `sensorSource: "default"`

#### Scenario: 缺少 GPS 資訊
- **WHEN** 影片不含 GPS 元數據
- **THEN** 系統繼續處理，GPS 欄位記錄為 null，不中斷流程

### Requirement: 感光元件尺寸資料庫
系統 SHALL 內建至少涵蓋 iPhone 12/13/14/15/16 系列主鏡頭、Samsung Galaxy S21/S22/S23/S24 的感光元件寬度對照表。

#### Scenario: 查詢已知設備
- **WHEN** 設備型號為 "iPhone 13 Pro Max"
- **THEN** 系統回傳感光元件寬度 7.6mm、像素間距 1.9μm
