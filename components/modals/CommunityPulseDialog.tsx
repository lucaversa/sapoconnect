"use client"

import { Activity, ShieldCheck } from "lucide-react"

import { CommunityPulse } from "@/components/community/CommunityPulse"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function CommunityPulseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-pull-to-refresh-ignore className="gap-0 p-0 sm:max-w-lg sm:p-0">
        <DialogHeader className="relative overflow-hidden border-b border-white/10 bg-gray-950 px-5 pb-5 pt-5 text-left text-white sm:px-6 sm:pb-6 sm:pt-6">
          <div aria-hidden="true" className="absolute -right-14 -top-16 size-44 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-3 pr-12">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <Activity className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-white">Pulso da comunidade</DialogTitle>
              <DialogDescription className="mt-0.5 text-white/60">A movimentação do SapoConnect em números.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="no-scrollbar max-h-[72dvh] overflow-y-auto px-5 sm:px-6">
          <CommunityPulse enabled={open} showHeading={false} />
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-white/70 bg-white/40 px-3.5 py-3 text-xs leading-5 text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-gray-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>Os dados são anônimos e agregados. Nenhuma informação acadêmica ou identificação de alunos é exibida.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
