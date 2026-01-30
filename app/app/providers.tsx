'use client';

import { useEffect } from 'react';
import { QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { QUERY_PERSIST_KEY_PREFIX, QUERY_PERSIST_THROTTLE_MS, getPersistKeyFromStorage } from '@/lib/query-persist';
import { getQueryCache, saveQueryCache } from '@/lib/storage';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }
    } catch {
      // ignore persistence request errors
    }

    let isCancelled = false;

    const hydrateCache = async () => {
      const persistedKey = getPersistKeyFromStorage();
      const fallbackKeys = persistedKey === QUERY_PERSIST_KEY_PREFIX
        ? []
        : [QUERY_PERSIST_KEY_PREFIX];

      const tryHydrate = (payload: string | null) => {
        if (!payload || isCancelled) return false;
        try {
          const data = JSON.parse(payload);
          hydrate(queryClient, data);
          return true;
        } catch {
          return false;
        }
      };

      let hydrated = false;
      try {
        hydrated = tryHydrate(localStorage.getItem(persistedKey));
        if (!hydrated) {
          fallbackKeys.some((key) => {
            hydrated = tryHydrate(localStorage.getItem(key));
            return hydrated;
          });
        }
      } catch {
        // ignore localStorage errors
      }

      if (!hydrated) {
        const idbCached =
          (await getQueryCache<ReturnType<typeof dehydrate>>(persistedKey)) ||
          (fallbackKeys.length
            ? await getQueryCache<ReturnType<typeof dehydrate>>(fallbackKeys[0])
            : null);
        if (idbCached && !isCancelled) {
          hydrate(queryClient, idbCached);
        }
      }
    };

    hydrateCache();

    let timeoutId: number | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (timeoutId) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        const persistKey = getPersistKeyFromStorage();
        const dehydrated = dehydrate(queryClient);
        try {
          localStorage.setItem(persistKey, JSON.stringify(dehydrated));
        } catch {
          // ignore localStorage errors
        }
        void saveQueryCache(persistKey, dehydrated).catch(() => {});
      }, QUERY_PERSIST_THROTTLE_MS);
    });

    return () => {
      isCancelled = true;
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
