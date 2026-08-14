"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ExternalLink, GraduationCap, Info, LogOut, Moon, MoreHorizontal, Sun } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { BrandMark } from "@/components/brand/BrandMark"
import { AboutDialog } from "@/components/modals/AboutDialog"
import { useTheme } from "@/context/ThemeContext"
import { useUserInfo } from "@/hooks/use-user-info"
import { useSession } from "@/lib/session-provider"

type AppHeaderViewProps = {
  theme: "light" | "dark"
  toggleTheme: () => void
  logout: () => Promise<void>
  greeting?: string | null
  ra?: string | null
}

export function AppHeaderView({ theme, toggleTheme, logout, greeting, ra }: AppHeaderViewProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setIsMobileMenuOpen(false)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const closeMobileMenu = (restoreFocus = true) => {
    setIsMobileMenuOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!isMobileMenuOpen) return
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeMobileMenu(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("pointerdown", handlePointerDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/70 bg-white/62 pt-[env(safe-area-inset-top)] backdrop-blur-2xl dark:border-white/[0.07] dark:bg-gray-950/68 lg:left-72">
        <div className="relative flex h-16 items-center gap-2.5 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <BrandMark className="size-9 lg:hidden" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-[-0.025em] text-gray-950 dark:text-white">
              {greeting || "Olá"}<span className="hidden min-[360px]:inline">{ra ? `, ${ra}` : ""}</span>
            </p>
            <p className="hidden truncate text-[11px] font-medium text-gray-500 dark:text-gray-400 min-[360px]:block">Seu painel acadêmico está pronto</p>
          </div>
          <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} className="native-control flex size-11 min-h-0 items-center justify-center p-0">
            {theme === "dark" ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
          </button>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="native-control hidden size-11 min-h-0 items-center justify-center p-0 text-red-600 hover:border-red-200 hover:text-red-700 dark:text-red-300 lg:flex" aria-label="Sair da conta">
            <LogOut className="size-[18px]" aria-hidden="true" />
          </button>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label="Abrir utilidades"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-utility-menu"
            className="native-control flex size-11 min-h-0 items-center justify-center p-0 lg:hidden"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {isMobileMenuOpen ? (
              <motion.div
                ref={menuRef}
                id="mobile-utility-menu"
                role="menu"
                aria-label="Utilidades"
                initial={reducedMotion ? false : { opacity: 0, y: -7, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -5, scale: 0.98 }}
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="liquid-float absolute right-4 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-[1.65rem] p-2 lg:hidden"
              >
                <div className="mb-1 flex items-center gap-3 rounded-[1.15rem] border border-white/55 bg-white/30 px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
                  <BrandMark className="size-8" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Conta acadêmica</p>
                    <p className="truncate text-xs font-extrabold text-gray-900 dark:text-white">{ra ? `RA ${ra}` : "Sessão ativa"}</p>
                  </div>
                </div>
                <a href="https://fundacaoeducacional132827.rm.cloudtotvs.com.br/" target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => closeMobileMenu(false)} className="liquid-menu-item flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300">
                  <span className="icon-orb size-9"><GraduationCap className="size-4" /></span>
                  Portal oficial
                  <ExternalLink className="ml-auto size-4 text-gray-400" />
                </a>
                <button type="button" role="menuitem" onClick={() => { closeMobileMenu(false); setIsAboutOpen(true) }} className="liquid-menu-item flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-bold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300">
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
  return <AppHeaderView theme={theme} toggleTheme={toggleTheme} logout={logout} greeting={greeting} ra={ra} />
}
