"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BookOpen, Calendar, Clock, GraduationCap, MapPin, RefreshCw, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDetalheAula } from "@/hooks/use-detalhe-aula"
import type { CalendarEvent } from "@/components/event-calendar"

interface EventViewDialogProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 px-1 py-4 sm:grid-cols-[1.5rem_6.5rem_minmax(0,1fr)] sm:gap-2.5">
      <Icon className="row-span-2 mt-0.5 size-[17px] text-primary sm:row-span-1" aria-hidden="true" />
      <p className="text-xs font-medium leading-5 text-gray-500 dark:text-gray-400">{label}</p>
      <div className="col-start-2 min-w-0 break-words text-sm font-semibold leading-5 text-gray-900 [overflow-wrap:anywhere] dark:text-white sm:col-start-auto">
        {children}
      </div>
    </section>
  )
}

export function EventViewDialog({ event, isOpen, onClose }: EventViewDialogProps) {
  const {
    data: detalhe,
    isLoading: isLoadingDetalhe,
    isFetching: isFetchingDetalhe,
    error: detalheError,
    refetch: refetchDetalhe,
  } = useDetalheAula(event?.detalheId || null)

  if (!event) return null

  const startDate = new Date(event.start)
  const endDate = new Date(event.end)
  const dayName = format(startDate, "EEEE", { locale: ptBR })
  const formattedDate = format(startDate, "d 'de' MMMM", { locale: ptBR })
  const formattedTime = `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`

  const info: Record<string, string> = {}
  event.description?.split("\n").filter(Boolean).forEach((line) => {
    if (!line.includes(":")) return
    const [key, ...valueParts] = line.split(":")
    info[key.trim().toLowerCase()] = valueParts.join(":").trim()
  })

  const professores = detalhe?.professores || []
  const hasDetalheId = Boolean(event.detalheId)
  const isProfessorLoading = isLoadingDetalhe || isFetchingDetalhe
  const hasStructuredData = Boolean(info.sala || info.predio || info["prédio"] || info.bloco || info.turma || info.código)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md sm:p-0">
        <div className="relative overflow-hidden border-b border-white/10 bg-gray-950 px-5 pb-5 pt-5 text-white sm:px-6 sm:pb-6 sm:pt-6">
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/22 blur-3xl" />
          <DialogHeader className="relative pr-10">
            <span className="inline-flex w-fit items-center gap-2 text-xs font-medium text-white/65">
              <Calendar className="size-3.5 text-primary-300" />
              <span className="first-letter:uppercase">{dayName}, {formattedDate}</span>
            </span>
            <DialogTitle className="mt-3 text-[1.45rem] font-extrabold leading-[1.1] tracking-[-0.045em] text-white">
              {event.title}
            </DialogTitle>
            <span className="mt-3 inline-flex w-fit items-center gap-2 text-sm font-bold text-primary-200">
              <Clock className="size-4" /> {formattedTime}
            </span>
          </DialogHeader>
        </div>

        <div className="no-scrollbar max-h-[62dvh] divide-y divide-gray-200/80 overflow-y-auto px-4 pb-2 dark:divide-white/[0.065] sm:px-5">
          {(info.sala || info.predio || info["prédio"] || info.bloco || event.location) ? (
            <DetailRow icon={MapPin} label="Localização">
              <p>{info.sala || event.location}</p>
              {(info.predio || info["prédio"]) ? <p className="font-medium text-gray-500 dark:text-gray-400">{info.predio || info["prédio"]}</p> : null}
              {info.bloco ? <p className="font-medium text-gray-500 dark:text-gray-400">{info.bloco}</p> : null}
            </DetailRow>
          ) : null}

          {(info.turma || info.subturma) ? (
            <DetailRow icon={Users} label="Turma">
              <p>{info.turma}</p>
              {info.subturma ? <p className="font-medium text-gray-500 dark:text-gray-400">Subturma: {info.subturma}</p> : null}
            </DetailRow>
          ) : null}

          {hasDetalheId ? (
            <DetailRow icon={GraduationCap} label={professores.length === 1 ? "Professor" : "Professores"}>
              {isProfessorLoading ? (
                <p className="font-medium text-gray-500 dark:text-gray-400">Carregando professor...</p>
              ) : professores.length ? (
                <div className="space-y-0.5">{professores.map((professor) => <p key={professor}>{professor}</p>)}</div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-gray-500 dark:text-gray-400">{detalheError ? "Não foi possível carregar o professor." : "Professor ainda não carregado."}</p>
                  <Button variant="outline" size="sm" onClick={() => void refetchDetalhe()} disabled={isProfessorLoading} className="gap-2">
                    <RefreshCw className={`size-3.5 ${isProfessorLoading ? "animate-spin" : ""}`} /> Carregar professor
                  </Button>
                </div>
              )}
            </DetailRow>
          ) : null}

          {info.código ? (
            <DetailRow icon={BookOpen} label="Código">
              <p className="font-mono text-[13px]">{info.código}</p>
            </DetailRow>
          ) : null}

          {!hasStructuredData && event.description ? (
            <DetailRow icon={BookOpen} label="Informações">
              <div className="space-y-1 font-medium text-gray-600 dark:text-gray-300">
                {event.description.split("\n").filter(Boolean).map((line) => <p key={line}>{line}</p>)}
              </div>
            </DetailRow>
          ) : null}
        </div>

      </DialogContent>
    </Dialog>
  )
}
