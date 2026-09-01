export const LITE_TARGET_RAS = [
  'SYNTH-RA-0005',
  'SYNTH-RA-0006',
] as const;

export type LiteTargetRa = (typeof LITE_TARGET_RAS)[number];
export type LiteAccessTier = 'full' | 'lite';
export type LiteAccessState = 'full' | 'intro' | 'active' | 'locked';
export type LiteLedgerIntegrity = 'missing' | 'valid' | 'invalid';

export const LITE_DAILY_LIMIT_MS = 3 * 60 * 1_000;
export const LITE_RUN_LEASE_MS = 3_000;
export const LITE_TIME_ZONE = 'America/Sao_Paulo';

export interface LiteUsageRecord {
  day: string;
  startedAt: number;
  consumedMs: number;
  runStartedAt: number | null;
  leaseUntil: number | null;
  locked: boolean;
}

export interface LiteAccessSnapshot {
  tier: LiteAccessTier;
  state: LiteAccessState;
  serverNow: number;
  startedAt: number | null;
  expiresAt: number | null;
  consumedMs: number;
  remainingMs: number;
  running: boolean;
  leaseUntil: number | null;
  resetAt: number;
}

const TARGET_RA_SET = new Set<string>(LITE_TARGET_RAS);
const DAY_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: LITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isLiteTargetRa(ra: string | null | undefined): ra is LiteTargetRa {
  return typeof ra === 'string' && TARGET_RA_SET.has(ra);
}

function zonedDateParts(timestamp: number): ZonedDateParts {
  const values = new Map(
    DAY_PARTS_FORMATTER
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.get('year')!,
    month: values.get('month')!,
    day: values.get('day')!,
    hour: values.get('hour')!,
    minute: values.get('minute')!,
    second: values.get('second')!,
  };
}

function zonedDateTimeToEpoch(parts: ZonedDateParts): number {
  const desiredAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let candidate = desiredAsUtc;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = zonedDateParts(candidate);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const correction = desiredAsUtc - actualAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return candidate;
}

export function getLiteDayKey(timestamp: number): string {
  const { year, month, day } = zonedDateParts(timestamp);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getLiteDayStartAt(timestamp: number): number {
  const { year, month, day } = zonedDateParts(timestamp);
  return zonedDateTimeToEpoch({ year, month, day, hour: 0, minute: 0, second: 0 });
}

export function getLiteResetAt(timestamp: number): number {
  const { year, month, day } = zonedDateParts(timestamp);
  const nextCalendarDay = new Date(Date.UTC(year, month - 1, day + 1));

  return zonedDateTimeToEpoch({
    year: nextCalendarDay.getUTCFullYear(),
    month: nextCalendarDay.getUTCMonth() + 1,
    day: nextCalendarDay.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  });
}

export function createLiteUsageRecord(
  timestamp: number,
  locked = false
): LiteUsageRecord {
  return {
    day: getLiteDayKey(timestamp),
    startedAt: timestamp,
    consumedMs: locked ? LITE_DAILY_LIMIT_MS : 0,
    runStartedAt: null,
    leaseUntil: null,
    locked,
  };
}

function activeRunElapsed(record: LiteUsageRecord, serverNow: number): number {
  if (record.runStartedAt === null || record.leaseUntil === null) return 0;
  const runEnd = Math.min(serverNow, record.leaseUntil, getLiteResetAt(record.startedAt));
  return Math.max(0, runEnd - record.runStartedAt);
}

export function getEffectiveLiteConsumedMs(
  record: LiteUsageRecord,
  serverNow: number
): number {
  return Math.min(
    LITE_DAILY_LIMIT_MS,
    record.consumedMs + activeRunElapsed(record, serverNow)
  );
}

export function settleLiteUsageRecord(
  record: LiteUsageRecord,
  serverNow: number
): LiteUsageRecord {
  return {
    ...record,
    consumedMs: getEffectiveLiteConsumedMs(record, serverNow),
    runStartedAt: null,
    leaseUntil: null,
  };
}

export function resumeLiteUsageRecord(
  record: LiteUsageRecord,
  serverNow: number
): LiteUsageRecord {
  const settled = settleLiteUsageRecord(record, serverNow);
  const remainingMs = LITE_DAILY_LIMIT_MS - settled.consumedMs;
  if (
    settled.locked ||
    remainingMs <= 0 ||
    settled.day !== getLiteDayKey(serverNow)
  ) {
    return settled;
  }

  return {
    ...settled,
    runStartedAt: serverNow,
    leaseUntil: Math.min(
      serverNow + LITE_RUN_LEASE_MS,
      serverNow + remainingMs,
      getLiteResetAt(serverNow)
    ),
  };
}

export function isLiteUsageRecord(value: unknown): value is LiteUsageRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LiteUsageRecord>;
  const runStartedAt = record.runStartedAt;
  const leaseUntil = record.leaseUntil;

  return (
    typeof record.day === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.day) &&
    Number.isSafeInteger(record.startedAt) &&
    Number.isSafeInteger(record.consumedMs) &&
    record.startedAt! >= 0 &&
    record.consumedMs! >= 0 &&
    record.consumedMs! <= LITE_DAILY_LIMIT_MS &&
    typeof record.locked === 'boolean' &&
    record.day === getLiteDayKey(record.startedAt!) &&
    (runStartedAt === null || Number.isSafeInteger(runStartedAt)) &&
    (leaseUntil === null || Number.isSafeInteger(leaseUntil)) &&
    ((runStartedAt === null && leaseUntil === null) ||
      (typeof runStartedAt === 'number' &&
        typeof leaseUntil === 'number' &&
        runStartedAt >= record.startedAt! &&
        leaseUntil > runStartedAt &&
        leaseUntil - runStartedAt <= LITE_RUN_LEASE_MS &&
        record.day === getLiteDayKey(runStartedAt))) &&
    (!record.locked || record.consumedMs === LITE_DAILY_LIMIT_MS)
  );
}

export function evaluateLiteAccess(
  ra: string | null | undefined,
  record: LiteUsageRecord | null,
  integrity: LiteLedgerIntegrity,
  serverNow = Date.now()
): LiteAccessSnapshot {
  const resetAt = getLiteResetAt(serverNow);

  if (!isLiteTargetRa(ra)) {
    return {
      tier: 'full',
      state: 'full',
      serverNow,
      startedAt: null,
      expiresAt: null,
      consumedMs: 0,
      remainingMs: 0,
      running: false,
      leaseUntil: null,
      resetAt,
    };
  }

  if (integrity === 'invalid') {
    return {
      tier: 'lite',
      state: 'locked',
      serverNow,
      startedAt: null,
      expiresAt: null,
      consumedMs: LITE_DAILY_LIMIT_MS,
      remainingMs: 0,
      running: false,
      leaseUntil: null,
      resetAt,
    };
  }

  if (!record || record.day !== getLiteDayKey(serverNow)) {
    return {
      tier: 'lite',
      state: 'intro',
      serverNow,
      startedAt: null,
      expiresAt: null,
      consumedMs: 0,
      remainingMs: LITE_DAILY_LIMIT_MS,
      running: false,
      leaseUntil: null,
      resetAt,
    };
  }

  const consumedMs = getEffectiveLiteConsumedMs(record, serverNow);
  const remainingMs = Math.max(
    0,
    Math.min(LITE_DAILY_LIMIT_MS - consumedMs, resetAt - serverNow)
  );
  const state: LiteAccessState = record.locked || remainingMs === 0 ? 'locked' : 'active';
  const running =
    state === 'active' &&
    record.runStartedAt !== null &&
    record.runStartedAt <= serverNow &&
    record.leaseUntil !== null &&
    record.leaseUntil > serverNow;

  return {
    tier: 'lite',
    state,
    serverNow,
    startedAt: record.startedAt,
    expiresAt: running ? serverNow + remainingMs : null,
    consumedMs,
    remainingMs: state === 'active' ? remainingMs : 0,
    running,
    leaseUntil: running ? record.leaseUntil : null,
    resetAt,
  };
}
