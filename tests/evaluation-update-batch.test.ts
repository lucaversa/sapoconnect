import { describe, expect, it } from 'vitest'

import { selectEvaluationBackgroundBatch } from '@/lib/evaluation-update-batch'

const disciplinas = Array.from({ length: 10 }, (_, index) => ({
  codigo: `COD-${index + 1}`,
  nome: `Disciplina ${index + 1}`,
}))

describe('evaluation update batch', () => {
  it('limits each background check to three unique disciplines', () => {
    const selected = selectEvaluationBackgroundBatch({
      disciplinas,
      preferredCodes: disciplinas.map((disciplina) => disciplina.codigo),
      cacheScope: 'scope-fixture',
      now: Date.UTC(2026, 7, 19, 12),
    })

    expect(selected).toHaveLength(3)
    expect(new Set(selected.map((disciplina) => disciplina.codigo)).size).toBe(3)
  })

  it('prioritizes pending disciplines and rotates them between six-hour windows', () => {
    const preferredCodes = ['COD-2', 'COD-4', 'COD-6', 'COD-8', 'COD-10']
    const now = Date.UTC(2026, 7, 19, 0)
    const first = selectEvaluationBackgroundBatch({
      disciplinas,
      preferredCodes,
      cacheScope: 'scope-fixture',
      now,
    })
    const second = selectEvaluationBackgroundBatch({
      disciplinas,
      preferredCodes,
      cacheScope: 'scope-fixture',
      now: now + 6 * 60 * 60 * 1_000,
    })

    expect(first.every((disciplina) => preferredCodes.includes(disciplina.codigo))).toBe(true)
    expect(second.every((disciplina) => preferredCodes.includes(disciplina.codigo))).toBe(true)
    expect(second.map((disciplina) => disciplina.codigo)).not.toEqual(
      first.map((disciplina) => disciplina.codigo),
    )
  })
})
