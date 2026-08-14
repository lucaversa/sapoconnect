import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/community-analytics', () => ({
  getCommunityPulse: vi.fn(async () => ({ available: false })),
}));

import { GET } from '@/app/api/community/pulse/route';

describe('community pulse route', () => {
  it('serves only public aggregate data through long CDN caching', async () => {
    const response = await GET();

    expect(await response.json()).toEqual({ available: false });
    expect(response.headers.get('cache-control')).toContain('s-maxage=21600');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=86400');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=21600');
  });
});
