const NAME = 'pet-ledger';
const VERSION = 4;
let _db = null;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tx')) db.createObjectStore('tx', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('recurring')) db.createObjectStore('recurring', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cats')) db.createObjectStore('cats', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('payments')) db.createObjectStore('payments', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('inccats')) db.createObjectStore('inccats', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function db() {
  if (!_db) _db = await open();
  return _db;
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* 設定類資料（分類/帳戶/定期開支）會同步到雲端。
   任何寫入都自動蓋上 settingsAt 時戳，sync 靠它判斷本機與雲端誰比較新。
   開機種預設值、從雲端拉回來時要用 setQuiet(true) 包住，才不會誤判成「本機有新編輯」。 */
const SETTING_STORES = ['recurring', 'cats', 'inccats', 'payments'];
let quiet = false;

export function setQuiet(v) {
  quiet = !!v;
}

async function touchSettings(store) {
  if (quiet || !SETTING_STORES.includes(store)) return;
  await setKV('settingsAt', Date.now());
}

export async function getAll(store) {
  const d = await db();
  return reqP(d.transaction(store).objectStore(store).getAll());
}

export async function put(store, value) {
  const d = await db();
  const r = await reqP(d.transaction(store, 'readwrite').objectStore(store).put(value));
  await touchSettings(store);
  return r;
}

export async function del(store, id) {
  const d = await db();
  const r = await reqP(d.transaction(store, 'readwrite').objectStore(store).delete(id));
  await touchSettings(store);
  return r;
}

export async function clear(store) {
  const d = await db();
  return reqP(d.transaction(store, 'readwrite').objectStore(store).clear());
}

export async function getKV(k) {
  const d = await db();
  const row = await reqP(d.transaction('kv').objectStore('kv').get(k));
  return row ? row.v : undefined;
}

export async function setKV(k, v) {
  const d = await db();
  return reqP(d.transaction('kv', 'readwrite').objectStore('kv').put({ k, v }));
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
}
