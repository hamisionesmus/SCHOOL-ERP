'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformSettings {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  paybillNumber: string | null;
  paybillAccountName: string | null;
}

export default function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>({
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    paybillNumber: '',
    paybillAccountName: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => apiFetch<PlatformSettings>('/platform/settings'),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch('/platform/settings', { method: 'PATCH', body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      notifySuccess('Payment settings saved');
    },
    onError: (err) => notifyError(err, 'Failed to save payment settings'),
  });

  function field(key: keyof PlatformSettings) {
    return {
      value: form[key] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payment Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Where schools send money when they pay their activation fee by Bank transfer or Paybill instead
          of M-Pesa STK push. Shown on the public activation page.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
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
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Saving...' : 'Save payment settings'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
