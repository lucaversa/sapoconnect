'use client';

import {
  cleanupLegacyCredentials,
  clearOfflineSessionHint,
  clearCredentials,
  getCredentials,
  getOfflineSessionHint,
  markReconnectCookieConfirmed,
  saveOfflineSessionHint,
  type Credentials,
} from './storage';

export type SessionStatus = 'active' | 'refreshing' | 'expired' | 'error';

export enum DisconnectReason {
  SESSION_EXPIRED = 'Sua sessao expirou. Faca login novamente.',
  INVALID_CREDENTIALS = 'Credenciais invalidas.',
  SERVER_ERROR = 'O servidor esta temporariamente indisponivel.',
  NETWORK_ERROR = 'Sem conexao com a internet.',
  LOGOUT_USER = 'Voce saiu da conta.',
}

export interface SessionUserData {
  ra: string;
}

export interface SessionInfo {
  user: SessionUserData | null;
  status: SessionStatus;
  lastCheckedAt: number;
  lastRefreshedAt: number;
  cacheScope: string | null;
}

interface RefreshPayload {
  type?: 'refresh';
  ok?: boolean;
  ra?: string;
  cacheScope?: string;
  lastExternalLoginAt?: number;
  reconnectStorage?: 'httpOnly';
  migrationConfirmed?: boolean;
  error?: string;
  code?: string;
}

interface LogoutPayload {
  type: 'logout';
}

const CONFIG = {
  SESSION_TTL: 20 * 60 * 1_000,
  RESUME_CHECK_AFTER: 5 * 60 * 1_000,
  CHECK_CACHE_TTL: 30 * 1_000,
  REQUEST_TIMEOUT: 20 * 1_000,
  PREEMPTIVE_WINDOW: 60 * 1_000,
  RECENT_INTERACTION_WINDOW: 5 * 60 * 1_000,
};

export class SessionManager {
  private state: SessionInfo = {
    user: null,
    status: 'active',
    lastCheckedAt: 0,
    lastRefreshedAt: 0,
    cacheScope: null,
  };

  private disconnectReason: DisconnectReason | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionCheckPromise: Promise<SessionInfo> | null = null;
  private backgroundReconnectPromise: Promise<boolean> | null = null;
  private listeners = new Set<(info: SessionInfo) => void>();
  private lastReconnectError: string | null = null;
  private lastReconnectCode: string | null = null;
  private lastInteractionAt = Date.now();
  private channel: BroadcastChannel | null = null;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private interactionHandler: (() => void) | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    this.setupLifecycleHandlers();
    void cleanupLegacyCredentials();
  }

  private setupLifecycleHandlers(): void {
    this.interactionHandler = () => {
      this.lastInteractionAt = Date.now();
    };
    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible' || !this.state.user) return;
      const elapsed = Date.now() - this.state.lastCheckedAt;
      if (elapsed < CONFIG.RESUME_CHECK_AFTER) return;
      void this.checkAndReconnectInBackground();
    };
    this.onlineHandler = () => {
      if (!this.state.user || document.visibilityState !== 'visible') return;
      const jitter = 250 + Math.floor(Math.random() * 750);
      window.setTimeout(() => void this.checkAndReconnectInBackground(), jitter);
    };
    this.offlineHandler = () => {
      if (this.state.user) this.setState({ status: 'error' });
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    window.addEventListener('pointerdown', this.interactionHandler, { passive: true });
    window.addEventListener('keydown', this.interactionHandler);

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('sapoconnect-session-v2');
      this.channel.addEventListener('message', (event: MessageEvent<RefreshPayload | LogoutPayload>) => {
        const payload = event.data;
        if (payload?.type === 'logout') {
          this.disconnectReason = DisconnectReason.LOGOUT_USER;
          void Promise.all([clearCredentials(), clearOfflineSessionHint()]);
          this.setState({
            user: null,
            status: 'expired',
            lastCheckedAt: Date.now(),
            lastRefreshedAt: 0,
            cacheScope: null,
          });
          window.location.replace('/login');
          return;
        }
        if (!payload?.ok || !payload.ra || !payload.cacheScope) return;
        this.applyActivePayload(payload);
      });
    }
  }

  private async checkAndReconnectInBackground(): Promise<boolean> {
    if (this.backgroundReconnectPromise) return this.backgroundReconnectPromise;

    this.backgroundReconnectPromise = (async () => {
      try {
        const info = await this.checkSession(false);
        return info.status === 'expired' ? this.refreshSession() : info.status === 'active';
      } finally {
        this.backgroundReconnectPromise = null;
      }
    })();
    return this.backgroundReconnectPromise;
  }

  private notifyListeners(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // A consumer must not break the session state machine.
      }
    });
  }

  private setState(updates: Partial<SessionInfo>): void {
    const previous = this.state;
    this.state = { ...previous, ...updates };
    if (
      previous.status !== this.state.status ||
      previous.user?.ra !== this.state.user?.ra ||
      previous.cacheScope !== this.state.cacheScope ||
      previous.lastRefreshedAt !== this.state.lastRefreshedAt
    ) {
      this.notifyListeners();
    }
  }

  private applyActivePayload(payload: RefreshPayload): void {
    const now = Date.now();
    this.setState({
      user: { ra: payload.ra || this.state.user?.ra || '' },
      status: 'active',
      lastCheckedAt: now,
      lastRefreshedAt: payload.lastExternalLoginAt || now,
      cacheScope: payload.cacheScope || this.state.cacheScope,
    });
    this.lastReconnectError = null;
    this.lastReconnectCode = null;
    if (payload.ra && payload.cacheScope) {
      void saveOfflineSessionHint(payload.ra, payload.cacheScope).catch(() => {});
    }
    if (payload.reconnectStorage === 'httpOnly' || payload.migrationConfirmed) {
      void markReconnectCookieConfirmed(payload.cacheScope);
    }
  }

  private async restoreOfflineIdentity(): Promise<boolean> {
    const hint = await getOfflineSessionHint();
    if (!hint) return false;
    this.setState({
      user: { ra: hint.ra },
      status: 'error',
      cacheScope: hint.cacheScope,
    });
    return true;
  }

  private async readPayload(response: Response): Promise<RefreshPayload> {
    try {
      return (await response.json()) as RefreshPayload;
    } catch {
      return {};
    }
  }

  private shouldUseCheckCache(): boolean {
    return (
      !!this.state.user &&
      this.state.status === 'active' &&
      Date.now() - this.state.lastCheckedAt < CONFIG.CHECK_CACHE_TTL
    );
  }

  async checkSession(useCache = false): Promise<SessionInfo> {
    if (useCache && this.shouldUseCheckCache()) return { ...this.state };
    if (this.sessionCheckPromise) return this.sessionCheckPromise;

    this.sessionCheckPromise = (async () => {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT),
        });
        const payload = await this.readPayload(response);

        if (response.ok && payload.ra) {
          this.applyActivePayload(payload);
        } else if (response.status === 401) {
          this.setState({
            status: 'expired',
            lastCheckedAt: Date.now(),
          });
        } else if (!this.state.user) {
          this.setState({ status: 'error', lastCheckedAt: Date.now() });
        }
        return { ...this.state };
      } catch {
        if (!this.state.user) this.setState({ status: 'error', lastCheckedAt: Date.now() });
        return { ...this.state };
      } finally {
        this.sessionCheckPromise = null;
      }
    })();
    return this.sessionCheckPromise;
  }

  private async postRefresh(credentials?: Credentials): Promise<{
    response: Response;
    payload: RefreshPayload;
  }> {
    const credentialPayload = credentials
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        }
      : {};
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      cache: 'no-store',
      ...credentialPayload,
      signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT),
    });
    return { response, payload: await this.readPayload(response) };
  }

  private async performRefresh(): Promise<boolean> {
    let result = await this.postRefresh();

    if (result.response.status === 428 || result.payload.code === 'LEGACY_CREDENTIALS_REQUIRED') {
      const legacyCredentials = await getCredentials();
      if (!legacyCredentials) {
        this.lastReconnectError = DisconnectReason.SESSION_EXPIRED;
        this.lastReconnectCode = 'SESSION_EXPIRED';
        if (await this.restoreOfflineIdentity()) return false;
        this.setState({ status: 'expired', user: null, cacheScope: null });
        return false;
      }

      result = await this.postRefresh(legacyCredentials);
      if (result.response.ok) {
        const confirmation = await this.postRefresh();
        if (confirmation.response.ok) result = confirmation;
      }
    }

    if (result.response.ok && result.payload.ok !== false) {
      this.applyActivePayload(result.payload);
      this.channel?.postMessage(result.payload);
      return true;
    }

    this.lastReconnectError = result.payload.error || DisconnectReason.SESSION_EXPIRED;
    this.lastReconnectCode = result.payload.code || 'SESSION_EXPIRED';
    if (result.response.status === 429 || result.response.status >= 500 || result.payload.code === 'TOTVS_OFFLINE') {
      await this.restoreOfflineIdentity();
      this.setState({ status: 'error' });
      return false;
    }

    if (
      result.payload.code === 'INVALID_CREDENTIALS' ||
      result.payload.code === 'IDENTITY_MISMATCH'
    ) {
      await Promise.all([clearCredentials(), clearOfflineSessionHint()]);
    }
    this.setState({ status: 'expired', user: null, cacheScope: null });
    return false;
  }

  private async withCrossTabLock(task: () => Promise<boolean>): Promise<boolean> {
    const lockManager = (navigator as Navigator & {
      locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> };
    }).locks;
    if (!lockManager) return task();

    return lockManager.request('sapoconnect-session-refresh', async () => {
      const info = await this.checkSession(false);
      if (
        info.status === 'active' &&
        info.user &&
        Date.now() - info.lastRefreshedAt < CONFIG.SESSION_TTL - CONFIG.PREEMPTIVE_WINDOW
      ) {
        return true;
      }
      return task();
    });
  }

  async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.setState({ status: 'refreshing' });
    this.lastReconnectError = null;
    this.lastReconnectCode = null;
    this.refreshPromise = this.withCrossTabLock(() => this.performRefresh())
      .catch(async () => {
        this.lastReconnectError = DisconnectReason.NETWORK_ERROR;
        this.lastReconnectCode = 'NETWORK_ERROR';
        await this.restoreOfflineIdentity();
        this.setState({ status: 'error' });
        return false;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  async reconnect(): Promise<boolean> {
    return this.refreshSession();
  }

  async logout(reason: DisconnectReason = DisconnectReason.LOGOUT_USER): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT),
    });
    if (!response.ok) {
      throw new Error('Não foi possível encerrar a sessão no servidor.');
    }

    this.disconnectReason = reason;
    await Promise.all([clearCredentials(), clearOfflineSessionHint()]);
    this.setState({
      user: null,
      status: 'expired',
      lastCheckedAt: Date.now(),
      lastRefreshedAt: 0,
      cacheScope: null,
    });
    this.channel?.postMessage({ type: 'logout' } satisfies LogoutPayload);
  }

  async initialize(): Promise<SessionInfo> {
    await cleanupLegacyCredentials();
    const checked = await this.checkSession(false);
    if (!checked.user && checked.status === 'error') {
      await this.restoreOfflineIdentity();
    }
    return this.getCurrentState();
  }

  getCurrentState(): SessionInfo {
    return { ...this.state };
  }

  isRefreshing(): boolean {
    return this.refreshPromise !== null || this.state.status === 'refreshing';
  }

  markSessionActive(): void {
    this.setState({ status: 'active', lastCheckedAt: Date.now() });
  }

  markSessionExpired(): void {
    this.setState({ status: 'refreshing' });
  }

  shouldRefreshPreemptively(): boolean {
    return (
      !!this.state.user &&
      this.state.status === 'active' &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      navigator.onLine !== false &&
      Date.now() - this.lastInteractionAt < CONFIG.RECENT_INTERACTION_WINDOW &&
      Date.now() - this.state.lastRefreshedAt >= CONFIG.SESSION_TTL - CONFIG.PREEMPTIVE_WINDOW
    );
  }

  async preemptiveRefreshIfNeeded(): Promise<boolean> {
    return this.shouldRefreshPreemptively() ? this.refreshSession() : true;
  }

  async waitForBackgroundReconnect(): Promise<void> {
    if (this.backgroundReconnectPromise) await this.backgroundReconnectPromise;
  }

  subscribe(callback: (info: SessionInfo) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getDisconnectReason(): DisconnectReason | null {
    return this.disconnectReason;
  }

  getLastReconnectError(): string | null {
    return this.lastReconnectError;
  }

  getLastReconnectCode(): string | null {
    return this.lastReconnectCode;
  }

  clearDisconnectReason(): void {
    this.disconnectReason = null;
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      }
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
      if (this.interactionHandler) {
        window.removeEventListener('pointerdown', this.interactionHandler);
        window.removeEventListener('keydown', this.interactionHandler);
      }
    }
    this.channel?.close();
    this.listeners.clear();
  }
}

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) sessionManagerInstance = new SessionManager();
  return sessionManagerInstance;
}
