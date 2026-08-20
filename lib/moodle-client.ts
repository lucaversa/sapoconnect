import 'server-only'

import { load } from 'cheerio'

import type {
  AvaCourse,
  AvaContentSummary,
  AvaCourseDetail,
  AvaCourseContentSummary,
  AvaMaterial,
  AvaOverview,
  AvaSection,
  AvaTask,
  AvaTaskUrgency,
} from '@/lib/ava-types'

const DEFAULT_MOODLE_BASE_URL = 'https://ava.cmmg.edu.br'
const MOODLE_SERVICE = 'moodle_mobile_app'
const REQUEST_TIMEOUT_MS = 25_000
const ACTION_EVENTS_PAGE_SIZE = 50
const MAX_ACTION_EVENT_PAGES = 4

type MoodleErrorKind = 'invalid-credentials' | 'invalid-token' | 'unavailable' | 'api'

export class MoodleClientError extends Error {
  constructor(
    message: string,
    public readonly kind: MoodleErrorKind,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'MoodleClientError'
  }
}

interface MoodleTokenResponse {
  token?: string
  error?: string
  errorcode?: string
}

export interface MoodleSiteInfo {
  userid: number
  username: string
  fullname?: string
  sitename?: string
}

export interface MoodleCourseRaw {
  id: number
  fullname?: string
  shortname?: string
  category?: number
  visible?: number | boolean
  startdate?: number
  enddate?: number
}

interface MoodleActionEventRaw {
  id?: number
  name?: string
  description?: string
  courseid?: number
  modulename?: string
  instance?: number
  eventtype?: string
  timestart?: number
  timesort?: number
  visible?: number | boolean
  action?: {
    name?: string
    url?: string
    actionable?: boolean
  }
  course?: {
    id?: number
    fullname?: string
    fullnamedisplay?: string
  }
}

interface MoodleActionEventsResponse {
  events?: MoodleActionEventRaw[]
  lastid?: number
}

interface MoodleFileRaw {
  type?: string
  filename?: string
  filepath?: string
  filesize?: number
  fileurl?: string
  timemodified?: number
  mimetype?: string
}

interface MoodleModuleRaw {
  id?: number
  name?: string
  description?: string
  modname?: string
  url?: string
  visible?: number | boolean
  uservisible?: boolean
  contents?: MoodleFileRaw[]
}

interface MoodleSectionRaw {
  id?: number
  name?: string
  summary?: string
  visible?: number | boolean
  modules?: MoodleModuleRaw[]
}

interface MoodleExceptionPayload {
  exception?: string
  errorcode?: string
  message?: string
}

function moodleBaseUrl(): URL {
  const value = process.env.MOODLE_BASE_URL || DEFAULT_MOODLE_BASE_URL
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('MOODLE_BASE_URL must use HTTPS')
  return new URL(url.origin)
}

export function getMoodlePublicUrl(): string {
  return moodleBaseUrl().origin
}

function isVisible(value: number | boolean | undefined): boolean {
  return value !== 0 && value !== false
}

function plainText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  return load(`<body>${value}</body>`)('body').text().replace(/\s+/g, ' ').trim()
}

function courseDisplayName(value: unknown): string {
  return plainText(value).replace(/\s*[-\u2013\u2014]\s*7M80D\s*$/i, '').trim()
}

function safeMoodlePageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const url = new URL(value, moodleBaseUrl())
    return url.origin === moodleBaseUrl().origin && url.protocol === 'https:'
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

function appendParameters(body: URLSearchParams, parameters: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      value.forEach((item, index) => body.append(`${key}[${index}]`, String(item)))
    } else if (typeof value === 'boolean') {
      body.append(key, value ? '1' : '0')
    } else {
      body.append(key, String(value))
    }
  }
}

function isMoodleException(value: unknown): value is MoodleExceptionPayload {
  return !!value && typeof value === 'object' && (
    typeof (value as MoodleExceptionPayload).exception === 'string'
    || typeof (value as MoodleExceptionPayload).errorcode === 'string'
  )
}

function moodleException(payload: MoodleExceptionPayload): MoodleClientError {
  const code = payload.errorcode || payload.exception || 'moodle_error'
  const invalidTokenCodes = new Set([
    'invalidtoken',
    'requireloginerror',
    'webservice_access_exception',
    'accessexception',
  ])
  if (invalidTokenCodes.has(code.toLowerCase())) {
    return new MoodleClientError('A conexão com o AVA expirou.', 'invalid-token', code)
  }
  return new MoodleClientError('O AVA não conseguiu concluir esta solicitação.', 'api', code)
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!response.ok) {
    throw new MoodleClientError('O AVA está indisponível no momento.', 'unavailable', String(response.status))
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new MoodleClientError('O AVA retornou uma resposta inválida.', 'unavailable')
  }
}

export async function callMoodle<T>(
  token: string,
  functionName: string,
  parameters: Record<string, unknown> = {},
): Promise<T> {
  const endpoint = new URL('/webservice/rest/server.php', moodleBaseUrl())
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction: functionName,
    moodlewsrestformat: 'json',
  })
  appendParameters(body, parameters)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new MoodleClientError('Não foi possível acessar o AVA.', 'unavailable')
  }

  const payload = await parseJsonResponse(response)
  if (isMoodleException(payload)) throw moodleException(payload)
  return payload as T
}

export async function requestMoodleToken(username: string, password: string): Promise<string> {
  const endpoint = new URL('/login/token.php', moodleBaseUrl())
  const body = new URLSearchParams({ username, password, service: MOODLE_SERVICE })

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new MoodleClientError('Não foi possível acessar o AVA.', 'unavailable')
  }

  const payload = await parseJsonResponse(response) as MoodleTokenResponse
  if (!payload.token) {
    if (payload.errorcode === 'invalidlogin' || payload.error) {
      throw new MoodleClientError('Usuário ou senha do AVA incorretos.', 'invalid-credentials', payload.errorcode)
    }
    throw new MoodleClientError('O AVA não forneceu uma conexão válida.', 'api', payload.errorcode)
  }
  return payload.token
}

export async function getMoodleSiteInfo(token: string): Promise<MoodleSiteInfo> {
  return callMoodle<MoodleSiteInfo>(token, 'core_webservice_get_site_info')
}

export function selectCurrentMoodleCourses(
  courses: MoodleCourseRaw[],
  nowSeconds = Math.floor(Date.now() / 1_000),
): MoodleCourseRaw[] {
  return courses
    .filter((course) => {
      const startsAt = Number(course.startdate || 0)
      const endsAt = Number(course.enddate || 0)
      return course.id > 1
        && isVisible(course.visible)
        && startsAt > 0
        && endsAt > 0
        && startsAt <= nowSeconds
        && endsAt >= nowSeconds
    })
    .sort((left, right) => (left.fullname || '').localeCompare(right.fullname || '', 'pt-BR'))
}

function toIsoDate(seconds: number): string {
  return new Date(seconds * 1_000).toISOString()
}

function mapCourse(course: MoodleCourseRaw): AvaCourse {
  const id = Number(course.id)
  return {
    id,
    fullName: courseDisplayName(course.fullname) || `Disciplina ${id}`,
    shortName: courseDisplayName(course.shortname) || `Disciplina ${id}`,
    categoryId: Number.isFinite(Number(course.category)) ? Number(course.category) : null,
    startsAt: toIsoDate(Number(course.startdate)),
    endsAt: toIsoDate(Number(course.enddate)),
    courseUrl: new URL(`/course/view.php?id=${id}`, moodleBaseUrl()).toString(),
  }
}

function taskUrgency(deadlineMs: number, nowMs: number): { urgency: AvaTaskUrgency; label: string } {
  const remaining = deadlineMs - nowMs
  if (remaining < 0) return { urgency: 'overdue', label: 'Prazo vencido' }
  if (remaining <= 2 * 60 * 60 * 1_000) return { urgency: 'two-hours', label: 'Vence em até 2 horas' }
  if (remaining <= 24 * 60 * 60 * 1_000) return { urgency: 'one-day', label: 'Vence em até 24 horas' }
  if (remaining <= 72 * 60 * 60 * 1_000) return { urgency: 'three-days', label: 'Vence em até 3 dias' }
  return { urgency: 'later', label: 'Prazo futuro' }
}

const MODULE_LABELS: Record<string, string> = {
  assign: 'Tarefa',
  quiz: 'Questionário',
  choice: 'Escolha',
  feedback: 'Pesquisa',
  forum: 'Fórum',
  lesson: 'Lição',
  scorm: 'Atividade SCORM',
  workshop: 'Laboratório',
}

function mapTask(
  event: MoodleActionEventRaw,
  coursesById: Map<number, AvaCourse>,
  nowMs: number,
): AvaTask | null {
  const courseId = Number(event.courseid || event.course?.id)
  const course = coursesById.get(courseId)
  const deadlineSeconds = Number(event.timesort || event.timestart || 0)
  if (!course || !Number.isFinite(deadlineSeconds) || deadlineSeconds <= 0) return null
  if (!isVisible(event.visible) || event.action?.actionable === false) return null
  const deadlineMs = deadlineSeconds * 1_000
  const { urgency, label } = taskUrgency(deadlineMs, nowMs)
  const moduleName = plainText(event.modulename) || 'activity'
  const eventId = Number(event.id || event.instance || 0)
  return {
    id: `${moduleName}:${eventId}`,
    courseId,
    courseName: course.fullName,
    name: plainText(event.name) || 'Atividade sem nome',
    description: plainText(event.description) || undefined,
    moduleName,
    moduleLabel: MODULE_LABELS[moduleName] || plainText(event.action?.name) || 'Atividade',
    deadline: new Date(deadlineMs).toISOString(),
    actionUrl: safeMoodlePageUrl(event.action?.url) || undefined,
    overdue: deadlineMs < nowMs,
    urgency,
    urgencyLabel: label,
  }
}

async function getEnrolledCourses(token: string, userId: number): Promise<MoodleCourseRaw[]> {
  const courses = await callMoodle<MoodleCourseRaw[]>(token, 'core_enrol_get_users_courses', {
    userid: userId,
  })
  return Array.isArray(courses) ? courses : []
}

async function getActionEvents(
  token: string,
  startsAtSeconds: number,
  endsAtSeconds: number,
): Promise<MoodleActionEventRaw[]> {
  const events: MoodleActionEventRaw[] = []
  let afterEventId: number | undefined

  for (let page = 0; page < MAX_ACTION_EVENT_PAGES; page += 1) {
    const response = await callMoodle<MoodleActionEventsResponse>(
      token,
      'core_calendar_get_action_events_by_timesort',
      {
        timesortfrom: startsAtSeconds,
        timesortto: endsAtSeconds,
        aftereventid: afterEventId,
        limitnum: ACTION_EVENTS_PAGE_SIZE,
        limittononsuspendedevents: true,
      },
    )
    const pageEvents = Array.isArray(response.events) ? response.events : []
    events.push(...pageEvents)
    const lastId = Number(response.lastid || 0)
    if (pageEvents.length < ACTION_EVENTS_PAGE_SIZE || !lastId || lastId === afterEventId) break
    afterEventId = lastId
  }

  return events
}

export async function getMoodleOverview(token: string, userId: number): Promise<AvaOverview> {
  const nowMs = Date.now()
  const currentRaw = selectCurrentMoodleCourses(
    await getEnrolledCourses(token, userId),
    Math.floor(nowMs / 1_000),
  )
  const courses = currentRaw.map(mapCourse)
  if (courses.length === 0) {
    return { courses: [], tasks: [], semester: null, fetchedAt: new Date(nowMs).toISOString() }
  }

  const startsAtSeconds = Math.min(...currentRaw.map((course) => Number(course.startdate)))
  const endsAtSeconds = Math.max(...currentRaw.map((course) => Number(course.enddate)))
  const coursesById = new Map(courses.map((course) => [course.id, course]))
  const events = await getActionEvents(token, startsAtSeconds, endsAtSeconds)
  const tasks = events
    .map((event) => mapTask(event, coursesById, nowMs))
    .filter((task): task is AvaTask => task !== null)
    .sort((left, right) => new Date(left.deadline).getTime() - new Date(right.deadline).getTime())

  return {
    courses,
    tasks,
    semester: {
      startsAt: toIsoDate(startsAtSeconds),
      endsAt: toIsoDate(endsAtSeconds),
    },
    fetchedAt: new Date(nowMs).toISOString(),
  }
}

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  resource: 'Arquivo',
  folder: 'Pasta',
  url: 'Link',
  page: 'Página',
  book: 'Livro',
  glossary: 'Glossário',
  database: 'Base de dados',
  file: 'Arquivo',
}

function mapFileMaterial(module: MoodleModuleRaw, file: MoodleFileRaw, index: number): AvaMaterial | null {
  const fileUrl = safeMoodleFileUrl(file.fileurl)
  if (!fileUrl) return null
  const moduleId = Number(module.id || 0)
  const fileName = plainText(file.filename) || plainText(module.name) || 'Material'
  return {
    id: `${moduleId}:file:${index}:${fileName}`,
    moduleId,
    name: plainText(module.name) || fileName,
    description: plainText(module.description) || undefined,
    type: module.modname || 'file',
    typeLabel: MATERIAL_TYPE_LABELS[module.modname || 'file'] || 'Material',
    fileName,
    mimeType: plainText(file.mimetype) || undefined,
    fileSize: Number.isFinite(Number(file.filesize)) ? Number(file.filesize) : undefined,
    updatedAt: Number(file.timemodified) > 0 ? toIsoDate(Number(file.timemodified)) : undefined,
    downloadUrl: `/api/moodle/files?url=${encodeURIComponent(fileUrl)}`,
  }
}

function mapModuleMaterials(module: MoodleModuleRaw): AvaMaterial[] {
  if (!isVisible(module.visible) || module.uservisible === false) return []
  const files = Array.isArray(module.contents)
    ? module.contents
        .filter((file) => file.type === 'file' || !!file.fileurl)
        .map((file, index) => mapFileMaterial(module, file, index))
        .filter((material): material is AvaMaterial => material !== null)
    : []
  if (files.length > 0) return files

  const type = module.modname || ''
  if (!['url', 'page', 'book', 'glossary', 'database', 'folder', 'resource'].includes(type)) return []
  const externalUrl = safeMoodlePageUrl(module.url)
  if (!externalUrl) return []
  const moduleId = Number(module.id || 0)
  return [{
    id: `${moduleId}:module`,
    moduleId,
    name: plainText(module.name) || 'Material',
    description: plainText(module.description) || undefined,
    type,
    typeLabel: MATERIAL_TYPE_LABELS[type] || 'Material',
    externalUrl,
  }]
}

export function mapMoodleSections(sections: MoodleSectionRaw[]): AvaSection[] {
  return sections
    .filter((section) => isVisible(section.visible))
    .map((section, index) => ({
      id: Number(section.id || index),
      name: plainText(section.name) || (index === 0 ? 'Geral' : `Seção ${index}`),
      summary: plainText(section.summary) || undefined,
      materials: (Array.isArray(section.modules) ? section.modules : []).flatMap(mapModuleMaterials),
    }))
    .filter((section) => section.materials.length > 0)
}

export function summarizeMoodleSections(
  courseId: number,
  sections: MoodleSectionRaw[],
): AvaCourseContentSummary {
  const visibleSections = mapMoodleSections(sections)
  return {
    courseId,
    sectionCount: visibleSections.length,
    materialCount: visibleSections.reduce(
      (total, section) => total + section.materials.length,
      0,
    ),
  }
}

export async function getMoodleContentSummary(
  token: string,
  courseIds: number[],
): Promise<AvaContentSummary> {
  const uniqueCourseIds = Array.from(new Set(courseIds))
  const courses = await Promise.all(uniqueCourseIds.map(async (courseId) => {
    const sections = await callMoodle<MoodleSectionRaw[]>(token, 'core_course_get_contents', {
      courseid: courseId,
    })
    return summarizeMoodleSections(courseId, Array.isArray(sections) ? sections : [])
  }))

  return { courses, fetchedAt: new Date().toISOString() }
}

export async function getMoodleCourseDetail(
  token: string,
  userId: number,
  courseId: number,
): Promise<AvaCourseDetail | null> {
  const overview = await getMoodleOverview(token, userId)
  const course = overview.courses.find((item) => item.id === courseId)
  if (!course) return null
  const sections = await callMoodle<MoodleSectionRaw[]>(token, 'core_course_get_contents', {
    courseid: courseId,
  })
  return {
    course,
    tasks: overview.tasks.filter((task) => task.courseId === courseId),
    sections: mapMoodleSections(Array.isArray(sections) ? sections : []),
    fetchedAt: new Date().toISOString(),
  }
}

export function safeMoodleFileUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const base = moodleBaseUrl()
    const url = new URL(value, base)
    if (url.origin !== base.origin || url.protocol !== 'https:' || url.username || url.password) return null

    const supportedPrefixes = ['/webservice/pluginfile.php/', '/pluginfile.php/', '/tokenpluginfile.php/']
    const prefix = supportedPrefixes.find((candidate) => url.pathname.startsWith(candidate))
    if (!prefix) return null
    if (prefix !== '/webservice/pluginfile.php/') {
      url.pathname = url.pathname.replace(prefix, '/webservice/pluginfile.php/')
    }
    url.searchParams.delete('token')
    return url.toString()
  } catch {
    return null
  }
}

export async function fetchMoodleFile(token: string, sourceUrl: string): Promise<Response> {
  const safeUrl = safeMoodleFileUrl(sourceUrl)
  if (!safeUrl) throw new MoodleClientError('Endereço de arquivo inválido.', 'api', 'invalid_file_url')
  const url = new URL(safeUrl)
  url.searchParams.set('token', token)
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new MoodleClientError('A conexão com o AVA expirou.', 'invalid-token')
      }
      throw new MoodleClientError('Não foi possível baixar este material.', 'unavailable')
    }
    return response
  } catch (error) {
    if (error instanceof MoodleClientError) throw error
    throw new MoodleClientError('Não foi possível baixar este material.', 'unavailable')
  }
}
