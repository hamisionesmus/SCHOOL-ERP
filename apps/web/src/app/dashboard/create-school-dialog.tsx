'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';

const detailsSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase, hyphenated'),
  address: z.string().optional(),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2),
  adminPassword: z.string().min(8),
  adminPhone: z.string().optional(),
  isDemo: z.boolean().optional(),
  demoDurationHours: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1), 'Must be a whole number of hours'),
});
type DetailsValues = z.infer<typeof detailsSchema>;

interface RequestResult {
  requestId: string;
  expiresAt: string;
  devCode: string;
}

export function CreateSchoolDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: RequestResult; name: string } | null>(null);
  const [code, setCode] = useState('');
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema) });
  const isDemo = watch('isDemo');

  const requestCreate = useMutation({
    mutationFn: (values: DetailsValues) =>
      apiFetch<RequestResult>('/platform/tenants/request', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          demoDurationHours: values.demoDurationHours ? Number(values.demoDurationHours) : undefined,
        }),
      }),
    onSuccess: (result, values) => {
      setPending({ result, name: values.name });
      setError(null);
      notifySuccess('Confirmation code sent to your email');
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
        body: JSON.stringify({ requestId: pending!.result.requestId, code }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      setPending(null);
      setCode('');
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
    setError(null);
    reset();
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ New school</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-md animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
        {!pending ? (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Create a new school</h2>
            <form
              onSubmit={handleSubmit((v) => {
                setError(null);
                requestCreate.mutate(v);
              })}
              className="flex flex-col gap-3"
            >
              <Field label="School name" error={errors.name?.message}>
                <Input placeholder="Greenfield Academy" {...register('name')} />
              </Field>
              <Field label="Slug" error={errors.slug?.message}>
                <Input placeholder="greenfield-academy" {...register('slug')} />
              </Field>
              <Field label="Address (optional)">
                <Input {...register('address')} />
              </Field>
              <hr className="my-1 border-slate-200" />
              <p className="text-xs font-medium uppercase text-slate-400">First School Administrator</p>
              <Field label="Admin full name" error={errors.adminFullName?.message}>
                <Input {...register('adminFullName')} />
              </Field>
              <Field label="Admin email" error={errors.adminEmail?.message}>
                <Input type="email" {...register('adminEmail')} />
              </Field>
              <Field label="Admin phone (optional, for demo SMS)">
                <Input placeholder="+2547..." {...register('adminPhone')} />
              </Field>
              <Field label="Admin password" error={errors.adminPassword?.message}>
                <Input type="password" {...register('adminPassword')} />
              </Field>
              <hr className="my-1 border-slate-200" />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isDemo')} />
                Create as a demo account
              </label>
              {isDemo && (
                <Field label="Demo duration (hours)" error={errors.demoDurationHours?.message}>
                  <Input type="number" min={1} placeholder="24" {...register('demoDurationHours')} />
                </Field>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeAll}>
                  Cancel
                </Button>
                <Button type="submit" disabled={requestCreate.isPending}>
                  {requestCreate.isPending ? 'Sending code...' : 'Send confirmation code'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Confirm creation</h2>
            <p className="mb-4 text-sm text-slate-500">
              A 6-digit code was emailed to your Super Admin account — enter it below to actually create{' '}
              <strong>{pending.name}</strong>. This exists so nobody can create a school on your account
              without you confirming.
            </p>
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Dev/test convenience: since this environment has no real email gateway, the code is also
              shown here — <strong>{pending.result.devCode}</strong>.
            </p>
            <Field label="6-digit code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                placeholder="482913"
              />
            </Field>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeAll}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={code.length !== 6 || confirmCreate.isPending}
                onClick={() => confirmCreate.mutate()}
              >
                {confirmCreate.isPending ? 'Creating...' : 'Confirm & create'}
              </Button>
            </div>
          </>
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
