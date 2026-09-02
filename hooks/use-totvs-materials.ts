'use client'

import { useQuery } from '@tanstack/react-query'
import { parseApiError } from '@/lib/api-response-error'
import { apiFetch } from '@/lib/fetch-client'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_GC_TIME, QUERY_STALE_TIME } from '@/lib/query-policy'
import type { TotvsMaterialsOverview } from '@/lib/totvs-materials-types'

export function useTotvsMaterials() {
  return useQuery({
    queryKey: queryKeys.totvsMaterials(),
    queryFn: async ({ signal }) => {
      const response = await apiFetch('/api/totvs/materials', { signal })
      if (!response.ok) throw await parseApiError(response)
      return response.json() as Promise<TotvsMaterialsOverview>
    },
    staleTime: QUERY_STALE_TIME.totvsMaterials,
    gcTime: QUERY_GC_TIME,
    retry: false,
  })
}
