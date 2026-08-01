'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  /** Set this to keep working with existing `new FormData(e.currentTarget)` submit handlers — a
   * hidden input carries the selected value under this name, same as a plain <select name=...>. */
  name?: string;
  options: SearchableSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const VISIBLE_CAP = 50;

/** A searchable dropdown that stands in for a plain <select> wherever the option list can grow long
 * (students, staff). Rather than paginating *inside* the dropdown — awkward UX for a picker — search
 * narrows the list, and rendering itself is capped at VISIBLE_CAP with a hint to keep typing; this
 * gives the same "don't choke on a long list" guarantee pagination would, without page-turning inside
 * a combobox. */
export function SearchableSelect({
  name,
  options,
  value,
  onChange,
  placeholder = 'Search...',
  required,
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = !q
      ? options
      : options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
        );
    return pool.slice(0, VISIBLE_CAP);
  }, [options, query]);
  const truncated = !query.trim() ? options.length > VISIBLE_CAP : false;
  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.length;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
    ).length;
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => setHighlight(0), [query, open]);

  function select(v: string) {
    onChange?.(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={value ?? ''} required={required} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50',
          !selected && 'text-slate-400',
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className="ml-2 flex-shrink-0 text-slate-400" />
      </button>
      {selected && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            select('');
          }}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-300 hover:text-slate-600"
          aria-label="Clear selection"
        >
          <X size={13} />
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={13} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, filtered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const opt = filtered[highlight];
                  if (opt && !opt.disabled) select(opt.value);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                  setQuery('');
                }
              }}
              placeholder="Type to search..."
              className="h-8 w-full rounded border-0 pl-6 text-sm focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            ) : (
              filtered.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    disabled={o.disabled}
                    onClick={() => !o.disabled && select(o.value)}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      'flex w-full flex-col items-start px-3 py-1.5 text-left text-sm',
                      o.disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-700',
                      i === highlight && !o.disabled && 'bg-slate-100',
                      o.value === value && 'font-medium text-slate-900',
                    )}
                  >
                    <span>{o.label}</span>
                    {o.sublabel && <span className="text-xs text-slate-400">{o.sublabel}</span>}
                  </button>
                </li>
              ))
            )}
            {(truncated || totalMatches > filtered.length) && (
              <li className="px-3 py-1.5 text-xs text-slate-400">
                Showing {filtered.length} of {totalMatches} — keep typing to narrow down
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
