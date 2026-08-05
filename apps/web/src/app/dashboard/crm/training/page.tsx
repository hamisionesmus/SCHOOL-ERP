'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;
const STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

interface TrainingRecord {
  id: string;
  traineeName: string;
  traineeEmail: string | null;
  traineePhone: string | null;
  track: string;
  status: string;
  client: { name: string } | null;
}

interface TrainingOverview {
  total: number;
  byTrack: { track: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

function AddTrainingDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [traineeName, setTraineeName] = useState('');
  const [traineeEmail, setTraineeEmail] = useState('');
  const [traineePhone, setTraineePhone] = useState('');
  const [track, setTrack] = useState<(typeof TRACKS)[number]>('FRONTEND');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/crm/training', {
        method: 'POST',
        body: JSON.stringify({ traineeName, traineeEmail: traineeEmail || undefined, traineePhone: traineePhone || undefined, track }),
      }),
    onSuccess: () => {
      notifySuccess('Trainee added');
      setOpen(false);
      setTraineeName('');
      setTraineeEmail('');
      setTraineePhone('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to add trainee'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Add Trainee
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Trainee</h3>
        <div className="space-y-3">
          <Input value={traineeName} onChange={(e) => setTraineeName(e.target.value)} placeholder="Trainee name" />
          <Input value={traineeEmail} onChange={(e) => setTraineeEmail(e.target.value)} placeholder="Email (optional)" />
          <Input value={traineePhone} onChange={(e) => setTraineePhone(e.target.value)} placeholder="Phone (optional)" />
          <select value={track} onChange={(e) => setTrack(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!traineeName.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CrmTrainingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['crm-training', page],
    queryFn: () => apiFetch<{ data: TrainingRecord[]; meta: { total: number } }>(`/platform/crm/training?page=${page}&pageSize=${pageSize}`),
  });
  const { data: overview } = useQuery({
    queryKey: ['crm-training-overview'],
    queryFn: () => apiFetch<TrainingOverview>('/platform/crm/training/overview'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/platform/crm/training/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-training'] });
      notifySuccess('Status updated');
    },
    onError: (err) => notifyError(err, 'Failed to update status'),
  });

  const records = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Training</h1>
          <p className="text-sm text-slate-500">Frontend, backend, and Coding &amp; Robotics trainees.</p>
        </div>
        <AddTrainingDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['crm-training'] })} />
      </header>

      {overview && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total trainees" value={overview.total} icon={GraduationCap} accent="violet" />
          {overview.byTrack.slice(0, 3).map((t) => (
            <StatCard key={t.track} label={t.track.replace(/_/g, ' ')} value={t.count} icon={GraduationCap} accent="blue" />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Trainees</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={4} />
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">No training records yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Trainee</th>
                    <th className="py-2 font-medium">Track</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">
                        {r.traineeName}
                        {r.client && <div className="text-xs text-slate-400">{r.client.name}</div>}
                      </td>
                      <td className="py-2 text-slate-500">{r.track.replace(/_/g, ' ')}</td>
                      <td className="py-2">
                        <Badge status={r.status} />
                      </td>
                      <td className="py-2 text-right">
                        <select
                          value={r.status}
                          onChange={(e) => updateStatus.mutate({ id: r.id, status: e.target.value })}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPageChange={setPage} totalItems={total} pageSize={pageSize} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
