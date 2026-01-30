export const QUERY_PERSIST_KEY_PREFIX = 'sapoconnect_query_cache_v1';
export const QUERY_PERSIST_USER_KEY = 'sapoconnect_current_ra';
export const QUERY_PERSIST_THROTTLE_MS = 1000;

export const QUERY_PERSIST_KEY = QUERY_PERSIST_KEY_PREFIX;

export function getPersistKeyForUser(ra?: string | null): string {
  if (ra) {
    return `${QUERY_PERSIST_KEY_PREFIX}_${ra}`;
  }
  return QUERY_PERSIST_KEY_PREFIX;
}

export function getPersistKeyFromStorage(): string {
  try {
    const ra = localStorage.getItem(QUERY_PERSIST_USER_KEY);
    return getPersistKeyForUser(ra);
  } catch {
    return QUERY_PERSIST_KEY_PREFIX;
  }
}
