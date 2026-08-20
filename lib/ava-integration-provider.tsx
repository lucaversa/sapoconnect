'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import type { AvaConnectionState } from '@/lib/ava-types'
import { parseApiError } from '@/lib/api-response-error'
import { apiFetch } from '@/lib/fetch-client'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

interface AvaIntegrationContextValue {
  connection: AvaConnectionState
  isLoading: boolean
  isDialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  openConnectionDialog: () => void
  connect: (password: string) => Promise<void>
  disconnect: () => Promise<void>
  markDisconnected: () => void
}

const DISCONNECTED: AvaConnectionState = { connected: false }
const AvaIntegrationContext = createContext<AvaIntegrationContextValue | undefined>(undefined)

async function readConnectionResponse(response: Response): Promise<AvaConnectionState> {
  if (!response.ok) throw await parseApiError(response)
  return response.json() as Promise<AvaConnectionState>
}

export function AvaIntegrationProvider({ children }: { children: React.ReactNode }) {
  const [isDialogOpen, setDialogOpen] = useState(false)
  const connectionQuery = useQuery({
    queryKey: queryKeys.avaConnection(),
    queryFn: async () => readConnectionResponse(await apiFetch('/api/moodle/session')),
    staleTime: Infinity,
    retry: false,
  })

  const markDisconnected = useCallback(() => {
    queryClient.setQueryData<AvaConnectionState>(queryKeys.avaConnection(), DISCONNECTED)
    queryClient.removeQueries({ queryKey: ['ava'] })
  }, [])

  const connect = useCallback(async (password: string) => {
    const response = await apiFetch('/api/moodle/session', {
      method: 'POST',
      body: JSON.stringify({ password }),
      maxRetries: 0,
    })
    const connection = await readConnectionResponse(response)
    queryClient.setQueryData(queryKeys.avaConnection(), connection)
    queryClient.removeQueries({ queryKey: ['ava'] })
  }, [])

  const disconnect = useCallback(async () => {
    const response = await apiFetch('/api/moodle/session', {
      method: 'DELETE',
      maxRetries: 0,
    })
    if (!response.ok) throw await parseApiError(response)
    markDisconnected()
  }, [markDisconnected])

  const value = useMemo<AvaIntegrationContextValue>(() => ({
    connection: connectionQuery.data ?? DISCONNECTED,
    isLoading: connectionQuery.isLoading,
    isDialogOpen,
    setDialogOpen,
    openConnectionDialog: () => setDialogOpen(true),
    connect,
    disconnect,
    markDisconnected,
  }), [connect, connectionQuery.data, connectionQuery.isLoading, disconnect, isDialogOpen, markDisconnected])

  return (
    <AvaIntegrationContext.Provider value={value}>
      {children}
    </AvaIntegrationContext.Provider>
  )
}

export function useAvaIntegration(): AvaIntegrationContextValue {
  const context = useContext(AvaIntegrationContext)
  if (!context) throw new Error('useAvaIntegration must be used within AvaIntegrationProvider')
  return context
}
