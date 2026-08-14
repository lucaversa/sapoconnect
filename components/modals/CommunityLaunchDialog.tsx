"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Activity, RefreshCw, UsersRound } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { BrandMark } from "@/components/brand/BrandMark"

const ANNOUNCEMENT_STORAGE_KEY = "sapoconnect:announcement:community-pulse-2026-08"
const ANNOUNCEMENT_COOKIE = "sc_announcement_community_pulse_2026_08"
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

function wasAnnouncementSeen() {
  try {
    if (window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) === "seen") return true
  } catch {
    // A cookie is the fallback for browsers that restrict local storage.
  }

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${ANNOUNCEMENT_COOKIE}=`))
}

function rememberAnnouncement() {
  try {
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, "seen")
  } catch {
    // The non-sensitive cookie below keeps the one-time behavior available.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${ANNOUNCEMENT_COOKIE}=seen; Max-Age=${ONE_YEAR_IN_SECONDS}; Path=/; SameSite=Lax${secure}`
}

function CommunityPulseAnimation() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="relative mx-auto flex h-32 w-52 items-center justify-center" aria-hidden="true">
      <motion.span
        className="absolute size-24 rounded-full border border-primary/35"
        animate={reducedMotion ? undefined : { opacity: [0.55, 0], scale: [0.82, 1.5] }}
        transition={{ duration: 2.4, ease: "easeOut", repeat: Infinity }}
      />
      <motion.span
        className="absolute size-24 rounded-full border border-primary/25"
        animate={reducedMotion ? undefined : { opacity: [0.45, 0], scale: [0.82, 1.75] }}
        transition={{ delay: 0.8, duration: 2.4, ease: "easeOut", repeat: Infinity }}
      />

      <motion.div
        className="absolute inset-2 rounded-full border border-dashed border-primary/30"
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 14, ease: "linear", repeat: Infinity }}
      >
        <span className="absolute left-1/2 top-0 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/75 text-primary shadow-[0_8px_24px_-10px_rgba(0,172,147,0.9)] backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/80">
          <UsersRound className="size-3.5" />
        </span>
        <span className="absolute bottom-2 right-1 flex size-6 items-center justify-center rounded-full border border-white/60 bg-white/75 text-primary shadow-[0_8px_24px_-10px_rgba(0,172,147,0.9)] backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/80">
          <Activity className="size-3" />
        </span>
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.75, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 19, delay: 0.1 }}
        className="relative rounded-[1.35rem] border border-white/70 bg-white/45 p-2 shadow-[0_20px_45px_-18px_rgba(0,172,147,0.75)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]"
      >
        <BrandMark className="size-16" priority />
        <motion.span
          className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-primary dark:border-gray-900"
          animate={reducedMotion ? undefined : { opacity: [1, 0.4, 1], scale: [1, 0.72, 1] }}
          transition={{ duration: 1.7, repeat: Infinity }}
        />
      </motion.div>
    </div>
  )
}

const highlights = [
  {
    icon: Activity,
    title: "Visual repaginado",
    description: "Uma experiência mais fluida, clara e confortável no celular.",
  },
  {
    icon: RefreshCw,
    title: "As funções continuam as mesmas",
    description: "Horários, faltas, avaliações e histórico permanecem onde você já conhece.",
  },
  {
    icon: UsersRound,
    title: "Nova área: Pulso da comunidade",
    description: "Em Sobre e instalar, veja a movimentação anônima e agregada da plataforma.",
  },
]

export function CommunityLaunchDialog() {
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!wasAnnouncementSeen()) setOpen(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) rememberAnnouncement()
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
          <div className="relative overflow-hidden border-b border-white/65 px-5 pb-5 pt-3 text-center dark:border-white/[0.08] sm:px-7 sm:pt-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_50%_0%,rgba(0,210,178,0.24),transparent_68%)]" />
            <CommunityPulseAnimation />
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.42, delay: reducedMotion ? 0 : 0.18 }}
            >
              <DialogPrimitive.Title className="text-balance text-[1.65rem] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-3xl">
                O SapoConnect está sendo muito visitado
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mx-auto mt-2 max-w-sm text-sm leading-5 text-gray-600 dark:text-gray-300">
                O app ganhou uma nova identidade para acompanhar esse crescimento.
              </DialogPrimitive.Description>
            </motion.div>
          </div>

          <motion.div
            className="space-y-2.5 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5"
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { delayChildren: 0.25, staggerChildren: 0.07 } },
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
