type HistorySubject = {
  status: 'concluida' | 'pendente' | 'naoconcluida' | 'equivalente'
}

type HistoryPeriod<TSubject extends HistorySubject> = {
  disciplinas: readonly TSubject[]
}

export function getCountedHistorySubjects<TSubject extends HistorySubject>(
  subjects: readonly TSubject[],
): TSubject[] {
  return subjects.filter((subject) => subject.status !== 'equivalente')
}

export function calculateHistoryCounts<TSubject extends HistorySubject>(
  periods: readonly HistoryPeriod<TSubject>[],
) {
  const subjects = periods.flatMap((period) =>
    getCountedHistorySubjects(period.disciplinas),
  )
  const completed = subjects.filter((subject) => subject.status === 'concluida').length

  return {
    total: subjects.length,
    completed,
    remaining: subjects.length - completed,
  }
}
