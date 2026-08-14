import 'server-only';
import { createHmac } from 'crypto';
import { ServerConfigurationError } from './configuration-error';

type Entry<T> = { value: T; expiresAt: number; staleUntil: number; bytes: number };

const MAX_ENTRIES = 200;
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const MAX_TRACKED_SCOPES = 500;
const entries = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<{ value: unknown; cache: 'miss' | 'stale' }>>();
const scopeGenerations = new Map<string, number>();
let cachedBytes = 0;

function estimateBytes(value: unknown): number {
  try {
    if (value === undefined || value === null) return 1;
    if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
    if (Buffer.isBuffer(value)) return value.byteLength;
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return MAX_CACHE_BYTES + 1;
  }
}

function deleteEntry(key: string): void {
  const entry = entries.get(key);
  if (entry) cachedBytes = Math.max(0, cachedBytes - entry.bytes);
  entries.delete(key);
}

function trim(): void {
  while (entries.size > MAX_ENTRIES || cachedBytes > MAX_CACHE_BYTES) {
    deleteEntry(entries.keys().next().value!);
  }
}

export function createCacheScope(sessionId: string, ra: string): string {
  const configured = process.env.SESSION_CACHE_SCOPE_KEY || process.env.SESSION_ENCRYPTION_KEY || process.env.SESSION_ENCRYPTION_KEYS?.split(',')[0]?.split(':')[1];
  if (!configured || !/^[a-fA-F0-9]{64}$/.test(configured)) {
    throw new ServerConfigurationError('SESSION_CACHE_SCOPE_KEY or SESSION_ENCRYPTION_KEY(S) is required');
  }
  const subkey = createHmac('sha256', Buffer.from(configured, 'hex')).update('sapoconnect:cache-scope:v1:subkey').digest();
  return createHmac('sha256', subkey).update(`${sessionId}:${ra}`).digest('base64url');
}

export function invalidateCacheScope(scope?: string): void {
  if (!scope) return;
  Array.from(entries.keys()).forEach((key) => { if (key.startsWith(`${scope}:`)) deleteEntry(key); });
  Array.from(inflight.keys()).forEach((key) => { if (key.startsWith(`${scope}:`)) inflight.delete(key); });
  const nextGeneration = (scopeGenerations.get(scope) ?? 0) + 1;
  scopeGenerations.delete(scope);
  scopeGenerations.set(scope, nextGeneration);
  while (scopeGenerations.size > MAX_TRACKED_SCOPES) {
    scopeGenerations.delete(scopeGenerations.keys().next().value!);
  }
}

export async function getOrLoad<T>(
  scope: string,
  name: string,
  loader: () => Promise<T>,
  options: {
    ttlMs?: number;
    staleMs?: number;
    canServeStale?: (error: unknown) => boolean;
  } = {},
): Promise<{ value: T; cache: 'hit' | 'miss' | 'stale' }> {
  const key = `${scope}:${name}`;
  const now = Date.now();
  const cached = entries.get(key) as Entry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    entries.delete(key); entries.set(key, cached);
    return { value: cached.value, cache: 'hit' };
  }
  const current = inflight.get(key);
  if (current) return current as Promise<{ value: T; cache: 'miss' | 'stale' }>;

  const generation = scopeGenerations.get(scope) ?? 0;
  const operationRef: { current?: Promise<{ value: T; cache: 'miss' | 'stale' }> } = {};
  const operation = (async (): Promise<{ value: T; cache: 'miss' | 'stale' }> => {
    try {
      const value = await Promise.resolve().then(loader);
      if ((scopeGenerations.get(scope) ?? 0) === generation) {
        const storedAt = Date.now();
        const ttlMs = options.ttlMs ?? 60_000;
        const bytes = estimateBytes(value);
        deleteEntry(key);
        if (bytes <= MAX_CACHE_BYTES) {
          entries.set(key, {
            value,
            expiresAt: storedAt + ttlMs,
            staleUntil: storedAt + ttlMs + (options.staleMs ?? 0),
            bytes,
          });
          cachedBytes += bytes;
          trim();
        }
      }
      return { value, cache: 'miss' };
    } catch (error) {
      if (
        cached &&
        cached.staleUntil > Date.now() &&
        options.canServeStale?.(error) === true &&
        (scopeGenerations.get(scope) ?? 0) === generation
      ) {
        return { value: cached.value, cache: 'stale' };
      }
      throw error;
    } finally {
      if (inflight.get(key) === operationRef.current) inflight.delete(key);
    }
  })();
  operationRef.current = operation;
  inflight.set(key, operation as Promise<{ value: unknown; cache: 'miss' | 'stale' }>);
  return operation;
}
