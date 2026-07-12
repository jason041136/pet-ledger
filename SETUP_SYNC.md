# 雲端同步 + Email 自動記帳 設定教學

跟著做一次約 15 分鐘，之後就是全自動。全部免費。

## 架構

```
Hotmail ──(轉寄規則)──→ Gmail ──(篩選器貼標籤)──→ Apps Script 每小時掃描解析
                                                        ↓ 寫入
手機 App ←──(同步：上傳帳目、下載待確認扣款)──→ Google Sheet（你的雲端帳本）
```

## 第一步：建立 Google Sheet + 貼上程式

1. 到 [sheets.new](https://sheets.new) 建一個新試算表，取名「怪獸小窩帳本」
2. 上方選單 **擴充功能 → Apps Script**
3. 把專案裡 `apps-script/Code.gs` 的內容全部貼上（取代原本的空白程式）
4. 把第一個設定 `TOKEN = '改成你自己的密語'` 改成一串只有你知道的亂碼（例如 `wombat-taco-9527`）
5. 存檔（Ctrl+S）

## 第二步：部署成 Web App

1. 右上角 **部署 → 新增部署作業**
2. 齒輪選 **網頁應用程式**
3. 「執行身分」選 **我**；「誰可以存取」選 **所有人**（別擔心，有 TOKEN 擋著，而且網址本身就是一長串亂碼）
4. 按部署 → 第一次會要求授權，一路允許
5. **複製 Web App 網址**（`https://script.google.com/macros/s/…/exec`）

## 第三步：App 端設定

1. 打開怪獸小窩 → **設定 → 雲端同步**
2. 貼上 Web App 網址、填入你的 TOKEN → **儲存設定** → **立即同步**
3. 看到「同步完成」就成功了。去 Google Sheet 看，`tx` 分頁會出現你的所有帳目

> 之後每次打開 App 都會自動同步。換手機時：新手機設定同一組網址+TOKEN，同步一次資料就全回來了。

## 第四步：Gmail 自動抓收據信

1. Gmail 建立標籤：`記帳待處理`
2. 建立篩選器（Gmail 搜尋列右邊的篩選圖示）——依 2026-07 信箱掃描結果，這條就夠：
   - 條件（寄件者）：`from:(no_reply@email.apple.com OR anthropic.com)`
   - 再建一條接 Hotmail 轉寄來的：條件（主旨）：`subject:(定期定額 OR "Microsoft 365" OR Netflix OR Disney)`
   - 動作：套用標籤「記帳待處理」、略過收件匣（可選）
3. 回到 Apps Script 編輯器：
   - 左側鬧鐘圖示（觸發條件）→ **新增觸發條件**
   - 函式選 `scanReceipts`、事件來源選「時間驅動」、每小時一次
   - 儲存時會再要求 Gmail 授權，允許
4. 測試：隨便找一封過去的訂閱收據信，手動貼上「記帳待處理」標籤 → 回編輯器手動執行 `testScan` → Sheet 的 `pending` 分頁應該長出一列 → App 同步後，記帳頁上方會出現「待確認扣款」，按入帳完成！

## 第五步：Hotmail 匯流

1. 到 [outlook.com 設定 → 郵件 → 規則](https://outlook.live.com/mail/0/options/mail/rules)
2. 新增規則（依 2026-07 信箱掃描結果，先設這兩條）：
   - 規則一：條件「主旨包含 `定期定額`」→ 動作「轉寄給」你的 Gmail（凱基證券扣款通知）
   - 規則二：條件「寄件者包含 `microsoft.com`」且主旨含 `Microsoft 365` → 轉寄 Gmail（年繳續約，約每年 11 月底）
   - （之後若重新訂閱 Disney+／Netflix 改寄到 Hotmail，再各加一條轉寄）
3. Outlook 會先寄一封驗證信到 Gmail，要點裡面的確認連結轉寄才會生效
4. 之後 Hotmail 的收據信會流進 Gmail，被同一條篩選器接住，不用寫第二套

## 新增訂閱服務的解析規則

`Code.gs` 最上面的 `PARSERS` 加一行即可，例如：

```js
{ match: /disney/i, merchant: 'Disney+', cat: 'fun' },
```

改完存檔就生效（不用重新部署觸發器；但如果改了 doPost 相關邏輯要「部署 → 管理部署作業 → 編輯 → 新版本」）。

## 常見問題

- **同步失敗**：檢查網址是不是 `/exec` 結尾、TOKEN 兩邊一致、Web App 存取權是「所有人」
- **改了 Code.gs 沒生效**：Web App 要發新版本（管理部署作業 → 鉛筆 → 版本選「新版本」→ 部署）
- **金額抓錯**：`scanReceipts` 抓的是信裡第一個金額，若某服務格式特殊，在 PARSERS 幫它寫專屬規則即可
