"use client"

import { useMemo } from "react"
import { differenceInMinutes, getHours, getMinutes, isPast } from "date-fns"

import { cn } from "@/lib/utils"
import { getBorderRadiusClasses, getEventColorClasses } from "./utils"
import type { CalendarEvent } from "./types"

const formatTime = (date: Date) => {
  const hours = getHours(date)
  const minutes = getMinutes(date)
  return minutes === 0 ? `${hours}h` : `${hours}:${minutes.toString().padStart(2, "0")}`
}

interface EventItemProps {
  event: CalendarEvent
  view: "month" | "week" | "day" | "agenda"
  onClick?: (event: React.MouseEvent) => void
  showTime?: boolean
  isFirstDay?: boolean
  isLastDay?: boolean
  children?: React.ReactNode
  className?: string
}

/** A read-only, keyboard-accessible calendar event. */
export function EventItem({
  event,
  view,
  onClick,
  showTime,
  isFirstDay = true,
  isLastDay = true,
  children,
  className,
}: EventItemProps) {
  const start = useMemo(() => new Date(event.start), [event.start])
  const end = useMemo(() => new Date(event.end), [event.end])
  const durationMinutes = useMemo(() => differenceInMinutes(end, start), [end, start])
  const time = event.allDay ? "Dia inteiro" : `${formatTime(start)} - ${formatTime(end)}`

  if (view === "agenda") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex min-h-16 w-full max-w-full items-stretch overflow-hidden rounded-xl text-left transition-[background-color,transform] duration-200 hover:translate-x-0.5 active:scale-[0.995] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
          getEventColorClasses(event.color),
          className
        )}
        data-past-event={isPast(end) || undefined}
      >
        <span className="w-1 shrink-0 bg-current opacity-55" aria-hidden="true" />
        <span className="min-w-0 flex-1 px-3 py-3 sm:px-4">
          <span className="block break-words text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{event.title}</span>
          <span className="mt-1 block break-words text-xs font-medium leading-4 opacity-75 [overflow-wrap:anywhere]">
            {time}{event.location ? ` · ${event.location}` : ""}
          </span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 flex h-full w-full overflow-hidden border border-white/25 px-1.5 text-left font-bold transition-[filter,transform] duration-200 hover:z-10 hover:brightness-105 active:scale-[0.985] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 data-[past-event=true]:opacity-60 dark:border-white/[0.06] sm:px-2",
        getEventColorClasses(event.color),
        getBorderRadiusClasses(isFirstDay, isLastDay),
        view === "month"
          ? "items-center text-[10px] sm:text-xs"
          : view === "week"
            ? "flex-col justify-center px-1 py-0.5 text-[10px] leading-3 sm:px-2 sm:py-1 sm:text-xs sm:leading-4"
            : "flex-col py-1 text-xs",
        className
      )}
      data-past-event={isPast(end) || undefined}
    >
      {children || (
        <>
          <span className="truncate">{event.title}</span>
          {showTime && durationMinutes >= 30 && (
            <span className="truncate text-[9px] font-normal leading-3 opacity-70 sm:text-[10px]">{time}</span>
          )}
        </>
      )}
    </button>
  )
}
