import 'server-only';

const configuredTimeout = Number(process.env.TOTVS_TIMEOUT_MS ?? 12_000);
const DEFAULT_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 12_000;

export class UpstreamTimeoutError extends Error {
  constructor() { super('Tempo de espera da TOTVS esgotado'); this.name = 'UpstreamTimeoutError'; }
}

export function isTransientUpstreamError(error: unknown): boolean {
  if (error instanceof UpstreamTimeoutError || error instanceof TypeError) return true;
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  const status = typeof candidate?.status === 'number'
    ? candidate.status
    : typeof candidate?.statusCode === 'number'
      ? candidate.statusCode
      : 0;
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    candidate?.code === 'TOTVS_OFFLINE' ||
    candidate?.code === 'UPSTREAM_TIMEOUT'
  );
}

function retryDelay(deadlineAt: number): Promise<void> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) return Promise.reject(new UpstreamTimeoutError());
  const jitter = 80 + Math.floor(Math.random() * 120);
  return new Promise((resolve) => setTimeout(resolve, Math.min(jitter, remaining)));
}

export async function fetchTotvs(
  input: string,
  init: RequestInit,
  options: { idempotentRead?: boolean; timeoutMs?: number } = {},
): Promise<Response> {
  const attempts = options.idempotentRead ? 2 : 1;
  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const totalTimeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? requestedTimeout
    : DEFAULT_TIMEOUT_MS;
  const deadlineAt = Date.now() + totalTimeoutMs;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) throw new UpstreamTimeoutError();
    const deadline = AbortSignal.timeout(Math.max(1, remaining));
    const signal = init.signal ? AbortSignal.any([deadline, init.signal]) : deadline;
    try {
      const response = await fetch(input, { ...init, signal, cache: 'no-store' });
      const isTransientStatus = response.status === 408 || response.status === 429 || response.status >= 500;
      if (attempt + 1 < attempts && isTransientStatus) {
        if (response.body) await response.body.cancel().catch(() => {});
        if (init.signal?.aborted) throw init.signal.reason;
        await retryDelay(deadlineAt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (deadline.aborted) lastError = new UpstreamTimeoutError();
      if (init.signal?.aborted) throw lastError;
      if (attempt + 1 === attempts) throw lastError;
      await retryDelay(deadlineAt);
    }
  }
  throw lastError;
}
