const NAME = 'pet-ledger';
const VERSION = 3;
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

export async function getAll(store) {
  const d = await db();
  return reqP(d.transaction(store).objectStore(store).getAll());
}

export async function put(store, value) {
  const d = await db();
  return reqP(d.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function del(store, id) {
  const d = await db();
  return reqP(d.transaction(store, 'readwrite').objectStore(store).delete(id));
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
