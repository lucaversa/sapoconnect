import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { fetchTotvs, UpstreamTimeoutError } from '@/lib/server/upstream';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('TOTVS transport budget', () => {
  it('retries a transient idempotent read once with jitter', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchTotvs('https://totvs.invalid/data', { method: 'GET' }, { idempotentRead: true });
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-idempotent requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTotvs('https://totvs.invalid/login', { method: 'POST' })).resolves.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry after the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    const fetchMock = vi.fn((_input, init: RequestInit) => Promise.reject(init.signal?.reason));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchTotvs('https://totvs.invalid/data', { method: 'GET', signal: controller.signal }, { idempotentRead: true })
    ).rejects.toThrow('cancelled');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps retry and jitter inside one total deadline', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const startedAt = Date.now();

    const pending = fetchTotvs(
      'https://totvs.invalid/data',
      { method: 'GET' },
      { idempotentRead: true, timeoutMs: 50 }
    );
    const rejection = expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError);

    await vi.advanceTimersByTimeAsync(49);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(Date.now() - startedAt).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
