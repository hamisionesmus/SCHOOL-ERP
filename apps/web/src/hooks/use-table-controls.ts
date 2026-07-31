import { useMemo, useState } from 'react';

type SortDir = 'asc' | 'desc';

/** Client-side sort + paginate for a list already fetched into memory — appropriate at this app's
 * data scale (see docs/ARCHITECTURE.md). Server-side pagination (Platform tenants list) uses its own
 * page/pageSize/meta pattern instead and pairs with the same <Pagination> UI component. */
export function useTableControls<T>(items: T[], options?: { pageSize?: number; initialSortKey?: keyof T | null }) {
  const pageSize = options?.pageSize ?? 8;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof T | null>(options?.initialSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [items, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  function toggleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  return {
    page: clampedPage,
    setPage,
    pageCount,
    pageItems,
    sortKey,
    sortDir,
    toggleSort,
    totalItems: sorted.length,
    pageSize,
  };
}
