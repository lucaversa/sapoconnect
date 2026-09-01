import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { proxy } from '@/proxy';
import { encryptSessionData, serializeSessionData } from '@/lib/session-encryption';
import type { SessionData } from '@/lib/session';

const originalEnv = { ...process.env };

function sessionCookie(ra: string, expiresAt = Date.now() + 60_000): string {
  const session: SessionData = {
    version: 1,
    sessionId: 'proxy-integration-session',
    cacheScope: 'proxy-integration-scope',
    externalCookies: { aspNetSessionId: 'asp', aspxAuth: 'auth' },
    lastExternalLoginAt: Date.now(),
    expiresAt,
    ra,
  };

  return encryptSessionData(serializeSessionData(session), 'session');
}

function protectedRequest(cookie: string) {
  return new NextRequest('https://sapoconnect.test/api/historico', {
    headers: { cookie: `sapoconnect_session=${cookie}` },
  });
}

describe('own3d encrypted-cookie API integration', () => {
  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEYS = `proxy-test:${'81'.repeat(32)}`;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it.each(['SYNTH-RA-0005', 'SYNTH-RA-0006'])(
    'decodes and blocks an active target session for %s',
    (ra) => {
      const response = proxy(protectedRequest(sessionCookie(ra)));
      expect(response.status).toBe(403);
    }
  );

  it('allows a nearby identity and an expired target cookie through to route authorization', () => {
    const nearby = proxy(protectedRequest(sessionCookie('SYNTH-RA-0007')));
    const expired = proxy(protectedRequest(sessionCookie('SYNTH-RA-0006', Date.now() - 1)));

    expect(nearby.headers.get('x-middleware-next')).toBe('1');
    expect(expired.headers.get('x-middleware-next')).toBe('1');
  });
});
