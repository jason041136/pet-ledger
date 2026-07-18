# 怪獸小窩（pet-ledger）— 專案指南

台灣使用者 Jason 的自用寵物養成記帳 PWA。**新對話接手前先讀完這份**。

## 一句話架構

零後端零成本：純前端 PWA（vanilla JS ES modules，無框架無建置）＋ 本機 IndexedDB ＋ Google Apps Script/Sheets 雲端同步 ＋ GitHub Pages 部署。

- **線上網址**：https://jason041136.github.io/pet-ledger/（repo: github.com/jason041136/pet-ledger，公開）
- **本機開發**：`python -m http.server 8642 --directory pet-ledger`（.claude/launch.json 已設好 `pet-ledger`）

## 鐵則（違反會出事）

1. **每次改動任何檔案，必須把 `sw.js` 第一行 `CACHE = 'pet-ledger-vNN'` 版號 +1**，否則已安裝的手機拿不到新版
2. **公開 repo：絕不能 commit 任何密碼/token/同步網址**。使用者的 Apps Script TOKEN 與 Web App URL 只存在他的裝置 IndexedDB 和他的 Google 帳號
3. 測試時預覽瀏覽器的 IndexedDB 是獨立沙盒，放心塞測試資料；**使用者真實資料在他自己的瀏覽器**，別碰
4. 改 `apps-script/Code.gs` 後，需要到使用者的 Apps Script 重新部署「新版本」才生效（流程見下）
5. 部署流程：`git add -A && git commit && git push origin main` → GitHub Pages 自動重建（1-2 分鐘）

## 檔案地圖

| 檔案 | 內容 |
|---|---|
| `js/app.js` | 主程式：五個分頁（entry 記帳三步驟 / home 小窩 / ledger 帳本 / assets 資產 / settings）、事件全部 delegation 在 `#view` click、boot 含一次性遷移（kv 旗標：catsV2/coffeeFix/mealsV3/acctV4/acctV5） |
| `js/data.js` | 五隻怪獸 PETS（含 SVG 後備）、支出分類 DEFAULT_CATS＋live CATS、收入分類 INCOME_CATS、帳戶 DEFAULT_PAYMENTS、台新 RICHART_PLANS/CAT_PLAN、金幣 COIN/COSTUMES/ACHIEVEMENTS |
| `js/engine.js` | 純函式：txKind(expense/income/transfer)、accountBalances（起始餘額+交易即時計算）、netWorth/assetTotal/cardDebtTotal、petTotals、streak、recommendPlan（台新方案推薦）、postDue（定期開支）、台詞 feedLine/idleLine |
| `js/db.js` | IndexedDB v4：stores tx / recurring / cats / inccats / payments / kv |
| `js/sync.js` | 與 Apps Script 同步：push 全部 txs＋updates（dirtyTx 編輯過的）＋tombstones（刪除）→ pull 覆蓋，含舊欄位保留防呆 |
| `apps-script/Code.gs` | 使用者貼在他 Google Sheet 綁定的 Apps Script：sync API（tx 11 欄）＋ Gmail 收據掃描 PARSERS |
| `css/app.css` | 果凍玩具風：粉圓體 Huninn＋Fredoka 數字、暖奶油/可可雙主題、浮動膠囊 tabbar |
| `img/pets/` | AI 立繪 `{petId}_{state}.png`（pulu/momo/jin/zhuan/jo × idle/happy/fat/sad），缺圖自動 fallback SVG。缺 3 張：pulu_sad、jin_fat、jin_sad |
| `art/` | STYLE.md 美術憲章、gen_pets.py 程式繪圖、process_art.py 生圖後處理（去背/裁方/命名） |
| `ART_GUIDE.md` | AI 生圖 prompt 包 |

## 資料模型速記

- **tx**：`{id, kind:'expense'|'income'|'transfer', amount, catId, note, ts, source:'manual'|'recurring'|'email'|'topup', payId, fromPay, toPay}`（舊資料無 kind＝expense）
- **payments（帳戶）**：`{id, name, emo, type:'cash'|'bank'|'easycard'|'invest'|'card', tracked, initBalance, order}`。信用卡負餘額＝待繳；淨資產＝資產−卡債。餘額永遠即時計算不累加存
- **kv 重要鍵**：syncUrl/syncToken/lastSync、pending/pendingResolved（email 待確認）、tombstones/dirtyTx（同步刪除/編輯）、budgets{total,pets{}}、coins/owned/equipped/achieved/lastCoinDay、pinHash（SHA-256 密碼鎖）、userName、theme、lastPay
- **怪獸系統**：分類掛 pet → 支出餵怪獸；體型=當月佔比；狀態 fat(≥35%)/happy(今天餵過)/sad(>7天)/idle；收入/轉帳不影響怪獸

## 使用者背景（做決策要考慮）

- iPhone（Apple Pay）、卡：台新 Richart（七大權益每日可切，推薦引擎在用）＋永豐 DAWHO（國內1%）、悠遊卡、凱基定期定額 0050 每月8號1萬
- Gmail=jason041136、Hotmail=jason200081（轉寄規則：主旨含「定期定額」→Gmail）
- email 自動記帳管線已運作：Gmail 標籤「記帳待處理」→ Apps Script 每時掃描 → pending → App 待確認
- TOKEN 仍是預設「改成你自己的密語」（等於公開），保護靠祕密的 Web App URL；建議日後換掉

## 常用工作流

**驗證改動**：preview_start `pet-ledger` → 用 javascript_tool 清 SW+caches+`fetch(f,{cache:'reload'})` 再 reload（GitHub Pages/http.server 快取很黏）→ 用 JS 斷言功能 → read_console_messages 確認零錯誤。（截圖工具常 timeout，別依賴）

**部署 Code.gs 到使用者的 Apps Script**（用 claude-in-chrome 他已登入的 Chrome）：
1. script.google.com → 開啟專案（id `1T_7Fka7Piv3om0HD_5FYwDRZCSmOQVP4jsFhSAHXiDCylqojzTrwzS90`）
2. javascript_tool：`monaco.editor.getModels()[0].setValue(內容)`（用 base64 傳避免跳脫；**先讀出現有 TOKEN 保留**）
3. Ctrl+S → 部署→管理部署作業→✎→版本「建立新版本」→部署（網址不變）
4. 驗證：fetch POST `{token,action:'sync',txs:[]}` 回 `ok:true`

**已知坑**：curl 對 GAS 轉址會 411（用瀏覽器 fetch 測）；Outlook 網頁版打字會被草稿搶焦點；GH Pages 需輪詢 build 完才驗證。

## 未來藍圖（使用者已認可的方向）

1. **載具**：使用者申請財政部電子發票 AppID 中 → 到手後在 Code.gs 加 carrierInvChk/carrierInvDetail 拉手機條碼載具發票明細（驗證碼存 Apps Script 不進 repo）；備案＝掃發票 QR
2. **家具佈置小窩**：依分類記帳量解鎖對應風格家具（金金→金碧輝煌…風格再議：包豪斯/日雜感）
3. **輕社交**：匿名排行榜、好友互看怪獸（不露金額）→ 驗證需求後才考慮廣場即時聊天（需真後端+帳號+審核）
4. 裝扮內購變現（遠期）

## 記憶同步

改動後記得更新 `C:\Users\USER\.claude\projects\C--Users-USER-Desktop-claude\memory\pet-expense-app.md`（跨對話記憶）。
