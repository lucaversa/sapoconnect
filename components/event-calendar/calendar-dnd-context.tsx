"use client"

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { addMinutes, differenceInMinutes } from "date-fns"

import { EventItem, type CalendarEvent } from "@/components/event-calendar"

type CalendarDndContextType = {
  activeEvent: CalendarEvent | null
  activeId: UniqueIdentifier | null
  activeView: "month" | "week" | "day" | null
  currentTime: Date | null
  eventHeight: number | null
  isMultiDay: boolean
  multiDayWidth: number | null
  dragHandlePosition: {
    x?: number
    y?: number
    data?: {
      isFirstDay?: boolean
      isLastDay?: boolean
    }
  } | null
}

const CalendarDndContext = createContext<CalendarDndContextType>({
  activeEvent: null,
  activeId: null,
  activeView: null,
  currentTime: null,
  eventHeight: null,
  isMultiDay: false,
  multiDayWidth: null,
  dragHandlePosition: null,
})

export const useCalendarDnd = () => useContext(CalendarDndContext)

interface CalendarDndProviderProps {
  children: ReactNode
  onEventUpdate: (event: CalendarEvent) => void
}

export function CalendarDndProvider({
  children,
  onEventUpdate,
}: CalendarDndProviderProps) {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [activeView, setActiveView] = useState<"month" | "week" | "day" | null>(
    null
  )
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [eventHeight, setEventHeight] = useState<number | null>(null)
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [multiDayWidth, setMultiDayWidth] = useState<number | null>(null)
  const [dragHandlePosition, setDragHandlePosition] = useState<{
    x?: number
    y?: number
    data?: {
      isFirstDay?: boolean
      isLastDay?: boolean
    }
  } | null>(null)

    const eventDimensions = useRef<{ height: number }>({ height: 0 })

    const sensors = useSensors(
    useSensor(MouseSensor, {
        activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
        activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
          activationConstraint: {
        distance: 5,
      },
    })
  )

    const dndContextId = useId()

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event

      if (!active.data.current) {
        return
    }

    const {
      event: calendarEvent,
      view,
      height,
      isMultiDay: eventIsMultiDay,
      multiDayWidth: eventMultiDayWidth,
      dragHandlePosition: eventDragHandlePosition,
    } = active.data.current as {
      event: CalendarEvent
      view: "month" | "week" | "day"
      height?: number
      isMultiDay?: boolean
      multiDayWidth?: number
      dragHandlePosition?: {
        x?: number
        y?: number
        data?: {
          isFirstDay?: boolean
          isLastDay?: boolean
        }
      }
    }

    setActiveEvent(calendarEvent)
    setActiveId(active.id)
    setActiveView(view)
    setCurrentTime(new Date(calendarEvent.start))
    setIsMultiDay(eventIsMultiDay || false)
    setMultiDayWidth(eventMultiDayWidth || null)
    setDragHandlePosition(eventDragHandlePosition || null)

      if (height) {
      eventDimensions.current.height = height
      setEventHeight(height)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event

    if (over && activeEvent && over.data.current) {
      const { date, time } = over.data.current as { date: Date; time?: number }

        if (time !== undefined && activeView !== "month") {
        const newTime = new Date(date)

          const hours = Math.floor(time)
        const fractionalHour = time - hours

            let minutes = 0
        if (fractionalHour < 0.125) minutes = 0
        else if (fractionalHour < 0.375) minutes = 15
        else if (fractionalHour < 0.625) minutes = 30
        else minutes = 45

        newTime.setHours(hours, minutes, 0, 0)

            if (
          !currentTime ||
          newTime.getHours() !== currentTime.getHours() ||
          newTime.getMinutes() !== currentTime.getMinutes() ||
          newTime.getDate() !== currentTime.getDate() ||
          newTime.getMonth() !== currentTime.getMonth() ||
          newTime.getFullYear() !== currentTime.getFullYear()
        ) {
          setCurrentTime(newTime)
        }
      } else if (activeView === "month") {
        const newTime = new Date(date)
        if (currentTime) {
          newTime.setHours(
            currentTime.getHours(),
            currentTime.getMinutes(),
            currentTime.getSeconds(),
            currentTime.getMilliseconds()
          )
        }

            if (
          !currentTime ||
          newTime.getDate() !== currentTime.getDate() ||
          newTime.getMonth() !== currentTime.getMonth() ||
          newTime.getFullYear() !== currentTime.getFullYear()
        ) {
          setCurrentTime(newTime)
        }
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

        if (!over || !activeEvent || !currentTime) {
        setActiveEvent(null)
      setActiveId(null)
      setActiveView(null)
      setCurrentTime(null)
      setEventHeight(null)
      setIsMultiDay(false)
      setMultiDayWidth(null)
      setDragHandlePosition(null)
      return
    }

    try {
      if (!active.data.current || !over.data.current) {
        throw new Error("Missing data in drag event")
      }

      const activeData = active.data.current as {
        event?: CalendarEvent
        view?: string
      }
      const overData = over.data.current as { date?: Date; time?: number }

        if (!activeData.event || !overData.date) {
        throw new Error("Missing required event data")
      }

      const calendarEvent = activeData.event
      const date = overData.date
      const time = overData.time

        const newStart = new Date(date)

        if (time !== undefined) {
        const hours = Math.floor(time)
        const fractionalHour = time - hours

            let minutes = 0
        if (fractionalHour < 0.125) minutes = 0
        else if (fractionalHour < 0.375) minutes = 15
        else if (fractionalHour < 0.625) minutes = 30
        else minutes = 45

        newStart.setHours(hours, minutes, 0, 0)
      } else {
        newStart.setHours(
          currentTime.getHours(),
          currentTime.getMinutes(),
          currentTime.getSeconds(),
          currentTime.getMilliseconds()
        )
      }

          const originalStart = new Date(calendarEvent.start)
      const originalEnd = new Date(calendarEvent.end)
      const durationMinutes = differenceInMinutes(originalEnd, originalStart)
      const newEnd = addMinutes(newStart, durationMinutes)

        const hasStartTimeChanged =
        originalStart.getFullYear() !== newStart.getFullYear() ||
        originalStart.getMonth() !== newStart.getMonth() ||
        originalStart.getDate() !== newStart.getDate() ||
        originalStart.getHours() !== newStart.getHours() ||
        originalStart.getMinutes() !== newStart.getMinutes()

      if (hasStartTimeChanged) {
          onEventUpdate({
          ...calendarEvent,
          start: newStart,
          end: newEnd,
        })
      }
    } catch (error) {
    } finally {
      setActiveEvent(null)
      setActiveId(null)
      setActiveView(null)
      setCurrentTime(null)
      setEventHeight(null)
      setIsMultiDay(false)
      setMultiDayWidth(null)
      setDragHandlePosition(null)
    }
  }

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <CalendarDndContext.Provider
        value={{
          activeEvent,
          activeId,
          activeView,
          currentTime,
          eventHeight,
          isMultiDay,
          multiDayWidth,
          dragHandlePosition,
        }}
      >
        {children}

        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeEvent && activeView && (
            <div
              style={{
                height: eventHeight ? `${eventHeight}px` : "auto",
                width:
                  isMultiDay && multiDayWidth ? `${multiDayWidth}%` : "100%",
                }}
            >
              <EventItem
                event={activeEvent}
                view={activeView}
                isDragging={true}
                showTime={activeView !== "month"}
                currentTime={currentTime || undefined}
                isFirstDay={dragHandlePosition?.data?.isFirstDay !== false}
                isLastDay={dragHandlePosition?.data?.isLastDay !== false}
              />
            </div>
          )}
        </DragOverlay>
      </CalendarDndContext.Provider>
    </DndContext>
  )
}
