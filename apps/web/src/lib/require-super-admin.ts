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

const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'];

/** Guards the Schools dashboard (`/dashboard` itself — the page every other guard above redirects
 * *to* on failure) — a restricted role like TRAINER or GIG_WORKER has no sidebar link here, but
 * nothing previously stopped direct navigation by URL, so the page rendered its full Schools
 * list/"+ Create School" UI even though every underlying API call is 403'd server-side
 * (@RequirePlatformRole() bare form only admits ADMIN_TIER_ROLES — see PermissionsGuard). Sends a
 * restricted role to its own real home page instead of showing a dead Schools shell. */
export function useRequireAdminTier() {
  const router = useRouter();
  useEffect(() => {
    const user = getSessionUser();
    if (user?.realm !== 'platform' || !user.role || ADMIN_TIER_ROLES.includes(user.role)) return;
    if (user.role === 'TRAINER') router.replace('/dashboard/training');
    else if (user.role === 'GIG_WORKER') router.replace('/dashboard/outreach');
    else router.replace('/login');
  }, [router]);
}
