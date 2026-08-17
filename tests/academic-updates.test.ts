import { describe, expect, it } from 'vitest'

import {
  applyAcademicSnapshot,
  createAcademicUpdatesState,
  type AcademicUpdatesState,
} from '@/lib/academic-updates'

function apply(
  state: AcademicUpdatesState,
  module: 'calendario' | 'faltas' | 'avaliacoes' | 'historico',
  data: unknown,
  now: number,
) {
  return applyAcademicSnapshot(state, module, data, now)
}

describe('academic updates', () => {
  it('uses the first valid response as a baseline without inventing updates', () => {
    const state = createAcademicUpdatesState('scope-fixture')
    const result = apply(state, 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '5,00%', limiteFaltas: '25,00%' }],
    }, 1_000)

    expect(result.status).toBe('baseline')
    expect(result.added).toEqual([])
    expect(result.state.snapshots.faltas?.records).toHaveLength(1)
  })

  it('detects calendar time and room changes without treating the class as new', () => {
    const initial = apply(createAcademicUpdatesState('scope-fixture'), 'calendario', {
      aulas: [{
        disciplina: 'Clínica Médica II',
        data_inicial: '17/08/2026',
        data_inicial_iso: '2026-08-17T07:00:00-03:00',
        inicio: '07:00',
        fim: '07:50',
        turma: '7M80D',
        subturma: '',
        predio: 'Unidade II',
        bloco: '7º A',
        sala: '701',
      }],
    }, 1_000).state

    const result = apply(initial, 'calendario', {
      aulas: [{
        disciplina: 'Clínica Médica II',
        data_inicial: '17/08/2026',
        data_inicial_iso: '2026-08-17T07:00:00-03:00',
        inicio: '07:10',
        fim: '08:00',
        turma: '7M80D',
        subturma: '',
        predio: 'Unidade II',
        bloco: '7º A',
        sala: '702',
      }],
    }, 2_000)

    expect(result.added).toHaveLength(1)
    expect(result.added[0].title).toBe('Horário e local alterados')
    expect(result.added[0].changes.map((change) => change.label)).toEqual(['Horário', 'Local'])
  })

  it('detects a newly launched grade', () => {
    const withoutGrade = {
      disciplinas: [{
        codigo: 'MED101',
        nome: 'Clínica Médica II',
        resultado: {
          mediaParaAprovacao: 60,
          categorias: [{
            nome: 'Avaliação Parcial',
            avaliacoes: [{ nome: 'Prova 1', data: '20/08/2026', nota: '', valor: '30,0' }],
          }],
        },
      }],
    }
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'avaliacoes', withoutGrade, 1_000).state
    const withGrade = structuredClone(withoutGrade)
    withGrade.disciplinas[0].resultado.categorias[0].avaliacoes[0].nota = '24,5'

    const result = apply(baseline, 'avaliacoes', withGrade, 2_000)

    expect(result.added).toHaveLength(1)
    expect(result.added[0].title).toBe('Nota lançada')
    expect(result.added[0].changes).toContainEqual({ label: 'Nota', before: 'Não informada', after: '24,5' })
  })

  it('detects attendance and academic status changes', () => {
    let state = createAcademicUpdatesState('scope-fixture')
    state = apply(state, 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '5,00%', limiteFaltas: '25,00%' }],
    }, 1_000).state
    const absences = apply(state, 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '7,50%', limiteFaltas: '25,00%' }],
    }, 2_000)

    state = apply(absences.state, 'historico', {
      periodos: [{ nome: '1º Período', disciplinas: [{ codigo: 'MED101', nome: 'Clínica Médica', status: 'pendente', situacao: 'Cursando' }] }],
    }, 3_000).state
    const history = apply(state, 'historico', {
      periodos: [{ nome: '1º Período', disciplinas: [{ codigo: 'MED101', nome: 'Clínica Médica', status: 'concluida', situacao: 'Concluída', nota: '74,0' }] }],
    }, 4_000)

    expect(absences.added[0].title).toBe('Frequência atualizada')
    expect(history.added[0].title).toBe('Situação acadêmica atualizada')
  })

  it('ignores stale fallbacks and suspicious empty responses', () => {
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '5,00%', limiteFaltas: '25,00%' }],
    }, 1_000).state

    const stale = apply(baseline, 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '10,00%', limiteFaltas: '25,00%' }],
      __cacheStale: true,
    }, 2_000)
    const empty = apply(baseline, 'faltas', { faltas: [] }, 2_000)

    expect(stale.status).toBe('ignored-stale')
    expect(empty.status).toBe('ignored-incomplete')
    expect(stale.state).toBe(baseline)
    expect(empty.state).toBe(baseline)
  })

  it('does not remove grades from disciplines that failed to load', () => {
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'avaliacoes', {
      disciplinas: [{
        codigo: 'MED101',
        nome: 'Clínica Médica',
        resultado: {
          mediaParaAprovacao: 60,
          categorias: [{ nome: 'Parcial', avaliacoes: [{ nome: 'Prova 1', nota: '20,0', valor: '30,0' }] }],
        },
      }],
    }, 1_000).state

    const partial = apply(baseline, 'avaliacoes', {
      disciplinas: [{ codigo: 'MED101', nome: 'Clínica Médica', error: 'TOTVS indisponível' }],
    }, 2_000)

    expect(partial.added).toEqual([])
    expect(partial.state.snapshots.avaliacoes?.records).toEqual(baseline.snapshots.avaliacoes?.records)
  })

  it('does not invent old grades when a discipline first succeeds after a partial baseline', () => {
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'avaliacoes', {
      disciplinas: [
        {
          codigo: 'MED101',
          nome: 'Clínica Médica',
          resultado: {
            mediaParaAprovacao: 60,
            categorias: [{ nome: 'Parcial', avaliacoes: [{ nome: 'Prova 1', nota: '20,0', valor: '30,0' }] }],
          },
        },
        { codigo: 'MED102', nome: 'Clínica Cirúrgica', error: 'TOTVS indisponível' },
      ],
    }, 1_000).state

    const recovered = apply(baseline, 'avaliacoes', {
      disciplinas: [
        {
          codigo: 'MED101',
          nome: 'Clínica Médica',
          resultado: {
            mediaParaAprovacao: 60,
            categorias: [{ nome: 'Parcial', avaliacoes: [{ nome: 'Prova 1', nota: '20,0', valor: '30,0' }] }],
          },
        },
        {
          codigo: 'MED102',
          nome: 'Clínica Cirúrgica',
          resultado: {
            mediaParaAprovacao: 60,
            categorias: [{ nome: 'Parcial', avaliacoes: [{ nome: 'Prova 1', nota: '25,0', valor: '30,0' }] }],
          },
        },
      ],
    }, 2_000)

    expect(recovered.added).toEqual([])
    expect(recovered.state.snapshots.avaliacoes?.records).toHaveLength(2)
  })

  it('does not create an empty evaluations baseline when every discipline failed', () => {
    const state = createAcademicUpdatesState('scope-fixture')
    const result = apply(state, 'avaliacoes', {
      disciplinas: [{ codigo: 'MED101', nome: 'Clínica Médica', error: 'TOTVS indisponível' }],
    }, 1_000)

    expect(result.status).toBe('ignored-incomplete')
    expect(result.state).toBe(state)
  })

  it('does not duplicate events when the same snapshot is processed again', () => {
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '5,00%', limiteFaltas: '25,00%' }],
    }, 1_000).state
    const changed = apply(baseline, 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '7,50%', limiteFaltas: '25,00%' }],
    }, 2_000)
    const repeated = apply(changed.state, 'faltas', {
      faltas: [{ codigo: 'MED101', disciplina: 'Clínica Médica', porcentagem: '7,50%', limiteFaltas: '25,00%' }],
    }, 3_000)

    expect(repeated.added).toEqual([])
    expect(repeated.state.updates).toHaveLength(1)
  })
})
