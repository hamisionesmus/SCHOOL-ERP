'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  message: string;
  href: string;
  tone: 'info' | 'warning' | 'danger';
}

const TONE_DOT: Record<NotificationItem['tone'], string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: items } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationItem[]>('/notifications'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const count = items?.length ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 animate-scale-in rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!items || items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full', TONE_DOT[item.tone])} />
                      {item.message}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
