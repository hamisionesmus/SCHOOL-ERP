'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExcelImportExportBar } from '@/components/ui/excel-import-export-bar';

interface SchoolClass {
  id: string;
  name: string;
  classTeacherId: string | null;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  currentClassId: string | null;
}
interface AttendanceRecord {
  id: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  locked: boolean;
}

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState<string>('');
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState<Record<string, (typeof STATUSES)[number]>>({});
  const [error, setError] = useState<string | null>(null);

  const canMark = user?.permissions?.includes('ATTENDANCE:MARK');
  const canReopen = user?.permissions?.includes('ATTENDANCE:REOPEN');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => apiFetch<SchoolClass[]>('/classes'),
    enabled: !!user,
  });

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user,
  });

  // A marker (admin/class teacher) picks from classes they're allowed to mark; anyone else (parent/
  // student, view-only) only ever sees classes that actually contain a student visible to them —
  // /students is already scoped server-side to "my children"/"my own record", so this never leaks
  // other students, it just avoids offering an empty "no students" dead end for every other class.
  const myClasses = useMemo(() => {
    if (canMark) {
      return (classes ?? []).filter(
        (c) => user?.roles?.includes('School Administrator') || c.classTeacherId === user?.sub,
      );
    }
    const visibleClassIds = new Set((students ?? []).map((s) => s.currentClassId).filter(Boolean));
    return (classes ?? []).filter((c) => visibleClassIds.has(c.id));
  }, [classes, students, user, canMark]);

  const classStudents = (students ?? []).filter((s) => s.currentClassId === classId);

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance', classId, date],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/attendance?classId=${classId}&date=${date}`),
    enabled: !!user && !!classId,
  });

  const recordsByStudent = new Map((records ?? []).map((r) => [r.studentId, r]));
  const isLocked = (records ?? []).length > 0 && (records ?? []).every((r) => r.locked);

  const markMutation = useMutation({
    mutationFn: () =>
      apiFetch('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          classId,
          date,
          entries: classStudents.map((s) => ({
            studentId: s.id,
            status: draft[s.id] ?? recordsByStudent.get(s.id)?.status ?? 'PRESENT',
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', classId, date] });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to submit attendance'),
  });

  const reopenMutation = useMutation({
    mutationFn: () => apiFetch('/attendance/reopen', { method: 'PATCH', body: JSON.stringify({ classId, date }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', classId, date] }),
  });

  if (!user) return null;

  return (
    <>
          <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{canMark ? 'Mark attendance' : 'Attendance'}</CardTitle>
          {canMark && (
            <ExcelImportExportBar
              exportUrl="/attendance/export"
              templateUrl="/attendance/import-template"
              importUrl="/attendance/import"
              entityLabel="attendance"
              onImported={() => queryClient.invalidateQueries({ queryKey: ['attendance'] })}
            />
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-3">
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">Select class</option>
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            {isLocked && <span className="self-center text-xs font-medium text-emerald-700">Submitted &amp; locked</span>}
          </div>

          {!classId ? (
            <p className="text-sm text-slate-500">Choose a class to mark or view attendance.</p>
          ) : isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : classStudents.length === 0 ? (
            <p className="text-sm text-slate-500">No students assigned to this class yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Student</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s) => {
                    const current = draft[s.id] ?? recordsByStudent.get(s.id)?.status ?? 'PRESENT';
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium text-slate-900">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="py-2">
                          {canMark ? (
                            <select
                              value={current}
                              disabled={isLocked && !canReopen}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, [s.id]: e.target.value as (typeof STATUSES)[number] }))
                              }
                              className="h-8 rounded-md border border-slate-300 px-2 text-xs disabled:bg-slate-100"
                            >
                              {STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge status={current} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex gap-2">
                {canMark && (!isLocked || canReopen) && (
                  <Button onClick={() => markMutation.mutate()} disabled={markMutation.isPending}>
                    {markMutation.isPending ? 'Submitting...' : isLocked ? 'Update & re-lock' : 'Submit attendance'}
                  </Button>
                )}
                {isLocked && canReopen && (
                  <Button variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
                    {reopenMutation.isPending ? 'Reopening...' : 'Reopen for correction'}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
