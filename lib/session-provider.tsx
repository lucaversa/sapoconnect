'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { getSessionManager, SessionInfo, SessionUserData, DisconnectReason } from './session-manager';
import { clearQueryCache, getCredentials } from './storage';
import { queryClient } from './query-client';
import { QUERY_PERSIST_KEY_PREFIX, QUERY_PERSIST_USER_KEY, getPersistKeyForUser } from './query-persist';

interface SessionContextValue {
  user: SessionUserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  logout: (reason?: DisconnectReason) => Promise<void>;
  reconnectFailed: boolean;
  sessionStatus: SessionInfo['status'];
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionInfo['status']>('active');
  const publicPaths = ['/login', '/'];
  const sessionManagerRef = useRef(getSessionManager());
  const isInitialized = useRef(false);
  const previousStatusRef = useRef<SessionInfo['status']>('active');
  const hasHandledFirstStatusUpdateRef = useRef(false);
  const reconnectToastIdRef = useRef<string | null>(null);
  const lastUserRaRef = useRef<string | null>(null);

  const clearPersistedCache = useCallback((raToClear?: string | null) => {
    queryClient.clear();
    const keysToClear = new Set<string>();
    keysToClear.add(QUERY_PERSIST_KEY_PREFIX);
    if (raToClear) {
      keysToClear.add(getPersistKeyForUser(raToClear));
    }
    try {
      const storedRa = localStorage.getItem(QUERY_PERSIST_USER_KEY);
      if (storedRa) {
        keysToClear.add(getPersistKeyForUser(storedRa));
      }
    } catch {
      // ignore storage errors
    }

    keysToClear.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
      void clearQueryCache(key).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (isInitialized.current) return;

    const initSession = async () => {
      setIsLoading(true);
      const sessionManager = sessionManagerRef.current;

      const info = await sessionManager.initialize();

      if (info.status === 'active' && info.user) {
        setUser(info.user);
        setSessionStatus('active');
        setReconnectFailed(false);
      } else if (!publicPaths.includes(pathname)) {
        const reconnected = await sessionManager.reconnect();
        if (!reconnected) {
          const currentState = sessionManager.getCurrentState();
          const credentials = await getCredentials();

          if (credentials) {
            setUser({ ra: credentials.codUsuario });
          }

          if (currentState.status === 'error') {
            setSessionStatus('error');
            setReconnectFailed(false);
            return;
          }

          setSessionStatus('expired');
          if (credentials) {
            setReconnectFailed(true);
          } else {
            setReconnectFailed(false);
            router.push('/login');
          }
        }
      }

      setIsLoading(false);
      isInitialized.current = true;
    };

    initSession();

    const unsubscribe = sessionManagerRef.current.subscribe((info: SessionInfo) => {
      const previousStatus = previousStatusRef.current;
      previousStatusRef.current = info.status;

      setUser((prev) => {
        if (info.user) return info.user;
        if (info.status === 'error' || info.status === 'expired') return prev;
        return null;
      });
      setSessionStatus(info.status);
      if (info.status === 'active') {
        setReconnectFailed(false);
      }

      // Mostrar toast baseado nas mudanças de status
      if (!hasHandledFirstStatusUpdateRef.current) {
        hasHandledFirstStatusUpdateRef.current = true;
        return;
      }

      if (previousStatus === 'active' && info.status === 'expired') {
        const reason = sessionManagerRef.current.getDisconnectReason();
        if (reason === DisconnectReason.LOGOUT_USER) {
          sessionManagerRef.current.clearDisconnectReason();
          setReconnectFailed(false);
          return;
        }
        if (reason) {
          sessionManagerRef.current.clearDisconnectReason();
        }
        setReconnectFailed(true);
      } else if (info.status === 'refreshing' && previousStatus !== 'refreshing') {
        // Mostrar toast de reconexão
        reconnectToastIdRef.current = 'reconnect';
        toast.loading('Reconectando...', { id: 'reconnect' });
      } else if (info.status === 'active' && previousStatus === 'refreshing') {
        // Despedir toast de reconexão e mostrar sucesso
        if (reconnectToastIdRef.current === 'reconnect') {
          toast.success('Conexão restabelecida!', { id: 'reconnect' });
          reconnectToastIdRef.current = null;
        }
      } else if (info.status === 'error') {
        if (reconnectToastIdRef.current === 'reconnect') {
          toast.dismiss('reconnect');
          reconnectToastIdRef.current = null;
        }
        toast.error('Sistema da TOTVS possivelmente fora do ar.');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (sessionStatus !== 'refreshing' && reconnectToastIdRef.current === 'reconnect') {
      toast.dismiss('reconnect');
      reconnectToastIdRef.current = null;
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (pathname !== '/login' || !reconnectFailed) return;

    const timeoutId = window.setTimeout(() => {
      setReconnectFailed(false);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, reconnectFailed]);

  const handleManualReconnect = useCallback(async () => {
    const sessionManager = sessionManagerRef.current;
    const refreshed = await sessionManager.refreshSession();

    if (refreshed) {
      setReconnectFailed(false);
      return;
    }

    const currentState = sessionManager.getCurrentState();
    if (currentState.status === 'error') {
      return;
    }

    const errorMessage = sessionManager.getLastReconnectError();
    toast.error(errorMessage || 'Não foi possível atualizar a sessão.', { id: 'reconnect' });
  }, []);

  useEffect(() => {
    try {
      const storedRa = localStorage.getItem(QUERY_PERSIST_USER_KEY);
      if (storedRa) {
        lastUserRaRef.current = storedRa;
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const currentRa = user?.ra ?? null;
    if (currentRa && lastUserRaRef.current && currentRa !== lastUserRaRef.current) {
      clearPersistedCache(lastUserRaRef.current);
    }
    if (currentRa) {
      lastUserRaRef.current = currentRa;
      try {
        localStorage.setItem(QUERY_PERSIST_USER_KEY, currentRa);
      } catch {
        // ignore storage errors
      }
    }
  }, [user?.ra, clearPersistedCache]);

  const logout = useCallback(async (reason: DisconnectReason = DisconnectReason.LOGOUT_USER) => {
    const sessionManager = sessionManagerRef.current;
    await sessionManager.logout(reason);
    clearPersistedCache(lastUserRaRef.current);
    lastUserRaRef.current = null;
    try {
      localStorage.removeItem(QUERY_PERSIST_USER_KEY);
    } catch {
      // ignore storage errors
    }
    setUser(null);
    setSessionStatus('expired');
    setReconnectFailed(false);

    // Mostrar toast baseado no motivo
    if (reason === DisconnectReason.LOGOUT_USER) {
      toast.success('Você saiu da conta.');
    }

    if (!publicPaths.includes(pathname)) {
      router.push('/login');
    }
  }, [pathname, router]);

  const refreshSession = useCallback(async () => {
    const sessionManager = sessionManagerRef.current;
    const info = await sessionManager.checkSession(false);

    if (info.status !== 'active' || !info.user) {
      const reconnected = await sessionManager.reconnect();
      if (!reconnected) {
        const currentState = sessionManager.getCurrentState();
        if (currentState.status === 'error') {
          return;
        }
        setReconnectFailed(true);
        await logout();
      }
    }
  }, [logout]);

  const value: SessionContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    refreshSession,
    logout,
    reconnectFailed,
    sessionStatus,
  };
  const isOnLoginPage = pathname === '/login';

  return (
    <SessionContext.Provider value={value}>
      {children}
      {reconnectFailed && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Sessão expirada
              </p>
              <p className={`text-xs text-amber-600 dark:text-amber-400 mt-1 ${isOnLoginPage ? 'hidden' : ''}`}>
                Não foi possível reconectar automaticamente. Atualize a sessão para continuar.
              </p>
              {isOnLoginPage && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Sua sessão expirou. Faça login novamente para continuar.
                </p>
              )}
            </div>
            {!isOnLoginPage && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualReconnect}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-700 bg-amber-700 text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-300 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
                >
                  Atualizar sessão
                </button>
                <button
                  onClick={() => {
                    setReconnectFailed(false);
                    router.push('/login');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-500 bg-amber-100 text-amber-800 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900"
                >
                  Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
