import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableThProps {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}

export function SortableTh({ label, active, dir, onClick, className }: SortableThProps) {
  return (
    <th className={cn('py-2 font-medium', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-1 text-left transition-colors hover:text-slate-900',
          active && 'text-slate-900',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )
        ) : (
          <ChevronsUpDown size={13} className="text-slate-300" />
        )}
      </button>
    </th>
  );
}
