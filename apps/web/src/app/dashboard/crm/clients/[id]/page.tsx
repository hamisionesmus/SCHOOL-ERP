'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';

interface ClientDetail {
  id: string;
  name: string;
  type: string;
  productLines: string[];
  contactName: string | null;
  email: string | null;
  phone: string | null;
  systemUrl: string | null;
  domainActive: boolean | null;
  nextPaymentDueAt: string | null;
  tenant: { name: string; slug: string } | null;
  createdBy: { fullName: string } | null;
  notes: { id: string; body: string; createdAt: string; author: { fullName: string } }[];
  invoices: { id: string; invoiceNumber: string; total: number; status: string; dueDate: string }[];
  trainingRecords: { id: string; traineeName: string; track: string; status: string }[];
}

export default function CrmClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [noteBody, setNoteBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['crm-client', id],
    queryFn: () => apiFetch<ClientDetail>(`/platform/crm/clients/${id}`),
  });

  const addNote = useMutation({
    mutationFn: () => apiFetch(`/platform/crm/clients/${id}/notes`, { method: 'POST', body: JSON.stringify({ body: noteBody }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-client', id] });
      setNoteBody('');
      notifySuccess('Note added');
    },
    onError: (err) => notifyError(err, 'Failed to add note'),
  });

  if (isLoading || !data) return <SkeletonCard />;

  return (
    <>
      <header className="mb-6">
        <button onClick={() => router.push('/dashboard/crm/clients')} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft size={13} /> Back to clients
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{data.name}</h1>
            <p className="text-sm text-slate-500">
              <Badge status={data.type} /> {data.productLines.map((l) => l.replace(/_/g, ' ')).join(', ')}
            </p>
          </div>
          <Button onClick={() => router.push(`/dashboard/crm/invoices?clientId=${id}`)} className="gap-1.5">
            <Plus size={15} /> New Invoice
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-slate-500">Contact:</span> {data.contactName ?? '—'}</p>
              <p><span className="text-slate-500">Email:</span> {data.email ?? '—'}</p>
              <p><span className="text-slate-500">Phone:</span> {data.phone ?? '—'}</p>
              <p><span className="text-slate-500">System URL:</span> {data.systemUrl ?? '—'}</p>
              {data.tenant && (
                <p>
                  <span className="text-slate-500">School-ERP tenant:</span> {data.tenant.name} ({data.tenant.slug})
                </p>
              )}
              {data.nextPaymentDueAt && (
                <p>
                  <span className="text-slate-500">Next payment due:</span> {new Date(data.nextPaymentDueAt).toLocaleDateString()}
                </p>
              )}
              {data.createdBy && <p className="text-xs text-slate-400">Added by {data.createdBy.fullName}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Log a call, meeting, promise, or agreement..."
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
              <Button size="sm" disabled={!noteBody.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                {addNote.isPending ? 'Saving...' : 'Add note'}
              </Button>
              <div className="space-y-3 border-t border-slate-100 pt-3">
                {data.notes.length === 0 ? (
                  <p className="text-xs text-slate-400">No notes yet.</p>
                ) : (
                  data.notes.map((n) => (
                    <div key={n.id} className="text-sm">
                      <p className="text-slate-700">{n.body}</p>
                      <p className="text-xs text-slate-400">
                        {n.author.fullName} · {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {data.invoices.length === 0 ? (
                <p className="text-sm text-slate-500">No invoices yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 font-medium">Number</th>
                      <th className="py-2 font-medium">Total</th>
                      <th className="py-2 font-medium">Status</th>
                      <th className="py-2 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2 text-slate-500">KES {inv.total.toLocaleString()}</td>
                        <td className="py-2">
                          <Badge status={inv.status} />
                        </td>
                        <td className="py-2 text-slate-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Training</CardTitle>
            </CardHeader>
            <CardContent>
              {data.trainingRecords.length === 0 ? (
                <p className="text-sm text-slate-500">No training records linked to this client.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 font-medium">Trainee</th>
                      <th className="py-2 font-medium">Track</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trainingRecords.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium text-slate-900">{t.traineeName}</td>
                        <td className="py-2 text-slate-500">{t.track.replace(/_/g, ' ')}</td>
                        <td className="py-2">
                          <Badge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
