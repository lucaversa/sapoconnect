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

import { parseApiError, isSessionExpiredApiError } from '@/lib/api-response-error'
import {
  ACADEMIC_MODULE_META,
  applyAcademicSnapshot,
  createAcademicUpdatesState,
  isAcademicUpdatesState,
  markAcademicUpdateRead,
  markAllAcademicUpdatesRead,
  recordBackgroundSweep,
  type AcademicModule,
  type AcademicUpdate,
  type AcademicUpdatesState,
} from '@/lib/academic-updates'
import { apiFetch, SessionExpiredError } from '@/lib/fetch-client'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME } from '@/lib/query-policy'
import { getAcademicUpdatesState, saveAcademicUpdatesState } from '@/lib/storage'

const BACKGROUND_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1_000
const HISTORY_BACKGROUND_INTERVAL_MS = 24 * 60 * 60 * 1_000
const BACKGROUND_START_DELAY_MS = 2_400

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
  mode: 'background' | 'manual' | null
  currentModule: AcademicModule | null
  completed: number
  total: number
}

export interface AcademicSyncResult {
  completed: number
  failed: AcademicModule[]
  stale: AcademicModule[]
  newUpdates: number
}

interface AcademicUpdatesContextValue {
  isReady: boolean
  updates: AcademicUpdate[]
  unreadCount: number
  lastSuccessfulSyncAt: Partial<Record<AcademicModule, number>>
  syncProgress: AcademicSyncProgress
  syncAll: () => Promise<AcademicSyncResult>
  markRead: (id: string) => void
  markAllRead: () => void
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

async function fetchAcademicResource(academicModule: AcademicModule): Promise<unknown> {
  const response = await apiFetch(RESOURCES[academicModule].url)
  if (!response.ok) {
    const apiError = await parseApiError(response)
    if (isSessionExpiredApiError(apiError)) throw new SessionExpiredError()
    throw apiError
  }

  const data = await response.json() as unknown
  if (
    response.headers.get('x-sapoconnect-cache') === 'stale' &&
    data &&
    typeof data === 'object'
  ) {
    Object.assign(data, { __cacheStale: true })
  }
  return data
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
        ? stored
        : createAcademicUpdatesState(cacheScope)
      if (cancelled) return

      stateRef.current = initial
      setState(initial)
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

  const syncModule = useCallback(async (academicModule: AcademicModule, force: boolean) => {
    const resource = RESOURCES[academicModule]
    const data = await queryClient.fetchQuery({
      queryKey: resource.queryKey,
      queryFn: () => fetchAcademicResource(academicModule),
      staleTime: force ? 0 : resource.staleTime,
    })
    const capturedAt = queryClient.getQueryState(resource.queryKey)?.dataUpdatedAt ?? Date.now()
    await processSnapshot(academicModule, data, capturedAt)
    return data
  }, [processSnapshot])

  useEffect(() => {
    if (!isReady) return

    const timeoutId = window.setTimeout(() => {
      if (
        syncInFlightRef.current ||
        !navigator.onLine ||
        document.visibilityState !== 'visible'
      ) return

      const run = async () => {
        syncInFlightRef.current = true
        setSyncProgress({
          isSyncing: true,
          mode: 'background',
          currentModule: 'calendario',
          completed: 0,
          total: 1,
        })

        try {
          await syncModule('calendario', false).catch(() => undefined)
          const now = Date.now()
          const current = stateRef.current
          if (now - current.lastBackgroundSweepAt < BACKGROUND_SWEEP_INTERVAL_MS) return

          commitState(recordBackgroundSweep(current, now))
          const candidates: AcademicModule[] = ['faltas', 'avaliacoes']
          const historyLastSync = current.lastSuccessfulSyncAt.historico ?? 0
          if (now - historyLastSync >= HISTORY_BACKGROUND_INTERVAL_MS) candidates.push('historico')
          candidates.sort((left, right) =>
            (current.lastSuccessfulSyncAt[left] ?? 0) -
            (current.lastSuccessfulSyncAt[right] ?? 0)
          )
          const candidate = candidates[0]
          setSyncProgress({
            isSyncing: true,
            mode: 'background',
            currentModule: candidate,
            completed: 1,
            total: 2,
          })
          await syncModule(candidate, false).catch(() => undefined)
        } finally {
          syncInFlightRef.current = false
          setSyncProgress(EMPTY_PROGRESS)
        }
      }

      void run()
    }, BACKGROUND_START_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [commitState, isReady, syncModule])

  const syncAll = useCallback(async (): Promise<AcademicSyncResult> => {
    if (syncInFlightRef.current) {
      return { completed: 0, failed: [], stale: [], newUpdates: 0 }
    }

    const modules: AcademicModule[] = ['calendario', 'faltas', 'avaliacoes', 'historico']
    const unreadBefore = stateRef.current.updates.filter((update) => update.readAt === null).length
    const failed: AcademicModule[] = []
    const stale: AcademicModule[] = []
    let completed = 0
    syncInFlightRef.current = true

    try {
      for (const academicModule of modules) {
        setSyncProgress({
          isSyncing: true,
          mode: 'manual',
          currentModule: academicModule,
          completed,
          total: modules.length,
        })
        try {
          const data = await syncModule(academicModule, true)
          if (data && typeof data === 'object' && '__cacheStale' in data) stale.push(academicModule)
          completed += 1
        } catch {
          failed.push(academicModule)
        }
      }
      await processingRef.current
      const unreadAfter = stateRef.current.updates.filter((update) => update.readAt === null).length
      return {
        completed,
        failed,
        stale,
        newUpdates: Math.max(0, unreadAfter - unreadBefore),
      }
    } finally {
      syncInFlightRef.current = false
      setSyncProgress(EMPTY_PROGRESS)
    }
  }, [syncModule])

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
    syncAll,
    markRead,
    markAllRead,
  }), [isReady, markAllRead, markRead, state, syncAll, syncProgress])

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
