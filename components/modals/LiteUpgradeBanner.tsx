"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Check, Copy, Crown, LockKeyhole, Sparkles } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { BrandMark } from "@/components/brand/BrandMark"
import { useSession } from "@/lib/session-provider"

const LITE_BANNER_INTERVAL_MS = 2 * 60 * 1_000
const CLOSE_DELAY_SECONDS = 10
const PIX_KEY = "35997030903"

export function LiteUpgradeBanner() {
  const { user } = useSession()
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(CLOSE_DELAY_SECONDS)
  const [copied, setCopied] = useState(false)
  const isEligible = user?.appTier === "lite"
  const canDismiss = secondsRemaining === 0

  const showBanner = useCallback(() => {
    setSecondsRemaining(CLOSE_DELAY_SECONDS)
    setCopied(false)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!isEligible || open) return

    let waitingForVisibility = false
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") showBanner()
      else waitingForVisibility = true
    }, LITE_BANNER_INTERVAL_MS)
    const handleVisibility = () => {
      if (waitingForVisibility && document.visibilityState === "visible") showBanner()
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [isEligible, open, showBanner])

  useEffect(() => {
    if (!open) return

    let elapsedSeconds = 0
    const timer = window.setInterval(() => {
      elapsedSeconds += 1
      setSecondsRemaining(Math.max(0, CLOSE_DELAY_SECONDS - elapsedSeconds))
      if (elapsedSeconds >= CLOSE_DELAY_SECONDS) window.clearInterval(timer)
    }, 1_000)

    return () => window.clearInterval(timer)
  }, [open])

  if (!isEligible) return null

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !canDismiss) return
    setOpen(nextOpen)
  }

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY)
      setCopied(true)
      toast.success("Chave Pix copiada")
    } catch {
      toast.error("Não foi possível copiar a chave Pix")
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-gray-950/62 backdrop-blur-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-pull-to-refresh-ignore
          onEscapeKeyDown={(event) => { if (!canDismiss) event.preventDefault() }}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="liquid-float fixed bottom-2 left-2 right-2 z-50 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[2rem] text-gray-950 shadow-[0_36px_100px_-30px_rgba(0,0,0,0.9)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-5 dark:text-white sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95"
        >
          <div className="relative overflow-hidden border-b border-white/65 px-5 pb-5 pt-5 dark:border-white/[0.08] sm:px-6 sm:pt-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_50%_0%,rgba(0,210,178,0.25),transparent_68%)]" />
            <div className="relative mx-auto flex size-24 items-center justify-center">
              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 12, ease: "linear", repeat: Infinity }}
                className="absolute inset-0 rounded-full border border-dashed border-primary/35"
              />
              <div className="relative flex size-16 items-center justify-center rounded-[1.35rem] border border-white/70 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_34px_-22px_rgba(0,172,147,0.85)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07]">
                <BrandMark className="size-11" />
                <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-xl border border-primary/25 bg-primary text-white shadow-lg shadow-primary/25">
                  <LockKeyhole className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="relative mt-3 text-center">
              <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-700 dark:text-primary-300">
                <Sparkles className="size-3" aria-hidden="true" />
                SapoConnect Lite
              </div>
              <DialogPrimitive.Title className="mt-3 text-balance text-2xl font-extrabold leading-tight tracking-[-0.045em] sm:text-[1.75rem]">
                Desbloqueie a versão Premium
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
                Para liberar a versão Premium, envie R$ 100 no Pix para {PIX_KEY}.
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="space-y-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">
            <button
              type="button"
              onClick={() => void copyPix()}
              className="group flex min-h-14 w-full items-center gap-3 rounded-[1.2rem] border border-white/75 bg-white/45 px-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] transition-transform active:scale-[0.985] motion-reduce:transition-none dark:border-white/[0.08] dark:bg-white/[0.045]"
            >
              <span className="icon-orb size-9">
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">Chave Pix</span>
                <span className="block truncate text-base font-extrabold tabular-nums text-gray-950 dark:text-white">{PIX_KEY}</span>
              </span>
              <span className="text-xs font-bold text-primary-700 dark:text-primary-300">{copied ? "Copiada" : "Copiar"}</span>
            </button>

            <div className="flex items-center gap-3 rounded-[1.2rem] border border-primary/20 bg-primary/[0.08] px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              <Crown className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="leading-5">A versão Lite continua disponível enquanto o acesso Premium não é liberado.</p>
            </div>

            <DialogPrimitive.Close asChild disabled={!canDismiss}>
              <button
                type="button"
                disabled={!canDismiss}
                className="flex min-h-12 w-full items-center justify-center rounded-[1.15rem] bg-gray-950 px-4 text-sm font-extrabold text-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.8)] transition-[transform,opacity] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none dark:bg-white dark:text-gray-950"
              >
                {canDismiss ? "Continuar no Lite" : `Aguarde ${secondsRemaining}s`}
              </button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
