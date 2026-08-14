import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildCalendarioPDF,
  prepareWeeklyBlocksForExport,
  summarizeSubjectsForExport,
} from '@/lib/calendar-export'
import type { Aula } from '@/types/calendario'

function classFixture(overrides: Partial<Aula>): Aula {
  return {
    dia_num: 2,
    dia: 'Segunda-feira',
    inicio: '07:00',
    fim: '07:50',
    disciplina: 'CLÍNICA MÉDICA II',
    turma: '7M80D',
    subturma: '7M80 - D08',
    data_inicial: '17/08/2026',
    data_inicial_iso: '2026-08-17T07:00:00-03:00',
    data_final: '17/08/2026',
    data_final_iso: '2026-08-17T07:50:00-03:00',
    predio: 'UNIDADE II',
    bloco: '7º A',
    sala: 'SL701/702',
    tipo_turma: 'Teórica',
    detalhe_id: 'fixture',
    detalhe_url: '',
    raw_details: {},
    ...overrides,
  }
}

describe('weekly schedule PDF layout', () => {
  it('keeps PDF headings factual and free of promotional copy', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/calendar-export.ts'), 'utf8')

    expect(source).not.toContain('AGENDA ACADÊMICA · VISÃO RECORRENTE')
    expect(source).not.toContain('Sua semana organizada para consultar, salvar e levar com você.')
    expect(source).not.toContain('Detalhes das disciplinas e encontros recorrentes')
  })

  it('merges consecutive class periods into one weekly block', () => {
    const aulas = Array.from({ length: 5 }, (_, week) => [
      classFixture({ detalhe_id: `week-${week}-1`, inicio: '07:00', fim: '07:50' }),
      classFixture({ detalhe_id: `week-${week}-2`, inicio: '08:00', fim: '08:50' }),
      classFixture({ detalhe_id: `week-${week}-3`, inicio: '09:00', fim: '09:50' }),
    ]).flat()

    const blocks = prepareWeeklyBlocksForExport(aulas)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ dayIndex: 0, startHour: 7, endHour: 9 + 50 / 60 })
  })

  it('does not merge periods separated by a real break', () => {
    const aulas = Array.from({ length: 5 }, (_, week) => [
      classFixture({ detalhe_id: `morning-${week}`, inicio: '07:00', fim: '07:50' }),
      classFixture({ detalhe_id: `afternoon-${week}`, inicio: '08:20', fim: '09:10' }),
    ]).flat()

    expect(prepareWeeklyBlocksForExport(aulas)).toHaveLength(2)
  })

  it('keeps class, group, time and location in the subject index', () => {
    const schedule = prepareWeeklyBlocksForExport(Array.from({ length: 5 }, (_, week) =>
      classFixture({ detalhe_id: `weekly-${week}`, sala: 'CONS. 802' }),
    ))

    expect(summarizeSubjectsForExport(schedule)).toEqual([
      expect.objectContaining({
        disciplina: 'CLÍNICA MÉDICA II',
        turma: '7M80D',
        subturma: '7M80 - D08',
        sessions: [expect.objectContaining({
          dayIndex: 0,
          startHour: 7,
          endHour: 7 + 50 / 60,
          location: expect.stringContaining('CONS. 802'),
        })],
      }),
    ])
  })

  it('builds the editorial schedule and subject index as two landscape pages', async () => {
    const aulas = Array.from({ length: 5 }, (_, week) =>
      classFixture({ detalhe_id: `pdf-${week}` }),
    )
    const pdf = await buildCalendarioPDF(aulas, '124101.00571', new Date('2026-08-14T12:00:00-03:00'))

    expect(pdf.getNumberOfPages()).toBe(2)
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight())
  })
})
