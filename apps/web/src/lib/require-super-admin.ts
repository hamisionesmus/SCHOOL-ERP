'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser } from './auth';

/** Defense-in-depth for pages the backend already restricts to `@RequirePlatformRole('SUPER_ADMIN')`
 * (Security, Backups, Platform Settings, Admins) — a Sub-Admin who navigates here directly by URL
 * gets redirected before the page renders, rather than seeing a broken screen full of 403s. The
 * backend guard is the real enforcement; this is purely UX. `module`, when given, lets a
 * Sub-Admin/Assistant Super Admin through if they've been individually granted that module (see
 * PlatformAdminModuleGrant) — mirrors the backend's RequirePlatformModule escape hatch exactly. */
export function useRequireSuperAdmin(module?: string | string[]) {
  const router = useRouter();
  const modules = module ? (Array.isArray(module) ? module : [module]) : [];
  const key = modules.join(',');
  useEffect(() => {
    const user = getSessionUser();
    const hasGrant = modules.some((m) => user?.moduleGrants?.includes(m));
    if (user?.realm === 'platform' && user.role && user.role !== 'SUPER_ADMIN' && !hasGrant) {
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, key]);
}

/** Same defense-in-depth idea, for Tickets — Assistant Super Admin is excluded from ticket
 * handling by default (finance + school creation only), unlike Sub-Admin which can see assigned
 * tickets, unless individually granted the TICKETS module (see PlatformAdminModuleGrant). Backend
 * already enforces this via @RequirePlatformRole()/@RequirePlatformModule() on the tickets
 * controllers; this just avoids a broken-looking page. */
export function useBlockAssistantSuperAdmin() {
  const router = useRouter();
  useEffect(() => {
    const user = getSessionUser();
    const hasGrant = !!user?.moduleGrants?.includes('TICKETS');
    if (user?.realm === 'platform' && user.role === 'ASSISTANT_SUPER_ADMIN' && !hasGrant) {
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
