import { getSession } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import type { NextResponse } from 'next/server';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';
import { getOrLoad } from '@/lib/server/cache';
import { privateJson } from '@/lib/server/http';
import { fetchTotvs, isTransientUpstreamError, UpstreamTimeoutError } from '@/lib/server/upstream';

const BASE_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';

export interface TotvsFetchOptions {
  requestProfile?: 'document' | 'ajax-html' | 'ajax-json';
  refererPath?: string;
}

export class HTTPError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public debugCode: string
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

/**
 * Detecta se a resposta é uma página de login externo.
 *
 * Verifica apenas a URL, não o conteúdo HTML, pois páginas válidas
 * podem conter referências a 'login' em scripts/links sem serem páginas de login.
 */
function isExternalLoginResponse(response: Response, _html: string): boolean {
  const url = response.url.toLowerCase();

  return (
    url.includes('loginexternoapp') ||
    url.includes('/account/login') ||
    url.includes('loginexterno')
  );
}

function assertSuccessfulResponse(response: Response): void {
  if (response.ok) return;

  if (response.status >= 500) {
    throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HTTPError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
  }
  throw new HTTPError(`Erro HTTP ${response.status}`, 502, 'UPSTREAM_ERROR');
}

export async function fetchTOTVS(
  path: string,
  _logPrefix = '[TOTVS API]',
  options?: TotvsFetchOptions
): Promise<string> {
  return (await fetchTOTVSResult(path, _logPrefix, options)).html;
}

export async function fetchTOTVSResult(
  path: string,
  _logPrefix = '[TOTVS API]',
  options?: TotvsFetchOptions
): Promise<{ html: string; cache: 'hit' | 'miss' | 'stale' }> {
  const scope = (await getSession())?.cacheScope;
  if (!scope) {
    return {
      html: await fetchTOTVSUncached(path, _logPrefix, options),
      cache: 'miss',
    };
  }

  const responseProfileKey = options?.requestProfile?.startsWith('ajax-')
    ? `${options.requestProfile}:${path}`
    : `html:${path}`;
  const cacheKey = options?.refererPath
    ? `v3:${responseProfileKey}:referer:${options.refererPath}`
    : `v3:${responseProfileKey}`;
  const result = await getOrLoad(scope, cacheKey, () => fetchTOTVSUncached(path, _logPrefix, options), {
    ttlMs: 45_000,
    staleMs: 120_000,
    canServeStale: isTransientUpstreamError,
  });
  return { html: result.value, cache: result.cache };
}

async function fetchTOTVSUncached(
  path: string,
  _logPrefix = '[TOTVS API]',
  options?: TotvsFetchOptions
): Promise<string> {
  const session = await getSession();
  const externalCookies = session?.externalCookies;

  if (!session || !externalCookies) {
    throw new HTTPError('Sessão não encontrada. Faça login novamente.', 401, 'SESSION_MISSING');
  }

  const cookieHeader = formatCookiesForRequest(externalCookies);
  const url = `${BASE_URL}${path}`;
  const isAjax = options?.requestProfile?.startsWith('ajax-') === true;
  const isAjaxJson = options?.requestProfile === 'ajax-json';
  const refererUrl = (() => {
    if (!options?.refererPath) return `${BASE_URL}/EducaMobile/Home/Index`;

    try {
      const candidate = new URL(options.refererPath, BASE_URL);
      return candidate.origin === BASE_URL
        ? `${candidate.origin}${candidate.pathname}${candidate.search}`
        : `${BASE_URL}/EducaMobile/Home/Index`;
    } catch {
      return `${BASE_URL}/EducaMobile/Home/Index`;
    }
  })();
  const requestHeaders = {
    Cookie: cookieHeader,
    Accept: isAjaxJson
      ? 'application/json, text/javascript, */*; q=0.01'
      : isAjax
        ? '*/*; q=0.01'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    Referer: refererUrl,
    'Sec-Fetch-Dest': isAjax ? 'empty' : 'document',
    'Sec-Fetch-Mode': isAjax ? 'cors' : 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    ...(isAjax
      ? {
          'X-Requested-With': 'XMLHttpRequest',
          ...(isAjaxJson ? { 'Content-Type': 'application/json' } : {}),
        }
      : {
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        }),
  };

  try {
    await ensureTotvsContext(cookieHeader, session.cacheScope);
  } catch (error) {
    if (error instanceof TotvsContextError) {
      throw new HTTPError(error.message, error.status, error.code);
    }
    throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }

  let response: Response;
  try {
    response = await fetchTotvs(url, {
      method: 'GET',
      redirect: 'follow',
      headers: requestHeaders,
    }, { idempotentRead: true });
  } catch (error) {
    throw new HTTPError(error instanceof UpstreamTimeoutError ? 'Tempo de espera da TOTVS esgotado.' : 'Sistema da TOTVS possivelmente fora do ar.', error instanceof UpstreamTimeoutError ? 504 : 503, error instanceof UpstreamTimeoutError ? 'UPSTREAM_TIMEOUT' : 'TOTVS_OFFLINE');
  }

  assertSuccessfulResponse(response);

  let html = await response.text();

  if (isExternalLoginResponse(response, html)) {
    throw new HTTPError('Sessão externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED');
  }

  if (html.includes('Object moved') && html.includes('GetContextoAluno')) {
    try {
      await ensureTotvsContext(cookieHeader, session.cacheScope, true);
    } catch (error) {
      if (error instanceof TotvsContextError) {
        throw new HTTPError(error.message, error.status, error.code);
      }
      throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }

    try {
      response = await fetchTotvs(url, {
        method: 'GET',
        redirect: 'follow',
        headers: requestHeaders,
      }, { idempotentRead: true });
    } catch (error) {
      throw new HTTPError(error instanceof UpstreamTimeoutError ? 'Tempo de espera da TOTVS esgotado.' : 'Sistema da TOTVS possivelmente fora do ar.', error instanceof UpstreamTimeoutError ? 504 : 503, error instanceof UpstreamTimeoutError ? 'UPSTREAM_TIMEOUT' : 'TOTVS_OFFLINE');
    }

    assertSuccessfulResponse(response);
    html = await response.text();

    if (isExternalLoginResponse(response, html)) {
      throw new HTTPError('Sessão externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED');
    }
  }

  return html;
}

export async function fetchTOTVSResponse<T>(
  path: string,
  processor: (html: string) => T,
  logPrefix = '[TOTVS API]',
  options?: {
    validate?: (data: T, html: string) => void;
  }
): Promise<NextResponse> {
  try {
    const { html, cache } = await fetchTOTVSResult(path, logPrefix);
    const data = processor(html);
    options?.validate?.(data, html);
    return privateJson(
      data,
      cache === 'stale' ? { headers: { 'X-SapoConnect-Cache': 'stale' } } : undefined
    );
  } catch (error) {
    if (error instanceof HTTPError) {
      return privateJson(
        { error: error.message, code: error.debugCode },
        { status: error.statusCode }
      );
    }

      return privateJson(
      { error: 'Erro ao buscar dados', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
