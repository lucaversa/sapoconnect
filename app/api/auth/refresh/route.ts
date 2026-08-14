import { NextRequest } from 'next/server';
import { ExternalAuthError, performExternalLogin } from '@/lib/external-auth';
import { createSession, destroySession, getReconnectCredentials, getSession, updateSessionCookies } from '@/lib/session';
import { privateJson } from '@/lib/server/http';
import { AuthInputError, readAuthCredentials } from '@/lib/server/auth-input';
import { guardAuthRequest, guardSameOriginRequest, RequestGuardError } from '@/lib/server/request-guard';
import {
  ServerConfigurationError,
  SERVER_CONFIGURATION_ERROR_CODE,
  SERVER_CONFIGURATION_PUBLIC_MESSAGE,
} from '@/lib/server/configuration-error';

export async function POST(request: NextRequest) {
  try {
    // Reject cross-origin work before parsing/decrypting anything. The actual
    // limiter is applied after identity discovery so shared mobile/NAT IPs do
    // not make unrelated students consume the same primary bucket.
    guardSameOriginRequest(request);
    const supplied = await readAuthCredentials(request, { optional: true });
    const existing = await getSession();
    const stored = await getReconnectCredentials();
    guardAuthRequest(
      request,
      'refresh',
      existing?.sessionId || stored?.sessionId || supplied?.codUsuario
    );
    if (!supplied && existing && stored && (stored.sessionId !== existing.sessionId || stored.ra !== existing.ra)) {
      await destroySession();
      return privateJson({ error: 'Cookie de reconexão não pertence à sessão atual.', code: 'IDENTITY_MISMATCH' }, { status: 409 });
    }
    const credentials = supplied?.codUsuario && supplied.senha
      ? { codUsuario: supplied.codUsuario, senha: supplied.senha }
      : stored ? { codUsuario: stored.codUsuario, senha: stored.senha } : null;
    if (!credentials) {
      return privateJson({ error: 'Migração de credenciais necessária.', code: 'LEGACY_CREDENTIALS_REQUIRED' }, { status: 428 });
    }
    if (existing && existing.ra !== credentials.codUsuario) {
      await destroySession();
      return privateJson({ error: 'A identidade da sessão não corresponde às credenciais.', code: 'IDENTITY_MISMATCH' }, { status: 409 });
    }
    const externalCookies = await performExternalLogin(credentials);
    const session = existing
      ? await updateSessionCookies(externalCookies, existing, credentials)
      : await createSession(
          externalCookies,
          credentials.codUsuario,
          credentials,
          !supplied ? stored?.sessionId : undefined
        );
    return privateJson({ ok: true, reconnectStorage: 'httpOnly', cacheScope: session.cacheScope, ra: session.ra, lastExternalLoginAt: session.lastExternalLoginAt, migrationConfirmed: true });
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return privateJson(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
        }
      );
    }
    if (error instanceof AuthInputError) {
      return privateJson(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof ExternalAuthError) {
      return privateJson(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof ServerConfigurationError) {
      console.error('[auth/refresh] Server configuration is incomplete:', error.message);
      return privateJson(
        {
          error: SERVER_CONFIGURATION_PUBLIC_MESSAGE,
          code: SERVER_CONFIGURATION_ERROR_CODE,
        },
        { status: 503 }
      );
    }
    return privateJson({ error: 'Não foi possível atualizar a sessão.', code: 'REFRESH_FAILED' }, { status: 503 });
  }
}
