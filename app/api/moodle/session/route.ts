import {
  getMoodlePublicUrl,
  getMoodleSiteInfo,
  requestMoodleToken,
} from '@/lib/moodle-client'
import {
  createPendingMoodleSession,
  createMoodleSession,
  destroyMoodleSession,
  getMoodleSession,
  getPendingMoodleSession,
} from '@/lib/moodle-session'
import { normalizePersonName } from '@/lib/person-name'
import { getSession } from '@/lib/session'
import { privateJson } from '@/lib/server/http'
import { AvaRouteError, moodleRouteError } from '@/lib/server/moodle-route'
import { guardAuthRequest, guardSameOriginRequest } from '@/lib/server/request-guard'

function publicConnection(session: Awaited<ReturnType<typeof getMoodleSession>>) {
  return session
    ? {
        connected: true,
        username: session.username,
        fullName: normalizePersonName(session.fullName) || undefined,
        connectedAt: session.connectedAt,
        moodleUrl: getMoodlePublicUrl(),
      }
    : { connected: false, moodleUrl: getMoodlePublicUrl() }
}

export async function GET() {
  try {
    const appSession = await getSession()
    if (!appSession) {
      return privateJson({
        error: 'Sess\u00e3o acad\u00eamica expirada.',
        code: 'SESSION_MISSING',
      }, { status: 401 })
    }
    return privateJson(publicConnection(await getMoodleSession(appSession.ra)))
  } catch (error) {
    return moodleRouteError(error, 'moodle/session')
  }
}

export async function POST(request: Request) {
  try {
    guardSameOriginRequest(request)

    const appSession = await getSession()
    if (!appSession) {
      throw new AvaRouteError('Sess\u00e3o acad\u00eamica expirada.', 401, 'SESSION_MISSING')
    }

    // Repeated submits with an existing cookie must never request a new token.
    const existing = await getMoodleSession(appSession.ra)
    if (existing) return privateJson(publicConnection(existing))

    const pending = await getPendingMoodleSession(appSession.ra)
    let token = pending?.token

    if (!token) {
      guardAuthRequest(request, 'login', `moodle:${appSession.ra}`)
      const body = await request.json().catch(() => null) as { password?: unknown } | null
      if (typeof body?.password !== 'string' || body.password.length < 1 || body.password.length > 512) {
        throw new AvaRouteError('Informe uma senha v\u00e1lida do AVA.', 400, 'AVA_INVALID_INPUT')
      }

      token = await requestMoodleToken(appSession.ra, body.password)
      await createPendingMoodleSession(token, appSession.ra)
    }

    const siteInfo = await getMoodleSiteInfo(token)
    const userId = Number(siteInfo.userid)

    if (!Number.isSafeInteger(userId) || userId <= 0 || !siteInfo.username?.trim()) {
      await destroyMoodleSession()
      throw new AvaRouteError(
        'O AVA retornou dados de conta inv\u00e1lidos.',
        502,
        'AVA_INVALID_ACCOUNT',
      )
    }

    if (siteInfo.username.trim().toLocaleLowerCase('pt-BR') !== appSession.ra.trim().toLocaleLowerCase('pt-BR')) {
      await destroyMoodleSession()
      throw new AvaRouteError(
        'A conta do AVA n\u00e3o corresponde ao seu RA.',
        422,
        'AVA_ACCOUNT_MISMATCH',
      )
    }

    const moodleSession = await createMoodleSession({
      token,
      userId,
      username: siteInfo.username,
      fullName: normalizePersonName(siteInfo.fullname) || undefined,
      totvsRa: appSession.ra,
    })
    return privateJson(publicConnection(moodleSession))
  } catch (error) {
    return moodleRouteError(error, 'moodle/connect')
  }
}

export async function DELETE(request: Request) {
  try {
    guardSameOriginRequest(request)
    await destroyMoodleSession()
    return privateJson({ connected: false, moodleUrl: getMoodlePublicUrl() })
  } catch (error) {
    return moodleRouteError(error, 'moodle/disconnect')
  }
}
