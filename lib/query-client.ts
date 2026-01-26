import { QueryClient } from '@tanstack/react-query';
import { SessionExpiredError } from './fetch-client';
import { ApiResponseError } from './api-response-error';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,      // 2 min - reduzido para tentar novamente mais rápido
      gcTime: 24 * 60 * 60 * 1000,   // 24h - mantém dados para fallback offline
      retry: (failureCount, error) => {
        // Não retry em 401 (sessão expirada)
        if (error instanceof SessionExpiredError) return false;
        if (error instanceof ApiResponseError && error.code === 'TOTVS_OFFLINE') return false;
        // Em erros de rede, tenta até 3 vezes
        if (error instanceof Error && error.message.includes('fetch')) return failureCount < 3;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Quando há erro, remove do cache mais rápido
      throwOnError: () => false,
    },
  },
});
