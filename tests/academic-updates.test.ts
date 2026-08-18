import { describe, expect, it } from 'vitest'

import {
  ACADEMIC_UPDATES_SCHEMA_VERSION,
  applyAcademicSnapshot,
  createAcademicUpdatesState,
  isAcademicUpdatesState,
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
  it('invalidates every stored feed from before the grouped-session redesign', () => {
    const current = createAcademicUpdatesState('scope-fixture')
    const legacy = { ...current, version: 1 }

    expect(ACADEMIC_UPDATES_SCHEMA_VERSION).toBe(2)
    expect(isAcademicUpdatesState(legacy, 'scope-fixture')).toBe(false)
    expect(current.updates).toEqual([])
    expect(current.snapshots).toEqual({})
  })

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

  it('groups consecutive schedule blocks into one detailed update', () => {
    const session = (startA: string, endA: string, startB: string, endB: string, room: string) => ({
      aulas: [
        {
          disciplina: 'Exercício Profissional II: Perícia Médica I',
          data_inicial: '25/08/2026',
          data_inicial_iso: '2026-08-25',
          dia: 'Terça-feira',
          inicio: startA,
          fim: endA,
          turma: '7M80D',
          subturma: 'D08',
          tipo_turma: 'Teórica',
          predio: 'Unidade II',
          bloco: '7º A',
          sala: room,
        },
        {
          disciplina: 'Exercício Profissional II: Perícia Médica I',
          data_inicial: '25/08/2026',
          data_inicial_iso: '2026-08-25',
          dia: 'Terça-feira',
          inicio: startB,
          fim: endB,
          turma: '7M80D',
          subturma: 'D08',
          tipo_turma: 'Teórica',
          predio: 'Unidade II',
          bloco: '7º A',
          sala: room,
        },
      ],
    })
    const baseline = apply(
      createAcademicUpdatesState('scope-fixture'),
      'calendario',
      session('07:00', '07:50', '07:50', '08:40', '701'),
      1_000,
    ).state

    const result = apply(
      baseline,
      'calendario',
      session('08:55', '09:45', '09:45', '10:35', '702'),
      2_000,
    )

    expect(result.added).toHaveLength(1)
    expect(result.added[0].title).toBe('Horário e local alterados')
    expect(result.added[0].changes).toEqual([
      { label: 'Horário', before: '07:00 - 08:40', after: '08:55 - 10:35' },
      { label: 'Local', before: 'Unidade II / 7º A / 701', after: 'Unidade II / 7º A / 702' },
    ])
    expect(result.added[0].details).toEqual(expect.arrayContaining([
      { label: 'Data', value: '25/08/2026' },
      { label: 'Dia da semana', value: 'Terça-feira' },
      { label: 'Horário completo', value: '08:55 - 10:35' },
      { label: 'Períodos seguidos', value: '2' },
      { label: 'Turma', value: '7M80D' },
      { label: 'Subturma', value: 'D08' },
    ]))
  })

  it('emits one notification when a long consecutive session is added or removed', () => {
    const anchor = {
      disciplina: 'Clínica Médica II',
      data_inicial: '24/08/2026',
      data_inicial_iso: '2026-08-24',
      dia: 'Segunda-feira',
      inicio: '07:00',
      fim: '07:50',
      turma: '7M80D',
    }
    const starts = ['08:55', '09:45', '10:35', '11:25', '12:15', '13:05']
    const ends = ['09:45', '10:35', '11:25', '12:15', '13:05', '13:55']
    const longSession = starts.map((inicio, index) => ({
      disciplina: 'Perícia Médica I',
      data_inicial: '25/08/2026',
      data_inicial_iso: '2026-08-25',
      dia: 'Terça-feira',
      inicio,
      fim: ends[index],
      turma: '7M80D',
    }))
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'calendario', {
      aulas: [anchor],
    }, 1_000).state
    const added = apply(baseline, 'calendario', {
      aulas: [anchor, ...longSession],
    }, 2_000)

    expect(added.added).toHaveLength(1)
    expect(added.added[0].kind).toBe('added')
    expect(added.added[0].details).toContainEqual({ label: 'Períodos seguidos', value: '6' })

    const removed = apply(added.state, 'calendario', { aulas: [anchor] }, 3_000)
    expect(removed.added).toHaveLength(1)
    expect(removed.added[0].kind).toBe('removed')
    expect(removed.added[0].details).toContainEqual({ label: 'Horário completo', value: '08:55 - 13:55' })
  })

  it('keeps date, day and class changes in a single reschedule notification', () => {
    const lesson = (date: string, iso: string, day: string, start: string, end: string, group: string) => ({
      aulas: [{
        disciplina: 'Semiologia e Nosologia',
        data_inicial: date,
        data_inicial_iso: iso,
        dia: day,
        inicio: start,
        fim: end,
        turma: group,
        subturma: 'A',
        tipo_turma: 'Prática',
      }],
    })
    const baseline = apply(
      createAcademicUpdatesState('scope-fixture'),
      'calendario',
      lesson('25/08/2026', '2026-08-25', 'Terça-feira', '07:00', '07:50', '7M80D'),
      1_000,
    ).state
    const result = apply(
      baseline,
      'calendario',
      lesson('26/08/2026', '2026-08-26', 'Quarta-feira', '08:55', '09:45', '7M80E'),
      2_000,
    )

    expect(result.added).toHaveLength(1)
    expect(result.added[0].title).toBe('Data e horário alterados')
    expect(result.added[0].changes.map((change) => change.label)).toEqual([
      'Data',
      'Dia da semana',
      'Horário',
      'Turma',
    ])
  })

  it('does not merge adjacent classes from different class groups', () => {
    const anchor = {
      disciplina: 'Clínica Médica II',
      data_inicial: '24/08/2026',
      data_inicial_iso: '2026-08-24',
      inicio: '07:00',
      fim: '07:50',
    }
    const baseline = apply(createAcademicUpdatesState('scope-fixture'), 'calendario', {
      aulas: [anchor],
    }, 1_000).state
    const result = apply(baseline, 'calendario', {
      aulas: [
        anchor,
        {
          disciplina: 'Semiologia',
          data_inicial: '25/08/2026',
          data_inicial_iso: '2026-08-25',
          inicio: '08:00',
          fim: '08:50',
          turma: '7M80D',
          subturma: 'A',
        },
        {
          disciplina: 'Semiologia',
          data_inicial: '25/08/2026',
          data_inicial_iso: '2026-08-25',
          inicio: '08:50',
          fim: '09:40',
          turma: '7M80D',
          subturma: 'B',
        },
      ],
    }, 2_000)

    expect(result.added).toHaveLength(2)
    expect(result.added.every((update) => update.kind === 'added')).toBe(true)
  })

  it('upgrades legacy calendar snapshots without flooding the feed', () => {
    const state = createAcademicUpdatesState('scope-fixture')
    state.updates = [
      {
        id: 'legacy-calendar-update',
        signature: 'legacy-calendar',
        module: 'calendario',
        kind: 'added',
        title: 'Aula adicionada',
        entityLabel: 'Clínica Médica II',
        summary: 'Clínica Médica II foi incluída em Horários.',
        changes: [],
        detectedAt: 900,
        readAt: null,
      },
      {
        id: 'preserved-absence-update',
        signature: 'preserved-absence',
        module: 'faltas',
        kind: 'changed',
        title: 'Frequência atualizada',
        entityLabel: 'Clínica Médica II',
        summary: 'Faltas: 5,00% para 7,50%.',
        changes: [{ label: 'Faltas', before: '5,00%', after: '7,50%' }],
        detectedAt: 800,
        readAt: null,
      },
    ]
    state.snapshots.calendario = {
      version: 1,
      capturedAt: 1_000,
      records: [{
        id: 'aula:id:123|0',
        namespace: 'aula:id:123|',
        entityLabel: 'Clínica Médica II',
        fields: {
          schedule: { label: 'Horário', value: '07:00 - 07:50', comparison: '07:00 - 07:50' },
          location: { label: 'Local', value: 'Sala 701', comparison: 'sala 701' },
          group: { label: 'Turma', value: '7M80D', comparison: '7m80d' },
        },
      }],
    }

    const result = apply(state, 'calendario', {
      aulas: [{
        disciplina: 'Clínica Médica II',
        data_inicial: '24/08/2026',
        data_inicial_iso: '2026-08-24',
        inicio: '07:00',
        fim: '07:50',
        turma: '7M80D',
      }],
    }, 2_000)

    expect(result.status).toBe('baseline')
    expect(result.added).toEqual([])
    expect(result.state.snapshots.calendario?.records[0].fields.date).toBeDefined()
    expect(result.state.updates.map((update) => update.id)).toEqual(['preserved-absence-update'])
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
    expect(result.added[0].details).toEqual(expect.arrayContaining([
      { label: 'Disciplina', value: 'Clínica Médica II' },
      { label: 'Categoria', value: 'Avaliação Parcial' },
      { label: 'Valor da avaliação', value: '30,0' },
    ]))
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
    expect(absences.added[0].details).toEqual(expect.arrayContaining([
      { label: 'Código', value: 'MED101' },
      { label: 'Faltas', value: '7,50%' },
      { label: 'Limite de faltas', value: '25,00%' },
    ]))
    expect(history.added[0].title).toBe('Situação acadêmica atualizada')
    expect(history.added[0].details).toEqual(expect.arrayContaining([
      { label: 'Período letivo', value: '1º Período' },
      { label: 'Situação', value: 'Concluída' },
      { label: 'Nota final', value: '74,0' },
    ]))
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
