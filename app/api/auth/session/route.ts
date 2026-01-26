/**
 * GET /api/auth/session
 * Verifica se existe sessão ativa
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { authenticated: false, code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    const sessionAge = Date.now() - session.lastExternalLoginAt;
    const SESSION_TTL = 20 * 60 * 1000;

    if (sessionAge > SESSION_TTL) {
      return NextResponse.json(
        { authenticated: false, code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      lastExternalLoginAt: session.lastExternalLoginAt,
      ra: session.ra || null,
    });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
