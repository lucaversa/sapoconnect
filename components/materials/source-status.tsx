'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAvaIntegration } from '@/lib/ava-integration-provider'

export function SourceBadge({ source }: { source: 'AVA' | 'TOTVS' }) {
  return <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">{source === 'TOTVS' ? 'EduConnect' : source}</span>
}

export function SourceStatus({ title, description, retry, loading = false }: {
  title: string
  description?: string
  retry?: () => void
  loading?: boolean
}) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gray-200/80 px-4 py-3 dark:border-white/10">
      {loading ? <RefreshCw className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      {retry ? <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button> : null}
    </div>
  )
}

export function AvaSourceStatus() {
  const { connection, isLoading, isUnavailable, openConnectionDialog, retryConnection } = useAvaIntegration()
  if (isLoading) return <SourceStatus title="Verificando conexão com o AVA…" loading />
  if (isUnavailable) return <SourceStatus title="AVA indisponível" description="Sua integração continua salva. Os arquivos do EduConnect continuam disponíveis; os conteúdos já consultados podem ser acessados offline." retry={() => void retryConnection()} />
  if (connection.connected) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-gray-200/80 px-4 py-3 dark:border-white/10">
      <div className="min-w-0 flex-1 basis-44">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Seus materiais em um só lugar</p>
        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Conecte o AVA para incluir seus conteúdos e tarefas junto aos arquivos do EduConnect.</p>
      </div>
      <Button variant="outline" size="sm" onClick={openConnectionDialog}>Conectar AVA</Button>
    </div>
  )
}
