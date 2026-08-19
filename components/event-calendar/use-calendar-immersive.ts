"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

const landscapeQuery = "(orientation: landscape)"
const immersiveAttribute = "data-calendar-immersive"

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>
}

type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => void
  webkitFullscreenElement?: Element | null
}

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function subscribeToLandscapeQuery(onChange: () => void) {
  const mediaQuery = window.matchMedia(landscapeQuery)
  mediaQuery.addEventListener("change", onChange)
  return () => mediaQuery.removeEventListener("change", onChange)
}

function getLandscapeSnapshot() {
  return window.matchMedia(landscapeQuery).matches
}

function getFullscreenElement() {
  const fullscreenDocument = document as WebkitFullscreenDocument
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null
}

function setDocumentImmersiveState(active: boolean) {
  if (active) {
    document.documentElement.setAttribute(immersiveAttribute, "true")
    return
  }

  document.documentElement.removeAttribute(immersiveAttribute)
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock()
  } catch {
    // Orientation locking is optional and unavailable on iOS Safari.
  }
}

async function exitNativeFullscreen() {
  const fullscreenDocument = document as WebkitFullscreenDocument
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }

  if (fullscreenDocument.webkitFullscreenElement && fullscreenDocument.webkitExitFullscreen) {
    fullscreenDocument.webkitExitFullscreen()
  }
}

export function useCalendarImmersive() {
  const [isImmersive, setIsImmersive] = useState(false)
  const isLandscape = useSyncExternalStore(subscribeToLandscapeQuery, getLandscapeSnapshot, () => false)
  const wantsImmersive = useRef(false)
  const nativeFullscreenStarted = useRef(false)

  const finishImmersive = useCallback(() => {
    wantsImmersive.current = false
    nativeFullscreenStarted.current = false
    setIsImmersive(false)
    setDocumentImmersiveState(false)
    unlockOrientation()
  }, [])

  const exitImmersive = useCallback(async () => {
    const shouldExitNativeFullscreen = nativeFullscreenStarted.current
    finishImmersive()
    if (!shouldExitNativeFullscreen) return

    try {
      await exitNativeFullscreen()
    } catch {
      // CSS keeps the exit reliable when the browser rejects the native API.
    }
  }, [finishImmersive])

  const enterImmersive = useCallback(() => {
    wantsImmersive.current = true
    setIsImmersive(true)
    setDocumentImmersiveState(true)

    void (async () => {
      const root = document.documentElement as WebkitFullscreenElement

      try {
        if (!getFullscreenElement()) {
          if (root.requestFullscreen) {
            await root.requestFullscreen({ navigationUI: "hide" })
          } else if (root.webkitRequestFullscreen) {
            await root.webkitRequestFullscreen()
          }
        }

        nativeFullscreenStarted.current = getFullscreenElement() === root
      } catch {
        // The fixed-position fallback still provides an immersive view.
      }

      if (!wantsImmersive.current) {
        if (getFullscreenElement() === root) {
          try {
            await exitNativeFullscreen()
          } catch {
            // The visual mode has already been closed.
          }
        }
        return
      }

      try {
        const orientation = screen.orientation as LockableScreenOrientation | undefined
        await orientation?.lock?.("landscape")
      } catch {
        // iOS and some browsers require the user to rotate the device manually.
      }
    })()
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (getFullscreenElement() === document.documentElement) {
        nativeFullscreenStarted.current = true
        return
      }

      if (!getFullscreenElement() && nativeFullscreenStarted.current) finishImmersive()
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
    }
  }, [finishImmersive])

  useEffect(() => {
    if (!isImmersive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exitImmersive()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [exitImmersive, isImmersive])

  useEffect(() => () => {
    const shouldExitNativeFullscreen = nativeFullscreenStarted.current
    wantsImmersive.current = false
    setDocumentImmersiveState(false)
    unlockOrientation()
    if (shouldExitNativeFullscreen) void exitNativeFullscreen().catch(() => undefined)
  }, [])

  return {
    enterImmersive,
    exitImmersive,
    isImmersive,
    isLandscape,
  }
}
