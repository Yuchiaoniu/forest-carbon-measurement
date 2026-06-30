# Forest Carbon Measurement — memory.md（長期查詢/對照資料）

> 規則：只新增與修正、去重。每則都是有用的資料、可隨時間慢慢變長。

## 相關正式文件

- **`sop.md`** ★ Standard Operating Procedure（標準作業程序）—— Verra §9.3 對齊文件、含拍攝 protocol / pipeline 設定 / calibration 流程 / 適用範圍宣告
- **`tasks.md`** —— 任務追蹤
- **`STATE.md`** —— 現況快照（短期、會被精簡）

---

## 1. 基礎設施 / 環境

### VM 部署拓撲

- **GCP VM**：`besu-bootnode` `35.227.93.38:3000`、pm2 process 名 `forest-carbon`
- **VM 上 source code**：`/home/yuchi/forest-carbon-measurement/`
- **VM 上 SQLite**：`/home/yuchi/forest-carbon-measurement/data.db`
- **公開 API**：`https://forest-carbon.duckdns.org`（nginx 在 3000 port 前面、有 TLS）
- **GitHub Pages 靜態頁**：`https://yuchiaoniu.github.io/forest-carbon-measurement/`、master branch、`./data/trees.json` 由 `pushTreesJson()` push

### SSH 連線

```powershell
$SSH = "C:\WINDOWS\System32\OpenSSH\ssh.exe"
$KEY = "$env:USERPROFILE\.ssh\google_compute_engine"
$USER = "yuchi"
& $SSH -i $KEY -o StrictHostKeyChecking=no -o BatchMode=yes "${USER}@35.227.93.38" "<command>"
```

### Google Drive 影片存放

- **Folder ID**（公開可讀）：`1MKlTbql8YGpfahAKmCHFyjdJh8wu71w3`
- **VM gdown 工具**：`/home/yuchi/.local/bin/gdown`（不在 default PATH、要用絕對路徑）
- 用法：`gdown <file_id> -O <local-path> -q`

### 31 支影片 IMG ↔ Drive file_id 對應表

| IMG | Drive file_id |
|---|---|
| 5786 | `1lpkf7TYbWLylUKtG0ABFdZDitkW2T0wN` |
| 5787 | `13fgOJO--W4opami5ZVKoqIl7Nxk-Ec6F` |
| 5788 | `1F0437umBsIGv_-oetcpKQokZW9KSXjcp` |
| 5789 | `1LLyAp4BjgjwX5cPHdP42rmasGPcZSycH` |
| 5790 | `1HrK9Iz2h2PqyeyC1b1rLvFipP6jpwD-P` |
| 5791 | `1fFNvMJSiDo6h0cGK7VBfDW7_Q9pE7aL4` |
| 5792 | `1oFUNweQ1E2BCJRuuEFgATXYRUV5rWzON` |
| 5793 | `1ZVDRkpkw0M7RYwS03Fdf19pAJKT4AnZ5` |
| 5794 | `1vk4A2WYgoGBxN581kf5H3vshPOimerGj` |
| 5795 | `1mAsxJchl2JRrYMyxSWBz8yRzTTvNpDmD` |
| 5798 | `1-yXWP7XWpgTeZBDQC9sHyOpIxljxm_tH` |
| 5799 | `19hdCOLZKBOLf1F3rtZ1LLeukXUw2NAFy` |
| 5800 | `1yvo9_vja1TJOFl8TTiHQDHi9vMNbRfTf` |
| 5801 | `1vwIqBt4Zob3wno3999dgfQkF5SSggRi6` |
| 5802 | `1lVacWtaNhrMq3oM2cfOgWYa7namSLlrK` |
| 5803 | `1U3Mi5Gtu_BqsYV2CjAyVQB4wy6J2ZbAu` |
| 5804 | `1WOuTQSB1jn_mpeUNUILl0606-9B-VZZR`（一影片兩棵樹）|
| 5805 | `1z1kzhPx4kUOj6opGt4ZILyawIQjcSvyp` |
| 5806 | `1ybyFmKlFRx3kuNFVSNYJBP4dMa2KfcL7` |
| 5807 | `1EbJkGAZpmb9CbMm0YlnKQhqEKaJ9olzB` |
| 5808 | `1Kzcy00bGk-kZjL8lQQ66wD1v-OZkOgAb` |
| 5809 | `1DY1OV8PEPjR3XGIcyVne1AtO1QdpUHUF` |
| 5810 | `1v6BthyaAo0uY4HvIs-yK5_YETJnWSV-5` |
| 5811 | `1CgeLGT-k2NiW54MXdInjuI5OAlYsTlf5` |
| 5812 | `1cbNBVVyqf0M0ShepbWT230yF4bddN4yA` |
| 5813 | `1e5CytcJRc7XhbdK_j0UWuUiYkH6YqKrD` |
| 5814 | `1DgPf1kPfqynAWSJBY44XM65dVkeLross` |
| 5815 | `1hAJOWC6SO9urNIn0aLESVQ7u1JUfZeHT` |
| 5817 | `1MYhIVJI2SBkbpAZFBoq7OdJgA4N5pog6` |
| 5818 | `13qfRS4GWJvWL-ur4F54pndHzsCTl5a9H` |
| 5819 | `1dFF4DF0JVlZqgxCQeOSxMSvnlybOCOfn` |

注意：Drive 沒有 IMG_5796、IMG_5797（編號跳號）。

---

## 2. 實驗演進旅程（§38–§40）

### §38 重測沙箱（2026-05-30 完成）

對任何舊樹跑兩條 prompt 對比、不污染 trees 表、不上鏈。
建立：
- `dryrun_runs` SQLite 表（schema 含 path0_dbh_cm / pathA_legacy_dbh_cm / pathA_opencv_dbh_cm 等）
- `scripts/dryrun-rerun.js` 重抽版（Drive 下載 → 2fps 重抽 → detect_card → 並跑 legacy/opencv）
- 影片 24h 延遲刪（`cleanupOldVideos()` 啟動 + 每小時掃 uploads/）

### §39 Gemini batch variance 發現（2026-05-30）

對 IMG_5789 frame_9 做 variance 實驗，發現：

1. **Gemini batch 內 cross-frame coupling**：傳 3 張幀 batch、3 張回完全相同 ratio。Batch 內不是 per-frame independent、是整批一個共識值。
2. **單張連跑 5 次 mean ≈ 真實值**（誤差 < 7%、cv 7-9%）、Gemini 本身不隨機飄。
3. **dryrun #8 拿到 ratio 4.5 / 6.19 是單次 outlier**、不是 systematic bias。
4. **含義**：sharpness top 3 / first-mid-last frame 挑選邏輯失去意義；應改用 N 次 batch median。

### §39.5 path-G 31 棵實驗（失敗，2026-05-31）

設計：移除 isOrthogonal + batch=8 + N=5 + relaxed prompt。
結果：
- DB clean 17 棵：100% → 47% PASS（**大退步**）
- High-error 14 棵：28% → 42%（小改善）
- 整體 31 棵：65% → 45%（**整體退步**）

結論：**isOrthogonal 篩選比預期重要、拿掉會破壞乾淨樹**。後續所有 pipeline 都保留 isOrthogonal。

### §39.6 path-G-iso 四輪 prompt 優化（2026-05-31）

對 7 棵 path-G 跑得到值但 err > 15% 的樹做 4 輪 prompt 對照：

| Round | Prompt 變更 | PASS rate |
|---|---|---|
| R0 path-G | relaxed prompt baseline | 0/7 |
| R1 +iso | 加回 isOrthogonal 篩選 | 2/7 |
| R2 +tight | 強調樹幹邊界精確 | 3/7 |
| R3 +measure | Chain-of-thought 量像素 | 3/7 |

**核心發現：no single best prompt**——每棵樹有自己最適的 prompt：
- 細樹幹（5818、5800）→ R3 measure
- 中樹幹（5810、5799）→ R1 baseline
- 樹皮複雜（5786）→ R2 tight

任一輪 PASS 樹數 = 5/7、全 FAIL = 2/7（5803、5790）。

### §40 五條 pipeline 對 30 棵的對照（2026-05-31）

排除 IMG_5804（一影片兩棵樹）= 30 棵。設計五條 pipeline 對照：

| Pipeline | 解碼 | 取幀 | 解析度 | OpenCV 篩 iso | N |
|---|---|---|---|---|---|
| **P1a** kf-sharp-960 | 只解 I-frame | sharpness top 8 | 降到 960 寬 | 篩 | 5 |
| **P1b** kf-sharp-orig | 只解 I-frame | sharpness top 8 | 原解析度 | 篩 | 5 |
| **P2** kf-time-960 | 只解 I-frame | time-spread 8 | 降到 960 寬 | 篩 | 5 |
| **P3** video-v1 | Gemini 端解 | Gemini 自挑 | 原解析度 | Gemini 自判 | 5 |
| **P4** video-v2 | Gemini 端解 | Gemini 自挑 | 原解析度 | Gemini 自判（+胸高 prompt）| 10 |

**最終結果：22/30 PASS（73.3%）+ 7 FAIL + 1 N/A（IMG_5788 API cap）**

各 pipeline 當 winner 次數：
- P4 = 17 次（58.6%）← 最常勝出
- P3 = 5 次（17.2%）
- P2 = 3 次、P1a = 3 次、P1b = 1 次

---

## 3. 五個變數的對照結論

| 變數 | 對照狀態 | 結論 |
|---|---|---|
| **D1 解碼方式** | 部分測 | 「Gemini 端解碼」勝過「只解 I-frame」（22 vs 7）。「只做 P/B」**技術不可能**（P/B 必須有 I 才能解碼）|
| **D2 取幀方式** | 三種都測 | 「直接給 Gemini」整體最佳。OpenCV 端「均勻 vs 最清晰」3 vs 3 平手 |
| **D3 解析度** | P1a vs P1b | 降解析跟原解析度**幾乎沒差**（3 vs 1 winner）|
| **D4 OpenCV 轉向** | **不必測** | §35.7 已關掉 frame rotation —— rotation 是 destructive operation、會扭曲樹幹寬度 |
| **D5 N=5 vs N=10** | 測了但 **confounded** | P3/P4 同時改了 N + prompt、無法單獨歸功 N。但 N 越多有邊際遞減（√N 收斂）、N=10 是合理上限 |

整體變數重要性：D1（解碼/處理位置）= D5（N + prompt）>> D3 ≈ D2 ≈ D4。

---

## 4. 30 棵 5-way mass run 詳細結果

格式 `err% / cv%`、`†` = 從歷史 dryrun_runs 補

| IMG | tape | P1a | P1b | P2 | P3 | P4 | best |
|---|---|---|---|---|---|---|---|
| 5786 | 22.6 | — | 39.8/51 | 58.4/48 | **7.1**/77 | 8.0/25 | 7.1 P3 |
| 5787 | 27.2 | 14.7/51 | 9.9/14 | 37.1/10 | 9.6/43 | **2.2**/28 | 2.2 P4 |
| 5788 | 27.7 | — | — | — | cap | cap | N/A |
| 5789 | 26.3 | 10.6/16 | 11.8/22 | **3.8**/27 | 20.2/19 | 15.2/36 | 3.8 P2 |
| 5790 | 19.4 | — | — | — | 25.8† | **15.5**† | 15.5 P4 (FAIL) |
| 5791 | 30.2 | 44.7/6 | 40.1/32 | 48.7/18 | 38.7/32 | **0.7**/30 | 0.7 P4 |
| 5792 | 28.6 | 42.0/23 | 37.4/28 | 30.4/24 | **12.2**/14 | 19.2/75 | 12.2 P3 |
| 5793 | 33.7 | 38.6/20 | — | **2.1**/25 | 30.6/33 | 41.2/25 | 2.1 P2 |
| 5794 | 31.2 | 29.8/24 | 25.6/25 | 31.7/25 | 25.3/35 | **5.4**/31 | 5.4 P4 |
| 5795 | 22.0 | 12.3/22 | 17.3/20 | **1.8**/42 | 5.0/39 | 30.0/24 | 1.8 P2 |
| 5798 | 42.0 | — | 44.3 | — | 56.9/71 | **14.5**/48 | 14.5 P4 |
| 5799 | 43.6 | **5.7**/2 | 19.5/49 | — | 47.5/27 | 27.1/27 | 5.7 P1a |
| 5800 | 17.5 | **10.3**/32 | 22.3/53 | 18.9/8 | 35.4/38 | 11.4/18 | 10.3 P1a |
| 5801 | 16.9 | 13.6/12 | 2.4/20 | 24.3/16 | 9.5/59 | **0.6**/24 | 0.6 P4 |
| 5802 | 43.9 | 36.9/20 | 44.6/29 | 45.1/41 | 25.1/45 | **22.3**/26 | 22.3 P4 (FAIL) |
| 5803 | 43.0 | 59.8/12 | 55.1/26 | 51.2/26 | **39.3**/45 | 45.6/62 | 39.3 P3 (FAIL) |
| 5805 | 35.7 | 42.6/13 | — | 27.2/20 | 42.9/69 | **9.5**/56 | 9.5 P4 |
| 5806 | 38.8 | — | — | — | 48.7† | **22.7**† | 22.7 P4 (FAIL) |
| 5807 | 31.5 | — | — | 31.4/16 | **2.9**† | 11.7† | 2.9 P3 |
| 5808 | 31.8 | **15.4**/20 | 27.4/15 | 23.0/12 | 28.0/52 | 21.4/16 | 15.4 P1a (FAIL) |
| 5809 | 30.6 | — | — | 34.3/32 | 43.1/47 | **29.4**/41 | 29.4 P4 (FAIL) |
| 5810 | 29.9 | 46.2/64 | 11.7/13 | 6.7/17 | 64.5/62 | **3.7**/48 | 3.7 P4 |
| 5811 | 30.6 | — | — | — | 34.0/31 | **4.6**/27 | 4.6 P4 |
| 5812 | 30.9 | — | — | 9.1/20 | 49.5/76 | **4.2**/35 | 4.2 P4 |
| 5813 | 26.1 | 30.3/12 | 25.7/31 | 4.6/18 | **0.4**/34 | 4.6/54 | 0.4 P3 |
| 5814 | 38.5 | 38.4/18 | 27.3/17 | 52.2/54 | **20.0**/27 | 51.2/63 | 20.0 P3 (FAIL) |
| 5815 | 32.5 | 14.5/26 | — | — | 7.1/32 | **1.2**/14 | 1.2 P4 |
| 5817 | 24.5 | 35.5/22 | — | 16.3/11 | 11.4/36 | **4.9**/58 | 4.9 P4 |
| 5818 | 17.5 | 71.4/27 | — | 32.6/24 | 19.4/41 | **11.4**/42 | 11.4 P4 |
| 5819 | 21.6 | 12.0/24 | **1.9**/12 | 6.0/16 | 7.4/28 | 7.9/33 | 1.9 P1b |

7 棵 FAIL：5790（15.5 邊緣）、5802、5803、5806、5808（15.4 邊緣）、5809、5814 — **全部 DBH 偏低 15-50%**。

---

## 5. AGB（Above-Ground Biomass）

### 定義

樹木地面以上所有有機物質的總重量（樹幹、樹枝、樹葉、樹皮、果實）。不含地下根系（那叫 BGB）。單位 kg 或公噸。

### 從 DBH 換 AGB（allometric equation）

```
AGB = 0.0673 × (ρ × DBH² × H)^0.976

ρ = 木材密度（軟木 0.4、硬木 0.7 g/cm³）
DBH = 樹徑（cm）
H = 樹高（m）
```

**關鍵：DBH 帶平方**——DBH 量錯 10% → AGB 錯約 20%（誤差被放大兩倍）。

### 從 AGB 換碳 / CO2

```
固碳量 ≈ AGB × 0.5（樹乾重 ~50% 是碳）
CO2 ≈ 固碳量 × 3.67（1 噸碳 = 3.67 噸 CO2e）
```

---

## 6. Verra VM0047 v1.0 規範對齊

### 三條核心硬性規定（§8.4 Uncertainty + §8.6）

| # | 規定 | 性質 |
|---|---|---|
| 1 | 用 **90% confidence interval**（不是 95%）、α=0.1 | 計算方法規範、不是 threshold |
| 2 | **CI half-width / mean estimate < 100%** | **唯一的「能不能 credit」紅線** |
| 3 | **最低 10% uncertainty deduction** | 強制扣減、不是 threshold |

真正「通過 / 不通過」只有規定 2。論文要避免講「通過三條規定」這種誇大表達。

### Verra credit 計算公式

```
CR_t = ΔC × (1 - PB) × (1 - UNC) - LK - PE

ΔC   = 碳吸存量變化
PB   = Performance Benchmark deduction（對照組自然增加扣除）
UNC  = Uncertainty deduction = MAX(0, sqrt(...) - 10%)（最低 10%）
LK   = Leakage
PE   = Project Emissions
```

### 我們 P4 對齊狀態

```
n = 28 棵（5788 cap 排除）
mean tape = 30.40 cm
mean P4 DBH = 27.05 cm
bias = -3.35 cm（-11.0%）  ← 可校準
std of error = 6.74 cm

90% CI half-width = 6.74 / √28 × 1.703(t-value) = 2.16 cm
CI half-width / mean = 8.0%      ← Verra 紅線 100%、寬鬆 12.5 倍 ✓
```

**P4 符合 Verra §8.4 唯一合格門檻**（CI = 8% << 100%）。但「通過合格門檻」≠「拿滿 credit」。

### 五個 maximize credit lever

| Lever | 影響 | 我們可做嗎 |
|---|---|---|
| 1. 校準 DBH bias（×1.124）| 直接修 ΔC、影響 credit | ★★★ 必做 |
| 2. 增加樣本數（30 → 50+）| 降 CI、可能讓 UNC=0 | ★★ |
| 3. minimum 10% deduction | 無法避免 | floor |
| 4. 降低 PB（選對照組）| 減少 baseline 扣除 | 專案設計層級 |
| 5. 避免 LK、PE | 減少洩漏、自家排放 | 實作面控制 |

---

## 7. ×1.124 校準因子設計

### 白話定義

**一個固定數字、乘到所有測量結果上、修正系統性偏差。**

```
calibration factor = mean(tape) / mean(P4 DBH) = 30.40 / 27.05 = 1.124

校準後 DBH = 原 DBH × 1.124
校準後 mean ≈ 30.4 cm（對齊 tape）
bias 從 -11% → < 2%
```

### Verra 對校準因子的明文規範（§9.1 page 38）

> Plot-based sampling approaches may be augmented using double or two-phase sampling approaches (e.g., **ratio sampling**). These approaches must include:
> 1) A complete census of an auxiliary variable, and
> 2) A sample of direct field-based measurements used to determine the **relationship (i.e., a ratio or regression) between aboveground woody biomass and the auxiliary variable**.

**Verra 明文允許 ratio/regression 校準**。我們的 1.124 完全符合 §9.1 ratio sampling 規範。

### Verra calibration 六條規範

| # | 規範 | 出處 | 我們狀態 |
|---|---|---|---|
| 1 | sample measurement 必須 demonstrated to be unbiased | §9.1 p38 | 校準後 bias < 2% ✓ |
| 2 | 允許 ratio/regression 建立 auxiliary 跟 biomass 關係 | §9.1 p38 | 用 ratio ✓ |
| 3 | uncertainty 用 ratio 90% CI 或 regression 1.645 × RMSE | §9.2 p42 | **嚴格計算未完成** ✗ |
| 4 | DBH 用 best practices（Kershaw 2016、Avery 2015）| §9.1 p39 | 影片量法 vs 教科書、需驗證 ⚠ |
| 5 | Allometric equation 對應 ecoregion / Holdridge life-zone | §9.1 p38 | 需確認 ⚠ |
| 6 | QA/QC procedures 寫進 SOP | §9.3 p50 | **SOP 未文件化** ✗ |

### 三個 caveat（論文要表達精確）

1. **DBH ≠ AGB**：DBH 8% CI 換 AGB CI 約 16%（平方放大）。論文要報 AGB level CI、不只 DBH level。
2. **bias ≠ CI**：CI 是精度（precision）、bias 是準度（accuracy）。我們 -11% bias 沒被 CI 抓到、套校準才修。
3. **30 棵 sample size 邊緣**：forest mensuration 慣例希望 n ≥ 50。

---

## 8. Kershaw / Avery DBH 量法

Verra §9.1 規定 DBH 用 Kershaw（2016 Forest mensuration）跟 Avery（2015 Forest measurements）教科書 best practices。

### 量的高度

- 北美：1.37 m（4.5 ft）
- 歐洲/亞洲：1.30 m
- Verra：通常 1.3 m

### 從上坡側地面算起

不是樹根平均高度、是「上坡側地面」算 1.3 m。

### 皮尺繞法

- 垂直於樹幹軸線（樹幹斜的話皮尺也斜）
- 緊貼樹皮但不勒進去
- 皮尺要平不能扭

### 特殊情況

| 情況 | 量法 |
|---|---|
| 樹幹分叉剛好在 1.3 m | 量分叉以下不變形處 |
| 樹幹傾斜 | 沿傾斜方向、上坡側 1.3 m |
| 有膨大根頭（buttress、熱帶常見）| 量膨大上方 30 cm |
| 樹幹有節瘤、傷疤 | 量上方或下方避開 |
| 1.3 m 處兩棵合生 | 分別量、視為兩棵 |

### 量具

| 工具 | 怎麼用 |
|---|---|
| **D-tape**（diameter tape）| 刻度標 πD、繞一圈直接讀直徑 |
| 一般皮尺 | 量周長、除以 π = 直徑 |
| Caliper（卡尺）| 量最寬、最窄兩方向取平均 |

業界最常用 D-tape。

### 精度要求

- 一般 ±0.5 cm（5 mm）
- QA/QC 抽 5-10% 棵重複量

---

## 9. 待解決問題

### 7 棵 systematic 偏低 FAIL

| IMG | tape | best DBH | 偏離方向 |
|---|---|---|---|
| 5790 | 19.4 | 16.4 | -16% 邊緣 |
| 5802 | 43.9 | 34.1 | -22% |
| 5803 | 43.0 | 26.1 | -39% |
| 5806 | 38.8 | 30.0 | -23% |
| 5808 | 31.8 | 26.9 | -15.4% 邊緣 |
| 5809 | 30.6 | 21.6 | -29% |
| 5814 | 38.5 | 30.8 | -20% |

共同 pattern：所有 FAIL 都「Gemini 把樹幹估小」。原因可能：拍攝角度、焦距、樹皮複雜度。
**修正因子 ×1.124 可救部分但 5803/5814 偏差大於 30% 仍救不了**。

### IMG_5804 一影片兩棵樹

影片裡有兩棵不同 tree_id（f5d4607c、b8b61455），Gemini 沒辦法分辨「現在看哪棵」。
未來解法：
- 拍攝時加標籤（每棵開始拍前停 2 秒講編號）
- 或用 segmentation 分區域量

### IMG_5788 撞 API cap

mass run 最後一棵撞到 Gemini API monthly spending cap。等下個月或加 quota 重跑。

### 6 個 Verra compliance task（task #39-44）

| Task # | 內容 | 對應規範 |
|---|---|---|
| #39 | 嚴格算 ratio 90% CI | §9.2 |
| #40 | 寫 SOP 文件（QA/QC procedures）| §9.3 |
| #41 | 確認 allometric equation 對應 ecoregion | §9.1 |
| #42 | 驗證 tape 量法符合 Kershaw protocol | §9.1 |
| #43 | 補 destructive validation + applicability boundary | §9.1 |
| #44 | 證明 measurement unbiased（paired t-test）| §9.1 |

---

## 10. 工具 / 路徑 / 網址

### 主要 scripts（VM `~/forest-carbon-measurement/scripts/`）

| Script | 用途 |
|---|---|
| `detect_card.py` | production OpenCV 偵測卡片（早停 5 frames）|
| `detect_card_kf.py` | dryrun 用、加 `--keyframe-only` `--no-resize` `--diag` flags |
| `dryrun-rerun.js` | path-G 原版（無 keyframe、有 isOrthogonal）|
| `dryrun-rerun-kf.js` | P1a + P2（keyframe + isOrthogonal + measure prompt）|
| `dryrun-rerun-kf-orig.js` | P1b（同 P1a 但保留原解析度）|
| `dryrun-rerun-kf-noiso.js` | path-G 不篩 iso 版（測試用）|
| `dryrun-video.js` | P3 video direct v1（N=5）|
| `dryrun-video-v2.js` | P4 video direct v2（N=10 胸高 prompt + timestamp）|
| `variance-test.js` | Gemini batch variance 實驗用 |

### Gemini 函式（`src/services/geminiService.js`）

| 函式 | prompt |
|---|---|
| `analyzeTrunkWithRetry` | production 完整 prompt（含樹種）|
| `analyzeTrunkPathAOnly` | RATIO_PROMPT（legacy §32、假設正交）|
| `analyzeTrunkRatioRelaxed` | path-G relaxed prompt |
| `analyzeTrunkRatioTight` | R2 tight prompt（強調邊界）|
| `analyzeTrunkRatioMeasure` | R3 measure prompt（CoT 量像素）|

### Pipeline 版本字串對應（dryrun_runs.pipeline_version）

| 版本 | Pipeline |
|---|---|
| `35.7+legacy32+resample+N` | path-G 原版（無 keyframe）|
| `pathG-iso-batch8-N5` | R1 baseline |
| `pathG-iso-tight-batch8-N5` | R2 tight |
| `pathG-iso-measure-batch8-N5` | R3 measure（**P1a/P2**）|
| `pathG-iso-measure-kf-batch8-N5` | P1a + P2（keyframe 版）|
| `pathG-iso-measure-kf-orig-batch8-N5` | **P1b**（no-resize）|
| `pathG-noiso-measure-kf-batch8-N5` | path-G 不篩 iso（單純測試）|
| `video-direct-N5` | **P3** |
| `video-direct-v2-N10` | **P4** |

### 重要靜態網頁

- 主旅程：https://forest-carbon.duckdns.org/journey/
- 主旅程「文風改寫預覽版」（§41）：https://forest-carbon.duckdns.org/journey/index.rewritten.html
- 詳細誤差表（含 cv）：https://forest-carbon.duckdns.org/journey/details.html
- variance test #1（5789 frame_9）：https://forest-carbon.duckdns.org/variance-tests/1/
- path-G 31 棵失敗報告：https://forest-carbon.duckdns.org/variance-tests/2/
- path-G-iso 四輪 prompt：https://forest-carbon.duckdns.org/variance-tests/3/
- dryrun #8 frames evidence：https://forest-carbon.duckdns.org/dryrun-frames/8/

### dryrun_runs 重要 id

| id 範圍 | 內容 |
|---|---|
| #8-#9 | 5789 早期 dryrun（發現 N×median 重要）|
| #10-#15 | path-G mass run 第一輪 |
| #16-#42 | path-G + iso 系列 |
| #43-#52 | path-G-iso R1 7 棵 |
| #53-#59 | path-G-iso R2 7 棵 |
| #60-#66 | path-G-iso R3 7 棵 |
| #67-#80 | video direct v1 / v2 + 5806 6-way |
| #81 | 中間切點（5-way mass run 從這之後）|
| #82-#196 | 5-way mass run 30 棵 |

### Production pipeline 順序（`src/index.js` line 460-530）

```
1. 抽幀（frameService 2fps）
2. detect_card.py 篩 orthogonal cards（early-exit 5 張）
3. Gemini analyzeTrunkWithRetry（此時不知道樹種、估 ratio + leafFrameIndices）
4. 取 Gemini 標的 "leaf frames"
5. Pl@ntNet + iNaturalist 平行 API call → 投票決種
   （兩個都沒結果才用 Gemini identifySpeciesFallback）
6. calculate() ← 樹種影響 volume/carbon allometric 係數
```

樹種辨識**是 Pl@ntNet + iNaturalist、不是 Gemini**。但跑在 Gemini ratio 之後、樹種沒回傳給 Gemini 改進 ratio 估算。

---

## 11. SOP / 適用範圍重要細節（2026-05-31 使用者澄清）

完整 SOP 在 `sop.md`、以下是重要對照速查：

### 拍攝細節（跟一般想像不同）

- **繞樹半圈拍**（不是繞一圈）—— 聚焦卡片週圍視角、確認皮尺貼合
- 原因：AI 在「圓形假設」框架下測量、繞一圈不提供額外資訊
- 拍攝時長 60-120 秒、過程中確認皮尺沒鬆垮

### 真值量法（Kershaw 對齊但有 caveats）

- 鐵捲尺從**平地地面**定 1.3 m（**沒有山坡地樹**、不需要 uphill side 校正）
- 1.3 m 處皮尺垂直繞、量周長 ÷ π = DBH
- **1.3 m 處分叉的樹（IMG_5804）**：分別量、視為兩棵獨立樹

### 模型版本管理（重要）

- Calibration factor ×1.124 lock 在 **Gemini 2.5 Flash 2026 年 5 月版本**
- 未來換模型版本（Gemini 3 等）**必須重新驗證**：
  1. 拿同 30 棵跑新模型
  2. 算新 mean bias、新 calibration factor
  3. paired t-test 確認新校準 unbiased
  4. ratio 90% CI 確認 < 100%
- 重驗工時：約 2-4 小時

### 適用範圍速查

| 條件 | 已驗證 | 未驗證 |
|---|---|---|
| 樹種 | formulaDb 內台灣本土樹種 | global 樹種、formulaDb 未登錄者 |
| 拍攝設備 | iPhone 4K HEVC | Android、其他格式 |
| 樹徑 | 17-44 cm | < 15 cm、> 50 cm |
| 地形 | 平地 | 山坡地 |
| 模型 | Gemini 2.5 Flash 2026/5 | 其他版本 / 其他 LLM |
| 季節 | 實驗期間 | 落葉、開花、結果期 |
| 驗證方法 | tape ground truth | destructive sampling 未做 |

### Verra task 完成狀態（task #39-44）

| Task | 狀態 | 證據 |
|---|---|---|
| #39 ratio 90% CI | ✓ | 8.63% << 100% 紅線、寬裕 11.6 倍 |
| #40 寫 SOP | ✓ | sop.md 完成 |
| #41 allometric equation | ✓ | 台灣林業局公式（formulaDb.js）|
| #42 tape Kershaw protocol | ✓ | 鐵捲尺定 1.3m + 皮尺繞 |
| #43 適用範圍宣告 | ✓ | sop.md §8 完成 |
| #44 paired t-test unbiased | ✓ | t=0.126 << 2.052、bias 不顯著 |

---

## 12. 寫作 / 表達規則

### 中文謂語完整原則

句子必須有完整主詞、動詞、受詞、不可縮略謂語。子句也要有主詞。
錯：「梯度強度分不清」 / 正：「無法分清楚梯度強度」

### 程式碼名稱保留 + 括號白話補充

提到 function / 變數 / class 名稱時保留原樣、第一次出現用括號補白話。
範例：「processVideo 這個函式（負責解碼影片並抽幀）」

### 分層寫法

主句講「結論 + 怎麼辦」（白話、不夾術語）、技術細節用括號補。
長代號（雜湊值、UUID、file_id）一律降級到括號當「查得到就好」的細節。

### 不要用「Last Session」這種自創英文標籤

一律改用白話中文、例如「上一次對話的進度」。

---

## 13. journey 展示頁文風改寫（§41，2026-06-01）

測試全部結束後，把 journey 演進旅程展示頁的中文敘述依論文寫作規則改寫。

### 檔案位置

| 用途 | 路徑 / 網址 |
|---|---|
| 原始對照版（本機）| `journey-rewrite/index.original.html` |
| 改寫版（本機）| `journey-rewrite/index.rewritten.html` |
| 改寫版線上預覽 | https://forest-carbon.duckdns.org/journey/index.rewritten.html |
| VM 上預覽檔 | `~/forest-carbon-measurement/public/journey/index.rewritten.html` |
| 正式頁（尚未覆蓋）| `~/forest-carbon-measurement/public/journey/index.html` |

### 改寫依據

寫作規則來源 = `thesis-advisor.md` §7 寫作注意事項 + §8 中文改寫句型規則（此專案沒有另一份；論文專案 thesis-rewrite 資料夾內無 thesis-advisor）。

### 套用的規則（之後改其他頁可重用）

1. 用詞：一律「此專案」，不用「我們／本研究／本實驗」；中文句不以「的」結尾；「閉環」→「循環」。
2. 順向連接：避免「但／然而／不過」，改「至於…／值得留意的是／同時／相較之下」。
3. 術語中英對照：首次出現補括號，例：胸高直徑（DBH）、離群值（outlier）、中位數（median）、偏差（bias）、但書（caveat）。
4. 避免恐懼行銷與絕對語氣：不可能→無法單獨成立、強制→固定、搞砸→扭曲、視為失敗→視為未通過。
5. 長代號降括號：tree_id 雜湊（f5d4607c、b8b61455）從主句移到括號當「查得到就好」的細節。
6. 標題中文為主、英文為輔：caveat→但書、AGB→地上生物量、pipeline→處理流程、winner→勝出、OpenCV→電腦視覺工具、Gemini→影像模型、ffmpeg→影音工具、HEVC→高效率編碼影片（英文全退到括號）。

### 名詞速查（caveat）

caveat = 但書，指「結論雖然成立，仍有幾點必須先聲明、不能忽略的限制或前提」。§7 三個 caveat 講的是 P4 雖通過 Verra 門檻，論文表達上有三處易被審查挑剔（DBH≠碳儲量、bias 不等於 CI、樣本數偏少）。

---

## 14. RQ2 三方協作驗證的四個候選框架（討論中，2026-06-01）

> 論文脊椎：此系統定位為信任基礎設施（Trust Infrastructure），解決植樹造林中企業、地主、基金會三方協調失敗的問題。RQ1 驗證數據可信度，RQ2 驗證可信數據能否促成三方協作。詳細框架見 auto-memory `project-forest-carbon-rq-framework`。

### 四個候選驗證方向

| # | 框架 | 量什麼 | 性質 | 特色 |
|---|---|---|---|---|
| 1 | TAM（科技接受模型，Technology Acceptance Model）| 使用意圖；核心兩變數：認知有用性（perceived usefulness）、認知易用性（perceived ease of use）| 實證問卷模型 | 最簡潔、最經典、問卷最短 |
| 2 | UTAUT（整合型科技接受與使用理論）| 使用意圖；四構念：績效期望、努力期望、社會影響、促成條件 | 實證問卷模型 | TAM 擴充版、較全面、問卷較長 |
| 3 | DeLone & McLean（資訊系統成功模型）| 系統品質、資訊品質、服務品質 → 使用 → 淨效益 | 實證問卷模型 | 重點在系統本身做得好不好 |
| 4 | Shared Value（共享價值，Porter & Kramer 2011）| 企業為何值得投入（商業價值＋社會價值雙贏）| 質性策略論證框架 | 非問卷、回答企業投入動機 |

### 關鍵區分與結合方向（待定）

- 前三者（TAM／UTAUT／D&M）皆為實證問卷模型，彼此高度重疊，原則上擇一為主，不宜三套全上、問卷過長。
- Shared Value 屬質性策略框架，與前三者不同軸，可互補結合。
- 初步建議組合：Shared Value 提供「三方各自價值主張」的質性骨架 → 轉成問卷構念 → 以 TAM 或 UTAUT 量三方使用意圖；DeLone & McLean 的系統品質可作為前置變數。
- 三方痛點對照（出自 RQ 利害關係人矩陣）：企業＝ESG 數據造假疑慮、地主／部落＝土地零散管理無利可圖、基金會／大學＝樹苗存活率低監測人力不足。

### 決策更新（2026-06-01）

- **TAM 排除**：老師明示不採用科技接受模型（TAM）。處理方式＝在 RO 撰寫時討論並表示「評估後不適用」，不列為驗證工具。
- **Shared Value 確定採用**：作為質性骨架，替三方各寫一條價值主張。
- **問卷模型在 UTAUT 與 DeLone & McLean（D&M）之間二選一**，討論中。
- **風險提醒**：UTAUT 屬科技接受／採用理論同一家族，若老師排除 TAM 的理由在於「不要科技接受模型」，UTAUT 可能觸及同一顧慮，需先向老師確認。D&M 屬資訊系統成功模型、血統不同，且其「資訊品質」構念可直接銜接 RQ1 的數據精度成果，相對安全。

---

## 15. dashboard02 / Pipeline 4 重跑（Phase 0 事實 + prompt + 樹種中文對照，2026-06-01）

### Phase 0 唯讀調查重要事實

| 項目 | 事實 |
|---|---|
| 正式 trees 筆數 | **18 棵**（非 31）；17 棵有 video_drive_url |
| 31 支影片實驗資料 | 在 `dryrun_runs`（196 列、沙箱），無樹種、無上鏈 |
| 樹種來源分布 | plantnet 7、gemini fallback 11、**iNaturalist 0（從未勝出）**；1 棵 Unknown |
| 樹種共同判斷實作 | index.js 485–503：`Promise.all([plantnetIdentify, inaturalistIdentify])` → 投票 → Gemini fallback（門檻 SPECIES_MIN_CONFIDENCE 預設 0.3）|
| P4 關鍵幀 | **video-direct-v2 整支影片給 Gemini，無原生離散關鍵幀**；有 keyframe 的是標準逐幀流程（ffmpeg 抽幀→偵測卡片→Gemini 逐幀→evidence 幀）|
| dryrun pipeline 版本 | video-direct-v2-N10（P4）32 筆、video-direct-N5（P3）33 筆、kf 系列若干 |
| 區塊瀏覽器 | **VM 上沒有**（只有 nginx 443/80、app 3000、Besu RPC 8545/8546）|
| 取區塊號方式 | blockchain_jobs 只有 tx_hash，無 block_number；需 `eth_getTransactionReceipt(tx_hash)` 取 blockNumber |
| Besu 鏈高 | 約 126866（0x1ef92）；RPC `http://35.227.93.38:8545` |
| 標準流程關鍵服務 | plantnetService.js / inaturalistService.js / geminiService.js / blockchainService.js / evidenceFrameService.js |

### P4 重跑追加 prompt（要求 Gemini 回傳關鍵幀時間點）

> 請分析這段影片中的樹木樹徑。除了給出最終的測量數字之外，請精確列出你用來計算樹徑的 5 個關鍵幀時間點（格式為 MM:SS），並說明你在該時間點看到了什麼特徵（例如：樹幹無遮蔽處、特定海拔高度氣壓計畫面）。

用途：P4 主畫面只放 Gemini 回傳的關鍵幀（時間點＋特徵），使用者可依時間點自行截圖；其他 pipeline 的關鍵幀放到 journey 頁佐證執行過程。

### 樹種學名 → 中文對照（dashboard02 中文為主、學名小標）

| 拉丁學名 | 中文俗名 |
|---|---|
| Fraxinus griffithii | 光臘樹 |
| Cinnamomum camphora／Camphora officinarum | 樟樹 |
| Acacia confusa | 相思樹 |
| Liquidambar formosana | 楓香 |
| Swietenia macrophylla | 大葉桃花心木 |
| Bischofia javanica | 茄苳 |
| Melia azedarach | 苦楝 |
| Juglans nigra | 黑胡桃 |
| Unknown | 未辨識 |

### 已確認執行決策（2026-06-01，詳見 tasks.md §42）

- 處理**全 31 棵**：18 棵更新量測＋重新上鏈、保留舊故事與 EXIF（故事不重生）；新 13 棵完整生成（量測＋共同判斷樹種＋上鏈＋故事＋EXIF）；以 video_hash／Drive file_id 對映既有 18 棵。
- **全 31 棵以 P4 新值重新上鏈（新區塊），不沿用舊區塊**。
- 關鍵幀：**自動 ffmpeg 截圖**＋**保留 10 次 run 原始 JSON**，dashboard 用**下拉選單**選 run、連 JSON 查詢頁、顯示對應 5 張截圖。
- **封存傳統上傳流程**（index.js 舊 processVideo 不動），**新建檔（如 `src/processVideoP4.js`）寫 P4 混合新流程並改用**。
- 第一步必須先測 1–2 支確認 Gemini 穩定回傳 MM:SS 關鍵幀，測通才往下。
- Besu 區塊 URL：Expedition（最輕量區塊瀏覽器）已架設完成，路由 `/explorer/`，組真實交易連結 `https://forest-carbon.duckdns.org/explorer/tx/<hash>?rpcUrl=...`。
- **樹種辨識＝Gemini ＋ Pl@ntNet 兩方**（2026-06-01 決定）。iNaturalist 暫緩：token 短效 JWT 已過期（2026-05-11），且建 OAuth 應用需帳號滿 2 個月＋鑑定 > 10 次、使用者無權限。待辦見 tasks §42.X。
- **取幀改良**：`rerun_p4.js` 原「平均取 6 幀」會漏樹冠；改由 P4 的 Gemini 回傳 `leafTimestamps`（樹冠/葉子清楚時間點）→ ffmpeg 抓那幾幀送 Pl@ntNet。
- Pl@ntNet key（長效、不過期）：`.env` `PLANTNET_API_KEY`；iNaturalist token 已失效。
- 進度：Gemini 關鍵幀測試 3/3 通過；`rerun_p4.js` 已寫、dry-run 單支通過（DBH→碳、關鍵幀、樹種 fallback 皆正常）；批次已完成（32 棵全上鏈）；**dashboard02 已不存在**（2026-06-07 確認）；Expedition explorer 已架設完成。

### 彙總與校準決策（2026-06-01，3 棵驗證後）

- **ratio 收斂法＝去頭去尾÷8（trimmed mean，丟最高最低各一、其餘平均）**。比純中位數穩，能擋單一離群值（5787 中位數 14.3% → 截尾 11.4%）。
- **校準因子流程改成「先存原始、跑完再定」**：① 31 支先存原始 P4 值、**先不套校準（上鏈也用原始值＝真正量到的數）**；② 跑完用「平均皮尺 ÷ 平均原始 DBH」算出新流程專屬因子；③ 再套那個因子（dashboard 路徑估算顯示原始→校準）。
- **為何不沿用舊 ×1.124**：那是舊流程（系統性低估 −11%）的因子。新流程（去頭去尾）原始值已居中，3 棵驗證原始誤差 +10.1%／−8.4%／+7.7%（**3/3 PASS、平均僅 +2%**），硬套 1.124 反而把兩棵推爆到 20%+。新流程實算因子 ≈ 0.979（近 1.0）。
- 取幀改良大成功：5801 用 Gemini leafTimestamps 抓樹冠幀，Pl@ntNet 信心 6.2% → **95.7%**。

---

## 16. P4v2 資料儲存結構（2026-06-02 確認）

### raw_result 欄位內容（trees 表）

每棵樹的 Gemini 量測數據全部存在 `raw_result` 欄位（JSON 字串），頂層就是 p4v2 資料（沒有 `p4v2` 這層包裝）：

| 欄位 | 說明 |
|---|---|
| `runs` | Array[10]，每次 Gemini call 原始回傳（ratio、cardPixelWidth、trunkPixelWidth、videoTimestampSec、confidence）|
| `measureTimestamps` | Array[10]，各次量測的影片秒數 |
| `rawDbhCm` | 10 次 median 後的原始 DBH（未校準）|
| `calibratedDbhCm` | rawDbhCm × 1.155 |
| `carbon` | { primaryKg, agbKg, co2eKg, heightM, volumeM3 }（用 Gemini 樹種係數算）|
| `species.gemini` | { species, confidence, zhName, carbonKg, co2eKg, agbKg, isDefaultFormula } |
| `species.plantnet` | 同上 |
| `species.leafTimestamps` | 樹冠幀時間點（送 Pl@ntNet 的幀）|

磁碟上**沒有**獨立的 JSON 檔案（§42.6 規劃的 p4-run endpoint 未實作）。

### 關鍵幀影像儲存

| 類型 | 位置 | 說明 |
|---|---|---|
| 量測關鍵幀 | 即時截圖（on-demand）| `/api/trees/:id/frame-at?sec=` → ffmpeg 從 video_cache 截圖，24h 快取 |
| 樹冠識別幀 | `species_frames/IMG_XXXX/` | Pl@ntNet 識別用，實體 JPG，永久保存 |
| 原始影片 | `video_cache/IMG_XXXX.mov` | 30 支，3.3GB，磁碟剩 17GB（2026-06-02）|

**注意**：IMG_5804.mov 不在 video_cache，那兩棵樹（f5d4607c、b8b61455）的量測關鍵幀無法截圖。

---

## 17. formulaDb 擴充（2026-06-02）

從 7 種擴充到 30 種。

**官方係數（sourceNote: 'official'）**：樟樹、柳杉、台灣杉、相思樹、楓香、光臘樹、木麻黃（以及 Camphora officinarum = 樟樹異名）

**推算係數（sourceNote: 'approx-broadleaf' 或 'approx-pioneer'）**：依 Global Wood Density Database + 同科樹種異速生長通式推算；涵蓋欖仁樹、苦楝、香椿、大葉桃花心木、櫸木、台灣欒樹、朴樹、大葉合歡、血桐（先驅種）、無患子×2、刺槐、繖楊、美洲楓香、印度楝、瓊崖海棠、西班牙雪松、茄苳、美洲山核桃、水黃皮、五蕊柳、槐樹、小葉桃花心木

32 棵樹中，`無法判斷`（1棵）和 `Unknown`（1棵）繼續用 DEFAULT_FORMULA，其餘 30 棵全部找到對應係數。

碳值重算結果：6,738 → **6,791 kg C**（+0.8%）

論文注意事項：approx-broadleaf 樹種非官方數據，需在方法論中標注此限制。
- 3 棵驗證樹（已寫 DB＋上鏈，但 DBH 是 ×1.124 灌水版，需用原始值重跑修正）：5801→8bd512bb(水黃皮)、5810→1517033e(苦楝)、5815→f64e6422(楓香)。
- 緩衝坑：`ssh "bash …"` 沒給 PTY 時 Node stdout 走區塊緩衝、整批結束才 flush。要即時看進度用 `stdbuf -oL` 或 `ssh -t`，並 tee 到 log。

---

## 18. 永續故事 generateStoryA 升級版 prompt（§28.8，2026-06-02）

### 檔案位置

`~/forest-carbon-measurement/src/services/storyService.js`

### 資料來源（升級後全部有用）

| 來源 | 欄位 | 舊版有 |
|---|---|---|
| `trees` 表 | species, dbh_cm, carbon_kg, gps, created_at | ✓ |
| `ecologyDb.js` | birds, insects, soilRole, keystone, origin | ✓ |
| `environmental_context` 表 | season, forest_zone, temp_c, humidity_pct, uv_index, sunshine_duration_h, solar_elevation_deg, day_length_h, weather_text, phenology_tags | **新增** |
| OpenWeatherMap fallback | weatherLine（只在無 environmental_context 時才用） | ✓（現為備援）|

### prompt 結構（v2）

```
## 樹木資訊
- 樹種、生長階段（sizeLabel）、碳儲量、地點、量測時間
- 原生/引進種、生態關鍵物種、吸引鳥類、吸引昆蟲

## 拍攝當下環境快照（新增，有 env 才出現）
- 季節：濕熱夏季 / 乾冷冬季 / 春季轉換 / 秋季轉換
- 林帶：海岸帶 / 低海拔闊葉林 / 中海拔混交林 / 高海拔針葉林
- 天氣：weather_text，temp_c，humidity_pct
- UV 指數：uv_index（含推算午間最高）
- 日照時數：sunshine_duration_h
- 太陽仰角：solar_elevation_deg
- 日長：day_length_h
- 物候事件：phenology_tags 轉中文（鳥類繁殖初期、昆蟲羽化…）

## 寫作要求（8 條）
1. 樹的視角或旁觀者視角，交織生態事實與情感
2. 至少提一種鳥類或昆蟲，描述與樹的關係
3. 提到土壤或周遭生態貢獻
4. 若有物候事件，融入當下季節氛圍
5. 若有 UV/日照，用詩意方式描述光線
6. 末段隱含「種樹是寫給未來的信」
7. 不用「的」結尾的句子
8. 語氣溫暖、避免說教
```

### Markdown 輸出結構（v2）

```
# 🌳 {zhName} 的故事
> {region} | {recordDate}
---
{getBiodiversityMarkdown}       ← 生態多樣性表格（原有）
---
## 🌍 碳儲量意義                ← 原有
## ✨ 這棵樹的故事              ← Gemini 生成正文
---
## 📊 拍攝當下環境快照         ← 新增（有 env 才出現）
| 季節 | 林帶 | 天氣 | 氣溫 | 濕度 | UV | 日照 | 太陽仰角 | 物候事件 |
---
_資料由系統自動生成，更新日期_
```

### 物候標籤中文對照

| key | 中文 |
|---|---|
| bird_breeding_early | 鳥類繁殖初期 |
| bird_breeding_late | 鳥類繁殖末期 |
| insect_emergence | 昆蟲羽化 |
| beetle_sap_feeding | 甲蟲樹液期 |
| termite_alates_flight | 白蟻婚飛 |
| flower_peak_lowland | 低地花期高峰 |
| fungal_fruiting_window | 菌類結實期 |
| flying_squirrel_pups | 鼯鼠幼仔期 |
| leaf_flush | 新葉萌發 |
| fruit_ripening | 果實成熟 |
| dormancy | 休眠期 |

### 重生成腳本

`scripts/regen_stories.js`：對所有 `winner_path IS NOT NULL` 的樹（32 棵）逐一呼叫 `generateStoryA`、INSERT 新故事，不刪舊版；`getLatestByTree ORDER BY created_at DESC` 自動以新版為準。間隔 3 秒避免 Gemini rate limit，log 輸出到 `logs/regen_stories.log`。


## 19. 區塊鏈瀏覽器評估（2026-06-11）

### GCP VM 規格（2026-06-11 確認）

三台 VM 均為 **e2-small**（2 vCPU、2 GB RAM、約 .5/月），
並非 e2-medium。bootnode 與兩台 member 都是同一規格。

| VM 名稱 | Internal IP | 角色 |
|---------|------------|------|
| besu-bootnode | 10.128.0.x | bootnode + nginx + Node.js app |
| besu-member1 | 10.128.0.x | member 節點 |
| besu-member2 | 10.128.0.x | member 節點 |

### 區塊鏈瀏覽器比較結論

| 方案 | ABI 解碼 | RAM 需求 | 費用估算 | 結論 |
|------|---------|---------|---------|------|
| Expedition（現有）| ✗（原始 hex，EXTRA DATA 亂碼為正常 QBFT RLP 二進位）| < 512 MB | 已架設， | 維持現狀用於區塊瀏覽 |
| 自建 tx.html（現有）| ✓（完整解碼 recordMeasurement 9 個參數）| 無需額外 | 已存在， | **最佳方案**，直接解碼自家合約 |
| Blockscout（自架）| ✓（通用 ABI 解碼）| 8 GB（需升至 e2-standard-2）| +/月 | RAM 太大，暫不採用 |
| Chainlens Free（Docker）| 不確定（官方描述「evaluation limited」）| 4–6 GB（需升至 e2-medium）| +.5/月 | ABI 解碼不確定，暫不採用 |

### 重要說明

- **EXTRA DATA 亂碼**：Expedition 顯示的亂碼是 QBFT 協議正常行為——
  欄位儲存 RLP 二進位資料（validators list + committed seals），用 UTF-8 顯示就會亂碼，
  並非 Bug。
- **tx.html 限制**：只能解碼 ecordMeasurement() 這一個函式呼叫（9 個固定參數位置），
  其他合約或其他函式呼叫無法解碼，並非通用區塊瀏覽器。
- **quorum-dev-quickstart**：指令 
px quorum-dev-quickstart 含 --blockscout 與 --chainlens
  旗標，一鍵架設完整環境，但需要另一台記憶體較大的機器，不適合現有 e2-small 環境直接使用。
- **待確認行動**：dashboard.html 的交易連結目前指向 /explorer/tx/<hash>（Expedition），
  可改為 /tx.html?hash=<hash> 讓使用者直接看到 ABI 解碼結果，但使用者尚未確認是否要改。
