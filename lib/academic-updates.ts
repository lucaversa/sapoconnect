export const ACADEMIC_UPDATES_SCHEMA_VERSION = 1

export type AcademicModule = 'calendario' | 'faltas' | 'avaliacoes' | 'historico'
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

  for (const subject of arrayFrom(data.disciplinas)) {
    const subjectLabel = displayText(subject.nome) || 'Disciplina'
    const namespace = `disc:${keyText(subject.codigo || subjectLabel)}|`
    if (displayText(subject.error) || !isRecord(subject.resultado)) {
      protectedNamespaces.push(namespace)
      continue
    }

    const duplicateCounts = new Map<string, number>()
    for (const category of arrayFrom(subject.resultado.categorias)) {
      const categoryLabel = displayText(category.nome) || 'Avaliação'
      for (const evaluation of arrayFrom(category.avaliacoes)) {
        const entityLabel = displayText(evaluation.nome) || 'Avaliação'
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
  }

  return { records, protectedNamespaces }
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

function normalizeSnapshot(module: AcademicModule, data: unknown): NormalizedSnapshot | null {
  if (!isRecord(data)) return null
  if (module === 'calendario' && !Array.isArray(data.aulas)) return null
  if (module === 'faltas' && !Array.isArray(data.faltas)) return null
  if (module === 'avaliacoes' && !Array.isArray(data.disciplinas)) return null
  if (module === 'historico' && !Array.isArray(data.periodos)) return null

  switch (module) {
    case 'calendario':
      return normalizeCalendar(data)
    case 'faltas':
      return normalizeAbsences(data)
    case 'avaliacoes':
      return normalizeEvaluations(data)
    case 'historico':
      return normalizeHistory(data)
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
    return 'Disciplina adicionada'
  }
  if (kind === 'removed') {
    if (module === 'calendario') return 'Aula não aparece mais'
    if (module === 'avaliacoes') return 'Avaliação não aparece mais'
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
  if (module === 'faltas') return 'Frequência atualizada'
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
  }
}

export function createAcademicUpdatesState(cacheScope: string): AcademicUpdatesState {
  return {
    version: ACADEMIC_UPDATES_SCHEMA_VERSION,
    cacheScope,
    snapshots: {},
    updates: [],
    lastSuccessfulSyncAt: {},
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
    typeof value.lastBackgroundSweepAt === 'number'
  )
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
  if (!previousSnapshot) {
    return {
      state: withModuleSnapshot(
        state,
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
    normalized.protectedNamespaces.length === 0
  ) {
    return { state, added: [], status: 'ignored-incomplete' }
  }

  const currentRecords = mergeProtectedRecords(
    previousSnapshot.records,
    normalized.records,
    normalized.protectedNamespaces,
  )
  const pendingNamespaces = new Set(previousSnapshot.pendingNamespaces ?? [])
  const added: AcademicUpdate[] = []
  const matchedPrevious = new Set<string>()
  const matchedCurrent = new Set<string>()
  const previousById = new Map(previousSnapshot.records.map((record) => [record.id, record]))
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
      added.push(createUpdate(module, 'changed', previous, current, changes, capturedAt))
    }
  }

  for (const current of currentRecords) {
    if (matchedCurrent.has(current.id)) continue
    if (!pendingNamespaces.has(current.namespace)) {
      added.push(createUpdate(module, 'added', undefined, current, [], capturedAt))
    }
  }

  for (const previous of previousSnapshot.records) {
    if (!matchedPrevious.has(previous.id)) {
      added.push(createUpdate(module, 'removed', previous, undefined, [], capturedAt))
    }
  }

  return {
    state: withModuleSnapshot(
      state,
      module,
      currentRecords,
      capturedAt,
      added,
      normalized.protectedNamespaces,
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
