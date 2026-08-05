'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

const SCOPES = ['training:read', 'clients:read', 'documents:read', 'leads:write', 'jobs:read', 'jobs:apply'] as const;

interface ApiKey {
  id: string;
  label: string;
  keyPreview: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { fullName: string };
}

export default function CrmApiKeysPage() {
  useRequireSuperAdmin();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-api-keys'],
    queryFn: () => apiFetch<ApiKey[]>('/platform/crm/api-keys'),
  });

  const create = useMutation({
    mutationFn: () => apiFetch<{ key: string }>('/platform/crm/api-keys', { method: 'POST', body: JSON.stringify({ label, scopes }) }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-api-keys'] });
      setNewKey(result.key);
      setLabel('');
      setScopes([]);
    },
    onError: (err) => notifyError(err, 'Failed to create API key'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/crm/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-api-keys'] });
      notifySuccess('API key revoked');
      setRevokeTarget(null);
    },
    onError: (err) => notifyError(err, 'Failed to revoke key'),
  });

  function toggleScope(s: string) {
    setScopes((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  }

  const keys = data ?? [];

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">API Keys</h1>
        <p className="text-sm text-slate-500">
          Let the Hamzone Technologies website (or any other third-party system) pull select CRM data via <code>X-API-Key</code>,
          without a login session.
        </p>
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Create a key</CardTitle>
          <CardDescription>Pick only the scopes this integration actually needs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Company website)" className="max-w-xs" />
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleScope(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  scopes.includes(s) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button disabled={!label.trim() || scopes.length === 0 || create.isPending} onClick={() => create.mutate()} className="gap-1.5">
            <Plus size={14} /> {create.isPending ? 'Creating...' : 'Create key'}
          </Button>
        </CardContent>
      </Card>

      {newKey && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="mb-2 text-sm font-medium text-amber-900">Copy this key now — it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-3 py-2 text-sm">{newKey}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  notifySuccess('Copied');
                }}
              >
                <Copy size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-slate-500">No API keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Label</th>
                  <th className="py-2 font-medium">Key</th>
                  <th className="py-2 font-medium">Scopes</th>
                  <th className="py-2 font-medium">Last used</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      {k.label}
                      {k.revokedAt && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">REVOKED</span>}
                    </td>
                    <td className="py-2 text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <KeyRound size={12} /> {k.keyPreview}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">{k.scopes.join(', ')}</td>
                    <td className="py-2 text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                    <td className="py-2 text-right">
                      {!k.revokedAt && (
                        <Button size="sm" variant="destructive" onClick={() => setRevokeTarget(k)} className="gap-1">
                          <Trash2 size={12} /> Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!revokeTarget}
        title={`Revoke "${revokeTarget?.label}"?`}
        description="Any system using this key will immediately lose access. This cannot be undone."
        tone="danger"
        confirmLabel="Revoke"
        loading={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
        onCancel={() => setRevokeTarget(null)}
      />
    </>
  );
}
