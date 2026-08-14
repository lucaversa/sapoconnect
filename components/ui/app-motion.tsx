"use client"

import { motion, useReducedMotion, type Variants } from "motion/react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const ease = [0.22, 1, 0.36, 1] as const

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.45, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.42, delay: reduced ? 0 : delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease } },
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      variants={reduced ? undefined : listVariants}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "visible"}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div variants={reduced ? undefined : itemVariants} className={className}>
      {children}
    </motion.div>
  )
}

export function Pressable({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -3, rotateX: 0.8 }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={cn("[transform-style:preserve-3d]", className)}
    >
      {children}
    </motion.div>
  )
}
