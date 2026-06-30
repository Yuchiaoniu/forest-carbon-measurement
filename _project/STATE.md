# Forest Carbon — 專案狀態快照（2026-06-06 更新）

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
| RO1 | 建立並評估以手機影像為基礎、以參照物比例尺法為核心的 DBH 量測模型，驗證其 Verra VCS 樣區精度可行性（P4v2，CI = 6.5%）|
| RO2 | 共享價值（Shared Value）骨架＋UTAUT／D&M 雙候選問卷並列（TAM 已排除）|
| RO3 | 改變理論（ToC）因果鏈＋三關鍵假設＋德爾菲法專家問卷＋SDG target 對應 |

---

## 現況（2026-06-11，本次對話完成）

1. **區塊鏈瀏覽器評估（2026-06-11）**：
   - Expedition 無 ABI 解碼（Input Data 顯示原始 hex）；EXTRA DATA 亂碼是 QBFT RLP 正常行為，並非 Bug
   - 自建 tx.html 已完整解碼 `recordMeasurement()` 9 個參數（GPS、樹種、DBH、材積、碳、影片雜湊等）
   - Blockscout（8 GB RAM，+$54/月）與 Chainlens Free Docker（4–6 GB，ABI 解碼不確定）均暫不採用
   - 待確認：dashboard.html 的交易連結可從 `/explorer/tx/<hash>` 改為 `/tx.html?hash=<hash>` 以顯示解碼結果

2. **區塊鏈瀏覽器（Expedition）修復完成**：
   - nginx `/rpc` 路由加尾斜線（proxy_pass http://localhost:8545/），現在外部可存取 RPC
   - Expedition 加入 `basename: "/explorer"` 解決 React Router 路由比對失敗問題
   - Build 時燒入 `REACT_APP_ETH_RPC_URL` 與 `PUBLIC_URL=/explorer/`
   - Forest Carbon Chain 加為預設第一個網路
   - 交易直連 URL：`https://forest-carbon.duckdns.org/explorer/tx/<txHash>?rpcUrl=https://forest-carbon.duckdns.org/rpc`
   - 無頭瀏覽器（chromium + puppeteer-core）驗證確認交易資料顯示正常

2. **story.html 載入文字修正**：spinner 改為「永續故事載入中…」

3. **DB 故事修正**：
   - 51 筆故事移除「每多一棵這樣的樹，就是給大氣的一次小小還債。」
   - 33 筆故事碳值浮點截為小數點後三位

4. **論文 §44 任務新增**：H-D 異速生長方程式適用於林地、不適用於城市立地，導致碳儲量高估約 87%，須在論文討論章節說明（不影響 RQ1 Verra 精度驗證）

---

## 可存取頁面

- 主畫面：https://forest-carbon.duckdns.org/
- 量測結果（dashboard）：https://forest-carbon.duckdns.org/dashboard.html
- 評估與演進旅程（showcase）：https://forest-carbon.duckdns.org/showcase.html
- SOP：https://forest-carbon.duckdns.org/sop.html
- 永續故事集：https://forest-carbon.duckdns.org/stories.html
- 個別故事：https://forest-carbon.duckdns.org/story.html?id=<treeId>
- 區塊鏈瀏覽器：https://forest-carbon.duckdns.org/explorer/
- 交易 ABI 解碼頁：https://forest-carbon.duckdns.org/tx.html?hash=\<txHash\>

---

## 下一步（待確認方向）

- **區塊鏈連結改向（待確認）**：dashboard.html 的交易連結改為指向 `/tx.html?hash=<hash>`，使用者就能直接看到 ABI 解碼結果，不必再手動貼網址。需使用者確認是否要改。
- **§43**：前端 API 欄位存取統一化（treeHelpers.js 共用 helper）
- **§44**：論文討論章節新增 H-D 方程式方法論限制段落
- **§30.5**：paper 章節更新，明示「對 manual ground truth」與「自比」兩種數字
- **§35.3–35.5**：Path A OpenCV 兩階段重構部署
- **RO2/RO3 定案**：UTAUT vs D&M 問卷模型選擇待確認

---

## 給接手 Claude 的提醒

- Expedition source 在 `/home/yuchi/expedition/`，node_modules 已清除（build 完不需要）；若要重 build：`npm install && PUBLIC_URL=/explorer/ NODE_OPTIONS=--openssl-legacy-provider REACT_APP_ETH_RPC_URL=https://forest-carbon.duckdns.org/rpc npm run build`
- VM 上有 chromium 和 `/tmp/node_modules/puppeteer-core` 可做無頭瀏覽器測試
- nginx sites-enabled/forest-carbon 是普通檔案（非 symlink）
- dashboard.html 是生產版（量測結果）；dashboard02.html 已不存在（2026-06-07 確認）
- 故事 markdown 已在 DB 中直接修正，若重新生成故事會覆蓋修正結果
- 修 index.js 後記得 PM2 重啟：pm2 restart forest-carbon
- **VM 生產檔案修改：必須先 SCP 從 VM 拉下來，修完再推回去，絕不用本機 staging 舊版覆蓋**
- VM External IP：35.227.93.38，SSH user：yuchi