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

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface MedicalAlert {
  id: string;
  student: Student;
  condition: string;
  severity: string;
  notes: string | null;
}
interface ClinicVisit {
  id: string;
  student: Student;
  visitDate: string;
  symptoms: string;
  treatment: string | null;
}

export default function HealthPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.permissions?.includes('HEALTH:MANAGE');

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && !!canManage,
  });
  const { data: alerts } = useQuery({
    queryKey: ['medical-alerts'],
    queryFn: () => apiFetch<MedicalAlert[]>('/health/medical-alerts'),
    enabled: !!user,
  });
  const { data: visits } = useQuery({
    queryKey: ['clinic-visits'],
    queryFn: () => apiFetch<ClinicVisit[]>('/health/clinic-visits'),
    enabled: !!user,
  });

  const createAlert = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/health/medical-alerts', {
        method: 'POST',
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          condition: fd.get('condition'),
          severity: fd.get('severity'),
          notes: fd.get('notes') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-alerts'] });
      setShowAlertForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add alert'),
  });

  const createVisit = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/health/clinic-visits', {
        method: 'POST',
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          symptoms: fd.get('symptoms'),
          treatment: fd.get('treatment') || undefined,
          medication: fd.get('medication') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-visits'] });
      setShowVisitForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to log visit'),
  });

  const alertsTable = useTableControls(alerts ?? [], { pageSize: 8 });
  const visitsTable = useTableControls(visits ?? [], { pageSize: 8 });

  if (!user) return null;

  return (
    <>
          <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Medical alerts</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowAlertForm((v) => !v)}>
              {showAlertForm ? 'Cancel' : '+ Add alert'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAlertForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAlert.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <select name="studentId" required className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Student</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <Input name="condition" placeholder="Condition, e.g. Peanut allergy" required />
              <select name="severity" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Severity</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <Input name="notes" placeholder="Notes (optional)" className="col-span-2" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createAlert.isPending}>
                  Save
                </Button>
              </div>
            </form>
          )}
          {!alerts || alerts.length === 0 ? (
            <p className="text-sm text-slate-500">No medical alerts.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-sm">
                {alertsTable.pageItems.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-slate-900">
                      {a.student.firstName} {a.student.lastName}
                    </span>{' '}
                    <span className="text-slate-500">
                      — {a.condition} ({a.severity}){a.notes && `: ${a.notes}`}
                    </span>
                  </li>
                ))}
              </ul>
              <Pagination
                page={alertsTable.page}
                pageCount={alertsTable.pageCount}
                totalItems={alertsTable.totalItems}
                pageSize={alertsTable.pageSize}
                onPageChange={alertsTable.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clinic visits</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowVisitForm((v) => !v)}>
              {showVisitForm ? 'Cancel' : '+ Log visit'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showVisitForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createVisit.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <select name="studentId" required className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Student</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <Input name="symptoms" placeholder="Symptoms" required className="col-span-2" />
              <Input name="treatment" placeholder="Treatment (optional)" />
              <Input name="medication" placeholder="Medication (optional)" />
              <div className="col-span-2">
                <Button type="submit" disabled={createVisit.isPending}>
                  Save
                </Button>
              </div>
            </form>
          )}
          {!visits || visits.length === 0 ? (
            <p className="text-sm text-slate-500">No clinic visits logged.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-sm">
                {visitsTable.pageItems.map((v) => (
                  <li key={v.id}>
                    <span className="font-medium text-slate-900">
                      {v.student.firstName} {v.student.lastName}
                    </span>{' '}
                    <span className="text-slate-500">
                      — {v.symptoms} ({new Date(v.visitDate).toLocaleDateString()})
                      {v.treatment && `, treated: ${v.treatment}`}
                    </span>
                  </li>
                ))}
              </ul>
              <Pagination
                page={visitsTable.page}
                pageCount={visitsTable.pageCount}
                totalItems={visitsTable.totalItems}
                pageSize={visitsTable.pageSize}
                onPageChange={visitsTable.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
