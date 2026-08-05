'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';

interface Recipient {
  id: string;
  type: 'SCHOOL' | 'PLATFORM_ADMIN' | 'EXTERNAL';
  name: string;
  email: string | null;
  phone: string | null;
  emailStatus: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  smsStatus: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  emailError: string | null;
  smsError: string | null;
}

interface CampaignDetail {
  id: string;
  subject: string;
  emailBody: string | null;
  smsBody: string | null;
  channel: 'EMAIL' | 'SMS' | 'BOTH';
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  createdBy: { fullName: string } | null;
  recipients: Recipient[];
}

const TYPE_LABEL: Record<string, string> = { SCHOOL: 'School', PLATFORM_ADMIN: 'Admin', EXTERNAL: 'External' };

export default function CampaignDetailPage() {
  useRequireFinanceAccess();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => apiFetch<CampaignDetail>(`/platform/campaigns/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'SENDING' || query.state.data?.status === 'SCHEDULED' ? 4000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => apiFetch(`/platform/campaigns/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      notifySuccess('Campaign cancelled');
      setConfirmCancel(false);
    },
    onError: (err) => {
      notifyError(err, 'Failed to cancel campaign');
      setConfirmCancel(false);
    },
  });

  if (isLoading || !data) {
    return <SkeletonCard />;
  }

  const emailCount = data.recipients.filter((r) => r.email).length;
  const smsCount = data.recipients.filter((r) => r.phone).length;
  const emailSent = data.recipients.filter((r) => r.emailStatus === 'SENT').length;
  const smsSent = data.recipients.filter((r) => r.smsStatus === 'SENT').length;

  return (
    <>
      <header className="mb-6">
        <button onClick={() => router.push('/dashboard/campaigns')} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft size={13} /> Back to campaigns
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{data.subject}</h1>
            <p className="text-sm text-slate-500">
              {data.createdBy?.fullName ? `Created by ${data.createdBy.fullName} · ` : ''}
              {new Date(data.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={data.status} />
            {(data.status === 'DRAFT' || data.status === 'SCHEDULED') && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Recipients</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{data.recipients.length}</p>
          </CardContent>
        </Card>
        {data.channel !== 'SMS' && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500">Emails sent</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {emailSent} / {emailCount}
              </p>
            </CardContent>
          </Card>
        )}
        {data.channel !== 'EMAIL' && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500">SMS sent</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {smsSent} / {smsCount}
              </p>
            </CardContent>
          </Card>
        )}
        {data.scheduledAt && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500">Scheduled for</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(data.scheduledAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {(data.emailBody || data.smsBody) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.emailBody && (
              <div>
                <p className="text-xs font-medium text-slate-500">Email</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{data.emailBody}</p>
              </div>
            )}
            {data.smsBody && (
              <div>
                <p className="text-xs font-medium text-slate-500">SMS</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{data.smsBody}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">SMS</th>
              </tr>
            </thead>
            <tbody>
              {data.recipients.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="py-2 text-slate-500">{TYPE_LABEL[r.type]}</td>
                  <td className="py-2">
                    {r.email ? (
                      <div>
                        <Badge status={r.emailStatus} />
                        {r.emailError && <p className="mt-0.5 text-[11px] text-rose-500">{r.emailError}</p>}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    {r.phone ? (
                      <div>
                        <Badge status={r.smsStatus} />
                        {r.smsError && <p className="mt-0.5 text-[11px] text-rose-500">{r.smsError}</p>}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this campaign?"
        description="It will not be sent. This cannot be undone."
        tone="danger"
        confirmLabel="Cancel campaign"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
