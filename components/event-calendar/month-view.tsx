"use client"

import { useMemo } from "react"
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { EventItem } from "./event-item"
import type { CalendarEvent } from "./types"
import { getAgendaEventsForDay } from "./utils"

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
}

export function MonthView({ currentDate, events, onEventSelect }: MonthViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
    })
  }, [currentDate])
  const weekdays = useMemo(() => days.slice(0, 7), [days])

  return (
    <div data-calendar-scroll className="touch-auto overflow-x-auto overscroll-x-contain">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-gray-200/70 dark:border-white/[0.07]">
          {weekdays.map((day) => (
            <div key={day.toISOString()} className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
              {format(day, "EEE", { locale: ptBR })}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const allDayEvents = getAgendaEventsForDay(events, day)
            const dayEvents = allDayEvents.slice(0, 3)
            const remaining = allDayEvents.length - dayEvents.length
            return (
              <section key={day.toISOString()} className={cn("min-h-32 border-b border-r border-gray-200/65 p-1.5 dark:border-white/[0.055]", !isSameMonth(day, currentDate) && "bg-gray-100/35 text-gray-400 dark:bg-white/[0.012]") }>
                <span className={cn("flex size-7 items-center justify-center rounded-xl text-xs font-bold", isToday(day) ? "bg-primary text-white shadow-[0_8px_18px_-10px_rgba(0,172,147,0.9)]" : "text-gray-700 dark:text-gray-200")}>{format(day, "d")}</span>
                <div className="mt-1 space-y-1">
                  {dayEvents.map((event) => <div key={event.id} className="h-6"><EventItem event={event} view="month" onClick={() => onEventSelect(event)} /></div>)}
                  {remaining > 0 ? <p className="px-1 text-[10px] font-bold text-gray-500">+{remaining} mais</p> : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
