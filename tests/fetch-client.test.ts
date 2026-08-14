import { afterEach, describe, expect, it, vi } from 'vitest';

const manager = vi.hoisted(() => ({
  getCurrentState: vi.fn(() => ({ status: 'active', user: { ra: '123' } })),
  markSessionActive: vi.fn(),
  markSessionExpired: vi.fn(),
  preemptiveRefreshIfNeeded: vi.fn(async () => true),
  refreshSession: vi.fn(async () => true),
}));

vi.mock('@/lib/session-manager', () => ({ getSessionManager: () => manager }));

import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('authenticated fetch replay', () => {
  it('performs one singleflight refresh and one replay after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/api/faltas/completo');
    expect(response.status).toBe(200);
    expect(manager.refreshSession).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never loops when the replay also returns 401', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/faltas/completo')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(manager.refreshSession).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
