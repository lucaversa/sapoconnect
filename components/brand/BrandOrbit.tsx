"use client"

import type { LucideIcon } from "lucide-react"
import { CalendarDays, ClipboardCheck, GraduationCap, History, UsersRound } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { BrandMark } from "./BrandMark"

type BrandOrbitProps = {
  className?: string
  compact?: boolean
  priority?: boolean
}

function OrbitNode({
  icon: Icon,
  radiusX,
  radiusY,
  phase,
  tilt,
  direction,
  duration,
  reducedMotion,
}: {
  icon: LucideIcon
  radiusX: number
  radiusY: number
  phase: number
  tilt: number
  direction: 1 | -1
  duration: number
  reducedMotion: boolean | null
}) {
  const steps = 32
  const tiltInRadians = tilt * (Math.PI / 180)
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = phase + direction * ((Math.PI * 2 * index) / steps)
    const ellipseX = Math.cos(angle) * radiusX
    const ellipseY = Math.sin(angle) * radiusY

    return {
      x: ellipseX * Math.cos(tiltInRadians) - ellipseY * Math.sin(tiltInRadians),
      y: ellipseX * Math.sin(tiltInRadians) + ellipseY * Math.cos(tiltInRadians),
    }
  })

  return (
    <motion.span
      animate={reducedMotion
        ? { x: points[0].x, y: points[0].y }
        : { x: points.map((point) => point.x), y: points.map((point) => point.y) }}
      transition={{ duration, ease: "linear", repeat: reducedMotion ? 0 : Infinity }}
      className="absolute left-1/2 top-1/2 z-10 -ml-3.5 -mt-3.5 flex size-7 items-center justify-center rounded-[0.7rem] border border-white/65 bg-white/70 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_22px_-12px_rgba(0,172,147,0.8)] backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/75"
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
    </motion.span>
  )
}

export function BrandOrbit({ className, compact = false, priority = false }: BrandOrbitProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative mx-auto flex h-44 w-[17.5rem] max-w-full items-center justify-center",
        compact && "h-36 w-[15.5rem] scale-[0.84]",
        className,
      )}
    >
      <div
        data-community-orbit="outer"
        className="absolute h-[6.75rem] w-[12.75rem] -rotate-[8deg] rounded-[50%] border border-primary/25 shadow-[inset_0_0_26px_rgba(0,172,147,0.055)]"
      />
      <div
        data-community-orbit="inner"
        className="absolute h-24 w-36 rotate-[16deg] rounded-[50%] border border-dashed border-primary/35"
      />

      <OrbitNode icon={CalendarDays} radiusX={102} radiusY={54} phase={-Math.PI / 2} tilt={-8} direction={1} duration={18} reducedMotion={reducedMotion} />
      <OrbitNode icon={History} radiusX={102} radiusY={54} phase={Math.PI / 6} tilt={-8} direction={1} duration={18} reducedMotion={reducedMotion} />
      <OrbitNode icon={ClipboardCheck} radiusX={102} radiusY={54} phase={(Math.PI * 5) / 6} tilt={-8} direction={1} duration={18} reducedMotion={reducedMotion} />
      <OrbitNode icon={GraduationCap} radiusX={72} radiusY={48} phase={0} tilt={16} direction={-1} duration={12} reducedMotion={reducedMotion} />
      <OrbitNode icon={UsersRound} radiusX={72} radiusY={48} phase={Math.PI} tilt={16} direction={-1} duration={12} reducedMotion={reducedMotion} />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.75, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 19, delay: 0.1 }}
        className="relative z-20 rounded-[1.35rem] border border-white/70 bg-white/45 p-2 shadow-[0_20px_45px_-18px_rgba(0,172,147,0.75)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]"
      >
        <BrandMark className="size-16" priority={priority} />
      </motion.div>
    </div>
  )
}
