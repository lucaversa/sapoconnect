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
    <div className="flex items-center justify-center" style={{ minHeight }}>
      <div className="text-center">
        {icon || <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mx-auto mb-4" />}
        <p className="text-gray-600 dark:text-gray-400 font-medium">{message}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Buscando informações no EduConnect
        </p>
      </div>
    </div>
  );
}
