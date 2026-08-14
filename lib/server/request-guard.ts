import 'server-only';
import { createHmac } from 'crypto';
import { ServerConfigurationError } from './configuration-error';

type AuthAction = 'login' | 'refresh';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 2_000;
const ANONYMOUS_LIMITS: Record<AuthAction, number> = { login: 8, refresh: 12 };
const LOGIN_SUBJECT_LIMIT = 6;
const LOGIN_SUBJECT_GLOBAL_LIMIT = 20;
const LOGIN_IP_CEILING = 600;
const REFRESH_SUBJECT_LIMIT = 12;
const REFRESH_IP_CEILING = 600;

export class RequestGuardError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 429,
    public readonly code: 'ORIGIN_REJECTED' | 'RATE_LIMITED',
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'RequestGuardError';
  }
}

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    throw new RequestGuardError('Origem da requisição não permitida.', 403, 'ORIGIN_REJECTED');
  }

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.APP_ORIGIN
    ? normalizedOrigin(process.env.APP_ORIGIN)
    : null;
  const allowed = new Set([requestOrigin, configuredOrigin].filter(Boolean));
  const origin = request.headers.get('origin');

  if (origin && !allowed.has(normalizedOrigin(origin))) {
    throw new RequestGuardError('Origem da requisição não permitida.', 403, 'ORIGIN_REJECTED');
  }

  if (
    !origin &&
    process.env.NODE_ENV === 'production' &&
    fetchSite !== 'same-origin' &&
    fetchSite !== 'same-site'
  ) {
    throw new RequestGuardError('Origem da requisição ausente.', 403, 'ORIGIN_REJECTED');
  }
}

function clientAddress(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

function guardKeyMaterial(): Buffer {
  const configured =
    process.env.REQUEST_GUARD_KEY ||
    process.env.SESSION_CACHE_SCOPE_KEY ||
    process.env.SESSION_ENCRYPTION_KEY ||
    process.env.SESSION_ENCRYPTION_KEYS?.split(',')[0]?.split(':')[1];
  if (!configured || !/^[a-fA-F0-9]{64}$/.test(configured)) {
    throw new ServerConfigurationError('REQUEST_GUARD_KEY or SESSION_ENCRYPTION_KEY(S) is required');
  }
  return Buffer.from(configured, 'hex');
}

function opaqueIdentifier(kind: 'address' | 'subject', value: string): string {
  return createHmac('sha256', guardKeyMaterial())
    .update(`sapoconnect:request-guard:v1:${kind}:${value.toLowerCase()}`)
    .digest('base64url');
}

function consumeBucket(key: string, limit: number): void {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    current.count += 1;
    buckets.delete(key);
    buckets.set(key, current);
    if (current.count > limit) {
      throw new RequestGuardError(
        'Muitas tentativas. Aguarde antes de tentar novamente.',
        429,
        'RATE_LIMITED',
        Math.max(1, Math.ceil((current.resetAt - now) / 1_000))
      );
    }
  }

  while (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value!);
}

function consume(action: AuthAction, request: Request, subject?: string): void {
  const address = opaqueIdentifier('address', clientAddress(request));
  const opaqueSubject = subject ? opaqueIdentifier('subject', subject) : null;
  if (action === 'login' && subject) {
    consumeBucket(`login-subject:${address}:${opaqueSubject}`, LOGIN_SUBJECT_LIMIT);
    consumeBucket(`login-user:${opaqueSubject}`, LOGIN_SUBJECT_GLOBAL_LIMIT);
    consumeBucket(`login-ip:${address}`, LOGIN_IP_CEILING);
    return;
  }
  if (action === 'refresh' && opaqueSubject) {
    consumeBucket(`refresh-session:${opaqueSubject}`, REFRESH_SUBJECT_LIMIT);
    consumeBucket(`refresh-ip:${address}`, REFRESH_IP_CEILING);
    return;
  }
  consumeBucket(`${action}-anonymous:${address}`, ANONYMOUS_LIMITS[action]);
}

export function guardAuthRequest(request: Request, action: AuthAction, subject?: string): void {
  assertSameOrigin(request);
  consume(action, request, subject);
}

export function guardSameOriginRequest(request: Request): void {
  assertSameOrigin(request);
}

export function resetRequestGuardsForTests(): void {
  buckets.clear();
}

export function getRequestGuardBucketKeysForTests(): string[] {
  return Array.from(buckets.keys());
}
