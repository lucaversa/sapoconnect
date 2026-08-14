'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '@/lib/auth-client';
import { SessionProvider, useSession } from '@/lib/session-provider';
import { PageLoading } from '@/components/page-loading';

function HomeContent() {
  const router = useRouter();
  const { user, isLoading, sessionStatus } = useSession();
  const hasStartedRedirect = useRef(false);

  useEffect(() => {
    if (isLoading || hasStartedRedirect.current) return;
    hasStartedRedirect.current = true;

    async function checkAuthAndRedirect() {
      if (sessionStatus === 'active' && user) {
        router.replace('/app/calendario');
        return;
      }

      try {
        const refreshed = await ensureSession();
        router.replace(refreshed ? '/app/calendario' : '/login');
      } catch {
        router.replace('/login');
      }
    }

    checkAuthAndRedirect();

  }, [isLoading, router, sessionStatus, user]);

  return <PageLoading message="Preparando seu acesso..." />;
}

export default function Home() {
  return (
    <SessionProvider>
      <HomeContent />
    </SessionProvider>
  );
}
