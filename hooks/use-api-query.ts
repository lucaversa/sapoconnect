'use client';

import { useQuery, UseQueryOptions, useQueryClient } from '@tanstack/react-query';
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';

type QueryOptions<T> = Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>;

export function useApiQuery<T>(
  queryKey: readonly unknown[],
  url: string,
  options?: QueryOptions<T>
) {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiFetch(url);
      if (!response.ok) {
        const apiError = await parseApiError(response);
        if (isSessionExpiredApiError(apiError)) {
          // Invalida APENAS este query quando há erro de sessão
          queryClient.invalidateQueries({ queryKey });
          queryClient.resetQueries({ queryKey });
          throw new SessionExpiredError();
        }
        throw apiError;
      }
      return response.json() as Promise<T>;
    },
    ...options,
    // Mantém dados antigos disponíveis mesmo em erro
    gcTime: 24 * 60 * 60 * 1000,
  });

  return result;
}
