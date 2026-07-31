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

const schema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase, hyphenated'),
  address: z.string().optional(),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2),
  adminPassword: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

export function CreateSchoolDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createSchool = useMutation({
    mutationFn: (values: FormValues) =>
      apiFetch('/platform/tenants', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: (_data, values) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      setOpen(false);
      notifySuccess(`${values.name} created`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create school');
      notifyError(err, 'Failed to create school');
    },
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ New school</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Create a new school</h2>
        <form
          onSubmit={handleSubmit((v) => {
            setError(null);
            createSchool.mutate(v);
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
          <Field label="Admin password" error={errors.adminPassword?.message}>
            <Input type="password" {...register('adminPassword')} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSchool.isPending}>
              {createSchool.isPending ? 'Creating...' : 'Create school'}
            </Button>
          </div>
        </form>
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
