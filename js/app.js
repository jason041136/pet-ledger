import * as store from './db.js';
import { PETS, CATS, DEFAULT_CATS, DEFAULT_PAYMENTS, INCOME_CATS, incomeCatById, ACCOUNT_TYPES, COIN, COSTUMES, costumeById, ACHIEVEMENTS, isCard, isAsset, setCats, petById, catById } from './data.js';
import { fmt, dateStr, monthTxs, petTotals, spendTotal, incomeTotal, isSpend, isIncome, isTransfer, txKind, accountBalances, netWorth, assetTotal, cardDebtTotal, recommendPlan, catCount, daysSinceFed, streak, feedLine, idleLine, initNextDue, postDue } from './engine.js';
import { doSync } from './sync.js';

let txs = [];
let recurring = [];
let cats = [];
let payments = [];
let balances = {};
let selectedPay = 'cash';
let pending = [];
let syncCfg = { url: '', token: '', last: 0 };
let theme = 'auto';
let userName = '';
let budgets = { total: 0, pets: {} };
let hasPin = false;
let coins = 0;
let owned = [];
let equipped = {};
let achieved = [];
let homeSub = null;   // null | 'shop' | 'achievements'
let shopPet = 'pulu';
let editingCat = null;
let tab = 'entry';
let entryKind = 'expense'; // expense | income | transfer
let amount = '';
let noteVal = '';
let entryStep = 1;
let transferFrom = null;
let ledgerDate = new Date();
let ledgerMode = 'list';
let ledgerSearch = '';
let ledgerSelDay = null;
let statsPeriod = 'month';   // month | year

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');
let toastTimer;

function showToast(text, color) {
  toastEl.textContent = text;
  toastEl.style.borderLeftColor = color || 'var(--accent)';
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400);
}

function applyTheme(t) {
  theme = t;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pet-ledger:' + s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function showLockScreen() {
  return new Promise((resolve) => {
    let entered = '';
    const draw = (err) => {
      view.innerHTML = `
        <div class="lock-wrap">
          <div class="lock-emo">🔒</div>
          <div class="lock-title">${userName ? userName + ' 的' : ''}怪獸小窩</div>
          <div class="lock-sub ${err ? 'err' : ''}">${err || '輸入 4 位數 PIN'}</div>
          <div class="lock-dots">${[0, 1, 2, 3].map((i) => `<i class="${i < entered.length ? 'on' : ''}"></i>`).join('')}</div>
          <div class="lock-pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-pin="${n}">${n}</button>`).join('')}
            <span></span>
            <button data-pin="0">0</button>
            <button data-pin="del" class="fn">⌫</button>
          </div>
        </div>`;
    };
    tabbar.style.display = 'none';
    draw();
    const handler = async (e) => {
      const b = e.target.closest('[data-pin]');
      if (!b) return;
      const k = b.dataset.pin;
      if (k === 'del') entered = entered.slice(0, -1);
      else if (entered.length < 4) entered += k;
      draw();
      if (entered.length === 4) {
        const ok = (await sha256(entered)) === (await store.getKV('pinHash'));
        if (ok) {
          view.removeEventListener('click', handler);
          tabbar.style.display = '';
          resolve();
        } else {
          entered = '';
          if (navigator.vibrate) navigator.vibrate(200);
          draw('PIN 不對，再試一次');
        }
      }
    };
    view.addEventListener('click', handler);
  });
}

async function reload() {
  txs = await store.getAll('tx');
  recurring = await store.getAll('recurring');
  cats = (await store.getAll('cats')).sort((a, b) => (a.order || 0) - (b.order || 0));
  setCats(cats);
  txs.sort((a, b) => b.ts - a.ts);
  payments = (await store.getAll('payments')).sort((a, b) => (a.order || 0) - (b.order || 0));
  balances = accountBalances(payments, txs);
  const lastPay = await store.getKV('lastPay');
  if (lastPay && payments.some((p) => p.id === lastPay)) selectedPay = lastPay;
  pending = (await store.getKV('pending')) || [];
  syncCfg = {
    url: (await store.getKV('syncUrl')) || '',
    token: (await store.getKV('syncToken')) || '',
    last: (await store.getKV('lastSync')) || 0
  };
  userName = (await store.getKV('userName')) || '';
  budgets = (await store.getKV('budgets')) || { total: 0, pets: {} };
  if (!budgets.pets) budgets.pets = {};
  hasPin = !!(await store.getKV('pinHash'));
  coins = (await store.getKV('coins')) || 0;
  owned = (await store.getKV('owned')) || [];
  equipped = (await store.getKV('equipped')) || {};
  achieved = (await store.getKV('achieved')) || [];
}

/* ================= entry ================= */

function catTile(c) {
  const p = petById(c.pet);
  return `<button class="cat-tile" data-cat="${c.id}" style="border-color:${p.color}66;background:${p.color}14">
    <span class="ce">${c.emo}</span><span class="cn">${c.name}</span></button>`;
}

function favCatIds() {
  const cutoff = Date.now() - 60 * 86400000;
  const nowH = new Date().getHours();
  const counts = {};
  for (const t of txs) {
    if (t.ts > cutoff && t.source !== 'topup' && t.catId) {
      // 時間感知：同時段（±2 小時）記過的分類權重 ×3，中午打開自然浮出午餐
      const h = new Date(t.ts).getHours();
      const diff = Math.abs(h - nowH);
      const near = diff <= 2 || diff >= 22;
      counts[t.catId] = (counts[t.catId] || 0) + (near ? 3 : 1);
    }
  }
  return Object.keys(counts)
    .filter((id) => cats.some((c) => c.id === id))
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 6);
}

function stepDots(n) {
  return `<div class="step-dots">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
}

const KIND_META = {
  expense: { color: 'var(--accent)', step2: '用什麼付？', next: '下一步：選支付方式　›' },
  income: { color: '#3B9A6E', step2: '存進哪個帳戶？', next: '下一步：選帳戶　›' },
  transfer: { color: '#4A86C5', step2: '從哪個帳戶轉出？', next: '下一步：轉出帳戶　›' }
};

function acctCard(p, selId, extra) {
  let bal;
  if (isCard(p)) {
    const due = Math.max(0, -(balances[p.id] || 0));
    bal = `<span class="pb ${due > 0 ? 'due' : ''}">${due > 0 ? '待繳 ' + fmt(due) : '已繳清'}</span>`;
  } else {
    bal = `<span class="pb">${fmt(balances[p.id] || 0)}</span>`;
  }
  return `<button class="pay-card ${p.id === selId ? 'on' : ''}" ${extra}="${p.id}">
    <span class="pe">${p.emo}</span><span class="pn">${p.name}</span>${bal}</button>`;
}

function renderEntry() {
  if (entryStep === 1) renderStep1();
  else if (entryStep === 2) renderStep2();
  else renderStep3();
}

function renderStep1() {
  const pendHtml = (entryKind === 'expense' && pending.length) ? `
    <div class="card">
      <div class="sub">📬 偵測到 ${pending.length} 筆扣款通知，確認後入帳：</div>
      ${pending.map((p) => {
        const opts = cats.map((c) => `<option value="${c.id}" ${c.id === p.cat ? 'selected' : ''}>${c.emo} ${c.name}</option>`).join('');
        return `<div class="rec-row" style="border-bottom:none;padding-bottom:2px">
          <div class="mid">
            <div class="name">${p.merchant} · ${fmt(p.amount)}</div>
            <div class="info">${(p.date || '').slice(0, 10)}　${p.subject || ''}</div>
          </div></div>
        <div class="pend-ctl">
          <select id="pcat-${p.id}">${opts}</select>
          <button class="chip" data-pend-ok="${p.id}">入帳</button>
          <button class="chip" data-pend-no="${p.id}">忽略</button>
        </div>`;
      }).join('')}
    </div>` : '';

  view.innerHTML = `
    ${pendHtml}
    <div class="kind-toggle">
      <button class="${entryKind === 'expense' ? 'on' : ''}" data-kind="expense">支出</button>
      <button class="${entryKind === 'income' ? 'on inc' : ''}" data-kind="income">收入</button>
      <button class="${entryKind === 'transfer' ? 'on tr' : ''}" data-kind="transfer">轉帳</button>
    </div>
    ${stepDots(1)}
    <div class="amount-box">
      <div><span class="cur">NT$</span><span class="num zero" id="amt">0</span></div>
      <div class="amt-expr" id="amt-expr"></div>
    </div>
    <input class="note-input" id="note" placeholder="備註（選填）" autocomplete="off" value="${noteVal.replace(/"/g, '&quot;')}">
    <div class="op-row">
      ${['+', '−', '×', '÷'].map((o) => `<button data-op="${o}">${o}</button>`).join('')}
    </div>
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
      <button data-key="C" class="fn">C</button>
      <button data-key="0">0</button>
      <button data-key="B" class="fn">⌫</button>
    </div>
    <button class="btn next-btn" data-act="next-step" style="background:${entryKind === 'expense' ? '' : KIND_META[entryKind].color}">${KIND_META[entryKind].next}</button>`;
  if (entryKind !== 'expense') {
    view.querySelector('.next-btn').style.boxShadow = 'none';
  }
  updateAmt();
}

function renderStep2() {
  // 支出：全部帳戶；收入：只能存進資產；轉帳轉出：只能從資產（排除信用卡）
  const list = entryKind === 'expense' ? payments : payments.filter(isAsset);
  const selId = entryKind === 'transfer' ? transferFrom : selectedPay;
  const attr = entryKind === 'transfer' ? 'data-from' : (entryKind === 'income' ? 'data-acct' : 'data-pay');
  const cards = list.map((p) => acctCard(p, selId, attr)).join('');

  view.innerHTML = `
    ${stepDots(2)}
    <div class="step-head">
      <button class="step-back" data-act="back-step" data-to="1">‹</button>
      <div>
        <div class="step-amt">${entryKind === 'income' ? '+ ' : ''}NT$ ${Number(amount).toLocaleString('zh-TW')}</div>
        <div class="step-sub">${KIND_META[entryKind].step2}</div>
      </div>
    </div>
    <div class="pay-grid">${cards}</div>`;
}

function renderStep3() {
  if (entryKind === 'income') return renderIncomeCats();
  if (entryKind === 'transfer') return renderTransferTo();
  // 支出：選分類
  const pay = payments.find((p) => p.id === selectedPay);
  const favIds = favCatIds();
  const favHtml = favIds.length
    ? `<div class="cat-group"><div class="pet-tag">⭐ 常用</div><div class="cat-grid">${favIds.map((id) => catTile(catById(id))).join('')}</div></div>`
    : '';
  const groups = PETS.map((p) => {
    const tiles = cats.filter((c) => c.pet === p.id).map(catTile).join('');
    if (!tiles) return '';
    return `<div class="cat-group">
      <div class="pet-tag"><span class="dot" style="background:${p.color}"></span>餵 ${p.name}（${p.title}）</div>
      <div class="cat-grid">${tiles}</div></div>`;
  }).join('');

  view.innerHTML = `
    ${stepDots(3)}
    <div class="step-head">
      <button class="step-back" data-act="back-step" data-to="2">‹</button>
      <div>
        <div class="step-amt">NT$ ${Number(amount).toLocaleString('zh-TW')} <span class="step-pay">${pay ? pay.emo + ' ' + pay.name : ''}</span></div>
        <div class="step-sub">花在哪？點一下就記好</div>
      </div>
    </div>
    <input class="note-input" id="cat-search" placeholder="🔍 搜尋分類…" autocomplete="off">
    <div class="cat-groups">${favHtml}${groups}</div>`;

  document.getElementById('cat-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    view.querySelectorAll('.cat-group').forEach((g) => {
      let any = false;
      g.querySelectorAll('.cat-tile').forEach((ch) => {
        const show = !q || ch.textContent.includes(q);
        ch.style.display = show ? '' : 'none';
        if (show) any = true;
      });
      g.style.display = any ? '' : 'none';
    });
  });
}

function renderIncomeCats() {
  const acct = payments.find((p) => p.id === selectedPay);
  const tiles = INCOME_CATS.map((c) =>
    `<button class="cat-tile" data-inccat="${c.id}" style="border-color:#3B9A6E55;background:#3B9A6E12">
      <span class="ce">${c.emo}</span><span class="cn">${c.name}</span></button>`).join('');
  view.innerHTML = `
    ${stepDots(3)}
    <div class="step-head">
      <button class="step-back" data-act="back-step" data-to="2">‹</button>
      <div>
        <div class="step-amt" style="color:#3B9A6E">+ NT$ ${Number(amount).toLocaleString('zh-TW')} <span class="step-pay">→ ${acct ? acct.emo + ' ' + acct.name : ''}</span></div>
        <div class="step-sub">這筆錢從哪來？</div>
      </div>
    </div>
    <div class="cat-groups"><div class="cat-group"><div class="cat-grid">${tiles}</div></div></div>`;
}

function renderTransferTo() {
  const from = payments.find((p) => p.id === transferFrom);
  // 轉入可以是資產或信用卡（還卡費）
  const list = payments.filter((p) => p.tracked && p.id !== transferFrom);
  const cards = list.map((p) => acctCard(p, null, 'data-toacct')).join('');
  view.innerHTML = `
    ${stepDots(3)}
    <div class="step-head">
      <button class="step-back" data-act="back-step" data-to="2">‹</button>
      <div>
        <div class="step-amt" style="color:#4A86C5">NT$ ${Number(amount).toLocaleString('zh-TW')} <span class="step-pay">${from ? from.emo + ' ' + from.name + ' →' : ''}</span></div>
        <div class="step-sub">轉到哪個帳戶？</div>
      </div>
    </div>
    <div class="pay-grid">${cards}</div>`;
}

function evalExpr(s) {
  if (!s) return 0;
  let e = String(s).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  e = e.replace(/[+\-*/.]+$/, '');   // 去掉結尾懸空的運算子
  if (!e) return 0;
  if (!/^[0-9+\-*/.]+$/.test(e)) return NaN;
  try {
    const v = Function('"use strict";return(' + e + ')')();
    return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  } catch { return NaN; }
}

function updateAmt() {
  const el = document.getElementById('amt');
  if (!el) return;
  const hasOp = /[+\-×÷]/.test(amount);
  const val = evalExpr(amount);
  el.textContent = amount ? (isNaN(val) ? '…' : Number(val).toLocaleString('zh-TW')) : '0';
  el.classList.toggle('zero', !amount);
  const ex = document.getElementById('amt-expr');
  if (ex) ex.textContent = hasOp ? amount : '';
}

function pressKey(k) {
  if (k === 'C') amount = '';
  else if (k === 'B') amount = amount.slice(0, -1);
  else if (amount.length < 30 && !(amount === '' && k === '0')) amount += k;
  updateAmt();
}

function pressOp(op) {
  if (!amount) return;                       // 不能以運算子開頭
  if (/[+\-×÷]$/.test(amount)) amount = amount.slice(0, -1) + op;  // 換掉結尾運算子
  else amount += op;
  updateAmt();
}

function resetEntry() {
  amount = '';
  noteVal = '';
  entryStep = 1;
  transferFrom = null;
  renderEntry();
}

async function saveTx(catId) {
  const amt = Number(amount);
  const cat = catById(catId);
  const pet = petById(cat.pet);
  if (!amt) {
    showToast(`${pet.name}：先輸入金額，再決定餵我多少啦！`, pet.color);
    return;
  }
  await store.put('tx', { id: store.uid(), kind: 'expense', amount: amt, catId, note: noteVal.trim(), ts: Date.now(), source: 'manual', payId: selectedPay });
  await reload();
  let balWarn = '';
  const pay = payments.find((p) => p.id === selectedPay);
  if (pay && pay.type === 'easycard' && (balances[pay.id] || 0) < 100) {
    balWarn = `（悠遊卡只剩 ${fmt(balances[pay.id] || 0)}，該加值囉！）`;
  }
  const coinMsg = await awardRecordCoins();
  await checkAchievements();
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const line = feedLine(pet.id, { n: catCount(mt, catId), cat: cat.name, amt: fmt(amt) });
  resetEntry();
  showToast(`${pet.name}：${line}${balWarn}${coinMsg}`, pet.color);
}

async function saveIncome(incCatId) {
  const amt = Number(amount);
  if (!amt) return;
  const c = incomeCatById(incCatId);
  const acct = payments.find((p) => p.id === selectedPay);
  await store.put('tx', { id: store.uid(), kind: 'income', amount: amt, catId: incCatId, note: noteVal.trim(), ts: Date.now(), source: 'manual', payId: selectedPay });
  await reload();
  const coinMsg = await awardRecordCoins();
  await checkAchievements();
  resetEntry();
  showToast(`💰 金金：收入 ${c.emo}${c.name} ${fmt(amt)} 入庫 ${acct ? acct.name : ''}，甚好甚好！${coinMsg}`, '#EF9F27');
}

async function saveTransfer(toId) {
  const amt = Number(amount);
  if (!amt) return;
  const from = payments.find((p) => p.id === transferFrom);
  const to = payments.find((p) => p.id === toId);
  await store.put('tx', { id: store.uid(), kind: 'transfer', amount: amt, note: noteVal.trim(), ts: Date.now(), source: 'manual', fromPay: transferFrom, toPay: toId });
  await reload();
  resetEntry();
  showToast(`🔄 已轉帳 ${fmt(amt)}：${from ? from.name : ''} → ${to ? to.name : ''}`, '#4A86C5');
}

async function topupEasycard() {
  const easy = payments.find((p) => p.type === 'easycard');
  if (!easy) return;
  // 悠遊卡加值 = 從現金/銀行轉入悠遊卡
  amount = '';
  noteVal = '悠遊卡加值';
  entryKind = 'transfer';
  entryStep = 3;
  transferFrom = payments.find((p) => p.tracked && p.type !== 'easycard')?.id || 'cash';
  selectedPay = easy.id;
  const val = prompt('悠遊卡加值金額', '500');
  if (val === null) { resetEntry(); entryKind = 'expense'; return; }
  const amt = Number(val);
  if (!amt || amt <= 0) { resetEntry(); entryKind = 'expense'; showToast('金額不對喔'); return; }
  amount = String(amt);
  await saveTransfer(easy.id);
  entryKind = 'expense';
  renderEntry();
  showToast(`🔋 已加值 ${fmt(amt)}（提示：改用永豐 DAWHO 自動加值可多賺 +3%）`);
}

async function resolvePending(id, confirmed) {
  const p = pending.find((x) => x.id === id);
  if (!p) return;
  const catId = document.getElementById('pcat-' + id)?.value || p.cat;
  const resolved = (await store.getKV('pendingResolved')) || [];
  resolved.push({ id, status: confirmed ? 'confirmed' : 'ignored' });
  await store.setKV('pendingResolved', resolved);
  if (confirmed) {
    const ts = p.date ? new Date(p.date).getTime() : Date.now();
    await store.put('tx', { id: 'p_' + id, kind: 'expense', amount: Number(p.amount), catId, note: p.merchant, ts, source: 'email', payId: 'sinopac' });
  }
  pending = pending.filter((x) => x.id !== id);
  await store.setKV('pending', pending);
  await reload();
  renderEntry();
  if (confirmed) {
    const pet = petById(catById(catId).pet);
    showToast(`${pet.name}：收到 ${p.merchant} 的 ${fmt(p.amount)}，已入帳！`, pet.color);
  } else {
    showToast('已忽略這筆通知');
  }
}

/* ================= 金幣 / 成就 ================= */

async function earnCoins(n) {
  coins += n;
  await store.setKV('coins', coins);
}

// 手動記帳給幣：每筆 + 每日首筆登入獎勵。回傳提示字串
async function awardRecordCoins() {
  let gained = COIN.perRecord;
  const today = dateStr(new Date());
  const lastDay = await store.getKV('lastCoinDay');
  let bonus = false;
  if (lastDay !== today) {
    gained += COIN.dailyBonus;
    bonus = true;
    await store.setKV('lastCoinDay', today);
  }
  await earnCoins(gained);
  return bonus ? `　🪙+${gained}（含每日獎勵）` : `　🪙+${gained}`;
}

async function checkAchievements() {
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const monthSpend = spendTotal(mt);
  const stats = {
    txCount: txs.length,
    hasIncome: txs.some(isIncome),
    hasInitBalance: payments.some((p) => p.tracked && (p.initBalance || 0) !== 0),
    streak: streak(txs),
    petsThisMonth: new Set(mt.filter(isSpend).map((t) => catById(t.catId).pet)).size,
    underBudget: budgets.total > 0 && monthSpend <= budgets.total && monthSpend > 0,
    netWorth: netWorth(payments, txs),
    hasEquipped: Object.keys(equipped).length > 0
  };
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!achieved.includes(a.id) && a.check(stats)) {
      achieved.push(a.id);
      newly.push(a);
    }
  }
  if (newly.length) {
    const total = newly.reduce((s, a) => s + a.coin, 0);
    await store.setKV('achieved', achieved);
    await earnCoins(total);
    const names = newly.map((a) => a.name).join('、');
    setTimeout(() => showToast(`🏆 達成成就：${names}　🪙+${total}`, 'var(--gold)'), 1200);
  }
}

/* ================= home ================= */

function costumeOverlay(petId) {
  const cid = equipped[petId];
  if (!cid) return '';
  const c = costumeById(cid);
  return c ? `<span class="pet-hat">${c.emo}</span>` : '';
}

function renderHome() {
  if (homeSub === 'shop') return renderShop();
  if (homeSub === 'achievements') return renderAchievements();
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const totals = petTotals(mt);
  const monthTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  let king = null;
  for (const p of PETS) {
    if ((totals[p.id] || 0) > 0 && (!king || totals[p.id] > totals[king.id])) king = p;
  }
  const todayKey = dateStr(now);
  const petsHtml = PETS.map((p) => {
    const share = monthTotal ? (totals[p.id] || 0) / monthTotal : 0;
    const w = Math.round(44 + share * 190);
    const fedToday = mt.some((t) => isSpend(t) && dateStr(new Date(t.ts)) === todayKey && catById(t.catId).pet === p.id);
    const days = daysSinceFed(txs, p.id);
    const state = share >= 0.35 ? 'fat' : fedToday ? 'happy' : (days !== null && days > 7) ? 'sad' : 'idle';
    return `<div class="pet" data-pet="${p.id}" style="width:${w}px">
      ${costumeOverlay(p.id)}
      <img src="img/pets/${p.id}_${state}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div class="pet-svg" style="display:none">${p.svg}</div>
    </div>`;
  }).join('');
  const labels = PETS.map((p) => {
    const pct = monthTotal ? Math.round(((totals[p.id] || 0) / monthTotal) * 100) : 0;
    const pb = budgets.pets[p.id];
    const over = pb && (totals[p.id] || 0) > pb;
    return `<div><div class="n">${p.name}${over ? ' ⚠️' : ''}</div><div class="c">${over ? '<span style="color:var(--accent-deep)">超支</span>' : p.title + ' ' + pct + '%'}</div></div>`;
  }).join('');

  // 預算進度
  let budgetHtml = '';
  if (budgets.total > 0) {
    const pctUsed = Math.round((monthTotal / budgets.total) * 100);
    const over = monthTotal > budgets.total;
    const cls = over ? 'over' : pctUsed >= 80 ? 'warn' : '';
    budgetHtml = `<div class="budget-card">
      <div class="budget-top"><span>本月預算</span><span class="${over ? 'over-t' : ''}">${fmt(monthTotal)} / ${fmt(budgets.total)}</span></div>
      <div class="budget-track"><div class="budget-fill ${cls}" style="width:${Math.min(100, pctUsed)}%"></div></div>
      <div class="budget-note">${over ? `⚠️ 超支 ${fmt(monthTotal - budgets.total)}，怪獸們吃太飽啦！` : `還剩 ${fmt(budgets.total - monthTotal)}（用了 ${pctUsed}%）`}</div>
    </div>`;
  }

  const today = dateStr(now);
  const todayTxs = txs.filter((t) => dateStr(new Date(t.ts)) === today);
  const weekTxs = txs.filter((t) => now.getTime() - t.ts < 7 * 86400000);
  const rec = recommendPlan(todayTxs, weekTxs);
  const recHtml = `
    <div class="rec-card">
      <div class="rec-top">
        ${rec.topCat
          ? `${rec.usedToday ? '今日' : '近七天'}花最多：${rec.topCat.emo} ${rec.topCat.name} ${fmt(rec.topAmt)}`
          : '還沒有消費紀錄，先記一筆吧'}
      </div>
      <div class="rec-plan">💳 台新 Richart 建議切換 <b>${rec.plan.name}</b>（${rec.plan.pct}）</div>
      <div class="rec-note">${rec.plan.desc} · 每天可在 Richart Life APP 切換一次</div>
      ${rec.cardAdvice ? `<div class="rec-note">💡 ${rec.cardAdvice}</div>` : ''}
    </div>`;

  const unclaimed = ACHIEVEMENTS.filter((a) => !achieved.includes(a.id)).length;
  view.innerHTML = `
    <div class="coin-bar">
      <div class="coin-amt">🪙 ${coins.toLocaleString('zh-TW')}</div>
      <div class="coin-btns">
        <button data-act="open-achievements">🏆 成就${unclaimed ? `<span class="badge-dot"></span>` : ''}</button>
        <button data-act="open-shop">🛍️ 小舖</button>
      </div>
    </div>
    ${userName ? `<div class="home-title">${userName} 的怪獸小窩</div>` : ''}
    <div class="bubble"><span id="bubble-text"></span></div>
    <div class="scene">${petsHtml}</div>
    <div class="pet-labels">${labels}</div>
    ${budgetHtml}
    ${recHtml}
    <div class="stat-row">
      <div class="stat"><div class="k">本月支出</div><div class="v">${fmt(monthTotal)}</div></div>
      <div class="stat"><div class="k">連續記帳</div><div class="v">${streak(txs)} 天</div></div>
      <div class="stat"><div class="k">本月最肥</div><div class="v">${king ? king.name : '—'}</div></div>
    </div>`;

  if (!monthTotal) setBubble('這個月還沒有帳目…記下第一筆，餵餵大家吧！', null);
  else petSpeak(king.id, false);
}

function renderShop() {
  const pet = petById(shopPet);
  const petPicker = PETS.map((p) =>
    `<button class="shop-pet ${p.id === shopPet ? 'on' : ''}" data-shoppet="${p.id}" style="${p.id === shopPet ? 'border-color:' + p.color : ''}">
      <span class="sp-emo">${{ pulu: '🔴', momo: '🟢', jin: '🟡', zhuan: '⬜', jo: '🩷' }[p.id]}</span>
      <span class="sp-n">${p.name}</span></button>`).join('');
  const eqId = equipped[shopPet];
  const grid = COSTUMES.map((c) => {
    const has = owned.includes(c.id);
    const on = eqId === c.id;
    let btn;
    if (on) btn = `<button class="cos-btn on" data-unequip="${shopPet}">取下</button>`;
    else if (has) btn = `<button class="cos-btn" data-equip="${c.id}">戴上</button>`;
    else btn = `<button class="cos-btn buy ${coins < c.price ? 'no' : ''}" data-buy="${c.id}">🪙 ${c.price}</button>`;
    return `<div class="cos-card ${on ? 'wearing' : ''}">
      <div class="cos-emo">${c.emo}</div>
      <div class="cos-name">${c.name}</div>
      ${btn}
    </div>`;
  }).join('');

  view.innerHTML = `
    <div class="sub-head">
      <button class="step-back" data-act="home-back">‹</button>
      <div class="sub-title">🛍️ 裝扮小舖</div>
      <div class="coin-amt">🪙 ${coins.toLocaleString('zh-TW')}</div>
    </div>
    <div class="dress-preview">
      <div class="pet" style="width:150px">${costumeOverlay(shopPet)}
        <img src="img/pets/${shopPet}_idle.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="pet-svg" style="display:none">${pet.svg}</div>
      </div>
    </div>
    <div class="shop-pets">${petPicker}</div>
    <div class="cos-grid">${grid}</div>`;
}

function renderAchievements() {
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const rows = ACHIEVEMENTS.map((a) => {
    const done = achieved.includes(a.id);
    return `<div class="ach-row ${done ? 'done' : ''}">
      <span class="ach-ico">${done ? '🏆' : '🔒'}</span>
      <div class="mid"><div class="ach-n">${a.name}</div><div class="ach-d">${a.desc}</div></div>
      <span class="ach-coin">🪙 ${a.coin}</span>
    </div>`;
  }).join('');
  const doneN = achieved.length, totalN = ACHIEVEMENTS.length;
  view.innerHTML = `
    <div class="sub-head">
      <button class="step-back" data-act="home-back">‹</button>
      <div class="sub-title">🏆 成就任務</div>
      <div class="coin-amt">🪙 ${coins.toLocaleString('zh-TW')}</div>
    </div>
    <div class="sub" style="margin:0 4px 12px">已完成 ${doneN} / ${totalN}，記帳解任務賺金幣去小舖買裝扮！</div>
    <div class="card">${rows}</div>`;
}

function petSpeak(petId, wiggle = true) {
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const totals = petTotals(mt);
  const monthTotal = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const share = (totals[petId] || 0) / monthTotal;
  const days = daysSinceFed(txs, petId);
  const pet = petById(petId);
  const line = idleLine(petId, share, {
    share: Math.round(share * 100),
    days: days === null ? '不知道幾' : days,
    total: fmt(totals[petId] || 0)
  });
  setBubble(`${pet.name}：${line}`, pet.color);
  if (wiggle) {
    const el = view.querySelector(`[data-pet="${petId}"]`);
    if (el) {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
    }
  }
}

function setBubble(text, color) {
  const b = document.getElementById('bubble-text');
  if (!b) return;
  b.textContent = text;
  b.style.color = color || 'var(--text)';
}

/* ================= ledger ================= */

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function txMatches(t, q) {
  if (!q) return true;
  const k = txKind(t);
  const catName = k === 'income' ? incomeCatById(t.catId).name : k === 'transfer' ? '轉帳' : catById(t.catId).name;
  const pay = payments.find((p) => p.id === t.payId);
  const hay = [catName, t.note || '', pay ? pay.name : '', String(Math.round(t.amount))].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function renderLedger() {
  const y = ledgerDate.getFullYear();
  const m = ledgerDate.getMonth();
  const mt = monthTxs(txs, y, m);
  const spend = spendTotal(mt);
  const income = incomeTotal(mt);

  // 搜尋模式：跨全部帳目過濾
  if (ledgerSearch) {
    const hits = txs.filter((t) => txMatches(t, ledgerSearch));
    view.innerHTML = `
      ${ledgerSearchBar()}
      <div class="sub" style="margin:2px 4px 10px">找到 ${hits.length} 筆「${ledgerSearch}」</div>
      ${ledgerList(hits, true)}`;
    wireSearch();
    return;
  }

  const body = ledgerMode === 'stats' ? ledgerStats(mt, y, m)
    : ledgerMode === 'calendar' ? ledgerCalendar(mt, y, m)
    : ledgerList(mt);

  view.innerHTML = `
    <div class="month-nav">
      <button data-act="prev-month">‹</button>
      <span class="m">${y} 年 ${m + 1} 月</span>
      <button data-act="next-month">›</button>
    </div>
    <div class="io-summary">
      <div class="io"><span class="k">收入</span><span class="v inc">+${fmt(income)}</span></div>
      <div class="io"><span class="k">支出</span><span class="v exp">−${fmt(spend)}</span></div>
      <div class="io"><span class="k">結餘</span><span class="v ${income - spend >= 0 ? 'inc' : 'exp'}">${income - spend >= 0 ? '+' : '−'}${fmt(Math.abs(income - spend))}</span></div>
    </div>
    ${ledgerSearchBar()}
    <div class="seg">
      <button data-act="mode-list" class="${ledgerMode === 'list' ? 'on' : ''}">明細</button>
      <button data-act="mode-calendar" class="${ledgerMode === 'calendar' ? 'on' : ''}">日曆</button>
      <button data-act="mode-stats" class="${ledgerMode === 'stats' ? 'on' : ''}">分析</button>
    </div>
    ${body}`;
  wireSearch();
}

function ledgerSearchBar() {
  return `<div class="search-bar">
    <input id="tx-search" placeholder="🔍 搜尋帳目（分類、備註、金額）" value="${ledgerSearch.replace(/"/g, '&quot;')}" autocomplete="off">
    ${ledgerSearch ? '<button class="search-clear" data-act="clear-search">✕</button>' : ''}
  </div>`;
}

function wireSearch() {
  const el = document.getElementById('tx-search');
  if (!el) return;
  el.addEventListener('input', (e) => {
    const wasEmpty = !ledgerSearch;
    ledgerSearch = e.target.value.trim();
    const pos = e.target.selectionStart;
    renderLedger();
    const ne = document.getElementById('tx-search');
    if (ne) { ne.focus(); try { ne.setSelectionRange(pos, pos); } catch {} }
  });
}

function ledgerCalendar(mt, y, m) {
  const spendByDay = {}, incByDay = {};
  for (const t of mt) {
    const day = new Date(t.ts).getDate();
    if (isSpend(t)) spendByDay[day] = (spendByDay[day] || 0) + t.amount;
    else if (isIncome(t)) incByDay[day] = (incByDay[day] || 0) + t.amount;
  }
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const todayStr = dateStr(new Date());
  let cells = WEEK.map((w) => `<div class="cal-wk">${w}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sp = spendByDay[d], inc = incByDay[d];
    const sel = ledgerSelDay === d ? ' sel' : '';
    const isToday = ds === todayStr ? ' today' : '';
    cells += `<div class="cal-cell${sel}${isToday}" data-calday="${d}">
      <div class="cal-d">${d}</div>
      ${sp ? `<div class="cal-sp">${sp >= 1000 ? Math.round(sp / 100) / 10 + 'k' : sp}</div>` : ''}
      ${inc ? `<div class="cal-inc">+${inc >= 1000 ? Math.round(inc / 100) / 10 + 'k' : inc}</div>` : ''}
    </div>`;
  }
  let detail = '';
  if (ledgerSelDay) {
    const dayTxs = mt.filter((t) => new Date(t.ts).getDate() === ledgerSelDay);
    detail = `<div class="day-head">${m + 1}/${ledgerSelDay} 明細</div>${dayTxs.length ? ledgerRows(dayTxs) : '<div class="empty">這天沒有帳目</div>'}`;
  }
  return `<div class="cal-grid">${cells}</div>${detail}`;
}

function txRowHtml(t) {
  const kind = txKind(t);
  if (kind === 'transfer') {
    const from = payments.find((x) => x.id === t.fromPay);
    const to = payments.find((x) => x.id === (t.toPay != null ? t.toPay : t.payId));
    return `<div class="tx-row transfer-row">
      <span class="emo">🔄</span>
      <div class="mid"><div class="cat">轉帳</div>
        <div class="note">${from ? from.name : '?'} → ${to ? to.name : '?'}${t.note && t.note !== '悠遊卡加值' ? ' · ' + t.note : ''}</div></div>
      <span class="amt">${fmt(t.amount)}</span>
      <button class="del" data-del="${t.id}">✕</button>
    </div>`;
  }
  if (kind === 'income') {
    const c = incomeCatById(t.catId);
    const acct = payments.find((x) => x.id === t.payId);
    return `<div class="tx-row income-row">
      <span class="emo">${c.emo}</span>
      <div class="mid"><div class="cat">${c.name}${acct ? ` <span class="paytag">${acct.emo}${acct.name}</span>` : ''}</div>
        ${t.note ? `<div class="note">${t.note}</div>` : ''}</div>
      <span class="amt inc">+${fmt(t.amount)}</span>
      <button class="del" data-del="${t.id}">✕</button>
    </div>`;
  }
  const pay = payments.find((x) => x.id === t.payId);
  const payTag = pay ? ` <span class="paytag">${pay.emo}${pay.name}</span>` : '';
  const c = catById(t.catId);
  const p = petById(c.pet);
  return `<div class="tx-row">
    <span class="emo">${c.emo}</span>
    <div class="mid">
      <div class="cat">${c.name}${t.source === 'recurring' ? ' 🔁' : ''}${payTag}</div>
      ${t.note ? `<div class="note">${t.note}</div>` : ''}
    </div>
    <span class="amt" style="color:${p.deep}">−${fmt(t.amount)}</span>
    <button class="del" data-del="${t.id}">✕</button>
  </div>`;
}

function ledgerRows(list) {
  const byDay = {};
  for (const t of list) {
    const k = dateStr(new Date(t.ts));
    (byDay[k] = byDay[k] || []).push(t);
  }
  return Object.keys(byDay).sort().reverse().map((k) => {
    const d = new Date(k + 'T12:00:00');
    return `<div class="day-head">${d.getMonth() + 1}/${d.getDate()}（週${WEEK[d.getDay()]}）</div>${byDay[k].map(txRowHtml).join('')}`;
  }).join('');
}

function ledgerList(mt, noChips) {
  const totals = petTotals(mt);
  const chips = noChips ? '' : `<div class="pet-totals">${PETS.map((p) =>
    `<span class="pt" style="border-color:${p.color}">${p.name} ${fmt(totals[p.id] || 0)}</span>`).join('')}</div>`;
  const list = ledgerRows(mt);
  return `${chips}${list || '<div class="empty">沒有帳目</div>'}`;
}

function ledgerStats(monthList, y, m) {
  const yearMode = statsPeriod === 'year';
  const scope = yearMode ? txs.filter((t) => new Date(t.ts).getFullYear() === y) : monthList;
  const periodToggle = `<div class="seg" style="margin-bottom:12px">
    <button data-act="period-month" class="${!yearMode ? 'on' : ''}">本月</button>
    <button data-act="period-year" class="${yearMode ? 'on' : ''}">整年</button>
  </div>`;
  const mt = scope.filter(isSpend);
  if (!mt.length) return `${periodToggle}<div class="empty">${yearMode ? '今年' : '這個月'}沒有帳目，沒東西好分析</div>`;

  const totals = petTotals(mt);
  const monthTotal = mt.reduce((a, t) => a + t.amount, 0);

  const segs = PETS.filter((p) => (totals[p.id] || 0) > 0)
    .map((p) => ({ label: `${p.name}（${p.title}）`, value: totals[p.id], color: p.color }));
  const r = 40;
  const C = 2 * Math.PI * r;
  let off = 0;
  const arcs = segs.map((s) => {
    const len = (s.value / monthTotal) * C;
    const el = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${s.color}" stroke-width="24"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`;
    off += len;
    return el;
  }).join('');
  const legend = segs.map((s) =>
    `<div class="li"><span class="dot" style="background:${s.color}"></span>${s.label}
     <span class="amt">${fmt(s.value)}</span> <span class="pc">${Math.round((s.value / monthTotal) * 100)}%</span></div>`
  ).join('');

  const byCat = {};
  for (const t of mt) byCat[t.catId] = (byCat[t.catId] || 0) + t.amount;
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat = topCats[0][1];
  const bars = topCats.map(([catId, v]) => {
    const c = catById(catId);
    const p = petById(c.pet);
    return `<div class="bar-row">
      <span class="lbl">${c.emo} ${c.name}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Math.round((v / maxCat) * 100))}%;background:${p.color}"></div></div>
      <span class="val">${fmt(v)}</span></div>`;
  }).join('');

  // 單筆消費排行（最貴的 5 筆）
  const topTx = [...mt].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const bigRows = topTx.map((t) => {
    const c = catById(t.catId);
    const d = new Date(t.ts);
    return `<div class="tx-row" style="box-shadow:none">
      <span class="emo">${c.emo}</span>
      <div class="mid"><div class="cat">${c.name}</div>
        <div class="note">${d.getMonth() + 1}/${d.getDate()}${t.note ? ' · ' + t.note : ''}</div></div>
      <span class="amt" style="color:${petById(c.pet).deep}">${fmt(t.amount)}</span></div>`;
  }).join('');

  const months = [];
  const span = yearMode ? 12 : 6;
  for (let i = span - 1; i >= 0; i--) {
    const d = yearMode ? new Date(y, 11 - i, 1) : new Date(y, m - i, 1);
    const total = spendTotal(monthTxs(txs, d.getFullYear(), d.getMonth()));
    months.push({ label: `${d.getMonth() + 1}月`, total });
  }
  const maxMonth = Math.max(...months.map((x) => x.total), 1);
  const trend = months.map((x) =>
    `<div class="tb">
      <span class="tv">${x.total ? Math.round(x.total / 1000) + 'k' : ''}</span>
      <div class="tbar" style="height:${Math.round((x.total / maxMonth) * 100)}%"></div>
      <span class="tl">${x.label}</span></div>`
  ).join('');

  const byPay = {};
  for (const t of mt) byPay[t.payId || 'unknown'] = (byPay[t.payId || 'unknown'] || 0) + t.amount;
  const payEntries = Object.entries(byPay).sort((a, b) => b[1] - a[1]);
  const maxPay = payEntries.length ? payEntries[0][1] : 1;
  const payBars = payEntries.map(([payId, v]) => {
    const p = payments.find((x) => x.id === payId);
    const label = p ? `${p.emo} ${p.name}` : '❔ 未標記';
    return `<div class="bar-row">
      <span class="lbl">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Math.round((v / maxPay) * 100))}%;background:var(--accent)"></div></div>
      <span class="val">${fmt(v)}</span></div>`;
  }).join('');

  return `
    ${periodToggle}
    <h2>${yearMode ? '今年' : '本月'}支出 ${fmt(monthTotal)}</h2>
    <div class="card"><div class="donut-wrap"><svg viewBox="0 0 120 120">${arcs}</svg><div class="legend">${legend}</div></div></div>
    <h2>分類排行</h2>
    <div class="card">${bars}</div>
    <h2>最貴的 5 筆</h2>
    <div class="card">${bigRows}</div>
    <h2>支付方式</h2>
    <div class="card">${payBars || '<div class="sub">還沒有支付方式標記</div>'}</div>
    <h2>${yearMode ? '今年各月' : '近六個月'}趨勢</h2>
    <div class="card"><div class="trend">${trend}</div></div>`;
}

/* ================= assets ================= */

function renderAssets() {
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const nw = netWorth(payments, txs);
  const assets = assetTotal(payments, txs);
  const debt = cardDebtTotal(payments, txs);
  const monthInc = incomeTotal(mt);
  const monthExp = spendTotal(mt);

  const assetAccts = payments.filter(isAsset);
  const cards = payments.filter(isCard);

  const assetRows = assetAccts.map((p) => {
    const b = balances[p.id] || 0;
    return `<div class="acct-row">
      <span class="ae">${p.emo}</span>
      <div class="mid"><div class="an">${p.name}</div></div>
      <span class="ab ${b < 0 ? 'neg' : ''}">${fmt(b)}</span>
      <button class="del" data-setbal="${p.id}">✎</button>
      <button class="del" data-delpay="${p.id}">✕</button>
    </div>`;
  }).join('') || '<div class="sub">還沒有資產帳戶</div>';

  const cardRows = cards.map((p) => {
    const due = Math.max(0, -(balances[p.id] || 0));
    return `<div class="acct-row">
      <span class="ae">${p.emo}</span>
      <div class="mid"><div class="an">${p.name}</div>
        <div class="info">${due > 0 ? '本期待繳' : '已繳清 🎉'}</div></div>
      <span class="ab ${due > 0 ? 'due' : ''}">${due > 0 ? fmt(due) : fmt(0)}</span>
      ${due > 0 ? `<button class="chip pay-btn" data-repay="${p.id}">還款</button>` : ''}
      <button class="del" data-delpay="${p.id}">✕</button>
    </div>`;
  }).join('') || '<div class="sub">還沒有信用卡</div>';

  const typeOpts = ACCOUNT_TYPES.map((t) => `<option value="${t.type}">${t.emo} ${t.label}</option>`).join('');

  view.innerHTML = `
    <div class="nw-card">
      <div class="nw-label">淨資產</div>
      <div class="nw-value">${fmt(nw)}</div>
      <div class="nw-io">
        <span>資產 ${fmt(assets)}</span>
        <span>待繳 ${fmt(debt)}</span>
      </div>
      <div class="nw-io" style="margin-top:4px">
        <span class="inc">本月收入 +${fmt(monthInc)}</span>
        <span class="exp">本月支出 −${fmt(monthExp)}</span>
      </div>
    </div>

    <h2>資產帳戶</h2>
    <div class="card">${assetRows}</div>

    <h2>信用卡待繳</h2>
    <div class="card">${cardRows}</div>

    <h2>新增帳戶</h2>
    <div class="card">
      <div class="form-grid">
        <input id="acct-emo" placeholder="圖示 emoji" maxlength="4" autocomplete="off">
        <input id="acct-name" placeholder="名稱（例如 中信帳戶）" autocomplete="off">
        <select id="acct-type" class="full">${typeOpts}</select>
        <input id="acct-init" class="full" type="number" inputmode="numeric" placeholder="起始餘額（信用卡填目前待繳，選填）">
      </div>
      <button class="btn" data-act="add-acct">新增帳戶</button>
    </div>

    <div class="card">
      <div class="sub">💡 餘額隨記帳自動增減。刷卡 → 該卡待繳增加；還卡費 → 按「還款」從帳戶轉過去、待繳歸零。第一次用請按 ✎ 設定各帳戶實際餘額（信用卡設目前待繳金額）。</div>
    </div>`;
}

async function addAccount() {
  const name = document.getElementById('acct-name').value.trim();
  const type = document.getElementById('acct-type').value;
  const meta = ACCOUNT_TYPES.find((t) => t.type === type);
  const emo = document.getElementById('acct-emo').value.trim() || meta.emo;
  const init = Number(document.getElementById('acct-init').value) || 0;
  if (!name) {
    showToast('先取個帳戶名稱');
    return;
  }
  const order = Math.max(0, ...payments.map((p) => p.order || 0)) + 1;
  // 信用卡：使用者填的是待繳金額（正數），內部存成負餘額
  const initBalance = type === 'card' ? -Math.abs(init) : init;
  await store.put('payments', {
    id: 'acct_' + store.uid().slice(0, 8), name, emo, type,
    tracked: true, initBalance, order
  });
  await reload();
  renderAssets();
  showToast(`已新增帳戶：${emo} ${name}`);
}

/* ================= settings ================= */

function renderSettings() {
  const themeBtns = [['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']]
    .map(([v, label]) => `<button data-theme-set="${v}" class="${theme === v ? 'on' : ''}">${label}</button>`)
    .join('');

  const recRows = recurring.map((r) => {
    const c = catById(r.catId);
    return `<div class="rec-row">
      <span class="emo">${c.emo}</span>
      <div class="mid">
        <div class="name">${r.name}</div>
        <div class="info">每月 ${r.day} 號 · ${c.name} · 下次入帳 ${r.nextDue}</div>
      </div>
      <b>${fmt(r.amount)}</b>
      <button class="del" data-delrec="${r.id}">✕</button>
    </div>`;
  }).join('') || '<div class="sub">還沒有定期開支。新增一筆吧，例如 Netflix、房租、電信費——到期會自動入帳。</div>';

  const catOpts = cats.map((c) => `<option value="${c.id}">${c.emo} ${c.name}</option>`).join('');
  const dayOpts = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">每月 ${i + 1} 號</option>`).join('');
  const petOpts = PETS.map((p) => `<option value="${p.id}">${p.name}（${p.title}）</option>`).join('');

  const catRows = PETS.map((p) => {
    const rows = cats.filter((c) => c.pet === p.id).map((c) => {
      if (c.id === editingCat) {
        const editPetOpts = PETS.map((x) =>
          `<option value="${x.id}" ${x.id === c.pet ? 'selected' : ''}>${x.name}（${x.title}）</option>`).join('');
        return `<div class="rec-row" style="flex-wrap:wrap;gap:6px">
          <input id="edit-emo" value="${c.emo}" maxlength="4" style="width:56px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;font-size:14px;color:var(--text)">
          <input id="edit-name" value="${c.name}" style="flex:1;min-width:90px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;font-size:14px;color:var(--text);font-family:inherit">
          <select id="edit-pet" style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;font-size:14px;color:var(--text);font-family:inherit">${editPetOpts}</select>
          <button class="chip" data-act="save-cat">✔ 儲存</button>
          <button class="chip" data-act="cancel-cat">取消</button>
        </div>`;
      }
      return `<div class="rec-row">
        <span class="emo">${c.emo}</span>
        <div class="mid"><div class="name">${c.name}</div></div>
        <button class="del" data-editcat="${c.id}">✎</button>
        <button class="del" data-delcat="${c.id}">✕</button>
      </div>`;
    }).join('');
    if (!rows) return '';
    return `<div class="pet-tag" style="margin-top:10px"><span class="dot" style="background:${p.color}"></span>${p.name}（${p.title}）</div>${rows}`;
  }).join('');

  const lastSyncText = syncCfg.url
    ? (syncCfg.last ? `上次同步：${new Date(syncCfg.last).toLocaleString('zh-TW')}` : '已設定，尚未同步')
    : '尚未設定。照著專案裡的 SETUP_SYNC.md 做一次（約 15 分鐘），就有雲端備份和 email 自動記帳。';

  const petBudgetRows = PETS.map((p) =>
    `<div class="rec-row">
      <span class="dot" style="width:11px;height:11px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
      <div class="mid"><div class="name">${p.name}（${p.title}）</div></div>
      <input id="bud-${p.id}" type="number" inputmode="numeric" placeholder="不限" value="${budgets.pets[p.id] || ''}"
        style="width:96px;background:var(--bg);border:1.5px solid var(--line);border-radius:10px;padding:8px;font-size:14px;color:var(--text);font-family:var(--font-num)">
    </div>`).join('');

  const pinSet = hasPin;

  view.innerHTML = `
    <h2>使用者</h2>
    <div class="card">
      <div class="form-grid">
        <input id="user-name" class="full" placeholder="你的名字（例如 Jason）" value="${userName.replace(/"/g, '&quot;')}" autocomplete="off">
      </div>
      <button class="btn" data-act="save-name">儲存名字</button>
    </div>

    <h2>外觀</h2>
    <div class="card"><div class="theme-row">${themeBtns}</div></div>

    <h2>雲端同步（Google Sheets）</h2>
    <div class="card">
      <div class="sub">${lastSyncText}</div>
      <div class="form-grid">
        <input id="sync-url" class="full" placeholder="Apps Script Web App 網址（…/exec）" value="${syncCfg.url}" autocomplete="off">
        <input id="sync-token" class="full" placeholder="通關密語（token）" value="${syncCfg.token}" autocomplete="off">
      </div>
      <button class="btn" data-act="save-sync">儲存設定</button>
      <button class="btn ghost" data-act="sync-now">立即同步</button>
    </div>

    <h2>定期開支</h2>
    <div class="card">${recRows}</div>
    <div class="card">
      <div class="sub">新增定期開支</div>
      <div class="form-grid">
        <input id="rec-name" class="full" placeholder="名稱（例如 Netflix）" autocomplete="off">
        <input id="rec-amount" type="number" inputmode="numeric" placeholder="金額">
        <select id="rec-day">${dayOpts}</select>
        <select id="rec-cat" class="full">${catOpts}</select>
      </div>
      <button class="btn" data-act="add-rec">新增</button>
    </div>

    <h2>預算</h2>
    <div class="card">
      <div class="rec-row">
        <div class="mid"><div class="name">每月總預算</div><div class="info">超支時怪獸會吃太飽發出警告</div></div>
        <input id="bud-total" type="number" inputmode="numeric" placeholder="不限" value="${budgets.total || ''}"
          style="width:110px;background:var(--bg);border:1.5px solid var(--line);border-radius:10px;padding:8px;font-size:14px;color:var(--text);font-family:var(--font-num)">
      </div>
    </div>
    <div class="card">
      <div class="sub">各怪獸分項預算（選填，超支該怪獸會標 ⚠️）</div>
      ${petBudgetRows}
      <button class="btn" data-act="save-budget">儲存預算</button>
    </div>

    <h2>安全</h2>
    <div class="card">
      <div class="rec-row">
        <div class="mid"><div class="name">App 密碼鎖</div><div class="info">${pinSet ? '已啟用 4 位數 PIN' : '打開 App 需輸入 4 位數 PIN'}</div></div>
        <button class="chip" data-act="${pinSet ? 'remove-pin' : 'set-pin'}">${pinSet ? '關閉' : '設定'}</button>
      </div>
    </div>

    <h2>分類管理</h2>
    <div class="card">${catRows}</div>
    <div class="card">
      <div class="sub">新增自訂分類</div>
      <div class="form-grid">
        <input id="cat-emo" placeholder="圖示（emoji）" maxlength="4" autocomplete="off">
        <input id="cat-name" placeholder="分類名稱" autocomplete="off">
        <select id="cat-pet" class="full">${petOpts}</select>
      </div>
      <button class="btn" data-act="add-cat">新增分類</button>
    </div>

    <h2>資料</h2>
    <div class="card">
      <div class="sub">共 ${txs.length} 筆帳目。資料存在這台裝置的瀏覽器裡，記得偶爾匯出備份；換手機時用「匯入備份」搬家。</div>
      <button class="btn ghost" data-act="export">匯出備份（JSON）</button>
      <button class="btn ghost" data-act="export-csv">匯出報表（CSV／Excel）</button>
      <button class="btn ghost" data-act="import">匯入備份</button>
      <input type="file" id="import-file" accept=".json,application/json" hidden>
    </div>`;

  document.getElementById('import-file').addEventListener('change', importData);
}

async function addRec() {
  const name = document.getElementById('rec-name').value.trim();
  const amt = Number(document.getElementById('rec-amount').value);
  const day = Number(document.getElementById('rec-day').value);
  const catId = document.getElementById('rec-cat').value;
  if (!name || !amt) {
    showToast('名稱和金額都要填喔');
    return;
  }
  await store.put('recurring', { id: store.uid(), name, amount: amt, catId, day, nextDue: initNextDue(day) });
  await reload();
  renderSettings();
  showToast(`已新增定期開支：${name}，每月 ${day} 號自動入帳`);
}

async function addCat() {
  const emo = document.getElementById('cat-emo').value.trim() || '🏷️';
  const name = document.getElementById('cat-name').value.trim();
  const pet = document.getElementById('cat-pet').value;
  if (!name) {
    showToast('分類名稱要填喔');
    return;
  }
  const order = Math.max(0, ...cats.map((c) => c.order || 0)) + 1;
  await store.put('cats', { id: 'c_' + store.uid().slice(0, 8), name, emo, pet, order });
  await reload();
  renderSettings();
  showToast(`已新增分類：${emo} ${name} → 餵${petById(pet).name}`);
}

async function saveCatEdit() {
  const c = cats.find((x) => x.id === editingCat);
  if (!c) return;
  const name = document.getElementById('edit-name').value.trim() || c.name;
  const emo = document.getElementById('edit-emo').value.trim() || c.emo;
  const petId = document.getElementById('edit-pet').value;
  const moved = petId !== c.pet;
  await store.put('cats', { ...c, name, emo, pet: petId });
  editingCat = null;
  await reload();
  renderSettings();
  showToast(moved ? `${emo} ${name} 現在改餵${petById(petId).name}了` : `已更新 ${emo} ${name}`);
}

async function delCat(id) {
  const c = cats.find((x) => x.id === id);
  if (!c) return;
  const used = txs.filter((t) => t.catId === id).length;
  const msg = used
    ? `刪除分類「${c.name}」？已有 ${used} 筆帳目使用它，這些紀錄會保留但顯示為原名。`
    : `刪除分類「${c.name}」？`;
  if (!confirm(msg)) return;
  await store.del('cats', id);
  await reload();
  renderSettings();
}

function exportData() {
  const payload = { app: 'pet-ledger', user: userName, exportedAt: new Date().toISOString(), txs, recurring, cats, payments, theme };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const who = userName ? userName.replace(/[^\w一-龥]/g, '') + '-' : '';
  a.download = `${who}怪獸小窩-備份-${dateStr(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCSV() {
  const esc = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
  const kindLabel = { expense: '支出', income: '收入', transfer: '轉帳' };
  const rows = [['日期', '時間', '類型', '分類', '金額', '帳戶／轉出', '轉入', '備註']];
  for (const t of [...txs].sort((a, b) => a.ts - b.ts)) {
    const d = new Date(t.ts);
    const k = txKind(t);
    let catName = '', acct = '', to = '';
    if (k === 'transfer') {
      catName = '轉帳';
      acct = (payments.find((p) => p.id === t.fromPay) || {}).name || '';
      to = (payments.find((p) => p.id === (t.toPay != null ? t.toPay : t.payId)) || {}).name || '';
    } else if (k === 'income') {
      catName = incomeCatById(t.catId).name;
      acct = (payments.find((p) => p.id === t.payId) || {}).name || '';
    } else {
      catName = catById(t.catId).name;
      acct = (payments.find((p) => p.id === t.payId) || {}).name || '';
    }
    rows.push([dateStr(d), d.toTimeString().slice(0, 5), kindLabel[k], catName, Math.round(t.amount), acct, to, t.note || '']);
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'); // BOM 讓 Excel 正確顯示中文
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const who = userName ? userName.replace(/[^\w一-龥]/g, '') + '-' : '';
  a.download = `${who}怪獸小窩-報表-${dateStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📄 CSV 報表已匯出，可用 Excel 開啟');
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.txs)) throw new Error('bad format');
    for (const t of data.txs) await store.put('tx', t);
    for (const r of data.recurring || []) await store.put('recurring', r);
    for (const c of data.cats || []) await store.put('cats', c);
    for (const p of data.payments || []) await store.put('payments', p);
    await reload();
    renderSettings();
    showToast(`匯入完成：${data.txs.length} 筆帳目、${(data.recurring || []).length} 筆定期開支`);
  } catch {
    showToast('匯入失敗：這不是有效的備份檔');
  }
  e.target.value = '';
}

/* ================= router & events ================= */

function render() {
  view.classList.remove('anim');
  void view.offsetWidth;
  view.classList.add('anim');
  tabbar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'entry') renderEntry();
  else if (tab === 'home') renderHome();
  else if (tab === 'ledger') renderLedger();
  else if (tab === 'assets') renderAssets();
  else renderSettings();
}

tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  const prev = tab;
  tab = btn.dataset.tab;
  if (tab === 'ledger') { ledgerDate = new Date(); ledgerSearch = ''; ledgerSelDay = null; }
  if (tab === 'home') homeSub = null;
  if (tab === 'entry' && prev !== 'entry') { entryStep = 1; entryKind = 'expense'; transferFrom = null; }
  render();
});

view.addEventListener('click', async (e) => {
  const key = e.target.closest('[data-key]');
  if (key) return pressKey(key.dataset.key);

  const op = e.target.closest('[data-op]');
  if (op) return pressOp(op.dataset.op);

  const chip = e.target.closest('[data-cat]');
  if (chip) return saveTx(chip.dataset.cat);

  const incChip = e.target.closest('[data-inccat]');
  if (incChip) return saveIncome(incChip.dataset.inccat);

  const pet = e.target.closest('[data-pet]');
  if (pet) return petSpeak(pet.dataset.pet);

  const shopPetBtn = e.target.closest('[data-shoppet]');
  if (shopPetBtn) { shopPet = shopPetBtn.dataset.shoppet; return renderShop(); }

  const buyBtn = e.target.closest('[data-buy]');
  if (buyBtn) {
    const c = costumeById(buyBtn.dataset.buy);
    if (coins < c.price) { showToast(`金幣不夠（還差 🪙${c.price - coins}），多記帳賺一點！`); return; }
    coins -= c.price;
    owned.push(c.id);
    equipped[shopPet] = c.id;
    await store.setKV('coins', coins);
    await store.setKV('owned', owned);
    await store.setKV('equipped', equipped);
    await checkAchievements();
    renderShop();
    showToast(`🎉 買下 ${c.emo}${c.name}，已幫 ${petById(shopPet).name} 戴上！`);
    return;
  }

  const equipBtn = e.target.closest('[data-equip]');
  if (equipBtn) {
    equipped[shopPet] = equipBtn.dataset.equip;
    await store.setKV('equipped', equipped);
    await checkAchievements();
    renderShop();
    return;
  }

  const unequipBtn = e.target.closest('[data-unequip]');
  if (unequipBtn) {
    delete equipped[unequipBtn.dataset.unequip];
    await store.setKV('equipped', equipped);
    renderShop();
    return;
  }

  const kindBtn = e.target.closest('[data-kind]');
  if (kindBtn) {
    entryKind = kindBtn.dataset.kind;
    entryStep = 1;
    transferFrom = null;
    noteVal = document.getElementById('note')?.value || noteVal;
    renderEntry();
    return;
  }

  const payBtn = e.target.closest('[data-pay]');
  if (payBtn) {
    selectedPay = payBtn.dataset.pay;
    await store.setKV('lastPay', selectedPay);
    if (tab === 'entry' && entryStep === 2) entryStep = 3;
    renderEntry();
    return;
  }

  const acctBtn = e.target.closest('[data-acct]');
  if (acctBtn) {
    selectedPay = acctBtn.dataset.acct;
    entryStep = 3;
    return renderEntry();
  }

  const fromBtn = e.target.closest('[data-from]');
  if (fromBtn) {
    transferFrom = fromBtn.dataset.from;
    entryStep = 3;
    return renderEntry();
  }

  const toBtn = e.target.closest('[data-toacct]');
  if (toBtn) return saveTransfer(toBtn.dataset.toacct);

  const setbal = e.target.closest('[data-setbal]');
  if (setbal) {
    const p = payments.find((x) => x.id === setbal.dataset.setbal);
    const cur = balances[p.id] || 0;
    const card = isCard(p);
    const promptDefault = card ? String(Math.round(Math.max(0, -cur))) : String(Math.round(cur));
    const val = prompt(card ? `設定「${p.name}」目前待繳金額` : `設定「${p.name}」目前實際餘額`, promptDefault);
    if (val === null) return;
    const target = card ? -Math.abs(Number(val) || 0) : (Number(val) || 0);
    const txDelta = cur - (p.initBalance || 0);   // 交易造成的變動
    p.initBalance = target - txDelta;              // 反推起始餘額，使計算餘額 = 目標
    await store.put('payments', p);
    await reload();
    renderAssets();
    return;
  }

  const repay = e.target.closest('[data-repay]');
  if (repay) {
    const card = payments.find((x) => x.id === repay.dataset.repay);
    const due = Math.max(0, -(balances[card.id] || 0));
    const sources = payments.filter(isAsset);
    if (!sources.length) { showToast('沒有可付款的資產帳戶'); return; }
    const from = sources.find((p) => p.type === 'bank') || sources[0];
    const val = prompt(`還「${card.name}」多少？（待繳 ${fmt(due)}，從「${from.name}」扣）`, String(Math.round(due)));
    if (val === null) return;
    const amt = Number(val);
    if (!amt || amt <= 0) { showToast('金額不對喔'); return; }
    await store.put('tx', { id: store.uid(), kind: 'transfer', amount: amt, note: card.name + ' 還款', ts: Date.now(), source: 'manual', fromPay: from.id, toPay: card.id });
    await reload();
    renderAssets();
    showToast(`💳 已還 ${card.name} ${fmt(amt)}（從 ${from.name} 扣）`);
    return;
  }

  const delpay = e.target.closest('[data-delpay]');
  if (delpay) {
    const p = payments.find((x) => x.id === delpay.dataset.delpay);
    if (confirm(`刪除帳戶「${p.name}」？（帳目紀錄會保留）`)) {
      await store.del('payments', p.id);
      await reload();
      renderAssets();
    }
    return;
  }

  const themeBtn = e.target.closest('[data-theme-set]');
  if (themeBtn) {
    applyTheme(themeBtn.dataset.themeSet);
    await store.setKV('theme', theme);
    renderSettings();
    return;
  }

  const editcat = e.target.closest('[data-editcat]');
  if (editcat) {
    editingCat = editcat.dataset.editcat;
    renderSettings();
    return;
  }

  const delcat = e.target.closest('[data-delcat]');
  if (delcat) return delCat(delcat.dataset.delcat);

  const calCell = e.target.closest('[data-calday]');
  if (calCell) {
    const d = Number(calCell.dataset.calday);
    ledgerSelDay = ledgerSelDay === d ? null : d;
    return renderLedger();
  }

  const pendOk = e.target.closest('[data-pend-ok]');
  if (pendOk) return resolvePending(pendOk.dataset.pendOk, true);

  const pendNo = e.target.closest('[data-pend-no]');
  if (pendNo) return resolvePending(pendNo.dataset.pendNo, false);

  const del = e.target.closest('[data-del]');
  if (del) {
    if (confirm('刪除這筆帳目？')) {
      await store.del('tx', del.dataset.del);
      const tomb = (await store.getKV('tombstones')) || [];
      tomb.push(del.dataset.del);
      await store.setKV('tombstones', tomb);
      await reload();
      renderLedger();
    }
    return;
  }

  const delrec = e.target.closest('[data-delrec]');
  if (delrec) {
    if (confirm('刪除這筆定期開支？（已入帳的紀錄會保留）')) {
      await store.del('recurring', delrec.dataset.delrec);
      await reload();
      renderSettings();
    }
    return;
  }

  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'next-step') {
    const v = evalExpr(amount);
    if (!v || isNaN(v)) {
      showToast('先輸入金額喔！');
      return;
    }
    amount = String(v);            // 運算式求值後變純數字
    noteVal = document.getElementById('note')?.value || '';
    entryStep = 2;
    return renderEntry();
  }
  if (a === 'back-step') {
    entryStep = Number(act.dataset.to) || 1;
    return renderEntry();
  }
  if (a === 'open-shop') { homeSub = 'shop'; return renderShop(); }
  if (a === 'open-achievements') { homeSub = 'achievements'; return renderAchievements(); }
  if (a === 'home-back') { homeSub = null; return renderHome(); }
  if (a === 'add-rec') return addRec();
  if (a === 'add-cat') return addCat();
  if (a === 'save-cat') return saveCatEdit();
  if (a === 'cancel-cat') {
    editingCat = null;
    return renderSettings();
  }
  if (a === 'topup') return topupEasycard();
  if (a === 'add-acct') return addAccount();
  if (a === 'save-name') {
    userName = document.getElementById('user-name').value.trim();
    await store.setKV('userName', userName);
    render();
    showToast(userName ? `你好，${userName}！🐾` : '已清除名字');
    return;
  }
  if (a === 'save-budget') {
    const total = Number(document.getElementById('bud-total').value) || 0;
    const pets = {};
    for (const p of PETS) {
      const v = Number(document.getElementById('bud-' + p.id).value) || 0;
      if (v > 0) pets[p.id] = v;
    }
    budgets = { total, pets };
    await store.setKV('budgets', budgets);
    renderSettings();
    showToast('💰 預算已儲存');
    return;
  }
  if (a === 'set-pin') {
    const pin = prompt('設定 4 位數 PIN（打開 App 要輸入）');
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin)) { showToast('請輸入 4 位數字'); return; }
    const confirm2 = prompt('再輸入一次確認');
    if (confirm2 !== pin) { showToast('兩次不一樣，重設一次'); return; }
    await store.setKV('pinHash', await sha256(pin));
    hasPin = true;
    renderSettings();
    showToast('🔒 密碼鎖已啟用');
    return;
  }
  if (a === 'remove-pin') {
    const pin = prompt('輸入目前 PIN 以關閉');
    if (pin === null) return;
    if ((await sha256(pin)) !== (await store.getKV('pinHash'))) { showToast('PIN 不對'); return; }
    await store.setKV('pinHash', null);
    hasPin = false;
    renderSettings();
    showToast('🔓 密碼鎖已關閉');
    return;
  }
  if (a === 'save-sync') {
    await store.setKV('syncUrl', document.getElementById('sync-url').value.trim());
    await store.setKV('syncToken', document.getElementById('sync-token').value.trim());
    await reload();
    renderSettings();
    showToast('同步設定已儲存');
    return;
  }
  if (a === 'sync-now') {
    showToast('☁️ 同步中…');
    const r = await doSync();
    if (r.ok) {
      await reload();
      render();
      showToast(`☁️ 同步完成：雲端共 ${r.pulled} 筆帳目${r.pending ? `，${r.pending} 筆扣款待確認` : ''}`);
    } else if (r.error === 'not-configured') {
      showToast('先填入網址和通關密語，按「儲存設定」');
    } else {
      showToast('同步失敗：檢查網址、通關密語或網路連線');
    }
    return;
  }
  if (a === 'export') return exportData();
  if (a === 'export-csv') return exportCSV();
  if (a === 'import') return document.getElementById('import-file').click();
  if (a === 'mode-list') { ledgerMode = 'list'; return renderLedger(); }
  if (a === 'mode-calendar') { ledgerMode = 'calendar'; return renderLedger(); }
  if (a === 'mode-stats') { ledgerMode = 'stats'; return renderLedger(); }
  if (a === 'period-month') { statsPeriod = 'month'; return renderLedger(); }
  if (a === 'period-year') { statsPeriod = 'year'; return renderLedger(); }
  if (a === 'clear-search') { ledgerSearch = ''; return renderLedger(); }
  if (a === 'prev-month') { ledgerDate.setMonth(ledgerDate.getMonth() - 1); ledgerSelDay = null; return renderLedger(); }
  if (a === 'next-month') { ledgerDate.setMonth(ledgerDate.getMonth() + 1); ledgerSelDay = null; return renderLedger(); }
});

/* ================= boot ================= */

async function boot() {
  const savedTheme = await store.getKV('theme');
  if (savedTheme) applyTheme(savedTheme);

  // 密碼鎖：有設 PIN 就先鎖住
  if (await store.getKV('pinHash')) {
    userName = (await store.getKV('userName')) || '';
    await showLockScreen();
  }

  const existing = await store.getAll('cats');
  if (!existing.length) {
    let i = 0;
    for (const c of DEFAULT_CATS) await store.put('cats', { ...c, order: i++ });
  }
  const existingPay = await store.getAll('payments');
  if (!existingPay.length) {
    for (const p of DEFAULT_PAYMENTS) await store.put('payments', p);
  }

  // 一次性補種：新版預設分類（咖啡/治裝/3C/醫療…）加到既有資料庫
  if (!(await store.getKV('catsV2'))) {
    const have = new Set((await store.getAll('cats')).map((c) => c.id));
    let order = 100;
    for (const c of DEFAULT_CATS) {
      if (!have.has(c.id)) await store.put('cats', { ...c, order: order++ });
    }
    await store.setKV('catsV2', 1);
  }

  // 一次性修正：咖啡是日常機能不是慾望，從噗嚕移到磚磚（若使用者已自行改過則不動）
  if (!(await store.getKV('coffeeFix'))) {
    const allCats = await store.getAll('cats');
    const coffee = allCats.find((c) => c.id === 'coffee');
    if (coffee && coffee.pet === 'pulu') await store.put('cats', { ...coffee, pet: 'zhuan' });
    await store.setKV('coffeeFix', 1);
  }

  // 一次性遷移：三餐拆成早/午/晚餐＋宵夜＋其他（參考 CWMoney/MOZE 的分類粒度）
  if (!(await store.getKV('mealsV3'))) {
    const allCats = await store.getAll('cats');
    const have = new Set(allCats.map((c) => c.id));
    const meals = allCats.find((c) => c.id === 'meals');
    const baseOrder = meals ? (meals.order || 11) : 50;
    const inserts = [
      { id: 'breakfast', ord: baseOrder + 0.1 }, { id: 'lunch', ord: baseOrder + 0.2 },
      { id: 'dinner', ord: baseOrder + 0.3 }, { id: 'latenight', ord: 1.5 }, { id: 'other', ord: 999 }
    ];
    for (const ins of inserts) {
      if (!have.has(ins.id)) {
        const def = DEFAULT_CATS.find((c) => c.id === ins.id);
        if (def) await store.put('cats', { ...def, order: ins.ord });
      }
    }
    if (meals) await store.del('cats', 'meals');
    const snack = allCats.find((c) => c.id === 'snack');
    if (snack && snack.name === '零食宵夜') await store.put('cats', { ...snack, name: '零食點心' });
    await store.setKV('mealsV3', 1);
  }

  // 一次性遷移：帳戶模型（tracked / initBalance），把舊 easycard 的累加餘額轉成起始餘額
  if (!(await store.getKV('acctV4'))) {
    const accs = await store.getAll('payments');
    const allTxs = await store.getAll('tx');
    for (const p of accs) {
      const tracked = p.type === 'cash' || p.type === 'bank' || p.type === 'easycard' || p.type === 'invest';
      const patch = { ...p, tracked };
      if (tracked && patch.initBalance === undefined) {
        if (p.type === 'easycard' && typeof p.balance === 'number') {
          // 舊 easycard.balance 已含加值與扣款；反推起始值使計算餘額維持不變
          let delta = 0;
          for (const t of allTxs) {
            if (t.source === 'topup' && t.payId === p.id) delta += t.amount;
            else if ((t.kind === 'expense' || (!t.kind && t.source !== 'topup')) && t.payId === p.id) delta -= t.amount;
          }
          patch.initBalance = p.balance - delta;
        } else {
          patch.initBalance = 0;
        }
      }
      delete patch.balance;
      await store.put('payments', patch);
    }
    // 補一個銀行帳戶（若沒有）
    if (!accs.some((p) => p.id === 'bank' || p.type === 'bank')) {
      await store.put('payments', { id: 'bank', name: '銀行帳戶', emo: '🏦', type: 'bank', tracked: true, initBalance: 0, order: 1.5 });
    }
    await store.setKV('acctV4', 1);
  }

  // 一次性遷移：信用卡改為可追蹤（待繳），起始待繳 0
  if (!(await store.getKV('acctV5'))) {
    const accs = await store.getAll('payments');
    for (const p of accs) {
      if (p.type === 'card' && !p.tracked) {
        await store.put('payments', { ...p, tracked: true, initBalance: 0 });
      }
    }
    await store.setKV('acctV5', 1);
  }

  await reload();
  const { newTxs, updated } = postDue(recurring);
  if (newTxs.length) {
    for (const t of newTxs) await store.put('tx', t);
    for (const r of updated) await store.put('recurring', r);
    await reload();
    const names = [...new Set(newTxs.map((t) => t.note))].join('、');
    showToast(`🔁 定期開支已自動入帳：${names}`);
  }
  await checkAchievements();   // 補發既有進度達成的成就
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (syncCfg.url && syncCfg.token) {
    doSync().then(async (r) => {
      if (!r.ok) return;
      await reload();
      render();
      if (r.pending) showToast(`📬 有 ${r.pending} 筆扣款通知待確認（記帳頁最上方）`);
    });
  }
}

boot();
