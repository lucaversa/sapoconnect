import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildCommunityPulse } from '@/lib/server/community-analytics';

describe('community pulse aggregation', () => {
  it('sums weekly page views and maps the most visited app page', () => {
    const pulse = buildCommunityPulse(
      { data: { visitors: 18, pageviews: 72 } },
      {
        data: [
          { requestPath: '/app/calendario', pageviews: 120 },
          { requestPath: '/app/faltas', pageviews: 80 },
          { requestPath: 'Others', pageviews: 25 },
        ],
      },
      '2026-08-14T12:00:00.000Z'
    );

    expect(pulse).toEqual({
      available: true,
      todayVisitors: 18,
      weekPageviews: 225,
      topPage: {
        label: 'Horários',
        path: '/app/calendario',
        pageviews: 120,
      },
      updatedAt: '2026-08-14T12:00:00.000Z',
    });
  });

  it('fails closed when Vercel returns an unexpected schema', () => {
    expect(buildCommunityPulse({}, { data: null })).toEqual({ available: false });
    expect(buildCommunityPulse({ data: { visitors: -1 } }, { data: [] })).toEqual({ available: false });
  });
});
