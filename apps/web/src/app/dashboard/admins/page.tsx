'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, Users, Crown, Shield } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';
import { useDraftState } from '@/hooks/use-draft-state';

interface Admin {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ASSISTANT_SUPER_ADMIN' | 'SUB_ADMIN';
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  deletedAt: string | null;
  createdAt: string;
}

interface AdminsAnalytics {
  total: number;
  byRole: { SUPER_ADMIN: number; ASSISTANT_SUPER_ADMIN: number; SUB_ADMIN: number };
  byGender: { MALE: number; FEMALE: number; OTHER: number; UNSPECIFIED: number };
}

interface RequestResult {
  requestId: string;
  expiresAt: string;
  devCode?: string;
}

const ROLE_LABELS: Record<Admin['role'], string> = {
  SUPER_ADMIN: 'Super Admin',
  ASSISTANT_SUPER_ADMIN: 'Assistant Super Admin',
  SUB_ADMIN: 'Sub-Admin',
};

export default function AdminsPage() {
  useRequireSuperAdmin('ADMINS');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const adminsQuery = useQuery({
    queryKey: ['platform-admins', search],
    queryFn: () => apiFetch<Admin[]>(`/platform/admins${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  });

  const analyticsQuery = useQuery({
    queryKey: ['platform-admins-analytics'],
    queryFn: () => apiFetch<AdminsAnalytics>('/platform/analytics/admins'),
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
            Sub-Admins handle school creation. Assistant Super Admins additionally record finance
            entries. Only the real Super Admin touches Security, Backups, Tickets, and Platform
            Settings. Inviting anyone requires your own confirmation code.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Invite Admin</Button>
      </div>

      {analyticsQuery.data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total admins" value={analyticsQuery.data.total} icon={Users} accent="slate" />
          <StatCard label="Assistant Super Admins" value={analyticsQuery.data.byRole.ASSISTANT_SUPER_ADMIN} icon={Crown} accent="violet" />
          <StatCard label="Sub-Admins" value={analyticsQuery.data.byRole.SUB_ADMIN} icon={Shield} accent="blue" />
          <StatCard label="Male / Female" value={analyticsQuery.data.byGender.MALE} suffix={` / ${analyticsQuery.data.byGender.FEMALE}`} icon={Users} accent="emerald" />
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-8"
        />
      </div>

      {adminsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (adminsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">No admins match &quot;{search}&quot;.</p>
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
                    <Badge status={admin.role}>{ROLE_LABELS[admin.role]}</Badge>
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

type InviteAdminDraft = {
  fullName: string;
  email: string;
  phone: string;
  role: 'SUB_ADMIN' | 'ASSISTANT_SUPER_ADMIN';
  gender: '' | 'MALE' | 'FEMALE' | 'OTHER';
};

function InviteAdminDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { loadDraft, saveDraft, clearDraft } = useDraftState<InviteAdminDraft>('invite-admin');
  const draft = loadDraft();
  const [fullName, setFullName] = useState(draft?.fullName ?? '');
  const [email, setEmail] = useState(draft?.email ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? '');
  const [role, setRole] = useState<'SUB_ADMIN' | 'ASSISTANT_SUPER_ADMIN'>(draft?.role ?? 'SUB_ADMIN');
  const [gender, setGender] = useState<'' | 'MALE' | 'FEMALE' | 'OTHER'>(draft?.gender ?? '');
  const [pending, setPending] = useState<RequestResult | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveDraft({ fullName, email, phone, role, gender });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, email, phone, role, gender]);

  const requestCreate = useMutation({
    mutationFn: () =>
      apiFetch<RequestResult>('/platform/admins/request-create', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, phone, role, gender: gender || undefined }),
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
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admins-analytics'] });
      notifySuccess(`${fullName} added as ${ROLE_LABELS[role]}`);
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
              <h2 className="text-lg font-semibold text-slate-900">Invite an admin</h2>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'SUB_ADMIN' | 'ASSISTANT_SUPER_ADMIN')}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <option value="SUB_ADMIN">Sub-Admin (school creation)</option>
                    <option value="ASSISTANT_SUPER_ADMIN">Assistant Super Admin (finance + schools)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Gender (optional)</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as typeof gender)}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <option value="">Not specified</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
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
                <strong>{fullName}</strong> as {ROLE_LABELS[role]}.
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
