'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface MeProfile {
  fullName: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

// Shares the ['platform-me'] query key with /dashboard/profile — React Query dedupes the request
// and the avatar here updates instantly once a new picture is saved there, no extra plumbing.
export function DashboardTopbar({ fallbackName }: { fallbackName: string }) {
  const { data } = useQuery({
    queryKey: ['platform-me'],
    queryFn: () => apiFetch<MeProfile>('/platform/me'),
  });
  const name = data?.fullName ?? fallbackName;

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-end border-b border-slate-200 bg-white px-4 lg:px-10">
      <Link
        href="/dashboard/profile"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
      >
        {data?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials(name)}
          </span>
        )}
        <span className="hidden sm:inline">{name}</span>
      </Link>
    </header>
  );
}
