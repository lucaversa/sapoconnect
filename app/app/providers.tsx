'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  QueryClientProvider,
  dehydrate,
  hydrate,
  type DehydratedState,
} from '@tanstack/react-query';
import { useSession } from '@/lib/session-provider';
import { queryClient } from '@/lib/query-client';
import {
  QUERY_PERSIST_THROTTLE_MS,
  getPersistKeyForScope,
  shouldPersistQuery,
} from '@/lib/query-persist';
import { clearQueryCache, getQueryCache, saveQueryCache } from '@/lib/storage';
import { BrandMark } from '@/components/brand/BrandMark';
import { AppToaster } from '@/components/app-toaster';
import { Button } from '@/components/ui/button';

const CACHE_RESTORE_TIMEOUT_MS = 1_500;
const LEGACY_CACHE_PURGED_KEY = 'sapoconnect_query_cache_v2_ready';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function CacheBootScreen() {
  return (
    <div
      className="app-shell flex min-h-[100dvh] items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-xs space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" />
        <div className="liquid-float h-20 animate-pulse rounded-3xl motion-reduce:animate-none" />
        <span className="sr-only">Preparando seus dados</span>
      </div>
    </div>
  );
}

function SessionUnavailableScreen({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <main className="app-shell flex min-h-[100dvh] items-center justify-center px-5">
      <section className="liquid-float w-full max-w-sm rounded-[1.75rem] p-6 text-center">
        <BrandMark className="mx-auto size-14" />
        <h1 className="mt-4 text-lg font-extrabold tracking-[-0.03em] text-gray-950 dark:text-white">
          Não foi possível preparar seus dados
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Verifique sua conexão ou tente novamente. Seus dados locais permanecem protegidos.
        </p>
        <div className="mt-5 grid gap-2">
          <Button type="button" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? 'Reconectando...' : 'Tentar novamente'}
          </Button>
          <Link
            href="/login"
            className="native-control flex min-h-11 items-center justify-center px-4 text-sm font-bold"
          >
            Ir para o login
          </Link>
        </div>
      </section>
    </main>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { cacheScope, isLoading: isSessionLoading, refreshSession } = useSession();
  const [restoredScope, setRestoredScope] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const persistKey = useMemo(
    () => (cacheScope ? getPersistKeyForScope(cacheScope) : null),
    [cacheScope]
  );

  const persistCache = useCallback(async () => {
    if (!persistKey || !cacheScope) return;

    const dehydrated = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersistQuery });
    await saveQueryCache(
      persistKey,
      cacheScope,
      dehydrated
    ).catch(() => {});
  }, [cacheScope, persistKey]);

  useEffect(() => {
    if (!cacheScope || !persistKey) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let unsubscribe: (() => void) | null = null;

    const restore = async () => {
      queryClient.clear();

      try {
        if (!localStorage.getItem(LEGACY_CACHE_PURGED_KEY)) {
          await clearQueryCache();
          localStorage.setItem(LEGACY_CACHE_PURGED_KEY, '1');
        }
      } catch {
        // Scoped v2 keys remain safe even if localStorage is unavailable.
      }

      const cached = await withTimeout(
        getQueryCache<DehydratedState>(persistKey, cacheScope),
        CACHE_RESTORE_TIMEOUT_MS,
        null
      );
      if (cached && !cancelled) hydrate(queryClient, cached);
      if (cancelled) return;

      setRestoredScope(cacheScope);
      unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (!shouldPersistQuery(event.query)) return;
        if (timeoutId) return;
        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          void persistCache();
        }, QUERY_PERSIST_THROTTLE_MS);
      });
    };

    void restore();
    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [cacheScope, persistCache, persistKey]);

  useEffect(() => {
    if (!cacheScope || restoredScope !== cacheScope) return;

    const flush = () => void persistCache();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [cacheScope, persistCache, restoredScope]);

  const isReady = !isSessionLoading && !!cacheScope && restoredScope === cacheScope;
  const retrySession = async () => {
    setIsRetrying(true);
    try {
      await refreshSession();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      {isReady ? (
        children
      ) : !isSessionLoading && !cacheScope ? (
        <SessionUnavailableScreen onRetry={() => void retrySession()} isRetrying={isRetrying} />
      ) : (
        <CacheBootScreen />
      )}
      <AppToaster />
    </QueryClientProvider>
  );
}
