'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Countdown } from '@/components/ui/countdown';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;

interface Center {
  id: string;
  name: string;
}
interface TrainerProfile {
  id: string;
  user: { fullName: string };
}
interface Program {
  id: string;
  title: string;
  track: string;
  status: string;
  startDate: string;
  endDate: string;
  center: { name: string } | null;
  trainer: { user: { fullName: string } } | null;
  _count: { trainees: number; registers: number };
}

function AddProgramDialog({ centers, trainers, onCreated }: { centers: Center[]; trainers: TrainerProfile[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [track, setTrack] = useState<(typeof TRACKS)[number]>('FRONTEND');
  const [centerId, setCenterId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/training/programs', {
        method: 'POST',
        body: JSON.stringify({
          title,
          track,
          centerId: centerId || undefined,
          trainerId: trainerId || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        }),
      }),
    onSuccess: () => {
      notifySuccess('Program created');
      setOpen(false);
      setTitle('');
      setStartDate('');
      setEndDate('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to create program'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> New Program
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">New Training Program</h3>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Program title" />
          <select value={track} onChange={(e) => setTrack(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">No center</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">No trainer yet</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user.fullName}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!title.trim() || !startDate || !endDate || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProgramsPage() {
  const queryClient = useQueryClient();
  const { data: programs, isLoading } = useQuery({ queryKey: ['training-programs'], queryFn: () => apiFetch<Program[]>('/platform/training/programs') });
  const { data: centers } = useQuery({ queryKey: ['training-centers'], queryFn: () => apiFetch<Center[]>('/platform/training/centers') });
  const { data: trainers } = useQuery({ queryKey: ['training-trainers'], queryFn: () => apiFetch<TrainerProfile[]>('/platform/training/trainers') });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Programs</h1>
          <p className="text-sm text-slate-500">Cohorts with real start/end dates.</p>
        </div>
        <AddProgramDialog centers={centers ?? []} trainers={trainers ?? []} onCreated={() => queryClient.invalidateQueries({ queryKey: ['training-programs'] })} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Programs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={6} />
          ) : !programs || programs.length === 0 ? (
            <p className="text-sm text-slate-500">No programs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Title</th>
                  <th className="py-2 font-medium">Track</th>
                  <th className="py-2 font-medium">Center</th>
                  <th className="py-2 font-medium">Trainer</th>
                  <th className="py-2 font-medium">Dates</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{p.title}</td>
                    <td className="py-2 text-slate-500">{p.track.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-slate-500">{p.center?.name ?? '—'}</td>
                    <td className="py-2 text-slate-500">{p.trainer?.user.fullName ?? '—'}</td>
                    <td className="py-2 text-slate-500">
                      <div className="flex flex-col gap-1">
                        <span>
                          {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                        </span>
                        {p.status === 'ACTIVE' && <Countdown endDate={p.endDate} className="w-fit" />}
                      </div>
                    </td>
                    <td className="py-2">
                      <Badge status={p.status} />
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
