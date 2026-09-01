'use client';

import { Clock3 } from 'lucide-react';

import { BrandMark } from '@/components/brand/BrandMark';

import { formatLiteRemainingTime } from './lite-clock';

export function LiteResumeScreen({ remainingMs }: { remainingMs: number }) {
  return (
    <main
      className="app-shell fixed inset-0 z-[90] grid min-h-[100dvh] place-items-center px-5"
      data-sapoconnect-lite="active"
      role="status"
      aria-live="polite"
    >
      <section className="liquid-panel w-full max-w-sm rounded-[2rem] p-7 text-center">
        <BrandMark className="mx-auto size-12" priority />
        <div className="mx-auto mt-6 flex size-12 items-center justify-center rounded-2xl bg-primary/[0.1] text-primary-700 dark:text-primary-300">
          <Clock3 className="size-5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold tracking-[-0.04em] text-gray-950 dark:text-white">
          Retomando seu acesso
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Seu cronômetro está pausado em{' '}
          <span className="font-mono font-black tabular-nums text-gray-950 dark:text-white">
            {formatLiteRemainingTime(remainingMs)}
          </span>
          .
        </p>
      </section>
    </main>
  );
}
