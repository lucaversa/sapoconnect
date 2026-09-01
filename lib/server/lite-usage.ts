import 'server-only';

import { cookies } from 'next/headers';

import {
  createLiteUsageRecord,
  evaluateLiteAccess,
  getLiteDayKey,
  isLiteTargetRa,
  isLiteUsageRecord,
  LITE_TARGET_RAS,
  resumeLiteUsageRecord,
  settleLiteUsageRecord,
  type LiteAccessSnapshot,
  type LiteLedgerIntegrity,
  type LiteTargetRa,
  type LiteUsageRecord,
} from '@/lib/lite-policy';
import {
  decryptSessionData,
  deserializeSessionData,
  encryptSessionData,
  serializeSessionData,
} from '@/lib/session-encryption';
import { getSession } from '@/lib/session';
import { ServerConfigurationError } from '@/lib/server/configuration-error';

export const LITE_USAGE_COOKIE_NAME = 'sapoconnect_lite_usage';

const LITE_USAGE_COOKIE_MAX_AGE_SECONDS = 8 * 24 * 60 * 60;
const MAX_COOKIE_VALUE_BYTES = 3_800;
const TARGET_RA_SET = new Set<string>(LITE_TARGET_RAS);

interface LiteUsageLedger {
  version: 1;
  records: Partial<Record<LiteTargetRa, LiteUsageRecord>>;
}

export interface LiteUsageCookieRead {
  integrity: LiteLedgerIntegrity;
  ledger: LiteUsageLedger | null;
}

export type LiteUsageAction = 'start' | 'resume' | 'heartbeat' | 'pause';

const liteCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  priority: 'high' as const,
  maxAge: LITE_USAGE_COOKIE_MAX_AGE_SECONDS,
  path: '/',
};

function emptyLedger(): LiteUsageLedger {
  return { version: 1, records: {} };
}

function lockedLedger(serverNow: number): LiteUsageLedger {
  const ledger = emptyLedger();
  for (const ra of LITE_TARGET_RAS) {
    ledger.records[ra] = createLiteUsageRecord(serverNow, true);
  }
  return ledger;
}

function isLiteUsageLedger(value: unknown): value is LiteUsageLedger {
  if (!value || typeof value !== 'object') return false;
  const ledger = value as Partial<LiteUsageLedger>;
  if (
    ledger.version !== 1 ||
    !ledger.records ||
    typeof ledger.records !== 'object' ||
    Array.isArray(ledger.records)
  ) {
    return false;
  }

  return Object.entries(ledger.records).every(
    ([ra, record]) => TARGET_RA_SET.has(ra) && isLiteUsageRecord(record)
  );
}

function encodeLiteUsageLedger(ledger: LiteUsageLedger): string {
  const value = encryptSessionData(serializeSessionData(ledger), 'lite');
  if (Buffer.byteLength(value, 'utf8') > MAX_COOKIE_VALUE_BYTES) {
    throw new Error('Lite usage cookie exceeds safe size');
  }
  return value;
}

async function writeLiteUsageLedger(ledger: LiteUsageLedger): Promise<void> {
  const value = encodeLiteUsageLedger(ledger);
  (await cookies()).set(LITE_USAGE_COOKIE_NAME, value, liteCookieOptions);
}

export function readLiteUsageCookie(value: string | undefined): LiteUsageCookieRead {
  if (!value) return { integrity: 'missing', ledger: null };

  try {
    const ledger = deserializeSessionData<unknown>(decryptSessionData(value, 'lite'));
    return isLiteUsageLedger(ledger)
      ? { integrity: 'valid', ledger }
      : { integrity: 'invalid', ledger: null };
  } catch (error) {
    if (error instanceof ServerConfigurationError) throw error;
    return { integrity: 'invalid', ledger: null };
  }
}

export function getLiteAccessSnapshotFromCookie(
  ra: string | null | undefined,
  cookieValue: string | undefined,
  serverNow = Date.now()
): LiteAccessSnapshot {
  if (!isLiteTargetRa(ra)) {
    return evaluateLiteAccess(ra, null, 'missing', serverNow);
  }

  const usage = readLiteUsageCookie(cookieValue);
  const record = usage.ledger?.records[ra] ?? null;
  return evaluateLiteAccess(ra, record, usage.integrity, serverNow);
}

export async function getLiteAccessSnapshotForRa(
  ra: string | null | undefined,
  serverNow = Date.now(),
  options: { repairInvalid?: boolean } = {}
): Promise<LiteAccessSnapshot> {
  if (!isLiteTargetRa(ra)) {
    return evaluateLiteAccess(ra, null, 'missing', serverNow);
  }

  const cookieValue = (await cookies()).get(LITE_USAGE_COOKIE_NAME)?.value;
  const usage = readLiteUsageCookie(cookieValue);

  if (usage.integrity === 'invalid' && options.repairInvalid) {
    const ledger = lockedLedger(serverNow);
    await writeLiteUsageLedger(ledger);
    return evaluateLiteAccess(ra, ledger.records[ra]!, 'valid', serverNow);
  }

  return evaluateLiteAccess(
    ra,
    usage.ledger?.records[ra] ?? null,
    usage.integrity,
    serverNow
  );
}

export async function getCurrentLiteAccessSnapshot(
  serverNow = Date.now()
): Promise<LiteAccessSnapshot> {
  const session = await getSession();
  return getLiteAccessSnapshotForRa(session?.ra, serverNow);
}

export async function startLiteAccessForRa(
  ra: string | null | undefined,
  serverNow = Date.now()
): Promise<LiteAccessSnapshot> {
  return updateLiteAccessForRa(ra, 'start', serverNow);
}

export async function updateLiteAccessForRa(
  ra: string | null | undefined,
  action: LiteUsageAction,
  serverNow = Date.now()
): Promise<LiteAccessSnapshot> {
  if (!isLiteTargetRa(ra)) {
    return evaluateLiteAccess(ra, null, 'missing', serverNow);
  }

  const cookieValue = (await cookies()).get(LITE_USAGE_COOKIE_NAME)?.value;
  const usage = readLiteUsageCookie(cookieValue);
  const ledger = usage.integrity === 'valid' && usage.ledger
    ? usage.ledger
    : emptyLedger();
  const existing = ledger.records[ra];

  if (usage.integrity === 'invalid') {
    const repairedLedger = lockedLedger(serverNow);
    await writeLiteUsageLedger(repairedLedger);
    return evaluateLiteAccess(ra, repairedLedger.records[ra]!, 'valid', serverNow);
  }

  if (!existing || existing.day !== getLiteDayKey(serverNow)) {
    if (action !== 'start') {
      return evaluateLiteAccess(ra, null, 'valid', serverNow);
    }

    ledger.records[ra] = resumeLiteUsageRecord(createLiteUsageRecord(serverNow), serverNow);
    await writeLiteUsageLedger(ledger);
    return evaluateLiteAccess(ra, ledger.records[ra]!, 'valid', serverNow);
  }

  ledger.records[ra] = action === 'pause'
    ? settleLiteUsageRecord(existing, serverNow)
    : resumeLiteUsageRecord(existing, serverNow);
  await writeLiteUsageLedger(ledger);
  return evaluateLiteAccess(ra, ledger.records[ra]!, 'valid', serverNow);
}
