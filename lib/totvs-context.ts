import {
  buildPeriodoSelectionBody,
  isTelaSelecaoPeriodo,
  parseSelecaoPeriodo,
  selecionarPeriodoMaisNovo,
} from './contexto-parser';
import { fetchTotvs, UpstreamTimeoutError } from './server/upstream';
import { getOrLoad } from './server/cache';

const BASE_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';

const CONTEXTO_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduContexto/GetContextoAluno';

const SET_CONTEXTO_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Educacional/EduContexto/SetContextoAluno';

export class TotvsContextError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = 'TotvsContextError';
  }
}

export async function ensureTotvsContext(cookieHeader: string, cacheScope?: string, force = false): Promise<void> {
  if (cacheScope && !force) {
    await getOrLoad(cacheScope, 'totvs-context', () => ensureTotvsContext(cookieHeader, undefined, true), { ttlMs: 30_000 });
    return;
  }
  let response: Response;
  try {
    response = await fetchTotvs(CONTEXTO_URL, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        Referer: `${BASE_URL}/EducaMobile/Home/Index`,
      },
    }, { idempotentRead: true });
  } catch (error) {
    throw new TotvsContextError(error instanceof UpstreamTimeoutError ? 'Tempo de espera da TOTVS esgotado.' : 'Sistema da TOTVS possivelmente fora do ar.', error instanceof UpstreamTimeoutError ? 504 : 503, error instanceof UpstreamTimeoutError ? 'UPSTREAM_TIMEOUT' : 'TOTVS_OFFLINE');
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new TotvsContextError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }
    if (response.status === 401 || response.status === 403) {
      throw new TotvsContextError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
    }
    throw new TotvsContextError('Erro ao validar contexto.', 502, 'UPSTREAM_ERROR');
  }

  const html = await response.text();
  if (!isTelaSelecaoPeriodo(html)) {
    return;
  }

  const selecao = parseSelecaoPeriodo(html, true);
  const periodoSelecionado = selecao ? selecionarPeriodoMaisNovo(selecao) : null;

  if (!selecao || !periodoSelecionado) {
    throw new TotvsContextError('Não foi possível selecionar período.', 500, 'CONTEXT_INVALID');
  }

  const isDirectLink =
    periodoSelecionado.hdKeyTD.startsWith('/') ||
    periodoSelecionado.hdKeyTD.startsWith('http');

  if (isDirectLink) {
    const targetUrl = periodoSelecionado.hdKeyTD.startsWith('http')
      ? periodoSelecionado.hdKeyTD
      : `${BASE_URL}${periodoSelecionado.hdKeyTD}`;

    try {
      response = await fetchTotvs(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Cookie: cookieHeader,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          Referer: `${BASE_URL}/EducaMobile/Home/Index`,
        },
      }, { idempotentRead: true });
    } catch (error) {
      throw new TotvsContextError(error instanceof UpstreamTimeoutError ? 'Tempo de espera da TOTVS esgotado.' : 'Sistema da TOTVS possivelmente fora do ar.', error instanceof UpstreamTimeoutError ? 504 : 503, error instanceof UpstreamTimeoutError ? 'UPSTREAM_TIMEOUT' : 'TOTVS_OFFLINE');
    }
  } else {
    const targetUrl = selecao.formAction.startsWith('http')
      ? selecao.formAction
      : `${BASE_URL}${selecao.formAction || SET_CONTEXTO_URL}`;

    const body = buildPeriodoSelectionBody(periodoSelecionado);

    try {
      response = await fetchTotvs(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          Referer: CONTEXTO_URL,
        },
        body,
      }, { idempotentRead: false });
    } catch (error) {
      throw new TotvsContextError(error instanceof UpstreamTimeoutError ? 'Tempo de espera da TOTVS esgotado.' : 'Sistema da TOTVS possivelmente fora do ar.', error instanceof UpstreamTimeoutError ? 504 : 503, error instanceof UpstreamTimeoutError ? 'UPSTREAM_TIMEOUT' : 'TOTVS_OFFLINE');
    }
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new TotvsContextError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }
    if (response.status === 401 || response.status === 403) {
      throw new TotvsContextError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
    }
    throw new TotvsContextError('Erro ao selecionar período.', 502, 'UPSTREAM_ERROR');
  }
}
