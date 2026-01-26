import { getSessionManager } from './session-manager';
import { ApiResponseError } from './api-response-error';

export class SessionExpiredError extends Error {
  name = 'SessionExpiredError';
  message = 'Sessão expirada. Por favor, faça login novamente.';

  constructor() {
    super('Sessão expirada. Por favor, faça login novamente.');
  }
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  maxRetries?: number;
}

function getRetryDelay(attempt: number, isAfterRefresh: boolean, timeSinceRefresh?: number): number {
  if (isAfterRefresh) {
    if (timeSinceRefresh && timeSinceRefresh < 1000) {
      return 300;
    }
    return Math.min(300 + (attempt * 250), 1000);
  }

  return Math.min(200 * Math.pow(1.5, attempt), 2000);
}

let lastGlobalRefreshTime = 0;

export async function apiFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    skipAuth = false,
    maxRetries = 3,
    ...fetchOptions
  } = options;

  const sessionManager = getSessionManager();

  await sessionManager.waitForBackgroundReconnect();

  let didRefresh = false;
  let attemptsAfterRefresh = 0;
  const MAX_ATTEMPTS_AFTER_REFRESH = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (response.status === 401 && !skipAuth) {
        if (!didRefresh) {
          if (sessionManager.isRefreshing()) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          const refreshed = await sessionManager.refreshSession();

          if (refreshed) {
            didRefresh = true;
            attemptsAfterRefresh = 0;
            lastGlobalRefreshTime = Date.now();

            const timeSinceLastGlobalRefresh = Date.now() - lastGlobalRefreshTime;
            const adaptiveDelay = Math.max(
              300,
              Math.min(1500, timeSinceLastGlobalRefresh)
            );

            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
            continue;
          }

          didRefresh = true;

          const currentState = sessionManager.getCurrentState();
          if (currentState.status === 'error') {
            throw new ApiResponseError(
              'Sistema da TOTVS possivelmente fora do ar.',
              503,
              'TOTVS_OFFLINE'
            );
          }
        }

        if (didRefresh) {
          attemptsAfterRefresh++;

          if (attemptsAfterRefresh <= MAX_ATTEMPTS_AFTER_REFRESH) {
            const timeSinceRefresh = Date.now() - lastGlobalRefreshTime;
            const delay = getRetryDelay(attemptsAfterRefresh, true, timeSinceRefresh);

            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        throw new SessionExpiredError();
      }

      if (response.ok && !skipAuth) {
        sessionManager.markSessionActive();
      }

      return response;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (lastError instanceof SessionExpiredError) {
        throw lastError;
      }
      if (lastError instanceof ApiResponseError && lastError.code === 'TOTVS_OFFLINE') {
        throw lastError;
      }

      if (lastError.name === 'AbortError') {
        throw lastError;
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = getRetryDelay(attempt, false);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Erro ao carregar dados');
}

export async function apiFetchWithTimeout(
  url: string,
  options: FetchOptions = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await apiFetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch {
    clearTimeout(timeoutId);
    throw new Error('Tempo de espera esgotado');
  }
}

export async function preWarmSession(): Promise<boolean> {
  try {
    const sessionManager = getSessionManager();

    const shouldRefresh = sessionManager.shouldRefreshPreemptively();
    if (shouldRefresh) {
      return await sessionManager.preemptiveRefreshIfNeeded();
    }

    const info = await sessionManager.checkSession(true);
    return info.status === 'active';
  } catch {
    return false;
  }
}

export function isSessionActive(): boolean {
  const sessionManager = getSessionManager();
  const state = sessionManager.getCurrentState();
  return state.status === 'active' && state.user !== null;
}

export async function forceSessionCheck(): Promise<boolean> {
  try {
    const sessionManager = getSessionManager();
    const info = await sessionManager.checkSession(false);
    return info.status === 'active';
  } catch {
    return false;
  }
}
