'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ensureSession } from '@/lib/auth-client';

export default function Home() {
  const router = useRouter();
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    // Timeout de segurança: se demorar mais de 5s, redireciona para login
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
      router.push('/login');
    }, 5000);

    async function checkAuthAndRedirect() {
      try {
        const response = await fetch('/api/auth/session');

        if (response.ok) {
          clearTimeout(timeout);
          router.push('/app/calendario');
          return;
        }
      } catch {
        // Fall through to refresh attempt.
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
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
