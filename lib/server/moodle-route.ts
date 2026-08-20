import 'server-only'

import { MoodleClientError } from '@/lib/moodle-client'
import { destroyMoodleSession, getMoodleSession, type MoodleSessionData } from '@/lib/moodle-session'
import { getSession, type SessionData } from '@/lib/session'
import { privateJson } from '@/lib/server/http'
import {
  ServerConfigurationError,
  SERVER_CONFIGURATION_ERROR_CODE,
  SERVER_CONFIGURATION_PUBLIC_MESSAGE,
} from '@/lib/server/configuration-error'
import { RequestGuardError } from '@/lib/server/request-guard'

export class AvaRouteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'AvaRouteError'
  }
}

export async function requireMoodleConnection(): Promise<{
  appSession: SessionData
  moodleSession: MoodleSessionData
}> {
  const appSession = await getSession()
  if (!appSession) throw new AvaRouteError('Sessão acadêmica expirada.', 401, 'SESSION_MISSING')
  const moodleSession = await getMoodleSession(appSession.ra)
  if (!moodleSession) {
    throw new AvaRouteError('Conecte seu AVA para continuar.', 428, 'AVA_NOT_CONNECTED')
  }
  return { appSession, moodleSession }
}

export async function moodleRouteError(error: unknown, context: string): Promise<Response> {
  if (error instanceof RequestGuardError) {
    return privateJson(
      { error: error.message, code: error.code },
      {
        status: error.status,
        headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
      },
    )
  }
  if (error instanceof AvaRouteError) {
    return privateJson({ error: error.message, code: error.code }, { status: error.status })
  }
  if (error instanceof MoodleClientError) {
    if (error.kind === 'invalid-token') {
      await destroyMoodleSession()
      return privateJson(
        { error: 'Sua conexão com o AVA expirou. Conecte novamente.', code: 'AVA_CONNECTION_EXPIRED' },
        { status: 428 },
      )
    }
    if (error.kind === 'invalid-credentials') {
      return privateJson({ error: error.message, code: 'AVA_INVALID_CREDENTIALS' }, { status: 422 })
    }
    console.error(`[${context}] Moodle request failed:`, error.code || error.kind)
    return privateJson({ error: error.message, code: 'AVA_UNAVAILABLE' }, { status: 502 })
  }
  if (error instanceof ServerConfigurationError) {
    console.error(`[${context}] Server configuration is incomplete:`, error.message)
    return privateJson(
      { error: SERVER_CONFIGURATION_PUBLIC_MESSAGE, code: SERVER_CONFIGURATION_ERROR_CODE },
      { status: 503 },
    )
  }
  console.error(`[${context}] Unexpected error`)
  return privateJson({ error: 'Não foi possível acessar o AVA.', code: 'AVA_INTERNAL_ERROR' }, { status: 500 })
}
