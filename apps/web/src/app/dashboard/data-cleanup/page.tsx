'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'TRIAL' | 'PENDING_PAYMENT' | 'ACTIVE' | 'SUSPENDED';
  isDemo: boolean;
  isTest: boolean;
  createdAt: string;
}

interface SystemResetRequest {
  requestId: string;
  expiresAt: string;
  devCode?: string;
  affectedCount: number;
  keptTenantName?: string;
}

const RESTART_PHRASE = 'RESTART SYSTEM';

export default function DataCleanupPage() {
  useRequireSuperAdmin();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [keepTenantId, setKeepTenantId] = useState('');
  const [restartPhrase, setRestartPhrase] = useState('');
  const [resetRequest, setResetRequest] = useState<SystemResetRequest | null>(null);
  const [resetCode, setResetCode] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tenants-cleanup'],
    queryFn: () => apiFetch<{ data: Tenant[] }>('/platform/tenants?pageSize=200'),
  });
  const tenants = data?.data ?? [];

  const markTest = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/tenants/${id}/mark-test`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants-cleanup'] });
      notifySuccess('Marked as test data — now eligible for deletion below');
    },
    onError: (err) => notifyError(err, 'Failed to reclassify school'),
  });

  const bulkDelete = useMutation({
    mutationFn: () => apiFetch<{ id: string; deleted: boolean; error?: string }[]>('/platform/tenants/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selected }),
    }),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['tenants-cleanup'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      const okCount = results.filter((r) => r.deleted).length;
      const failed = results.filter((r) => !r.deleted);
      if (failed.length === 0) {
        notifySuccess(`Deleted ${okCount} school${okCount === 1 ? '' : 's'}`);
      } else {
        notifyError(undefined, `Deleted ${okCount}, ${failed.length} failed: ${failed.map((f) => f.error).join('; ')}`);
      }
      setSelected([]);
      setShowConfirm(false);
      setConfirmText('');
    },
    onError: (err) => {
      notifyError(err, 'Bulk delete failed');
      setShowConfirm(false);
    },
  });

  const requestReset = useMutation({
    mutationFn: () =>
      apiFetch<SystemResetRequest>('/platform/tenants/request-system-reset', {
        method: 'POST',
        body: JSON.stringify({ keepTenantId: keepTenantId || undefined }),
      }),
    onSuccess: (result) => {
      setResetRequest(result);
      setResetCode('');
      notifySuccess('Confirmation code sent to your email and phone');
    },
    onError: (err) => notifyError(err, 'Failed to start system reset'),
  });

  const confirmReset = useMutation({
    mutationFn: () =>
      apiFetch<{ deletedCount: number }>('/platform/tenants/confirm-system-reset', {
        method: 'POST',
        body: JSON.stringify({ requestId: resetRequest!.requestId, code: resetCode }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenants-cleanup'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      notifySuccess(`System restarted — ${result.deletedCount} school${result.deletedCount === 1 ? '' : 's'} deleted`);
      setResetRequest(null);
      setResetCode('');
      setRestartPhrase('');
      setKeepTenantId('');
    },
    onError: (err) => notifyError(err, 'Failed to confirm system reset'),
  });

  const testTenants = tenants.filter((t) => t.isTest);
  const otherTenants = tenants.filter((t) => !t.isTest);
  const resetAffectedCount = tenants.length - (keepTenantId ? 1 : 0);

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Data Cleanup</h1>
        <p className="text-sm text-slate-500">
          Permanently remove dummy/demo schools before onboarding real ones. Deletion only ever applies to schools flagged{' '}
          <strong>Test</strong> — reclassify a school below first if it needs to go.
        </p>
      </header>

      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Deleting a school is permanent — it removes its schema, uploads, invoices, and every other record tied to it. This
            cannot be undone. It never affects any other school or the platform itself.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Not yet marked as test data</CardTitle>
          <CardDescription>
            These schools were created as Demo or Real accounts. If any of them are actually dummy data, mark them as Test
            first — that&apos;s a reversible label change, not a deletion — then delete them from the list below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : otherTenants.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing here — every school is either already Test-flagged or you have none yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {otherTenants.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      <Link href={`/dashboard/schools/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="py-2">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-2 text-slate-500">{t.isDemo ? 'Demo' : 'Real'}</td>
                    <td className="py-2 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" disabled={markTest.isPending} onClick={() => markTest.mutate(t.id)}>
                        Mark as test data
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Test data — eligible for deletion</CardTitle>
            <CardDescription>Select any of these and delete them permanently.</CardDescription>
          </div>
          <Button variant="destructive" size="sm" disabled={selected.length === 0} onClick={() => setShowConfirm(true)} className="gap-1.5">
            <Trash2 size={14} /> Delete selected ({selected.length})
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : testTenants.length === 0 ? (
            <p className="text-sm text-slate-500">No test-flagged schools yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2" />
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {testTenants.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4" />
                    </td>
                    <td className="py-2 font-medium text-slate-900">{t.name}</td>
                    <td className="py-2">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-2 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-rose-300 bg-rose-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-900">
            <RotateCcw size={16} /> Restart the system
          </CardTitle>
          <CardDescription className="text-rose-700">
            While the system is still in testing, none of the schools or people in it are real. When you&apos;re ready to
            start onboarding real schools, use this to wipe every school — Test, Demo, and Real alike — and begin with a
            clean slate. Optionally keep one school around for ongoing testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Keep one school for ongoing testing (optional)</label>
            <select
              value={keepTenantId}
              onChange={(e) => setKeepTenantId(e.target.value)}
              className="mt-1.5 h-10 w-full max-w-sm rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">None — delete every school</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm font-medium text-rose-800">
            This will permanently delete {resetAffectedCount} of {tenants.length} school{tenants.length === 1 ? '' : 's'}
            {keepTenantId && tenants.find((t) => t.id === keepTenantId) ? ` — keeping "${tenants.find((t) => t.id === keepTenantId)!.name}"` : ''}.
          </p>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Type <strong>{RESTART_PHRASE}</strong> to continue
            </label>
            <Input
              className="mt-1.5 max-w-sm"
              value={restartPhrase}
              onChange={(e) => setRestartPhrase(e.target.value)}
              placeholder={RESTART_PHRASE}
            />
          </div>

          <Button
            variant="destructive"
            disabled={restartPhrase !== RESTART_PHRASE || tenants.length === 0 || requestReset.isPending}
            onClick={() => requestReset.mutate()}
            className="gap-1.5"
          >
            <RotateCcw size={14} /> {requestReset.isPending ? 'Sending code...' : 'Send confirmation code'}
          </Button>
        </CardContent>
      </Card>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete {selected.length} school{selected.length === 1 ? '' : 's'}?
            </h3>
            <p className="mt-1.5 text-sm text-slate-500">
              This permanently removes their data, schemas, and uploads. This cannot be undone. Type <strong>DELETE</strong> below
              to confirm.
            </p>
            <Input className="mt-4" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)} disabled={bulkDelete.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={confirmText !== 'DELETE' || bulkDelete.isPending}
                onClick={() => bulkDelete.mutate()}
              >
                {bulkDelete.isPending ? 'Deleting...' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {resetRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Confirm system restart</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              This will permanently delete <strong>{resetRequest.affectedCount}</strong> school
              {resetRequest.affectedCount === 1 ? '' : 's'}
              {resetRequest.keptTenantName ? ` — keeping "${resetRequest.keptTenantName}"` : ''}. A 6-digit confirmation code
              was sent to your email and phone. Enter it below to proceed — this cannot be undone.
            </p>
            {resetRequest.devCode && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-left text-xs text-amber-700">
                Dev/test convenience: since real email isn&apos;t configured yet, the code is also shown here —{' '}
                <strong>{resetRequest.devCode}</strong>.
              </p>
            )}
            <Input
              className="mt-4"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              maxLength={6}
              placeholder="482913"
            />
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setResetRequest(null);
                  setResetCode('');
                }}
                disabled={confirmReset.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={resetCode.length !== 6 || confirmReset.isPending}
                onClick={() => confirmReset.mutate()}
              >
                {confirmReset.isPending ? 'Restarting...' : 'Restart permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
