import 'server-only'

import {
  parseAvaliacoesHTML,
  parseDisciplinasHTML,
  type DisciplinaOpcao,
  type ResultadoAvaliacoes,
} from '@/lib/avaliacoes-parser'
import { getOrLoad } from '@/lib/server/cache'
import { fetchTotvs, isTransientUpstreamError } from '@/lib/server/upstream'

const BASE_URL = 'https://fundacaoeducacional132827.rm.cloudtotvs.com.br'
const AVALIACOES_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/EduNotasAvaliacao?tp=A`
const GET_NOTAS_URL = `${BASE_URL}/EducaMobile/Educacional/EduAluno/GetNotasAvaliacao`

export type AvaliacoesCacheState = 'hit' | 'miss' | 'stale'
export type CachedAvaliacoesValue<T> = { value: T; cache: AvaliacoesCacheState }

export class AvaliacoesFetchError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message)
    this.name = 'AvaliacoesFetchError'
  }
}

function isLoginResponse(response: Response): boolean {
  const url = response.url.toLowerCase()
  return url.includes('loginexternoapp') ||
    url.includes('account/login') ||
    url.includes('loginexterno')
}

async function fetchDisciplinasHTMLUncached(cookieHeader: string): Promise<string> {
  let response: Response
  try {
    response = await fetchTotvs(AVALIACOES_URL, {
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
    }, { idempotentRead: true })
  } catch {
    throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AvaliacoesFetchError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED')
    }
    if (response.status >= 500) {
      throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE')
    }
    throw new AvaliacoesFetchError(`Erro HTTP ${response.status}`, 502, 'UPSTREAM_ERROR')
  }

  const html = await response.text()
  if (isLoginResponse(response)) {
    throw new AvaliacoesFetchError('Sessão externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED')
  }
  return html
}

async function fetchNotasUncached(
  codigo: string,
  cookieHeader: string,
): Promise<ResultadoAvaliacoes> {
  let response: Response
  try {
    response = await fetchTotvs(GET_NOTAS_URL, {
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
    }, { idempotentRead: true })
  } catch {
    throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AvaliacoesFetchError('Sessão expirada no sistema TOTVS.', 401, 'SESSION_EXPIRED')
    }
    if (response.status >= 500) {
      throw new AvaliacoesFetchError('Sistema da TOTVS possivelmente fora do ar.', 503, 'TOTVS_OFFLINE')
    }
    throw new AvaliacoesFetchError(`Erro HTTP ${response.status}`, 502, 'UPSTREAM_ERROR')
  }

  const html = await response.text()
  if (isLoginResponse(response)) {
    throw new AvaliacoesFetchError('Sessão externa expirada. Tente novamente.', 401, 'SESSION_EXPIRED')
  }

  const resultado = parseAvaliacoesHTML(html)
  if (!resultado.categorias?.length) {
    throw new AvaliacoesFetchError('Falha ao validar sessão. Tente novamente.', 401, 'SESSION_EXPIRED')
  }
  return resultado
}

export async function fetchAvaliacoesDisciplinas(
  cookieHeader: string,
  cacheScope: string,
): Promise<CachedAvaliacoesValue<DisciplinaOpcao[]>> {
  const loaded = await getOrLoad(
    cacheScope,
    'source:avaliacoes-disciplinas',
    () => fetchDisciplinasHTMLUncached(cookieHeader),
    { ttlMs: 45_000, staleMs: 120_000, canServeStale: isTransientUpstreamError },
  )
  const { disciplinas } = parseDisciplinasHTML(loaded.value)
  if (!disciplinas.length) {
    throw new AvaliacoesFetchError('Falha ao validar sessão. Tente novamente.', 401, 'SESSION_EXPIRED')
  }
  return { value: disciplinas, cache: loaded.cache }
}

export async function fetchAvaliacoesNotas(
  codigo: string,
  cookieHeader: string,
  cacheScope: string,
): Promise<CachedAvaliacoesValue<ResultadoAvaliacoes>> {
  return getOrLoad(
    cacheScope,
    `source:avaliacoes-notas:${codigo}`,
    () => fetchNotasUncached(codigo, cookieHeader),
    { ttlMs: 45_000, staleMs: 120_000, canServeStale: isTransientUpstreamError },
  )
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  let aborted = false

  async function worker() {
    while (!aborted && nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      try {
        results[currentIndex] = await mapper(items[currentIndex])
      } catch (error) {
        aborted = true
        throw error
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}
