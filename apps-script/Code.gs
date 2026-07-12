/**
 * 怪獸小窩 — Google Sheets 同步 + Gmail 收據解析
 * 使用方式見專案根目錄的 SETUP_SYNC.md
 *
 * 這個檔案要貼到「綁定 Google Sheet」的 Apps Script 專案裡
 * （在試算表中：擴充功能 → Apps Script）
 */

/* ======== 設定區（只需要改這裡） ======== */

// 通關密語：改成一串只有你知道的亂碼，App 設定頁要填一樣的
const TOKEN = '改成你自己的密語';

const TZ = 'Asia/Taipei';
const LABEL_TODO = '記帳待處理'; // Gmail 篩選器把收據信貼上這個標籤
const LABEL_DONE = '記帳已處理'; // 解析完會改貼這個標籤

// 收據信解析規則：match 比對寄件者+主旨，命中就用該商家名稱與預設分類
// 分類 id 對照 App：fun 娛樂 / gacha 課金儲值 / utils 水電網路 / shopping 購物
// rent 房租 / meals 三餐 / transport 交通 / social 聚餐社交 / saving 儲蓄...
const PARSERS = [
  // ── 已確認的定期扣款（2026-07 掃描信箱結果）──
  { match: /定期定額/, merchant: '凱基定期定額', cat: 'invest' },        // 凱基證券台股定期定額扣款通知（Hotmail 轉寄過來）
  { match: /apple|itunes/i, merchant: 'iCloud+', cat: 'utils' },        // Apple 每月 7 號 NT$90（iCloud+ 200GB）
  { match: /anthropic/i, merchant: 'Claude', cat: 'books' },            // Anthropic 每月 30 號

  // ── 預備規則：目前信箱收不到，之後開通/轉寄進來就會自動生效 ──
  { match: /netflix/i, merchant: 'Netflix', cat: 'fun' },               // 注意：Netflix 目前直接刷永豐卡、不寄收據信
  { match: /disney/i, merchant: 'Disney+', cat: 'fun' },
  { match: /microsoft/i, merchant: 'Microsoft 365', cat: 'books' },     // 年繳，約每年 11/29（寄到 Hotmail）
  { match: /spotify/i, merchant: 'Spotify', cat: 'fun' },
  { match: /google play/i, merchant: 'Google Play', cat: 'gacha' },
  { match: /youtube/i, merchant: 'YouTube Premium', cat: 'fun' },
  { match: /iRent|himaas/i, merchant: 'iRent', cat: 'transport' },
  { match: /中華電信|遠傳|台灣大哥大|台灣之星/, merchant: '電信費', cat: 'utils' },
  { match: /台灣電力|台水|自來水/, merchant: '水電費', cat: 'utils' }
  // 想加新的訂閱，照上面格式多加一行就好
];

/* ======== 以下不用改 ======== */

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function txSheet() {
  const sh = sheet('tx', ['id', 'ts', 'amount', 'catId', 'note', 'source', 'deleted', 'payId', 'kind', 'fromPay', 'toPay']);
  // 舊版試算表欄位較少，自動補上新欄位標題
  var heads = ['id', 'ts', 'amount', 'catId', 'note', 'source', 'deleted', 'payId', 'kind', 'fromPay', 'toPay'];
  for (var c = 0; c < heads.length; c++) {
    if (sh.getRange(1, c + 1).getValue() !== heads[c]) sh.getRange(1, c + 1).setValue(heads[c]);
  }
  return sh;
}

function pendingSheet() {
  return sheet('pending', ['id', 'date', 'amount', 'cat', 'merchant', 'subject', 'status']);
}

function doGet() {
  return out({ ok: true, msg: 'pet-ledger sync alive' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'bad-json' });
  }
  if (body.token !== TOKEN) return out({ ok: false, error: 'bad-token' });
  if (body.action === 'sync') return out(sync(body));
  return out({ ok: false, error: 'bad-action' });
}

function sync(body) {
  const sh = txSheet();
  const data = sh.getDataRange().getValues();
  const rowById = {};
  for (let i = 1; i < data.length; i++) rowById[String(data[i][0])] = i + 1;

  // 上行：新增本機帳目（已存在的跳過，避免覆蓋雲端狀態）
  const appends = [];
  (body.txs || []).forEach(function (t) {
    if (!rowById[String(t.id)]) {
      appends.push([String(t.id), Number(t.ts), Number(t.amount), String(t.catId || ''), String(t.note || ''), String(t.source || 'manual'), '', String(t.payId || ''), String(t.kind || 'expense'), String(t.fromPay || ''), String(t.toPay || '')]);
    }
  });
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, 11).setValues(appends);
    const fresh = sh.getDataRange().getValues();
    for (let i = 1; i < fresh.length; i++) rowById[String(fresh[i][0])] = i + 1;
  }

  // 刪除（軟刪除，打上 deleted 標記）
  (body.tombstones || []).forEach(function (id) {
    if (rowById[String(id)]) sh.getRange(rowById[String(id)], 7).setValue(1);
  });

  // 待確認扣款的處理結果
  const ps = pendingSheet();
  const pdata = ps.getDataRange().getValues();
  const pRowById = {};
  for (let i = 1; i < pdata.length; i++) pRowById[String(pdata[i][0])] = i + 1;
  (body.pendingResolved || []).forEach(function (r) {
    if (pRowById[String(r.id)]) ps.getRange(pRowById[String(r.id)], 7).setValue(String(r.status));
  });

  // 下行：回傳雲端完整帳目 + 未處理的待確認扣款
  const all = sh.getDataRange().getValues();
  const txs = [];
  const deletedIds = [];
  for (let i = 1; i < all.length; i++) {
    const r = all[i];
    if (r[6]) deletedIds.push(String(r[0]));
    else txs.push({ id: String(r[0]), ts: Number(r[1]), amount: Number(r[2]), catId: String(r[3] || ''), note: String(r[4] || ''), source: String(r[5] || 'manual'), payId: String(r[7] || ''), kind: String(r[8] || 'expense'), fromPay: String(r[9] || ''), toPay: String(r[10] || '') });
  }
  const pall = ps.getDataRange().getValues();
  const pending = [];
  for (let i = 1; i < pall.length; i++) {
    const r = pall[i];
    if (String(r[6]) === 'new') {
      pending.push({ id: String(r[0]), date: String(r[1]), amount: Number(r[2]), cat: String(r[3]), merchant: String(r[4]), subject: String(r[5]) });
    }
  }
  return { ok: true, txs: txs, deletedIds: deletedIds, pending: pending };
}

/* ======== Gmail 收據掃描（設定時間觸發器每小時跑一次） ======== */

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function scanReceipts() {
  const todo = getOrCreateLabel(LABEL_TODO);
  const done = getOrCreateLabel(LABEL_DONE);
  const ps = pendingSheet();
  const existing = {};
  ps.getDataRange().getValues().slice(1).forEach(function (r) { existing[String(r[0])] = true; });

  const threads = todo.getThreads(0, 50);
  threads.forEach(function (th) {
    th.getMessages().forEach(function (msg) {
      const id = msg.getId();
      if (existing[id]) return;
      const from = msg.getFrom();
      const subject = msg.getSubject() || '';
      const text = (subject + '\n' + msg.getPlainBody()).slice(0, 5000);

      // 金額：抓 NT$ / NTD / TWD / 新台幣 / 金額: / $ 後面的數字
      const m = text.match(/(?:NT\$|NTD|TWD|新台幣|金額[:：]?\s*|US\$|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
      if (!m) return;
      const amount = Number(m[1].replace(/,/g, ''));
      if (!amount) return;

      let merchant = from.replace(/<.*>/, '').replace(/"/g, '').trim();
      let cat = 'shopping';
      for (let i = 0; i < PARSERS.length; i++) {
        if (PARSERS[i].match.test(from) || PARSERS[i].match.test(subject)) {
          merchant = PARSERS[i].merchant;
          cat = PARSERS[i].cat;
          break;
        }
      }
      ps.appendRow([id, Utilities.formatDate(msg.getDate(), TZ, "yyyy-MM-dd'T'HH:mm:ss"), amount, cat, merchant, subject.slice(0, 80), 'new']);
      existing[id] = true;
    });
    th.removeLabel(todo);
    th.addLabel(done);
  });
}

/* 手動測試用：在編輯器裡選這個函式按「執行」，看 pending 分頁有沒有長出資料 */
function testScan() {
  scanReceipts();
}
