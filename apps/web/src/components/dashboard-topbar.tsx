'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PlatformNotificationBell } from '@/components/platform-notification-bell';

interface MeProfile {
  fullName: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'];

// Shares the ['platform-me'] query key with /dashboard/profile — React Query dedupes the request
// and the avatar here updates instantly once a new picture is saved there, no extra plumbing.
export function DashboardTopbar({
  fallbackName,
  role,
  onLogout,
}: {
  fallbackName: string;
  /** GET /platform/notifications is @RequirePlatformRole() (admin-tier only) server-side — hiding
   * the bell for TRAINER/GIG_WORKER avoids a silently-403ing request every 60s for a feed that's
   * entirely about school activation/finance/tickets and irrelevant to their restricted world. */
  role?: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const showNotificationBell = !role || ADMIN_TIER_ROLES.includes(role);

  const { data } = useQuery({
    queryKey: ['platform-me'],
    queryFn: () => apiFetch<MeProfile>('/platform/me'),
  });
  const name = data?.fullName ?? fallbackName;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-end gap-1 border-b border-slate-200 bg-white px-4 lg:px-10">
      {showNotificationBell && <PlatformNotificationBell />}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded-full p-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          aria-label={`${name} — account menu`}
          title={name}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials(name)}
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-52 animate-scale-in rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserCircle size={16} className="text-slate-400" />
              My Profile
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
