'use client';

import { WifiOff } from 'lucide-react';

export function TotvsOfflineBanner({
  message = 'Sistema da TOTVS possivelmente fora do ar. Exibindo dados em cache.',
  updatedAt,
  onRetry,
}: {
  message?: string;
  updatedAt?: number;
  onRetry?: () => void;
}) {
  return (
    <div className="liquid-float liquid-notice liquid-notice-warning flex flex-wrap items-center gap-3 px-3.5 py-3 text-amber-900 sm:flex-nowrap sm:px-4 dark:text-amber-100" role="status" aria-live="polite">
      <div className="liquid-notice-icon size-9 rounded-xl text-amber-700 dark:text-amber-200">
        <WifiOff className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-[12rem] flex-1 text-xs font-semibold leading-5 sm:text-sm">
        {message}
        {updatedAt ? (
          <span className="mt-0.5 block text-[11px] font-medium text-amber-700/80 dark:text-amber-200/75">
            Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
          </span>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="liquid-menu-item ml-12 min-h-10 rounded-xl border-amber-500/20 bg-white/30 px-3 text-xs font-bold text-amber-800 sm:ml-0 dark:bg-white/[0.04] dark:text-amber-100"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
