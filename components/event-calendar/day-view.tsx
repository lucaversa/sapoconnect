"use client"

import { useMemo } from "react"
import { format, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Clock3 } from "lucide-react"

import { DayCellsHeight, EndHour, StartHour } from "./constants"
import { EventItem } from "./event-item"
import { useCurrentTimeIndicator } from "./hooks/use-current-time-indicator"
import { getCalendarEventPosition, getCalendarHours } from "./time-grid"
import type { CalendarEvent } from "./types"

const GRID_HEIGHT = (EndHour - StartHour) * DayCellsHeight

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
}

export function DayView({ currentDate, events, onEventSelect }: DayViewProps) {
  const dayEvents = useMemo(
    () => events
      .filter((event) => isSameDay(currentDate, new Date(event.start)))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [currentDate, events],
  )
  const allDayEvents = dayEvents.filter((event) => event.allDay)
  const timedEvents = dayEvents.filter((event) => !event.allDay)
  const hours = useMemo(() => getCalendarHours(StartHour, EndHour), [])
  const { currentTimePosition, currentTimeVisible } = useCurrentTimeIndicator(currentDate, "day")

  return (
    <div className="calendar-day-view">
      <header className="flex items-end justify-between border-b border-gray-200/70 px-4 py-4 dark:border-white/[0.065] sm:px-5">
        <div>
          <p className="text-sm font-semibold text-primary first-letter:uppercase">{format(currentDate, "EEEE", { locale: ptBR })}</p>
          <h3 className="mt-0.5 text-xl font-bold tracking-[-0.03em] text-gray-950 first-letter:uppercase dark:text-white">
            {format(currentDate, "d 'de' MMMM", { locale: ptBR })}
          </h3>
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {dayEvents.length} {dayEvents.length === 1 ? "evento" : "eventos"}
        </span>
      </header>

      {allDayEvents.length > 0 ? (
        <section className="border-b border-gray-200/70 bg-amber-50/45 px-4 py-2 dark:border-white/[0.065] dark:bg-amber-950/10 sm:px-5" aria-label="Prazos do dia">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-800 dark:text-amber-300">Prazos</p>
          <div className="space-y-1">{allDayEvents.map((event) => <EventItem key={event.id} event={event} view="agenda" onClick={() => onEventSelect(event)} />)}</div>
        </section>
      ) : null}

      <div data-calendar-scroll className="calendar-scroll-viewport">
        <div className="grid grid-cols-[4.25rem_minmax(0,1fr)]">
          <aside data-time-axis className="sticky left-0 z-30 relative border-r border-gray-200/70 bg-white dark:border-white/[0.07] dark:bg-gray-900" style={{ height: GRID_HEIGHT }} aria-label="Horários do dia">
            {hours.map((hour) => (
              <time key={hour} className="absolute right-2 -translate-y-1/2 bg-white px-1 text-[11px] font-semibold tabular-nums text-gray-500 dark:bg-gray-900 dark:text-gray-400" style={{ top: hour === StartHour ? 10 : hour === EndHour ? GRID_HEIGHT - 10 : (hour - StartHour) * DayCellsHeight }}>
                {hour.toString().padStart(2, "0")}:00
              </time>
            ))}
          </aside>

          <section className="relative" style={{ height: GRID_HEIGHT }} aria-label={`${timedEvents.length} aulas em ${format(currentDate, "dd/MM/yyyy")}`}>
            <div className="pointer-events-none absolute inset-0">
              {hours.map((hour) => (
                <div key={hour} className="absolute inset-x-0 border-t border-gray-200/65 dark:border-white/[0.055]" style={{ top: (hour - StartHour) * DayCellsHeight }}>
                  {hour < EndHour ? <span className="absolute inset-x-0 border-t border-dashed border-gray-200/35 dark:border-white/[0.03]" style={{ top: DayCellsHeight / 2 }} /> : null}
                </div>
              ))}
            </div>

            {currentTimeVisible && currentTimePosition >= 0 && currentTimePosition <= 100 ? (
              <div className="pointer-events-none absolute inset-x-0 z-20 border-t border-primary" style={{ top: `${currentTimePosition}%` }} aria-hidden="true">
                <span className="absolute -left-1 -top-1 size-2 rounded-full bg-primary" />
              </div>
            ) : null}

            {timedEvents.map((event) => {
              const position = getCalendarEventPosition(new Date(event.start), new Date(event.end), { startHour: StartHour, hourHeight: DayCellsHeight })
              return (
                <div key={event.id} className="absolute inset-x-2 z-10" style={{ top: position.top + 4, height: position.height - 8 }}>
                  <EventItem event={event} view="day" showTime onClick={() => onEventSelect(event)} />
                </div>
              )
            })}

            {!timedEvents.length ? (
              <div className="absolute inset-x-4 top-24 flex items-center gap-3 border-l-2 border-gray-200 px-4 py-2 text-gray-500 dark:border-white/10 dark:text-gray-400">
                <Clock3 className="size-5" />
                <div><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sem aulas com horário</p><p className="text-xs">Não há aulas marcadas para esta data.</p></div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
