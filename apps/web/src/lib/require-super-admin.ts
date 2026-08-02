'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser } from './auth';

/** Defense-in-depth for pages the backend already restricts to `@RequirePlatformRole('SUPER_ADMIN')`
 * (Security, Backups, Platform Settings, Admins) — a Sub-Admin who navigates here directly by URL
 * gets redirected before the page renders, rather than seeing a broken screen full of 403s. The
 * backend guard is the real enforcement; this is purely UX. */
export function useRequireSuperAdmin() {
  const router = useRouter();
  useEffect(() => {
    const user = getSessionUser();
    if (user?.realm === 'platform' && user.role && user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [router]);
}
