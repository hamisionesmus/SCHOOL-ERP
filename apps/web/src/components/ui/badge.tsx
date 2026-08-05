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
  SUPER_ADMIN: 'bg-slate-900 text-white',
  ASSISTANT_SUPER_ADMIN: 'bg-violet-100 text-violet-700',
  SUB_ADMIN: 'bg-slate-100 text-slate-700',
  TRAINER: 'bg-teal-100 text-teal-700',
  GIG_WORKER: 'bg-cyan-100 text-cyan-700',
  SOFTWARE_ENGINEER: 'bg-indigo-100 text-indigo-700',
  STAFF: 'bg-sky-100 text-sky-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  ESCALATED: 'bg-amber-100 text-amber-700',
  OPEN: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-emerald-100 text-emerald-700',
  SKIPPED: 'bg-slate-100 text-slate-500',
  FILLED: 'bg-slate-200 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-amber-100 text-amber-700',
  INTERVIEW_SCHEDULED: 'bg-violet-100 text-violet-700',
  INTERVIEWED: 'bg-indigo-100 text-indigo-700',
  HIRED: 'bg-emerald-100 text-emerald-700',
};

export function Badge({
  status,
  className,
  children,
}: {
  status: string;
  className?: string;
  /** Overrides the displayed text (still colored/keyed off `status`) — e.g. a human-readable role
   * label instead of the raw enum value. */
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status] ?? 'bg-slate-100 text-slate-700',
        className,
      )}
    >
      {children ?? status}
    </span>
  );
}
