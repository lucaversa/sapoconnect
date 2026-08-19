/**
 * POST /api/avaliacoes/atualizacoes
 * Consulta no máximo três disciplinas para o feed de atualizações.
 */

import { getSession } from '@/lib/session'
import { formatCookiesForRequest } from '@/lib/external-auth'
import type { DisciplinaOpcao, ResultadoAvaliacoes } from '@/lib/avaliacoes-parser'
import {
  EVALUATION_BACKGROUND_SKIPPED,
  selectEvaluationBackgroundBatch,
} from '@/lib/evaluation-update-batch'
import { ensureTotvsContext, TotvsContextError } from '@/lib/totvs-context'
import { privateJson } from '@/lib/server/http'
import { guardSameOriginRequest, RequestGuardError } from '@/lib/server/request-guard'
import {
  AvaliacoesFetchError,
  fetchAvaliacoesDisciplinas,
  fetchAvaliacoesNotas,
  mapWithConcurrency,
} from '@/lib/server/avaliacoes-source'

const MAX_REQUEST_BYTES = 20 * 1024
const MAX_PREFERRED_CODES = 64
const CONCURRENCY_LIMIT = 3

interface DisciplinaParcial extends DisciplinaOpcao {
  resultado?: ResultadoAvaliacoes
  error?: string
  code?: string
}

async function readPreferredCodes(request: Request): Promise<string[]> {
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES) {
    throw new AvaliacoesFetchError('Requisição muito grande.', 413, 'PAYLOAD_TOO_LARGE')
  }
  if (!raw) return []

  try {
    const body = JSON.parse(raw) as { preferredCodes?: unknown }
    if (body.preferredCodes === undefined) return []
    if (!Array.isArray(body.preferredCodes) || body.preferredCodes.length > MAX_PREFERRED_CODES) {
      throw new Error()
    }
    return body.preferredCodes.map((value) => {
      if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error()
      return value.trim()
    })
  } catch {
    throw new AvaliacoesFetchError('Dados de consulta inválidos.', 400, 'BAD_REQUEST')
  }
}

export async function POST(request: Request) {
  try {
    guardSameOriginRequest(request)
    const preferredCodes = await readPreferredCodes(request)
    const session = await getSession()
    if (!session?.externalCookies) {
      return privateJson(
        { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
        { status: 401 },
      )
    }

    const cookieHeader = formatCookiesForRequest(session.externalCookies)
    await ensureTotvsContext(cookieHeader, session.cacheScope)
    const disciplinasSource = await fetchAvaliacoesDisciplinas(
      cookieHeader,
      session.cacheScope,
    )
    const selected = selectEvaluationBackgroundBatch({
      disciplinas: disciplinasSource.value,
      preferredCodes,
      cacheScope: session.cacheScope,
      now: Date.now(),
    })
    const selectedCodes = new Set(selected.map((disciplina) => disciplina.codigo))
    let servedStale = disciplinasSource.cache === 'stale'

    const checked = await mapWithConcurrency(
      selected,
      CONCURRENCY_LIMIT,
      async (disciplina): Promise<DisciplinaParcial> => {
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
    const checkedByCode = new Map(checked.map((disciplina) => [disciplina.codigo, disciplina]))
    const disciplinas = disciplinasSource.value.map<DisciplinaParcial>((disciplina) => {
      if (selectedCodes.has(disciplina.codigo)) {
        return checkedByCode.get(disciplina.codigo) ?? {
          ...disciplina,
          error: 'Não foi possível verificar esta disciplina.',
          code: 'INTERNAL_ERROR',
        }
      }
      return {
        ...disciplina,
        error: 'Disciplina preservada neste ciclo econômico.',
        code: EVALUATION_BACKGROUND_SKIPPED,
      }
    })

    return privateJson(
      { disciplinas, __partial: true },
      servedStale ? { headers: { 'X-SapoConnect-Cache': 'stale' } } : undefined,
    )
  } catch (error) {
    if (error instanceof RequestGuardError || error instanceof AvaliacoesFetchError) {
      return privateJson({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof TotvsContextError) {
      return privateJson({ error: error.message, code: error.code }, { status: error.status })
    }
    return privateJson(
      { error: 'Erro ao verificar avaliações.', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
