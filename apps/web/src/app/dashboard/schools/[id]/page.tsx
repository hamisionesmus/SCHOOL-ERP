'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Copy, Check } from 'lucide-react';
import { apiFetch, API_ORIGIN, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { daysUntil, formatCountdown, countdownTone } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { Wallet, Database, ShieldAlert, Users } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  address: string | null;
  website: string | null;
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string | null;
  mpesaPaybill: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  createdAt: string;
}
interface TenantUsage {
  totalMb: number;
  limitMb: number | null;
  usagePct: number | null;
}
interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  receiptNumber: string;
  createdAt: string;
}
interface Invoice {
  id: string;
  invoiceNumber: string;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  payments: Payment[];
}
interface AuditLogAccessRequest {
  id: string;
  requestedBy: { fullName: string; email: string };
  confirmedAt: string | null;
  availableAt: string | null;
  downloadedAt: string | null;
  sharedWithSchoolAt: string | null;
  createdAt: string;
}

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

const TABS = ['Overview', 'Billing', 'Audit Log'] as const;
type Tab = (typeof TABS)[number];

export default function SchoolDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => apiFetch<Tenant>(`/platform/tenants/${id}`),
  });

  if (isLoading || !tenant) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-float-up">
        <Link href="/dashboard" className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} />
          Back to schools
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{tenant.name}</h1>
            <p className="text-sm text-slate-500">{tenant.slug} · created {new Date(tenant.createdAt).toLocaleDateString()}</p>
          </div>
          <Badge status={tenant.status} />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab tenant={tenant} />}
      {tab === 'Billing' && <BillingTab tenantId={id} />}
      {tab === 'Audit Log' && <AuditLogTab tenantId={id} />}
    </div>
  );
}

function OverviewTab({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<'suspend' | 'activate' | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: usage } = useQuery({
    queryKey: ['tenant-usage', tenant.id],
    queryFn: () => apiFetch<TenantUsage>(`/platform/tenants/${tenant.id}/usage`),
  });

  const resetPassword = useMutation({
    mutationFn: () => apiFetch<{ email: string; fullName: string; temporaryPassword: string }>(`/platform/tenants/${tenant.id}/reset-admin-password`, { method: 'POST' }),
    onSuccess: (data) => {
      setResetResult({ email: data.email, temporaryPassword: data.temporaryPassword });
      setConfirmReset(false);
      notifySuccess('Temporary password generated');
    },
    onError: (err) => {
      notifyError(err, 'Failed to reset password');
      setConfirmReset(false);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (action: 'suspend' | 'activate') => apiFetch(`/platform/tenants/${tenant.id}/${action}`, { method: 'PATCH' }),
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      notifySuccess(action === 'suspend' ? 'School suspended' : 'School activated');
      setConfirmStatus(null);
    },
    onError: (err) => {
      notifyError(err, 'Failed to update status');
      setConfirmStatus(null);
    },
  });

  const days = tenant.currentPeriodEnd ? daysUntil(tenant.currentPeriodEnd) : null;
  const tone = days !== null ? countdownTone(days) : 'upcoming';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Storage Used"
          value={usage?.totalMb ?? 0}
          icon={Database}
          accent="blue"
          suffix=" MB"
          hint={usage?.limitMb ? `of ${usage.limitMb} MB limit` : 'No limit set'}
        />
        <StatCard
          label="Billing Cycle"
          value={0}
          icon={Wallet}
          accent="violet"
          formatValue={() => tenant.billingCycle}
        />
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-float-up">
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80',
              tone === 'past' ? 'from-rose-500 to-red-600' : tone === 'soon' ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-teal-600',
            )}
          />
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Subscription Renewal</p>
          <p
            className={cn(
              'mt-1.5 text-2xl font-semibold',
              tone === 'past' ? 'text-rose-600' : tone === 'soon' ? 'text-amber-600' : 'text-slate-900',
            )}
          >
            {days !== null ? formatCountdown(days) : 'Not set'}
          </p>
          {tenant.currentPeriodEnd && (
            <p className="mt-1 text-xs text-slate-400">{new Date(tenant.currentPeriodEnd).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Visible to this school&apos;s administrator on their own Settings page as read-only reference.
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">M-Pesa Paybill</dt>
              <dd className="font-medium text-slate-900">{tenant.mpesaPaybill ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Bank</dt>
              <dd className="font-medium text-slate-900">{tenant.bankName ?? 'Not set'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-700">
            <ShieldAlert size={16} />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Reset School Administrator password</p>
              <p className="text-xs text-slate-500">
                Generates a fresh temporary password shown once — real passwords are one-way hashed
                and cannot be retrieved or displayed.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)}>
              <KeyRound size={14} className="mr-1.5" />
              Reset password
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {tenant.status === 'SUSPENDED' ? 'Activate this school' : 'Suspend this school'}
              </p>
              <p className="text-xs text-slate-500">
                {tenant.status === 'SUSPENDED'
                  ? 'Restores access for all staff and parents.'
                  : 'Immediately blocks all staff and parent logins until reactivated.'}
              </p>
            </div>
            <Button
              size="sm"
              variant={tenant.status === 'SUSPENDED' ? 'outline' : 'destructive'}
              onClick={() => setConfirmStatus(tenant.status === 'SUSPENDED' ? 'activate' : 'suspend')}
            >
              {tenant.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Reset admin password?"
        description={`A new temporary password will be generated for ${tenant.name}'s School Administrator. Their current password stops working immediately.`}
        tone="danger"
        confirmLabel="Reset password"
        loading={resetPassword.isPending}
        onConfirm={() => resetPassword.mutate()}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        open={!!confirmStatus}
        title={confirmStatus === 'suspend' ? `Suspend ${tenant.name}?` : `Activate ${tenant.name}?`}
        description={
          confirmStatus === 'suspend'
            ? 'Staff and parents will immediately lose access until reactivated.'
            : 'This school will regain full access to the platform.'
        }
        tone={confirmStatus === 'suspend' ? 'danger' : 'success'}
        confirmLabel={confirmStatus === 'suspend' ? 'Suspend school' : 'Activate school'}
        loading={toggleStatus.isPending}
        onConfirm={() => confirmStatus && toggleStatus.mutate(confirmStatus)}
        onCancel={() => setConfirmStatus(null)}
      />

      {resetResult && (
        <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <KeyRound size={28} className="text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Temporary password generated</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              Shown once — relay it securely to <strong>{resetResult.email}</strong>. It will not be
              shown again.
            </p>
            <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-4 py-3">
              <p className="select-all font-mono text-lg font-semibold tracking-wide text-slate-900">
                {resetResult.temporaryPassword}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resetResult.temporaryPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                aria-label="Copy password"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Copy this exactly — retyping it by hand risks mistaking look-alike characters.
            </p>
            <Button className="mt-3 w-full" onClick={() => setResetResult(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BillingTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['tenant-invoices', tenantId],
    queryFn: () => apiFetch<Invoice[]>(`/platform/tenants/${tenantId}/invoices`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant-invoices', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
  };

  const createInvoice = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch(`/platform/tenants/${tenantId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          billingCycle: fd.get('billingCycle'),
          amount: Number(fd.get('amount')),
        }),
      }),
    onSuccess: () => {
      invalidate();
      setShowInvoiceForm(false);
      setError(null);
      notifySuccess('Invoice issued and emailed to the school administrator');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to issue invoice');
      notifyError(err, 'Failed to issue invoice');
    },
  });

  const recordPayment = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch(`/platform/invoices/${payTarget?.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(fd.get('amount')),
          method: fd.get('method'),
          reference: fd.get('reference') || undefined,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setPayTarget(null);
      notifySuccess('Payment recorded');
    },
    onError: (err) => notifyError(err, 'Failed to record payment'),
  });

  async function downloadPdf(invoiceId: string) {
    setDownloadingId(invoiceId);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_ORIGIN}/platform/invoices/${invoiceId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to generate invoice PDF');
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameMatch?.[1] ?? 'invoice.pdf';
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess('Invoice downloaded');
    } catch (err) {
      notifyError(err, 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Billing</CardTitle>
        <Button size="sm" onClick={() => setShowInvoiceForm((v) => !v)}>
          {showInvoiceForm ? 'Cancel' : '+ Issue invoice'}
        </Button>
      </CardHeader>
      <CardContent>
        {showInvoiceForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createInvoice.mutate(new FormData(e.currentTarget));
            }}
            className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
          >
            <select name="billingCycle" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
            <Input name="amount" type="number" min={1} placeholder="Amount (KES)" required />
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? 'Issuing...' : 'Issue invoice'}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !invoices || invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices issued yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">Invoice</th>
                <th className="py-2 font-medium">Period</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{inv.invoiceNumber}</td>
                  <td className="py-2 text-slate-500">
                    {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-slate-700">{kes(inv.amount)}</td>
                  <td className="py-2">
                    <Badge status={inv.status} />
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                        <Button size="sm" variant="outline" onClick={() => setPayTarget(inv)}>
                          Record payment
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadingId === inv.id}
                        onClick={() => downloadPdf(inv.id)}
                      >
                        {downloadingId === inv.id ? '...' : 'PDF'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      {payTarget && (
        <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-900">Record payment</h3>
            <p className="mb-4 text-sm text-slate-500">
              {payTarget.invoiceNumber} — {kes(payTarget.amount)} due
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordPayment.mutate(new FormData(e.currentTarget));
              }}
              className="flex flex-col gap-3"
            >
              <Input name="amount" type="number" min={1} defaultValue={payTarget.amount} placeholder="Amount (KES)" required />
              <select name="method" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="MPESA">M-Pesa</option>
                <option value="BANK">Bank transfer</option>
                <option value="CASH">Cash</option>
              </select>
              <Input name="reference" placeholder="Reference (transaction code, slip no.)" />
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={recordPayment.isPending}>
                  {recordPayment.isPending ? 'Recording...' : 'Record payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

function AuditLogTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['audit-log-access-requests', tenantId],
    queryFn: () => apiFetch<AuditLogAccessRequest[]>(`/platform/tenants/${tenantId}/audit-log-access/requests`),
    refetchInterval: 30_000,
  });

  const latest = requests?.[0];
  const ready = latest?.availableAt && new Date(latest.availableAt) <= new Date();
  const waiting = latest?.confirmedAt && !ready;
  const awaitingCode = latest && !latest.confirmedAt;

  const requestAccess = useMutation({
    mutationFn: () =>
      apiFetch<{ requestId: string; devCode: string }>(`/platform/tenants/${tenantId}/audit-log-access/request`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setDevCode(data.devCode);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['audit-log-access-requests', tenantId] });
      notifySuccess('Confirmation code sent to your email');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to request access');
      notifyError(err, 'Failed to request access');
    },
  });

  const confirmAccess = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/audit-log-access/${latest!.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      setError(null);
      setCode('');
      setDevCode(null);
      queryClient.invalidateQueries({ queryKey: ['audit-log-access-requests', tenantId] });
      notifySuccess('Confirmed — the log will be ready to download in 2 hours');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm');
      notifyError(err, 'Failed to confirm');
    },
  });

  const shareWithSchool = useMutation({
    mutationFn: () => apiFetch<{ sharedWith: string }>(`/platform/audit-log-access/${latest!.id}/share`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-log-access-requests', tenantId] });
      notifySuccess(`Emailed to ${data.sharedWith}`);
    },
    onError: (err) => notifyError(err, 'Failed to share'),
  });

  async function downloadCsv() {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_ORIGIN}/platform/audit-log-access/${latest!.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-log.csv';
      a.click();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ['audit-log-access-requests', tenantId] });
    } catch (err) {
      notifyError(err, 'Failed to download');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users size={16} />
          Activity Log Access
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-slate-500">
          This school&apos;s activity log isn&apos;t viewable on the spot — request access, confirm the
          code emailed to your own account, then wait 2 hours before the log file can be downloaded.
          It&apos;s always scoped to this one school; nothing is ever bundled across schools.
        </p>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !latest ? (
          <Button onClick={() => requestAccess.mutate()} disabled={requestAccess.isPending}>
            {requestAccess.isPending ? 'Sending code...' : 'Request access to activity log'}
          </Button>
        ) : awaitingCode ? (
          <div className="flex flex-col gap-3">
            {devCode && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Dev/test convenience — no real email gateway in this environment: code is{' '}
                <strong>{devCode}</strong>.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="6-digit code" className="w-40" />
              <Button onClick={() => confirmAccess.mutate()} disabled={code.length !== 6 || confirmAccess.isPending}>
                {confirmAccess.isPending ? 'Confirming...' : 'Confirm'}
              </Button>
            </div>
          </div>
        ) : waiting ? (
          <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Confirmed. Ready to download at{' '}
            <strong>{new Date(latest.availableAt!).toLocaleString('en-KE')}</strong> — this page
            refreshes automatically.
          </div>
        ) : ready ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Ready since {new Date(latest.availableAt!).toLocaleString('en-KE')}.
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadCsv}>Download CSV</Button>
              <Button variant="outline" onClick={() => shareWithSchool.mutate()} disabled={shareWithSchool.isPending}>
                {shareWithSchool.isPending ? 'Sending...' : "Email to school's admin"}
              </Button>
              <Button variant="outline" onClick={() => requestAccess.mutate()} disabled={requestAccess.isPending}>
                Start a new request
              </Button>
            </div>
            {latest.sharedWithSchoolAt && (
              <p className="text-xs text-slate-400">
                Shared with the school admin on {new Date(latest.sharedWithSchoolAt).toLocaleString('en-KE')}.
              </p>
            )}
          </div>
        ) : null}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {requests && requests.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-medium uppercase text-slate-400">Request history</p>
            <ul className="flex flex-col gap-1.5 text-xs text-slate-500">
              {requests.map((r) => (
                <li key={r.id}>
                  {new Date(r.createdAt).toLocaleString('en-KE')} by {r.requestedBy.fullName} —{' '}
                  {r.downloadedAt ? 'downloaded' : r.availableAt && new Date(r.availableAt) <= new Date() ? 'ready' : r.confirmedAt ? 'waiting' : 'awaiting code'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
