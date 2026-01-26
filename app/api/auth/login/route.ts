/**
 * POST /api/auth/login
 * Autentica usuário externamente e cria sessão interna
 */

import { NextRequest, NextResponse } from 'next/server';
import { performExternalLogin } from '@/lib/external-auth';
import { createSession, setRA } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codUsuario, senha } = body;

    if (!codUsuario || !senha) {
      return NextResponse.json(
        { error: 'CodUsuario e Senha são obrigatórios', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const externalCookies = await performExternalLogin({
      codUsuario,
      senha,
    });

    await createSession(externalCookies);

    // Salva o RA (codUsuario) na sessão
    await setRA(codUsuario);

    return NextResponse.json({ ok: true });
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
