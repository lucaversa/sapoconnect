import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/lite-targets', () => ({
  LITE_TARGET_RAS: ['SYNTH-A.00001', 'SYNTH-B.00001', 'SYNTH-B.00002'],
}));

const sessionMocks = vi.hoisted(() => ({
  readSessionCookie: vi.fn(),
}));
const usageMocks = vi.hoisted(() => ({
  getLiteAccessSnapshotFromCookie: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  SESSION_COOKIE_NAME: 'sapoconnect_session',
  readSessionCookie: sessionMocks.readSessionCookie,
}));
vi.mock('@/lib/server/lite-usage', () => ({
  LITE_USAGE_COOKIE_NAME: 'sapoconnect_lite_usage',
  getLiteAccessSnapshotFromCookie: usageMocks.getLiteAccessSnapshotFromCookie,
}));

import { config, proxy } from '@/proxy';

const resetAt = Date.parse('2026-09-02T03:00:00.000Z');

function apiRequest(pathname: string) {
  return new NextRequest(`https://sapoconnect.test${pathname}`, {
    headers: {
      cookie: 'sapoconnect_session=test-session; sapoconnect_lite_usage=test-usage',
    },
  });
}

function liteSnapshot(state: 'intro' | 'active' | 'locked', running = false) {
  const remainingMs = state === 'active' ? 1_000 : state === 'intro' ? 180_000 : 0;
  return {
    tier: 'lite',
    state,
    serverNow: resetAt - 1_000,
    startedAt: state === 'intro' ? null : resetAt - 180_000,
    expiresAt: state === 'active' && running ? resetAt : null,
    consumedMs: state === 'locked' ? 180_000 : state === 'active' ? 179_000 : 0,
    remainingMs,
    running,
    leaseUntil: running ? resetAt : null,
    resetAt,
  };
}

describe('SapoConnect Lite API boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs for every API route and nowhere else', () => {
    expect(config).toEqual({ matcher: '/api/:path*' });
  });

  it.each([
    ['intro', 428, 'LITE_START_REQUIRED'],
    ['locked', 403, 'LITE_TIME_EXPIRED'],
  ] as const)('blocks protected API data in %s state', async (state, status, code) => {
    sessionMocks.readSessionCookie.mockReturnValue({ ra: 'SYNTH-A.00001' });
    usageMocks.getLiteAccessSnapshotFromCookie.mockReturnValue(liteSnapshot(state));

    const response = proxy(apiRequest('/api/faltas/completo'));

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({ code, resetAt });
  });

  it('blocks a started balance after its foreground lease pauses', async () => {
    sessionMocks.readSessionCookie.mockReturnValue({ ra: 'SYNTH-A.00001' });
    usageMocks.getLiteAccessSnapshotFromCookie.mockReturnValue(
      liteSnapshot('active', false)
    );

    const response = proxy(apiRequest('/api/faltas/completo'));

    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toMatchObject({ code: 'LITE_RESUME_REQUIRED' });
  });

  it('allows protected API data only while the server snapshot is active', () => {
    sessionMocks.readSessionCookie.mockReturnValue({ ra: 'SYNTH-B.00001' });
    usageMocks.getLiteAccessSnapshotFromCookie.mockReturnValue(liteSnapshot('active', true));

    const response = proxy(apiRequest('/api/historico'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not restrict nearby or unauthenticated identities', () => {
    for (const ra of ['SYNTH-A.00000', 'SYNTH-B.00003', undefined]) {
      sessionMocks.readSessionCookie.mockReturnValue(ra ? { ra } : null);
      const response = proxy(apiRequest('/api/historico'));
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
    expect(usageMocks.getLiteAccessSnapshotFromCookie).not.toHaveBeenCalled();
  });

  it.each([
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/session',
    '/api/auth/refresh',
    '/api/lite',
  ])('keeps the control endpoint %s available', (pathname) => {
    const response = proxy(apiRequest(pathname));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(sessionMocks.readSessionCookie).not.toHaveBeenCalled();
  });
});
