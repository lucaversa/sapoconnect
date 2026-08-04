'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ensureSession } from '@/lib/auth-client';
import { useSession } from '@/lib/session-provider';

export default function Home() {
  const router = useRouter();
  const { user, isLoading, sessionStatus } = useSession();
  const hasStartedRedirect = useRef(false);

  useEffect(() => {
    if (isLoading || hasStartedRedirect.current) return;
    hasStartedRedirect.current = true;

    // Timeout de segurança: se demorar mais de 5s, redireciona para login
    const timeout = setTimeout(() => {
      router.push('/login');
    }, 5000);

    async function checkAuthAndRedirect() {
      if (sessionStatus === 'active' && user) {
        clearTimeout(timeout);
        router.push('/app/calendario');
        return;
      }

      try {
        const refreshed = await ensureSession();
        clearTimeout(timeout);
        router.push(refreshed ? '/app/calendario' : '/login');
      } catch {
        clearTimeout(timeout);
        router.push('/login');
      }
    }

    checkAuthAndRedirect();

    return () => clearTimeout(timeout);
  }, [isLoading, router, sessionStatus, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
