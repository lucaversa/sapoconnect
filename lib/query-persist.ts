import type { Query } from '@tanstack/react-query';

export const QUERY_PERSIST_SCHEMA_VERSION = 2;
export const QUERY_PERSIST_KEY_PREFIX = `sapoconnect-query-cache:v${QUERY_PERSIST_SCHEMA_VERSION}`;
export const QUERY_PERSIST_THROTTLE_MS = 750;
export const QUERY_PERSIST_RETENTION = 'until-logout' as const;

const PERSISTED_QUERY_ROOTS = new Set([
  'avaliacoes',
  'aula-detalhe',
  'calendario',
  'faltas',
  'historico',
  'ava',
]);

export function getPersistKeyForScope(cacheScope: string): string {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(cacheScope)) {
    throw new Error('Escopo de cache invalido');
  }

  return `${QUERY_PERSIST_KEY_PREFIX}:${cacheScope}`;
}

export function shouldPersistQuery(query: Query): boolean {
  const [root] = query.queryKey;
  return (
    typeof root === 'string' &&
    PERSISTED_QUERY_ROOTS.has(root) &&
    query.state.status === 'success' &&
    query.state.data !== undefined
  );
}

export function isCurrentPersistKey(key: string): boolean {
  return key.startsWith(`${QUERY_PERSIST_KEY_PREFIX}:`);
}
