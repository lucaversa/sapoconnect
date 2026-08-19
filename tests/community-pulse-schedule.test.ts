import { describe, expect, it } from 'vitest';

import { getCommunityPulseSchedule } from '@/lib/community-pulse-schedule';

describe('community pulse schedule', () => {
  it('keeps the midnight snapshot until the 05h refresh in São Paulo', () => {
    const schedule = getCommunityPulseSchedule(new Date('2026-08-19T07:59:00.000Z'));

    expect(schedule.cacheKey).toBe('2026-08-19T00');
    expect(schedule.snapshotAt.toISOString()).toBe('2026-08-19T03:00:00.000Z');
    expect(schedule.nextRefreshAt.toISOString()).toBe('2026-08-19T08:00:00.000Z');
    expect(schedule.secondsUntilNextRefresh).toBe(60);
  });

  it('advances in two-hour windows after 05h', () => {
    const schedule = getCommunityPulseSchedule(new Date('2026-08-19T08:01:00.000Z'));

    expect(schedule.cacheKey).toBe('2026-08-19T05');
    expect(schedule.snapshotAt.toISOString()).toBe('2026-08-19T08:00:00.000Z');
    expect(schedule.nextRefreshAt.toISOString()).toBe('2026-08-19T10:00:00.000Z');
    expect(schedule.secondsUntilNextRefresh).toBe(7_140);
  });

  it('uses a final one-hour window from 23h to midnight', () => {
    const schedule = getCommunityPulseSchedule(new Date('2026-08-20T02:30:00.000Z'));

    expect(schedule.cacheKey).toBe('2026-08-19T23');
    expect(schedule.snapshotAt.toISOString()).toBe('2026-08-20T02:00:00.000Z');
    expect(schedule.nextRefreshAt.toISOString()).toBe('2026-08-20T03:00:00.000Z');
    expect(schedule.secondsUntilNextRefresh).toBe(1_800);
  });
});
