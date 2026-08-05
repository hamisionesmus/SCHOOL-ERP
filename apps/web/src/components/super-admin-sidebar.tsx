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
  Radio,
  Search,
  Megaphone,
  Trash2,
  Building2,
  Code2,
  GraduationCap,
  CalendarClock,
  UserCog,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch, API_ORIGIN } from '@/lib/api';

const SUPER_ADMIN_NAV = [
  { href: '/dashboard', label: 'Schools', icon: LayoutDashboard },
  { href: '/dashboard/admins', label: 'Admins', icon: Users },
  { href: '/dashboard/crm', label: 'Hamzone CRM', icon: Building2 },
  { href: '/dashboard/training', label: 'Training', icon: GraduationCap },
  { href: '/dashboard/meetings', label: 'Meetings', icon: CalendarClock },
  { href: '/dashboard/outreach', label: 'Outreach', icon: UserCog },
  { href: '/dashboard/inbox', label: 'Inbox', icon: Mail },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/tickets', label: 'Tickets', icon: LifeBuoy },
  { href: '/dashboard/finance', label: 'Finance', icon: Landmark },
  { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquareHeart },
  { href: '/dashboard/presence', label: "Who's Online", icon: Radio },
  { href: '/dashboard/system-health', label: 'System Health', icon: Activity },
  { href: '/dashboard/settings', label: 'Platform Settings', icon: Wallet },
  { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
  { href: '/dashboard/backups', label: 'Backups', icon: DatabaseBackup },
  { href: '/dashboard/data-cleanup', label: 'Data Cleanup', icon: Trash2 },
  { href: '/dashboard/api-docs', label: 'API & Architecture', icon: Code2 },
];

// A Sub-Admin can create schools, see revenue, and handle escalated tickets (assigned to them or
// unassigned) but nothing else — Admins/Platform Settings/Security/Backups are all Super-Admin-only,
// both here and enforced server-side via @RequirePlatformRole('SUPER_ADMIN').
const SUB_ADMIN_NAV = [
  { href: '/dashboard', label: 'Schools', icon: LayoutDashboard },
  { href: '/dashboard/crm', label: 'Hamzone CRM', icon: Building2 },
  { href: '/dashboard/training', label: 'Training', icon: GraduationCap },
  { href: '/dashboard/meetings', label: 'Meetings', icon: CalendarClock },
  { href: '/dashboard/outreach', label: 'Outreach', icon: UserCog },
  { href: '/dashboard/tickets', label: 'Tickets', icon: LifeBuoy },
];

// Sits above Sub-Admin: school creation (self-confirmed) + finance recording + system health (same
// visibility tier as Finance), but no Tickets/Admins/Settings/Security/Backups/Feedback — see
// docs/RBAC.md.
const ASSISTANT_SUPER_ADMIN_NAV = [
  { href: '/dashboard', label: 'Schools', icon: LayoutDashboard },
  { href: '/dashboard/crm', label: 'Hamzone CRM', icon: Building2 },
  { href: '/dashboard/training', label: 'Training', icon: GraduationCap },
  { href: '/dashboard/meetings', label: 'Meetings', icon: CalendarClock },
  { href: '/dashboard/outreach', label: 'Outreach', icon: UserCog },
  { href: '/dashboard/inbox', label: 'Inbox', icon: Mail },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/finance', label: 'Finance', icon: Landmark },
  { href: '/dashboard/presence', label: "Who's Online", icon: Radio },
  { href: '/dashboard/system-health', label: 'System Health', icon: Activity },
  { href: '/dashboard/api-docs', label: 'API & Architecture', icon: Code2 },
];

// A trainer's whole world — their own assignment/contract, registers, reports, shared resources,
// and meetings they're invited to. Nothing from the admin side (CRM, Finance, Settings, etc).
const TRAINER_NAV = [
  { href: '/dashboard/training', label: 'My Training', icon: GraduationCap },
  { href: '/dashboard/crm/documents', label: 'Resources', icon: Building2 },
  { href: '/dashboard/meetings', label: 'Meetings', icon: CalendarClock },
];

// A gig worker's whole world — the outreach entries assigned to them (report earnings/challenges)
// and any meetings they're invited to. Nothing else.
const GIG_WORKER_NAV = [
  { href: '/dashboard/outreach', label: 'My Work', icon: UserCog },
  { href: '/dashboard/meetings', label: 'Meetings', icon: CalendarClock },
];

// Nav item to surface when a module is individually granted (see PlatformAdminModuleGrant) and
// isn't already part of the viewer's tier-default nav — only for modules with a real standalone
// route; MESSAGE_TEMPLATES/AUDIT_LOG live inside Settings/a school's own page respectively and add
// no nav entry of their own, same as Super Admin doesn't get a separate nav item for either today.
const MODULE_NAV_ITEM: Partial<Record<string, { href: string; label: string; icon: React.ElementType }>> = {
  TICKETS: { href: '/dashboard/tickets', label: 'Tickets', icon: LifeBuoy },
  SECURITY: { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
  BACKUPS: { href: '/dashboard/backups', label: 'Backups', icon: DatabaseBackup },
  SETTINGS: { href: '/dashboard/settings', label: 'Platform Settings', icon: Wallet },
  ADMINS: { href: '/dashboard/admins', label: 'Admins', icon: Users },
};

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
  moduleGrants,
  fallbackName,
  onLogout,
}: {
  email: string;
  role?: string;
  /** Per-admin extras granted on top of the tier default — see PlatformAdminModuleGrant. Adds a
   * nav entry for any granted module not already visible for this role (Super Admin already sees
   * everything, so this only ever changes what a Sub-Admin/Assistant Super Admin sees). */
  moduleGrants?: string[];
  fallbackName: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const baseNav =
    role === 'SUB_ADMIN'
      ? SUB_ADMIN_NAV
      : role === 'ASSISTANT_SUPER_ADMIN'
        ? ASSISTANT_SUPER_ADMIN_NAV
        : role === 'TRAINER'
          ? TRAINER_NAV
          : role === 'GIG_WORKER'
            ? GIG_WORKER_NAV
            : SUPER_ADMIN_NAV;
  const grantedNav = (moduleGrants ?? [])
    .map((m) => MODULE_NAV_ITEM[m])
    .filter((item): item is { href: string; label: string; icon: React.ElementType } => !!item)
    .filter((item) => !baseNav.some((existing) => existing.href === item.href));
  const nav = role === 'SUPER_ADMIN' ? baseNav : [...baseNav, ...grantedNav];
  const [navQuery, setNavQuery] = useState('');
  const visibleNav = navQuery.trim()
    ? nav.filter((item) => item.label.toLowerCase().includes(navQuery.trim().toLowerCase()))
    : nav;

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

        {!collapsed && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-slate-800 bg-slate-900 py-1.5 pl-8 pr-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-col gap-0.5">
            {visibleNav.length === 0 && !collapsed && (
              <p className="px-2.5 py-2 text-xs text-slate-500">No matches</p>
            )}
            {visibleNav.map((item) => {
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
