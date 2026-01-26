'use client';

import { useEffect } from 'react';
import { QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { SessionProvider } from '@/lib/session-provider';
import { Toaster } from 'sonner';

const PERSIST_KEY = 'sapoconnect_query_cache_v1';
const PERSIST_THROTTLE_MS = 1000;

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem(PERSIST_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        hydrate(queryClient, data);
      }
    } catch {
      // ignore cache hydration errors
    }

    let timeoutId: number | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (timeoutId) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        try {
          const dehydrated = dehydrate(queryClient);
          localStorage.setItem(PERSIST_KEY, JSON.stringify(dehydrated));
        } catch {
          // ignore persistence errors
        }
      }, PERSIST_THROTTLE_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {children}
        <Toaster richColors position="top-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
