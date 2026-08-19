import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  getCommunityPulse: vi.fn(),
}));

vi.mock('@/lib/server/community-analytics', () => mocks);
vi.mock('@/lib/community-pulse-schedule', () => ({
  getCommunityPulseSchedule: () => ({
    cacheKey: '2026-08-19T05',
    snapshotAt: new Date('2026-08-19T08:00:00.000Z'),
    nextRefreshAt: new Date('2026-08-19T10:00:00.000Z'),
    secondsUntilNextRefresh: 7_200,
  }),
}));

import { GET } from '@/app/api/community/pulse/route';

describe('community pulse route', () => {
  it('serves one public aggregate snapshot until the next scheduled window', async () => {
    mocks.getCommunityPulse.mockResolvedValueOnce({ available: false });
    const response = await GET();

    expect(await response.json()).toEqual({ available: false });
    expect(mocks.getCommunityPulse).toHaveBeenCalledWith(new Date('2026-08-19T08:00:00.000Z'));
    expect(response.headers.get('cache-control')).toContain('max-age=300');
    expect(response.headers.get('cache-control')).toContain('s-maxage=7200');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=300');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=7200');
  });

  it('rechecks a provisional zero after ten minutes', async () => {
    mocks.getCommunityPulse.mockResolvedValueOnce({
      available: true,
      todayVisitors: 0,
      weekPageviews: 4_030,
      topPage: null,
      updatedAt: '2026-08-19T08:45:00.000Z',
    });

    const response = await GET();

    expect(response.headers.get('cache-control')).toContain('s-maxage=600');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=600');
  });

  it('keeps a valid count shared until the scheduled refresh', async () => {
    mocks.getCommunityPulse.mockResolvedValueOnce({
      available: true,
      todayVisitors: 18,
      weekPageviews: 4_030,
      topPage: null,
      updatedAt: '2026-08-19T08:45:00.000Z',
    });

    const response = await GET();

    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=7200');
  });
});
