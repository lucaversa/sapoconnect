'use client';

import { ExternalLink, MonitorSmartphone, MoonStar, ShieldCheck, Smartphone } from 'lucide-react';

import { BrandMark } from '@/components/brand/BrandMark';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function InstallGuide({ platform, steps }: { platform: string; steps: string[] }) {
  return (
    <article className="rounded-[1.15rem] border border-white/80 bg-white/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="icon-orb size-8"><Smartphone className="size-4" aria-hidden="true" /></span>
        <h4 className="text-sm font-extrabold text-gray-950 dark:text-white">{platform}</h4>
      </div>
      <ol className="space-y-2.5">
        {steps.map((step, index) => (
          <li key={step} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-extrabold text-primary-700 dark:text-primary-300">{index + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl sm:p-0">
        <DialogHeader className="relative overflow-hidden border-b border-white/10 bg-gray-950 px-5 pb-5 pt-5 text-left text-white sm:px-6 sm:pb-6 sm:pt-6">
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-3 pr-12">
            <BrandMark className="size-12" />
            <div className="min-w-0">
              <DialogTitle className="text-white">SapoConnect</DialogTitle>
              <DialogDescription className="mt-0.5 text-white/60">de aluno para aluno</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="no-scrollbar max-h-[72dvh] overflow-y-auto px-5 sm:px-6">
          <section className="py-5">
            <div className="flex items-start gap-3">
              <span className="icon-orb size-9"><MonitorSmartphone className="size-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h3 className="font-extrabold text-gray-950 dark:text-white">Um portal feito para o celular</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">Horários, faltas, avaliações e histórico em uma experiência mais rápida e direta do que o portal original.</p>
              </div>
            </div>
          </section>

          <section className="border-t border-gray-200/70 py-5 dark:border-white/[0.065]">
            <div className="mb-3 flex items-start gap-3">
              <span className="icon-orb size-9"><Smartphone className="size-[18px]" aria-hidden="true" /></span>
              <div>
                <h3 className="font-extrabold text-gray-950 dark:text-white">Instalar no celular</h3>
                <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">Adicione o SapoConnect à tela inicial e abra como aplicativo.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InstallGuide platform="iPhone e iPad" steps={[
                'Abra o SapoConnect no Safari.',
                'Toque em Compartilhar.',
                'Escolha “Adicionar à Tela de Início”.',
              ]} />
              <InstallGuide platform="Android" steps={[
                'Abra o SapoConnect no navegador.',
                'Toque no menu do navegador.',
                'Escolha “Instalar app” ou “Adicionar à tela inicial”.',
              ]} />
            </div>
          </section>

          <section className="border-t border-gray-200/70 py-5 dark:border-white/[0.065]">
            <div className="flex items-start gap-3">
              <span className="icon-orb size-9"><ShieldCheck className="size-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h3 className="font-extrabold text-gray-950 dark:text-white">Privacidade e reconexão</h3>
                <div className="mt-1 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  <p>Não existe banco de credenciais. A reconexão usa um cookie criptografado e HttpOnly, restrito à autenticação, quando a sessão da TOTVS expira.</p>
                  <p>Instalações antigas podem manter uma cópia criptografada no IndexedDB do navegador por até 7 dias durante a migração. Depois disso, ela é removida automaticamente.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="border-t border-gray-200/70 py-5 dark:border-white/[0.065]">
            <div className="flex items-start gap-3">
              <span className="icon-orb size-9"><MoonStar className="size-[18px]" aria-hidden="true" /></span>
              <div>
                <h3 className="font-extrabold text-gray-950 dark:text-white">Aparência</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">Alterne entre os temas claro e escuro pelo botão de sol ou lua no cabeçalho.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200/70 p-4 dark:border-white/[0.065] sm:px-6 sm:py-5">
          <a href="https://github.com/lucaversa/sapoconnect" target="_blank" rel="noopener noreferrer" className="native-control flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold">
            Código-fonte no GitHub <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
