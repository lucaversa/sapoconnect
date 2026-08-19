import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildCommunityPulse, getSettledAnalyticsCutoff } from '@/lib/server/community-analytics';
import {
  COMMUNITY_PULSE_PROVISIONAL_STALE_TIME_MS,
  COMMUNITY_PULSE_STALE_TIME_MS,
  getCommunityPulseStaleTime,
} from '@/lib/community-pulse';

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

  it('leaves a settling margin without crossing midnight in São Paulo', () => {
    expect(getSettledAnalyticsCutoff(new Date('2026-08-19T12:00:00.000Z')).toISOString())
      .toBe('2026-08-19T11:45:00.000Z');
    expect(getSettledAnalyticsCutoff(new Date('2026-08-19T03:00:00.000Z')).toISOString())
      .toBe('2026-08-19T03:00:00.000Z');
  });

  it('treats a zero visitor count as provisional', () => {
    expect(getCommunityPulseStaleTime({
      available: true,
      todayVisitors: 0,
      weekPageviews: 4_030,
      topPage: null,
      updatedAt: '2026-08-19T12:00:00.000Z',
    })).toBe(COMMUNITY_PULSE_PROVISIONAL_STALE_TIME_MS);

    expect(getCommunityPulseStaleTime({
      available: true,
      todayVisitors: 1,
      weekPageviews: 4_030,
      topPage: null,
      updatedAt: '2026-08-19T12:00:00.000Z',
    })).toBe(COMMUNITY_PULSE_STALE_TIME_MS);
  });
});
