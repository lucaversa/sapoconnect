"use client"

import { useMemo } from "react"
import { addDays, format, isToday } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarX } from "lucide-react"

import { AgendaDaysToShow } from "./constants"
import { EventItem } from "./event-item"
import type { CalendarEvent } from "./types"
import { getAgendaEventsForDay } from "./utils"

interface AgendaViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
}

export function AgendaView({ currentDate, events, onEventSelect }: AgendaViewProps) {
  const days = useMemo(() => Array.from({ length: AgendaDaysToShow }, (_, index) => addDays(currentDate, index)), [currentDate])
  const daysWithEvents = useMemo(() => days.map((day) => ({ day, events: getAgendaEventsForDay(events, day) })).filter(({ events }) => events.length > 0), [days, events])

  if (daysWithEvents.length === 0) {
    return <div data-calendar-scroll className="calendar-scroll-viewport flex flex-col items-center justify-center px-6 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><CalendarX className="h-6 w-6" /></span><h3 className="mt-4 font-semibold text-gray-900 dark:text-white">Nenhuma aula neste período</h3><p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">Navegue para outro período para consultar sua agenda.</p></div>
  }

  return <div data-calendar-scroll className="calendar-scroll-viewport min-w-0 divide-y divide-gray-200/75 dark:divide-white/[0.065]">{daysWithEvents.map(({ day, events: dayEvents }) => <section key={day.toISOString()} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 px-4 py-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:px-5"><div className="flex min-w-0 items-baseline gap-2 sm:block"><span className={isToday(day) ? "text-2xl font-extrabold tabular-nums text-primary" : "text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white"}>{format(day, "d")}</span><div className="min-w-0"><h3 className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{isToday(day) ? "Hoje" : format(day, "EEEE", { locale: ptBR })}</h3><p className="text-xs capitalize text-gray-500 dark:text-gray-400">{format(day, "MMMM", { locale: ptBR })}</p></div></div><div className="min-w-0 max-w-full divide-y divide-gray-200/65 dark:divide-white/[0.055]">{dayEvents.map((event) => <EventItem key={event.id} event={event} view="agenda" onClick={() => onEventSelect(event)} className="rounded-none" />)}</div></section>)}</div>
}
