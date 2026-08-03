import { cn } from '@/lib/utils';

interface StorageBarProps {
  totalMb: number;
  limitMb: number | null;
  className?: string;
}

function formatMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export function StorageBar({ totalMb, limitMb, className }: StorageBarProps) {
  const pct = limitMb ? Math.min(100, (totalMb / limitMb) * 100) : 0;
  const fillClass = !limitMb
    ? 'bg-slate-300'
    : pct >= 90
      ? 'bg-gradient-to-r from-rose-500 to-red-600'
      : pct >= 70
        ? 'bg-gradient-to-r from-amber-500 to-orange-600'
        : 'bg-gradient-to-r from-emerald-500 to-teal-600';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{formatMb(totalMb)}</span>
        <span className="text-slate-400">{limitMb ? `of ${formatMb(limitMb)}` : 'No limit'}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', fillClass)}
          style={{ width: limitMb ? `${Math.max(pct, totalMb > 0 ? 2 : 0)}%` : '100%' }}
        />
      </div>
    </div>
  );
}
