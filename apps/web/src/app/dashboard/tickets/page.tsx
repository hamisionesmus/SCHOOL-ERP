'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { LifeBuoy, Clock, UserCheck, CheckCircle2, ListTodo } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SortableTh } from '@/components/ui/sortable-th';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { useBlockAssistantSuperAdmin } from '@/lib/require-super-admin';

interface TicketsAnalytics {
  total: number;
  PENDING: number;
  ASSIGNED: number;
  RESOLVED: number;
}

const PRIORITY_TONE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-rose-100 text-rose-700',
};

interface Escalation {
  id: string;
  subject: string;
  category: string;
  priority: string;
  submitterName: string;
  status: 'PENDING' | 'ASSIGNED' | 'RESOLVED';
  tenant: { id: string; name: string; slug: string };
  assignedTo: { id: string; fullName: string } | null;
  createdAt: string;
}

export default function PlatformTicketsPage() {
  useBlockAssistantSuperAdmin();
  const { data: escalations, isLoading } = useQuery({
    queryKey: ['platform-tickets'],
    queryFn: () => apiFetch<Escalation[]>('/platform/tickets'),
    refetchInterval: 30_000,
  });

  const { data: analytics } = useQuery({
    queryKey: ['platform-tickets-analytics'],
    queryFn: () => apiFetch<TicketsAnalytics>('/platform/analytics/tickets'),
  });

  const table = useTableControls(escalations ?? [], { pageSize: 12, initialSortKey: 'createdAt' });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <LifeBuoy size={22} className="text-slate-400" />
          Escalated tickets
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tickets a School Administrator couldn&apos;t resolve and escalated for platform attention.
        </p>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total escalated" value={analytics.total} icon={ListTodo} accent="slate" />
          <StatCard label="Pending" value={analytics.PENDING} icon={Clock} accent="amber" />
          <StatCard label="Assigned" value={analytics.ASSIGNED} icon={UserCheck} accent="blue" />
          <StatCard label="Resolved" value={analytics.RESOLVED} icon={CheckCircle2} accent="emerald" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All escalations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : !escalations || escalations.length === 0 ? (
            <p className="text-sm text-slate-500">No escalated tickets. All clear.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <SortableTh label="Subject" active={table.sortKey === 'subject'} dir={table.sortDir} onClick={() => table.toggleSort('subject')} />
                    <th className="py-2 font-medium">School</th>
                    <th className="py-2 font-medium">Priority</th>
                    <SortableTh label="Status" active={table.sortKey === 'status'} dir={table.sortDir} onClick={() => table.toggleSort('status')} />
                    <th className="py-2 font-medium">Assigned to</th>
                    <SortableTh
                      label="Created"
                      active={table.sortKey === 'createdAt'}
                      dir={table.sortDir}
                      onClick={() => table.toggleSort('createdAt')}
                    />
                  </tr>
                </thead>
                <tbody>
                  {table.pageItems.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">
                        <Link href={`/dashboard/tickets/${e.id}`} className="hover:underline">
                          {e.subject}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-500">{e.tenant.name}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_TONE[e.priority]}`}>
                          {e.priority}
                        </span>
                      </td>
                      <td className="py-2">
                        <Badge status={e.status} />
                      </td>
                      <td className="py-2 text-slate-500">{e.assignedTo?.fullName ?? '—'}</td>
                      <td className="py-2 text-slate-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={table.page}
                pageCount={table.pageCount}
                totalItems={table.totalItems}
                pageSize={table.pageSize}
                onPageChange={table.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
