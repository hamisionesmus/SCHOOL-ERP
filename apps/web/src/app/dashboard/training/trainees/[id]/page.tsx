'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, ShieldCheck, ShieldOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TraineeDetail {
  id: string;
  traineeNumber: string | null;
  fullName: string;
  gender: string;
  phone: string | null;
  address: string | null;
  age: number | null;
  educationLevel: string | null;
  portalEmail: string | null;
  portalEnabled: boolean;
  createdAt: string;
  program: { id: string; title: string; track: string | null; status: string; startDate: string; endDate: string };
  attendance: {
    totalSessions: number;
    present: number;
    absent: number;
    attendancePct: number | null;
    history: { date: string; present: boolean; topicsCovered: string | null; hadTrainingToday: boolean }[];
  };
}

function PortalAccessCard({ trainee }: { trainee: TraineeDetail }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(trainee.portalEmail ?? '');

  const grant = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/training/trainees/${trainee.id}/grant-portal-access`, {
        method: 'PATCH',
        body: JSON.stringify({ portalEmail: email }),
      }),
    onSuccess: () => {
      notifySuccess(trainee.portalEnabled ? 'Welcome message resent' : 'Portal access granted — credentials sent');
      queryClient.invalidateQueries({ queryKey: ['trainee-detail', trainee.id] });
    },
    onError: (err) => notifyError(err, 'Failed to grant portal access'),
  });

  const revoke = useMutation({
    mutationFn: () => apiFetch(`/platform/training/trainees/${trainee.id}/revoke-portal-access`, { method: 'PATCH' }),
    onSuccess: () => {
      notifySuccess('Portal access revoked');
      queryClient.invalidateQueries({ queryKey: ['trainee-detail', trainee.id] });
    },
    onError: (err) => notifyError(err, 'Failed to revoke portal access'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Portal Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="flex items-center gap-2">
          <span className="text-slate-500">Status:</span>
          <Badge status={trainee.portalEnabled ? 'ACTIVE' : 'INACTIVE'}>{trainee.portalEnabled ? 'Enabled' : 'Not set up'}</Badge>
        </p>
        {trainee.portalEnabled && trainee.portalEmail && (
          <p className="flex items-center gap-1.5 text-slate-600">
            <Mail size={13} className="text-slate-400" /> {trainee.portalEmail}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Trainee's email"
            className="flex-1"
          />
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!email.trim() || grant.isPending}
            onClick={() => grant.mutate()}
          >
            <ShieldCheck size={14} />
            {grant.isPending ? 'Sending...' : trainee.portalEnabled ? 'Resend Welcome' : 'Grant Access'}
          </Button>
          {trainee.portalEnabled && (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
              <ShieldOff size={14} /> Revoke
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Grant sends a temporary password to this email so the trainee can log in at the trainee portal and see their
          progress and learning materials. Resend re-sends a fresh password to the same email.
        </p>
      </CardContent>
    </Card>
  );
}

export default function TraineeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: trainee, isLoading } = useQuery({
    queryKey: ['trainee-detail', id],
    queryFn: () => apiFetch<TraineeDetail>(`/platform/training/trainees/${id}`),
  });

  if (isLoading || !trainee) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <>
      <Link href="/dashboard/training/trainees" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Back to Trainees
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{trainee.fullName}</h1>
          <p className="text-sm text-slate-500">
            {trainee.traineeNumber ?? '—'} · {trainee.program.title}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Gender:</span> {trainee.gender}</p>
            <p><span className="text-slate-500">Phone:</span> {trainee.phone ?? '—'}</p>
            <p><span className="text-slate-500">Address:</span> {trainee.address ?? '—'}</p>
            <p><span className="text-slate-500">Age:</span> {trainee.age ?? '—'}</p>
            <p><span className="text-slate-500">Education Level:</span> {trainee.educationLevel ?? '—'}</p>
            <p><span className="text-slate-500">Joined:</span> {new Date(trainee.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Title:</span> {trainee.program.title}</p>
            <p><span className="text-slate-500">Track:</span> {trainee.program.track?.replace(/_/g, ' ') ?? '—'}</p>
            <p><span className="text-slate-500">Status:</span> <Badge status={trainee.program.status} /></p>
            <p>
              <span className="text-slate-500">Dates:</span> {new Date(trainee.program.startDate).toLocaleDateString()} –{' '}
              {new Date(trainee.program.endDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <PortalAccessCard trainee={trainee} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Sessions:</span> {trainee.attendance.totalSessions}</p>
            <p><span className="text-slate-500">Present:</span> {trainee.attendance.present}</p>
            <p><span className="text-slate-500">Absent:</span> {trainee.attendance.absent}</p>
            <p>
              <span className="text-slate-500">Attendance rate:</span>{' '}
              {trainee.attendance.attendancePct != null ? `${trainee.attendance.attendancePct}%` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            {trainee.attendance.history.length === 0 ? (
              <p className="text-sm text-slate-500">No attendance recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Topics Covered</th>
                  </tr>
                </thead>
                <tbody>
                  {trainee.attendance.history.map((h, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 text-slate-500">{new Date(h.date).toLocaleDateString()}</td>
                      <td className="py-2">
                        <Badge status={h.present ? 'PRESENT' : 'ABSENT'} />
                      </td>
                      <td className="py-2 text-slate-500">{h.topicsCovered ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
