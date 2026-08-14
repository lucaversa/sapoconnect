"use client"

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react"
import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

export function AcademicPanel({
  expanded = false,
  children,
  className,
  ...props
}: HTMLMotionProps<"section"> & { expanded?: boolean; children: ReactNode }) {
  const reduced = useReducedMotion()

  return (
    <motion.section
      layout={!reduced}
      transition={{ layout: { duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] } }}
      data-expanded={expanded || undefined}
      className={cn("academic-panel", className)}
      {...props}
    >
      {children}
    </motion.section>
  )
}

export function AcademicPanelBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("academic-panel-body", className)} {...props}>
      {children}
    </div>
  )
}
