'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { School, CheckCircle2, PauseCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CreateSchoolDialog } from './create-school-dialog';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  address: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = { ACTIVE: '#10b981', TRIAL: '#f59e0b', SUSPENDED: '#f43f5e' };

export default function DashboardPage() {
  const { user, logout } = useSession('platform');
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; action: 'suspend' | 'activate' } | null>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<{ data: Tenant[] }>('/platform/tenants'),
    enabled: !!user,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      apiFetch(`/platform/tenants/${id}/${action}`, { method: 'PATCH' }),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      notifySuccess(action === 'suspend' ? 'School suspended' : 'School activated');
      setConfirmTarget(null);
    },
    onError: (err) => {
      notifyError(err, 'Failed to update school status');
      setConfirmTarget(null);
    },
  });

  if (!user) return null;

  const tenants = data?.data ?? [];
  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trialCount = tenants.filter((t) => t.status === 'TRIAL').length;
  const suspendedCount = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const statusBreakdown = [
    { status: 'ACTIVE', count: activeCount },
    { status: 'TRIAL', count: trialCount },
    { status: 'SUSPENDED', count: suspendedCount },
  ].filter((s) => s.count > 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between animate-float-up">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Super Admin</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </header>

      {isLoading ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Schools" value={tenants.length} icon={School} accent="blue" />
          <StatCard label="Active" value={activeCount} icon={CheckCircle2} accent="emerald" />
          <StatCard label="On Trial" value={trialCount} icon={Clock} accent="amber" />
          <StatCard label="Suspended" value={suspendedCount} icon={PauseCircle} accent="rose" />
        </div>
      )}

      {!isLoading && statusBreakdown.length > 1 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Schools by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {statusBreakdown.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Schools</CardTitle>
          <CreateSchoolDialog />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={5} />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-500">No schools yet. Create the first one.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Slug</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{t.name}</td>
                    <td className="py-2 text-slate-500">{t.slug}</td>
                    <td className="py-2">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-2 text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">
                      {t.status === 'SUSPENDED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmTarget({ id: t.id, name: t.name, action: 'activate' })}
                        >
                          Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmTarget({ id: t.id, name: t.name, action: 'suspend' })}
                        >
                          Suspend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.action === 'suspend' ? `Suspend ${confirmTarget?.name}?` : `Activate ${confirmTarget?.name}?`}
        description={
          confirmTarget?.action === 'suspend'
            ? 'Staff and parents at this school will immediately lose access until reactivated.'
            : 'This school will regain full access to the platform.'
        }
        tone={confirmTarget?.action === 'suspend' ? 'danger' : 'success'}
        confirmLabel={confirmTarget?.action === 'suspend' ? 'Suspend school' : 'Activate school'}
        loading={toggleStatus.isPending}
        onConfirm={() => confirmTarget && toggleStatus.mutate({ id: confirmTarget.id, action: confirmTarget.action })}
        onCancel={() => setConfirmTarget(null)}
      />
    </main>
  );
}
