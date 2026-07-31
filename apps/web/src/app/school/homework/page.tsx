'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { cn } from '@/lib/utils';

interface SchoolClass {
  id: string;
  name: string;
}
interface Submission {
  id: string;
  studentId: string;
  submittedAt: string | null;
}
interface Assignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  schoolClass: SchoolClass;
  submissions?: Submission[];
}

export default function HomeworkPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAssign = user?.permissions?.includes('HOMEWORK:ASSIGN');
  const isStudent = user?.permissions?.includes('STUDENT:VIEW_OWN_RECORD');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => apiFetch<SchoolClass[]>('/classes'),
    enabled: !!user && !!canAssign,
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['homework'],
    queryFn: () => apiFetch<Assignment[]>('/homework'),
    enabled: !!user,
  });

  const createAssignment = useMutation({
    mutationFn: (formData: FormData) =>
      apiFetch('/homework', {
        method: 'POST',
        body: JSON.stringify({
          classId: formData.get('classId'),
          title: formData.get('title'),
          description: formData.get('description'),
          dueDate: formData.get('dueDate'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to assign homework'),
  });

  const submitMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch(`/homework/${assignmentId}/submissions`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
  });

  const table = useTableControls(assignments ?? [], { pageSize: 8 });

  if (!user) return null;

  return (
    <>
          <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Homework</CardTitle>
          {canAssign && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Assign homework'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAssignment.mutate(new FormData(e.currentTarget));
              }}
              className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <select
                name="classId"
                required
                className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Class</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input name="title" placeholder="Title" required className="col-span-2" />
              <Input name="description" placeholder="Description (optional)" className="col-span-2" />
              <Input name="dueDate" type="date" required />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createAssignment.isPending}>
                  {createAssignment.isPending ? 'Saving...' : 'Assign'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !assignments || assignments.length === 0 ? (
            <p className="text-sm text-slate-500">No homework yet.</p>
          ) : (
            <>
            <div className="mb-3 flex items-center gap-1 text-xs text-slate-500">
              Sort by:
              {(['dueDate', 'title'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => table.toggleSort(key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-medium capitalize transition-colors',
                    table.sortKey === key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  {key === 'dueDate' ? 'Due date' : 'Title'} {table.sortKey === key && (table.sortDir === 'asc' ? '↑' : '↓')}
                </button>
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {table.pageItems.map((a) => {
                const submitted = a.submissions && a.submissions.length > 0 && a.submissions[0].submittedAt;
                return (
                  <li key={a.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{a.title}</p>
                        <p className="text-xs text-slate-500">
                          {a.schoolClass.name} · Due {new Date(a.dueDate).toLocaleDateString()}
                        </p>
                        {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                      </div>
                      {isStudent && (
                        <Button
                          size="sm"
                          variant={submitted ? 'outline' : 'default'}
                          disabled={!!submitted || submitMutation.isPending}
                          onClick={() => submitMutation.mutate(a.id)}
                        >
                          {submitted ? 'Submitted' : 'Mark as submitted'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
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
