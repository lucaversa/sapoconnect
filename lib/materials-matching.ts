import type { AvaCourse } from '@/lib/ava-types'
import type { TotvsMaterialsCourse } from '@/lib/totvs-materials-types'

export interface MaterialSubject {
  id: string
  name: string
  avaCourse: AvaCourse | null
  totvsCourse: TotvsMaterialsCourse | null
}

export function normalizeMaterialCourseName(name: string): string {
  let normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const turmaSuffix = normalized.match(/\s+[-\u2010-\u2015]\s*(?:turma\s*:?\s*)?([a-z0-9]+(?:\.[a-z0-9]+)*)\s*$/)

  // Only mixed letter/digit codes are turma suffixes; I, II and 2 are subject levels.
  if (turmaSuffix && /[a-z]/.test(turmaSuffix[1]) && /[0-9]/.test(turmaSuffix[1])) {
    normalized = normalized.slice(0, turmaSuffix.index)
  }

  return normalized.replace(/[^a-z0-9]+/g, ' ').trim()
}

export function mergeMaterialSubjects(
  avaCourses: AvaCourse[],
  totvsCourses: TotvsMaterialsCourse[],
): MaterialSubject[] {
  const totvsNames = totvsCourses.map(course => normalizeMaterialCourseName(course.name))
  const candidateCountsByTotvs = totvsCourses.map(() => 0)
  const candidatesByAva = avaCourses.map(course => {
    const aliases = [course.fullName, course.shortName].map(normalizeMaterialCourseName).filter(Boolean)
    const candidates: number[] = []

    totvsNames.forEach((name, index) => {
      if (name && aliases.includes(name)) {
        candidates.push(index)
        candidateCountsByTotvs[index] += 1
      }
    })

    return candidates
  })
  const matchedTotvs = new Set<number>()
  const subjects: MaterialSubject[] = avaCourses.map((course, index) => {
    const candidates = candidatesByAva[index]
    const totvsIndex = candidates[0]
    // Check both sides before matching so ambiguous aliases never resolve by input order.
    const hasUniqueMatch = candidates.length === 1 && candidateCountsByTotvs[totvsIndex] === 1

    if (hasUniqueMatch) matchedTotvs.add(totvsIndex)

    return {
      id: String(course.id),
      name: course.fullName.trim() || course.shortName,
      avaCourse: course,
      totvsCourse: hasUniqueMatch ? totvsCourses[totvsIndex] : null,
    }
  })

  totvsCourses.forEach((course, index) => {
    if (!matchedTotvs.has(index)) {
      subjects.push({ id: `totvs-${course.id}`, name: course.name, avaCourse: null, totvsCourse: course })
    }
  })

  return subjects
}
