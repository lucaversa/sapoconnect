"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { BookOpenCheck, Download, ListTodo } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import {
  AVA_ANNOUNCEMENT_EXPIRES_AT,
  FIRST_LOGIN_GUIDE_COMPLETED_EVENT,
  getFirstLoginGuideStorageKey,
  isAvaAnnouncementActive,
  rememberAvaAnnouncement,
  wasAvaAnnouncementSeen,
  wasFirstLoginGuideSeen,
} from "@/lib/onboarding"
import { useSession } from "@/lib/session-provider"

const OPEN_DELAY_MS = 450

const highlights = [
  {
    icon: BookOpenCheck,
    title: "Disciplinas",
    description: "Veja as matérias do semestre atual.",
  },
  {
    icon: Download,
    title: "Materiais",
    description: "Abra as seções e baixe os arquivos disponíveis.",
  },
  {
    icon: ListTodo,
    title: "Tarefas e prazos",
    description: "Veja pendências no início, no calendário e nas atualizações.",
  },
]

export function AvaLaunchDialog() {
  const { user } = useSession()
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const userRa = user?.ra
    if (!userRa) return

    let cancelled = false
    let openTimer: number | undefined
    let expiryTimer: number | undefined

    async function openWhenEligible() {
      const currentUserRa = user?.ra
      if (!currentUserRa || cancelled || !isAvaAnnouncementActive() || wasAvaAnnouncementSeen()) return

      const storageKey = await getFirstLoginGuideStorageKey(currentUserRa)
      if (cancelled || !wasFirstLoginGuideSeen(storageKey)) return

      if (openTimer !== undefined) window.clearTimeout(openTimer)
      openTimer = window.setTimeout(() => {
        if (cancelled || !isAvaAnnouncementActive() || wasAvaAnnouncementSeen()) return

        setOpen(true)
        const remainingTime = AVA_ANNOUNCEMENT_EXPIRES_AT - Date.now()
        if (remainingTime > 0) {
          expiryTimer = window.setTimeout(() => setOpen(false), remainingTime)
        }
      }, OPEN_DELAY_MS)
    }

    const frame = window.requestAnimationFrame(() => void openWhenEligible())
    const handleFirstLoginGuideCompleted = () => void openWhenEligible()
    window.addEventListener(FIRST_LOGIN_GUIDE_COMPLETED_EVENT, handleFirstLoginGuideCompleted)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.removeEventListener(FIRST_LOGIN_GUIDE_COMPLETED_EVENT, handleFirstLoginGuideCompleted)
      if (openTimer !== undefined) window.clearTimeout(openTimer)
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer)
    }
  }, [user?.ra])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) rememberAvaAnnouncement()
    setOpen(nextOpen)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-gray-950/65 backdrop-blur-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onPointerDownOutside={(event) => event.preventDefault()}
          className="liquid-float fixed bottom-2 left-2 right-2 z-50 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[2rem] text-gray-950 shadow-[0_36px_100px_-30px_rgba(0,0,0,0.9)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-5 dark:text-white sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(31rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95"
        >
          <div className="relative overflow-hidden border-b border-white/65 px-5 pb-5 pt-6 text-center dark:border-white/[0.08] sm:px-7 sm:pt-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_50%_0%,rgba(0,210,178,0.28),transparent_68%)]" />
            <motion.div
              aria-hidden="true"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.8, rotate: -7 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="icon-orb relative mx-auto mb-4 size-16"
            >
              <BookOpenCheck className="size-7" />
              <span className="absolute -right-2 -top-1 flex size-7 items-center justify-center rounded-xl border border-white/60 bg-white/80 text-primary shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/85">
                <Download className="size-3.5" />
              </span>
            </motion.div>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.42, delay: reducedMotion ? 0 : 0.12 }}
            >
              <DialogPrimitive.Title className="text-balance text-[1.65rem] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-3xl">
                Novo módulo AVA
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mx-auto mt-2 max-w-sm text-sm leading-5 text-gray-600 dark:text-gray-300">
                Disciplinas, materiais e tarefas do Moodle no SapoConnect.
              </DialogPrimitive.Description>
            </motion.div>
          </div>

          <motion.div
            className="space-y-2.5 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5"
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { delayChildren: 0.2, staggerChildren: 0.07 } },
            }}
          >
            {highlights.map(({ icon: Icon, title, description }) => (
              <motion.div
                key={title}
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.985 },
                  visible: { opacity: 1, y: 0, scale: 1 },
                }}
                transition={{ duration: reducedMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-[1.25rem] border border-white/70 bg-white/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/[0.07] dark:bg-white/[0.035]"
              >
                <span className="flex size-10 items-center justify-center rounded-[0.95rem] border border-primary/20 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-sm font-extrabold leading-5 text-gray-950 dark:text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-[1.15rem] text-gray-600 dark:text-gray-300">{description}</p>
                </div>
              </motion.div>
            ))}

            <motion.p
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              className="px-2 py-1 text-center text-[11px] leading-4 text-gray-500 dark:text-gray-400"
            >
              Conecte pelo menu de três pontos. A senha do AVA pode ser diferente da usada no EduConnect.
            </motion.p>

            <DialogPrimitive.Close asChild>
              <motion.button
                type="button"
                aria-label="Fechar aviso"
                whileHover={reducedMotion ? undefined : { y: -2, scale: 1.04 }}
                whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className="mx-auto mt-3 flex size-12 items-center justify-center rounded-full border border-white/80 bg-white/55 text-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_14px_30px_-16px_rgba(0,172,147,0.75)] backdrop-blur-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary dark:border-white/10 dark:bg-white/[0.07]"
              >
                🔝
              </motion.button>
            </DialogPrimitive.Close>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
