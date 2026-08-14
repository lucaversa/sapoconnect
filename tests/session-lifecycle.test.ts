import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const cookieState = vi.hoisted(() => new Map<string, { value: string; options?: Record<string, unknown> }>());

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieState.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieState.set(name, { value, options });
    },
  }),
}));

import {
  createSession,
  destroySession,
  getReconnectCredentials,
  getSession,
  updateSessionCookies,
} from '@/lib/session';

beforeEach(() => {
  cookieState.clear();
  process.env.SESSION_ENCRYPTION_KEYS = `test:${'71'.repeat(32)}`;
  process.env.SESSION_CACHE_SCOPE_KEY = '72'.repeat(32);
});

describe('session and reconnect cookie lifecycle', () => {
  it('prepares both encrypted values before emitting either cookie', async () => {
    await expect(
      createSession(
        { aspNetSessionId: 'asp', aspxAuth: 'auth' },
        '12345',
        { codUsuario: '12345', senha: 'x'.repeat(10_000) }
      )
    ).rejects.toThrow(/cookie exceeds safe size/i);

    expect(cookieState.size).toBe(0);
  });

  it('emits operational and reconnect cookies as one prepared bundle', async () => {
    const session = await createSession(
      { aspNetSessionId: 'asp', aspxAuth: 'auth' },
      '12345',
      { codUsuario: '12345', senha: 'secret' }
    );

    expect(cookieState.has('sapoconnect_session')).toBe(true);
    expect(cookieState.has('sapoconnect_reconnect')).toBe(true);

    cookieState.clear();
    await updateSessionCookies(
      { aspNetSessionId: 'new-asp', aspxAuth: 'new-auth' },
      session,
      { codUsuario: '12345', senha: 'secret' }
    );
    expect(cookieState.has('sapoconnect_session')).toBe(true);
    expect(cookieState.has('sapoconnect_reconnect')).toBe(true);
  });

  it('does not mutate either cookie when refresh bundle preparation fails', async () => {
    const session = await createSession(
      { aspNetSessionId: 'asp', aspxAuth: 'auth' },
      '12345',
      { codUsuario: '12345', senha: 'secret' }
    );
    cookieState.clear();

    await expect(
      updateSessionCookies(
        { aspNetSessionId: 'new-asp', aspxAuth: 'new-auth' },
        session,
        { codUsuario: '12345', senha: 'x'.repeat(10_000) }
      )
    ).rejects.toThrow(/cookie exceeds safe size/i);
    expect(cookieState.size).toBe(0);
  });

  it('preserves identity and cache scope when rebuilding a missing session cookie', async () => {
    const externalCookies = { aspNetSessionId: 'asp', aspxAuth: 'auth' };
    const credentials = { codUsuario: '12345', senha: 'secret' };
    const first = await createSession(externalCookies, '12345', credentials, 'stable-session-id');
    const reconnect = await getReconnectCredentials();

    cookieState.delete('sapoconnect_session');
    const rebuilt = await createSession(externalCookies, '12345', credentials, reconnect?.sessionId);

    expect(rebuilt.sessionId).toBe(first.sessionId);
    expect(rebuilt.cacheScope).toBe(first.cacheScope);
    expect((await getSession())?.ra).toBe('12345');
  });

  it('deletes both cookies even when the session cookie cannot be decrypted', async () => {
    cookieState.set('sapoconnect_session', { value: 'invalid-cookie' });
    cookieState.set('sapoconnect_reconnect', { value: 'invalid-cookie' });

    await expect(destroySession()).resolves.toBeUndefined();
    expect(cookieState.get('sapoconnect_session')).toMatchObject({ value: '', options: { maxAge: 0, path: '/' } });
    expect(cookieState.get('sapoconnect_reconnect')).toMatchObject({ value: '', options: { maxAge: 0, path: '/api/auth' } });
  });
});
