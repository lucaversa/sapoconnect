import type { AcademicUpdatesState } from '@/lib/academic-updates'

export const ABSENCES_BACKGROUND_INTERVAL_MS = 4 * 60 * 60 * 1_000
export const EVALUATIONS_BACKGROUND_INTERVAL_MS = 6 * 60 * 60 * 1_000
export const EVALUATIONS_FULL_INTERVAL_MS = 24 * 60 * 60 * 1_000
export const HISTORY_BACKGROUND_INTERVAL_MS = 24 * 60 * 60 * 1_000
export const BACKGROUND_RECHECK_INTERVAL_MS = 30 * 60 * 1_000
export const BACKGROUND_LOCK_TTL_MS = 5 * 60 * 1_000
export const BACKGROUND_MAX_JITTER_MS = 2 * 60 * 1_000

export interface AcademicBackgroundPlan {
  absencesDue: boolean
  evaluationsMode: 'batch' | 'full' | null
  historyDue: boolean
}

function elapsed(now: number, previous: number | undefined): number {
  if (!previous) return Number.POSITIVE_INFINITY
  return Math.max(0, now - previous)
}

export function getAcademicBackgroundPlan(
  state: AcademicUpdatesState,
  now: number,
): AcademicBackgroundPlan {
  const evaluationSnapshotExists = Boolean(state.snapshots.avaliacoes)
  const evaluationFullSync = state.lastFullSyncAt?.avaliacoes ?? 0
  const evaluationsMode = !evaluationSnapshotExists
    || elapsed(now, evaluationFullSync) >= EVALUATIONS_FULL_INTERVAL_MS
    ? 'full'
    : elapsed(now, state.lastSuccessfulSyncAt.avaliacoes) >= EVALUATIONS_BACKGROUND_INTERVAL_MS
      ? 'batch'
      : null

  return {
    absencesDue: elapsed(now, state.lastSuccessfulSyncAt.faltas) >= ABSENCES_BACKGROUND_INTERVAL_MS,
    evaluationsMode,
    // A heavy evaluation sweep and history never compete in the same cycle.
    historyDue: evaluationsMode === null
      && elapsed(now, state.lastSuccessfulSyncAt.historico) >= HISTORY_BACKGROUND_INTERVAL_MS,
  }
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getBackgroundStartJitter(cacheScope: string, now: number): number {
  const bucket = Math.floor(now / ABSENCES_BACKGROUND_INTERVAL_MS)
  return stableHash(`${cacheScope}:${bucket}`) % BACKGROUND_MAX_JITTER_MS
}
