const DB_NAME = 'learning-map';
const DB_VERSION = 1;
const STORE = 'settings';
const CONNECTION_KEY = 'github-connection';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, operation) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function getConnection() {
  return transact('readonly', (store) => store.get(CONNECTION_KEY));
}

export function saveConnection(connection) {
  return transact('readwrite', (store) => store.put(connection, CONNECTION_KEY));
}

export function clearConnection() {
  return transact('readwrite', (store) => store.delete(CONNECTION_KEY));
}
