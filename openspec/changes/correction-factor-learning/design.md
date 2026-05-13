## Context

`ground_truth` 表已存在（由 physical-reference change 建立），記錄每筆測量的實際 DBH、估算 DBH 與修正因子。支柱二的任務是在這個資料基礎上，建立統計彙總與自動套用的機制，讓系統隨時間變得更準確。

## Goals / Non-Goals

**Goals:**
- 從 ground_truth 資料彙總各樹種的平均修正因子
- 在無參照物的測量中自動套用修正因子
- 樣本數不足時不套用（避免過擬合）
- 提供前端頁面讓用戶看到學習進度

**Non-Goals:**
- 不做複雜的機器學習模型（簡單加權平均即可）
- 不套用在 referenceUsed=true 的測量（已是高精度）
- 不做跨樹種的修正因子推算

## Decisions

### D1：修正因子分組鍵

**選擇**：以 `species` 為主要分組鍵，不細分設備或光線條件。

**理由**：目前 ground_truth 資料量少，細分條件會讓每組樣本數更少，修正因子反而不可靠。待資料累積到 100+ 筆後再考慮加入條件分組。

### D2：最小樣本數門檻 = 5

**選擇**：同一樹種有 ≥5 筆 ground_truth 才套用修正因子。

**理由**：5 筆是統計上的最低可信門檻，避免因單一異常值導致全面偏差。

### D3：加權平均（近期資料權重較高）

**選擇**：修正因子 = 加權平均，最近 30 天的資料權重 × 2。

**理由**：系統在改善（Gemini 模型更新、用戶拍攝技巧進步），近期資料更能反映當前精度。

### D4：套用時機在 calculate() 之後

**選擇**：`correctionFactorService.js` 查詢修正因子，在 index.js 計算完 dbhCm 後乘以修正因子。

**理由**：不改 calculationService.js 的純計算邏輯，修正是獨立的後處理步驟。

## Risks / Trade-offs

- **循環偏差**：若 ground_truth 資料本身有誤（捲尺量錯），修正因子會往錯誤方向走 → 保留原始估算值在結果中供比較
- **樣本不足期**：初期大多數樹種沒有修正因子，系統行為與現在相同
- **物種誤判影響**：若樹種辨識錯誤，修正因子會套用到錯誤的樣本池 → 物種辨識改善後自動修正

## Migration Plan

1. 新增 correctionFactorService.js
2. 修改 index.js 在計算後查詢並套用
3. 新增 /api/correction-factors 端點
4. 前端加入修正因子摘要頁面
5. 測試：手動插入幾筆 ground_truth，驗證修正因子正確計算並套用

## Open Questions

- 修正因子要不要上 Besu 鏈？→ 暫不，先在 SQLite 累積足夠資料再決定
