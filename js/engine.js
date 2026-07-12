import { CATS, catById, DIALOG, CAT_PLAN, RICHART_PLANS } from './data.js';
import { uid } from './db.js';

/* 交易種類：expense 支出 / income 收入 / transfer 轉帳。舊資料無 kind 一律視為支出。 */
export const txKind = (t) => t.kind || (t.source === 'topup' ? 'transfer' : 'expense');
export const isSpend = (t) => txKind(t) === 'expense';
export const isIncome = (t) => txKind(t) === 'income';
export const isTransfer = (t) => txKind(t) === 'transfer';

/* 由起始餘額 + 全部交易即時計算每個帳戶目前餘額（比累加式更穩，刪帳自動反映） */
export function accountBalances(accounts, txs) {
  const bal = {};
  for (const a of accounts) bal[a.id] = a.tracked ? (a.initBalance || 0) : 0;
  for (const t of txs) {
    const k = txKind(t);
    if (k === 'expense' && t.payId != null && bal[t.payId] !== undefined) bal[t.payId] -= t.amount;
    else if (k === 'income' && t.payId != null && bal[t.payId] !== undefined) bal[t.payId] += t.amount;
    else if (k === 'transfer') {
      if (t.fromPay != null && bal[t.fromPay] !== undefined) bal[t.fromPay] -= t.amount;
      const to = t.toPay != null ? t.toPay : t.payId; // 舊 topup 用 payId 當入帳帳戶
      if (to != null && bal[to] !== undefined) bal[to] += t.amount;
    }
  }
  return bal;
}

export function netWorth(accounts, txs) {
  const bal = accountBalances(accounts, txs);
  return accounts.filter((a) => a.tracked).reduce((s, a) => s + (bal[a.id] || 0), 0);
}

export function incomeTotal(list) {
  return list.filter(isIncome).reduce((a, t) => a + t.amount, 0);
}

export function fmt(n) {
  return 'NT$' + Math.round(n).toLocaleString('zh-TW');
}

export function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthTxs(txs, year, month) {
  return txs.filter((t) => {
    const d = new Date(t.ts);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function petTotals(list) {
  const totals = {};
  for (const t of list) {
    if (!isSpend(t)) continue;
    const cat = catById(t.catId);
    if (!cat) continue;
    totals[cat.pet] = (totals[cat.pet] || 0) + t.amount;
  }
  return totals;
}

export function spendTotal(list) {
  return list.filter(isSpend).reduce((a, t) => a + t.amount, 0);
}

/* 今日消費分析 → 台新 Richart 當日方案建議 */
export function recommendPlan(todayList, refList) {
  const base = todayList.filter(isSpend).length ? todayList.filter(isSpend) : (refList || []).filter(isSpend);
  const usedToday = todayList.filter(isSpend).length > 0;
  const byCat = {};
  for (const t of base) byCat[t.catId] = (byCat[t.catId] || 0) + t.amount;
  const topCatId = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0];

  const byPlan = {};
  for (const [catId, amt] of Object.entries(byCat)) {
    const plan = CAT_PLAN[catId];
    if (plan) byPlan[plan] = (byPlan[plan] || 0) + amt;
  }
  let planId = Object.keys(byPlan).sort((a, b) => byPlan[b] - byPlan[a])[0];
  const day = new Date().getDay();
  const noPlanMatch = !planId;
  if (!planId) planId = (day === 0 || day === 6) ? 'holiday' : 'daily';

  // 用卡建議：類別有對到 Richart 加碼方案 → 台新；沒對到（房租水電等）→ 永豐 DAWHO 1% > Richart 一般 0.3%
  const topMapped = topCatId && CAT_PLAN[topCatId];
  const cardAdvice = topMapped
    ? `這類消費刷台新 Richart（記得切方案）`
    : (topCatId ? `這類通路兩卡都無加碼，刷永豐 DAWHO 保底 1%（台新僅 0.3%）` : '');

  return {
    plan: { id: planId, ...RICHART_PLANS[planId] },
    topCat: topCatId ? catById(topCatId) : null,
    topAmt: topCatId ? byCat[topCatId] : 0,
    usedToday,
    noPlanMatch,
    cardAdvice
  };
}

export function catCount(list, catId) {
  return list.filter((t) => t.catId === catId).length;
}

export function daysSinceFed(txs, petId) {
  const petCats = new Set(CATS.filter((c) => c.pet === petId).map((c) => c.id));
  let latest = null;
  for (const t of txs) {
    if (petCats.has(t.catId) && (latest === null || t.ts > latest)) latest = t.ts;
  }
  if (latest === null) return null;
  const days = Math.floor((Date.now() - latest) / 86400000);
  return days;
}

export function streak(txs) {
  const days = new Set(txs.filter((t) => t.source !== 'recurring' && t.source !== 'topup').map((t) => dateStr(new Date(t.ts))));
  let d = new Date();
  if (!days.has(dateStr(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days.has(dateStr(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? ctx[k] : ''));
}

export function feedLine(petId, ctx) {
  return fill(pick(DIALOG[petId].feed), ctx);
}

export function idleLine(petId, share, ctx) {
  const tier = share < 0.13 ? 'low' : share < 0.32 ? 'mid' : 'high';
  return fill(pick(DIALOG[petId].idle[tier]), ctx);
}

/* ---------- recurring ---------- */

function clampDay(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
}

export function initNextDue(day) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (day <= now.getDate()) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(clampDay(y, m, day)).padStart(2, '0')}`;
}

function advanceDue(dueStr, day) {
  const [y, m] = dueStr.split('-').map(Number);
  let nextY = y, nextMIdx = m; // m is 1-based, so m itself is the 0-based index of the next month
  if (nextMIdx > 11) { nextMIdx = 0; nextY += 1; }
  const d = clampDay(nextY, nextMIdx, day);
  return `${nextY}-${String(nextMIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function postDue(recurring) {
  const today = dateStr(new Date());
  const newTxs = [];
  const updated = [];
  for (const r of recurring) {
    let changed = false;
    let guard = 0;
    while (r.nextDue && r.nextDue <= today && guard < 24) {
      newTxs.push({
        id: uid(),
        kind: 'expense',
        amount: r.amount,
        catId: r.catId,
        note: r.name,
        ts: new Date(r.nextDue + 'T12:00:00').getTime(),
        source: 'recurring',
        payId: r.payId || 'sinopac'
      });
      r.nextDue = advanceDue(r.nextDue, r.day);
      changed = true;
      guard++;
    }
    if (changed) updated.push(r);
  }
  return { newTxs, updated };
}
