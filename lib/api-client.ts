/**
 * Cliente API com retry automatico para 401
 */

import { ensureSession } from './auth-client';

interface FetchWithRetryOptions {
  url: string;
  options?: RequestInit;
  maxRetries?: number;
}

export async function fetchWithRetry({
  url,
  options = {},
  maxRetries = 1,
}: FetchWithRetryOptions): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 401 && attempt < maxRetries) {
        const refreshed = await ensureSession();

        if (!refreshed) {
          return response;
        }

        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Erro ao carregar dados');
}
