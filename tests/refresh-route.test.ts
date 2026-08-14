import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  destroySession: vi.fn(async () => {}),
  getReconnectCredentials: vi.fn(),
  getSession: vi.fn(),
  updateSessionCookies: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  performExternalLogin: vi.fn(async () => ({ aspNetSessionId: 'new-asp', aspxAuth: 'new-auth' })),
}));

vi.mock('@/lib/session', () => sessionMocks);
vi.mock('@/lib/external-auth', () => ({
  ExternalAuthError: class ExternalAuthError extends Error {},
  performExternalLogin: authMocks.performExternalLogin,
}));

import { POST } from '@/app/api/auth/refresh/route';
import { resetRequestGuardsForTests } from '@/lib/server/request-guard';

const existing = {
  version: 1,
  sessionId: 'session-existing',
  cacheScope: 'scope-existing',
  externalCookies: { aspNetSessionId: 'asp', aspxAuth: 'auth' },
  lastExternalLoginAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  ra: '111',
};

function request(body?: object) {
  return new Request('https://app.example.com/api/auth/refresh', {
    method: 'POST',
    headers: {
      origin: 'https://app.example.com',
      'x-forwarded-for': '198.51.100.7',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  resetRequestGuardsForTests();
  vi.clearAllMocks();
  vi.stubEnv('SESSION_ENCRYPTION_KEY', 'a'.repeat(64));
});

afterEach(() => vi.unstubAllEnvs());

describe('refresh identity reconciliation', () => {
  it('deletes divergent session/reconnect cookies before returning 409', async () => {
    sessionMocks.getSession.mockResolvedValue(existing);
    sessionMocks.getReconnectCredentials.mockResolvedValue({
      version: 1,
      sessionId: 'session-other',
      ra: '222',
      codUsuario: '222',
      senha: 'secret',
      expiresAt: Date.now() + 60_000,
    });

    const response = await POST(request() as never);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDENTITY_MISMATCH' });
    expect(sessionMocks.destroySession).toHaveBeenCalledOnce();
    expect(authMocks.performExternalLogin).not.toHaveBeenCalled();
  });

  it('preserves reconnect sessionId when the operational session cookie is missing', async () => {
    const stored = {
      version: 1,
      sessionId: 'stable-session-id',
      ra: '333',
      codUsuario: '333',
      senha: 'secret',
      expiresAt: Date.now() + 60_000,
    };
    sessionMocks.getSession.mockResolvedValue(null);
    sessionMocks.getReconnectCredentials.mockResolvedValue(stored);
    sessionMocks.createSession.mockImplementation(async (_cookies, ra, _credentials, sessionId) => ({
      ...existing,
      ra,
      sessionId,
      cacheScope: 'stable-scope',
    }));

    const response = await POST(request() as never);
    expect(response.status).toBe(200);
    expect(sessionMocks.createSession).toHaveBeenCalledWith(
      { aspNetSessionId: 'new-asp', aspxAuth: 'new-auth' },
      '333',
      { codUsuario: '333', senha: 'secret' },
      'stable-session-id'
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true, cacheScope: 'stable-scope' });
  });
});
