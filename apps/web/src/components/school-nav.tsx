'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const OWN_RECORD_PERMS = ['STUDENT:VIEW_OWN_CHILD', 'STUDENT:VIEW_OWN_RECORD'];

const TABS: { href: string; label: string; anyOf?: string[]; noneOf?: string[] }[] = [
  { href: '/school', label: 'Students' },
  { href: '/school/attendance', label: 'Attendance', anyOf: ['ATTENDANCE:MARK', 'ATTENDANCE:VIEW', ...OWN_RECORD_PERMS] },
  { href: '/school/homework', label: 'Homework', anyOf: ['HOMEWORK:ASSIGN', 'HOMEWORK:VIEW', ...OWN_RECORD_PERMS] },
  {
    href: '/school/exams',
    label: 'Exams',
    anyOf: ['EXAM:MANAGE', 'EXAM:ENTER_MARKS', 'EXAM:APPROVE', ...OWN_RECORD_PERMS],
  },
  { href: '/school/admissions', label: 'Admissions', anyOf: ['ADMISSION:MANAGE'] },
  {
    href: '/school/finance',
    label: 'Finance',
    anyOf: ['FINANCE:EDIT', 'FINANCE:RECEIVE_PAYMENT', 'FINANCE:PRINT_RECEIPT', ...OWN_RECORD_PERMS],
  },
  { href: '/school/announcements', label: 'Announcements', anyOf: ['ANNOUNCEMENT:SEND_TO_PARENTS', ...OWN_RECORD_PERMS] },
  { href: '/school/library', label: 'Library', anyOf: ['LIBRARY:MANAGE', ...OWN_RECORD_PERMS] },
  { href: '/school/transport', label: 'Transport', anyOf: ['TRANSPORT:MANAGE', ...OWN_RECORD_PERMS] },
  { href: '/school/health', label: 'Health', anyOf: ['HEALTH:MANAGE', ...OWN_RECORD_PERMS] },
  { href: '/school/discipline', label: 'Discipline', anyOf: ['DISCIPLINE:MANAGE', ...OWN_RECORD_PERMS] },
  { href: '/school/inventory', label: 'Inventory', anyOf: ['INVENTORY:MANAGE'] },
  // HR leave is a staff self-service feature — Parents/Students aren't employees, so hide it for them
  // even though they're technically "authenticated tenant users" who could technically call the API.
  { href: '/school/hr', label: 'HR', noneOf: OWN_RECORD_PERMS },
];

export function SchoolNav({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const pathname = usePathname();
  const perms = user.permissions ?? [];
  const visibleTabs = TABS.filter((t) => {
    if (t.noneOf && t.noneOf.some((p) => perms.includes(p))) return false;
    return !t.anyOf || t.anyOf.some((p) => perms.includes(p));
  });

  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{user.tenantSlug}</h1>
          <p className="text-sm text-slate-500">
            {user.fullName} · {user.roles?.join(', ')}
          </p>
        </div>
        <Button variant="outline" onClick={onLogout}>
          Log out
        </Button>
      </div>
      <nav className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium',
              pathname === tab.href
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
