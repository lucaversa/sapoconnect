import { describe, expect, it } from "vitest"

import { resolveDragAxis } from "@/components/event-calendar/hooks/use-mobile-horizontal-scroll"

describe("calendar gesture direction", () => {
  it("keeps small movements pending", () => {
    expect(resolveDragAxis(3, 4)).toBe("pending")
  })

  it("reserves predominantly vertical gestures for page scrolling", () => {
    expect(resolveDragAxis(8, 30)).toBe("vertical")
    expect(resolveDragAxis(20, 20)).toBe("vertical")
  })

  it("handles predominantly horizontal gestures inside the calendar", () => {
    expect(resolveDragAxis(30, 8)).toBe("horizontal")
  })
})
