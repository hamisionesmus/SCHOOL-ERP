'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { SortableTh } from '@/components/ui/sortable-th';
import { Pagination } from '@/components/ui/pagination';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useTableControls } from '@/hooks/use-table-controls';

interface GradeLevel {
  id: string;
  name: string;
}
interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}
interface UserRef {
  id: string;
  fullName: string;
  email: string;
}
interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  userRoles: { role: { name: string } }[];
}
interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  academicYear: AcademicYear;
  classTeacher: UserRef | null;
}

export default function ClassesPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = !!user?.permissions?.includes('TENANT:MANAGE_USERS');

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => apiFetch<SchoolClass[]>('/classes'),
    enabled: !!user,
  });
  const { data: gradeLevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => apiFetch<GradeLevel[]>('/grade-levels'),
    enabled: !!user && canManage,
  });
  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<AcademicYear[]>('/academic-years'),
    enabled: !!user && canManage,
  });
  // Only fetched for staff who can actually reassign teachers — /users requires TENANT:MANAGE_USERS,
  // and the read-only view below renders classTeacher straight from the /classes response instead.
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<StaffUser[]>('/users'),
    enabled: !!user && canManage,
  });

  const staff = (users ?? []).filter((u) => u.userRoles.some((r) => !['Parent', 'Student'].includes(r.role.name)));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['classes'] });

  const createClass = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          gradeLevelId: fd.get('gradeLevelId'),
          academicYearId: fd.get('academicYearId'),
          classTeacherId: fd.get('classTeacherId') || undefined,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setError(null);
      setNewClassTeacherId('');
      notifySuccess('Class created');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create class');
      notifyError(err, 'Failed to create class');
    },
  });

  const [newClassTeacherId, setNewClassTeacherId] = useState('');

  const assignTeacher = useMutation({
    mutationFn: ({ classId, classTeacherId }: { classId: string; classTeacherId: string | null }) =>
      apiFetch(`/classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ classTeacherId }) }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Class teacher updated');
    },
    onError: (err) => notifyError(err, 'Failed to update class teacher'),
  });

  const table = useTableControls(classes ?? [], { pageSize: 10, initialSortKey: 'name' });

  if (!user) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Classes</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add class'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {canManage && showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createClass.mutate(new FormData(e.currentTarget));
            }}
            className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
          >
            <Input name="name" placeholder="Class name, e.g. Grade 5 Blue" required className="col-span-2" />
            <select name="gradeLevelId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="">Grade level</option>
              {gradeLevels?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select name="academicYearId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="">Academic year</option>
              {academicYears?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <SearchableSelect
              name="classTeacherId"
              value={newClassTeacherId}
              onChange={setNewClassTeacherId}
              placeholder="Class teacher (optional — can assign later)"
              className="col-span-2"
              options={staff.map((s) => ({ value: s.id, label: s.fullName, sublabel: s.email }))}
            />
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={createClass.isPending}>
                {createClass.isPending ? 'Saving...' : 'Save class'}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <SkeletonTable rows={3} cols={4} />
        ) : !classes || classes.length === 0 ? (
          <p className="text-sm text-slate-500">No classes yet.</p>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <SortableTh label="Class" active={table.sortKey === 'name'} dir={table.sortDir} onClick={() => table.toggleSort('name')} />
                <th className="py-2 font-medium">Grade</th>
                <th className="py-2 font-medium">Academic Year</th>
                <th className="py-2 font-medium">Class Teacher</th>
              </tr>
            </thead>
            <tbody>
              {table.pageItems.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{c.name}</td>
                  <td className="py-2 text-slate-500">{c.gradeLevel?.name}</td>
                  <td className="py-2 text-slate-500">{c.academicYear?.name}</td>
                  <td className="py-2">
                    {canManage ? (
                      <SearchableSelect
                        className="w-48"
                        value={c.classTeacher?.id ?? ''}
                        disabled={assignTeacher.isPending}
                        placeholder="Unassigned"
                        onChange={(v) => assignTeacher.mutate({ classId: c.id, classTeacherId: v || null })}
                        options={staff.map((s) => ({ value: s.id, label: s.fullName }))}
                      />
                    ) : c.classTeacher ? (
                      <span className="text-slate-700">{c.classTeacher.fullName}</span>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  );
}
