export type ApiErrorCode =
  | 'SESSION_EXPIRED'
  | 'SESSION_MISSING'
  | 'TOTVS_OFFLINE'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | string;

export class ApiResponseError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: ApiErrorCode,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

export async function parseApiError(response: Response): Promise<ApiResponseError> {
  let payload: { error?: string; code?: ApiErrorCode; details?: string } = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const message = payload.error || 'Erro ao carregar dados';
  return new ApiResponseError(message, response.status, payload.code, payload.details);
}

export function isTotvsOfflineError(error: unknown): boolean {
  return error instanceof ApiResponseError && error.code === 'TOTVS_OFFLINE';
}

export function isSessionExpiredApiError(error: unknown): boolean {
  if (!(error instanceof ApiResponseError)) return false;
  if (error.code === 'SESSION_EXPIRED' || error.code === 'SESSION_MISSING') return true;
  return error.status === 401;
}
