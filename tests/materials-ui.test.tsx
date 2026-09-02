import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AvaPage from '@/app/app/ava/page'
import AvaCoursePage from '@/app/app/ava/[courseId]/page'
import type { AvaContentSummary, AvaCourse, AvaCourseDetail, AvaOverview, AvaTask } from '@/lib/ava-types'
import type { TotvsMaterialsCourse, TotvsMaterialsOverview } from '@/lib/totvs-materials-types'

type QueryState<T> = {
  data?: T
  error: Error | null
  isLoading: boolean
  isPending: boolean
  isSuccess: boolean
  isFetching: boolean
  fetchStatus: 'idle' | 'fetching' | 'paused'
  dataUpdatedAt: number
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  course: vi.fn(),
  summary: vi.fn(),
  totvs: vi.fn(),
  integration: vi.fn(),
  params: vi.fn(),
  push: vi.fn(),
  openConnectionDialog: vi.fn(),
}))

vi.mock('@/hooks/use-ava', () => ({
  useAvaOverview: mocks.overview,
  useAvaCourse: mocks.course,
  useAvaContentSummary: mocks.summary,
}))
vi.mock('@/hooks/use-totvs-materials', () => ({ useTotvsMaterials: mocks.totvs }))
vi.mock('@/lib/ava-integration-provider', () => ({ useAvaIntegration: mocks.integration }))
vi.mock('next/navigation', () => ({
  useParams: mocks.params,
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => createElement('a', props, children),
  }
})
vi.mock('@/components/pull-to-refresh', () => ({ PullToRefresh: () => null }))
vi.mock('motion/react', async () => {
  const { createElement } = await import('react')
  const element = (tag: string) => ({ children, ...props }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) => {
    const domProps = { ...props }
    for (const prop of ['initial', 'animate', 'transition', 'variants', 'whileHover', 'whileTap', 'layout']) delete domProps[prop]
    return createElement(tag, domProps, children)
  }
  return {
    motion: { div: element('div'), section: element('section'), article: element('article'), button: element('button') },
    useReducedMotion: () => true,
  }
})

const fetchedAt = '2026-09-02T12:00:00.000Z'
const totvsId = '0123456789abcdef01234567'
const avaCourse: AvaCourse = {
  id: 103,
  fullName: 'ANATOMIA HUMANA - 7M80D',
  shortName: 'Anatomia Humana',
  categoryId: null,
  startsAt: '2026-08-01',
  endsAt: '2026-12-31',
  courseUrl: 'https://ava.example/course/view.php?id=103',
}
const task: AvaTask = {
  id: 'task-103',
  courseId: 103,
  courseName: avaCourse.fullName,
  name: 'Questionário de revisão',
  moduleName: 'quiz',
  moduleLabel: 'Questionário',
  deadline: '2026-09-05T12:00:00.000Z',
  actionUrl: 'https://ava.example/mod/quiz/view.php?id=7',
  overdue: false,
  urgency: 'three-days',
  urgencyLabel: 'Em três dias',
}
const totvsCourse: TotvsMaterialsCourse = {
  id: totvsId,
  name: 'Anatomia Humana',
  materials: [{
    id: '701',
    title: 'Roteiro do laboratório',
    fileName: 'roteiro-anatomia.pdf',
    sizeLabel: '512 KB',
    publishedAt: fetchedAt,
    publishedAtLabel: '02/09/2026',
    downloadUrl: 'https://totvs.example/private-file?token=do-not-render',
  }],
}

function query<T>(data?: T, overrides: Partial<QueryState<T>> = {}): QueryState<T> {
  return {
    data,
    error: null,
    isLoading: false,
    isPending: data === undefined,
    isSuccess: data !== undefined,
    isFetching: false,
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    refetch: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

function setConnection(connected: boolean, isUnavailable = false) {
  mocks.integration.mockReturnValue({
    connection: { connected },
    isLoading: false,
    isUnavailable,
    isDialogOpen: false,
    openConnectionDialog: mocks.openConnectionDialog,
    retryConnection: vi.fn(),
  })
}

function setAvaData() {
  mocks.overview.mockReturnValue(query<AvaOverview>({ courses: [avaCourse], tasks: [task], semester: null, fetchedAt }))
  mocks.summary.mockReturnValue(query<AvaContentSummary>({ courses: [{ courseId: 103, sectionCount: 1, materialCount: 2 }], fetchedAt }))
  mocks.course.mockReturnValue(query<AvaCourseDetail>({
    course: avaCourse,
    tasks: [task],
    sections: [{
      id: 22,
      name: 'Semana 1 — Introdução',
      materials: [{ id: 'ava-file-1', moduleId: 12, name: 'Aula introdutória', type: 'resource', typeLabel: 'Arquivo', fileName: 'aula.pdf' }],
    }],
    fetchedAt,
  }))
}

function setTotvsData() {
  mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>({ courses: [totvsCourse], fetchedAt }))
}

beforeEach(() => {
  vi.clearAllMocks()
  // The repository's Node Vitest setup preserves classic JSX in imported pages.
  vi.stubGlobal('React', React)
  setConnection(false)
  mocks.params.mockReturnValue({ courseId: `totvs-${totvsId}` })
  mocks.overview.mockReturnValue(query<AvaOverview>())
  mocks.course.mockReturnValue(query<AvaCourseDetail>())
  mocks.summary.mockReturnValue(query<AvaContentSummary>())
  mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('materials overview rendering', () => {
  it('makes TOTVS-only disciplines usable while AVA is disconnected', () => {
    setTotvsData()

    const $ = load(renderToStaticMarkup(<AvaPage />))
    const discipline = $(`a[href="/app/ava/totvs-${totvsId}"]`)

    expect($('h1').text()).toBe('Materiais')
    expect(discipline).toHaveLength(1)
    expect(discipline.text()).toContain('Anatomia Humana')
    expect(discipline.text()).toContain('EduConnect')
    expect($('span').filter((_, node) => $(node).text() === 'TOTVS')).toHaveLength(0)
    expect(discipline.text()).not.toContain('AVA')
    expect($('button').filter((_, node) => $(node).text() === 'Conectar AVA')).toHaveLength(1)
    expect($('body').text()).toContain('arquivos do EduConnect')
    expect($('body').text()).not.toContain('TOTVS')
    expect($('[role="dialog"]')).toHaveLength(0)
    expect(mocks.openConnectionDialog).not.toHaveBeenCalled()
    expect(mocks.overview).toHaveBeenCalledWith(false)
    expect(mocks.totvs).toHaveBeenCalledOnce()
  })

  it('renders one matched discipline with both source badges and the combined material count', () => {
    setConnection(true)
    setAvaData()
    setTotvsData()

    const $ = load(renderToStaticMarkup(<AvaPage />))
    const disciplines = $('section[aria-labelledby="ava-courses-title"] a')

    expect(disciplines).toHaveLength(1)
    expect(disciplines.attr('href')).toBe(`/app/ava/totvs-${totvsId}`)
    expect(disciplines.find('span').filter((_, node) => $(node).text() === 'AVA')).toHaveLength(1)
    expect(disciplines.find('span').filter((_, node) => $(node).text() === 'EduConnect')).toHaveLength(1)
    expect($('span').filter((_, node) => $(node).text() === 'TOTVS')).toHaveLength(0)
    expect(disciplines.text()).toContain('3materiais')
    expect(mocks.summary).toHaveBeenCalledWith([103], true)
  })

  it('keeps TOTVS disciplines visible when the AVA request fails', () => {
    setConnection(true)
    setTotvsData()
    mocks.overview.mockReturnValue(query<AvaOverview>(undefined, { error: new Error('AVA unavailable'), isPending: false }))

    const $ = load(renderToStaticMarkup(<AvaPage />))

    expect($('[role="status"]').text()).toContain('Não foi possível atualizar o AVA')
    expect($('[role="status"]').text()).toContain('Os arquivos do EduConnect continuam disponíveis')
    expect($(`a[href="/app/ava/totvs-${totvsId}"]`)).toHaveLength(1)
  })

  it('keeps AVA disciplines and tasks visible when the TOTVS request fails', () => {
    setConnection(true)
    setAvaData()
    mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>(undefined, { error: new Error('TOTVS unavailable'), isPending: false }))

    const $ = load(renderToStaticMarkup(<AvaPage />))

    expect($('[role="status"]').text()).toContain('Não foi possível atualizar o EduConnect')
    expect($('a[href="/app/ava/103"]')).toHaveLength(1)
    expect($('body').text()).toContain(task.name)
  })

  it('explains an offline, unsaved TOTVS list without claiming no disciplines exist', () => {
    mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>(undefined, { fetchStatus: 'paused' }))

    const $ = load(renderToStaticMarkup(<AvaPage />))

    expect($('[role="status"]').text()).toContain('EduConnect offline')
    expect($('[role="status"]').text()).toContain('Sem arquivos salvos neste dispositivo')
    expect($('[role="status"]').text()).toContain('Conecte-se para consultar o EduConnect')
    expect($('body').text()).not.toContain('Nenhuma disciplina atual')
  })
})

describe('materials source naming', () => {
  it.each([
    ['overview', AvaPage],
    ['detail', AvaCoursePage],
  ] as const)('uses EduConnect in the %s loading message', (_, Page) => {
    mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>(undefined, { isLoading: true, isFetching: true, fetchStatus: 'fetching' }))

    const $ = load(renderToStaticMarkup(<Page />))

    expect($('[role="status"]').text()).toContain('Buscando arquivos do EduConnect…')
    expect($('body').text()).not.toContain('TOTVS')
  })

  it('names EduConnect in the AVA unavailable notice', () => {
    setConnection(false, true)
    setTotvsData()

    const $ = load(renderToStaticMarkup(<AvaPage />))

    expect($('[role="status"]').text()).toContain('Os arquivos do EduConnect continuam disponíveis')
    expect($('body').text()).not.toContain('TOTVS')
  })
})

describe('materials detail rendering', () => {
  it('opens a prefixed 24-hex TOTVS route and renders protected file buttons without AVA', () => {
    setTotvsData()

    const html = renderToStaticMarkup(<AvaCoursePage />)
    const $ = load(html)
    const files = $('section[aria-labelledby="totvs-materials-title"]')

    expect($('h1').text()).toBe(totvsCourse.name)
    expect(files.find('span').filter((_, node) => $(node).text() === 'EduConnect')).toHaveLength(1)
    expect($('span').filter((_, node) => $(node).text() === 'TOTVS')).toHaveLength(0)
    expect(files.text()).toContain('Roteiro do laboratório')
    expect(files.text()).toContain('512 KB')
    expect(files.text()).toContain('02/09/2026')
    expect(files.find('button[aria-label="Baixar roteiro-anatomia.pdf"]')).toHaveLength(1)
    expect(files.find('a')).toHaveLength(0)
    expect(html).not.toContain('do-not-render')
    expect($('section[aria-labelledby="pending-tasks-title"]')).toHaveLength(0)
    expect(mocks.course).toHaveBeenCalledWith(null, false)
    expect(mocks.openConnectionDialog).not.toHaveBeenCalled()
  })

  it('preserves a numeric Moodle bookmark with tasks and content sections', () => {
    setConnection(true)
    setAvaData()
    mocks.params.mockReturnValue({ courseId: '103' })
    mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>({ courses: [], fetchedAt }))

    const $ = load(renderToStaticMarkup(<AvaCoursePage />))
    const tasks = $('section[aria-labelledby="pending-tasks-title"]')
    const content = $('section[aria-labelledby="course-materials-title"]')

    expect($('h1').text()).toBe(avaCourse.fullName)
    expect(tasks.text()).toContain(task.name)
    expect(tasks.find('a').attr('href')).toBe(task.actionUrl)
    expect(content.text()).toContain('Semana 1 — Introdução')
    expect(content.find('button[aria-controls="ava-section-22"]').attr('aria-expanded')).toBe('false')
    expect(mocks.course).toHaveBeenCalledWith(103, true)
  })

  it('separates TOTVS files from AVA activities and sectioned contents for a matched subject', () => {
    setConnection(true)
    setAvaData()
    setTotvsData()

    const $ = load(renderToStaticMarkup(<AvaCoursePage />))
    const files = $('section[aria-labelledby="totvs-materials-title"]')
    const content = $('section[aria-labelledby="course-materials-title"]')
    const tasks = $('section[aria-labelledby="pending-tasks-title"]')

    expect(files.find('span').filter((_, node) => $(node).text() === 'EduConnect')).toHaveLength(1)
    expect($('span').filter((_, node) => $(node).text() === 'TOTVS')).toHaveLength(0)
    expect(files.text()).toContain(totvsCourse.materials[0].title)
    expect(files.text()).not.toContain(task.name)
    expect(content.find('span').filter((_, node) => $(node).text() === 'AVA')).toHaveLength(1)
    expect(content.text()).toContain('Semana 1 — Introdução')
    expect(content.text()).not.toContain(totvsCourse.materials[0].title)
    expect(tasks.find('span').filter((_, node) => $(node).text() === 'AVA')).toHaveLength(1)
    expect(tasks.text()).toContain(task.name)
    expect(mocks.course).toHaveBeenCalledWith(103, true)
  })

  it('keeps TOTVS file downloads visible when AVA overview and detail fail', () => {
    setConnection(true)
    setTotvsData()
    mocks.overview.mockReturnValue(query<AvaOverview>(undefined, { error: new Error('AVA unavailable'), isPending: false }))
    mocks.course.mockReturnValue(query<AvaCourseDetail>(undefined, { error: new Error('AVA unavailable'), isPending: false }))

    const $ = load(renderToStaticMarkup(<AvaCoursePage />))

    expect($('[role="status"]').text()).toContain('Não foi possível atualizar o AVA')
    expect($('button[aria-label="Baixar roteiro-anatomia.pdf"]')).toHaveLength(1)
  })

  it('keeps numeric AVA detail available when TOTVS fails', () => {
    setConnection(true)
    setAvaData()
    mocks.params.mockReturnValue({ courseId: '103' })
    mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>(undefined, { error: new Error('TOTVS unavailable'), isPending: false }))

    const $ = load(renderToStaticMarkup(<AvaCoursePage />))

    expect($('[role="status"]').text()).toContain('Não foi possível atualizar o EduConnect')
    expect($('section[aria-labelledby="pending-tasks-title"]').text()).toContain(task.name)
    expect($('section[aria-labelledby="course-materials-title"]').text()).toContain('Semana 1 — Introdução')
  })

  it('explains offline detail without a saved file list', () => {
    mocks.totvs.mockReturnValue(query<TotvsMaterialsOverview>(undefined, { fetchStatus: 'paused' }))

    const $ = load(renderToStaticMarkup(<AvaCoursePage />))

    expect($('[role="status"]').text()).toContain('EduConnect offline')
    expect($('[role="status"]').text()).toContain('Sem arquivos salvos para esta disciplina')
    expect($('button[aria-label^="Baixar "]')).toHaveLength(0)
  })
})
