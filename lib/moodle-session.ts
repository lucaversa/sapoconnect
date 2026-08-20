import 'server-only'

import { cookies } from 'next/headers'

import {
  decryptSessionData,
  deserializeSessionData,
  encryptSessionData,
  serializeSessionData,
} from '@/lib/session-encryption'

const MOODLE_COOKIE_NAME = 'sapoconnect_moodle'
const MOODLE_MAX_AGE = 60 * 60 * 24 * 90
const MOODLE_PENDING_MAX_AGE = 10 * 60
const MAX_COOKIE_VALUE_BYTES = 3_800

export interface MoodleSessionData {
  version: 1
  token: string
  userId: number
  username: string
  fullName?: string
  totvsRa: string
  connectedAt: number
  expiresAt: number
}

export interface PendingMoodleSessionData {
  version: 1
  pending: true
  token: string
  totvsRa: string
  connectedAt: number
  expiresAt: number
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    priority: 'high' as const,
    maxAge,
    path: '/api/moodle',
  }
}

function isValid(value: unknown, expectedRa: string): value is MoodleSessionData {
  const session = value as Partial<MoodleSessionData>
  return session?.version === 1
    && typeof session.token === 'string'
    && session.token.length >= 16
    && typeof session.userId === 'number'
    && Number.isInteger(session.userId)
    && session.userId > 0
    && typeof session.username === 'string'
    && typeof session.totvsRa === 'string'
    && session.totvsRa === expectedRa
    && typeof session.connectedAt === 'number'
    && typeof session.expiresAt === 'number'
    && session.expiresAt > Date.now()
}

function isPending(value: unknown, expectedRa: string): value is PendingMoodleSessionData {
  const session = value as Partial<PendingMoodleSessionData>
  return session?.version === 1
    && session.pending === true
    && typeof session.token === 'string'
    && session.token.length >= 16
    && session.totvsRa === expectedRa
    && typeof session.connectedAt === 'number'
    && typeof session.expiresAt === 'number'
    && session.expiresAt > Date.now()
}

async function readMoodleCookie(): Promise<unknown> {
  const value = (await cookies()).get(MOODLE_COOKIE_NAME)?.value
  if (!value) return null
  try {
    return deserializeSessionData<unknown>(decryptSessionData(value, 'moodle'))
  } catch {
    return null
  }
}

export async function getMoodleSession(expectedRa: string): Promise<MoodleSessionData | null> {
  const session = await readMoodleCookie()
  return isValid(session, expectedRa) ? session : null
}

export async function getPendingMoodleSession(expectedRa: string): Promise<PendingMoodleSessionData | null> {
  const session = await readMoodleCookie()
  return isPending(session, expectedRa) ? session : null
}

async function writeMoodleCookie(
  session: MoodleSessionData | PendingMoodleSessionData,
  maxAge: number,
): Promise<void> {
  const encrypted = encryptSessionData(serializeSessionData(session), 'moodle')
  if (Buffer.byteLength(encrypted, 'utf8') > MAX_COOKIE_VALUE_BYTES) {
    throw new Error('Moodle session cookie exceeds safe size')
  }
  const store = await cookies()
  store.set(MOODLE_COOKIE_NAME, encrypted, cookieOptions(maxAge))
}

export async function createPendingMoodleSession(
  token: string,
  totvsRa: string,
): Promise<PendingMoodleSessionData> {
  const now = Date.now()
  const session: PendingMoodleSessionData = {
    version: 1,
    pending: true,
    token,
    totvsRa,
    connectedAt: now,
    expiresAt: now + MOODLE_PENDING_MAX_AGE * 1_000,
  }
  await writeMoodleCookie(session, MOODLE_PENDING_MAX_AGE)
  return session
}

export async function createMoodleSession(
  data: Omit<MoodleSessionData, 'version' | 'connectedAt' | 'expiresAt'>,
): Promise<MoodleSessionData> {
  const now = Date.now()
  const session: MoodleSessionData = {
    version: 1,
    ...data,
    connectedAt: now,
    expiresAt: now + MOODLE_MAX_AGE * 1_000,
  }
  await writeMoodleCookie(session, MOODLE_MAX_AGE)
  return session
}

export async function destroyMoodleSession(): Promise<void> {
  const store = await cookies()
  store.set(MOODLE_COOKIE_NAME, '', cookieOptions(0))
}
