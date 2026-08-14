/**
 * GET /api/auth/session
 * Verifica se existe sessão ativa
 */

import { getSession } from '@/lib/session';
import { privateJson } from '@/lib/server/http';
import {
  ServerConfigurationError,
  SERVER_CONFIGURATION_ERROR_CODE,
  SERVER_CONFIGURATION_PUBLIC_MESSAGE,
} from '@/lib/server/configuration-error';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
        return privateJson(
        { authenticated: false, code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    const sessionAge = Date.now() - session.lastExternalLoginAt;
    const SESSION_TTL = 20 * 60 * 1000;

    if (sessionAge > SESSION_TTL) {
      return privateJson(
        { authenticated: false, code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    return privateJson({
      authenticated: true,
      lastExternalLoginAt: session.lastExternalLoginAt,
      ra: session.ra || null,
      cacheScope: session.cacheScope,
    });
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      console.error('[auth/session] Server configuration is incomplete:', error.message);
      return privateJson(
        {
          authenticated: false,
          error: SERVER_CONFIGURATION_PUBLIC_MESSAGE,
          code: SERVER_CONFIGURATION_ERROR_CODE,
        },
        { status: 503 }
      );
    }
    return privateJson(
      { authenticated: false, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
