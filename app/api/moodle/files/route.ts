import { fetchMoodleFile } from '@/lib/moodle-client'
import { renewMoodleSession } from '@/lib/moodle-session'
import { PRIVATE_NO_STORE } from '@/lib/server/http'
import { AvaRouteError, moodleRouteError, requireMoodleConnection } from '@/lib/server/moodle-route'

const FORWARDED_FILE_HEADERS = [
  'content-disposition',
  'content-length',
  'content-type',
  'etag',
  'last-modified',
] as const

export async function GET(request: Request) {
  try {
    const sourceUrl = new URL(request.url).searchParams.get('url')
    if (!sourceUrl || sourceUrl.length > 4_000) {
      throw new AvaRouteError('Arquivo inválido.', 400, 'AVA_INVALID_FILE')
    }
    const { moodleSession } = await requireMoodleConnection()
    const upstream = await fetchMoodleFile(moodleSession.token, sourceUrl)
    const headers = new Headers(PRIVATE_NO_STORE)
    for (const name of FORWARDED_FILE_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('X-Content-Type-Options', 'nosniff')
    await renewMoodleSession(moodleSession)
    return new Response(upstream.body, { status: 200, headers })
  } catch (error) {
    return moodleRouteError(error, 'moodle/file')
  }
}
