import { encrypt, decrypt, getOrCreateDeviceId } from './crypto';

const DB_NAME = 'sapoconnect_db';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';

interface StoredCredentials {
  encrypted: string;
  salt: string;
  iv: string;
  timestamp: number;
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
          const deviceId = getOrCreateDeviceId();
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