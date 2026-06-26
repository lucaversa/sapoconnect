/**
 * GET /api/avaliacoes/completo
 * Lista disciplinas e pre-carrega as avaliacoes de cada uma.
 */

import { NextResponse } from 'next/server';
import { getExternalCookies } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import {
  DisciplinaOpcao,
  ResultadoAvaliacoes,
  parseAvaliacoesHTML,
  parseDisciplinasHTML,
} from '@/lib/avaliacoes-parser';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';

const BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';
const AVALIACOES_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/EduNotasAvaliacao?tp=A`;
const GET_NOTAS_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/GetNotasAvaliacao`;
const CONCURRENCY_LIMIT = 3;

interface DisciplinaCompleta extends DisciplinaOpcao {
  resultado?: ResultadoAvaliacoes;
  error?: string;
  code?: string;
}

class AvaliacoesFetchError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = 'AvaliacoesFetchError';
  }
}

function isLoginResponse(response: Response): boolean {
  const url = response.url.toLowerCase();
  return url.includes('loginexternoapp') ||
    url.includes('account/login') ||
    url.includes('loginexterno');
}

async function fetchDisciplinasHTML(cookieHeader: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(AVALIACOES_URL, {
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
    throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AvaliacoesFetchError('Sessao expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
    }
    if (response.status >= 500) {
      throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }
    throw new AvaliacoesFetchError(`Erro HTTP ${response.status}`, 502, 'UPSTREAM_ERROR');
  }

  const html = await response.text();

  if (isLoginResponse(response)) {
    throw new AvaliacoesFetchError('Sessao externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED');
  }

  return html;
}

async function fetchNotas(codigo: string, cookieHeader: string): Promise<ResultadoAvaliacoes> {
  let response: Response;
  try {
    response = await fetch(GET_NOTAS_URL, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        Referer: GET_NOTAS_URL,
        Origin: BASE_URL,
        Connection: 'keep-alive',
      },
      body: `ddlTurmaDisc=${encodeURIComponent(codigo)}`,
    });
  } catch {
    throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AvaliacoesFetchError('Sessao expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
    }
    if (response.status >= 500) {
      throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
    }
    throw new AvaliacoesFetchError(`Erro HTTP ${response.status}`, 502, 'UPSTREAM_ERROR');
  }

  const html = await response.text();

  if (isLoginResponse(response)) {
    throw new AvaliacoesFetchError('Sessao externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED');
  }

  const resultado = parseAvaliacoesHTML(html);
  if (!resultado.categorias || resultado.categorias.length === 0) {
    throw new AvaliacoesFetchError('Falha ao validar sessao. Tente novamente.', 401, 'SESSION_EXPIRED');
  }

  return resultado;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

export async function GET() {
  try {
    const externalCookies = await getExternalCookies();

    if (!externalCookies) {
      return NextResponse.json(
        { error: 'Sessao nao encontrada. Faca login novamente.', code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    const cookieHeader = formatCookiesForRequest(externalCookies);

    try {
      await ensureTotvsContext(cookieHeader);
    } catch (error) {
      if (error instanceof TotvsContextError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        );
      }
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 }
      );
    }

    const disciplinasHtml = await fetchDisciplinasHTML(cookieHeader);
    const { disciplinas } = parseDisciplinasHTML(disciplinasHtml);

    if (!disciplinas.length) {
      return NextResponse.json(
        { error: 'Falha ao validar sessao. Tente novamente.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const disciplinasCompletas = await mapWithConcurrency(
      disciplinas,
      CONCURRENCY_LIMIT,
      async (disciplina): Promise<DisciplinaCompleta> => {
        try {
          const resultado = await fetchNotas(disciplina.codigo, cookieHeader);
          return { ...disciplina, resultado };
        } catch (error) {
          if (error instanceof AvaliacoesFetchError) {
            return {
              ...disciplina,
              error: error.message,
              code: error.code,
            };
          }
          return {
            ...disciplina,
            error: 'Erro ao buscar avaliacoes',
            code: 'INTERNAL_ERROR',
          };
        }
      }
    );

    return NextResponse.json({ disciplinas: disciplinasCompletas });
  } catch (error) {
    if (error instanceof AvaliacoesFetchError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar avaliacoes completas', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    );
  }
}
