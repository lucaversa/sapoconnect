"use client"

import { useEffect, useMemo, useState } from "react"
import { RiCalendarCheckLine } from "@remixicon/react"
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isSameMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AgendaDaysToShow,
  AgendaView,
  CalendarEvent,
  CalendarView,
  DayView,
  EventGap,
  EventHeight,
  EventViewDialog,
  MonthView,
  WeekCellsHeight,
  WeekView,
} from "@/components/event-calendar"

const LABELS = {
  today: "Hoje",
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Agenda",
} as const

const VIEW_NAMES: Record<CalendarView, string> = {
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Agenda",
}

export interface EventCalendarProps {
  events?: CalendarEvent[]
  className?: string
  initialView?: CalendarView
}

export function EventCalendar({
  events = [],
  className,
  initialView = "week",
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>(initialView)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleViewChange = (newView: CalendarView) => {
    setView(newView)
    setIsDropdownOpen(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (
        isEventDialogOpen ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      switch (e.key.toLowerCase()) {
        case "m":
          setView("month")
          break
        case "s":
          setView("week")
          break
        case "d":
          setView("day")
          break
        case "a":
          setView("agenda")
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isEventDialogOpen])

  const handlePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1))
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, -1))
    } else if (view === "agenda") {
      setCurrentDate(addDays(currentDate, -AgendaDaysToShow))
    }
  }

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1))
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, 1))
    } else if (view === "agenda") {
      setCurrentDate(addDays(currentDate, AgendaDaysToShow))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsEventDialogOpen(true)
  }

  const viewTitle = useMemo(() => {
    const formatShort = (date: Date) => {
        const month = format(date, "MMM", { locale: ptBR }).replace(".", "")
      const year = format(date, "yy")
      return `${month}/${year}`
    }

    if (view === "month") {
      return formatShort(currentDate)
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      if (isSameMonth(start, end)) {
        return formatShort(start)
      } else {
        return `${format(start, "MMM", { locale: ptBR }).replace(".", "")} - ${formatShort(end)}`
      }
    } else if (view === "day") {
      return (
        <>
          <span className="sm:hidden" aria-hidden="true">
            {format(currentDate, "dd/MM")}
          </span>
          <span className="max-sm:hidden">
            {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
        </>
      )
    } else if (view === "agenda") {
      const start = currentDate
      const end = addDays(currentDate, AgendaDaysToShow - 1)

      if (isSameMonth(start, end)) {
        return formatShort(start)
      } else {
        return `${format(start, "MMM", { locale: ptBR }).replace(".", "")} - ${formatShort(end)}`
      }
    } else {
      return formatShort(currentDate)
    }
  }, [currentDate, view])

  return (
    <div
      className="flex flex-col rounded-lg border has-data-[slot=month-view]:flex-1"
      style={
        {
          "--event-height": `${EventHeight}px`,
          "--event-gap": `${EventGap}px`,
          "--week-cells-height": `${WeekCellsHeight}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "flex items-center justify-between p-2 sm:p-4",
          className
        )}
      >
        <div className="flex items-center gap-1 sm:gap-4">
          <Button
            variant="outline"
            className="max-[479px]:aspect-square max-[479px]:p-0!"
            onClick={handleToday}
            aria-label="Ir para hoje"
          >
            <RiCalendarCheckLine size={16} aria-hidden="true" />
            <span className="sr-only">Ir para hoje</span>
          </Button>
          <div className="flex items-center sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              aria-label="Anterior"
            >
              <ChevronLeftIcon size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              aria-label="Proximo"
            >
              <ChevronRightIcon size={16} aria-hidden="true" />
            </Button>
          </div>
          <h2 className="text-sm font-semibold sm:text-lg md:text-xl capitalize">
            {viewTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5 max-[479px]:h-8">
                <span>
                  <span className="min-[480px]:hidden" aria-hidden="true">
                    {VIEW_NAMES[view].charAt(0)}
                  </span>
                  <span className="max-[479px]:sr-only">
                    {VIEW_NAMES[view]}
                  </span>
                </span>
                <ChevronDownIcon
                  className="-me-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
              <DropdownMenuItem onClick={() => handleViewChange("month")}>
                {LABELS.month} <DropdownMenuShortcut>M</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange("week")}>
                {LABELS.week} <DropdownMenuShortcut>S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange("day")}>
                {LABELS.day} <DropdownMenuShortcut>D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange("agenda")}>
                {LABELS.agenda} <DropdownMenuShortcut>A</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onEventSelect={handleEventSelect}
            onEventCreate={() => {}}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onEventSelect={handleEventSelect}
            onEventCreate={() => {}}
          />
        )}
        {view === "day" && (
          <DayView
            currentDate={currentDate}
            events={events}
            onEventSelect={handleEventSelect}
            onEventCreate={() => {}}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            currentDate={currentDate}
            events={events}
            onEventSelect={handleEventSelect}
          />
        )}
      </div>

      <EventViewDialog
        event={selectedEvent}
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false)
          setSelectedEvent(null)
        }}
      />
    </div>
  )
}
