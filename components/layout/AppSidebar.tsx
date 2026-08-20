"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenCheck, CalendarDays, ClipboardList, History, Star } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { BrandLockup } from "@/components/brand/BrandMark"
import { cn } from "@/lib/utils"

const items = [
  { href: "/app/calendario", label: "Horários", icon: CalendarDays },
  { href: "/app/faltas", label: "Faltas", icon: ClipboardList },
  { href: "/app/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/app/ava", label: "AVA", icon: BookOpenCheck },
  { href: "/app/historico", label: "Histórico", icon: History },
]

function DesktopNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Navegação do aplicativo" className="space-y-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl border px-3.5 text-sm font-bold transition-[transform,background-color,border-color,color] duration-200 active:scale-[0.985]",
              active
                ? "border-white/80 bg-white/72 text-primary-800 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_14px_28px_-22px_rgba(0,172,147,.6)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-white/[0.07] dark:text-primary-300"
                : "border-transparent text-gray-600 hover:translate-x-0.5 hover:border-white/70 hover:bg-white/45 hover:text-gray-950 dark:text-gray-300 dark:hover:border-white/[0.07] dark:hover:bg-white/[0.04] dark:hover:text-white",
            )}
          >
            {active ? <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary" /> : null}
            <span className={cn("flex size-8 items-center justify-center transition-colors", active ? "text-primary" : "text-gray-500 group-hover:text-primary") }>
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function MobileNavLinks() {
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()
  return (
    <nav aria-label="Navegação principal" className="grid grid-cols-5 gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-[1.2rem] text-[10px] font-bold transition-[transform,color] duration-200 active:scale-95",
              active ? "text-primary-700 dark:text-primary-300" : "text-gray-500 dark:text-gray-400",
            )}
          >
            {active ? (
              <motion.span
                layoutId="mobile-nav-active"
                className="liquid-nav-lens"
                transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                aria-hidden="true"
              />
            ) : null}
            <Icon className={cn("relative size-5", active && "drop-shadow-[0_5px_8px_rgba(0,172,147,0.24)]")} aria-hidden="true" />
            <span className="relative">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function MobileNav() {
  return (
    <div className="mobile-dock-viewport pointer-events-none lg:hidden" data-mobile-dock>
      <div className="liquid-float liquid-dock pointer-events-auto mx-auto max-w-md">
        <MobileNavLinks />
      </div>
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/70 bg-white/58 px-4 pb-5 pt-5 backdrop-blur-2xl dark:border-white/[0.07] dark:bg-gray-950/72 lg:flex">
      <Link href="/app/calendario" className="flex min-h-14 items-center rounded-2xl px-2 focus-visible:outline-none">
        <BrandLockup />
      </Link>

      <div className="mb-7 mt-4 h-px bg-gradient-to-r from-transparent via-gray-300/90 to-transparent dark:via-white/10" aria-hidden="true" />

      <DesktopNav />
    </aside>
  )
}
