# Forest Carbon — 專案狀態快照（2026-06-02 更新）

## 研究問題（RQ）與研究目標（RO）— 動態修正中

> 狀態：RQ 三條已確認方向；RO 三條只有 RO1 大致定案，RO2／RO3 仍是草稿。

### RQ（已確認方向）

| RQ | 問題 |
|---|---|
| RQ1 | 以參照物比例尺法（Path A）估算的 DBH，其量測不確定性能否符合 Verra VM0047 §8.4 精度要求？|
| RQ2 | 系統能否讓企業、地主、基金會三方各自看見足夠助益而形成協作？ |
| RQ3 | 信任機制能否促使 SDG 13/15 相關目標的落地？ |

### RO（草稿，未完整定案）

| RO | 草稿內容 |
|---|---|
| RO1 | 建立並評估以手機影像為基礎、以參照物比例尺法為核心的 DBH 量測模型，驗證其 Verra VCS 樣區精度可行性（P4v2，CI = 7.4%）|
| RO2 | 共享價值（Shared Value）骨架＋UTAUT／D&M 雙候選問卷並列（TAM 已排除）|
| RO3 | 改變理論（ToC）因果鏈＋三關鍵假設＋德爾菲法專家問卷＋SDG target 對應 |

---

## 現況（2026-06-02，dashboard02 三個 Bug 已修 + UI 補齊 + 故事升級完成）

**已完成的工作（本次對話）：**

1. **dashboard02 Bug 修正（全部完成）：**
   - frame-at 路徑 Bug：`index.js` 加 `..` → 關鍵幀截圖 HTTP 200 ✓
   - CV 精度等級全 LOW：閾值改 `cv <= 10`（HIGH）、`cv <= 25`（MEDIUM）；顯示移除多餘 ×100 ✓
   - Drive 影片嵌入空白：iframe src 加 `.replace('/view', '/preview')` ✓

2. **dashboard02 UI 補齊（全部完成）：**
   - section title 去掉「P4v2」字眼，改中文通用描述
   - 物種辨識「信心」改「可靠評分」
   - 新增「🌿 拍攝當下環境快照（CBD 生物多樣性）」區塊（lazy-load，展開時呼叫 `/api/trees/:id/environment`）
   - 區塊鏈存證連結格式確認正確（`tx.html?hash=…`）

3. **§28.8 永續故事 prompt 升級（完成）：**
   - `storyService.js` `generateStoryA()` 升級：讀 `environmental_context` 表，注入季節、林帶、氣溫、濕度、UV、日照時數、太陽仰角、物候標籤進 prompt
   - Markdown 末段補「📊 拍攝當下環境快照」表格
   - `regen_stories.js` 對 32 棵全部重新生成：**成功 32、跳過 0、失敗 0**
   - 升級版 prompt 架構已存入 `memory.md` §18

---

## 可存取頁面

- dashboard02（主目標）：https://forest-carbon.duckdns.org/dashboard02.html
- dashboard（原版三路徑）：https://forest-carbon.duckdns.org/dashboard.html
- tx 查詢：https://forest-carbon.duckdns.org/tx.html?hash=\<txHash\>
- journey：https://forest-carbon.duckdns.org/journey/

---

## 下一步（待確認方向）

- **§30.5**：paper 章節更新，明示「對 manual ground truth」與「自比」兩種數字
- **§35.3–35.5**：Path A OpenCV 兩階段重構部署（VM pip install + 主流程整合）
- **永續故事連結補齊**：`hasStory` 32 棵已全部重生成新版故事（含環境快照），dashboard02 的故事連結已可用
- **RO2/RO3 定案**：UTAUT vs D&M 問卷模型選擇待確認

---

## 給接手 Claude 的提醒

- dashboard02 `hasStory` 連結格式 `story.html?id=...`，故事端點 `/api/trees/:id/story?format=json`
- 新版故事含「📊 拍攝當下環境快照」表格（季節/林帶/氣溫/UV/日照/物候標籤），只在 `environmental_context` 有資料的樹才出現
- 不要用大段 sed 讀整份 HTML，改用 grep -n 定位行號再縮範圍讀
- 修 index.js 後記得 PM2 重啟：`pm2 restart forest-carbon`
