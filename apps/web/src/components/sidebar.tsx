'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GraduationCap,
  School,
  CalendarCheck,
  ScanFace,
  BookOpen,
  ClipboardList,
  UserPlus,
  Wallet,
  Megaphone,
  Library as LibraryIcon,
  Bus,
  HeartPulse,
  ShieldAlert,
  Boxes,
  ChefHat,
  Briefcase,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  MapPinned,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const OWN_RECORD_PERMS = ['STUDENT:VIEW_OWN_CHILD', 'STUDENT:VIEW_OWN_RECORD'];

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  anyOf?: string[];
  noneOf?: string[];
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/school', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/school/students', label: 'Students', icon: GraduationCap },
    ],
  },
  {
    label: 'Academics',
    items: [
      { href: '/school/attendance', label: 'Attendance', icon: CalendarCheck, anyOf: ['ATTENDANCE:MARK', 'ATTENDANCE:VIEW', ...OWN_RECORD_PERMS] },
      { href: '/school/biometric', label: 'Biometric Log', icon: ScanFace, noneOf: OWN_RECORD_PERMS },
      { href: '/school/homework', label: 'Homework', icon: BookOpen, anyOf: ['HOMEWORK:ASSIGN', 'HOMEWORK:VIEW', ...OWN_RECORD_PERMS] },
      { href: '/school/exams', label: 'Exams', icon: ClipboardList, anyOf: ['EXAM:MANAGE', 'EXAM:ENTER_MARKS', 'EXAM:APPROVE', ...OWN_RECORD_PERMS] },
      { href: '/school/admissions', label: 'Admissions', icon: UserPlus, anyOf: ['ADMISSION:MANAGE'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/school/finance', label: 'Fees & Payments', icon: Wallet, anyOf: ['FINANCE:EDIT', 'FINANCE:RECEIVE_PAYMENT', 'FINANCE:PRINT_RECEIPT', ...OWN_RECORD_PERMS] },
    ],
  },
  {
    label: 'Life & Activities',
    items: [
      { href: '/school/trips', label: 'Trips', icon: MapPinned, anyOf: ['TRANSPORT:MANAGE', 'TRANSPORT:PROPOSE', ...OWN_RECORD_PERMS] },
      { href: '/school/library', label: 'Library', icon: LibraryIcon, anyOf: ['LIBRARY:MANAGE', ...OWN_RECORD_PERMS], noneOf: ['STUDENT:VIEW_OWN_CHILD'] },
      { href: '/school/health', label: 'Health', icon: HeartPulse, anyOf: ['HEALTH:MANAGE', ...OWN_RECORD_PERMS], noneOf: ['STUDENT:VIEW_OWN_CHILD'] },
      { href: '/school/discipline', label: 'Discipline', icon: ShieldAlert, anyOf: ['DISCIPLINE:MANAGE', ...OWN_RECORD_PERMS], noneOf: ['STUDENT:VIEW_OWN_CHILD'] },
      { href: '/school/announcements', label: 'Announcements', icon: Megaphone, anyOf: ['ANNOUNCEMENT:SEND_TO_PARENTS', ...OWN_RECORD_PERMS] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/school/transport', label: 'Transport', icon: Bus, anyOf: ['TRANSPORT:MANAGE', ...OWN_RECORD_PERMS], noneOf: ['STUDENT:VIEW_OWN_CHILD'] },
      { href: '/school/inventory', label: 'Inventory', icon: Boxes, anyOf: ['INVENTORY:MANAGE'] },
      { href: '/school/kitchen', label: 'Kitchen', icon: ChefHat, anyOf: ['INVENTORY:MANAGE'] },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/school/users', label: 'Staff', icon: Users, anyOf: ['TENANT:MANAGE_USERS'] },
      { href: '/school/hr', label: 'HR & Staff Portal', icon: Briefcase, noneOf: OWN_RECORD_PERMS },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/school/classes', label: 'Classes', icon: School, anyOf: ['TENANT:MANAGE_USERS'] },
      { href: '/school/settings', label: 'School Settings', icon: SettingsIcon, anyOf: ['SETTINGS:MANAGE'] },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = 'school-erp:sidebar-collapsed';

export function Sidebar({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const pathname = usePathname();
  const perms = user.permissions ?? [];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.noneOf && item.noneOf.some((p) => perms.includes(p))) return false;
      return !item.anyOf || item.anyOf.some((p) => perms.includes(p));
    }),
  })).filter((group) => group.items.length > 0);

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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user.tenantSlug}</p>
              <p className="truncate text-xs text-slate-500">{user.roles?.join(', ')}</p>
            </div>
          )}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
          <button
            onClick={toggleCollapsed}
            className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-5">
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
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
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      <Icon size={16} className="flex-shrink-0" />
                      <span className={collapsed ? 'lg:hidden' : undefined}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          {!collapsed && (
            <div className="mb-2 px-2">
              <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            title={collapsed ? 'Log out' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-red-600',
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
