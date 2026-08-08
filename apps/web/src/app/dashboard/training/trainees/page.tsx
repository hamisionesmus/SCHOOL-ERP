'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeleton';
import { SortableTh } from '@/components/ui/sortable-th';
import { Pagination } from '@/components/ui/pagination';
import { ExcelImportExportBar } from '@/components/ui/excel-import-export-bar';
import { useTableControls } from '@/hooks/use-table-controls';

interface Program {
  id: string;
  title: string;
  status: string;
}

interface Trainee {
  id: string;
  traineeNumber: string | null;
  fullName: string;
  gender: string;
  phone: string | null;
  portalEnabled: boolean;
  program: { id: string; title: string; status: string };
}

export default function TraineesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [programId, setProgramId] = useState('');

  const { data: trainees, isLoading } = useQuery({
    queryKey: ['training-trainees'],
    queryFn: () => apiFetch<Trainee[]>('/platform/training/trainees'),
  });
  const { data: programs } = useQuery({
    queryKey: ['training-programs-all'],
    queryFn: () => apiFetch<Program[]>('/platform/training/programs'),
  });

  const filtered = useMemo(() => {
    let rows = trainees ?? [];
    if (programId) rows = rows.filter((t) => t.program.id === programId);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          (t.traineeNumber ?? '').toLowerCase().includes(q) ||
          t.program.title.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [trainees, programId, search]);

  const { pageItems, page, pageCount, setPage, sortKey, sortDir, toggleSort, totalItems, pageSize, setPageSize } =
    useTableControls(filtered, { pageSize: 10, initialSortKey: 'fullName' });

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Trainees</h1>
        <p className="text-sm text-slate-500">Full roster across every program, with attendance history and portal access.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Trainees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or trainee number..."
                  className="h-9 w-64 pl-8 text-sm"
                />
              </div>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="h-9 rounded-md border border-slate-300 px-2 text-sm"
              >
                <option value="">All programs</option>
                {(programs ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <ExcelImportExportBar
              exportUrl={`${API_ORIGIN}/platform/training/trainees/export`}
              templateUrl={`${API_ORIGIN}/platform/training/trainees/import-template`}
              importUrl={`${API_ORIGIN}/platform/training/trainees/import`}
              entityLabel="trainees"
              onImported={() => queryClient.invalidateQueries({ queryKey: ['training-trainees'] })}
            />
          </div>

          {isLoading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : !trainees || trainees.length === 0 ? (
            <p className="text-sm text-slate-500">No trainees yet — add them via Import, or they&apos;ll appear here once a trainer submits a daily register.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No trainees match your search.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <SortableTh label="Trainee #" active={sortKey === 'traineeNumber'} dir={sortDir} onClick={() => toggleSort('traineeNumber')} />
                    <SortableTh label="Name" active={sortKey === 'fullName'} dir={sortDir} onClick={() => toggleSort('fullName')} />
                    <SortableTh label="Gender" active={sortKey === 'gender'} dir={sortDir} onClick={() => toggleSort('gender')} />
                    <th className="py-2 font-medium">Program</th>
                    <th className="py-2 font-medium">Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-2 text-slate-500">{t.traineeNumber ?? '—'}</td>
                      <td className="py-2 font-medium text-slate-900">
                        <Link href={`/dashboard/training/trainees/${t.id}`} className="hover:underline">
                          {t.fullName}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-500">{t.gender}</td>
                      <td className="py-2 text-slate-500">{t.program.title}</td>
                      <td className="py-2">
                        <Badge status={t.portalEnabled ? 'ACTIVE' : 'INACTIVE'}>{t.portalEnabled ? 'Enabled' : 'Not set up'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                totalItems={totalItems}
                pageSize={pageSize}
                pageSizeOptions={[10, 25, 50]}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
