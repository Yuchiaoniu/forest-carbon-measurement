# Forest Carbon — 專案狀態快照（2026-06-03 更新）

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

## 現況（2026-06-03，網站頁面整理完成）

**本次對話完成的工作：**

1. **Expedition 區塊鏈瀏覽器修復（完成）：**
   - 根本原因：`sites-enabled/forest-carbon` 是舊版複製檔，`/explorer/` 和 `/rpc` location 區塊從未生效
   - 修法：`sudo cp sites-available/forest-carbon sites-enabled/forest-carbon && systemctl reload nginx`
   - 現在 `/explorer/tx/<hash>?rpcUrl=...` 可正常存取

2. **showcase.html 頁面整理（完成）：**
   - 移除「▶ 生產版成果（32 棵量測 + Verra 碳信用憑證）：dashboard02.html」
   - 任務編號 #39–#44 從表格移除，欄位「要做的事」改「任務名稱」，句子拿掉「由六件任務（編號 #39 至 #44）構成，」
   - Footer 清空舊內容（最後更新、dashboard02 連結）
   - 新增 §10 Verra VM0047 官方文件區塊（含三條認證條件的 PDF 搜尋關鍵字表格）
   - Nav 改為：← 測量系統 ｜ 📊 量測結果 ｜ 📋 SOP

3. **dashboard.html 調整（完成）：**
   - 大標題從「🌿 Pipeline 4 v2 量測結果」改為「🌿 量測結果」
   - Nav 補回 showcase 連結：← 測量系統 ｜ 📈 評估與演進旅程 ｜ 📋 SOP

4. **sop.html 新增（完成）：**
   - 內容：拍攝 Protocol（§1）、Ground Truth 標準（§2.1–§2.2）、林業局公式表格（§3）
   - Nav：← 測量系統 ｜ 📊 量測記錄 ｜ 📈 評估與演進旅程

5. **GitHub 同步（完成）：** 最新 commit `6a5ab10`，master branch

---

## 可存取頁面

- 主畫面：https://forest-carbon.duckdns.org/
- 量測結果（dashboard）：https://forest-carbon.duckdns.org/dashboard.html
- 評估與演進旅程（showcase）：https://forest-carbon.duckdns.org/showcase.html
- SOP：https://forest-carbon.duckdns.org/sop.html
- 區塊鏈瀏覽器：https://forest-carbon.duckdns.org/explorer/

---

## 下一步（待確認方向）

- **§30.5**：paper 章節更新，明示「對 manual ground truth」與「自比」兩種數字
- **§35.3–35.5**：Path A OpenCV 兩階段重構部署（VM pip install + 主流程整合）
- **RO2/RO3 定案**：UTAUT vs D&M 問卷模型選擇待確認

---

## 給接手 Claude 的提醒

- nginx `sites-enabled/forest-carbon` 是普通檔案（非 symlink），每次改 `sites-available` 要記得複製過去再 reload
- dashboard.html 現在就是生產版（原 dashboard02 內容），dashboard02.html 仍存在作相容備份
- showcase.html 有來自其他對話的隱藏 RQ3/RO3 區塊，修改時注意不要蓋掉
- 不要用大段 sed 讀整份 HTML，改用 grep -n 定位行號再縮範圍讀
- 修 index.js 後記得 PM2 重啟：`pm2 restart forest-carbon`
