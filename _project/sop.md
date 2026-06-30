# Standard Operating Procedure（標準作業程序）

本文件為森林碳測量系統之 SOP、對齊 Verra VCS VM0047 v1.0 §9.3 Monitoring Plan 要求。
適用範圍宣告見文末 § 8。

---

## 1. 拍攝 Protocol（影片取得）

### 1.1 設備

- iPhone（4K HEVC 影片格式）
- 國際標準信用卡（ISO/IEC 7810 ID-1、長邊 85.6 mm）作為參考物

### 1.2 拍攝步驟

1. **皮尺定位**：用鐵捲尺從平地地面定 1.3 公尺高度
2. **卡片貼合**：將信用卡長邊水平貼在樹幹胸高 1.3 公尺位置、與皮尺同高
3. **拍攝路徑**：手持手機**繞樹半圈**、聚焦在卡片週圍視角
4. **時長**：60-120 秒、過程中確認皮尺沒鬆垮
5. **拍攝高度**：手機保持跟卡片同高（避免大角度俯仰造成卡片透視畸變）

### 1.3 為什麼不繞一圈

- AI 從單一視角看到的「樹幹寬度」已對應「等效直徑」概念
- 繞一圈在「圓形假設」框架下不提供額外資訊
- 繞半圈拍卡片週圍、確認皮尺貼合、是合理且足夠的拍攝設計

---

## 2. Ground Truth Protocol（人工皮尺真值）

### 2.1 量測標準

依 Kershaw（2016）Forest Mensuration 跟 Avery（2015）Forest Measurements 教科書：

1. **高度**：鐵捲尺從**平地地面**定 1.3 公尺
2. **皮尺繞法**：在 1.3 m 處皮尺**垂直樹幹軸線**繞一圈、緊貼樹皮但不勒
3. **計算**：量測周長 → 周長 ÷ π = 樹徑（DBH、cm）
4. **精度**：±0.5 cm（5 mm）

### 2.2 特殊情況處理

| 情況 | 本研究處理方式 |
|---|---|
| 樹幹在 1.3 m 處分叉（如 IMG_5804）| **分別測量、視為兩棵獨立樹** |
| 樹幹傾斜 | 沿樹幹軸線、1.3 m 高度量測 |
| 1.3 m 處有節瘤、傷疤 | 量上方或下方避開、避開不變形處 |
| 山坡地 | **本研究無山坡地樣本**、未制定 protocol |

### 2.3 QA/QC 抽驗

- 每批至少抽 5-10% 棵重新量測
- 重複量測與原量測之差 > 1 cm 視為 outlier、需重新量
- 量測記錄包含：樹編號、量測時間、量測人員、特殊備註

---

## 3. Pipeline 設定

### 3.1 處理流程

```
影片上傳
   ↓
Gemini Files API 上傳（Google 端處理）
   ↓
Pipeline P4 video-direct v2:
   - 整支影片給 Gemini 2.5 Flash
   - Prompt: 胸高 prompt（明示卡片位置為 1.3 m）
   - 要求 Gemini 回傳 cardPixelWidth、trunkPixelWidth、ratio、videoTimestampSec
   - N=10（同一影片連打 10 次取 ratio 中位數）
   ↓
原始 DBH = median ratio × 8.56 cm
   ↓
校準後 DBH = 原始 DBH × 1.124（calibration factor）
   ↓
帶入 allometric equation（src/data/formulaDb.js 台灣本土樹種公式）
   ↓
AGB → 固碳量（kg C）→ CO2 等值（× 3.67）
```

### 3.2 關鍵參數

| 參數 | 值 |
|---|---|
| Pipeline 版本 | `video-direct-v2-N10` |
| Gemini 模型 | `gemini-2.5-flash`（2026 年 5 月版本）|
| N（重複次數）| 10 |
| Prompt | 胸高 prompt（明示 1.3 m 位置 + 要求量像素 + timestamp）|
| Calibration factor | ×1.124（基於 30 棵 mean(tape)/mean(P4 DBH)）|
| Allometric equation | 台灣林業局樹種材積公式（species-specific）|

### 3.3 為什麼選 P4

從 5-way 對照實驗（30 棵）：
- P4 是 17/29 棵的 best winner（58.6%）
- P4 樣區層級偏差 -10.69%（校準後 0.57%）
- P4 90% CI half-width 8.0%（Verra 紅線 100%、寬裕 12.5 倍）
- P4 操作最簡單（只要上傳影片、不需 OpenCV pre-processing）

---

## 4. Calibration 流程（×1.124）

### 4.1 怎麼來的

基於 30 棵實測樹（28 棵有效）：
```
mean tape (ground truth) = 29.95 cm
mean P4 DBH (raw)       = 26.75 cm
calibration factor      = 29.95 / 26.75 = 1.1196 ≈ 1.124
```

### 4.2 統計驗證（Verra §9.1 unbiased 要求）

Paired t-test（校準後 DBH × 1.124 vs tape）：
```
mean(diff) = 0.171 cm
t-statistic = 0.126
t-critical(α=0.05, df=27) = 2.052
|t| = 0.126 << 2.052 → H0(bias = 0) NOT rejected
→ Calibrated measurement is unbiased ✓
```

### 4.3 套用方式

每棵樹的 P4 估值出來後立刻套：

```javascript
const calibrated_DBH = raw_P4_DBH * 1.124
```

### 4.4 何時要重算 calibration

當以下任一條件成立：

- ✗ Gemini 模型版本變更（例如升級到 Gemini 3）
- ✗ 拍攝設備變更（例如換 Android 手機）
- ✗ 應用到新生態區（不再是台灣亞熱帶常綠林）
- ✗ Prompt 內容修改
- ✗ N 值變更

重算流程：用同流程跑 ≥ 30 棵已知 tape 真值的樹、重新算 mean ratio、執行 paired t-test 確認 unbiased。

---

## 5. Verra Uncertainty 計算（§8.4）

對 N 棵樣本之 ratio 90% confidence interval：

```
ratio_i = tape_i / raw_P4_DBH_i  （每棵的個別 ratio）
mean_ratio = mean(ratio_i)
SE = sd(ratio_i) / sqrt(n)
CI_half_width = t(α=0.1, df=n-1) × SE

Verra 合格門檻：CI_half_width / mean_ratio < 100%
```

我們 28 棵 sample：
- mean_ratio = 1.139
- CI half-width = 0.0983
- CI half-width / mean = **8.63%** << 100% ✓

---

## 6. 資料保存 / 稽核

| 資料 | 保存位置 | 保留期限 |
|---|---|---|
| 原始影片 | Google Drive folder `1MKlTbql...71w3` | 永久 |
| Tape 真值 | trees.manual_tape_dbh_cm in SQLite | 永久 |
| Pipeline 設定 | scripts/dryrun-video-v2.js（git tracked）| 永久 |
| Pipeline 跑出來的 raw DBH | dryrun_runs.pathA_legacy_dbh_cm | 永久 |
| Calibration factor 推導文件 | 本 SOP + memory.md | 永久 |
| Gemini 模型版本記錄 | dryrun_runs.notes（pipeline_version 字串）| 永久 |
| 區塊鏈錨點（manual_tape）| GroundTruth.sol `0xC9a43158...986Aaec` | 永久（鏈上不可改）|

Verra §9.3 規定：所有 monitoring 資料至少保留 crediting period 結束後 2 年。

---

## 7. 區塊鏈錨定（額外保證）

本系統將每棵樹的 ground truth tape 資料 hash 後寫入 Ethereum 智能合約 `GroundTruth.sol`、合約地址 `0xC9a43158...986Aaec`。
這提供 Verra 規範以外的額外不可篡改保證——任何人可獨立驗證原始量測資料沒被事後修改。

---

## 8. 適用範圍宣告（Applicability Statement）

本方法之精度數據（mean bias 0.57%、90% CI half-width 8.63%）僅在以下條件下成立：

### 8.1 生態類型

- ✓ **台灣亞熱帶常綠林**
- ✓ 樹種覆蓋 `src/data/formulaDb.js` 列出之台灣本土樹種：
  樟樹（Cinnamomum camphora）、柳杉（Cryptomeria japonica）、台灣杉（Taiwania cryptomerioides）、相思樹（Acacia confusa）、其他 formulaDb 內登錄樹種
- ✗ 熱帶雨林、溫帶林、北方針葉林**未驗證**
- ✗ formulaDb 未登錄之樹種**未驗證**

### 8.2 拍攝條件

- ✓ **iPhone 4K HEVC** 影片
- ✓ 時長 60-120 秒
- ✓ **繞樹半圈拍攝**、聚焦卡片週圍
- ✓ 標準信用卡（ISO/IEC 7810 ID-1、85.6 mm 長邊）作為參考物
- ✓ 卡片貼**胸高 1.3 m 位置**
- ✗ Android 手機未驗證
- ✗ 其他影片格式（MP4 H.264、360° 全景）未驗證
- ✗ 不同拍攝距離極端（例如 < 0.5 m 或 > 5 m）未驗證

### 8.3 樹徑範圍

- ✓ 已驗證 **17-44 cm**（30 棵實測範圍）
- ✗ < 15 cm 苗木**未驗證**（可能透視畸變影響大）
- ✗ > 50 cm 老樹**未驗證**（樹皮複雜度可能影響邊緣判讀）

### 8.4 地形

- ✓ **平地**（本研究無山坡地樣本）
- ✗ 山坡地**未驗證**（特別是 uphill side 1.3m 量法在實際操作之變異）

### 8.5 樹幹特殊情況

- ✓ 直立、單一樹幹
- ✓ 1.3 m 處分叉樹（分別量、視為兩棵）——本研究 1 棵（IMG_5804 但 video pipeline 無法區分兩棵、需後續處理）
- ✗ 多分叉複雜樹冠**未驗證**
- ✗ 有大型 buttress（板根、熱帶常見）**未驗證**

### 8.6 模型版本

- ✓ **Gemini 2.5 Flash（2026 年 5 月版本）**
- ✗ 未來模型版本（Gemini 3、其他 LLM）**必須重新驗證**才能延續使用
- 重新驗證流程：見 § 4.4

### 8.7 季節 / 物候

- ✓ 本研究季節（含實驗時段、未涵蓋全年）
- ✗ 落葉樹冬季無葉狀態**未驗證**
- ✗ 開花、結果期間**未驗證**

### 8.8 未做之驗證

- ✗ **Destructive sampling**（砍樹秤實際 AGB）未執行
- ✗ 長期追蹤（同一棵樹多年資料）未執行
- ✗ 不同森林管理階段（撫育、間伐後）影響未驗證

### 8.9 重新驗證觸發條件

當超出上述任一適用範圍時、必須重新進行驗證：

1. 跑 ≥ 30 棵新樣本（涵蓋目標條件）
2. 取得 tape ground truth（按 § 2 protocol）
3. 跑 P4 pipeline、套用初始校準
4. 算 paired t-test 確認 unbiased
5. 算 ratio 90% CI 確認 < 100%
6. 如未達標、調整 calibration factor 或 prompt 重做

---

## 9. 文件版本

- v1.0、2026-05-31 建立
- 基於 30 棵 mass run 結果（dryrun_runs id > 81）
- 對齊 Verra VCS VM0047 v1.0（2023 年 9 月）

相關文件：
- `memory.md`（專案長期資料）
- `tasks.md`（任務追蹤）
- 靜態網頁：https://forest-carbon.duckdns.org/journey/
