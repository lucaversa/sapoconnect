'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session-provider';

export function useUserInfo() {
  const { user, isLoading } = useSession();
  const [greeting, setGreeting] = useState<string>('');

  useEffect(() => {
    queueMicrotask(() => {
      const hour = new Date().getHours();
      setGreeting(hour < 5 || hour >= 18 ? 'Boa noite' : hour < 12 ? 'Bom dia' : 'Boa tarde');
    });
  }, []);

  return { ra: user?.ra || '', greeting, loading: isLoading };
}
