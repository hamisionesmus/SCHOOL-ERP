'use client';

import { useEffect, useState } from 'react';
import { getSessionUser, clearSession, type SessionUser } from './auth';
import { usePageTransition } from './page-transition';

const LOGIN_CURTAIN_COLOR = '#07130f';

export function useSession(requiredRealm?: 'platform' | 'tenant') {
  const { navigate } = usePageTransition();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    const sessionUser = getSessionUser();
    if (!sessionUser || (requiredRealm && sessionUser.realm !== requiredRealm)) {
      navigate('/login', { color: LOGIN_CURTAIN_COLOR, replace: true });
      return;
    }
    setUser(sessionUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearSession();
    navigate('/login', { color: LOGIN_CURTAIN_COLOR, replace: true });
  }

  return { user, logout };
}
