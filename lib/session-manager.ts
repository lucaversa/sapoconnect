'use client';

import { getCredentials, clearCredentials } from './storage';

export type SessionStatus = 'active' | 'refreshing' | 'expired' | 'error';

export enum DisconnectReason {
  SESSION_EXPIRED = 'Sua sessão expirou. Faça login novamente.',
  INVALID_CREDENTIALS = 'Credenciais inválidas.',
  SERVER_ERROR = 'O servidor está temporariamente indisponível.',
  NETWORK_ERROR = 'Sem conexão com a internet.',
  LOGOUT_USER = 'Você saiu da conta.',
}

export interface SessionUserData {
  ra: string;
}

export interface SessionInfo {
  user: SessionUserData | null;
  status: SessionStatus;
  lastCheckedAt: number;
  lastRefreshedAt: number;
}

const CONFIG = {
  SESSION_CHECK_INTERVAL: 2 * 60 * 1000,
  SESSION_TTL: 20 * 60 * 1000,
  REFRESH_TIMEOUT: 15 * 1000,
  MIN_DELAY_BETWEEN_REQUESTS: 500,
  CACHE_TTL: 10 * 1000,
};

class SessionManager {
  private state: SessionInfo = {
    user: null,
    status: 'active',
    lastCheckedAt: 0,
    lastRefreshedAt: 0,
  };

  private disconnectReason: DisconnectReason | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionCheckPromise: Promise<SessionInfo | null> | null = null;
  private listeners: Set<(info: SessionInfo) => void> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;
  private visibilityHandler: (() => void) | null = null;
  private backgroundReconnectPromise: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startPeriodicCheck();
      this.setupVisibilityHandler();
    }
  }

  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = async () => {
      if (document.visibilityState === 'visible' && this.state.user) {
        const timeSinceLastCheck = Date.now() - this.state.lastCheckedAt;
        if (timeSinceLastCheck > 60 * 1000) {
          if (this.backgroundReconnectPromise) {
            await this.backgroundReconnectPromise;
            return;
          }

          this.backgroundReconnectPromise = (async () => {
            try {
              const info = await this.checkSession(false);
              if (info.status === 'expired') {
                const reconnected = await this.reconnect();
                if (reconnected) {
                  await new Promise(resolve => setTimeout(resolve, 1500));
                }
                return reconnected;
              }
              return true;
            } finally {
              setTimeout(() => {
                this.backgroundReconnectPromise = null;
              }, 2000);
            }
          })();

          await this.backgroundReconnectPromise;
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      if (this.state.user && this.state.status === 'active') {
        const info = await this.checkSession(true);
        if (info.status === 'expired') {
          this.notifyListeners();
        }
      }
    }, CONFIG.SESSION_CHECK_INTERVAL);
  }

  private stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.state });
      } catch {
      }
    });
  }

  private setState(updates: Partial<SessionInfo>): void {
    const previousStatus = this.state.status;
    this.state = { ...this.state, ...updates };

    if (previousStatus !== this.state.status || updates.user) {
      this.notifyListeners();
    }
  }

  private shouldUseCache(): boolean {
    const now = Date.now();
    const timeSinceCheck = now - this.state.lastCheckedAt;
    return timeSinceCheck < CONFIG.CACHE_TTL && this.state.status === 'active';
  }

  async checkSession(silent = false): Promise<SessionInfo> {
    if (silent && this.shouldUseCache() && this.state.user) {
      return { ...this.state };
    }

    if (this.sessionCheckPromise) {
      return this.sessionCheckPromise.then((info) => info ?? { ...this.state });
    }

    this.sessionCheckPromise = (async () => {
      try {
        const response = await fetch('/api/auth/session', {
          signal: AbortSignal.timeout(CONFIG.REFRESH_TIMEOUT),
        });

        if (response.ok) {
          const data = await response.json();
          const lastExternalLoginAt = typeof data.lastExternalLoginAt === 'number'
            ? data.lastExternalLoginAt
            : Date.now();
          this.setState({
            user: { ra: data.ra || '' },
            status: 'active',
            lastCheckedAt: Date.now(),
            lastRefreshedAt: lastExternalLoginAt,
          });
          return { ...this.state };
        } else if (response.status === 401) {
          this.setState({ status: 'expired', lastCheckedAt: Date.now() });
          return { ...this.state };
        } else {
          this.setState({ status: 'error', lastCheckedAt: Date.now() });
          return { ...this.state };
        }
      } catch {
        if (this.state.status === 'active' && this.state.user) {
          return { ...this.state };
        }
        this.setState({ status: 'error', lastCheckedAt: Date.now() });
        return { ...this.state };
      } finally {
        this.sessionCheckPromise = null;
      }
    })();

    return this.sessionCheckPromise.then((info) => info ?? { ...this.state });
  }

  async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const credentials = await getCredentials();
    if (!credentials) {
      return false;
    }

    this.setState({ status: 'refreshing' });

    this.refreshPromise = (async () => {
      try {
        const startTime = Date.now();

        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
          signal: AbortSignal.timeout(CONFIG.REFRESH_TIMEOUT),
        });

        if (response.ok) {
          const elapsed = Date.now() - startTime;
          const remainingDelay = Math.max(0, CONFIG.MIN_DELAY_BETWEEN_REQUESTS - elapsed);
          if (remainingDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
          }

          const sessionInfo = await this.checkSession();

          if (sessionInfo.status === 'active' && sessionInfo.user) {
            this.setState({ status: 'active', lastRefreshedAt: Date.now() });
            return true;
          }
        }

        if (response.status >= 500) {
          this.setState({ status: 'error' });
          return false;
        }

        if (response.status === 401 || response.status === 400) {
          await clearCredentials();
        }

        this.setState({ status: 'expired' });
        return false;
      } catch {
        this.setState({ status: 'error' });
        return false;
      } finally {
        setTimeout(() => {
          this.refreshPromise = null;
        }, 3000);
      }
    })();

    return this.refreshPromise;
  }

  async reconnect(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const credentials = await getCredentials();
    if (!credentials) {
      return false;
    }

    this.setState({ status: 'refreshing' });

    this.refreshPromise = (async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
          signal: AbortSignal.timeout(CONFIG.REFRESH_TIMEOUT),
        });

        if (response.ok) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const sessionInfo = await this.checkSession();

          if (sessionInfo.status === 'active' && sessionInfo.user) {
            this.setState({ status: 'active', lastRefreshedAt: Date.now() });
            return true;
          }
        }

        if (response.status >= 500) {
          this.setState({ status: 'error' });
          return false;
        }

        if (response.status === 401 || response.status === 400) {
          await clearCredentials();
        }
        this.setState({ status: 'expired', user: null });
        return false;
      } catch {
        this.setState({ status: 'error' });
        return false;
      } finally {
        setTimeout(() => {
          this.refreshPromise = null;
        }, 3000);
      }
    })();

    return this.refreshPromise;
  }

  async logout(reason: DisconnectReason = DisconnectReason.LOGOUT_USER): Promise<void> {
    this.disconnectReason = reason;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      this.stopPeriodicCheck();
      this.setState({ user: null, status: 'expired' });
    }
  }

  getDisconnectReason(): DisconnectReason | null {
    return this.disconnectReason;
  }

  clearDisconnectReason(): void {
    this.disconnectReason = null;
  }

  async initialize(): Promise<SessionInfo> {
    const info = await this.checkSession();
    return info;
  }

  getCurrentState(): SessionInfo {
    return { ...this.state };
  }

  isRefreshing(): boolean {
    return this.refreshPromise !== null || this.state.status === 'refreshing';
  }

  subscribe(callback: (info: SessionInfo) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  destroy(): void {
    this.stopPeriodicCheck();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.listeners.clear();
  }

  markSessionActive(): void {
    this.setState({
      lastRefreshedAt: Date.now(),
      lastCheckedAt: Date.now(),
    });
  }

  shouldRefreshPreemptively(): boolean {
    if (!this.state.user || this.state.status !== 'active') {
      return false;
    }

    const now = Date.now();
    const timeSinceRefresh = now - this.state.lastRefreshedAt;
    return timeSinceRefresh > (CONFIG.SESSION_TTL - 5 * 60 * 1000);
  }

  async preemptiveRefreshIfNeeded(): Promise<boolean> {
    if (this.shouldRefreshPreemptively() && !this.isRefreshing()) {
      return this.refreshSession();
    }
    return true;
  }

  async waitForBackgroundReconnect(): Promise<void> {
    if (this.backgroundReconnectPromise) {
      await this.backgroundReconnectPromise;
    }
  }
}

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

export function destroySessionManager(): void {
  if (sessionManagerInstance) {
    sessionManagerInstance.destroy();
    sessionManagerInstance = null;
  }
}
