import type { DisciplinaOpcao } from '@/lib/avaliacoes-parser'

export const EVALUATION_BACKGROUND_BATCH_SIZE = 3
export const EVALUATION_BACKGROUND_SKIPPED = 'BACKGROUND_SKIPPED'

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0) return []
  const normalized = ((offset % items.length) + items.length) % items.length
  return [...items.slice(normalized), ...items.slice(0, normalized)]
}

export function selectEvaluationBackgroundBatch({
  disciplinas,
  preferredCodes,
  cacheScope,
  now,
  batchSize = EVALUATION_BACKGROUND_BATCH_SIZE,
}: {
  disciplinas: DisciplinaOpcao[]
  preferredCodes: string[]
  cacheScope: string
  now: number
  batchSize?: number
}): DisciplinaOpcao[] {
  if (disciplinas.length <= batchSize) return disciplinas

  const byCode = new Map(disciplinas.map((disciplina) => [disciplina.codigo, disciplina]))
  const preferred = Array.from(new Set(preferredCodes))
    .map((codigo) => byCode.get(codigo))
    .filter((disciplina): disciplina is DisciplinaOpcao => Boolean(disciplina))
  const sixHourBucket = Math.floor(now / (6 * 60 * 60 * 1_000))
  const seed = stableHash(cacheScope)
  const result: DisciplinaOpcao[] = []
  const selectedCodes = new Set<string>()

  const append = (items: DisciplinaOpcao[]) => {
    for (const disciplina of items) {
      if (result.length >= batchSize) break
      if (selectedCodes.has(disciplina.codigo)) continue
      selectedCodes.add(disciplina.codigo)
      result.push(disciplina)
    }
  }

  append(rotate(preferred, seed + sixHourBucket * batchSize))
  append(rotate(disciplinas, seed + sixHourBucket * batchSize))
  return result
}
