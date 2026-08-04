'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useTableControls } from '@/hooks/use-table-controls';
import { cn } from '@/lib/utils';
import { useDraftState } from '@/hooks/use-draft-state';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface DisciplineCase {
  id: string;
  student: Student;
  category: 'WARNING' | 'DETENTION' | 'SUSPENSION' | 'POSITIVE_BEHAVIOR';
  description: string;
  actionTaken: string | null;
  createdAt: string;
}

type CaseDraft = { studentId: string; category: string; description: string; actionTaken: string };

export default function DisciplinePage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadDraft, saveDraft, clearDraft } = useDraftState<CaseDraft>('discipline-case');
  const draft = loadDraft();
  const [category, setCategory] = useState(draft?.category ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [actionTaken, setActionTaken] = useState(draft?.actionTaken ?? '');

  const canManage = user?.permissions?.includes('DISCIPLINE:MANAGE');

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && !!canManage,
  });
  const { data: cases, isLoading } = useQuery({
    queryKey: ['discipline-cases'],
    queryFn: () => apiFetch<DisciplineCase[]>('/discipline/cases'),
    enabled: !!user,
  });

  const createCase = useMutation({
    mutationFn: () =>
      apiFetch('/discipline/cases', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          category,
          description,
          actionTaken: actionTaken || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipline-cases'] });
      setShowForm(false);
      setError(null);
      setStudentId('');
      setCategory('');
      setDescription('');
      setActionTaken('');
      clearDraft();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to log case'),
  });

  const [studentId, setStudentId] = useState(draft?.studentId ?? '');

  useEffect(() => {
    saveDraft({ studentId, category, description, actionTaken });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, category, description, actionTaken]);

  // No initialSortKey: the API already orders newest-first, so leaving sort unset preserves that
  // default instead of the hook's ascending sort silently flipping it to oldest-first on load.
  const table = useTableControls(cases ?? [], { pageSize: 8 });

  if (!user) return null;

  return (
    <>
          <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Discipline</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Log case'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCase.mutate();
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <SearchableSelect
                name="studentId"
                value={studentId}
                onChange={setStudentId}
                required
                placeholder="Select student"
                className="col-span-2"
                options={(students ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Category</option>
                <option value="WARNING">Warning</option>
                <option value="DETENTION">Detention</option>
                <option value="SUSPENSION">Suspension</option>
                <option value="POSITIVE_BEHAVIOR">Positive behavior</option>
              </select>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" required className="col-span-2" />
              <Input value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Action taken (optional)" className="col-span-2" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <p className="col-span-2 text-xs text-slate-500">
                Saving this notifies the student&apos;s primary guardian by SMS.
              </p>
              <div className="col-span-2">
                <Button type="submit" disabled={createCase.isPending}>
                  {createCase.isPending ? 'Saving...' : 'Log case'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !cases || cases.length === 0 ? (
            <p className="text-sm text-slate-500">No discipline cases logged.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-1 text-xs text-slate-500">
                Sort by:
                {(['createdAt', 'category'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => table.toggleSort(key)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 font-medium transition-colors',
                      table.sortKey === key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {key === 'createdAt' ? 'Date' : 'Category'} {table.sortKey === key && (table.sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                ))}
              </div>
              <ul className="flex flex-col gap-3">
                {table.pageItems.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        {c.student.firstName} {c.student.lastName}
                      </span>
                      <Badge status={c.category} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                    {c.actionTaken && <p className="text-xs text-slate-500">Action: {c.actionTaken}</p>}
                    <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
              <Pagination
                page={table.page}
                pageCount={table.pageCount}
                totalItems={table.totalItems}
                pageSize={table.pageSize}
                onPageChange={table.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
