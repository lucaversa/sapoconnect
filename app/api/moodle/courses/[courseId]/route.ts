import { getMoodleCourseDetail } from '@/lib/moodle-client'
import { renewMoodleSession } from '@/lib/moodle-session'
import { privateJson } from '@/lib/server/http'
import { AvaRouteError, moodleRouteError, requireMoodleConnection } from '@/lib/server/moodle-route'

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId: rawCourseId } = await context.params
    const courseId = Number(rawCourseId)
    if (!Number.isSafeInteger(courseId) || courseId <= 1) {
      throw new AvaRouteError('Disciplina inválida.', 400, 'AVA_INVALID_COURSE')
    }
    const { moodleSession } = await requireMoodleConnection()
    const detail = await getMoodleCourseDetail(moodleSession.token, moodleSession.userId, courseId)
    if (!detail) {
      throw new AvaRouteError('Esta disciplina não pertence ao semestre atual.', 404, 'AVA_COURSE_NOT_CURRENT')
    }
    await renewMoodleSession(moodleSession)
    return privateJson(detail)
  } catch (error) {
    return moodleRouteError(error, 'moodle/course')
  }
}
