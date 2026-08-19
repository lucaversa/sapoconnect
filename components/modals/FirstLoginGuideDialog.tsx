"use client"

import { Download, Moon, Share2, Smartphone, Sun } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { BrandMark } from "@/components/brand/BrandMark"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme } from "@/context/ThemeContext"
import { useSession } from "@/lib/session-provider"
import {
  getFirstLoginGuideStorageKey,
  rememberCommunityAnnouncement,
  rememberFirstLoginGuide,
  wasFirstLoginGuideSeen,
} from "@/lib/onboarding"

export function FirstLoginGuideDialog() {
  const { user } = useSession()
  const { theme, toggleTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const storageKeyRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user?.ra) return

    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      void getFirstLoginGuideStorageKey(user.ra).then((storageKey) => {
        if (cancelled) return
        storageKeyRef.current = storageKey
        if (!wasFirstLoginGuideSeen(storageKey)) setOpen(true)
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [user?.ra])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && storageKeyRef.current) {
      rememberFirstLoginGuide(storageKeyRef.current)
      rememberCommunityAnnouncement()
    }
    setOpen(nextOpen)
  }

  function selectTheme(nextTheme: "light" | "dark") {
    if (theme !== nextTheme) toggleTheme()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-pull-to-refresh-ignore className="gap-0 p-0 sm:max-w-lg sm:p-0">
        <DialogHeader className="relative overflow-hidden border-b border-white/10 bg-gray-950 px-5 pb-5 pt-5 text-left text-white sm:px-6 sm:pb-6 sm:pt-6">
          <div aria-hidden="true" className="absolute -right-14 -top-20 size-52 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-3 pr-12">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.82, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative shrink-0"
            >
              <BrandMark className="size-14 shadow-[0_18px_36px_-18px_rgba(0,210,178,0.9)]" priority />
              <motion.span
                aria-hidden="true"
                initial={reducedMotion ? false : { opacity: 0, x: -8, y: 5 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.18 }}
                className="absolute -bottom-1 -left-2 flex size-6 items-center justify-center rounded-lg border border-white/15 bg-gray-900/85 text-amber-300 backdrop-blur-xl"
              >
                <Sun className="size-3.5" aria-hidden="true" />
              </motion.span>
              <motion.span
                aria-hidden="true"
                initial={reducedMotion ? false : { opacity: 0, x: 8, y: -5 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.24 }}
                className="absolute -right-2 -top-1 flex size-6 items-center justify-center rounded-lg border border-white/15 bg-gray-900/85 text-primary-300 backdrop-blur-xl"
              >
                <Moon className="size-3.5" aria-hidden="true" />
              </motion.span>
            </motion.div>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.38, delay: reducedMotion ? 0 : 0.1 }}
              className="min-w-0"
            >
              <DialogTitle className="text-white">Deixe o SapoConnect do seu jeito</DialogTitle>
              <DialogDescription className="mt-1 text-white/60">Escolha a aparência e instale o portal como aplicativo.</DialogDescription>
            </motion.div>
          </div>
        </DialogHeader>

        <motion.div
          className="no-scrollbar max-h-[72dvh] space-y-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5"
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { delayChildren: 0.16, staggerChildren: 0.07 } },
          }}
        >
          <motion.section
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: reducedMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[1.25rem] border border-white/75 bg-white/45 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <div className="flex items-start gap-3">
              <span className="icon-orb size-9"><Sun className="size-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-gray-950 dark:text-white">Modos claro e escuro</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Experimente agora. Depois, altere quando quiser pelo menu de três pontos.</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Escolher aparência">
              <button
                type="button"
                aria-pressed={theme === "light"}
                onClick={() => selectTheme("light")}
                className="native-control flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-extrabold aria-pressed:border-primary/45 aria-pressed:bg-primary/10 aria-pressed:text-primary-700 dark:aria-pressed:text-primary-300"
              >
                <Sun className="size-4" aria-hidden="true" />
                Claro
              </button>
              <button
                type="button"
                aria-pressed={theme === "dark"}
                onClick={() => selectTheme("dark")}
                className="native-control flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-extrabold aria-pressed:border-primary/45 aria-pressed:bg-primary/10 aria-pressed:text-primary-700 dark:aria-pressed:text-primary-300"
              >
                <Moon className="size-4" aria-hidden="true" />
                Escuro
              </button>
            </div>
          </motion.section>

          <motion.section
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: reducedMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[1.25rem] border border-primary/20 bg-primary/[0.07] p-3.5 dark:bg-primary/[0.08]"
          >
            <div className="flex items-start gap-3">
              <span className="icon-orb size-9"><Smartphone className="size-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-gray-950 dark:text-white">Instale no celular</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Abra em tela cheia, como qualquer outro aplicativo.</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
                <Share2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-xs leading-5 text-gray-600 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">iPhone e iPad:</strong> no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
                <Download className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-xs leading-5 text-gray-600 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">Android:</strong> abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.</p>
              </div>
            </div>
          </motion.section>

          <DialogClose asChild>
            <motion.button
              type="button"
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              whileTap={reducedMotion ? undefined : { scale: 0.98 }}
              transition={{ duration: reducedMotion ? 0 : 0.3 }}
              className="flex min-h-12 w-full items-center justify-center rounded-[1.1rem] bg-primary px-4 text-sm font-extrabold text-gray-950 shadow-[0_16px_32px_-20px_rgba(0,172,147,0.95)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Começar
            </motion.button>
          </DialogClose>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
