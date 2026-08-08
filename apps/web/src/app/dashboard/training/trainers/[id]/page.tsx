'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Mail, Phone } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TrainerProfile {
  id: string;
  track: string | null;
  trackOther: string | null;
  monthlySalaryKes: number | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  status: string;
  center: { id: string; name: string } | null;
  user: { id: string; fullName: string; email: string; phone: string | null };
}

interface CenterHistoryEntry {
  id: string;
  startDate: string;
  endDate: string | null;
  center: { id: string; name: string };
}

interface Program {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  center: { name: string } | null;
  trainer: { id: string } | null;
}

async function downloadContract(id: string, name: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_ORIGIN}/platform/training/trainers/${id}/contract`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    notifyError(undefined, 'Failed to download contract');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-contract.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TrainerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: trainer, isLoading } = useQuery({
    queryKey: ['trainer-detail', id],
    queryFn: () => apiFetch<TrainerProfile>(`/platform/training/trainers/${id}`),
  });
  const { data: centerHistory } = useQuery({
    queryKey: ['trainer-center-history', id],
    queryFn: () => apiFetch<CenterHistoryEntry[]>(`/platform/training/trainers/${id}/center-history`),
  });
  const { data: programs } = useQuery({
    queryKey: ['training-programs-all'],
    queryFn: () => apiFetch<Program[]>('/platform/training/programs'),
  });

  if (isLoading || !trainer) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  const assignedPrograms = (programs ?? []).filter((p) => p.trainer?.id === id);

  return (
    <>
      <Link href="/dashboard/training/trainers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Back to Trainers
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{trainer.user.fullName}</h1>
          <p className="text-sm text-slate-500">{trainer.track?.replace(/_/g, ' ') ?? 'No track assigned'}</p>
        </div>
        <Button className="gap-1.5" onClick={() => downloadContract(trainer.id, trainer.user.fullName)}>
          <Download size={14} /> Download Contract
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-1.5 text-slate-600">
              <Mail size={13} className="text-slate-400" /> {trainer.user.email}
            </p>
            <p className="flex items-center gap-1.5 text-slate-600">
              <Phone size={13} className="text-slate-400" /> {trainer.user.phone ?? '—'}
            </p>
            <p><span className="text-slate-500">Track:</span> {trainer.track === 'OTHER' ? trainer.trackOther : trainer.track?.replace(/_/g, ' ') ?? '—'}</p>
            <p><span className="text-slate-500">Status:</span> <Badge status={trainer.status} /></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment & Contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Center:</span> {trainer.center?.name ?? '—'}</p>
            {trainer.monthlySalaryKes != null && (
              <p><span className="text-slate-500">Monthly Salary:</span> KES {trainer.monthlySalaryKes.toLocaleString()}</p>
            )}
            {trainer.contractStartDate && (
              <p>
                <span className="text-slate-500">Contract:</span> {new Date(trainer.contractStartDate).toLocaleDateString()}
                {trainer.contractEndDate && ` – ${new Date(trainer.contractEndDate).toLocaleDateString()}`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Center Assignment History</CardTitle>
          </CardHeader>
          <CardContent>
            {!centerHistory || centerHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No center history yet.</p>
            ) : (
              <div className="space-y-2">
                {centerHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-900">{h.center.name}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(h.startDate).toLocaleDateString()} – {h.endDate ? new Date(h.endDate).toLocaleDateString() : 'present'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Programs</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedPrograms.length === 0 ? (
              <p className="text-sm text-slate-500">No programs assigned.</p>
            ) : (
              <div className="space-y-2">
                {assignedPrograms.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()} · {p.center?.name ?? 'Remote'}
                    </p>
                    <Badge status={p.status} className="mt-1" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
