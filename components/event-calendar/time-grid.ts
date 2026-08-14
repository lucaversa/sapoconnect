import { differenceInMinutes, getHours, getMinutes } from "date-fns"

export function getCalendarHours(startHour: number, endHour: number) {
  return Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index)
}

export function getCalendarEventPosition(
  start: Date,
  end: Date,
  { startHour, hourHeight }: { startHour: number; hourHeight: number },
) {
  const startMinutes = (getHours(start) - startHour) * 60 + getMinutes(start)
  const durationMinutes = Math.max(30, differenceInMinutes(end, start))

  return {
    top: Math.max(0, (startMinutes / 60) * hourHeight),
    height: Math.max(44, (durationMinutes / 60) * hourHeight),
  }
}
