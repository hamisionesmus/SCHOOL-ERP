'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanFace } from 'lucide-react';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { SortableTh } from '@/components/ui/sortable-th';
import { Pagination } from '@/components/ui/pagination';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useTableControls } from '@/hooks/use-table-controls';

interface UserRef {
  id: string;
  fullName: string;
  email?: string;
}
interface StudentRef {
  id: string;
  firstName: string;
  lastName: string;
}
interface BiometricEvent {
  id: string;
  subjectType: 'STUDENT' | 'STAFF';
  student: StudentRef | null;
  staff: UserRef | null;
  method: 'FACE' | 'FINGERPRINT';
  direction: 'IN' | 'OUT';
  occurredAt: string;
  loggedBy: UserRef;
  note: string | null;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  userRoles: { role: { name: string } }[];
}

export default function BiometricPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const canManage = !!user?.permissions?.includes('BIOMETRIC:MANAGE');
  const [subjectType, setSubjectType] = useState<'STUDENT' | 'STAFF'>('STUDENT');
  const [error, setError] = useState<string | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ['biometric-events'],
    queryFn: () => apiFetch<BiometricEvent[]>('/biometric-events'),
    enabled: !!user,
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && canManage,
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<StaffUser[]>('/users'),
    enabled: !!user && canManage,
  });
  const staff = (users ?? []).filter((u) => u.userRoles.some((r) => !['Parent', 'Student'].includes(r.role.name)));

  const logEvent = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/biometric-events', {
        method: 'POST',
        body: JSON.stringify({
          subjectType,
          studentId: subjectType === 'STUDENT' ? fd.get('subjectId') : undefined,
          staffUserId: subjectType === 'STAFF' ? fd.get('subjectId') : undefined,
          method: subjectType === 'STUDENT' ? 'FACE' : 'FINGERPRINT',
          direction: fd.get('direction'),
          note: fd.get('note') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric-events'] });
      setError(null);
      setSubjectId('');
      notifySuccess('Scan logged');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to log scan');
      notifyError(err, 'Failed to log scan');
    },
  });

  const [subjectId, setSubjectId] = useState('');
  // No initialSortKey: the API already orders newest-first.
  const table = useTableControls(events ?? [], { pageSize: 10 });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanFace size={18} />
              Log a scan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-slate-500">
              No physical scanner is connected in this environment — this form stands in for what a
              real face/fingerprint device would post automatically. Learners are scanned by face,
              staff by fingerprint.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                logEvent.mutate(new FormData(e.currentTarget));
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="col-span-2 flex gap-1 rounded-lg border border-slate-200 p-1">
                {(['STUDENT', 'STAFF'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSubjectType(t);
                      setSubjectId('');
                    }}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      subjectType === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'STUDENT' ? 'Learner (face)' : 'Staff (fingerprint)'}
                  </button>
                ))}
              </div>
              <SearchableSelect
                name="subjectId"
                value={subjectId}
                onChange={setSubjectId}
                required
                placeholder={subjectType === 'STUDENT' ? 'Select student' : 'Select staff member'}
                className="col-span-2"
                options={
                  subjectType === 'STUDENT'
                    ? (students ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))
                    : staff.map((s) => ({ value: s.id, label: s.fullName, sublabel: s.email }))
                }
              />
              <select name="direction" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="IN">Arriving (IN)</option>
                <option value="OUT">Leaving (OUT)</option>
              </select>
              <input name="note" placeholder="Note (optional)" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={logEvent.isPending}>
                  {logEvent.isPending ? 'Logging...' : 'Log scan'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{canManage ? 'Recent scans' : 'Attendance log'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : !events || events.length === 0 ? (
            <p className="text-sm text-slate-500">No scans logged yet.</p>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Who</th>
                  <SortableTh label="Method" active={table.sortKey === 'method'} dir={table.sortDir} onClick={() => table.toggleSort('method')} />
                  <SortableTh label="Direction" active={table.sortKey === 'direction'} dir={table.sortDir} onClick={() => table.toggleSort('direction')} />
                  <SortableTh label="Time" active={table.sortKey === 'occurredAt'} dir={table.sortDir} onClick={() => table.toggleSort('occurredAt')} />
                </tr>
              </thead>
              <tbody>
                {table.pageItems.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      {e.subjectType === 'STUDENT'
                        ? `${e.student?.firstName} ${e.student?.lastName}`
                        : e.staff?.fullName}
                      {e.note && <span className="ml-1.5 text-xs font-normal text-slate-400">· {e.note}</span>}
                    </td>
                    <td className="py-2 text-slate-500">{e.method === 'FACE' ? 'Face' : 'Fingerprint'}</td>
                    <td className="py-2">
                      <Badge status={e.direction} />
                    </td>
                    <td className="py-2 text-slate-500">{new Date(e.occurredAt).toLocaleString()}</td>
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
    </div>
  );
}
