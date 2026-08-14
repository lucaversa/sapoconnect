/**
 * POST /api/auth/logout
 * Destrói sessão interna do app
 * Cliente deve limpar credenciais locais se necessário
 */

import { destroySession } from '@/lib/session';
import { privateJson } from '@/lib/server/http';
import { guardSameOriginRequest, RequestGuardError } from '@/lib/server/request-guard';

export async function POST(request: Request) {
  try {
    guardSameOriginRequest(request);
    await destroySession();

    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return privateJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return privateJson(
      { error: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
