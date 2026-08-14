import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createCacheScope, getOrLoad, invalidateCacheScope } from '@/lib/server/cache';

beforeEach(() => {
  process.env.SESSION_CACHE_SCOPE_KEY = '55'.repeat(32);
});

describe('session-scoped upstream cache', () => {
  it('creates stable, identity-specific opaque scopes', () => {
    expect(createCacheScope('session-a', 'ra-a')).toBe(createCacheScope('session-a', 'ra-a'));
    expect(createCacheScope('session-a', 'ra-a')).not.toBe(createCacheScope('session-a', 'ra-b'));
  });

  it('coalesces concurrent loads inside one scope', async () => {
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const first = getOrLoad('scope-coalesce', 'faltas', loader);
    const second = getOrLoad('scope-coalesce', 'faltas', loader);
    await Promise.resolve();
    resolve('shared');

    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 'shared', cache: 'miss' },
      { value: 'shared', cache: 'miss' },
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('never shares entries across scopes', async () => {
    const loader = vi.fn(async () => loader.mock.calls.length);
    const first = await getOrLoad('scope-a', 'notas', loader);
    const second = await getOrLoad('scope-b', 'notas', loader);
    expect(first.value).toBe(1);
    expect(second.value).toBe(2);
  });

  it('serves bounded stale data when a transient reload fails', async () => {
    vi.useFakeTimers();
    const scope = 'scope-stale';
    await getOrLoad(scope, 'horario', async () => 'cached', { ttlMs: 10, staleMs: 100 });
    await vi.advanceTimersByTimeAsync(20);
    const failingLoader = vi.fn(async () => { throw new Error('TOTVS offline'); });
    const transientOnly = (error: unknown) => error instanceof Error && error.message === 'TOTVS offline';
    const first = getOrLoad(scope, 'horario', failingLoader, { ttlMs: 10, staleMs: 100, canServeStale: transientOnly });
    const second = getOrLoad(scope, 'horario', failingLoader, { ttlMs: 10, staleMs: 100, canServeStale: transientOnly });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 'cached', cache: 'stale' },
      { value: 'cached', cache: 'stale' },
    ]);
    expect(failingLoader).toHaveBeenCalledTimes(1);
    invalidateCacheScope(scope);
    vi.useRealTimers();
  });

  it('never serves stale data for authentication or parsing failures', async () => {
    vi.useFakeTimers();
    const scope = 'scope-non-transient';
    await getOrLoad(scope, 'horario', async () => 'cached', { ttlMs: 10, staleMs: 100 });
    await vi.advanceTimersByTimeAsync(20);

    const authFailure = Object.assign(new Error('expired'), { status: 401 });
    await expect(getOrLoad(
      scope,
      'horario',
      async () => { throw authFailure; },
      { ttlMs: 10, staleMs: 100, canServeStale: () => false }
    )).rejects.toBe(authFailure);
    invalidateCacheScope(scope);
    vi.useRealTimers();
  });

  it('does not retain a single value larger than the byte budget', async () => {
    const scope = 'scope-large';
    const large = 'x'.repeat(8 * 1024 * 1024 + 1);
    const loader = vi.fn(async () => large);
    await getOrLoad(scope, 'oversized', loader);
    await getOrLoad(scope, 'oversized', loader);
    expect(loader).toHaveBeenCalledTimes(2);
    invalidateCacheScope(scope);
  });

  it('retains successful void leases such as TOTVS context validation', async () => {
    const scope = 'scope-void-lease';
    const loader = vi.fn(async () => undefined);
    await getOrLoad(scope, 'totvs-context', loader, { ttlMs: 30_000 });
    const second = await getOrLoad(scope, 'totvs-context', loader, { ttlMs: 30_000 });
    expect(second.cache).toBe('hit');
    expect(loader).toHaveBeenCalledOnce();
    invalidateCacheScope(scope);
  });
});
