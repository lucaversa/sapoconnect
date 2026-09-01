import type { LiteAccessSnapshot } from '@/lib/lite-policy';

export type LiteClockAnchor = {
  remainingMs: number;
  performanceNow: number;
};

export function createLiteClockAnchor(
  snapshot: LiteAccessSnapshot,
  performanceNow: number
): LiteClockAnchor {
  return {
    remainingMs: Math.max(0, snapshot.remainingMs),
    performanceNow,
  };
}

export function getLiteRemainingMs(anchor: LiteClockAnchor, performanceNow: number): number {
  return Math.max(0, anchor.remainingMs - Math.max(0, performanceNow - anchor.performanceNow));
}

export function formatLiteRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function isLiteAccessSnapshot(value: unknown): value is LiteAccessSnapshot {
  if (!value || typeof value !== 'object') return false;

  const snapshot = value as Partial<LiteAccessSnapshot>;
  return (
    (snapshot.tier === 'full' || snapshot.tier === 'lite') &&
    (snapshot.state === 'full' ||
      snapshot.state === 'intro' ||
      snapshot.state === 'active' ||
      snapshot.state === 'locked') &&
    typeof snapshot.serverNow === 'number' &&
    Number.isFinite(snapshot.serverNow) &&
    (snapshot.startedAt === null ||
      (typeof snapshot.startedAt === 'number' && Number.isFinite(snapshot.startedAt))) &&
    (snapshot.expiresAt === null ||
      (typeof snapshot.expiresAt === 'number' && Number.isFinite(snapshot.expiresAt))) &&
    typeof snapshot.consumedMs === 'number' &&
    Number.isFinite(snapshot.consumedMs) &&
    typeof snapshot.remainingMs === 'number' &&
    Number.isFinite(snapshot.remainingMs) &&
    typeof snapshot.running === 'boolean' &&
    (snapshot.leaseUntil === null ||
      (typeof snapshot.leaseUntil === 'number' && Number.isFinite(snapshot.leaseUntil))) &&
    typeof snapshot.resetAt === 'number' &&
    Number.isFinite(snapshot.resetAt)
  );
}
