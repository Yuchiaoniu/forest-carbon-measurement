## ADDED Requirements

### Requirement: 修正因子摘要頁面
系統 SHALL 提供 /correction-factors.html 頁面，展示各樹種的學習進度。

#### Scenario: 顯示修正因子表格
- **WHEN** 用戶開啟 /correction-factors.html
- **THEN** 顯示各樹種的樣本數、修正因子、是否已達門檻（≥5 筆）

#### Scenario: 樣本不足時提示
- **WHEN** 某樹種樣本數 < 5
- **THEN** 顯示「需要更多資料（目前 N 筆，需要 5 筆）」

### Requirement: 修正因子歷史趨勢
系統 SHALL 顯示修正因子隨時間的變化（最近 10 次更新）。

#### Scenario: 趨勢顯示
- **WHEN** 某樹種有 ≥5 筆且有時間序列資料
- **THEN** 顯示修正因子數值的變化趨勢（文字形式即可）
