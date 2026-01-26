'use client';

import { WifiOff } from 'lucide-react';

export function TotvsOfflineBanner({
  message = 'Sistema da TOTVS possivelmente fora do ar. Exibindo dados em cache.',
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
        <WifiOff className="h-4 w-4 text-amber-700" />
      </div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
