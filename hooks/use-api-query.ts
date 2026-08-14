'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';
import { QUERY_GC_TIME } from '@/lib/query-policy';

type QueryOptions<T> = Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>;

export function useApiQuery<T>(
  queryKey: readonly unknown[],
  url: string,
  options?: QueryOptions<T>
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiFetch(url);
      if (!response.ok) {
        const apiError = await parseApiError(response);
        if (isSessionExpiredApiError(apiError)) throw new SessionExpiredError();
        throw apiError;
      }
      const data = await response.json() as T;
      if (
        response.headers.get('x-sapoconnect-cache') === 'stale' &&
        data &&
        typeof data === 'object'
      ) {
        Object.assign(data as object, { __cacheStale: true });
      }
      return data;
    },
    ...options,
    gcTime: QUERY_GC_TIME,
  });
}
