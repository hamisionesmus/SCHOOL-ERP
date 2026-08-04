'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, School, Wallet, FileCheck, SlidersHorizontal, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';

const SCHOOLS_CREATED_PAGE_SIZE_OPTIONS = [10, 30, 50];

// Mirrors apps/api/src/platform/admins/platform-modules.ts — kept in sync manually (no shared
// package between the two apps yet, same precedent as KENYA_COUNTIES).
const PLATFORM_MODULES = ['TICKETS', 'SECURITY', 'BACKUPS', 'SETTINGS', 'MESSAGE_TEMPLATES', 'ADMINS', 'AUDIT_LOG'] as const;
const PLATFORM_MODULE_LABELS: Record<(typeof PLATFORM_MODULES)[number], string> = {
  TICKETS: 'Tickets',
  SECURITY: 'Security',
  BACKUPS: 'Backups',
  SETTINGS: 'Platform Settings',
  MESSAGE_TEMPLATES: 'Message Templates',
  ADMINS: 'Admin management (view only)',
  AUDIT_LOG: 'Audit Log access',
};

interface AdminDetail {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'SUPER_ADMIN' | 'SUB_ADMIN' | 'ASSISTANT_SUPER_ADMIN';
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
  useRequireSuperAdmin('ADMINS');
  const params = useParams<{ id: string }>();

  const { data: admin, isLoading } = useQuery({
    queryKey: ['platform-admin', params.id],
    queryFn: () => apiFetch<AdminDetail>(`/platform/admins/${params.id}`),
  });

  const isDelegatedAdmin = admin && admin.role !== 'SUPER_ADMIN';
  // Called unconditionally (before the loading early-return below) per Rules of Hooks.
  const schoolsCreated = useTableControls(admin?.schoolsCreated ?? [], { pageSize: 10 });

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
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolsCreated.pageItems.map((s) => (
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
              <Pagination
                page={schoolsCreated.page}
                pageCount={schoolsCreated.pageCount}
                totalItems={schoolsCreated.totalItems}
                pageSize={schoolsCreated.pageSize}
                pageSizeOptions={SCHOOLS_CREATED_PAGE_SIZE_OPTIONS}
                onPageChange={schoolsCreated.setPage}
                onPageSizeChange={schoolsCreated.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      {isDelegatedAdmin && <ModuleGrantsCard adminId={admin.id} />}
    </div>
  );
}

/** Lets a Super Admin grant this Sub-Admin/Assistant Super Admin individual access to otherwise
 * tier-restricted platform modules — see PlatformAdminModuleGrant/RequirePlatformModule on the
 * backend. Takes effect on the admin's next login/refresh, same as a role change would. */
function ModuleGrantsCard({ adminId }: { adminId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasSynced, setHasSynced] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-admin-module-grants', adminId],
    queryFn: () => apiFetch<{ modules: string[] }>(`/platform/admins/${adminId}/module-grants`),
  });

  useEffect(() => {
    if (data && !hasSynced) {
      setSelected(new Set(data.modules));
      setHasSynced(true);
    }
  }, [data, hasSynced]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/admins/${adminId}/module-grants`, {
        method: 'PUT',
        body: JSON.stringify({ modules: Array.from(selected) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin-module-grants', adminId] });
      notifySuccess('Module access updated — takes effect next time this admin signs in.');
    },
    onError: (err) => notifyError(err, 'Failed to update module access'),
  });

  function toggle(module: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module Access</CardTitle>
        <CardDescription>
          Grant this admin extra access to specific platform modules, on top of what their tier
          normally allows — doesn&apos;t change their overall role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLATFORM_MODULES.map((module) => (
                <label
                  key={module}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(module)}
                    onChange={() => toggle(module)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {PLATFORM_MODULE_LABELS[module]}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? 'Saving...' : 'Save module access'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
