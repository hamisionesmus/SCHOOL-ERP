'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';

interface ClientTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assignedTo: { id: string; fullName: string };
  hamzoneClient: { id: string } | null;
}

const CLIENT_STAGES = ['ONBOARDING', 'ACTIVE', 'AT_RISK', 'DORMANT', 'CHURNED'] as const;
const NEXT_STATUS: Record<'TODO' | 'IN_PROGRESS' | 'DONE', 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
};

interface ClientDetail {
  id: string;
  name: string;
  type: string;
  stage: (typeof CLIENT_STAGES)[number];
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
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const me = getSessionUser();

  const { data, isLoading } = useQuery({
    queryKey: ['crm-client', id],
    queryFn: () => apiFetch<ClientDetail>(`/platform/crm/clients/${id}`),
  });

  // Any admin can see this client's tasks regardless of who they're assigned to, matching CRM's
  // "all admins are marketers here" openness elsewhere — /platform/staff-tasks (no query param) is
  // the broader admin-tier listing, filtered client-side to this client since the endpoint has no
  // hamzoneClientId filter of its own.
  const { data: allTasks } = useQuery({
    queryKey: ['staff-tasks-all'],
    queryFn: () => apiFetch<ClientTask[]>('/platform/staff-tasks'),
  });
  const clientTasks = (allTasks ?? []).filter((t) => t.hamzoneClient?.id === id);

  const addTask = useMutation({
    mutationFn: () =>
      apiFetch('/platform/staff-tasks', {
        method: 'POST',
        body: JSON.stringify({
          assignedToUserId: me?.sub,
          title: taskTitle,
          dueDate: taskDueDate || undefined,
          hamzoneClientId: id,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tasks-all'] });
      setTaskTitle('');
      setTaskDueDate('');
      notifySuccess('Task added');
    },
    onError: (err) => notifyError(err, 'Failed to add task'),
  });

  const setTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: ClientTask['status'] }) =>
      apiFetch(`/platform/staff-tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tasks-all'] });
    },
    onError: (err) => notifyError(err, 'Failed to update task'),
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

  const updateStage = useMutation({
    mutationFn: (stage: string) => apiFetch(`/platform/crm/clients/${id}`, { method: 'PATCH', body: JSON.stringify({ name: data?.name, stage }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-client', id] });
      notifySuccess('Stage updated');
    },
    onError: (err) => notifyError(err, 'Failed to update stage'),
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
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Badge status={data.type} /> {data.productLines.map((l) => l.replace(/_/g, ' ')).join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={data.stage}
              disabled={updateStage.isPending}
              onChange={(e) => updateStage.mutate(e.target.value)}
              className="h-9 rounded-md border border-slate-300 px-2.5 text-sm"
              title="Pipeline stage"
            >
              {CLIENT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <Button onClick={() => router.push(`/dashboard/crm/invoices?clientId=${id}`)} className="gap-1.5">
              <Plus size={15} /> New Invoice
            </Button>
          </div>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Call back about renewal"
                  className="flex-1"
                />
                <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="sm:w-40" />
              </div>
              <Button size="sm" disabled={!taskTitle.trim() || addTask.isPending} onClick={() => addTask.mutate()}>
                {addTask.isPending ? 'Adding...' : 'Add task'}
              </Button>
              <div className="space-y-2 border-t border-slate-100 pt-3">
                {clientTasks.length === 0 ? (
                  <p className="text-xs text-slate-400">No tasks linked to this client yet.</p>
                ) : (
                  clientTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <p className={t.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-700'}>{t.title}</p>
                        <p className="text-xs text-slate-400">
                          {t.assignedTo.fullName}
                          {t.dueDate && ` · Due ${new Date(t.dueDate).toLocaleDateString()}`}
                        </p>
                      </div>
                      {t.assignedTo.id === me?.sub && (
                        <button
                          onClick={() => setTaskStatus.mutate({ taskId: t.id, status: NEXT_STATUS[t.status] })}
                          disabled={setTaskStatus.isPending}
                          className="whitespace-nowrap rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-slate-300"
                        >
                          {t.status.replace(/_/g, ' ')} →
                        </button>
                      )}
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
