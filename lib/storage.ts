import { encrypt, decrypt, getDeviceId, getOrCreateDeviceId, setDeviceId } from './crypto';

const DB_NAME = 'sapoconnect_db';
const DB_VERSION = 2;
const STORE_NAME = 'credentials';
const CACHE_STORE_NAME = 'query_cache';

interface StoredCredentials {
  encrypted: string;
  salt: string;
  iv: string;
  timestamp: number;
  deviceId?: string;
}

interface Credentials {
  codUsuario: string;
  senha: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME);
      }
    };
  });
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  const data = JSON.stringify(credentials);
  const { encrypted, salt, iv } = await encrypt(data, deviceId);

  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const storedData: StoredCredentials = {
    encrypted,
    salt,
    iv,
    timestamp: Date.now(),
    deviceId,
  };

  return new Promise((resolve, reject) => {
    const request = store.put(storedData, 'user_credentials');
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function getCredentials(): Promise<Credentials | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('user_credentials');

      request.onsuccess = async () => {
        db.close();
        const storedData = request.result as StoredCredentials | undefined;

        if (!storedData) {
          resolve(null);
          return;
        }

        try {
          let deviceId = getDeviceId();

          if (!deviceId && storedData.deviceId) {
            deviceId = storedData.deviceId;
            try {
              setDeviceId(deviceId);
            } catch {
              // ignore storage errors
            }
          }

          if (!deviceId) {
            resolve(null);
            return;
          }

          const decrypted = await decrypt(
            storedData.encrypted,
            storedData.salt,
            storedData.iv,
            deviceId
          );
          const credentials: Credentials = JSON.parse(decrypted);
          resolve(credentials);
        } catch (error) {
          resolve(null);
        }
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete('user_credentials');
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function hasStoredCredentials(): Promise<boolean> {
  const credentials = await getCredentials();
  return credentials !== null;
}

export async function saveQueryCache(key: string, data: unknown): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(CACHE_STORE_NAME);

  const payload = {
    data,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(payload, key);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function getQueryCache<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CACHE_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        db.close();
        const stored = request.result as { data?: T } | undefined;
        resolve(stored?.data ?? null);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
}

export async function clearQueryCache(key?: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(CACHE_STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = key ? store.delete(key) : store.clear();
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
