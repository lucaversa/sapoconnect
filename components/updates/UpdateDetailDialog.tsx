'use client'

import Link from 'next/link'
import {
  BellRing,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  History,
  MoveRight,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  ACADEMIC_MODULE_META,
  type AcademicModule,
  type AcademicUpdate,
} from '@/lib/academic-updates'
import { cn } from '@/lib/utils'

const MODULE_ICONS = {
  calendario: CalendarClock,
  faltas: ClipboardCheck,
  avaliacoes: BookOpenCheck,
  historico: History,
} satisfies Record<AcademicModule, typeof BellRing>

function formatDetectedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(timestamp)
}

export function UpdateDetailDialog({
  update,
  open,
  onOpenChange,
}: {
  update: AcademicUpdate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!update) return null
  const moduleMeta = ACADEMIC_MODULE_META[update.module]
  const Icon = MODULE_ICONS[update.module]
  const details = update.details ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl sm:p-0">
        <DialogHeader className="pb-4 pl-5 pr-20 pt-5 sm:pb-5 sm:pl-6 sm:pr-20 sm:pt-6">
          <div className="mb-2 flex items-center gap-3">
            <span className="icon-orb size-11">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-primary-700 dark:text-primary-300">
                {moduleMeta.label}
              </p>
              <p className="text-[11px] leading-4 text-gray-500 dark:text-gray-400 sm:text-xs">
                Detectado em {formatDetectedAt(update.detectedAt)}
              </p>
            </div>
          </div>
          <DialogTitle>{update.title}</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            <span className="font-bold text-gray-800 dark:text-gray-100">{update.entityLabel}</span>
            {update.context ? <span className="block">{update.context}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div
          data-update-scroll
          className="min-h-0 max-h-[52dvh] space-y-5 overflow-y-auto overscroll-contain px-5 sm:px-6"
        >
          <div
            data-update-summary
            className="liquid-float rounded-[1.25rem] p-4 text-sm leading-6 text-gray-700 dark:text-gray-200"
          >
            {update.summary}
          </div>

          {update.changes.length > 0 ? (
            <section aria-labelledby="update-changes-title">
              <h3 id="update-changes-title" className="mb-2 text-xs font-extrabold uppercase tracking-[0.11em] text-gray-500 dark:text-gray-400">
                O que mudou
              </h3>
              <div className="space-y-3">
                {update.changes.map((change) => (
                  <article
                    key={change.label}
                    className="liquid-float rounded-[1.25rem] p-4"
                    aria-label={`Alteração em ${change.label}`}
                  >
                    <p className="mb-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                      {change.label}
                    </p>
                    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <div className="min-w-0 rounded-xl border border-white/60 bg-white/32 p-3 dark:border-white/[0.07] dark:bg-white/[0.035]">
                        <span className="block text-[10px] font-bold text-gray-400">Antes</span>
                        <span className="mt-1 block break-words text-sm font-semibold text-gray-600 line-through decoration-gray-400/50 dark:text-gray-300">
                          {change.before}
                        </span>
                      </div>
                      <MoveRight className="size-4 rotate-90 justify-self-center text-primary sm:rotate-0" aria-hidden="true" />
                      <div className="min-w-0 rounded-xl border border-primary/20 bg-primary/[0.07] p-3">
                        <span className="block text-[10px] font-bold text-primary-700 dark:text-primary-300">Agora</span>
                        <span className="mt-1 block break-words text-sm font-extrabold text-gray-950 dark:text-white">
                          {change.after}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {details.length > 0 ? (
            <section aria-labelledby="update-details-title">
              <h3 id="update-details-title" className="mb-2 text-xs font-extrabold uppercase tracking-[0.11em] text-gray-500 dark:text-gray-400">
                Informações completas
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                {details.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className={cn(
                      'min-w-0 rounded-2xl border border-white/60 bg-white/32 p-3 dark:border-white/[0.07] dark:bg-white/[0.035]',
                      item.value.length > 28 && 'col-span-2',
                    )}
                  >
                    <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                      {item.label}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-bold leading-5 text-gray-900 dark:text-white">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <div data-update-action className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <Button asChild className="w-full gap-2">
            <Link href={moduleMeta.href} prefetch={false} onClick={() => onOpenChange(false)}>
              Abrir {moduleMeta.label}
              <MoveRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
