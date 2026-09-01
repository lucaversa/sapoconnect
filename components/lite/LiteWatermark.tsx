import { Clock3 } from 'lucide-react';

import { formatLiteRemainingTime } from './lite-clock';

export function LiteWatermark({
  remainingMs,
  isRunning,
}: {
  remainingMs: number;
  isRunning: boolean;
}) {
  const formattedTime = formatLiteRemainingTime(remainingMs);

  return (
    <aside
      className="liquid-float pointer-events-none fixed bottom-[calc(5.7rem+env(safe-area-inset-bottom))] right-3 z-30 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-gray-950 opacity-95 sm:right-5 lg:bottom-5 dark:text-white"
      role="timer"
      aria-live="polite"
      aria-label={
        isRunning
          ? `SapoConnect Lite, ${formattedTime} restantes`
          : `SapoConnect Lite, cronômetro pausado em ${formattedTime}`
      }
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary/[0.12] text-primary-700 dark:text-primary-300">
        <Clock3 className="size-4" aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
          SapoConnect Lite
        </span>
        <span className="mt-1 block font-mono text-base font-black tabular-nums tracking-[-0.04em]">
          {formattedTime}
        </span>
        {!isRunning ? (
          <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-primary-700 dark:text-primary-300">
            Pausado
          </span>
        ) : null}
      </span>
    </aside>
  );
}
