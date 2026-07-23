import * as store from './db.js';

const SETTING_STORES = ['recurring', 'cats', 'inccats', 'payments'];

export async function doSync() {
  const url = await store.getKV('syncUrl');
  const token = await store.getKV('syncToken');
  if (!url || !token) return { ok: false, error: 'not-configured' };

  const txs = await store.getAll('tx');
  const tombstones = (await store.getKV('tombstones')) || [];
  const pendingResolved = (await store.getKV('pendingResolved')) || [];
  const dirtyIds = (await store.getKV('dirtyTx')) || [];
  const updates = txs.filter((t) => dirtyIds.includes(t.id));   // 本機編輯過、要覆蓋雲端的

  // 設定（定期開支/支出分類/收入分類/帳戶）：整包比時戳，新的覆蓋舊的
  // settingsAt 為 0＝這台裝置從沒改過設定（例如剛裝的新手機），一律以雲端為準
  const settingsAt = (await store.getKV('settingsAt')) || 0;
  const settings = {};
  for (const s of SETTING_STORES) settings[s] = await store.getAll(s);

  let data;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token, action: 'sync', txs, updates, tombstones, pendingResolved,
        settings: settingsAt ? settings : null, settingsAt
      })
    });
    data = await res.json();
  } catch {
    return { ok: false, error: 'network' };
  }
  if (!data.ok) return { ok: false, error: data.error || 'server' };

  const localById = new Map(txs.map((t) => [t.id, t]));
  for (const t of data.txs) {
    const local = localById.get(t.id);
    if (local) {
      // 雲端 Code.gs 若為舊版、沒存這些欄位，回傳時保留本機值，避免收入/轉帳/標記遺失
      if (local.payId && !t.payId) t.payId = local.payId;
      if (local.kind && !t.kind) t.kind = local.kind;
      if (local.fromPay && t.fromPay == null) t.fromPay = local.fromPay;
      if (local.toPay && t.toPay == null) t.toPay = local.toPay;
      if (local.source === 'topup') t.source = 'topup';
    }
    await store.put('tx', t);
  }
  for (const id of data.deletedIds || []) await store.del('tx', id);

  // 雲端設定比本機新 → 整包換掉（換手機、清資料後靠這個救回來）
  let settingsPulled = false;
  if (data.settings && Number(data.settingsAt || 0) > settingsAt) {
    store.setQuiet(true);
    try {
      for (const s of SETTING_STORES) {
        const rows = data.settings[s];
        if (!Array.isArray(rows)) continue;
        // 分類/帳戶不可能是空的，空的代表雲端資料有問題，寧可不動本機
        if (!rows.length && s !== 'recurring') continue;
        await store.clear(s);
        for (const row of rows) await store.put(s, row);
      }
      await store.setKV('settingsAt', Number(data.settingsAt));
      settingsPulled = true;
    } finally {
      store.setQuiet(false);
    }
  }

  await store.setKV('tombstones', []);
  await store.setKV('dirtyTx', []);
  await store.setKV('pendingResolved', []);
  await store.setKV('pending', data.pending || []);
  await store.setKV('lastSync', Date.now());
  return { ok: true, pulled: data.txs.length, pending: (data.pending || []).length, settingsPulled };
}
