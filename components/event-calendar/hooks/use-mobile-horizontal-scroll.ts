"use client"

import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react"

export type DragAxis = "pending" | "horizontal" | "vertical"

export function resolveDragAxis(deltaX: number, deltaY: number, threshold = 6): DragAxis {
  const horizontalDistance = Math.abs(deltaX)
  const verticalDistance = Math.abs(deltaY)
  if (Math.max(horizontalDistance, verticalDistance) < threshold) return "pending"
  return horizontalDistance > verticalDistance ? "horizontal" : "vertical"
}

type GestureState = {
  axis: DragAxis
  pointerId: number
  startScrollLeft: number
  startX: number
  startY: number
}

export function useMobileHorizontalScroll() {
  const gesture = useRef<GestureState | null>(null)
  const suppressClick = useRef(false)

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.pointerType === "mouse" && event.button !== 0) return
    suppressClick.current = false
    gesture.current = {
      axis: "pending",
      pointerId: event.pointerId,
      startScrollLeft: event.currentTarget.scrollLeft,
      startX: event.clientX,
      startY: event.clientY,
    }
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - current.startX
    const deltaY = event.clientY - current.startY
    if (current.axis === "pending") current.axis = resolveDragAxis(deltaX, deltaY)
    if (current.axis !== "horizontal") return

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    event.currentTarget.scrollLeft = current.startScrollLeft - deltaX
    suppressClick.current = true
  }, [])

  const finishGesture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    gesture.current = null
  }, [])

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }, [])

  return {
    onClickCapture,
    onPointerCancel: finishGesture,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishGesture,
  }
}
