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

/** Same defense-in-depth idea, for Tickets — Assistant Super Admin is explicitly excluded from
 * ticket handling (finance + school creation only), unlike Sub-Admin which can see assigned
 * tickets. Backend already enforces this via @RequirePlatformRole() on the tickets controllers not
 * matching ASSISTANT_SUPER_ADMIN's other allowances; this just avoids a broken-looking page. */
export function useBlockAssistantSuperAdmin() {
  const router = useRouter();
  useEffect(() => {
    const user = getSessionUser();
    if (user?.realm === 'platform' && user.role === 'ASSISTANT_SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [router]);
}

/** Finance is Super Admin + Assistant Super Admin only — Sub-Admin is excluded (school creation
 * only). Backend enforces via @RequirePlatformRole(['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN']) on
 * the finance controller; this is the client-side redirect counterpart. */
export function useRequireFinanceAccess() {
  const router = useRouter();
  useEffect(() => {
    const user = getSessionUser();
    if (user?.realm === 'platform' && user.role === 'SUB_ADMIN') {
      router.replace('/dashboard');
    }
  }, [router]);
}
