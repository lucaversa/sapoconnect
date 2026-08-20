import { getMoodleOverview } from '@/lib/moodle-client'
import { renewMoodleSession } from '@/lib/moodle-session'
import { privateJson } from '@/lib/server/http'
import { moodleRouteError, requireMoodleConnection } from '@/lib/server/moodle-route'

export async function GET() {
  try {
    const { moodleSession } = await requireMoodleConnection()
    const overview = await getMoodleOverview(moodleSession.token, moodleSession.userId)
    await renewMoodleSession(moodleSession)
    return privateJson(overview)
  } catch (error) {
    return moodleRouteError(error, 'moodle/overview')
  }
}
