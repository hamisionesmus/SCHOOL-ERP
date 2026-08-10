'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;
const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'] as const;

interface Lead {
  id: string;
  clientName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  interest: string;
  location: string | null;
  status: string;
  source: string;
  followUpAt: string | null;
  convertedToClientId: string | null;
  createdAt: string;
  submittedBy: { fullName: string } | null;
}

function SubmitLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [interest, setInterest] = useState<(typeof PRODUCT_LINES)[number]>('OTHER');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/crm/leads', {
        method: 'POST',
        body: JSON.stringify({
          clientName,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          interest,
          location: location || undefined,
          notes: notes || undefined,
          followUpAt: followUpAt || undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Lead submitted');
      setOpen(false);
      setClientName('');
      setContactPhone('');
      setContactEmail('');
      setLocation('');
      setNotes('');
      setFollowUpAt('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to submit lead'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Submit Lead
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Submit Lead</h3>
        <div className="space-y-3">
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Prospect's name / organisation" />
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" />
          <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email (optional)" />
          <select value={interest} onChange={(e) => setInterest(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {PRODUCT_LINES.map((l) => (
              <option key={l} value={l}>
                {l.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where you met them (optional)" />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Follow up on (optional)</label>
            <Input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!clientName.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CrmLeadsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['crm-leads', page],
    queryFn: () => apiFetch<{ data: Lead[]; meta: { total: number } }>(`/platform/crm/leads?page=${page}&pageSize=${pageSize}`),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/platform/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      notifySuccess('Lead updated');
    },
    onError: (err) => notifyError(err, 'Failed to update lead'),
  });

  const convert = useMutation({
    mutationFn: (id: string) => apiFetch<{ id: string }>(`/platform/crm/leads/${id}/convert`, { method: 'POST' }),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      notifySuccess('Converted to client');
      router.push(`/dashboard/crm/clients/${client.id}`);
    },
    onError: (err) => notifyError(err, 'Failed to convert lead'),
  });

  const leads = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Marketing Leads</h1>
          <p className="text-sm text-slate-500">Real-time leads submitted from the field — every admin is a marketer here.</p>
        </div>
        <SubmitLeadDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['crm-leads'] })} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : leads.length === 0 ? (
            <p className="text-sm text-slate-500">No leads yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Prospect</th>
                    <th className="py-2 font-medium">Interest</th>
                    <th className="py-2 font-medium">Contact</th>
                    <th className="py-2 font-medium">Follow up</th>
                    <th className="py-2 font-medium">Submitted by</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const followUpPast = l.followUpAt && new Date(l.followUpAt) < new Date();
                    return (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">
                        {l.clientName}
                        {l.location && <div className="text-xs text-slate-400">{l.location}</div>}
                      </td>
                      <td className="py-2 text-slate-500">{l.interest.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-slate-500">
                        {l.contactPhone ?? '—'}
                        {l.contactEmail && <div className="text-xs">{l.contactEmail}</div>}
                      </td>
                      <td className={`py-2 ${followUpPast ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
                        {l.followUpAt ? new Date(l.followUpAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 text-slate-500">
                        {l.submittedBy?.fullName ?? <span className="italic text-slate-400">Website (public form)</span>}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {l.status !== 'CONVERTED' && l.status !== 'LOST' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={convert.isPending}
                              onClick={() => convert.mutate(l.id)}
                            >
                              Convert to Client
                            </Button>
                          )}
                          <select
                            value={l.status}
                            onChange={(e) => updateStatus.mutate({ id: l.id, status: e.target.value })}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <Badge status={l.status} />
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPageChange={setPage} totalItems={total} pageSize={pageSize} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
