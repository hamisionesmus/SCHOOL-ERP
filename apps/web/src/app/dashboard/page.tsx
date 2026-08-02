'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { School, CheckCircle2, PauseCircle, Clock, Wallet, AlertTriangle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { daysUntil, formatCountdown, countdownTone } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { SortableTh } from '@/components/ui/sortable-th';
import { useTableControls } from '@/hooks/use-table-controls';
import { CreateSchoolDialog } from './create-school-dialog';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'TRIAL' | 'PENDING_PAYMENT' | 'ACTIVE' | 'SUSPENDED';
  address: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}
interface TenantUsage {
  totalMb: number;
  limitMb: number | null;
  usagePct: number | null;
}

function UsageCell({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-usage', tenantId],
    queryFn: () => apiFetch<TenantUsage>(`/platform/tenants/${tenantId}/usage`),
    staleTime: 60 * 1000,
  });

  if (isLoading || !data) return <span className="text-slate-300">…</span>;

  const overLimit = data.usagePct !== null && data.usagePct >= 90;
  return (
    <span className={overLimit ? 'font-medium text-rose-600' : 'text-slate-600'}>
      {data.totalMb} MB
      {data.limitMb && ` / ${data.limitMb} MB (${data.usagePct}%)`}
    </span>
  );
}

function RenewalCell({ currentPeriodEnd }: { currentPeriodEnd: string | null }) {
  if (!currentPeriodEnd) return <span className="text-slate-300">Not set</span>;
  const days = daysUntil(currentPeriodEnd);
  const tone = countdownTone(days);
  const toneClass =
    tone === 'past' ? 'text-rose-600 font-medium' : tone === 'soon' ? 'text-amber-600 font-medium' : 'text-slate-600';
  return <span className={toneClass}>{formatCountdown(days)}</span>;
}

interface RevenueOverview {
  totalRevenue: number;
  outstanding: number;
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  trialSchools: number;
  demoSchools: number;
  revenueByBillingCycle: Record<'MONTHLY' | 'HALF_YEARLY' | 'YEARLY', number>;
  monthlyRevenue: { month: string; amount: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  TRIAL: '#f59e0b',
  PENDING_PAYMENT: '#3b82f6',
  SUSPENDED: '#f43f5e',
};
const CYCLE_COLORS: Record<string, string> = { MONTHLY: '#3b82f6', HALF_YEARLY: '#8b5cf6', YEARLY: '#0ea5e9' };
const CYCLE_LABELS: Record<string, string> = { MONTHLY: 'Monthly', HALF_YEARLY: 'Half-yearly', YEARLY: 'Yearly' };

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; action: 'suspend' | 'activate' } | null>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<{ data: Tenant[] }>('/platform/tenants'),
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: () => apiFetch<RevenueOverview>('/platform/analytics/revenue'),
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

  const tenants = data?.data ?? [];
  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trialCount = tenants.filter((t) => t.status === 'TRIAL').length;
  const pendingPaymentCount = tenants.filter((t) => t.status === 'PENDING_PAYMENT').length;
  const suspendedCount = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const statusBreakdown = [
    { status: 'ACTIVE', count: activeCount },
    { status: 'TRIAL', count: trialCount },
    { status: 'PENDING_PAYMENT', count: pendingPaymentCount },
    { status: 'SUSPENDED', count: suspendedCount },
  ].filter((s) => s.count > 0);

  const table = useTableControls(tenants, { pageSize: 8, initialSortKey: 'createdAt' });

  return (
    <>
      <header className="mb-8 animate-float-up">
        <h1 className="text-2xl font-semibold text-slate-900">Schools</h1>
        <p className="text-sm text-slate-500">Every school on the platform, at a glance.</p>
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

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Revenue &amp; Subscriptions</h2>

        {revenueLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : revenue ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total revenue collected" value={revenue.totalRevenue} formatValue={formatKes} icon={Wallet} accent="emerald" />
              <StatCard label="Outstanding balance" value={revenue.outstanding} formatValue={formatKes} icon={AlertTriangle} accent="amber" />
              <StatCard label="Active subscriptions" value={revenue.activeSchools} icon={CheckCircle2} accent="blue" />
              <StatCard label="Demo schools" value={revenue.demoSchools} icon={Sparkles} accent="rose" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly revenue (last 12 months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revenue.monthlyRevenue.map((m) => ({ ...m, label: formatMonthLabel(m.month) }))}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v) => formatKes(Number(v))} />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue by billing cycle</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.values(revenue.revenueByBillingCycle).every((v) => v === 0) ? (
                    <p className="flex h-[220px] items-center justify-center text-sm text-slate-400">No paid invoices yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={Object.entries(revenue.revenueByBillingCycle).map(([cycle, amount]) => ({ cycle, amount }))}
                          dataKey="amount"
                          nameKey="cycle"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {Object.keys(revenue.revenueByBillingCycle).map((cycle) => (
                            <Cell key={cycle} fill={CYCLE_COLORS[cycle]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v, _n, p) => [
                            formatKes(Number(v)),
                            CYCLE_LABELS[p.payload.cycle] ?? p.payload.cycle,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Schools</CardTitle>
          <CreateSchoolDialog />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={6} />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-500">No schools yet. Create the first one.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <SortableTh label="Name" active={table.sortKey === 'name'} dir={table.sortDir} onClick={() => table.toggleSort('name')} />
                    <SortableTh label="Slug" active={table.sortKey === 'slug'} dir={table.sortDir} onClick={() => table.toggleSort('slug')} />
                    <SortableTh label="Status" active={table.sortKey === 'status'} dir={table.sortDir} onClick={() => table.toggleSort('status')} />
                    <th className="py-2 font-medium">Storage</th>
                    <SortableTh
                      label="Renewal"
                      active={table.sortKey === 'currentPeriodEnd'}
                      dir={table.sortDir}
                      onClick={() => table.toggleSort('currentPeriodEnd')}
                    />
                    <SortableTh
                      label="Created"
                      active={table.sortKey === 'createdAt'}
                      dir={table.sortDir}
                      onClick={() => table.toggleSort('createdAt')}
                    />
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {table.pageItems.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">
                        <Link href={`/dashboard/schools/${t.id}`} className="hover:underline">
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-500">{t.slug}</td>
                      <td className="py-2">
                        <Badge status={t.status} />
                      </td>
                      <td className="py-2">
                        <UsageCell tenantId={t.id} />
                      </td>
                      <td className="py-2">
                        <RenewalCell currentPeriodEnd={t.currentPeriodEnd} />
                      </td>
                      <td className="py-2 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/schools/${t.id}`}>
                            <Button size="sm" variant="outline">
                              Manage
                            </Button>
                          </Link>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={table.page}
                pageCount={table.pageCount}
                onPageChange={table.setPage}
                totalItems={table.totalItems}
                pageSize={table.pageSize}
              />
            </>
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
    </>
  );
}
