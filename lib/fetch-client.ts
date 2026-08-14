import { ApiResponseError } from './api-response-error';
import { getSessionManager } from './session-manager';

export class SessionExpiredError extends Error {
  name = 'SessionExpiredError';

  constructor() {
    super('Sessao expirada. Por favor, faca login novamente.');
  }
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  maxRetries?: number;
}

function isIdempotentMethod(method?: string): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
}

function isRetryableTransportError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name !== 'AbortError' && error.name !== 'TimeoutError')
  );
}

function retryDelay(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 1_000) + Math.floor(Math.random() * 180);
}

async function fetchWithTransportBudget(
  url: string,
  options: RequestInit,
  maxRetries: number
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (!isRetryableTransportError(error) || attempt >= maxRetries) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, retryDelay(attempt)));
    }
  }
  throw lastError;
}

export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth = false, maxRetries, ...fetchOptions } = options;
  const methodIsIdempotent = isIdempotentMethod(fetchOptions.method);
  const transportRetries = maxRetries ?? (methodIsIdempotent ? 1 : 0);
  const sessionManager = getSessionManager();

  if (!skipAuth) await sessionManager.preemptiveRefreshIfNeeded();

  const requestOptions: RequestInit = {
    ...fetchOptions,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  };

  let response = await fetchWithTransportBudget(url, requestOptions, transportRetries);
  if (response.status === 401 && !skipAuth) {
    sessionManager.markSessionExpired();
    const refreshed = await sessionManager.refreshSession();
    if (!refreshed) {
      const state = sessionManager.getCurrentState();
      if (state.status === 'error') {
        const code = sessionManager.getLastReconnectCode() || 'UPSTREAM_ERROR';
        throw new ApiResponseError(
          sessionManager.getLastReconnectError() || 'Não foi possível restabelecer a sessão.',
          503,
          code
        );
      }
      throw new SessionExpiredError();
    }

    // One replay only. Auth refresh and route retries must never multiply each other.
    response = await fetchWithTransportBudget(url, requestOptions, 0);
    if (response.status === 401) throw new SessionExpiredError();
  }

  if (response.ok && !skipAuth) sessionManager.markSessionActive();
  return response;
}

export async function apiFetchWithTimeout(
  url: string,
  options: FetchOptions = {},
  timeout = 30_000
): Promise<Response> {
  const callerSignal = options.signal;
  const timeoutSignal = AbortSignal.timeout(timeout);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;

  try {
    return await apiFetch(url, { ...options, signal });
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new Error('Tempo de espera esgotado');
    }
    throw error;
  }
}

export async function preWarmSession(): Promise<boolean> {
  return getSessionManager().preemptiveRefreshIfNeeded();
}

export function isSessionActive(): boolean {
  const state = getSessionManager().getCurrentState();
  return state.status === 'active' && state.user !== null;
}
