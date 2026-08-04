'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Copy, Check } from 'lucide-react';
import { apiFetch, API_ORIGIN, ApiError } from '@/lib/api';
import { getAccessToken, getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { daysUntil, formatCountdown, countdownTone } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { StorageBar } from '@/components/ui/storage-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { Wallet, Database, ShieldAlert, Users } from 'lucide-react';
import { useTabQueryState } from '@/hooks/use-tab-query-state';
import { useTableControls } from '@/hooks/use-table-controls';
import { Pagination } from '@/components/ui/pagination';

const SUBLIST_PAGE_SIZE_OPTIONS = [10, 30, 50];

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'TRIAL' | 'PENDING_PAYMENT' | 'ACTIVE' | 'SUSPENDED';
  address: string | null;
  website: string | null;
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string | null;
  mpesaPaybill: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  createdAt: string;
  county: string | null;
  town: string | null;
  createdBy: { fullName: string } | null;
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
interface MpesaAttempt {
  id: string;
  phone: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  resultDesc: string | null;
  mpesaReceiptNumber: string | null;
  createdAt: string;
}
interface PaymentProof {
  id: string;
  method: 'BANK' | 'PAYBILL';
  rawMessage: string;
  extractedAmount: number | null;
  extractedReference: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewedBy: { fullName: string; email: string } | null;
  reviewNote: string | null;
  createdAt: string;
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
  const [tab, setTab] = useTabQueryState<Tab>(TABS, 'Overview');

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => apiFetch<Tenant>(`/platform/tenants/${id}`),
    // Poll quietly while a payment might land any second — React Query only shows a loading state
    // on the very first fetch (isLoading above), so these background refetches never flash/blink,
    // they just swap in fresh data once it arrives.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING_PAYMENT' ? 5_000 : 30_000),
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
            <p className="text-sm text-slate-500">
              {tenant.slug} · created {new Date(tenant.createdAt).toLocaleDateString()}
              {tenant.createdBy && ` by ${tenant.createdBy.fullName}`}
              {tenant.county && ` · ${tenant.county}${tenant.town ? `, ${tenant.town}` : ''}`}
            </p>
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
  // Reset password / Suspend / Activate are all @RequirePlatformRole('SUPER_ADMIN') server-side
  // (BillingController, TenantsController) — hide the whole Danger Zone for a Sub-Admin instead of
  // showing actions that will just 403 when clicked.
  const isSuperAdmin = getSessionUser()?.role === 'SUPER_ADMIN';
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<'suspend' | 'activate' | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: usage } = useQuery({
    queryKey: ['tenant-usage', tenant.id],
    queryFn: () => apiFetch<TenantUsage>(`/platform/tenants/${tenant.id}/usage`),
  });
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  const updateStorageLimit = useMutation({
    mutationFn: (storageLimitMb: number | null) =>
      apiFetch(`/platform/tenants/${tenant.id}/storage-limit`, {
        method: 'PATCH',
        body: JSON.stringify({ storageLimitMb }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-usage', tenant.id] });
      notifySuccess('Storage limit updated');
      setEditingLimit(false);
    },
    onError: (err) => notifyError(err, 'Failed to update storage limit'),
  });

  const { data: activationLink } = useQuery({
    queryKey: ['activation-link', tenant.id],
    queryFn: () => apiFetch<{ url: string; amountKes: number }>(`/platform/tenants/${tenant.id}/activation-link`),
    enabled: tenant.status === 'PENDING_PAYMENT',
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const [stkPhone, setStkPhone] = useState('');

  const initiateStk = useMutation({
    mutationFn: () =>
      apiFetch<{ checkoutRequestId: string }>(`/platform/tenants/${tenant.id}/initiate-stk`, {
        method: 'POST',
        body: JSON.stringify({ phone: stkPhone }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mpesa-attempts', tenant.id] });
      notifySuccess(`STK push sent to ${stkPhone} — ask them to enter their M-Pesa PIN`);
      setStkPhone('');
    },
    onError: (err) => notifyError(err, 'Failed to send STK push'),
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
  const canManuallyActivate = tenant.status === 'SUSPENDED' || tenant.status === 'PENDING_PAYMENT';

  return (
    <div className="flex flex-col gap-6">
      {tenant.status === 'PENDING_PAYMENT' && activationLink && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">
            Awaiting activation payment — KES {activationLink.amountKes.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Already sent to the school by email and SMS, with a link they can open themselves to pay.
            You can also copy the link below, or push an M-Pesa STK prompt directly from here.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2">
            <p className="flex-1 truncate text-xs text-slate-600">{activationLink.url}</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activationLink.url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="flex-shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Copy activation link"
              title="Copy to clipboard"
            >
              {linkCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            </button>
          </div>
          {isSuperAdmin && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                placeholder="Phone to push STK to, e.g. 0712345678"
                value={stkPhone}
                onChange={(e) => setStkPhone(e.target.value)}
                className="h-9 bg-white text-xs"
              />
              <Button
                size="sm"
                disabled={stkPhone.length < 9 || initiateStk.isPending}
                onClick={() => initiateStk.mutate()}
              >
                {initiateStk.isPending ? 'Sending...' : 'Send STK Push'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-float-up">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-80" aria-hidden />
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Storage Used</p>
            <div className="rounded-lg bg-blue-50 p-2.5">
              <Database size={18} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-3">
            <StorageBar totalMb={usage?.totalMb ?? 0} limitMb={usage?.limitMb ?? null} />
          </div>
          {isSuperAdmin && (
            <div className="mt-2">
              {editingLimit ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    placeholder="MB, blank = no limit"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={updateStorageLimit.isPending}
                    onClick={() => updateStorageLimit.mutate(limitInput.trim() === '' ? null : Number(limitInput))}
                  >
                    Save
                  </Button>
                  <button
                    type="button"
                    onClick={() => setEditingLimit(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLimitInput(usage?.limitMb ? String(usage.limitMb) : '');
                    setEditingLimit(true);
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Override limit
                </button>
              )}
            </div>
          )}
        </div>
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

      <FeedbackCard tenantId={tenant.id} />

      {isSuperAdmin && (
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
                  {canManuallyActivate ? 'Activate this school' : 'Suspend this school'}
                </p>
                <p className="text-xs text-slate-500">
                  {canManuallyActivate
                    ? tenant.status === 'PENDING_PAYMENT'
                      ? 'Grants access without waiting for the M-Pesa payment — use if paid another way (bank, cash).'
                      : 'Restores access for all staff and parents.'
                    : 'Immediately blocks all staff and parent logins until reactivated.'}
                </p>
              </div>
              <Button
                size="sm"
                variant={canManuallyActivate ? 'outline' : 'destructive'}
                onClick={() => setConfirmStatus(canManuallyActivate ? 'activate' : 'suspend')}
              >
                {canManuallyActivate ? 'Activate' : 'Suspend'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
        <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-sm animate-scale-in rounded-2xl bg-white p-6 text-center shadow-2xl">
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

interface TenantFeedbackRow {
  id: string;
  rating: number | null;
  improvements: string | null;
  interestedInRealAccount: boolean | null;
  context: 'DEMO_EXPIRY' | 'TICKET_RESOLUTION';
  createdAt: string;
}

function FeedbackCard({ tenantId }: { tenantId: string }) {
  const { data } = useQuery({
    queryKey: ['tenant-feedback', tenantId],
    queryFn: () => apiFetch<TenantFeedbackRow[]>(`/platform/tenants/${tenantId}/feedback`),
  });
  // Called unconditionally (before the empty-data early-return below) per Rules of Hooks.
  const feedback = useTableControls(data ?? [], { pageSize: 10 });

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feedback from this school</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {feedback.pageItems.map((f) => (
          <div key={f.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{f.rating ? `${f.rating}/5` : 'No rating'}</span>
              <span className="text-xs text-slate-400">
                {f.context === 'TICKET_RESOLUTION' ? 'Ticket feedback' : 'Demo survey'} ·{' '}
                {new Date(f.createdAt).toLocaleDateString()}
              </span>
            </div>
            {f.improvements && <p className="mt-1 text-slate-600">{f.improvements}</p>}
          </div>
        ))}
        <Pagination
          page={feedback.page}
          pageCount={feedback.pageCount}
          totalItems={feedback.totalItems}
          pageSize={feedback.pageSize}
          pageSizeOptions={SUBLIST_PAGE_SIZE_OPTIONS}
          onPageChange={feedback.setPage}
          onPageSizeChange={feedback.setPageSize}
        />
      </CardContent>
    </Card>
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
    refetchInterval: (query) => (query.state.data?.some((inv) => inv.status === 'PENDING') ? 5_000 : 30_000),
  });
  const invoicesPaged = useTableControls(invoices ?? [], { pageSize: 10 });

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
    <div className="flex flex-col gap-6">
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
          <>
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
              {invoicesPaged.pageItems.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{inv.invoiceNumber}</td>
                  <td className="py-2 text-slate-500">
                    {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-slate-700">{kes(inv.amount)}</td>
                  <td className="py-2">
                    <Badge status={inv.status} />
                    {inv.status === 'PAID' && inv.payments[0] && (
                      <p className="mt-1 text-xs text-slate-400">
                        {inv.payments[0].method === 'MPESA' ? 'via M-Pesa' : inv.payments[0].method === 'BANK' ? 'via bank' : 'via cash'}
                      </p>
                    )}
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
          <Pagination
            page={invoicesPaged.page}
            pageCount={invoicesPaged.pageCount}
            totalItems={invoicesPaged.totalItems}
            pageSize={invoicesPaged.pageSize}
            pageSizeOptions={SUBLIST_PAGE_SIZE_OPTIONS}
            onPageChange={invoicesPaged.setPage}
            onPageSizeChange={invoicesPaged.setPageSize}
          />
          </>
        )}
      </CardContent>

      {payTarget && (
        <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-sm animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
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

    <MpesaAttemptsCard tenantId={tenantId} />
    <PaymentProofsCard tenantId={tenantId} />
    </div>
  );
}

function MpesaAttemptsCard({ tenantId }: { tenantId: string }) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ['mpesa-attempts', tenantId],
    queryFn: () => apiFetch<MpesaAttempt[]>(`/platform/tenants/${tenantId}/mpesa-attempts`),
    refetchInterval: (query) => (query.state.data?.some((a) => a.status === 'PENDING') ? 5_000 : 30_000),
  });
  const attemptsPaged = useTableControls(attempts ?? [], { pageSize: 10 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>M-Pesa Attempts</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !attempts || attempts.length === 0 ? (
          <p className="text-sm text-slate-500">No M-Pesa STK attempts yet.</p>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">Phone</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Detail</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {attemptsPaged.pageItems.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-700">{a.phone}</td>
                  <td className="py-2 text-slate-700">{kes(a.amount)}</td>
                  <td className="py-2">
                    <Badge status={a.status} />
                  </td>
                  <td className="py-2 text-slate-500">{a.mpesaReceiptNumber ?? a.resultDesc ?? '—'}</td>
                  <td className="py-2 text-slate-400">{new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={attemptsPaged.page}
            pageCount={attemptsPaged.pageCount}
            totalItems={attemptsPaged.totalItems}
            pageSize={attemptsPaged.pageSize}
            pageSizeOptions={SUBLIST_PAGE_SIZE_OPTIONS}
            onPageChange={attemptsPaged.setPage}
            onPageSizeChange={attemptsPaged.setPageSize}
          />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentProofsCard({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<{ proof: PaymentProof; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const { data: proofs, isLoading } = useQuery({
    queryKey: ['payment-proofs', tenantId],
    queryFn: () => apiFetch<PaymentProof[]>(`/platform/tenants/${tenantId}/payment-proofs`),
    refetchInterval: 15_000,
  });
  const proofsPaged = useTableControls(proofs ?? [], { pageSize: 10 });

  const review = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/payment-proofs/${reviewing!.proof.id}/${reviewing!.action}`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: reviewNote || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      notifySuccess(reviewing?.action === 'approve' ? 'Payment approved — school activated' : 'Proof rejected');
      setReviewing(null);
      setReviewNote('');
    },
    onError: (err) => notifyError(err, 'Failed to review payment proof'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Proofs (Bank/Paybill)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !proofs || proofs.length === 0 ? (
          <p className="text-sm text-slate-500">No payment proofs submitted yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {proofsPaged.pageItems.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {p.method === 'BANK' ? 'Bank transfer' : 'Paybill'}
                      {p.extractedAmount && <span className="ml-2 text-slate-500">{kes(p.extractedAmount)}</span>}
                    </p>
                    {p.extractedReference && <p className="text-xs text-slate-500">Ref: {p.extractedReference}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{p.rawMessage}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(p.createdAt).toLocaleString()}</p>
                    {p.reviewedBy && (
                      <p className="mt-1 text-xs text-slate-400">
                        Reviewed by {p.reviewedBy.fullName}
                        {p.reviewNote ? ` — ${p.reviewNote}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <Badge status={p.status} />
                    {p.status === 'PENDING_REVIEW' && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setReviewing({ proof: p, action: 'reject' })}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => setReviewing({ proof: p, action: 'approve' })}>
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {proofs && proofs.length > 0 && (
          <Pagination
            page={proofsPaged.page}
            pageCount={proofsPaged.pageCount}
            totalItems={proofsPaged.totalItems}
            pageSize={proofsPaged.pageSize}
            pageSizeOptions={SUBLIST_PAGE_SIZE_OPTIONS}
            onPageChange={proofsPaged.setPage}
            onPageSizeChange={proofsPaged.setPageSize}
          />
        )}
      </CardContent>

      {reviewing && (
        <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-sm animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              {reviewing.action === 'approve' ? 'Approve payment proof' : 'Reject payment proof'}
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              {reviewing.action === 'approve'
                ? 'This will mark the invoice paid and activate the school.'
                : 'The school stays locked and can resubmit proof.'}
            </p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder="Note (optional)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReviewing(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={reviewing.action === 'reject' ? 'destructive' : 'default'}
                disabled={review.isPending}
                onClick={() => review.mutate()}
              >
                {review.isPending ? 'Saving...' : reviewing.action === 'approve' ? 'Approve & activate' : 'Reject'}
              </Button>
            </div>
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
  const requestsPaged = useTableControls(requests ?? [], { pageSize: 10 });

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
              {requestsPaged.pageItems.map((r) => (
                <li key={r.id}>
                  {new Date(r.createdAt).toLocaleString('en-KE')} by {r.requestedBy.fullName} —{' '}
                  {r.downloadedAt ? 'downloaded' : r.availableAt && new Date(r.availableAt) <= new Date() ? 'ready' : r.confirmedAt ? 'waiting' : 'awaiting code'}
                </li>
              ))}
            </ul>
            <Pagination
              page={requestsPaged.page}
              pageCount={requestsPaged.pageCount}
              totalItems={requestsPaged.totalItems}
              pageSize={requestsPaged.pageSize}
              pageSizeOptions={SUBLIST_PAGE_SIZE_OPTIONS}
              onPageChange={requestsPaged.setPage}
              onPageSizeChange={requestsPaged.setPageSize}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
