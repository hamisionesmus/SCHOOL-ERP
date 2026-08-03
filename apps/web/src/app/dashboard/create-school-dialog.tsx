'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { getSessionUser } from '@/lib/auth';
import { KENYA_COUNTIES } from '@/lib/kenya-counties';

const COUNTY_OPTIONS = KENYA_COUNTIES.map((c) => ({ value: c, label: c }));

const DEMO_DURATION_OPTIONS = [
  { label: '4 hours', hours: 4 },
  { label: '24 hours (1 day)', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '14 days', hours: 336 },
  { label: '30 days', hours: 720 },
];

const detailsSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase, hyphenated'),
  address: z.string().optional(),
  county: z.string().optional(),
  town: z.string().optional(),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2),
  adminPassword: z.string().min(8),
  adminPhone: z.string().min(9, 'Required — an OTP is sent here to verify the admin'),
  accountType: z.enum(['demo', 'real']),
  demoDurationHours: z.string().optional(),
  activationFeeKes: z
    .string()
    .optional()
    .refine((v) => !v || Number(v) > 0, 'Must be a positive amount'),
  activationBillingCycle: z.enum(['MONTHLY', 'HALF_YEARLY', 'YEARLY']).optional(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

interface RequestResult {
  requestId: string;
  expiresAt: string;
  devCode?: string;
  devAdminOtp?: string;
}

export function CreateSchoolDialog() {
  const isSubAdmin = getSessionUser()?.role === 'SUB_ADMIN';
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: RequestResult; name: string } | null>(null);
  const [code, setCode] = useState('');
  const [adminOtpCode, setAdminOtpCode] = useState('');
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { accountType: 'real', activationBillingCycle: 'MONTHLY' },
  });
  const accountType = watch('accountType');
  const isDemo = accountType === 'demo';
  const county = watch('county');

  const requestCreate = useMutation({
    mutationFn: (values: DetailsValues) =>
      apiFetch<RequestResult>('/platform/tenants/request', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug,
          address: values.address,
          county: values.county || undefined,
          town: values.town || undefined,
          adminEmail: values.adminEmail,
          adminFullName: values.adminFullName,
          adminPassword: values.adminPassword,
          adminPhone: values.adminPhone,
          isDemo,
          demoDurationHours: isDemo && values.demoDurationHours ? Number(values.demoDurationHours) : undefined,
          activationFeeKes: isDemo ? undefined : values.activationFeeKes ? Number(values.activationFeeKes) : undefined,
          activationBillingCycle: isDemo ? undefined : values.activationBillingCycle,
        }),
      }),
    onSuccess: (result, values) => {
      setPending({ result, name: values.name });
      setError(null);
      notifySuccess('Confirmation codes sent');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to start school creation');
      notifyError(err, 'Failed to start school creation');
    },
  });

  const confirmCreate = useMutation({
    mutationFn: () =>
      apiFetch('/platform/tenants/confirm', {
        method: 'POST',
        body: JSON.stringify({ requestId: pending!.result.requestId, code, adminOtpCode }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      setPending(null);
      setCode('');
      setAdminOtpCode('');
      setOpen(false);
      notifySuccess(`${pending!.name} created`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm');
      notifyError(err, 'Failed to confirm');
    },
  });

  function closeAll() {
    setOpen(false);
    setPending(null);
    setCode('');
    setAdminOtpCode('');
    setError(null);
    reset();
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ New school</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl animate-scale-in flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {!pending ? (
          <form
            onSubmit={handleSubmit((v) => {
              if (!isDemo && !v.activationFeeKes) {
                setError('Activation fee is required for a real account');
                return;
              }
              if (isDemo && !v.demoDurationHours) {
                setError('Demo duration is required');
                return;
              }
              setError(null);
              requestCreate.mutate(v);
            })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Create a new school</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="School name" error={errors.name?.message}>
                  <Input placeholder="Greenfield Academy" {...register('name')} />
                </Field>
                <Field label="Slug" error={errors.slug?.message}>
                  <Input placeholder="greenfield-academy" {...register('slug')} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Address (optional)">
                  <Input {...register('address')} />
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="County (optional)">
                  <SearchableSelect
                    options={COUNTY_OPTIONS}
                    value={county}
                    onChange={(v) => setValue('county', v)}
                    placeholder="Search counties..."
                  />
                </Field>
                <Field label="Town / city (optional)">
                  <Input placeholder="Kitengela" {...register('town')} />
                </Field>
              </div>

              <hr className="my-4 border-slate-200" />
              <p className="mb-3 text-xs font-medium uppercase text-slate-400">First School Administrator</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Admin full name" error={errors.adminFullName?.message}>
                  <Input {...register('adminFullName')} />
                </Field>
                <Field label="Admin email" error={errors.adminEmail?.message}>
                  <Input type="email" {...register('adminEmail')} />
                </Field>
                <Field label="Admin phone" error={errors.adminPhone?.message}>
                  <Input placeholder="0712345678" {...register('adminPhone')} />
                </Field>
                <Field label="Admin password" error={errors.adminPassword?.message}>
                  <PasswordInput {...register('adminPassword')} />
                </Field>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                An OTP is sent to the admin phone above to verify the number and their consent.
              </p>

              <hr className="my-4 border-slate-200" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Account type">
                  <select
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    {...register('accountType')}
                  >
                    <option value="real">Real account</option>
                    <option value="demo">Demo account</option>
                  </select>
                </Field>
                {isDemo ? (
                  <Field label="Demo duration" error={errors.demoDurationHours?.message}>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      {...register('demoDurationHours')}
                    >
                      <option value="">Select duration…</option>
                      {DEMO_DURATION_OPTIONS.map((o) => (
                        <option key={o.hours} value={o.hours}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Activation fee (KES)" error={errors.activationFeeKes?.message}>
                    <Input type="number" min={1} placeholder="5000" {...register('activationFeeKes')} />
                  </Field>
                )}
                {!isDemo && (
                  <Field label="Billing cycle">
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      {...register('activationBillingCycle')}
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="HALF_YEARLY">Half-yearly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </Field>
                )}
              </div>
              {!isDemo && (
                <p className="mt-1.5 text-xs text-slate-500">
                  The school pays this via M-Pesa, bank, or paybill before sign-in is unlocked.
                </p>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={closeAll}>
                Cancel
              </Button>
              <Button type="submit" disabled={requestCreate.isPending}>
                {requestCreate.isPending ? 'Sending codes...' : 'Send confirmation codes'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Confirm creation</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="mb-4 text-sm text-slate-500">
                {isSubAdmin ? (
                  <>
                    Two codes were sent — one to the platform&apos;s Super Admin (ask them for it),
                    and a separate OTP texted to <strong>{pending.name}</strong>&apos;s admin phone.
                    Enter both to create the school.
                  </>
                ) : (
                  <>
                    Two codes were sent — your own confirmation code (email + SMS), and a separate OTP
                    texted to <strong>{pending.name}</strong>&apos;s admin phone. Enter both to create
                    the school.
                  </>
                )}
              </p>
              {(pending.result.devCode || pending.result.devAdminOtp) && (
                <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Dev/test convenience: since real email isn&apos;t configured yet, the code(s) are
                  also shown here
                  {pending.result.devCode && (
                    <>
                      {' '}
                      — {isSubAdmin ? "Super Admin's" : 'your'} code <strong>{pending.result.devCode}</strong>
                    </>
                  )}
                  {pending.result.devAdminOtp && (
                    <>
                      , admin OTP <strong>{pending.result.devAdminOtp}</strong>
                    </>
                  )}
                  .
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={isSubAdmin ? "Super Admin's code" : 'Your confirmation code'}>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="482913" />
                </Field>
                <Field label="Admin's OTP code">
                  <Input
                    value={adminOtpCode}
                    onChange={(e) => setAdminOtpCode(e.target.value)}
                    maxLength={6}
                    placeholder="193742"
                  />
                </Field>
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={closeAll}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={code.length !== 6 || adminOtpCode.length !== 6 || confirmCreate.isPending}
                onClick={() => confirmCreate.mutate()}
              >
                {confirmCreate.isPending ? 'Creating...' : 'Confirm & create'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
