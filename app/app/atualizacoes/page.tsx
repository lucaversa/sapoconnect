'use client'

import { useMemo, useState } from 'react'
import {
  BellRing,
  BookOpenCheck,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  History,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'

import { UpdateDetailDialog } from '@/components/updates/UpdateDetailDialog'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/ui/page-heading'
import { PageTransition } from '@/components/ui/app-motion'
import {
  ACADEMIC_MODULE_META,
  type AcademicModule,
  type AcademicUpdate,
} from '@/lib/academic-updates'
import {
  getAcademicSyncLabel,
  useAcademicUpdates,
} from '@/lib/academic-updates-provider'
import { cn } from '@/lib/utils'

const MODULE_ICONS = {
  calendario: CalendarClock,
  faltas: ClipboardCheck,
  avaliacoes: BookOpenCheck,
  historico: History,
} satisfies Record<AcademicModule, typeof BellRing>

type FeedFilter = 'all' | 'unread'

function dayStart(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function groupUpdates(updates: AcademicUpdate[]) {
  const today = dayStart(Date.now())
  const sevenDaysAgo = today - 6 * 24 * 60 * 60 * 1_000
  const groups = [
    { label: 'Hoje', updates: [] as AcademicUpdate[] },
    { label: 'Últimos 7 dias', updates: [] as AcademicUpdate[] },
    { label: 'Anteriores', updates: [] as AcademicUpdate[] },
  ]

  for (const update of updates) {
    if (update.detectedAt >= today) groups[0].updates.push(update)
    else if (update.detectedAt >= sevenDaysAgo) groups[1].updates.push(update)
    else groups[2].updates.push(update)
  }
  return groups.filter((group) => group.updates.length > 0)
}

function formatUpdateTime(timestamp: number): string {
  const today = dayStart(Date.now())
  const eventDay = dayStart(timestamp)
  if (eventDay === today) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(timestamp)
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(timestamp)
}

export default function AtualizacoesPage() {
  const {
    isReady,
    updates,
    unreadCount,
    syncProgress,
    syncAll,
    markRead,
    markAllRead,
  } = useAcademicUpdates()
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [selectedUpdate, setSelectedUpdate] = useState<AcademicUpdate | null>(null)
  const reducedMotion = useReducedMotion()
  const visibleUpdates = useMemo(
    () => filter === 'unread' ? updates.filter((update) => update.readAt === null) : updates,
    [filter, updates],
  )
  const groups = useMemo(() => groupUpdates(visibleUpdates), [visibleUpdates])

  const handleSync = async () => {
    const toastId = toast.loading('Verificando atualizações...', { id: 'academic-updates-sync' })
    const result = await syncAll()
    if (result.failed.length === 4) {
      toast.error('Não foi possível consultar a TOTVS. Seus dados salvos foram mantidos.', { id: toastId })
      return
    }
    if (result.newUpdates > 0) {
      toast.success(`${result.newUpdates} ${result.newUpdates === 1 ? 'alteração encontrada' : 'alterações encontradas'}.`, { id: toastId })
      return
    }
    if (result.stale.length > 0 || result.failed.length > 0) {
      toast.warning('Parte dos módulos usou dados salvos. Tente novamente mais tarde.', { id: toastId })
      return
    }
    toast.success('Tudo está em dia.', { id: toastId })
  }

  const openUpdate = (update: AcademicUpdate) => {
    markRead(update.id)
    setSelectedUpdate(update)
  }

  const currentSyncLabel = getAcademicSyncLabel(syncProgress.currentModule)

  return (
    <PageTransition className="app-page">
      <PageHeading
        icon={BellRing}
        title="Atualizações"
        meta={syncProgress.isSyncing ? `Verificando ${currentSyncLabel}` : unreadCount > 0 ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}` : 'Nenhuma pendência'}
      />

      <section className="liquid-float rounded-[1.5rem] p-2.5 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:p-3">
        <div className="grid grid-cols-2 gap-1 rounded-[1.1rem] bg-gray-950/[0.035] p-1 dark:bg-white/[0.035] sm:w-auto sm:min-w-64">
          {([
            ['all', 'Todas'],
            ['unread', `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                'relative min-h-10 rounded-xl px-3 text-xs font-bold transition-colors',
                filter === value
                  ? 'text-primary-800 dark:text-primary-200'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              {filter === value ? (
                <motion.span
                  layoutId="updates-filter"
                  className="absolute inset-0 rounded-xl border border-white/75 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,.85)] dark:border-white/[0.09] dark:bg-white/[0.065]"
                  transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 34 }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:mt-0 sm:flex">
          <Button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncProgress.isSyncing}
            className="gap-2"
          >
            <RefreshCw className={cn('size-4', syncProgress.isSyncing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            {syncProgress.isSyncing ? 'Verificando' : 'Verificar agora'}
          </Button>
          {unreadCount > 0 ? (
            <Button type="button" variant="outline" size="icon" onClick={markAllRead} aria-label="Marcar todas como lidas">
              <CheckCheck className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </section>

      {!isReady ? (
        <div className="space-y-3" role="status" aria-label="Carregando atualizações">
          {[0, 1, 2].map((item) => (
            <div key={item} className="liquid-float h-24 animate-pulse rounded-[1.35rem] motion-reduce:animate-none" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <section className="liquid-float rounded-[1.75rem] px-5 py-10 text-center sm:py-14">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.84, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
            className="icon-orb mx-auto size-16"
          >
            <Sparkles className="size-7" aria-hidden="true" />
          </motion.div>
          <h2 className="mt-4 text-lg font-extrabold tracking-[-0.03em] text-gray-950 dark:text-white">
            {filter === 'unread' ? 'Nenhuma atualização pendente' : 'Nenhuma alteração detectada'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
            {updates.length > 0
              ? 'As atualizações anteriores já foram lidas.'
              : 'O primeiro retrato de cada módulo serve como referência. As próximas mudanças aparecerão aqui.'}
          </p>
        </section>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`updates-${group.label.replace(/\s/g, '-').toLowerCase()}`}>
              <h2
                id={`updates-${group.label.replace(/\s/g, '-').toLowerCase()}`}
                className="mb-3 text-sm font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white"
              >
                {group.label}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence>
                  {group.updates.map((update, index) => {
                    const Icon = MODULE_ICONS[update.module]
                    const isUnread = update.readAt === null
                    return (
                      <motion.button
                        key={update.id}
                        type="button"
                        onClick={() => openUpdate(update)}
                        initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, amount: 0.18, margin: '0px 0px -40px' }}
                        exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                        transition={{ duration: reducedMotion ? 0 : 0.38, delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.18), ease: [0.22, 1, 0.36, 1] }}
                        className="liquid-float group w-full rounded-[1.35rem] p-4 text-left transition-transform duration-200 active:scale-[0.985]"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="icon-orb size-11">
                            <Icon className="size-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-extrabold tracking-[-0.02em] text-gray-950 dark:text-white">
                                  {update.title}
                                </p>
                                <p className="mt-0.5 truncate text-xs font-semibold text-gray-600 dark:text-gray-300">
                                  {update.entityLabel}
                                </p>
                              </div>
                              {isUnread ? (
                                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_rgba(0,172,147,.1)]" aria-label="Não lida" />
                              ) : null}
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                              {update.summary}
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold text-gray-400">
                              <span>{ACADEMIC_MODULE_META[update.module].label}</span>
                              <time dateTime={new Date(update.detectedAt).toISOString()}>{formatUpdateTime(update.detectedAt)}</time>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      <UpdateDetailDialog
        update={selectedUpdate}
        open={selectedUpdate !== null}
        onOpenChange={(open) => { if (!open) setSelectedUpdate(null) }}
      />
    </PageTransition>
  )
}
