import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  /** Optional page-size selector, e.g. [10, 30, 50] — omit to keep the page size fixed (every
   * existing caller keeps working unchanged since these are the only two new, optional props). */
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  // Only hide entirely when there's truly nothing to show. A single page of results still renders
  // the "X of Y" summary (with Prev/Next disabled) rather than disappearing outright — otherwise
  // there's no way to tell pagination exists at all until a list happens to cross the page-size
  // threshold, which small/demo datasets may never do.
  if (totalItems === 0 || (totalItems === undefined && pageCount <= 1)) return null;

  const start = totalItems && pageSize ? (page - 1) * pageSize + 1 : undefined;
  const end = totalItems && pageSize ? Math.min(page * pageSize, totalItems) : undefined;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">
          {start !== undefined && end !== undefined && totalItems !== undefined
            ? `${start}–${end} of ${totalItems}`
            : `Page ${page} of ${pageCount}`}
        </p>
        {pageSizeOptions && pageSize !== undefined && onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Rows:
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="px-2 text-xs font-medium text-slate-600">
          {page} / {pageCount}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
