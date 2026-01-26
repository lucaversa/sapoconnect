"use client"

import React, { useMemo } from "react"
import {
  addHours,
  areIntervalsOverlapping,
  differenceInMinutes,
  eachDayOfInterval,
  eachHourOfInterval,
  endOfWeek,
  format,
  getHours,
  getMinutes,
  isBefore,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import {
  DraggableEvent,
  DroppableCell,
  EventItem,
  isMultiDayEvent,
  useCurrentTimeIndicator,
  WeekCellsHeight,
  type CalendarEvent,
} from "@/components/event-calendar"
import { EndHour, StartHour } from "@/components/event-calendar/constants"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
  onEventCreate: (startTime: Date) => void
}

interface PositionedEvent {
  event: CalendarEvent
  top: number
  height: number
  left: number
  width: number
  zIndex: number
}

export function WeekView({
  currentDate,
  events,
  onEventSelect,
  onEventCreate,
}: WeekViewProps) {
  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: weekStart, end: weekEnd })
  }, [currentDate])

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 0 }),
    [currentDate]
  )

  const hours = useMemo(() => {
    const dayStart = startOfDay(currentDate)
    return eachHourOfInterval({
      start: addHours(dayStart, StartHour),
      end: addHours(dayStart, EndHour - 1),
    })
  }, [currentDate])

  // Get all-day events and multi-day events for the week
  const allDayEvents = useMemo(() => {
    return events
      .filter((event) => {
        return event.allDay || isMultiDayEvent(event)
      })
      .filter((event) => {
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)
        return days.some(
          (day) =>
            isSameDay(day, eventStart) ||
            isSameDay(day, eventEnd) ||
            (day > eventStart && day < eventEnd)
        )
      })
  }, [events, days])

  // Process events for each day to calculate positions
  const processedDayEvents = useMemo(() => {
    const result = days.map((day) => {
      const dayEvents = events.filter((event) => {
        if (event.allDay || isMultiDayEvent(event)) return false

        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)

        return (
          isSameDay(day, eventStart) ||
          isSameDay(day, eventEnd) ||
          (eventStart < day && eventEnd > day)
        )
      })

      const sortedEvents = [...dayEvents].sort((a, b) => {
        const aStart = new Date(a.start)
        const bStart = new Date(b.start)
        const aEnd = new Date(a.end)
        const bEnd = new Date(b.end)

        if (aStart < bStart) return -1
        if (aStart > bStart) return 1

        const aDuration = differenceInMinutes(aEnd, aStart)
        const bDuration = differenceInMinutes(bEnd, bStart)
        return bDuration - aDuration
      })

      const positionedEvents: PositionedEvent[] = []
      const dayStart = startOfDay(day)

      const columns: { event: CalendarEvent; end: Date }[][] = []

      sortedEvents.forEach((event) => {
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)

        const adjustedStart = isSameDay(day, eventStart) ? eventStart : dayStart
        const adjustedEnd = isSameDay(day, eventEnd)
          ? eventEnd
          : addHours(dayStart, 24)

        const startHour =
          getHours(adjustedStart) + getMinutes(adjustedStart) / 60
        const endHour = getHours(adjustedEnd) + getMinutes(adjustedEnd) / 60

        const top = (startHour - StartHour) * WeekCellsHeight
        const height = (endHour - startHour) * WeekCellsHeight

        let columnIndex = 0
        let placed = false

        while (!placed) {
          const col = columns[columnIndex] || []
          if (col.length === 0) {
            columns[columnIndex] = col
            placed = true
          } else {
            const overlaps = col.some((c) =>
              areIntervalsOverlapping(
                { start: adjustedStart, end: adjustedEnd },
                {
                  start: new Date(c.event.start),
                  end: new Date(c.event.end),
                }
              )
            )
            if (!overlaps) {
              placed = true
            } else {
              columnIndex++
            }
          }
        }

        const currentColumn = columns[columnIndex] || []
        columns[columnIndex] = currentColumn
        currentColumn.push({ event, end: adjustedEnd })

        const width = columnIndex === 0 ? 1 : 1 - (columnIndex * 0.1)
        const left = columnIndex === 0 ? 0 : columnIndex * 0.1

        positionedEvents.push({
          event,
          top,
          height,
          left,
          width,
          zIndex: 10 + columnIndex,
        })
      })

      return positionedEvents
    })

    return result
  }, [days, events])

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    onEventSelect(event)
  }

  const showAllDaySection = allDayEvents.length > 0
  const { currentTimePosition, currentTimeVisible } = useCurrentTimeIndicator(
    currentDate,
    "week"
  )

  return (
    <div data-slot="week-view" className="flex h-full flex-col">
      <div className="bg-background/80 border-border/70 sticky top-0 z-30 grid grid-cols-8 border-b backdrop-blur-md">
        <div className="text-muted-foreground/70 py-2 text-center text-sm">
          <span className="max-[479px]:sr-only">GMT-3</span>
        </div>
        {days.map((day) => (
          <div
            key={day.toString()}
            className="text-muted-foreground/70 py-2 text-center text-sm"
            data-today={isToday(day) || undefined}
          >
            <span className="sm:hidden flex flex-col leading-none" aria-hidden="true">
              <span className="text-xs">{format(day, "EEE", { locale: ptBR })[0]}</span>
              <span>{format(day, "d")}</span>
            </span>
            <span className="max-sm:hidden">{format(day, "EEE, dd", { locale: ptBR })}</span>
          </div>
        ))}
      </div>

      {showAllDaySection && (
        <div className="border-border/70 bg-muted/50 border-b">
          <div className="grid grid-cols-8">
            <div className="border-border/70 relative border-r">
              <span className="text-muted-foreground/70 absolute bottom-0 left-0 h-6 w-16 max-w-full pe-2 text-right text-[10px] sm:pe-4 sm:text-xs">
                Dia inteiro
              </span>
            </div>
            {days.map((day, dayIndex) => {
              const dayAllDayEvents = allDayEvents.filter((event) => {
                const eventStart = new Date(event.start)
                const eventEnd = new Date(event.end)
                return (
                  isSameDay(day, eventStart) ||
                  (day > eventStart && day < eventEnd) ||
                  isSameDay(day, eventEnd)
                )
              })

              return (
                <div
                  key={day.toString()}
                  className="border-border/70 relative border-r p-1 last:border-r-0"
                  data-today={isToday(day) || undefined}
                >
                  {dayAllDayEvents.map((event) => {
                    const eventStart = new Date(event.start)
                    const eventEnd = new Date(event.end)
                    const isFirstDay = isSameDay(day, eventStart)
                    const isLastDay = isSameDay(day, eventEnd)

                    const isFirstVisibleDay =
                      dayIndex === 0 && isBefore(eventStart, weekStart)
                    const shouldShowTitle = isFirstDay || isFirstVisibleDay

                    return (
                      <EventItem
                        key={`spanning-${event.id}`}
                        onClick={(e) => handleEventClick(event, e)}
                        event={event}
                        view="month"
                        isFirstDay={isFirstDay}
                        isLastDay={isLastDay}
                      >
                        <div
                          className={cn(
                            "truncate",
                            !shouldShowTitle && "invisible"
                          )}
                          aria-hidden={!shouldShowTitle}
                        >
                          {event.title}
                        </div>
                      </EventItem>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-8 overflow-hidden">
        <div className="border-border/70 grid auto-cols-fr border-r">
          {hours.map((hour, index) => (
            <div
              key={hour.toString()}
              className="border-border/70 relative min-h-[var(--week-cells-height)] border-b last:border-b-0"
            >
              {index > 0 && (
                <span className="bg-background text-muted-foreground/70 absolute -top-3 left-0 flex h-6 w-16 max-w-full items-center justify-end pe-2 text-[10px] sm:pe-4 sm:text-xs">
                  {format(hour, "H'h'", { locale: ptBR })}
                </span>
              )}
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={day.toString()}
            className={cn(
              "border-border/70 relative grid auto-cols-fr border-r last:border-r-0",
              isToday(day) && "border-l-2 border-l-primary border-r-2 border-r-primary"
            )}
          >
            {(processedDayEvents[dayIndex] ?? []).map((positionedEvent) => (
              <div
                key={positionedEvent.event.id}
                className="absolute z-10 px-0.5"
                style={{
                  top: `${positionedEvent.top}px`,
                  height: `${positionedEvent.height}px`,
                  left: `${positionedEvent.left * 100}%`,
                  width: `${positionedEvent.width * 100}%`,
                  zIndex: positionedEvent.zIndex,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-full w-full">
                  <DraggableEvent
                    event={positionedEvent.event}
                    view="week"
                    onClick={(e) => handleEventClick(positionedEvent.event, e)}
                    showTime
                    height={positionedEvent.height}
                  />
                </div>
              </div>
            ))}

            {currentTimeVisible && isToday(day) && (
              <div
                className="pointer-events-none absolute right-0 left-0 z-20"
                style={{ top: `${currentTimePosition}%` }}
              >
                <div className="relative flex items-center">
                  <div className="bg-primary absolute -left-1 h-2 w-2 rounded-full"></div>
                  <div className="bg-primary h-[2px] w-full"></div>
                </div>
              </div>
            )}
            {hours.map((hour) => {
              const hourValue = getHours(hour)
              return (
                <div
                  key={hour.toString()}
                  className="border-border/70 relative min-h-[var(--week-cells-height)] border-b last:border-b-0"
                >
                  {[0, 1, 2, 3].map((quarter) => {
                    const quarterHourTime = hourValue + quarter * 0.25
                    return (
                      <DroppableCell
                        key={`${hour.toString()}-${quarter}`}
                        id={`week-cell-${day.toISOString()}-${quarterHourTime}`}
                        date={day}
                        time={quarterHourTime}
                        className={cn(
                          "absolute h-[calc(var(--week-cells-height)/4)] w-full",
                          quarter === 0 && "top-0",
                          quarter === 1 &&
                            "top-[calc(var(--week-cells-height)/4)]",
                          quarter === 2 &&
                            "top-[calc(var(--week-cells-height)/4*2)]",
                          quarter === 3 &&
                            "top-[calc(var(--week-cells-height)/4*3)]"
                        )}
                        onClick={() => {
                          const startTime = new Date(day)
                          startTime.setHours(hourValue)
                          startTime.setMinutes(quarter * 15)
                          onEventCreate(startTime)
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
