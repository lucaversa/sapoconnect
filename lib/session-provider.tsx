'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { getSessionManager, SessionInfo, SessionUserData, DisconnectReason } from './session-manager';
import { getCredentials } from './storage';

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
  const reconnectToastIdRef = useRef<string | null>(null);

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
          if (currentState.status === 'error') {
            const credentials = await getCredentials();
            if (credentials) {
              setUser({ ra: credentials.codUsuario });
            }
            setSessionStatus('error');
            setReconnectFailed(false);
            return;
          }
          setReconnectFailed(true);
          router.push('/login');
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
        if (info.status === 'error') return prev;
        return null;
      });
      setSessionStatus(info.status);

      // Mostrar toast baseado nas mudanças de status
      if (previousStatus === 'active' && info.status === 'expired') {
        const reason = sessionManagerRef.current.getDisconnectReason();
        if (reason === DisconnectReason.LOGOUT_USER) {
          sessionManagerRef.current.clearDisconnectReason();
          setReconnectFailed(false);
          return;
        }
        if (reason) {
          toast.error(reason);
          sessionManagerRef.current.clearDisconnectReason();
        } else {
          toast.error('Sessão expirada. Faça login novamente.');
        }
        setReconnectFailed(true);
        if (!publicPaths.includes(pathname)) {
          router.push('/login');
        }
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
        toast.error('Sistema da TOTVS possivelmente fora do ar.');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const logout = useCallback(async (reason: DisconnectReason = DisconnectReason.LOGOUT_USER) => {
    const sessionManager = sessionManagerRef.current;
    await sessionManager.logout(reason);
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
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Não foi possível reconectar automaticamente.
              </p>
            </div>
            <button
              onClick={() => {
                setReconnectFailed(false);
                router.push('/login');
              }}
              className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white"
            >
              Login
            </button>
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
