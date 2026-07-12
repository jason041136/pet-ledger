import * as store from './db.js';
import { PETS, CATS, DEFAULT_CATS, DEFAULT_PAYMENTS, setCats, petById, catById } from './data.js';
import { fmt, dateStr, monthTxs, petTotals, spendTotal, isSpend, recommendPlan, catCount, daysSinceFed, streak, feedLine, idleLine, initNextDue, postDue } from './engine.js';
import { doSync } from './sync.js';

let txs = [];
let recurring = [];
let cats = [];
let payments = [];
let selectedPay = 'cash';
let pending = [];
let syncCfg = { url: '', token: '', last: 0 };
let theme = 'auto';
let editingCat = null;
let tab = 'entry';
let amount = '';
let noteVal = '';
let entryStep = 1;
let ledgerDate = new Date();
let ledgerMode = 'list';

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

async function reload() {
  txs = await store.getAll('tx');
  recurring = await store.getAll('recurring');
  cats = (await store.getAll('cats')).sort((a, b) => (a.order || 0) - (b.order || 0));
  setCats(cats);
  txs.sort((a, b) => b.ts - a.ts);
  payments = (await store.getAll('payments')).sort((a, b) => (a.order || 0) - (b.order || 0));
  const lastPay = await store.getKV('lastPay');
  if (lastPay && payments.some((p) => p.id === lastPay)) selectedPay = lastPay;
  pending = (await store.getKV('pending')) || [];
  syncCfg = {
    url: (await store.getKV('syncUrl')) || '',
    token: (await store.getKV('syncToken')) || '',
    last: (await store.getKV('lastSync')) || 0
  };
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

function renderEntry() {
  if (entryStep === 1) renderStep1();
  else if (entryStep === 2) renderStep2();
  else renderStep3();
}

function renderStep1() {
  const pendHtml = pending.length ? `
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
    ${stepDots(1)}
    <div class="amount-box"><span class="cur">NT$</span><span class="num zero" id="amt">0</span></div>
    <input class="note-input" id="note" placeholder="備註（選填）" autocomplete="off" value="${noteVal.replace(/"/g, '&quot;')}">
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
      <button data-key="C" class="fn">C</button>
      <button data-key="0">0</button>
      <button data-key="B" class="fn">⌫</button>
    </div>
    <button class="btn next-btn" data-act="next-step">下一步：選支付方式　›</button>`;
  updateAmt();
}

function renderStep2() {
  const cards = payments.map((p) => {
    const bal = p.type === 'easycard' ? `<span class="pb">${fmt(p.balance || 0)}</span>` : '';
    return `<button class="pay-card ${p.id === selectedPay ? 'on' : ''}" data-pay="${p.id}">
      <span class="pe">${p.emo}</span><span class="pn">${p.name}</span>${bal}</button>`;
  }).join('');
  const easy = payments.find((p) => p.type === 'easycard');

  view.innerHTML = `
    ${stepDots(2)}
    <div class="step-head">
      <button class="step-back" data-act="back-step" data-to="1">‹</button>
      <div>
        <div class="step-amt">NT$ ${Number(amount).toLocaleString('zh-TW')}</div>
        <div class="step-sub">用什麼付？</div>
      </div>
    </div>
    <div class="pay-grid">${cards}</div>
    ${easy ? `<button class="btn ghost" data-act="topup" style="margin-top:14px">➕ 悠遊卡加值（餘額 ${fmt(easy.balance || 0)}）</button>` : ''}`;
}

function renderStep3() {
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

function updateAmt() {
  const el = document.getElementById('amt');
  if (!el) return;
  el.textContent = amount ? Number(amount).toLocaleString('zh-TW') : '0';
  el.classList.toggle('zero', !amount);
}

function pressKey(k) {
  if (k === 'C') amount = '';
  else if (k === 'B') amount = amount.slice(0, -1);
  else if (amount.length < 9 && !(amount === '' && k === '0')) amount += k;
  updateAmt();
}

async function saveTx(catId) {
  const amt = Number(amount);
  const cat = catById(catId);
  const pet = petById(cat.pet);
  if (!amt) {
    showToast(`${pet.name}：先輸入金額，再決定餵我多少啦！`, pet.color);
    return;
  }
  const note = noteVal.trim();
  await store.put('tx', { id: store.uid(), amount: amt, catId, note, ts: Date.now(), source: 'manual', payId: selectedPay });
  let balWarn = '';
  const pay = payments.find((p) => p.id === selectedPay);
  if (pay && pay.type === 'easycard') {
    pay.balance = (pay.balance || 0) - amt;
    await store.put('payments', pay);
    if (pay.balance < 100) balWarn = `（悠遊卡只剩 ${fmt(pay.balance)}，該加值囉！）`;
  }
  await reload();
  const now = new Date();
  const mt = monthTxs(txs, now.getFullYear(), now.getMonth());
  const line = feedLine(pet.id, { n: catCount(mt, catId), cat: cat.name, amt: fmt(amt) });
  amount = '';
  noteVal = '';
  entryStep = 1;
  renderEntry();
  showToast(`${pet.name}：${line}${balWarn}`, pet.color);
}

async function topupEasycard() {
  const pay = payments.find((p) => p.id === selectedPay && p.type === 'easycard') || payments.find((p) => p.type === 'easycard');
  if (!pay) return;
  const val = prompt(`悠遊卡加值金額（目前餘額 ${fmt(pay.balance || 0)}）`, '500');
  if (val === null) return;
  const amt = Number(val);
  if (!amt || amt <= 0) {
    showToast('金額不對喔');
    return;
  }
  pay.balance = (pay.balance || 0) + amt;
  await store.put('payments', pay);
  await store.put('tx', { id: store.uid(), amount: amt, catId: '', note: '悠遊卡加值', ts: Date.now(), source: 'topup', payId: pay.id });
  await reload();
  renderEntry();
  showToast(`🔋 已加值 ${fmt(amt)}，餘額 ${fmt(pay.balance)}（提示：改用永豐 DAWHO 自動加值可多賺 +3%）`);
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
    await store.put('tx', { id: 'p_' + id, amount: Number(p.amount), catId, note: p.merchant, ts, source: 'email' });
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

/* ================= home ================= */

function renderHome() {
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
      <img src="img/pets/${p.id}_${state}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div class="pet-svg" style="display:none">${p.svg}</div>
    </div>`;
  }).join('');
  const labels = PETS.map((p) => {
    const pct = monthTotal ? Math.round(((totals[p.id] || 0) / monthTotal) * 100) : 0;
    return `<div><div class="n">${p.name}</div><div class="c">${p.title} ${pct}%</div></div>`;
  }).join('');

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

  view.innerHTML = `
    <div class="bubble"><span id="bubble-text"></span></div>
    <div class="scene">${petsHtml}</div>
    <div class="pet-labels">${labels}</div>
    ${recHtml}
    <div class="stat-row">
      <div class="stat"><div class="k">本月支出</div><div class="v">${fmt(monthTotal)}</div></div>
      <div class="stat"><div class="k">連續記帳</div><div class="v">${streak(txs)} 天</div></div>
      <div class="stat"><div class="k">本月最肥</div><div class="v">${king ? king.name : '—'}</div></div>
    </div>`;

  if (!monthTotal) setBubble('這個月還沒有帳目…記下第一筆，餵餵大家吧！', null);
  else petSpeak(king.id, false);
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

function renderLedger() {
  const y = ledgerDate.getFullYear();
  const m = ledgerDate.getMonth();
  const mt = monthTxs(txs, y, m);
  const monthTotal = spendTotal(mt);

  const body = ledgerMode === 'list' ? ledgerList(mt) : ledgerStats(mt, y, m);

  view.innerHTML = `
    <div class="month-nav">
      <button data-act="prev-month">‹</button>
      <span class="m">${y} 年 ${m + 1} 月 · ${fmt(monthTotal)}</span>
      <button data-act="next-month">›</button>
    </div>
    <div class="seg">
      <button data-act="mode-list" class="${ledgerMode === 'list' ? 'on' : ''}">明細</button>
      <button data-act="mode-stats" class="${ledgerMode === 'stats' ? 'on' : ''}">分析</button>
    </div>
    ${body}`;
}

function ledgerList(mt) {
  const totals = petTotals(mt);
  const chips = PETS.map((p) =>
    `<span class="pt" style="border-color:${p.color}">${p.name} ${fmt(totals[p.id] || 0)}</span>`
  ).join('');

  const byDay = {};
  for (const t of mt) {
    const k = dateStr(new Date(t.ts));
    (byDay[k] = byDay[k] || []).push(t);
  }
  const days = Object.keys(byDay).sort().reverse();
  const list = days.map((k) => {
    const d = new Date(k + 'T12:00:00');
    const rows = byDay[k].map((t) => {
      const pay = payments.find((x) => x.id === t.payId);
      const payTag = pay ? ` <span class="paytag">${pay.emo}${pay.name}</span>` : '';
      if (t.source === 'topup') {
        return `<div class="tx-row topup-row">
          <span class="emo">🔋</span>
          <div class="mid"><div class="cat">悠遊卡加值${payTag}</div></div>
          <span class="amt">+${fmt(t.amount)}</span>
          <button class="del" data-del="${t.id}">✕</button>
        </div>`;
      }
      const c = catById(t.catId);
      const p = petById(c.pet);
      return `<div class="tx-row">
        <span class="emo">${c.emo}</span>
        <div class="mid">
          <div class="cat">${c.name}${t.source === 'recurring' ? ' 🔁' : ''}${payTag}</div>
          ${t.note ? `<div class="note">${t.note}</div>` : ''}
        </div>
        <span class="amt" style="color:${p.deep}">${fmt(t.amount)}</span>
        <button class="del" data-del="${t.id}">✕</button>
      </div>`;
    }).join('');
    return `<div class="day-head">${d.getMonth() + 1}/${d.getDate()}（週${WEEK[d.getDay()]}）</div>${rows}`;
  }).join('');

  return `<div class="pet-totals">${chips}</div>${list || '<div class="empty">這個月沒有帳目</div>'}`;
}

function ledgerStats(mt, y, m) {
  mt = mt.filter(isSpend);
  if (!mt.length) return '<div class="empty">這個月沒有帳目，沒東西好分析</div>';

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

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
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
    <h2>怪獸佔比</h2>
    <div class="card"><div class="donut-wrap"><svg viewBox="0 0 120 120">${arcs}</svg><div class="legend">${legend}</div></div></div>
    <h2>分類排行</h2>
    <div class="card">${bars}</div>
    <h2>支付方式</h2>
    <div class="card">${payBars || '<div class="sub">本月帳目還沒有支付方式標記</div>'}</div>
    <h2>近六個月趨勢</h2>
    <div class="card"><div class="trend">${trend}</div></div>`;
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

  view.innerHTML = `
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

    <h2>支付方式</h2>
    <div class="card">
      ${payments.map((p) => `<div class="rec-row">
        <span class="emo">${p.emo}</span>
        <div class="mid">
          <div class="name">${p.name}</div>
          ${p.type === 'easycard' ? `<div class="info">餘額 ${fmt(p.balance || 0)}</div>` : ''}
        </div>
        ${p.type === 'easycard' ? `<button class="del" data-editbal="${p.id}">✎</button>` : ''}
        ${p.type === 'card' ? `<button class="del" data-delpay="${p.id}">✕</button>` : ''}
      </div>`).join('')}
    </div>
    <div class="card">
      <div class="sub">新增信用卡／支付方式</div>
      <div class="form-grid">
        <input id="pay-name" class="full" placeholder="名稱（例如 國泰CUBE卡）" autocomplete="off">
      </div>
      <button class="btn" data-act="add-pay">新增</button>
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
  const payload = { app: 'pet-ledger', exportedAt: new Date().toISOString(), txs, recurring, cats, payments, theme };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pet-ledger-backup-${dateStr(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
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
  else renderSettings();
}

tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  tab = btn.dataset.tab;
  if (tab === 'ledger') ledgerDate = new Date();
  render();
});

view.addEventListener('click', async (e) => {
  const key = e.target.closest('[data-key]');
  if (key) return pressKey(key.dataset.key);

  const chip = e.target.closest('[data-cat]');
  if (chip) return saveTx(chip.dataset.cat);

  const pet = e.target.closest('[data-pet]');
  if (pet) return petSpeak(pet.dataset.pet);

  const payBtn = e.target.closest('[data-pay]');
  if (payBtn) {
    selectedPay = payBtn.dataset.pay;
    await store.setKV('lastPay', selectedPay);
    if (tab === 'entry' && entryStep === 2) entryStep = 3;
    renderEntry();
    return;
  }

  const editbal = e.target.closest('[data-editbal]');
  if (editbal) {
    const p = payments.find((x) => x.id === editbal.dataset.editbal);
    const val = prompt('校正悠遊卡餘額（輸入實際餘額）', String(p.balance || 0));
    if (val === null) return;
    p.balance = Number(val) || 0;
    await store.put('payments', p);
    await reload();
    renderSettings();
    return;
  }

  const delpay = e.target.closest('[data-delpay]');
  if (delpay) {
    const p = payments.find((x) => x.id === delpay.dataset.delpay);
    if (confirm(`刪除支付方式「${p.name}」？（帳目紀錄會保留）`)) {
      await store.del('payments', p.id);
      await reload();
      renderSettings();
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
    if (!Number(amount)) {
      showToast('先輸入金額喔！');
      return;
    }
    noteVal = document.getElementById('note')?.value || '';
    entryStep = 2;
    return renderEntry();
  }
  if (a === 'back-step') {
    entryStep = Number(act.dataset.to) || 1;
    return renderEntry();
  }
  if (a === 'add-rec') return addRec();
  if (a === 'add-cat') return addCat();
  if (a === 'save-cat') return saveCatEdit();
  if (a === 'cancel-cat') {
    editingCat = null;
    return renderSettings();
  }
  if (a === 'topup') return topupEasycard();
  if (a === 'add-pay') {
    const name = document.getElementById('pay-name').value.trim();
    if (!name) {
      showToast('先取個名字，例如 國泰CUBE卡');
      return;
    }
    const order = Math.max(0, ...payments.map((p) => p.order || 0)) + 1;
    await store.put('payments', { id: 'pay_' + store.uid().slice(0, 8), name, emo: '💳', type: 'card', order });
    await reload();
    renderSettings();
    showToast(`已新增支付方式：💳 ${name}`);
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
  if (a === 'import') return document.getElementById('import-file').click();
  if (a === 'mode-list') { ledgerMode = 'list'; return renderLedger(); }
  if (a === 'mode-stats') { ledgerMode = 'stats'; return renderLedger(); }
  if (a === 'prev-month') { ledgerDate.setMonth(ledgerDate.getMonth() - 1); return renderLedger(); }
  if (a === 'next-month') { ledgerDate.setMonth(ledgerDate.getMonth() + 1); return renderLedger(); }
});

/* ================= boot ================= */

async function boot() {
  const savedTheme = await store.getKV('theme');
  if (savedTheme) applyTheme(savedTheme);

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

  await reload();
  const { newTxs, updated } = postDue(recurring);
  if (newTxs.length) {
    for (const t of newTxs) await store.put('tx', t);
    for (const r of updated) await store.put('recurring', r);
    await reload();
    const names = [...new Set(newTxs.map((t) => t.note))].join('、');
    showToast(`🔁 定期開支已自動入帳：${names}`);
  }
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
