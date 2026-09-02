'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AudioLines,
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  ChevronDown,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
  Folder,
  FolderOpen,
  ImageIcon,
  Link2,
  Presentation,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

import { ApiError } from '@/components/api-error'
import { AvaSourceStatus, SourceBadge, SourceStatus } from '@/components/materials/source-status'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { AcademicPanel, AcademicPanelBody } from '@/components/ui/academic-panel'
import { PageTransition } from '@/components/ui/app-motion'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/ui/page-heading'
import { useAvaCourse, useAvaOverview } from '@/hooks/use-ava'
import { useTotvsMaterials } from '@/hooks/use-totvs-materials'
import type { AvaMaterial, AvaTask } from '@/lib/ava-types'
import { getAvaMaterialKind, type AvaMaterialKind } from '@/lib/ava-material-kind'
import { useAvaIntegration } from '@/lib/ava-integration-provider'
import { cn } from '@/lib/utils'
import { mergeMaterialSubjects } from '@/lib/materials-matching'
import { downloadTotvsMaterial } from '@/lib/download-totvs-material'
import type { TotvsMaterial } from '@/lib/totvs-materials-types'

function formatFileSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_024 ** 2) return `${(bytes / 1_024).toFixed(1).replace('.', ',')} KB`
  return `${(bytes / 1_024 ** 2).toFixed(1).replace('.', ',')} MB`
}

const MATERIAL_ICONS: Record<Exclude<AvaMaterialKind, 'pdf'>, LucideIcon> = {
  archive: FileArchive,
  audio: AudioLines,
  book: BookOpen,
  document: FileType2,
  file: File,
  folder: Folder,
  image: ImageIcon,
  link: Link2,
  page: FileText,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
  video: FileVideo,
}

const MATERIAL_ICON_STYLES: Record<AvaMaterialKind, string> = {
  archive: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  audio: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  book: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  document: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  file: 'border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-300',
  folder: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  image: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  link: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  page: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  pdf: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  presentation: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  spreadsheet: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  video: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

function MaterialKindIcon({ kind }: { kind: AvaMaterialKind }) {
  if (kind === 'pdf') {
    return <span aria-label="Arquivo PDF" className="text-[9px] font-black tracking-[-0.04em]">PDF</span>
  }

  const MaterialIcon = MATERIAL_ICONS[kind]
  return <MaterialIcon className="size-[18px]" aria-hidden="true" />
}

function TaskRow({ task }: { task: AvaTask }) {
  return (
    <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <span className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-2xl',
        task.overdue
          ? 'bg-red-500/10 text-red-600 dark:text-red-300'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}>
        <CalendarClock className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-extrabold leading-5 text-gray-950 dark:text-white">{task.name}</h3>
        <p className={cn('mt-1 text-xs font-bold', task.overdue ? 'text-red-600 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>
          {task.urgencyLabel}. {format(new Date(task.deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
        {task.description ? <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{task.description}</p> : null}
      </div>
      {task.actionUrl ? (
        <Button asChild variant="outline" size="sm" className="w-full shrink-0 gap-2 sm:w-auto">
          <a href={task.actionUrl} target="_blank" rel="noopener noreferrer">
            Abrir atividade <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </Button>
      ) : null}
    </article>
  )
}

function MaterialRow({ material, totvsFile }: { material: AvaMaterial; totvsFile?: TotvsMaterial }) {
  const [downloading, setDownloading] = useState(false)
  const size = totvsFile?.sizeLabel || formatFileSize(material.fileSize)
  const actionUrl = material.downloadUrl || material.externalUrl
  const isDownload = Boolean(material.downloadUrl)
  const materialKind = getAvaMaterialKind(material)
  const download = async () => {
    if (!totvsFile || downloading) return
    setDownloading(true)
    try {
      await downloadTotvsMaterial(totvsFile)
    } catch {
      toast.error('Não foi possível baixar o arquivo. Verifique sua conexão e tente novamente.')
    } finally {
      setDownloading(false)
    }
  }
  return (
    <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl border', MATERIAL_ICON_STYLES[materialKind])}>
        <MaterialKindIcon kind={materialKind} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-extrabold leading-5 text-gray-950 dark:text-white">{material.name}</h3>
        <p className="mt-1 break-words text-xs leading-5 text-gray-500 dark:text-gray-400">
          {[totvsFile ? null : material.typeLabel, material.fileName, size, totvsFile?.publishedAtLabel].filter(Boolean).join(' · ')}
        </p>
        {material.description ? <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{material.description}</p> : null}
      </div>
      {totvsFile ? (
        <Button variant="outline" size="sm" disabled={downloading} onClick={() => void download()} className="w-full shrink-0 gap-2 sm:w-auto" aria-label={`Baixar ${totvsFile.fileName}`}>
          {downloading ? <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
          {downloading ? 'Baixando…' : 'Baixar'}
        </Button>
      ) : actionUrl ? (
        <Button asChild variant="outline" size="sm" className="w-full shrink-0 gap-2 sm:w-auto">
          <a href={actionUrl} target={isDownload ? undefined : '_blank'} rel={isDownload ? undefined : 'noopener noreferrer'} download={isDownload ? material.fileName : undefined}>
            {isDownload ? <Download className="size-3.5" aria-hidden="true" /> : <ExternalLink className="size-3.5" aria-hidden="true" />}
            {isDownload ? 'Baixar' : 'Abrir'}
          </a>
        </Button>
      ) : null}
    </article>
  )
}

export default function AvaCoursePage() {
  const params = useParams<{ courseId: string }>()
  const parsedCourseId = Number(params.courseId)
  const numericId = /^\d+$/.test(params.courseId) && Number.isSafeInteger(parsedCourseId) && parsedCourseId > 1 ? parsedCourseId : null
  const totvsId = /^totvs-[a-f0-9]{16,64}$/.test(params.courseId) ? params.courseId.slice(6) : null
  const { connection } = useAvaIntegration()
  const overview = useAvaOverview(connection.connected)
  const totvs = useTotvsMaterials()
  const subjects = useMemo(() => mergeMaterialSubjects(overview.data?.courses ?? [], totvs.data?.courses ?? []), [overview.data?.courses, totvs.data?.courses])
  const subject = subjects.find((item) => totvsId ? item.totvsCourse?.id === totvsId : item.avaCourse?.id === numericId)
  const courseId = numericId ?? subject?.avaCourse?.id ?? null
  const totvsCourse = subject?.totvsCourse
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set())
  const detail = useAvaCourse(courseId, connection.connected)

  const toggleSection = (sectionId: number) => {
    setExpandedSections((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const refresh = async () => {
    const toastId = toast.loading('Atualizando disciplina...', { id: 'refresh-ava-course' })
    const results = await Promise.all([
      totvs.refetch(),
      ...(connection.connected ? [overview.refetch()] : []),
      ...(connection.connected && courseId ? [detail.refetch()] : []),
    ])
    const failed = results.filter((result) => result.error).length
    if (failed === results.length) toast.error('Não foi possível atualizar a disciplina.', { id: toastId })
    else if (failed) toast.warning('Atualização parcial. Uma das fontes está indisponível.', { id: toastId })
    else toast.success('Disciplina atualizada.', { id: toastId })
  }

  if (numericId === null && totvsId === null) return <ApiError error={new Error('Disciplina inválida.')} />

  const tasks = detail.data?.tasks ?? []
  const sections = detail.data?.sections ?? []
  const materialCount = sections.reduce((total, section) => total + section.materials.length, 0) + (totvsCourse?.materials.length ?? 0)
  const isFetching = totvs.isFetching || overview.isFetching || detail.isFetching

  return (
    <PageTransition className="app-page">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-2"><Link href="/app/ava"><ArrowLeft className="size-4" aria-hidden="true" /> Voltar aos materiais</Link></Button>
      <PageHeading
        icon={BookOpenCheck}
        title={detail.data?.course.fullName ?? subject?.name ?? 'Materiais da disciplina'}
        meta={detail.data || totvsCourse ? `${detail.data ? `${tasks.length} ${tasks.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'} · ` : ''}${materialCount} ${materialCount === 1 ? 'material' : 'materiais'}` : undefined}
        actions={(
          <Button variant="outline" size="icon" onClick={() => void refresh()} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex">
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        )}
        desktopActionsOnly
      />

      <AvaSourceStatus />
      {detail.isLoading || overview.isLoading ? <SourceStatus title="Buscando conteúdos do AVA…" loading /> : null}
      {detail.fetchStatus === 'paused' || overview.fetchStatus === 'paused' ? <SourceStatus title="AVA offline" description={detail.data ? 'Exibindo os conteúdos salvos. Os downloads precisam de conexão.' : 'Sem conteúdos salvos para esta disciplina. Conecte-se para consultar o AVA.'} /> : null}
      {detail.error || overview.error ? <SourceStatus title="Não foi possível atualizar o AVA" description="Os arquivos do EduConnect continuam disponíveis." retry={() => void refresh()} /> : null}

      {detail.data ? <section aria-labelledby="pending-tasks-title">
        <div className="mb-3 flex items-center gap-2"><h2 id="pending-tasks-title" className="text-sm font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">Atividades pendentes</h2><SourceBadge source="AVA" /></div>
        {tasks.length > 0 ? (
          <div className="content-list">{tasks.map((task) => <TaskRow key={task.id} task={task} />)}</div>
        ) : (
          <div className="content-surface px-5 py-7 text-center">
            <p className="text-sm font-extrabold text-gray-950 dark:text-white">Nenhuma atividade pendente</p>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">O Moodle não retornou tarefas que aguardam uma ação sua.</p>
          </div>
        )}
      </section> : null}

      <section aria-labelledby="totvs-materials-title" className="space-y-3">
        <div className="flex items-center gap-2"><h2 id="totvs-materials-title" className="text-sm font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">Arquivos da disciplina</h2><SourceBadge source="TOTVS" /></div>
        {totvs.isLoading ? <SourceStatus title="Buscando arquivos do EduConnect…" loading /> : null}
        {totvs.fetchStatus === 'paused' ? <SourceStatus title="EduConnect offline" description={totvs.data ? 'Exibindo a última lista salva. Os downloads precisam de conexão.' : 'Sem arquivos salvos para esta disciplina.'} /> : null}
        {totvs.error || totvs.data?.__cacheStale ? <SourceStatus title="Não foi possível atualizar o EduConnect" description={totvs.data ? 'Exibindo os últimos arquivos consultados.' : undefined} retry={() => void totvs.refetch()} /> : null}
        {totvsCourse?.materials.length ? (
          <div className="content-list">{totvsCourse.materials.map((file) => <MaterialRow key={file.id} totvsFile={file} material={{ id: file.id, moduleId: 0, name: file.title, fileName: file.fileName, type: 'resource', typeLabel: 'Arquivo' }} />)}</div>
        ) : totvs.data && !totvs.error && (totvsId || overview.data) ? (
          <p className="content-surface px-4 py-5 text-sm text-gray-500 dark:text-gray-400">{totvsId ? 'Esta disciplina não está mais disponível na lista atual do EduConnect.' : 'Nenhum arquivo do EduConnect associado a esta disciplina.'}</p>
        ) : numericId && !overview.isLoading && !overview.data ? (
          <p className="content-surface px-4 py-5 text-sm leading-6 text-gray-500 dark:text-gray-400">Abra a lista de <Link href="/app/ava" className="font-bold text-primary underline">materiais</Link> para consultar os arquivos do EduConnect por disciplina.</p>
        ) : null}
      </section>

      {detail.data ? <section aria-labelledby="course-materials-title" className="border-t border-gray-200/80 pt-5 dark:border-white/10">
        <div className="mb-3 flex items-center gap-2"><h2 id="course-materials-title" className="text-sm font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">Conteúdos por seção</h2><SourceBadge source="AVA" /></div>
        {sections.length > 0 ? (
          <div className="academic-stack">
            {sections.map((section) => {
              const expanded = expandedSections.has(section.id)
              const panelId = `ava-section-${section.id}`
              return (
                <AcademicPanel key={section.id} expanded={expanded}>
                  <button type="button" onClick={() => toggleSection(section.id)} aria-expanded={expanded} aria-controls={panelId} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left sm:px-5">
                    <span className="icon-orb size-10"><FolderOpen className="size-[18px]" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-extrabold text-gray-950 dark:text-white">{section.name}</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{section.materials.length} {section.materials.length === 1 ? 'material' : 'materiais'}</span>
                    </span>
                    <ChevronDown className={cn('size-5 shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <AcademicPanelBody id={panelId} className="detail-reveal divide-y divide-gray-200/75 dark:divide-white/[0.065]">
                      {section.summary ? <p className="px-4 py-3 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:px-5">{section.summary}</p> : null}
                      {section.materials.map((material) => <MaterialRow key={material.id} material={material} />)}
                    </AcademicPanelBody>
                  ) : null}
                </AcademicPanel>
              )
            })}
          </div>
        ) : (
          <div className="content-surface px-5 py-7 text-center">
            <p className="text-sm font-extrabold text-gray-950 dark:text-white">Nenhum material encontrado</p>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Pode ser que a disciplina ainda não tenha conteúdos publicados para seu grupo.</p>
          </div>
        )}
      </section> : null}
      <PullToRefresh onRefresh={refresh} />
    </PageTransition>
  )
}
