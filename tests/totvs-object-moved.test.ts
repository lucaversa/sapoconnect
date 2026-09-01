import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { fetchTOTVS, fetchTOTVSResult } from '@/lib/totvs-api';

describe('TOTVS Object moved recovery', () => {
  beforeEach(() => {
    mocks.ensureTotvsContext.mockClear();
    mocks.fetchTotvs.mockReset();
  });

  it('forces context once and replays the read once', async () => {
    mocks.fetchTotvs
      .mockResolvedValueOnce(new Response('Object moved GetContextoAluno', { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>horário válido</html>', { status: 200 }));

    await expect(fetchTOTVS('/EducaMobile/test')).resolves.toContain('horário válido');
    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(2);
    expect(mocks.ensureTotvsContext).toHaveBeenNthCalledWith(2, expect.any(String), 'scope-object-moved', true);
    expect(mocks.fetchTotvs).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        }),
      }),
      { idempotentRead: true }
    );
  });

  it('replays the dependent-options request with the same AJAX profile as TOTVS', async () => {
    mocks.fetchTotvs.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    const refererPath =
      '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir?codGrupoAtendimento=token';

    await fetchTOTVSResult(
      '/EducaMobile/Educacional/EduAluno/GetListaOpcaoCampoParametrizadoComDependencia?parametro=1',
      '[test]',
      { requestProfile: 'ajax-json', refererPath }
    );

    expect(mocks.fetchTotvs).toHaveBeenCalledWith(
      expect.stringContaining('GetListaOpcaoCampoParametrizadoComDependencia'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: expect.stringContaining('EduAcompanhaSolicitacoesIncluir'),
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        }),
      }),
      { idempotentRead: true }
    );
  });

  it('validates the replay status before returning or caching an AJAX response', async () => {
    mocks.fetchTotvs
      .mockResolvedValueOnce(new Response('Object moved GetContextoAluno', { status: 200 }))
      .mockResolvedValueOnce(new Response('expired', { status: 401 }));

    await expect(fetchTOTVSResult(
      '/EducaMobile/Educacional/EduAluno/GetListaOpcaoCampoParametrizadoComDependencia?parametro=1',
      '[test]',
      {
        requestProfile: 'ajax-json',
        refererPath: '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir',
      }
    )).rejects.toMatchObject({
      statusCode: 401,
      debugCode: 'SESSION_EXPIRED',
    });

    expect(mocks.fetchTotvs).toHaveBeenCalledTimes(2);
    expect(mocks.fetchTotvs).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: expect.stringContaining('EduAcompanhaSolicitacoesIncluir'),
        }),
      }),
      { idempotentRead: true }
    );
  });
});
