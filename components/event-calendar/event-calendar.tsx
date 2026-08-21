"use client"

import { useMemo, useRef, useState, useSyncExternalStore, type TouchEvent } from "react"
import { addDays, addMonths, addWeeks, endOfWeek, format, isSameMonth, startOfWeek, subMonths, subWeeks } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { AgendaDaysToShow } from "./constants"
import { AgendaView } from "./agenda-view"
import { DayView } from "./day-view"
import { EventViewDialog } from "./event-view-dialog"
import { MonthView } from "./month-view"
import type { CalendarEvent, CalendarView } from "./types"
import { WeekView } from "./week-view"

const viewNames: Record<CalendarView, string> = { agenda: "Agenda", day: "Dia", week: "Semana", month: "Mês" }
const views: CalendarView[] = ["agenda", "day", "week", "month"]

const desktopQuery = "(min-width: 640px)"

function subscribeToDesktopQuery(onChange: () => void) {
  const mediaQuery = window.matchMedia(desktopQuery)
  mediaQuery.addEventListener("change", onChange)
  return () => mediaQuery.removeEventListener("change", onChange)
}

function getDesktopSnapshot() {
  return window.matchMedia(desktopQuery).matches
}

export interface EventCalendarProps {
  events?: CalendarEvent[]
  className?: string
  initialView?: CalendarView
  desktopInitialView?: CalendarView
}

export function EventCalendar({
  events = [],
  className,
  initialView = "week",
  desktopInitialView,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const isDesktop = useSyncExternalStore(subscribeToDesktopQuery, getDesktopSnapshot, () => false)
  const [selectedView, setSelectedView] = useState<CalendarView | null>(null)
  const view = selectedView ?? (isDesktop && desktopInitialView ? desktopInitialView : initialView)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false)
  const reducedMotion = useReducedMotion()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const move = (direction: -1 | 1) => {
    setCurrentDate((date) => {
      if (view === "month") return direction === 1 ? addMonths(date, 1) : subMonths(date, 1)
      if (view === "week") return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1)
      return addDays(date, direction * (view === "agenda" ? AgendaDaysToShow : 1))
    })
  }

  const viewTitle = useMemo(() => {
    if (view === "day") return format(currentDate, "EEE, d 'de' MMM", { locale: ptBR })
    if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      return isSameMonth(start, end)
        ? format(start, "MMMM yyyy", { locale: ptBR })
        : `${format(start, "d MMM", { locale: ptBR })} - ${format(end, "d MMM", { locale: ptBR })}`
    }
    return format(currentDate, "MMMM yyyy", { locale: ptBR })
  }, [currentDate, view])

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (
      event.touches.length !== 1
      || event.target instanceof HTMLElement && event.target.closest("button, [role=button], [data-calendar-scroll]")
    ) return
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.changedTouches.length !== 1) return
    const touch = event.changedTouches[0]
    const x = touch.clientX - start.x
    const y = touch.clientY - start.y
    if (Math.abs(x) >= 48 && Math.abs(x) > Math.abs(y) * 1.2) move(x < 0 ? 1 : -1)
  }

  const selectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsEventDialogOpen(true)
  }

  return (
    <section
      className={cn("academic-panel overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStart.current = null }}
    >
      <header className="relative z-30 border-b border-white/70 bg-white/36 px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02] sm:px-4 sm:py-3">
        <div className="sm:hidden">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-base font-semibold text-gray-900 first-letter:uppercase dark:text-white">{viewTitle}</h2>
            <div className="relative shrink-0">
              <button type="button" onClick={() => setIsViewMenuOpen((open) => !open)} className="native-control flex h-10 min-h-0 items-center gap-1 px-3 text-sm font-bold" aria-expanded={isViewMenuOpen}>
                {viewNames[view]} <ChevronDown className="h-4 w-4" />
              </button>
              {isViewMenuOpen && <div className="liquid-float absolute right-0 z-40 mt-2 w-36 rounded-2xl p-1.5">{views.map((option) => <button key={option} type="button" onClick={() => { setSelectedView(option); setIsViewMenuOpen(false) }} className={cn("liquid-menu-item flex h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold", view === option ? "border-white/70 bg-gray-950 text-white dark:border-white/10 dark:bg-white dark:text-gray-950" : "text-gray-700 dark:text-gray-200")}>{viewNames[option]}</button>)}</div>}
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <button type="button" onClick={() => setCurrentDate(new Date())} className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-bold text-primary-700 transition-colors motion-reduce:transition-none hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-300">
              <CalendarDays className="h-5 w-5" aria-hidden="true" /> Hoje
            </button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(-1)} className="native-control flex size-10 min-h-0 items-center justify-center p-0" aria-label="Período anterior"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => move(1)} className="native-control flex size-10 min-h-0 items-center justify-center p-0" aria-label="Próximo período"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
        <div className="hidden min-w-0 items-center justify-between gap-2 sm:flex">
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" onClick={() => setCurrentDate(new Date())} className="native-control flex size-11 min-h-0 shrink-0 items-center justify-center p-0 text-primary" aria-label="Ir para hoje"><CalendarDays className="h-5 w-5" /></button>
            <button type="button" onClick={() => move(-1)} className="native-control flex size-11 min-h-0 shrink-0 items-center justify-center p-0" aria-label="Período anterior"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => move(1)} className="native-control flex size-11 min-h-0 shrink-0 items-center justify-center p-0" aria-label="Próximo período"><ChevronRight className="h-5 w-5" /></button>
            <h2 className="min-w-0 truncate px-1 text-base font-semibold text-gray-900 first-letter:uppercase dark:text-white">{viewTitle}</h2>
          </div>
          <div className="flex shrink-0 items-center rounded-2xl border border-white/70 bg-gray-100/70 p-1 dark:border-white/[0.06] dark:bg-white/[0.04]">{views.map((option) => <button key={option} type="button" onClick={() => setSelectedView(option)} className={cn("h-9 rounded-xl px-3 text-sm font-semibold transition-[background-color,color,box-shadow] motion-reduce:transition-none", view === option ? "bg-gray-950 text-white shadow-sm dark:bg-white dark:text-gray-950" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white")}>{viewNames[option]}</button>)}</div>
        </div>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={reducedMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, x: -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn("calendar-view-frame", view !== "agenda" && "calendar-page-scroll-frame")}
        >
          {view === "agenda" && <AgendaView currentDate={currentDate} events={events} onEventSelect={selectEvent} />}
          {view === "day" && <DayView currentDate={currentDate} events={events} onEventSelect={selectEvent} />}
          {view === "week" && <WeekView currentDate={currentDate} events={events} onEventSelect={selectEvent} />}
          {view === "month" && <MonthView currentDate={currentDate} events={events} onEventSelect={selectEvent} />}
        </motion.div>
      </AnimatePresence>
      <EventViewDialog event={selectedEvent} isOpen={isEventDialogOpen} onClose={() => { setIsEventDialogOpen(false); setSelectedEvent(null) }} />
    </section>
  )
}
