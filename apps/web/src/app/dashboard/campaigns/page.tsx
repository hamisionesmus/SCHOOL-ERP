'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';

interface Campaign {
  id: string;
  subject: string;
  channel: 'EMAIL' | 'SMS' | 'BOTH';
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  createdBy: { fullName: string } | null;
  _count: { recipients: number };
}

const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', SMS: 'SMS', BOTH: 'Email + SMS' };

export default function CampaignsPage() {
  useRequireFinanceAccess();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page],
    queryFn: () => apiFetch<{ data: Campaign[]; meta: { total: number } }>(`/platform/campaigns?page=${page}&pageSize=${pageSize}`),
  });

  const campaigns = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500">Send holiday greetings, maintenance notices, and targeted follow-ups by email or SMS.</p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button className="gap-1.5">
            <Plus size={15} /> New Campaign
          </Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Megaphone size={28} className="text-slate-300" />
              <p className="text-sm text-slate-500">No campaigns sent yet. Create your first one.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Subject</th>
                    <th className="py-2 font-medium">Channel</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Recipients</th>
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Created by</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{c.subject}</td>
                      <td className="py-2 text-slate-500">{CHANNEL_LABEL[c.channel]}</td>
                      <td className="py-2">
                        <Badge status={c.status} />
                      </td>
                      <td className="py-2 text-slate-500">{c._count.recipients}</td>
                      <td className="py-2 text-slate-500">
                        {c.sentAt
                          ? `Sent ${new Date(c.sentAt).toLocaleString()}`
                          : c.scheduledAt
                            ? `Scheduled ${new Date(c.scheduledAt).toLocaleString()}`
                            : new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-slate-500">{c.createdBy?.fullName ?? '—'}</td>
                      <td className="py-2 text-right">
                        <Link href={`/dashboard/campaigns/${c.id}`}>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPageChange={setPage} totalItems={total} pageSize={pageSize} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
