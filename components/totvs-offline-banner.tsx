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
    <div className="liquid-panel flex items-center gap-3 rounded-2xl border-amber-300/70 px-4 py-3 text-amber-800 dark:border-amber-700/50 dark:text-amber-100">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
        <WifiOff className="h-4 w-4 text-amber-700 dark:text-amber-200" />
      </div>
      <div className="min-w-0 flex-1 text-sm font-medium">
        {message}
        {updatedAt ? (
          <span className="mt-1 block text-xs font-normal text-amber-700 dark:text-amber-300">
            Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
          </span>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 shrink-0 rounded-xl border border-amber-300 px-3 text-xs font-semibold active:scale-[0.98] dark:border-amber-700"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
