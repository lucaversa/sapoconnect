"use client"

import { motion, useReducedMotion } from "motion/react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: ReactNode
  detail?: ReactNode
  actionHint?: string
  className?: string
  onClick?: () => void
  disabled?: boolean
  progress?: number
  progressClassName?: string
  compact?: boolean
  tile?: boolean
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  actionHint,
  className,
  onClick,
  disabled,
  progress,
  progressClassName,
  compact = false,
  tile = false,
}: MetricCardProps) {
  const reduced = useReducedMotion()
  const interactive = Boolean(onClick) && !disabled
  const Comp = onClick ? motion.button : motion.article

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      whileHover={interactive && !reduced ? { x: 2 } : undefined}
      whileTap={interactive && !reduced ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 31 }}
      className={cn(
        "stat-tile group h-full w-full text-left",
        tile ? "p-3 sm:p-4" : "p-3.5 sm:p-[1.125rem]",
        interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        disabled && "opacity-70",
        className,
      )}
    >
      {tile ? (
        <div className="relative z-[1] flex min-h-[6.5rem] flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="icon-orb flex size-10 shrink-0 items-center justify-center" aria-hidden="true">
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 text-right text-[1.75rem] font-extrabold leading-none tracking-[-0.045em] text-gray-950 dark:text-white">
              {value}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="truncate text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>
              {actionHint ? (
                <span className="hidden text-[10px] font-bold text-primary-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-300 sm:inline">
                  {actionHint}
                </span>
              ) : null}
            </div>
            {detail ? <div className="mt-1 min-w-0 break-words text-xs leading-5 text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400">{detail}</div> : null}
            {typeof progress === "number" ? (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/[0.08]">
                <motion.div
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("h-full rounded-full bg-primary", progressClassName)}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={cn("relative z-[1] flex h-full gap-3", compact ? "items-center" : "items-start sm:gap-3.5")}>
          <span className={cn("icon-orb flex shrink-0 items-center justify-center", compact ? "size-10" : "size-9")} aria-hidden="true">
            <Icon className="size-[18px]" />
          </span>
          <div className={cn("min-w-0 flex-1", compact && "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5")}>
            <div className={cn("flex items-start justify-between gap-2", compact && "min-w-0")}>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
              {actionHint ? (
                <span className="hidden text-[10px] font-bold text-primary-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-300 sm:inline">
                  {actionHint}
                </span>
              ) : null}
            </div>
            <div className={cn(
              "min-w-0 break-words text-xl font-extrabold tracking-[-0.035em] text-gray-950 [overflow-wrap:anywhere] dark:text-white",
              compact ? "col-start-2 row-span-2 row-start-1 text-right text-[1.4rem]" : "mt-1",
            )}>{value}</div>
            {detail ? <div className={cn(
              "min-w-0 break-words text-xs leading-5 text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400",
              compact ? "col-start-1 row-start-2" : "mt-1",
            )}>{detail}</div> : null}
            {typeof progress === "number" ? (
              <div className={cn("mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/[0.08]", compact && "col-span-2 w-full")}>
                <motion.div
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("h-full rounded-full bg-primary", progressClassName)}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Comp>
  )
}
