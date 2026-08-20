import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  getMoodleContentSummary,
  getMoodleOverview,
  mapMoodleSections,
  safeMoodleFileUrl,
  selectCurrentMoodleCourses,
} from '@/lib/moodle-client'

beforeEach(() => {
  vi.stubEnv('MOODLE_BASE_URL', 'https://ava.cmmg.edu.br')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Moodle integration mapping', () => {
  it('keeps only visible courses whose dates contain the current semester', () => {
    const now = 1_786_000_000
    const current = { id: 10, fullname: 'Atual', visible: 1, startdate: now - 10, enddate: now + 10 }
    const result = selectCurrentMoodleCourses([
      current,
      { id: 11, fullname: 'Antiga', visible: 1, startdate: now - 100, enddate: now - 50 },
      { id: 12, fullname: 'Futura', visible: 1, startdate: now + 50, enddate: now + 100 },
      { id: 13, fullname: 'Oculta', visible: 0, startdate: now - 10, enddate: now + 10 },
      { id: 1, fullname: 'Site', visible: 1, startdate: now - 10, enddate: now + 10 },
    ], now)

    expect(result).toEqual([current])
  })

  it('accepts only Moodle plugin files and removes injected tokens', () => {
    const safe = safeMoodleFileUrl('https://ava.cmmg.edu.br/pluginfile.php/10/mod_resource/content/1/a.pdf?token=attacker')
    expect(safe).toContain('/webservice/pluginfile.php/10/mod_resource/content/1/a.pdf')
    expect(safe).not.toContain('token=')
    expect(safeMoodleFileUrl('https://example.com/pluginfile.php/10/a.pdf')).toBeNull()
    expect(safeMoodleFileUrl('https://ava.cmmg.edu.br/admin/index.php')).toBeNull()
  })

  it('filters inaccessible sections and exposes internal download routes', () => {
    const sections = mapMoodleSections([
      {
        id: 1,
        name: 'Semana 1',
        visible: 1,
        modules: [{
          id: 20,
          name: 'Cronograma',
          modname: 'resource',
          visible: 1,
          uservisible: true,
          contents: [{
            type: 'file',
            filename: 'cronograma.pdf',
            fileurl: 'https://ava.cmmg.edu.br/webservice/pluginfile.php/20/mod_resource/content/1/cronograma.pdf',
            mimetype: 'application/pdf',
          }],
        }],
      },
      {
        id: 2,
        name: 'Restrita',
        visible: 1,
        modules: [{ id: 21, name: 'Outro grupo', modname: 'resource', uservisible: false }],
      },
    ])

    expect(sections).toHaveLength(1)
    expect(sections[0].materials[0]).toMatchObject({
      fileName: 'cronograma.pdf',
      mimeType: 'application/pdf',
    })
    expect(sections[0].materials[0].downloadUrl).toContain('/api/moodle/files?url=')
  })

  it('summarizes sections and materials for each requested course', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body))
      expect(body.get('wsfunction')).toBe('core_course_get_contents')
      const courseId = Number(body.get('courseid'))
      return new Response(JSON.stringify([{
        id: courseId * 10,
        name: 'Conteúdo principal',
        visible: 1,
        modules: [{
          id: courseId * 100,
          name: 'Material da disciplina',
          modname: 'resource',
          visible: 1,
          uservisible: true,
          contents: [{
            type: 'file',
            filename: `material-${courseId}.pdf`,
            fileurl: `https://ava.cmmg.edu.br/webservice/pluginfile.php/${courseId}/material.pdf`,
            mimetype: 'application/pdf',
          }],
        }],
      }]))
    })
    vi.stubGlobal('fetch', fetchMock)

    const summary = await getMoodleContentSummary('reused-token', [10, 11, 10])

    expect(summary.courses).toEqual([
      { courseId: 10, sectionCount: 1, materialCount: 1 },
      { courseId: 11, sectionCount: 1, materialCount: 1 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('paginates action events using Moodle maximum batches of 50', async () => {
    const nowSeconds = Math.floor(Date.now() / 1_000)
    let calendarPage = 0
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body))
      expect(body.get('wstoken')).toBe('reused-token')

      if (body.get('wsfunction') === 'core_enrol_get_users_courses') {
        return new Response(JSON.stringify([{
          id: 10,
          fullname: 'Disciplina atual \u2013 7M80D',
          shortname: 'Atual - 7M80D',
          visible: 1,
          startdate: nowSeconds - 3_600,
          enddate: nowSeconds + 86_400,
        }]))
      }

      expect(body.get('wsfunction')).toBe('core_calendar_get_action_events_by_timesort')
      expect(body.get('limitnum')).toBe('50')
      calendarPage += 1
      const firstId = calendarPage === 1 ? 1 : 51
      const count = calendarPage === 1 ? 50 : 1
      const events = Array.from({ length: count }, (_, index) => ({
        id: firstId + index,
        name: `Atividade ${firstId + index}`,
        courseid: 10,
        modulename: 'assign',
        timesort: nowSeconds + 3_600 + index,
        visible: 1,
        action: { actionable: true },
      }))
      return new Response(JSON.stringify({
        events,
        lastid: events.at(-1)?.id,
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const overview = await getMoodleOverview('reused-token', 6_116)

    expect(calendarPage).toBe(2)
    expect(overview.tasks).toHaveLength(51)
    expect(overview.courses[0]).toMatchObject({
      fullName: 'Disciplina atual',
      shortName: 'Atual',
    })
    expect(overview.tasks[0].courseName).toBe('Disciplina atual')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
