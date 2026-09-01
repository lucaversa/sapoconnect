import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { ExternalCookies } from './external-auth';
import { decryptSessionData, deserializeSessionData, encryptSessionData, serializeSessionData } from './session-encryption';
import { createCacheScope, invalidateCacheScope } from './server/cache';

export const SESSION_COOKIE_NAME = 'sapoconnect_session';
const RECONNECT_COOKIE_NAME = 'sapoconnect_reconnect';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const RECONNECT_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_COOKIE_VALUE_BYTES = 3800;

export interface SessionData {
  version: 1;
  sessionId: string;
  cacheScope: string;
  externalCookies: ExternalCookies;
  lastExternalLoginAt: number;
  expiresAt: number;
  ra: string;
}
interface ReconnectData { version: 1; sessionId: string; ra: string; codUsuario: string; senha: string; expiresAt: number; }

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  priority: 'high' as const,
};
const sessionCookieOptions = { ...baseCookieOptions, maxAge: SESSION_MAX_AGE, path: '/' };
const reconnectCookieOptions = { ...baseCookieOptions, maxAge: RECONNECT_MAX_AGE, path: '/api/auth' };

function encode(data: object, purpose: 'session' | 'reconnect'): string {
  const value = encryptSessionData(serializeSessionData(data), purpose);
  if (Buffer.byteLength(value, 'utf8') > MAX_COOKIE_VALUE_BYTES) throw new Error('Session cookie exceeds safe size');
  return value;
}
function decode<T>(value: string, purpose: 'session' | 'reconnect'): T {
  return deserializeSessionData<T>(decryptSessionData(value, purpose));
}

async function writeSessionBundle(
  session: SessionData,
  credentials?: { codUsuario: string; senha: string }
): Promise<void> {
  // Encryption, validation and size checks happen before the response cookie
  // store is touched, so a preparation failure cannot emit a partial bundle.
  const sessionValue = encode(session, 'session');
  const reconnectValue = credentials
    ? encode(
        {
          version: 1,
          ...credentials,
          sessionId: session.sessionId,
          ra: session.ra,
          expiresAt: Date.now() + RECONNECT_MAX_AGE * 1000,
        } satisfies ReconnectData,
        'reconnect'
      )
    : null;
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionValue, sessionCookieOptions);
  if (reconnectValue) {
    store.set(RECONNECT_COOKIE_NAME, reconnectValue, reconnectCookieOptions);
  }
}

function validSession(value: unknown): value is SessionData {
  const s = value as Partial<SessionData>;
  return s?.version === 1 && typeof s.sessionId === 'string' && typeof s.ra === 'string' && typeof s.cacheScope === 'string' && typeof s.expiresAt === 'number' && s.expiresAt > Date.now() && !!s.externalCookies?.aspNetSessionId && !!s.externalCookies?.aspxAuth;
}

export function readSessionCookie(value: string | undefined): SessionData | null {
  if (!value) return null;
  try {
    const session = decode<SessionData>(value, 'session');
    return validSession(session) ? session : null;
  } catch (error) {
    if (error instanceof Error && error.message.includes('SESSION_ENCRYPTION')) throw error;
    return null;
  }
}

export async function createSession(
  externalCookies: ExternalCookies,
  ra?: string,
  credentials?: { codUsuario: string; senha: string },
  preservedSessionId?: string
): Promise<SessionData> {
  if (!ra) throw new Error('RA is required to create a session');
  const sessionId = preservedSessionId && /^[a-zA-Z0-9_-]{8,128}$/.test(preservedSessionId)
    ? preservedSessionId
    : randomUUID();
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const session: SessionData = { version: 1, sessionId, cacheScope: createCacheScope(sessionId, ra), externalCookies, lastExternalLoginAt: Date.now(), expiresAt, ra };
  await writeSessionBundle(session, credentials);
  return session;
}

export async function getSession(): Promise<SessionData | null> {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return readSessionCookie(value);
}

export async function updateSessionCookies(
  externalCookies: ExternalCookies,
  existingSession?: SessionData,
  credentials?: { codUsuario: string; senha: string }
): Promise<SessionData> {
  const session = existingSession ?? await getSession();
  if (!session) throw new Error('Session not found');
  invalidateCacheScope(session.cacheScope);
  const updated: SessionData = {
    ...session,
    externalCookies,
    lastExternalLoginAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };
  await writeSessionBundle(updated, credentials);
  return updated;
}
export async function getReconnectCredentials(): Promise<ReconnectData | null> {
  const value = (await cookies()).get(RECONNECT_COOKIE_NAME)?.value;
  if (!value) return null;
  try {
    const reconnect = decode<ReconnectData>(value, 'reconnect');
    return reconnect?.version === 1 && reconnect.expiresAt > Date.now() && typeof reconnect.sessionId === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(reconnect.sessionId) && typeof reconnect.ra === 'string' && reconnect.ra === reconnect.codUsuario && typeof reconnect.codUsuario === 'string' && typeof reconnect.senha === 'string' ? reconnect : null;
  } catch { return null; }
}
export async function destroySession(): Promise<void> {
  const store = await cookies();
  let cacheScope: string | undefined;
  try {
    cacheScope = (await getSession())?.cacheScope;
  } catch {
    // Cookie deletion must still happen when an old/invalid key cannot decrypt it.
  }
  invalidateCacheScope(cacheScope);
  store.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions, maxAge: 0 });
  store.set(RECONNECT_COOKIE_NAME, '', { ...reconnectCookieOptions, maxAge: 0 });
}
export async function hasActiveSession(): Promise<boolean> { return (await getSession()) !== null; }
export async function hasSession(): Promise<boolean> { return hasActiveSession(); }
export async function getExternalCookies(): Promise<ExternalCookies | null> { return (await getSession())?.externalCookies ?? null; }
export async function setRA(ra: string): Promise<void> { throw new Error(`RA is immutable for a session (${ra})`); }
export async function getRA(): Promise<string | null> { return (await getSession())?.ra ?? null; }
