'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Send } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { SearchableSelect } from '@/components/ui/searchable-select';

const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;

interface Invoice {
  id: string;
  invoiceNumber: string;
  productLine: string;
  purpose: string | null;
  description: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: string;
  dueDate: string;
  emailSentAt: string | null;
  smsSentAt: string | null;
  emailStatus: string;
  smsStatus: string;
  emailError: string | null;
  smsError: string | null;
  client: { name: string; email: string | null; phone: string | null };
}

function DeliveryBadges({ inv }: { inv: Invoice }) {
  const parts: { label: string; status: string; error: string | null }[] = [];
  if (inv.client.email) parts.push({ label: 'Email', status: inv.emailStatus, error: inv.emailError });
  if (inv.client.phone) parts.push({ label: 'SMS', status: inv.smsStatus, error: inv.smsError });
  if (parts.length === 0) return <span className="text-xs text-slate-400">No contact on file</span>;
  return (
    <div className="flex flex-col gap-1">
      {parts.map((p) => (
        <div key={p.label} className="flex items-center gap-1.5" title={p.error ?? undefined}>
          <span className="text-xs text-slate-400">{p.label}:</span>
          <Badge status={p.status} className="text-[10px]">
            {p.status === 'PENDING' ? 'Not sent yet' : p.status === 'SKIPPED' ? 'Channel disabled' : p.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}

interface ClientOption {
  id: string;
  name: string;
}

function CreateInvoiceDialog({ defaultClientId, onCreated }: { defaultClientId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(!!defaultClientId);
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [productLine, setProductLine] = useState<(typeof PRODUCT_LINES)[number]>('OTHER');
  const [purpose, setPurpose] = useState('');
  const [description, setDescription] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [vatRate, setVatRate] = useState('16');
  const [dueDate, setDueDate] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['crm-clients-picker'],
    queryFn: () => apiFetch<{ data: ClientOption[] }>('/platform/crm/clients?pageSize=200'),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/crm/invoices', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          productLine,
          purpose: productLine === 'OTHER' ? purpose : undefined,
          description,
          subtotal: Number(subtotal),
          vatRate: Number(vatRate),
          dueDate: new Date(dueDate).toISOString(),
        }),
      }),
    onSuccess: () => {
      notifySuccess('Invoice created');
      setOpen(false);
      setPurpose('');
      setDescription('');
      setSubtotal('');
      setDueDate('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to create invoice'),
  });

  const subtotalNum = Number(subtotal) || 0;
  const vatNum = Math.round((subtotalNum * (Number(vatRate) || 0)) / 100);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> New Invoice
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">New Invoice</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-3">
          <SearchableSelect
            options={(clients?.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={clientId}
            onChange={setClientId}
            placeholder="Select client..."
          />
          <select value={productLine} onChange={(e) => setProductLine(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {PRODUCT_LINES.map((l) => (
              <option key={l} value={l}>
                {l.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {productLine === 'OTHER' && (
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is this payment for? (required — shown on the invoice before the description)"
            />
          )}
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (e.g. Website development — phase 1)" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} placeholder="Subtotal (KES)" />
            <Input type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} placeholder="VAT %" />
          </div>
          {subtotalNum > 0 && (
            <p className="text-xs text-slate-500">
              VAT: KES {vatNum.toLocaleString()} — Total: KES {(subtotalNum + vatNum).toLocaleString()}
            </p>
          )}
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        </div>
        <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={
                !clientId ||
                !description.trim() ||
                !subtotalNum ||
                !dueDate ||
                (productLine === 'OTHER' && !purpose.trim()) ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CrmInvoicesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const pageSize = 15;
  const clientIdParam = searchParams.get('clientId') ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['crm-invoices', page, clientIdParam, overdueOnly],
    queryFn: () =>
      apiFetch<{ data: Invoice[]; meta: { total: number } }>(
        `/platform/crm/invoices?page=${page}&pageSize=${pageSize}${clientIdParam ? `&clientId=${clientIdParam}` : ''}${overdueOnly ? '&overdue=true' : ''}`,
      ),
  });

  const markPaid = useMutation({
    mutationFn: () => apiFetch(`/platform/crm/invoices/${payTarget!.id}/mark-paid`, { method: 'POST', body: JSON.stringify({ paymentMethod, paymentReference: paymentReference || undefined }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
      notifySuccess('Invoice marked paid');
      setPayTarget(null);
      setPaymentMethod('');
      setPaymentReference('');
    },
    onError: (err) => notifyError(err, 'Failed to mark paid'),
  });

  const send = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/crm/invoices/${id}/send`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
      notifySuccess('Invoice sent');
    },
    onError: (err) => notifyError(err, 'Failed to send invoice'),
  });

  async function downloadPdf(id: string, invoiceNumber: string) {
    const token = getAccessToken();
    const res = await fetch(`${API_ORIGIN}/platform/crm/invoices/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) {
      notifyError(undefined, 'Failed to download invoice');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const invoices = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">Company invoicing, VAT-inclusive, across every Hamzone product line.</p>
        </div>
        <CreateInvoiceDialog defaultClientId={clientIdParam} onCreated={() => queryClient.invalidateQueries({ queryKey: ['crm-invoices'] })} />
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">All Invoices</CardTitle>
          <button
            onClick={() => { setOverdueOnly((v) => !v); setPage(1); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              overdueOnly ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            Overdue only
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Number</th>
                    <th className="py-2 font-medium">Client</th>
                    <th className="py-2 font-medium">Total</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Due</th>
                    <th className="py-2 font-medium">Delivery</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-2 text-slate-500">{inv.client.name}</td>
                      <td className="py-2 text-slate-500">KES {inv.total.toLocaleString()}</td>
                      <td className="py-2">
                        <Badge status={inv.status} />
                      </td>
                      <td className="py-2 text-slate-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="py-2">
                        <DeliveryBadges inv={inv} />
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => downloadPdf(inv.id, inv.invoiceNumber)} title="Download PDF">
                            <Download size={13} />
                          </Button>
                          <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate(inv.id)} title="Send by email/SMS">
                            <Send size={13} />
                          </Button>
                          {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                            <Button size="sm" onClick={() => setPayTarget(inv)}>
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPageChange={setPage} totalItems={total} pageSize={pageSize} />
            </>
          )}
        </CardContent>
      </Card>

      {payTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Mark {payTarget.invoiceNumber} as paid</h3>
            <div className="mt-4 space-y-3">
              <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Payment method (e.g. M-Pesa, Bank)" />
              <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Reference (optional)" />
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPayTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" disabled={!paymentMethod.trim() || markPaid.isPending} onClick={() => markPaid.mutate()}>
                {markPaid.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
