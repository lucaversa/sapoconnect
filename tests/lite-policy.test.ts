import { describe, expect, it } from 'vitest';

import {
  createLiteUsageRecord,
  evaluateLiteAccess,
  getLiteDayKey,
  getLiteDayStartAt,
  getLiteResetAt,
  isLiteTargetRa,
  LITE_DAILY_LIMIT_MS,
  LITE_RUN_LEASE_MS,
  LITE_TARGET_RAS,
  resumeLiteUsageRecord,
  settleLiteUsageRecord,
} from '@/lib/lite-policy';

describe('SapoConnect Lite policy', () => {
  it('targets only the three exact requested RAs', () => {
    expect(LITE_TARGET_RAS).toEqual(['SYNTH-RA-0005', 'SYNTH-RA-0006', 'SYNTH-RA-0009']);

    for (const ra of LITE_TARGET_RAS) expect(isLiteTargetRa(ra)).toBe(true);
    for (const ra of [
      'SYNTH-RA-0004',
      'SYNTH-RA-0007',
      'SYNTH-RA-0008',
      'SYNTH-RA-0010',
      'SYNTH-RA-0009',
      ' SYNTH-RA-0009 ',
      'SYNTH-RA-0005',
      'SYNTH-RA-0006',
      ' SYNTH-RA-0005 ',
      null,
      undefined,
    ]) {
      expect(isLiteTargetRa(ra)).toBe(false);
    }
  });

  it('uses midnight in America/Sao_Paulo as the daily boundary', () => {
    const beforeMidnight = Date.parse('2026-09-02T02:59:59.999Z');
    const afterMidnight = Date.parse('2026-09-02T03:00:00.000Z');

    expect(getLiteDayKey(beforeMidnight)).toBe('2026-09-01');
    expect(getLiteDayKey(afterMidnight)).toBe('2026-09-02');
    expect(getLiteResetAt(beforeMidnight)).toBe(afterMidnight);
    expect(getLiteDayStartAt(afterMidnight)).toBe(afterMidnight);
  });

  it('moves a Lite account from intro to a server-leased active run', () => {
    const ra = 'SYNTH-RA-0005';
    const startedAt = Date.parse('2026-09-01T15:00:00.000Z');

    expect(evaluateLiteAccess(ra, null, 'missing', startedAt)).toMatchObject({
      tier: 'lite',
      state: 'intro',
      remainingMs: LITE_DAILY_LIMIT_MS,
    });

    const record = resumeLiteUsageRecord(createLiteUsageRecord(startedAt), startedAt);
    expect(evaluateLiteAccess(ra, record, 'valid', startedAt + 1_000)).toMatchObject({
      state: 'active',
      startedAt,
      consumedMs: 1_000,
      remainingMs: 179_000,
      running: true,
      leaseUntil: startedAt + LITE_RUN_LEASE_MS,
    });
    expect(
      evaluateLiteAccess(ra, record, 'valid', startedAt + LITE_RUN_LEASE_MS)
    ).toMatchObject({
      state: 'active',
      consumedMs: LITE_RUN_LEASE_MS,
      remainingMs: LITE_DAILY_LIMIT_MS - LITE_RUN_LEASE_MS,
      running: false,
    });
  });

  it('settles a run at the lease and pauses without charging background time', () => {
    const startedAt = Date.parse('2026-09-01T15:00:00.000Z');
    const running = resumeLiteUsageRecord(createLiteUsageRecord(startedAt), startedAt);
    const paused = settleLiteUsageRecord(running, startedAt + 1_250);

    expect(paused).toMatchObject({
      consumedMs: 1_250,
      runStartedAt: null,
      leaseUntil: null,
    });
    expect(
      evaluateLiteAccess('SYNTH-RA-0005', paused, 'valid', startedAt + 8 * 60 * 60_000)
    ).toMatchObject({
      state: 'active',
      consumedMs: 1_250,
      remainingMs: LITE_DAILY_LIMIT_MS - 1_250,
      running: false,
    });
  });

  it('resets an old record on the next Sao Paulo calendar day', () => {
    const ra = 'SYNTH-RA-0006';
    const startedAt = Date.parse('2026-09-02T02:59:30.000Z');
    const record = resumeLiteUsageRecord(createLiteUsageRecord(startedAt), startedAt);

    expect(evaluateLiteAccess(ra, record, 'valid', startedAt)).toMatchObject({
      state: 'active',
      remainingMs: 30_000,
      expiresAt: Date.parse('2026-09-02T03:00:00.000Z'),
      running: true,
    });
    expect(
      evaluateLiteAccess(ra, record, 'valid', Date.parse('2026-09-02T03:00:00.000Z'))
    ).toMatchObject({
      state: 'intro',
      remainingMs: LITE_DAILY_LIMIT_MS,
    });
  });

  it('fails a Lite account closed for an invalid ledger without affecting full accounts', () => {
    expect(evaluateLiteAccess('SYNTH-RA-0005', null, 'invalid', 1_788_000_000_000)).toMatchObject({
      tier: 'lite',
      state: 'locked',
      remainingMs: 0,
    });
    expect(evaluateLiteAccess('SYNTH-RA-0004', null, 'invalid', 1_788_000_000_000)).toMatchObject({
      tier: 'full',
      state: 'full',
    });
  });
});
