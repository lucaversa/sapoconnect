"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { BellRing, ExternalLink, GraduationCap, Info, LogOut, Moon, MoreHorizontal, Sun } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { BrandMark } from "@/components/brand/BrandMark"
import { AboutDialog } from "@/components/modals/AboutDialog"
import { useTheme } from "@/context/ThemeContext"
import { useUserInfo } from "@/hooks/use-user-info"
import { useAcademicUpdates } from "@/lib/academic-updates-provider"
import { useSession } from "@/lib/session-provider"

type AppHeaderViewProps = {
  theme: "light" | "dark"
  toggleTheme: () => void
  logout: () => Promise<void>
  greeting?: string | null
  ra?: string | null
  unreadCount?: number
}

export function AppHeaderView({ theme, toggleTheme, logout, greeting, ra, unreadCount = 0 }: AppHeaderViewProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setIsUtilityMenuOpen(false)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const closeUtilityMenu = (restoreFocus = true) => {
    setIsUtilityMenuOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!isUtilityMenuOpen) return
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeUtilityMenu()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeUtilityMenu(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("pointerdown", handlePointerDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [isUtilityMenuOpen])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/70 bg-white/62 pt-[env(safe-area-inset-top)] backdrop-blur-2xl dark:border-white/[0.07] dark:bg-gray-950/68 lg:left-72">
        <div className="relative flex h-16 items-center gap-2.5 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <BrandMark className="size-9 lg:hidden" priority />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-[-0.025em] text-gray-950 dark:text-white">
              {greeting || "Olá"}<span className="hidden min-[360px]:inline">{ra ? `, ${ra}` : ""}</span>
            </p>
            <p className="hidden truncate text-[11px] font-medium text-gray-500 dark:text-gray-400 min-[360px]:block">Seu painel acadêmico está pronto</p>
          </div>
          <Link
            href="/app/atualizacoes"
            prefetch={false}
            aria-label={unreadCount > 0 ? `Atualizações, ${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"}` : "Atualizações"}
            className="native-control relative flex size-11 min-h-0 items-center justify-center p-0"
          >
            <BellRing className="size-[18px]" aria-hidden="true" />
            <AnimatePresence initial={false}>
              {unreadCount > 0 ? (
                <motion.span
                  key={Math.min(unreadCount, 99)}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.55, y: 3 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.7 }}
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 27 }}
                  className="absolute -right-1 -top-1 flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full border-2 border-white bg-primary px-1 text-[9px] font-black leading-none text-white shadow-[0_6px_14px_-4px_rgba(0,172,147,.75)] dark:border-gray-950"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsUtilityMenuOpen((open) => !open)}
            aria-label="Abrir utilidades"
            aria-expanded={isUtilityMenuOpen}
            aria-controls="utility-menu"
            className="native-control flex size-11 min-h-0 items-center justify-center p-0"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {isUtilityMenuOpen ? (
              <motion.div
                ref={menuRef}
                id="utility-menu"
                role="menu"
                aria-label="Utilidades"
                initial={reducedMotion ? false : { opacity: 0, y: -7, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -5, scale: 0.98 }}
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="liquid-float absolute right-4 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-[1.65rem] p-2"
              >
                <div className="mb-1 flex items-center gap-3 rounded-[1.15rem] border border-white/55 bg-white/30 px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
                  <BrandMark className="size-8" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Conta acadêmica</p>
                    <p className="truncate text-xs font-extrabold text-gray-900 dark:text-white">{ra ? `RA ${ra}` : "Sessão ativa"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { toggleTheme(); closeUtilityMenu() }}
                  className="liquid-menu-item flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-bold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300"
                >
                  <span className="icon-orb size-9">
                    {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
                  </span>
                  {theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
                </button>
                <a href="https://fundacaoeducacional132827.rm.cloudtotvs.com.br/" target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => closeUtilityMenu(false)} className="liquid-menu-item flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300">
                  <span className="icon-orb size-9"><GraduationCap className="size-4" /></span>
                  Portal oficial
                  <ExternalLink className="ml-auto size-4 text-gray-400" />
                </a>
                <button type="button" role="menuitem" onClick={() => { closeUtilityMenu(false); setIsAboutOpen(true) }} className="liquid-menu-item flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-bold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300">
                  <span className="icon-orb size-9"><Info className="size-4" /></span>
                  Sobre e instalar
                </button>
                <div className="my-1 h-px bg-gray-200/70 dark:bg-white/[0.07]" />
                <button type="button" role="menuitem" onClick={handleLogout} disabled={isLoggingOut} className="liquid-menu-item flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-bold text-red-600 disabled:opacity-60 dark:text-red-300">
                  <span className="flex size-9 items-center justify-center rounded-2xl bg-red-500/10"><LogOut className="size-4" /></span>
                  {isLoggingOut ? "Saindo..." : "Sair da conta"}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>
      <AboutDialog open={isAboutOpen} onOpenChange={(open) => { setIsAboutOpen(open); if (!open) window.requestAnimationFrame(() => triggerRef.current?.focus()) }} />
    </>
  )
}

export function AppHeader() {
  const { theme, toggleTheme } = useTheme()
  const { logout } = useSession()
  const { greeting, ra } = useUserInfo()
  const { unreadCount } = useAcademicUpdates()
  return <AppHeaderView theme={theme} toggleTheme={toggleTheme} logout={logout} greeting={greeting} ra={ra} unreadCount={unreadCount} />
}
