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
      router.push('/app/calendario');
      return;
    }

    router.push('/login');
  }, [isLoading, user, sessionStatus, router]);

  return <PageLoading message="Carregando..." />;
}
