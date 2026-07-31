'use client';

import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/sidebar';
import { NotificationBell } from '@/components/notification-bell';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';

interface SchoolBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession('tenant');

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch<SchoolBranding>('/settings'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} onLogout={logout} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_ORIGIN}${branding.logoUrl}`} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
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
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
