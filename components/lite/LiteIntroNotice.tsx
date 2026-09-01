'use client';

import { Clock3, X } from 'lucide-react';

import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/button';

type LiteIntroNoticeProps = {
  error: string | null;
  isStarting: boolean;
  onStart: () => void;
};

export function LiteIntroNotice({ error, isStarting, onStart }: LiteIntroNoticeProps) {
  return (
    <main
      className="app-shell fixed inset-0 z-[100] grid min-h-[100dvh] place-items-center overflow-y-auto px-4 py-[max(1.25rem,env(safe-area-inset-top))]"
      data-sapoconnect-lite="intro"
    >
      <section
        className="liquid-panel relative w-full max-w-lg rounded-[2rem] p-5 shadow-2xl shadow-gray-950/10 sm:p-7 dark:shadow-black/40"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lite-intro-title"
        aria-describedby="lite-intro-description"
      >
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          className="native-control absolute right-4 top-4 flex size-11 min-h-0 items-center justify-center p-0 text-gray-600 dark:text-gray-300"
          aria-label="Fechar e começar o acesso"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 pr-14">
          <BrandMark className="size-12 shadow-[0_14px_28px_-16px_rgba(0,172,147,0.9)]" priority />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary-700 dark:text-primary-300">
              SapoConnect Lite
            </p>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              Aviso de acesso diário
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h1
              id="lite-intro-title"
              className="max-w-sm text-2xl font-extrabold tracking-[-0.045em] text-gray-950 sm:text-3xl dark:text-white"
            >
              Seus 3 minutos começam quando este aviso fechar
            </h1>
            <p
              id="lite-intro-description"
              className="mt-3 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300"
            >
              O tempo só corre enquanto o SapoConnect estiver aberto e visível. Ao minimizar, trocar de app ou fechar, o cronômetro pausa e continua quando você voltar.
            </p>
          </div>

          <div
            className="flex min-h-24 min-w-28 flex-col items-center justify-center rounded-[1.5rem] border border-primary/20 bg-primary/[0.07] px-5 text-primary-800 dark:border-primary/20 dark:bg-primary/[0.09] dark:text-primary-200"
            aria-hidden="true"
          >
            <Clock3 className="size-5" />
            <span className="mt-2 font-mono text-2xl font-black tabular-nums tracking-[-0.05em]">
              03:00
            </span>
          </div>
        </div>

        <div className="mt-7 border-t border-gray-200/80 pt-5 dark:border-white/[0.08]">
          {error ? (
            <p className="mb-3 text-sm font-semibold text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={onStart}
            disabled={isStarting}
            className="w-full sm:w-auto"
            autoFocus
          >
            {isStarting ? 'Iniciando...' : 'Começar meus 3 minutos'}
          </Button>
          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
            Este aviso aparece no primeiro acesso do dia. Seu saldo é preservado enquanto o app estiver em segundo plano.
          </p>
        </div>
      </section>
    </main>
  );
}
