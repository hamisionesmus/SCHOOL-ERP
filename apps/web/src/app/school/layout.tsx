'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/sidebar';
import { NotificationBell } from '@/components/notification-bell';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { usePresenceOnline } from '@/lib/presence-socket';

interface SchoolBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  sidebarColor: string | null;
  contentBgColor: string | null;
  settingsConfigured: boolean;
}

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession('tenant');
  const router = useRouter();
  const pathname = usePathname();
  usePresenceOnline();

  const brandingQuery = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch<SchoolBranding>('/settings'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const branding = brandingQuery.data;

  // First-time onboarding: a School Administrator whose school hasn't saved Settings yet gets
  // steered there (branding review, payment reference, password change) before anything else.
  const canManageSettings = !!user?.permissions?.includes('SETTINGS:MANAGE');
  const needsSettingsRedirect =
    canManageSettings && !!branding && !branding.settingsConfigured && pathname !== '/school/settings';

  useEffect(() => {
    if (needsSettingsRedirect) router.replace('/school/settings');
  }, [needsSettingsRedirect, router]);

  // Suppresses the "Dashboard flashes, then jumps to Settings" glitch: while we don't yet know
  // whether a redirect is coming (branding still loading) or we've already decided one is needed,
  // hold off on painting {children} at all — the wrong page (Dashboard) must never render even for
  // one frame before the redirect fires. Only applies to users who could possibly be redirected.
  const holdForRedirectDecision =
    canManageSettings && pathname !== '/school/settings' && (brandingQuery.isLoading || needsSettingsRedirect);

  if (!user) return null;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: branding?.contentBgColor && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(branding.contentBgColor) ? branding.contentBgColor : '#f8fafc' }}
    >
      <Sidebar user={user} onLogout={logout} sidebarColor={branding?.sidebarColor} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative flex h-16 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-6 shadow-sm backdrop-blur-sm">
          <div
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: `linear-gradient(90deg, ${branding?.primaryColor ?? '#0f172a'}, transparent 140%)` }}
            aria-hidden
          />
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_ORIGIN}${branding.logoUrl}`}
              alt=""
              className="h-9 w-9 rounded-lg object-cover shadow-sm ring-1 ring-slate-200"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: branding?.primaryColor ?? '#0f172a' }}
            >
              {(branding?.name ?? user.tenantSlug ?? 'S').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-slate-900">{branding?.name ?? user.tenantSlug}</span>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">
            {holdForRedirectDecision ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
