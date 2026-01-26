import { NextResponse } from 'next/server';
import { clearCredentials } from '@/lib/storage';

export async function POST() {
  try {
    await clearCredentials();
    return NextResponse.json({ success: true, message: 'Credenciais limpas' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao limpar' },
      { status: 500 }
    );
  }
}
