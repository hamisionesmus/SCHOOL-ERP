'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, School, Wallet, FileCheck, SlidersHorizontal, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminDetail {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'SUPER_ADMIN' | 'SUB_ADMIN';
  twoFactorEnabled: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schoolsCreated: { id: string; name: string; slug: string; status: string; createdAt: string }[];
  activityCounts: {
    paymentsRecorded: number;
    proofsReviewed: number;
    settingsChangeRequests: number;
  };
  lastLoginApprox: string | null;
}

export default function AdminDetailPage() {
  useRequireSuperAdmin();
  const params = useParams<{ id: string }>();

  const { data: admin, isLoading } = useQuery({
    queryKey: ['platform-admin', params.id],
    queryFn: () => apiFetch<AdminDetail>(`/platform/admins/${params.id}`),
  });

  if (isLoading || !admin) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-float-up">
        <Link href="/dashboard/admins" className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} />
          Back to admins
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{admin.fullName}</h1>
            <p className="text-sm text-slate-500">
              {admin.email} · joined {new Date(admin.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge status={admin.role} />
            <Badge status={admin.deletedAt ? 'SUSPENDED' : 'ACTIVE'} />
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Schools created" value={admin.schoolsCreated.length} icon={School} accent="blue" />
        <StatCard label="Payments recorded" value={admin.activityCounts.paymentsRecorded} icon={Wallet} accent="emerald" />
        <StatCard label="Proofs reviewed" value={admin.activityCounts.proofsReviewed} icon={FileCheck} accent="amber" />
        <StatCard
          label="Settings changes requested"
          value={admin.activityCounts.settingsChangeRequests}
          icon={SlidersHorizontal}
          accent="violet"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Phone</p>
            <p className="text-slate-700">{admin.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Two-factor authentication</p>
            <p className="text-slate-700">{admin.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-slate-400">
              <Clock size={12} /> Last login (approximate)
            </p>
            <p className="text-slate-700">
              {admin.lastLoginApprox ? new Date(admin.lastLoginApprox).toLocaleString() : 'Never signed in'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schools created</CardTitle>
        </CardHeader>
        <CardContent>
          {admin.schoolsCreated.length === 0 ? (
            <p className="text-sm text-slate-500">This admin hasn&apos;t created any schools yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {admin.schoolsCreated.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      <Link href={`/dashboard/schools/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2">
                      <Badge status={s.status} />
                    </td>
                    <td className="py-2 text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
