import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isLiteTargetRa } from '@/lib/lite-policy';
import {
  getLiteAccessSnapshotFromCookie,
  LITE_USAGE_COOKIE_NAME,
} from '@/lib/server/lite-usage';
import { readSessionCookie, SESSION_COOKIE_NAME } from '@/lib/session';

function isLiteControlPath(pathname: string): boolean {
  return pathname === '/api/lite' || pathname.startsWith('/api/lite/');
}

function isAuthenticationPath(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

function blockedResponse(
  state: 'intro' | 'paused' | 'locked',
  resetAt: number
): NextResponse {
  const intro = state === 'intro';
  const paused = state === 'paused';
  return NextResponse.json(
    {
      error: intro
        ? 'Inicie seu tempo diário do SapoConnect Lite.'
        : paused
          ? 'Retome o SapoConnect Lite para continuar.'
          : 'Seu tempo diário do SapoConnect Lite acabou.',
      code: intro
        ? 'LITE_START_REQUIRED'
        : paused
          ? 'LITE_RESUME_REQUIRED'
          : 'LITE_TIME_EXPIRED',
      resetAt,
    },
    {
      status: state === 'locked' ? 403 : 428,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Vercel-CDN-Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Vary: 'Cookie',
      },
    }
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isAuthenticationPath(pathname) || isLiteControlPath(pathname)) {
    return NextResponse.next();
  }

  const session = readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!isLiteTargetRa(session?.ra)) return NextResponse.next();

  const snapshot = getLiteAccessSnapshotFromCookie(
    session.ra,
    request.cookies.get(LITE_USAGE_COOKIE_NAME)?.value
  );
  if (snapshot.state === 'active' && snapshot.running) return NextResponse.next();

  return blockedResponse(
    snapshot.state === 'intro'
      ? 'intro'
      : snapshot.state === 'active'
        ? 'paused'
        : 'locked',
    snapshot.resetAt
  );
}

export const config = {
  matcher: '/api/:path*',
};
