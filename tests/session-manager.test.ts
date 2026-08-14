import { afterEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  clearCredentials: vi.fn(async () => {}),
  cleanupLegacyCredentials: vi.fn(async () => {}),
  getCredentials: vi.fn(async () => null),
  getOfflineSessionHint: vi.fn(async (): Promise<{ ra: string; cacheScope: string; expiresAt: number } | null> => null),
  markReconnectCookieConfirmed: vi.fn(async () => {}),
  saveOfflineSessionHint: vi.fn(async () => {}),
  clearOfflineSessionHint: vi.fn(async () => {}),
}));

vi.mock('@/lib/storage', () => storageMocks);

import { DisconnectReason, SessionManager } from '@/lib/session-manager';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  storageMocks.clearCredentials.mockClear();
  storageMocks.getOfflineSessionHint.mockReset().mockResolvedValue(null);
  storageMocks.saveOfflineSessionHint.mockClear();
  storageMocks.clearOfflineSessionHint.mockClear();
});

describe('client logout safety', () => {
  it('does not claim or apply logout when the server keeps the HttpOnly cookie', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const manager = new SessionManager();

    await expect(manager.logout()).rejects.toThrow(/encerrar a sessão/);
    expect(storageMocks.clearCredentials).not.toHaveBeenCalled();
    expect(manager.getDisconnectReason()).toBeNull();
  });

  it('registers lifecycle events without starting a polling interval', () => {
    const addWindowListener = vi.fn();
    const addDocumentListener = vi.fn();
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    vi.stubGlobal('window', {
      addEventListener: addWindowListener,
      removeEventListener: vi.fn(),
      setTimeout,
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: addDocumentListener,
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', { onLine: true });

    new SessionManager();

    expect(addDocumentListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(addWindowListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addWindowListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(intervalSpy).not.toHaveBeenCalled();
  });

  it('keeps the active client state when logout has a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const manager = new SessionManager();

    await expect(manager.logout()).rejects.toThrow('offline');
    expect(storageMocks.clearCredentials).not.toHaveBeenCalled();
    expect(manager.getDisconnectReason()).toBeNull();
  });

  it('clears local migration data only after confirmed server logout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })));
    const manager = new SessionManager();

    await expect(manager.logout()).resolves.toBeUndefined();
    expect(storageMocks.clearCredentials).toHaveBeenCalledOnce();
    expect(storageMocks.clearOfflineSessionHint).toHaveBeenCalledOnce();
    expect(manager.getDisconnectReason()).toBe(DisconnectReason.LOGOUT_USER);
    expect(manager.getCurrentState()).toMatchObject({ user: null, status: 'expired', cacheScope: null });
  });

  it('broadcasts confirmed logout to the other tabs', async () => {
    const postMessage = vi.fn();
    class FakeBroadcastChannel {
      postMessage = postMessage;
      addEventListener = vi.fn();
      close = vi.fn();
    }
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      BroadcastChannel: FakeBroadcastChannel,
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })));

    const manager = new SessionManager();
    await manager.logout();
    expect(postMessage).toHaveBeenCalledWith({ type: 'logout' });
  });
});

describe('offline cache identity', () => {
  it('restores the opaque cache scope when the session endpoint is unreachable', async () => {
    storageMocks.getOfflineSessionHint.mockResolvedValue({
      ra: '124101.00571',
      cacheScope: 'scope_offline_1234',
      expiresAt: Date.now() + 60_000,
    });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));

    const manager = new SessionManager();
    const session = await manager.initialize();

    expect(session).toMatchObject({
      user: { ra: '124101.00571' },
      status: 'error',
      cacheScope: 'scope_offline_1234',
    });
  });

  it('updates the offline cache hint after a valid server session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ra: '124101.00571',
      cacheScope: 'scope_active_1234',
      lastExternalLoginAt: 123,
    }), { status: 200 })));

    const manager = new SessionManager();
    await manager.initialize();

    expect(storageMocks.saveOfflineSessionHint).toHaveBeenCalledWith('124101.00571', 'scope_active_1234');
  });

  it('keeps cached identity when reconnect itself has a network failure', async () => {
    storageMocks.getOfflineSessionHint.mockResolvedValue({
      ra: '124101.00571',
      cacheScope: 'scope_offline_1234',
      expiresAt: 0,
    });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));

    const manager = new SessionManager();
    await manager.initialize();

    await expect(manager.refreshSession()).resolves.toBe(false);
    expect(manager.getCurrentState()).toMatchObject({
      user: { ra: '124101.00571' },
      status: 'error',
      cacheScope: 'scope_offline_1234',
    });
  });

  it('restores cached identity when the session expired and TOTVS is unavailable', async () => {
    storageMocks.getOfflineSessionHint.mockResolvedValue({
      ra: '124101.00571',
      cacheScope: 'scope_offline_1234',
      expiresAt: 0,
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{"authenticated":false}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"code":"TOTVS_OFFLINE"}', { status: 503 })));

    const manager = new SessionManager();
    await manager.initialize();

    await expect(manager.refreshSession()).resolves.toBe(false);
    expect(manager.getCurrentState()).toMatchObject({
      user: { ra: '124101.00571' },
      status: 'error',
      cacheScope: 'scope_offline_1234',
    });
  });

  it('keeps the active cache scope while a session check is being recovered', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ra: '124101.00571',
        cacheScope: 'scope_active_1234',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{"authenticated":false}', { status: 401 })));

    const manager = new SessionManager();
    await manager.initialize();
    const checked = await manager.checkSession(false);

    expect(checked).toMatchObject({
      user: { ra: '124101.00571' },
      status: 'expired',
      cacheScope: 'scope_active_1234',
    });
  });

  it('enters refreshing state immediately instead of flashing an expired-session UI', () => {
    const manager = new SessionManager();
    manager.markSessionExpired();
    expect(manager.getCurrentState().status).toBe('refreshing');
  });
});

describe('reconnect diagnostics', () => {
  it('preserves a server configuration error instead of relabeling it as TOTVS offline', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"authenticated":false}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          '{"error":"Aplicativo temporariamente indisponivel.","code":"SERVER_CONFIGURATION_ERROR"}',
          { status: 503 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const manager = new SessionManager();

    await manager.initialize();
    await expect(manager.refreshSession()).resolves.toBe(false);

    expect(manager.getCurrentState().status).toBe('error');
    expect(manager.getLastReconnectCode()).toBe('SERVER_CONFIGURATION_ERROR');
    expect(manager.getLastReconnectError()).toBe('Aplicativo temporariamente indisponivel.');
  });
});
