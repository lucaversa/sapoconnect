"use client"

import { useSyncExternalStore } from "react"

const compactCalendarQuery = "(max-width: 639px)"

function subscribeToCompactCalendar(onChange: () => void) {
  const mediaQuery = window.matchMedia(compactCalendarQuery)
  mediaQuery.addEventListener("change", onChange)
  return () => mediaQuery.removeEventListener("change", onChange)
}

function getCompactCalendarSnapshot() {
  return window.matchMedia(compactCalendarQuery).matches
}

export function useCompactCalendar() {
  return useSyncExternalStore(subscribeToCompactCalendar, getCompactCalendarSnapshot, () => true)
}
