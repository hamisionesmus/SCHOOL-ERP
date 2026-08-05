'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Program {
  id: string;
  title: string;
}
interface Report {
  id: string;
  periodStart: string;
  periodEnd: string;
  progressSummary: string;
  challenges: string | null;
  trainer: { user: { fullName: string } };
  program: { title: string } | null;
}

function TrainerReports() {
  const queryClient = useQueryClient();
  const { data: programs } = useQuery({ queryKey: ['trainer-programs-mine'], queryFn: () => apiFetch<Program[]>('/platform/training/programs/mine') });
  const { data: reports, isLoading } = useQuery({ queryKey: ['trainer-reports-mine'], queryFn: () => apiFetch<Report[]>('/platform/training/reports/mine') });

  const [programId, setProgramId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [progressSummary, setProgressSummary] = useState('');
  const [challenges, setChallenges] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      apiFetch('/platform/training/reports', {
        method: 'POST',
        body: JSON.stringify({
          programId: programId || undefined,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          progressSummary,
          challenges: challenges || undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Report submitted');
      queryClient.invalidateQueries({ queryKey: ['trainer-reports-mine'] });
      setPeriodStart('');
      setPeriodEnd('');
      setProgressSummary('');
      setChallenges('');
    },
    onError: (err) => notifyError(err, 'Failed to submit report'),
  });

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Progress Reports</h1>
        <p className="text-sm text-slate-500">Your periodic check-in — progress and any challenges.</p>
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Submit Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">General (not tied to one program)</option>
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <textarea
            value={progressSummary}
            onChange={(e) => setProgressSummary(e.target.value)}
            placeholder="What progress did you make this period?"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <textarea
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            placeholder="Any challenges you're facing? (optional)"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <Button disabled={!periodStart || !periodEnd || !progressSummary.trim() || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !reports || reports.length === 0 ? (
            <p className="text-sm text-slate-500">No reports submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-400">
                    {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                    {r.program && ` · ${r.program.title}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{r.progressSummary}</p>
                  {r.challenges && <p className="mt-1 text-sm text-rose-600">Challenges: {r.challenges}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AdminReports() {
  const { data: reports, isLoading } = useQuery({ queryKey: ['trainer-reports-all'], queryFn: () => apiFetch<Report[]>('/platform/training/reports') });

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Progress Reports</h1>
        <p className="text-sm text-slate-500">What trainers report about their own progress and challenges.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !reports || reports.length === 0 ? (
            <p className="text-sm text-slate-500">No reports submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{r.trainer.user.fullName}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                    {r.program && ` · ${r.program.title}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{r.progressSummary}</p>
                  {r.challenges && <p className="mt-1 text-sm text-rose-600">Challenges: {r.challenges}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function TrainerReportsPage() {
  const role = getSessionUser()?.role;
  return role === 'TRAINER' ? <TrainerReports /> : <AdminReports />;
}
