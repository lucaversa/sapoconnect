import { NextResponse } from 'next/server';
import { hasStoredCredentials, getCredentials } from '@/lib/storage';

export async function GET() {
  try {
    const hasCreds = await hasStoredCredentials();

    if (!hasCreds) {
      return NextResponse.json({
        hasCredentials: false,
        message: 'Nenhuma credencial armazenada'
      });
    }

    const creds = await getCredentials();

    return NextResponse.json({
      hasCredentials: true,
      codUsuario: creds?.codUsuario || 'N/A',
      senhaLength: creds?.senha?.length || 0
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
