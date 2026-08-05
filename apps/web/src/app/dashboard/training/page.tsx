'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, GraduationCap, ClipboardList, FileText, Download } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { getSessionUser, getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { notifyError } from '@/lib/notify';

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

interface Program {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  center: { name: string } | null;
}

const SECTIONS = [
  { href: '/dashboard/training/centers', label: 'Centers', description: 'Where training happens — location, head, student count.', icon: Building2 },
  { href: '/dashboard/training/trainers', label: 'Trainers', description: 'Assignments, salary, contracts.', icon: GraduationCap },
  { href: '/dashboard/training/programs', label: 'Programs', description: 'Cohorts with real start/end dates.', icon: ClipboardList },
  { href: '/dashboard/training/registers', label: 'Daily Registers', description: 'Attendance + coverage, downloadable.', icon: FileText },
  { href: '/dashboard/training/reports', label: 'Progress Reports', description: 'Challenges + progress, are trainers working?', icon: FileText },
];

async function downloadContract(profileId: string, name: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_ORIGIN}/platform/training/trainers/${profileId}/contract`, {
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

function TrainerView() {
  const { data: profile } = useQuery({ queryKey: ['trainer-me'], queryFn: () => apiFetch<TrainerProfile>('/platform/training/trainers/me') });
  const { data: programs } = useQuery({ queryKey: ['trainer-programs-mine'], queryFn: () => apiFetch<Program[]>('/platform/training/programs/mine') });

  if (!profile) return null;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My Training</h1>
        <p className="text-sm text-slate-500">Your assignment, contract, and cohorts.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Track:</span> {profile.track?.replace(/_/g, ' ') ?? '—'}</p>
            <p><span className="text-slate-500">Center:</span> {profile.center?.name ?? '—'}</p>
            <p><span className="text-slate-500">Status:</span> <Badge status={profile.status} /></p>
            {profile.monthlySalaryKes != null && <p><span className="text-slate-500">Monthly Salary:</span> KES {profile.monthlySalaryKes.toLocaleString()}</p>}
            {profile.contractStartDate && (
              <p>
                <span className="text-slate-500">Contract:</span> {new Date(profile.contractStartDate).toLocaleDateString()}
                {profile.contractEndDate && ` – ${new Date(profile.contractEndDate).toLocaleDateString()}`}
              </p>
            )}
            <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => downloadContract(profile.id, profile.user.fullName)}>
              <Download size={13} /> Download Contract
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Programs</CardTitle>
          </CardHeader>
          <CardContent>
            {!programs || programs.length === 0 ? (
              <p className="text-sm text-slate-500">No programs assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {programs.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-200 p-3">
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/dashboard/training/registers">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <FileText size={18} className="mb-1 text-slate-500" />
              <CardTitle className="text-base">Submit Daily Register</CardTitle>
              <CardDescription>Attendance and topics covered today.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/training/reports">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <ClipboardList size={18} className="mb-1 text-slate-500" />
              <CardTitle className="text-base">Submit Progress Report</CardTitle>
              <CardDescription>Progress and challenges for this period.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </>
  );
}

export default function TrainingLandingPage() {
  const role = getSessionUser()?.role;
  if (role === 'TRAINER') return <TrainerView />;

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Training</h1>
        <p className="text-sm text-slate-500">Centers, trainers, cohorts, registers, and progress — all in one place.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <s.icon size={20} className="mb-1 text-slate-500" />
                <CardTitle className="text-base">{s.label}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
