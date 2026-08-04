'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  DatabaseBackup,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  Wallet,
  Landmark,
  Users,
  LifeBuoy,
  MessageSquareHeart,
  Activity,
  Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch, API_ORIGIN } from '@/lib/api';

const SUPER_ADMIN_NAV = [
  { href: '/dashboard', label: 'Schools', icon: LayoutDashboard },
  { href: '/dashboard/admins', label: 'Admins', icon: Users },
  { href: '/dashboard/inbox', label: 'Inbox', icon: Mail },
  { href: '/dashboard/tickets', label: 'Tickets', icon: LifeBuoy },
  { href: '/dashboard/finance', label: 'Finance', icon: Landmark },
  { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquareHeart },
  { href: '/dashboard/system-health', label: 'System Health', icon: Activity },
  { href: '/dashboard/settings', label: 'Platform Settings', icon: Wallet },
  { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
  { href: '/dashboard/backups', label: 'Backups', icon: DatabaseBackup },
];

// A Sub-Admin can create schools, see revenue, and handle escalated tickets (assigned to them or
// unassigned) but nothing else — Admins/Platform Settings/Security/Backups are all Super-Admin-only,
// both here and enforced server-side via @RequirePlatformRole('SUPER_ADMIN').
const SUB_ADMIN_NAV = [
  { href: '/dashboard', label: 'Schools', icon: LayoutDashboard },
  { href: '/dashboard/tickets', label: 'Tickets', icon: LifeBuoy },
];

// Sits above Sub-Admin: school creation (self-confirmed) + finance recording + system health (same
// visibility tier as Finance), but no Tickets/Admins/Settings/Security/Backups/Feedback — see
// docs/RBAC.md.
const ASSISTANT_SUPER_ADMIN_NAV = [
  { href: '/dashboard', label: 'Schools', icon: LayoutDashboard },
  { href: '/dashboard/inbox', label: 'Inbox', icon: Mail },
  { href: '/dashboard/finance', label: 'Finance', icon: Landmark },
  { href: '/dashboard/system-health', label: 'System Health', icon: Activity },
];

const COLLAPSE_STORAGE_KEY = 'school-erp:sa-sidebar-collapsed';

interface MeProfile {
  fullName: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function SuperAdminSidebar({
  email,
  role,
  fallbackName,
  onLogout,
}: {
  email: string;
  role?: string;
  fallbackName: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const nav = role === 'SUB_ADMIN' ? SUB_ADMIN_NAV : role === 'ASSISTANT_SUPER_ADMIN' ? ASSISTANT_SUPER_ADMIN_NAV : SUPER_ADMIN_NAV;

  // Shares the ['platform-me'] query key with DashboardTopbar/ProfilePage — React Query dedupes
  // the request and this updates instantly once a new photo is saved on the Profile page.
  const { data } = useQuery({
    queryKey: ['platform-me'],
    queryFn: () => apiFetch<MeProfile>('/platform/me'),
  });
  const name = data?.fullName ?? fallbackName;

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-md border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-950 transition-all duration-200 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2.5">
              {data?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_ORIGIN}${data.avatarUrl}`}
                  alt=""
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {initials(name)}
                </span>
              )}
              <p className="truncate text-sm font-semibold text-white">{name}</p>
            </div>
          )}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400" aria-label="Close menu">
            <X size={18} />
          </button>
          <button
            onClick={toggleCollapsed}
            className="hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white lg:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    collapsed && 'lg:justify-center',
                    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className={collapsed ? 'lg:hidden' : undefined}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-800 p-3">
          {!collapsed && (
            <div className="mb-2 px-2">
              <p className="truncate text-xs text-slate-400">{email}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            title={collapsed ? 'Log out' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-rose-400',
              collapsed && 'lg:justify-center',
            )}
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span className={collapsed ? 'lg:hidden' : undefined}>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
