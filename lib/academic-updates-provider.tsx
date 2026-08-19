'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Query } from '@tanstack/react-query'

import {
  BACKGROUND_LOCK_TTL_MS,
  BACKGROUND_RECHECK_INTERVAL_MS,
  getAcademicBackgroundPlan,
  getBackgroundStartJitter,
} from '@/lib/academic-update-schedule'
import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error'
import {
  ACADEMIC_MODULE_META,
  applyAcademicSnapshot,
  createAcademicUpdatesState,
  isAcademicUpdatesState,
  markAcademicUpdateRead,
  markAllAcademicUpdatesRead,
  migrateAcademicUpdatesState,
  recordBackgroundSweep,
  type AcademicModule,
  type AcademicUpdate,
  type AcademicUpdatesState,
} from '@/lib/academic-updates'
import { calculateEvaluationLaunchProgress } from '@/lib/evaluation-progress'
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME } from '@/lib/query-policy'
import { getAcademicUpdatesState, saveAcademicUpdatesState } from '@/lib/storage'

const BACKGROUND_START_DELAY_MS = 2_400
const CALENDAR_BACKGROUND_INTERVAL_MS = 6 * 60 * 60 * 1_000
const LOCK_RETRY_INTERVAL_MS = 5 * 60 * 1_000
const FAILED_SWEEP_RETRY_INTERVAL_MS = 60 * 60 * 1_000
const LOCK_KEY_PREFIX = 'sapoconnect:academic-sync-lock:'

interface AcademicResource {
  queryKey: readonly unknown[]
  url: string
  staleTime: number
}

const RESOURCES: Record<AcademicModule, AcademicResource> = {
  calendario: {
    queryKey: queryKeys.calendario(),
    url: '/api/calendario/horario',
    staleTime: QUERY_STALE_TIME.calendario,
  },
  faltas: {
    queryKey: queryKeys.faltas(),
    url: '/api/faltas/completo',
    staleTime: QUERY_STALE_TIME.faltas,
  },
  avaliacoes: {
    queryKey: queryKeys.avaliacoesCompleto(),
    url: '/api/avaliacoes/completo',
    staleTime: QUERY_STALE_TIME.avaliacoes,
  },
  historico: {
    queryKey: queryKeys.historico(),
    url: '/api/historico',
    staleTime: QUERY_STALE_TIME.historico,
  },
}

export interface AcademicSyncProgress {
  isSyncing: boolean
  mode: 'background' | null
  currentModule: AcademicModule | null
  completed: number
  total: number
}

interface AcademicUpdatesContextValue {
  isReady: boolean
  updates: AcademicUpdate[]
  unreadCount: number
  lastSuccessfulSyncAt: Partial<Record<AcademicModule, number>>
  syncProgress: AcademicSyncProgress
  markRead: (id: string) => void
  markAllRead: () => void
}

interface EvaluationResultLike {
  categorias?: Array<{
    nome: string
    avaliacoes: Array<{ nome: string; nota?: string }>
  }>
}

interface EvaluationDisciplineLike {
  codigo?: string
  resultado?: EvaluationResultLike
}

interface EvaluationResponseLike {
  disciplinas?: EvaluationDisciplineLike[]
}

interface BackgroundLock {
  owner: string
  expiresAt: number
}

interface BackgroundTask {
  module: AcademicModule
  run: () => Promise<unknown>
}

const EMPTY_PROGRESS: AcademicSyncProgress = {
  isSyncing: false,
  mode: null,
  currentModule: null,
  completed: 0,
  total: 0,
}

const AcademicUpdatesContext = createContext<AcademicUpdatesContextValue | undefined>(undefined)

function moduleFromQuery(query: Query): AcademicModule | null {
  const [root, detail] = query.queryKey
  if (root === 'calendario') return 'calendario'
  if (root === 'faltas') return 'faltas'
  if (root === 'historico') return 'historico'
  if (root === 'avaliacoes' && detail === 'completo') return 'avaliacoes'
  return null
}

function markStaleResponse(response: Response, data: unknown): unknown {
  if (
    response.headers.get('x-sapoconnect-cache') === 'stale'
    && data
    && typeof data === 'object'
  ) {
    Object.assign(data, { __cacheStale: true })
  }
  return data
}

async function readAcademicResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const apiError = await parseApiError(response)
    if (isSessionExpiredApiError(apiError)) throw new SessionExpiredError()
    throw apiError
  }
  return markStaleResponse(response, await response.json() as unknown)
}

async function fetchAcademicResource(academicModule: AcademicModule): Promise<unknown> {
  return readAcademicResponse(await apiFetch(RESOURCES[academicModule].url))
}

function preferredEvaluationCodes(): string[] {
  const cached = queryClient.getQueryData<EvaluationResponseLike>(queryKeys.avaliacoesCompleto())
  if (!cached?.disciplinas) return []
  return cached.disciplinas.flatMap((disciplina) => {
    if (!disciplina.codigo || !disciplina.resultado?.categorias) return []
    const progress = calculateEvaluationLaunchProgress(disciplina.resultado.categorias)
    return progress.total > progress.launched ? [disciplina.codigo] : []
  })
}

function parseBackgroundLock(value: string | null): BackgroundLock | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<BackgroundLock>
    if (typeof parsed.owner !== 'string' || typeof parsed.expiresAt !== 'number') return null
    return { owner: parsed.owner, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function acquireBackgroundLock(cacheScope: string, owner: string, now: number): boolean {
  try {
    const key = `${LOCK_KEY_PREFIX}${cacheScope}`
    const current = parseBackgroundLock(window.localStorage.getItem(key))
    if (current && current.expiresAt > now && current.owner !== owner) return false
    window.localStorage.setItem(key, JSON.stringify({
      owner,
      expiresAt: now + BACKGROUND_LOCK_TTL_MS,
    } satisfies BackgroundLock))
    return parseBackgroundLock(window.localStorage.getItem(key))?.owner === owner
  } catch {
    // Safari private mode can deny localStorage. The in-tab single-flight still applies.
    return true
  }
}

function releaseBackgroundLock(cacheScope: string, owner: string): void {
  try {
    const key = `${LOCK_KEY_PREFIX}${cacheScope}`
    if (parseBackgroundLock(window.localStorage.getItem(key))?.owner === owner) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Best effort only.
  }
}

export function AcademicUpdatesProvider({
  cacheScope,
  children,
}: {
  cacheScope: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<AcademicUpdatesState>(() =>
    createAcademicUpdatesState(cacheScope)
  )
  const [isReady, setIsReady] = useState(false)
  const [syncProgress, setSyncProgress] = useState<AcademicSyncProgress>(EMPTY_PROGRESS)
  const stateRef = useRef(state)
  const processingRef = useRef<Promise<void>>(Promise.resolve())
  const processedQueriesRef = useRef(new Map<string, number>())
  const syncInFlightRef = useRef(false)

  const commitState = useCallback((next: AcademicUpdatesState) => {
    stateRef.current = next
    setState(next)
    void saveAcademicUpdatesState(cacheScope, next).catch(() => {})
  }, [cacheScope])

  const processSnapshot = useCallback((
    academicModule: AcademicModule,
    data: unknown,
    capturedAt: number,
  ) => {
    processingRef.current = processingRef.current.then(async () => {
      const current = stateRef.current
      const previousCapturedAt = current.snapshots[academicModule]?.capturedAt ?? 0
      if (capturedAt <= previousCapturedAt) return

      const result = applyAcademicSnapshot(current, academicModule, data, capturedAt)
      if (result.state === current) return
      commitState(result.state)
    })
    return processingRef.current
  }, [commitState])

  const processQuery = useCallback((query: Query) => {
    const academicModule = moduleFromQuery(query)
    const { data, dataUpdatedAt, status } = query.state
    if (!academicModule || status !== 'success' || data === undefined || dataUpdatedAt <= 0) return

    const lastProcessed = processedQueriesRef.current.get(query.queryHash) ?? 0
    if (dataUpdatedAt <= lastProcessed) return
    processedQueriesRef.current.set(query.queryHash, dataUpdatedAt)
    void processSnapshot(academicModule, data, dataUpdatedAt)
  }, [processSnapshot])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const initialize = async () => {
      setIsReady(false)
      processedQueriesRef.current.clear()
      processingRef.current = Promise.resolve()
      const emptyState = createAcademicUpdatesState(cacheScope)
      stateRef.current = emptyState
      setState(emptyState)
      const stored = await getAcademicUpdatesState<AcademicUpdatesState>(cacheScope)
      const initial = isAcademicUpdatesState(stored, cacheScope)
        ? migrateAcademicUpdatesState(stored)
        : createAcademicUpdatesState(cacheScope)
      if (cancelled) return

      stateRef.current = initial
      setState(initial)
      if (initial !== stored) void saveAcademicUpdatesState(cacheScope, initial).catch(() => {})
      unsubscribe = queryClient.getQueryCache().subscribe((event) => processQuery(event.query))
      for (const query of queryClient.getQueryCache().getAll()) processQuery(query)
      await processingRef.current
      if (!cancelled) setIsReady(true)
    }

    void initialize()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [cacheScope, processQuery])

  const syncModule = useCallback(async (academicModule: AcademicModule) => {
    const resource = RESOURCES[academicModule]
    const data = await queryClient.fetchQuery({
      queryKey: resource.queryKey,
      queryFn: () => fetchAcademicResource(academicModule),
      staleTime: resource.staleTime,
    })
    const capturedAt = queryClient.getQueryState(resource.queryKey)?.dataUpdatedAt ?? Date.now()
    await processSnapshot(academicModule, data, capturedAt)
    return data
  }, [processSnapshot])

  const syncLightAbsences = useCallback(async () => {
    const data = await readAcademicResponse(await apiFetch('/api/faltas'))
    await processSnapshot('faltas', data, Date.now())
    return data
  }, [processSnapshot])

  const syncEvaluationBatch = useCallback(async () => {
    const data = await readAcademicResponse(await apiFetch('/api/avaliacoes/atualizacoes', {
      method: 'POST',
      body: JSON.stringify({ preferredCodes: preferredEvaluationCodes() }),
      maxRetries: 1,
    }))
    await processSnapshot('avaliacoes', data, Date.now())
    return data
  }, [processSnapshot])

  useEffect(() => {
    if (!isReady) return

    let cancelled = false
    let timeoutId: number | null = null
    const lockOwner = globalThis.crypto?.randomUUID?.()
      ?? `academic-sync-${Date.now()}-${Math.random()}`

    const schedule = (delay: number) => {
      if (cancelled) return
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(run, delay)
    }

    const run = async () => {
      timeoutId = null
      if (
        cancelled
        || syncInFlightRef.current
        || !navigator.onLine
        || document.visibilityState !== 'visible'
      ) {
        schedule(BACKGROUND_RECHECK_INTERVAL_MS)
        return
      }

      const now = Date.now()
      const current = stateRef.current
      if (now - current.lastBackgroundSweepAt < FAILED_SWEEP_RETRY_INTERVAL_MS) {
        schedule(BACKGROUND_RECHECK_INTERVAL_MS)
        return
      }
      const plan = getAcademicBackgroundPlan(current, now)
      const tasks: BackgroundTask[] = []
      if (now - (current.lastSuccessfulSyncAt.calendario ?? 0) >= CALENDAR_BACKGROUND_INTERVAL_MS) {
        tasks.push({ module: 'calendario', run: () => syncModule('calendario') })
      }
      if (plan.absencesDue) {
        tasks.push({ module: 'faltas', run: syncLightAbsences })
      }
      if (plan.evaluationsMode === 'full') {
        tasks.push({ module: 'avaliacoes', run: () => syncModule('avaliacoes') })
      } else if (plan.evaluationsMode === 'batch') {
        tasks.push({ module: 'avaliacoes', run: syncEvaluationBatch })
      } else if (plan.historyDue) {
        tasks.push({ module: 'historico', run: () => syncModule('historico') })
      }

      if (tasks.length === 0) {
        schedule(BACKGROUND_RECHECK_INTERVAL_MS)
        return
      }
      if (!acquireBackgroundLock(cacheScope, lockOwner, now)) {
        schedule(LOCK_RETRY_INTERVAL_MS)
        return
      }

      syncInFlightRef.current = true
      commitState(recordBackgroundSweep(stateRef.current, now))
      try {
        for (let index = 0; index < tasks.length; index += 1) {
          if (cancelled || !navigator.onLine || document.visibilityState !== 'visible') break
          const task = tasks[index]
          setSyncProgress({
            isSyncing: true,
            mode: 'background',
            currentModule: task.module,
            completed: index,
            total: tasks.length,
          })
          await task.run().catch(() => undefined)
        }
      } finally {
        syncInFlightRef.current = false
        releaseBackgroundLock(cacheScope, lockOwner)
        if (!cancelled) {
          setSyncProgress(EMPTY_PROGRESS)
          schedule(BACKGROUND_RECHECK_INTERVAL_MS)
        }
      }
    }

    const triggerSoon = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      schedule(BACKGROUND_START_DELAY_MS + getBackgroundStartJitter(cacheScope, Date.now()))
    }

    triggerSoon()
    document.addEventListener('visibilitychange', triggerSoon)
    window.addEventListener('online', triggerSoon)
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', triggerSoon)
      window.removeEventListener('online', triggerSoon)
      releaseBackgroundLock(cacheScope, lockOwner)
    }
  }, [cacheScope, commitState, isReady, syncEvaluationBatch, syncLightAbsences, syncModule])

  const markRead = useCallback((id: string) => {
    commitState(markAcademicUpdateRead(stateRef.current, id))
  }, [commitState])

  const markAllRead = useCallback(() => {
    commitState(markAllAcademicUpdatesRead(stateRef.current))
  }, [commitState])

  const value = useMemo<AcademicUpdatesContextValue>(() => ({
    isReady,
    updates: state.updates,
    unreadCount: state.updates.filter((update) => update.readAt === null).length,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    syncProgress,
    markRead,
    markAllRead,
  }), [isReady, markAllRead, markRead, state, syncProgress])

  return (
    <AcademicUpdatesContext.Provider value={value}>
      {children}
    </AcademicUpdatesContext.Provider>
  )
}

export function useAcademicUpdates(): AcademicUpdatesContextValue {
  const context = useContext(AcademicUpdatesContext)
  if (!context) throw new Error('useAcademicUpdates must be used within AcademicUpdatesProvider')
  return context
}

export function getAcademicSyncLabel(academicModule: AcademicModule | null): string {
  return academicModule ? ACADEMIC_MODULE_META[academicModule].label : ''
}
