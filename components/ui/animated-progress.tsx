"use client"

import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

const clampProgress = (value: number) => Math.min(100, Math.max(0, value))
const PROGRESS_VIEWPORT = { once: true, amount: 0.6 } as const

type AnimatedProgressProps = {
  value: number
  ariaLabel: string
  className?: string
  indicatorClassName?: string
  delay?: number
}

export function AnimatedProgress({
  value,
  ariaLabel,
  className,
  indicatorClassName,
  delay = 0.08,
}: AnimatedProgressProps) {
  const reduced = useReducedMotion()
  const normalized = clampProgress(value)

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalized)}
      className={cn(
        "overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/[0.08]",
        className,
      )}
    >
      <motion.div
        initial={reduced ? false : { scaleX: 0 }}
        animate={reduced ? { scaleX: normalized / 100 } : undefined}
        whileInView={reduced ? undefined : { scaleX: normalized / 100 }}
        viewport={PROGRESS_VIEWPORT}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 120, damping: 20, mass: 0.8, delay }
        }
        className={cn(
          "h-full w-full origin-left rounded-full bg-primary will-change-transform",
          indicatorClassName,
        )}
      />
    </div>
  )
}

export type AnimatedProgressSegment = {
  value: number
  className: string
  label: string
}

type AnimatedSegmentedProgressProps = {
  segments: AnimatedProgressSegment[]
  ariaLabel: string
  className?: string
}

export function AnimatedSegmentedProgress({
  segments,
  ariaLabel,
  className,
}: AnimatedSegmentedProgressProps) {
  const reduced = useReducedMotion()

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "flex overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/[0.08]",
        className,
      )}
    >
      {segments.map((segment, index) => {
        const normalized = clampProgress(segment.value)

        return (
          <motion.div
            key={segment.label}
            layout={!reduced}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 120, damping: 20, mass: 0.8 }
            }
            style={{ width: `${normalized}%` }}
            className="h-full overflow-hidden"
          >
            <motion.div
              initial={reduced ? false : { scaleX: 0 }}
              animate={reduced ? { scaleX: 1 } : undefined}
              whileInView={reduced ? undefined : { scaleX: 1 }}
              viewport={PROGRESS_VIEWPORT}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 120,
                      damping: 20,
                      mass: 0.8,
                      delay: 0.08 + index * 0.07,
                    }
              }
              className={cn(
                "h-full w-full origin-left will-change-transform",
                segment.className,
              )}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
