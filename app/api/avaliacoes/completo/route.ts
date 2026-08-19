/**
 * GET /api/avaliacoes/completo
 * Lista disciplinas e carrega todas as avaliações de cada uma.
 */

import { getSession } from '@/lib/session'
import { formatCookiesForRequest } from '@/lib/external-auth'
import type { DisciplinaOpcao, ResultadoAvaliacoes } from '@/lib/avaliacoes-parser'
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context'
import { privateJson } from '@/lib/server/http'
import {
  AvaliacoesFetchError,
  fetchAvaliacoesDisciplinas,
  fetchAvaliacoesNotas,
  mapWithConcurrency,
} from '@/lib/server/avaliacoes-source'

const CONCURRENCY_LIMIT = 3

interface DisciplinaCompleta extends DisciplinaOpcao {
  resultado?: ResultadoAvaliacoes
  error?: string
  code?: string
}

export async function GET() {
  try {
    const session = await getSession()
    const externalCookies = session?.externalCookies

    if (!session || !externalCookies) {
      return privateJson(
        { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
        { status: 401 },
      )
    }

    const cookieHeader = formatCookiesForRequest(externalCookies)
    try {
      await ensureTotvsContext(cookieHeader, session.cacheScope)
    } catch (error) {
      if (error instanceof TotvsContextError) {
        return privateJson({ error: error.message, code: error.code }, { status: error.status })
      }
      return privateJson(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 },
      )
    }

    const disciplinasSource = await fetchAvaliacoesDisciplinas(
      cookieHeader,
      session.cacheScope,
    )
    let servedStale = disciplinasSource.cache === 'stale'
    const disciplinasCompletas = await mapWithConcurrency(
      disciplinasSource.value,
      CONCURRENCY_LIMIT,
      async (disciplina): Promise<DisciplinaCompleta> => {
        try {
          const loaded = await fetchAvaliacoesNotas(
            disciplina.codigo,
            cookieHeader,
            session.cacheScope,
          )
          if (loaded.cache === 'stale') servedStale = true
          return { ...disciplina, resultado: loaded.value }
        } catch (error) {
          if (error instanceof AvaliacoesFetchError) {
            if (error.status === 401) throw error
            return { ...disciplina, error: error.message, code: error.code }
          }
          return {
            ...disciplina,
            error: 'Erro ao buscar avaliações',
            code: 'INTERNAL_ERROR',
          }
        }
      },
    )

    return privateJson(
      { disciplinas: disciplinasCompletas },
      servedStale ? { headers: { 'X-SapoConnect-Cache': 'stale' } } : undefined,
    )
  } catch (error) {
    if (error instanceof AvaliacoesFetchError) {
      return privateJson({ error: error.message, code: error.code }, { status: error.status })
    }
    return privateJson(
      { error: 'Erro ao buscar avaliações completas', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
