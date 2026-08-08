'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const TYPES = ['ACCOUNT_MANAGEMENT', 'TASKING', 'OUTLIER', 'HANDSHAKE', 'OTHER'] as const;
const PERIODS = ['DAILY', 'WEEKLY'] as const;

interface Earning {
  id: string;
  period: string;
  periodDate: string;
  amount: number;
  challenges: string | null;
  notes: string | null;
}
interface Entry {
  id: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  type: string;
  status: string;
  receivedAt: string;
  loginBrowser: string | null;
  notes: string | null;
  createdBy: { fullName: string };
  assignedTo: { id: string; fullName: string } | null;
  assignedToExternalName: string | null;
  earnings: Earning[];
}

function AddEntryDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('OTHER');
  const [receivedAt, setReceivedAt] = useState('');
  const [loginBrowser, setLoginBrowser] = useState('');
  const [assignedToExternalName, setAssignedToExternalName] = useState('');
  const [assignedToExternalPhone, setAssignedToExternalPhone] = useState('');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/outreach/entries', {
        method: 'POST',
        body: JSON.stringify({
          contactName,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          type,
          receivedAt: new Date(receivedAt).toISOString(),
          loginBrowser: loginBrowser || undefined,
          assignedToExternalName: assignedToExternalName || undefined,
          assignedToExternalPhone: assignedToExternalPhone || undefined,
          notes: notes || undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Entry logged');
      setOpen(false);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setReceivedAt('');
      setLoginBrowser('');
      setAssignedToExternalName('');
      setAssignedToExternalPhone('');
      setNotes('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to log entry'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Log Entry
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Log Outreach Entry</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-3">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" />
            <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email (optional)" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value as never)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          <Input value={loginBrowser} onChange={(e) => setLoginBrowser(e.target.value)} placeholder="Login browser (e.g. Chrome, iX Browser, GoLogin, MoreLogin)" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={assignedToExternalName} onChange={(e) => setAssignedToExternalName(e.target.value)} placeholder="Assign to (name, optional)" />
            <Input value={assignedToExternalPhone} onChange={(e) => setAssignedToExternalPhone(e.target.value)} placeholder="Their phone (optional)" />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes / details..."
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
        </div>
        </div>
        <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!contactName.trim() || !receivedAt || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EarningForm({ entryId, onAdded }: { entryId: string; onAdded: () => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('DAILY');
  const [periodDate, setPeriodDate] = useState('');
  const [amount, setAmount] = useState('');
  const [challenges, setChallenges] = useState('');

  const add = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/outreach/entries/${entryId}/earnings`, {
        method: 'POST',
        body: JSON.stringify({ period, periodDate: new Date(periodDate).toISOString(), amount: Number(amount), challenges: challenges || undefined }),
      }),
    onSuccess: () => {
      notifySuccess('Earning recorded');
      setPeriodDate('');
      setAmount('');
      setChallenges('');
      onAdded();
    },
    onError: (err) => notifyError(err, 'Failed to record earning'),
  });

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
      <select value={period} onChange={(e) => setPeriod(e.target.value as never)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <Input className="h-9 w-36 text-xs" type="date" value={periodDate} onChange={(e) => setPeriodDate(e.target.value)} />
      <Input className="h-9 w-28 text-xs" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
      <Input className="h-9 flex-1 text-xs" value={challenges} onChange={(e) => setChallenges(e.target.value)} placeholder="Challenges (optional)" />
      <Button size="sm" disabled={!periodDate || !amount || add.isPending} onClick={() => add.mutate()}>
        Add
      </Button>
    </div>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const totalEarnings = entry.earnings.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="rounded-lg border border-slate-200">
      <button className="flex w-full items-center justify-between p-3 text-left" onClick={() => setExpanded((v) => !v)}>
        <div>
          <p className="text-sm font-medium text-slate-900">{entry.contactName}</p>
          <p className="text-xs text-slate-400">
            {entry.contactPhone ?? entry.contactEmail ?? '—'} · Received {new Date(entry.receivedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={entry.type} />
          <Badge status={entry.status} />
          {totalEarnings > 0 && <span className="text-xs font-medium text-emerald-600">KES {totalEarnings.toLocaleString()}</span>}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <p>Assigned to: {entry.assignedTo?.fullName ?? entry.assignedToExternalName ?? '—'}</p>
            {entry.loginBrowser && <p>Login browser: {entry.loginBrowser}</p>}
            <p>Logged by: {entry.createdBy.fullName}</p>
          </div>
          {entry.notes && <p className="text-sm text-slate-700">{entry.notes}</p>}

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Earnings</p>
            {entry.earnings.length === 0 ? (
              <p className="text-xs text-slate-400">None recorded yet.</p>
            ) : (
              <div className="space-y-1">
                {entry.earnings.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      {e.period} · {new Date(e.periodDate).toLocaleDateString()}
                    </span>
                    <span className="font-medium text-slate-900">KES {e.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <EarningForm entryId={entry.id} onAdded={() => queryClient.invalidateQueries({ queryKey: ['outreach-entries'] })} />
        </div>
      )}
    </div>
  );
}

export default function OutreachPage() {
  const queryClient = useQueryClient();
  const role = getSessionUser()?.role;
  const canCreate = role === 'SUPER_ADMIN' || role === 'SUB_ADMIN' || role === 'ASSISTANT_SUPER_ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const { data: entries, isLoading } = useQuery({ queryKey: ['outreach-entries'], queryFn: () => apiFetch<Entry[]>('/platform/outreach/entries') });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Outreach</h1>
          <p className="text-sm text-slate-500">
            A personal log — not Hamzone company business. Only you (and whoever it&apos;s assigned to) can see it.
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Link href="/dashboard/outreach/workers">
              <Button variant="outline" className="gap-1.5">
                <Users size={15} /> Workers
              </Button>
            </Link>
          )}
          {canCreate && <AddEntryDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['outreach-entries'] })} />}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Entries</CardTitle>
          <CardDescription>Click one to see details and record earnings.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !entries || entries.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing logged yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
