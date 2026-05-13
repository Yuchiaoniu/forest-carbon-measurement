# Physical Reference — Design

## 核心架構

本 change 在原有薄透鏡公式（Route B）上新增三條更精確的量測路徑，並整合葉片幀標記以提升樹種辨識品質。

```
路徑 0  Gemini OCR 讀取捲尺/直尺數字    confidence: high（最高精度）
路徑 A  trunkToReferenceRatio 比例換算   confidence: high
路徑 B  薄透鏡公式（備援）               confidence: low / medium
```

優先順序：路徑 0 > 路徑 A > 路徑 B

---

## 路徑 0：直接量測讀數

**觸發條件：** Gemini 在任一幀偵測到 directMeasurementCm > 0

**計算：**
- measurementType = 'circumference'：DBH = directMeasurementCm / π
- measurementType = 'diameter'：DBH = directMeasurementCm

**取值：** 對所有幀（含特寫幀）取 directMeasurementCm 的中位數，不受有效幀篩選限制。

---

## 路徑 A：trunkToReferenceRatio 比例換算

**觸發條件：** referenceAtTrunk=true 且 trunkToReferenceRatio > 0 且 referenceConfidence ≥ 0.4

**計算：**
```
DBH(cm) = trunkToReferenceRatio × refWidthMm / 10
```

其中 trunkToReferenceRatio = 胸高樹幹像素寬 / 參照物代表長度像素寬。

**關鍵約束 referenceAtTrunk：**
- 參照物必須接觸樹幹（貼著樹皮、或放在樹幹根部正下方）
- 若參照物在背景、相機附近或與樹幹有明顯水平距離 → referenceAtTrunk=false → 不觸發 Route A
- 偵測到但不在樹幹旁時：referenceOffTrunkDetected=true，confidence 降為 medium

**已知參照物尺寸（refWidthMm）：**
| 類型 | 寬度 mm |
|------|--------|
| creditcard | 85.6 |
| businesscard | 90 |
| a4 | 210 |
| a5 | 148 |
| b5notebook | 182 |
| ruler30 | 300 |
| ruler100 | 1000 |
| banknote100 | 130 |
| banknote500 | 154 |
| banknote1000 | 160 |
| unknown | referenceEstimatedWidthMm（Gemini 估算） |

**多幀聚合：** 對同一 referenceType 的有效幀取 trunkToReferenceRatio 中位數。

---

## 路徑 B 平行估算（routeBDbhCm）

路徑 0 或 A 成功時，系統同步執行薄透鏡公式估算 routeBDbhCm，與 actual_dbh_cm（路徑 0/A/手動）一起存入 ground_truth 表。此資料為支柱二修正因子學習的訓練資料。

```
correction_factor = actual_dbh_cm / routeBDbhCm
```

---

## 葉片幀標記

Gemini 分析時對每幀輸出 leafVisible（葉片細節清楚且適合樹種辨識）。

`getMedianResult()` 彙整 leafFrameIndices 後，主流程（index.js）優先將這些幀送給 PlantNet / iNaturalist。若無葉片幀則退回全幀。

**執行順序：** Gemini 分析必須先完成，才能取得 leafFrameIndices，再呼叫樹種辨識 API。

---

## Confidence 邏輯

```
directMeasurementUsed = true          → high
referenceUsed = true
  referenceConfidence < 0.7           → medium
  otherwise                           → high
referenceOffTrunkDetected = true      → medium
Route B: frameQuality=good
         distanceStdPct < 20
         validFrames ≥ 2
         !sensorIsDefault             → high
Route B: frameQuality=low 或 distanceStdPct ≥ 20 或 validFrames < 2 → low
otherwise                             → medium
```

---

## 資料表 ground_truth

```sql
CREATE TABLE ground_truth (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tree_id           INTEGER NOT NULL,
  actual_dbh_cm     REAL NOT NULL,      -- 地面真值（路徑0/A或手動輸入）
  estimated_dbh_cm  REAL,               -- routeBDbhCm（薄透鏡公式平行估算）
  correction_factor REAL,               -- actual / estimated
  source            TEXT NOT NULL,      -- 'direct_measurement' | 'reference' | 'manual'
  created_at        TEXT DEFAULT (datetime('now'))
);
```

---

## 不在本 change 範圍內

- 修正因子學習與套用邏輯 → correction-factor-learning change
- 支柱一數據蒐集平台 → metadata-research-platform change（待建立）
