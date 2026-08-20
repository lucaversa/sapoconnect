'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  Files,
  Layers3,
  ListTodo,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

import { ApiError } from '@/components/api-error'
import { PageLoading } from '@/components/page-loading'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/app-motion'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/ui/metric-card'
import { PageHeading } from '@/components/ui/page-heading'
import { useAvaContentSummary, useAvaOverview } from '@/hooks/use-ava'
import { useAvaIntegration } from '@/lib/ava-integration-provider'

function CourseStat({
  icon: Icon,
  value,
  label,
  loading = false,
}: {
  icon: LucideIcon
  value: number | string
  label: string
  loading?: boolean
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 px-2.5 sm:px-3">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0">
        {loading ? (
          <span className="block h-4 w-7 animate-pulse rounded bg-gray-200 dark:bg-white/10" aria-label={`Carregando ${label}`} />
        ) : (
          <span className="block text-sm font-extrabold leading-4 text-gray-950 dark:text-white">{value}</span>
        )}
        <span className="mt-0.5 block truncate text-[10px] font-medium leading-4 text-gray-500 dark:text-gray-400">{label}</span>
      </span>
    </span>
  )
}

export default function AvaPage() {
  const router = useRouter()
  const {
    connection,
    isLoading: isConnectionLoading,
    isUnavailable: isConnectionUnavailable,
    openConnectionDialog,
    retryConnection,
  } = useAvaIntegration()
  const promptedRef = useRef(false)
  const overview = useAvaOverview(connection.connected)
  const courseIds = useMemo(
    () => overview.data?.courses.map((course) => course.id) ?? [],
    [overview.data?.courses],
  )
  const contentSummary = useAvaContentSummary(courseIds, overview.isSuccess)

  useEffect(() => {
    if (isConnectionLoading || isConnectionUnavailable || connection.connected || promptedRef.current) return
    promptedRef.current = true
    openConnectionDialog()
  }, [connection.connected, isConnectionLoading, isConnectionUnavailable, openConnectionDialog])

  const pendingByCourse = useMemo(() => {
    const counts = new Map<number, number>()
    for (const task of overview.data?.tasks ?? []) {
      counts.set(task.courseId, (counts.get(task.courseId) ?? 0) + 1)
    }
    return counts
  }, [overview.data?.tasks])

  const nextTask = useMemo(() => {
    const tasks = overview.data?.tasks ?? []
    return tasks.find((task) => !task.overdue) ?? tasks[0] ?? null
  }, [overview.data?.tasks])

  const contentByCourse = useMemo(() => new Map(
    (contentSummary.data?.courses ?? []).map((course) => [course.courseId, course]),
  ), [contentSummary.data?.courses])

  const refresh = async () => {
    const toastId = toast.loading('Atualizando AVA...', { id: 'refresh-ava' })
    const contentRefresh = courseIds.length > 0 ? contentSummary.refetch() : Promise.resolve(null)
    const [overviewResult, contentResult] = await Promise.all([
      overview.refetch(),
      contentRefresh,
    ])
    if (overviewResult.error) {
      toast.error('Não foi possível atualizar o AVA.', { id: toastId })
    } else if (contentResult?.error) {
      toast.warning('Prazos atualizados. A contagem de conteúdos está indisponível.', { id: toastId })
    } else {
      toast.success('AVA atualizado.', { id: toastId })
    }
  }

  if (isConnectionLoading) return <PageLoading message="Preparando integração com o AVA..." />

  if (isConnectionUnavailable) {
    return (
      <PageTransition className="app-page">
        <PageHeading icon={BookOpenCheck} title="AVA" />
        <section className="liquid-float rounded-[1.75rem] px-5 py-10 text-center sm:px-8 sm:py-14">
          <span className="icon-orb mx-auto size-16"><BookOpenCheck className="size-7" aria-hidden="true" /></span>
          <h2 className="mt-4 text-lg font-extrabold tracking-[-0.03em] text-gray-950 dark:text-white">Não foi possível verificar o AVA</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
            Sua integração continua salva. Conecte-se à internet para carregar os dados que ainda não estiverem disponíveis offline.
          </p>
          <Button type="button" onClick={() => void retryConnection()} className="mt-5">Tentar novamente</Button>
        </section>
      </PageTransition>
    )
  }

  if (!connection.connected) {
    return (
      <PageTransition className="app-page">
        <PageHeading
          icon={BookOpenCheck}
          title="AVA"
          description="Materiais e atividades das disciplinas do semestre atual."
        />
        <section className="liquid-float rounded-[1.75rem] px-5 py-10 text-center sm:px-8 sm:py-14">
          <span className="icon-orb mx-auto size-16"><BookOpenCheck className="size-7" aria-hidden="true" /></span>
          <h2 className="mt-4 text-lg font-extrabold tracking-[-0.03em] text-gray-950 dark:text-white">Conecte seu AVA</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
            Veja tarefas pendentes, prazos e materiais organizados por disciplina.
          </p>
          <Button type="button" onClick={openConnectionDialog} className="mt-5 gap-2">
            Conectar AVA
          </Button>
        </section>
      </PageTransition>
    )
  }

  if (overview.isLoading) return <PageLoading message="Carregando disciplinas do AVA..." />
  if (overview.error && !overview.data) return <ApiError error={overview.error} retry={() => overview.refetch()} />

  const courses = overview.data?.courses ?? []
  const tasks = overview.data?.tasks ?? []
  const lastUpdatedLabel = overview.dataUpdatedAt
    ? formatDistanceToNow(new Date(overview.dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null
  return (
    <PageTransition className="app-page">
      <PageHeading
        icon={BookOpenCheck}
        title="AVA"
        meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{overview.isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
        actions={(
          <Button variant="outline" size="icon" onClick={() => void refresh()} disabled={overview.isFetching} aria-label="Atualizar" className="hidden sm:inline-flex">
            <RefreshCw className={`size-4 ${overview.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        )}
        desktopActionsOnly
      />

      <Stagger className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.75fr)]">
        <StaggerItem>
          <MetricCard
            icon={CalendarClock}
            label="Próxima tarefa"
            value={nextTask
              ? <span className="block break-words text-[15px] leading-5">{nextTask.name}</span>
              : <span className="text-sm text-gray-400">Nenhuma pendente</span>}
            detail={nextTask
              ? `${nextTask.courseName}. ${format(new Date(nextTask.deadline), "dd/MM 'às' HH:mm")}`
              : 'Tudo certo por enquanto.'}
            onClick={nextTask ? () => router.push(`/app/ava/${nextTask.courseId}`) : undefined}
            actionHint={nextTask ? 'Abrir disciplina' : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            icon={ListTodo}
            label="Tarefas pendentes"
            value={tasks.length}
            detail={tasks.length === 1 ? 'Uma atividade aguardando conclusão.' : `${tasks.length} atividades aguardando conclusão.`}
          />
        </StaggerItem>
      </Stagger>

      {courses.length > 0 ? (
        <section aria-labelledby="ava-courses-title">
          <h2 id="ava-courses-title" className="mb-3 text-sm font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">Disciplinas</h2>
          <Stagger className="grid gap-3.5 md:grid-cols-2">
            {courses.map((course) => {
              const pending = pendingByCourse.get(course.id) ?? 0
              const courseNextTask = tasks.find((task) => task.courseId === course.id)
              const content = contentByCourse.get(course.id)
              const isContentLoading = !content && contentSummary.isLoading
              return (
                <StaggerItem key={course.id}>
                  <Link
                    href={`/app/ava/${course.id}`}
                    aria-label={`Abrir ${course.fullName}`}
                    className="academic-panel tech-card-interactive group flex h-full min-h-40 flex-col p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-5"
                  >
                    <span className="flex w-full items-start gap-3.5">
                      <span className="icon-orb size-11"><BookOpenCheck className="size-5" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="block break-words text-sm font-extrabold leading-5 text-gray-950 dark:text-white">{course.fullName}</span>
                        <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-gray-400">
                          {courseNextTask
                            ? `Próxima tarefa em ${format(new Date(courseNextTask.deadline), 'dd/MM')}`
                            : 'Nenhuma tarefa pendente'}
                        </span>
                      </span>
                      <ChevronRight className="mt-3 size-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                    </span>

                    <span className="mt-4 grid w-full grid-cols-3 divide-x divide-gray-200/80 rounded-2xl border border-gray-200/70 bg-white/45 py-3 dark:divide-white/[0.07] dark:border-white/[0.07] dark:bg-white/[0.025]">
                      <CourseStat icon={ListTodo} value={pending} label={pending === 1 ? 'tarefa' : 'tarefas'} />
                      <CourseStat
                        icon={Layers3}
                        value={content?.sectionCount ?? '-'}
                        label={content?.sectionCount === 1 ? 'seção' : 'seções'}
                        loading={isContentLoading}
                      />
                      <CourseStat
                        icon={Files}
                        value={content?.materialCount ?? '-'}
                        label={content?.materialCount === 1 ? 'material' : 'materiais'}
                        loading={isContentLoading}
                      />
                    </span>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      ) : (
        <section className="content-surface px-5 py-10 text-center">
          <h2 className="text-base font-extrabold text-gray-950 dark:text-white">Nenhuma disciplina atual</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">O AVA não retornou disciplinas com datas dentro do semestre em andamento.</p>
        </section>
      )}

      <PullToRefresh onRefresh={refresh} />
    </PageTransition>
  )
}
