import { NextResponse } from 'next/server';
import { getSession, getExternalCookies } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        hasSession: false,
        message: 'Sessão não encontrada'
      });
    }

    const externalCookies = await getExternalCookies();

    return NextResponse.json({
      hasSession: true,
      hasExternalCookies: externalCookies !== null,
      externalCookies: externalCookies ? {
        aspNetSessionId: externalCookies.aspNetSessionId ? 'Sim' : 'Não',
        aspxAuth: externalCookies.aspxAuth ? 'Sim' : 'Não',
        hasOtherCookies: Object.keys(externalCookies).length > 2
      } : null,
      lastExternalLoginAt: session.lastExternalLoginAt
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
