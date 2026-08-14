'use client';

import { useEffect } from 'react';

import { ensurePersistentStorage } from '@/lib/pwa-storage';

export function PwaRuntime() {
  useEffect(() => {
    void ensurePersistentStorage();

    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).then((registration) => registration.update()).catch(() => {
      // IndexedDB remains available if service workers are disabled or blocked.
    });
  }, []);

  return null;
}
