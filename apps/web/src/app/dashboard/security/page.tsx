'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Check, ShieldX, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  email: string | null;
  tenantSlug: string | null;
  ipAddress: string | null;
  attemptCount: number | null;
  details: string | null;
  acknowledged: boolean;
  createdAt: string;
}
interface AlertsPage {
  data: SecurityAlert[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    unacknowledgedCount: number;
    highSeverityUnacknowledgedCount: number;
  };
}

const SEVERITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-rose-100 text-rose-700',
};

export default function SecurityPage() {
  useRequireSuperAdmin();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['security-alerts', page],
    queryFn: () => apiFetch<AlertsPage>(`/platform/security-alerts?page=${page}&pageSize=${pageSize}`),
    refetchInterval: 30_000,
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/security-alerts/${id}/acknowledge`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      notifySuccess('Acknowledged');
    },
    onError: (err) => notifyError(err, 'Failed to acknowledge'),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Security</h1>
        <p className="mt-1 text-sm text-slate-500">
          Raised automatically when the same email/school sees 5+ failed login attempts within 15
          minutes — one alert per burst, not per attempt. Login itself is also rate-limited
          (8 attempts/minute per IP) independently of this.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Unacknowledged" value={data?.meta.unacknowledgedCount ?? 0} icon={ShieldAlert} accent="rose" />
          <StatCard
            label="High severity, unacknowledged"
            value={data?.meta.highSeverityUnacknowledgedCount ?? 0}
            icon={AlertTriangle}
            accent="amber"
          />
          <StatCard label="Total alerts" value={data?.meta.total ?? 0} icon={ShieldX} accent="slate" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : !data || data.data.length === 0 ? (
            <p className="text-sm text-slate-500">No security alerts. All quiet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {data.data.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      'flex items-start justify-between gap-3 rounded-lg border p-3',
                      a.acknowledged ? 'border-slate-100 bg-slate-50' : 'border-rose-100 bg-rose-50/40',
                    )}
                  >
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_STYLE[a.severity])}>
                          {a.severity}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString('en-KE')}</span>
                      </div>
                      <p className="text-sm text-slate-800">{a.details}</p>
                      {a.ipAddress && <p className="text-xs text-slate-400">IP: {a.ipAddress}</p>}
                    </div>
                    {!a.acknowledged && (
                      <Button size="sm" variant="outline" onClick={() => acknowledge.mutate(a.id)} disabled={acknowledge.isPending}>
                        <Check size={13} className="mr-1" /> Acknowledge
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination
                page={data.meta.page}
                pageCount={Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))}
                totalItems={data.meta.total}
                pageSize={data.meta.pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
