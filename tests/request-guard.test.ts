import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getRequestGuardBucketKeysForTests,
  guardAuthRequest,
  RequestGuardError,
  resetRequestGuardsForTests,
} from '@/lib/server/request-guard';

beforeEach(() => {
  resetRequestGuardsForTests();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_ENCRYPTION_KEY', 'a'.repeat(64));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(headers: Record<string, string> = {}) {
  return new Request('https://app.example.com/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://app.example.com', 'x-forwarded-for': '203.0.113.8', ...headers },
  });
}

describe('auth request guard', () => {
  it('accepts the same origin and rejects cross-site origins', () => {
    expect(() => guardAuthRequest(request(), 'login')).not.toThrow();
    expect(() => guardAuthRequest(request({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), 'login'))
      .toThrowError(RequestGuardError);
  });

  it('rejects missing browser provenance in production', () => {
    const withoutOrigin = new Request('https://app.example.com/api/auth/login', { method: 'POST' });
    expect(() => guardAuthRequest(withoutOrigin, 'login')).toThrow(/Origem/);
  });

  it('limits repeated login amplification and returns a retry window', () => {
    for (let index = 0; index < 6; index += 1) guardAuthRequest(request(), 'login', '12345');
    try {
      guardAuthRequest(request(), 'login', '12345');
      throw new Error('expected rate limit');
    } catch (error) {
      expect(error).toBeInstanceOf(RequestGuardError);
      expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
      expect((error as RequestGuardError).retryAfter).toBeGreaterThan(0);
    }
  });

  it('isolates refresh limits by session behind a shared NAT', () => {
    for (let student = 0; student < 20; student += 1) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        expect(() => guardAuthRequest(request(), 'refresh', `session-${student}`)).not.toThrow();
      }
    }

    expect(() => guardAuthRequest(request(), 'refresh', 'session-0')).toThrowError(
      RequestGuardError
    );
  });

  it('never keeps raw IP or student identifiers in bucket keys', () => {
    guardAuthRequest(request(), 'login', '12345');
    guardAuthRequest(request(), 'refresh', 'session-12345');
    const serializedKeys = getRequestGuardBucketKeysForTests().join('\n');

    expect(serializedKeys).not.toContain('203.0.113.8');
    expect(serializedKeys).not.toContain('12345');
  });
});
