/**
 * POST /api/auth/login
 * Autentica usuário externamente e cria sessão interna
 */

import { NextRequest } from 'next/server';
import { ExternalAuthError, performExternalLogin } from '@/lib/external-auth';
import { isOwn3dTargetRa } from '@/lib/own3d-target';
import { createSession } from '@/lib/session';
import { privateJson } from '@/lib/server/http';
import { AuthInputError, readAuthCredentials } from '@/lib/server/auth-input';
import { guardAuthRequest, RequestGuardError } from '@/lib/server/request-guard';
import {
  ServerConfigurationError,
  SERVER_CONFIGURATION_ERROR_CODE,
  SERVER_CONFIGURATION_PUBLIC_MESSAGE,
} from '@/lib/server/configuration-error';

export async function POST(request: NextRequest) {
  try {
    const credentials = await readAuthCredentials(request);
    if (!credentials) throw new AuthInputError('Credenciais ausentes.', 400, 'BAD_REQUEST');
    const { codUsuario, senha } = credentials;
    guardAuthRequest(request, 'login', codUsuario);

    const externalCookies = await performExternalLogin({
      codUsuario,
      senha,
    });

    const session = await createSession(externalCookies, codUsuario, { codUsuario, senha });

    return privateJson({
      ok: true,
      reconnectStorage: 'httpOnly',
      cacheScope: session.cacheScope,
      migrationConfirmed: true,
      ra: session.ra,
      restrictedExperience: isOwn3dTargetRa(session.ra),
    });
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
      console.error('[auth/login] Server configuration is incomplete:', error.message);
      return privateJson(
        {
          error: SERVER_CONFIGURATION_PUBLIC_MESSAGE,
          code: SERVER_CONFIGURATION_ERROR_CODE,
        },
        { status: 503 }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    const isTotvsOffline =
      /status 5\d{2}/.test(errorMessage) ||
      errorMessage.toLowerCase().includes('fetch');

    if (isTotvsOffline) {
      return privateJson(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 }
      );
    }

    return privateJson(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
