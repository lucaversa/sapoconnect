'use client'

import { useMemo } from 'react'
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

import { AvaSourceStatus, SourceBadge, SourceStatus } from '@/components/materials/source-status'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/app-motion'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/ui/metric-card'
import { PageHeading } from '@/components/ui/page-heading'
import { useAvaContentSummary, useAvaOverview } from '@/hooks/use-ava'
import { useAvaIntegration } from '@/lib/ava-integration-provider'
import { useTotvsMaterials } from '@/hooks/use-totvs-materials'
import { mergeMaterialSubjects } from '@/lib/materials-matching'

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
  const { connection } = useAvaIntegration()
  const overview = useAvaOverview(connection.connected)
  const totvs = useTotvsMaterials()
  const courseIds = useMemo(
    () => overview.data?.courses.map((course) => course.id) ?? [],
    [overview.data?.courses],
  )
  const contentSummary = useAvaContentSummary(courseIds, overview.isSuccess)

  const courses = useMemo(() => mergeMaterialSubjects(
    overview.data?.courses ?? [], totvs.data?.courses ?? [],
  ), [overview.data?.courses, totvs.data?.courses])

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
    const toastId = toast.loading('Atualizando materiais...', { id: 'refresh-materials' })
    const results = await Promise.all([
      totvs.refetch(),
      ...(connection.connected ? [overview.refetch()] : []),
      ...(connection.connected && courseIds.length > 0 ? [contentSummary.refetch()] : []),
    ])
    const failed = results.filter((result) => result.error).length
    if (failed === results.length) toast.error('Não foi possível atualizar os materiais.', { id: toastId })
    else if (failed) toast.warning('Atualização parcial. Uma das fontes está indisponível.', { id: toastId })
    else toast.success('Materiais atualizados.', { id: toastId })
  }

  const tasks = overview.data?.tasks ?? []
  const isFetching = overview.isFetching || totvs.isFetching || contentSummary.isFetching
  const updatedAt = Math.max(overview.dataUpdatedAt, totvs.dataUpdatedAt)
  const lastUpdatedLabel = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: ptBR })
    : null
  return (
    <PageTransition className="app-page">
      <PageHeading
        icon={BookOpenCheck}
        title="Materiais"
        meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
        actions={(
          <Button variant="outline" size="icon" onClick={() => void refresh()} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex">
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        )}
        desktopActionsOnly
      />

      <AvaSourceStatus />
      {totvs.isLoading ? <SourceStatus title="Buscando arquivos do EduConnect…" loading /> : null}
      {totvs.fetchStatus === 'paused' ? <SourceStatus title="EduConnect offline" description={totvs.data ? 'Exibindo a última lista salva. Os downloads precisam de conexão.' : 'Sem arquivos salvos neste dispositivo. Conecte-se para consultar o EduConnect.'} /> : null}
      {totvs.error || totvs.data?.__cacheStale ? <SourceStatus title="Não foi possível atualizar o EduConnect" description={totvs.data ? 'Exibindo os últimos arquivos consultados.' : 'Os conteúdos do AVA continuam disponíveis.'} retry={() => void totvs.refetch()} /> : null}
      {overview.isLoading ? <SourceStatus title="Buscando conteúdos do AVA…" loading /> : null}
      {overview.fetchStatus === 'paused' ? <SourceStatus title="AVA offline" description={overview.data ? 'Exibindo as disciplinas e tarefas salvas neste dispositivo.' : 'Sem conteúdos salvos neste dispositivo. Conecte-se para consultar o AVA.'} /> : null}
      {overview.error ? <SourceStatus title="Não foi possível atualizar o AVA" description="Os arquivos do EduConnect continuam disponíveis." retry={() => void overview.refetch()} /> : null}

      {overview.data ? <Stagger className="hidden grid-cols-1 gap-3 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.75fr)]">
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
      </Stagger> : null}

      {courses.length > 0 ? (
        <section aria-labelledby="ava-courses-title">
          <h2 id="ava-courses-title" className="mb-3 hidden text-sm font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white lg:block">Disciplinas</h2>
          <Stagger className="grid gap-3.5 md:grid-cols-2">
            {courses.map((course) => {
              const avaId = course.avaCourse?.id
              const pending = avaId ? pendingByCourse.get(avaId) ?? 0 : 0
              const courseNextTask = tasks.find((task) => task.courseId === avaId)
              const content = avaId ? contentByCourse.get(avaId) : undefined
              const isContentLoading = Boolean(avaId && !content && contentSummary.isLoading)
              const totvsCount = course.totvsCourse?.materials.length ?? 0
              const materialCount = (content?.materialCount ?? 0) + totvsCount
              // A TOTVS-backed link stays useful even if the AVA is disconnected later.
              const routeId = course.totvsCourse ? `totvs-${course.totvsCourse.id}` : course.id
              return (
                <StaggerItem key={course.id}>
                  <Link
                    href={`/app/ava/${routeId}`}
                    aria-label={`Abrir ${course.name}`}
                    className="academic-panel tech-card-interactive group flex h-full min-h-40 flex-col p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-5"
                  >
                    <span className="flex w-full items-start gap-3.5">
                      <span className="icon-orb size-11"><BookOpenCheck className="size-5" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="block break-words text-sm font-extrabold leading-5 text-gray-950 dark:text-white">{course.name}</span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {course.avaCourse ? <SourceBadge source="AVA" /> : null}
                          {course.totvsCourse ? <SourceBadge source="TOTVS" /> : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-gray-400">
                          {courseNextTask
                            ? `Próxima tarefa em ${format(new Date(courseNextTask.deadline), 'dd/MM')}`
                            : course.avaCourse ? 'Nenhuma tarefa pendente' : 'Arquivos publicados no portal'}
                        </span>
                      </span>
                      <ChevronRight className="mt-3 size-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                    </span>

                    <span className={`mt-4 grid w-full ${course.avaCourse ? 'grid-cols-3' : 'grid-cols-1'} divide-x divide-gray-200/80 rounded-2xl border border-gray-200/70 bg-white/45 py-3 dark:divide-white/[0.07] dark:border-white/[0.07] dark:bg-white/[0.025]`}>
                      {course.avaCourse ? <CourseStat icon={ListTodo} value={pending} label={pending === 1 ? 'tarefa' : 'tarefas'} /> : null}
                      {course.avaCourse ? <CourseStat
                        icon={Layers3}
                        value={content?.sectionCount ?? '-'}
                        label={content?.sectionCount === 1 ? 'seção' : 'seções'}
                        loading={isContentLoading}
                      /> : null}
                      <CourseStat
                        icon={Files}
                        value={course.avaCourse && !content ? (totvsCount ? `${totvsCount}+` : '–') : materialCount}
                        label={materialCount === 1 ? 'material' : 'materiais'}
                        loading={isContentLoading}
                      />
                    </span>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      ) : totvs.isSuccess && (!connection.connected || overview.isSuccess) ? (
        <section className="content-surface px-5 py-10 text-center">
          <h2 className="text-base font-extrabold text-gray-950 dark:text-white">Nenhuma disciplina atual</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Não há materiais disponíveis nas fontes consultadas para o período atual.</p>
        </section>
      ) : null}

      <PullToRefresh onRefresh={refresh} />
    </PageTransition>
  )
}
