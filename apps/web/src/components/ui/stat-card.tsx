import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

const ACCENTS = {
  slate: 'from-slate-500 to-slate-700 text-slate-600 bg-slate-50',
  blue: 'from-blue-500 to-indigo-600 text-blue-600 bg-blue-50',
  emerald: 'from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50',
  amber: 'from-amber-500 to-orange-600 text-amber-600 bg-amber-50',
  rose: 'from-rose-500 to-pink-600 text-rose-600 bg-rose-50',
  violet: 'from-violet-500 to-purple-600 text-violet-600 bg-violet-50',
} as const;

export type StatAccent = keyof typeof ACCENTS;

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: StatAccent;
  prefix?: string;
  suffix?: string;
  formatValue?: (n: number) => string;
  hint?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'blue',
  prefix,
  suffix,
  formatValue,
  hint,
  className,
}: StatCardProps) {
  const animated = useCountUp(value);
  const [fromClass, toClass, iconColor, iconBg] = ACCENTS[accent].split(' ');
  const gradient = `${fromClass} ${toClass}`;
  const displayValue = formatValue ? formatValue(animated) : animated.toLocaleString();

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md animate-float-up',
        className,
      )}
    >
      <div
        className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80', gradient)}
        aria-hidden
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900">
            {prefix}
            {displayValue}
            {suffix}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={cn('rounded-lg p-2.5', iconBg)}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
    </div>
  );
}
