"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar, Clock, MapPin, Users, BookOpen, Building, GraduationCap } from "lucide-react"
import { useDetalheAula } from "@/hooks/use-detalhe-aula"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CalendarEvent } from "@/components/event-calendar"

interface EventViewDialogProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
}

export function EventViewDialog({
  event,
  isOpen,
  onClose,
}: EventViewDialogProps) {
  // Buscar detalhes adicionais (professor) se tiver detalheId
  const { data: detalhe, isLoading: isLoadingDetalhe } = useDetalheAula(event?.detalheId || null)

  if (!event) return null

  const startDate = new Date(event.start)
  const endDate = new Date(event.end)

  const dayName = format(startDate, "EEEE", { locale: ptBR })
  const formattedDate = format(startDate, "d 'de' MMMM", { locale: ptBR })
  const formattedTime = `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`

  // Parse description para extrair informações
  const parseDescription = () => {
    if (!event.description) return {}

    const info: Record<string, string> = {}
    const lines = event.description.split("\n").filter(Boolean)

    lines.forEach((line) => {
      if (line.includes(":")) {
        const [key, ...valueParts] = line.split(":")
        info[key.trim().toLowerCase()] = valueParts.join(":").trim()
      }
    })

    return info
  }

  const info = parseDescription()
  const professores = detalhe?.professores || []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border-0">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 pt-6 pb-8">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <DialogHeader className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-white/90 text-xs font-medium mb-3 w-fit">
              <Calendar className="h-3 w-3" />
              <span className="capitalize">{dayName}, {formattedDate}</span>
            </div>
            <DialogTitle className="text-xl font-bold text-white leading-tight pr-8 text-left">
              {event.title}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-lg">
                <Clock className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white">
                  {formattedTime}
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-5">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-4">
            {/* Location */}
            {(info.sala || info.predio || info.bloco) && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                  <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Localização</p>
                  {info.sala && (
                    <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                      {info.sala}
                    </p>
                  )}
                  {info.predio && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {info.predio}
                    </p>
                  )}
                  {info.bloco && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {info.bloco}
                    </p>
                  )}
                </div>
              </div>
            )}

            {(info.turma || info.subturma) && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />

                {/* Turma */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Turma</p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                      {info.turma}
                    </p>
                    {info.subturma && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Subturma: {info.subturma}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Professor(es) */}
            {professores.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                    <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {professores.length === 1 ? 'Professor' : 'Professores'}
                    </p>
                    {isLoadingDetalhe ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                        Carregando...
                      </p>
                    ) : (
                      <div className="mt-0.5 space-y-0.5">
                        {professores.map((prof, idx) => (
                          <p key={idx} className="font-semibold text-gray-900 dark:text-white">
                            {prof}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {info.código && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />

                {/* Código */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-purple-500/20">
                    <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Código</p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-0.5 font-mono">
                      {info.código}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Fallback: show all description info if no structured data */}
            {!info.prédio && !info.turma && !info.código && event.description && (
              <div className="space-y-2 text-sm">
                {event.description.split("\n").filter(Boolean).map((line, index) => {
                  if (line.includes(":")) {
                    const [key, ...valueParts] = line.split(":")
                    const value = valueParts.join(":").trim()
                    return (
                      <div key={index} className="flex gap-2">
                        <span className="font-medium text-gray-900 dark:text-white min-w-[80px] shrink-0">
                          {key.trim()}:
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">{value}</span>
                      </div>
                    )
                  }
                  return (
                    <p key={index} className="text-gray-600 dark:text-gray-400">
                      {line}
                    </p>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button
            onClick={onClose}
            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
