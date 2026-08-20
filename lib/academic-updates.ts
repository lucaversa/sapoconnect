import { EVALUATION_BACKGROUND_SKIPPED } from '@/lib/evaluation-update-batch'
import {
  isSpecialEvaluation,
  isSummaryEvaluation,
  parseEvaluationGrade,
} from '@/lib/evaluation-progress'

// Version 2 intentionally starts a clean update feed after the grouped-session redesign.
export const ACADEMIC_UPDATES_SCHEMA_VERSION = 2

export type AcademicModule = 'calendario' | 'faltas' | 'avaliacoes' | 'ava' | 'historico'
export type AcademicUpdateKind = 'added' | 'changed' | 'removed'
export type AcademicSnapshotStatus =
  | 'baseline'
  | 'updated'
  | 'unchanged'
  | 'ignored-stale'
  | 'ignored-incomplete'

export interface AcademicUpdateChange {
  label: string
  before: string
  after: string
}

export interface AcademicUpdateDetail {
  label: string
  value: string
}

export interface AcademicUpdate {
  id: string
  signature: string
  module: AcademicModule
  kind: AcademicUpdateKind
  title: string
  entityLabel: string
  context?: string
  summary: string
  changes: AcademicUpdateChange[]
  details?: AcademicUpdateDetail[]
  detectedAt: number
  readAt: number | null
}

interface AcademicSnapshotField {
  label: string
  value: string
  comparison: string
}

export interface AcademicSnapshotRecord {
  id: string
  namespace: string
  entityLabel: string
  context?: string
  fields: Record<string, AcademicSnapshotField>
  details?: AcademicUpdateDetail[]
}

export interface AcademicModuleSnapshot {
  version: number
  capturedAt: number
  records: AcademicSnapshotRecord[]
  pendingNamespaces?: string[]
}

export interface AcademicUpdatesState {
  version: number
  cacheScope: string
  snapshots: Partial<Record<AcademicModule, AcademicModuleSnapshot>>
  updates: AcademicUpdate[]
  lastSuccessfulSyncAt: Partial<Record<AcademicModule, number>>
  lastFullSyncAt?: Partial<Record<AcademicModule, number>>
  lastBackgroundSweepAt: number
}

export interface ApplyAcademicSnapshotResult {
  state: AcademicUpdatesState
  added: AcademicUpdate[]
  status: AcademicSnapshotStatus
}

interface NormalizedSnapshot {
  records: AcademicSnapshotRecord[]
  protectedNamespaces: string[]
  skippedNamespaces?: string[]
  partial?: boolean
  allowEmpty?: boolean
}

interface UpdateCandidate {
  kind: AcademicUpdateKind
  previous?: AcademicSnapshotRecord
  current?: AcademicSnapshotRecord
  changes: AcademicUpdateChange[]
}

const MAX_UPDATES = 200
const UPDATE_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000
const MAX_CONSECUTIVE_GAP_MINUTES = 15
const EMPTY_VALUE = 'Não informada'

export const ACADEMIC_MODULE_META: Record<
  AcademicModule,
  { label: string; href: string }
> = {
  calendario: { label: 'Horários', href: '/app/calendario' },
  faltas: { label: 'Faltas', href: '/app/faltas' },
  avaliacoes: { label: 'Avaliações', href: '/app/avaliacoes' },
  ava: { label: 'AVA', href: '/app/ava' },
  historico: { label: 'Histórico', href: '/app/historico' },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function arrayFrom(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function displayText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeAvaCourseLabel(value: unknown): string {
  return displayText(value).replace(/\s*[-\u2013\u2014]\s*7M80D\s*$/i, '').trim()
}

function comparisonText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

function keyText(value: unknown): string {
  return comparisonText(displayText(value)).replace(/[^a-z0-9]+/g, '-') || 'sem-id'
}

function numericComparison(value: string): string {
  const parsed = Number.parseFloat(value.replace(/\s/g, '').replace('%', '').replace(',', '.'))
  return Number.isFinite(parsed) ? String(parsed) : comparisonText(value)
}

function numericValue(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseFloat(value.replace(/\s/g, '').replace('%', '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function field(label: string, value: unknown, numeric = false): AcademicSnapshotField {
  const displayed = displayText(value)
  return {
    label,
    value: displayed,
    comparison: numeric ? numericComparison(displayed) : comparisonText(displayed),
  }
}

function datePart(value: unknown): string {
  const displayed = displayText(value)
  return displayed.includes('T') ? displayed.split('T')[0] : displayed
}

function uniqueText(values: unknown[]): string {
  return Array.from(new Set(values.map(displayText).filter(Boolean))).join(', ')
}

function timeInMinutes(value: unknown): number | null {
  const match = displayText(value).match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function formatLocalDateTime(value: unknown): string {
  const displayed = displayText(value)
  const match = displayed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return displayed
  const [, year, month, day, hours, minutes] = match
  return `${day}/${month}/${year} às ${hours}:${minutes}`
}

function detail(label: string, value: unknown): AcademicUpdateDetail | null {
  const displayed = displayText(value)
  return displayed ? { label, value: displayed } : null
}

function detailsFrom(values: Array<AcademicUpdateDetail | null>): AcademicUpdateDetail[] {
  return values.filter((value): value is AcademicUpdateDetail => value !== null)
}

interface CalendarSession {
  lessons: Record<string, unknown>[]
  namespace: string
  date: string
}

function normalizeCalendar(data: Record<string, unknown>): NormalizedSnapshot {
  const lessons = arrayFrom(data.aulas)
  const groups = new Map<string, { namespace: string; date: string; lessons: Record<string, unknown>[] }>()

  for (const lesson of lessons) {
    const date = datePart(lesson.data_inicial_iso) || displayText(lesson.data_inicial)
    const identity = keyText(lesson.disciplina)
    const namespace = `aula:${identity}|`
    const dayKey = [lesson.disciplina, date, lesson.turma, lesson.subturma, lesson.tipo_turma]
      .map(keyText)
      .join('|')
    const group = groups.get(dayKey) ?? { namespace, date, lessons: [] }
    group.lessons.push(lesson)
    groups.set(dayKey, group)
  }

  const sessions: CalendarSession[] = []
  for (const group of Array.from(groups.values())) {
    const sortedLessons = [...group.lessons].sort((left, right) => {
      const leftTime = `${displayText(left.inicio)}|${displayText(left.fim)}|${displayText(left.sala)}`
      const rightTime = `${displayText(right.inicio)}|${displayText(right.fim)}|${displayText(right.sala)}`
      return leftTime.localeCompare(rightTime, 'pt-BR')
    })

    let current: CalendarSession | null = null
    for (const lesson of sortedLessons) {
      if (!current) {
        current = { lessons: [lesson], namespace: group.namespace, date: group.date }
        continue
      }

      const previousLesson = current.lessons[current.lessons.length - 1]
      const previousEnd = timeInMinutes(previousLesson.fim)
      const nextStart = timeInMinutes(lesson.inicio)
      const isConsecutive = previousEnd !== null && nextStart !== null
        && nextStart >= previousEnd
        && nextStart - previousEnd <= MAX_CONSECUTIVE_GAP_MINUTES

      if (isConsecutive) current.lessons.push(lesson)
      else {
        sessions.push(current)
        current = { lessons: [lesson], namespace: group.namespace, date: group.date }
      }
    }
    if (current) sessions.push(current)
  }

  const records: AcademicSnapshotRecord[] = []
  const duplicateCounts = new Map<string, number>()
  for (const session of sessions.sort((left, right) => {
    const leftKey = `${left.namespace}${left.date}|${displayText(left.lessons[0]?.inicio)}`
    const rightKey = `${right.namespace}${right.date}|${displayText(right.lessons[0]?.inicio)}`
    return leftKey.localeCompare(rightKey, 'pt-BR')
  })) {
    const firstLesson = session.lessons[0]
    const lastLesson = session.lessons[session.lessons.length - 1]
    const entityLabel = displayText(firstLesson.disciplina) || 'Aula'
    const date = displayText(firstLesson.data_inicial) || session.date
    const day = uniqueText(session.lessons.map((lesson) => lesson.dia))
    const start = displayText(firstLesson.inicio)
    const end = displayText(lastLesson.fim)
    const schedule = [start, end].filter(Boolean).join(' - ')
    const buildings = uniqueText(session.lessons.map((lesson) => lesson.predio))
    const blocks = uniqueText(session.lessons.map((lesson) => lesson.bloco))
    const rooms = uniqueText(session.lessons.map((lesson) => lesson.sala))
    const location = [buildings, blocks, rooms].filter(Boolean).join(' / ')
    const endDate = uniqueText(session.lessons.map((lesson) => lesson.data_final))
    const baseId = [
      `${session.namespace}${keyText(session.date)}`,
      keyText(start),
      keyText(end),
      keyText(firstLesson.turma),
      keyText(firstLesson.subturma),
      keyText(firstLesson.tipo_turma),
    ].join('|')
    const duplicateIndex = duplicateCounts.get(baseId) ?? 0
    duplicateCounts.set(baseId, duplicateIndex + 1)

    records.push({
      id: `${baseId}|${duplicateIndex}`,
      namespace: session.namespace,
      entityLabel,
      context: [day, date].filter(Boolean).join(', ') || undefined,
      fields: {
        date: field('Data', date),
        day: field('Dia da semana', day),
        schedule: field('Horário', schedule),
        periods: field('Períodos seguidos', session.lessons.length, true),
        location: field('Local', location),
        group: field('Turma', firstLesson.turma),
        subgroup: field('Subturma', firstLesson.subturma),
        classType: field('Tipo de turma', firstLesson.tipo_turma),
      },
      details: detailsFrom([
        detail('Data', date),
        detail('Dia da semana', day),
        detail('Horário completo', schedule),
        detail('Períodos seguidos', session.lessons.length),
        detail('Local completo', location),
        detail('Prédio', buildings),
        detail('Bloco', blocks),
        detail('Sala', rooms),
        detail('Turma', firstLesson.turma),
        detail('Subturma', firstLesson.subturma),
        detail('Tipo de turma', firstLesson.tipo_turma),
        endDate && endDate !== date ? detail('Data final', endDate) : null,
      ]),
    })
  }

  return { records, protectedNamespaces: [] }
}

function normalizeAbsences(data: Record<string, unknown>): NormalizedSnapshot {
  const records = arrayFrom(data.faltas).map((absence) => {
    const entityLabel = displayText(absence.disciplina) || 'Disciplina'
    const namespace = `disc:${keyText(absence.codigo || entityLabel)}|`
    const riskValue = displayText(absence.status)
    const riskLabel = riskValue === 'abaixo'
      ? 'Seguro'
      : riskValue === 'proximo'
        ? 'Próximo do limite'
        : riskValue === 'acima'
          ? 'Acima do limite'
          : riskValue
    const futureEvents = Array.isArray(absence.eventosFuturos)
      ? absence.eventosFuturos.map(formatLocalDateTime).filter(Boolean)
      : []
    return {
      id: `${namespace}frequencia`,
      namespace,
      entityLabel,
      fields: {
        percentage: field('Faltas', absence.porcentagem, true),
        limit: field('Limite', absence.limiteFaltas, true),
        situation: field('Situação', absence.situacao),
        risk: field('Nível de atenção', riskLabel),
      },
      details: detailsFrom([
        detail('Código', absence.codigo),
        detail('Turma', absence.turma),
        detail('Situação', absence.situacao),
        detail('Faltas', absence.porcentagem),
        detail('Limite de faltas', absence.limiteFaltas),
        detail('Carga horária', absence.ch),
        detail('Impacto de uma falta', absence.umaFaltaPct),
        detail('Aulas no calendário', absence.aulasTotal),
        detail('Aulas já realizadas', absence.aulasRealizadas),
        detail('Dias restantes', absence.diasRestantes),
        detail('Próxima aula', futureEvents[0]),
        futureEvents.length > 0 ? detail('Aulas futuras', futureEvents.length) : null,
      ]),
    } satisfies AcademicSnapshotRecord
  })

  return { records, protectedNamespaces: [] }
}

function normalizeEvaluations(data: Record<string, unknown>): NormalizedSnapshot {
  const records: AcademicSnapshotRecord[] = []
  const protectedNamespaces: string[] = []
  const skippedNamespaces: string[] = []
  const partial = data.__partial === true

  for (const subject of arrayFrom(data.disciplinas)) {
    const subjectLabel = displayText(subject.nome) || 'Disciplina'
    const namespace = `disc:${keyText(subject.codigo || subjectLabel)}|`
    if (displayText(subject.error) || !isRecord(subject.resultado)) {
      protectedNamespaces.push(namespace)
      if (displayText(subject.code) === EVALUATION_BACKGROUND_SKIPPED) {
        skippedNamespaces.push(namespace)
      }
      continue
    }

    const duplicateCounts = new Map<string, number>()
    const regularGrades: number[] = []
    let regularEvaluationCount = 0
    let pendingRegularCount = 0
    for (const category of arrayFrom(subject.resultado.categorias)) {
      const categoryLabel = displayText(category.nome) || 'Avaliação'
      for (const evaluation of arrayFrom(category.avaliacoes)) {
        const entityLabel = displayText(evaluation.nome) || 'Avaliação'
        const isRegular = !isSpecialEvaluation(categoryLabel, entityLabel)
          && !isSummaryEvaluation(categoryLabel, entityLabel)
        if (isRegular) {
          regularEvaluationCount += 1
          const grade = parseEvaluationGrade(displayText(evaluation.nota))
          if (grade === null) pendingRegularCount += 1
          else regularGrades.push(grade)
        }
        const base = `${namespace}${keyText(categoryLabel)}|${keyText(entityLabel)}`
        const duplicateIndex = duplicateCounts.get(base) ?? 0
        duplicateCounts.set(base, duplicateIndex + 1)
        records.push({
          id: `${base}|${duplicateIndex}`,
          namespace,
          entityLabel,
          context: `${subjectLabel} / ${categoryLabel}`,
          fields: {
            grade: field('Nota', evaluation.nota, true),
            value: field('Valor', evaluation.valor, true),
            date: field('Data', evaluation.data),
          },
          details: detailsFrom([
            detail('Disciplina', subjectLabel),
            detail('Categoria', categoryLabel),
            detail('Avaliação', entityLabel),
            detail('Data', evaluation.data),
            detail('Nota', evaluation.nota),
            detail('Valor da avaliação', evaluation.valor),
            detail('Média para aprovação', subject.resultado.mediaParaAprovacao),
          ]),
        })
      }
    }

    const approvalTarget = parseEvaluationGrade(displayText(subject.resultado.mediaParaAprovacao)) ?? 60
    const launchedTotal = regularGrades.reduce((total, grade) => total + grade, 0)
    const remaining = Math.max(approvalTarget - launchedTotal, 0)
    const averageStatus = launchedTotal >= approvalTarget
      ? 'Média regular atingida'
      : 'Abaixo da média regular'
    records.push({
      id: `${namespace}resumo`,
      namespace,
      entityLabel: subjectLabel,
      context: 'Resumo da disciplina',
      fields: {
        launchedTotal: field('Total regular lançado', launchedTotal, true),
        pendingCount: field('Avaliações pendentes', pendingRegularCount, true),
        averageStatus: field('Situação da média', averageStatus),
        approvalTarget: field('Média para aprovação', approvalTarget, true),
      },
      details: detailsFrom([
        detail('Disciplina', subjectLabel),
        detail('Total regular lançado', launchedTotal.toFixed(1).replace('.', ',')),
        detail('Média para aprovação', approvalTarget.toFixed(1).replace('.', ',')),
        detail('Pontos necessários', remaining.toFixed(1).replace('.', ',')),
        detail('Avaliações regulares', regularEvaluationCount),
        detail('Avaliações pendentes', pendingRegularCount),
      ]),
    })
  }

  return { records, protectedNamespaces, skippedNamespaces, partial }
}

function normalizeHistory(data: Record<string, unknown>): NormalizedSnapshot {
  const records: AcademicSnapshotRecord[] = []
  const duplicateCounts = new Map<string, number>()

  for (const period of arrayFrom(data.periodos)) {
    const periodLabel = displayText(period.nome)
    for (const subject of arrayFrom(period.disciplinas)) {
      const entityLabel = displayText(subject.nome) || 'Disciplina'
      const base = `disc:${keyText(subject.codigo || entityLabel)}|${keyText(periodLabel)}`
      const duplicateIndex = duplicateCounts.get(base) ?? 0
      duplicateCounts.set(base, duplicateIndex + 1)
      const namespace = `${base}|`
      records.push({
        id: `${namespace}${duplicateIndex}`,
        namespace,
        entityLabel,
        context: periodLabel || undefined,
        fields: {
          status: field('Situação', subject.situacao || subject.status),
          grade: field('Nota final', subject.nota, true),
          absences: field('Faltas', subject.faltas, true),
        },
        details: detailsFrom([
          detail('Período letivo', periodLabel),
          detail('Código', subject.codigo),
          detail('Situação', subject.situacao || subject.status),
          detail('Créditos', subject.creditos),
          detail('Carga horária', subject.ch),
          detail('Carga horária integralizada', subject.chIntegralizada),
          detail('Conceito', subject.conceito),
          detail('Nota final', subject.nota),
          detail('Faltas', subject.faltas),
          detail('Período de referência', subject.periodo),
        ]),
      })
    }
  }

  return { records, protectedNamespaces: [] }
}

function normalizeAva(data: Record<string, unknown>): NormalizedSnapshot {
  const records = arrayFrom(data.tasks).map((task) => {
    const entityLabel = displayText(task.name) || 'Atividade'
    const courseLabel = normalizeAvaCourseLabel(task.courseName) || 'Disciplina'
    const taskId = displayText(task.id) || `${task.courseId}:${entityLabel}`
    const namespace = `ava:${keyText(task.courseId || courseLabel)}|`
    const deadline = formatLocalDateTime(task.deadline)
    return {
      id: `${namespace}${keyText(taskId)}`,
      namespace,
      entityLabel,
      context: courseLabel,
      fields: {
        deadline: field('Prazo', deadline),
        urgency: field('Proximidade do prazo', task.urgencyLabel),
        course: field('Disciplina', courseLabel),
        type: field('Tipo', task.moduleLabel),
      },
      details: detailsFrom([
        detail('Disciplina', courseLabel),
        detail('Atividade', entityLabel),
        detail('Tipo', task.moduleLabel),
        detail('Prazo', deadline),
        detail('Situação', task.urgencyLabel),
      ]),
    } satisfies AcademicSnapshotRecord
  })
  return { records, protectedNamespaces: [], allowEmpty: true }
}

function normalizeSnapshot(module: AcademicModule, data: unknown): NormalizedSnapshot | null {
  if (!isRecord(data)) return null
  if (module === 'calendario' && !Array.isArray(data.aulas)) return null
  if (module === 'faltas' && !Array.isArray(data.faltas)) return null
  if (module === 'avaliacoes' && !Array.isArray(data.disciplinas)) return null
  if (module === 'historico' && !Array.isArray(data.periodos)) return null
  if (module === 'ava' && (!Array.isArray(data.tasks) || !Array.isArray(data.courses))) return null

  switch (module) {
    case 'calendario':
      return normalizeCalendar(data)
    case 'faltas':
      return normalizeAbsences(data)
    case 'avaliacoes':
      return normalizeEvaluations(data)
    case 'historico':
      return normalizeHistory(data)
    case 'ava':
      return normalizeAva(data)
  }
}

function hashText(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function changesBetween(
  previous: AcademicSnapshotRecord,
  current: AcademicSnapshotRecord,
): AcademicUpdateChange[] {
  const changes: AcademicUpdateChange[] = []
  const fieldKeys = new Set([...Object.keys(previous.fields), ...Object.keys(current.fields)])

  for (const key of Array.from(fieldKeys)) {
    // The course ID is already part of every AVA record identity. A display-name
    // cleanup or rename must not make every pending task look updated.
    if (key === 'course' && previous.namespace.startsWith('ava:')) continue
    const before = previous.fields[key]
    const after = current.fields[key]
    if ((before?.comparison ?? '') === (after?.comparison ?? '')) continue
    changes.push({
      label: after?.label ?? before?.label ?? 'Informação',
      before: before?.value || EMPTY_VALUE,
      after: after?.value || EMPTY_VALUE,
    })
  }
  return changes
}

function titleFor(
  module: AcademicModule,
  kind: AcademicUpdateKind,
  changes: AcademicUpdateChange[],
): string {
  if (kind === 'added') {
    if (module === 'calendario') return 'Aula adicionada'
    if (module === 'avaliacoes') return 'Avaliação adicionada'
    if (module === 'ava') return 'Nova atividade no AVA'
    return 'Disciplina adicionada'
  }
  if (kind === 'removed') {
    if (module === 'calendario') return 'Aula não aparece mais'
    if (module === 'avaliacoes') return 'Avaliação não aparece mais'
    if (module === 'ava') return 'Atividade concluída ou removida'
    return 'Disciplina não aparece mais'
  }

  const labels = new Set(changes.map((change) => change.label))
  if (module === 'calendario') {
    if (labels.has('Data') && labels.has('Horário')) return 'Data e horário alterados'
    if (labels.has('Data')) return 'Data da aula alterada'
    if (labels.has('Horário') && labels.has('Local')) return 'Horário e local alterados'
    if (labels.has('Horário')) return 'Horário da aula alterado'
    if (labels.has('Local')) return 'Local da aula alterado'
    return 'Aula atualizada'
  }
  if (module === 'avaliacoes') {
    const grade = changes.find((change) => change.label === 'Nota')
    if (grade?.before === EMPTY_VALUE && grade.after !== EMPTY_VALUE) return 'Nota lançada'
    if (grade && grade.after === EMPTY_VALUE) return 'Nota removida'
    if (grade) return 'Nota corrigida'
    return 'Avaliação atualizada'
  }
  if (module === 'faltas') {
    const risk = changes.find((change) => change.label === 'Nível de atenção')
    if (risk?.after === 'Acima do limite') return 'Limite de faltas ultrapassado'
    if (risk?.after === 'Próximo do limite') return 'Faltas próximas do limite'
    if (risk?.after === 'Seguro') return 'Faltas em nível seguro'
    return 'Faltas atualizadas'
  }
  if (module === 'ava') {
    if (labels.has('Prazo')) return 'Prazo da atividade alterado'
    if (labels.has('Proximidade do prazo')) return 'Atividade perto do prazo'
    return 'Atividade atualizada no AVA'
  }
  return 'Situação acadêmica atualizada'
}

function summaryFor(
  module: AcademicModule,
  kind: AcademicUpdateKind,
  record: AcademicSnapshotRecord,
  changes: AcademicUpdateChange[],
): string {
  if (module === 'calendario') {
    const date = record.fields.date?.value
    const schedule = record.fields.schedule?.value
    const location = record.fields.location?.value
    const descriptor = [
      date,
      schedule ? `das ${schedule.replace(' - ', ' às ')}` : '',
      location ? `em ${location}` : '',
    ].filter(Boolean).join(', ')
    if (kind === 'added') return descriptor ? `Incluída em ${descriptor}.` : 'Aula incluída nos horários.'
    if (kind === 'removed') return descriptor ? `Não aparece mais em ${descriptor}.` : 'Aula removida dos horários atuais.'
    const changedLabels = changes.map((change) => change.label.toLocaleLowerCase('pt-BR')).join(', ')
    if (changedLabels && descriptor) return `Mudanças em ${changedLabels}. Agora: ${descriptor}.`
  }

  if (module === 'faltas' && kind === 'changed') {
    const percentage = changes.find((change) => change.label === 'Faltas')
    const before = numericValue(percentage?.before)
    const after = numericValue(percentage?.after)
    const impact = numericValue(record.details?.find((item) => item.label === 'Impacto de uma falta')?.value)
    if (percentage && before !== null && after !== null) {
      const delta = after - before
      const direction = delta > 0 ? 'aumento' : delta < 0 ? 'redução' : 'alteração'
      const deltaText = Math.abs(delta).toFixed(2).replace('.', ',')
      const estimatedAbsences = impact && impact > 0 && delta > 0
        ? Math.max(1, Math.round(delta / impact))
        : null
      return `Faltas: ${percentage.before} para ${percentage.after} (${direction} de ${deltaText} p.p.)${estimatedAbsences ? `, aproximadamente ${estimatedAbsences} ${estimatedAbsences === 1 ? 'falta registrada' : 'faltas registradas'}` : ''}.`
    }
  }

  if (module === 'ava') {
    const deadline = record.fields.deadline?.value
    const course = record.fields.course?.value
    const urgency = record.fields.urgency?.value
    if (kind === 'added') return `${record.entityLabel} foi publicada em ${course || 'uma disciplina'}${deadline ? `, com prazo em ${deadline}` : ''}.`
    if (kind === 'removed') return `${record.entityLabel} não aparece mais entre as pendências do AVA.`
    if (urgency && changes.some((change) => change.label === 'Proximidade do prazo')) {
      return `${record.entityLabel}: ${urgency}${deadline ? `. Prazo em ${deadline}.` : '.'}`
    }
  }

  if (kind === 'added') return `${record.entityLabel} foi incluída em ${ACADEMIC_MODULE_META[module].label}.`
  if (kind === 'removed') return `${record.entityLabel} não aparece mais nos dados atuais.`
  const relevant = changes.slice(0, 2).map(
    (change) => `${change.label}: ${change.before} para ${change.after}`,
  )
  return relevant.length > 0 ? `${relevant.join('. ')}.` : `${record.entityLabel} foi atualizada.`
}

function createUpdate(
  module: AcademicModule,
  kind: AcademicUpdateKind,
  previous: AcademicSnapshotRecord | undefined,
  current: AcademicSnapshotRecord | undefined,
  changes: AcademicUpdateChange[],
  detectedAt: number,
): AcademicUpdate {
  const record = current ?? previous
  if (!record) throw new Error('Registro acadêmico ausente')
  const signatureSource = JSON.stringify({ module, kind, id: record.id, changes })
  const signature = hashText(signatureSource)
  return {
    id: `${module}:${detectedAt}:${signature}`,
    signature,
    module,
    kind,
    title: titleFor(module, kind, changes),
    entityLabel: record.entityLabel,
    context: record.context,
    summary: summaryFor(module, kind, record, changes),
    changes,
    details: record.details ?? Object.values(record.fields)
      .filter((item) => item.value)
      .map((item) => ({ label: item.label, value: item.value })),
    detectedAt,
    readAt: null,
  }
}

function candidateRecord(candidate: UpdateCandidate): AcademicSnapshotRecord {
  const record = candidate.current ?? candidate.previous
  if (!record) throw new Error('Registro acadêmico ausente')
  return record
}

function isEvaluationSummaryRecord(record: AcademicSnapshotRecord): boolean {
  return record.id.endsWith('|resumo')
}

function resignUpdate(
  update: AcademicUpdate,
  changes: AcademicUpdateChange[],
  details: AcademicUpdateDetail[],
): AcademicUpdate {
  const signature = hashText(JSON.stringify({
    module: update.module,
    kind: update.kind,
    entityLabel: update.entityLabel,
    changes,
  }))
  return {
    ...update,
    id: `${update.module}:${update.detectedAt}:${signature}`,
    signature,
    changes,
    details,
  }
}

function uniqueDetails(details: AcademicUpdateDetail[]): AcademicUpdateDetail[] {
  const seen = new Set<string>()
  return details.filter((item) => {
    const key = `${item.label}\u0000${item.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function createEvaluationUpdates(
  candidates: UpdateCandidate[],
  detectedAt: number,
): AcademicUpdate[] {
  const groups = new Map<string, UpdateCandidate[]>()
  for (const candidate of candidates) {
    const namespace = candidateRecord(candidate).namespace
    const group = groups.get(namespace) ?? []
    group.push(candidate)
    groups.set(namespace, group)
  }

  return Array.from(groups.values()).map((group) => {
    const primary = group.filter((candidate) => !isEvaluationSummaryRecord(candidateRecord(candidate)))
    const summaries = group.filter((candidate) => isEvaluationSummaryRecord(candidateRecord(candidate)))
    const summaryChanges = summaries.flatMap((candidate) => candidate.changes.map((change) => ({
      ...change,
      label: `Resumo — ${change.label}`,
    })))
    const summaryDetails = summaries.flatMap((candidate) => candidateRecord(candidate).details ?? [])

    if (primary.length <= 1) {
      const source = primary[0] ?? summaries[0]
      const record = candidateRecord(source)
      let update = createUpdate(
        'avaliacoes',
        source.kind,
        source.previous,
        source.current,
        source.changes,
        detectedAt,
      )
      if (primary.length === 0) {
        const reachedAverage = source.changes.some(
          (change) => change.label === 'Situação da média' && change.after === 'Média regular atingida',
        )
        update = {
          ...update,
          title: reachedAverage ? 'Média regular atingida' : 'Resumo da disciplina atualizado',
          entityLabel: record.entityLabel,
        }
      }
      const changes = primary.length === 1
        ? [...update.changes, ...summaryChanges]
        : update.changes
      const details = uniqueDetails([...(update.details ?? []), ...summaryDetails])
      return resignUpdate(update, changes, details)
    }

    const records = primary.map(candidateRecord)
    const subjectLabel = records[0].context?.split(' / ')[0] || records[0].entityLabel
    const allGradesLaunched = primary.every((candidate) =>
      candidate.kind === 'changed'
      && candidate.changes.some(
        (change) => change.label === 'Nota'
          && change.before === EMPTY_VALUE
          && change.after !== EMPTY_VALUE,
      ),
    )
    const changes = [
      ...primary.flatMap((candidate) => candidate.changes.map((change) => ({
        ...change,
        label: `${candidateRecord(candidate).entityLabel} — ${change.label}`,
      }))),
      ...summaryChanges,
    ]
    const details = uniqueDetails([
      { label: 'Disciplina', value: subjectLabel },
      ...primary.map((candidate) => {
        const record = candidateRecord(candidate)
        const grade = record.fields.grade?.value
        const date = record.fields.date?.value
        const value = record.fields.value?.value
        const descriptor = [
          candidate.kind === 'added' ? 'Nova avaliação' : candidate.kind === 'removed' ? 'Avaliação removida' : 'Atualizada',
          grade ? `nota ${grade}` : null,
          value ? `valor ${value}` : null,
          date ? `data ${date}` : null,
        ].filter(Boolean).join(' • ')
        return { label: record.entityLabel, value: descriptor }
      }),
      ...summaryDetails,
    ])
    const kind = primary.every((candidate) => candidate.kind === primary[0].kind)
      ? primary[0].kind
      : 'changed'
    const signature = hashText(JSON.stringify({ module: 'avaliacoes', kind, subjectLabel, changes }))
    return {
      id: `avaliacoes:${detectedAt}:${signature}`,
      signature,
      module: 'avaliacoes',
      kind,
      title: allGradesLaunched ? `${primary.length} notas lançadas` : 'Avaliações atualizadas',
      entityLabel: subjectLabel,
      context: `${primary.length} mudanças agrupadas`,
      summary: `${primary.length} avaliações tiveram alterações. Abra para conferir todos os detalhes.`,
      changes,
      details,
      detectedAt,
      readAt: null,
    }
  })
}

function mergeRecordDetails(
  previous: AcademicSnapshotRecord[],
  current: AcademicSnapshotRecord[],
  preservePrevious = true,
): AcademicSnapshotRecord[] {
  if (!preservePrevious) return current
  const previousById = new Map(previous.map((record) => [record.id, record]))
  return current.map((record) => {
    const prior = previousById.get(record.id)
    if (!prior?.details?.length) return record
    return {
      ...record,
      details: uniqueDetails([...(record.details ?? []), ...prior.details]),
    }
  })
}

function mergeProtectedRecords(
  previous: AcademicSnapshotRecord[],
  current: AcademicSnapshotRecord[],
  protectedNamespaces: string[],
): AcademicSnapshotRecord[] {
  if (protectedNamespaces.length === 0) return current
  const currentIds = new Set(current.map((record) => record.id))
  const protectedPrevious = previous.filter(
    (record) =>
      protectedNamespaces.some((namespace) => record.namespace === namespace) &&
      !currentIds.has(record.id),
  )
  return [...current, ...protectedPrevious]
}

function isLegacyCalendarSnapshot(snapshot: AcademicModuleSnapshot): boolean {
  return snapshot.records.some(
    (record) => !record.fields.date || !record.fields.periods,
  )
}

function calendarRecordPairs(
  previousRecords: AcademicSnapshotRecord[],
  currentRecords: AcademicSnapshotRecord[],
): Array<[AcademicSnapshotRecord, AcademicSnapshotRecord]> {
  const pairs: Array<[AcademicSnapshotRecord, AcademicSnapshotRecord]> = []
  const matchedPrevious = new Set<string>()
  const matchedCurrent = new Set<string>()
  const previousById = new Map(previousRecords.map((record) => [record.id, record]))

  for (const current of currentRecords) {
    const previous = previousById.get(current.id)
    if (!previous) continue
    pairs.push([previous, current])
    matchedPrevious.add(previous.id)
    matchedCurrent.add(current.id)
  }

  const previousByNamespace = new Map<string, AcademicSnapshotRecord[]>()
  const currentByNamespace = new Map<string, AcademicSnapshotRecord[]>()
  for (const previous of previousRecords) {
    if (matchedPrevious.has(previous.id)) continue
    const group = previousByNamespace.get(previous.namespace) ?? []
    group.push(previous)
    previousByNamespace.set(previous.namespace, group)
  }
  for (const current of currentRecords) {
    if (matchedCurrent.has(current.id)) continue
    const group = currentByNamespace.get(current.namespace) ?? []
    group.push(current)
    currentByNamespace.set(current.namespace, group)
  }

  for (const [namespace, previousGroup] of Array.from(previousByNamespace.entries())) {
    const currentGroup = currentByNamespace.get(namespace)
    if (!currentGroup) continue
    const sortedPrevious = [...previousGroup].sort((left, right) => left.id.localeCompare(right.id, 'pt-BR'))
    const sortedCurrent = [...currentGroup].sort((left, right) => left.id.localeCompare(right.id, 'pt-BR'))
    const pairCount = Math.min(sortedPrevious.length, sortedCurrent.length)
    for (let index = 0; index < pairCount; index += 1) {
      const previous = sortedPrevious[index]
      const current = sortedCurrent[index]
      pairs.push([previous, current])
      matchedPrevious.add(previous.id)
      matchedCurrent.add(current.id)
    }
  }

  return pairs
}

function withModuleSnapshot(
  state: AcademicUpdatesState,
  module: AcademicModule,
  records: AcademicSnapshotRecord[],
  capturedAt: number,
  added: AcademicUpdate[],
  pendingNamespaces: string[] = [],
  partial = false,
): AcademicUpdatesState {
  const retained = state.updates.filter(
    (update) => capturedAt - update.detectedAt <= UPDATE_RETENTION_MS,
  )

  return {
    ...state,
    snapshots: {
      ...state.snapshots,
      [module]: {
        version: ACADEMIC_UPDATES_SCHEMA_VERSION,
        capturedAt,
        records,
        pendingNamespaces,
      },
    },
    updates: [...added, ...retained]
      .sort((left, right) => right.detectedAt - left.detectedAt)
      .slice(0, MAX_UPDATES),
    lastSuccessfulSyncAt: {
      ...state.lastSuccessfulSyncAt,
      [module]: capturedAt,
    },
    lastFullSyncAt: partial
      ? state.lastFullSyncAt
      : {
          ...state.lastFullSyncAt,
          [module]: capturedAt,
        },
  }
}

export function createAcademicUpdatesState(cacheScope: string): AcademicUpdatesState {
  return {
    version: ACADEMIC_UPDATES_SCHEMA_VERSION,
    cacheScope,
    snapshots: {},
    updates: [],
    lastSuccessfulSyncAt: {},
    lastFullSyncAt: {},
    lastBackgroundSweepAt: 0,
  }
}

export function isAcademicUpdatesState(
  value: unknown,
  expectedScope: string,
): value is AcademicUpdatesState {
  if (!isRecord(value)) return false
  return (
    value.version === ACADEMIC_UPDATES_SCHEMA_VERSION &&
    value.cacheScope === expectedScope &&
    isRecord(value.snapshots) &&
    Array.isArray(value.updates) &&
    isRecord(value.lastSuccessfulSyncAt) &&
    typeof value.lastBackgroundSweepAt === 'number' &&
    (value.lastFullSyncAt === undefined || isRecord(value.lastFullSyncAt))
  )
}

export function migrateAcademicUpdatesState(
  state: AcademicUpdatesState,
): AcademicUpdatesState {
  const updates = state.updates.filter((update) => {
    if (update.module !== 'ava' || update.kind !== 'changed' || update.changes.length === 0) {
      return true
    }
    const onlyCosmeticCourseChanges = update.changes.every((change) => (
      change.label === 'Disciplina'
      && comparisonText(normalizeAvaCourseLabel(change.before))
        === comparisonText(normalizeAvaCourseLabel(change.after))
    ))
    return !onlyCosmeticCourseChanges
  })

  if (state.lastFullSyncAt && updates.length === state.updates.length) return state
  return {
    ...state,
    updates,
    lastFullSyncAt: state.lastFullSyncAt ?? { ...state.lastSuccessfulSyncAt },
  }
}

export function applyAcademicSnapshot(
  state: AcademicUpdatesState,
  module: AcademicModule,
  data: unknown,
  capturedAt: number,
): ApplyAcademicSnapshotResult {
  if (isRecord(data) && data.__cacheStale === true) {
    return { state, added: [], status: 'ignored-stale' }
  }

  const normalized = normalizeSnapshot(module, data)
  if (!normalized) return { state, added: [], status: 'ignored-incomplete' }
  if (normalized.records.length === 0 && normalized.protectedNamespaces.length > 0) {
    return { state, added: [], status: 'ignored-incomplete' }
  }

  const previousSnapshot = state.snapshots[module]
  if (normalized.partial && !previousSnapshot) {
    return { state, added: [], status: 'ignored-incomplete' }
  }
  if (!previousSnapshot) {
    return {
      state: withModuleSnapshot(
        state,
        module,
        normalized.records,
        capturedAt,
        [],
        normalized.protectedNamespaces,
        normalized.partial,
      ),
      added: [],
      status: 'baseline',
    }
  }

  if (module === 'calendario' && isLegacyCalendarSnapshot(previousSnapshot)) {
    const stateWithoutLegacyCalendarUpdates = {
      ...state,
      updates: state.updates.filter((update) => update.module !== 'calendario'),
    }
    return {
      state: withModuleSnapshot(
        stateWithoutLegacyCalendarUpdates,
        module,
        normalized.records,
        capturedAt,
        [],
        normalized.protectedNamespaces,
      ),
      added: [],
      status: 'baseline',
    }
  }

  if (
    previousSnapshot.records.length > 0 &&
    normalized.records.length === 0 &&
    normalized.protectedNamespaces.length === 0 &&
    !normalized.allowEmpty
  ) {
    return { state, added: [], status: 'ignored-incomplete' }
  }

  const currentRecords = mergeRecordDetails(
    previousSnapshot.records,
    mergeProtectedRecords(
      previousSnapshot.records,
      normalized.records,
      normalized.protectedNamespaces,
    ),
    module !== 'ava',
  )
  const previouslyPendingNamespaces = new Set(previousSnapshot.pendingNamespaces ?? [])
  const pendingNamespaces = new Set(previousSnapshot.pendingNamespaces ?? [])
  const skippedNamespaces = new Set(normalized.skippedNamespaces ?? [])
  for (const record of normalized.records) pendingNamespaces.delete(record.namespace)
  for (const namespace of normalized.protectedNamespaces) {
    if (!skippedNamespaces.has(namespace)) pendingNamespaces.add(namespace)
  }
  const candidates: UpdateCandidate[] = []
  const matchedPrevious = new Set<string>()
  const matchedCurrent = new Set<string>()
  const previousById = new Map(previousSnapshot.records.map((record) => [record.id, record]))
  const evaluationSummaryNamespaces = new Set(
    previousSnapshot.records
      .filter(isEvaluationSummaryRecord)
      .map((record) => record.namespace),
  )
  const pairs = module === 'calendario'
    ? calendarRecordPairs(previousSnapshot.records, currentRecords)
    : currentRecords.flatMap((current) => {
      const previous = previousById.get(current.id)
      return previous ? [[previous, current] as [AcademicSnapshotRecord, AcademicSnapshotRecord]] : []
    })

  for (const [previous, current] of pairs) {
    matchedPrevious.add(previous.id)
    matchedCurrent.add(current.id)
    const changes = changesBetween(previous, current)
    if (changes.length > 0) {
      candidates.push({ kind: 'changed', previous, current, changes })
    }
  }

  for (const current of currentRecords) {
    if (matchedCurrent.has(current.id)) continue
    if (
      module === 'avaliacoes'
      && isEvaluationSummaryRecord(current)
      && !evaluationSummaryNamespaces.has(current.namespace)
    ) continue
    if (!previouslyPendingNamespaces.has(current.namespace)) {
      candidates.push({ kind: 'added', current, changes: [] })
    }
  }

  for (const previous of previousSnapshot.records) {
    if (!matchedPrevious.has(previous.id)) {
      candidates.push({ kind: 'removed', previous, changes: [] })
    }
  }

  const added = module === 'avaliacoes'
    ? createEvaluationUpdates(candidates, capturedAt)
    : candidates.map((candidate) => createUpdate(
        module,
        candidate.kind,
        candidate.previous,
        candidate.current,
        candidate.changes,
        capturedAt,
      ))

  return {
    state: withModuleSnapshot(
      state,
      module,
      currentRecords,
      capturedAt,
      added,
      Array.from(pendingNamespaces),
      normalized.partial,
    ),
    added,
    status: added.length > 0 ? 'updated' : 'unchanged',
  }
}

export function markAcademicUpdateRead(
  state: AcademicUpdatesState,
  id: string,
  readAt = Date.now(),
): AcademicUpdatesState {
  return {
    ...state,
    updates: state.updates.map((update) =>
      update.id === id && update.readAt === null ? { ...update, readAt } : update,
    ),
  }
}

export function markAllAcademicUpdatesRead(
  state: AcademicUpdatesState,
  readAt = Date.now(),
): AcademicUpdatesState {
  return {
    ...state,
    updates: state.updates.map((update) =>
      update.readAt === null ? { ...update, readAt } : update,
    ),
  }
}

export function recordBackgroundSweep(
  state: AcademicUpdatesState,
  attemptedAt = Date.now(),
): AcademicUpdatesState {
  return { ...state, lastBackgroundSweepAt: attemptedAt }
}
