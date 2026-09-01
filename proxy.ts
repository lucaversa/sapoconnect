import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isOwn3dTargetRa } from '@/lib/own3d-target';
import { readSessionCookie, SESSION_COOKIE_NAME } from '@/lib/session';

const SESSION_MUTATION_PATHS = new Set(['/api/auth/login', '/api/auth/logout']);

export function proxy(request: NextRequest) {
  if (SESSION_MUTATION_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!isOwn3dTargetRa(session?.ra)) return NextResponse.next();

  return NextResponse.json(
    { error: 'Acesso indisponível.', code: 'OWN3D_ACCESS_BLOCKED' },
    {
      status: 403,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    }
  );
}

export const config = {
  matcher: '/api/:path*',
};
