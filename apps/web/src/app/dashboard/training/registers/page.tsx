'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Send } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { getSessionUser, getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Countdown } from '@/components/ui/countdown';

interface Program {
  id: string;
  title: string;
  endDate: string;
  status: string;
}
interface Register {
  id: string;
  date: string;
  traineesPresent: number;
  traineesTotal: number;
  topicsCovered: string;
  notes: string | null;
  program: { title: string; center: { name: string } | null };
  trainer: { user: { fullName: string } };
}
interface RegisterStats {
  programTitle: string;
  daysRemaining: number;
  rosterSize: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number | null;
  byGender: Record<'MALE' | 'FEMALE' | 'OTHER', { present: number; absent: number }>;
}

function AttendanceStats({ programId }: { programId: string }) {
  const { data: stats } = useQuery({
    queryKey: ['register-stats', programId],
    queryFn: () => apiFetch<RegisterStats>(`/platform/training/registers/stats?programId=${programId}`),
    enabled: !!programId,
  });
  if (!stats) return null;

  const genderData = (['MALE', 'FEMALE', 'OTHER'] as const)
    .map((g) => ({ name: g[0] + g.slice(1).toLowerCase(), present: stats.byGender[g].present, absent: stats.byGender[g].absent }))
    .filter((d) => d.present + d.absent > 0);

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{stats.programTitle} — Attendance</CardTitle>
        <Countdown endDate={new Date(Date.now() + stats.daysRemaining * 86_400_000)} />
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold text-slate-900">{stats.rosterSize}</p>
            <p className="text-xs text-slate-500">Trainees</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-emerald-600">{stats.attendanceRate ?? '—'}%</p>
            <p className="text-xs text-slate-500">Attendance rate</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-900">
              {stats.totalPresent}/{stats.totalPresent + stats.totalAbsent}
            </p>
            <p className="text-xs text-slate-500">Present marks</p>
          </div>
        </div>
        {genderData.length > 0 && (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function downloadRegisterPdf(id: string, date: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_ORIGIN}/platform/training/registers/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `register-${date.slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function TrainerRegisters() {
  const queryClient = useQueryClient();
  const { data: programs } = useQuery({ queryKey: ['trainer-programs-mine'], queryFn: () => apiFetch<Program[]>('/platform/training/programs/mine') });
  const { data: registers, isLoading } = useQuery({ queryKey: ['registers-mine'], queryFn: () => apiFetch<Register[]>('/platform/training/registers/mine') });

  const [programId, setProgramId] = useState('');
  const [date, setDate] = useState('');
  const [traineesPresent, setTraineesPresent] = useState('');
  const [traineesTotal, setTraineesTotal] = useState('');
  const [topicsCovered, setTopicsCovered] = useState('');
  const [notes, setNotes] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      apiFetch('/platform/training/registers', {
        method: 'POST',
        body: JSON.stringify({
          programId,
          date: new Date(date).toISOString(),
          traineesPresent: Number(traineesPresent),
          traineesTotal: Number(traineesTotal),
          topicsCovered,
          notes: notes || undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Register submitted');
      queryClient.invalidateQueries({ queryKey: ['registers-mine'] });
      setDate('');
      setTraineesPresent('');
      setTraineesTotal('');
      setTopicsCovered('');
      setNotes('');
    },
    onError: (err) => notifyError(err, 'Failed to submit register'),
  });

  const resendLink = useMutation({
    mutationFn: () => apiFetch<{ sent: number }>('/platform/training/daily-link/resend', { method: 'POST' }),
    onSuccess: (res) => notifySuccess(res.sent > 0 ? `Sent ${res.sent} link(s) to your phone/email` : 'No active program found for today'),
    onError: (err) => notifyError(err, 'Failed to send link'),
  });

  const activeProgram = (programs ?? []).find((p) => p.status === 'ACTIVE') ?? programs?.[0];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Daily Register</h1>
          <p className="text-sm text-slate-500">Attendance and what you covered today.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeProgram && <Countdown endDate={activeProgram.endDate} />}
          <Button size="sm" variant="outline" className="gap-1.5" disabled={resendLink.isPending} onClick={() => resendLink.mutate()}>
            <Send size={13} /> {resendLink.isPending ? 'Sending...' : "Send me today's link"}
          </Button>
        </div>
      </header>

      {activeProgram && <AttendanceStats programId={activeProgram.id} />}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Submit Today&apos;s Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">Select program...</option>
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" value={traineesPresent} onChange={(e) => setTraineesPresent(e.target.value)} placeholder="Trainees present" />
            <Input type="number" value={traineesTotal} onChange={(e) => setTraineesTotal(e.target.value)} placeholder="Trainees total" />
          </div>
          <textarea
            value={topicsCovered}
            onChange={(e) => setTopicsCovered(e.target.value)}
            placeholder="Topics covered today..."
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes / challenges (optional)"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <Button
            disabled={!programId || !date || !traineesPresent || !traineesTotal || !topicsCovered.trim() || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? 'Submitting...' : 'Submit Register'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Registers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !registers || registers.length === 0 ? (
            <p className="text-sm text-slate-500">No registers submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {registers.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(r.date).toLocaleDateString()} — {r.program.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.traineesPresent}/{r.traineesTotal} present
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadRegisterPdf(r.id, r.date)}>
                    <Download size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AdminRegisters() {
  const { data: registers, isLoading } = useQuery({ queryKey: ['registers-all'], queryFn: () => apiFetch<Register[]>('/platform/training/registers') });

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Daily Registers</h1>
        <p className="text-sm text-slate-500">Attendance and coverage submitted by every trainer.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Registers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !registers || registers.length === 0 ? (
            <p className="text-sm text-slate-500">No registers submitted yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Trainer</th>
                  <th className="py-2 font-medium">Program</th>
                  <th className="py-2 font-medium">Present</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {registers.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-2 text-slate-500">{r.trainer.user.fullName}</td>
                    <td className="py-2 text-slate-500">{r.program.title}</td>
                    <td className="py-2 text-slate-500">
                      {r.traineesPresent}/{r.traineesTotal}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => downloadRegisterPdf(r.id, r.date)}>
                        <Download size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function RegistersPage() {
  const role = getSessionUser()?.role;
  return role === 'TRAINER' ? <TrainerRegisters /> : <AdminRegisters />;
}
