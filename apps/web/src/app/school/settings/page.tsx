'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, apiUpload, API_ORIGIN, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { daysUntil, formatCountdown, countdownTone } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDraftState } from '@/hooks/use-draft-state';
import { useTabQueryState } from '@/hooks/use-tab-query-state';
import { useTableControls } from '@/hooks/use-table-controls';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

const INVOICES_PAGE_SIZE_OPTIONS = [10, 30, 50];

const TABS = [
  { key: 'identity', label: 'Identity' },
  { key: 'theme', label: 'Theme' },
  { key: 'about', label: 'About' },
  { key: 'academic', label: 'Academic' },
  { key: 'billing', label: 'Payment & Billing' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

interface SchoolSettings {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  sidebarColor: string | null;
  contentBgColor: string | null;
  address: string | null;
  website: string | null;
  smsSenderId: string | null;
  mission: string | null;
  vision: string | null;
  motto: string | null;
  mpesaPaybill: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  passMarkPercent: number;
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string | null;
  settingsConfigured: boolean;
}
interface Payment {
  id: string;
  amount: number;
  method: string;
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

interface FormState {
  [key: string]: string;
  name: string;
  primaryColor: string;
  sidebarColor: string;
  contentBgColor: string;
  address: string;
  website: string;
  smsSenderId: string;
  motto: string;
  mission: string;
  vision: string;
  passMarkPercent: string;
}

// Mirrored in apps/api/src/settings/settings.service.ts's REQUIRED_FIELDS — the fields that
// actually make a school look "set up" for the onboarding progress bar below.
const REQUIRED_FIELDS: (keyof SchoolSettings)[] = ['name', 'logoUrl', 'address', 'mission', 'vision', 'motto'];
const REQUIRED_FIELD_LABELS: Record<string, string> = {
  name: 'School name',
  logoUrl: 'Logo',
  address: 'Address',
  mission: 'Mission',
  vision: 'Vision',
  motto: 'Motto',
};

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

// A small curated palette, not an exhaustive one — the raw color picker next to it still covers
// any exact shade a school wants. Foreground/hover/border shades are always derived automatically
// from whatever's picked (see apps/web/src/lib/theme-color.ts), so every one of these stays
// readable regardless of which field it's applied to.
const RECOMMENDED_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Slate', value: '#0f172a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Violet', value: '#7c3aed' },
];

function ColorPresetSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {RECOMMENDED_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={cn(
            'h-6 w-6 rounded-full border shadow-sm transition-transform hover:scale-110',
            value.toLowerCase() === c.value ? 'ring-2 ring-offset-1 ring-slate-900' : 'border-slate-200',
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [tab, setTab] = useTabQueryState<TabKey>(
    TABS.map((t) => t.key),
    'identity',
  );
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    name: '',
    primaryColor: '#2563eb',
    sidebarColor: '#ffffff',
    contentBgColor: '#f8fafc',
    address: '',
    website: '',
    smsSenderId: '',
    motto: '',
    mission: '',
    vision: '',
    passMarkPercent: '50',
  });
  const hasSynced = useRef(false);
  const { loadDraft, saveDraft, clearDraft } = useDraftState<FormState>('school-settings');

  const canManage = user?.permissions?.includes('SETTINGS:MANAGE');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch<SchoolSettings>('/settings'),
    enabled: !!user,
  });

  // Syncs from the server exactly once (a real reload restarts this component and `hasSynced`
  // together, which is fine — the draft below is what survives that), then layers any saved draft
  // on top so an accidental refresh mid-edit doesn't lose typed-but-unsaved changes.
  useEffect(() => {
    if (settings && !hasSynced.current) {
      hasSynced.current = true;
      const fromServer: FormState = {
        name: settings.name,
        primaryColor: settings.primaryColor ?? '#2563eb',
        sidebarColor: settings.sidebarColor ?? '#ffffff',
        contentBgColor: settings.contentBgColor ?? '#f8fafc',
        address: settings.address ?? '',
        website: settings.website ?? '',
        smsSenderId: settings.smsSenderId ?? '',
        motto: settings.motto ?? '',
        mission: settings.mission ?? '',
        vision: settings.vision ?? '',
        passMarkPercent: String(settings.passMarkPercent),
      };
      const draft = loadDraft();
      setForm(draft ? ({ ...fromServer, ...draft } as FormState) : fromServer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (hasSynced.current) saveDraft(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const updateSettings = useMutation({
    mutationFn: () =>
      apiFetch('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          primaryColor: form.primaryColor,
          sidebarColor: form.sidebarColor,
          contentBgColor: form.contentBgColor,
          address: form.address || undefined,
          website: form.website || undefined,
          smsSenderId: form.smsSenderId || undefined,
          mission: form.mission || undefined,
          vision: form.vision || undefined,
          motto: form.motto || undefined,
          passMarkPercent: form.passMarkPercent ? Number(form.passMarkPercent) : undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      clearDraft();
      setError(null);
      notifySuccess('Settings saved');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
      notifyError(err, 'Failed to save settings');
    },
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const { url } = await apiUpload(file);
      return apiFetch('/settings', { method: 'PATCH', body: JSON.stringify({ logoUrl: url }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setUploading(false);
      notifySuccess('Logo updated');
    },
    onError: (err) => {
      setUploading(false);
      setError(err instanceof ApiError ? err.message : 'Failed to upload logo');
      notifyError(err, 'Failed to upload logo');
    },
  });

  if (!user || isLoading || !settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>School Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>School Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Only a School Administrator can view and edit these settings.</p>
        </CardContent>
      </Card>
    );
  }

  const missingFields = REQUIRED_FIELDS.filter((f) => !settings[f]);
  const completedCount = REQUIRED_FIELDS.length - missingFields.length;

  return (
    <div className="flex flex-col gap-6">
      {!settings.settingsConfigured && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Getting your school set up</span>
              <span className="text-slate-500">
                {completedCount} of {REQUIRED_FIELDS.length} done
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                style={{ width: `${(completedCount / REQUIRED_FIELDS.length) * 100}%` }}
              />
            </div>
            {missingFields.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Still needed: {missingFields.map((f) => REQUIRED_FIELD_LABELS[f]).join(', ')}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateSettings.mutate();
        }}
        className="flex flex-col gap-6"
      >
        {tab === 'identity' && (
        <Card>
          <CardHeader>
            <CardTitle>School Identity</CardTitle>
            <CardDescription>Your logo and name — shown in the sidebar and on report cards.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_ORIGIN}${settings.logoUrl}`}
                  alt="School logo"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                  No logo
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo.mutate(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? 'Uploading...' : 'Upload logo'}
                </Button>
                <p className="mt-1 text-xs text-slate-400">JPG, PNG, or WEBP, up to 5MB. Saves immediately.</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">School name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
          </CardContent>
        </Card>
        )}

        {tab === 'theme' && (
        <Card>
          <CardHeader>
            <CardTitle>Theme Colors</CardTitle>
            <CardDescription>
              Reskins the app shell only — card content stays white with the usual text colors, and
              sidebar text/hover colors are computed automatically for contrast, so any color you pick
              here stays readable.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Brand color</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300"
              />
              <ColorPresetSwatches value={form.primaryColor} onChange={(c) => setForm((f) => ({ ...f, primaryColor: c }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Sidebar color</label>
              <input
                type="color"
                value={form.sidebarColor}
                onChange={(e) => setForm((f) => ({ ...f, sidebarColor: e.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300"
              />
              <ColorPresetSwatches value={form.sidebarColor} onChange={(c) => setForm((f) => ({ ...f, sidebarColor: c }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Main background color</label>
              <input
                type="color"
                value={form.contentBgColor}
                onChange={(e) => setForm((f) => ({ ...f, contentBgColor: e.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300"
              />
              <ColorPresetSwatches value={form.contentBgColor} onChange={(c) => setForm((f) => ({ ...f, contentBgColor: c }))} />
            </div>
          </CardContent>
        </Card>
        )}

        {tab === 'about' && (
        <Card>
          <CardHeader>
            <CardTitle>About Your School</CardTitle>
            <CardDescription>
              Mission, vision, motto, and logo appear on downloadable student report cards.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Address</label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Website</label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">SMS sender ID</label>
              <Input
                value={form.smsSenderId}
                onChange={(e) => setForm((f) => ({ ...f, smsSenderId: e.target.value }))}
                placeholder="SCHOOLNAME"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Motto</label>
              <Input
                value={form.motto}
                onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))}
                placeholder="Excellence Through Character"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Mission</label>
              <textarea
                value={form.mission}
                onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))}
                rows={2}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Vision</label>
              <textarea
                value={form.vision}
                onChange={(e) => setForm((f) => ({ ...f, vision: e.target.value }))}
                rows={2}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>
        )}

        {tab === 'academic' && (
        <Card>
          <CardHeader>
            <CardTitle>Academic Configuration</CardTitle>
            <CardDescription>
              Scores at or above the pass mark render green on the report card; below it renders red.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex max-w-xs flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Report card pass mark (%)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.passMarkPercent}
                onChange={(e) => setForm((f) => ({ ...f, passMarkPercent: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
        )}

        {tab !== 'billing' && (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </>
        )}
      </form>

      {tab === 'billing' && (
      <Card>
        <CardHeader>
          <CardTitle>Payment configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Set by the platform Super Admin — visible here for your reference, not editable.
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">M-Pesa Paybill</dt>
              <dd className="font-medium text-slate-900">{settings.mpesaPaybill ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Bank</dt>
              <dd className="font-medium text-slate-900">{settings.bankName ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Account name</dt>
              <dd className="font-medium text-slate-900">{settings.bankAccountName ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Account number</dt>
              <dd className="font-medium text-slate-900">{settings.bankAccountNumber ?? 'Not set'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      )}

      {tab === 'billing' && <BillingCard settings={settings} />}
    </div>
  );
}

function BillingCard({ settings }: { settings: SchoolSettings }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => apiFetch<Invoice[]>('/settings/billing'),
  });
  const invoicesPaged = useTableControls(invoices ?? [], { pageSize: 10 });

  const days = settings.currentPeriodEnd ? daysUntil(settings.currentPeriodEnd) : null;
  const tone = days !== null ? countdownTone(days) : 'upcoming';

  async function downloadPdf(invoiceId: string) {
    setDownloadingId(invoiceId);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_ORIGIN}/settings/billing/${invoiceId}/pdf`, {
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
      <CardHeader>
        <CardTitle>Subscription &amp; Billing</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex items-center justify-between rounded-lg bg-slate-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {settings.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'} subscription renews
            </p>
            <p
              className={`mt-1 text-lg font-semibold ${
                tone === 'past' ? 'text-rose-600' : tone === 'soon' ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {days !== null ? formatCountdown(days) : 'Not set'}
            </p>
          </div>
          {settings.currentPeriodEnd && (
            <p className="text-sm text-slate-500">{new Date(settings.currentPeriodEnd).toLocaleDateString()}</p>
          )}
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Invoices and receipts issued by the platform for this school&apos;s subscription. Emailed to
          this account when issued or paid.
        </p>

        {invoicesLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !invoices || invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">Invoice</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {invoicesPaged.pageItems.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{inv.invoiceNumber}</td>
                  <td className="py-2 text-slate-700">{kes(inv.amount)}</td>
                  <td className="py-2">
                    <Badge status={inv.status} />
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === inv.id}
                      onClick={() => downloadPdf(inv.id)}
                    >
                      {downloadingId === inv.id ? '...' : 'Download PDF'}
                    </Button>
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
            pageSizeOptions={INVOICES_PAGE_SIZE_OPTIONS}
            onPageChange={invoicesPaged.setPage}
            onPageSizeChange={invoicesPaged.setPageSize}
          />
          </>
        )}
      </CardContent>
    </Card>
  );
}
