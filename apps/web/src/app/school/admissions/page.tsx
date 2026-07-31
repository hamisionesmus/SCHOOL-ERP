'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolNav } from '@/components/school-nav';

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

export default function AdmissionsPage() {
  const { user, logout } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    mutationFn: (formData: FormData) =>
      apiFetch('/admissions/applications', {
        method: 'POST',
        body: JSON.stringify({
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          dateOfBirth: formData.get('dateOfBirth'),
          gender: formData.get('gender'),
          gradeLevelId: formData.get('gradeLevelId'),
          guardianName: formData.get('guardianName'),
          guardianEmail: formData.get('guardianEmail'),
          guardianPhone: formData.get('guardianPhone'),
        }),
      }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setError(null);
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

  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <SchoolNav user={user} onLogout={logout} />

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
                createApplication.mutate(new FormData(e.currentTarget));
              }}
              className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input name="firstName" placeholder="First name" required />
              <Input name="lastName" placeholder="Last name" required />
              <Input name="dateOfBirth" type="date" required />
              <select name="gender" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
              <select
                name="gradeLevelId"
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
              <Input name="guardianName" placeholder="Guardian full name" required className="col-span-2" />
              <Input name="guardianEmail" type="email" placeholder="Guardian email" required />
              <Input name="guardianPhone" placeholder="Guardian phone" required />
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Applicant</th>
                  <th className="py-2 font-medium">Grade</th>
                  <th className="py-2 font-medium">Guardian</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
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
          )}
        </CardContent>
      </Card>
    </main>
  );
}
