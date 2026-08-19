import { describe, expect, it } from 'vitest'

import {
  ABSENCES_BACKGROUND_INTERVAL_MS,
  EVALUATIONS_BACKGROUND_INTERVAL_MS,
  EVALUATIONS_FULL_INTERVAL_MS,
  getAcademicBackgroundPlan,
  getBackgroundStartJitter,
} from '@/lib/academic-update-schedule'
import { createAcademicUpdatesState } from '@/lib/academic-updates'

describe('academic update schedule', () => {
  it('starts with light absences and a full evaluations baseline', () => {
    const state = createAcademicUpdatesState('scope-fixture')
    expect(getAcademicBackgroundPlan(state, 1_000)).toEqual({
      absencesDue: true,
      evaluationsMode: 'full',
      historyDue: false,
    })
  })

  it('uses independent cadences and never competes history with evaluations', () => {
    const now = 30 * 24 * 60 * 60 * 1_000
    const state = createAcademicUpdatesState('scope-fixture')
    state.snapshots.avaliacoes = { version: 2, capturedAt: now - 1, records: [] }
    state.lastSuccessfulSyncAt = {
      faltas: now - ABSENCES_BACKGROUND_INTERVAL_MS - 1,
      avaliacoes: now - EVALUATIONS_BACKGROUND_INTERVAL_MS - 1,
      historico: now - 2 * EVALUATIONS_FULL_INTERVAL_MS,
    }
    state.lastFullSyncAt = { avaliacoes: now - EVALUATIONS_FULL_INTERVAL_MS + 1 }

    expect(getAcademicBackgroundPlan(state, now)).toEqual({
      absencesDue: true,
      evaluationsMode: 'batch',
      historyDue: false,
    })
  })

  it('keeps the deterministic start jitter inside the two-minute budget', () => {
    const now = Date.UTC(2026, 7, 19, 12)
    const first = getBackgroundStartJitter('scope-fixture', now)
    expect(first).toBe(getBackgroundStartJitter('scope-fixture', now))
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(2 * 60 * 1_000)
  })
})
