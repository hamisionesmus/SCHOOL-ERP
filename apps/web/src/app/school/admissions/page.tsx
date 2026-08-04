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
import { SortableTh } from '@/components/ui/sortable-th';
import { useTableControls } from '@/hooks/use-table-controls';
import { useDraftState } from '@/hooks/use-draft-state';

interface GradeLevel {
  id: string;
  code: string;
  name: string;
}
interface Application {
  id: string;
  firstName: string;
  lastName: string;
  status: 'APPLIED' | 'INTERVIEW' | 'OFFERED' | 'ADMITTED' | 'REJECTED' | 'WAITLISTED';
  gradeLevel: GradeLevel;
  guardianName: string;
  guardianEmail: string;
  createdAt: string;
}

const STATUS_OPTIONS = ['APPLIED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WAITLISTED'] as const;

type ApplicationDraft = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  gradeLevelId: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
};

export default function AdmissionsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadDraft, saveDraft, clearDraft } = useDraftState<ApplicationDraft>('admissions-application');
  const draft = loadDraft();
  const [firstName, setFirstName] = useState(draft?.firstName ?? '');
  const [lastName, setLastName] = useState(draft?.lastName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(draft?.dateOfBirth ?? '');
  const [gender, setGender] = useState(draft?.gender ?? '');
  const [gradeLevelId, setGradeLevelId] = useState(draft?.gradeLevelId ?? '');
  const [guardianName, setGuardianName] = useState(draft?.guardianName ?? '');
  const [guardianEmail, setGuardianEmail] = useState(draft?.guardianEmail ?? '');
  const [guardianPhone, setGuardianPhone] = useState(draft?.guardianPhone ?? '');

  useEffect(() => {
    saveDraft({ firstName, lastName, dateOfBirth, gender, gradeLevelId, guardianName, guardianEmail, guardianPhone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, dateOfBirth, gender, gradeLevelId, guardianName, guardianEmail, guardianPhone]);

  const { data: gradeLevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => apiFetch<GradeLevel[]>('/grade-levels'),
    enabled: !!user,
  });

  const { data: applications, isLoading } = useQuery({
    queryKey: ['admissions'],
    queryFn: () => apiFetch<Application[]>('/admissions/applications'),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admissions'] });

  const createApplication = useMutation({
    mutationFn: () =>
      apiFetch('/admissions/applications', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          gender,
          gradeLevelId,
          guardianName,
          guardianEmail,
          guardianPhone,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setError(null);
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setGender('');
      setGradeLevelId('');
      setGuardianName('');
      setGuardianEmail('');
      setGuardianPhone('');
      clearDraft();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create application'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/admissions/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: invalidate,
  });

  const admit = useMutation({
    mutationFn: (id: string) => apiFetch(`/admissions/applications/${id}/admit`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const table = useTableControls(applications ?? [], { pageSize: 8 });

  if (!user) return null;

  return (
    <>
          <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Admissions</CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ New application'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createApplication.mutate();
              }}
              className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required />
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required />
              <Input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} type="date" required />
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
              <select
                value={gradeLevelId}
                onChange={(e) => setGradeLevelId(e.target.value)}
                required
                className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Applying for grade</option>
                {gradeLevels?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian full name" required className="col-span-2" />
              <Input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} type="email" placeholder="Guardian email" required />
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="Guardian phone" required />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createApplication.isPending}>
                  {createApplication.isPending ? 'Saving...' : 'Submit application'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !applications || applications.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <SortableTh label="Applicant" active={table.sortKey === 'firstName'} dir={table.sortDir} onClick={() => table.toggleSort('firstName')} />
                  <th className="py-2 font-medium">Grade</th>
                  <SortableTh label="Guardian" active={table.sortKey === 'guardianName'} dir={table.sortDir} onClick={() => table.toggleSort('guardianName')} />
                  <SortableTh label="Status" active={table.sortKey === 'status'} dir={table.sortDir} onClick={() => table.toggleSort('status')} />
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {table.pageItems.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      {a.firstName} {a.lastName}
                    </td>
                    <td className="py-2 text-slate-500">{a.gradeLevel?.name}</td>
                    <td className="py-2 text-slate-500">{a.guardianName}</td>
                    <td className="py-2">
                      <Badge status={a.status} />
                    </td>
                    <td className="py-2 text-right">
                      {a.status === 'ADMITTED' ? null : (
                        <div className="flex justify-end gap-2">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) updateStatus.mutate({ id: a.id, status: e.target.value });
                            }}
                            className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                          >
                            <option value="">Change status...</option>
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <Button size="sm" onClick={() => admit.mutate(a.id)} disabled={admit.isPending}>
                            Admit
                          </Button>
                        </div>
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
    </>
  );
}
