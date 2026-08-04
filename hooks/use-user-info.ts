'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session-provider';

export function useUserInfo() {
  const { user, isLoading } = useSession();
  const [greeting, setGreeting] = useState<string>('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Bom dia');
    } else if (hour >= 12 && hour < 18) {
      setGreeting('Boa tarde');
    } else {
      setGreeting('Boa noite');
    }
  }, []);

  return { ra: user?.ra || '', greeting, loading: isLoading };
}
