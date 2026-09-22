import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createLiteUsageRecord, evaluateLiteAccess, LITE_TARGET_RAS } from '@/lib/lite-policy';
import { getLiteAccessSnapshotFromCookie } from '@/lib/server/lite-usage';
import { encryptSessionData, serializeSessionData } from '@/lib/session-encryption';
import type { SessionData } from '@/lib/session';
import { proxy } from '@/proxy';

describe('Lite restrictions disabled', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_ENCRYPTION_KEYS', `disabled-test:${'81'.repeat(32)}`);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('has no configured restricted accounts', () => {
    expect(LITE_TARGET_RAS).toEqual([]);
  });

  it.each(['124101.00574', '23201.00120', '23201.00134'])(
    'grants full access to %s even with an exhausted or invalid ledger',
    (ra) => {
      const now = Date.now();
      const record = createLiteUsageRecord(now, true);
      const session: SessionData = {
        version: 1,
        sessionId: 'disabled-test-session',
        cacheScope: 'disabled-test-scope',
        externalCookies: { aspNetSessionId: 'asp', aspxAuth: 'auth' },
        lastExternalLoginAt: now,
        expiresAt: now + 60_000,
        ra,
      };
      const sessionCookie = encryptSessionData(serializeSessionData(session), 'session');
      const lockedCookie = encryptSessionData(
        serializeSessionData({ version: 1, records: { [ra]: record } }),
        'lite'
      );

      expect(evaluateLiteAccess(ra, record, 'valid', now)).toMatchObject({
        tier: 'full', state: 'full', running: false,
      });

      for (const usageCookie of [undefined, lockedCookie, 'invalid-cookie']) {
        expect(getLiteAccessSnapshotFromCookie(ra, usageCookie, now)).toMatchObject({
          tier: 'full', state: 'full', running: false,
        });
        const cookie = `sapoconnect_session=${sessionCookie}` +
          (usageCookie ? `; sapoconnect_lite_usage=${usageCookie}` : '');
        const response = proxy(new NextRequest('https://sapoconnect.test/api/historico', {
          headers: { cookie },
        }));
        expect(response.headers.get('x-middleware-next')).toBe('1');
      }
    }
  );
});
