'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

interface Admin {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'SUB_ADMIN';
  deletedAt: string | null;
  createdAt: string;
}

interface RequestResult {
  requestId: string;
  expiresAt: string;
  devCode?: string;
}

export default function AdminsPage() {
  useRequireSuperAdmin();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const adminsQuery = useQuery({
    queryKey: ['platform-admins'],
    queryFn: () => apiFetch<Admin[]>('/platform/admins'),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/admins/${id}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      notifySuccess('Admin deactivated');
    },
    onError: (err) => notifyError(err, 'Failed to deactivate admin'),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/admins/${id}/reactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      notifySuccess('Admin reactivated');
    },
    onError: (err) => notifyError(err, 'Failed to reactivate admin'),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admins</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sub-Admins can create schools and view revenue, but not Security, Backups, Audit Logs,
            or Platform Settings. Inviting one requires your own confirmation code.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Invite Sub-Admin</Button>
      </div>

      {adminsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(adminsQuery.data ?? []).map((admin) => (
                <tr key={admin.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/dashboard/admins/${admin.id}`} className="hover:underline">
                      {admin.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{admin.email}</td>
                  <td className="px-4 py-3 text-slate-600">{admin.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge status={admin.role} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={admin.deletedAt ? 'SUSPENDED' : 'ACTIVE'} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {admin.deletedAt ? (
                      <Button size="sm" variant="outline" onClick={() => reactivate.mutate(admin.id)}>
                        Reactivate
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => deactivate.mutate(admin.id)}>
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <InviteAdminDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function InviteAdminDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState<RequestResult | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requestCreate = useMutation({
    mutationFn: () =>
      apiFetch<RequestResult>('/platform/admins/request-create', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, phone }),
      }),
    onSuccess: (result) => {
      setPending(result);
      setError(null);
      notifySuccess('Confirmation code sent to you');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to invite admin');
      notifyError(err, 'Failed to invite admin');
    },
  });

  const confirmCreate = useMutation({
    mutationFn: () =>
      apiFetch('/platform/admins/confirm-create', {
        method: 'POST',
        body: JSON.stringify({ requestId: pending!.requestId, code }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      notifySuccess(`${fullName} added as a Sub-Admin`);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm');
      notifyError(err, 'Failed to confirm');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-scale-in rounded-xl bg-white shadow-2xl">
        {!pending ? (
          <>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Invite a Sub-Admin</h2>
            </div>
            <div className="flex flex-col gap-3 px-6 py-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Full name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Phone</label>
                <Input placeholder="0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!fullName || !email || !phone || requestCreate.isPending}
                onClick={() => requestCreate.mutate()}
              >
                {requestCreate.isPending ? 'Sending code...' : 'Send confirmation code'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Confirm invite</h2>
            </div>
            <div className="px-6 py-4">
              <p className="mb-4 text-sm text-slate-500">
                A confirmation code was sent to your own email and phone. Enter it to add{' '}
                <strong>{fullName}</strong> as a Sub-Admin.
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
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={code.length !== 6 || confirmCreate.isPending}
                onClick={() => confirmCreate.mutate()}
              >
                {confirmCreate.isPending ? 'Confirming...' : 'Confirm & invite'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
