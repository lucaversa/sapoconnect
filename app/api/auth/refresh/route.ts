/**
 * POST /api/auth/refresh
 * Renova cookies externos (reautentica no sistema externo)
 * Pode receber credenciais no body (para auto-login) ou usar sessão existente
 */

import { NextRequest, NextResponse } from 'next/server';
import { performExternalLogin } from '@/lib/external-auth';
import { getSession, updateSessionCookies, createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codUsuario, senha } = body;

    if (codUsuario && senha) {
      const externalCookies = await performExternalLogin({
        codUsuario,
        senha,
      });

      const session = await getSession();

      if (session) {
        await updateSessionCookies(externalCookies);
      } else {
        await createSession(externalCookies);
      }

      return NextResponse.json({ ok: true });
    }

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error:
          'Para refresh sem sessão ativa, forneça credenciais (codUsuario e senha)',
        code: 'BAD_REQUEST',
      },
      { status: 400 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    const isTotvsOffline =
      /status 5\d{2}/.test(errorMessage) ||
      errorMessage.toLowerCase().includes('fetch');

    if (isTotvsOffline) {
      return NextResponse.json(
        { error: 'Sistema da TOTVS possivelmente fora do ar.', code: 'TOTVS_OFFLINE' },
        { status: 503 }
      );
    }

    if (
      errorMessage.includes('External login failed') ||
      errorMessage.includes('Failed to extract')
    ) {
      return NextResponse.json(
        { error: 'Credenciais inválidas ou erro no login externo', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
