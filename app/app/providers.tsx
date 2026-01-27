'use client';

import { useEffect } from 'react';
import { QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { QUERY_PERSIST_KEY, QUERY_PERSIST_THROTTLE_MS } from '@/lib/query-persist';
import { SessionProvider } from '@/lib/session-provider';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem(QUERY_PERSIST_KEY);
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
          localStorage.setItem(QUERY_PERSIST_KEY, JSON.stringify(dehydrated));
        } catch {
          // ignore persistence errors
        }
      }, QUERY_PERSIST_THROTTLE_MS);
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
