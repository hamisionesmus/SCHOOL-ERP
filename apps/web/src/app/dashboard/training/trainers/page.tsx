'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'TERMINATED'] as const;

interface Center {
  id: string;
  name: string;
}
interface TrainerProfile {
  id: string;
  track: string | null;
  monthlySalaryKes: number | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  status: string;
  center: { id: string; name: string } | null;
  user: { fullName: string; email: string; phone: string | null };
}

async function downloadContract(id: string, name: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_ORIGIN}/platform/training/trainers/${id}/contract`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-contract.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function AddTrainerDialog({ centers, onCreated }: { centers: Center[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [centerId, setCenterId] = useState('');
  const [track, setTrack] = useState<(typeof TRACKS)[number] | ''>('');
  const [monthlySalaryKes, setMonthlySalaryKes] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/training/trainers', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          phone,
          centerId: centerId || undefined,
          track: track || undefined,
          monthlySalaryKes: monthlySalaryKes ? Number(monthlySalaryKes) : undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Trainer added — credentials sent');
      setOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setMonthlySalaryKes('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to add trainer'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Add Trainer
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Trainer</h3>
        <div className="space-y-3">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          </div>
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">No center yet</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={track} onChange={(e) => setTrack(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">No track yet</option>
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Input type="number" value={monthlySalaryKes} onChange={(e) => setMonthlySalaryKes(e.target.value)} placeholder="Monthly salary (KES, optional)" />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!fullName.trim() || !email.trim() || !phone.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding...' : 'Add Trainer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditTrainerRow({ trainer, centers }: { trainer: TrainerProfile; centers: Center[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [centerId, setCenterId] = useState(trainer.center?.id ?? '');
  const [track, setTrack] = useState(trainer.track ?? '');
  const [monthlySalaryKes, setMonthlySalaryKes] = useState(trainer.monthlySalaryKes?.toString() ?? '');
  const [contractStartDate, setContractStartDate] = useState(trainer.contractStartDate?.slice(0, 10) ?? '');
  const [contractEndDate, setContractEndDate] = useState(trainer.contractEndDate?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(trainer.status);

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/training/trainers/${trainer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          centerId: centerId || undefined,
          track: track || undefined,
          monthlySalaryKes: monthlySalaryKes ? Number(monthlySalaryKes) : undefined,
          contractStartDate: contractStartDate ? new Date(contractStartDate).toISOString() : undefined,
          contractEndDate: contractEndDate ? new Date(contractEndDate).toISOString() : undefined,
          status,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-trainers'] });
      notifySuccess('Trainer updated');
      setEditing(false);
    },
    onError: (err) => notifyError(err, 'Failed to update trainer'),
  });

  if (!editing) {
    return (
      <tr className="border-b border-slate-100">
        <td className="py-2 font-medium text-slate-900">{trainer.user.fullName}</td>
        <td className="py-2 text-slate-500">{trainer.track?.replace(/_/g, ' ') ?? '—'}</td>
        <td className="py-2 text-slate-500">{trainer.center?.name ?? '—'}</td>
        <td className="py-2 text-slate-500">{trainer.monthlySalaryKes != null ? `KES ${trainer.monthlySalaryKes.toLocaleString()}` : '—'}</td>
        <td className="py-2">
          <Badge status={trainer.status} />
        </td>
        <td className="py-2 text-right">
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => downloadContract(trainer.id, trainer.user.fullName)}>
              <Download size={13} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50">
      <td className="py-2 font-medium text-slate-900" colSpan={6}>
        <div className="flex flex-wrap items-end gap-2 py-2">
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
            <option value="">No center</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={track} onChange={(e) => setTrack(e.target.value)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
            <option value="">No track</option>
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Input className="h-9 w-32 text-xs" type="number" value={monthlySalaryKes} onChange={(e) => setMonthlySalaryKes(e.target.value)} placeholder="Salary" />
          <Input className="h-9 w-36 text-xs" type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
          <Input className="h-9 w-36 text-xs" type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function TrainersPage() {
  const queryClient = useQueryClient();
  const { data: trainers, isLoading } = useQuery({ queryKey: ['training-trainers'], queryFn: () => apiFetch<TrainerProfile[]>('/platform/training/trainers') });
  const { data: centers } = useQuery({ queryKey: ['training-centers'], queryFn: () => apiFetch<Center[]>('/platform/training/centers') });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Trainers</h1>
          <p className="text-sm text-slate-500">Assignments, salary, and contracts — auto-generated on download.</p>
        </div>
        <AddTrainerDialog centers={centers ?? []} onCreated={() => queryClient.invalidateQueries({ queryKey: ['training-trainers'] })} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Trainers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={6} />
          ) : !trainers || trainers.length === 0 ? (
            <p className="text-sm text-slate-500">No trainers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Track</th>
                  <th className="py-2 font-medium">Center</th>
                  <th className="py-2 font-medium">Salary</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {trainers.map((t) => (
                  <EditTrainerRow key={t.id} trainer={t} centers={centers ?? []} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
