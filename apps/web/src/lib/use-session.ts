'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser, clearSession, type SessionUser } from './auth';

export function useSession(requiredRealm?: 'platform' | 'tenant') {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    const sessionUser = getSessionUser();
    if (!sessionUser || (requiredRealm && sessionUser.realm !== requiredRealm)) {
      router.replace('/login');
      return;
    }
    setUser(sessionUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return { user, logout };
}
