'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
interface SickSheet {
  id: string;
  student: Student;
  issuedBy: { fullName: string };
  dateIssued: string;
  reason: string;
  recommendedRestUntil: string | null;
}

export default function HealthPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.permissions?.includes('HEALTH:MANAGE');
  const canIssueSickSheet = user?.permissions?.includes('HEALTH:ISSUE_SICK_SHEET');

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && (!!canManage || !!canIssueSickSheet),
  });
  const { data: sickSheets } = useQuery({
    queryKey: ['sick-sheets'],
    queryFn: () => apiFetch<SickSheet[]>('/sick-sheets'),
    enabled: !!user,
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
      setAlertStudentId('');
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
      setVisitStudentId('');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to log visit'),
  });

  const createSickSheet = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/sick-sheets', {
        method: 'POST',
        body: JSON.stringify({
          studentId: fd.get('studentId'),
          reason: fd.get('reason'),
          recommendedRestUntil: fd.get('recommendedRestUntil') || undefined,
          notes: fd.get('notes') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sick-sheets'] });
      setShowSickSheetForm(false);
      setError(null);
      setSickSheetStudentId('');
      notifySuccess('Sick sheet issued');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to issue sick sheet');
      notifyError(err, 'Failed to issue sick sheet');
    },
  });

  async function downloadSickSheetPdf(id: string, studentName: string) {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_ORIGIN}/sick-sheets/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${studentName.replace(/\s+/g, '_')}_SickSheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notifyError(err, 'Failed to download PDF');
    }
  }

  const [showSickSheetForm, setShowSickSheetForm] = useState(false);
  const [sickSheetStudentId, setSickSheetStudentId] = useState('');
  const [alertStudentId, setAlertStudentId] = useState('');
  const [visitStudentId, setVisitStudentId] = useState('');
  const sickSheetsTable = useTableControls(sickSheets ?? [], { pageSize: 8 });
  const alertsTable = useTableControls(alerts ?? [], { pageSize: 8 });
  const visitsTable = useTableControls(visits ?? [], { pageSize: 8 });

  if (!user) return null;

  return (
    <>
          <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sick Sheets</CardTitle>
          {canIssueSickSheet && (
            <Button size="sm" onClick={() => setShowSickSheetForm((v) => !v)}>
              {showSickSheetForm ? 'Cancel' : '+ Issue sick sheet'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Printable excuse notes for a same-day absence. Issued by the student&apos;s class teacher,
            or by a School Administrator for any student.
          </p>
          {showSickSheetForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSickSheet.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <SearchableSelect
                name="studentId"
                value={sickSheetStudentId}
                onChange={setSickSheetStudentId}
                required
                placeholder="Select student"
                className="col-span-2"
                options={(students ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
              <Input name="reason" placeholder="Reason, e.g. Fever and flu symptoms" required className="col-span-2" />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Expected back (optional)</label>
                <Input name="recommendedRestUntil" type="date" />
              </div>
              <Input name="notes" placeholder="Notes (optional)" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createSickSheet.isPending}>
                  {createSickSheet.isPending ? 'Issuing...' : 'Issue sick sheet'}
                </Button>
              </div>
            </form>
          )}
          {!sickSheets || sickSheets.length === 0 ? (
            <p className="text-sm text-slate-500">No sick sheets issued.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 text-sm">
                {sickSheetsTable.pageItems.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <span className="font-medium text-slate-900">
                        {s.student.firstName} {s.student.lastName}
                      </span>{' '}
                      <span className="text-slate-500">
                        — {s.reason} ({new Date(s.dateIssued).toLocaleDateString()})
                        {s.recommendedRestUntil && `, back by ${new Date(s.recommendedRestUntil).toLocaleDateString()}`}
                      </span>
                      <p className="text-xs text-slate-400">Issued by {s.issuedBy.fullName}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadSickSheetPdf(s.id, `${s.student.firstName}_${s.student.lastName}`)}
                    >
                      PDF
                    </Button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={sickSheetsTable.page}
                pageCount={sickSheetsTable.pageCount}
                totalItems={sickSheetsTable.totalItems}
                pageSize={sickSheetsTable.pageSize}
                onPageChange={sickSheetsTable.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

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
              <SearchableSelect
                name="studentId"
                value={alertStudentId}
                onChange={setAlertStudentId}
                required
                placeholder="Select student"
                className="col-span-2"
                options={(students ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
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
              <SearchableSelect
                name="studentId"
                value={visitStudentId}
                onChange={setVisitStudentId}
                required
                placeholder="Select student"
                className="col-span-2"
                options={(students ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
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
