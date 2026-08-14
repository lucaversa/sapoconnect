import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { privateJson } from '@/lib/server/http';

describe('private API responses', () => {
  it('prevents browser and Vercel CDN storage and varies by cookie', () => {
    const response = privateJson({ ok: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('vary')).toBe('Cookie');
  });
});
