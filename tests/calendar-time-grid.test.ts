import { describe, expect, it } from "vitest"

import { getCalendarEventPosition, getCalendarHours } from "@/components/event-calendar/time-grid"

describe("calendar time grid", () => {
  it("builds a complete visible hour scale", () => {
    expect(getCalendarHours(6, 23)).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    ])
  })

  it("positions lessons against the same scale used by the labels", () => {
    const position = getCalendarEventPosition(
      new Date("2026-08-14T09:30:00"),
      new Date("2026-08-14T10:20:00"),
      { startHour: 6, hourHeight: 72 },
    )

    expect(position).toEqual({ top: 252, height: 60 })
  })
})
