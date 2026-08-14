'use client';

import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

interface PageLoadingProps {
  message?: string;
  icon?: ReactNode;
  minHeight?: string;
}

export function PageLoading({
  message = 'Carregando...',
  icon,
  minHeight = '400px',
}: PageLoadingProps) {
  return (
    <div className="flex items-center justify-center px-4" style={{ minHeight }}>
      <div className="liquid-panel w-full max-w-sm rounded-[1.75rem] p-7 text-center" role="status" aria-live="polite">
        <span className="icon-orb mx-auto mb-4 size-14">{icon || <Loader2 className="size-6 animate-spin" />}</span>
        <p className="font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">{message}</p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Sincronizando com o EduConnect
        </p>
      </div>
    </div>
  );
}
