import * as React from 'react';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  TRIAL: 'bg-amber-100 text-amber-700',
  PENDING_PAYMENT: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  ADMITTED: 'bg-emerald-100 text-emerald-700',
  PROPOSED: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  APPLIED: 'bg-amber-100 text-amber-700',
  INTERVIEW: 'bg-amber-100 text-amber-700',
  OFFERED: 'bg-blue-100 text-blue-700',
  WAITLISTED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-slate-200 text-slate-700',
  IN: 'bg-emerald-100 text-emerald-700',
  OUT: 'bg-amber-100 text-amber-700',
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  LATE: 'bg-amber-100 text-amber-700',
  EXCUSED: 'bg-blue-100 text-blue-700',
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
};

export function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status] ?? 'bg-slate-100 text-slate-700',
        className,
      )}
    >
      {status}
    </span>
  );
}
