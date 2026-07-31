import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({ page, pageCount, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (pageCount <= 1) return null;

  const start = totalItems && pageSize ? (page - 1) * pageSize + 1 : undefined;
  const end = totalItems && pageSize ? Math.min(page * pageSize, totalItems) : undefined;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
      <p className="text-xs text-slate-500">
        {start !== undefined && end !== undefined && totalItems !== undefined
          ? `${start}–${end} of ${totalItems}`
          : `Page ${page} of ${pageCount}`}
      </p>
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
