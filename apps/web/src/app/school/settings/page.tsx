'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const INVOICES_PAGE_SIZE_OPTIONS = [5, 10, 30, 50];

const TABS = [
  { key: 'identity', label: 'Identity' },
  { key: 'theme', label: 'Theme' },
  { key: 'about', label: 'About' },
  { key: 'academic', label: 'Academic' },
  { key: 'billing', label: 'Payment & Billing' },
  { key: 'workflows', label: 'Workflows' },
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
  const canManageWorkflows = user?.permissions?.includes('TENANT:MANAGE_USERS');

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
        {TABS.filter((t) => t.key !== 'workflows' || canManageWorkflows).map((t) => (
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
      {tab === 'workflows' && canManageWorkflows && <WorkflowsTab />}
    </div>
  );
}

function BillingCard({ settings }: { settings: SchoolSettings }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => apiFetch<Invoice[]>('/settings/billing'),
  });
  const invoicesPaged = useTableControls(invoices ?? [], { pageSize: 5 });

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

interface WorkflowStepRow {
  name: string;
  approverPermissionCode: string;
  slaHours: string;
}
interface RoleWithPermissions {
  id: string;
  name: string;
  rolePermissions: { permission: { code: string; module: string; action: string } }[];
}
interface WorkflowDefinitionResponse {
  steps: { order: number; name: string; approverPermissionCode: string; slaHours: number | null }[];
}

interface WorkflowEntityConfig {
  entityType: string;
  navLabel: string;
  cardTitle: string;
  /** The permission code that gates approve/reject when no chain is configured — shown in the
   * empty-state copy so it stays accurate per department instead of hardcoding "HR:EDIT". */
  fallbackPermission: string;
}
const WORKFLOW_ENTITIES: readonly WorkflowEntityConfig[] = [
  { entityType: 'LEAVE_REQUEST', navLabel: 'Leave Requests', cardTitle: 'Leave request approval chain', fallbackPermission: 'HR:EDIT' },
  { entityType: 'ADMISSION_APPLICATION', navLabel: 'Admissions', cardTitle: 'Admission application approval chain', fallbackPermission: 'ADMISSION:MANAGE' },
  { entityType: 'TRIP_PROPOSAL', navLabel: 'Trips', cardTitle: 'Trip proposal approval chain', fallbackPermission: 'TRANSPORT:MANAGE' },
  { entityType: 'EXAM_MARKSHEET', navLabel: 'Exam Marks', cardTitle: 'Exam mark-sheet approval chain', fallbackPermission: 'EXAM:APPROVE' },
];

/** Container for the workflow engine's per-department settings — each configured entity type (see
 * WORKFLOW_ENTITIES) gets its own step-chain editor, reusing the identical WorkflowEntityTab
 * component. This is what makes "plug a new department into the engine" cheap: the engine itself and
 * this settings UI both stay entity-agnostic, so wiring in a third department later needs only a new
 * WORKFLOW_ENTITIES entry, not new UI code. */
function WorkflowsTab() {
  const [entityType, setEntityType] = useState<string>(WORKFLOW_ENTITIES[0].entityType);
  const active = WORKFLOW_ENTITIES.find((e) => e.entityType === entityType) ?? WORKFLOW_ENTITIES[0];

  return (
    <div className="flex flex-col gap-3">
      {WORKFLOW_ENTITIES.length > 1 && (
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 self-start">
          {WORKFLOW_ENTITIES.map((e) => (
            <button
              key={e.entityType}
              type="button"
              onClick={() => setEntityType(e.entityType)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                entityType === e.entityType ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {e.navLabel}
            </button>
          ))}
        </div>
      )}
      <WorkflowEntityTab key={active.entityType} config={active} />
    </div>
  );
}

/** Configures a single entity type's approval chain — a Phase-1 pilot for the generic workflow
 * engine (see docs plan "Generic Workflow/Approval Engine"), now reused across every plugged-in
 * department (see WORKFLOW_ENTITIES). A step's approver is anyone holding the chosen permission
 * code; this schema has no reporting-hierarchy/org-chart concept, so there's no "pick a role in an
 * org chart" option — only "pick a permission." Leaving no steps configured (or never saving here)
 * keeps that department on its original single-approver fallback path. */
function WorkflowEntityTab({ config }: { config: WorkflowEntityConfig }) {
  const { entityType, cardTitle, fallbackPermission } = config;
  const queryClient = useQueryClient();
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<RoleWithPermissions[]>('/roles'),
  });
  const { data: definition, isLoading, isError, error, fetchStatus, status } = useQuery({
    queryKey: ['workflow-definition', entityType],
    queryFn: () => apiFetch<WorkflowDefinitionResponse | null>(`/workflows/definitions/${entityType}`),
  });
  const [steps, setSteps] = useState<WorkflowStepRow[] | null>(null);
  const hasSynced = useRef(false);

  // TEMPORARY diagnostic: tracking down a "stuck Loading forever" report that persists in
  // incognito, so it isn't cache/session related. Remove once root cause is found.
  useEffect(() => {
    console.log(`[WorkflowEntityTab:${entityType}] MOUNTED`);
    return () => console.log(`[WorkflowEntityTab:${entityType}] UNMOUNTED`);
  }, [entityType]);
  console.log(`[WorkflowEntityTab:${entityType}] render`, {
    isLoading,
    isError,
    status,
    fetchStatus,
    definition,
    steps,
    hasSynced: hasSynced.current,
    t: new Date().toISOString(),
  });

  useEffect(() => {
    // isLoading must be a dependency here, not just read inside the effect: when the query settles
    // into an error (403/500/network), `definition` stays `undefined` on both the pre- and post-fetch
    // renders (no reference change), so an effect keyed only on [definition] never re-fires once
    // isLoading flips to false — hasSynced never gets set, steps stays null, and the component is
    // stuck on "Loading..." forever, surviving both a hard refresh and a fresh login since it's a
    // deterministic per-request failure, not session state.
    if (hasSynced.current || isLoading) return;
    hasSynced.current = true;
    setSteps(
      definition && definition.steps.length > 0
        ? definition.steps
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ name: s.name, approverPermissionCode: s.approverPermissionCode, slaHours: s.slaHours?.toString() ?? '' }))
        : [],
    );
  }, [definition, isLoading]);

  const permissionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const role of roles ?? []) {
      for (const rp of role.rolePermissions) {
        seen.set(rp.permission.code, `${rp.permission.code} (${rp.permission.module})`);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [roles]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/workflows/definitions/${entityType}`, {
        method: 'PUT',
        body: JSON.stringify({
          steps: (steps ?? []).map((s) => ({
            name: s.name,
            approverPermissionCode: s.approverPermissionCode,
            slaHours: s.slaHours ? Number(s.slaHours) : undefined,
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definition', entityType] });
      notifySuccess('Approval chain saved');
    },
    onError: (err) => notifyError(err, 'Failed to save approval chain'),
  });

  if (isLoading || steps === null) return <p className="text-sm text-slate-500">Loading...</p>;
  if (isError) {
    return (
      <p className="text-sm text-rose-600">
        Failed to load the approval chain: {error instanceof Error ? error.message : 'Unknown error'}. Try
        refreshing the page.
      </p>
    );
  }

  const canSave = steps.every((s) => s.name.trim() && s.approverPermissionCode) && (steps.length === 0 || permissionOptions.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
        <CardDescription>
          Add one or more review steps. Anyone holding the chosen permission can act on that step. Leave this empty and any
          holder of {fallbackPermission} can approve/reject directly, same as before.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.length === 0 && <p className="text-sm text-slate-500">No approval chain configured — direct {fallbackPermission} approval applies.</p>}
        {steps.map((step, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3">
            <span className="w-6 text-sm font-medium text-slate-400">{i + 1}.</span>
            <Input
              value={step.name}
              onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))}
              placeholder="Step name (e.g. HOD Review)"
              className="w-56"
            />
            <select
              value={step.approverPermissionCode}
              onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, approverPermissionCode: e.target.value } : s)))}
              className="h-10 rounded-md border border-slate-300 px-2 text-sm"
            >
              <option value="">Approver permission...</option>
              {permissionOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              value={step.slaHours}
              onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, slaHours: e.target.value } : s)))}
              type="number"
              min="1"
              placeholder="SLA hours (optional)"
              className="w-40"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSteps([...steps, { name: '', approverPermissionCode: '', slaHours: '' }])}
          >
            + Add step
          </Button>
          <Button type="button" size="sm" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save approval chain'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
