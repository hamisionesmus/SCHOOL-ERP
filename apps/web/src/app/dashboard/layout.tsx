'use client';

import { SuperAdminSidebar } from '@/components/super-admin-sidebar';
import { DashboardTopbar } from '@/components/dashboard-topbar';
import { useSession } from '@/lib/use-session';
import { usePresenceOnline } from '@/lib/presence-socket';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession('platform');
  usePresenceOnline();

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SuperAdminSidebar email={user.email} role={user.role} moduleGrants={user.moduleGrants} fallbackName={user.fullName} onLogout={logout} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DashboardTopbar fallbackName={user.fullName} role={user.role} onLogout={logout} />
        <main className="flex-1 overflow-y-auto px-4 py-10 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
