'use client';

import { SuperAdminSidebar } from '@/components/super-admin-sidebar';
import { useSession } from '@/lib/use-session';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession('platform');

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SuperAdminSidebar email={user.email} onLogout={logout} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto px-4 py-10 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
