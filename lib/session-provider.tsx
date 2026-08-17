'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DisconnectReason,
  getSessionManager,
  type SessionInfo,
  type SessionUserData,
} from './session-manager';
import { queryClient } from './query-client';
import { getPersistKeyForScope } from './query-persist';
import {
  clearAcademicUpdatesState,
  clearQueryCache,
  hasStoredCredentials,
} from './storage';

interface SessionContextValue {
  user: SessionUserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  logout: (reason?: DisconnectReason) => Promise<void>;
  reconnectFailed: boolean;
  sessionStatus: SessionInfo['status'];
  cacheScope: string | null;
  lastExternalLoginAt: number;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);
const PUBLIC_PATHS = new Set(['/login', '/']);
const sessionManager = getSessionManager();

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentScopeRef = useRef<string | null>(null);
  const previousStatusRef = useRef<SessionInfo['status']>('active');
  const [initialPathname] = useState(pathname);
  const [session, setSession] = useState<SessionInfo>(() => sessionManager.getCurrentState());
  const [isLoading, setIsLoading] = useState(true);
  const [reconnectFailed, setReconnectFailed] = useState(false);

  const publishSession = useCallback((next: SessionInfo) => {
    const previousScope = currentScopeRef.current;
    if (next.cacheScope && previousScope !== next.cacheScope) {
      queryClient.clear();
      currentScopeRef.current = next.cacheScope;
    }

    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = next.status;
    setSession(next);

    if (next.status === 'active') {
      setReconnectFailed(false);
    } else if (
      previousStatus === 'active' &&
      next.status === 'expired' &&
      !next.cacheScope
    ) {
      const reason = sessionManager.getDisconnectReason();
      if (reason === DisconnectReason.LOGOUT_USER) {
        sessionManager.clearDisconnectReason();
      } else {
        setReconnectFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    const manager = sessionManager;
    const unsubscribe = manager.subscribe(publishSession);
    let cancelled = false;

    const initialize = async () => {
      setIsLoading(true);
      let info = await manager.initialize();

      if ((!info.user || info.status !== 'active') && !PUBLIC_PATHS.has(initialPathname)) {
        const reconnected = await manager.reconnect();
        info = manager.getCurrentState();
        if (!reconnected) {
          if (info.status === 'error') {
            setReconnectFailed(false);
          } else if (await hasStoredCredentials()) {
            setReconnectFailed(true);
          } else {
            router.replace('/login');
          }
        }
      }

      if (!cancelled) {
        publishSession(info);
        setIsLoading(false);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [initialPathname, publishSession, router]);

  useEffect(() => {
    if (pathname !== '/login' || !reconnectFailed) return;
    const timeoutId = window.setTimeout(() => setReconnectFailed(false), 4_500);
    return () => window.clearTimeout(timeoutId);
  }, [pathname, reconnectFailed]);

  const logout = useCallback(
    async (reason: DisconnectReason = DisconnectReason.LOGOUT_USER) => {
      const scopeToClear = currentScopeRef.current;
      try {
        await sessionManager.logout(reason);
      } catch {
        toast.error('Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.');
        return;
      }
      queryClient.clear();
      if (scopeToClear) {
        await Promise.all([
          clearQueryCache(getPersistKeyForScope(scopeToClear)),
          clearAcademicUpdatesState(scopeToClear),
        ]);
      }
      currentScopeRef.current = null;
      setReconnectFailed(false);

      if (reason === DisconnectReason.LOGOUT_USER) toast.success('Voce saiu da conta.');
      if (!PUBLIC_PATHS.has(pathname)) router.replace('/login');
    },
    [pathname, router]
  );

  const refreshSession = useCallback(async () => {
    const manager = sessionManager;
    const current = await manager.checkSession(false);
    if (current.status === 'active' && current.user) return;

    const reconnected = await manager.reconnect();
    if (!reconnected) {
      if (manager.getCurrentState().status === 'error') {
        toast.error(
          manager.getLastReconnectError() || 'Não foi possível restabelecer a sessão.',
          { id: 'reconnect' }
        );
      } else {
        setReconnectFailed(true);
      }
    }
  }, []);

  const manualReconnect = useCallback(async () => {
    const refreshed = await sessionManager.refreshSession();
    if (refreshed) return;
    toast.error(
      sessionManager.getLastReconnectError() || 'Nao foi possivel atualizar a sessao.',
      { id: 'reconnect' }
    );
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: session.user,
      isLoading,
      isAuthenticated: !!session.user && session.status === 'active',
      refreshSession,
      logout,
      reconnectFailed,
      sessionStatus: session.status,
      cacheScope: session.cacheScope,
      lastExternalLoginAt: session.lastRefreshedAt,
    }),
    [isLoading, logout, reconnectFailed, refreshSession, session]
  );

  const isLogin = pathname === '/login';

  return (
    <SessionContext.Provider value={value}>
      {children}
      {reconnectFailed ? (
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md">
          <div
            className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950 shadow-lg shadow-amber-950/5 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50"
            role="alert"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Sessao expirada</p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                {isLogin
                  ? 'Entre novamente para continuar.'
                  : 'Tente reconectar ou abra a tela de login.'}
              </p>
            </div>
            {!isLogin ? (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={manualReconnect}
                  className="min-h-11 rounded-xl bg-amber-800 px-3 text-xs font-semibold text-white active:scale-[0.98] dark:bg-amber-200 dark:text-amber-950"
                >
                  Reconectar
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="min-h-11 rounded-xl border border-amber-400 px-3 text-xs font-semibold active:scale-[0.98] dark:border-amber-700"
                >
                  Login
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within a SessionProvider');
  return context;
}
