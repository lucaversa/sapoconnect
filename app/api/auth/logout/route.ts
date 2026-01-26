/**
 * POST /api/auth/logout
 * Destrói sessão interna do app
 * Cliente deve limpar credenciais locais se necessário
 */

import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
