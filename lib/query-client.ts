import { QueryClient } from '@tanstack/react-query';
import { SessionExpiredError } from './fetch-client';
import { ApiResponseError } from './api-response-error';
import { QUERY_GC_TIME } from './query-policy';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof SessionExpiredError || error instanceof ApiResponseError) return false;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return false;
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1_000,
      gcTime: QUERY_GC_TIME,
      retry: shouldRetry,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      throwOnError: false,
    },
  },
});
