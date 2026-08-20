import { getMoodleOverview } from '@/lib/moodle-client'
import { privateJson } from '@/lib/server/http'
import { moodleRouteError, requireMoodleConnection } from '@/lib/server/moodle-route'

export async function GET() {
  try {
    const { moodleSession } = await requireMoodleConnection()
    return privateJson(await getMoodleOverview(moodleSession.token, moodleSession.userId))
  } catch (error) {
    return moodleRouteError(error, 'moodle/overview')
  }
}
