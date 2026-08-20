import { getMoodleContentSummary } from '@/lib/moodle-client'
import { renewMoodleSession } from '@/lib/moodle-session'
import { privateJson } from '@/lib/server/http'
import { AvaRouteError, moodleRouteError, requireMoodleConnection } from '@/lib/server/moodle-route'

const MAX_COURSES_PER_REQUEST = 30

function readCourseIds(request: Request): number[] {
  const rawCourseIds = new URL(request.url).searchParams.get('courseIds')?.split(',') ?? []
  const courseIds = Array.from(new Set(rawCourseIds.map((value) => Number(value))))

  if (
    courseIds.length === 0
    || courseIds.length > MAX_COURSES_PER_REQUEST
    || courseIds.some((courseId) => !Number.isSafeInteger(courseId) || courseId <= 1)
  ) {
    throw new AvaRouteError('Lista de disciplinas inválida.', 400, 'AVA_INVALID_COURSES')
  }

  return courseIds
}

export async function GET(request: Request) {
  try {
    const courseIds = readCourseIds(request)
    const { moodleSession } = await requireMoodleConnection()
    const summary = await getMoodleContentSummary(moodleSession.token, courseIds)
    await renewMoodleSession(moodleSession)
    return privateJson(summary)
  } catch (error) {
    return moodleRouteError(error, 'moodle/content-summary')
  }
}
