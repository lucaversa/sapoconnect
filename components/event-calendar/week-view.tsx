"use client"

import { useMemo } from "react"
import { addDays, format, isToday, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { EndHour, StartHour, WeekCellsHeight } from "./constants"
import { EventItem } from "./event-item"
import { useCurrentTimeIndicator } from "./hooks/use-current-time-indicator"
import { getCalendarEventPosition, getCalendarHours } from "./time-grid"
import type { CalendarEvent } from "./types"
import { getAgendaEventsForDay } from "./utils"

const GRID_HEIGHT = (EndHour - StartHour) * WeekCellsHeight

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
}

export function WeekView({ currentDate, events, onEventSelect }: WeekViewProps) {
  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [currentDate])
  const hours = useMemo(() => getCalendarHours(StartHour, EndHour), [])
  const { currentTimePosition, currentTimeVisible } = useCurrentTimeIndicator(currentDate, "week")

  return (
    <div data-calendar-scroll className="no-scrollbar touch-auto overflow-x-auto overscroll-x-contain" aria-label="Grade semanal; deslize horizontalmente para ver todos os dias">
      <div className="min-w-[880px]">
        <div className="sticky top-0 z-20 grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] border-b border-gray-200/70 bg-white/88 backdrop-blur-xl dark:border-white/[0.07] dark:bg-gray-900/88">
          <div data-time-axis className="sticky left-0 z-30 flex items-center justify-center border-r border-gray-200/70 bg-white text-[10px] font-semibold text-gray-400 dark:border-white/[0.07] dark:bg-gray-900">Horário</div>
          {days.map((day) => (
            <header key={day.toISOString()} className={cn("border-r border-gray-200/70 px-2 py-3 text-center last:border-r-0 dark:border-white/[0.07]", isToday(day) && "bg-primary/[0.07]") }>
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-gray-500 dark:text-gray-400">{format(day, "EEE", { locale: ptBR })}</p>
              <span className={cn("mx-auto mt-1.5 flex size-8 items-center justify-center rounded-xl text-sm font-extrabold", isToday(day) ? "bg-primary text-white shadow-[0_10px_20px_-12px_rgba(0,172,147,0.9)]" : "text-gray-900 dark:text-white")}>{format(day, "d")}</span>
            </header>
          ))}
        </div>

        <div className="grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))]">
          <div data-time-axis className="sticky left-0 z-20 relative border-r border-gray-200/70 bg-white dark:border-white/[0.07] dark:bg-gray-900" style={{ height: GRID_HEIGHT }}>
            {hours.map((hour) => (
              <time key={hour} className="absolute right-2 z-10 -translate-y-1/2 bg-white px-1 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-gray-900 dark:text-gray-400" style={{ top: hour === StartHour ? 10 : hour === EndHour ? GRID_HEIGHT - 10 : (hour - StartHour) * WeekCellsHeight }}>
                {hour.toString().padStart(2, "0")}:00
              </time>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = getAgendaEventsForDay(events, day)
            return (
              <section
                key={day.toISOString()}
                className={cn("relative border-r border-gray-200/70 last:border-r-0 dark:border-white/[0.07]", isToday(day) && "bg-primary/[0.025]")}
                style={{ height: GRID_HEIGHT }}
                aria-label={`${format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${dayEvents.length} aulas`}
              >
                <div className="pointer-events-none absolute inset-0">
                  {hours.map((hour) => (
                    <div key={hour} className="absolute inset-x-0 border-t border-gray-200/65 dark:border-white/[0.055]" style={{ top: (hour - StartHour) * WeekCellsHeight }}>
                      {hour < EndHour ? <span className="absolute inset-x-0 border-t border-dashed border-gray-200/35 dark:border-white/[0.03]" style={{ top: WeekCellsHeight / 2 }} /> : null}
                    </div>
                  ))}
                </div>
                {currentTimeVisible && currentTimePosition >= 0 && currentTimePosition <= 100 && isToday(day) ? (
                  <div className="pointer-events-none absolute inset-x-0 z-20 border-t border-primary" style={{ top: `${currentTimePosition}%` }} aria-hidden="true">
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-primary" />
                  </div>
                ) : null}
                {dayEvents.map((event) => {
                  const position = getCalendarEventPosition(new Date(event.start), new Date(event.end), { startHour: StartHour, hourHeight: WeekCellsHeight })
                  return (
                    <div key={event.id} className="absolute inset-x-1 z-10" style={{ top: position.top + 3, height: position.height - 6 }}>
                      <EventItem event={event} view="week" showTime onClick={() => onEventSelect(event)} />
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
