'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload, API_ORIGIN } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

const TABS = [
  { key: 'payment', label: 'Payment Details' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'templates', label: 'Message Templates' },
  { key: 'api', label: 'API & Payment Config' },
  { key: 'branding', label: 'Branding' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

interface SecretField {
  set: boolean;
  preview: string | null;
}

interface PlatformSettings {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  paybillNumber: string | null;
  paybillAccountName: string | null;
  smsEnabled: boolean;
  emailEnabled: boolean;
  stkEnabled: boolean;
  bankTransferEnabled: boolean;
  paybillEnabled: boolean;
  demoReminderDaysBefore: number;
  renewalReminderDaysBefore: number;
  mpesaEnv: string | null;
  mpesaConsumerKey: string | null;
  mpesaConsumerSecret: SecretField;
  mpesaShortcode: string | null;
  mpesaPasskey: SecretField;
  mpesaCallbackUrl: string | null;
  resendApiKey: SecretField;
  resendFromAddress: string | null;
  advantaApiKey: SecretField;
  advantaPartnerId: string | null;
  advantaSenderId: string | null;
  systemName: string | null;
  loginTagline: string | null;
  loginSubtitle: string | null;
  loginLogoUrl: string | null;
  faviconUrl: string | null;
  loginHeading: string | null;
  loginHelperText: string | null;
  loginFooterText: string | null;
  builtByText: string | null;
}

interface EffectiveTemplate {
  key: string;
  subject?: string;
  emailBody?: string;
  smsBody?: string;
  variables: string[];
  isCustomized: boolean;
}

interface OtpRequestResult {
  requestId: string;
  expiresAt: string;
  devCode?: string;
}

interface PendingChange {
  result: OtpRequestResult;
  confirmPath: string;
  label: string;
}

type OnRequested = (result: OtpRequestResult, confirmPath: string, label: string) => void;

const TEMPLATE_LABELS: Record<string, string> = {
  OTP_SUPERADMIN: 'Your school-creation confirmation code',
  OTP_ADMIN: "New admin's verification code",
  WELCOME_DEMO: 'Welcome — demo account',
  WELCOME_REAL: 'Welcome + activation link — real account',
  ACTIVATED: 'Account activated (payment received)',
  PROOF_SUBMITTED_SUPERADMIN: 'Alert: payment proof submitted (to you)',
  PROOF_RECEIVED_SCHOOL: 'Confirmation: proof received (to school)',
  DEMO_REMINDER: 'Demo expiry reminder + survey',
  RENEWAL_REMINDER: 'Renewal deadline reminder',
  SETTINGS_OTP: 'Settings-change confirmation code',
};

export default function PlatformSettingsPage() {
  useRequireSuperAdmin();
  const [tab, setTab] = useState<TabKey>('payment');
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [code, setCode] = useState('');
  // Bumped only when our own confirmed save lands — remounts the active tab (via its `key` below)
  // so its form resyncs from the freshly-saved server data. Background refetchInterval ticks don't
  // touch this, so they never remount a tab mid-edit and clobber unsaved typing.
  const [dataVersion, setDataVersion] = useState(0);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => apiFetch<PlatformSettings>('/platform/settings'),
  });
  const templatesQuery = useQuery({
    queryKey: ['platform-message-templates'],
    queryFn: () => apiFetch<EffectiveTemplate[]>('/platform/message-templates'),
  });

  const confirmChange = useMutation({
    mutationFn: () =>
      apiFetch(pending!.confirmPath, {
        method: 'POST',
        body: JSON.stringify({ requestId: pending!.result.requestId, code }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['platform-message-templates'] });
      setDataVersion((v) => v + 1);
      notifySuccess(`${pending!.label} saved`);
      setPending(null);
      setCode('');
    },
    onError: (err) => notifyError(err, 'Failed to confirm change'),
  });

  const onRequested: OnRequested = (result, confirmPath, label) => {
    setPending({ result, confirmPath, label });
    setCode('');
    notifySuccess('Confirmation code sent');
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Payment details, notification channels, and the messages School ERP sends. Every change here
          needs a confirmation code sent to your own email and phone first.
        </p>
      </div>

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

      {settingsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {tab === 'payment' && <PaymentDetailsTab key={dataVersion} data={settingsQuery.data} onRequested={onRequested} />}
          {tab === 'notifications' && <NotificationsTab key={dataVersion} data={settingsQuery.data} onRequested={onRequested} />}
          {tab === 'api' && <ApiConfigTab key={dataVersion} data={settingsQuery.data} onRequested={onRequested} />}
          {tab === 'branding' && <BrandingTab key={dataVersion} data={settingsQuery.data} onRequested={onRequested} />}
        </>
      )}
      {tab === 'templates' && (
        <TemplatesTab
          dataVersion={dataVersion}
          templates={templatesQuery.data}
          loading={templatesQuery.isLoading}
          onRequested={onRequested}
        />
      )}

      {pending && (
        <ConfirmDialog
          pending={pending}
          code={code}
          setCode={setCode}
          onCancel={() => {
            setPending(null);
            setCode('');
          }}
          onConfirm={() => confirmChange.mutate()}
          confirming={confirmChange.isPending}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  pending,
  code,
  setCode,
  onCancel,
  onConfirm,
  confirming,
}: {
  pending: PendingChange;
  code: string;
  setCode: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-scale-in rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Confirm: {pending.label}</h2>
        </div>
        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-slate-500">
            A 6-digit confirmation code was sent to your email and phone. Enter it to apply this change.
          </p>
          {pending.result.devCode && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Dev/test convenience: since real email isn&apos;t configured yet, the code is also shown here —{' '}
              <strong>{pending.result.devCode}</strong>.
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Confirmation code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="482913" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={code.length !== 6 || confirming} onClick={onConfirm}>
            {confirming ? 'Confirming...' : 'Confirm & save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

function PaymentDetailsTab({ data, onRequested }: { data?: PlatformSettings; onRequested: OnRequested }) {
  const [form, setForm] = useState<Partial<PlatformSettings>>({});
  // Sync only once per mount (the parent remounts this tab via `key={dataVersion}` after our own
  // confirmed save) — not on every background refetchInterval tick, which would otherwise clobber
  // in-progress typing.
  const hasSynced = useRef(false);

  useEffect(() => {
    if (data && !hasSynced.current) {
      hasSynced.current = true;
      setForm({
        bankName: data.bankName ?? '',
        bankAccountName: data.bankAccountName ?? '',
        bankAccountNumber: data.bankAccountNumber ?? '',
        paybillNumber: data.paybillNumber ?? '',
        paybillAccountName: data.paybillAccountName ?? '',
        stkEnabled: data.stkEnabled,
        bankTransferEnabled: data.bankTransferEnabled,
        paybillEnabled: data.paybillEnabled,
      });
    }
  }, [data]);

  const requestSave = useMutation({
    mutationFn: () => apiFetch<OtpRequestResult>('/platform/settings/request-update', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
    onSuccess: (result) => onRequested(result, '/platform/settings/confirm-update', 'Payment details'),
    onError: (err) => notifyError(err, 'Failed to request settings change'),
  });

  function field(key: 'bankName' | 'bankAccountName' | 'bankAccountNumber' | 'paybillNumber' | 'paybillAccountName') {
    return {
      value: (form[key] as string) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment methods available to schools</CardTitle>
          <CardDescription>Turn a method off to hide it from the public activation page.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="M-Pesa STK Push"
            checked={!!form.stkEnabled}
            onChange={(v) => setForm((f) => ({ ...f, stkEnabled: v }))}
          />
          <Toggle
            label="Bank transfer"
            checked={!!form.bankTransferEnabled}
            onChange={(v) => setForm((f) => ({ ...f, bankTransferEnabled: v }))}
          />
          <Toggle
            label="Paybill"
            checked={!!form.paybillEnabled}
            onChange={(v) => setForm((f) => ({ ...f, paybillEnabled: v }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Transfer</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Bank name</label>
            <Input placeholder="e.g. Equity Bank" {...field('bankName')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Account name</label>
            <Input {...field('bankAccountName')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Account number</label>
            <Input {...field('bankAccountNumber')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">M-Pesa Paybill</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Paybill number</label>
            <Input {...field('paybillNumber')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Account name</label>
            <Input {...field('paybillAccountName')} />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => requestSave.mutate()} disabled={requestSave.isPending}>
          {requestSave.isPending ? 'Sending code...' : 'Save payment details'}
        </Button>
      </div>
    </div>
  );
}

function NotificationsTab({ data, onRequested }: { data?: PlatformSettings; onRequested: OnRequested }) {
  const [form, setForm] = useState<Partial<PlatformSettings>>({});
  const hasSynced = useRef(false);

  useEffect(() => {
    if (data && !hasSynced.current) {
      hasSynced.current = true;
      setForm({
        smsEnabled: data.smsEnabled,
        emailEnabled: data.emailEnabled,
        demoReminderDaysBefore: data.demoReminderDaysBefore,
        renewalReminderDaysBefore: data.renewalReminderDaysBefore,
      });
    }
  }, [data]);

  const requestSave = useMutation({
    mutationFn: () => apiFetch<OtpRequestResult>('/platform/settings/request-update', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
    onSuccess: (result) => onRequested(result, '/platform/settings/confirm-update', 'Notification settings'),
    onError: (err) => notifyError(err, 'Failed to request settings change'),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
          <CardDescription>Turn a channel off to stop all outbound messages of that kind platform-wide.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle
            label="SMS"
            description="Advanta SMS"
            checked={!!form.smsEnabled}
            onChange={(v) => setForm((f) => ({ ...f, smsEnabled: v }))}
          />
          <Toggle
            label="Email"
            description="Resend"
            checked={!!form.emailEnabled}
            onChange={(v) => setForm((f) => ({ ...f, emailEnabled: v }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminder windows</CardTitle>
          <CardDescription>How many days before a deadline the daily reminder job sends its message.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Demo expiry reminder (days before)</label>
            <Input
              type="number"
              min={0}
              value={form.demoReminderDaysBefore ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, demoReminderDaysBefore: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Renewal reminder (days before)</label>
            <Input
              type="number"
              min={0}
              value={form.renewalReminderDaysBefore ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, renewalReminderDaysBefore: Number(e.target.value) }))}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => requestSave.mutate()} disabled={requestSave.isPending}>
          {requestSave.isPending ? 'Sending code...' : 'Save notification settings'}
        </Button>
      </div>
    </div>
  );
}

function SecretInput({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field?: SecretField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <PasswordInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field?.set ? `•••• set (ending ${field.preview})` : 'Not set'}
      />
      <p className="text-xs text-slate-400">Leave blank to keep the current value.</p>
    </div>
  );
}

function ApiConfigTab({ data, onRequested }: { data?: PlatformSettings; onRequested: OnRequested }) {
  const [form, setForm] = useState({
    mpesaEnv: '',
    mpesaConsumerKey: '',
    mpesaShortcode: '',
    mpesaCallbackUrl: '',
    resendFromAddress: '',
    advantaPartnerId: '',
    advantaSenderId: '',
  });
  const [secrets, setSecrets] = useState({
    mpesaConsumerSecret: '',
    mpesaPasskey: '',
    resendApiKey: '',
    advantaApiKey: '',
  });
  const hasSynced = useRef(false);

  useEffect(() => {
    if (data && !hasSynced.current) {
      hasSynced.current = true;
      setForm({
        mpesaEnv: data.mpesaEnv ?? '',
        mpesaConsumerKey: data.mpesaConsumerKey ?? '',
        mpesaShortcode: data.mpesaShortcode ?? '',
        mpesaCallbackUrl: data.mpesaCallbackUrl ?? '',
        resendFromAddress: data.resendFromAddress ?? '',
        advantaPartnerId: data.advantaPartnerId ?? '',
        advantaSenderId: data.advantaSenderId ?? '',
      });
      setSecrets({ mpesaConsumerSecret: '', mpesaPasskey: '', resendApiKey: '', advantaApiKey: '' });
    }
  }, [data]);

  const requestSave = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = { ...form };
      if (!payload.mpesaEnv) delete payload.mpesaEnv;
      for (const [key, value] of Object.entries(secrets)) {
        if (value) payload[key] = value;
      }
      return apiFetch<OtpRequestResult>('/platform/settings/request-update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (result) => onRequested(result, '/platform/settings/confirm-update', 'API & Payment Config'),
    onError: (err) => notifyError(err, 'Failed to request settings change'),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">M-Pesa Daraja</CardTitle>
          <CardDescription>
            Powers the STK Push activation flow. Sandbox credentials come from the Safaricom
            developer portal; switch to production when you&apos;re ready to go live.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Environment</label>
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              value={form.mpesaEnv}
              onChange={(e) => setForm((f) => ({ ...f, mpesaEnv: e.target.value }))}
            >
              <option value="">Use server default (MPESA_ENV env var)</option>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Shortcode</label>
            <Input
              value={form.mpesaShortcode}
              onChange={(e) => setForm((f) => ({ ...f, mpesaShortcode: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Consumer key</label>
            <Input
              value={form.mpesaConsumerKey}
              onChange={(e) => setForm((f) => ({ ...f, mpesaConsumerKey: e.target.value }))}
            />
          </div>
          <SecretInput
            label="Consumer secret"
            field={data?.mpesaConsumerSecret}
            value={secrets.mpesaConsumerSecret}
            onChange={(v) => setSecrets((s) => ({ ...s, mpesaConsumerSecret: v }))}
          />
          <SecretInput
            label="Passkey"
            field={data?.mpesaPasskey}
            value={secrets.mpesaPasskey}
            onChange={(v) => setSecrets((s) => ({ ...s, mpesaPasskey: v }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Callback URL</label>
            <Input
              value={form.mpesaCallbackUrl}
              onChange={(e) => setForm((f) => ({ ...f, mpesaCallbackUrl: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resend (email)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SecretInput
            label="API key"
            field={data?.resendApiKey}
            value={secrets.resendApiKey}
            onChange={(v) => setSecrets((s) => ({ ...s, resendApiKey: v }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">From address</label>
            <Input
              placeholder="School ERP <no-reply@yourdomain.com>"
              value={form.resendFromAddress}
              onChange={(e) => setForm((f) => ({ ...f, resendFromAddress: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanta (SMS)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SecretInput
            label="API key"
            field={data?.advantaApiKey}
            value={secrets.advantaApiKey}
            onChange={(v) => setSecrets((s) => ({ ...s, advantaApiKey: v }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Partner ID</label>
            <Input
              value={form.advantaPartnerId}
              onChange={(e) => setForm((f) => ({ ...f, advantaPartnerId: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Sender ID</label>
            <Input
              value={form.advantaSenderId}
              onChange={(e) => setForm((f) => ({ ...f, advantaSenderId: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => requestSave.mutate()} disabled={requestSave.isPending}>
          {requestSave.isPending ? 'Sending code...' : 'Save API & payment config'}
        </Button>
      </div>
    </div>
  );
}

const BRANDING_DEFAULTS = {
  systemName: '',
  loginTagline: '',
  loginSubtitle: '',
  loginLogoUrl: '',
  faviconUrl: '',
  loginHeading: '',
  loginHelperText: '',
  loginFooterText: '',
  builtByText: '',
};

function BrandingTab({ data, onRequested }: { data?: PlatformSettings; onRequested: OnRequested }) {
  const [form, setForm] = useState(BRANDING_DEFAULTS);
  const hasSynced = useRef(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data && !hasSynced.current) {
      hasSynced.current = true;
      setForm({
        systemName: data.systemName ?? '',
        loginTagline: data.loginTagline ?? '',
        loginSubtitle: data.loginSubtitle ?? '',
        loginLogoUrl: data.loginLogoUrl ?? '',
        faviconUrl: data.faviconUrl ?? '',
        loginHeading: data.loginHeading ?? '',
        loginHelperText: data.loginHelperText ?? '',
        loginFooterText: data.loginFooterText ?? '',
        builtByText: data.builtByText ?? '',
      });
    }
  }, [data]);

  const requestSave = useMutation({
    mutationFn: () =>
      apiFetch<OtpRequestResult>('/platform/settings/request-update', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (result) => onRequested(result, '/platform/settings/confirm-update', 'Branding'),
    onError: (err) => notifyError(err, 'Failed to request settings change'),
  });

  async function uploadImage(file: File, field: 'loginLogoUrl' | 'faviconUrl', setBusy: (v: boolean) => void) {
    setBusy(true);
    try {
      const { url } = await apiUpload(file);
      setForm((f) => ({ ...f, [field]: url }));
    } catch (err) {
      notifyError(err, 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login page branding</CardTitle>
          <CardDescription>
            Platform-wide only — shown on the login page before anyone signs in, plus the browser-tab
            icon and the &quot;Built by&quot; watermark shown across the whole app. Never applies to
            an individual school&apos;s own branding. Leave a field blank to use the default shown as
            its placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Login logo</label>
            <div className="flex items-center gap-3">
              {form.loginLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.loginLogoUrl.startsWith('http') ? form.loginLogoUrl : `${API_ORIGIN}${form.loginLogoUrl}`}
                  alt="Login logo"
                  className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-amber-400 text-xs font-semibold text-emerald-950">
                  Default
                </span>
              )}
              <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                {uploadingLogo ? 'Uploading...' : 'Change logo'}
              </Button>
              {form.loginLogoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, loginLogoUrl: '' }))}>
                  Reset
                </Button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, 'loginLogoUrl', setUploadingLogo);
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Favicon (browser tab icon)</label>
            <div className="flex items-center gap-3">
              {form.faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.faviconUrl.startsWith('http') ? form.faviconUrl : `${API_ORIGIN}${form.faviconUrl}`}
                  alt="Favicon"
                  className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-500">
                  Default
                </span>
              )}
              <Button type="button" variant="outline" size="sm" disabled={uploadingFavicon} onClick={() => faviconInputRef.current?.click()}>
                {uploadingFavicon ? 'Uploading...' : 'Change favicon'}
              </Button>
              {form.faviconUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, faviconUrl: '' }))}>
                  Reset
                </Button>
              )}
            </div>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/x-icon,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, 'faviconUrl', setUploadingFavicon);
                e.target.value = '';
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">System name</label>
            <Input
              placeholder="School ERP"
              value={form.systemName}
              onChange={(e) => setForm((f) => ({ ...f, systemName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Login tagline</label>
            <Input
              placeholder="One place for every register, rubric and receipt."
              value={form.loginTagline}
              onChange={(e) => setForm((f) => ({ ...f, loginTagline: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Login subtitle</label>
            <Input
              placeholder="Kenyan CBC · PP1 — Grade 9"
              value={form.loginSubtitle}
              onChange={(e) => setForm((f) => ({ ...f, loginSubtitle: e.target.value }))}
            />
            <p className="text-xs text-slate-500">
              Small caps line under the tagline — e.g. &quot;Feel the difference&quot; or &quot;Value
              for your money&quot;.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Sign-in heading</label>
            <Input
              placeholder="Sign in"
              value={form.loginHeading}
              onChange={(e) => setForm((f) => ({ ...f, loginHeading: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Sign-in helper text</label>
            <Input
              placeholder="Enter your details to access your dashboard."
              value={form.loginHelperText}
              onChange={(e) => setForm((f) => ({ ...f, loginHelperText: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Login footer text</label>
            <Input
              placeholder="Multi-tenant SaaS for CBC schools — PP1 to Grade 9"
              value={form.loginFooterText}
              onChange={(e) => setForm((f) => ({ ...f, loginFooterText: e.target.value }))}
            />
            <p className="text-xs text-slate-500">Small line under the sign-in button, next to the shield icon.</p>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">&quot;Built by&quot; watermark</label>
            <Input
              placeholder="Built by Hamzone Technologies"
              value={form.builtByText}
              onChange={(e) => setForm((f) => ({ ...f, builtByText: e.target.value }))}
            />
            <p className="text-xs text-slate-500">Shown in the corner of every page across the whole app.</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => requestSave.mutate()} disabled={requestSave.isPending}>
          {requestSave.isPending ? 'Sending code...' : 'Save branding'}
        </Button>
      </div>
    </div>
  );
}

function TemplatesTab({
  templates,
  loading,
  onRequested,
  dataVersion,
}: {
  templates?: EffectiveTemplate[];
  loading: boolean;
  onRequested: OnRequested;
  dataVersion: number;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      {(templates ?? []).map((t) => (
        <TemplateRow
          // Remounts (resyncing subject/body from the server) only when our own confirmed save
          // bumps dataVersion — a background refetchInterval tick keeps the same key, so it never
          // clobbers an in-progress edit.
          key={`${t.key}-${dataVersion}`}
          template={t}
          open={openKey === t.key}
          onToggle={() => setOpenKey(openKey === t.key ? null : t.key)}
          onRequested={onRequested}
        />
      ))}
    </div>
  );
}

function TemplateRow({
  template,
  open,
  onToggle,
  onRequested,
}: {
  template: EffectiveTemplate;
  open: boolean;
  onToggle: () => void;
  onRequested: OnRequested;
}) {
  const [subject, setSubject] = useState(template.subject ?? '');
  const [emailBody, setEmailBody] = useState(template.emailBody ?? '');
  const [smsBody, setSmsBody] = useState(template.smsBody ?? '');
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!hasSynced.current) {
      hasSynced.current = true;
      setSubject(template.subject ?? '');
      setEmailBody(template.emailBody ?? '');
      setSmsBody(template.smsBody ?? '');
    }
  }, [template]);

  const requestSave = useMutation({
    mutationFn: () =>
      apiFetch<OtpRequestResult>('/platform/message-templates/request-update', {
        method: 'POST',
        body: JSON.stringify({ key: template.key, subject, emailBody, smsBody }),
      }),
    onSuccess: (result) =>
      onRequested(
        result,
        '/platform/message-templates/confirm-update',
        `Message template: ${TEMPLATE_LABELS[template.key] ?? template.key}`,
      ),
    onError: (err) => notifyError(err, 'Failed to request template change'),
  });

  const requestReset = useMutation({
    mutationFn: () =>
      apiFetch<OtpRequestResult>(`/platform/message-templates/${template.key}/request-reset`, { method: 'POST' }),
    onSuccess: (result) =>
      onRequested(
        result,
        '/platform/message-templates/confirm-update',
        `Reset to default: ${TEMPLATE_LABELS[template.key] ?? template.key}`,
      ),
    onError: (err) => notifyError(err, 'Failed to request template reset'),
  });

  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            {TEMPLATE_LABELS[template.key] ?? template.key}
          </span>
          <span className="block text-xs text-slate-500">{template.key}</span>
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            template.isCustomized ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500',
          )}
        >
          {template.isCustomized ? 'Customized' : 'Default'}
        </span>
      </button>

      {open && (
        <CardContent className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Available variables:{' '}
            {template.variables.map((v) => (
              <code key={v} className="mr-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">{`{{${v}}}`}</code>
            ))}
          </p>

          {'subject' in template && template.subject !== undefined && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Email subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}
          {template.emailBody !== undefined && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Email body</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">SMS body</label>
            <textarea
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => requestSave.mutate()} disabled={requestSave.isPending}>
              {requestSave.isPending ? 'Sending code...' : 'Save changes'}
            </Button>
            {template.isCustomized && (
              <Button
                type="button"
                variant="outline"
                onClick={() => requestReset.mutate()}
                disabled={requestReset.isPending}
              >
                {requestReset.isPending ? 'Sending code...' : 'Reset to default'}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
