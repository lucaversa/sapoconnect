import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/lite-targets', () => ({
  LITE_TARGET_RAS: ['SYNTH-A.00001', 'SYNTH-B.00001', 'SYNTH-B.00002'],
}));

const cookieMocks = vi.hoisted(() => {
  const jar = new Map<string, string>();
  return {
    jar,
    store: {
      get: vi.fn((name: string) => {
        const value = jar.get(name);
        return value ? { name, value } : undefined;
      }),
      set: vi.fn((name: string, value: string) => {
        jar.set(name, value);
      }),
    },
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieMocks.store),
}));

import { LITE_DAILY_LIMIT_MS, LITE_RUN_LEASE_MS, LITE_TARGET_RAS } from '@/lib/lite-policy';
import {
  getLiteAccessSnapshotForRa,
  LITE_USAGE_COOKIE_NAME,
  readLiteUsageCookie,
  updateLiteAccessForRa,
} from '@/lib/server/lite-usage';

const originalEnv = { ...process.env };

describe('Lite usage cookie ledger', () => {
  beforeEach(() => {
    cookieMocks.jar.clear();
    vi.clearAllMocks();
    process.env.SESSION_ENCRYPTION_KEYS = `lite-test:${'62'.repeat(32)}`;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it.each(LITE_TARGET_RAS)('requires start once, then heartbeats persist only elapsed foreground time for %s', async (ra) => {
    const startedAt = Date.parse('2026-09-01T15:00:00.000Z');

    for (const action of ['resume', 'heartbeat', 'pause'] as const) {
      await expect(updateLiteAccessForRa(ra, action, startedAt)).resolves.toMatchObject({
        state: 'intro',
        running: false,
      });
    }
    expect(cookieMocks.store.set).not.toHaveBeenCalled();

    const started = await updateLiteAccessForRa(ra, 'start', startedAt);
    const heartbeat = await updateLiteAccessForRa(ra, 'heartbeat', startedAt + 1_000);
    const duplicateStart = await updateLiteAccessForRa(ra, 'start', startedAt + 2_000);

    expect(started).toMatchObject({
      state: 'active',
      startedAt,
      consumedMs: 0,
      remainingMs: LITE_DAILY_LIMIT_MS,
      running: true,
      leaseUntil: startedAt + LITE_RUN_LEASE_MS,
    });
    expect(heartbeat).toMatchObject({
      state: 'active',
      consumedMs: 1_000,
      remainingMs: 179_000,
      running: true,
    });
    expect(duplicateStart).toMatchObject({
      state: 'active',
      startedAt,
      consumedMs: 2_000,
      remainingMs: 178_000,
      running: true,
    });
    expect(cookieMocks.store.set).toHaveBeenCalledTimes(3);
  });

  it.each(LITE_TARGET_RAS)('pauses for hours without consuming and resumes the same daily balance for %s', async (ra) => {
    const startedAt = Date.parse('2026-09-01T12:00:00.000Z');

    await updateLiteAccessForRa(ra, 'start', startedAt);
    const paused = await updateLiteAccessForRa(ra, 'pause', startedAt + 1_250);
    const hoursLater = startedAt + 6 * 60 * 60_000;
    const stillPaused = await getLiteAccessSnapshotForRa(ra, hoursLater);
    const resumed = await updateLiteAccessForRa(ra, 'resume', hoursLater);
    const pausedAgain = await updateLiteAccessForRa(ra, 'pause', hoursLater + 750);

    expect(paused).toMatchObject({
      state: 'active',
      consumedMs: 1_250,
      remainingMs: 178_750,
      running: false,
      leaseUntil: null,
    });
    expect(stillPaused).toMatchObject({
      consumedMs: 1_250,
      remainingMs: 178_750,
      running: false,
    });
    expect(resumed).toMatchObject({
      consumedMs: 1_250,
      remainingMs: 178_750,
      running: true,
    });
    expect(pausedAgain).toMatchObject({
      consumedMs: 2_000,
      remainingMs: 178_000,
      running: false,
    });
  });

  it('caps abrupt-close consumption at the short lease until an explicit resume', async () => {
    const ra = 'SYNTH-A.00001';
    const startedAt = Date.parse('2026-09-01T15:00:00.000Z');

    await updateLiteAccessForRa(ra, 'start', startedAt);
    const afterLease = await getLiteAccessSnapshotForRa(ra, startedAt + 30_000);
    const muchLater = await getLiteAccessSnapshotForRa(ra, startedAt + 2 * 60 * 60_000);
    const resumed = await updateLiteAccessForRa(ra, 'resume', startedAt + 2 * 60 * 60_000);

    expect(afterLease).toMatchObject({
      state: 'active',
      consumedMs: LITE_RUN_LEASE_MS,
      remainingMs: LITE_DAILY_LIMIT_MS - LITE_RUN_LEASE_MS,
      running: false,
    });
    expect(muchLater).toMatchObject({
      consumedMs: LITE_RUN_LEASE_MS,
      remainingMs: LITE_DAILY_LIMIT_MS - LITE_RUN_LEASE_MS,
      running: false,
    });
    expect(resumed).toMatchObject({
      consumedMs: LITE_RUN_LEASE_MS,
      running: true,
    });
  });

  it('locks after 180 seconds of accumulated leased runs', async () => {
    const ra = 'SYNTH-A.00001';
    const startedAt = Date.parse('2026-09-01T15:00:00.000Z');
    await updateLiteAccessForRa(ra, 'start', startedAt);

    for (
      let elapsed = LITE_RUN_LEASE_MS;
      elapsed <= LITE_DAILY_LIMIT_MS;
      elapsed += LITE_RUN_LEASE_MS
    ) {
      await updateLiteAccessForRa(ra, 'heartbeat', startedAt + elapsed);
    }

    await expect(
      getLiteAccessSnapshotForRa(ra, startedAt + LITE_DAILY_LIMIT_MS)
    ).resolves.toMatchObject({
      state: 'locked',
      consumedMs: LITE_DAILY_LIMIT_MS,
      remainingMs: 0,
      running: false,
    });
    await expect(
      updateLiteAccessForRa(ra, 'start', startedAt + LITE_DAILY_LIMIT_MS + 1)
    ).resolves.toMatchObject({ state: 'locked', remainingMs: 0 });
  });

  it('keeps independent daily records for both target RAs', async () => {
    const firstAt = Date.parse('2026-09-01T15:00:00.000Z');
    const secondAt = firstAt + 1_000;

    await updateLiteAccessForRa('SYNTH-A.00001', 'start', firstAt);
    await updateLiteAccessForRa('SYNTH-A.00001', 'pause', firstAt + 500);
    await updateLiteAccessForRa('SYNTH-B.00001', 'start', secondAt);

    await expect(
      getLiteAccessSnapshotForRa('SYNTH-A.00001', secondAt)
    ).resolves.toMatchObject({ state: 'active', consumedMs: 500, running: false });
    await expect(
      getLiteAccessSnapshotForRa('SYNTH-B.00001', secondAt)
    ).resolves.toMatchObject({ state: 'active', consumedMs: 0, running: true });
  });

  it('caps today at midnight, then requires a fresh start after the reset', async () => {
    const ra = 'SYNTH-A.00001';
    const beforeMidnight = Date.parse('2026-09-02T02:59:58.000Z');
    const afterMidnight = Date.parse('2026-09-02T03:00:00.000Z');

    await expect(
      updateLiteAccessForRa(ra, 'start', beforeMidnight)
    ).resolves.toMatchObject({
      state: 'active',
      remainingMs: 2_000,
      expiresAt: afterMidnight,
      leaseUntil: afterMidnight,
      running: true,
    });
    await expect(getLiteAccessSnapshotForRa(ra, afterMidnight)).resolves.toMatchObject({
      state: 'intro',
      consumedMs: 0,
      remainingMs: LITE_DAILY_LIMIT_MS,
      running: false,
    });
    await expect(updateLiteAccessForRa(ra, 'resume', afterMidnight)).resolves.toMatchObject({
      state: 'intro',
      running: false,
    });
    await expect(updateLiteAccessForRa(ra, 'start', afterMidnight)).resolves.toMatchObject({
      state: 'active',
      startedAt: afterMidnight,
      running: true,
    });
  });

  it('fails closed on tampering and repairs the ledger as locked for the current day', async () => {
    const ra = 'SYNTH-B.00001';
    const now = Date.parse('2026-09-01T15:00:00.000Z');
    cookieMocks.jar.set(LITE_USAGE_COOKIE_NAME, 'tampered');

    await expect(getLiteAccessSnapshotForRa(ra, now)).resolves.toMatchObject({
      state: 'locked',
      consumedMs: LITE_DAILY_LIMIT_MS,
      remainingMs: 0,
    });
    const repaired = await getLiteAccessSnapshotForRa(ra, now, { repairInvalid: true });
    expect(repaired).toMatchObject({ state: 'locked', remainingMs: 0 });

    const stored = readLiteUsageCookie(cookieMocks.jar.get(LITE_USAGE_COOKIE_NAME));
    expect(stored.integrity).toBe('valid');
    await expect(getLiteAccessSnapshotForRa('SYNTH-A.00001', now)).resolves.toMatchObject({
      state: 'locked',
      remainingMs: 0,
    });
    await expect(updateLiteAccessForRa(ra, 'resume', now + 1_000)).resolves.toMatchObject({
      state: 'locked',
      running: false,
    });
  });

  it('never creates or reads a Lite ledger for a full account', async () => {
    cookieMocks.jar.set(LITE_USAGE_COOKIE_NAME, 'tampered');
    await expect(
      updateLiteAccessForRa('SYNTH-A.00000', 'start', Date.now())
    ).resolves.toMatchObject({ tier: 'full', state: 'full' });
    expect(cookieMocks.store.get).not.toHaveBeenCalled();
    expect(cookieMocks.store.set).not.toHaveBeenCalled();
  });
});
