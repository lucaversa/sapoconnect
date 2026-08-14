/** Backward-compatible per-discipline assessment endpoint. */
import { getSession } from '@/lib/session';
import { formatCookiesForRequest } from '@/lib/external-auth';
import { parseAvaliacoesHTML, type ResultadoAvaliacoes } from '@/lib/avaliacoes-parser';
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context';
import { getOrLoad } from '@/lib/server/cache';
import { privateJson } from '@/lib/server/http';
import { guardSameOriginRequest, RequestGuardError } from '@/lib/server/request-guard';
import { fetchTotvs, isTransientUpstreamError } from '@/lib/server/upstream';

const BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br';
const GET_NOTAS_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/GetNotasAvaliacao`;

class NotasError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

function isLoginResponse(response: Response): boolean {
  const url = response.url.toLowerCase();
  return url.includes('loginexternoapp') || url.includes('account/login') || url.includes('loginexterno');
}

async function readCodigo(request: Request): Promise<string> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 512) throw new NotasError('Requisição muito grande.', 413, 'PAYLOAD_TOO_LARGE');
  try {
    const codigo = (JSON.parse(raw) as { codigo?: unknown }).codigo;
    if (typeof codigo !== 'string' || !codigo.trim() || codigo.length > 256) {
      throw new Error();
    }
    return codigo.trim();
  } catch {
    throw new NotasError('Código da disciplina é obrigatório.', 400, 'BAD_REQUEST');
  }
}

async function loadNotas(codigo: string, cookieHeader: string): Promise<ResultadoAvaliacoes> {
  let response: Response;
  try {
    response = await fetchTotvs(GET_NOTAS_URL, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: GET_NOTAS_URL,
        Origin: BASE_URL,
      },
      body: `ddlTurmaDisc=${encodeURIComponent(codigo)}`,
    }, { idempotentRead: true });
  } catch {
    throw new NotasError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE');
  }

  if (response.status === 401 || response.status === 403 || isLoginResponse(response)) {
    throw new NotasError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED');
  }
  if (!response.ok) {
    throw new NotasError(
      response.status >= 500 ? 'Sistema da TOTVS possivelmente fora do ar.' : 'Erro ao buscar avaliações.',
      response.status >= 500 ? 503 : 502,
      response.status >= 500 ? 'TOTVS_OFFLINE' : 'UPSTREAM_ERROR'
    );
  }

  const result = parseAvaliacoesHTML(await response.text());
  if (!result.categorias?.length) {
    throw new NotasError('Falha ao validar sessão. Tente novamente.', 401, 'SESSION_EXPIRED');
  }
  return result;
}

export async function POST(request: Request) {
  try {
    guardSameOriginRequest(request);
    const codigo = await readCodigo(request);
    const session = await getSession();
    if (!session?.externalCookies) {
      return privateJson({ error: 'Sessão não encontrada.', code: 'SESSION_MISSING' }, { status: 401 });
    }

    const cookieHeader = formatCookiesForRequest(session.externalCookies);
    await ensureTotvsContext(cookieHeader, session.cacheScope);
    const loaded = await getOrLoad(
      session.cacheScope,
      `source:avaliacoes-notas:${codigo}`,
      () => loadNotas(codigo, cookieHeader),
      { ttlMs: 45_000, staleMs: 120_000, canServeStale: isTransientUpstreamError }
    );
    return privateJson(loaded.value, loaded.cache === 'stale' ? { headers: { 'X-SapoConnect-Cache': 'stale' } } : undefined);
  } catch (error) {
    if (error instanceof RequestGuardError || error instanceof NotasError) {
      return privateJson({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof TotvsContextError) {
      return privateJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return privateJson({ error: 'Erro ao buscar avaliações.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
