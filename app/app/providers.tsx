'use client';

import { useCallback, useEffect, useState } from 'react';
import { QueryClientProvider, dehydrate, hydrate, type DehydratedState } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import {
  QUERY_PERSIST_KEY_PREFIX,
  QUERY_PERSIST_THROTTLE_MS,
  QUERY_PERSIST_USER_KEY,
  getPersistKeyForUser,
} from '@/lib/query-persist';
import { getCredentials, getQueryCache, saveQueryCache } from '@/lib/storage';
import { Toaster } from 'sonner';

const CACHE_RESTORE_TIMEOUT_MS = 1200;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timeoutId));
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [isCacheRestored, setIsCacheRestored] = useState(false);

  const getCandidatePersistKeys = useCallback(async () => {
    const keys = new Set<string>();

    try {
      const storedRa = localStorage.getItem(QUERY_PERSIST_USER_KEY);
      if (storedRa) {
        keys.add(getPersistKeyForUser(storedRa));
      }
    } catch {
      // ignore localStorage errors
    }

    const credentials = await withTimeout(getCredentials(), CACHE_RESTORE_TIMEOUT_MS, null);
    if (credentials?.codUsuario) {
      keys.add(getPersistKeyForUser(credentials.codUsuario));
    }

    keys.add(QUERY_PERSIST_KEY_PREFIX);
    return Array.from(keys);
  }, []);

  const getPersistWriteKeys = useCallback(async () => {
    try {
      const storedRa = localStorage.getItem(QUERY_PERSIST_USER_KEY);
      if (storedRa) {
        return [getPersistKeyForUser(storedRa)];
      }
    } catch {
      // ignore localStorage errors
    }

    const credentials = await withTimeout(getCredentials(), CACHE_RESTORE_TIMEOUT_MS, null);
    if (credentials?.codUsuario) {
      return [getPersistKeyForUser(credentials.codUsuario)];
    }

    return [QUERY_PERSIST_KEY_PREFIX];
  }, []);

  const persistCache = useCallback(async () => {
    const dehydrated = dehydrate(queryClient);
    const keys = await getPersistWriteKeys();

    keys.forEach((key) => {
      try {
        localStorage.setItem(key, JSON.stringify(dehydrated));
      } catch {
        // ignore localStorage errors
      }
      void saveQueryCache(key, dehydrated).catch(() => {});
    });
  }, [getPersistWriteKeys]);

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
    let timeoutId: number | null = null;

    const hydrateCache = async () => {
      const keys = await getCandidatePersistKeys();
      const tryHydrate = (payload: string | null | DehydratedState) => {
        if (!payload || isCancelled) return false;
        try {
          const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
          hydrate(queryClient, data);
          return true;
        } catch {
          return false;
        }
      };

      let hydrated = false;
      try {
        for (const key of keys) {
          hydrated = tryHydrate(localStorage.getItem(key));
          if (hydrated) break;
        }
      } catch {
        // ignore localStorage errors
      }

      if (!hydrated) {
        for (const key of keys) {
          const idbCached = await withTimeout(
            getQueryCache<DehydratedState>(key),
            CACHE_RESTORE_TIMEOUT_MS,
            null
          );
          if (tryHydrate(idbCached)) {
            break;
          }
        }
      }
    };

    const persistSoon = () => {
      if (timeoutId) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void persistCache();
      }, QUERY_PERSIST_THROTTLE_MS);
    };

    const handlePageHide = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      void persistCache();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handlePageHide();
      }
    };

    let unsubscribe: (() => void) | null = null;

    hydrateCache().finally(() => {
      if (isCancelled) return;
      setIsCacheRestored(true);
      unsubscribe = queryClient.getQueryCache().subscribe(persistSoon);
      window.addEventListener('pagehide', handlePageHide);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [getCandidatePersistKeys, persistCache]);

  return (
    <QueryClientProvider client={queryClient}>
      {isCacheRestored ? children : null}
      <Toaster richColors closeButton position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
