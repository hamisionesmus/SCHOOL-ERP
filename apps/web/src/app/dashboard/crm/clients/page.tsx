'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;
const CLIENT_TYPES = ['INDIVIDUAL', 'SCHOOL', 'BUSINESS'] as const;

interface Client {
  id: string;
  name: string;
  type: string;
  productLines: string[];
  email: string | null;
  phone: string | null;
  domainActive: boolean | null;
  nextPaymentDueAt: string | null;
  tenant: { name: string } | null;
  _count: { invoices: number; notes: number };
}

function CreateClientDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof CLIENT_TYPES)[number]>('INDIVIDUAL');
  const [productLines, setProductLines] = useState<string[]>([]);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [systemUrl, setSystemUrl] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/crm/clients', {
        method: 'POST',
        body: JSON.stringify({ name, type, productLines, contactName: contactName || undefined, email: email || undefined, phone: phone || undefined, systemUrl: systemUrl || undefined }),
      }),
    onSuccess: () => {
      notifySuccess('Client added');
      setOpen(false);
      setName('');
      setProductLines([]);
      setContactName('');
      setEmail('');
      setPhone('');
      setSystemUrl('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to add client'),
  });

  function toggleLine(l: string) {
    setProductLines((lines) => (lines.includes(l) ? lines.filter((x) => x !== l) : [...lines, l]));
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Add Client
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Client</h3>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client / organisation name" />
          <select value={type} onChange={(e) => setType(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0]}
                {t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Product lines</p>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_LINES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLine(l)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    productLines.includes(l) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {l.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact person (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          </div>
          <Input value={systemUrl} onChange={(e) => setSystemUrl(e.target.value)} placeholder="Website/system URL (optional)" />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding...' : 'Add Client'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CrmClientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['crm-clients', page, search],
    queryFn: () => apiFetch<{ data: Client[]; meta: { total: number } }>(`/platform/crm/clients?page=${page}&pageSize=${pageSize}${search ? `&q=${encodeURIComponent(search)}` : ''}`),
  });

  const clients = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">Every Hamzone client, across every product line.</p>
        </div>
        <CreateClientDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['crm-clients'] })} />
      </header>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search clients..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : clients.length === 0 ? (
            <p className="text-sm text-slate-500">No clients yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Product Lines</th>
                    <th className="py-2 font-medium">Contact</th>
                    <th className="py-2 font-medium">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">
                        <Link href={`/dashboard/crm/clients/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                        {c.tenant && <div className="text-xs text-slate-400">ERP: {c.tenant.name}</div>}
                      </td>
                      <td className="py-2">
                        <Badge status={c.type} />
                      </td>
                      <td className="py-2 text-slate-500">{c.productLines.map((l) => l.replace(/_/g, ' ')).join(', ') || '—'}</td>
                      <td className="py-2 text-slate-500">
                        {c.email ?? '—'}
                        {c.phone && <div className="text-xs">{c.phone}</div>}
                      </td>
                      <td className="py-2 text-slate-500">{c._count.invoices}</td>
                    </tr>
                  ))}
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
