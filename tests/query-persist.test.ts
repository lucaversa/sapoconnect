import { describe, expect, it } from 'vitest';
import type { Query } from '@tanstack/react-query';
import {
  QUERY_PERSIST_RETENTION,
  QUERY_PERSIST_THROTTLE_MS,
  getPersistKeyForScope,
  isCurrentPersistKey,
  shouldPersistQuery,
} from '@/lib/query-persist';

function query(root: string, status: 'success' | 'pending' = 'success', data: unknown = {}) {
  return { queryKey: [root], state: { status, data } } as unknown as Query;
}

describe('persisted query isolation', () => {
  it('namespaces persisted state by opaque session scope', () => {
    const key = getPersistKeyForScope('scope_12345678');
    expect(key).toContain('scope_12345678');
    expect(isCurrentPersistKey(key)).toBe(true);
    expect(() => getPersistKeyForScope('../unsafe')).toThrow();
  });

  it('keeps A → B → A cache namespaces deterministic and isolated', () => {
    const firstA = getPersistKeyForScope('scope_AAAAAAAA');
    const userB = getPersistKeyForScope('scope_BBBBBBBB');
    const secondA = getPersistKeyForScope('scope_AAAAAAAA');
    expect(secondA).toBe(firstA);
    expect(userB).not.toBe(firstA);
  });

  it('persists only successful academic queries', () => {
    expect(shouldPersistQuery(query('faltas'))).toBe(true);
    expect(shouldPersistQuery(query('ava'))).toBe(true);
    expect(shouldPersistQuery(query('session'))).toBe(false);
    expect(shouldPersistQuery(query('faltas', 'pending'))).toBe(false);
    expect(
      shouldPersistQuery({ queryKey: ['faltas'], state: { status: 'success', data: undefined } } as unknown as Query)
    ).toBe(false);
  });

  it('persists successful data quickly enough for immediate module changes', () => {
    expect(QUERY_PERSIST_THROTTLE_MS).toBeLessThanOrEqual(1_000);
  });

  it('retains the latest successful snapshot until explicit cleanup', () => {
    expect(QUERY_PERSIST_RETENTION).toBe('until-logout');
  });
});
