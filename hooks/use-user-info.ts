'use client';

import { useEffect, useState } from 'react';

export function useUserInfo() {
  const [ra, setRa] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          setRa(data.ra || '');
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }

    fetchUserInfo();
  }, []);

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

  return { ra, greeting, loading };
}
