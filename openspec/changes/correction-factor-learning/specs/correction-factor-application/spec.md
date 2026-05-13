## ADDED Requirements

### Requirement: 自動套用修正因子
系統 SHALL 在無參照物的測量（referenceUsed=false）完成後，查詢對應樹種的修正因子，若 applicable=true 則套用。

#### Scenario: 有修正因子且樣本足夠
- **WHEN** referenceUsed=false 且該樹種有 ≥5 筆 ground_truth
- **THEN** adjustedDbhCm = dbhCm × correctionFactor，結果包含 `correctionApplied=true`、`originalDbhCm`、`correctionFactor`

#### Scenario: 樣本不足不套用
- **WHEN** referenceUsed=false 且該樹種 ground_truth < 5 筆
- **THEN** 維持原始 dbhCm，`correctionApplied=false`

#### Scenario: 有參照物不套用
- **WHEN** referenceUsed=true
- **THEN** 不查詢修正因子，直接用參照物計算結果

### Requirement: 保留原始估算值
系統 SHALL 在套用修正因子後，結果中同時保留 originalDbhCm（修正前）供比較。

#### Scenario: 修正後結果格式
- **WHEN** correctionApplied=true
- **THEN** 結果包含 `{ dbhCm: 修正後, originalDbhCm: 修正前, correctionFactor, correctionApplied: true }`
