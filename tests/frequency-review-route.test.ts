import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  class HTTPError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public debugCode: string
    ) {
      super(message);
      this.name = 'HTTPError';
    }
  }

  return {
    HTTPError,
    fetchTOTVSResult: vi.fn(),
    getSession: vi.fn(),
    getOrLoad: vi.fn(),
    isTransientUpstreamError: vi.fn(() => false),
  };
});

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/totvs-api', () => ({
  fetchTOTVSResult: mocks.fetchTOTVSResult,
  HTTPError: mocks.HTTPError,
}));
vi.mock('@/lib/server/cache', () => ({ getOrLoad: mocks.getOrLoad }));
vi.mock('@/lib/server/upstream', () => ({
  isTransientUpstreamError: mocks.isTransientUpstreamError,
}));

import { GET } from '@/app/api/faltas/datas/route';

const reviewPath =
  '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir?codGrupoAtendimento=%255cC2&codOpcaoAtendimento=%255cEB';
const requestsHtml = `
  <a href="${reviewPath.replace('&', '&amp;')}">
    REVIS&#195;O DE FREQU&#202;NCIA (REQUERIMENTOS PORTAL ALUNO)
  </a>
`;
const reviewFormHtml = `
  <form>
    <h1>REVISÃO DE FREQUÊNCIA</h1>
    <input name="NOMETIPO" value="REVISÃO DE FREQUÊNCIA" />
    <label for="field_param_53">Disciplinas para Revisão</label>
    <select id="field_param_53" onchange="onChangeCampoParametroDependencia(1, 'S', 'CRM.EDU.36.008', '54', 'PARAMETRO_53')">
      <option value="">Selecione</option>
      <option value="1-8405-160">SAÚDE DA CRIANÇA E DO ADOLESCENTE III</option>
    </select>
  </form>
`;
const emptyReviewFormShell = `
  <!DOCTYPE html>
  <html>
    <body>
      <script>var urlSessionReload = '/EducaMobile/Home/ReloadSesion';</script>
      <div data-role="page" id="main">
        <div data-role="content" id="content-main"></div>
      </div>
      <input id="hdUrlValidSession" value="/EducaMobile/Educacional/EduSessao/SessaoAtiva" />
    </body>
  </html>
`;
const source = (html: string, cache: 'hit' | 'miss' | 'stale' = 'miss') => ({
  html,
  cache,
});

describe('frequency review dates route', () => {
  beforeEach(() => {
    mocks.fetchTOTVSResult.mockReset();
    mocks.getSession.mockReset();
    mocks.getOrLoad.mockReset();
    mocks.isTransientUpstreamError.mockReset();
    mocks.isTransientUpstreamError.mockReturnValue(false);
    mocks.getSession.mockResolvedValue({ cacheScope: 'scope-faltas-datas' });
    mocks.getOrLoad.mockImplementation(async (
      _scope: string,
      _key: string,
      loader: () => Promise<unknown>
    ) => ({ value: await loader(), cache: 'miss' }));
  });

  it('returns dates for the requested discipline through a read-only flow', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source(reviewFormHtml))
      .mockResolvedValueOnce(source(JSON.stringify([
        { Selected: false, Text: '24/08/2026', Value: '24/08/2026' },
        { Selected: false, Text: '10/08/2026', Value: '10/08/2026' },
      ])));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({
      codigo: '1-8405-160',
      datasFalta: [
        { data: '2026-08-10', label: '10/08/2026' },
        { data: '2026-08-24', label: '24/08/2026' },
      ],
      datasFaltaStatus: 'ok',
      fonte: 'revisao_frequencia',
      escopo: 'disponiveis_para_revisao',
    });
    expect(mocks.getOrLoad).toHaveBeenCalledWith(
      'scope-faltas-datas',
      'source:faltas-datas:v2:1-8405-160',
      expect.any(Function),
      expect.objectContaining({ ttlMs: 45_000 })
    );
    expect(mocks.fetchTOTVSResult).toHaveBeenCalledTimes(3);
    expect(mocks.fetchTOTVSResult).toHaveBeenNthCalledWith(
      2,
      reviewPath,
      '[Faltas datas]',
      {
        refererPath: '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoes?tp=A',
      }
    );

    const dependentPath = mocks.fetchTOTVSResult.mock.calls[2][0] as string;
    const dependentUrl = new URL(
      dependentPath,
      'https://fundacaoeducacional132827.rm.cloudtotvs.com.br'
    );
    expect(dependentUrl.searchParams.get('parametro')).toBe(
      '1;S;CRM.EDU.36.008|1-8405-160|0|PARAMETRO_53'
    );
    expect(mocks.fetchTOTVSResult).toHaveBeenNthCalledWith(
      3,
      dependentPath,
      '[Faltas datas]',
      {
        requestProfile: 'ajax-json',
        refererPath: reviewPath,
      }
    );
    expect(mocks.fetchTOTVSResult.mock.calls.flat().join(' ')).not.toContain(
      'EduAcompanhaSolicitacoesSalvar'
    );
  });

  it('follows the available-options request before opening its review form', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source('<a href="/outra-rota">Outra solicitação</a>'))
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source(reviewFormHtml))
      .mockResolvedValueOnce(source('[]'));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(200);
    expect(mocks.fetchTOTVSResult).toHaveBeenNthCalledWith(
      2,
      '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesDisponiveis?codGrupoAtd=',
      '[Faltas datas]',
      {
        requestProfile: 'ajax-html',
        refererPath: '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoes?tp=A',
      }
    );
    expect(mocks.fetchTOTVSResult).toHaveBeenNthCalledWith(
      3,
      reviewPath,
      '[Faltas datas]',
      {
        refererPath: '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesDisponiveis?codGrupoAtd=',
      }
    );
  });

  it('treats an empty upstream array as a valid no-data response', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source(reviewFormHtml))
      .mockResolvedValueOnce(source('[]'));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      datasFalta: [],
      datasFaltaStatus: 'sem_dados',
    }));
  });

  it('rejects invalid input before reading the session or the upstream source', async () => {
    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=../../outra-rota'
    ));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Código de disciplina inválido.',
      code: 'BAD_REQUEST',
    });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.fetchTOTVSResult).not.toHaveBeenCalled();
  });

  it('returns a session error without reaching TOTVS', async () => {
    mocks.getSession.mockResolvedValueOnce(null);

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(expect.objectContaining({ code: 'SESSION_MISSING' }));
    expect(mocks.fetchTOTVSResult).not.toHaveBeenCalled();
  });

  it('does not query dependent options for a discipline absent from the form', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source(reviewFormHtml));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-9999-40'
    ));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(expect.objectContaining({
      code: 'DISCIPLINE_NOT_AVAILABLE',
    }));
    expect(mocks.fetchTOTVSResult).toHaveBeenCalledTimes(2);
  });

  it('maps invalid JSON to an upstream error instead of an empty result', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source(reviewFormHtml))
      .mockResolvedValueOnce(source('<html>unexpected response</html>'));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(expect.objectContaining({
      code: 'FREQUENCY_REVIEW_DATES_INVALID',
    }));
  });

  it('uses the known read-only dependency when TOTVS omits the review form', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source(emptyReviewFormShell))
      .mockResolvedValueOnce(source(JSON.stringify([
        { Selected: false, Text: '10/08/2026', Value: '10/08/2026' },
      ])));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      datasFalta: [{ data: '2026-08-10', label: '10/08/2026' }],
    }));
    const dependentPath = mocks.fetchTOTVSResult.mock.calls[2][0] as string;
    expect(new URL(dependentPath, 'https://totvs.invalid').searchParams.get('parametro')).toBe(
      '1;S;CRM.EDU.36.008|1-8405-160|0|PARAMETRO_53'
    );
  });

  it('rejects an unexpected form response instead of applying the fixed fallback', async () => {
    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml))
      .mockResolvedValueOnce(source('<!DOCTYPE html><html><body>schema changed</body></html>'));

    const response = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(expect.objectContaining({
      code: 'FREQUENCY_REVIEW_FORM_INVALID',
    }));
    expect(mocks.fetchTOTVSResult).toHaveBeenCalledTimes(2);
  });

  it('preserves upstream session errors and marks stale cache responses', async () => {
    mocks.fetchTOTVSResult.mockRejectedValueOnce(
      new mocks.HTTPError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED')
    );

    const expiredResponse = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));
    expect(expiredResponse.status).toBe(401);
    expect(await expiredResponse.json()).toEqual(expect.objectContaining({
      code: 'SESSION_EXPIRED',
    }));

    mocks.fetchTOTVSResult
      .mockResolvedValueOnce(source(requestsHtml, 'stale'))
      .mockResolvedValueOnce(source(reviewFormHtml))
      .mockResolvedValueOnce(source('[]'));

    const staleResponse = await GET(new Request(
      'http://localhost/api/faltas/datas?codigo=1-8405-160'
    ));
    expect(staleResponse.headers.get('x-sapoconnect-cache')).toBe('stale');
  });
});
