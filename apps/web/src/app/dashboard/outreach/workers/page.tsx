'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

interface Worker {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  deletedAt: string | null;
  createdAt: string;
}

function AddWorkerDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const create = useMutation({
    mutationFn: () => apiFetch('/platform/outreach/workers', { method: 'POST', body: JSON.stringify({ fullName, email, phone }) }),
    onSuccess: () => {
      notifySuccess('Account created — credentials sent');
      setOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to create account'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Add Worker
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Worker</h3>
        <div className="space-y-3">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!fullName.trim() || !email.trim() || !phone.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OutreachWorkersPage() {
  useRequireSuperAdmin();
  const queryClient = useQueryClient();
  const { data: workers, isLoading } = useQuery({ queryKey: ['outreach-workers'], queryFn: () => apiFetch<Worker[]>('/platform/outreach/workers') });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Outreach Workers</h1>
          <p className="text-sm text-slate-500">People you&apos;ve assigned outreach entries to — they log in and report their own earnings.</p>
        </div>
        <AddWorkerDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['outreach-workers'] })} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Workers</CardTitle>
          <CardDescription>Assign an entry to one of these from the Outreach page once created.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !workers || workers.length === 0 ? (
            <p className="text-sm text-slate-500">No workers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Phone</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{w.fullName}</td>
                    <td className="py-2 text-slate-500">{w.email}</td>
                    <td className="py-2 text-slate-500">{w.phone ?? '—'}</td>
                    <td className="py-2 text-slate-500">{w.deletedAt ? 'Inactive' : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
