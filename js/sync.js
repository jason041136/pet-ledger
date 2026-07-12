import * as store from './db.js';

export async function doSync() {
  const url = await store.getKV('syncUrl');
  const token = await store.getKV('syncToken');
  if (!url || !token) return { ok: false, error: 'not-configured' };

  const txs = await store.getAll('tx');
  const tombstones = (await store.getKV('tombstones')) || [];
  const pendingResolved = (await store.getKV('pendingResolved')) || [];

  let data;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, action: 'sync', txs, tombstones, pendingResolved })
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
  await store.setKV('tombstones', []);
  await store.setKV('pendingResolved', []);
  await store.setKV('pending', data.pending || []);
  await store.setKV('lastSync', Date.now());
  return { ok: true, pulled: data.txs.length, pending: (data.pending || []).length };
}
