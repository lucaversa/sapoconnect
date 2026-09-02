import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { proxy } from '@/proxy';
import { createLiteUsageRecord, resumeLiteUsageRecord } from '@/lib/lite-policy';
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

function liteCookie(
  ra: '124101.00574' | '23201.00120' | '23201.00134',
  startedAt: number,
  mode: 'running' | 'paused' | 'locked' = 'running'
): string {
  const created = createLiteUsageRecord(startedAt, mode === 'locked');
  const record = mode === 'running'
    ? resumeLiteUsageRecord(created, startedAt)
    : created;
  return encryptSessionData(
    serializeSessionData({
      version: 1,
      records: { [ra]: record },
    }),
    'lite'
  );
}

function protectedRequest(session: string, lite?: string) {
  const cookie = [
    `sapoconnect_session=${session}`,
    lite ? `sapoconnect_lite_usage=${lite}` : null,
  ].filter(Boolean).join('; ');
  return new NextRequest('https://sapoconnect.test/api/historico', {
    headers: { cookie },
  });
}

describe('SapoConnect Lite encrypted-cookie API integration', () => {
  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEYS = `proxy-test:${'81'.repeat(32)}`;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it.each(['124101.00574', '23201.00120', '23201.00134'] as const)(
    'allows an exact target session only during its active window for %s',
    (ra) => {
      const now = Date.now();
      const response = proxy(protectedRequest(sessionCookie(ra), liteCookie(ra, now)));
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  );

  it.each(['124101.00574', '23201.00120', '23201.00134'])(
    'requires the intro before %s receives protected API data',
    async (ra) => {
      const response = proxy(protectedRequest(sessionCookie(ra)));
      expect(response.status).toBe(428);
      await expect(response.json()).resolves.toMatchObject({ code: 'LITE_START_REQUIRED' });
    }
  );

  it('requires resume after a lease expires', async () => {
    const ra = '23201.00120';
    const paused = proxy(
      protectedRequest(sessionCookie(ra), liteCookie(ra, Date.now() - 10_000))
    );

    expect(paused.status).toBe(428);
    await expect(paused.json()).resolves.toMatchObject({ code: 'LITE_RESUME_REQUIRED' });
  });

  it.each(['124101.00574', '23201.00120', '23201.00134'] as const)(
    'locks exhausted and tampered Lite ledgers for %s',
    async (ra) => {
      const exhausted = proxy(
        protectedRequest(sessionCookie(ra), liteCookie(ra, Date.now(), 'locked'))
      );
      const tampered = proxy(protectedRequest(sessionCookie(ra), 'invalid-cookie'));

      expect(exhausted.status).toBe(403);
      expect(tampered.status).toBe(403);
      await expect(exhausted.json()).resolves.toMatchObject({ code: 'LITE_TIME_EXPIRED' });
      await expect(tampered.json()).resolves.toMatchObject({ code: 'LITE_TIME_EXPIRED' });
    }
  );

  it('allows a nearby identity and an expired target session through to route authorization', () => {
    const nearby = proxy(protectedRequest(sessionCookie('23201.00121'), 'invalid-cookie'));
    const expiredSession = proxy(
      protectedRequest(sessionCookie('23201.00120', Date.now() - 1), 'invalid-cookie')
    );

    expect(nearby.headers.get('x-middleware-next')).toBe('1');
    expect(expiredSession.headers.get('x-middleware-next')).toBe('1');
  });
});
