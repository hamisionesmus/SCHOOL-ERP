import { Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';

function daysRemaining(endDate: string | Date): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

/** "The days for the cohort/training to end should be displayed in countdown" — used on trainer,
 * lead, and Super Admin views alike so everyone sees the same deadline pressure. */
export function Countdown({ endDate, label = 'until end', className }: { endDate: string | Date; label?: string; className?: string }) {
  const days = daysRemaining(endDate);
  const ended = days <= 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        ended ? 'bg-slate-100 text-slate-600' : days <= 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
        className,
      )}
    >
      <Hourglass size={12} />
      {ended ? 'Ended' : `${days} day${days === 1 ? '' : 's'} ${label}`}
    </span>
  );
}
