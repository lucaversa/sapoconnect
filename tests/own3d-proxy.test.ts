import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionMocks = vi.hoisted(() => ({
  readSessionCookie: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  SESSION_COOKIE_NAME: 'sapoconnect_session',
  readSessionCookie: sessionMocks.readSessionCookie,
}));

import { config, proxy } from '@/proxy';

function apiRequest(pathname: string) {
  return new NextRequest(`https://sapoconnect.test${pathname}`, {
    headers: { cookie: 'sapoconnect_session=test-session' },
  });
}

describe('own3d API boundary', () => {
  beforeEach(() => {
    sessionMocks.readSessionCookie.mockReset();
  });

  it('runs for every API route and nowhere else', () => {
    expect(config).toEqual({ matcher: '/api/:path*' });
  });

  it.each(['124101.00574', '23201.00120'])(
    'blocks protected API data for exact target RA %s',
    async (ra) => {
      sessionMocks.readSessionCookie.mockReturnValue({ ra });

      const response = proxy(apiRequest('/api/faltas/completo'));

      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toContain('no-store');
      await expect(response.json()).resolves.toEqual({
        error: 'Acesso indisponível.',
        code: 'OWN3D_ACCESS_BLOCKED',
      });
    }
  );

  it('does not block nearby or unauthenticated identities', () => {
    for (const ra of ['124101.00573', '23201.00121', undefined]) {
      sessionMocks.readSessionCookie.mockReturnValue(ra ? { ra } : null);

      const response = proxy(apiRequest('/api/faltas/completo'));

      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it.each(['/api/auth/login', '/api/auth/logout'])(
    'keeps the session mutation endpoint %s available for account switching',
    (pathname) => {
      sessionMocks.readSessionCookie.mockReturnValue({ ra: '124101.00574' });

      const response = proxy(apiRequest(pathname));

      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(sessionMocks.readSessionCookie).not.toHaveBeenCalled();
    }
  );
});
