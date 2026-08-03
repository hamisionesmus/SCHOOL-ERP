'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Landmark, TrendingUp, TrendingDown, Scale, CalendarDays } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';

interface FinanceOverview {
  totalIn: number;
  schoolRevenue: number;
  manualIn: number;
  totalOut: number;
  net: number;
  thisMonthIn: number;
  thisMonthOut: number;
  monthlyBreakdown: { month: string; in: number; out: number }[];
  byCategory: { category: string; amount: number }[];
}
interface FinanceEntry {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  description: string | null;
  createdAt: string;
  recordedBy: { fullName: string };
}
interface EntriesPage {
  data: FinanceEntry[];
  meta: { page: number; pageSize: number; total: number };
}

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
}

export default function FinancePage() {
  useRequireFinanceAccess();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ['finance-overview'],
    queryFn: () => apiFetch<FinanceOverview>('/platform/finance/overview'),
  });

  const entriesQuery = useQuery({
    queryKey: ['finance-entries', page],
    queryFn: () => apiFetch<EntriesPage>(`/platform/finance/entries?page=${page}&pageSize=15`),
  });

  const createEntry = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/platform/finance/entries', {
        method: 'POST',
        body: JSON.stringify({
          type: fd.get('type'),
          category: fd.get('category'),
          amount: Number(fd.get('amount')),
          description: fd.get('description') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
      queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      setShowForm(false);
      notifySuccess('Entry recorded');
    },
    onError: (err) => notifyError(err, 'Failed to record entry'),
  });

  const overview = overviewQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Landmark size={22} className="text-slate-400" />
            Finance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            School payment revenue plus manual money in/out — salaries, hosting, and other costs.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add entry'}</Button>
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total in" value={overview.totalIn} formatValue={kes} icon={TrendingUp} accent="emerald" />
          <StatCard label="Total out" value={overview.totalOut} formatValue={kes} icon={TrendingDown} accent="rose" />
          <StatCard label="Net" value={overview.net} formatValue={kes} icon={Scale} accent="blue" />
          <StatCard
            label="This month"
            value={overview.thisMonthIn - overview.thisMonthOut}
            formatValue={kes}
            icon={CalendarDays}
            accent="violet"
            hint={`In ${kes(overview.thisMonthIn)} · Out ${kes(overview.thisMonthOut)}`}
          />
        </div>
      ) : null}

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createEntry.mutate(new FormData(e.currentTarget));
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4"
            >
              <select
                name="type"
                required
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <option value="IN">Money in</option>
                <option value="OUT">Money out</option>
              </select>
              <Input name="category" placeholder="Category (e.g. Sub-Admin Salary)" required />
              <Input name="amount" type="number" min={1} placeholder="Amount (KES)" required />
              <Input name="description" placeholder="Description (optional)" />
              <div className="sm:col-span-4">
                <Button type="submit" disabled={createEntry.isPending}>
                  {createEntry.isPending ? 'Saving...' : 'Save entry'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {overview && overview.monthlyBreakdown.some((m) => m.in > 0 || m.out > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly in vs. out</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={overview.monthlyBreakdown.map((m) => ({ ...m, month: formatMonthLabel(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => kes(Number(v))} />
                <Legend />
                <Bar dataKey="in" name="In" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Out" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {overview && overview.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {overview.byCategory
                .sort((a, b) => b.amount - a.amount)
                .map((c) => (
                  <li key={c.category} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm">
                    <span className="text-slate-700">{c.category}</span>
                    <span className="font-medium text-slate-900">{kes(c.amount)}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesQuery.isLoading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : !entriesQuery.data || entriesQuery.data.data.length === 0 ? (
            <p className="text-sm text-slate-500">No manual entries yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Recorded by</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entriesQuery.data.data.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            e.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {e.type === 'IN' ? 'In' : 'Out'}
                        </span>
                      </td>
                      <td className="py-2 text-slate-700">
                        {e.category}
                        {e.description && <div className="text-xs text-slate-400">{e.description}</div>}
                      </td>
                      <td className="py-2 font-medium text-slate-900">{kes(e.amount)}</td>
                      <td className="py-2 text-slate-500">{e.recordedBy.fullName}</td>
                      <td className="py-2 text-slate-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={entriesQuery.data.meta.page}
                pageCount={Math.max(1, Math.ceil(entriesQuery.data.meta.total / entriesQuery.data.meta.pageSize))}
                totalItems={entriesQuery.data.meta.total}
                pageSize={entriesQuery.data.meta.pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
