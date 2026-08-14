import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  performExternalLogin: vi.fn(async () => ({ aspNetSessionId: 'asp', aspxAuth: 'auth' })),
}));

vi.mock('@/lib/session', () => sessionMocks);
vi.mock('@/lib/external-auth', () => ({
  ExternalAuthError: class ExternalAuthError extends Error {},
  performExternalLogin: authMocks.performExternalLogin,
}));

import { POST } from '@/app/api/auth/login/route';
import { resetRequestGuardsForTests } from '@/lib/server/request-guard';

function request() {
  return new Request('https://app.example.com/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'https://app.example.com',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': '198.51.100.21',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ codUsuario: '12345', senha: 'secret' }),
  });
}

beforeEach(() => {
  resetRequestGuardsForTests();
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => vi.unstubAllEnvs());

describe('login route diagnostics', () => {
  it('reports missing server secrets without blaming TOTVS', async () => {
    vi.stubEnv('SESSION_ENCRYPTION_KEY', '');
    vi.stubEnv('SESSION_ENCRYPTION_KEYS', '');
    vi.stubEnv('REQUEST_GUARD_KEY', '');
    vi.stubEnv('SESSION_CACHE_SCOPE_KEY', '');

    const response = await POST(request() as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SERVER_CONFIGURATION_ERROR',
    });
    expect(authMocks.performExternalLogin).not.toHaveBeenCalled();
  });

  it('keeps a correctly configured request on the external-auth path', async () => {
    vi.stubEnv('SESSION_ENCRYPTION_KEY', 'a'.repeat(64));
    sessionMocks.createSession.mockResolvedValue({ cacheScope: 'scope-a' });

    const response = await POST(request() as never);

    expect(response.status).toBe(200);
    expect(authMocks.performExternalLogin).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({ ok: true, cacheScope: 'scope-a' });
  });
});
