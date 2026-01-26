import { cookies } from 'next/headers';
import { ExternalCookies } from './external-auth';
import {
  encryptSessionData,
  decryptSessionData,
  serializeSessionData,
  deserializeSessionData,
} from './session-encryption';

const SESSION_COOKIE_NAME = 'sapoconnect_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

interface SessionData {
  externalCookies: ExternalCookies;
  lastExternalLoginAt: number;
  ra?: string;
}

export async function createSession(
  externalCookies: ExternalCookies
): Promise<void> {
  const sessionData: SessionData = {
    externalCookies,
    lastExternalLoginAt: Date.now(),
  };

  const serialized = serializeSessionData(sessionData);
  const encrypted = encryptSessionData(serialized);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  try {
    const decrypted = decryptSessionData(sessionCookie.value);
    const sessionData = deserializeSessionData(decrypted);
    return sessionData;
  } catch {
    return null;
  }
}

export async function updateSessionCookies(
  externalCookies: ExternalCookies
): Promise<void> {
  const session = await getSession();

  if (!session) {
    throw new Error('Sessão não encontrada');
  }

  const updatedSession: SessionData = {
    ...session,
    externalCookies,
    lastExternalLoginAt: Date.now(),
  };

  const serialized = serializeSessionData(updatedSession);
  const encrypted = encryptSessionData(serialized);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function hasActiveSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

export async function hasSession(): Promise<boolean> {
  return hasActiveSession();
}

export async function getExternalCookies(): Promise<ExternalCookies | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return session.externalCookies;
}

export async function setRA(ra: string): Promise<void> {
  const session = await getSession();
  if (!session) {
    throw new Error('Sessão não encontrada');
  }

  const updatedSession: SessionData = {
    ...session,
    ra,
  };

  const serialized = serializeSessionData(updatedSession);
  const encrypted = encryptSessionData(serialized);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function getRA(): Promise<string | null> {
  const session = await getSession();
  return session?.ra || null;
}
