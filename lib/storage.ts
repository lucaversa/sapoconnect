import { decrypt, getDeviceId, setDeviceId } from './crypto';
import { ACADEMIC_UPDATES_SCHEMA_VERSION } from './academic-updates';
import { QUERY_PERSIST_SCHEMA_VERSION } from './query-persist';

const DB_NAME = 'sapoconnect_db';
const DB_VERSION = 5;
const CREDENTIAL_STORE = 'credentials';
const CACHE_STORE = 'query_cache';
const SESSION_STORE = 'session_state';
const ACADEMIC_UPDATES_STORE = 'academic_updates';
const LEGACY_CREDENTIAL_KEY = 'user_credentials';
const MIGRATION_MARKER_KEY = 'reconnect_cookie_migration';
const LEGACY_ROLLBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const OFFLINE_SESSION_HINT_KEY = 'offline_session_hint';

export interface Credentials {
  codUsuario: string;
  senha: string;
}

interface StoredCredentials {
  encrypted: string;
  salt: string;
  iv: string;
  timestamp: number;
  deviceId?: string;
}

export interface MigrationMarker {
  confirmedAt: number;
  cacheScope?: string;
}

interface StoredQueryCache<T> {
  version: number;
  cacheScope: string;
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface StoredAcademicUpdates<T> {
  version: number;
  cacheScope: string;
  data: T;
  timestamp: number;
}

export interface OfflineSessionHint {
  ra: string;
  cacheScope: string;
  expiresAt: number;
}

export function getReconnectMigrationMode(): 'dual' | 'cookie-only' {
  return process.env.NEXT_PUBLIC_RECONNECT_MIGRATION_MODE === 'cookie-only'
    ? 'cookie-only'
    : 'dual';
}

export function resolveMigrationMarker(
  existing: MigrationMarker | undefined,
  now: number,
  cacheScope?: string
): MigrationMarker | null {
  const confirmedAt = existing?.confirmedAt;
  if (
    typeof confirmedAt === 'number' &&
    Number.isFinite(confirmedAt) &&
    confirmedAt <= now
  ) {
    if (now - confirmedAt >= LEGACY_ROLLBACK_WINDOW_MS) return null;
    return { confirmedAt, cacheScope };
  }
  return { confirmedAt: now, cacheScope };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CREDENTIAL_STORE)) {
        db.createObjectStore(CREDENTIAL_STORE);
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE);
      }
      if (!db.objectStoreNames.contains(ACADEMIC_UPDATES_STORE)) {
        db.createObjectStore(ACADEMIC_UPDATES_STORE);
      }
    };
  });
}

async function idbRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function getCredentials(): Promise<Credentials | null> {
  if (getReconnectMigrationMode() === 'cookie-only') return null;

  try {
    const storedData = await idbRequest<StoredCredentials | undefined>(
      CREDENTIAL_STORE,
      'readonly',
      (store) => store.get(LEGACY_CREDENTIAL_KEY)
    );
    if (!storedData) return null;

    let deviceId = getDeviceId();
    if (!deviceId && storedData.deviceId) {
      deviceId = storedData.deviceId;
      try {
        setDeviceId(deviceId);
      } catch {
        // Storage may be unavailable in private browsing.
      }
    }
    if (!deviceId) return null;

    const decrypted = await decrypt(
      storedData.encrypted,
      storedData.salt,
      storedData.iv,
      deviceId
    );
    const parsed = JSON.parse(decrypted) as Partial<Credentials>;
    if (typeof parsed.codUsuario !== 'string' || typeof parsed.senha !== 'string') {
      return null;
    }
    return { codUsuario: parsed.codUsuario, senha: parsed.senha };
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await Promise.all([
      idbRequest(CREDENTIAL_STORE, 'readwrite', (store) =>
        store.delete(LEGACY_CREDENTIAL_KEY)
      ),
      idbRequest(CREDENTIAL_STORE, 'readwrite', (store) =>
        store.delete(MIGRATION_MARKER_KEY)
      ),
    ]);
  } catch {
    // Clearing is best-effort when IndexedDB is unavailable.
  }
}

export async function hasStoredCredentials(): Promise<boolean> {
  return (await getCredentials()) !== null;
}

export async function markReconnectCookieConfirmed(cacheScope?: string): Promise<void> {
  try {
    if (getReconnectMigrationMode() === 'cookie-only') {
      await clearCredentials();
      return;
    }

    const existing = await idbRequest<MigrationMarker | undefined>(
      CREDENTIAL_STORE,
      'readonly',
      (store) => store.get(MIGRATION_MARKER_KEY)
    );
    const marker = resolveMigrationMarker(existing, Date.now(), cacheScope);
    if (!marker) {
      await clearCredentials();
      return;
    }
    await idbRequest(CREDENTIAL_STORE, 'readwrite', (store) =>
      store.put(marker, MIGRATION_MARKER_KEY)
    );
  } catch {
    // Authentication already succeeded; an unavailable IndexedDB must never
    // turn the migration marker into a login/refresh failure.
  }
}

export async function cleanupLegacyCredentials(): Promise<void> {
  if (getReconnectMigrationMode() === 'cookie-only') {
    await clearCredentials();
    return;
  }

  try {
    const marker = await idbRequest<MigrationMarker | undefined>(
      CREDENTIAL_STORE,
      'readonly',
      (store) => store.get(MIGRATION_MARKER_KEY)
    );
    if (marker && Date.now() - marker.confirmedAt >= LEGACY_ROLLBACK_WINDOW_MS) {
      await clearCredentials();
    }
  } catch {
    // Migration cleanup is retried on the next app start.
  }
}

export async function saveOfflineSessionHint(ra: string, cacheScope: string): Promise<void> {
  if (!ra.trim() || !/^[a-zA-Z0-9_-]{8,128}$/.test(cacheScope)) return;
  const hint: OfflineSessionHint = {
    ra: ra.trim(),
    cacheScope,
    // Zero means that the app does not expire the hint by age. The browser can
    // still evict origin storage under pressure, and explicit logout clears it.
    expiresAt: 0,
  };
  await idbRequest(SESSION_STORE, 'readwrite', (store) =>
    store.put(hint, OFFLINE_SESSION_HINT_KEY)
  );
}

export async function getOfflineSessionHint(): Promise<OfflineSessionHint | null> {
  try {
    const hint = await idbRequest<OfflineSessionHint | undefined>(
      SESSION_STORE,
      'readonly',
      (store) => store.get(OFFLINE_SESSION_HINT_KEY)
    );
    const isValid = !!hint
      && typeof hint.ra === 'string'
      && hint.ra.trim().length > 0
      && /^[a-zA-Z0-9_-]{8,128}$/.test(hint.cacheScope);

    if (!isValid) {
      await clearOfflineSessionHint();
      return null;
    }
    return hint;
  } catch {
    return null;
  }
}

export async function clearOfflineSessionHint(): Promise<void> {
  try {
    await idbRequest(SESSION_STORE, 'readwrite', (store) =>
      store.delete(OFFLINE_SESSION_HINT_KEY)
    );
  } catch {
    // Cache identity cleanup is best-effort when IndexedDB is unavailable.
  }
}

export async function saveQueryCache(
  key: string,
  cacheScope: string,
  data: unknown
): Promise<void> {
  const now = Date.now();
  const payload: StoredQueryCache<unknown> = {
    version: QUERY_PERSIST_SCHEMA_VERSION,
    cacheScope,
    data,
    timestamp: now,
    // Kept for backwards-compatible reads of the v2 payload shape. Zero means
    // retain until logout, a schema migration, or browser-managed eviction.
    expiresAt: 0,
  };
  await idbRequest(CACHE_STORE, 'readwrite', (store) => store.put(payload, key));
}

export async function getQueryCache<T>(
  key: string,
  expectedScope: string
): Promise<T | null> {
  try {
    const stored = await idbRequest<StoredQueryCache<T> | undefined>(
      CACHE_STORE,
      'readonly',
      (store) => store.get(key)
    );
    if (!stored) return null;

    const isValid =
      stored.version === QUERY_PERSIST_SCHEMA_VERSION &&
      stored.cacheScope === expectedScope;

    if (!isValid) {
      await clearQueryCache(key);
      return null;
    }
    return stored.data;
  } catch {
    return null;
  }
}

export async function clearQueryCache(key?: string): Promise<void> {
  try {
    await idbRequest(CACHE_STORE, 'readwrite', (store) =>
      key ? store.delete(key) : store.clear()
    );
  } catch {
    // Cache removal is best-effort.
  }
}

export async function saveAcademicUpdatesState(
  cacheScope: string,
  data: unknown
): Promise<void> {
  const payload: StoredAcademicUpdates<unknown> = {
    version: ACADEMIC_UPDATES_SCHEMA_VERSION,
    cacheScope,
    data,
    timestamp: Date.now(),
  };
  await idbRequest(ACADEMIC_UPDATES_STORE, 'readwrite', (store) =>
    store.put(payload, cacheScope)
  );
}

export async function getAcademicUpdatesState<T>(
  expectedScope: string
): Promise<T | null> {
  try {
    const stored = await idbRequest<StoredAcademicUpdates<T> | undefined>(
      ACADEMIC_UPDATES_STORE,
      'readonly',
      (store) => store.get(expectedScope)
    );
    if (!stored) return null;

    const isValid =
      stored.version === ACADEMIC_UPDATES_SCHEMA_VERSION &&
      stored.cacheScope === expectedScope;
    if (!isValid) {
      await clearAcademicUpdatesState(expectedScope);
      return null;
    }
    return stored.data;
  } catch {
    return null;
  }
}

export async function clearAcademicUpdatesState(cacheScope?: string): Promise<void> {
  try {
    await idbRequest(ACADEMIC_UPDATES_STORE, 'readwrite', (store) =>
      cacheScope ? store.delete(cacheScope) : store.clear()
    );
  } catch {
    // Academic update cleanup is best-effort when IndexedDB is unavailable.
  }
}
