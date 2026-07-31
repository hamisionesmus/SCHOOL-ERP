'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, apiUpload, API_ORIGIN, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SchoolSettings {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
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
}

export default function SettingsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = user?.permissions?.includes('SETTINGS:MANAGE');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch<SchoolSettings>('/settings'),
    enabled: !!user,
  });

  const updateSettings = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: fd.get('name'),
          primaryColor: fd.get('primaryColor'),
          address: fd.get('address') || undefined,
          website: fd.get('website') || undefined,
          smsSenderId: fd.get('smsSenderId') || undefined,
          mission: fd.get('mission') || undefined,
          vision: fd.get('vision') || undefined,
          motto: fd.get('motto') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save settings'),
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
    },
    onError: (err) => {
      setUploading(false);
      setError(err instanceof ApiError ? err.message : 'Failed to upload logo');
    },
  });

  if (!user || isLoading || !settings) return null;

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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex items-center gap-4">
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
              <p className="mt-1 text-xs text-slate-400">JPG, PNG, or WEBP, up to 5MB.</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateSettings.mutate(new FormData(e.currentTarget));
            }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">School name</label>
              <Input name="name" defaultValue={settings.name} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Brand color</label>
              <input
                name="primaryColor"
                type="color"
                defaultValue={settings.primaryColor ?? '#2563eb'}
                className="h-10 w-full rounded-md border border-slate-300"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">SMS sender ID</label>
              <Input name="smsSenderId" defaultValue={settings.smsSenderId ?? ''} placeholder="SCHOOLNAME" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Address</label>
              <Input name="address" defaultValue={settings.address ?? ''} />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Website</label>
              <Input name="website" defaultValue={settings.website ?? ''} />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Motto</label>
              <Input name="motto" defaultValue={settings.motto ?? ''} placeholder="Excellence Through Character" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Mission</label>
              <textarea
                name="mission"
                defaultValue={settings.mission ?? ''}
                rows={2}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Vision</label>
              <textarea
                name="vision"
                defaultValue={settings.vision ?? ''}
                rows={2}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <p className="col-span-2 text-xs text-slate-500">
              Mission, vision, motto, and logo appear on downloadable student report cards.
            </p>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}
