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

interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'SUB_ADMIN' | 'ASSISTANT_SUPER_ADMIN';
  avatarUrl: string | null;
  contactEmail: string | null;
}

interface OtpRequestResult {
  requestId: string;
  expiresAt: string;
  devCode?: string;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', contactEmail: '' });
  const [pending, setPending] = useState<OtpRequestResult | null>(null);
  const [code, setCode] = useState('');

  const profileQuery = useQuery({
    queryKey: ['platform-me'],
    queryFn: () => apiFetch<Profile>('/platform/me'),
  });

  // Only sync the form from the first fetch, or right after our own save invalidates the query
  // (see confirmUpdate.onSuccess below) — not from every background refetchInterval tick, which
  // would otherwise silently overwrite whatever the user is mid-typing every 30s.
  const hasSyncedForm = useRef(false);
  useEffect(() => {
    if (profileQuery.data && !hasSyncedForm.current) {
      hasSyncedForm.current = true;
      setForm({
        fullName: profileQuery.data.fullName,
        phone: profileQuery.data.phone ?? '',
        email: profileQuery.data.email,
        contactEmail: profileQuery.data.contactEmail ?? '',
      });
    }
  }, [profileQuery.data]);

  const requestUpdate = useMutation({
    mutationFn: () => {
      // contactEmail is the only truly optional field here — omit it entirely when blank rather
      // than sending an empty string, which would fail the DTO's @IsEmail() validator.
      const { contactEmail, ...rest } = form;
      const payload: Record<string, string> = { ...rest };
      if (contactEmail) payload.contactEmail = contactEmail;
      return apiFetch<OtpRequestResult>('/platform/me/request-update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (result) => {
      setPending(result);
      setCode('');
      notifySuccess('Confirmation code sent to your current email/phone');
    },
    onError: (err) => notifyError(err, 'Failed to request profile change'),
  });

  const confirmUpdate = useMutation({
    mutationFn: () =>
      apiFetch('/platform/me/confirm-update', {
        method: 'POST',
        body: JSON.stringify({ requestId: pending!.requestId, code }),
      }),
    onSuccess: () => {
      hasSyncedForm.current = false;
      queryClient.invalidateQueries({ queryKey: ['platform-me'] });
      setPending(null);
      setCode('');
      notifySuccess('Profile updated');
    },
    onError: (err) => notifyError(err, 'Failed to confirm profile change'),
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your own account only — name, phone, and email changes need a confirmation code sent to
          your current contact details.
        </p>
      </div>

      {profileQuery.data && <AvatarCard profile={profileQuery.data} />}

      {profileQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account details</CardTitle>
            <CardDescription>
              {profileQuery.data?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Sub-Admin'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Full name</label>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            {profileQuery.data?.role !== 'SUPER_ADMIN' && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Contact email (for messaging Billing/Partnerships/Info)
                </label>
                <Input
                  type="email"
                  placeholder={form.email || 'defaults to your login email above'}
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                />
                <p className="text-xs text-slate-500">
                  When you contact the platform team from the Inbox, this is the address your
                  message appears to come from, and where replies go. Leave blank to use your login
                  email above.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <Button onClick={() => requestUpdate.mutate()} disabled={requestUpdate.isPending}>
          {requestUpdate.isPending ? 'Sending code...' : 'Save changes'}
        </Button>
      </div>

      <ChangePasswordCard />

      {pending && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-scale-in rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Confirm profile change</h2>
            </div>
            <div className="px-6 py-4">
              <p className="mb-4 text-sm text-slate-500">
                A 6-digit code was sent to your current email and phone. Enter it to apply this change.
              </p>
              {pending.devCode && (
                <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Dev/test convenience: since real email isn&apos;t configured yet, the code is also
                  shown here — <strong>{pending.devCode}</strong>.
                </p>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Confirmation code</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="482913" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={code.length !== 6 || confirmUpdate.isPending}
                onClick={() => confirmUpdate.mutate()}
              >
                {confirmUpdate.isPending ? 'Confirming...' : 'Confirm & save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function AvatarCard({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const { url } = await apiUpload(file);
      return apiFetch('/platform/me/avatar', { method: 'POST', body: JSON.stringify({ avatarUrl: url }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-me'] });
      setUploading(false);
      notifySuccess('Profile photo updated');
    },
    onError: (err) => {
      setUploading(false);
      notifyError(err, 'Failed to upload photo');
    },
  });

  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_ORIGIN}${profile.avatarUrl}`}
            alt="Profile photo"
            className="h-16 w-16 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
            {initials(profile.fullName)}
          </span>
        )}
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : 'Change photo'}
          </Button>
          <p className="text-xs text-slate-500">JPG, PNG, or WEBP. Up to 5MB.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar.mutate(file);
            e.target.value = '';
          }}
        />
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: () =>
      apiFetch('/platform/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notifySuccess('Password changed');
    },
    onError: (err) => notifyError(err, 'Failed to change password'),
  });

  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Requires your current password — no confirmation code needed.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Current password</label>
          <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">New password</label>
          <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Confirm new password</label>
          <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          {mismatch && <p className="text-xs text-red-600">Passwords don&apos;t match</p>}
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button
          onClick={() => changePassword.mutate()}
          disabled={!currentPassword || !newPassword || mismatch || changePassword.isPending}
        >
          {changePassword.isPending ? 'Changing...' : 'Change password'}
        </Button>
      </div>
    </Card>
  );
}
