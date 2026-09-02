import { describe, expect, it } from 'vitest'

import type { AvaCourse } from '@/lib/ava-types'
import { mergeMaterialSubjects, normalizeMaterialCourseName } from '@/lib/materials-matching'
import type { TotvsMaterialsCourse } from '@/lib/totvs-materials-types'

function avaCourse(id: number, fullName: string, shortName = fullName): AvaCourse {
  return {
    id,
    fullName,
    shortName,
    categoryId: null,
    startsAt: '2026-08-01',
    endsAt: '2026-12-31',
    courseUrl: `https://ava.example/course/view.php?id=${id}`,
  }
}

function totvsCourse(id: string, name: string): TotvsMaterialsCourse {
  return { id, name, materials: [] }
}

describe('normalizeMaterialCourseName', () => {
  it('ignores accents, case, punctuation and repeated whitespace', () => {
    expect(normalizeMaterialCourseName('  CLÍNICA: Médica — II  ')).toBe('clinica medica ii')
    expect(normalizeMaterialCourseName('Clínica-Médica II')).toBe('clinica medica ii')
    expect(normalizeMaterialCourseName('Cli\u0301nica Médica II')).toBe('clinica medica ii')
  })

  it.each([
    'Anatomia - 7M80D',
    'Anatomia - M80D626.1',
    'Anatomia - Turma: 7M80D',
    'Anatomia – Turma: M80D626.1',
    'Anatomia — 7m80d ',
  ])('strips a trailing turma code from %s', (name) => {
    expect(normalizeMaterialCourseName(name)).toBe('anatomia')
  })

  it.each([
    ['Clínica Médica - I', 'clinica medica i'],
    ['Clínica Médica - II', 'clinica medica ii'],
    ['Clínica Médica - 2', 'clinica medica 2'],
    ['Clínica Médica II - 7M80D', 'clinica medica ii'],
    ['Clínica Médica 2 - M80D626.1', 'clinica medica 2'],
    ['Bioquímica B12', 'bioquimica b12'],
  ])('preserves subject levels and numerals in %s', (name, expected) => {
    expect(normalizeMaterialCourseName(name)).toBe(expected)
  })
})

describe('mergeMaterialSubjects', () => {
  it('merges exact normalized names and keeps both source objects', () => {
    const ava = avaCourse(17, 'INTRODUÇÃO À SAÚDE - 7M80D')
    const totvs = totvsCourse('discipline-91', 'Introdução à Saúde')

    expect(mergeMaterialSubjects([ava], [totvs])).toEqual([
      { id: '17', name: ava.fullName, avaCourse: ava, totvsCourse: totvs },
    ])
  })

  it('uses the AVA shortName as another exact normalized alias', () => {
    const ava = avaCourse(18, 'Curso AVA 2026 - M80D626.1', 'Anatomia Humana - Turma: 7M80D')
    const totvs = totvsCourse('anatomia', 'ANATOMIA HUMANA')

    expect(mergeMaterialSubjects([ava], [totvs])).toEqual([
      { id: '18', name: ava.fullName, avaCourse: ava, totvsCourse: totvs },
    ])
  })

  it('does not count identical fullName and shortName matches twice', () => {
    const ava = avaCourse(19, 'Ética', 'ETICA')
    const totvs = totvsCourse('etica', 'Ética')

    expect(mergeMaterialSubjects([ava], [totvs])).toHaveLength(1)
    expect(mergeMaterialSubjects([ava], [totvs])[0].totvsCourse).toBe(totvs)
  })

  it('keeps Roman numeral and numeric levels separate', () => {
    const ava = [
      avaCourse(1, 'Clínica Médica I - 7M80D'),
      avaCourse(2, 'Clínica Médica II - 7M80D'),
      avaCourse(3, 'Clínica Médica 2 - 7M80D'),
    ]
    const totvs = [
      totvsCourse('level-2', 'Clínica Médica 2'),
      totvsCourse('level-ii', 'Clínica Médica II'),
      totvsCourse('level-i', 'Clínica Médica I'),
    ]

    expect(mergeMaterialSubjects(ava, totvs).map(subject => subject.totvsCourse?.id)).toEqual([
      'level-i', 'level-ii', 'level-2',
    ])
  })

  it('does not join substrings or similar names', () => {
    const ava = [avaCourse(1, 'Clínica Médica'), avaCourse(2, 'Anatomia Humana')]
    const totvs = [totvsCourse('clinica', 'Clínica Médica I'), totvsCourse('anatomia', 'Anatomia')]

    const subjects = mergeMaterialSubjects(ava, totvs)

    expect(subjects.map(subject => subject.id)).toEqual(['1', '2', 'totvs-clinica', 'totvs-anatomia'])
    expect(subjects.every(subject => subject.avaCourse === null || subject.totvsCourse === null)).toBe(true)
  })

  it('leaves ambiguous AVA courses and their shared TOTVS candidate separate', () => {
    const ava = [avaCourse(1, 'Anatomia - 7M80D'), avaCourse(2, 'ANATOMIA - 8M80D')]
    const totvs = [totvsCourse('anatomia', 'Anatomia')]

    const subjects = mergeMaterialSubjects(ava, totvs)

    expect(subjects.map(subject => subject.id)).toEqual(['1', '2', 'totvs-anatomia'])
    expect(subjects[0].totvsCourse).toBeNull()
    expect(subjects[1].totvsCourse).toBeNull()
    expect(subjects[2].avaCourse).toBeNull()
  })

  it('leaves an AVA course with multiple TOTVS candidates separate', () => {
    const ava = [avaCourse(1, 'Anatomia')]
    const totvs = [totvsCourse('anatomia-a', 'Anatomia'), totvsCourse('anatomia-b', 'ANATOMIA')]

    const subjects = mergeMaterialSubjects(ava, totvs)

    expect(subjects.map(subject => subject.id)).toEqual(['1', 'totvs-anatomia-a', 'totvs-anatomia-b'])
    expect(subjects[0].totvsCourse).toBeNull()
  })

  it('does not resolve alias ambiguity by greedily choosing a candidate', () => {
    const ava = [avaCourse(1, 'Anatomia', 'Histologia'), avaCourse(2, 'Anatomia')]
    const totvs = [totvsCourse('anatomia', 'Anatomia'), totvsCourse('histologia', 'Histologia')]

    expect(mergeMaterialSubjects(ava, totvs).map(subject => subject.id)).toEqual([
      '1', '2', 'totvs-anatomia', 'totvs-histologia',
    ])
  })

  it('returns TOTVS-only disciplines without an AVA connection', () => {
    const totvs = [totvsCourse('17', 'Anatomia'), totvsCourse('26', 'Histologia')]

    expect(mergeMaterialSubjects([], totvs)).toEqual([
      { id: 'totvs-17', name: 'Anatomia', avaCourse: null, totvsCourse: totvs[0] },
      { id: 'totvs-26', name: 'Histologia', avaCourse: null, totvsCourse: totvs[1] },
    ])
  })

  it('keeps AVA numeric route IDs stable when TOTVS is unavailable or later matches', () => {
    const ava = avaCourse(103, 'Anatomia')

    expect(mergeMaterialSubjects([ava], [])[0]).toEqual({
      id: '103', name: 'Anatomia', avaCourse: ava, totvsCourse: null,
    })
    expect(mergeMaterialSubjects([ava], [totvsCourse('other-id', 'Anatomia')])[0].id).toBe('103')
  })

  it('preserves AVA order and appends unmatched TOTVS courses in their original order', () => {
    const ava = [avaCourse(20, 'Histologia'), avaCourse(10, 'Anatomia')]
    const totvs = [
      totvsCourse('etica', 'Ética'),
      totvsCourse('anatomia', 'Anatomia'),
      totvsCourse('saude', 'Saúde'),
      totvsCourse('histologia', 'Histologia'),
    ]
    const avaBefore = structuredClone(ava)
    const totvsBefore = structuredClone(totvs)

    expect(mergeMaterialSubjects(ava, totvs).map(subject => subject.id)).toEqual([
      '20', '10', 'totvs-etica', 'totvs-saude',
    ])
    expect(ava).toEqual(avaBefore)
    expect(totvs).toEqual(totvsBefore)
  })

  it('does not merge empty normalized names', () => {
    const ava = avaCourse(1, '---', '')
    const totvs = totvsCourse('empty', ' ')

    expect(mergeMaterialSubjects([ava], [totvs])).toHaveLength(2)
  })

  it('uses shortName for display if AVA fullName is blank', () => {
    const ava = avaCourse(1, ' ', 'Anatomia')

    expect(mergeMaterialSubjects([ava], [])[0].name).toBe('Anatomia')
  })

  it('returns an empty list when neither source has courses', () => {
    expect(mergeMaterialSubjects([], [])).toEqual([])
  })
})
