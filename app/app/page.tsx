'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session-provider';
import { PageLoading } from '@/components/page-loading';

export default function AppPage() {
  const router = useRouter();
  const { user, isLoading, sessionStatus } = useSession();

  useEffect(() => {
    if (isLoading) return;

    if (user || sessionStatus === 'error') {
      router.replace('/app/calendario');
      return;
    }

    router.replace('/login');
  }, [isLoading, user, sessionStatus, router]);

  return <PageLoading message="Carregando..." />;
}
