'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, isSessionExpiredError, SessionExpiredError } from '@/lib/fetch-client';
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error';

interface FetchResult<T> {
  data: T | null;
  error: string | null;
  isSessionError: boolean;
}

export function usePageFetch() {
  const router = useRouter();
  const routerRef = useRef(router);
  const redirectingRef = useRef(false);

  routerRef.current = router;

  const fetchWithHandler = useCallback(
    async <T,>(url: string): Promise<FetchResult<T>> => {
      if (redirectingRef.current) {
        return { data: null, error: null, isSessionError: true };
      }

      try {
        const response = await apiFetch(url);

        if (!response.ok) {
          const apiError = await parseApiError(response);
          if (isSessionExpiredApiError(apiError)) {
            return { data: null, error: null, isSessionError: true };
          }
          return { data: null, error: apiError.message, isSessionError: false };
        }

        const data = await response.json();
        return { data, error: null, isSessionError: false };
      } catch (err) {
        if (isSessionExpiredError(err) || err instanceof SessionExpiredError) {
          redirectingRef.current = true;
          routerRef.current.push('/login');
          return { data: null, error: null, isSessionError: true };
        }
        return { data: null, error: err instanceof Error ? err.message : 'Erro desconhecido', isSessionError: false };
      }
    },
    []
  );

  return { fetchWithHandler };
}
