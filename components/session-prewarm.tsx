'use client';

import { useEffect } from 'react';
import { getSessionManager } from '@/lib/session-manager';

export function SessionPreWarm() {
  useEffect(() => {
    const sessionManager = getSessionManager();

    const preemptiveInterval = setInterval(async () => {
      const shouldRefresh = sessionManager.shouldRefreshPreemptively();
      if (shouldRefresh && !sessionManager.isRefreshing()) {
        await sessionManager.preemptiveRefreshIfNeeded();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(preemptiveInterval);
  }, []);

  return null;
}
