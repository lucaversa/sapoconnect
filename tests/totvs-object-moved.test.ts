import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  ensureTotvsContext: vi.fn(async () => {}),
  fetchTotvs: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => ({
    cacheScope: 'scope-object-moved',
    externalCookies: { aspNetSessionId: 'asp', aspxAuth: 'auth' },
  })),
}));
vi.mock('@/lib/external-auth', () => ({ formatCookiesForRequest: () => 'ASP.NET_SessionId=asp;.ASPXAUTH=auth' }));
vi.mock('@/lib/totvs-context', () => ({
  ensureTotvsContext: mocks.ensureTotvsContext,
  TotvsContextError: class TotvsContextError extends Error {},
}));
vi.mock('@/lib/server/cache', () => ({
  getOrLoad: async (_scope: string, _key: string, loader: () => Promise<unknown>) => ({ value: await loader(), cache: 'miss' }),
}));
vi.mock('@/lib/server/upstream', () => ({
  fetchTotvs: mocks.fetchTotvs,
  isTransientUpstreamError: () => false,
  UpstreamTimeoutError: class UpstreamTimeoutError extends Error {},
}));

import { fetchTOTVS } from '@/lib/totvs-api';

describe('TOTVS Object moved recovery', () => {
  it('forces context once and replays the read once', async () => {
    mocks.fetchTotvs
      .mockResolvedValueOnce(new Response('Object moved GetContextoAluno', { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>horário válido</html>', { status: 200 }));

    await expect(fetchTOTVS('/EducaMobile/test')).resolves.toContain('horário válido');
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(2);
    expect(mocks.ensureTotvsContext).toHaveBeenNthCalledWith(2, expect.any(String), 'scope-object-moved', true);
  });
});
