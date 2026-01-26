import { useCallback, useRef } from 'react';
import { getCredentials, clearCredentials } from './storage';

interface AuthFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

interface AuthFetchError extends Error {
  isAuthError?: boolean;
}
export function useAuthFetch() {
  const isRelogging = useRef(false);
  const pendingRequests = useRef<Map<string, Promise<Response>>>(new Map());

  const authFetch = useCallback(
    async (url: string, options: AuthFetchOptions = {}): Promise<Response> => {
      const { skipAuth = false, ...fetchOptions } = options;
      const cacheKey = `${url}-${JSON.stringify(fetchOptions)}`;

      if (isRelogging.current && pendingRequests.current.has(cacheKey)) {
        return pendingRequests.current.get(cacheKey)!;
      }

      const makeRequest = async (): Promise<Response> => {
        const response = await fetch(url, {
          ...fetchOptions,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
        });

        if (response.status === 401 && !skipAuth && !isRelogging.current) {
          isRelogging.current = true;

          try {
            const credentials = await getCredentials();

            if (!credentials) {
              const authError = new Error('Sessão expirada') as AuthFetchError;
              authError.isAuthError = true;
              throw authError;
            }

            const loginResponse = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(credentials),
            });

            if (!loginResponse.ok) {
              await clearCredentials();

              const authError = new Error('Sessão expirada. Faça login novamente.') as AuthFetchError;
              authError.isAuthError = true;
              throw authError;
            }

            const retryResponse = await fetch(url, {
              ...fetchOptions,
              headers: {
                'Content-Type': 'application/json',
                ...fetchOptions.headers,
              },
            });

            return retryResponse;

          } finally {
            isRelogging.current = false;
            pendingRequests.current.clear();
          }
        }

        return response;
      };

      const requestPromise = makeRequest();
      if (isRelogging.current) {
        pendingRequests.current.set(cacheKey, requestPromise);
      }

      return requestPromise;
    },
    []
  );

  return authFetch;
}

export function useAuthFetchJson() {
  const authFetch = useAuthFetch();

  return useCallback(
    async <T = unknown>(url: string, options: AuthFetchOptions = {}): Promise<T> => {
      const response = await authFetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        const error = new Error(errorData.error || 'Erro na requisição') as AuthFetchError;
        (error as AuthFetchError).isAuthError = response.status === 401;
        throw error;
      }

      return response.json() as Promise<T>;
    },
    [authFetch]
  );
}
