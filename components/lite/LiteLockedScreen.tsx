'use client';

import { useCallback, useEffect } from 'react';
import { Clock3, LockKeyhole } from 'lucide-react';

import { BrandMark } from '@/components/brand/BrandMark';
import type { LiteAccessSnapshot } from '@/lib/lite-policy';

import { isLiteAccessSnapshot } from './lite-clock';

const MAX_TIMEOUT_MS = 2_147_000_000;

export function LiteLockedScreen({ snapshot }: { snapshot: LiteAccessSnapshot }) {
  const refreshAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/lite', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const nextSnapshot: unknown = await response.json();
      if (response.ok && isLiteAccessSnapshot(nextSnapshot) && nextSnapshot.state !== 'locked') {
        window.location.replace('/app/calendario');
      }
    } catch {
      // The fixed screen stays in place until the server confirms new access.
    }
  }, []);

  useEffect(() => {
    const waitMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(0, snapshot.resetAt - snapshot.serverNow) + 500
    );
    const timeoutId = window.setTimeout(() => void refreshAccess(), waitMs);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshAccess();
    };

    window.addEventListener('pageshow', refreshAccess);
    window.addEventListener('online', refreshAccess);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pageshow', refreshAccess);
      window.removeEventListener('online', refreshAccess);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshAccess, snapshot.resetAt, snapshot.serverNow]);

  return (
    <main
      className="app-shell fixed inset-0 z-[100] grid min-h-[100dvh] place-items-center overflow-y-auto px-5 py-[max(1.5rem,env(safe-area-inset-top))]"
      data-sapoconnect-lite="locked"
      aria-labelledby="lite-locked-title"
    >
      <section className="liquid-panel w-full max-w-lg rounded-[2rem] p-6 text-center sm:p-9">
        <div className="mx-auto flex w-fit items-center gap-3">
          <BrandMark className="size-11" priority />
          <p className="text-sm font-extrabold tracking-[-0.025em] text-gray-950 dark:text-white">
            SapoConnect <span className="text-primary">Lite</span>
          </p>
        </div>

        <div className="mx-auto mt-8 flex size-16 items-center justify-center rounded-[1.4rem] border border-primary/20 bg-primary/[0.08] text-primary-700 dark:text-primary-300">
          <LockKeyhole className="size-7" aria-hidden="true" />
        </div>

        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.12em] text-primary-700 dark:text-primary-300">
          Limite diário atingido
        </p>
        <h1
          id="lite-locked-title"
          className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-gray-950 sm:text-4xl dark:text-white"
        >
          Seu tempo de hoje acabou
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-gray-600 dark:text-gray-300">
          Para desbloquear o SapoConnect Premium, entre em contato com os donos do projeto.
        </p>

        <div className="mx-auto mt-7 flex w-fit items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <Clock3 className="size-4" aria-hidden="true" />
          <span>O acesso Lite será liberado novamente amanhã.</span>
        </div>
      </section>
    </main>
  );
}
