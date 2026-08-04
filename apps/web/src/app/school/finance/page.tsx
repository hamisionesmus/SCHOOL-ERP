'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { cn } from '@/lib/utils';
import { useDraftState } from '@/hooks/use-draft-state';

interface GradeLevel {
  id: string;
  name: string;
}
interface AcademicYear {
  id: string;
  name: string;
}
interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  term: number;
  gradeLevel: GradeLevel;
  academicYear: AcademicYear;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface MpesaRequest {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount: number;
}
interface Payment {
  id: string;
  amount: number;
  method: string;
  receiptNumber: string;
  createdAt: string;
}
interface Invoice {
  id: string;
  term: number;
  amount: number;
  balance: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  student: Student;
  payments?: Payment[];
  mpesaRequests?: MpesaRequest[];
}

type FeeStructureDraft = { name: string; gradeLevelId: string; academicYearId: string; term: string; amount: string };

export default function FinancePage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [mpesaPhoneDrafts, setMpesaPhoneDrafts] = useState<Record<string, string>>({});
  const { loadDraft, saveDraft, clearDraft } = useDraftState<FeeStructureDraft>('finance-fee-structure');
  const feeDraft = loadDraft();
  const [feeName, setFeeName] = useState(feeDraft?.name ?? '');
  const [feeGradeLevelId, setFeeGradeLevelId] = useState(feeDraft?.gradeLevelId ?? '');
  const [feeAcademicYearId, setFeeAcademicYearId] = useState(feeDraft?.academicYearId ?? '');
  const [feeTerm, setFeeTerm] = useState(feeDraft?.term ?? '');
  const [feeAmount, setFeeAmount] = useState(feeDraft?.amount ?? '');

  useEffect(() => {
    saveDraft({ name: feeName, gradeLevelId: feeGradeLevelId, academicYearId: feeAcademicYearId, term: feeTerm, amount: feeAmount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeName, feeGradeLevelId, feeAcademicYearId, feeTerm, feeAmount]);

  const perms = user?.permissions ?? [];
  const isStaff = perms.includes('FINANCE:EDIT') || perms.includes('FINANCE:RECEIVE_PAYMENT');
  const canReceive = perms.includes('FINANCE:RECEIVE_PAYMENT');

  const { data: gradeLevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => apiFetch<GradeLevel[]>('/grade-levels'),
    enabled: !!user,
  });
  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<AcademicYear[]>('/academic-years'),
    enabled: !!user,
  });
  const { data: feeStructures } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => apiFetch<FeeStructure[]>('/finance/fee-structures'),
    enabled: !!user,
  });
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiFetch<Invoice[]>('/finance/invoices'),
    enabled: !!user,
  });

  const invalidateInvoices = () => queryClient.invalidateQueries({ queryKey: ['invoices'] });

  const createFeeStructure = useMutation({
    mutationFn: () =>
      apiFetch('/finance/fee-structures', {
        method: 'POST',
        body: JSON.stringify({
          name: feeName,
          gradeLevelId: feeGradeLevelId,
          academicYearId: feeAcademicYearId,
          term: Number(feeTerm),
          amount: Number(feeAmount),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setShowFeeForm(false);
      setError(null);
      setFeeName('');
      setFeeGradeLevelId('');
      setFeeAcademicYearId('');
      setFeeTerm('');
      setFeeAmount('');
      clearDraft();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create fee structure'),
  });

  const generateInvoices = useMutation({
    mutationFn: (feeStructureId: string) =>
      apiFetch<{ generated: number; skipped: number }>('/finance/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ feeStructureId, dueDate: new Date().toISOString().slice(0, 10) }),
      }),
    onSuccess: (res) => {
      invalidateInvoices();
      setError(null);
      alert(`Generated ${res.generated} invoice(s), ${res.skipped} already existed.`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to generate invoices'),
  });

  const recordPayment = useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: number }) =>
      apiFetch(`/finance/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, method: 'CASH' }),
      }),
    onSuccess: invalidateInvoices,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to record payment'),
  });

  const initiateMpesa = useMutation({
    mutationFn: ({ invoiceId, phoneNumber }: { invoiceId: string; phoneNumber: string }) =>
      apiFetch(`/finance/invoices/${invoiceId}/mpesa-stk`, {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      }),
    onSuccess: invalidateInvoices,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to initiate M-Pesa STK push'),
  });

  const confirmMpesa = useMutation({
    mutationFn: (stkRequestId: string) =>
      apiFetch(`/finance/mpesa-stk/${stkRequestId}/confirm`, { method: 'PATCH' }),
    onSuccess: invalidateInvoices,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to confirm M-Pesa payment'),
  });

  const feeStructuresTable = useTableControls(feeStructures ?? [], { pageSize: 8, initialSortKey: 'name' });
  const invoicesTable = useTableControls(invoices ?? [], { pageSize: 6 });

  if (!user) return null;

  return (
    <>
          {isStaff && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Fee structures</CardTitle>
            <Button size="sm" onClick={() => setShowFeeForm((v) => !v)}>
              {showFeeForm ? 'Cancel' : '+ New fee structure'}
            </Button>
          </CardHeader>
          <CardContent>
            {showFeeForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createFeeStructure.mutate();
                }}
                className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
              >
                <Input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="e.g. Grade 4 Term 2 Fees" required className="col-span-2" />
                <select
                  value={feeGradeLevelId}
                  onChange={(e) => setFeeGradeLevelId(e.target.value)}
                  required
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Grade level</option>
                  {gradeLevels?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={feeAcademicYearId}
                  onChange={(e) => setFeeAcademicYearId(e.target.value)}
                  required
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Academic year</option>
                  {academicYears?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
                <Input value={feeTerm} onChange={(e) => setFeeTerm(e.target.value)} type="number" min={1} placeholder="Term" required />
                <Input value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} type="number" min={1} placeholder="Amount (KES)" required />
                <div className="col-span-2">
                  <Button type="submit" disabled={createFeeStructure.isPending}>
                    {createFeeStructure.isPending ? 'Saving...' : 'Create fee structure'}
                  </Button>
                </div>
              </form>
            )}

            {!feeStructures || feeStructures.length === 0 ? (
              <p className="text-sm text-slate-500">No fee structures yet.</p>
            ) : (
              <>
              <ul className="flex flex-col gap-2">
                {feeStructuresTable.pageItems.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{f.name}</p>
                      <p className="text-xs text-slate-500">
                        {f.gradeLevel.name} · Term {f.term} · {f.academicYear.name} · KES {f.amount.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generateInvoices.isPending}
                      onClick={() => generateInvoices.mutate(f.id)}
                    >
                      Generate invoices
                    </Button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={feeStructuresTable.page}
                pageCount={feeStructuresTable.pageCount}
                totalItems={feeStructuresTable.totalItems}
                pageSize={feeStructuresTable.pageSize}
                onPageChange={feeStructuresTable.setPage}
              />
              </>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !invoices || invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <>
            <div className="mb-3 flex items-center gap-1 text-xs text-slate-500">
              Sort by:
              {(['balance', 'amount', 'status'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => invoicesTable.toggleSort(key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-medium capitalize transition-colors',
                    invoicesTable.sortKey === key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  {key} {invoicesTable.sortKey === key && (invoicesTable.sortDir === 'asc' ? '↑' : '↓')}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {invoicesTable.pageItems.map((inv) => {
                const pendingStk = inv.mpesaRequests?.find((r) => r.status === 'PENDING');
                return (
                  <div key={inv.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {inv.student.firstName} {inv.student.lastName} · Term {inv.term}
                        </p>
                        <p className="text-xs text-slate-500">
                          Amount KES {inv.amount.toLocaleString()} · Balance KES {inv.balance.toLocaleString()}
                        </p>
                      </div>
                      <Badge status={inv.status} />
                    </div>

                    {inv.payments && inv.payments.length > 0 && (
                      <ul className="mb-2 text-xs text-slate-500">
                        {inv.payments.map((p) => (
                          <li key={p.id}>
                            {p.receiptNumber}: KES {p.amount.toLocaleString()} ({p.method})
                          </li>
                        ))}
                      </ul>
                    )}

                    {canReceive && inv.balance > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={inv.balance}
                          placeholder="Amount"
                          className="h-8 w-28 text-xs"
                          value={paymentDrafts[inv.id] ?? ''}
                          onChange={(e) => setPaymentDrafts((d) => ({ ...d, [inv.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          disabled={recordPayment.isPending}
                          onClick={() =>
                            recordPayment.mutate({ invoiceId: inv.id, amount: Number(paymentDrafts[inv.id]) })
                          }
                        >
                          Record cash payment
                        </Button>

                        {pendingStk ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={confirmMpesa.isPending}
                            onClick={() => confirmMpesa.mutate(pendingStk.id)}
                          >
                            Simulate M-Pesa confirmation (KES {pendingStk.amount.toLocaleString()})
                          </Button>
                        ) : (
                          <>
                            <Input
                              placeholder="2547XXXXXXXX"
                              className="h-8 w-36 text-xs"
                              value={mpesaPhoneDrafts[inv.id] ?? ''}
                              onChange={(e) => setMpesaPhoneDrafts((d) => ({ ...d, [inv.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={initiateMpesa.isPending}
                              onClick={() =>
                                initiateMpesa.mutate({ invoiceId: inv.id, phoneNumber: mpesaPhoneDrafts[inv.id] })
                              }
                            >
                              Send M-Pesa STK push
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Pagination
              page={invoicesTable.page}
              pageCount={invoicesTable.pageCount}
              totalItems={invoicesTable.totalItems}
              pageSize={invoicesTable.pageSize}
              onPageChange={invoicesTable.setPage}
            />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
