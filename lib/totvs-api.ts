import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { NextResponse } from 'next/server';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';

const BASE_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';

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

export async function fetchTOTVS(
  path: string,
  logPrefix = '[TOTVS API]'
): Promise<string> {
  const externalCookies = await getExternalCookies();

  if (!externalCookies) {
    throw new HTTPError('Sessão não encontrada. Faça login novamente.', 401, 'SESSION_MISSING');
  }

  const cookieHeader = formatCookiesForRequest(externalCookies);
  const url = `${BASE_URL}${path}`;

  try {
    await ensureTotvsContext(cookieHeader);
  } catch (error) {
    if (error instanceof TotvsContextError) {
      throw new HTTPError(error.message, error.status, error.code);
    }
    throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }

  let response: Response;
  try {
    response = await fetch(url, {
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
    });
  } catch {
    throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }
    if (response.status === 401 || response.status === 403) {
      throw new HTTPError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
    }
    throw new HTTPError(`Erro HTTP ${response.status}`, 502, 'UPSTREAM_ERROR');
  }

  let html = await response.text();

  if (isExternalLoginResponse(response, html)) {
    throw new HTTPError('Sessão externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED');
  }

  if (html.includes('Object moved') && html.includes('GetContextoAluno')) {
    try {
      await ensureTotvsContext(cookieHeader);
    } catch (error) {
      if (error instanceof TotvsContextError) {
        throw new HTTPError(error.message, error.status, error.code);
      }
      throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }

    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Cookie: cookieHeader,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          Referer: `${BASE_URL}/EducaMobile/Home/Index`,
        },
      });
    } catch {
      throw new HTTPError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }

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
    const html = await fetchTOTVS(path, logPrefix);
    const data = processor(html);
    options?.validate?.(data, html);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof HTTPError) {
      return NextResponse.json(
        { error: error.message, code: error.debugCode },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao buscar dados', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
