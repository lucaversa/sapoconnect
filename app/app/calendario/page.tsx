"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Calendar as CalendarIcon, CalendarDays, Download, RefreshCw, Sun } from "lucide-react"
import { format, formatDistanceToNow, isAfter } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { ApiError } from "@/components/api-error"
import { EmptyState } from "@/components/empty-state"
import { PageLoading } from "@/components/page-loading"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { TotvsOfflineBanner } from "@/components/totvs-offline-banner"
import { PageTransition, Stagger, StaggerItem } from "@/components/ui/app-motion"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/ui/metric-card"
import { PageHeading } from "@/components/ui/page-heading"
import type { CalendarEvent } from "@/components/event-calendar/types"
import { useHorario } from "@/hooks/use-horario"
import { useAvaOverview } from "@/hooks/use-ava"
import { useUserInfo } from "@/hooks/use-user-info"
import { useAvaIntegration } from "@/lib/ava-integration-provider"
import { isTotvsOfflineError } from "@/lib/api-response-error"
import { exportCalendarioToPDF } from "@/lib/calendar-export"
import { aulasToCalendarEvents, avaTasksToCalendarEvents } from "@/lib/event-calendar-adapter"

const EventCalendar = dynamic(
  () => import("@/components/event-calendar/event-calendar").then((module) => module.EventCalendar),
  { ssr: false, loading: () => <div className="content-surface h-80 animate-pulse motion-reduce:animate-none" /> },
)

const EventViewDialog = dynamic(
  () => import("@/components/event-calendar/event-view-dialog").then((module) => module.EventViewDialog),
  { ssr: false },
)

export default function CalendarioPage() {
  const { data, error, isLoading, isFetching, fetchStatus, refetch, dataUpdatedAt } = useHorario()
  const { connection } = useAvaIntegration()
  const avaOverview = useAvaOverview(connection.connected)
  const { ra } = useUserInfo()
  const [isExporting, setIsExporting] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)

  const handleRefresh = async () => {
    const toastId = toast.loading("Atualizando...", { id: "refresh-calendar" })
    try {
      const [result, avaResult] = await Promise.all([
        refetch(),
        connection.connected ? avaOverview.refetch() : Promise.resolve(null),
      ])
      if (result.error) throw result.error
      if (avaResult?.error) toast.warning("Horários atualizados, mas o AVA não respondeu.", { id: toastId })
      else toast.success("Atualizado com sucesso!", { id: toastId })
    } catch (refreshError) {
      if (isTotvsOfflineError(refreshError)) {
        toast.error("Sistema da TOTVS possivelmente fora do ar.", { id: toastId })
        return
      }
      toast.error("Erro ao atualizar. Tente novamente.", { id: toastId })
    }
  }

  const handleExportPDF = async () => {
    if (!data?.aulas?.length) {
      toast.error("Não há aulas para exportar.")
      return
    }
    setIsExporting(true)
    const toastId = toast.loading("Gerando PDF...")
    try {
      await exportCalendarioToPDF(data.aulas, ra)
      toast.success("PDF gerado com sucesso!", { id: toastId })
    } catch {
      toast.error("Erro ao gerar PDF. Tente novamente.", { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  const encontrarProximaAula = (): CalendarEvent | null => {
    if (!data?.aulas) return null
    const agora = new Date()
    return aulasToCalendarEvents(data.aulas).find((evento) => isAfter(new Date(evento.start), agora)) ?? null
  }

  const encontrarProximoSabado = (): CalendarEvent | null => {
    if (!data?.aulas) return null
    const agora = new Date()
    return aulasToCalendarEvents(data.aulas).find((evento) => {
      const eventDate = new Date(evento.start)
      return isAfter(eventDate, agora) && eventDate.getDay() === 6
    }) ?? null
  }

  if (isLoading && fetchStatus === "paused") {
    return (
      <EmptyState
        title="Sem dados salvos"
        description="Conecte-se uma vez e abra este módulo para disponibilizá-lo offline."
        icon="calendar"
        retry={() => void refetch()}
      />
    )
  }
  if (isLoading) return <PageLoading message="Carregando calendário..." />
  if (error && !data) return <ApiError error={error} retry={() => refetch()} />
  if (!data?.aulas?.length) return <EmptyState title="Nenhum horário encontrado" description="Não há aulas cadastradas para exibir." icon="calendar" retry={() => refetch()} />

  const eventos = [
    ...aulasToCalendarEvents(data.aulas),
    ...avaTasksToCalendarEvents(avaOverview.data?.tasks ?? []),
  ]
  const proximaAula = encontrarProximaAula()
  const proximoSabado = encontrarProximoSabado()
  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })
    : null

  return (
    <PageTransition className="app-page">
      {(error && data) || data.__cacheStale || fetchStatus === "paused" ? (
        <TotvsOfflineBanner updatedAt={data.__cacheStale ? undefined : dataUpdatedAt} onRetry={() => void refetch()} />
      ) : null}

      <div className="flex flex-col gap-5">
        <PageHeading
          icon={CalendarDays}
          title="Horários"
          meta={lastUpdatedLabel ? <span className="inline-flex items-center gap-1.5">Atualizado {lastUpdatedLabel}{isFetching ? <RefreshCw className="size-3.5 animate-spin text-primary" /> : null}</span> : undefined}
          actions={<>
            <Button onClick={handleExportPDF} disabled={isExporting || isLoading || !data.aulas.length} className="min-w-0 flex-1 gap-2 sm:flex-none" aria-label="Exportar PDF" title="Exportar horário para PDF">
              <Download className={`size-4 ${isExporting ? "animate-pulse" : ""}`} />
              <span className="truncate">{isExporting ? "Gerando PDF..." : "Exportar PDF"}</span>
            </Button>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} aria-label="Atualizar" className="hidden sm:inline-flex">
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>}
        />

        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StaggerItem>
            <MetricCard
              icon={CalendarIcon}
              label="Próxima aula"
              onClick={() => {
                if (!proximaAula) return
                setSelectedEvent(proximaAula)
                setIsEventDialogOpen(true)
              }}
              disabled={!proximaAula}
              actionHint={proximaAula ? "Ver detalhes" : undefined}
              value={proximaAula ? <span className="block break-words text-[15px] leading-5">{proximaAula.title}</span> : <span className="text-sm text-gray-400">Nenhuma programada</span>}
              detail={proximaAula ? format(new Date(proximaAula.start), "EEE, dd/MM 'às' HH:mm", { locale: ptBR }) : undefined}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={Sun}
              label="Próximo sábado letivo"
              onClick={() => {
                if (!proximoSabado) return
                setSelectedEvent(proximoSabado)
                setIsEventDialogOpen(true)
              }}
              disabled={!proximoSabado}
              actionHint={proximoSabado ? "Ver detalhes" : undefined}
              value={proximoSabado ? <span className="block break-words text-[15px] leading-5">{proximoSabado.title}</span> : <span className="text-sm text-gray-400">Nenhum programado</span>}
              detail={proximoSabado ? format(new Date(proximoSabado.start), "dd/MM 'às' HH:mm", { locale: ptBR }) : undefined}
            />
          </StaggerItem>
        </Stagger>
      </div>

      <EventCalendar events={eventos} initialView="week" desktopInitialView="week" />

      <EventViewDialog
        event={selectedEvent}
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false)
          setSelectedEvent(null)
        }}
      />
      <PullToRefresh onRefresh={handleRefresh} />
    </PageTransition>
  )
}
