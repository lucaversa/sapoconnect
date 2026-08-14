import 'server-only';
import { NextResponse } from 'next/server';

export const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export function privateJson<T>(body: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(body, { ...init, headers: { ...PRIVATE_NO_STORE, ...(init?.headers ?? {}) } });
}

export function privateResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(PRIVATE_NO_STORE).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
