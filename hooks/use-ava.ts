'use client'

import { useQuery } from '@tanstack/react-query'

import type { AvaContentSummary, AvaCourseDetail, AvaOverview } from '@/lib/ava-types'
import { useAvaIntegration } from '@/lib/ava-integration-provider'
import { parseApiError, type ApiResponseError } from '@/lib/api-response-error'
import { apiFetch } from '@/lib/fetch-client'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_GC_TIME, QUERY_STALE_TIME } from '@/lib/query-policy'

async function readAvaResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseApiError(response)
  return response.json() as Promise<T>
}

function isExpiredAvaConnection(error: unknown): boolean {
  const code = (error as ApiResponseError | undefined)?.code
  return code === 'AVA_CONNECTION_EXPIRED' || code === 'AVA_NOT_CONNECTED'
}

export function useAvaOverview(enabled = true) {
  const { connection, markDisconnected } = useAvaIntegration()
  return useQuery({
    queryKey: queryKeys.avaOverview(),
    queryFn: async () => {
      try {
        return await readAvaResponse<AvaOverview>(await apiFetch('/api/moodle/overview'))
      } catch (error) {
        if (isExpiredAvaConnection(error)) markDisconnected()
        throw error
      }
    },
    enabled: enabled && connection.connected,
    staleTime: QUERY_STALE_TIME.ava,
    gcTime: QUERY_GC_TIME,
    retry: false,
  })
}

export function useAvaContentSummary(courseIds: number[], enabled = true) {
  const { connection, markDisconnected } = useAvaIntegration()
  const normalizedCourseIds = Array.from(new Set(courseIds)).sort((left, right) => left - right)

  return useQuery({
    queryKey: queryKeys.avaContentSummary(normalizedCourseIds),
    queryFn: async () => {
      try {
        const search = new URLSearchParams({ courseIds: normalizedCourseIds.join(',') })
        return await readAvaResponse<AvaContentSummary>(
          await apiFetch(`/api/moodle/content-summary?${search.toString()}`),
        )
      } catch (error) {
        if (isExpiredAvaConnection(error)) markDisconnected()
        throw error
      }
    },
    enabled: enabled && connection.connected && normalizedCourseIds.length > 0,
    staleTime: QUERY_STALE_TIME.avaContentSummary,
    gcTime: QUERY_GC_TIME,
    retry: false,
  })
}

export function useAvaCourse(courseId: number | null, enabled = true) {
  const { connection, markDisconnected } = useAvaIntegration()
  return useQuery({
    queryKey: queryKeys.avaCourse(courseId ?? 0),
    queryFn: async () => {
      try {
        return await readAvaResponse<AvaCourseDetail>(
          await apiFetch(`/api/moodle/courses/${courseId}`),
        )
      } catch (error) {
        if (isExpiredAvaConnection(error)) markDisconnected()
        throw error
      }
    },
    enabled: enabled && connection.connected && courseId !== null,
    staleTime: QUERY_STALE_TIME.avaCourse,
    gcTime: QUERY_GC_TIME,
    retry: false,
  })
}
