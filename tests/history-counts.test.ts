import { describe, expect, it } from 'vitest'

import { calculateHistoryCounts, getCountedHistorySubjects } from '@/lib/history-counts'

describe('history counts', () => {
  type TestSubject = {
    id: string
    status: 'concluida' | 'pendente' | 'naoconcluida' | 'equivalente'
  }

  const periods: Array<{ disciplinas: TestSubject[] }> = [
    {
      disciplinas: [
        { id: 'urgencias', status: 'concluida' },
        { id: 'urgencias-equivalente', status: 'equivalente' },
        { id: 'gestao', status: 'concluida' },
        { id: 'gestao-equivalente', status: 'equivalente' },
      ],
    },
    {
      disciplinas: [
        { id: 'internato', status: 'pendente' },
        { id: 'optativa', status: 'naoconcluida' },
      ],
    },
  ]

  it('keeps equivalent cards visible but removes them from group counts', () => {
    expect(periods[0].disciplinas).toHaveLength(4)
    expect(getCountedHistorySubjects(periods[0].disciplinas)).toHaveLength(2)
  })

  it('makes the summary equal the sum of every displayed group count', () => {
    const counts = calculateHistoryCounts(periods)
    const groupTotal = periods.reduce(
      (total, period) => total + getCountedHistorySubjects(period.disciplinas).length,
      0,
    )

    expect(counts).toEqual({ total: 4, completed: 2, remaining: 2 })
    expect(counts.total).toBe(groupTotal)
  })
})
