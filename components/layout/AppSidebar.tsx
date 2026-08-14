"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { CalendarDays, ClipboardList, ExternalLink, GraduationCap, History, Info, Star } from "lucide-react"

import { BrandLockup, BrandMark } from "@/components/brand/BrandMark"
import { AboutDialog } from "@/components/modals/AboutDialog"
import { useSession } from "@/lib/session-provider"
import { cn } from "@/lib/utils"

const items = [
  { href: "/app/calendario", label: "Horários", icon: CalendarDays },
  { href: "/app/faltas", label: "Faltas", icon: ClipboardList },
  { href: "/app/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/app/historico", label: "Histórico", icon: History },
]

function DesktopNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Navegação do aplicativo" className="space-y-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
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
  return (
    <nav aria-label="Navegação principal" className="grid grid-cols-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition-[transform,color,background-color] duration-200 active:scale-95",
              active ? "text-primary-700 dark:text-primary-300" : "text-gray-500 dark:text-gray-400",
            )}
          >
            {active ? <span className="absolute inset-x-2 inset-y-1 rounded-2xl bg-primary/[0.09]" aria-hidden="true" /> : null}
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
    <div className="mobile-safe-bottom fixed inset-x-3 bottom-2 z-40 lg:hidden">
      <div className="liquid-panel mx-auto max-w-md rounded-[1.4rem] p-1 shadow-[0_20px_55px_-24px_rgba(15,23,42,0.7)] dark:shadow-[0_24px_60px_-26px_rgba(0,0,0,0.95)]">
        <MobileNavLinks />
      </div>
    </div>
  )
}

export function AppSidebar() {
  const { user } = useSession()
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/70 bg-white/58 px-4 pb-5 pt-5 backdrop-blur-2xl dark:border-white/[0.07] dark:bg-gray-950/72 lg:flex">
        <Link href="/app/calendario" className="flex min-h-14 items-center rounded-2xl px-2 focus-visible:outline-none">
          <BrandLockup />
        </Link>

        <div className="mb-7 mt-4 h-px bg-gradient-to-r from-transparent via-gray-300/90 to-transparent dark:via-white/10" aria-hidden="true" />

        <DesktopNav />

        <div className="mt-auto space-y-2">
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gray-950/[0.035] px-3 py-3 dark:bg-white/[0.035]">
            <BrandMark className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Conta acadêmica</p>
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{user?.ra ? `RA ${user.ra}` : "Sessão ativa"}</p>
            </div>
          </div>
          <a
            href="https://fundacaoeducacional132827.rm.cloudtotvs.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="native-control flex w-full items-center gap-3 px-3 text-xs font-bold"
          >
            <GraduationCap className="size-4 text-primary" aria-hidden="true" />
            Portal oficial
            <ExternalLink className="ml-auto size-3.5 text-gray-400" aria-hidden="true" />
          </a>
          <button type="button" onClick={() => setIsAboutOpen(true)} className="native-control flex w-full items-center gap-3 px-3 text-xs font-bold">
            <Info className="size-4 text-primary" aria-hidden="true" />
            Sobre e instalar
          </button>
        </div>
      </aside>
      <AboutDialog open={isAboutOpen} onOpenChange={setIsAboutOpen} />
    </>
  )
}
